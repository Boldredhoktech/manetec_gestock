-- ============================================================
-- MIGRATION 010 — Corrige l'unicité des public_id (par boutique)
-- ------------------------------------------------------------
-- BUG : 7 tables du module fournisseurs/achats/stock avaient en
-- production une contrainte UNIQUE (public_id) GLOBALE, alors que
-- generate_public_id() génère des identifiants séquentiels PAR
-- BOUTIQUE (chaque boutique repart à 00001). Résultat : dès qu'une
-- 2e boutique créait un fournisseur/BC/etc., elle générait un
-- public_id déjà pris globalement par une autre boutique →
-- « duplicate key value violates unique constraint ».
--
-- Correctif : remplacer UNIQUE (public_id) par UNIQUE (shop_id,
-- public_id), conformément à la migration 007 et au reste du schéma.
-- La contrainte par boutique est plus permissive : aucune ligne
-- existante ne peut la violer.
-- ============================================================

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'suppliers',
        'purchase_orders',
        'receptions',
        'supplier_returns',
        'supplier_payments',
        'stock_transfers',
        'stock_adjustments'
    ];
    c RECORD;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Supprimer toute contrainte UNIQUE globale portant sur (public_id) seul
        FOR c IN
            SELECT con.conname
            FROM pg_constraint con
            WHERE con.conrelid = t::regclass
              AND con.contype = 'u'
              AND pg_get_constraintdef(con.oid) = 'UNIQUE (public_id)'
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c.conname);
        END LOOP;

        -- Ajouter la contrainte par boutique si elle n'existe pas déjà
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint con
            WHERE con.conrelid = t::regclass
              AND con.contype = 'u'
              AND pg_get_constraintdef(con.oid) = 'UNIQUE (shop_id, public_id)'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD CONSTRAINT %I UNIQUE (shop_id, public_id)',
                t, t || '_shop_id_public_id_key'
            );
        END IF;
    END LOOP;
END $$;
