-- ============================================================
-- MIGRATION 003 — Tranche 3 : Produits, Entrepôts, Stock
-- ============================================================

-- ── Entrepôts ─────────────────────────────────────────────────
CREATE TABLE warehouses (
                            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            public_id       TEXT NOT NULL,
                            shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                            nom             TEXT NOT NULL,
                            description     TEXT,
                            adresse         TEXT,
                            est_actif       BOOLEAN NOT NULL DEFAULT TRUE,
                            est_defaut      BOOLEAN NOT NULL DEFAULT FALSE,
                            created_by      UUID REFERENCES shop_users(id),
                            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_warehouses_shop_id ON warehouses(shop_id);

-- Un seul entrepôt par défaut par boutique
CREATE UNIQUE INDEX idx_warehouses_defaut
    ON warehouses(shop_id)
    WHERE est_defaut = TRUE;

-- ── Catégories (arbre parent/enfant) ──────────────────────────
CREATE TABLE categories (
                            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            public_id   TEXT NOT NULL,
                            shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                            parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
                            nom         TEXT NOT NULL,
                            description TEXT,
                            couleur     TEXT,
                            est_actif   BOOLEAN NOT NULL DEFAULT TRUE,
                            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_categories_shop_id   ON categories(shop_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- ── Marques ───────────────────────────────────────────────────
CREATE TABLE brands (
                        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        public_id   TEXT NOT NULL,
                        shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                        nom         TEXT NOT NULL,
                        description TEXT,
                        est_actif   BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_brands_shop_id ON brands(shop_id);

-- ── Produits ──────────────────────────────────────────────────
CREATE TABLE products (
                          id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                          public_id             TEXT NOT NULL,
                          shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                          category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
                          brand_id              UUID REFERENCES brands(id) ON DELETE SET NULL,
                          nom                   TEXT NOT NULL,
                          description           TEXT,
                          type_produit          TEXT NOT NULL DEFAULT 'simple'
                              CHECK (type_produit IN ('simple', 'ponderal', 'kit')),
                          sku                   TEXT,
                          code_barres           TEXT,
                          unite                 TEXT NOT NULL DEFAULT 'pièce',
                          photo_url             TEXT,
                          prix_achat            NUMERIC(15,2) NOT NULL DEFAULT 0,
                          prix_vente            NUMERIC(15,2) NOT NULL DEFAULT 0,
                          prix_gros             NUMERIC(15,2),
                          prix_minimum          NUMERIC(15,2),
                          tva_pct               NUMERIC(5,2) NOT NULL DEFAULT 0,
                          remise_max_pct        NUMERIC(5,2),
                          seuil_alerte          INTEGER NOT NULL DEFAULT 5,
                          est_actif             BOOLEAN NOT NULL DEFAULT TRUE,
                          notes                 TEXT,
                          created_by            UUID REFERENCES shop_users(id),
                          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          UNIQUE (shop_id, public_id),
                          UNIQUE (shop_id, sku)
);

CREATE INDEX idx_products_shop_id     ON products(shop_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id    ON products(brand_id);
CREATE INDEX idx_products_actif       ON products(est_actif);
CREATE INDEX idx_products_type        ON products(type_produit);

-- ── Stock par entrepôt ────────────────────────────────────────
CREATE TABLE stock_levels (
                              id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                              shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                              product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                              warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                              quantite        NUMERIC(15,3) NOT NULL DEFAULT 0,
                              updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                              UNIQUE (product_id, warehouse_id)
);

CREATE INDEX idx_stock_shop_id      ON stock_levels(shop_id);
CREATE INDEX idx_stock_product_id   ON stock_levels(product_id);
CREATE INDEX idx_stock_warehouse_id ON stock_levels(warehouse_id);

-- ── Mouvements de stock ───────────────────────────────────────
CREATE TABLE stock_movements (
                                 id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 public_id           TEXT NOT NULL,
                                 shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                 product_id          UUID NOT NULL REFERENCES products(id),
                                 warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
                                 type_mouvement      TEXT NOT NULL CHECK (type_mouvement IN (
                                                                                             'entree_initiale', 'vente', 'retour_vente',
                                                                                             'reception', 'retour_fournisseur',
                                                                                             'transfert_sortie', 'transfert_entree',
                                                                                             'ajustement_positif', 'ajustement_negatif',
                                                                                             'inventaire'
                                     )),
                                 quantite            NUMERIC(15,3) NOT NULL,
                                 quantite_avant      NUMERIC(15,3) NOT NULL,
                                 quantite_apres      NUMERIC(15,3) NOT NULL,
                                 reference_type      TEXT,
                                 reference_id        UUID,
                                 reference_public_id TEXT,
                                 note                TEXT,
                                 created_by          UUID REFERENCES shop_users(id),
                                 created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_movements_shop_id     ON stock_movements(shop_id);
CREATE INDEX idx_movements_product_id  ON stock_movements(product_id);
CREATE INDEX idx_movements_created_at  ON stock_movements(created_at);

-- ── Historique des prix ───────────────────────────────────────
CREATE TABLE price_history (
                               id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                               shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                               product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                               ancien_prix_achat  NUMERIC(15,2),
                               nouveau_prix_achat NUMERIC(15,2),
                               ancien_prix_vente  NUMERIC(15,2),
                               nouveau_prix_vente NUMERIC(15,2),
                               modifie_par     UUID REFERENCES shop_users(id),
                               created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_history_product_id ON price_history(product_id);

-- ── Triggers updated_at ───────────────────────────────────────
CREATE TRIGGER trg_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_stock_levels_updated_at
    BEFORE UPDATE ON stock_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE warehouses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_isolation"      ON warehouses      FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "categories_isolation"      ON categories      FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "brands_isolation"          ON brands          FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "products_isolation"        ON products        FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "stock_levels_isolation"    ON stock_levels    FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "stock_movements_isolation" ON stock_movements FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "price_history_isolation"   ON price_history   FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

-- ── Fonction atomique : déduire stock à la vente (règle S1) ──
CREATE OR REPLACE FUNCTION deduire_stock(
  p_shop_id       UUID,
  p_product_id    UUID,
  p_warehouse_id  UUID,
  p_quantite      NUMERIC,
  p_reference_type TEXT,
  p_reference_id  UUID,
  p_reference_pid TEXT,
  p_user_id       UUID
)
RETURNS JSONB AS $$
DECLARE
v_stock_actuel  NUMERIC;
  v_public_id     TEXT;
  v_product_nom   TEXT;
BEGIN
  -- Vérifier stock disponible (règle S1)
SELECT quantite INTO v_stock_actuel
FROM stock_levels
WHERE product_id = p_product_id
  AND warehouse_id = p_warehouse_id
    FOR UPDATE;

IF v_stock_actuel IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Stock introuvable');
END IF;

  IF v_stock_actuel < p_quantite THEN
SELECT nom INTO v_product_nom FROM products WHERE id = p_product_id;
RETURN jsonb_build_object(
        'succes', false,
        'erreur', 'Stock insuffisant pour ' || v_product_nom ||
                  ' (disponible: ' || v_stock_actuel || ')'
       );
END IF;

  -- Déduire
UPDATE stock_levels
SET quantite   = quantite - p_quantite,
    updated_at = NOW()
WHERE product_id   = p_product_id
  AND warehouse_id = p_warehouse_id;

-- Générer public_id mouvement
SELECT generate_public_id(p_shop_id, 'MVT') INTO v_public_id;

-- Enregistrer le mouvement
INSERT INTO stock_movements (
    public_id, shop_id, product_id, warehouse_id,
    type_mouvement, quantite,
    quantite_avant, quantite_apres,
    reference_type, reference_id, reference_public_id,
    created_by
) VALUES (
             v_public_id, p_shop_id, p_product_id, p_warehouse_id,
             'vente', p_quantite,
             v_stock_actuel, v_stock_actuel - p_quantite,
             p_reference_type, p_reference_id, p_reference_pid,
             p_user_id
         );

RETURN jsonb_build_object('succes', true, 'stock_restant', v_stock_actuel - p_quantite);
END;
$$ LANGUAGE plpgsql;