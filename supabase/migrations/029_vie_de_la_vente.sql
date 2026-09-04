-- ============================================================
-- MIGRATION 029 — Une vie pour la vente
-- ============================================================
--
-- Constat du cadrage POS : une vente conclue disparaissait. Les statuts
-- `annulee` et `remboursee` figuraient dans la contrainte de `sales` et
-- AUCUN code ne les écrivait — le même schéma que les factures avant le
-- module Facturation. Une vente saisie par erreur restait définitive :
-- le stock déduit, l'argent compté, et rien à reprendre.
--
-- Le retour client, lui, remettait bien la marchandise en stock mais son
-- champ `reglement` restait à « à traiter » : aucun avoir, aucun
-- remboursement, aucune avance créditée. La moitié financière manquait.
--
-- Décision D2 du module POS : les trois issues sont proposées au moment
-- du retour, avec « porter à l'avance du client » par défaut. Le
-- remboursement en espèces vide le tiroir et l'avance fidélise, mais un
-- client qui exige son argent doit pouvoir l'obtenir.
-- ============================================================

-- ── 1. Traces d'annulation ───────────────────────────────────
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT;

COMMENT ON COLUMN sales.statut IS
    'completee | annulee. Une vente annulée reste visible et conserve son numéro, mais son stock est rendu, ses soldes client repris, et elle sort de tous les totaux.';

CREATE INDEX IF NOT EXISTS idx_sales_shop_date_actives
    ON sales(shop_id, created_at) WHERE statut = 'completee';

-- ── 2. Annuler une vente ─────────────────────────────────────
-- Tout ce que la vente a fait est défait dans la même transaction : le
-- stock revient, les soldes client sont repris, les règlements sortent
-- des totaux. C'est la seule façon de reprendre une erreur de caisse.
CREATE OR REPLACE FUNCTION annuler_vente(
    p_shop_id UUID,
    p_sale_id UUID,
    p_motif   TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_vente  RECORD;
    v_item   RECORD;
    v_res    JSONB;
    v_solde  JSONB;
BEGIN
    IF p_motif IS NULL OR length(trim(p_motif)) < 5 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Expliquez en quelques mots pourquoi cette vente est annulée.');
    END IF;

    SELECT * INTO v_vente FROM sales
     WHERE id = p_sale_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Vente introuvable.');
    END IF;
    IF v_vente.statut <> 'completee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette vente est déjà annulée.');
    END IF;

    -- Une vente déjà retournée en partie ne s'annule pas d'un trait :
    -- le stock serait rendu deux fois.
    IF EXISTS (SELECT 1 FROM sale_returns WHERE sale_id = p_sale_id) THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Cette vente a déjà fait l''objet d''un retour. Annulez le retour d''abord, ou traitez le reste en retour.'
        );
    END IF;

    -- Le stock revient, ligne par ligne.
    FOR v_item IN
        SELECT product_id, warehouse_id, quantite FROM sale_items WHERE sale_id = p_sale_id
    LOOP
        v_res := appliquer_mouvement_stock(
            p_shop_id, v_item.product_id, v_item.warehouse_id,
            v_item.quantite, 'retour_vente',
            'sale', p_sale_id, v_vente.public_id,
            'Annulation de ' || v_vente.public_id, p_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;
    END LOOP;

    -- Les soldes client sont repris, chacun en sens inverse.
    IF v_vente.client_id IS NOT NULL THEN

        IF v_vente.credit_accorde > 0 THEN
            SELECT appliquer_mouvement_solde_client(
                p_shop_id, v_vente.client_id, 'credit_balance', -v_vente.credit_accorde,
                'vente_credit', 'Annulation de ' || v_vente.public_id, p_user_id
            ) INTO v_solde;
            IF NOT (v_solde->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION 'Crédit accordé : %', v_solde->>'erreur';
            END IF;
        END IF;

        IF v_vente.credit_utilise > 0 THEN
            SELECT appliquer_mouvement_solde_client(
                p_shop_id, v_vente.client_id, 'credit_balance', v_vente.credit_utilise,
                'credit_utilisation', 'Annulation de ' || v_vente.public_id, p_user_id
            ) INTO v_solde;
            IF NOT (v_solde->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION 'Ardoise réglée : %', v_solde->>'erreur';
            END IF;
        END IF;

        IF v_vente.advance_utilise > 0 THEN
            SELECT appliquer_mouvement_solde_client(
                p_shop_id, v_vente.client_id, 'advance_balance', v_vente.advance_utilise,
                'advance_depot', 'Annulation de ' || v_vente.public_id, p_user_id
            ) INTO v_solde;
            IF NOT (v_solde->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION 'Avance utilisée : %', v_solde->>'erreur';
            END IF;
        END IF;

        IF v_vente.change_utilise > 0 THEN
            SELECT appliquer_mouvement_solde_client(
                p_shop_id, v_vente.client_id, 'change_balance', v_vente.change_utilise,
                'change_depot', 'Annulation de ' || v_vente.public_id, p_user_id
            ) INTO v_solde;
            IF NOT (v_solde->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION 'Monnaie utilisée : %', v_solde->>'erreur';
            END IF;
        END IF;

    END IF;

    UPDATE sales SET
        statut           = 'annulee',
        annule_le        = NOW(),
        annule_par       = p_user_id,
        motif_annulation = trim(p_motif)
    WHERE id = p_sale_id;

    RETURN jsonb_build_object('succes', true, 'public_id', v_vente.public_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

COMMENT ON FUNCTION annuler_vente(UUID, UUID, TEXT, UUID) IS
    'Annule une vente : stock rendu, soldes client repris, statut « annulee ». Refuse une vente déjà retournée (le stock reviendrait deux fois).';

-- ── 3. Le retour reçoit sa moitié financière (décision D2) ───
-- `effectuer_retour_vente` remettait la marchandise en stock et
-- laissait `reglement` à « a_traiter ». Cette fonction traite la partie
-- argent, séparément : on peut ainsi enregistrer le retour au comptoir
-- et décider du règlement ensuite.
CREATE OR REPLACE FUNCTION regler_retour_vente(
    p_shop_id   UUID,
    p_retour_id UUID,
    p_mode      TEXT,   -- 'avance' | 'rembourse' | 'avoir' | 'sans_suite'
    p_note      TEXT,
    p_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_retour RECORD;
    v_solde  JSONB;
BEGIN
    IF p_mode NOT IN ('avance', 'rembourse', 'avoir', 'sans_suite') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Mode de règlement inconnu.');
    END IF;

    SELECT * INTO v_retour FROM sale_returns
     WHERE id = p_retour_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Retour introuvable.');
    END IF;
    IF v_retour.reglement <> 'a_traiter' THEN
        RETURN jsonb_build_object(
            'succes', false,
            'erreur', 'Ce retour a déjà été réglé (' || v_retour.reglement || ').'
        );
    END IF;
    IF v_retour.montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ce retour ne porte aucun montant.');
    END IF;

    -- Porter à l'avance du client : le montant devient réutilisable sur
    -- un prochain achat. C'est le défaut de la décision D2.
    IF p_mode = 'avance' THEN
        IF v_retour.client_id IS NULL THEN
            RETURN jsonb_build_object(
                'succes', false,
                'erreur', 'Ce retour n''a pas de client : le montant ne peut être porté à aucune avance. Choisissez le remboursement.'
            );
        END IF;

        SELECT appliquer_mouvement_solde_client(
            p_shop_id, v_retour.client_id, 'advance_balance', v_retour.montant,
            'advance_depot',
            'Retour ' || v_retour.public_id || COALESCE(' — ' || NULLIF(p_note, ''), ''),
            p_user_id
        ) INTO v_solde;

        IF NOT (v_solde->>'succes')::BOOLEAN THEN
            RETURN jsonb_build_object('succes', false, 'erreur', v_solde->>'erreur');
        END IF;

        UPDATE sale_returns SET reglement = 'avance',
               note = COALESCE(NULLIF(p_note, ''), note)
         WHERE id = p_retour_id;

        RETURN jsonb_build_object(
            'succes', true, 'mode', 'avance', 'montant', v_retour.montant,
            'message', 'Montant porté à l''avance du client.'
        );
    END IF;

    -- Remboursé en espèces : l'argent sort de la caisse. La sortie est
    -- enregistrée comme une dépense pour que la trésorerie la voie —
    -- sans elle, le tiroir se vide sans trace.
    IF p_mode = 'rembourse' THEN
        DECLARE
            v_cat UUID;
            v_pid TEXT;
        BEGIN
            SELECT id INTO v_cat FROM expense_categories
             WHERE shop_id = p_shop_id AND nom = 'Remboursements clients'
             LIMIT 1;

            IF v_cat IS NULL THEN
                INSERT INTO expense_categories (shop_id, nom, description, est_actif)
                VALUES (p_shop_id, 'Remboursements clients',
                        'Créée automatiquement : sorties de caisse dues aux retours clients.', TRUE)
                RETURNING id INTO v_cat;
            END IF;

            SELECT generate_public_id(p_shop_id, 'EXP') INTO v_pid;

            INSERT INTO expenses (
                public_id, shop_id, category_id, libelle, montant,
                moyen_paiement, date_depense, note, created_by
            ) VALUES (
                v_pid, p_shop_id, v_cat,
                'Remboursement retour ' || v_retour.public_id,
                v_retour.montant, 'cash', CURRENT_DATE,
                COALESCE(NULLIF(p_note, ''), v_retour.motif), p_user_id
            );
        END;

        UPDATE sale_returns SET reglement = 'rembourse',
               note = COALESCE(NULLIF(p_note, ''), note)
         WHERE id = p_retour_id;

        RETURN jsonb_build_object(
            'succes', true, 'mode', 'rembourse', 'montant', v_retour.montant,
            'message', 'Remboursement enregistré comme sortie de caisse.'
        );
    END IF;

    -- Avoir : on marque le retour, l'avoir lui-même s'émet depuis la
    -- facture concernée (module Facturation), qui sait déjà le répartir.
    IF p_mode = 'avoir' THEN
        UPDATE sale_returns SET reglement = 'avoir',
               note = COALESCE(NULLIF(p_note, ''), note)
         WHERE id = p_retour_id;

        RETURN jsonb_build_object(
            'succes', true, 'mode', 'avoir', 'montant', v_retour.montant,
            'message', 'Retour marqué « avoir ». Émettez l''avoir depuis la facture du client.'
        );
    END IF;

    -- Sans suite : la marchandise revient, rien n'est dû au client.
    UPDATE sale_returns SET reglement = 'sans_suite',
           note = COALESCE(NULLIF(p_note, ''), note)
     WHERE id = p_retour_id;

    RETURN jsonb_build_object(
        'succes', true, 'mode', 'sans_suite', 'montant', 0,
        'message', 'Retour classé sans suite : rien n''est dû au client.'
    );
END;
$$;

COMMENT ON FUNCTION regler_retour_vente(UUID, UUID, TEXT, TEXT, UUID) IS
    'Traite la moitié FINANCIÈRE d''un retour client (décision D2 POS) : avance du client par défaut, remboursement en caisse, avoir à émettre, ou sans suite. La partie stock est faite par effectuer_retour_vente.';

-- ── 4. Contrôle ──────────────────────────────────────────────
DO $$
DECLARE
    v_ventes  INTEGER;
    v_retours INTEGER;
BEGIN
    SELECT count(*) INTO v_ventes  FROM sales WHERE statut = 'completee';
    SELECT count(*) INTO v_retours FROM sale_returns WHERE reglement = 'a_traiter';

    RAISE NOTICE 'Migration 029 : % vente(s) complétée(s) désormais annulables, % retour(s) en attente de règlement.',
        v_ventes, v_retours;
END $$;

-- ── 5. « avance » entre dans les règlements possibles ────────
-- La contrainte ne connaissait que les quatre issues d'origine, dont
-- aucune n'était jamais posée. La décision D2 en ajoute une cinquième —
-- porter le montant à l'avance du client — et c'est le défaut proposé.
ALTER TABLE sale_returns
    DROP CONSTRAINT IF EXISTS sale_returns_reglement_check;

ALTER TABLE sale_returns
    ADD CONSTRAINT sale_returns_reglement_check
    CHECK (reglement IN ('a_traiter', 'avance', 'avoir', 'rembourse', 'sans_suite'));

COMMENT ON COLUMN sale_returns.reglement IS
    'Issue financière du retour : a_traiter (par défaut à la création), avance (porté au solde du client), rembourse (sortie de caisse), avoir (à émettre depuis la facture), sans_suite. La partie stock est indépendante.';
