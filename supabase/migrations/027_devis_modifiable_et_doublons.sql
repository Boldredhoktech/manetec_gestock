-- ============================================================
-- MIGRATION 027 — Devis modifiable, doublons de clients
-- ============================================================
--
-- Deux corrections du dernier lot du module.
--
-- 1. Un devis n'est qu'une PROPOSITION : une faute de frappe dans une
--    désignation ou un prix erroné obligeait à tout ressaisir. La
--    facture, elle, reste immuable — c'est une pièce — et c'est
--    l'annulation (Lot 2) qui sert à la corriger.
--
--    On ne modifie qu'un devis encore ouvert : `brouillon` ou `envoye`.
--    Un devis accepté ou converti a engagé le client, il ne se réécrit
--    pas dans son dos.
--
-- 2. Rien n'empêchait de créer deux fois le même client dans une même
--    boutique, ce qui éclate son historique et ses soldes en deux
--    fiches. L'unicité du téléphone est posée là où elle a du sens :
--    par boutique, et seulement quand le numéro est renseigné.
-- ============================================================

-- ── 1. Modifier un devis ─────────────────────────────────────
CREATE OR REPLACE FUNCTION modifier_devis(
    p_shop_id       UUID,
    p_devis_id      UUID,
    p_client_id     UUID,
    p_objet         TEXT,
    p_date_validite DATE,
    p_remise_pct    NUMERIC,
    p_note_client   TEXT,
    p_note_interne  TEXT,
    p_lignes        JSONB,
    p_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_devis      RECORD;
    v_ligne      JSONB;
    v_ordre      INTEGER := 0;
    v_remise_val NUMERIC;
    v_ht         NUMERIC;
    v_tva        NUMERIC;
    v_total_ht   NUMERIC := 0;
    v_total_tva  NUMERIC := 0;
    v_remise_glo NUMERIC;
    v_ht_final   NUMERIC;
BEGIN
    IF jsonb_array_length(p_lignes) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;

    SELECT * INTO v_devis FROM devis
     WHERE id = p_devis_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Devis introuvable.');
    END IF;
    IF v_devis.converti_en_facture IS NOT NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ce devis a été converti en facture : il ne se modifie plus.');
    END IF;
    IF v_devis.statut NOT IN ('brouillon', 'envoye') THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Seul un devis en brouillon ou envoyé peut être modifié (celui-ci est « ' || v_devis.statut || ' »).'
        );
    END IF;

    -- Les lignes sont remplacées en bloc : plus simple à raisonner
    -- qu'une réconciliation ligne à ligne, et sans risque de laisser
    -- une ligne orpheline. Le tout dans la même transaction.
    DELETE FROM devis_items WHERE devis_id = p_devis_id;

    FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
    LOOP
        v_remise_val := (v_ligne->>'prix_unitaire')::NUMERIC
                      * (v_ligne->>'quantite')::NUMERIC
                      * COALESCE((v_ligne->>'remise_pct')::NUMERIC, 0) / 100;

        v_ht  := (v_ligne->>'prix_unitaire')::NUMERIC * (v_ligne->>'quantite')::NUMERIC - v_remise_val;
        v_tva := v_ht * COALESCE((v_ligne->>'tva_pct')::NUMERIC, 0) / 100;

        v_total_ht  := v_total_ht  + v_ht;
        v_total_tva := v_total_tva + v_tva;

        INSERT INTO devis_items (
            shop_id, devis_id, product_id, designation, quantite,
            prix_unitaire, remise_pct, remise_val, montant_ht,
            tva_pct, montant_tva, montant_ttc, ordre
        ) VALUES (
            p_shop_id, p_devis_id,
            NULLIF(v_ligne->>'product_id', '')::UUID,
            v_ligne->>'designation',
            (v_ligne->>'quantite')::NUMERIC,
            (v_ligne->>'prix_unitaire')::NUMERIC,
            COALESCE((v_ligne->>'remise_pct')::NUMERIC, 0),
            v_remise_val, v_ht,
            COALESCE((v_ligne->>'tva_pct')::NUMERIC, 0),
            v_tva, v_ht + v_tva, v_ordre
        );

        v_ordre := v_ordre + 1;
    END LOOP;

    v_remise_glo := v_total_ht * COALESCE(p_remise_pct, 0) / 100;
    v_ht_final   := v_total_ht - v_remise_glo;

    UPDATE devis SET
        client_id     = p_client_id,
        objet         = NULLIF(p_objet, ''),
        date_validite = p_date_validite,
        montant_ht    = v_ht_final,
        montant_tva   = v_total_tva,
        montant_ttc   = v_ht_final + v_total_tva,
        remise_pct    = COALESCE(p_remise_pct, 0),
        remise_val    = v_remise_glo,
        note_client   = NULLIF(p_note_client, ''),
        note_interne  = NULLIF(p_note_interne, '')
    WHERE id = p_devis_id;

    RETURN jsonb_build_object('succes', true, 'montant_ttc', v_ht_final + v_total_tva);
END;
$$;

COMMENT ON FUNCTION modifier_devis(UUID, UUID, UUID, TEXT, DATE, NUMERIC, TEXT, TEXT, JSONB, UUID) IS
    'Modifie un devis encore ouvert (brouillon ou envoyé) : lignes remplacées en bloc et totaux recalculés dans la même transaction. Un devis converti en facture est refusé.';

-- ── 2. Un même client, une seule fiche ───────────────────────
-- Deux fiches pour la même personne éclatent son historique et ses
-- soldes. On contrôle avant de poser la contrainte : elle échoue s'il
-- existe déjà des doublons, qu'il faudrait alors fusionner d'abord.
DO $$
DECLARE
    v_doublons INTEGER;
    v_detail   TEXT;
BEGIN
    SELECT count(*), string_agg(DISTINCT telephone, ', ')
      INTO v_doublons, v_detail
      FROM (
        SELECT shop_id, telephone
          FROM clients
         WHERE telephone IS NOT NULL AND trim(telephone) <> ''
           AND NOT est_anonyme
         GROUP BY shop_id, telephone
        HAVING count(*) > 1
      ) d;

    IF v_doublons > 0 THEN
        RAISE EXCEPTION
            'Migration 027 : % numéro(s) de téléphone en double (%). Fusionner ces fiches avant de poser la contrainte.',
            v_doublons, v_detail;
    END IF;
END $$;

-- Index UNIQUE partiel : le téléphone n'est obligatoire pour personne,
-- mais quand il est renseigné il désigne une seule fiche par boutique.
-- Les clients anonymes (le « client de passage » du POS) en sont exclus.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_telephone_unique
    ON clients(shop_id, telephone)
 WHERE telephone IS NOT NULL AND trim(telephone) <> '' AND NOT est_anonyme;

COMMENT ON INDEX idx_clients_telephone_unique IS
    'Un numéro de téléphone désigne une seule fiche client par boutique : deux fiches pour la même personne éclateraient son historique et ses soldes.';

-- ── 3. Contrôle ──────────────────────────────────────────────
DO $$
DECLARE
    v_sans_echeance INTEGER;
BEGIN
    -- Les factures dont l'échéance tombe le jour même sont en retard
    -- dès leur création. Le formulaire pose désormais 30 jours par
    -- défaut ; les anciennes restent telles quelles (une échéance
    -- passée est un fait, pas une erreur de saisie à réécrire).
    SELECT count(*) INTO v_sans_echeance
      FROM factures
     WHERE date_echeance = date_facture;

    IF v_sans_echeance > 0 THEN
        RAISE NOTICE 'Migration 027 : % facture(s) ont une échéance égale à leur date d''émission (échues dès leur création). Laissées en l''état : le passé ne se réécrit pas.', v_sans_echeance;
    END IF;
END $$;
