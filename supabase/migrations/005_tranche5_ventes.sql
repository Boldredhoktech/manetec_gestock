-- ============================================================
-- MIGRATION 005 — Tranche 5 : Ventes et POS
-- ============================================================

-- ── Ventes (entête) ───────────────────────────────────────────
CREATE TABLE sales (
                       id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       public_id           TEXT NOT NULL,
                       shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                       client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
                       warehouse_id        UUID NOT NULL REFERENCES warehouses(id),
                       vendeur_id          UUID REFERENCES shop_users(id),
                       statut              TEXT NOT NULL DEFAULT 'completee'
                           CHECK (statut IN ('completee', 'annulee', 'remboursee')),
                       montant_brut        NUMERIC(15,2) NOT NULL DEFAULT 0,
                       remise_globale_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
                       remise_globale_val  NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_net         NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_tva         NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_total       NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_recu        NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_rendu       NUMERIC(15,2) NOT NULL DEFAULT 0,
                       credit_utilise      NUMERIC(15,2) NOT NULL DEFAULT 0,
                       advance_utilise     NUMERIC(15,2) NOT NULL DEFAULT 0,
                       change_utilise      NUMERIC(15,2) NOT NULL DEFAULT 0,
                       credit_accorde      NUMERIC(15,2) NOT NULL DEFAULT 0,
                       note                TEXT,
                       created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_sales_shop_id     ON sales(shop_id);
CREATE INDEX idx_sales_client_id   ON sales(client_id);
CREATE INDEX idx_sales_vendeur_id  ON sales(vendeur_id);
CREATE INDEX idx_sales_created_at  ON sales(created_at);
CREATE INDEX idx_sales_statut      ON sales(statut);

-- ── Lignes de vente ───────────────────────────────────────────
CREATE TABLE sale_items (
                            id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                            sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                            product_id      UUID NOT NULL REFERENCES products(id),
                            warehouse_id    UUID NOT NULL REFERENCES warehouses(id),
                            quantite        NUMERIC(15,3) NOT NULL,
                            prix_unitaire   NUMERIC(15,2) NOT NULL,
                            remise_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
                            remise_val      NUMERIC(15,2) NOT NULL DEFAULT 0,
                            montant_ligne   NUMERIC(15,2) NOT NULL,
                            tva_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
                            montant_tva     NUMERIC(15,2) NOT NULL DEFAULT 0,
                            imei            TEXT,
                            note            TEXT
);

CREATE INDEX idx_sale_items_sale_id    ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX idx_sale_items_shop_id    ON sale_items(shop_id);

-- ── Paiements d'une vente ─────────────────────────────────────
CREATE TABLE sale_payments (
                               id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                               shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                               sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                               moyen_paiement  TEXT NOT NULL,
                               montant         NUMERIC(15,2) NOT NULL,
                               reference       TEXT,
                               created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX idx_sale_payments_shop_id ON sale_payments(shop_id);

-- ── Triggers ──────────────────────────────────────────────────
CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE sales         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_isolation"
  ON sales FOR ALL
  USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

CREATE POLICY "sale_items_isolation"
  ON sale_items FOR ALL
  USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

CREATE POLICY "sale_payments_isolation"
  ON sale_payments FOR ALL
  USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

-- ── Fonction atomique : enregistrer une vente complète ────────
CREATE OR REPLACE FUNCTION enregistrer_vente(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
v_sale_id       UUID;
  v_sale_public_id TEXT;
  v_item          JSONB;
  v_stock_result  JSONB;
  v_shop_id       UUID;
  v_warehouse_id  UUID;
  v_user_id       UUID;
BEGIN
  v_shop_id      := (p_data->>'shop_id')::UUID;
  v_warehouse_id := (p_data->>'warehouse_id')::UUID;
  v_user_id      := (p_data->>'vendeur_id')::UUID;

  -- Générer public_id vente
SELECT generate_public_id(v_shop_id, 'VENTE') INTO v_sale_public_id;

-- Créer l'entête de vente
INSERT INTO sales (
    public_id, shop_id, client_id, warehouse_id, vendeur_id,
    statut, montant_brut, remise_globale_pct, remise_globale_val,
    montant_net, montant_tva, montant_total,
    montant_recu, montant_rendu,
    credit_utilise, advance_utilise, change_utilise, credit_accorde,
    note
) VALUES (
             v_sale_public_id,
             v_shop_id,
             NULLIF(p_data->>'client_id', '')::UUID,
             v_warehouse_id,
             v_user_id,
             'completee',
             (p_data->>'montant_brut')::NUMERIC,
             (p_data->>'remise_globale_pct')::NUMERIC,
             (p_data->>'remise_globale_val')::NUMERIC,
             (p_data->>'montant_net')::NUMERIC,
             (p_data->>'montant_tva')::NUMERIC,
             (p_data->>'montant_total')::NUMERIC,
             (p_data->>'montant_recu')::NUMERIC,
             (p_data->>'montant_rendu')::NUMERIC,
             (p_data->>'credit_utilise')::NUMERIC,
             (p_data->>'advance_utilise')::NUMERIC,
             (p_data->>'change_utilise')::NUMERIC,
             (p_data->>'credit_accorde')::NUMERIC,
             p_data->>'note'
         )
    RETURNING id INTO v_sale_id;

-- Traiter chaque ligne
FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items')
                                LOOP
-- Déduire le stock (règle S1)
SELECT deduire_stock(
               v_shop_id,
               (v_item->>'product_id')::UUID,
               v_warehouse_id,
               (v_item->>'quantite')::NUMERIC,
               'sale',
               v_sale_id,
               v_sale_public_id,
               v_user_id
       ) INTO v_stock_result;

IF NOT (v_stock_result->>'succes')::BOOLEAN THEN
      RAISE EXCEPTION '%', v_stock_result->>'erreur';
END IF;

    -- Insérer la ligne de vente
INSERT INTO sale_items (
    shop_id, sale_id, product_id, warehouse_id,
    quantite, prix_unitaire, remise_pct, remise_val,
    montant_ligne, tva_pct, montant_tva, imei, note
) VALUES (
             v_shop_id, v_sale_id,
             (v_item->>'product_id')::UUID,
             v_warehouse_id,
             (v_item->>'quantite')::NUMERIC,
             (v_item->>'prix_unitaire')::NUMERIC,
             COALESCE((v_item->>'remise_pct')::NUMERIC, 0),
             COALESCE((v_item->>'remise_val')::NUMERIC, 0),
             (v_item->>'montant_ligne')::NUMERIC,
             COALESCE((v_item->>'tva_pct')::NUMERIC, 0),
             COALESCE((v_item->>'montant_tva')::NUMERIC, 0),
             NULLIF(v_item->>'imei', ''),
             NULLIF(v_item->>'note', '')
         );
END LOOP;

  -- Insérer les paiements
FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'paiements')
                                LOOP
    INSERT INTO sale_payments (
    shop_id, sale_id, moyen_paiement, montant, reference
) VALUES (
                  v_shop_id, v_sale_id,
                  v_item->>'moyen_paiement',
                  (v_item->>'montant')::NUMERIC,
                  NULLIF(v_item->>'reference', '')
                  );
END LOOP;

  -- Mettre à jour les soldes client si nécessaire
  IF (p_data->>'client_id') IS NOT NULL AND (p_data->>'client_id') != '' THEN

    -- Déduire avance utilisée
    IF (p_data->>'advance_utilise')::NUMERIC > 0 THEN
UPDATE clients SET
    advance_balance = advance_balance - (p_data->>'advance_utilise')::NUMERIC
WHERE id = (p_data->>'client_id')::UUID;
END IF;

    -- Déduire monnaie utilisée
    IF (p_data->>'change_utilise')::NUMERIC > 0 THEN
UPDATE clients SET
    change_balance = change_balance - (p_data->>'change_utilise')::NUMERIC
WHERE id = (p_data->>'client_id')::UUID;
END IF;

    -- Ajouter crédit accordé
    IF (p_data->>'credit_accorde')::NUMERIC > 0 THEN
UPDATE clients SET
    credit_balance = credit_balance + (p_data->>'credit_accorde')::NUMERIC
WHERE id = (p_data->>'client_id')::UUID;
END IF;

    -- Déposer monnaie rendue en attente
    IF (p_data->>'montant_rendu')::NUMERIC > 0
       AND (p_data->>'garder_monnaie')::BOOLEAN = TRUE THEN
UPDATE clients SET
    change_balance = change_balance + (p_data->>'montant_rendu')::NUMERIC
WHERE id = (p_data->>'client_id')::UUID;
END IF;

END IF;

RETURN jsonb_build_object(
        'succes', true,
        'sale_id', v_sale_id,
        'public_id', v_sale_public_id
       );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;