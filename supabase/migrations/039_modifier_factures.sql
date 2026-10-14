-- ═══════════════════════════════════════════════════════════════
-- 039 — Corriger une facture tant que rien n'est réglé
--
-- Demande du 2026-10-14 : ni la facture client ni la facture
-- fournisseur ne se modifiaient. Côté fournisseur, c'était bloquant :
-- une réception sans facture crée une facture « à compléter » que
-- rien ne permettait de compléter.
--
-- Décisions de l'utilisateur :
--   • Facture CLIENT : modifiable (client, objet, échéance, remise,
--     note, lignes) en gardant son numéro, tant qu'aucun règlement ni
--     avoir n'existe. Chaque modification est tracée (audit_logs).
--   • Facture FOURNISSEUR : modifiable tant qu'aucun paiement n'existe.
--     Si la marchandise est déjà entrée en stock (réception liée), les
--     quantités par produit ne changent pas : elles se corrigent par un
--     retour fournisseur ou un ajustement, qui laissent leur trace.
--
-- Les montants des lignes sont calculés par l'application (mêmes
-- règles qu'à la création) ; ces fonctions gardent les verrous, les
-- contrôles et la cohérence des totaux, en une seule transaction.
-- ═══════════════════════════════════════════════════════════════

-- 1. Règle F1 : une facture client devient intouchable à son premier
--    règlement ou avoir, plus à sa création. (Le déclencheur comparait
--    aussi client_id avec != : un passage de NULL à un client lui
--    échappait.)
CREATE OR REPLACE FUNCTION public.check_facture_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.est_immutable = TRUE
       AND (NEW.montant_ht  IS DISTINCT FROM OLD.montant_ht
         OR NEW.montant_ttc IS DISTINCT FROM OLD.montant_ttc
         OR NEW.client_id   IS DISTINCT FROM OLD.client_id)
       AND (EXISTS (SELECT 1 FROM facture_payments
                     WHERE facture_id = OLD.id AND NOT est_annule)
         OR EXISTS (SELECT 1 FROM avoirs WHERE facture_id = OLD.id))
    THEN
        RAISE EXCEPTION 'Cette facture a déjà reçu un règlement ou un avoir : elle ne peut plus être modifiée (règle F1)';
    END IF;
    RETURN NEW;
END;
$function$;

-- 2. Modifier une facture client.
--    p_entete : client_id, objet, date_echeance, remise_pct, remise_val,
--               note_client, montant_ht, montant_tva, montant_ttc
--    p_lignes : [{product_id, designation, quantite, prix_unitaire,
--                 remise_pct, remise_val, montant_ht, tva_pct,
--                 montant_tva, montant_ttc}]
CREATE OR REPLACE FUNCTION public.modifier_facture(
    p_shop_id uuid, p_facture_id uuid, p_entete jsonb, p_lignes jsonb,
    p_user_id uuid, p_user_nom text
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_avant   RECORD;
    v_client  UUID := NULLIF(p_entete->>'client_id', '')::uuid;
BEGIN
    SELECT * INTO v_avant FROM factures
     WHERE id = p_facture_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;
    IF v_avant.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Une facture annulée ne se modifie pas.');
    END IF;
    IF EXISTS (SELECT 1 FROM facture_payments WHERE facture_id = p_facture_id AND NOT est_annule) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Cette facture a déjà reçu un règlement : elle ne se modifie plus. Annulez d''abord le règlement, ou émettez un avoir.');
    END IF;
    IF EXISTS (SELECT 1 FROM avoirs WHERE facture_id = p_facture_id) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Un avoir a été émis sur cette facture : elle ne se modifie plus.');
    END IF;
    IF jsonb_array_length(COALESCE(p_lignes, '[]'::jsonb)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;
    IF v_client IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM clients WHERE id = v_client AND shop_id = p_shop_id
    ) THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Client introuvable dans cette boutique.');
    END IF;

    DELETE FROM facture_items WHERE facture_id = p_facture_id;

    INSERT INTO facture_items (
        shop_id, facture_id, product_id, designation, quantite, prix_unitaire,
        remise_pct, remise_val, montant_ht, tva_pct, montant_tva, montant_ttc, ordre
    )
    SELECT p_shop_id, p_facture_id,
           NULLIF(l->>'product_id', '')::uuid,
           l->>'designation',
           (l->>'quantite')::numeric, (l->>'prix_unitaire')::numeric,
           COALESCE((l->>'remise_pct')::numeric, 0), COALESCE((l->>'remise_val')::numeric, 0),
           (l->>'montant_ht')::numeric,
           COALESCE((l->>'tva_pct')::numeric, 0), COALESCE((l->>'montant_tva')::numeric, 0),
           (l->>'montant_ttc')::numeric,
           (o - 1)::integer
      FROM jsonb_array_elements(p_lignes) WITH ORDINALITY AS t(l, o);

    UPDATE factures SET
        client_id       = v_client,
        objet           = NULLIF(p_entete->>'objet', ''),
        date_echeance   = NULLIF(p_entete->>'date_echeance', '')::date,
        remise_pct      = COALESCE((p_entete->>'remise_pct')::numeric, 0),
        remise_val      = COALESCE((p_entete->>'remise_val')::numeric, 0),
        note_client     = NULLIF(p_entete->>'note_client', ''),
        montant_ht      = (p_entete->>'montant_ht')::numeric,
        montant_tva     = (p_entete->>'montant_tva')::numeric,
        montant_ttc     = (p_entete->>'montant_ttc')::numeric
     WHERE id = p_facture_id;

    -- Le seul endroit qui décide de montant_paye / montant_restant / statut.
    PERFORM recalculer_statut_facture(p_facture_id);

    INSERT INTO audit_logs (
        shop_id, user_id, user_nom, type_acteur, event_type,
        reference_type, reference_id, reference_public_id, details_json
    ) VALUES (
        p_shop_id, p_user_id, p_user_nom, 'shop', 'INVOICE_UPDATED',
        'facture', p_facture_id, v_avant.public_id,
        jsonb_build_object('modifications', jsonb_build_array(
            jsonb_build_object('champ', 'montant_ttc', 'libelle', 'Total',
                               'avant', v_avant.montant_ttc, 'apres', (p_entete->>'montant_ttc')::numeric),
            jsonb_build_object('champ', 'client_id', 'libelle', 'Client',
                               'avant', v_avant.client_id, 'apres', v_client),
            jsonb_build_object('champ', 'date_echeance', 'libelle', 'Échéance',
                               'avant', v_avant.date_echeance, 'apres', NULLIF(p_entete->>'date_echeance', ''))
        ))
    );

    RETURN jsonb_build_object('succes', true);
END;
$function$;

-- 3. Modifier une facture fournisseur.
--    p_entete : reference_fourn, date_echeance, notes,
--               montant_ht, montant_tva, montant_ttc
--    p_lignes : [{product_id, designation, quantite, prix_unitaire,
--                 tva_pct, montant_ht, montant_tva, montant_ttc}]
CREATE OR REPLACE FUNCTION public.modifier_facture_fournisseur(
    p_shop_id uuid, p_facture_id uuid, p_entete jsonb, p_lignes jsonb,
    p_user_id uuid, p_user_nom text
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_avant    RECORD;
    v_ttc      NUMERIC := (p_entete->>'montant_ttc')::numeric;
    v_ref      TEXT    := NULLIF(trim(p_entete->>'reference_fourn'), '');
    v_ecart    RECORD;
BEGIN
    SELECT * INTO v_avant FROM factures_fournisseurs
     WHERE id = p_facture_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;
    IF v_avant.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Une facture annulée ne se modifie pas.');
    END IF;
    IF EXISTS (SELECT 1 FROM supplier_payments WHERE facture_id = p_facture_id) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Un paiement a déjà été enregistré sur cette facture : elle ne se modifie plus.');
    END IF;
    IF jsonb_array_length(COALESCE(p_lignes, '[]'::jsonb)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;
    IF v_ttc IS NULL OR v_ttc < 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;

    -- Le numéro de facture du fournisseur ne doit pas déjà désigner une
    -- autre facture : ce serait deux dettes pour une seule pièce.
    IF v_ref IS NOT NULL AND EXISTS (
        SELECT 1 FROM factures_fournisseurs
         WHERE shop_id = p_shop_id AND supplier_id = v_avant.supplier_id
           AND reference_fourn = v_ref AND statut <> 'annulee' AND id <> p_facture_id
    ) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'La facture n° ' || v_ref || ' de ce fournisseur est déjà enregistrée sous un autre numéro.');
    END IF;

    -- Marchandise déjà entrée : les quantités par produit sont celles
    -- qui ont été RÉCEPTIONNÉES (toutes les réceptions rattachées à la
    -- facture, cumulées). Une facture « à compléter » n'a d'ailleurs
    -- aucune ligne : la réception seule dit ce qui est arrivé.
    IF EXISTS (SELECT 1 FROM receptions WHERE facture_id = p_facture_id) THEN
        SELECT COALESCE(a.product_id, n.product_id) AS product_id,
               COALESCE(a.qte, 0) AS avant, COALESCE(n.qte, 0) AS apres
          INTO v_ecart
          FROM (SELECT ri.product_id, SUM(ri.quantite_recue) qte
                  FROM reception_items ri JOIN receptions r ON r.id = ri.reception_id
                 WHERE r.facture_id = p_facture_id AND ri.product_id IS NOT NULL
                 GROUP BY ri.product_id) a
          FULL JOIN (SELECT NULLIF(l->>'product_id', '')::uuid product_id, SUM((l->>'quantite')::numeric) qte
                       FROM jsonb_array_elements(p_lignes) l
                      WHERE NULLIF(l->>'product_id', '') IS NOT NULL GROUP BY 1) n
            ON n.product_id = a.product_id
         WHERE COALESCE(a.qte, 0) <> COALESCE(n.qte, 0)
         LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object('succes', false, 'erreur',
                'La marchandise de cette facture est déjà entrée en stock : la quantité de « '
                || COALESCE((SELECT nom FROM products WHERE id = v_ecart.product_id), 'un produit')
                || ' » doit rester celle réceptionnée ('
                || (v_ecart.avant::float8)::text
                || '), pas ' || (v_ecart.apres::float8)::text
                || '. Corrigez le stock par un retour fournisseur ou un ajustement.');
        END IF;
    END IF;

    DELETE FROM facture_fournisseur_items WHERE facture_id = p_facture_id;

    INSERT INTO facture_fournisseur_items (
        shop_id, facture_id, product_id, designation, quantite, prix_unitaire,
        tva_pct, montant_ht, montant_tva, montant_ttc, ordre
    )
    SELECT p_shop_id, p_facture_id,
           NULLIF(l->>'product_id', '')::uuid,
           l->>'designation',
           (l->>'quantite')::numeric, (l->>'prix_unitaire')::numeric,
           COALESCE((l->>'tva_pct')::numeric, 0),
           (l->>'montant_ht')::numeric, COALESCE((l->>'montant_tva')::numeric, 0),
           (l->>'montant_ttc')::numeric,
           (o - 1)::integer
      FROM jsonb_array_elements(p_lignes) WITH ORDINALITY AS t(l, o);

    UPDATE factures_fournisseurs SET
        reference_fourn = v_ref,
        date_echeance   = NULLIF(p_entete->>'date_echeance', '')::date,
        notes           = NULLIF(p_entete->>'notes', ''),
        montant_ht      = (p_entete->>'montant_ht')::numeric,
        montant_tva     = (p_entete->>'montant_tva')::numeric,
        montant_ttc     = v_ttc,
        montant_restant = v_ttc,
        -- Une facture « à compléter » l'est une fois relue et enregistrée.
        a_completer     = false
     WHERE id = p_facture_id;

    -- La dette envers le fournisseur suit le nouveau total.
    UPDATE suppliers SET "solde_dû" = "solde_dû" + (v_ttc - v_avant.montant_ttc)
     WHERE id = v_avant.supplier_id AND shop_id = p_shop_id;

    -- Le prix d'achat des produits suit la facture, comme à la création.
    UPDATE products p SET prix_achat = n.prix
      FROM (SELECT DISTINCT ON (NULLIF(l->>'product_id', '')::uuid)
                   NULLIF(l->>'product_id', '')::uuid AS product_id,
                   (l->>'prix_unitaire')::numeric      AS prix
              FROM jsonb_array_elements(p_lignes) WITH ORDINALITY AS t(l, o)
             WHERE NULLIF(l->>'product_id', '') IS NOT NULL
             ORDER BY 1, o DESC) n
     WHERE p.id = n.product_id AND p.shop_id = p_shop_id;

    INSERT INTO audit_logs (
        shop_id, user_id, user_nom, type_acteur, event_type,
        reference_type, reference_id, reference_public_id, details_json
    ) VALUES (
        p_shop_id, p_user_id, p_user_nom, 'shop', 'SUPPLIER_INVOICE_UPDATED',
        'facture_fournisseur', p_facture_id, v_avant.public_id,
        jsonb_build_object('modifications', jsonb_build_array(
            jsonb_build_object('champ', 'montant_ttc', 'libelle', 'Total',
                               'avant', v_avant.montant_ttc, 'apres', v_ttc),
            jsonb_build_object('champ', 'reference_fourn', 'libelle', 'Référence fournisseur',
                               'avant', v_avant.reference_fourn, 'apres', v_ref),
            jsonb_build_object('champ', 'a_completer', 'libelle', 'À compléter',
                               'avant', v_avant.a_completer, 'apres', false)
        ))
    );

    RETURN jsonb_build_object('succes', true);
END;
$function$;
