-- ============================================================
-- MIGRATION 013 — Lot 4 : retours (partie stock)
-- ------------------------------------------------------------
-- Les types de mouvement retour_vente et retour_fournisseur
-- existaient dans la contrainte, s'affichaient dans trois écrans
-- avec leur libellé et leur couleur, et étaient comptés dans le
-- rapport — mais AUCUNE ligne de code n'en créait. La marchandise
-- rendue par un client restait sortie du stock, et un retour
-- fournisseur n'existait nulle part.
--
-- Cette migration traite la PARTIE STOCK :
--   • retour client  → la marchandise revient en stock ;
--   • retour fournisseur → la marchandise quitte le stock.
-- Le volet financier (avoir client, dette fournisseur) reste au
-- module Facturation / Fournisseurs : le montant est enregistré,
-- aucun solde n'est touché ici.
-- ============================================================

-- ── 1. Un retour fournisseur sort d'un entrepôt précis ────────
ALTER TABLE supplier_returns
    ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id),
    ADD COLUMN IF NOT EXISTS note         TEXT;

-- ── 2. Retours clients ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_returns (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id    TEXT NOT NULL,
    shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    sale_id      UUID REFERENCES sales(id),
    client_id    UUID REFERENCES clients(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    motif        TEXT NOT NULL,
    montant      NUMERIC(15,2) NOT NULL DEFAULT 0,
    -- Le remboursement (avoir, remise en caisse, geste commercial)
    -- est traité au module Facturation : ici on ne fait que le noter.
    reglement    TEXT NOT NULL DEFAULT 'a_traiter'
        CHECK (reglement IN ('a_traiter', 'avoir', 'rembourse', 'sans_suite')),
    note         TEXT,
    created_by   UUID REFERENCES shop_users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, public_id)
);

CREATE TABLE IF NOT EXISTS sale_return_items (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id        UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    sale_return_id UUID NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products(id),
    quantite       NUMERIC(15,3) NOT NULL CHECK (quantite > 0),
    prix_unitaire  NUMERIC(15,2) NOT NULL DEFAULT 0,
    montant_ligne  NUMERIC(15,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_shop_id   ON sale_returns(shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id   ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_ret  ON sale_return_items(sale_return_id);

ALTER TABLE sale_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_return_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_returns') THEN
        CREATE POLICY "sale_returns_isolation" ON sale_returns
            FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_return_items') THEN
        CREATE POLICY "sale_return_items_isolation" ON sale_return_items
            FOR ALL USING (shop_id = (SELECT (auth.jwt()->'user_metadata'->>'shop_id')::uuid));
    END IF;
END $$;

-- ── 3. Retour client : la marchandise revient en stock ────────
-- p_data = { shop_id, warehouse_id, sale_id, client_id, motif,
--            reglement, note, user_id,
--            items: [{ product_id, quantite, prix_unitaire }] }
CREATE OR REPLACE FUNCTION effectuer_retour_vente(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_shop_id   UUID := (p_data->>'shop_id')::UUID;
    v_wh        UUID := (p_data->>'warehouse_id')::UUID;
    v_user_id   UUID := NULLIF(p_data->>'user_id', '')::UUID;
    v_motif     TEXT := NULLIF(p_data->>'motif', '');
    v_pid       TEXT;
    v_retour    UUID;
    v_item      JSONB;
    v_qte       NUMERIC;
    v_prix      NUMERIC;
    v_total     NUMERIC := 0;
    v_res       JSONB;
    v_nb        INTEGER := 0;
BEGIN
    IF v_motif IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Le motif du retour est obligatoire.');
    END IF;

    IF jsonb_array_length(COALESCE(p_data->'items', '[]'::JSONB)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins un article retourné.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_wh AND shop_id = v_shop_id) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    SELECT generate_public_id(v_shop_id, 'RETV') INTO v_pid;

    INSERT INTO sale_returns (
        public_id, shop_id, sale_id, client_id, warehouse_id,
        motif, montant, reglement, note, created_by
    ) VALUES (
        v_pid, v_shop_id,
        NULLIF(p_data->>'sale_id', '')::UUID,
        NULLIF(p_data->>'client_id', '')::UUID,
        v_wh, v_motif, 0,
        COALESCE(NULLIF(p_data->>'reglement', ''), 'a_traiter'),
        NULLIF(p_data->>'note', ''), v_user_id
    ) RETURNING id INTO v_retour;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_qte  := (v_item->>'quantite')::NUMERIC;
        v_prix := COALESCE((v_item->>'prix_unitaire')::NUMERIC, 0);

        IF v_qte IS NULL OR v_qte <= 0 THEN
            RAISE EXCEPTION 'Quantité retournée invalide.';
        END IF;

        -- La marchandise revient en stock.
        v_res := appliquer_mouvement_stock(
            v_shop_id, (v_item->>'product_id')::UUID, v_wh,
            v_qte, 'retour_vente',
            'sale_return', v_retour, v_pid, v_motif, v_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;

        INSERT INTO sale_return_items (
            shop_id, sale_return_id, product_id, quantite, prix_unitaire, montant_ligne
        ) VALUES (
            v_shop_id, v_retour, (v_item->>'product_id')::UUID, v_qte, v_prix, v_qte * v_prix
        );

        v_total := v_total + v_qte * v_prix;
        v_nb    := v_nb + 1;
    END LOOP;

    UPDATE sale_returns SET montant = v_total WHERE id = v_retour;

    RETURN jsonb_build_object(
        'succes', true, 'retour_id', v_retour,
        'public_id', v_pid, 'montant', v_total, 'nb_lignes', v_nb
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ── 4. Retour fournisseur : la marchandise quitte le stock ────
-- p_data = { shop_id, warehouse_id, supplier_id, motif, note,
--            user_id, items: [{ product_id, quantite, prix_unitaire }] }
CREATE OR REPLACE FUNCTION effectuer_retour_fournisseur(p_data JSONB)
RETURNS JSONB AS $$
DECLARE
    v_shop_id   UUID := (p_data->>'shop_id')::UUID;
    v_wh        UUID := (p_data->>'warehouse_id')::UUID;
    v_supplier  UUID := (p_data->>'supplier_id')::UUID;
    v_user_id   UUID := NULLIF(p_data->>'user_id', '')::UUID;
    v_motif     TEXT := NULLIF(p_data->>'motif', '');
    v_pid       TEXT;
    v_retour    UUID;
    v_item      JSONB;
    v_qte       NUMERIC;
    v_prix      NUMERIC;
    v_nom       TEXT;
    v_total     NUMERIC := 0;
    v_res       JSONB;
    v_nb        INTEGER := 0;
BEGIN
    IF v_motif IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Le motif du retour est obligatoire.');
    END IF;

    IF jsonb_array_length(COALESCE(p_data->'items', '[]'::JSONB)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins un article à retourner.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_wh AND shop_id = v_shop_id) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = v_supplier AND shop_id = v_shop_id) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Fournisseur introuvable dans cette boutique.');
    END IF;

    SELECT generate_public_id(v_shop_id, 'RETF') INTO v_pid;

    INSERT INTO supplier_returns (
        public_id, shop_id, supplier_id, warehouse_id, motif, montant, note, created_by
    ) VALUES (
        v_pid, v_shop_id, v_supplier, v_wh, v_motif, 0,
        NULLIF(p_data->>'note', ''), v_user_id
    ) RETURNING id INTO v_retour;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_qte  := (v_item->>'quantite')::NUMERIC;
        v_prix := COALESCE((v_item->>'prix_unitaire')::NUMERIC, 0);

        IF v_qte IS NULL OR v_qte <= 0 THEN
            RAISE EXCEPTION 'Quantité retournée invalide.';
        END IF;

        SELECT nom INTO v_nom FROM products WHERE id = (v_item->>'product_id')::UUID;

        -- La marchandise sort du stock.
        v_res := appliquer_mouvement_stock(
            v_shop_id, (v_item->>'product_id')::UUID, v_wh,
            -v_qte, 'retour_fournisseur',
            'supplier_return', v_retour, v_pid, v_motif, v_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;

        INSERT INTO supplier_return_items (
            shop_id, supplier_return_id, product_id, designation,
            quantite, prix_unitaire, montant_ligne
        ) VALUES (
            v_shop_id, v_retour, (v_item->>'product_id')::UUID,
            COALESCE(v_nom, 'Article'), v_qte, v_prix, v_qte * v_prix
        );

        v_total := v_total + v_qte * v_prix;
        v_nb    := v_nb + 1;
    END LOOP;

    -- Le solde fournisseur n'est PAS touché ici : la dette et l'avoir
    -- fournisseur relèvent du module Fournisseurs.
    UPDATE supplier_returns SET montant = v_total WHERE id = v_retour;

    RETURN jsonb_build_object(
        'succes', true, 'retour_id', v_retour,
        'public_id', v_pid, 'montant', v_total, 'nb_lignes', v_nb
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql;
