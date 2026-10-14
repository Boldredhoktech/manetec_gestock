-- ═══════════════════════════════════════════════════════════════
-- 038 — La caisse du jour, obligatoire pour vendre
--
-- Constaté le 2026-10-14 (FAVEUR INFORMATIQUE) : 1 900 000 F encaissés
-- au comptoir, rapport de caisse vide. Le rapport liste les sessions de
-- caisse, et rien n'obligeait à en ouvrir une : le POS vendait sans.
-- Désormais le POS exige la caisse du jour ouverte (contrôle dans
-- enregistrerVente) ; cette migration fournit ce qu'il lui faut :
--
--   1. ouvrir_session_caisse date la session sur la journée vécue dans
--      la boutique (UTC+1), comme le rapport classe les ventes
--      ((created_at + décalage)::date). En UTC, une caisse ouverte entre
--      minuit et 1 h prenait la date de la veille.
--   2. Une seule session par entrepôt et par jour : une deuxième
--      compterait deux fois les ventes de la journée dans le rapport.
--   3. rouvrir_session_caisse : une vente après le comptage du soir
--      rouvre la session du jour. Le comptage effacé reste écrit dans
--      la note de fermeture (l'écart est constaté, jamais effacé sans
--      trace), et il faudra recompter avant de partir.
--   4. especes_attendues_session compte les ventes de la journée, et
--      non plus celles postérieures à l'ouverture.
--   5. fermer_session_caisse ajoute sa note au lieu d'écraser la trace.
-- ═══════════════════════════════════════════════════════════════

-- Les sessions existantes ne doivent pas déjà violer la règle 2.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM cash_sessions
         GROUP BY shop_id, warehouse_id, jour HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Des sessions de caisse en double existent pour un même jour : à régler avant la migration 038.';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_une_par_jour
    ON cash_sessions (shop_id, warehouse_id, jour);

CREATE OR REPLACE FUNCTION public.ouvrir_session_caisse(p_shop_id uuid, p_warehouse_id uuid, p_fond numeric, p_note text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pid     TEXT;
    v_id      UUID;
    v_jour    DATE := (now() + interval '1 hour')::date;   -- journée de la boutique
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
            'erreur', 'Une caisse est déjà ouverte pour cet entrepôt depuis le ' || to_char(v_ouverte.jour, 'DD/MM/YYYY') || '.',
            'session_id', v_ouverte.id
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM cash_sessions
         WHERE shop_id = p_shop_id AND warehouse_id = p_warehouse_id AND jour = v_jour
    ) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'La caisse d''aujourd''hui a déjà été comptée : rouvrez-la plutôt que d''en ouvrir une autre.');
    END IF;

    SELECT generate_public_id(p_shop_id, 'CAISSE') INTO v_pid;

    INSERT INTO cash_sessions (
        public_id, shop_id, warehouse_id, jour, statut,
        fond_initial, note_ouverture, ouverte_par
    ) VALUES (
        v_pid, p_shop_id, p_warehouse_id, v_jour, 'ouverte',
        p_fond, NULLIF(p_note, ''), p_user_id
    ) RETURNING id INTO v_id;

    RETURN jsonb_build_object('succes', true, 'session_id', v_id, 'public_id', v_pid);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rouvrir_session_caisse(p_shop_id uuid, p_session_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_session RECORD;
    v_auteur  TEXT;
    v_trace   TEXT;
BEGIN
    SELECT * INTO v_session FROM cash_sessions
     WHERE id = p_session_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Caisse introuvable.');
    END IF;
    IF v_session.statut <> 'fermee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette caisse est déjà ouverte.');
    END IF;
    -- Seule la journée en cours se rouvre : rouvrir un jour passé
    -- réécrirait un comptage que plus personne ne peut refaire.
    IF v_session.jour <> (now() + interval '1 hour')::date THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Seule la caisse d''aujourd''hui peut être rouverte.');
    END IF;

    SELECT nom_complet INTO v_auteur FROM shop_users WHERE id = p_user_id;

    v_trace := 'Rouverte le ' || to_char(now() + interval '1 hour', 'DD/MM/YYYY à HH24:MI')
        || COALESCE(' par ' || v_auteur, '')
        || ' — comptage annulé : compté ' || COALESCE(v_session.compte_especes::text, '?')
        || ', attendu ' || COALESCE(v_session.attendu_especes::text, '?')
        || ', écart ' || COALESCE(v_session.ecart::text, '?') || '.';

    UPDATE cash_sessions SET
        statut          = 'ouverte',
        compte_especes  = NULL,
        attendu_especes = NULL,
        ecart           = NULL,
        fermee_par      = NULL,
        fermee_le       = NULL,
        note_fermeture  = concat_ws(E'\n', note_fermeture, v_trace)
     WHERE id = p_session_id;

    RETURN jsonb_build_object('succes', true, 'session_id', p_session_id);
END;
$function$;

-- 4. Les espèces attendues comptent les ventes de la JOURNÉE (une seule
--    session par jour désormais), comme le rapport de caisse. Avant,
--    seules les ventes postérieures à l'ouverture comptaient : une vente
--    faite avant d'ouvrir la caisse était dans le tiroir mais pas dans
--    l'attendu, et le comptage annonçait un excédent fictif.
CREATE OR REPLACE FUNCTION public.especes_attendues_session(p_session_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
AS $function$
    WITH s AS (
        SELECT * FROM cash_sessions WHERE id = p_session_id
    )
    SELECT
        s.fond_initial
        -- Encaissements au comptoir, sur cet entrepôt, ce jour-là
        + COALESCE((
            SELECT SUM(sp.montant)
              FROM sale_payments sp
              JOIN sales v ON v.id = sp.sale_id
             WHERE v.shop_id = s.shop_id
               AND v.warehouse_id = s.warehouse_id
               AND v.statut = 'completee'
               AND sp.moyen_paiement = 'cash'
               AND (v.created_at + interval '1 hour')::date = s.jour
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
$function$;

-- 5. Fermer ajoute sa note à la suite au lieu de l'écraser : la trace
--    d'une réouverture (comptage annulé) doit survivre au recomptage.
CREATE OR REPLACE FUNCTION public.fermer_session_caisse(p_shop_id uuid, p_session_id uuid, p_compte numeric, p_note text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
        note_fermeture  = NULLIF(concat_ws(E'\n', note_fermeture, NULLIF(p_note, '')), ''),
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
$function$;
