-- ═══════════════════════════════════════════════════════════════
-- 037 — Après l'essai, un seul entrepôt vivant en Starter (Lot C)
--
-- L'essai ouvre le multi-entrepôts (mig 036). Une boutique qui choisit
-- ensuite Starter garde ses autres entrepôts et leur stock, visibles,
-- mais plus aucun mouvement n'y est accepté, sauf le transfert de leur
-- stock vers l'entrepôt par défaut. Le contrôle est posé dans
-- appliquer_mouvement_stock(), par où passent TOUS les mouvements
-- (ventes, réceptions, transferts, ajustements, inventaires, retours,
-- annulations) : aucun écran ne peut l'oublier.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.appliquer_mouvement_stock(p_shop_id uuid, p_product_id uuid, p_warehouse_id uuid, p_delta numeric, p_type_mouvement text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_pid text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid, p_autoriser_negatif boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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

    -- 037 : une boutique sans multi-entrepôts (Starter) ne fait vivre que
    -- son entrepôt par défaut. Les autres, créés pendant l'essai ou sous
    -- un plan supérieur, restent consultables ; seule une sortie par
    -- transfert y est permise, pour rapatrier le stock vers l'entrepôt
    -- principal. Liste des plans à tenir alignée sur lib/constants/plans.ts.
    IF EXISTS (SELECT 1 FROM shops WHERE id = p_shop_id AND plan = 'starter')
       AND NOT EXISTS (SELECT 1 FROM warehouses
                       WHERE id = p_warehouse_id AND est_defaut)
       AND p_type_mouvement <> 'transfert_sortie' THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Votre plan Starter ne fait vivre que l''entrepôt par défaut. '
                   || 'Les autres sont consultables, et leur stock peut être transféré vers l''entrepôt par défaut. '
                   || 'Passez au plan Pro pour les utiliser à nouveau.');
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
$function$;
