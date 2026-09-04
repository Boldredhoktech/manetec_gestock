-- ============================================================
-- MIGRATION 023 — La courbe du P&P en une seule requête
-- ============================================================
--
-- Le rapport Profits & Pertes construisait sa courbe d'évolution sur
-- six mois en enchaînant TROIS requêtes par mois, une par une, sans
-- parallélisation ni agrégation : dix-huit allers-retours en série
-- pour tracer six points, sur le rapport le plus consulté.
--
-- Une seule requête les remplace. Elle sert aussi de source unique à la
-- courbe : jusqu'ici la boucle JavaScript oubliait d'exclure les
-- écritures annulées des mois passés — elle avait été écrite avant
-- qu'elles existent.
--
-- Le décalage horaire de la boutique (UTC+1, cf. lib/dates/periode.ts)
-- est appliqué aux colonnes `created_at`, qui sont des instants, pour
-- qu'une vente de 00 h 30 le 1er ne tombe pas dans le mois précédent.
-- Les colonnes `date_depense` / `date_paiement` sont déjà des jours et
-- n'ont pas besoin de conversion.
--
-- SECURITY INVOKER (le défaut) : appelée directement avec le shop_id
-- d'une autre boutique, la RLS des tables lues ne renvoie rien.
-- ============================================================

CREATE OR REPLACE FUNCTION evolution_tresorerie(
    p_shop_id   UUID,
    p_mois_fin  INTEGER,
    p_annee_fin INTEGER,
    p_nb_mois   INTEGER DEFAULT 6,
    p_decalage  INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    mois       INTEGER,
    annee      INTEGER,
    ca         NUMERIC,
    depenses   NUMERIC,
    resultat   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH periodes AS (
        SELECT generate_series(
            make_date(p_annee_fin, p_mois_fin, 1) - ((p_nb_mois - 1) || ' months')::INTERVAL,
            make_date(p_annee_fin, p_mois_fin, 1),
            '1 month'
        )::date AS debut
    ),
    bornes AS (
        SELECT debut,
               (debut + INTERVAL '1 month - 1 day')::date AS fin
          FROM periodes
    )
    SELECT
        EXTRACT(MONTH FROM b.debut)::INTEGER,
        EXTRACT(YEAR  FROM b.debut)::INTEGER,
        COALESCE((
            SELECT SUM(s.montant_total) FROM sales s
             WHERE s.shop_id = p_shop_id
               AND s.statut = 'completee'
               -- created_at est un instant : on le ramène au jour vécu
               -- dans la boutique avant de le comparer.
               AND (s.created_at + p_decalage)::date BETWEEN b.debut AND b.fin
        ), 0),
        COALESCE((
            SELECT SUM(e.montant) FROM expenses e
             WHERE e.shop_id = p_shop_id
               AND NOT e.est_annule
               AND e.date_depense BETWEEN b.debut AND b.fin
        ), 0)
        + COALESCE((
            SELECT SUM(sal.montant_net) FROM salary_payments sal
             WHERE sal.shop_id = p_shop_id
               AND NOT sal.est_annule
               AND sal.date_paiement BETWEEN b.debut AND b.fin
        ), 0),
        COALESCE((
            SELECT SUM(s.montant_total) FROM sales s
             WHERE s.shop_id = p_shop_id
               AND s.statut = 'completee'
               AND (s.created_at + p_decalage)::date BETWEEN b.debut AND b.fin
        ), 0)
        - COALESCE((
            SELECT SUM(e.montant) FROM expenses e
             WHERE e.shop_id = p_shop_id
               AND NOT e.est_annule
               AND e.date_depense BETWEEN b.debut AND b.fin
        ), 0)
        - COALESCE((
            SELECT SUM(sal.montant_net) FROM salary_payments sal
             WHERE sal.shop_id = p_shop_id
               AND NOT sal.est_annule
               AND sal.date_paiement BETWEEN b.debut AND b.fin
        ), 0)
      FROM bornes b
     ORDER BY b.debut;
$$;

COMMENT ON FUNCTION evolution_tresorerie(UUID, INTEGER, INTEGER, INTEGER, INTERVAL) IS
    'Courbe CA / dépenses / résultat sur les N mois se terminant au mois demandé. Remplace 3 requêtes par mois enchaînées en série dans le rapport P&P. Exclut les écritures annulées.';

-- ── Contrôle ──────────────────────────────────────────────────
DO $$
DECLARE
    v_ligne RECORD;
    v_shop  UUID;
BEGIN
    SELECT shop_id INTO v_shop FROM expenses LIMIT 1;
    IF v_shop IS NULL THEN
        RAISE NOTICE 'Migration 023 : aucune donnée, contrôle sauté.';
        RETURN;
    END IF;

    FOR v_ligne IN
        SELECT * FROM evolution_tresorerie(
            v_shop,
            EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
            EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
            6
        )
    LOOP
        RAISE NOTICE 'Migration 023 : %/% — CA %, dépenses %, résultat %',
            v_ligne.mois, v_ligne.annee, v_ligne.ca, v_ligne.depenses, v_ligne.resultat;
    END LOOP;
END $$;
