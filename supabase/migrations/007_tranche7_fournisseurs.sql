-- ============================================================
-- MIGRATION 007 — Tranche 7 : Fournisseurs
-- ============================================================

-- ── Fournisseurs ──────────────────────────────────────────────
CREATE TABLE suppliers (
                           id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                           public_id       TEXT NOT NULL,
                           shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                           nom             TEXT NOT NULL,
                           nom_contact     TEXT,
                           telephone       TEXT,
                           email           TEXT,
                           adresse         TEXT,
                           ville           TEXT,
                           pays            TEXT,
                           ifu             TEXT,
                           rccm            TEXT,
                           solde_dû        NUMERIC(15,2) NOT NULL DEFAULT 0,
                           notes           TEXT,
                           est_actif       BOOLEAN NOT NULL DEFAULT TRUE,
                           created_by      UUID REFERENCES shop_users(id),
                           created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_suppliers_shop_id ON suppliers(shop_id);

-- ── Bons de commande ──────────────────────────────────────────
CREATE TABLE purchase_orders (
                                 id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 public_id       TEXT NOT NULL,
                                 shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                 supplier_id     UUID NOT NULL REFERENCES suppliers(id),
                                 warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                                 statut          TEXT NOT NULL DEFAULT 'brouillon'
                                     CHECK (statut IN (
                                                       'brouillon','envoye','partiellement_recu',
                                                       'recu','annule'
                                         )),
                                 date_commande   DATE NOT NULL DEFAULT CURRENT_DATE,
                                 date_livraison  DATE,
                                 montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
                                 notes           TEXT,
                                 created_by      UUID REFERENCES shop_users(id),
                                 created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_po_shop_id     ON purchase_orders(shop_id);
CREATE INDEX idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_po_statut      ON purchase_orders(statut);

-- ── Lignes de bon de commande ─────────────────────────────────
CREATE TABLE purchase_order_items (
                                      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                      po_id           UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                                      product_id      UUID NOT NULL REFERENCES products(id),
                                      designation     TEXT NOT NULL,
                                      quantite_cmd    NUMERIC(15,3) NOT NULL,
                                      quantite_recue  NUMERIC(15,3) NOT NULL DEFAULT 0,
                                      prix_unitaire   NUMERIC(15,2) NOT NULL,
                                      montant_ligne   NUMERIC(15,2) NOT NULL,
                                      ordre           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_poi_po_id      ON purchase_order_items(po_id);
CREATE INDEX idx_poi_product_id ON purchase_order_items(product_id);

-- ── Réceptions ────────────────────────────────────────────────
CREATE TABLE receptions (
                            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            public_id       TEXT NOT NULL,
                            shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                            po_id           UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
                            supplier_id     UUID NOT NULL REFERENCES suppliers(id),
                            warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                            date_reception  DATE NOT NULL DEFAULT CURRENT_DATE,
                            montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
                            notes           TEXT,
                            created_by      UUID REFERENCES shop_users(id),
                            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_receptions_shop_id     ON receptions(shop_id);
CREATE INDEX idx_receptions_supplier_id ON receptions(supplier_id);
CREATE INDEX idx_receptions_po_id       ON receptions(po_id);

-- ── Lignes de réception ───────────────────────────────────────
CREATE TABLE reception_items (
                                 id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                 reception_id    UUID NOT NULL REFERENCES receptions(id) ON DELETE CASCADE,
                                 product_id      UUID NOT NULL REFERENCES products(id),
                                 poi_id          UUID REFERENCES purchase_order_items(id),
                                 designation     TEXT NOT NULL,
                                 quantite        NUMERIC(15,3) NOT NULL,
                                 prix_unitaire   NUMERIC(15,2) NOT NULL,
                                 montant_ligne   NUMERIC(15,2) NOT NULL
);

CREATE INDEX idx_rec_items_reception_id ON reception_items(reception_id);
CREATE INDEX idx_rec_items_product_id   ON reception_items(product_id);

-- ── Retours fournisseur ───────────────────────────────────────
CREATE TABLE supplier_returns (
                                  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                  public_id       TEXT NOT NULL,
                                  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                  supplier_id     UUID NOT NULL REFERENCES suppliers(id),
                                  warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                                  motif           TEXT NOT NULL,
                                  montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
                                  notes           TEXT,
                                  created_by      UUID REFERENCES shop_users(id),
                                  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                  UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_sret_shop_id     ON supplier_returns(shop_id);
CREATE INDEX idx_sret_supplier_id ON supplier_returns(supplier_id);

-- ── Lignes de retour fournisseur ──────────────────────────────
CREATE TABLE supplier_return_items (
                                       id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                       shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                       return_id       UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
                                       product_id      UUID NOT NULL REFERENCES products(id),
                                       designation     TEXT NOT NULL,
                                       quantite        NUMERIC(15,3) NOT NULL,
                                       prix_unitaire   NUMERIC(15,2) NOT NULL,
                                       montant_ligne   NUMERIC(15,2) NOT NULL
);

CREATE INDEX idx_sret_items_return_id ON supplier_return_items(return_id);

-- ── Paiements fournisseur ─────────────────────────────────────
CREATE TABLE supplier_payments (
                                   id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                   public_id       TEXT NOT NULL,
                                   shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                   supplier_id     UUID NOT NULL REFERENCES suppliers(id),
                                   montant         NUMERIC(15,2) NOT NULL,
                                   moyen_paiement  TEXT NOT NULL,
                                   reference       TEXT,
                                   note            TEXT,
                                   date_paiement   DATE NOT NULL DEFAULT CURRENT_DATE,
                                   created_by      UUID REFERENCES shop_users(id),
                                   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                   UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_spay_shop_id     ON supplier_payments(shop_id);
CREATE INDEX idx_spay_supplier_id ON supplier_payments(supplier_id);

-- ── Transferts inter-entrepôts ────────────────────────────────
CREATE TABLE stock_transfers (
                                 id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 public_id           TEXT NOT NULL,
                                 shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                 warehouse_source_id UUID NOT NULL REFERENCES warehouses(id),
                                 warehouse_dest_id   UUID NOT NULL REFERENCES warehouses(id),
                                 statut              TEXT NOT NULL DEFAULT 'effectue'
                                     CHECK (statut IN ('effectue','annule')),
                                 notes               TEXT,
                                 created_by          UUID REFERENCES shop_users(id),
                                 created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 UNIQUE (shop_id, public_id),
                                 CHECK (warehouse_source_id != warehouse_dest_id)
    );

CREATE INDEX idx_transfers_shop_id ON stock_transfers(shop_id);

-- ── Lignes de transfert ───────────────────────────────────────
CREATE TABLE stock_transfer_items (
                                      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                      transfer_id     UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
                                      product_id      UUID NOT NULL REFERENCES products(id),
                                      quantite        NUMERIC(15,3) NOT NULL
);

CREATE INDEX idx_transfer_items_transfer_id ON stock_transfer_items(transfer_id);

-- ── Ajustements de stock ──────────────────────────────────────
CREATE TABLE stock_adjustments (
                                   id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                   public_id       TEXT NOT NULL,
                                   shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                   warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                                   motif           TEXT NOT NULL,
                                   notes           TEXT,
                                   created_by      UUID REFERENCES shop_users(id),
                                   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                   UNIQUE (shop_id, public_id)
);

CREATE TABLE stock_adjustment_items (
                                        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                        shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                        adjustment_id   UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
                                        product_id      UUID NOT NULL REFERENCES products(id),
                                        quantite_avant  NUMERIC(15,3) NOT NULL,
                                        quantite_apres  NUMERIC(15,3) NOT NULL,
                                        difference      NUMERIC(15,3) NOT NULL
);

-- ── Triggers updated_at ───────────────────────────────────────
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_po_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Fonction atomique : enregistrer une réception ─────────────
CREATE OR REPLACE FUNCTION enregistrer_reception(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
v_rec_id        UUID;
  v_rec_public_id TEXT;
  v_item          JSONB;
  v_shop_id       UUID;
  v_warehouse_id  UUID;
  v_user_id       UUID;
  v_mvt_pid       TEXT;
  v_stock_actuel  NUMERIC;
BEGIN
  v_shop_id      := (p_data->>'shop_id')::UUID;
  v_warehouse_id := (p_data->>'warehouse_id')::UUID;
  v_user_id      := (p_data->>'user_id')::UUID;

SELECT generate_public_id(v_shop_id, 'REC') INTO v_rec_public_id;

INSERT INTO receptions (
    public_id, shop_id, po_id, supplier_id,
    warehouse_id, date_reception, montant_total, notes, created_by
) VALUES (
             v_rec_public_id, v_shop_id,
             NULLIF(p_data->>'po_id', '')::UUID,
             (p_data->>'supplier_id')::UUID,
             v_warehouse_id,
             CURRENT_DATE,
             (p_data->>'montant_total')::NUMERIC,
             NULLIF(p_data->>'notes', ''),
             v_user_id
         ) RETURNING id INTO v_rec_id;

FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items')
                                LOOP
                            -- Insérer ligne réception
    INSERT INTO reception_items (
    shop_id, reception_id, product_id, poi_id,
    designation, quantite, prix_unitaire, montant_ligne
) VALUES (
                  v_shop_id, v_rec_id,
                  (v_item->>'product_id')::UUID,
                  NULLIF(v_item->>'poi_id', '')::UUID,
                  v_item->>'designation',
                  (v_item->>'quantite')::NUMERIC,
                  (v_item->>'prix_unitaire')::NUMERIC,
                  (v_item->>'montant_ligne')::NUMERIC
                  );

-- Augmenter le stock
SELECT quantite INTO v_stock_actuel
FROM stock_levels
WHERE product_id   = (v_item->>'product_id')::UUID
      AND warehouse_id = v_warehouse_id;

IF v_stock_actuel IS NULL THEN
      INSERT INTO stock_levels (shop_id, product_id, warehouse_id, quantite)
      VALUES (v_shop_id, (v_item->>'product_id')::UUID, v_warehouse_id,
              (v_item->>'quantite')::NUMERIC);
      v_stock_actuel := 0;
ELSE
UPDATE stock_levels
SET quantite   = quantite + (v_item->>'quantite')::NUMERIC,
          updated_at = NOW()
WHERE product_id   = (v_item->>'product_id')::UUID
  AND warehouse_id = v_warehouse_id;
END IF;

    -- Mouvement stock
SELECT generate_public_id(v_shop_id, 'MVT') INTO v_mvt_pid;
INSERT INTO stock_movements (
    public_id, shop_id, product_id, warehouse_id,
    type_mouvement, quantite, quantite_avant, quantite_apres,
    reference_type, reference_id, reference_public_id, created_by
) VALUES (
             v_mvt_pid, v_shop_id,
             (v_item->>'product_id')::UUID, v_warehouse_id,
             'reception',
             (v_item->>'quantite')::NUMERIC,
             v_stock_actuel,
             v_stock_actuel + (v_item->>'quantite')::NUMERIC,
             'reception', v_rec_id, v_rec_public_id, v_user_id
         );

-- Mettre à jour prix d'achat produit
UPDATE products SET
    prix_achat = (v_item->>'prix_unitaire')::NUMERIC
WHERE id = (v_item->>'product_id')::UUID
  AND shop_id = v_shop_id;

-- Mettre à jour quantité reçue sur ligne BC si applicable
IF (v_item->>'poi_id') IS NOT NULL AND (v_item->>'poi_id') != '' THEN
UPDATE purchase_order_items SET
    quantite_recue = quantite_recue + (v_item->>'quantite')::NUMERIC
WHERE id = (v_item->>'poi_id')::UUID;
END IF;
END LOOP;

  -- Mettre à jour statut BC si applicable
  IF (p_data->>'po_id') IS NOT NULL AND (p_data->>'po_id') != '' THEN
UPDATE purchase_orders SET
    statut = CASE
                 WHEN NOT EXISTS (
                     SELECT 1 FROM purchase_order_items
                     WHERE po_id = (p_data->>'po_id')::UUID
                         AND quantite_recue < quantite_cmd
                 ) THEN 'recu'
                 ELSE 'partiellement_recu'
        END
WHERE id = (p_data->>'po_id')::UUID;
END IF;

  -- Ajouter au solde fournisseur
UPDATE suppliers SET
    solde_dû = solde_dû + (p_data->>'montant_total')::NUMERIC
WHERE id = (p_data->>'supplier_id')::UUID;

RETURN jsonb_build_object(
        'succes', true,
        'reception_id', v_rec_id,
        'public_id', v_rec_public_id
       );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── Fonction : paiement fournisseur ───────────────────────────
CREATE OR REPLACE FUNCTION payer_fournisseur(
  p_shop_id      UUID,
  p_supplier_id  UUID,
  p_montant      NUMERIC,
  p_moyen        TEXT,
  p_reference    TEXT,
  p_note         TEXT,
  p_user_id      UUID
)
RETURNS JSONB AS $$
DECLARE
v_public_id TEXT;
  v_solde     NUMERIC;
BEGIN
SELECT solde_dû INTO v_solde
FROM suppliers
WHERE id = p_supplier_id AND shop_id = p_shop_id
    FOR UPDATE;

IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Fournisseur introuvable');
END IF;

  IF p_montant > v_solde THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Le montant dépasse le solde dû (' || v_solde || ')'
    );
END IF;

UPDATE suppliers SET
    solde_dû = solde_dû - p_montant
WHERE id = p_supplier_id;

SELECT generate_public_id(p_shop_id, 'SPAY') INTO v_public_id;

INSERT INTO supplier_payments (
    public_id, shop_id, supplier_id,
    montant, moyen_paiement, reference,
    note, created_by
) VALUES (
             v_public_id, p_shop_id, p_supplier_id,
             p_montant, p_moyen,
             NULLIF(p_reference, ''),
             NULLIF(p_note, ''),
             p_user_id
         );

RETURN jsonb_build_object('succes', true, 'nouveau_solde', v_solde - p_montant);
END;
$$ LANGUAGE plpgsql;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reception_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_isolation"      ON suppliers             FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "po_isolation"             ON purchase_orders       FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "poi_isolation"            ON purchase_order_items  FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "receptions_isolation"     ON receptions            FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "rec_items_isolation"      ON reception_items       FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "sret_isolation"           ON supplier_returns      FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "sret_items_isolation"     ON supplier_return_items FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "spay_isolation"           ON supplier_payments     FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "transfers_isolation"      ON stock_transfers       FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "transfer_items_isolation" ON stock_transfer_items  FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "adjustments_isolation"    ON stock_adjustments     FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "adj_items_isolation"      ON stock_adjustment_items FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));