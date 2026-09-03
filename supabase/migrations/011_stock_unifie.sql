-- ============================================================
-- MIGRATION 011 — Lot 1 : écriture unifiée du stock
-- ------------------------------------------------------------
-- Avant : 5 chemins d'écriture concurrents dans stock_levels
--   (3 fonctions SQL + 2 fonctions TypeScript sans verrou ni
--   transaction). Résultats : transferts partiellement appliqués,
--   mises à jour perdues en cas de vente concurrente, erreur
--   « Stock introuvable » quand la ligne de stock n'existe pas.
--
-- Après : TOUTE écriture de stock passe par
--   appliquer_mouvement_stock() — verrou FOR UPDATE, création de
--   la ligne manquante, contrôle du négatif, journalisation du
--   mouvement, le tout dans la transaction de l'appelant.
-- ============================================================

-- ── 1. Point d'entrée unique ──────────────────────────────────
-- p_delta est SIGNÉ : positif = entrée, négatif = sortie.
-- Retourne { succes, stock_avant, stock_apres, mouvement } ou
--          { succes: false, erreur }.
CREATE OR REPLACE FUNCTION appliquer_mouvement_stock(
    p_shop_id           UUID,
    p_product_id        UUID,
    p_warehouse_id      UUID,
    p_delta             NUMERIC,
    p_type_mouvement    TEXT,
    p_reference_type    TEXT    DEFAULT NULL,
    p_reference_id      UUID    DEFAULT NULL,
    p_reference_pid     TEXT    DEFAULT NULL,
    p_note              TEXT    DEFAULT NULL,
    p_user_id           UUID    DEFAULT NULL,
    p_autoriser_negatif BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_produit_nom  TEXT;
    v_avant        NUMERIC;
    v_apres        NUMERIC;
    v_mvt_pid      TEXT;
BEGIN
    -- Cohérence du sens : le type de mouvement impose le signe.
    -- (« inventaire » est le seul type qui va dans les deux sens.)
    IF p_type_mouvement IN ('entree_initiale','reception','retour_vente',
                            'transfert_entree','ajustement_positif')
       AND p_delta < 0 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Mouvement « ' || p_type_mouvement || ' » incompatible avec une sortie de stock.');
    END IF;

    IF p_type_mouvement IN ('vente','retour_fournisseur',
                            'transfert_sortie','ajustement_negatif')
       AND p_delta > 0 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Mouvement « ' || p_type_mouvement || ' » incompatible avec une entrée de stock.');
    END IF;

    -- Mouvement nul : rien à écrire, pas de ligne de journal.
    IF p_delta = 0 THEN
        RETURN jsonb_build_object('succes', true, 'ignore', true);
    END IF;

    -- Cloisonnement : le produit et l'entrepôt appartiennent à la boutique.
    SELECT nom INTO v_produit_nom
    FROM products
    WHERE id = p_product_id AND shop_id = p_shop_id;

    IF v_produit_nom IS NULL THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Produit introuvable dans cette boutique.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM warehouses
        WHERE id = p_warehouse_id AND shop_id = p_shop_id
    ) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    -- La ligne de stock est créée à la volée si elle manque : une
    -- absence de ligne vaut zéro, jamais « Stock introuvable ».
    INSERT INTO stock_levels (shop_id, product_id, warehouse_id, quantite)
    VALUES (p_shop_id, p_product_id, p_warehouse_id, 0)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    -- Verrou : plus aucune écriture concurrente ne peut s'intercaler
    -- entre la lecture et l'écriture.
    SELECT quantite INTO v_avant
    FROM stock_levels
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    v_apres := v_avant + p_delta;

    IF v_apres < 0 AND NOT p_autoriser_negatif THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Stock insuffisant pour ' || v_produit_nom ||
                      ' (disponible : ' || v_avant || ', demandé : ' || ABS(p_delta) || ')');
    END IF;

    UPDATE stock_levels
    SET quantite = v_apres, updated_at = NOW()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    SELECT generate_public_id(p_shop_id, 'MVT') INTO v_mvt_pid;

    INSERT INTO stock_movements (
        public_id, shop_id, product_id, warehouse_id,
        type_mouvement, quantite, quantite_avant, quantite_apres,
        reference_type, reference_id, reference_public_id,
        note, created_by
    ) VALUES (
        v_mvt_pid, p_shop_id, p_product_id, p_warehouse_id,
        p_type_mouvement, ABS(p_delta), v_avant, v_apres,
        p_reference_type, p_reference_id, p_reference_pid,
        p_note, p_user_id
    );

    RETURN jsonb_build_object(
        'succes',      true,
        'stock_avant', v_avant,
        'stock_apres', v_apres,
        'mouvement',   v_mvt_pid
    );
END;
$$ LANGUAGE plpgsql;

-- ── 2. Vente : deduire_stock délègue ──────────────────────────
-- Signature inchangée pour ne pas toucher enregistrer_vente().
CREATE OR REPLACE FUNCTION deduire_stock(
    p_shop_id        UUID,
    p_product_id     UUID,
    p_warehouse_id   UUID,
    p_quantite       NUMERIC,
    p_reference_type TEXT,
    p_reference_id   UUID,
    p_reference_pid  TEXT,
    p_user_id        UUID
)
RETURNS JSONB AS $$
DECLARE
    v_res JSONB;
BEGIN
    v_res := appliquer_mouvement_stock(
        p_shop_id, p_product_id, p_warehouse_id,
        -p_quantite, 'vente',
        p_reference_type, p_reference_id, p_reference_pid,
        NULL, p_user_id, FALSE
    );

    IF NOT (v_res->>'succes')::BOOLEAN THEN
        RETURN v_res;
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'stock_restant', (v_res->>'stock_apres')::NUMERIC
    );
END;
$$ LANGUAGE plpgsql;

-- ── 3. Transfert inter-entrepôts : atomique ───────────────────
-- p_data = { shop_id, warehouse_from, warehouse_to, note,
--            user_id, items: [{ product_id, quantite }] }
-- Tout s'applique ou rien : le bloc EXCEPTION annule l'ensemble.
CREATE OR REPLACE FUNCTION effectuer_transfert(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_shop_id    UUID := (p_data->>'shop_id')::UUID;
    v_from       UUID := (p_data->>'warehouse_from')::UUID;
    v_to         UUID := (p_data->>'warehouse_to')::UUID;
    v_user_id    UUID := NULLIF(p_data->>'user_id', '')::UUID;
    v_pid        TEXT;
    v_transfert  UUID;
    v_item       JSONB;
    v_qte        NUMERIC;
    v_res        JSONB;
    v_nb         INTEGER := 0;
BEGIN
    IF v_from = v_to THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Les entrepôts source et destination doivent être différents.');
    END IF;

    IF jsonb_array_length(COALESCE(p_data->'items', '[]'::JSONB)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;

    IF (SELECT COUNT(*) FROM warehouses
        WHERE id IN (v_from, v_to) AND shop_id = v_shop_id) <> 2 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    SELECT generate_public_id(v_shop_id, 'TRF') INTO v_pid;

    INSERT INTO stock_transfers (
        public_id, shop_id, warehouse_from, warehouse_to,
        statut, note, created_by
    ) VALUES (
        v_pid, v_shop_id, v_from, v_to,
        'valide', NULLIF(p_data->>'note', ''), v_user_id
    ) RETURNING id INTO v_transfert;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_qte := (v_item->>'quantite')::NUMERIC;

        IF v_qte IS NULL OR v_qte <= 0 THEN
            RAISE EXCEPTION 'Quantité invalide dans le transfert.';
        END IF;

        -- Sortie de l'entrepôt source
        v_res := appliquer_mouvement_stock(
            v_shop_id, (v_item->>'product_id')::UUID, v_from,
            -v_qte, 'transfert_sortie',
            'transfer', v_transfert, v_pid, NULL, v_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;

        -- Entrée dans l'entrepôt destination
        v_res := appliquer_mouvement_stock(
            v_shop_id, (v_item->>'product_id')::UUID, v_to,
            v_qte, 'transfert_entree',
            'transfer', v_transfert, v_pid, NULL, v_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;

        INSERT INTO stock_transfer_items (shop_id, transfer_id, product_id, quantite)
        VALUES (v_shop_id, v_transfert, (v_item->>'product_id')::UUID, v_qte);

        v_nb := v_nb + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'succes', true, 'transfer_id', v_transfert,
        'public_id', v_pid, 'nb_lignes', v_nb
    );
EXCEPTION WHEN OTHERS THEN
    -- Le transfert entier est annulé, y compris les lignes déjà appliquées.
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 4. Ajustement de stock : atomique ─────────────────────────
-- p_data = { shop_id, warehouse_id, motif, note, user_id,
--            items: [{ product_id, quantite_apres }] }
CREATE OR REPLACE FUNCTION effectuer_ajustement(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_shop_id   UUID := (p_data->>'shop_id')::UUID;
    v_wh        UUID := (p_data->>'warehouse_id')::UUID;
    v_user_id   UUID := NULLIF(p_data->>'user_id', '')::UUID;
    v_motif     TEXT := NULLIF(p_data->>'motif', '');
    v_pid       TEXT;
    v_adj       UUID;
    v_item      JSONB;
    v_product   UUID;
    v_apres     NUMERIC;
    v_avant     NUMERIC;
    v_delta     NUMERIC;
    v_res       JSONB;
    v_nb        INTEGER := 0;
BEGIN
    IF v_motif IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Le motif est obligatoire.');
    END IF;

    IF jsonb_array_length(COALESCE(p_data->'items', '[]'::JSONB)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_wh AND shop_id = v_shop_id) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    SELECT generate_public_id(v_shop_id, 'ADJ') INTO v_pid;

    INSERT INTO stock_adjustments (public_id, shop_id, warehouse_id, motif, note, created_by)
    VALUES (v_pid, v_shop_id, v_wh, v_motif, NULLIF(p_data->>'note', ''), v_user_id)
    RETURNING id INTO v_adj;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_product := (v_item->>'product_id')::UUID;
        v_apres   := (v_item->>'quantite_apres')::NUMERIC;

        IF v_apres IS NULL OR v_apres < 0 THEN
            RAISE EXCEPTION 'Quantité après ajustement invalide.';
        END IF;

        -- On verrouille la ligne AVANT de calculer l'écart : la
        -- quantité lue ne peut plus bouger d'ici l'écriture.
        INSERT INTO stock_levels (shop_id, product_id, warehouse_id, quantite)
        VALUES (v_shop_id, v_product, v_wh, 0)
        ON CONFLICT (product_id, warehouse_id) DO NOTHING;

        SELECT quantite INTO v_avant
        FROM stock_levels
        WHERE product_id = v_product AND warehouse_id = v_wh
        FOR UPDATE;

        v_delta := v_apres - v_avant;

        IF v_delta <> 0 THEN
            v_res := appliquer_mouvement_stock(
                v_shop_id, v_product, v_wh,
                v_delta,
                CASE WHEN v_delta > 0 THEN 'ajustement_positif' ELSE 'ajustement_negatif' END,
                'adjustment', v_adj, v_pid, v_motif, v_user_id, FALSE
            );
            IF NOT (v_res->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION '%', v_res->>'erreur';
            END IF;

            INSERT INTO stock_adjustment_items (
                shop_id, adjustment_id, product_id,
                quantite_avant, quantite_apres, ecart
            ) VALUES (
                v_shop_id, v_adj, v_product, v_avant, v_apres, v_delta
            );

            v_nb := v_nb + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'succes', true, 'adjustment_id', v_adj,
        'public_id', v_pid, 'nb_lignes', v_nb
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 5. Réception : délègue la partie stock ────────────────────
CREATE OR REPLACE FUNCTION enregistrer_reception(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_rec_id        UUID;
    v_rec_public_id TEXT;
    v_item          JSONB;
    v_shop_id       UUID;
    v_warehouse_id  UUID;
    v_user_id       UUID;
    v_product_id    UUID;
    v_res           JSONB;
BEGIN
    v_shop_id      := (p_data->>'shop_id')::UUID;
    v_warehouse_id := (p_data->>'warehouse_id')::UUID;
    v_user_id      := (p_data->>'user_id')::UUID;

    SELECT generate_public_id(v_shop_id, 'REC') INTO v_rec_public_id;

    INSERT INTO receptions (
        public_id, shop_id, po_id, supplier_id,
        warehouse_id, date_reception, montant_total, notes, created_by
    ) VALUES (
        v_rec_public_id, v_shop_id,
        NULLIF(p_data->>'po_id', '')::UUID,
        (p_data->>'supplier_id')::UUID,
        v_warehouse_id,
        CURRENT_DATE,
        (p_data->>'montant_total')::NUMERIC,
        NULLIF(p_data->>'notes', ''),
        v_user_id
    ) RETURNING id INTO v_rec_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_product_id := NULLIF(v_item->>'product_id', '')::UUID;

        INSERT INTO reception_items (
            shop_id, reception_id, product_id, poi_id,
            designation, quantite_recue, prix_unitaire
        ) VALUES (
            v_shop_id, v_rec_id, v_product_id,
            NULLIF(v_item->>'poi_id', '')::UUID,
            v_item->>'designation',
            (v_item->>'quantite')::NUMERIC,
            (v_item->>'prix_unitaire')::NUMERIC
        );

        -- Ligne libre (hors catalogue) : pas de mouvement de stock.
        IF v_product_id IS NOT NULL THEN
            v_res := appliquer_mouvement_stock(
                v_shop_id, v_product_id, v_warehouse_id,
                (v_item->>'quantite')::NUMERIC, 'reception',
                'reception', v_rec_id, v_rec_public_id, NULL, v_user_id, FALSE
            );
            IF NOT (v_res->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION '%', v_res->>'erreur';
            END IF;

            UPDATE products
            SET prix_achat = (v_item->>'prix_unitaire')::NUMERIC
            WHERE id = v_product_id AND shop_id = v_shop_id;
        END IF;

        IF NULLIF(v_item->>'poi_id', '') IS NOT NULL THEN
            UPDATE purchase_order_items
            SET quantite_recue = quantite_recue + (v_item->>'quantite')::NUMERIC
            WHERE id = NULLIF(v_item->>'poi_id', '')::UUID;
        END IF;
    END LOOP;

    IF NULLIF(p_data->>'po_id', '') IS NOT NULL THEN
        UPDATE purchase_orders SET
            statut = CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM purchase_order_items
                    WHERE purchase_order_id = NULLIF(p_data->>'po_id', '')::UUID
                      AND quantite_recue < quantite_cmd
                ) THEN 'recu'
                ELSE 'partiellement_recu'
            END
        WHERE id = NULLIF(p_data->>'po_id', '')::UUID;
    END IF;

    UPDATE suppliers
    SET solde_dû = solde_dû + (p_data->>'montant_total')::NUMERIC
    WHERE id = (p_data->>'supplier_id')::UUID
      AND shop_id = v_shop_id;

    RETURN jsonb_build_object(
        'succes', true,
        'reception_id', v_rec_id,
        'public_id', v_rec_public_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 6. Rattrapage : une ligne de stock par produit × entrepôt ─
-- Un produit créé dans un entrepôt était invendable depuis les
-- autres (« Stock introuvable »). On matérialise à zéro les
-- lignes manquantes de l'existant.
INSERT INTO stock_levels (shop_id, product_id, warehouse_id, quantite)
SELECT p.shop_id, p.id, w.id, 0
FROM products p
JOIN warehouses w ON w.shop_id = p.shop_id
LEFT JOIN stock_levels sl
       ON sl.product_id = p.id AND sl.warehouse_id = w.id
WHERE sl.id IS NULL
ON CONFLICT (product_id, warehouse_id) DO NOTHING;
