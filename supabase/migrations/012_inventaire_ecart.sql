-- ============================================================
-- MIGRATION 012 — Lot 3 : refonte de l'inventaire
-- ------------------------------------------------------------
-- Avant :
--   • la validation écrivait quantite = quantite_reelle en valeur
--     absolue, sur un théorique figé au lancement du comptage :
--     toutes les ventes de la journée de comptage étaient effacées ;
--   • les écarts négatifs créaient une DÉPENSE en espèces, ce qui
--     faisait sortir de la caisse un argent qui n'en est jamais
--     sorti ; les écarts positifs n'étaient enregistrés nulle part ;
--   • la validation se faisait en deux temps (SQL puis TypeScript),
--     donc jamais atomique.
--
-- Après :
--   • validation en ÉCART par défaut (quantite += ecart), qui
--     préserve les mouvements survenus pendant le comptage, avec un
--     mode « absolu » explicite en secours ;
--   • les dérives détectées sont retournées à l'écran pour arbitrage ;
--   • pertes ET gains valorisés symétriquement au prix d'achat, ligne
--     à ligne, sans écriture de trésorerie ;
--   • tout se passe dans une seule transaction.
-- ============================================================

-- ── 1. Valorisation ligne à ligne ─────────────────────────────
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS prix_achat_unitaire NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS valeur_ecart        NUMERIC(15,2);

COMMENT ON COLUMN inventory_items.prix_achat_unitaire IS
    'Prix d''achat figé au moment de la validation (sert à valoriser l''écart).';
COMMENT ON COLUMN inventory_items.valeur_ecart IS
    'ecart × prix_achat_unitaire. Négatif = perte, positif = gain.';

-- ── 2. Traçabilité de la validation et de l'annulation ────────
ALTER TABLE inventories
    ADD COLUMN IF NOT EXISTS mode_validation  TEXT,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventories_mode_validation_check'
    ) THEN
        ALTER TABLE inventories
            ADD CONSTRAINT inventories_mode_validation_check
            CHECK (mode_validation IS NULL OR mode_validation IN ('ecart', 'absolu'));
    END IF;
END $$;

-- ── 3. Validation d'inventaire ────────────────────────────────
-- p_mode = 'ecart'  (défaut) : quantite += ecart constaté au comptage.
--          'absolu'          : quantite = quantite_reelle (ancien
--                              comportement, à n'utiliser qu'en
--                              connaissance de cause).
-- Retourne les dérives (lignes dont le stock a bougé pendant le
-- comptage) pour que l'écran puisse les montrer.
DROP FUNCTION IF EXISTS valider_inventaire(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION valider_inventaire(
    p_inventory_id UUID,
    p_shop_id      UUID,
    p_user_id      UUID,
    p_mode         TEXT DEFAULT 'ecart'
)
RETURNS JSONB AS $$
DECLARE
    v_warehouse    UUID;
    v_item         RECORD;
    v_stock_actuel NUMERIC;
    v_delta        NUMERIC;
    v_prix         NUMERIC;
    v_valeur       NUMERIC;
    v_res          JSONB;
    v_pertes       NUMERIC := 0;
    v_gains        NUMERIC := 0;
    v_nb_neg       INTEGER := 0;
    v_nb_pos       INTEGER := 0;
    v_non_comptes  INTEGER;
    v_derives      JSONB   := '[]'::JSONB;
BEGIN
    IF p_mode NOT IN ('ecart', 'absolu') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Mode de validation inconnu.');
    END IF;

    SELECT warehouse_id INTO v_warehouse
    FROM inventories
    WHERE id = p_inventory_id AND shop_id = p_shop_id AND statut = 'en_cours';

    IF v_warehouse IS NULL THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Inventaire introuvable ou déjà traité.');
    END IF;

    -- Contrôle de complétude (était côté TypeScript, donc contournable).
    SELECT COUNT(*) INTO v_non_comptes
    FROM inventory_items
    WHERE inventory_id = p_inventory_id AND quantite_reelle IS NULL;

    IF v_non_comptes > 0 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', v_non_comptes || ' article(s) n''ont pas encore été comptés. ' ||
                      'Complétez le comptage avant de valider.');
    END IF;

    FOR v_item IN
        SELECT ii.id, ii.product_id, ii.quantite_theorique, ii.quantite_reelle, ii.ecart,
               p.nom AS produit_nom, p.prix_achat
        FROM inventory_items ii
        JOIN products p ON p.id = ii.product_id
        WHERE ii.inventory_id = p_inventory_id
    LOOP
        -- Stock réel au moment de la validation (verrou posé plus bas
        -- par appliquer_mouvement_stock).
        SELECT quantite INTO v_stock_actuel
        FROM stock_levels
        WHERE product_id = v_item.product_id AND warehouse_id = v_warehouse;

        v_stock_actuel := COALESCE(v_stock_actuel, 0);

        -- Dérive = le stock a bougé depuis le lancement du comptage.
        IF v_stock_actuel <> v_item.quantite_theorique THEN
            v_derives := v_derives || jsonb_build_object(
                'produit',    v_item.produit_nom,
                'theorique',  v_item.quantite_theorique,
                'actuel',     v_stock_actuel,
                'compte',     v_item.quantite_reelle
            );
        END IF;

        IF p_mode = 'ecart' THEN
            -- On applique la DIFFÉRENCE constatée au comptage : les
            -- ventes de la journée restent déduites.
            v_delta := COALESCE(v_item.ecart, 0);
        ELSE
            v_delta := v_item.quantite_reelle - v_stock_actuel;
        END IF;

        IF v_delta <> 0 THEN
            v_res := appliquer_mouvement_stock(
                p_shop_id, v_item.product_id, v_warehouse,
                v_delta, 'inventaire',
                'inventory', p_inventory_id, NULL,
                'Écart d''inventaire', p_user_id, FALSE
            );

            IF NOT (v_res->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION '%', v_res->>'erreur';
            END IF;
        END IF;

        -- Valorisation symétrique : pertes ET gains, au prix d'achat
        -- figé maintenant. Aucune écriture de trésorerie.
        v_prix   := COALESCE(v_item.prix_achat, 0);
        v_valeur := COALESCE(v_item.ecart, 0) * v_prix;

        UPDATE inventory_items
        SET prix_achat_unitaire = v_prix,
            valeur_ecart        = v_valeur
        WHERE id = v_item.id;

        IF COALESCE(v_item.ecart, 0) < 0 THEN
            v_nb_neg := v_nb_neg + 1;
            v_pertes := v_pertes + ABS(v_valeur);
        ELSIF COALESCE(v_item.ecart, 0) > 0 THEN
            v_nb_pos := v_nb_pos + 1;
            v_gains  := v_gains + v_valeur;
        END IF;
    END LOOP;

    UPDATE inventories SET
        statut             = 'valide',
        valide_par         = p_user_id,
        valide_le          = NOW(),
        mode_validation    = p_mode,
        valeur_pertes      = v_pertes,
        valeur_gains       = v_gains,
        nb_ecarts_negatifs = v_nb_neg,
        nb_ecarts_positifs = v_nb_pos
    WHERE id = p_inventory_id;

    RETURN jsonb_build_object(
        'succes',        true,
        'mode',          p_mode,
        'valeur_pertes', v_pertes,
        'valeur_gains',  v_gains,
        'valeur_nette',  v_gains - v_pertes,
        'nb_negatifs',   v_nb_neg,
        'nb_positifs',   v_nb_pos,
        'derives',       v_derives
    );
EXCEPTION WHEN OTHERS THEN
    -- Stock, valorisation et statut sont annulés ensemble.
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 4. Annulation d'un inventaire en cours ────────────────────
-- Le statut 'annule' existait en base et s'affichait dans l'historique,
-- mais rien ne permettait d'annuler : un inventaire ouvert par erreur
-- bloquait définitivement l'entrepôt.
CREATE OR REPLACE FUNCTION annuler_inventaire(
    p_inventory_id UUID,
    p_shop_id      UUID,
    p_user_id      UUID,
    p_motif        TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ok BOOLEAN;
BEGIN
    UPDATE inventories SET
        statut           = 'annule',
        annule_par       = p_user_id,
        annule_le        = NOW(),
        motif_annulation = NULLIF(p_motif, '')
    WHERE id = p_inventory_id
      AND shop_id = p_shop_id
      AND statut = 'en_cours'
    RETURNING TRUE INTO v_ok;

    IF NOT COALESCE(v_ok, FALSE) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Inventaire introuvable ou déjà traité.');
    END IF;

    -- Aucun mouvement de stock n'a été appliqué : il n'y a rien à défaire.
    RETURN jsonb_build_object('succes', true);
END;
$$ LANGUAGE plpgsql;

-- ── 5. Reprise des anciennes pertes d'inventaire ──────────────
-- Les pertes étaient enregistrées en dépenses de caisse. La valeur des
-- écarts est désormais portée par inventories.valeur_pertes/gains :
-- garder ces dépenses reviendrait à compter deux fois. On supprime les
-- seules lignes générées automatiquement (reconnaissables à leur note).
DELETE FROM expenses
WHERE note LIKE 'Généré automatiquement lors de la validation de l''inventaire%';

-- Valorise après coup les inventaires déjà validés, pour que leurs
-- lignes portent le prix d'achat comme les nouveaux.
UPDATE inventory_items ii
SET prix_achat_unitaire = p.prix_achat,
    valeur_ecart        = COALESCE(ii.ecart, 0) * p.prix_achat
FROM products p
WHERE p.id = ii.product_id
  AND ii.prix_achat_unitaire IS NULL
  AND EXISTS (
      SELECT 1 FROM inventories i
      WHERE i.id = ii.inventory_id AND i.statut = 'valide'
  );
