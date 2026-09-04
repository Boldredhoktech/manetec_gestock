-- ============================================================
-- MIGRATION 020 — Les salaires comptent à leur date de versement
-- ============================================================
--
-- Deux corrections liées, décidées au cadrage du module Finances.
--
-- 1. `periode_mois` / `periode_annee` = le mois TRAVAILLÉ. C'est sur
--    lui que filtraient le tableau de bord, le P&P et le rapport de
--    paie, alors que les dépenses et les paiements fournisseurs
--    filtraient sur leur date réelle. Un salaire de juin versé en
--    juillet tombait donc dans le résultat de juin. Désormais tous les
--    filtres financiers passent sur `date_paiement` ; la période
--    travaillée reste une étiquette affichée, plus une clé comptable.
--    → d'où l'index sur (shop_id, date_paiement).
--
-- 2. La contrainte d'unicité (employé, mois, année) interdisait
--    d'enregistrer un acompte puis le solde. L'acompte étant la norme,
--    on la lève : le double paiement n'est plus interdit, il est rendu
--    VISIBLE par le récapitulatif « versé / reste dû » de l'écran
--    Salaires.
--
-- Conséquence à ne pas oublier : le compteur « employés payés » du
-- rapport de paie doit compter les employés DISTINCTS, plus les lignes.
-- ============================================================

-- ── 1. Lever l'unicité par période ────────────────────────────
ALTER TABLE salary_payments
    DROP CONSTRAINT IF EXISTS salary_payments_employee_id_periode_mois_periode_annee_key;

-- Les deux colonnes restent obligatoires : un versement dit toujours au
-- titre de quel mois il est fait, on ne peut simplement plus s'en servir
-- pour dater la sortie de caisse.
COMMENT ON COLUMN salary_payments.periode_mois IS
    'Mois TRAVAILLÉ (étiquette). Ne jamais filtrer un rapport financier dessus : utiliser date_paiement.';
COMMENT ON COLUMN salary_payments.periode_annee IS
    'Année TRAVAILLÉE (étiquette). Ne jamais filtrer un rapport financier dessus : utiliser date_paiement.';
COMMENT ON COLUMN salary_payments.date_paiement IS
    'Date réelle de sortie de caisse. Clé de rattachement comptable du salaire.';

-- ── 2. Indexer la nouvelle clé de filtrage ────────────────────
CREATE INDEX IF NOT EXISTS idx_salaries_shop_date_paiement
    ON salary_payments(shop_id, date_paiement);

-- ── 3. Contrôle de cohérence des lignes existantes ────────────
-- Régularisation tracée si une ligne avait une date de versement
-- incohérente avec sa période. En pratique la base n'en contient
-- aucune (les trois versements ont été saisis le mois même), mais le
-- bloc reste : il documente le contrôle et ne fait rien s'il n'y a
-- rien à faire.
DO $$
DECLARE
    v_incoherentes INTEGER;
BEGIN
    SELECT count(*) INTO v_incoherentes
    FROM salary_payments
    WHERE date_paiement < make_date(periode_annee, periode_mois, 1);

    IF v_incoherentes > 0 THEN
        RAISE NOTICE 'Migration 020 : % versement(s) datés avant leur mois travaillé — à vérifier manuellement.', v_incoherentes;
    ELSE
        RAISE NOTICE 'Migration 020 : aucune incohérence entre date_paiement et période travaillée.';
    END IF;
END $$;
