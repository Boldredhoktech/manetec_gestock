-- 034_compte_abonnement.sql
-- ═══════════════════════════════════════════════════════════════
-- Abonnement, Lot 2 — « l'abonnement est une date, pas un compte ».
--
-- 1. abonnement_paiements : chaque paiement d'abonnement (en ligne ou
--    enregistré par la plateforme) laisse une ligne : plan, durée,
--    montant, moyen, statut, référence de transaction, période couverte,
--    auteur (ABO-03).
-- 2. prolonger_abonnement() : SEUL chemin qui modifie shops.plan et
--    shops.plan_expire_le (ABO-04, D4, D8). Un déclencheur refuse toute
--    autre écriture de ces deux colonnes.
-- 3. enregistrer_paiement_manuel() : l'activation par la plateforme
--    passe par le même chemin (D7), dans une seule transaction.
-- 4. Licence dans la RLS : une session d'une boutique expirée ou
--    désactivée ne peut plus rien lire ni écrire en direct par l'API
--    Supabase (le contrôle applicatif du Lot 1 ne couvrait que le site).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Paiements d'abonnement ─────────────────────────────────
INSERT INTO platform_id_counters (prefix, last_value)
VALUES ('ABO', 0)
ON CONFLICT (prefix) DO NOTHING;

CREATE TABLE abonnement_paiements (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id               text        NOT NULL UNIQUE,
    shop_id                 uuid        NOT NULL REFERENCES shops(id),
    plan                    text        NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
    duree                   text        NOT NULL CHECK (duree IN ('mensuel', 'annuel')),
    nb_mois                 integer     NOT NULL CHECK (nb_mois > 0),
    montant                 numeric(12,0) NOT NULL CHECK (montant >= 0),
    devise                  text        NOT NULL DEFAULT 'FCFA',
    moyen                   text        NOT NULL CHECK (moyen IN ('kkiapay', 'manuel')),
    statut                  text        NOT NULL DEFAULT 'en_attente'
                                        CHECK (statut IN ('en_attente', 'reussi', 'echoue', 'abandonne', 'rembourse')),
    -- Identifiant de transaction du prestataire (KkiaPay : transactionId).
    reference_transaction   text,
    -- Renseignés à la confirmation : ce que le paiement a réellement acheté.
    periode_debut           timestamptz,
    periode_fin             timestamptz,
    plan_precedent          text,
    expiration_precedente   timestamptz,
    -- Auteur : l'administrateur de la boutique (en ligne) OU un agent plateforme (manuel).
    cree_par_utilisateur    uuid        REFERENCES shop_users(id),
    cree_par_plateforme     uuid        REFERENCES platform_admins(id),
    note                    text,
    -- Réponse brute du prestataire, gardée pour les litiges.
    details_prestataire     jsonb,
    motif_echec             text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    confirme_le             timestamptz,

    CONSTRAINT abo_auteur_unique CHECK (
        (cree_par_utilisateur IS NULL) <> (cree_par_plateforme IS NULL)
    ),
    CONSTRAINT abo_manuel_par_plateforme CHECK (
        moyen <> 'manuel' OR cree_par_plateforme IS NOT NULL
    ),
    -- D7 : l'Enterprise ne se paie pas en ligne.
    CONSTRAINT abo_enterprise_manuel CHECK (
        plan <> 'enterprise' OR moyen = 'manuel'
    ),
    CONSTRAINT abo_periode_si_reussi CHECK (
        statut <> 'reussi' OR (periode_debut IS NOT NULL AND periode_fin IS NOT NULL AND confirme_le IS NOT NULL)
    ),
    CONSTRAINT abo_nb_mois_selon_duree CHECK (
        (duree = 'mensuel' AND nb_mois = 1) OR (duree = 'annuel' AND nb_mois = 12)
    )
);

-- Une transaction du prestataire ne crédite qu'un seul paiement :
-- c'est ce qui rend le traitement idempotent (webhook + retour navigateur).
CREATE UNIQUE INDEX abonnement_paiements_reference_unique
    ON abonnement_paiements (moyen, reference_transaction)
    WHERE reference_transaction IS NOT NULL;

CREATE INDEX abonnement_paiements_shop_idx
    ON abonnement_paiements (shop_id, created_at DESC);

COMMENT ON TABLE abonnement_paiements IS
    'Paiements d''abonnement d''une boutique. Seule prolonger_abonnement() fait passer une ligne à « reussi » et modifie shops.plan / plan_expire_le.';

ALTER TABLE abonnement_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY abonnement_paiements_isolation ON abonnement_paiements
    FOR SELECT
    USING (shop_id = (SELECT ((auth.jwt() -> 'user_metadata') ->> 'shop_id')::uuid));
-- Aucune politique d'écriture : seul le serveur (clé service) écrit.

-- ── 2. Le seul chemin qui touche plan / plan_expire_le ─────────
CREATE OR REPLACE FUNCTION garde_plan_boutique()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.plan_expire_le IS DISTINCT FROM OLD.plan_expire_le)
       AND coalesce(current_setting('manetec.prolongation', true), '') <> 'oui' THEN
        RAISE EXCEPTION 'Le plan et l''échéance d''une boutique ne changent que par prolonger_abonnement().'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER shops_garde_plan
    BEFORE UPDATE OF plan, plan_expire_le ON shops
    FOR EACH ROW EXECUTE FUNCTION garde_plan_boutique();

-- Confirme un paiement « en_attente » et prolonge la boutique.
-- Idempotent : rappelée sur un paiement déjà réussi, elle le renvoie tel quel.
--   D4 : même plan → la nouvelle période part de la plus tardive des deux
--        dates (maintenant, échéance en cours) : aucun jour perdu.
--   D8 : changement de plan → nouvelle période pleine qui part de
--        maintenant, sans conversion du reste.
CREATE OR REPLACE FUNCTION prolonger_abonnement(
    p_paiement_id           uuid,
    p_reference_transaction text  DEFAULT NULL,
    p_details_prestataire   jsonb DEFAULT NULL
)
RETURNS abonnement_paiements
LANGUAGE plpgsql
AS $$
DECLARE
    v_paiement abonnement_paiements;
    v_shop     shops;
    v_debut    timestamptz;
    v_fin      timestamptz;
BEGIN
    SELECT * INTO v_paiement FROM abonnement_paiements WHERE id = p_paiement_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Paiement d''abonnement introuvable.' USING ERRCODE = 'P0002';
    END IF;

    IF v_paiement.statut = 'reussi' THEN
        RETURN v_paiement;
    END IF;
    IF v_paiement.statut <> 'en_attente' THEN
        RAISE EXCEPTION 'Ce paiement est « % » : il ne peut plus être confirmé.', v_paiement.statut
            USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_shop FROM shops WHERE id = v_paiement.shop_id FOR UPDATE;

    IF v_paiement.plan = v_shop.plan
       AND v_shop.plan_expire_le IS NOT NULL
       AND v_shop.plan_expire_le > now() THEN
        v_debut := v_shop.plan_expire_le;
    ELSE
        v_debut := now();
    END IF;
    v_fin := v_debut + make_interval(months => v_paiement.nb_mois);

    PERFORM set_config('manetec.prolongation', 'oui', true);
    UPDATE shops
    SET    plan                = v_paiement.plan,
           plan_expire_le      = v_fin,
           activation_manuelle = (v_paiement.moyen = 'manuel'),
           active_par          = v_paiement.cree_par_plateforme,
           updated_at          = now()
    WHERE  id = v_shop.id;
    PERFORM set_config('manetec.prolongation', '', true);

    UPDATE abonnement_paiements
    SET    statut                = 'reussi',
           reference_transaction = coalesce(p_reference_transaction, reference_transaction),
           details_prestataire   = coalesce(p_details_prestataire, details_prestataire),
           periode_debut         = v_debut,
           periode_fin           = v_fin,
           plan_precedent        = v_shop.plan,
           expiration_precedente = v_shop.plan_expire_le,
           confirme_le           = now()
    WHERE  id = p_paiement_id
    RETURNING * INTO v_paiement;

    INSERT INTO audit_logs (shop_id, user_id, type_acteur, event_type,
                            reference_type, reference_id, reference_public_id, details_json)
    VALUES (v_shop.id,
            coalesce(v_paiement.cree_par_plateforme, v_paiement.cree_par_utilisateur),
            CASE WHEN v_paiement.cree_par_plateforme IS NOT NULL THEN 'platform' ELSE 'shop' END,
            'SHOP_PLAN_CHANGED', 'abonnement_paiement', v_paiement.id, v_paiement.public_id,
            jsonb_build_object(
                'plan_precedent',        v_shop.plan,
                'nouveau_plan',          v_paiement.plan,
                'expiration_precedente', v_shop.plan_expire_le,
                'expiration',            v_fin,
                'montant',               v_paiement.montant,
                'moyen',                 v_paiement.moyen,
                'reference',             v_paiement.reference_transaction));

    RETURN v_paiement;
END;
$$;

-- Activation par la plateforme (D7) : paiement « manuel » créé ET
-- confirmé dans la même transaction, par le même chemin.
CREATE OR REPLACE FUNCTION enregistrer_paiement_manuel(
    p_shop_id     uuid,
    p_plan        text,
    p_duree       text,
    p_montant     numeric,
    p_admin_id    uuid,
    p_note        text DEFAULT NULL,
    p_reference   text DEFAULT NULL
)
RETURNS abonnement_paiements
LANGUAGE plpgsql
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop_id) THEN
        RAISE EXCEPTION 'Boutique introuvable.' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO abonnement_paiements (public_id, shop_id, plan, duree, nb_mois, montant,
                                      moyen, cree_par_plateforme, note, reference_transaction)
    VALUES (generate_platform_id('ABO'), p_shop_id, p_plan, p_duree,
            CASE p_duree WHEN 'annuel' THEN 12 ELSE 1 END,
            p_montant, 'manuel', p_admin_id, nullif(trim(p_note), ''), nullif(trim(p_reference), ''))
    RETURNING id INTO v_id;

    RETURN prolonger_abonnement(v_id);
END;
$$;

-- Le serveur seul appelle ces fonctions (clé service).
REVOKE ALL ON FUNCTION prolonger_abonnement(uuid, text, jsonb)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enregistrer_paiement_manuel(uuid, text, text, numeric, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ── 3. La licence dans la RLS ─────────────────────────────────
-- Vrai pour toute session qui n'est pas celle d'une boutique (les
-- autres politiques s'appliquent), et pour une boutique active et non
-- expirée. SECURITY DEFINER : elle doit lire shops quelle que soit la RLS.
CREATE OR REPLACE FUNCTION session_boutique_en_service()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN (auth.jwt() -> 'user_metadata' ->> 'type_acteur') IS DISTINCT FROM 'shop' THEN true
        ELSE EXISTS (
            SELECT 1 FROM shops s
            WHERE s.id = ((auth.jwt() -> 'user_metadata') ->> 'shop_id')::uuid
              AND s.est_active
              AND (s.plan_expire_le IS NULL OR s.plan_expire_le > now())
        )
    END
$$;

-- Politique RESTRICTIVE (combinée en ET avec les politiques existantes)
-- sur chaque table cloisonnée par boutique. Sur shops, la lecture reste
-- permise : le middleware y lit l'état de la licence pour rediriger
-- l'administrateur vers la page Abonnement (D3).
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN
        SELECT c.relname
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        WHERE  c.relkind = 'r'
          AND  c.relrowsecurity
          AND  EXISTS (SELECT 1 FROM pg_attribute a
                       WHERE a.attrelid = c.oid AND a.attname = 'shop_id' AND NOT a.attisdropped)
    LOOP
        EXECUTE format(
            'CREATE POLICY licence_en_service ON %I AS RESTRICTIVE FOR ALL
                 USING ((SELECT session_boutique_en_service()))
                 WITH CHECK ((SELECT session_boutique_en_service()))', t.relname);
    END LOOP;

    EXECUTE 'CREATE POLICY licence_en_service_ecriture_shops ON shops AS RESTRICTIVE FOR UPDATE
                 USING ((SELECT session_boutique_en_service()))
                 WITH CHECK ((SELECT session_boutique_en_service()))';
    EXECUTE 'CREATE POLICY licence_en_service_suppression_shops ON shops AS RESTRICTIVE FOR DELETE
                 USING ((SELECT session_boutique_en_service()))';
END;
$$;
