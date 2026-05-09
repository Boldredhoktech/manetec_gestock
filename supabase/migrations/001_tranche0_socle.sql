-- ============================================================
-- MIGRATION 001 — Tranche 0 : Socle technique Manetec_Gestock
-- ============================================================
-- Ordre d'exécution : ce fichier en entier, dans l'ordre
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1 : platform_admins
-- Équipe Bold Redhok Tech (Super-SuperAdmin + Agents)
-- ============================================================
CREATE TABLE platform_admins (
                                 id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 public_id         TEXT UNIQUE NOT NULL,
                                 nom_complet       TEXT NOT NULL,
                                 email             TEXT UNIQUE NOT NULL,
                                 password_hash     TEXT NOT NULL,
                                 role              TEXT NOT NULL CHECK (role IN ('super_platform_admin', 'platform_agent')),
                                 est_actif         BOOLEAN NOT NULL DEFAULT TRUE,
                                 tentatives_echecs INTEGER NOT NULL DEFAULT 0,
                                 est_bloque        BOOLEAN NOT NULL DEFAULT FALSE,
                                 bloque_le         TIMESTAMPTZ,
                                 created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_admins_email   ON platform_admins(email);
CREATE INDEX idx_platform_admins_role    ON platform_admins(role);
CREATE INDEX idx_platform_admins_actif   ON platform_admins(est_actif);

-- ============================================================
-- TABLE 2 : shops
-- Chaque boutique créée par Bold Redhok Tech
-- ============================================================
CREATE TABLE shops (
                       id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       public_id               TEXT UNIQUE NOT NULL,
                       nom                     TEXT NOT NULL,
                       logo_url                TEXT,
                       adresse                 TEXT,
                       ville                   TEXT,
                       pays                    TEXT NOT NULL DEFAULT 'Bénin',
                       telephone_1             TEXT NOT NULL,
                       telephone_2             TEXT,
                       email                   TEXT,
                       site_web                TEXT,
                       ifu                     TEXT,
                       rccm                    TEXT,
                       devise                  TEXT NOT NULL DEFAULT 'FCFA',
                       remise_max_pct          NUMERIC(5,2) NOT NULL DEFAULT 15.00,
                       message_pied_facture    TEXT,
                       message_recu_thermique  TEXT,
                       plan                    TEXT NOT NULL DEFAULT 'starter'
                           CHECK (plan IN ('starter', 'pro', 'enterprise')),
                       plan_expire_le          TIMESTAMPTZ,
                       est_active              BOOLEAN NOT NULL DEFAULT TRUE,
                       activation_manuelle     BOOLEAN NOT NULL DEFAULT FALSE,
                       note_activation         TEXT,
                       active_par              UUID REFERENCES platform_admins(id),
                       created_by              UUID REFERENCES platform_admins(id),
                       created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shops_public_id  ON shops(public_id);
CREATE INDEX idx_shops_plan       ON shops(plan);
CREATE INDEX idx_shops_active     ON shops(est_active);

-- ============================================================
-- TABLE 3 : shop_users
-- Utilisateurs de chaque boutique (SuperAdmin boutique, Vendeur, etc.)
-- ============================================================
CREATE TABLE shop_users (
                            id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            public_id           TEXT UNIQUE NOT NULL,
                            shop_id             UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                            nom_complet         TEXT NOT NULL,
                            identifiant         TEXT NOT NULL,
                            password_hash       TEXT NOT NULL,
                            role                TEXT NOT NULL CHECK (role IN (
                                                                              'super_admin_boutique',
                                                                              'vendeur',
                                                                              'stock_manager',
                                                                              'comptable'
                                )),
                            tentatives_echecs   INTEGER NOT NULL DEFAULT 0,
                            est_bloque          BOOLEAN NOT NULL DEFAULT FALSE,
                            bloque_le           TIMESTAMPTZ,
                            est_actif           BOOLEAN NOT NULL DEFAULT TRUE,
                            desactive_le        TIMESTAMPTZ,
                            preference_theme    TEXT NOT NULL DEFAULT 'systeme'
                                CHECK (preference_theme IN ('clair', 'sombre', 'systeme')),
                            version             INTEGER NOT NULL DEFAULT 1,
                            created_by          UUID REFERENCES shop_users(id),
                            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un identifiant est unique par boutique (pas globalement)
                            UNIQUE (shop_id, identifiant)
);

CREATE INDEX idx_shop_users_shop_id    ON shop_users(shop_id);
CREATE INDEX idx_shop_users_public_id  ON shop_users(public_id);
CREATE INDEX idx_shop_users_role       ON shop_users(role);
CREATE INDEX idx_shop_users_actif      ON shop_users(est_actif);

-- ============================================================
-- TABLE 4 : shop_user_permissions
-- Permissions étendues accordées par le SuperAdmin boutique
-- ============================================================
CREATE TABLE shop_user_permissions (
                                       id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                       shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                       user_id      UUID NOT NULL REFERENCES shop_users(id) ON DELETE CASCADE,
                                       permission   TEXT NOT NULL,
                                       accorde_par  UUID REFERENCES shop_users(id),
                                       accorde_le   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                       UNIQUE (user_id, permission)
);

CREATE INDEX idx_permissions_user_id  ON shop_user_permissions(user_id);
CREATE INDEX idx_permissions_shop_id  ON shop_user_permissions(shop_id);

-- ============================================================
-- TABLE 5 : public_id_counters
-- Compteurs séquentiels par boutique et par type d'entité
-- ============================================================
CREATE TABLE public_id_counters (
                                    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                    shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                                    prefix      TEXT NOT NULL,
                                    last_value  INTEGER NOT NULL DEFAULT 0,
                                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                    UNIQUE (shop_id, prefix)
);

CREATE INDEX idx_counters_shop_id ON public_id_counters(shop_id);

-- ============================================================
-- TABLE 6 : platform_sessions
-- Sessions actives des admins Bold Redhok Tech
-- ============================================================
CREATE TABLE platform_sessions (
                                   id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                   admin_id        UUID NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
                                   token_hash      TEXT NOT NULL,
                                   ip_address      TEXT,
                                   user_agent      TEXT,
                                   expire_le       TIMESTAMPTZ NOT NULL,
                                   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                   derniere_activite TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_sessions_admin_id ON platform_sessions(admin_id);

-- ============================================================
-- TABLE 7 : shop_sessions
-- Sessions actives des utilisateurs de boutique
-- ============================================================
CREATE TABLE shop_sessions (
                               id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                               user_id           UUID NOT NULL REFERENCES shop_users(id) ON DELETE CASCADE,
                               shop_id           UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                               token_hash        TEXT NOT NULL,
                               ip_address        TEXT,
                               user_agent        TEXT,
                               expire_le         TIMESTAMPTZ NOT NULL,
                               created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                               derniere_activite TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shop_sessions_user_id  ON shop_sessions(user_id);
CREATE INDEX idx_shop_sessions_shop_id  ON shop_sessions(shop_id);

-- ============================================================
-- TABLE 8 : audit_logs
-- Journal immuable de toutes les actions critiques
-- ============================================================
CREATE TABLE audit_logs (
                            id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                            shop_id            UUID REFERENCES shops(id) ON DELETE SET NULL,
                            user_id            UUID,
                            user_public_id     TEXT,
                            user_nom           TEXT,
                            type_acteur        TEXT NOT NULL CHECK (type_acteur IN ('platform', 'shop')),
                            event_type         TEXT NOT NULL,
                            reference_type     TEXT,
                            reference_id       UUID,
                            reference_public_id TEXT,
                            details_json       JSONB,
                            ip_address         TEXT,
                            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_shop_id     ON audit_logs(shop_id);
CREATE INDEX idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type  ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(created_at);

-- ============================================================
-- FONCTION : mise à jour automatique de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_platform_admins_updated_at
    BEFORE UPDATE ON platform_admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_shop_users_updated_at
    BEFORE UPDATE ON shop_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FONCTION : génération d'identifiant public atomique
-- Appelée depuis le serveur Next.js via RPC Supabase
-- ============================================================
CREATE OR REPLACE FUNCTION generate_public_id(
  p_shop_id UUID,
  p_prefix  TEXT
)
RETURNS TEXT AS $$
DECLARE
v_next INTEGER;
  v_padded TEXT;
BEGIN
INSERT INTO public_id_counters (shop_id, prefix, last_value)
VALUES (p_shop_id, p_prefix, 1)
    ON CONFLICT (shop_id, prefix)
  DO UPDATE SET
    last_value = public_id_counters.last_value + 1,
             updated_at = NOW()
             RETURNING last_value INTO v_next;

IF v_next > 99999 THEN
    v_padded := LPAD(v_next::TEXT, 6, '0');
ELSE
    v_padded := LPAD(v_next::TEXT, 5, '0');
END IF;

RETURN p_prefix || '-' || v_padded;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activer RLS sur toutes les tables sensibles
ALTER TABLE shops                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_id_counters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

-- Les platform_admins n'ont pas de RLS — accès via service_role uniquement
-- Les politiques RLS boutique seront ajoutées tranche par tranche

-- ============================================================
-- DONNÉES INITIALES : Premier Super Platform Admin
-- (mot de passe à changer immédiatement après installation)
-- Le hash correspond à "BoldRedhok2026!" — À CHANGER
-- ============================================================
INSERT INTO platform_admins (
    public_id,
    nom_complet,
    email,
    password_hash,
    role
) VALUES (
             'PLAT-00001',
             'Super Admin Plateforme',
             'admin@boldredhok.com',
             'HASH_A_REMPLACER_ARGON2',
             'super_platform_admin'
         );

-- ============================================================
-- INITIALISATION : compteur global plateforme
-- (pour les public_id des boutiques elles-mêmes)
-- ============================================================
CREATE TABLE platform_id_counters (
                                      prefix      TEXT PRIMARY KEY,
                                      last_value  INTEGER NOT NULL DEFAULT 0,
                                      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_id_counters (prefix, last_value)
VALUES ('SHOP', 0);

CREATE OR REPLACE FUNCTION generate_platform_id(p_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
v_next INTEGER;
BEGIN
UPDATE platform_id_counters
SET last_value = last_value + 1,
    updated_at = NOW()
WHERE prefix = p_prefix
    RETURNING last_value INTO v_next;

RETURN p_prefix || '-' || LPAD(v_next::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;