-- ============================================================
-- MIGRATION 024 — Suppression des « clients entreprise »
-- ============================================================
--
-- Décision produit D4 du cadrage Clients & facturation.
--
-- `business_clients` était une seconde table de clients, née avec la
-- tranche 6 : la migration d'origine faisait pointer `factures.client_id`
-- vers elle, mais la production pointe en réalité vers `clients` (dérive
-- déjà relevée à l'audit de juillet). Résultat : une table vide, aucun
-- écran pour la lire, et une action de création qui redirigeait vers
-- `/admin/factures/clients` — une page qui n'a jamais existé.
--
-- Les champs qui distinguent une entreprise — IFU, RCCM, site web,
-- ville — sont déjà portés par `clients` et repris sur les PDF. Une
-- seule table suffit ; garder la seconde n'ajoutait qu'une occasion de
-- diverger.
--
-- Contrôle avant suppression : on refuse de détruire des données. Si la
-- table contient la moindre ligne, la migration échoue et il faudra
-- d'abord les reprendre dans `clients`.
-- ============================================================

DO $$
DECLARE
    v_lignes INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'business_clients'
    ) THEN
        RAISE NOTICE 'Migration 024 : business_clients déjà absente, rien à faire.';
        RETURN;
    END IF;

    EXECUTE 'SELECT count(*) FROM business_clients' INTO v_lignes;

    IF v_lignes > 0 THEN
        RAISE EXCEPTION
            'Migration 024 interrompue : business_clients contient % ligne(s). Reprendre ces clients dans « clients » avant de supprimer la table.',
            v_lignes;
    END IF;

    -- Aucune donnée à perdre : on supprime.
    DROP TABLE business_clients;
    RAISE NOTICE 'Migration 024 : business_clients supprimée (0 ligne).';
END $$;
