-- ============================================================
-- MIGRATION 025 — Donner une vie à la facture
-- ============================================================
--
-- Constat du cadrage : une facture ne savait que naître et encaisser.
-- Les statuts `en_retard` et `annulee` figuraient dans la contrainte,
-- l'écran leur réservait un badge, et AUCUN code ne les écrivait. Une
-- facture échue depuis soixante jours s'affichait « Émise ». L'avoir
-- s'enregistrait dans sa table sans rien retrancher au montant dû.
--
-- Trois décisions produit s'appliquent ici :
--   D1 — le retard est CALCULÉ à l'affichage, jamais stocké. Ce n'est
--        pas un état de la facture mais une lecture de sa date
--        d'échéance à un instant donné : un statut écrit serait faux
--        dès le lendemain. On le retire donc de la contrainte.
--   D3 — l'avoir vient en déduction tant qu'il reste à payer ; le
--        surplus alimente l'avance du client.
--   (D2, le plafond de crédit, appartient au Lot 3.)
--
-- Le mouvement de solde client passe par une fonction dédiée, créée ici
-- parce que l'avoir en a besoin. Le Lot 3 y fera converger les deux
-- autres écrivains de soldes (la vente au comptoir et l'opération
-- manuelle), qui aujourd'hui se contredisent.
-- ============================================================

-- ── 1. Colonnes d'annulation et de correction ────────────────
ALTER TABLE factures
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT;

ALTER TABLE facture_payments
    ADD COLUMN IF NOT EXISTS est_annule       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT,
    ADD COLUMN IF NOT EXISTS modifie_le       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS modifie_par      UUID REFERENCES shop_users(id);

COMMENT ON COLUMN facture_payments.est_annule IS
    'Règlement annulé : reste visible et barré, mais EXCLU des totaux et du montant payé de la facture.';

-- L'avoir garde la trace de sa répartition (décision D3).
ALTER TABLE avoirs
    ADD COLUMN IF NOT EXISTS montant_deduit  NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS montant_avance  NUMERIC(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN avoirs.montant_deduit IS
    'Part de l''avoir venue en déduction du reste à payer de la facture.';
COMMENT ON COLUMN avoirs.montant_avance IS
    'Part de l''avoir versée au solde d''avance du client (facture déjà réglée).';

CREATE INDEX IF NOT EXISTS idx_fpay_facture_actifs
    ON facture_payments(facture_id) WHERE NOT est_annule;

-- ── 2. `en_retard` sort des statuts stockés (décision D1) ─────
-- Aucune ligne ne le porte : il n'a jamais été écrit.
DO $$
DECLARE
    v_lignes INTEGER;
BEGIN
    SELECT count(*) INTO v_lignes FROM factures WHERE statut = 'en_retard';
    IF v_lignes > 0 THEN
        RAISE EXCEPTION 'Migration 025 : % facture(s) portent le statut en_retard, à reprendre avant de retirer ce statut.', v_lignes;
    END IF;
END $$;

ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_statut_check;
ALTER TABLE factures ADD CONSTRAINT factures_statut_check
    CHECK (statut IN ('emise', 'partiellement_payee', 'payee', 'annulee'));

COMMENT ON COLUMN factures.statut IS
    'État de la facture. Le RETARD n''en fait pas partie : il se déduit de date_echeance à la lecture (décision D1), sinon le statut serait faux dès le lendemain de son écriture.';

-- ── 3. Mouvement de solde client, avec registre ──────────────
-- Le solde client bougeait par deux chemins dont un seul tenait le
-- registre `client_balance_operations`. Voici le chemin unique : verrou,
-- écriture du solde et de son opération dans la même transaction.
-- Le Lot 3 y fera passer la vente au comptoir et l'opération manuelle.
CREATE OR REPLACE FUNCTION appliquer_mouvement_solde_client(
    p_shop_id   UUID,
    p_client_id UUID,
    p_champ     TEXT,     -- 'credit_balance' | 'advance_balance' | 'change_balance'
    p_delta     NUMERIC,  -- signé : positif augmente le solde
    p_type      TEXT,     -- libellé de l'opération, pour le registre
    p_note      TEXT,
    p_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_client     RECORD;
    v_avant      NUMERIC;
    v_apres      NUMERIC;
BEGIN
    IF p_champ NOT IN ('credit_balance', 'advance_balance', 'change_balance') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Solde inconnu.');
    END IF;

    -- FOR UPDATE : deux opérations simultanées sur le même client ne
    -- peuvent plus s'écraser l'une l'autre.
    SELECT * INTO v_client FROM clients
     WHERE id = p_client_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Client introuvable.');
    END IF;

    IF v_client.est_anonyme AND p_delta <> 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Un client anonyme ne peut pas porter de solde.');
    END IF;

    v_avant := CASE p_champ
        WHEN 'credit_balance'  THEN v_client.credit_balance
        WHEN 'advance_balance' THEN v_client.advance_balance
        ELSE v_client.change_balance
    END;

    v_apres := v_avant + p_delta;

    IF v_apres < 0 THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Solde insuffisant : ' || v_avant || ' disponible, ' || ABS(p_delta) || ' demandé.'
        );
    END IF;

    EXECUTE format('UPDATE clients SET %I = $1 WHERE id = $2', p_champ)
      USING v_apres, p_client_id;

    INSERT INTO client_balance_operations (
        shop_id, client_id, type_operation, montant,
        solde_avant, solde_apres, note, created_by
    ) VALUES (
        p_shop_id, p_client_id, p_type, ABS(p_delta),
        v_avant, v_apres, p_note, p_user_id
    );

    RETURN jsonb_build_object('succes', true, 'solde_avant', v_avant, 'solde_apres', v_apres);
END;
$$;

COMMENT ON FUNCTION appliquer_mouvement_solde_client(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, UUID) IS
    'Chemin UNIQUE de variation d''un solde client : verrou FOR UPDATE, solde et registre écrits ensemble. Ne jamais écrire clients.credit_balance / advance_balance / change_balance directement.';

-- ── 4. Recalcul du statut d'une facture ──────────────────────
-- Un seul endroit décide de l'état d'une facture, à partir de ce qui a
-- réellement été encaissé et avoiré. Appelé après chaque mouvement.
CREATE OR REPLACE FUNCTION recalculer_statut_facture(p_facture_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_facture RECORD;
    v_paye    NUMERIC;
    v_deduit  NUMERIC;
    v_reste   NUMERIC;
    v_statut  TEXT;
BEGIN
    SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;
    IF NOT FOUND OR v_facture.statut = 'annulee' THEN RETURN; END IF;

    SELECT COALESCE(SUM(montant), 0) INTO v_paye
      FROM facture_payments
     WHERE facture_id = p_facture_id AND NOT est_annule;

    SELECT COALESCE(SUM(montant_deduit), 0) INTO v_deduit
      FROM avoirs WHERE facture_id = p_facture_id;

    v_reste := GREATEST(v_facture.montant_ttc - v_paye - v_deduit, 0);

    v_statut := CASE
        WHEN v_reste <= 0                    THEN 'payee'
        WHEN v_paye > 0 OR v_deduit > 0      THEN 'partiellement_payee'
        ELSE 'emise'
    END;

    UPDATE factures SET
        montant_paye    = v_paye,
        montant_restant = v_reste,
        statut          = v_statut
    WHERE id = p_facture_id;
END;
$$;

-- ── 5. Créer un avoir (décision D3) ──────────────────────────
CREATE OR REPLACE FUNCTION creer_avoir(
    p_shop_id    UUID,
    p_facture_id UUID,
    p_montant    NUMERIC,
    p_motif      TEXT,
    p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_facture   RECORD;
    v_deja      NUMERIC;
    v_couvrable NUMERIC;
    v_deduit    NUMERIC;
    v_avance    NUMERIC;
    v_public_id TEXT;
    v_solde     JSONB;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;
    IF p_motif IS NULL OR length(trim(p_motif)) < 3 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Indiquez le motif de l''avoir.');
    END IF;

    SELECT * INTO v_facture FROM factures
     WHERE id = p_facture_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;
    IF v_facture.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette facture est annulée.');
    END IF;

    SELECT COALESCE(SUM(montant), 0) INTO v_deja
      FROM avoirs WHERE facture_id = p_facture_id;

    IF p_montant > v_facture.montant_ttc - v_deja THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Un avoir ne peut pas dépasser le montant de la facture. Reste couvrable : '
                      || (v_facture.montant_ttc - v_deja)
        );
    END IF;

    -- Décision D3 : déduction tant qu'il reste à payer, le surplus va à
    -- l'avance du client. C'est ce qu'une boutique fait naturellement
    -- quand la facture est déjà réglée.
    v_couvrable := GREATEST(v_facture.montant_restant, 0);
    v_deduit    := LEAST(p_montant, v_couvrable);
    v_avance    := p_montant - v_deduit;

    IF v_avance > 0 AND v_facture.client_id IS NULL THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Cette facture n''a pas de client : le surplus de l''avoir ne peut être porté à aucune avance. Limitez l''avoir à ' || v_couvrable || '.'
        );
    END IF;

    SELECT generate_public_id(p_shop_id, 'AVO') INTO v_public_id;

    INSERT INTO avoirs (
        public_id, shop_id, facture_id, client_id, motif, montant,
        montant_deduit, montant_avance, est_applique, created_by
    ) VALUES (
        v_public_id, p_shop_id, p_facture_id, v_facture.client_id, trim(p_motif), p_montant,
        v_deduit, v_avance, TRUE, p_user_id
    );

    IF v_avance > 0 THEN
        SELECT appliquer_mouvement_solde_client(
            p_shop_id, v_facture.client_id, 'advance_balance', v_avance,
            'avoir_facture', 'Avoir ' || v_public_id || ' sur ' || v_facture.public_id, p_user_id
        ) INTO v_solde;

        IF NOT (v_solde->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_solde->>'erreur';
        END IF;
    END IF;

    PERFORM recalculer_statut_facture(p_facture_id);

    RETURN jsonb_build_object(
        'succes', true, 'public_id', v_public_id,
        'montant_deduit', v_deduit, 'montant_avance', v_avance
    );
END;
$$;

-- ── 6. Annuler une facture ───────────────────────────────────
CREATE OR REPLACE FUNCTION annuler_facture(
    p_shop_id    UUID,
    p_facture_id UUID,
    p_motif      TEXT,
    p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_facture RECORD;
    v_paye    NUMERIC;
BEGIN
    IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Expliquez en quelques mots pourquoi cette facture est annulée.');
    END IF;

    SELECT * INTO v_facture FROM factures
     WHERE id = p_facture_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;
    IF v_facture.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette facture est déjà annulée.');
    END IF;

    -- Une facture déjà encaissée ne s'annule pas d'un trait : l'argent
    -- est entré. Il faut d'abord annuler les règlements, ce qui laisse
    -- une trace, ou passer par un avoir.
    SELECT COALESCE(SUM(montant), 0) INTO v_paye
      FROM facture_payments
     WHERE facture_id = p_facture_id AND NOT est_annule;

    IF v_paye > 0 THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Cette facture a déjà reçu ' || v_paye || ' de règlements. Annulez-les d''abord, ou émettez un avoir.'
        );
    END IF;

    UPDATE factures SET
        statut           = 'annulee',
        montant_restant  = 0,
        annule_le        = NOW(),
        annule_par       = p_user_id,
        motif_annulation = trim(p_motif)
    WHERE id = p_facture_id;

    RETURN jsonb_build_object('succes', true);
END;
$$;

-- ── 7. Régler une facture : la date réelle fait foi ──────────
-- L'ancienne version n'écrivait jamais `date_paiement` : la base
-- retombait sur CURRENT_DATE, et un règlement reçu le 30 puis saisi le 2
-- portait la mauvaise date. Depuis le Lot 4 Finances, c'est cette
-- colonne qui date la trésorerie.
CREATE OR REPLACE FUNCTION payer_facture(
    p_shop_id       UUID,
    p_facture_id    UUID,
    p_montant       NUMERIC,
    p_moyen         TEXT,
    p_reference     TEXT,
    p_note          TEXT,
    p_user_id       UUID,
    p_date_paiement DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_facture   RECORD;
    v_public_id TEXT;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;
    IF p_date_paiement > CURRENT_DATE THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'La date de règlement ne peut pas être dans le futur.');
    END IF;

    SELECT * INTO v_facture FROM factures
     WHERE id = p_facture_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;
    IF v_facture.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette facture est annulée.');
    END IF;
    IF p_montant > v_facture.montant_restant THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Le montant dépasse le reste à payer (' || v_facture.montant_restant || ').'
        );
    END IF;

    SELECT generate_public_id(p_shop_id, 'FPAY') INTO v_public_id;

    INSERT INTO facture_payments (
        public_id, shop_id, facture_id, moyen_paiement, montant,
        reference, note, date_paiement, created_by
    ) VALUES (
        v_public_id, p_shop_id, p_facture_id, p_moyen, p_montant,
        NULLIF(p_reference, ''), NULLIF(p_note, ''), p_date_paiement, p_user_id
    );

    PERFORM recalculer_statut_facture(p_facture_id);

    SELECT * INTO v_facture FROM factures WHERE id = p_facture_id;

    RETURN jsonb_build_object(
        'succes', true, 'statut', v_facture.statut,
        'montant_paye', v_facture.montant_paye,
        'montant_restant', v_facture.montant_restant
    );
END;
$$;

-- ── 8. Corriger ou annuler un règlement ──────────────────────
CREATE OR REPLACE FUNCTION modifier_paiement_facture(
    p_shop_id       UUID,
    p_paiement_id   UUID,
    p_montant       NUMERIC,
    p_moyen         TEXT,
    p_reference     TEXT,
    p_date_paiement DATE,
    p_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_paiement RECORD;
    v_facture  RECORD;
    v_autres   NUMERIC;
    v_deduit   NUMERIC;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;
    IF p_date_paiement > CURRENT_DATE THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'La date de règlement ne peut pas être dans le futur.');
    END IF;

    SELECT * INTO v_paiement FROM facture_payments
     WHERE id = p_paiement_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Règlement introuvable.');
    END IF;
    IF v_paiement.est_annule THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ce règlement est annulé : il ne peut plus être modifié.');
    END IF;

    SELECT * INTO v_facture FROM factures
     WHERE id = v_paiement.facture_id FOR UPDATE;

    -- Le nouveau montant doit tenir dans la facture, les AUTRES
    -- règlements et les avoirs déduits.
    SELECT COALESCE(SUM(montant), 0) INTO v_autres
      FROM facture_payments
     WHERE facture_id = v_paiement.facture_id
       AND id <> p_paiement_id AND NOT est_annule;

    SELECT COALESCE(SUM(montant_deduit), 0) INTO v_deduit
      FROM avoirs WHERE facture_id = v_paiement.facture_id;

    IF v_autres + v_deduit + p_montant > v_facture.montant_ttc THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Ce montant ferait dépasser le total de la facture. Maximum : '
                      || (v_facture.montant_ttc - v_autres - v_deduit)
        );
    END IF;

    UPDATE facture_payments SET
        montant        = p_montant,
        moyen_paiement = p_moyen,
        reference      = NULLIF(p_reference, ''),
        date_paiement  = p_date_paiement,
        modifie_le     = NOW(),
        modifie_par    = p_user_id
    WHERE id = p_paiement_id;

    PERFORM recalculer_statut_facture(v_paiement.facture_id);

    RETURN jsonb_build_object('succes', true);
END;
$$;

CREATE OR REPLACE FUNCTION annuler_paiement_facture(
    p_shop_id     UUID,
    p_paiement_id UUID,
    p_motif       TEXT,
    p_user_id     UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_paiement RECORD;
BEGIN
    IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Expliquez en quelques mots pourquoi ce règlement est annulé.');
    END IF;

    SELECT * INTO v_paiement FROM facture_payments
     WHERE id = p_paiement_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Règlement introuvable.');
    END IF;
    IF v_paiement.est_annule THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ce règlement est déjà annulé.');
    END IF;

    UPDATE facture_payments SET
        est_annule       = TRUE,
        annule_le        = NOW(),
        annule_par       = p_user_id,
        motif_annulation = trim(p_motif)
    WHERE id = p_paiement_id;

    PERFORM recalculer_statut_facture(v_paiement.facture_id);

    RETURN jsonb_build_object('succes', true);
END;
$$;

-- ── 9. Conversion d'un devis : une seule fois ────────────────
-- L'ancienne version ne refusait que les devis refusés ou expirés. Un
-- devis déjà converti porte le statut `accepte`, qui passait le
-- contrôle : deux clics, deux factures pour la même commande.
CREATE OR REPLACE FUNCTION convertir_devis_en_facture(
    p_shop_id  UUID,
    p_devis_id UUID,
    p_user_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_devis     RECORD;
    v_public_id TEXT;
    v_facture_id UUID;
BEGIN
    SELECT * INTO v_devis FROM devis
     WHERE id = p_devis_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Devis introuvable.');
    END IF;
    IF v_devis.converti_en_facture IS NOT NULL THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Ce devis a déjà été converti en facture.',
            'facture_id', v_devis.converti_en_facture
        );
    END IF;
    IF v_devis.statut IN ('refuse', 'expire') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ce devis ne peut pas être converti.');
    END IF;

    SELECT generate_public_id(p_shop_id, 'FACT') INTO v_public_id;

    INSERT INTO factures (
        public_id, shop_id, client_id, devis_id, statut,
        date_facture, date_echeance, objet,
        montant_ht, montant_tva, montant_ttc,
        montant_paye, montant_restant, remise_pct, remise_val,
        note_client, est_immutable, created_by
    ) VALUES (
        v_public_id, p_shop_id, v_devis.client_id, p_devis_id, 'emise',
        CURRENT_DATE, CURRENT_DATE + 30, v_devis.objet,
        v_devis.montant_ht, v_devis.montant_tva, v_devis.montant_ttc,
        0, v_devis.montant_ttc, v_devis.remise_pct, v_devis.remise_val,
        v_devis.note_client, TRUE, p_user_id
    ) RETURNING id INTO v_facture_id;

    -- En-tête et lignes dans la MÊME transaction : plus de facture
    -- numérotée sans son détail.
    INSERT INTO facture_items (
        shop_id, facture_id, product_id, designation, quantite,
        prix_unitaire, remise_pct, remise_val, montant_ht,
        tva_pct, montant_tva, montant_ttc, ordre
    )
    SELECT p_shop_id, v_facture_id, product_id, designation, quantite,
           prix_unitaire, remise_pct, remise_val, montant_ht,
           tva_pct, montant_tva, montant_ttc, ordre
      FROM devis_items WHERE devis_id = p_devis_id;

    UPDATE devis SET statut = 'accepte', converti_en_facture = v_facture_id
     WHERE id = p_devis_id;

    RETURN jsonb_build_object('succes', true, 'facture_id', v_facture_id, 'public_id', v_public_id);
END;
$$;

-- ── 10. Contrôle ─────────────────────────────────────────────
DO $$
DECLARE
    v_ligne RECORD;
BEGIN
    FOR v_ligne IN
        SELECT public_id, statut, date_echeance,
               CURRENT_DATE - date_echeance AS jours
          FROM factures
         WHERE date_echeance < CURRENT_DATE
           AND statut IN ('emise', 'partiellement_payee')
    LOOP
        RAISE NOTICE 'Migration 025 : % est échue depuis % jours (statut « % ») — le retard est désormais calculé à la lecture.',
            v_ligne.public_id, v_ligne.jours, v_ligne.statut;
    END LOOP;
END $$;

-- ── 11. Retrait de l'ancienne signature de payer_facture ─────
-- La nouvelle version ajoute `p_date_paiement` : PostgreSQL en fait une
-- SURCHARGE et non un remplacement. Les deux coexisteraient, et un
-- appel à sept arguments continuerait de viser l'ancienne — celle qui
-- n'écrit jamais la date. On la supprime.
DROP FUNCTION IF EXISTS payer_facture(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID);

DO $$
DECLARE
    v_nb INTEGER;
BEGIN
    SELECT count(*) INTO v_nb FROM pg_proc WHERE proname = 'payer_facture';
    IF v_nb <> 1 THEN
        RAISE EXCEPTION 'Migration 025 : % signatures de payer_facture subsistent, une seule est attendue.', v_nb;
    END IF;
    RAISE NOTICE 'Migration 025 : payer_facture n''a plus qu''une signature, avec la date de règlement.';
END $$;

-- ── 12. Les types d'opération de solde s'ouvrent aux origines ─
-- La contrainte ne connaissait que les six opérations MANUELLES, seules
-- écrites jusqu'ici. Or le registre doit désormais recevoir tout
-- mouvement de solde, quelle qu'en soit l'origine : c'est ce qui
-- manquait pour que le solde d'un client s'explique (le crédit de
-- 10 000 F en production n'a laissé aucune trace).
--
-- On ajoute l'avoir, et déjà les origines que le Lot 3 fera passer par
-- la fonction unique : la vente au comptoir accorde du crédit, consomme
-- une avance, rend de la monnaie.
ALTER TABLE client_balance_operations
    DROP CONSTRAINT IF EXISTS client_balance_operations_type_operation_check;

ALTER TABLE client_balance_operations
    ADD CONSTRAINT client_balance_operations_type_operation_check
    CHECK (type_operation IN (
        -- Opérations saisies à la main
        'credit_remboursement', 'credit_utilisation',
        'advance_depot',        'advance_utilisation',
        'change_depot',         'change_utilisation',
        -- Origines automatiques
        'avoir_facture',        -- avoir dont le surplus va à l'avance (D3)
        'vente_credit',         -- crédit accordé au comptoir
        'vente_avance',         -- avance consommée par une vente
        'vente_monnaie',        -- monnaie laissée en compte
        'regularisation'        -- reprise d'un solde sans opération d'origine
    ));

COMMENT ON COLUMN client_balance_operations.type_operation IS
    'Origine du mouvement. Tout mouvement de solde doit en produire un : un solde sans opération est un solde inexplicable.';
