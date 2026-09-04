-- ============================================================
-- MIGRATION 022 — Ventilation de la caisse par moyen de paiement
-- ============================================================
--
-- Constat du cadrage : le mot « caisse » n'existait nulle part. Le
-- tableau de bord additionnait les espèces, le mobile money et les
-- virements dans un même total « entrées » et un même total
-- « sorties », alors que `moyen_paiement` est stocké sur CHAQUE ligne
-- d'argent. Le gérant ne pouvait donc jamais rapprocher l'écran de
-- l'argent réellement présent dans le tiroir.
--
-- Décision produit (D3) : ventilation par moyen + solde courant, sans
-- nouvelle table. La session de caisse (fond initial, comptage,
-- écart de fermeture) est reportée au module POS.
--
-- Pourquoi une fonction SQL plutôt qu'un calcul en JavaScript : le
-- solde courant est un cumul depuis l'origine. Le calculer côté serveur
-- Node obligerait à rapatrier toutes les lignes d'argent de la boutique
-- à chaque affichage du tableau de bord. Ici, cinq sources sont
-- agrégées en une seule requête.
--
-- SECURITY INVOKER (le défaut, volontairement conservé) : appelée
-- directement par un utilisateur via PostgREST avec le shop_id d'une
-- autre boutique, la fonction s'exécute sous ses droits et les
-- politiques RLS des cinq tables ne renvoient rien.
-- ============================================================

CREATE OR REPLACE FUNCTION ventilation_caisse(
    p_shop_id UUID,
    p_debut   DATE,
    p_fin     DATE
)
RETURNS TABLE (
    moyen            TEXT,
    entrees_periode  NUMERIC,
    sorties_periode  NUMERIC,
    entrees_cumul    NUMERIC,
    sorties_cumul    NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH mouvements AS (
        -- ENTRÉES ────────────────────────────────────────────
        -- Encaissements au comptoir : c'est la ligne de règlement qui
        -- porte le moyen, pas la vente.
        SELECT sp.moyen_paiement AS moyen,
               sp.montant        AS montant,
               'entree'          AS sens,
               s.created_at::date AS jour
          FROM sale_payments sp
          JOIN sales s ON s.id = sp.sale_id
         WHERE sp.shop_id = p_shop_id
           AND s.statut = 'completee'

        UNION ALL
        -- Règlements de facture. On date sur date_paiement, la date
        -- réelle, et non sur created_at : même règle que les salaires
        -- depuis la migration 020.
        SELECT fp.moyen_paiement, fp.montant, 'entree', fp.date_paiement
          FROM facture_payments fp
         WHERE fp.shop_id = p_shop_id

        -- SORTIES ────────────────────────────────────────────
        UNION ALL
        SELECT e.moyen_paiement, e.montant, 'sortie', e.date_depense
          FROM expenses e
         WHERE e.shop_id = p_shop_id
           AND NOT e.est_annule

        UNION ALL
        SELECT sal.moyen_paiement, sal.montant_net, 'sortie', sal.date_paiement
          FROM salary_payments sal
         WHERE sal.shop_id = p_shop_id
           AND NOT sal.est_annule

        UNION ALL
        SELECT f.moyen_paiement, f.montant, 'sortie', f.date_paiement
          FROM supplier_payments f
         WHERE f.shop_id = p_shop_id
    )
    SELECT
        moyen,
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'entree' AND jour BETWEEN p_debut AND p_fin), 0),
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'sortie' AND jour BETWEEN p_debut AND p_fin), 0),
        -- Cumul arrêté à la FIN de la période affichée : en consultant
        -- un mois passé, on voit le solde tel qu'il était alors, pas
        -- celui d'aujourd'hui.
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'entree' AND jour <= p_fin), 0),
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'sortie' AND jour <= p_fin), 0)
      FROM mouvements
     GROUP BY moyen
     ORDER BY
        COALESCE(SUM(montant) FILTER (WHERE sens = 'entree' AND jour <= p_fin), 0)
      - COALESCE(SUM(montant) FILTER (WHERE sens = 'sortie' AND jour <= p_fin), 0) DESC;
$$;

COMMENT ON FUNCTION ventilation_caisse(UUID, DATE, DATE) IS
    'Entrées/sorties par moyen de paiement sur une période, et cumul arrêté à la fin de cette période. Le solde ne tient pas compte des dépôts en banque ni des retraits d''espèces : ces mouvements internes ne sont enregistrés nulle part (à traiter au module POS avec la session de caisse).';

-- ── Index de lecture ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fpay_shop_date_paiement
    ON facture_payments(shop_id, date_paiement);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_shop_date
    ON supplier_payments(shop_id, date_paiement);

-- ── Contrôle ──────────────────────────────────────────────────
DO $$
DECLARE
    v_ligne RECORD;
    v_shop  UUID;
BEGIN
    SELECT id INTO v_shop FROM shops
     WHERE EXISTS (SELECT 1 FROM expenses e WHERE e.shop_id = shops.id)
     LIMIT 1;

    IF v_shop IS NULL THEN
        RAISE NOTICE 'Migration 022 : aucune boutique avec des mouvements, contrôle sauté.';
        RETURN;
    END IF;

    FOR v_ligne IN
        SELECT * FROM ventilation_caisse(v_shop, '2000-01-01', CURRENT_DATE)
    LOOP
        RAISE NOTICE 'Migration 022 : moyen % — entrées %, sorties %, solde %',
            v_ligne.moyen, v_ligne.entrees_cumul, v_ligne.sorties_cumul,
            v_ligne.entrees_cumul - v_ligne.sorties_cumul;
    END LOOP;
END $$;
