-- ============================================================
-- MIGRATION 016 — Fournisseurs, Lot 2 :
--                 une seule dette, une seule caisse
-- ------------------------------------------------------------
-- Avant, le module tenait deux comptabilités parallèles :
--   • la RÉCEPTION ajoutait son montant à suppliers.solde_dû
--     ET la FACTURE ajoutait le sien → recevoir puis facturer
--     comptait la dette deux fois, sans aucun lien entre les
--     deux documents ;
--   • les paiements vivaient dans DEUX tables — supplier_payments
--     (paiement libre) et facture_fournisseur_payments (paiement
--     d'une facture). Le compte de résultat ne lisant que la
--     première, tout ce qui était payé sur facture n'apparaissait
--     dans aucun rapport de trésorerie.
--
-- Décision prise : LA FACTURE FAIT FOI. La réception constate la
-- marchandise ; si elle arrive sans facture, elle en crée une
-- marquée « à compléter » — la dette existe, le document est
-- signalé comme incomplet. Et il n'y a plus qu'une seule table de
-- paiements, avec lettrage optionnel sur facture.
-- ============================================================

-- ── 1. Liens et marqueurs ─────────────────────────────────────
ALTER TABLE factures_fournisseurs
    ADD COLUMN IF NOT EXISTS a_completer BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN factures_fournisseurs.a_completer IS
    'Facture créée automatiquement par une réception sans document : montants et références restent à compléter.';

ALTER TABLE receptions
    ADD COLUMN IF NOT EXISTS facture_id UUID REFERENCES factures_fournisseurs(id);

CREATE INDEX IF NOT EXISTS idx_receptions_facture_id ON receptions(facture_id);

-- Lettrage : un paiement peut solder une facture précise, ou rester
-- un règlement libre sur le solde (facture_id NULL).
ALTER TABLE supplier_payments
    ADD COLUMN IF NOT EXISTS facture_id UUID REFERENCES factures_fournisseurs(id);

CREATE INDEX IF NOT EXISTS idx_spay_facture_id ON supplier_payments(facture_id);

-- ── 2. Fusion des deux caisses ────────────────────────────────
-- Les paiements de factures rejoignent la table unique, en
-- conservant leur date, leur moyen et leur rattachement.
DO $$
DECLARE
    v_ligne  RECORD;
    v_pid    TEXT;
    v_avant  INTEGER;
    v_apres  INTEGER;
    v_reste  INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'facture_fournisseur_payments'
    ) THEN
        RAISE NOTICE 'Table facture_fournisseur_payments déjà fusionnée, rien à faire.';
        RETURN;
    END IF;

    SELECT count(*) INTO v_avant FROM facture_fournisseur_payments;

    FOR v_ligne IN
        SELECT p.*, f.supplier_id
        FROM facture_fournisseur_payments p
        JOIN factures_fournisseurs f ON f.id = p.facture_id
        WHERE NOT EXISTS (
            SELECT 1 FROM supplier_payments sp
            WHERE sp.facture_id = p.facture_id
              AND sp.montant    = p.montant
              AND sp.created_at = p.created_at
        )
        ORDER BY p.created_at
    LOOP
        SELECT generate_public_id(v_ligne.shop_id, 'SPAY') INTO v_pid;

        INSERT INTO supplier_payments (
            public_id, shop_id, supplier_id, facture_id,
            montant, moyen_paiement, reference, note,
            date_paiement, created_by, created_at
        ) VALUES (
            v_pid, v_ligne.shop_id, v_ligne.supplier_id, v_ligne.facture_id,
            v_ligne.montant, v_ligne.moyen_paiement, v_ligne.reference, v_ligne.note,
            v_ligne.created_at::DATE, v_ligne.created_by, v_ligne.created_at
        );
    END LOOP;

    -- Contrôle : tout paiement de facture doit avoir son équivalent
    -- dans la table unique avant qu'on retire l'ancienne.
    SELECT count(*) INTO v_apres
    FROM facture_fournisseur_payments p
    WHERE EXISTS (
        SELECT 1 FROM supplier_payments sp
        WHERE sp.facture_id = p.facture_id
          AND sp.montant    = p.montant
          AND sp.created_at = p.created_at
    );

    v_reste := v_avant - v_apres;

    IF v_reste <> 0 THEN
        RAISE EXCEPTION 'Fusion incomplète : % paiement(s) non repris, la table ancienne est conservée.', v_reste;
    END IF;

    RAISE NOTICE 'Paiements de factures repris dans supplier_payments : %', v_avant;
    DROP TABLE facture_fournisseur_payments;
END $$;

-- ── 3. La réception ne crée plus de dette ─────────────────────
-- Elle constate la marchandise et se rattache à une facture :
-- celle passée en paramètre, ou une facture « à compléter »
-- créée pour l'occasion.
CREATE OR REPLACE FUNCTION enregistrer_reception(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_rec_id        UUID;
    v_rec_public_id TEXT;
    v_item          JSONB;
    v_shop_id       UUID;
    v_warehouse_id  UUID;
    v_user_id       UUID;
    v_supplier_id   UUID;
    v_product_id    UUID;
    v_facture_id    UUID;
    v_facture_pid   TEXT;
    v_montant       NUMERIC;
    v_res           JSONB;
    v_creee         BOOLEAN := FALSE;
BEGIN
    v_shop_id      := (p_data->>'shop_id')::UUID;
    v_warehouse_id := (p_data->>'warehouse_id')::UUID;
    v_user_id      := (p_data->>'user_id')::UUID;
    v_supplier_id  := (p_data->>'supplier_id')::UUID;
    v_facture_id   := NULLIF(p_data->>'facture_id', '')::UUID;
    v_montant      := COALESCE((p_data->>'montant_total')::NUMERIC, 0);

    SELECT generate_public_id(v_shop_id, 'REC') INTO v_rec_public_id;

    -- Facture d'accompagnement : soit celle fournie (la dette existe
    -- déjà), soit une facture « à compléter » créée ici.
    IF v_facture_id IS NULL THEN
        SELECT generate_public_id(v_shop_id, 'FF') INTO v_facture_pid;

        INSERT INTO factures_fournisseurs (
            public_id, shop_id, supplier_id, warehouse_id, statut,
            date_facture, montant_ht, montant_tva, montant_ttc,
            montant_paye, montant_restant, a_completer, notes, created_by
        ) VALUES (
            v_facture_pid, v_shop_id, v_supplier_id, v_warehouse_id, 'non_payee',
            CURRENT_DATE, v_montant, 0, v_montant,
            0, v_montant, TRUE,
            'Créée automatiquement par la réception ' || v_rec_public_id ||
            ' : montants et référence fournisseur à compléter.',
            v_user_id
        ) RETURNING id INTO v_facture_id;

        v_creee := TRUE;

        -- La dette naît ici, une seule fois, portée par la facture.
        UPDATE suppliers
        SET solde_dû = solde_dû + v_montant
        WHERE id = v_supplier_id AND shop_id = v_shop_id;
    ELSE
        -- Facture déjà saisie : elle porte déjà la dette, on ne
        -- touche pas au solde.
        IF NOT EXISTS (
            SELECT 1 FROM factures_fournisseurs
            WHERE id = v_facture_id AND shop_id = v_shop_id
        ) THEN
            RETURN jsonb_build_object('succes', false,
                'erreur', 'Facture fournisseur introuvable dans cette boutique.');
        END IF;
    END IF;

    INSERT INTO receptions (
        public_id, shop_id, po_id, supplier_id,
        warehouse_id, date_reception, montant_total, notes,
        facture_id, created_by
    ) VALUES (
        v_rec_public_id, v_shop_id,
        NULLIF(p_data->>'po_id', '')::UUID,
        v_supplier_id, v_warehouse_id, CURRENT_DATE,
        v_montant, NULLIF(p_data->>'notes', ''),
        v_facture_id, v_user_id
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
                ) THEN 'recu_total'
                ELSE 'recu_partiel'
            END
        WHERE id = NULLIF(p_data->>'po_id', '')::UUID;
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'reception_id', v_rec_id,
        'public_id', v_rec_public_id,
        'facture_id', v_facture_id,
        'facture_creee', v_creee
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 4. Paiement d'une facture : atomique et verrouillé ────────
-- Remplace quatre requêtes séparées côté TypeScript, où deux
-- paiements simultanés passaient tous les deux le contrôle du
-- restant dû.
CREATE OR REPLACE FUNCTION payer_facture_fournisseur(
    p_shop_id    UUID,
    p_facture_id UUID,
    p_montant    NUMERIC,
    p_moyen      TEXT,
    p_reference  TEXT,
    p_note       TEXT,
    p_user_id    UUID
)
RETURNS JSONB AS $$
DECLARE
    v_facture RECORD;
    v_pid     TEXT;
    v_paye    NUMERIC;
    v_restant NUMERIC;
    v_statut  TEXT;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;

    SELECT id, supplier_id, montant_paye, montant_restant, statut
    INTO v_facture
    FROM factures_fournisseurs
    WHERE id = p_facture_id AND shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;

    IF v_facture.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette facture est annulée.');
    END IF;

    IF p_montant > v_facture.montant_restant THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Le montant dépasse le restant dû (' || v_facture.montant_restant || ').');
    END IF;

    v_paye    := v_facture.montant_paye + p_montant;
    v_restant := v_facture.montant_restant - p_montant;
    v_statut  := CASE WHEN v_restant <= 0 THEN 'payee' ELSE 'partiellement_payee' END;

    SELECT generate_public_id(p_shop_id, 'SPAY') INTO v_pid;

    INSERT INTO supplier_payments (
        public_id, shop_id, supplier_id, facture_id,
        montant, moyen_paiement, reference, note, created_by
    ) VALUES (
        v_pid, p_shop_id, v_facture.supplier_id, p_facture_id,
        p_montant, p_moyen, NULLIF(p_reference, ''), NULLIF(p_note, ''), p_user_id
    );

    UPDATE factures_fournisseurs
    SET montant_paye = v_paye, montant_restant = v_restant,
        statut = v_statut, updated_at = NOW()
    WHERE id = p_facture_id;

    UPDATE suppliers
    SET solde_dû = solde_dû - p_montant
    WHERE id = v_facture.supplier_id AND shop_id = p_shop_id;

    RETURN jsonb_build_object(
        'succes', true, 'public_id', v_pid,
        'statut', v_statut, 'montant_restant', v_restant
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 5. Remise à plat des soldes ───────────────────────────────
-- Le solde d'un fournisseur est désormais, par construction, le
-- restant dû de ses factures non annulées. On le recale une fois
-- pour repartir d'une base cohérente.
UPDATE suppliers s
SET solde_dû = COALESCE((
    SELECT sum(f.montant_restant)
    FROM factures_fournisseurs f
    WHERE f.supplier_id = s.id AND f.statut <> 'annulee'
), 0);
