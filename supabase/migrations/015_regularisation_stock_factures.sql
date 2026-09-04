-- ============================================================
-- MIGRATION 015 — Fournisseurs, Lot 1 : régularisation du stock
--                 entré par les factures fournisseurs
-- ------------------------------------------------------------
-- Jusqu'à cette correction, creerFactureFournisseur() écrivait
-- directement dans stock_levels quand un entrepôt était renseigné :
-- lecture puis réécriture en TypeScript, sans verrou, sans
-- transaction et SANS créer de mouvement de stock.
--
-- Conséquence sur les données existantes : des unités bien
-- présentes en stock n'apparaissent nulle part dans le journal.
-- Le code ne le fait plus. Cette migration documente après coup
-- les entrées déjà réalisées, pour que stock_movements explique
-- enfin chaque unité en stock.
--
-- Elle NE MODIFIE AUCUNE QUANTITÉ : les unités sont déjà dans
-- stock_levels. Elle n'ajoute que la ligne de journal manquante,
-- datée de la facture, avec une note qui dit ce qu'elle est.
-- Idempotente : une facture déjà régularisée est ignorée.
-- ============================================================

DO $$
DECLARE
    v_ligne  RECORD;
    v_stock  NUMERIC;
    v_pid    TEXT;
    v_nb     INTEGER := 0;
BEGIN
    FOR v_ligne IN
        SELECT f.id            AS facture_id,
               f.public_id     AS facture_pid,
               f.shop_id,
               f.warehouse_id,
               f.created_at,
               i.product_id,
               i.quantite
        FROM factures_fournisseurs f
        JOIN facture_fournisseur_items i ON i.facture_id = f.id
        WHERE f.warehouse_id IS NOT NULL
          AND i.product_id   IS NOT NULL
          AND i.quantite     > 0
          -- Pas déjà régularisée
          AND NOT EXISTS (
              SELECT 1 FROM stock_movements m
              WHERE m.reference_type = 'facture_fournisseur'
                AND m.reference_id   = f.id
                AND m.product_id     = i.product_id
          )
        ORDER BY f.created_at
    LOOP
        SELECT quantite INTO v_stock
        FROM stock_levels
        WHERE product_id = v_ligne.product_id
          AND warehouse_id = v_ligne.warehouse_id;

        -- Pas de ligne de stock : il n'y a rien à expliquer.
        CONTINUE WHEN v_stock IS NULL;

        SELECT generate_public_id(v_ligne.shop_id, 'MVT') INTO v_pid;

        INSERT INTO stock_movements (
            public_id, shop_id, product_id, warehouse_id,
            type_mouvement, quantite,
            quantite_avant, quantite_apres,
            reference_type, reference_id, reference_public_id,
            note, created_at
        ) VALUES (
            v_pid, v_ligne.shop_id, v_ligne.product_id, v_ligne.warehouse_id,
            'reception', v_ligne.quantite,
            GREATEST(v_stock - v_ligne.quantite, 0), v_stock,
            'facture_fournisseur', v_ligne.facture_id, v_ligne.facture_pid,
            'Régularisation : entrée de stock créée par la facture ' || v_ligne.facture_pid ||
            ' avant la correction du 04/09/2026, sans mouvement enregistré à l''époque. ' ||
            'Quantités avant/après reconstituées à partir du stock actuel.',
            v_ligne.created_at
        );

        v_nb := v_nb + 1;
    END LOOP;

    RAISE NOTICE 'Mouvements de régularisation créés : %', v_nb;
END $$;
