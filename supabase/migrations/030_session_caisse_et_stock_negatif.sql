-- ============================================================
-- MIGRATION 030 — Session de caisse et stock négatif
-- ============================================================
--
-- Deux décisions restées ouvertes trouvent ici leur réponse.
--
-- D1 (renvoyée par le module Finances) : une SESSION DE CAISSE par
-- journée et par entrepôt — pas par caissier. Une boutique de quartier
-- a un tiroir, pas un caissier attitré ; compter le tiroir le soir est
-- le geste réel. C'est l'écart constaté à la fermeture qui rend enfin
-- vérifiable le solde théorique de la ventilation livrée au Lot 4
-- Finances, où `bank_transfer` et `moov_money` affichent des soldes
-- négatifs faute de mouvements enregistrés.
--
-- D3 (ouverte depuis le module Stock) : le stock négatif devient un
-- PARAMÈTRE par boutique, bloqué par défaut. Le blocage protège la
-- justesse du stock, raison d'être du logiciel ; mais une boutique dont
-- l'inventaire initial est incomplet doit pouvoir vendre le temps de le
-- corriger.
-- ============================================================

-- ── 1. Stock négatif : un paramètre, pas un absolu (D3) ──────
ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS autoriser_stock_negatif BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN shops.autoriser_stock_negatif IS
    'Décision D3 du module POS. FALSE (défaut) : une vente qui ferait passer le stock sous zéro est refusée. TRUE : elle passe, et l''écart devient visible à l''inventaire. Jamais un choix silencieux : la vente forcée laisse une note sur son mouvement.';

-- `deduire_stock` lisait FALSE en dur. Elle consulte désormais le
-- paramètre de la boutique, et annote le mouvement quand il force le
-- négatif — sans cette note, l'écart serait invisible à l'inventaire.
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
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_res      JSONB;
    v_autorise BOOLEAN;
    v_avant    NUMERIC;
    v_note     TEXT := NULL;
BEGIN
    SELECT autoriser_stock_negatif INTO v_autorise
      FROM shops WHERE id = p_shop_id;

    v_autorise := COALESCE(v_autorise, FALSE);

    IF v_autorise THEN
        SELECT quantite INTO v_avant FROM stock_levels
         WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

        IF COALESCE(v_avant, 0) - p_quantite < 0 THEN
            v_note := 'Vente au-delà du stock disponible ('
                   || COALESCE(v_avant, 0) || ' en stock, ' || p_quantite
                   || ' vendus) — écart à régulariser à l''inventaire.';
        END IF;
    END IF;

    v_res := appliquer_mouvement_stock(
        p_shop_id, p_product_id, p_warehouse_id,
        -p_quantite, 'vente',
        p_reference_type, p_reference_id, p_reference_pid,
        v_note, p_user_id, v_autorise
    );

    IF NOT (v_res->>'succes')::BOOLEAN THEN
        RETURN v_res;
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'stock_restant', (v_res->>'stock_apres')::NUMERIC,
        'stock_force',   v_note IS NOT NULL
    );
END;
$$;

-- ── 2. Session de caisse (décision D1) ──────────────────────
CREATE TABLE IF NOT EXISTS cash_sessions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id     TEXT NOT NULL,
    shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
    -- Le jour ouvré, pas l'instant : une session couvre une journée.
    jour          DATE NOT NULL DEFAULT CURRENT_DATE,
    statut        TEXT NOT NULL DEFAULT 'ouverte'
                  CHECK (statut IN ('ouverte', 'fermee')),
    fond_initial  NUMERIC(15,2) NOT NULL DEFAULT 0,
    -- Renseignés à la fermeture.
    compte_especes NUMERIC(15,2),
    attendu_especes NUMERIC(15,2),
    ecart         NUMERIC(15,2),
    note_ouverture TEXT,
    note_fermeture TEXT,
    ouverte_par   UUID REFERENCES shop_users(id),
    ouverte_le    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fermee_par    UUID REFERENCES shop_users(id),
    fermee_le     TIMESTAMPTZ,
    UNIQUE (shop_id, public_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_shop_jour
    ON cash_sessions(shop_id, jour DESC);

-- Une seule session ouverte par entrepôt à la fois : deux tiroirs
-- ouverts pour le même comptoir n'auraient aucun sens.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_une_ouverte
    ON cash_sessions(shop_id, warehouse_id) WHERE statut = 'ouverte';

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_isolation" ON cash_sessions;
CREATE POLICY "cash_sessions_isolation" ON cash_sessions FOR ALL
    USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));

COMMENT ON TABLE cash_sessions IS
    'Session de caisse par journée et par entrepôt (décision D1 du module POS) : fond initial à l''ouverture, comptage à la fermeture, écart constaté. Ce n''est pas une session par caissier — une boutique de quartier a un tiroir, pas un caissier attitré.';

-- ── 3. Ouvrir la caisse ─────────────────────────────────────
CREATE OR REPLACE FUNCTION ouvrir_session_caisse(
    p_shop_id      UUID,
    p_warehouse_id UUID,
    p_fond         NUMERIC,
    p_note         TEXT,
    p_user_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_pid    TEXT;
    v_id     UUID;
    v_ouverte RECORD;
BEGIN
    IF p_fond IS NULL OR p_fond < 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Fond de caisse invalide.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND shop_id = p_shop_id
    ) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    SELECT * INTO v_ouverte FROM cash_sessions
     WHERE shop_id = p_shop_id AND warehouse_id = p_warehouse_id AND statut = 'ouverte';

    IF FOUND THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Une caisse est déjà ouverte pour cet entrepôt depuis le ' || v_ouverte.jour || '.',
            'session_id', v_ouverte.id
        );
    END IF;

    SELECT generate_public_id(p_shop_id, 'CAISSE') INTO v_pid;

    INSERT INTO cash_sessions (
        public_id, shop_id, warehouse_id, jour, statut,
        fond_initial, note_ouverture, ouverte_par
    ) VALUES (
        v_pid, p_shop_id, p_warehouse_id, CURRENT_DATE, 'ouverte',
        p_fond, NULLIF(p_note, ''), p_user_id
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object('succes', true, 'session_id', v_id, 'public_id', v_pid);
END;
$$;

-- ── 4. Ce que la caisse devrait contenir ────────────────────
-- Les espèces attendues : fond initial + encaissements en espèces −
-- sorties en espèces, depuis l'ouverture. On s'appuie sur les mêmes
-- sources que la ventilation du Lot 4 Finances, filtrées sur `cash`.
CREATE OR REPLACE FUNCTION especes_attendues_session(p_session_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
    WITH s AS (
        SELECT * FROM cash_sessions WHERE id = p_session_id
    )
    SELECT
        s.fond_initial
        -- Encaissements au comptoir, sur cet entrepôt, depuis l'ouverture
        + COALESCE((
            SELECT SUM(sp.montant)
              FROM sale_payments sp
              JOIN sales v ON v.id = sp.sale_id
             WHERE v.shop_id = s.shop_id
               AND v.warehouse_id = s.warehouse_id
               AND v.statut = 'completee'
               AND sp.moyen_paiement = 'cash'
               AND v.created_at >= s.ouverte_le
               AND (s.fermee_le IS NULL OR v.created_at < s.fermee_le)
        ), 0)
        -- Règlements de facture encaissés en espèces le même jour
        + COALESCE((
            SELECT SUM(fp.montant)
              FROM facture_payments fp
             WHERE fp.shop_id = s.shop_id
               AND fp.moyen_paiement = 'cash'
               AND NOT fp.est_annule
               AND fp.date_paiement = s.jour
        ), 0)
        -- Sorties en espèces du jour
        - COALESCE((
            SELECT SUM(e.montant) FROM expenses e
             WHERE e.shop_id = s.shop_id AND e.moyen_paiement = 'cash'
               AND NOT e.est_annule AND e.date_depense = s.jour
        ), 0)
        - COALESCE((
            SELECT SUM(sal.montant_net) FROM salary_payments sal
             WHERE sal.shop_id = s.shop_id AND sal.moyen_paiement = 'cash'
               AND NOT sal.est_annule AND sal.date_paiement = s.jour
        ), 0)
        - COALESCE((
            SELECT SUM(f.montant) FROM supplier_payments f
             WHERE f.shop_id = s.shop_id AND f.moyen_paiement = 'cash'
               AND f.date_paiement = s.jour
        ), 0)
      FROM s;
$$;

COMMENT ON FUNCTION especes_attendues_session(UUID) IS
    'Espèces que le tiroir devrait contenir : fond initial + encaissements espèces − sorties espèces. Ne couvre que les ESPÈCES : les autres moyens ne passent pas par le tiroir.';

-- ── 5. Fermer la caisse ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fermer_session_caisse(
    p_shop_id    UUID,
    p_session_id UUID,
    p_compte     NUMERIC,
    p_note       TEXT,
    p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_session RECORD;
    v_attendu NUMERIC;
    v_ecart   NUMERIC;
BEGIN
    IF p_compte IS NULL OR p_compte < 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant compté invalide.');
    END IF;

    SELECT * INTO v_session FROM cash_sessions
     WHERE id = p_session_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Session introuvable.');
    END IF;
    IF v_session.statut = 'fermee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette caisse est déjà fermée.');
    END IF;

    v_attendu := especes_attendues_session(p_session_id);
    v_ecart   := p_compte - v_attendu;

    -- L'écart n'est jamais corrigé en silence : il est constaté, et
    -- c'est lui qui a de la valeur.
    UPDATE cash_sessions SET
        statut          = 'fermee',
        compte_especes  = p_compte,
        attendu_especes = v_attendu,
        ecart           = v_ecart,
        note_fermeture  = NULLIF(p_note, ''),
        fermee_par      = p_user_id,
        fermee_le       = NOW()
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
        'succes', true,
        'attendu', v_attendu,
        'compte',  p_compte,
        'ecart',   v_ecart
    );
END;
$$;

-- ── 6. Contrôle ─────────────────────────────────────────────
DO $$
DECLARE
    v_boutiques INTEGER;
BEGIN
    SELECT count(*) INTO v_boutiques FROM shops;
    RAISE NOTICE 'Migration 030 : session de caisse disponible pour % boutique(s) ; stock négatif bloqué par défaut partout.', v_boutiques;
END $$;
