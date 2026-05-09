-- ============================================================
-- MIGRATION 006 — Tranche 6 : Facturation
-- ============================================================

-- ── Clients entreprise (distincts des clients POS) ───────────
CREATE TABLE business_clients (
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
                                  notes           TEXT,
                                  est_actif       BOOLEAN NOT NULL DEFAULT TRUE,
                                  created_by      UUID REFERENCES shop_users(id),
                                  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                  UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_biz_clients_shop_id ON business_clients(shop_id);

-- ── Devis ─────────────────────────────────────────────────────
CREATE TABLE devis (
                       id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       public_id           TEXT NOT NULL,
                       shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                       client_id           UUID REFERENCES business_clients(id) ON DELETE SET NULL,
                       statut              TEXT NOT NULL DEFAULT 'brouillon'
                           CHECK (statut IN ('brouillon','envoye','accepte','refuse','expire')),
                       date_devis          DATE NOT NULL DEFAULT CURRENT_DATE,
                       date_validite       DATE,
                       objet               TEXT,
                       montant_ht          NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_tva         NUMERIC(15,2) NOT NULL DEFAULT 0,
                       montant_ttc         NUMERIC(15,2) NOT NULL DEFAULT 0,
                       remise_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
                       remise_val          NUMERIC(15,2) NOT NULL DEFAULT 0,
                       note_client         TEXT,
                       note_interne        TEXT,
                       converti_en_facture UUID,
                       created_by          UUID REFERENCES shop_users(id),
                       created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_devis_shop_id    ON devis(shop_id);
CREATE INDEX idx_devis_client_id  ON devis(client_id);
CREATE INDEX idx_devis_statut     ON devis(statut);

-- ── Lignes de devis ───────────────────────────────────────────
CREATE TABLE devis_items (
                             id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                             shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                             devis_id        UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
                             product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
                             designation     TEXT NOT NULL,
                             quantite        NUMERIC(15,3) NOT NULL DEFAULT 1,
                             prix_unitaire   NUMERIC(15,2) NOT NULL,
                             remise_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
                             remise_val      NUMERIC(15,2) NOT NULL DEFAULT 0,
                             montant_ht      NUMERIC(15,2) NOT NULL,
                             tva_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
                             montant_tva     NUMERIC(15,2) NOT NULL DEFAULT 0,
                             montant_ttc     NUMERIC(15,2) NOT NULL,
                             ordre           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_devis_items_devis_id ON devis_items(devis_id);

-- ── Factures ──────────────────────────────────────────────────
CREATE TABLE factures (
                          id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                          public_id           TEXT NOT NULL,
                          shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                          client_id           UUID REFERENCES business_clients(id) ON DELETE SET NULL,
                          devis_id            UUID REFERENCES devis(id) ON DELETE SET NULL,
                          statut              TEXT NOT NULL DEFAULT 'emise'
                              CHECK (statut IN ('emise','partiellement_payee','payee','en_retard','annulee')),
                          date_facture        DATE NOT NULL DEFAULT CURRENT_DATE,
                          date_echeance       DATE,
                          objet               TEXT,
                          montant_ht          NUMERIC(15,2) NOT NULL DEFAULT 0,
                          montant_tva         NUMERIC(15,2) NOT NULL DEFAULT 0,
                          montant_ttc         NUMERIC(15,2) NOT NULL DEFAULT 0,
                          montant_paye        NUMERIC(15,2) NOT NULL DEFAULT 0,
                          montant_restant     NUMERIC(15,2) NOT NULL DEFAULT 0,
                          remise_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
                          remise_val          NUMERIC(15,2) NOT NULL DEFAULT 0,
                          note_client         TEXT,
                          note_interne        TEXT,
    -- Règle F1 : facture immuable après émission
                          est_immutable       BOOLEAN NOT NULL DEFAULT FALSE,
                          created_by          UUID REFERENCES shop_users(id),
                          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_factures_shop_id   ON factures(shop_id);
CREATE INDEX idx_factures_client_id ON factures(client_id);
CREATE INDEX idx_factures_statut    ON factures(statut);
CREATE INDEX idx_factures_echeance  ON factures(date_echeance);

-- ── Lignes de facture ─────────────────────────────────────────
CREATE TABLE facture_items (
                               id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                               shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                               facture_id      UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
                               product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
                               designation     TEXT NOT NULL,
                               quantite        NUMERIC(15,3) NOT NULL DEFAULT 1,
                               prix_unitaire   NUMERIC(15,2) NOT NULL,
                               remise_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,
                               remise_val      NUMERIC(15,2) NOT NULL DEFAULT 0,
                               montant_ht      NUMERIC(15,2) NOT NULL,
                               tva_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
                               montant_tva     NUMERIC(15,2) NOT NULL DEFAULT 0,
                               montant_ttc     NUMERIC(15,2) NOT NULL,
                               ordre           INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_facture_items_facture_id ON facture_items(facture_id);

-- ── Paiements de facture ──────────────────────────────────────
CREATE TABLE facture_payments (
                                  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                  public_id       TEXT NOT NULL,
                                  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                  facture_id      UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
                                  moyen_paiement  TEXT NOT NULL,
                                  montant         NUMERIC(15,2) NOT NULL,
                                  reference       TEXT,
                                  note            TEXT,
                                  date_paiement   DATE NOT NULL DEFAULT CURRENT_DATE,
                                  created_by      UUID REFERENCES shop_users(id),
                                  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                  UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_fpay_facture_id ON facture_payments(facture_id);
CREATE INDEX idx_fpay_shop_id    ON facture_payments(shop_id);

-- ── Avoirs ────────────────────────────────────────────────────
CREATE TABLE avoirs (
                        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                        public_id       TEXT NOT NULL,
                        shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                        facture_id      UUID NOT NULL REFERENCES factures(id),
                        client_id       UUID REFERENCES business_clients(id) ON DELETE SET NULL,
                        motif           TEXT NOT NULL,
                        montant         NUMERIC(15,2) NOT NULL,
                        est_applique    BOOLEAN NOT NULL DEFAULT FALSE,
                        created_by      UUID REFERENCES shop_users(id),
                        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_avoirs_facture_id ON avoirs(facture_id);
CREATE INDEX idx_avoirs_shop_id    ON avoirs(shop_id);

-- ── Triggers updated_at ───────────────────────────────────────
CREATE TRIGGER trg_biz_clients_updated_at
    BEFORE UPDATE ON business_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_devis_updated_at
    BEFORE UPDATE ON devis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_factures_updated_at
    BEFORE UPDATE ON factures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Règle F1 : facture immuable après émission ────────────────
CREATE OR REPLACE FUNCTION check_facture_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.est_immutable = TRUE THEN
    IF NEW.montant_ht != OLD.montant_ht
    OR NEW.montant_ttc != OLD.montant_ttc
    OR NEW.client_id != OLD.client_id THEN
      RAISE EXCEPTION 'Cette facture est immuable et ne peut plus être modifiée (règle F1)';
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_facture_immutable
    BEFORE UPDATE ON factures
    FOR EACH ROW EXECUTE FUNCTION check_facture_immutable();

-- ── Fonction : enregistrer un paiement de facture ─────────────
CREATE OR REPLACE FUNCTION payer_facture(
  p_shop_id       UUID,
  p_facture_id    UUID,
  p_montant       NUMERIC,
  p_moyen         TEXT,
  p_reference     TEXT,
  p_note          TEXT,
  p_user_id       UUID
)
RETURNS JSONB AS $$
DECLARE
v_facture       RECORD;
  v_public_id     TEXT;
  v_nouveau_paye  NUMERIC;
  v_nouveau_reste NUMERIC;
  v_statut        TEXT;
BEGIN
SELECT * INTO v_facture
FROM factures
WHERE id = p_facture_id AND shop_id = p_shop_id
    FOR UPDATE;

IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable');
END IF;

  IF v_facture.statut = 'annulee' THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Cette facture est annulée');
END IF;

  IF p_montant > v_facture.montant_restant THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Le montant dépasse le reste à payer (' ||
                v_facture.montant_restant || ')'
    );
END IF;

  v_nouveau_paye  := v_facture.montant_paye + p_montant;
  v_nouveau_reste := v_facture.montant_ttc - v_nouveau_paye;

  IF v_nouveau_reste <= 0 THEN
    v_statut := 'payee';
ELSE
    v_statut := 'partiellement_payee';
END IF;

UPDATE factures SET
                    montant_paye    = v_nouveau_paye,
                    montant_restant = GREATEST(v_nouveau_reste, 0),
                    statut          = v_statut
WHERE id = p_facture_id;

SELECT generate_public_id(p_shop_id, 'FPAY') INTO v_public_id;

INSERT INTO facture_payments (
    public_id, shop_id, facture_id,
    moyen_paiement, montant, reference,
    note, created_by
) VALUES (
             v_public_id, p_shop_id, p_facture_id,
             p_moyen, p_montant, NULLIF(p_reference, ''),
             NULLIF(p_note, ''), p_user_id
         );

RETURN jsonb_build_object(
        'succes', true,
        'statut', v_statut,
        'montant_paye', v_nouveau_paye,
        'montant_restant', GREATEST(v_nouveau_reste, 0)
       );
END;
$$ LANGUAGE plpgsql;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE business_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis              ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures           ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE facture_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE avoirs             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biz_clients_isolation"  ON business_clients FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "devis_isolation"        ON devis            FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "devis_items_isolation"  ON devis_items      FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "factures_isolation"     ON factures         FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "facture_items_isolation" ON facture_items   FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "fpay_isolation"         ON facture_payments FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
CREATE POLICY "avoirs_isolation"       ON avoirs           FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));