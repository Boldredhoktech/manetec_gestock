-- ═══════════════════════════════════════════════════════════════
-- 036 — L'offre Essai (D2 révisé, 2026-10-13)
--
-- Avant : une boutique neuve était un Starter « en essai », état deviné
-- (Starter sans paiement réussi). Désormais l'essai est un plan :
--   · `essai` = limites du Starter + fonctionnalités du Pro, 30 jours,
--     gratuit (les limites vivent dans lib/constants/plans.ts) ;
--   · il n'est jamais vendu : abonnement_paiements le refuse toujours ;
--   · payer pendant l'essai ne fait perdre aucun jour gratuit : la
--     période payée commence à la fin de l'essai, quel que soit le plan.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Le plan existe ─────────────────────────────────────────
ALTER TABLE shops DROP CONSTRAINT shops_plan_check;
ALTER TABLE shops ADD CONSTRAINT shops_plan_check
    CHECK (plan IN ('essai', 'starter', 'pro', 'enterprise'));
ALTER TABLE shops ALTER COLUMN plan SET DEFAULT 'essai';

-- ── 2. Payer pendant l'essai garde les jours gratuits ─────────
--   D4 : même plan → la nouvelle période part de la plus tardive des deux
--        dates (maintenant, échéance en cours) : aucun jour perdu.
--   Essai en cours → idem, quel que soit le plan acheté.
--   D8 : autre changement de plan → nouvelle période pleine qui part de
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

    IF (v_paiement.plan = v_shop.plan OR v_shop.plan = 'essai')
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

REVOKE ALL ON FUNCTION prolonger_abonnement(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 3. Les boutiques en « essai Starter » passent en Essai ────
-- Starter, aucun paiement réussi, pas encore expirées. L'échéance ne
-- bouge pas. Régularisation tracée (une ligne d'audit par boutique).
DO $$
DECLARE
    r record;
BEGIN
    PERFORM set_config('manetec.prolongation', 'oui', true);
    FOR r IN
        UPDATE shops s
        SET    plan = 'essai', updated_at = now()
        WHERE  s.plan = 'starter'
          AND  s.plan_expire_le > now()
          AND  NOT EXISTS (SELECT 1 FROM abonnement_paiements p
                           WHERE p.shop_id = s.id AND p.statut = 'reussi')
        RETURNING s.id, s.public_id, s.plan_expire_le
    LOOP
        INSERT INTO audit_logs (shop_id, type_acteur, event_type,
                                reference_type, reference_id, reference_public_id, details_json)
        VALUES (r.id, 'platform', 'SHOP_PLAN_CHANGED', 'shop', r.id, r.public_id,
                jsonb_build_object(
                    'plan_precedent', 'starter',
                    'nouveau_plan',   'essai',
                    'expiration',     r.plan_expire_le,
                    'note',           'Migration 036 : l''essai devient un plan à part entière.'));
    END LOOP;
    PERFORM set_config('manetec.prolongation', '', true);
END;
$$;
