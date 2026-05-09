-- ============================================================
-- MIGRATION 004 — Tranche 4 : Clients
-- ============================================================

CREATE TABLE clients (
                         id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                         public_id         TEXT NOT NULL,
                         shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                         nom               TEXT NOT NULL,
                         telephone         TEXT,
                         email             TEXT,
                         adresse           TEXT,
                         est_anonyme       BOOLEAN NOT NULL DEFAULT FALSE,
                         credit_balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
                         advance_balance   NUMERIC(15,2) NOT NULL DEFAULT 0,
                         change_balance    NUMERIC(15,2) NOT NULL DEFAULT 0,
                         notes             TEXT,
                         est_actif         BOOLEAN NOT NULL DEFAULT TRUE,
                         created_by        UUID REFERENCES shop_users(id),
                         created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         UNIQUE (shop_id, public_id)
);

CREATE INDEX idx_clients_shop_id   ON clients(shop_id);
CREATE INDEX idx_clients_telephone ON clients(telephone);
CREATE INDEX idx_clients_actif     ON clients(est_actif);

-- ── Opérations sur les soldes clients ────────────────────────
CREATE TABLE client_balance_operations (
                                           id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                           shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                           client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                                           type_operation  TEXT NOT NULL CHECK (type_operation IN (
                                                                                                   'credit_remboursement',
                                                                                                   'credit_utilisation',
                                                                                                   'advance_depot',
                                                                                                   'advance_utilisation',
                                                                                                   'change_depot',
                                                                                                   'change_utilisation'
                                               )),
                                           montant         NUMERIC(15,2) NOT NULL,
                                           solde_avant     NUMERIC(15,2) NOT NULL,
                                           solde_apres     NUMERIC(15,2) NOT NULL,
                                           reference_type  TEXT,
                                           reference_id    UUID,
                                           note            TEXT,
                                           created_by      UUID REFERENCES shop_users(id),
                                           created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_ops_client_id ON client_balance_operations(client_id);
CREATE INDEX idx_client_ops_shop_id   ON client_balance_operations(shop_id);

-- ── Trigger updated_at ────────────────────────────────────────
CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE clients                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_balance_operations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_isolation"
ON clients FOR ALL
USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

CREATE POLICY "client_ops_isolation"
ON client_balance_operations FOR ALL
USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

-- ── Règle F2 : client anonyme ne peut pas avoir de crédit ────
-- Enforced côté application, mais aussi en base :
CREATE OR REPLACE FUNCTION check_client_credit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.est_anonyme = TRUE AND NEW.credit_balance > 0 THEN
    RAISE EXCEPTION 'Un client anonyme ne peut pas avoir de solde crédit (règle F2)';
END IF;
  IF NEW.est_anonyme = TRUE AND NEW.advance_balance > 0 THEN
    RAISE EXCEPTION 'Un client anonyme ne peut pas avoir de solde avance (règle F2)';
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_client_credit
    BEFORE INSERT OR UPDATE ON clients
                         FOR EACH ROW EXECUTE FUNCTION check_client_credit();

-- ── Client anonyme par défaut (créé automatiquement par boutique)
-- Sera créé côté application lors du onboarding boutique