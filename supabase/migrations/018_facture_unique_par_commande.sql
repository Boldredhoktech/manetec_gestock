-- ============================================================
-- MIGRATION 018 — Fournisseurs, Lot 3 (suite) :
--   une seule facture « à compléter » par commande
-- ------------------------------------------------------------
-- Défaut constaté en test : deux réceptions partielles sur le même
-- bon de commande créaient DEUX factures « à compléter », alors que
-- le fournisseur n'en enverra qu'une pour la commande entière.
--
-- Désormais, une réception rattachée à un bon de commande réutilise
-- la facture « à compléter » déjà ouverte pour ce bon, et y ajoute
-- son montant. La dette reste comptée une fois par marchandise
-- reçue, mais elle est portée par un seul document.
-- ============================================================

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
    v_po_id         UUID;
    v_product_id    UUID;
    v_facture_id    UUID;
    v_facture_pid   TEXT;
    v_montant       NUMERIC;
    v_res           JSONB;
    v_creee         BOOLEAN := FALSE;
    v_reprise       BOOLEAN := FALSE;
BEGIN
    v_shop_id      := (p_data->>'shop_id')::UUID;
    v_warehouse_id := (p_data->>'warehouse_id')::UUID;
    v_user_id      := (p_data->>'user_id')::UUID;
    v_supplier_id  := (p_data->>'supplier_id')::UUID;
    v_po_id        := NULLIF(p_data->>'po_id', '')::UUID;
    v_facture_id   := NULLIF(p_data->>'facture_id', '')::UUID;
    v_montant      := COALESCE((p_data->>'montant_total')::NUMERIC, 0);

    SELECT generate_public_id(v_shop_id, 'REC') INTO v_rec_public_id;

    -- Facture fournie : elle porte déjà la dette, on ne touche à rien.
    IF v_facture_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM factures_fournisseurs
            WHERE id = v_facture_id AND shop_id = v_shop_id
        ) THEN
            RETURN jsonb_build_object('succes', false,
                'erreur', 'Facture fournisseur introuvable dans cette boutique.');
        END IF;
    ELSE
        -- Réception d'un bon de commande déjà partiellement servi :
        -- on reprend la facture « à compléter » ouverte pour ce bon.
        IF v_po_id IS NOT NULL THEN
            SELECT f.id INTO v_facture_id
            FROM receptions r
            JOIN factures_fournisseurs f ON f.id = r.facture_id
            WHERE r.po_id = v_po_id
              AND r.shop_id = v_shop_id
              AND f.a_completer
              AND f.statut = 'non_payee'
            ORDER BY r.created_at
            LIMIT 1;

            v_reprise := v_facture_id IS NOT NULL;
        END IF;

        IF v_reprise THEN
            -- Même document, montant cumulé.
            UPDATE factures_fournisseurs
            SET montant_ht      = montant_ht      + v_montant,
                montant_ttc     = montant_ttc     + v_montant,
                montant_restant = montant_restant + v_montant,
                updated_at      = NOW()
            WHERE id = v_facture_id;
        ELSE
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
        END IF;

        -- La dette suit la marchandise reçue, dans les deux cas.
        UPDATE suppliers
        SET solde_dû = solde_dû + v_montant
        WHERE id = v_supplier_id AND shop_id = v_shop_id;
    END IF;

    INSERT INTO receptions (
        public_id, shop_id, po_id, supplier_id,
        warehouse_id, date_reception, montant_total, notes,
        facture_id, created_by
    ) VALUES (
        v_rec_public_id, v_shop_id, v_po_id,
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

    IF v_po_id IS NOT NULL THEN
        UPDATE purchase_orders SET
            statut = CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM purchase_order_items
                    WHERE purchase_order_id = v_po_id
                      AND quantite_recue < quantite_cmd
                ) THEN 'recu_total'
                ELSE 'recu_partiel'
            END,
            updated_at = NOW()
        WHERE id = v_po_id;
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'reception_id', v_rec_id,
        'public_id', v_rec_public_id,
        'facture_id', v_facture_id,
        'facture_creee', v_creee,
        'facture_completee', v_reprise
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;
