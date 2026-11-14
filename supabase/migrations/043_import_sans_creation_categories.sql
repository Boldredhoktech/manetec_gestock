-- ════════════════════════════════════════════════════════════════
-- 043 — Import produits : plus de création automatique de catégories
-- ni de marques (décision du 2026-11-14).
--
-- Une catégorie / marque du fichier qui EXISTE déjà est rattachée ; une
-- inconnue est ignorée et le produit est importé sans : la boutique le
-- classe ensuite depuis la fiche produit. Seule importer_produits change.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.importer_produits(
    p_shop_id UUID, p_lignes JSONB, p_nom_fichier TEXT, p_date DATE,
    p_max_produits INT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_import    imports_donnees;
    l           JSONB;
    v_rejets    JSONB := '[]'::jsonb;
    v_ok        INT := 0;
    v_nb        INT;
    v_cree      INT := 0;
    v_cats      INT := 0;
    v_marques   INT := 0;
    v_prod      products%ROWTYPE;
    v_wh        UUID;
    v_cat       UUID;
    v_marque    UUID;
    v_qte       NUMERIC;
    v_res       JSONB;
    v_ref       TEXT;
    v_cb        TEXT;
BEGIN
    v_import := ouvrir_import(p_shop_id, 'produits', p_nom_fichier, p_date, jsonb_array_length(p_lignes), p_user_id);
    SELECT count(*) INTO v_nb FROM products WHERE shop_id = p_shop_id;

    FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) ORDER BY (value->>'ligne')::INT LOOP
        BEGIN
            v_ref := NULLIF(trim(l->>'reference'), '');
            v_cb  := NULLIF(trim(l->>'code_barres'), '');
            v_qte := NULLIF(l->>'quantite', '')::NUMERIC;

            IF cle_texte(l->>'nom') IS NULL THEN
                RAISE EXCEPTION 'Désignation manquante.';
            END IF;
            IF NULLIF(l->>'prix_vente', '') IS NULL OR (l->>'prix_vente')::NUMERIC < 0 THEN
                RAISE EXCEPTION 'Prix de vente manquant ou négatif.';
            END IF;
            IF v_qte IS NOT NULL AND v_qte < 0 THEN
                RAISE EXCEPTION 'Quantité négative.';
            END IF;

            -- Entrepôt : nommé, sinon celui par défaut.
            v_wh := NULL;
            IF v_qte IS NOT NULL AND v_qte > 0 THEN
                IF cle_texte(l->>'entrepot') IS NOT NULL THEN
                    SELECT id INTO v_wh FROM warehouses
                     WHERE shop_id = p_shop_id AND est_actif AND cle_texte(nom) = cle_texte(l->>'entrepot') LIMIT 1;
                    IF v_wh IS NULL THEN
                        RAISE EXCEPTION 'Entrepôt « % » inconnu.', trim(l->>'entrepot');
                    END IF;
                ELSE
                    SELECT id INTO v_wh FROM warehouses
                     WHERE shop_id = p_shop_id AND est_actif ORDER BY est_defaut DESC, created_at LIMIT 1;
                    IF v_wh IS NULL THEN
                        RAISE EXCEPTION 'Aucun entrepôt : créez-en un avant d''importer du stock.';
                    END IF;
                END IF;
            END IF;

            -- Le produit existe-t-il ? Référence, sinon code-barres, sinon nom.
            v_prod := NULL;
            IF v_ref IS NOT NULL THEN
                SELECT * INTO v_prod FROM products WHERE shop_id = p_shop_id AND lower(sku) = lower(v_ref) LIMIT 1;
            END IF;
            IF v_prod.id IS NULL AND v_cb IS NOT NULL THEN
                SELECT * INTO v_prod FROM products WHERE shop_id = p_shop_id AND code_barres = v_cb LIMIT 1;
            END IF;
            IF v_prod.id IS NULL THEN
                SELECT * INTO v_prod FROM products WHERE shop_id = p_shop_id AND cle_texte(nom) = cle_texte(l->>'nom') LIMIT 1;
            END IF;

            IF v_prod.id IS NOT NULL AND v_prod.import_id IS DISTINCT FROM v_import.id THEN
                RAISE EXCEPTION 'Existe déjà (%) : ligne ignorée.', v_prod.public_id;
            END IF;

            IF v_prod.id IS NULL THEN
                IF p_max_produits >= 0 AND v_nb >= p_max_produits THEN
                    RAISE EXCEPTION 'Quota du forfait atteint (% produits).', p_max_produits;
                END IF;

                -- Catégorie et marque : rattachées si elles EXISTENT déjà ;
                -- sinon le produit est importé sans, et la boutique le
                -- classe ensuite elle-même (décision du 14/11 : plus de
                -- création automatique).
                v_cat := NULL;
                IF cle_texte(l->>'categorie') IS NOT NULL THEN
                    SELECT id INTO v_cat FROM categories WHERE shop_id = p_shop_id AND cle_texte(nom) = cle_texte(l->>'categorie') LIMIT 1;
                    IF v_cat IS NULL THEN v_cats := v_cats + 1; END IF;
                END IF;
                v_marque := NULL;
                IF cle_texte(l->>'marque') IS NOT NULL THEN
                    SELECT id INTO v_marque FROM brands WHERE shop_id = p_shop_id AND cle_texte(nom) = cle_texte(l->>'marque') LIMIT 1;
                    IF v_marque IS NULL THEN v_marques := v_marques + 1; END IF;
                END IF;

                INSERT INTO products (
                    public_id, shop_id, nom, prix_vente, sku, code_barres, category_id, brand_id,
                    prix_achat, prix_gros, prix_minimum, tva_pct, unite, seuil_alerte,
                    necessite_imei, necessite_serie, import_id, created_by
                ) VALUES (
                    prochain_numero(p_shop_id, 'ITM'), p_shop_id, trim(l->>'nom'), (l->>'prix_vente')::NUMERIC,
                    v_ref, v_cb, v_cat, v_marque,
                    COALESCE(NULLIF(l->>'prix_achat', '')::NUMERIC, 0),
                    NULLIF(l->>'prix_gros', '')::NUMERIC,
                    NULLIF(l->>'prix_minimum', '')::NUMERIC,
                    COALESCE(NULLIF(l->>'tva_pct', '')::NUMERIC, 0),
                    COALESCE(NULLIF(trim(l->>'unite'), ''), 'pièce'),
                    COALESCE(NULLIF(l->>'seuil_alerte', '')::INT, 0),
                    COALESCE((l->>'imei')::BOOLEAN, FALSE),
                    COALESCE((l->>'serie')::BOOLEAN, FALSE),
                    v_import.id, p_user_id
                ) RETURNING * INTO v_prod;
                v_nb := v_nb + 1;
                v_cree := v_cree + 1;
            END IF;

            IF v_wh IS NOT NULL THEN
                v_res := appliquer_mouvement_stock(
                    p_shop_id, v_prod.id, v_wh, v_qte, 'entree_initiale',
                    'import', v_import.id, v_import.public_id,
                    'Stock d''ouverture au ' || to_char(v_import.date_demarrage, 'DD/MM/YYYY') || ' (import ' || v_import.public_id || ')',
                    p_user_id, FALSE);
                IF NOT COALESCE((v_res->>'succes')::BOOLEAN, FALSE) THEN
                    RAISE EXCEPTION '%', COALESCE(v_res->>'erreur', 'Stock refusé.');
                END IF;
            END IF;

            v_ok := v_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            v_rejets := v_rejets || jsonb_build_object('ligne', (l->>'ligne')::INT, 'nom', l->>'nom', 'motif', motif_rejet(SQLERRM), 'donnees', l);
        END;
    END LOOP;

    UPDATE imports_donnees SET nb_importees = v_ok, nb_rejetees = jsonb_array_length(v_rejets), rejets = v_rejets
     WHERE id = v_import.id;

    RETURN jsonb_build_object('succes', true, 'id', v_import.id, 'public_id', v_import.public_id,
        'date_demarrage', v_import.date_demarrage, 'importees', v_ok, 'produits_crees', v_cree,
        'categories_inconnues', v_cats, 'marques_inconnues', v_marques, 'rejets', v_rejets);
END;
$$;

