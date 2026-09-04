-- ============================================================
-- MIGRATION 017 — Fournisseurs, Lot 3 : la chaîne d'achat
-- ------------------------------------------------------------
-- Le bon de commande était inutilisable pour trois raisons
-- cumulées :
--   • creerBonCommande() insère purchase_orders.warehouse_id,
--     colonne déclarée par la migration 007 mais jamais créée en
--     production : toute création échouait ;
--   • trois vocabulaires de statut coexistaient — la contrainte
--     en base (brouillon / soumis / recu_partiel / recu_total /
--     annule), la fonction de réception (« recu », interdit) et
--     l'écran de réception (« envoye », inexistant) ;
--   • aucune transition n'était prévue : rien ne faisait passer
--     un bon de brouillon à soumis, ni ne l'annulait.
--
-- Le vocabulaire de la base fait foi. La fonction de réception a
-- déjà été alignée (migration 016). Il reste la colonne manquante
-- et la traçabilité des transitions.
--
-- Décision prise : le bon de commande reste FACULTATIF. Réception
-- et facture fonctionnent sans lui.
-- ============================================================

-- ── 1. L'entrepôt destinataire de la commande ─────────────────
-- Nullable : une commande peut être passée sans savoir encore où
-- la marchandise sera rangée ; la réception, elle, tranche.
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- ── 2. Traçabilité des transitions de statut ──────────────────
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS soumis_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS soumis_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS annule_le        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS annule_par       UUID REFERENCES shop_users(id),
    ADD COLUMN IF NOT EXISTS motif_annulation TEXT;

COMMENT ON COLUMN purchase_orders.statut IS
    'brouillon : en préparation · soumis : envoyé au fournisseur · recu_partiel / recu_total : réceptionné · annule.';

-- ── 3. Changement de statut, contrôlé ─────────────────────────
-- p_statut ∈ ('soumis', 'annule'). Les statuts de réception sont
-- posés par enregistrer_reception(), jamais à la main.
CREATE OR REPLACE FUNCTION changer_statut_bon_commande(
    p_shop_id UUID,
    p_po_id   UUID,
    p_statut  TEXT,
    p_user_id UUID,
    p_motif   TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_actuel TEXT;
    v_recu   NUMERIC;
BEGIN
    IF p_statut NOT IN ('soumis', 'annule') THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Seuls les passages à « soumis » et « annulé » se font à la main.');
    END IF;

    SELECT statut INTO v_actuel
    FROM purchase_orders
    WHERE id = p_po_id AND shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Bon de commande introuvable.');
    END IF;

    IF p_statut = 'soumis' THEN
        IF v_actuel <> 'brouillon' THEN
            RETURN jsonb_build_object('succes', false,
                'erreur', 'Seul un bon en brouillon peut être soumis au fournisseur.');
        END IF;

        UPDATE purchase_orders
        SET statut = 'soumis', soumis_le = NOW(), soumis_par = p_user_id, updated_at = NOW()
        WHERE id = p_po_id;

    ELSE
        IF v_actuel IN ('recu_total', 'annule') THEN
            RETURN jsonb_build_object('succes', false,
                'erreur', 'Ce bon de commande est déjà ' ||
                          CASE v_actuel WHEN 'annule' THEN 'annulé.' ELSE 'entièrement reçu.' END);
        END IF;

        -- Une commande déjà servie en partie ne s'annule pas : la
        -- marchandise reçue existe et la dette avec.
        SELECT COALESCE(sum(quantite_recue), 0) INTO v_recu
        FROM purchase_order_items WHERE purchase_order_id = p_po_id;

        IF v_recu > 0 THEN
            RETURN jsonb_build_object('succes', false,
                'erreur', 'Ce bon a déjà fait l''objet d''une réception : il ne peut plus être annulé.');
        END IF;

        UPDATE purchase_orders
        SET statut = 'annule', annule_le = NOW(), annule_par = p_user_id,
            motif_annulation = NULLIF(p_motif, ''), updated_at = NOW()
        WHERE id = p_po_id;
    END IF;

    RETURN jsonb_build_object('succes', true, 'statut', p_statut);
END;
$$ LANGUAGE plpgsql;
