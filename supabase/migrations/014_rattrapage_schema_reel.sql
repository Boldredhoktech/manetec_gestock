-- ============================================================
-- MIGRATION 014 — Lot 5 : rattrapage du schéma réel
-- ------------------------------------------------------------
-- Le dossier supabase/migrations/ ne permettait plus de
-- reconstruire la base : des tables et des colonnes avaient été
-- créées à la main dans l'interface Supabase, et plusieurs
-- colonnes portent en production un NOM DIFFÉRENT de celui déclaré
-- dans la migration 007. C'est ce décalage qui a fait écrire du
-- code visant des colonnes inexistantes (transferts, ajustements).
--
-- Cette migration déclare l'existant. Elle est idempotente et
-- ne fait rien sur une base déjà à jour :
--   • 4 tables jamais versionnées ;
--   • 24 colonnes absentes des migrations ;
--   • 9 colonnes renommées (le nom de la migration → le nom réel) ;
--   • 2 colonnes déclarées mais jamais créées, retirées.
--
-- RESTE UN ÉCART ASSUMÉ, traité au module Fournisseurs :
--   purchase_orders.warehouse_id est déclaré par la migration 007
--   mais n'existe PAS en production, alors que creerBonCommande()
--   l'insère — la création d'un bon de commande échoue donc en
--   production. On corrige côté prod (ajout de la colonne) au
--   module Fournisseurs, pas ici : cette migration décrit, elle
--   n'arbitre pas.
--
-- NOTE : la fonction rls_auto_enable() présente en base est un
-- event trigger de la plateforme Supabase (activation automatique
-- de la RLS sur toute nouvelle table). Elle n'appartient pas à
-- l'application et n'a pas à figurer ici.
-- ============================================================

-- ── 1. Colonnes renommées entre la migration et la réalité ────
-- Sur la production, ces renommages ne font rien (le nom cible
-- existe déjà). Sur une base reconstruite depuis les migrations,
-- ils la font converger vers la production.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('purchase_order_items',   'po_id',               'purchase_order_id'),
            ('reception_items',        'quantite',            'quantite_recue'),
            ('stock_adjustment_items', 'difference',          'ecart'),
            ('stock_adjustments',      'notes',               'note'),
            ('stock_transfers',        'warehouse_source_id', 'warehouse_from'),
            ('stock_transfers',        'warehouse_dest_id',   'warehouse_to'),
            ('stock_transfers',        'notes',               'note'),
            ('supplier_return_items',  'return_id',           'supplier_return_id'),
            ('supplier_returns',       'montant_total',       'montant')
        ) AS t(tbl, ancien, nouveau)
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.ancien
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.nouveau
        ) THEN
            EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', r.tbl, r.ancien, r.nouveau);
            RAISE NOTICE 'Renommé %.% → %', r.tbl, r.ancien, r.nouveau;
        END IF;
    END LOOP;
END $$;

-- supplier_returns.notes → note : la 013 a déjà créé « note ».
-- Si les deux coexistent (base reconstruite), on garde « note ».
ALTER TABLE supplier_returns  DROP COLUMN IF EXISTS notes;
ALTER TABLE reception_items   DROP COLUMN IF EXISTS montant_ligne;

-- ── 2. Colonnes déclarées mais jamais créées en production ────
ALTER TABLE suppliers            DROP COLUMN IF EXISTS created_by;
ALTER TABLE purchase_order_items DROP COLUMN IF EXISTS ordre;

-- ── 3. Colonnes existantes en production, jamais versionnées ──
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS type_config_json JSONB,
    ADD COLUMN IF NOT EXISTS unit_config_json JSONB,
    ADD COLUMN IF NOT EXISTS necessite_imei   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS necessite_serie  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS garantie_mois    INTEGER,
    ADD COLUMN IF NOT EXISTS est_retournable  BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE inventories
    ADD COLUMN IF NOT EXISTS nom                TEXT,
    ADD COLUMN IF NOT EXISTS valeur_pertes      NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valeur_gains       NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nb_ecarts_negatifs INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nb_ecarts_positifs INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchase_order_items
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE reception_items
    ADD COLUMN IF NOT EXISTS quantite_recue NUMERIC(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE stock_adjustment_items
    ADD COLUMN IF NOT EXISTS ecart NUMERIC(15,3) NOT NULL DEFAULT 0;

ALTER TABLE stock_adjustments
    ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE stock_transfers
    ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE supplier_payments
    ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id);

ALTER TABLE supplier_returns
    ADD COLUMN IF NOT EXISTS montant NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS poste_contact TEXT;

-- ── 4. Variantes de produit (table jamais versionnée) ─────────
CREATE TABLE IF NOT EXISTS product_variants (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    nom            TEXT NOT NULL,
    attribute_type TEXT NOT NULL
        CHECK (attribute_type IN ('color', 'size', 'storage', 'other')),
    color_hex      TEXT,
    est_actif      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);

-- ── 5. Factures fournisseurs (3 tables jamais versionnées) ────
CREATE TABLE IF NOT EXISTS factures_fournisseurs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id       TEXT NOT NULL,
    shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    statut          TEXT NOT NULL DEFAULT 'non_payee'
        CHECK (statut IN ('non_payee', 'partiellement_payee', 'payee', 'annulee')),
    date_facture    DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance   DATE,
    reference_fourn TEXT,
    warehouse_id    UUID REFERENCES warehouses(id),
    montant_ht      NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_tva     NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_ttc     NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_paye    NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_restant NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    created_by      UUID REFERENCES shop_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ff_public_id UNIQUE (shop_id, public_id)
);

CREATE INDEX IF NOT EXISTS idx_ff_shop_id     ON factures_fournisseurs(shop_id);
CREATE INDEX IF NOT EXISTS idx_ff_supplier_id ON factures_fournisseurs(supplier_id);

CREATE TABLE IF NOT EXISTS facture_fournisseur_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    facture_id    UUID NOT NULL REFERENCES factures_fournisseurs(id) ON DELETE CASCADE,
    product_id    UUID REFERENCES products(id),
    designation   TEXT NOT NULL,
    quantite      NUMERIC(15,3) NOT NULL DEFAULT 1,
    prix_unitaire NUMERIC(15,2) NOT NULL DEFAULT 0,
    tva_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,
    montant_ht    NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_tva   NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_ttc   NUMERIC(15,2) NOT NULL DEFAULT 0,
    ordre         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS facture_fournisseur_payments (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    facture_id     UUID NOT NULL REFERENCES factures_fournisseurs(id) ON DELETE CASCADE,
    montant        NUMERIC(15,2) NOT NULL,
    moyen_paiement TEXT NOT NULL DEFAULT 'cash',
    reference      TEXT,
    note           TEXT,
    created_by     UUID REFERENCES shop_users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. RLS sur les tables rattrapées ──────────────────────────
ALTER TABLE product_variants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures_fournisseurs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_fournisseur_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_fournisseur_payments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('product_variants',             'variants_isolation'),
            ('factures_fournisseurs',        'ff_isolation'),
            ('facture_fournisseur_items',    'ffi_isolation'),
            ('facture_fournisseur_payments', 'ffp_isolation')
        ) AS t(tbl, pol)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = r.tbl AND policyname = r.pol
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR ALL USING (shop_id = (SELECT (auth.jwt()->''user_metadata''->>''shop_id'')::uuid))',
                r.pol, r.tbl
            );
        END IF;
    END LOOP;
END $$;
