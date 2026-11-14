-- ═══════════════════════════════════════════════════════════════
-- 044 — Caisses POS multi-entrepôts (chantier du 14/11/2026)
--
-- Décisions de l'utilisateur :
--   • un entrepôt peut avoir PLUSIEURS caisses POS ; une caissière est
--     affectée à UNE caisse, une caisse peut avoir plusieurs caissières ;
--   • la session de caisse (ouverture, comptage, écart) devient PAR
--     CAISSE, et non plus par entrepôt ;
--   • chaque boutique a une CAISSE PRINCIPALE (le coffre), sans
--     entrepôt, où l'argent des caisses POS est versé en fin de journée
--     — versement proposé à la clôture ;
--   • quota de caisses POS : Starter et Essai 1, Pro 3, Enterprise
--     illimité (la principale ne compte pas) ; au-delà, l'existant est
--     DÉSACTIVÉ (solde éventuel viré d'abord vers la principale) ;
--   • une vente peut sortir une ligne d'un AUTRE entrepôt que celui de
--     la caisse (permission côté application) : l'argent entre dans la
--     caisse de la vente, le stock sort de l'entrepôt de la ligne.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Caisse principale ───────────────────────────────────────
ALTER TABLE public.comptes_tresorerie
    ADD COLUMN est_principale BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.comptes_tresorerie
    ADD CONSTRAINT comptes_principale_caisse
    CHECK (NOT est_principale OR (type = 'caisse' AND warehouse_id IS NULL));
CREATE UNIQUE INDEX comptes_tresorerie_une_principale
    ON public.comptes_tresorerie (shop_id) WHERE est_principale;

-- Plusieurs caisses par entrepôt désormais.
DROP INDEX IF EXISTS public.comptes_tresorerie_une_caisse_par_entrepot;

COMMENT ON COLUMN public.comptes_tresorerie.est_principale IS
    'Caisse principale de la boutique (le coffre) : sans entrepôt, jamais utilisée au POS ; reçoit les versements de fin de journée des caisses POS.';

CREATE OR REPLACE FUNCTION public.creer_caisse_principale(p_shop_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_id  UUID;
    v_nom TEXT := 'Caisse principale';
BEGIN
    SELECT id INTO v_id FROM comptes_tresorerie WHERE shop_id = p_shop_id AND est_principale;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    IF EXISTS (SELECT 1 FROM comptes_tresorerie WHERE shop_id = p_shop_id AND nom = v_nom) THEN
        v_nom := 'Caisse principale (coffre)';
    END IF;
    INSERT INTO comptes_tresorerie (public_id, shop_id, type, nom, est_principale, note)
    VALUES (prochain_numero(p_shop_id, 'CPT'), p_shop_id, 'caisse', v_nom, TRUE,
            'Le coffre de la boutique : les caisses POS y versent leur argent en fin de journée.')
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_creer_caisse_principale()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    PERFORM creer_caisse_principale(NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER shops_creer_caisse_principale
    AFTER INSERT ON public.shops
    FOR EACH ROW EXECUTE FUNCTION public.trg_creer_caisse_principale();

-- Boutiques existantes.
DO $$
DECLARE v_s RECORD;
BEGIN
    FOR v_s IN SELECT id FROM public.shops ORDER BY created_at LOOP
        PERFORM public.creer_caisse_principale(v_s.id);
    END LOOP;
END $$;

-- ── 2. Quota de caisses POS selon le forfait ───────────────────
-- NULL = illimité. Même grille que lib/constants/plans.ts (max_caisses_pos).
CREATE OR REPLACE FUNCTION public.quota_caisses_pos(p_shop_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT CASE s.plan WHEN 'pro' THEN 3 WHEN 'enterprise' THEN NULL ELSE 1 END
      FROM shops s WHERE s.id = p_shop_id
$$;

CREATE OR REPLACE FUNCTION public.nb_caisses_pos(p_shop_id UUID, p_sauf UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT count(*)::INTEGER FROM comptes_tresorerie
     WHERE shop_id = p_shop_id AND type = 'caisse' AND warehouse_id IS NOT NULL
       AND est_actif AND id IS DISTINCT FROM p_sauf
$$;

-- ── 3. Excédent existant : désactivé (après versement du solde) ─
-- On garde, dans l'ordre : la caisse de l'entrepôt par défaut, puis les
-- plus anciennes.
DO $$
DECLARE
    v_s      RECORD;
    v_c      RECORD;
    v_quota  INTEGER;
    v_rang   INTEGER;
    v_solde  NUMERIC;
    v_res    JSONB;
BEGIN
    FOR v_s IN SELECT id FROM public.shops LOOP
        v_quota := public.quota_caisses_pos(v_s.id);
        CONTINUE WHEN v_quota IS NULL OR public.nb_caisses_pos(v_s.id) <= v_quota;
        v_rang := 0;
        FOR v_c IN
            SELECT c.* FROM public.comptes_tresorerie c
              LEFT JOIN public.warehouses w ON w.id = c.warehouse_id
             WHERE c.shop_id = v_s.id AND c.type = 'caisse' AND c.warehouse_id IS NOT NULL AND c.est_actif
             ORDER BY COALESCE(w.est_defaut, FALSE) DESC, c.created_at, c.public_id
        LOOP
            v_rang := v_rang + 1;
            CONTINUE WHEN v_rang <= v_quota;
            v_solde := public.solde_compte(v_c.id);
            IF v_solde > 0 THEN
                v_res := public.effectuer_virement(
                    v_s.id, v_c.id, public.creer_caisse_principale(v_s.id), v_solde, 0, CURRENT_DATE,
                    NULL, 'Caisse au-delà du forfait, désactivée par la migration 044 : solde versé à la caisse principale.', NULL);
                IF NOT (v_res->>'succes')::BOOLEAN THEN
                    RAISE EXCEPTION 'Versement impossible pour % : %', v_c.nom, v_res->>'erreur';
                END IF;
            END IF;
            UPDATE public.comptes_tresorerie
               SET est_actif = FALSE,
                   note = concat_ws(E'\n', note, 'Désactivée le ' || to_char(now(), 'DD/MM/YYYY')
                          || ' par la migration 044 : au-delà du nombre de caisses POS du forfait.')
             WHERE id = v_c.id;
        END LOOP;
    END LOOP;
END $$;

-- ── 4. Le quota est gardé par la base ──────────────────────────
-- À la création d'une caisse POS et à sa réactivation.
CREATE OR REPLACE FUNCTION public.garde_quota_caisses_pos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_quota INTEGER;
BEGIN
    IF NEW.type <> 'caisse' OR NEW.warehouse_id IS NULL OR NOT NEW.est_actif THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.est_actif AND OLD.type = 'caisse' AND OLD.warehouse_id IS NOT NULL THEN
        RETURN NEW;   -- déjà comptée
    END IF;
    v_quota := quota_caisses_pos(NEW.shop_id);
    IF v_quota IS NOT NULL AND nb_caisses_pos(NEW.shop_id, NEW.id) >= v_quota THEN
        RAISE EXCEPTION 'Votre forfait permet % caisse(s) POS. Passez à un forfait supérieur pour en ajouter.', v_quota
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER comptes_tresorerie_quota_caisses
    BEFORE INSERT OR UPDATE OF est_actif, warehouse_id, type ON public.comptes_tresorerie
    FOR EACH ROW EXECUTE FUNCTION public.garde_quota_caisses_pos();

-- Un nouvel entrepôt reçoit sa caisse POS seulement si le forfait le
-- permet encore (sinon il se vend depuis une autre caisse, avec la
-- permission « Vendre depuis d'autres entrepôts »).
CREATE OR REPLACE FUNCTION public.creer_caisse_entrepot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_nom   TEXT := 'Caisse — ' || NEW.nom;
    v_quota INTEGER := quota_caisses_pos(NEW.shop_id);
BEGIN
    IF EXISTS (SELECT 1 FROM comptes_tresorerie WHERE warehouse_id = NEW.id AND type = 'caisse') THEN
        RETURN NEW;
    END IF;
    IF v_quota IS NOT NULL AND nb_caisses_pos(NEW.shop_id) >= v_quota THEN
        RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM comptes_tresorerie WHERE shop_id = NEW.shop_id AND nom = v_nom) THEN
        v_nom := v_nom || ' (' || NEW.public_id || ')';
    END IF;
    INSERT INTO comptes_tresorerie (public_id, shop_id, type, nom, warehouse_id, date_ouverture, note)
    VALUES (prochain_numero(NEW.shop_id, 'CPT'), NEW.shop_id, 'caisse', v_nom, NEW.id,
            COALESCE(NEW.created_at::date, CURRENT_DATE), 'Créée avec l''entrepôt.');
    RETURN NEW;
END;
$$;

-- Créer une caisse POS supplémentaire (écran Trésorerie).
CREATE OR REPLACE FUNCTION public.creer_caisse_pos(
    p_shop_id UUID, p_warehouse_id UUID, p_nom TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_id  UUID;
    v_pid TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND shop_id = p_shop_id AND est_actif) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Entrepôt introuvable ou désactivé.');
    END IF;
    IF length(trim(COALESCE(p_nom, ''))) < 2 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Donnez un nom à la caisse (ex. Caisse 2 — Magasin).');
    END IF;
    IF EXISTS (SELECT 1 FROM comptes_tresorerie WHERE shop_id = p_shop_id AND nom = trim(p_nom)) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Un compte porte déjà ce nom.');
    END IF;
    v_pid := prochain_numero(p_shop_id, 'CPT');
    INSERT INTO comptes_tresorerie (public_id, shop_id, type, nom, warehouse_id, created_by)
    VALUES (v_pid, p_shop_id, 'caisse', trim(p_nom), p_warehouse_id, p_user_id)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('succes', true, 'id', v_id, 'public_id', v_pid);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

-- ── 5. Caissières ↔ caisse ─────────────────────────────────────
-- Une personne : une seule caisse. Une caisse : plusieurs personnes.
CREATE TABLE public.caisse_utilisateurs (
    user_id     UUID PRIMARY KEY REFERENCES public.shop_users(id) ON DELETE CASCADE,
    shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    compte_id   UUID NOT NULL REFERENCES public.comptes_tresorerie(id) ON DELETE CASCADE,
    affecte_par UUID,
    affecte_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX caisse_utilisateurs_compte_idx ON public.caisse_utilisateurs (compte_id);

COMMENT ON TABLE public.caisse_utilisateurs IS
    'Affectation d''une caissière à sa caisse POS (une caisse par personne, plusieurs personnes par caisse).';

ALTER TABLE public.caisse_utilisateurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY caisse_utilisateurs_isolation ON public.caisse_utilisateurs
    USING (shop_id = (SELECT ((auth.jwt() -> 'user_metadata') ->> 'shop_id')::uuid));
CREATE POLICY licence_en_service ON public.caisse_utilisateurs AS RESTRICTIVE
    USING ((SELECT public.session_boutique_en_service()))
    WITH CHECK ((SELECT public.session_boutique_en_service()));

CREATE OR REPLACE FUNCTION public.garde_caisse_utilisateur()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM comptes_tresorerie
         WHERE id = NEW.compte_id AND shop_id = NEW.shop_id
           AND type = 'caisse' AND warehouse_id IS NOT NULL AND est_actif
    ) THEN
        RAISE EXCEPTION 'Seule une caisse POS active peut être affectée.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM shop_users WHERE id = NEW.user_id AND shop_id = NEW.shop_id) THEN
        RAISE EXCEPTION 'Utilisateur introuvable dans cette boutique.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER caisse_utilisateurs_garde
    BEFORE INSERT OR UPDATE ON public.caisse_utilisateurs
    FOR EACH ROW EXECUTE FUNCTION public.garde_caisse_utilisateur();

-- Une caisse désactivée libère ses caissières.
CREATE OR REPLACE FUNCTION public.liberer_caissieres()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD.est_actif AND NOT NEW.est_actif THEN
        DELETE FROM caisse_utilisateurs WHERE compte_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER comptes_tresorerie_liberer_caissieres
    AFTER UPDATE OF est_actif ON public.comptes_tresorerie
    FOR EACH ROW EXECUTE FUNCTION public.liberer_caissieres();

-- Existant : les vendeurs (et quiconque a reçu le droit de vendre)
-- sont affectés à la caisse de l'entrepôt par défaut, sinon à la
-- première caisse POS active. Les administrateurs choisissent la leur.
INSERT INTO public.caisse_utilisateurs (user_id, shop_id, compte_id)
SELECT u.id, u.shop_id, c.id
  FROM public.shop_users u
  JOIN LATERAL (
      SELECT c.id FROM public.comptes_tresorerie c
        LEFT JOIN public.warehouses w ON w.id = c.warehouse_id
       WHERE c.shop_id = u.shop_id AND c.type = 'caisse' AND c.warehouse_id IS NOT NULL AND c.est_actif
       ORDER BY COALESCE(w.est_defaut, FALSE) DESC, c.created_at
       LIMIT 1
  ) c ON TRUE
 WHERE u.est_actif
   AND u.role NOT IN ('super_admin_boutique', 'admin_boutique')
   AND (u.role = 'vendeur'
        OR EXISTS (SELECT 1 FROM public.shop_user_permissions p
                    WHERE p.user_id = u.id AND p.permission = 'sales.create'));

-- ── 6. Sessions par caisse ─────────────────────────────────────
ALTER TABLE public.cash_sessions
    ADD COLUMN compte_id UUID REFERENCES public.comptes_tresorerie(id);

UPDATE public.cash_sessions cs
   SET compte_id = c.id
  FROM public.comptes_tresorerie c
 WHERE c.warehouse_id = cs.warehouse_id AND c.type = 'caisse';

ALTER TABLE public.cash_sessions ALTER COLUMN compte_id SET NOT NULL;

DROP INDEX IF EXISTS public.idx_cash_sessions_une_ouverte;
DROP INDEX IF EXISTS public.idx_cash_sessions_une_par_jour;
CREATE UNIQUE INDEX idx_cash_sessions_une_ouverte ON public.cash_sessions (compte_id) WHERE statut = 'ouverte';
CREATE UNIQUE INDEX idx_cash_sessions_une_par_jour ON public.cash_sessions (compte_id, jour);

COMMENT ON TABLE public.cash_sessions IS
    'Session d''une CAISSE POS par journée (mig 044 ; avant : par entrepôt) : fond initial à l''ouverture, comptage à la fermeture, écart constaté. warehouse_id = entrepôt de la caisse.';

DROP FUNCTION IF EXISTS public.ouvrir_session_caisse(UUID, UUID, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.ouvrir_session_caisse(
    p_shop_id UUID, p_compte_id UUID, p_fond NUMERIC, p_note TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_pid     TEXT;
    v_id      UUID;
    v_jour    DATE := (now() + interval '1 hour')::date;   -- journée de la boutique
    v_caisse  comptes_tresorerie%ROWTYPE;
    v_ouverte RECORD;
BEGIN
    IF p_fond IS NULL OR p_fond < 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Fond de caisse invalide.');
    END IF;

    SELECT * INTO v_caisse FROM comptes_tresorerie
     WHERE id = p_compte_id AND shop_id = p_shop_id AND type = 'caisse' AND warehouse_id IS NOT NULL;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Caisse POS introuvable dans cette boutique.');
    END IF;
    IF NOT v_caisse.est_actif THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'La caisse « ' || v_caisse.nom || ' » est désactivée.');
    END IF;

    SELECT * INTO v_ouverte FROM cash_sessions WHERE compte_id = p_compte_id AND statut = 'ouverte';
    IF FOUND THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Cette caisse est déjà ouverte depuis le ' || to_char(v_ouverte.jour, 'DD/MM/YYYY') || '.',
            'session_id', v_ouverte.id);
    END IF;

    IF EXISTS (SELECT 1 FROM cash_sessions WHERE compte_id = p_compte_id AND jour = v_jour) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'La caisse d''aujourd''hui a déjà été comptée : rouvrez-la plutôt que d''en ouvrir une autre.');
    END IF;

    SELECT generate_public_id(p_shop_id, 'CAISSE') INTO v_pid;
    INSERT INTO cash_sessions (
        public_id, shop_id, warehouse_id, compte_id, jour, statut,
        fond_initial, note_ouverture, ouverte_par
    ) VALUES (
        v_pid, p_shop_id, v_caisse.warehouse_id, p_compte_id, v_jour, 'ouverte',
        p_fond, NULLIF(p_note, ''), p_user_id
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object('succes', true, 'session_id', v_id, 'public_id', v_pid);
END;
$$;

-- Espèces attendues : le grand livre de LA caisse de la session.
CREATE OR REPLACE FUNCTION public.especes_attendues_session(p_session_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT s.fond_initial
         + COALESCE(SUM(CASE m.sens WHEN 'entree' THEN m.montant ELSE -m.montant END), 0)
      FROM cash_sessions s
      LEFT JOIN mouvements_tresorerie m
             ON m.compte_id = s.compte_id AND m.jour = s.jour AND NOT m.est_annule
     WHERE s.id = p_session_id
     GROUP BY s.id, s.fond_initial
$$;

-- Fermeture + versement vers la caisse principale, d'un seul tenant :
-- si le versement échoue, la caisse reste ouverte.
DROP FUNCTION IF EXISTS public.fermer_session_caisse(UUID, UUID, NUMERIC, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.fermer_session_caisse(
    p_shop_id UUID, p_session_id UUID, p_compte NUMERIC, p_note TEXT, p_user_id UUID,
    p_versement NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_session   RECORD;
    v_attendu   NUMERIC;
    v_ecart     NUMERIC;
    v_vers      NUMERIC := COALESCE(p_versement, 0);
    v_principal UUID;
    v_res       JSONB;
    v_vir       TEXT;
BEGIN
    IF p_compte IS NULL OR p_compte < 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant compté invalide.');
    END IF;
    IF v_vers < 0 OR v_vers > p_compte THEN
        RETURN jsonb_build_object('succes', false, 'erreur',
            'Le versement ne peut pas dépasser ce qui a été compté dans le tiroir.');
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

    -- On ne verse que l'argent que la caisse a ENREGISTRÉ : un écart de
    -- comptage se constate, il ne se verse pas (le fond déclaré à
    -- l'ouverture n'est pas une entrée du grand livre).
    IF v_vers > 0 AND v_vers > solde_compte(v_session.compte_id) THEN
        RETURN jsonb_build_object('succes', false, 'erreur',
            'Le versement (' || montant_fr(v_vers) || ') dépasse ce que la caisse a enregistré ('
            || montant_fr(solde_compte(v_session.compte_id)) || '). Un écart de comptage se constate, il ne se verse pas.');
    END IF;

    -- L'écart n'est jamais corrigé en silence : il est constaté.
    UPDATE cash_sessions SET
        statut          = 'fermee',
        compte_especes  = p_compte,
        attendu_especes = v_attendu,
        ecart           = v_ecart,
        note_fermeture  = NULLIF(concat_ws(E'\n', note_fermeture, NULLIF(p_note, '')), ''),
        fermee_par      = p_user_id,
        fermee_le       = NOW()
    WHERE id = p_session_id;

    IF v_vers > 0 THEN
        v_principal := creer_caisse_principale(p_shop_id);
        v_res := effectuer_virement(
            p_shop_id, v_session.compte_id, v_principal, v_vers, 0,
            LEAST(v_session.jour, CURRENT_DATE), NULL,
            'Versement de fin de journée (session ' || v_session.public_id || ')', p_user_id);
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;
        v_vir := v_res->>'public_id';
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'attendu', v_attendu,
        'compte',  p_compte,
        'ecart',   v_ecart,
        'versement', v_vers,
        'virement', v_vir);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

-- ── 7. Ventes : la caisse, et l'entrepôt de chaque ligne ───────
ALTER TABLE public.sales ADD COLUMN caisse_id UUID REFERENCES public.comptes_tresorerie(id);
UPDATE public.sales s
   SET caisse_id = c.id
  FROM public.comptes_tresorerie c
 WHERE c.warehouse_id = s.warehouse_id AND c.type = 'caisse';
CREATE INDEX sales_caisse_idx ON public.sales (caisse_id);

COMMENT ON COLUMN public.sales.caisse_id IS
    'Caisse POS de la vente (mig 044). warehouse_id = entrepôt de cette caisse ; chaque ligne (sale_items.warehouse_id) peut sortir d''un autre entrepôt.';

CREATE OR REPLACE FUNCTION public.enregistrer_vente(p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sale_id        UUID;
  v_sale_public_id TEXT;
  v_item           JSONB;
  v_stock_result   JSONB;
  v_shop_id        UUID;
  v_warehouse_id   UUID;
  v_ligne_wh       UUID;
  v_caisse_id      UUID;
  v_user_id        UUID;
  v_client_id      UUID;
  v_solde          JSONB;
  v_avertissements TEXT[] := ARRAY[]::TEXT[];

  v_total          NUMERIC;
  v_credit         NUMERIC;
  v_avance         NUMERIC;
  v_monnaie        NUMERIC;
  v_rembourse      NUMERIC;
  v_regle          NUMERIC;
  v_encaisse_vente NUMERIC;
  v_a_couvrir      NUMERIC;
  v_reste          NUMERIC;
BEGIN
  v_shop_id      := (p_data->>'shop_id')::UUID;
  v_warehouse_id := (p_data->>'warehouse_id')::UUID;
  v_caisse_id    := NULLIF(p_data->>'caisse_id', '')::UUID;
  v_user_id      := (p_data->>'vendeur_id')::UUID;
  v_client_id    := NULLIF(p_data->>'client_id', '')::UUID;

  -- La caisse fixe l'entrepôt de la vente.
  IF v_caisse_id IS NOT NULL THEN
    SELECT warehouse_id INTO v_warehouse_id FROM comptes_tresorerie
     WHERE id = v_caisse_id AND shop_id = v_shop_id AND type = 'caisse' AND warehouse_id IS NOT NULL;
    IF v_warehouse_id IS NULL THEN
      RETURN jsonb_build_object('succes', false, 'erreur', 'Caisse POS introuvable.');
    END IF;
  END IF;

  v_total     := COALESCE((p_data->>'montant_total')::NUMERIC, 0);
  v_credit    := COALESCE((p_data->>'credit_accorde')::NUMERIC, 0);
  v_avance    := COALESCE((p_data->>'advance_utilise')::NUMERIC, 0);
  v_monnaie   := COALESCE((p_data->>'change_utilise')::NUMERIC, 0);
  v_rembourse := COALESCE((p_data->>'credit_utilise')::NUMERIC, 0);

  SELECT COALESCE(SUM((e->>'montant')::NUMERIC), 0) INTO v_regle
    FROM jsonb_array_elements(COALESCE(p_data->'paiements', '[]'::JSONB)) e;

  IF v_credit < 0 OR v_avance < 0 OR v_monnaie < 0 OR v_rembourse < 0 THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Montant négatif dans le règlement.');
  END IF;

  IF v_credit > 0 AND v_client_id IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Un crédit ne peut être accordé qu''à un client identifié.');
  END IF;

  v_a_couvrir := v_total - v_avance - v_monnaie;
  v_reste     := v_a_couvrir - v_credit;

  IF v_reste < -0.01 THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Le crédit accordé (' || v_credit || ') dépasse ce qui reste à payer (' || GREATEST(v_a_couvrir, 0) || ').'
    );
  END IF;

  v_encaisse_vente := GREATEST(v_reste, 0);

  IF v_regle + 0.01 < v_encaisse_vente + v_rembourse THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Les règlements saisis (' || v_regle || ') ne couvrent pas ce qui est dû (' || (v_encaisse_vente + v_rembourse) || ').'
    );
  END IF;

  SELECT generate_public_id(v_shop_id, 'VENTE') INTO v_sale_public_id;

  INSERT INTO sales (
    public_id, shop_id, client_id, warehouse_id, caisse_id, vendeur_id,
    statut, montant_brut, remise_globale_pct, remise_globale_val,
    montant_net, montant_tva, montant_total,
    montant_recu, montant_rendu,
    credit_utilise, advance_utilise, change_utilise, credit_accorde,
    note
  ) VALUES (
    v_sale_public_id, v_shop_id, v_client_id, v_warehouse_id, v_caisse_id, v_user_id,
    'completee',
    (p_data->>'montant_brut')::NUMERIC,
    (p_data->>'remise_globale_pct')::NUMERIC,
    (p_data->>'remise_globale_val')::NUMERIC,
    (p_data->>'montant_net')::NUMERIC,
    (p_data->>'montant_tva')::NUMERIC,
    v_total,
    (p_data->>'montant_recu')::NUMERIC,
    (p_data->>'montant_rendu')::NUMERIC,
    v_rembourse, v_avance, v_monnaie, v_credit,
    p_data->>'note'
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items')
  LOOP
    -- Entrepôt de la ligne : par défaut celui de la caisse.
    v_ligne_wh := COALESCE(NULLIF(v_item->>'warehouse_id', '')::UUID, v_warehouse_id);
    IF v_ligne_wh <> v_warehouse_id AND NOT EXISTS (
        SELECT 1 FROM warehouses WHERE id = v_ligne_wh AND shop_id = v_shop_id AND est_actif
    ) THEN
      RAISE EXCEPTION 'Entrepôt introuvable pour une ligne de la vente.';
    END IF;

    SELECT deduire_stock(
      v_shop_id, (v_item->>'product_id')::UUID, v_ligne_wh,
      (v_item->>'quantite')::NUMERIC, 'sale', v_sale_id, v_sale_public_id, v_user_id
    ) INTO v_stock_result;

    IF NOT (v_stock_result->>'succes')::BOOLEAN THEN
      RAISE EXCEPTION '%', v_stock_result->>'erreur';
    END IF;

    INSERT INTO sale_items (
      shop_id, sale_id, product_id, warehouse_id,
      quantite, prix_unitaire, remise_pct, remise_val,
      montant_ligne, tva_pct, montant_tva, imei, note
    ) VALUES (
      v_shop_id, v_sale_id,
      (v_item->>'product_id')::UUID, v_ligne_wh,
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

  IF v_regle > 0 AND (v_encaisse_vente + v_rembourse) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'paiements')
    LOOP
      INSERT INTO sale_payments (
        shop_id, sale_id, compte_id, montant, reference
      ) VALUES (
        v_shop_id, v_sale_id,
        (v_item->>'compte_id')::UUID,
        ROUND(
          (v_item->>'montant')::NUMERIC / v_regle * (v_encaisse_vente + v_rembourse),
          2
        ),
        NULLIF(v_item->>'reference', '')
      );
    END LOOP;
  END IF;

  IF v_client_id IS NOT NULL THEN

    IF v_avance > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'advance_balance', -v_avance,
        'vente_avance', 'Avance utilisée sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF v_monnaie > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'change_balance', -v_monnaie,
        'vente_monnaie', 'Monnaie utilisée sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF v_rembourse > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'credit_balance', -v_rembourse,
        'credit_remboursement', 'Ardoise réglée au comptoir sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF v_credit > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'credit_balance', v_credit,
        'vente_credit', 'Crédit accordé sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
      IF v_solde->>'avertissement' IS NOT NULL THEN
        v_avertissements := v_avertissements || (v_solde->>'avertissement');
      END IF;
    END IF;

    IF COALESCE((p_data->>'montant_rendu')::NUMERIC, 0) > 0
       AND COALESCE((p_data->>'garder_monnaie')::BOOLEAN, FALSE) THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'change_balance',
        (p_data->>'montant_rendu')::NUMERIC,
        'vente_monnaie', 'Monnaie laissée en compte sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'sale_id', v_sale_id,
    'public_id', v_sale_public_id,
    'encaisse', v_encaisse_vente + v_rembourse,
    'credit_accorde', v_credit,
    'avertissements', to_jsonb(v_avertissements)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$function$;

-- ── 8. Rapport des journées de caisse : par caisse ─────────────
DROP FUNCTION IF EXISTS public.journees_caisse(UUID, DATE, DATE, INTERVAL);
CREATE OR REPLACE FUNCTION public.journees_caisse(
    p_shop_id UUID, p_debut DATE, p_fin DATE, p_decalage INTERVAL DEFAULT '01:00:00'::interval
) RETURNS TABLE(session_id uuid, public_id text, jour date, entrepot text, statut text, fond_initial numeric,
                attendu_especes numeric, compte_especes numeric, ecart numeric, ouverte_par text, fermee_par text,
                note_ouverture text, note_fermeture text, encaisse_especes numeric, encaisse_autres numeric,
                sorties_especes numeric, nb_ventes integer, caisse text)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $function$
    SELECT
        cs.id, cs.public_id, cs.jour, w.nom, cs.statut,
        cs.fond_initial, cs.attendu_especes, cs.compte_especes, cs.ecart,
        uo.nom_complet, uf.nom_complet, cs.note_ouverture, cs.note_fermeture,
        COALESCE(t.entrees, 0),
        COALESCE(v.autres, 0),
        COALESCE(t.sorties, 0),
        COALESCE(v.nb, 0)::INTEGER,
        caisse.nom
      FROM cash_sessions cs
      JOIN warehouses w  ON w.id  = cs.warehouse_id
      JOIN comptes_tresorerie caisse ON caisse.id = cs.compte_id
      LEFT JOIN shop_users uo ON uo.id = cs.ouverte_par
      LEFT JOIN shop_users uf ON uf.id = cs.fermee_par
      LEFT JOIN LATERAL (
          SELECT SUM(m.montant) FILTER (WHERE m.sens = 'entree') AS entrees,
                 SUM(m.montant) FILTER (WHERE m.sens = 'sortie') AS sorties
            FROM mouvements_tresorerie m
           WHERE m.compte_id = caisse.id AND m.jour = cs.jour AND NOT m.est_annule
      ) t ON true
      -- Ventes de CETTE caisse ce jour-là réglées sur un AUTRE compte.
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(sp.montant) FILTER (WHERE sp.compte_id IS DISTINCT FROM caisse.id), 0) AS autres,
                 count(DISTINCT sa.id) AS nb
            FROM sales sa
            LEFT JOIN sale_payments sp ON sp.sale_id = sa.id
           WHERE sa.shop_id = p_shop_id AND sa.caisse_id = cs.compte_id
             AND sa.statut = 'completee'
             AND (sa.created_at + p_decalage)::date = cs.jour
      ) v ON true
     WHERE cs.shop_id = p_shop_id
       AND cs.jour BETWEEN p_debut AND p_fin
     ORDER BY cs.jour DESC, w.nom, caisse.nom
$function$;
