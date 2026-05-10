-- ============================================================
-- MIGRATION 008 — Tranche 8 : Comptabilité
-- ============================================================

-- ── Catégories de dépenses ────────────────────────────────────
CREATE TABLE expense_categories (
                                    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                    shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                    nom         TEXT NOT NULL,
                                    description TEXT,
                                    est_actif   BOOLEAN NOT NULL DEFAULT TRUE,
                                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                    UNIQUE (shop_id, nom)
);

CREATE INDEX idx_expense_cat_shop_id ON expense_categories(shop_id);

-- ── Dépenses ──────────────────────────────────────────────────
CREATE TABLE expenses (
                          id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                          public_id       TEXT NOT NULL,
                          shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                          category_id     UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
                          libelle         TEXT NOT NULL,
                          montant         NUMERIC(15,2) NOT NULL,
                          moyen_paiement  TEXT NOT NULL DEFAULT 'cash',
                          reference       TEXT,
                          date_depense    DATE NOT NULL DEFAULT CURRENT_DATE,
                          note            TEXT,
                          created_by      UUID REFERENCES shop_users(id),
                          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_expenses_shop_id    ON expenses(shop_id);
CREATE INDEX idx_expenses_date       ON expenses(date_depense);
CREATE INDEX idx_expenses_category   ON expenses(category_id);

-- ── Employés ──────────────────────────────────────────────────
CREATE TABLE employees (
                           id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                           shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                           user_id         UUID REFERENCES shop_users(id) ON DELETE SET NULL,
                           nom_complet     TEXT NOT NULL,
                           poste           TEXT,
                           salaire_base    NUMERIC(15,2) NOT NULL DEFAULT 0,
                           telephone       TEXT,
                           date_embauche   DATE,
                           est_actif       BOOLEAN NOT NULL DEFAULT TRUE,
                           created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_shop_id ON employees(shop_id);

-- ── Fiches de paie ────────────────────────────────────────────
CREATE TABLE salary_payments (
                                 id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 public_id       TEXT NOT NULL,
                                 shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                 employee_id     UUID NOT NULL REFERENCES employees(id),
                                 periode_mois    INTEGER NOT NULL CHECK (periode_mois BETWEEN 1 AND 12),
                                 periode_annee   INTEGER NOT NULL,
                                 salaire_base    NUMERIC(15,2) NOT NULL,
                                 bonus           NUMERIC(15,2) NOT NULL DEFAULT 0,
                                 deductions      NUMERIC(15,2) NOT NULL DEFAULT 0,
                                 montant_net     NUMERIC(15,2) NOT NULL,
                                 moyen_paiement  TEXT NOT NULL DEFAULT 'cash',
                                 reference       TEXT,
                                 note            TEXT,
                                 date_paiement   DATE NOT NULL DEFAULT CURRENT_DATE,
                                 created_by      UUID REFERENCES shop_users(id),
                                 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 UNIQUE (shop_id, public_id),
                                 UNIQUE (employee_id, periode_mois, periode_annee)
);

CREATE INDEX idx_salaries_shop_id     ON salary_payments(shop_id);
CREATE INDEX idx_salaries_employee_id ON salary_payments(employee_id);
CREATE INDEX idx_salaries_periode     ON salary_payments(periode_annee, periode_mois);

-- ── Inventaires physiques ─────────────────────────────────────
CREATE TABLE inventories (
                             id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                             public_id       TEXT NOT NULL,
                             shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                             warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                             statut          TEXT NOT NULL DEFAULT 'en_cours'
                                 CHECK (statut IN ('en_cours', 'valide', 'annule')),
                             notes           TEXT,
                             valide_par      UUID REFERENCES shop_users(id),
                             valide_le       TIMESTAMPTZ,
                             created_by      UUID REFERENCES shop_users(id),
                             created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                             updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                             UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_inventories_shop_id ON inventories(shop_id);
CREATE INDEX idx_inventories_statut  ON inventories(statut);

-- ── Lignes d'inventaire ───────────────────────────────────────
CREATE TABLE inventory_items (
                                 id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                 inventory_id      UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
                                 product_id        UUID NOT NULL REFERENCES products(id),
                                 quantite_theorique NUMERIC(15,3) NOT NULL DEFAULT 0,
                                 quantite_reelle    NUMERIC(15,3),
                                 ecart             NUMERIC(15,3),
                                 note              TEXT
);

CREATE INDEX idx_inv_items_inventory_id ON inventory_items(inventory_id);
CREATE INDEX idx_inv_items_product_id   ON inventory_items(product_id);

-- ── Triggers ──────────────────────────────────────────────────
CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_inventories_updated_at
    BEFORE UPDATE ON inventories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE expense_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_cat_isolation"  ON expense_categories FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "expenses_isolation"     ON expenses           FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "employees_isolation"    ON employees          FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "salaries_isolation"     ON salary_payments    FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "inventories_isolation"  ON inventories        FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "inv_items_isolation"    ON inventory_items    FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

-- ── Fonction : valider un inventaire ─────────────────────────
CREATE OR REPLACE FUNCTION valider_inventaire(
  p_inventory_id UUID,
  p_shop_id      UUID,
  p_user_id      UUID
)
RETURNS JSONB AS $$
DECLARE
v_item        RECORD;
  v_mvt_pid     TEXT;
  v_stock_actuel NUMERIC;
BEGIN
  -- Vérifier que l'inventaire existe et est en cours
  IF NOT EXISTS (
    SELECT 1 FROM inventories
    WHERE id = p_inventory_id
      AND shop_id = p_shop_id
      AND statut = 'en_cours'
  ) THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Inventaire introuvable ou déjà traité');
END IF;

  -- Appliquer les écarts
FOR v_item IN
SELECT ii.*, inv.warehouse_id
FROM inventory_items ii
         JOIN inventories inv ON inv.id = ii.inventory_id
WHERE ii.inventory_id = p_inventory_id
  AND ii.quantite_reelle IS NOT NULL
  AND ii.ecart != 0
  LOOP
-- Mettre à jour le stock
UPDATE stock_levels SET
                        quantite   = v_item.quantite_reelle,
                        updated_at = NOW()
WHERE product_id   = v_item.product_id
  AND warehouse_id = v_item.warehouse_id;

-- Mouvement de stock
SELECT generate_public_id(p_shop_id, 'MVT') INTO v_mvt_pid;
INSERT INTO stock_movements (
    public_id, shop_id, product_id, warehouse_id,
    type_mouvement, quantite, quantite_avant, quantite_apres,
    reference_type, reference_id, reference_public_id,
    note, created_by
) VALUES (
             v_mvt_pid, p_shop_id, v_item.product_id, v_item.warehouse_id,
             'inventaire',
             ABS(v_item.ecart),
             v_item.quantite_theorique,
             v_item.quantite_reelle,
             'inventory', p_inventory_id, NULL,
             'Ajustement inventaire physique',
             p_user_id
         );
END LOOP;

  -- Valider l'inventaire
UPDATE inventories SET
                       statut     = 'valide',
                       valide_par = p_user_id,
                       valide_le  = NOW()
WHERE id = p_inventory_id;

RETURN jsonb_build_object('succes', true);
END;
$$ LANGUAGE plpgsql;