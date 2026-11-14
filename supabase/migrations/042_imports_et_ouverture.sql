-- ════════════════════════════════════════════════════════════════
-- 042 — Imports Excel et soldes d'ouverture
--
-- Une boutique qui arrive avec un historique reprend en une fois :
--   • ses PRODUITS et leur stock d'ouverture (par entrepôt) ;
--   • ses CLIENTS et ce qu'ils lui doivent / ont déjà versé ;
--   • ses FOURNISSEURS et ce qu'elle leur doit.
--
-- Décisions (2026-11-14) :
--   • obligatoire : produit = nom + prix de vente ; client = nom ;
--     fournisseur = nom. Tout le reste est facultatif ;
--   • un élément qui existe déjà est IGNORÉ (ligne rejetée, motif donné) :
--     produit = même référence, sinon même code-barres, sinon même nom ;
--     client = même téléphone (sinon même nom) ; fournisseur = même nom ;
--   • les bonnes lignes passent, les autres sont listées ;
--   • catégories et marques inconnues : créées ;
--   • une DATE DE DÉMARRAGE unique par boutique ; créance client et dette
--     fournisseur = FACTURE D'OUVERTURE à cette date, réglable comme les
--     autres, mais hors chiffre d'affaires et hors achats (est_ouverture) ;
--   • le stock d'ouverture est un mouvement « entree_initiale » ;
--   • quota du forfait bloquant ;
--   • un import entier s'ANNULE tant que rien de ce qu'il a créé n'a servi.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Clé de comparaison : minuscules, sans accents, espaces réduits ──
CREATE OR REPLACE FUNCTION public.cle_texte(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT NULLIF(regexp_replace(lower(translate(trim(coalesce(p, '')),
        'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ',
        'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy')), '\s+', ' ', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.cle_telephone(p TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    -- Les 8 derniers chiffres : « +229 01 97 00 00 01 » et « 97000001 » se reconnaissent.
    SELECT NULLIF(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 8), '')
$$;

-- ── 2. Date de démarrage, marqueur d'ouverture ──────────────────
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS date_demarrage DATE;
COMMENT ON COLUMN public.shops.date_demarrage IS
    'Date à laquelle la boutique a démarré sur Manetec : stock, créances et dettes d''ouverture y sont datés (imports, mig 042).';

ALTER TABLE public.factures              ADD COLUMN IF NOT EXISTS est_ouverture BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.factures_fournisseurs ADD COLUMN IF NOT EXISTS est_ouverture BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN public.factures.est_ouverture IS
    'Solde d''ouverture d''un client (import) : réglable normalement, mais ce n''est pas une vente de la période.';
COMMENT ON COLUMN public.factures_fournisseurs.est_ouverture IS
    'Dette d''ouverture envers un fournisseur (import) : réglable normalement, mais ce n''est pas un achat de la période.';

-- L'avance d'ouverture d'un client est une opération de solde à part.
ALTER TABLE public.client_balance_operations DROP CONSTRAINT IF EXISTS client_balance_operations_type_operation_check;
ALTER TABLE public.client_balance_operations ADD CONSTRAINT client_balance_operations_type_operation_check
    CHECK (type_operation = ANY (ARRAY['credit_remboursement', 'credit_utilisation', 'advance_depot',
        'advance_utilisation', 'change_depot', 'change_utilisation', 'avoir_facture', 'vente_credit',
        'vente_avance', 'vente_monnaie', 'regularisation', 'ouverture']));

-- ── 3. Journal des imports ──────────────────────────────────────
CREATE TABLE public.imports_donnees (
    id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    public_id         TEXT NOT NULL,
    shop_id           UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    type              TEXT NOT NULL CHECK (type IN ('produits', 'clients', 'fournisseurs')),
    nom_fichier       TEXT,
    date_demarrage    DATE NOT NULL,
    nb_lignes         INTEGER NOT NULL DEFAULT 0,
    nb_importees      INTEGER NOT NULL DEFAULT 0,
    nb_rejetees       INTEGER NOT NULL DEFAULT 0,
    rejets            JSONB NOT NULL DEFAULT '[]'::jsonb,
    statut            TEXT NOT NULL DEFAULT 'valide' CHECK (statut IN ('valide', 'annule')),
    annule_le         TIMESTAMPTZ,
    annule_par        UUID,
    motif_annulation  TEXT,
    created_by        UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT imports_donnees_public_id_key UNIQUE (shop_id, public_id)
);

ALTER TABLE public.imports_donnees ENABLE ROW LEVEL SECURITY;
CREATE POLICY imports_donnees_isolation ON public.imports_donnees
    USING (shop_id = (SELECT ((auth.jwt() -> 'user_metadata') ->> 'shop_id')::uuid));
CREATE POLICY licence_en_service ON public.imports_donnees AS RESTRICTIVE
    USING ((SELECT public.session_boutique_en_service()))
    WITH CHECK ((SELECT public.session_boutique_en_service()));

COMMENT ON TABLE public.imports_donnees IS
    'Chaque import Excel : quoi, quand, par qui, combien de lignes passées ou rejetées (et pourquoi). Ce qu''il a créé porte son import_id.';

-- Ce qu'un import a créé (pour pouvoir l'annuler).
ALTER TABLE public.products              ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
ALTER TABLE public.categories            ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
ALTER TABLE public.brands                ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
ALTER TABLE public.clients               ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers             ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
ALTER TABLE public.factures              ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
ALTER TABLE public.factures_fournisseurs ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports_donnees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_import_idx  ON public.products (import_id)  WHERE import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_import_idx   ON public.clients (import_id)   WHERE import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_import_idx ON public.suppliers (import_id) WHERE import_id IS NOT NULL;

-- ── 4. Préparation commune ──────────────────────────────────────
-- Crée l'import, fixe la date de démarrage de la boutique si elle ne
-- l'est pas encore (sinon c'est elle qui s'impose).
CREATE OR REPLACE FUNCTION public.ouvrir_import(
    p_shop_id UUID, p_type TEXT, p_nom_fichier TEXT, p_date DATE, p_nb_lignes INT, p_user_id UUID
) RETURNS imports_donnees
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_date   DATE;
    v_import imports_donnees;
BEGIN
    SELECT date_demarrage INTO v_date FROM shops WHERE id = p_shop_id FOR UPDATE;
    IF v_date IS NULL THEN
        v_date := COALESCE(p_date, CURRENT_DATE);
        IF v_date > CURRENT_DATE THEN
            RAISE EXCEPTION 'La date de démarrage ne peut pas être dans le futur.';
        END IF;
        UPDATE shops SET date_demarrage = v_date WHERE id = p_shop_id;
    END IF;

    INSERT INTO imports_donnees (public_id, shop_id, type, nom_fichier, date_demarrage, nb_lignes, created_by)
    VALUES (prochain_numero(p_shop_id, 'IMP'), p_shop_id, p_type, NULLIF(trim(p_nom_fichier), ''), v_date, p_nb_lignes, p_user_id)
    RETURNING * INTO v_import;
    RETURN v_import;
END;
$$;

-- Message d'erreur lisible pour une ligne rejetée.
CREATE OR REPLACE FUNCTION public.motif_rejet(p_message TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_message LIKE '%duplicate key%' THEN 'Existe déjà (doublon).'
        WHEN p_message LIKE '%violates check constraint%' THEN 'Valeur refusée par la base (vérifiez les nombres et les champs oui/non).'
        WHEN p_message LIKE '%invalid input syntax%' THEN 'Valeur mal écrite (un nombre ou une date attendu).'
        ELSE left(p_message, 200)
    END
$$;

-- ── 5. Produits et stock d'ouverture ────────────────────────────
-- p_lignes : [{ligne, nom, prix_vente, reference?, code_barres?, categorie?,
--   marque?, prix_achat?, prix_gros?, prix_minimum?, tva_pct?, unite?,
--   seuil_alerte?, imei?, serie?, entrepot?, quantite?}]
-- Plusieurs lignes pour le même produit = son stock dans plusieurs entrepôts.
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

                v_cat := NULL;
                IF cle_texte(l->>'categorie') IS NOT NULL THEN
                    SELECT id INTO v_cat FROM categories WHERE shop_id = p_shop_id AND cle_texte(nom) = cle_texte(l->>'categorie') LIMIT 1;
                    IF v_cat IS NULL THEN
                        INSERT INTO categories (public_id, shop_id, nom, import_id)
                        VALUES (prochain_numero(p_shop_id, 'CAT'), p_shop_id, trim(l->>'categorie'), v_import.id)
                        RETURNING id INTO v_cat;
                        v_cats := v_cats + 1;
                    END IF;
                END IF;
                v_marque := NULL;
                IF cle_texte(l->>'marque') IS NOT NULL THEN
                    SELECT id INTO v_marque FROM brands WHERE shop_id = p_shop_id AND cle_texte(nom) = cle_texte(l->>'marque') LIMIT 1;
                    IF v_marque IS NULL THEN
                        INSERT INTO brands (public_id, shop_id, nom, import_id)
                        VALUES (prochain_numero(p_shop_id, 'BRD'), p_shop_id, trim(l->>'marque'), v_import.id)
                        RETURNING id INTO v_marque;
                        v_marques := v_marques + 1;
                    END IF;
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
        'categories_creees', v_cats, 'marques_creees', v_marques, 'rejets', v_rejets);
END;
$$;

-- ── 6. Clients, créances et avances d'ouverture ─────────────────
-- p_lignes : [{ligne, nom, telephone?, email?, adresse?, ville?, ifu?, rccm?,
--   plafond_credit?, montant_du?, avance?}]
CREATE OR REPLACE FUNCTION public.importer_clients(
    p_shop_id UUID, p_lignes JSONB, p_nom_fichier TEXT, p_date DATE,
    p_max_clients INT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_import  imports_donnees;
    l         JSONB;
    v_rejets  JSONB := '[]'::jsonb;
    v_ok      INT := 0;
    v_nb      INT;
    v_existe  TEXT;
    v_client  UUID;
    v_du      NUMERIC;
    v_avance  NUMERIC;
    v_res     JSONB;
    v_creances NUMERIC := 0;
    v_avances  NUMERIC := 0;
BEGIN
    v_import := ouvrir_import(p_shop_id, 'clients', p_nom_fichier, p_date, jsonb_array_length(p_lignes), p_user_id);
    SELECT count(*) INTO v_nb FROM clients WHERE shop_id = p_shop_id AND NOT est_anonyme;

    FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) ORDER BY (value->>'ligne')::INT LOOP
        BEGIN
            v_du     := COALESCE(NULLIF(l->>'montant_du', '')::NUMERIC, 0);
            v_avance := COALESCE(NULLIF(l->>'avance', '')::NUMERIC, 0);
            IF cle_texte(l->>'nom') IS NULL THEN RAISE EXCEPTION 'Nom manquant.'; END IF;
            IF v_du < 0 OR v_avance < 0 THEN RAISE EXCEPTION 'Montant négatif.'; END IF;

            v_existe := NULL;
            IF cle_telephone(l->>'telephone') IS NOT NULL THEN
                SELECT public_id INTO v_existe FROM clients
                 WHERE shop_id = p_shop_id AND cle_telephone(telephone) = cle_telephone(l->>'telephone') LIMIT 1;
            ELSE
                SELECT public_id INTO v_existe FROM clients
                 WHERE shop_id = p_shop_id AND NOT est_anonyme AND cle_texte(nom) = cle_texte(l->>'nom') LIMIT 1;
            END IF;
            IF v_existe IS NOT NULL THEN
                RAISE EXCEPTION 'Existe déjà (%) : ligne ignorée.', v_existe;
            END IF;
            IF p_max_clients >= 0 AND v_nb >= p_max_clients THEN
                RAISE EXCEPTION 'Quota du forfait atteint (% clients).', p_max_clients;
            END IF;

            INSERT INTO clients (public_id, shop_id, nom, telephone, email, adresse, ville, ifu, rccm,
                                 plafond_credit, import_id, created_by)
            VALUES (prochain_numero(p_shop_id, 'CLI'), p_shop_id, trim(l->>'nom'),
                    NULLIF(trim(l->>'telephone'), ''), NULLIF(trim(l->>'email'), ''),
                    NULLIF(trim(l->>'adresse'), ''), NULLIF(trim(l->>'ville'), ''),
                    NULLIF(trim(l->>'ifu'), ''), NULLIF(trim(l->>'rccm'), ''),
                    COALESCE(NULLIF(l->>'plafond_credit', '')::NUMERIC, 0), v_import.id, p_user_id)
            RETURNING id INTO v_client;
            v_nb := v_nb + 1;

            IF v_du > 0 THEN
                INSERT INTO factures (public_id, shop_id, client_id, statut, date_facture, date_echeance, objet,
                                      montant_ht, montant_tva, montant_ttc, montant_paye, montant_restant,
                                      note_interne, est_ouverture, import_id, created_by)
                VALUES (prochain_numero(p_shop_id, 'FACT'), p_shop_id, v_client, 'emise',
                        v_import.date_demarrage, v_import.date_demarrage, 'Solde d''ouverture',
                        v_du, 0, v_du, 0, v_du,
                        'Créance reprise à l''ouverture (import ' || v_import.public_id || ').',
                        TRUE, v_import.id, p_user_id);
                v_creances := v_creances + v_du;
            END IF;

            IF v_avance > 0 THEN
                v_res := appliquer_mouvement_solde_client(p_shop_id, v_client, 'advance_balance', v_avance, 'ouverture',
                    'Avance reprise à l''ouverture (import ' || v_import.public_id || ')', p_user_id);
                IF NOT COALESCE((v_res->>'succes')::BOOLEAN, FALSE) THEN
                    RAISE EXCEPTION '%', COALESCE(v_res->>'erreur', 'Avance refusée.');
                END IF;
                v_avances := v_avances + v_avance;
            END IF;

            v_ok := v_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            v_rejets := v_rejets || jsonb_build_object('ligne', (l->>'ligne')::INT, 'nom', l->>'nom', 'motif', motif_rejet(SQLERRM), 'donnees', l);
        END;
    END LOOP;

    UPDATE imports_donnees SET nb_importees = v_ok, nb_rejetees = jsonb_array_length(v_rejets), rejets = v_rejets
     WHERE id = v_import.id;

    RETURN jsonb_build_object('succes', true, 'id', v_import.id, 'public_id', v_import.public_id,
        'date_demarrage', v_import.date_demarrage, 'importees', v_ok,
        'creances', v_creances, 'avances', v_avances, 'rejets', v_rejets);
END;
$$;

-- ── 7. Fournisseurs et dettes d'ouverture ───────────────────────
-- p_lignes : [{ligne, nom, nom_contact?, poste_contact?, telephone?, email?,
--   adresse?, ville?, pays?, ifu?, rccm?, montant_du?}]
CREATE OR REPLACE FUNCTION public.importer_fournisseurs(
    p_shop_id UUID, p_lignes JSONB, p_nom_fichier TEXT, p_date DATE, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_import  imports_donnees;
    l         JSONB;
    v_rejets  JSONB := '[]'::jsonb;
    v_ok      INT := 0;
    v_existe  TEXT;
    v_fourn   UUID;
    v_du      NUMERIC;
    v_dettes  NUMERIC := 0;
BEGIN
    v_import := ouvrir_import(p_shop_id, 'fournisseurs', p_nom_fichier, p_date, jsonb_array_length(p_lignes), p_user_id);

    FOR l IN SELECT * FROM jsonb_array_elements(p_lignes) ORDER BY (value->>'ligne')::INT LOOP
        BEGIN
            v_du := COALESCE(NULLIF(l->>'montant_du', '')::NUMERIC, 0);
            IF cle_texte(l->>'nom') IS NULL THEN RAISE EXCEPTION 'Nom manquant.'; END IF;
            IF v_du < 0 THEN RAISE EXCEPTION 'Montant négatif.'; END IF;

            SELECT public_id INTO v_existe FROM suppliers
             WHERE shop_id = p_shop_id AND cle_texte(nom) = cle_texte(l->>'nom') LIMIT 1;
            IF v_existe IS NOT NULL THEN
                RAISE EXCEPTION 'Existe déjà (%) : ligne ignorée.', v_existe;
            END IF;

            INSERT INTO suppliers (public_id, shop_id, nom, nom_contact, poste_contact, telephone, email,
                                   adresse, ville, pays, ifu, rccm, "solde_dû", import_id)
            VALUES (prochain_numero(p_shop_id, 'SUP'), p_shop_id, trim(l->>'nom'),
                    NULLIF(trim(l->>'nom_contact'), ''), NULLIF(trim(l->>'poste_contact'), ''),
                    NULLIF(trim(l->>'telephone'), ''), NULLIF(trim(l->>'email'), ''),
                    NULLIF(trim(l->>'adresse'), ''), NULLIF(trim(l->>'ville'), ''),
                    NULLIF(trim(l->>'pays'), ''), NULLIF(trim(l->>'ifu'), ''), NULLIF(trim(l->>'rccm'), ''),
                    v_du, v_import.id)
            RETURNING id INTO v_fourn;

            IF v_du > 0 THEN
                INSERT INTO factures_fournisseurs (public_id, shop_id, supplier_id, statut, date_facture, date_echeance,
                                                   reference_fourn, montant_ht, montant_tva, montant_ttc,
                                                   montant_paye, montant_restant, notes, a_completer,
                                                   est_ouverture, import_id, created_by)
                VALUES (prochain_numero(p_shop_id, 'FF'), p_shop_id, v_fourn, 'non_payee',
                        v_import.date_demarrage, v_import.date_demarrage, 'Solde d''ouverture',
                        v_du, 0, v_du, 0, v_du,
                        'Dette reprise à l''ouverture (import ' || v_import.public_id || ').', FALSE,
                        TRUE, v_import.id, p_user_id);
                v_dettes := v_dettes + v_du;
            END IF;

            v_ok := v_ok + 1;
        EXCEPTION WHEN OTHERS THEN
            v_rejets := v_rejets || jsonb_build_object('ligne', (l->>'ligne')::INT, 'nom', l->>'nom', 'motif', motif_rejet(SQLERRM), 'donnees', l);
        END;
    END LOOP;

    UPDATE imports_donnees SET nb_importees = v_ok, nb_rejetees = jsonb_array_length(v_rejets), rejets = v_rejets
     WHERE id = v_import.id;

    RETURN jsonb_build_object('succes', true, 'id', v_import.id, 'public_id', v_import.public_id,
        'date_demarrage', v_import.date_demarrage, 'importees', v_ok, 'dettes', v_dettes, 'rejets', v_rejets);
END;
$$;

-- ── 8. Annuler un import, tant que rien n'a servi ───────────────
CREATE OR REPLACE FUNCTION public.annuler_import(
    p_shop_id UUID, p_import_id UUID, p_motif TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_import imports_donnees;
    v_ids    UUID[];
    v_sert   TEXT;
BEGIN
    IF NULLIF(trim(p_motif), '') IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Indiquez le motif de l''annulation.');
    END IF;
    SELECT * INTO v_import FROM imports_donnees WHERE id = p_import_id AND shop_id = p_shop_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Import introuvable.'); END IF;
    IF v_import.statut = 'annule' THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Cet import est déjà annulé.'); END IF;

    IF v_import.type = 'produits' THEN
        SELECT array_agg(id) INTO v_ids FROM products WHERE import_id = p_import_id;
        v_ids := COALESCE(v_ids, '{}');
        SELECT CASE
            WHEN EXISTS (SELECT 1 FROM sale_items WHERE product_id = ANY(v_ids)) THEN 'des produits ont été vendus'
            WHEN EXISTS (SELECT 1 FROM facture_items WHERE product_id = ANY(v_ids)) THEN 'des produits figurent sur une facture'
            WHEN EXISTS (SELECT 1 FROM devis_items WHERE product_id = ANY(v_ids)) THEN 'des produits figurent sur un devis'
            WHEN EXISTS (SELECT 1 FROM purchase_order_items WHERE product_id = ANY(v_ids)) THEN 'des produits figurent sur un bon de commande'
            WHEN EXISTS (SELECT 1 FROM facture_fournisseur_items WHERE product_id = ANY(v_ids)) THEN 'des produits figurent sur une facture fournisseur'
            WHEN EXISTS (SELECT 1 FROM inventory_items WHERE product_id = ANY(v_ids)) THEN 'des produits ont été inventoriés'
            WHEN EXISTS (SELECT 1 FROM stock_movements WHERE product_id = ANY(v_ids)
                          AND reference_id IS DISTINCT FROM p_import_id) THEN 'le stock de ces produits a bougé depuis'
            ELSE NULL END INTO v_sert;
        IF v_sert IS NOT NULL THEN
            RETURN jsonb_build_object('succes', false, 'erreur', 'Annulation impossible : ' || v_sert || '.');
        END IF;
        DELETE FROM stock_movements WHERE product_id = ANY(v_ids) AND reference_id = p_import_id;
        DELETE FROM products WHERE id = ANY(v_ids);
        DELETE FROM categories c WHERE c.import_id = p_import_id
           AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id)
           AND NOT EXISTS (SELECT 1 FROM categories e WHERE e.parent_id = c.id);
        DELETE FROM brands b WHERE b.import_id = p_import_id
           AND NOT EXISTS (SELECT 1 FROM products p WHERE p.brand_id = b.id);

    ELSIF v_import.type = 'clients' THEN
        SELECT array_agg(id) INTO v_ids FROM clients WHERE import_id = p_import_id;
        v_ids := COALESCE(v_ids, '{}');
        SELECT CASE
            WHEN EXISTS (SELECT 1 FROM sales WHERE client_id = ANY(v_ids)) THEN 'des clients ont acheté depuis'
            WHEN EXISTS (SELECT 1 FROM devis WHERE client_id = ANY(v_ids)) THEN 'des clients ont un devis'
            WHEN EXISTS (SELECT 1 FROM sale_returns WHERE client_id = ANY(v_ids)) THEN 'des clients ont un retour'
            WHEN EXISTS (SELECT 1 FROM factures WHERE client_id = ANY(v_ids)
                          AND import_id IS DISTINCT FROM p_import_id) THEN 'des clients ont une autre facture'
            WHEN EXISTS (SELECT 1 FROM facture_payments fp JOIN factures f ON f.id = fp.facture_id
                          WHERE f.import_id = p_import_id) THEN 'une créance d''ouverture a reçu un règlement'
            WHEN EXISTS (SELECT 1 FROM avoirs a JOIN factures f ON f.id = a.facture_id
                          WHERE f.import_id = p_import_id) THEN 'une créance d''ouverture a reçu un avoir'
            WHEN EXISTS (SELECT 1 FROM client_balance_operations WHERE client_id = ANY(v_ids)
                          AND type_operation <> 'ouverture') THEN 'le solde d''un client a bougé depuis'
            ELSE NULL END INTO v_sert;
        IF v_sert IS NOT NULL THEN
            RETURN jsonb_build_object('succes', false, 'erreur', 'Annulation impossible : ' || v_sert || '.');
        END IF;
        DELETE FROM factures WHERE import_id = p_import_id;
        DELETE FROM clients WHERE id = ANY(v_ids);

    ELSE
        SELECT array_agg(id) INTO v_ids FROM suppliers WHERE import_id = p_import_id;
        v_ids := COALESCE(v_ids, '{}');
        SELECT CASE
            WHEN EXISTS (SELECT 1 FROM supplier_payments WHERE supplier_id = ANY(v_ids)) THEN 'un fournisseur a été payé'
            WHEN EXISTS (SELECT 1 FROM factures_fournisseurs WHERE supplier_id = ANY(v_ids)
                          AND import_id IS DISTINCT FROM p_import_id) THEN 'un fournisseur a une autre facture'
            WHEN EXISTS (SELECT 1 FROM purchase_orders WHERE supplier_id = ANY(v_ids)) THEN 'un fournisseur a un bon de commande'
            WHEN EXISTS (SELECT 1 FROM receptions WHERE supplier_id = ANY(v_ids)) THEN 'un fournisseur a une réception'
            WHEN EXISTS (SELECT 1 FROM supplier_returns WHERE supplier_id = ANY(v_ids)) THEN 'un fournisseur a un retour'
            ELSE NULL END INTO v_sert;
        IF v_sert IS NOT NULL THEN
            RETURN jsonb_build_object('succes', false, 'erreur', 'Annulation impossible : ' || v_sert || '.');
        END IF;
        DELETE FROM factures_fournisseurs WHERE import_id = p_import_id;
        DELETE FROM suppliers WHERE id = ANY(v_ids);
    END IF;

    UPDATE imports_donnees
       SET statut = 'annule', annule_le = NOW(), annule_par = p_user_id, motif_annulation = trim(p_motif)
     WHERE id = p_import_id;

    RETURN jsonb_build_object('succes', true, 'supprimes', COALESCE(array_length(v_ids, 1), 0));
END;
$$;

-- Compteur IMP pour les boutiques existantes (prochain_numero le crée sinon).
INSERT INTO public.public_id_counters (shop_id, prefix, last_value)
SELECT id, 'IMP', 0 FROM public.shops
ON CONFLICT (shop_id, prefix) DO NOTHING;
