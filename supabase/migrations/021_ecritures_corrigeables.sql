-- ============================================================
-- MIGRATION 021 — Les écritures deviennent corrigeables
-- ============================================================
--
-- Constat du cadrage Finances : aucune action de modification, de
-- suppression ou d'annulation n'existait dans tout le module. Un
-- montant saisi de travers restait faux pour toujours et faussait le
-- résultat de son mois à jamais — la base en contient un : un loyer
-- enregistré à 700 000 F au lieu de 45 000 F.
--
-- Décision produit (D4) : **modification directe tracée**. La ligne
-- garde son identifiant, ses valeurs changent, et l'ancienne valeur est
-- conservée dans `audit_logs` avec son auteur et sa date. Jamais de
-- suppression silencieuse.
--
-- L'annulation reste nécessaire pour une écriture qui n'aurait jamais
-- dû exister (une double saisie) : la ligne demeure visible et barrée,
-- avec un motif obligatoire, et SORT DES TOTAUX. D'où une vraie colonne
-- plutôt qu'une simple note — tous les rapports doivent pouvoir
-- l'exclure.
-- ============================================================

-- ── Dépenses ──────────────────────────────────────────────────
ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS est_annule       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT,
    ADD COLUMN IF NOT EXISTS modifie_le       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS modifie_par      UUID REFERENCES shop_users(id);

COMMENT ON COLUMN expenses.est_annule IS
    'Écriture annulée : reste visible et barrée à l''écran, mais EXCLUE de tous les totaux et rapports.';

-- ── Versements de salaire ─────────────────────────────────────
ALTER TABLE salary_payments
    ADD COLUMN IF NOT EXISTS est_annule       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT,
    ADD COLUMN IF NOT EXISTS modifie_le       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS modifie_par      UUID REFERENCES shop_users(id);

COMMENT ON COLUMN salary_payments.est_annule IS
    'Versement annulé : reste visible et barré à l''écran, mais EXCLU des totaux, du cumul « versé » et du rapport de paie.';

-- ── Employés ──────────────────────────────────────────────────
-- `est_actif` existait déjà et la liste filtrait dessus, mais rien ne
-- permettait de l'écrire : un employé parti restait à payer
-- indéfiniment. On garde la trace du jour du départ.
ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS desactive_le TIMESTAMPTZ;

-- ── Index de lecture des rapports ─────────────────────────────
-- Les rapports lisent désormais « sur la période ET non annulé ».
CREATE INDEX IF NOT EXISTS idx_expenses_shop_date_actives
    ON expenses(shop_id, date_depense) WHERE NOT est_annule;

CREATE INDEX IF NOT EXISTS idx_salaries_shop_date_actifs
    ON salary_payments(shop_id, date_paiement) WHERE NOT est_annule;

-- ── Contrôle ──────────────────────────────────────────────────
DO $$
DECLARE
    v_dep INTEGER;
    v_sal INTEGER;
BEGIN
    SELECT count(*) INTO v_dep FROM expenses;
    SELECT count(*) INTO v_sal FROM salary_payments;
    RAISE NOTICE 'Migration 021 : % dépense(s) et % versement(s) existants, tous actifs par défaut.', v_dep, v_sal;
END $$;
