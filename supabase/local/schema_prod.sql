


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."annuler_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_motif" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."annuler_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_motif" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."annuler_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_motif" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_ok BOOLEAN;
BEGIN
    UPDATE inventories SET
        statut           = 'annule',
        annule_par       = p_user_id,
        annule_le        = NOW(),
        motif_annulation = NULLIF(p_motif, '')
    WHERE id = p_inventory_id
      AND shop_id = p_shop_id
      AND statut = 'en_cours'
    RETURNING TRUE INTO v_ok;

    IF NOT COALESCE(v_ok, FALSE) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Inventaire introuvable ou déjà traité.');
    END IF;

    -- Aucun mouvement de stock n'a été appliqué : il n'y a rien à défaire.
    RETURN jsonb_build_object('succes', true);
END;
$$;


ALTER FUNCTION "public"."annuler_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_motif" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."annuler_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_motif" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."annuler_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_motif" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."annuler_vente"("p_shop_id" "uuid", "p_sale_id" "uuid", "p_motif" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."annuler_vente"("p_shop_id" "uuid", "p_sale_id" "uuid", "p_motif" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."annuler_vente"("p_shop_id" "uuid", "p_sale_id" "uuid", "p_motif" "text", "p_user_id" "uuid") IS 'Annule une vente : stock rendu, soldes client repris, statut « annulee ». Refuse une vente déjà retournée (le stock reviendrait deux fois).';



CREATE OR REPLACE FUNCTION "public"."appliquer_mouvement_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_champ" "text", "p_delta" numeric, "p_type" "text", "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
    v_client        RECORD;
    v_avant         NUMERIC;
    v_apres         NUMERIC;
    v_avertissement TEXT := NULL;
BEGIN
    IF p_champ NOT IN ('credit_balance', 'advance_balance', 'change_balance') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Solde inconnu.');
    END IF;

    IF p_delta = 0 THEN
        RETURN jsonb_build_object('succes', true, 'sans_effet', true);
    END IF;

    -- FOR UPDATE : deux opérations simultanées sur le même client ne
    -- peuvent plus s'écraser l'une l'autre.
    SELECT * INTO v_client FROM clients
     WHERE id = p_client_id AND shop_id = p_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Client introuvable.');
    END IF;

    IF v_client.est_anonyme THEN
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

    -- Décision D2 : on prévient, on ne bloque pas.
    IF p_champ = 'credit_balance'
       AND v_client.plafond_credit > 0
       AND v_apres > v_client.plafond_credit THEN
        v_avertissement := 'Le crédit de ce client atteint ' || v_apres
            || ', au-delà de son plafond de ' || v_client.plafond_credit || '.';
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

    RETURN jsonb_build_object(
        'succes', true,
        'solde_avant', v_avant,
        'solde_apres', v_apres,
        'avertissement', v_avertissement
    );
END;
$_$;


ALTER FUNCTION "public"."appliquer_mouvement_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_champ" "text", "p_delta" numeric, "p_type" "text", "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."appliquer_mouvement_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_champ" "text", "p_delta" numeric, "p_type" "text", "p_note" "text", "p_user_id" "uuid") IS 'Chemin UNIQUE de variation d''un solde client : verrou FOR UPDATE, solde et registre écrits ensemble. Ne jamais écrire clients.credit_balance / advance_balance / change_balance directement.';



CREATE OR REPLACE FUNCTION "public"."appliquer_mouvement_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_delta" numeric, "p_type_mouvement" "text", "p_reference_type" "text" DEFAULT NULL::"text", "p_reference_id" "uuid" DEFAULT NULL::"uuid", "p_reference_pid" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_autoriser_negatif" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_produit_nom  TEXT;
    v_avant        NUMERIC;
    v_apres        NUMERIC;
    v_mvt_pid      TEXT;
BEGIN
    -- Cohérence du sens : le type de mouvement impose le signe.
    -- (« inventaire » est le seul type qui va dans les deux sens.)
    IF p_type_mouvement IN ('entree_initiale','reception','retour_vente',
                            'transfert_entree','ajustement_positif')
       AND p_delta < 0 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Mouvement « ' || p_type_mouvement || ' » incompatible avec une sortie de stock.');
    END IF;

    IF p_type_mouvement IN ('vente','retour_fournisseur',
                            'transfert_sortie','ajustement_negatif')
       AND p_delta > 0 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Mouvement « ' || p_type_mouvement || ' » incompatible avec une entrée de stock.');
    END IF;

    -- Mouvement nul : rien à écrire, pas de ligne de journal.
    IF p_delta = 0 THEN
        RETURN jsonb_build_object('succes', true, 'ignore', true);
    END IF;

    -- Cloisonnement : le produit et l'entrepôt appartiennent à la boutique.
    SELECT nom INTO v_produit_nom
    FROM products
    WHERE id = p_product_id AND shop_id = p_shop_id;

    IF v_produit_nom IS NULL THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Produit introuvable dans cette boutique.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM warehouses
        WHERE id = p_warehouse_id AND shop_id = p_shop_id
    ) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    -- 037 : une boutique sans multi-entrepôts (Starter) ne fait vivre que
    -- son entrepôt par défaut. Les autres, créés pendant l'essai ou sous
    -- un plan supérieur, restent consultables ; seule une sortie par
    -- transfert y est permise, pour rapatrier le stock vers l'entrepôt
    -- principal. Liste des plans à tenir alignée sur lib/constants/plans.ts.
    IF EXISTS (SELECT 1 FROM shops WHERE id = p_shop_id AND plan = 'starter')
       AND NOT EXISTS (SELECT 1 FROM warehouses
                       WHERE id = p_warehouse_id AND est_defaut)
       AND p_type_mouvement <> 'transfert_sortie' THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Votre plan Starter ne fait vivre que l''entrepôt par défaut. '
                   || 'Les autres sont consultables, et leur stock peut être transféré vers l''entrepôt par défaut. '
                   || 'Passez au plan Pro pour les utiliser à nouveau.');
    END IF;

    -- La ligne de stock est créée à la volée si elle manque : une
    -- absence de ligne vaut zéro, jamais « Stock introuvable ».
    INSERT INTO stock_levels (shop_id, product_id, warehouse_id, quantite)
    VALUES (p_shop_id, p_product_id, p_warehouse_id, 0)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    -- Verrou : plus aucune écriture concurrente ne peut s'intercaler
    -- entre la lecture et l'écriture.
    SELECT quantite INTO v_avant
    FROM stock_levels
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    v_apres := v_avant + p_delta;

    IF v_apres < 0 AND NOT p_autoriser_negatif THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Stock insuffisant pour ' || v_produit_nom ||
                      ' (disponible : ' || v_avant || ', demandé : ' || ABS(p_delta) || ')');
    END IF;

    UPDATE stock_levels
    SET quantite = v_apres, updated_at = NOW()
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

    SELECT generate_public_id(p_shop_id, 'MVT') INTO v_mvt_pid;

    INSERT INTO stock_movements (
        public_id, shop_id, product_id, warehouse_id,
        type_mouvement, quantite, quantite_avant, quantite_apres,
        reference_type, reference_id, reference_public_id,
        note, created_by
    ) VALUES (
        v_mvt_pid, p_shop_id, p_product_id, p_warehouse_id,
        p_type_mouvement, ABS(p_delta), v_avant, v_apres,
        p_reference_type, p_reference_id, p_reference_pid,
        p_note, p_user_id
    );

    RETURN jsonb_build_object(
        'succes',      true,
        'stock_avant', v_avant,
        'stock_apres', v_apres,
        'mouvement',   v_mvt_pid
    );
END;
$$;


ALTER FUNCTION "public"."appliquer_mouvement_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_delta" numeric, "p_type_mouvement" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_note" "text", "p_user_id" "uuid", "p_autoriser_negatif" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ca_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval DEFAULT '01:00:00'::interval) RETURNS TABLE("nb_ventes" integer, "ca_facture" numeric, "encaisse_pos" numeric, "credit_accorde" numeric, "soldes_utilises" numeric, "remb_ardoise" numeric, "encaisse_factures" numeric, "encaisse_total" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH ventes AS (
        SELECT s.id,
               s.montant_total,
               s.credit_accorde,
               s.advance_utilise + s.change_utilise AS soldes,
               s.credit_utilise
          FROM sales s
         WHERE s.shop_id = p_shop_id
           AND s.statut  = 'completee'
           -- created_at est un instant : on le ramène au jour vécu
           -- dans la boutique avant de le comparer à une date.
           AND (s.created_at + p_decalage)::date BETWEEN p_debut AND p_fin
    ),
    encaissements AS (
        SELECT COALESCE(SUM(sp.montant), 0) AS montant
          FROM sale_payments sp
         WHERE sp.sale_id IN (SELECT id FROM ventes)
    ),
    reglements AS (
        SELECT COALESCE(SUM(fp.montant), 0) AS montant
          FROM facture_payments fp
         WHERE fp.shop_id = p_shop_id
           -- Un règlement annulé n'a jamais été encaissé.
           AND NOT fp.est_annule
           AND fp.date_paiement BETWEEN p_debut AND p_fin
    )
    SELECT
        (SELECT count(*) FROM ventes)::INTEGER,
        (SELECT COALESCE(SUM(montant_total),  0) FROM ventes),
        (SELECT montant FROM encaissements),
        (SELECT COALESCE(SUM(credit_accorde), 0) FROM ventes),
        (SELECT COALESCE(SUM(soldes),         0) FROM ventes),
        (SELECT COALESCE(SUM(credit_utilise), 0) FROM ventes),
        (SELECT montant FROM reglements),
        (SELECT montant FROM encaissements) + (SELECT montant FROM reglements);
$$;


ALTER FUNCTION "public"."ca_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ca_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) IS 'L''argent des ventes d''une période : facturé, encaissé, et ce qui explique l''écart. Source unique du CA — rapport de ventes, compte de résultat et tableau de bord lisent ceci.';



CREATE OR REPLACE FUNCTION "public"."changer_statut_bon_commande"("p_shop_id" "uuid", "p_po_id" "uuid", "p_statut" "text", "p_user_id" "uuid", "p_motif" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."changer_statut_bon_commande"("p_shop_id" "uuid", "p_po_id" "uuid", "p_statut" "text", "p_user_id" "uuid", "p_motif" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_client_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.est_anonyme = TRUE AND NEW.credit_balance > 0 THEN
    RAISE EXCEPTION 'Un client anonyme ne peut pas avoir de solde crédit (règle F2)';
  END IF;
  IF NEW.est_anonyme = TRUE AND NEW.advance_balance > 0 THEN
    RAISE EXCEPTION 'Un client anonyme ne peut pas avoir de solde avance (règle F2)';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_client_credit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_facture_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_facture_immutable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clients_encours"("p_shop_id" "uuid") RETURNS TABLE("client_id" "uuid", "public_id" "text", "nom" "text", "telephone" "text", "credit_balance" numeric, "advance_balance" numeric, "change_balance" numeric, "plafond_credit" numeric, "depasse_plafond" boolean, "nb_achats" integer, "ca_total" numeric, "nb_operations" integer, "derniere_operation" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT
        c.id,
        c.public_id,
        c.nom,
        c.telephone,
        c.credit_balance,
        c.advance_balance,
        c.change_balance,
        c.plafond_credit,
        -- Un plafond à 0 signifie « pas de limite fixée », jamais
        -- « aucun crédit autorisé » : le dépassement ne se déclare
        -- que si une limite a été posée.
        c.plafond_credit > 0 AND c.credit_balance > c.plafond_credit,
        COALESCE(v.nb, 0)::INTEGER,
        COALESCE(v.ca, 0),
        COALESCE(o.nb, 0)::INTEGER,
        o.dernier
      FROM clients c
      LEFT JOIN LATERAL (
          SELECT count(*) AS nb, COALESCE(SUM(s.montant_total), 0) AS ca
            FROM sales s
           WHERE s.client_id = c.id
             AND s.statut    = 'completee'
      ) v ON true
      LEFT JOIN LATERAL (
          SELECT count(*) AS nb, max(b.created_at) AS dernier
            FROM client_balance_operations b
           WHERE b.client_id = c.id
      ) o ON true
     WHERE c.shop_id     = p_shop_id
       AND c.est_actif
       AND NOT c.est_anonyme
     ORDER BY c.credit_balance DESC, c.nom;
$$;


ALTER FUNCTION "public"."clients_encours"("p_shop_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."clients_encours"("p_shop_id" "uuid") IS 'Encours de chaque client actif, son plafond, et son historique de soldes. Source unique du rapport clients.';



CREATE OR REPLACE FUNCTION "public"."convertir_devis_en_facture"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."convertir_devis_en_facture"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."creer_avoir"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_motif" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."creer_avoir"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_motif" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduire_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_quantite" numeric, "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_res      JSONB;
    v_autorise BOOLEAN;
    v_avant    NUMERIC;
    v_note     TEXT := NULL;
BEGIN
    SELECT autoriser_stock_negatif INTO v_autorise
      FROM shops WHERE id = p_shop_id;

    v_autorise := COALESCE(v_autorise, FALSE);

    IF v_autorise THEN
        SELECT quantite INTO v_avant FROM stock_levels
         WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id;

        IF COALESCE(v_avant, 0) - p_quantite < 0 THEN
            v_note := 'Vente au-delà du stock disponible ('
                   || COALESCE(v_avant, 0) || ' en stock, ' || p_quantite
                   || ' vendus) — écart à régulariser à l''inventaire.';
        END IF;
    END IF;

    v_res := appliquer_mouvement_stock(
        p_shop_id, p_product_id, p_warehouse_id,
        -p_quantite, 'vente',
        p_reference_type, p_reference_id, p_reference_pid,
        v_note, p_user_id, v_autorise
    );

    IF NOT (v_res->>'succes')::BOOLEAN THEN
        RETURN v_res;
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'stock_restant', (v_res->>'stock_apres')::NUMERIC,
        'stock_force',   v_note IS NOT NULL
    );
END;
$$;


ALTER FUNCTION "public"."deduire_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_quantite" numeric, "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effectuer_ajustement"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_shop_id   UUID := (p_data->>'shop_id')::UUID;
    v_wh        UUID := (p_data->>'warehouse_id')::UUID;
    v_user_id   UUID := NULLIF(p_data->>'user_id', '')::UUID;
    v_motif     TEXT := NULLIF(p_data->>'motif', '');
    v_pid       TEXT;
    v_adj       UUID;
    v_item      JSONB;
    v_product   UUID;
    v_apres     NUMERIC;
    v_avant     NUMERIC;
    v_delta     NUMERIC;
    v_res       JSONB;
    v_nb        INTEGER := 0;
BEGIN
    IF v_motif IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Le motif est obligatoire.');
    END IF;

    IF jsonb_array_length(COALESCE(p_data->'items', '[]'::JSONB)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = v_wh AND shop_id = v_shop_id) THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    SELECT generate_public_id(v_shop_id, 'ADJ') INTO v_pid;

    INSERT INTO stock_adjustments (public_id, shop_id, warehouse_id, motif, note, created_by)
    VALUES (v_pid, v_shop_id, v_wh, v_motif, NULLIF(p_data->>'note', ''), v_user_id)
    RETURNING id INTO v_adj;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_product := (v_item->>'product_id')::UUID;
        v_apres   := (v_item->>'quantite_apres')::NUMERIC;

        IF v_apres IS NULL OR v_apres < 0 THEN
            RAISE EXCEPTION 'Quantité après ajustement invalide.';
        END IF;

        -- On verrouille la ligne AVANT de calculer l'écart : la
        -- quantité lue ne peut plus bouger d'ici l'écriture.
        INSERT INTO stock_levels (shop_id, product_id, warehouse_id, quantite)
        VALUES (v_shop_id, v_product, v_wh, 0)
        ON CONFLICT (product_id, warehouse_id) DO NOTHING;

        SELECT quantite INTO v_avant
        FROM stock_levels
        WHERE product_id = v_product AND warehouse_id = v_wh
        FOR UPDATE;

        v_delta := v_apres - v_avant;

        IF v_delta <> 0 THEN
            v_res := appliquer_mouvement_stock(
                v_shop_id, v_product, v_wh,
                v_delta,
                CASE WHEN v_delta > 0 THEN 'ajustement_positif' ELSE 'ajustement_negatif' END,
                'adjustment', v_adj, v_pid, v_motif, v_user_id, FALSE
            );
            IF NOT (v_res->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION '%', v_res->>'erreur';
            END IF;

            INSERT INTO stock_adjustment_items (
                shop_id, adjustment_id, product_id,
                quantite_avant, quantite_apres, ecart
            ) VALUES (
                v_shop_id, v_adj, v_product, v_avant, v_apres, v_delta
            );

            v_nb := v_nb + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'succes', true, 'adjustment_id', v_adj,
        'public_id', v_pid, 'nb_lignes', v_nb
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."effectuer_ajustement"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effectuer_retour_fournisseur"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."effectuer_retour_fournisseur"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effectuer_retour_vente"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."effectuer_retour_vente"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effectuer_transfert"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_shop_id    UUID := (p_data->>'shop_id')::UUID;
    v_from       UUID := (p_data->>'warehouse_from')::UUID;
    v_to         UUID := (p_data->>'warehouse_to')::UUID;
    v_user_id    UUID := NULLIF(p_data->>'user_id', '')::UUID;
    v_pid        TEXT;
    v_transfert  UUID;
    v_item       JSONB;
    v_qte        NUMERIC;
    v_res        JSONB;
    v_nb         INTEGER := 0;
BEGIN
    IF v_from = v_to THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Les entrepôts source et destination doivent être différents.');
    END IF;

    IF jsonb_array_length(COALESCE(p_data->'items', '[]'::JSONB)) = 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ajoutez au moins une ligne.');
    END IF;

    IF (SELECT COUNT(*) FROM warehouses
        WHERE id IN (v_from, v_to) AND shop_id = v_shop_id) <> 2 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Entrepôt introuvable dans cette boutique.');
    END IF;

    SELECT generate_public_id(v_shop_id, 'TRF') INTO v_pid;

    INSERT INTO stock_transfers (
        public_id, shop_id, warehouse_from, warehouse_to,
        statut, note, created_by
    ) VALUES (
        v_pid, v_shop_id, v_from, v_to,
        'valide', NULLIF(p_data->>'note', ''), v_user_id
    ) RETURNING id INTO v_transfert;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_qte := (v_item->>'quantite')::NUMERIC;

        IF v_qte IS NULL OR v_qte <= 0 THEN
            RAISE EXCEPTION 'Quantité invalide dans le transfert.';
        END IF;

        -- Sortie de l'entrepôt source
        v_res := appliquer_mouvement_stock(
            v_shop_id, (v_item->>'product_id')::UUID, v_from,
            -v_qte, 'transfert_sortie',
            'transfer', v_transfert, v_pid, NULL, v_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;

        -- Entrée dans l'entrepôt destination
        v_res := appliquer_mouvement_stock(
            v_shop_id, (v_item->>'product_id')::UUID, v_to,
            v_qte, 'transfert_entree',
            'transfer', v_transfert, v_pid, NULL, v_user_id, FALSE
        );
        IF NOT (v_res->>'succes')::BOOLEAN THEN
            RAISE EXCEPTION '%', v_res->>'erreur';
        END IF;

        INSERT INTO stock_transfer_items (shop_id, transfer_id, product_id, quantite)
        VALUES (v_shop_id, v_transfert, (v_item->>'product_id')::UUID, v_qte);

        v_nb := v_nb + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'succes', true, 'transfer_id', v_transfert,
        'public_id', v_pid, 'nb_lignes', v_nb
    );
EXCEPTION WHEN OTHERS THEN
    -- Le transfert entier est annulé, y compris les lignes déjà appliquées.
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."effectuer_transfert"("p_data" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abonnement_paiements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "plan" "text" NOT NULL,
    "duree" "text" NOT NULL,
    "nb_mois" integer NOT NULL,
    "montant" numeric(12,0) NOT NULL,
    "devise" "text" DEFAULT 'FCFA'::"text" NOT NULL,
    "moyen" "text" NOT NULL,
    "statut" "text" DEFAULT 'en_attente'::"text" NOT NULL,
    "reference_transaction" "text",
    "periode_debut" timestamp with time zone,
    "periode_fin" timestamp with time zone,
    "plan_precedent" "text",
    "expiration_precedente" timestamp with time zone,
    "cree_par_utilisateur" "uuid",
    "cree_par_plateforme" "uuid",
    "note" "text",
    "details_prestataire" "jsonb",
    "motif_echec" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirme_le" timestamp with time zone,
    "sandbox" boolean DEFAULT false NOT NULL,
    CONSTRAINT "abo_auteur_unique" CHECK ((("cree_par_utilisateur" IS NULL) <> ("cree_par_plateforme" IS NULL))),
    CONSTRAINT "abo_enterprise_manuel" CHECK ((("plan" <> 'enterprise'::"text") OR ("moyen" = 'manuel'::"text"))),
    CONSTRAINT "abo_manuel_par_plateforme" CHECK ((("moyen" <> 'manuel'::"text") OR ("cree_par_plateforme" IS NOT NULL))),
    CONSTRAINT "abo_nb_mois_selon_duree" CHECK (((("duree" = 'mensuel'::"text") AND ("nb_mois" = 1)) OR (("duree" = 'annuel'::"text") AND ("nb_mois" = 12)))),
    CONSTRAINT "abo_periode_si_reussi" CHECK ((("statut" <> 'reussi'::"text") OR (("periode_debut" IS NOT NULL) AND ("periode_fin" IS NOT NULL) AND ("confirme_le" IS NOT NULL)))),
    CONSTRAINT "abonnement_paiements_duree_check" CHECK (("duree" = ANY (ARRAY['mensuel'::"text", 'annuel'::"text"]))),
    CONSTRAINT "abonnement_paiements_montant_check" CHECK (("montant" >= (0)::numeric)),
    CONSTRAINT "abonnement_paiements_moyen_check" CHECK (("moyen" = ANY (ARRAY['kkiapay'::"text", 'manuel'::"text"]))),
    CONSTRAINT "abonnement_paiements_nb_mois_check" CHECK (("nb_mois" > 0)),
    CONSTRAINT "abonnement_paiements_plan_check" CHECK (("plan" = ANY (ARRAY['starter'::"text", 'pro'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "abonnement_paiements_statut_check" CHECK (("statut" = ANY (ARRAY['en_attente'::"text", 'reussi'::"text", 'echoue'::"text", 'abandonne'::"text", 'rembourse'::"text"])))
);


ALTER TABLE "public"."abonnement_paiements" OWNER TO "postgres";


COMMENT ON TABLE "public"."abonnement_paiements" IS 'Paiements d''abonnement d''une boutique. Seule prolonger_abonnement() fait passer une ligne à « reussi » et modifie shops.plan / plan_expire_le.';



COMMENT ON COLUMN "public"."abonnement_paiements"."sandbox" IS 'Paiement passé par la sandbox KkiaPay (test) : exclu de tout encaissement.';



CREATE OR REPLACE FUNCTION "public"."enregistrer_paiement_manuel"("p_shop_id" "uuid", "p_plan" "text", "p_duree" "text", "p_montant" numeric, "p_admin_id" "uuid", "p_note" "text" DEFAULT NULL::"text", "p_reference" "text" DEFAULT NULL::"text") RETURNS "public"."abonnement_paiements"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM shops WHERE id = p_shop_id) THEN
        RAISE EXCEPTION 'Boutique introuvable.' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO abonnement_paiements (public_id, shop_id, plan, duree, nb_mois, montant,
                                      moyen, cree_par_plateforme, note, reference_transaction)
    VALUES (generate_platform_id('ABO'), p_shop_id, p_plan, p_duree,
            CASE p_duree WHEN 'annuel' THEN 12 ELSE 1 END,
            p_montant, 'manuel', p_admin_id, nullif(trim(p_note), ''), nullif(trim(p_reference), ''))
    RETURNING id INTO v_id;

    RETURN prolonger_abonnement(v_id);
END;
$$;


ALTER FUNCTION "public"."enregistrer_paiement_manuel"("p_shop_id" "uuid", "p_plan" "text", "p_duree" "text", "p_montant" numeric, "p_admin_id" "uuid", "p_note" "text", "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enregistrer_reception"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_rec_id        UUID;
    v_rec_public_id TEXT;
    v_item          JSONB;
    v_shop_id       UUID;
    v_warehouse_id  UUID;
    v_user_id       UUID;
    v_supplier_id   UUID;
    v_po_id         UUID;
    v_product_id    UUID;
    v_facture_id    UUID;
    v_facture_pid   TEXT;
    v_montant       NUMERIC;
    v_prix          NUMERIC;
    v_ancien_achat  NUMERIC;
    v_ancien_vente  NUMERIC;
    v_res           JSONB;
    v_creee         BOOLEAN := FALSE;
    v_reprise       BOOLEAN := FALSE;
BEGIN
    v_shop_id      := (p_data->>'shop_id')::UUID;
    v_warehouse_id := (p_data->>'warehouse_id')::UUID;
    v_user_id      := (p_data->>'user_id')::UUID;
    v_supplier_id  := (p_data->>'supplier_id')::UUID;
    v_po_id        := NULLIF(p_data->>'po_id', '')::UUID;
    v_facture_id   := NULLIF(p_data->>'facture_id', '')::UUID;
    v_montant      := COALESCE((p_data->>'montant_total')::NUMERIC, 0);

    SELECT generate_public_id(v_shop_id, 'REC') INTO v_rec_public_id;

    IF v_facture_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM factures_fournisseurs
            WHERE id = v_facture_id AND shop_id = v_shop_id
        ) THEN
            RETURN jsonb_build_object('succes', false,
                'erreur', 'Facture fournisseur introuvable dans cette boutique.');
        END IF;
    ELSE
        IF v_po_id IS NOT NULL THEN
            SELECT f.id INTO v_facture_id
            FROM receptions r
            JOIN factures_fournisseurs f ON f.id = r.facture_id
            WHERE r.po_id = v_po_id
              AND r.shop_id = v_shop_id
              AND f.a_completer
              AND f.statut = 'non_payee'
            ORDER BY r.created_at
            LIMIT 1;

            v_reprise := v_facture_id IS NOT NULL;
        END IF;

        IF v_reprise THEN
            UPDATE factures_fournisseurs
            SET montant_ht      = montant_ht      + v_montant,
                montant_ttc     = montant_ttc     + v_montant,
                montant_restant = montant_restant + v_montant,
                updated_at      = NOW()
            WHERE id = v_facture_id;
        ELSE
            SELECT generate_public_id(v_shop_id, 'FF') INTO v_facture_pid;

            INSERT INTO factures_fournisseurs (
                public_id, shop_id, supplier_id, warehouse_id, statut,
                date_facture, montant_ht, montant_tva, montant_ttc,
                montant_paye, montant_restant, a_completer, notes, created_by
            ) VALUES (
                v_facture_pid, v_shop_id, v_supplier_id, v_warehouse_id, 'non_payee',
                CURRENT_DATE, v_montant, 0, v_montant,
                0, v_montant, TRUE,
                'Créée automatiquement par la réception ' || v_rec_public_id ||
                ' : montants et référence fournisseur à compléter.',
                v_user_id
            ) RETURNING id INTO v_facture_id;

            v_creee := TRUE;
        END IF;

        UPDATE suppliers
        SET solde_dû = solde_dû + v_montant
        WHERE id = v_supplier_id AND shop_id = v_shop_id;
    END IF;

    INSERT INTO receptions (
        public_id, shop_id, po_id, supplier_id,
        warehouse_id, date_reception, montant_total, notes,
        facture_id, created_by
    ) VALUES (
        v_rec_public_id, v_shop_id, v_po_id,
        v_supplier_id, v_warehouse_id, CURRENT_DATE,
        v_montant, NULLIF(p_data->>'notes', ''),
        v_facture_id, v_user_id
    ) RETURNING id INTO v_rec_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items') LOOP
        v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
        v_prix       := (v_item->>'prix_unitaire')::NUMERIC;

        INSERT INTO reception_items (
            shop_id, reception_id, product_id, poi_id,
            designation, quantite_recue, prix_unitaire
        ) VALUES (
            v_shop_id, v_rec_id, v_product_id,
            NULLIF(v_item->>'poi_id', '')::UUID,
            v_item->>'designation',
            (v_item->>'quantite')::NUMERIC,
            v_prix
        );

        IF v_product_id IS NOT NULL THEN
            v_res := appliquer_mouvement_stock(
                v_shop_id, v_product_id, v_warehouse_id,
                (v_item->>'quantite')::NUMERIC, 'reception',
                'reception', v_rec_id, v_rec_public_id, NULL, v_user_id, FALSE
            );
            IF NOT (v_res->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION '%', v_res->>'erreur';
            END IF;

            -- Prix d'achat : on garde une trace du changement.
            SELECT prix_achat, prix_vente INTO v_ancien_achat, v_ancien_vente
            FROM products WHERE id = v_product_id AND shop_id = v_shop_id;

            IF v_ancien_achat IS DISTINCT FROM v_prix THEN
                UPDATE products
                SET prix_achat = v_prix
                WHERE id = v_product_id AND shop_id = v_shop_id;

                INSERT INTO price_history (
                    shop_id, product_id,
                    ancien_prix_achat, nouveau_prix_achat,
                    ancien_prix_vente, nouveau_prix_vente,
                    modifie_par
                ) VALUES (
                    v_shop_id, v_product_id,
                    v_ancien_achat, v_prix,
                    v_ancien_vente, v_ancien_vente,
                    v_user_id
                );
            END IF;
        END IF;

        IF NULLIF(v_item->>'poi_id', '') IS NOT NULL THEN
            UPDATE purchase_order_items
            SET quantite_recue = quantite_recue + (v_item->>'quantite')::NUMERIC
            WHERE id = NULLIF(v_item->>'poi_id', '')::UUID;
        END IF;
    END LOOP;

    IF v_po_id IS NOT NULL THEN
        UPDATE purchase_orders SET
            statut = CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM purchase_order_items
                    WHERE purchase_order_id = v_po_id
                      AND quantite_recue < quantite_cmd
                ) THEN 'recu_total'
                ELSE 'recu_partiel'
            END,
            updated_at = NOW()
        WHERE id = v_po_id;
    END IF;

    RETURN jsonb_build_object(
        'succes', true,
        'reception_id', v_rec_id,
        'public_id', v_rec_public_id,
        'facture_id', v_facture_id,
        'facture_creee', v_creee,
        'facture_completee', v_reprise
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."enregistrer_reception"("p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enregistrer_vente"("p_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_sale_id        UUID;
  v_sale_public_id TEXT;
  v_item           JSONB;
  v_stock_result   JSONB;
  v_shop_id        UUID;
  v_warehouse_id   UUID;
  v_user_id        UUID;
  v_client_id      UUID;
  v_solde          JSONB;
  v_avertissements TEXT[] := ARRAY[]::TEXT[];

  v_total          NUMERIC;
  v_credit         NUMERIC;
  v_avance         NUMERIC;
  v_monnaie        NUMERIC;
  v_rembourse      NUMERIC;
  v_regle          NUMERIC;
  v_encaisse_vente NUMERIC;
  v_a_couvrir      NUMERIC;
  v_reste          NUMERIC;
BEGIN
  v_shop_id      := (p_data->>'shop_id')::UUID;
  v_warehouse_id := (p_data->>'warehouse_id')::UUID;
  v_user_id      := (p_data->>'vendeur_id')::UUID;
  v_client_id    := NULLIF(p_data->>'client_id', '')::UUID;

  v_total     := COALESCE((p_data->>'montant_total')::NUMERIC, 0);
  v_credit    := COALESCE((p_data->>'credit_accorde')::NUMERIC, 0);
  v_avance    := COALESCE((p_data->>'advance_utilise')::NUMERIC, 0);
  v_monnaie   := COALESCE((p_data->>'change_utilise')::NUMERIC, 0);
  -- Remboursement d'ardoise encaissé avec la vente : il s'ajoute à ce
  -- que le client donne, sans faire partie du prix des articles.
  v_rembourse := COALESCE((p_data->>'credit_utilise')::NUMERIC, 0);

  SELECT COALESCE(SUM((e->>'montant')::NUMERIC), 0) INTO v_regle
    FROM jsonb_array_elements(COALESCE(p_data->'paiements', '[]'::JSONB)) e;

  -- ── Contrôles de cohérence de l'argent ─────────────────────
  IF v_credit < 0 OR v_avance < 0 OR v_monnaie < 0 OR v_rembourse < 0 THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Montant négatif dans le règlement.');
  END IF;

  IF v_credit > 0 AND v_client_id IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Un crédit ne peut être accordé qu''à un client identifié.');
  END IF;

  -- Ce que la vente doit couvrir, et ce qui reste après les soldes.
  v_a_couvrir := v_total - v_avance - v_monnaie;
  v_reste     := v_a_couvrir - v_credit;

  IF v_reste < -0.01 THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Le crédit accordé (' || v_credit || ') dépasse ce qui reste à payer (' || GREATEST(v_a_couvrir, 0) || ').'
    );
  END IF;

  -- Le cœur de la correction : ce qui entre en caisse AU TITRE DE LA
  -- VENTE, c'est le total moins les soldes utilisés et moins le crédit
  -- accordé. Le reste des règlements saisis rembourse l'ardoise ou
  -- constitue la monnaie à rendre.
  v_encaisse_vente := GREATEST(v_reste, 0);

  IF v_regle + 0.01 < v_encaisse_vente + v_rembourse THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Les règlements saisis (' || v_regle || ') ne couvrent pas ce qui est dû (' || (v_encaisse_vente + v_rembourse) || ').'
    );
  END IF;

  SELECT generate_public_id(v_shop_id, 'VENTE') INTO v_sale_public_id;

  INSERT INTO sales (
    public_id, shop_id, client_id, warehouse_id, vendeur_id,
    statut, montant_brut, remise_globale_pct, remise_globale_val,
    montant_net, montant_tva, montant_total,
    montant_recu, montant_rendu,
    credit_utilise, advance_utilise, change_utilise, credit_accorde,
    note
  ) VALUES (
    v_sale_public_id, v_shop_id, v_client_id, v_warehouse_id, v_user_id,
    'completee',
    (p_data->>'montant_brut')::NUMERIC,
    (p_data->>'remise_globale_pct')::NUMERIC,
    (p_data->>'remise_globale_val')::NUMERIC,
    (p_data->>'montant_net')::NUMERIC,
    (p_data->>'montant_tva')::NUMERIC,
    v_total,
    (p_data->>'montant_recu')::NUMERIC,
    (p_data->>'montant_rendu')::NUMERIC,
    v_rembourse, v_avance, v_monnaie, v_credit,
    p_data->>'note'
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'items')
  LOOP
    SELECT deduire_stock(
      v_shop_id, (v_item->>'product_id')::UUID, v_warehouse_id,
      (v_item->>'quantite')::NUMERIC, 'sale', v_sale_id, v_sale_public_id, v_user_id
    ) INTO v_stock_result;

    IF NOT (v_stock_result->>'succes')::BOOLEAN THEN
      RAISE EXCEPTION '%', v_stock_result->>'erreur';
    END IF;

    INSERT INTO sale_items (
      shop_id, sale_id, product_id, warehouse_id,
      quantite, prix_unitaire, remise_pct, remise_val,
      montant_ligne, tva_pct, montant_tva, imei, note
    ) VALUES (
      v_shop_id, v_sale_id,
      (v_item->>'product_id')::UUID, v_warehouse_id,
      (v_item->>'quantite')::NUMERIC,
      (v_item->>'prix_unitaire')::NUMERIC,
      COALESCE((v_item->>'remise_pct')::NUMERIC, 0),
      COALESCE((v_item->>'remise_val')::NUMERIC, 0),
      (v_item->>'montant_ligne')::NUMERIC,
      COALESCE((v_item->>'tva_pct')::NUMERIC, 0),
      COALESCE((v_item->>'montant_tva')::NUMERIC, 0),
      NULLIF(v_item->>'imei', ''),
      NULLIF(v_item->>'note', '')
    );
  END LOOP;

  -- ── Règlements : SEULEMENT l'argent réellement entré ───────
  -- Les montants saisis sont ramenés à ce qui est effectivement
  -- encaissé (vente + remboursement d'ardoise), au prorata de chaque
  -- moyen de paiement. Le surplus est la monnaie rendue, qui n'entre
  -- pas en caisse ; le crédit accordé n'y entre pas non plus.
  IF v_regle > 0 AND (v_encaisse_vente + v_rembourse) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'paiements')
    LOOP
      INSERT INTO sale_payments (
        shop_id, sale_id, moyen_paiement, montant, reference
      ) VALUES (
        v_shop_id, v_sale_id,
        v_item->>'moyen_paiement',
        ROUND(
          (v_item->>'montant')::NUMERIC / v_regle * (v_encaisse_vente + v_rembourse),
          2
        ),
        NULLIF(v_item->>'reference', '')
      );
    END LOOP;
  END IF;

  -- ── Soldes client ──────────────────────────────────────────
  IF v_client_id IS NOT NULL THEN

    IF v_avance > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'advance_balance', -v_avance,
        'vente_avance', 'Avance utilisée sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF v_monnaie > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'change_balance', -v_monnaie,
        'vente_monnaie', 'Monnaie utilisée sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    -- Remboursement d'ardoise : le solde dû diminue.
    IF v_rembourse > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'credit_balance', -v_rembourse,
        'credit_remboursement', 'Ardoise réglée au comptoir sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF v_credit > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'credit_balance', v_credit,
        'vente_credit', 'Crédit accordé sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
      -- Le plafond avertit, il ne bloque pas (décision D2 Facturation).
      IF v_solde->>'avertissement' IS NOT NULL THEN
        v_avertissements := v_avertissements || (v_solde->>'avertissement');
      END IF;
    END IF;

    IF COALESCE((p_data->>'montant_rendu')::NUMERIC, 0) > 0
       AND COALESCE((p_data->>'garder_monnaie')::BOOLEAN, FALSE) THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'change_balance',
        (p_data->>'montant_rendu')::NUMERIC,
        'vente_monnaie', 'Monnaie laissée en compte sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'sale_id', v_sale_id,
    'public_id', v_sale_public_id,
    'encaisse', v_encaisse_vente + v_rembourse,
    'credit_accorde', v_credit,
    'avertissements', to_jsonb(v_avertissements)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."enregistrer_vente"("p_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enregistrer_vente"("p_data" "jsonb") IS 'Enregistre une vente. Les sale_payments ne reçoivent QUE l''argent réellement entré : total moins soldes utilisés moins crédit accordé, plus le remboursement d''ardoise. Le crédit accordé n''est pas une entrée de trésorerie.';



CREATE OR REPLACE FUNCTION "public"."especes_attendues_session"("p_session_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."especes_attendues_session"("p_session_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."especes_attendues_session"("p_session_id" "uuid") IS 'Espèces que le tiroir devrait contenir : fond initial + encaissements espèces − sorties espèces. Ne couvre que les ESPÈCES : les autres moyens ne passent pas par le tiroir.';



CREATE OR REPLACE FUNCTION "public"."evolution_tresorerie"("p_shop_id" "uuid", "p_mois_fin" integer, "p_annee_fin" integer, "p_nb_mois" integer DEFAULT 6, "p_decalage" interval DEFAULT '01:00:00'::interval) RETURNS TABLE("mois" integer, "annee" integer, "entrees" numeric, "sorties" numeric, "resultat" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH periodes AS (
        SELECT generate_series(
            make_date(p_annee_fin, p_mois_fin, 1) - ((p_nb_mois - 1) || ' months')::INTERVAL,
            make_date(p_annee_fin, p_mois_fin, 1),
            '1 month'
        )::date AS debut
    ),
    bornes AS (
        SELECT debut,
               (debut + INTERVAL '1 month - 1 day')::date AS fin
          FROM periodes
    )
    SELECT
        EXTRACT(MONTH FROM b.debut)::INTEGER,
        EXTRACT(YEAR  FROM b.debut)::INTEGER,
        t.total_entrees,
        t.total_sorties,
        t.resultat
      FROM bornes b
      CROSS JOIN LATERAL tresorerie_periode(p_shop_id, b.debut, b.fin, p_decalage) t
     ORDER BY b.debut;
$$;


ALTER FUNCTION "public"."evolution_tresorerie"("p_shop_id" "uuid", "p_mois_fin" integer, "p_annee_fin" integer, "p_nb_mois" integer, "p_decalage" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."evolution_tresorerie"("p_shop_id" "uuid", "p_mois_fin" integer, "p_annee_fin" integer, "p_nb_mois" integer, "p_decalage" interval) IS 'Six mois de trésorerie, calculés par tresorerie_periode : la courbe et le total de la page disent forcément la même chose.';



CREATE OR REPLACE FUNCTION "public"."fermer_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_compte" numeric, "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."fermer_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_compte" numeric, "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."garde_plan_boutique"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.plan_expire_le IS DISTINCT FROM OLD.plan_expire_le)
       AND coalesce(current_setting('manetec.prolongation', true), '') <> 'oui' THEN
        RAISE EXCEPTION 'Le plan et l''échéance d''une boutique ne changent que par prolonger_abonnement().'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."garde_plan_boutique"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_platform_id"("p_prefix" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_next INTEGER;
BEGIN
  UPDATE platform_id_counters
  SET last_value = last_value + 1,
      updated_at = NOW()
  WHERE prefix = p_prefix
  RETURNING last_value INTO v_next;

  RETURN p_prefix || '-' || LPAD(v_next::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."generate_platform_id"("p_prefix" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_public_id"("p_shop_id" "uuid", "p_prefix" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_next_val INTEGER;
BEGIN
    -- Insérer le compteur s'il n'existe pas, sinon incrémenter
    INSERT INTO public_id_counters (shop_id, prefix, last_value)
    VALUES (p_shop_id, p_prefix, 1)
    ON CONFLICT (shop_id, prefix)
    DO UPDATE SET last_value = public_id_counters.last_value + 1
    RETURNING last_value INTO v_next_val;

    RETURN p_prefix || '-' || LPAD(v_next_val::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION "public"."generate_public_id"("p_shop_id" "uuid", "p_prefix" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."journees_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval DEFAULT '01:00:00'::interval) RETURNS TABLE("session_id" "uuid", "public_id" "text", "jour" "date", "entrepot" "text", "statut" "text", "fond_initial" numeric, "attendu_especes" numeric, "compte_especes" numeric, "ecart" numeric, "ouverte_par" "text", "fermee_par" "text", "note_ouverture" "text", "note_fermeture" "text", "encaisse_especes" numeric, "encaisse_autres" numeric, "sorties_especes" numeric, "nb_ventes" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT
        cs.id,
        cs.public_id,
        cs.jour,
        w.nom,
        cs.statut,
        cs.fond_initial,
        cs.attendu_especes,
        cs.compte_especes,
        cs.ecart,
        uo.nom_complet,
        uf.nom_complet,
        cs.note_ouverture,
        cs.note_fermeture,
        COALESCE(v.especes, 0),
        COALESCE(v.autres,  0),
        COALESCE(s.especes, 0),
        COALESCE(v.nb, 0)::INTEGER
      FROM cash_sessions cs
      JOIN warehouses w  ON w.id  = cs.warehouse_id
      LEFT JOIN shop_users uo ON uo.id = cs.ouverte_par
      LEFT JOIN shop_users uf ON uf.id = cs.fermee_par
      -- Ce qui est entré au comptoir, ce jour-là, dans cet entrepôt.
      LEFT JOIN LATERAL (
          SELECT
              COALESCE(SUM(sp.montant) FILTER (WHERE sp.moyen_paiement = 'cash'), 0) AS especes,
              COALESCE(SUM(sp.montant) FILTER (WHERE sp.moyen_paiement <> 'cash'), 0) AS autres,
              count(DISTINCT sa.id) AS nb
            FROM sale_payments sp
            JOIN sales sa ON sa.id = sp.sale_id
           WHERE sa.shop_id      = p_shop_id
             AND sa.warehouse_id = cs.warehouse_id
             AND sa.statut       = 'completee'
             AND (sa.created_at + p_decalage)::date = cs.jour
      ) v ON true
      -- Ce qui est sorti du tiroir en espèces le même jour. Les
      -- dépenses et les salaires ne portent pas d'entrepôt : ils sont
      -- comptés au niveau de la boutique, comme le fait déjà
      -- especes_attendues_session().
      LEFT JOIN LATERAL (
          SELECT
              COALESCE((SELECT SUM(e.montant) FROM expenses e
                         WHERE e.shop_id = p_shop_id AND NOT e.est_annule
                           AND e.moyen_paiement = 'cash'
                           AND e.date_depense = cs.jour), 0)
            + COALESCE((SELECT SUM(sal.montant_net) FROM salary_payments sal
                         WHERE sal.shop_id = p_shop_id AND NOT sal.est_annule
                           AND sal.moyen_paiement = 'cash'
                           AND sal.date_paiement = cs.jour), 0)
            + COALESCE((SELECT SUM(f.montant) FROM supplier_payments f
                         WHERE f.shop_id = p_shop_id
                           AND f.moyen_paiement = 'cash'
                           AND f.date_paiement = cs.jour), 0)
            AS especes
      ) s ON true
     WHERE cs.shop_id = p_shop_id
       AND cs.jour BETWEEN p_debut AND p_fin
     ORDER BY cs.jour DESC, w.nom;
$$;


ALTER FUNCTION "public"."journees_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."journees_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) IS 'Une ligne par journée de caisse : le fond, l''attendu, le compté, l''écart tel qu''il a été constaté, et ce qui s''est passé ce jour-là.';



CREATE OR REPLACE FUNCTION "public"."modifier_devis"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_client_id" "uuid", "p_objet" "text", "p_date_validite" "date", "p_remise_pct" numeric, "p_note_client" "text", "p_note_interne" "text", "p_lignes" "jsonb", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."modifier_devis"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_client_id" "uuid", "p_objet" "text", "p_date_validite" "date", "p_remise_pct" numeric, "p_note_client" "text", "p_note_interne" "text", "p_lignes" "jsonb", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."modifier_devis"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_client_id" "uuid", "p_objet" "text", "p_date_validite" "date", "p_remise_pct" numeric, "p_note_client" "text", "p_note_interne" "text", "p_lignes" "jsonb", "p_user_id" "uuid") IS 'Modifie un devis encore ouvert (brouillon ou envoyé) : lignes remplacées en bloc et totaux recalculés dans la même transaction. Un devis converti en facture est refusé.';



CREATE OR REPLACE FUNCTION "public"."modifier_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."modifier_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."modifier_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."modifier_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."modifier_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_date_paiement" "date", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."modifier_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_date_paiement" "date", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mouvements_caisse_jour"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval DEFAULT '01:00:00'::interval) RETURNS TABLE("jour" "date", "moyen" "text", "entrees" numeric, "sorties" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH mouvements AS (
        SELECT (s.created_at + p_decalage)::date AS jour,
               sp.moyen_paiement AS moyen, sp.montant AS montant, 'entree' AS sens
          FROM sale_payments sp
          JOIN sales s ON s.id = sp.sale_id
         WHERE sp.shop_id = p_shop_id AND s.statut = 'completee'

        UNION ALL
        SELECT fp.date_paiement, fp.moyen_paiement, fp.montant, 'entree'
          FROM facture_payments fp
         WHERE fp.shop_id = p_shop_id AND NOT fp.est_annule

        UNION ALL
        SELECT e.date_depense, e.moyen_paiement, e.montant, 'sortie'
          FROM expenses e
         WHERE e.shop_id = p_shop_id AND NOT e.est_annule

        UNION ALL
        SELECT sal.date_paiement, sal.moyen_paiement, sal.montant_net, 'sortie'
          FROM salary_payments sal
         WHERE sal.shop_id = p_shop_id AND NOT sal.est_annule

        UNION ALL
        SELECT f.date_paiement, f.moyen_paiement, f.montant, 'sortie'
          FROM supplier_payments f
         WHERE f.shop_id = p_shop_id
    )
    SELECT
        jour,
        moyen,
        COALESCE(SUM(montant) FILTER (WHERE sens = 'entree'), 0),
        COALESCE(SUM(montant) FILTER (WHERE sens = 'sortie'), 0)
      FROM mouvements
     WHERE jour BETWEEN p_debut AND p_fin
     GROUP BY jour, moyen
    HAVING SUM(montant) <> 0
     ORDER BY jour DESC, 3 DESC;
$$;


ALTER FUNCTION "public"."mouvements_caisse_jour"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mouvements_caisse_jour"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) IS 'Entrées et sorties d''une période, ventilées par journée et par moyen de paiement.';



CREATE OR REPLACE FUNCTION "public"."operation_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_type" "text", "p_montant" numeric, "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_champ TEXT;
    v_delta NUMERIC;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;

    -- Le type d'opération dit à la fois QUEL solde bouge et DANS QUEL
    -- SENS : c'est la seule table de correspondance du logiciel.
    CASE p_type
        WHEN 'credit_remboursement' THEN v_champ := 'credit_balance';  v_delta := -p_montant;
        WHEN 'credit_utilisation'   THEN v_champ := 'credit_balance';  v_delta :=  p_montant;
        WHEN 'advance_depot'        THEN v_champ := 'advance_balance'; v_delta :=  p_montant;
        WHEN 'advance_utilisation'  THEN v_champ := 'advance_balance'; v_delta := -p_montant;
        WHEN 'change_depot'         THEN v_champ := 'change_balance';  v_delta :=  p_montant;
        WHEN 'change_utilisation'   THEN v_champ := 'change_balance';  v_delta := -p_montant;
        ELSE RETURN jsonb_build_object('succes', false, 'erreur', 'Type d''opération invalide.');
    END CASE;

    RETURN appliquer_mouvement_solde_client(
        p_shop_id, p_client_id, v_champ, v_delta, p_type, p_note, p_user_id
    );
END;
$$;


ALTER FUNCTION "public"."operation_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_type" "text", "p_montant" numeric, "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ouvrir_session_caisse"("p_shop_id" "uuid", "p_warehouse_id" "uuid", "p_fond" numeric, "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."ouvrir_session_caisse"("p_shop_id" "uuid", "p_warehouse_id" "uuid", "p_fond" numeric, "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payer_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid", "p_date_paiement" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."payer_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid", "p_date_paiement" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payer_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_facture RECORD;
    v_pid     TEXT;
    v_paye    NUMERIC;
    v_restant NUMERIC;
    v_statut  TEXT;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;

    SELECT id, supplier_id, montant_paye, montant_restant, statut
    INTO v_facture
    FROM factures_fournisseurs
    WHERE id = p_facture_id AND shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Facture introuvable.');
    END IF;

    IF v_facture.statut = 'annulee' THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette facture est annulée.');
    END IF;

    IF p_montant > v_facture.montant_restant THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Le montant dépasse le restant dû (' || v_facture.montant_restant || ').');
    END IF;

    v_paye    := v_facture.montant_paye + p_montant;
    v_restant := v_facture.montant_restant - p_montant;
    v_statut  := CASE WHEN v_restant <= 0 THEN 'payee' ELSE 'partiellement_payee' END;

    SELECT generate_public_id(p_shop_id, 'SPAY') INTO v_pid;

    INSERT INTO supplier_payments (
        public_id, shop_id, supplier_id, facture_id,
        montant, moyen_paiement, reference, note, created_by
    ) VALUES (
        v_pid, p_shop_id, v_facture.supplier_id, p_facture_id,
        p_montant, p_moyen, NULLIF(p_reference, ''), NULLIF(p_note, ''), p_user_id
    );

    UPDATE factures_fournisseurs
    SET montant_paye = v_paye, montant_restant = v_restant,
        statut = v_statut, updated_at = NOW()
    WHERE id = p_facture_id;

    UPDATE suppliers
    SET solde_dû = solde_dû - p_montant
    WHERE id = v_facture.supplier_id AND shop_id = p_shop_id;

    RETURN jsonb_build_object(
        'succes', true, 'public_id', v_pid,
        'statut', v_statut, 'montant_restant', v_restant
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."payer_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payer_fournisseur"("p_shop_id" "uuid", "p_supplier_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_public_id TEXT;
  v_solde     NUMERIC;
BEGIN
  SELECT solde_dû INTO v_solde
  FROM suppliers
  WHERE id = p_supplier_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Fournisseur introuvable');
  END IF;

  IF p_montant > v_solde THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreur', 'Le montant dépasse le solde dû (' || v_solde || ')'
    );
  END IF;

  UPDATE suppliers
  SET solde_dû = solde_dû - p_montant
  WHERE id = p_supplier_id;

  SELECT generate_public_id(p_shop_id, 'SPAY') INTO v_public_id;

  INSERT INTO supplier_payments (
    public_id, shop_id, supplier_id,
    montant, moyen_paiement, reference,
    note, created_by
  ) VALUES (
    v_public_id, p_shop_id, p_supplier_id,
    p_montant, p_moyen,
    NULLIF(p_reference, ''),
    NULLIF(p_note, ''),
    p_user_id
  );

  RETURN jsonb_build_object('succes', true, 'nouveau_solde', v_solde - p_montant);
END;
$$;


ALTER FUNCTION "public"."payer_fournisseur"("p_shop_id" "uuid", "p_supplier_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prolonger_abonnement"("p_paiement_id" "uuid", "p_reference_transaction" "text" DEFAULT NULL::"text", "p_details_prestataire" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."abonnement_paiements"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."prolonger_abonnement"("p_paiement_id" "uuid", "p_reference_transaction" "text", "p_details_prestataire" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculer_statut_facture"("p_facture_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."recalculer_statut_facture"("p_facture_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."regler_retour_vente"("p_shop_id" "uuid", "p_retour_id" "uuid", "p_mode" "text", "p_note" "text", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."regler_retour_vente"("p_shop_id" "uuid", "p_retour_id" "uuid", "p_mode" "text", "p_note" "text", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."regler_retour_vente"("p_shop_id" "uuid", "p_retour_id" "uuid", "p_mode" "text", "p_note" "text", "p_user_id" "uuid") IS 'Traite la moitié FINANCIÈRE d''un retour client (décision D2 POS) : avance du client par défaut, remboursement en caisse, avoir à émettre, ou sans suite. La partie stock est faite par effectuer_retour_vente.';



CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rouvrir_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."rouvrir_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_boutique_en_service"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT CASE
        WHEN (auth.jwt() -> 'user_metadata' ->> 'type_acteur') IS DISTINCT FROM 'shop' THEN true
        ELSE EXISTS (
            SELECT 1 FROM shops s
            WHERE s.id = ((auth.jwt() -> 'user_metadata') ->> 'shop_id')::uuid
              AND s.est_active
              AND (s.plan_expire_le IS NULL OR s.plan_expire_le > now())
        )
    END
$$;


ALTER FUNCTION "public"."session_boutique_en_service"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tresorerie_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval DEFAULT '01:00:00'::interval) RETURNS TABLE("entrees_pos" numeric, "entrees_factures" numeric, "total_entrees" numeric, "sorties_depenses" numeric, "sorties_salaires" numeric, "sorties_fournisseurs" numeric, "total_sorties" numeric, "resultat" numeric, "ventes_facturees" numeric, "non_encaisse" numeric, "stock_pertes" numeric, "stock_gains" numeric, "resultat_economique" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH ca AS (
        SELECT * FROM ca_periode(p_shop_id, p_debut, p_fin, p_decalage)
    ),
    dep AS (
        SELECT COALESCE(SUM(e.montant), 0) AS montant
          FROM expenses e
         WHERE e.shop_id = p_shop_id
           AND NOT e.est_annule
           AND e.date_depense BETWEEN p_debut AND p_fin
    ),
    sal AS (
        -- Sur la date de VERSEMENT : un salaire de juin réglé en
        -- juillet sort de la caisse de juillet.
        SELECT COALESCE(SUM(s.montant_net), 0) AS montant
          FROM salary_payments s
         WHERE s.shop_id = p_shop_id
           AND NOT s.est_annule
           AND s.date_paiement BETWEEN p_debut AND p_fin
    ),
    four AS (
        SELECT COALESCE(SUM(f.montant), 0) AS montant
          FROM supplier_payments f
         WHERE f.shop_id = p_shop_id
           AND f.date_paiement BETWEEN p_debut AND p_fin
    ),
    inv AS (
        SELECT COALESCE(SUM(i.valeur_pertes), 0) AS pertes,
               COALESCE(SUM(i.valeur_gains),  0) AS gains
          FROM inventories i
         WHERE i.shop_id = p_shop_id
           AND i.statut  = 'valide'
           AND (i.valide_le + p_decalage)::date BETWEEN p_debut AND p_fin
    )
    SELECT
        ca.encaisse_pos,
        ca.encaisse_factures,
        ca.encaisse_total,
        dep.montant,
        sal.montant,
        four.montant,
        dep.montant + sal.montant + four.montant,
        ca.encaisse_total - (dep.montant + sal.montant + four.montant),
        ca.ca_facture,
        ca.ca_facture - ca.encaisse_pos,
        inv.pertes,
        inv.gains,
        ca.encaisse_total - (dep.montant + sal.montant + four.montant)
            + (inv.gains - inv.pertes)
      FROM ca, dep, sal, four, inv;
$$;


ALTER FUNCTION "public"."tresorerie_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."tresorerie_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) IS 'Entrées, sorties et résultat d''une période. Les écarts d''inventaire sont rendus à part : ce n''est pas de la trésorerie.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."valeur_stock"("p_shop_id" "uuid", "p_warehouse_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("product_id" "uuid", "warehouse_id" "uuid", "quantite" numeric, "prix_unitaire" numeric, "base_prix" "text", "valeur" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT
        p.id,
        sl.warehouse_id,
        sl.quantite,
        COALESCE(dernier.prix_unitaire, p.prix_achat),
        CASE WHEN dernier.prix_unitaire IS NULL THEN 'courant' ELSE 'paye' END,
        sl.quantite * COALESCE(dernier.prix_unitaire, p.prix_achat)
      FROM products p
      JOIN stock_levels sl ON sl.product_id = p.id
      LEFT JOIN LATERAL (
          SELECT ri.prix_unitaire
            FROM reception_items ri
            JOIN receptions r ON r.id = ri.reception_id
           WHERE ri.product_id = p.id
             AND ri.shop_id    = p_shop_id
           ORDER BY r.created_at DESC
           LIMIT 1
      ) dernier ON true
     WHERE p.shop_id  = p_shop_id
       AND p.est_actif
       AND (p_warehouse_id IS NULL OR sl.warehouse_id = p_warehouse_id);
$$;


ALTER FUNCTION "public"."valeur_stock"("p_shop_id" "uuid", "p_warehouse_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."valeur_stock"("p_shop_id" "uuid", "p_warehouse_id" "uuid") IS 'Valeur du stock au dernier prix réellement payé à la réception, avec la base retenue par ligne (payé / courant).';



CREATE OR REPLACE FUNCTION "public"."valider_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_mode" "text" DEFAULT 'ecart'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_warehouse    UUID;
    v_item         RECORD;
    v_stock_actuel NUMERIC;
    v_delta        NUMERIC;
    v_prix         NUMERIC;
    v_valeur       NUMERIC;
    v_res          JSONB;
    v_pertes       NUMERIC := 0;
    v_gains        NUMERIC := 0;
    v_nb_neg       INTEGER := 0;
    v_nb_pos       INTEGER := 0;
    v_non_comptes  INTEGER;
    v_derives      JSONB   := '[]'::JSONB;
BEGIN
    IF p_mode NOT IN ('ecart', 'absolu') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Mode de validation inconnu.');
    END IF;

    SELECT warehouse_id INTO v_warehouse
    FROM inventories
    WHERE id = p_inventory_id AND shop_id = p_shop_id AND statut = 'en_cours';

    IF v_warehouse IS NULL THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', 'Inventaire introuvable ou déjà traité.');
    END IF;

    -- Contrôle de complétude (était côté TypeScript, donc contournable).
    SELECT COUNT(*) INTO v_non_comptes
    FROM inventory_items
    WHERE inventory_id = p_inventory_id AND quantite_reelle IS NULL;

    IF v_non_comptes > 0 THEN
        RETURN jsonb_build_object('succes', false,
            'erreur', v_non_comptes || ' article(s) n''ont pas encore été comptés. ' ||
                      'Complétez le comptage avant de valider.');
    END IF;

    FOR v_item IN
        SELECT ii.id, ii.product_id, ii.quantite_theorique, ii.quantite_reelle, ii.ecart,
               p.nom AS produit_nom, p.prix_achat
        FROM inventory_items ii
        JOIN products p ON p.id = ii.product_id
        WHERE ii.inventory_id = p_inventory_id
    LOOP
        -- Stock réel au moment de la validation (verrou posé plus bas
        -- par appliquer_mouvement_stock).
        SELECT quantite INTO v_stock_actuel
        FROM stock_levels
        WHERE product_id = v_item.product_id AND warehouse_id = v_warehouse;

        v_stock_actuel := COALESCE(v_stock_actuel, 0);

        -- Dérive = le stock a bougé depuis le lancement du comptage.
        IF v_stock_actuel <> v_item.quantite_theorique THEN
            v_derives := v_derives || jsonb_build_object(
                'produit',    v_item.produit_nom,
                'theorique',  v_item.quantite_theorique,
                'actuel',     v_stock_actuel,
                'compte',     v_item.quantite_reelle
            );
        END IF;

        IF p_mode = 'ecart' THEN
            -- On applique la DIFFÉRENCE constatée au comptage : les
            -- ventes de la journée restent déduites.
            v_delta := COALESCE(v_item.ecart, 0);
        ELSE
            v_delta := v_item.quantite_reelle - v_stock_actuel;
        END IF;

        IF v_delta <> 0 THEN
            v_res := appliquer_mouvement_stock(
                p_shop_id, v_item.product_id, v_warehouse,
                v_delta, 'inventaire',
                'inventory', p_inventory_id, NULL,
                'Écart d''inventaire', p_user_id, FALSE
            );

            IF NOT (v_res->>'succes')::BOOLEAN THEN
                RAISE EXCEPTION '%', v_res->>'erreur';
            END IF;
        END IF;

        -- Valorisation symétrique : pertes ET gains, au prix d'achat
        -- figé maintenant. Aucune écriture de trésorerie.
        v_prix   := COALESCE(v_item.prix_achat, 0);
        v_valeur := COALESCE(v_item.ecart, 0) * v_prix;

        UPDATE inventory_items
        SET prix_achat_unitaire = v_prix,
            valeur_ecart        = v_valeur
        WHERE id = v_item.id;

        IF COALESCE(v_item.ecart, 0) < 0 THEN
            v_nb_neg := v_nb_neg + 1;
            v_pertes := v_pertes + ABS(v_valeur);
        ELSIF COALESCE(v_item.ecart, 0) > 0 THEN
            v_nb_pos := v_nb_pos + 1;
            v_gains  := v_gains + v_valeur;
        END IF;
    END LOOP;

    UPDATE inventories SET
        statut             = 'valide',
        valide_par         = p_user_id,
        valide_le          = NOW(),
        mode_validation    = p_mode,
        valeur_pertes      = v_pertes,
        valeur_gains       = v_gains,
        nb_ecarts_negatifs = v_nb_neg,
        nb_ecarts_positifs = v_nb_pos
    WHERE id = p_inventory_id;

    RETURN jsonb_build_object(
        'succes',        true,
        'mode',          p_mode,
        'valeur_pertes', v_pertes,
        'valeur_gains',  v_gains,
        'valeur_nette',  v_gains - v_pertes,
        'nb_negatifs',   v_nb_neg,
        'nb_positifs',   v_nb_pos,
        'derives',       v_derives
    );
EXCEPTION WHEN OTHERS THEN
    -- Stock, valorisation et statut sont annulés ensemble.
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."valider_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ventilation_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval DEFAULT '01:00:00'::interval) RETURNS TABLE("moyen" "text", "entrees_periode" numeric, "sorties_periode" numeric, "entrees_cumul" numeric, "sorties_cumul" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    WITH mouvements AS (
        -- ENTRÉES ────────────────────────────────────────────
        -- Encaissements au comptoir : c'est la ligne de règlement qui
        -- porte le moyen, pas la vente.
        SELECT sp.moyen_paiement            AS moyen,
               sp.montant                   AS montant,
               'entree'                     AS sens,
               (s.created_at + p_decalage)::date AS jour
          FROM sale_payments sp
          JOIN sales s ON s.id = sp.sale_id
         WHERE sp.shop_id = p_shop_id
           AND s.statut   = 'completee'

        UNION ALL
        -- Règlements de facture, sur date_paiement — la date réelle.
        SELECT fp.moyen_paiement, fp.montant, 'entree', fp.date_paiement
          FROM facture_payments fp
         WHERE fp.shop_id = p_shop_id
           AND NOT fp.est_annule

        -- SORTIES ────────────────────────────────────────────
        UNION ALL
        SELECT e.moyen_paiement, e.montant, 'sortie', e.date_depense
          FROM expenses e
         WHERE e.shop_id = p_shop_id
           AND NOT e.est_annule

        UNION ALL
        SELECT sal.moyen_paiement, sal.montant_net, 'sortie', sal.date_paiement
          FROM salary_payments sal
         WHERE sal.shop_id = p_shop_id
           AND NOT sal.est_annule

        UNION ALL
        SELECT f.moyen_paiement, f.montant, 'sortie', f.date_paiement
          FROM supplier_payments f
         WHERE f.shop_id = p_shop_id
    )
    SELECT
        moyen,
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'entree' AND jour BETWEEN p_debut AND p_fin), 0),
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'sortie' AND jour BETWEEN p_debut AND p_fin), 0),
        -- Cumul arrêté à la FIN de la période affichée : en consultant
        -- un mois passé, on voit le solde tel qu'il était alors.
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'entree' AND jour <= p_fin), 0),
        COALESCE(SUM(montant) FILTER (
            WHERE sens = 'sortie' AND jour <= p_fin), 0)
      FROM mouvements
     GROUP BY moyen
     ORDER BY
        COALESCE(SUM(montant) FILTER (WHERE sens = 'entree' AND jour <= p_fin), 0)
      - COALESCE(SUM(montant) FILTER (WHERE sens = 'sortie' AND jour <= p_fin), 0) DESC;
$$;


ALTER FUNCTION "public"."ventilation_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."abonnement_alertes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "palier" "text" NOT NULL,
    "echeance" timestamp with time zone NOT NULL,
    "email" "text" NOT NULL,
    "succes" boolean NOT NULL,
    "erreur" "text",
    "envoye_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abonnement_alertes" OWNER TO "postgres";


COMMENT ON TABLE "public"."abonnement_alertes" IS 'Alertes d''expiration envoyées par le cron. Une ligne réussie par (boutique, palier, échéance) : jamais deux fois le même e-mail.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid",
    "user_id" "uuid",
    "user_public_id" "text",
    "user_nom" "text",
    "type_acteur" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "reference_public_id" "text",
    "details_json" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_logs_type_acteur_check" CHECK (("type_acteur" = ANY (ARRAY['platform'::"text", 'shop'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avoirs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "motif" "text" NOT NULL,
    "montant" numeric(15,2) NOT NULL,
    "est_applique" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "montant_deduit" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_avance" numeric(15,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."avoirs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."avoirs"."montant_deduit" IS 'Part de l''avoir venue en déduction du reste à payer de la facture.';



COMMENT ON COLUMN "public"."avoirs"."montant_avance" IS 'Part de l''avoir versée au solde d''avance du client (facture déjà réglée).';



CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "description" "text",
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "jour" "date" DEFAULT CURRENT_DATE NOT NULL,
    "statut" "text" DEFAULT 'ouverte'::"text" NOT NULL,
    "fond_initial" numeric(15,2) DEFAULT 0 NOT NULL,
    "compte_especes" numeric(15,2),
    "attendu_especes" numeric(15,2),
    "ecart" numeric(15,2),
    "note_ouverture" "text",
    "note_fermeture" "text",
    "ouverte_par" "uuid",
    "ouverte_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fermee_par" "uuid",
    "fermee_le" timestamp with time zone,
    CONSTRAINT "cash_sessions_statut_check" CHECK (("statut" = ANY (ARRAY['ouverte'::"text", 'fermee'::"text"])))
);


ALTER TABLE "public"."cash_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."cash_sessions" IS 'Session de caisse par journée et par entrepôt (décision D1 du module POS) : fond initial à l''ouverture, comptage à la fermeture, écart constaté. Ce n''est pas une session par caissier — une boutique de quartier a un tiroir, pas un caissier attitré.';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "nom" "text" NOT NULL,
    "description" "text",
    "couleur" "text",
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_balance_operations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type_operation" "text" NOT NULL,
    "montant" numeric(15,2) NOT NULL,
    "solde_avant" numeric(15,2) NOT NULL,
    "solde_apres" numeric(15,2) NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_balance_operations_type_operation_check" CHECK (("type_operation" = ANY (ARRAY['credit_remboursement'::"text", 'credit_utilisation'::"text", 'advance_depot'::"text", 'advance_utilisation'::"text", 'change_depot'::"text", 'change_utilisation'::"text", 'avoir_facture'::"text", 'vente_credit'::"text", 'vente_avance'::"text", 'vente_monnaie'::"text", 'regularisation'::"text"])))
);


ALTER TABLE "public"."client_balance_operations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_balance_operations"."type_operation" IS 'Origine du mouvement. Tout mouvement de solde doit en produire un : un solde sans opération est un solde inexplicable.';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "telephone" "text",
    "email" "text",
    "adresse" "text",
    "est_anonyme" boolean DEFAULT false NOT NULL,
    "credit_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "advance_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "change_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ville" "text",
    "pays" "text",
    "site_web" "text",
    "ifu" "text",
    "rccm" "text",
    "plafond_credit" numeric(15,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."plafond_credit" IS 'Encours de crédit au-delà duquel la vente AVERTIT (jamais ne bloque, décision D2). 0 = pas de limite.';



CREATE TABLE IF NOT EXISTS "public"."devis" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "statut" "text" DEFAULT 'brouillon'::"text" NOT NULL,
    "date_devis" "date" DEFAULT CURRENT_DATE NOT NULL,
    "date_validite" "date",
    "objet" "text",
    "montant_ht" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ttc" numeric(15,2) DEFAULT 0 NOT NULL,
    "remise_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_val" numeric(15,2) DEFAULT 0 NOT NULL,
    "note_client" "text",
    "note_interne" "text",
    "converti_en_facture" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "devis_statut_check" CHECK (("statut" = ANY (ARRAY['brouillon'::"text", 'envoye'::"text", 'accepte'::"text", 'refuse'::"text", 'expire'::"text"])))
);


ALTER TABLE "public"."devis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devis_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "devis_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "designation" "text" NOT NULL,
    "quantite" numeric(15,3) DEFAULT 1 NOT NULL,
    "prix_unitaire" numeric(15,2) NOT NULL,
    "remise_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_val" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ht" numeric(15,2) NOT NULL,
    "tva_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ttc" numeric(15,2) NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."devis_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "nom_complet" "text" NOT NULL,
    "poste" "text",
    "salaire_base" numeric(15,2) DEFAULT 0 NOT NULL,
    "telephone" "text",
    "date_embauche" "date",
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "desactive_le" timestamp with time zone
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "description" "text",
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "libelle" "text" NOT NULL,
    "montant" numeric(15,2) NOT NULL,
    "moyen_paiement" "text" DEFAULT 'cash'::"text" NOT NULL,
    "reference" "text",
    "date_depense" "date" DEFAULT CURRENT_DATE NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "est_annule" boolean DEFAULT false NOT NULL,
    "annule_le" timestamp with time zone,
    "annule_par" "uuid",
    "motif_annulation" "text",
    "modifie_le" timestamp with time zone,
    "modifie_par" "uuid"
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."expenses"."est_annule" IS 'Écriture annulée : reste visible et barrée à l''écran, mais EXCLUE de tous les totaux et rapports.';



CREATE TABLE IF NOT EXISTS "public"."facture_fournisseur_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "designation" "text" NOT NULL,
    "quantite" numeric(15,3) DEFAULT 1 NOT NULL,
    "prix_unitaire" numeric(15,2) DEFAULT 0 NOT NULL,
    "tva_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "montant_ht" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ttc" numeric(15,2) DEFAULT 0 NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."facture_fournisseur_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facture_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "designation" "text" NOT NULL,
    "quantite" numeric(15,3) DEFAULT 1 NOT NULL,
    "prix_unitaire" numeric(15,2) NOT NULL,
    "remise_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_val" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ht" numeric(15,2) NOT NULL,
    "tva_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ttc" numeric(15,2) NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."facture_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facture_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "facture_id" "uuid" NOT NULL,
    "moyen_paiement" "text" NOT NULL,
    "montant" numeric(15,2) NOT NULL,
    "reference" "text",
    "note" "text",
    "date_paiement" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "est_annule" boolean DEFAULT false NOT NULL,
    "annule_le" timestamp with time zone,
    "annule_par" "uuid",
    "motif_annulation" "text",
    "modifie_le" timestamp with time zone,
    "modifie_par" "uuid"
);


ALTER TABLE "public"."facture_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."facture_payments"."est_annule" IS 'Règlement annulé : reste visible et barré, mais EXCLU des totaux et du montant payé de la facture.';



CREATE TABLE IF NOT EXISTS "public"."factures" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "devis_id" "uuid",
    "statut" "text" DEFAULT 'emise'::"text" NOT NULL,
    "date_facture" "date" DEFAULT CURRENT_DATE NOT NULL,
    "date_echeance" "date",
    "objet" "text",
    "montant_ht" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ttc" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_paye" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_restant" numeric(15,2) DEFAULT 0 NOT NULL,
    "remise_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_val" numeric(15,2) DEFAULT 0 NOT NULL,
    "note_client" "text",
    "note_interne" "text",
    "est_immutable" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "annule_le" timestamp with time zone,
    "annule_par" "uuid",
    "motif_annulation" "text",
    CONSTRAINT "factures_statut_check" CHECK (("statut" = ANY (ARRAY['emise'::"text", 'partiellement_payee'::"text", 'payee'::"text", 'annulee'::"text"])))
);


ALTER TABLE "public"."factures" OWNER TO "postgres";


COMMENT ON COLUMN "public"."factures"."statut" IS 'État de la facture. Le RETARD n''en fait pas partie : il se déduit de date_echeance à la lecture (décision D1), sinon le statut serait faux dès le lendemain de son écriture.';



CREATE TABLE IF NOT EXISTS "public"."factures_fournisseurs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'non_payee'::"text" NOT NULL,
    "date_facture" "date" DEFAULT CURRENT_DATE NOT NULL,
    "date_echeance" "date",
    "reference_fourn" "text",
    "warehouse_id" "uuid",
    "montant_ht" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ttc" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_paye" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_restant" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "a_completer" boolean DEFAULT false NOT NULL,
    CONSTRAINT "factures_fournisseurs_statut_check" CHECK (("statut" = ANY (ARRAY['non_payee'::"text", 'partiellement_payee'::"text", 'payee'::"text", 'annulee'::"text"])))
);


ALTER TABLE "public"."factures_fournisseurs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."factures_fournisseurs"."a_completer" IS 'Facture créée automatiquement par une réception sans document : montants et références restent à compléter.';



CREATE TABLE IF NOT EXISTS "public"."inventories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'en_cours'::"text" NOT NULL,
    "notes" "text",
    "valide_par" "uuid",
    "valide_le" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nom" "text",
    "valeur_pertes" numeric(15,2) DEFAULT 0 NOT NULL,
    "valeur_gains" numeric(15,2) DEFAULT 0 NOT NULL,
    "nb_ecarts_negatifs" integer DEFAULT 0 NOT NULL,
    "nb_ecarts_positifs" integer DEFAULT 0 NOT NULL,
    "mode_validation" "text",
    "annule_par" "uuid",
    "annule_le" timestamp with time zone,
    "motif_annulation" "text",
    CONSTRAINT "inventories_mode_validation_check" CHECK ((("mode_validation" IS NULL) OR ("mode_validation" = ANY (ARRAY['ecart'::"text", 'absolu'::"text"])))),
    CONSTRAINT "inventories_statut_check" CHECK (("statut" = ANY (ARRAY['en_cours'::"text", 'valide'::"text", 'annule'::"text"])))
);


ALTER TABLE "public"."inventories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantite_theorique" numeric(15,3) DEFAULT 0 NOT NULL,
    "quantite_reelle" numeric(15,3),
    "ecart" numeric(15,3),
    "note" "text",
    "prix_achat_unitaire" numeric(15,2),
    "valeur_ecart" numeric(15,2)
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_items"."prix_achat_unitaire" IS 'Prix d''achat figé au moment de la validation (sert à valoriser l''écart).';



COMMENT ON COLUMN "public"."inventory_items"."valeur_ecart" IS 'ecart × prix_achat_unitaire. Négatif = perte, positif = gain.';



CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "nom_complet" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "text" NOT NULL,
    "est_actif" boolean DEFAULT true NOT NULL,
    "tentatives_echecs" integer DEFAULT 0 NOT NULL,
    "est_bloque" boolean DEFAULT false NOT NULL,
    "bloque_le" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_admins_role_check" CHECK (("role" = ANY (ARRAY['super_platform_admin'::"text", 'platform_agent'::"text"])))
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_id_counters" (
    "prefix" "text" NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_id_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "expire_le" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "derniere_activite" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "ancien_prix_achat" numeric(15,2),
    "nouveau_prix_achat" numeric(15,2),
    "ancien_prix_vente" numeric(15,2),
    "nouveau_prix_vente" numeric(15,2),
    "modifie_par" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "attribute_type" "text" NOT NULL,
    "color_hex" "text",
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_variants_attribute_type_check" CHECK (("attribute_type" = ANY (ARRAY['color'::"text", 'size'::"text", 'storage'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."product_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "brand_id" "uuid",
    "nom" "text" NOT NULL,
    "description" "text",
    "type_produit" "text" DEFAULT 'simple'::"text" NOT NULL,
    "sku" "text",
    "code_barres" "text",
    "unite" "text" DEFAULT 'pièce'::"text" NOT NULL,
    "photo_url" "text",
    "prix_achat" numeric(15,2) DEFAULT 0 NOT NULL,
    "prix_vente" numeric(15,2) DEFAULT 0 NOT NULL,
    "prix_gros" numeric(15,2),
    "prix_minimum" numeric(15,2),
    "tva_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_max_pct" numeric(5,2),
    "seuil_alerte" integer DEFAULT 5 NOT NULL,
    "est_actif" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type_config_json" "jsonb",
    "unit_config_json" "jsonb",
    "necessite_imei" boolean DEFAULT false NOT NULL,
    "necessite_serie" boolean DEFAULT false NOT NULL,
    "garantie_mois" integer,
    "est_retournable" boolean DEFAULT true NOT NULL,
    CONSTRAINT "products_type_produit_check" CHECK (("type_produit" = ANY (ARRAY['simple'::"text", 'ponderal'::"text", 'kit'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_id_counters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "prefix" "text" NOT NULL,
    "last_value" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."public_id_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "designation" "text" NOT NULL,
    "quantite_cmd" numeric(15,3) DEFAULT 1 NOT NULL,
    "quantite_recue" numeric(15,3) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ligne" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'brouillon'::"text" NOT NULL,
    "date_commande" "date" DEFAULT CURRENT_DATE NOT NULL,
    "date_livraison" "date",
    "montant_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "warehouse_id" "uuid",
    "soumis_le" timestamp with time zone,
    "soumis_par" "uuid",
    "annule_le" timestamp with time zone,
    "annule_par" "uuid",
    "motif_annulation" "text",
    CONSTRAINT "purchase_orders_statut_check" CHECK (("statut" = ANY (ARRAY['brouillon'::"text", 'soumis'::"text", 'recu_partiel'::"text", 'recu_total'::"text", 'annule'::"text"])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchase_orders"."statut" IS 'brouillon : en préparation · soumis : envoyé au fournisseur · recu_partiel / recu_total : réceptionné · annule.';



CREATE TABLE IF NOT EXISTS "public"."reception_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "reception_id" "uuid" NOT NULL,
    "poi_id" "uuid",
    "product_id" "uuid",
    "designation" "text" NOT NULL,
    "quantite_recue" numeric(15,3) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reception_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "po_id" "uuid",
    "warehouse_id" "uuid" NOT NULL,
    "date_reception" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supplier_id" "uuid",
    "montant_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "facture_id" "uuid"
);


ALTER TABLE "public"."receptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "periode_mois" integer NOT NULL,
    "periode_annee" integer NOT NULL,
    "salaire_base" numeric(15,2) NOT NULL,
    "bonus" numeric(15,2) DEFAULT 0 NOT NULL,
    "deductions" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_net" numeric(15,2) NOT NULL,
    "moyen_paiement" "text" DEFAULT 'cash'::"text" NOT NULL,
    "reference" "text",
    "note" "text",
    "date_paiement" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "est_annule" boolean DEFAULT false NOT NULL,
    "annule_le" timestamp with time zone,
    "annule_par" "uuid",
    "motif_annulation" "text",
    "modifie_le" timestamp with time zone,
    "modifie_par" "uuid",
    CONSTRAINT "salary_payments_periode_mois_check" CHECK ((("periode_mois" >= 1) AND ("periode_mois" <= 12)))
);


ALTER TABLE "public"."salary_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."salary_payments"."periode_mois" IS 'Mois TRAVAILLÉ (étiquette). Ne jamais filtrer un rapport financier dessus : utiliser date_paiement.';



COMMENT ON COLUMN "public"."salary_payments"."periode_annee" IS 'Année TRAVAILLÉE (étiquette). Ne jamais filtrer un rapport financier dessus : utiliser date_paiement.';



COMMENT ON COLUMN "public"."salary_payments"."date_paiement" IS 'Date réelle de sortie de caisse. Clé de rattachement comptable du salaire.';



COMMENT ON COLUMN "public"."salary_payments"."est_annule" IS 'Versement annulé : reste visible et barré à l''écran, mais EXCLU des totaux, du cumul « versé » et du rapport de paie.';



CREATE TABLE IF NOT EXISTS "public"."sale_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "quantite" numeric(15,3) NOT NULL,
    "prix_unitaire" numeric(15,2) NOT NULL,
    "remise_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_val" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ligne" numeric(15,2) NOT NULL,
    "tva_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "imei" "text",
    "note" "text"
);


ALTER TABLE "public"."sale_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sale_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "sale_id" "uuid" NOT NULL,
    "moyen_paiement" "text" NOT NULL,
    "montant" numeric(15,2) NOT NULL,
    "reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sale_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sale_return_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "sale_return_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantite" numeric(15,3) NOT NULL,
    "prix_unitaire" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ligne" numeric(15,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "sale_return_items_quantite_check" CHECK (("quantite" > (0)::numeric))
);


ALTER TABLE "public"."sale_return_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sale_returns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "sale_id" "uuid",
    "client_id" "uuid",
    "warehouse_id" "uuid" NOT NULL,
    "motif" "text" NOT NULL,
    "montant" numeric(15,2) DEFAULT 0 NOT NULL,
    "reglement" "text" DEFAULT 'a_traiter'::"text" NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sale_returns_reglement_check" CHECK (("reglement" = ANY (ARRAY['a_traiter'::"text", 'avance'::"text", 'avoir'::"text", 'rembourse'::"text", 'sans_suite'::"text"])))
);


ALTER TABLE "public"."sale_returns" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sale_returns"."reglement" IS 'Issue financière du retour : a_traiter (par défaut à la création), avance (porté au solde du client), rembourse (sortie de caisse), avoir (à émettre depuis la facture), sans_suite. La partie stock est indépendante.';



CREATE TABLE IF NOT EXISTS "public"."sales" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "warehouse_id" "uuid" NOT NULL,
    "vendeur_id" "uuid",
    "statut" "text" DEFAULT 'completee'::"text" NOT NULL,
    "montant_brut" numeric(15,2) DEFAULT 0 NOT NULL,
    "remise_globale_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "remise_globale_val" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_net" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_tva" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_recu" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_rendu" numeric(15,2) DEFAULT 0 NOT NULL,
    "credit_utilise" numeric(15,2) DEFAULT 0 NOT NULL,
    "advance_utilise" numeric(15,2) DEFAULT 0 NOT NULL,
    "change_utilise" numeric(15,2) DEFAULT 0 NOT NULL,
    "credit_accorde" numeric(15,2) DEFAULT 0 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "annule_le" timestamp with time zone,
    "annule_par" "uuid",
    "motif_annulation" "text",
    CONSTRAINT "sales_statut_check" CHECK (("statut" = ANY (ARRAY['completee'::"text", 'annulee'::"text", 'remboursee'::"text"])))
);


ALTER TABLE "public"."sales" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sales"."statut" IS 'completee | annulee. Une vente annulée reste visible et conserve son numéro, mais son stock est rendu, ses soldes client repris, et elle sort de tous les totaux.';



CREATE TABLE IF NOT EXISTS "public"."shop_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "expire_le" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "derniere_activite" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_user_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "text" NOT NULL,
    "accorde_par" "uuid",
    "accorde_le" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shop_user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shop_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "nom_complet" "text" NOT NULL,
    "identifiant" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "text" NOT NULL,
    "tentatives_echecs" integer DEFAULT 0 NOT NULL,
    "est_bloque" boolean DEFAULT false NOT NULL,
    "bloque_le" timestamp with time zone,
    "est_actif" boolean DEFAULT true NOT NULL,
    "desactive_le" timestamp with time zone,
    "preference_theme" "text" DEFAULT 'systeme'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shop_users_preference_theme_check" CHECK (("preference_theme" = ANY (ARRAY['clair'::"text", 'sombre'::"text", 'systeme'::"text"]))),
    CONSTRAINT "shop_users_role_check" CHECK (("role" = ANY (ARRAY['super_admin_boutique'::"text", 'admin_boutique'::"text", 'vendeur'::"text", 'stock_manager'::"text", 'comptable'::"text"])))
);


ALTER TABLE "public"."shop_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "nom" "text" NOT NULL,
    "logo_url" "text",
    "adresse" "text",
    "ville" "text",
    "pays" "text" DEFAULT 'Bénin'::"text" NOT NULL,
    "telephone_1" "text" NOT NULL,
    "telephone_2" "text",
    "email" "text",
    "site_web" "text",
    "ifu" "text",
    "rccm" "text",
    "devise" "text" DEFAULT 'FCFA'::"text" NOT NULL,
    "remise_max_pct" numeric(5,2) DEFAULT 15.00 NOT NULL,
    "message_pied_facture" "text",
    "message_recu_thermique" "text",
    "plan" "text" DEFAULT 'essai'::"text" NOT NULL,
    "plan_expire_le" timestamp with time zone,
    "est_active" boolean DEFAULT true NOT NULL,
    "activation_manuelle" boolean DEFAULT false NOT NULL,
    "note_activation" "text",
    "active_par" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "autoriser_stock_negatif" boolean DEFAULT false NOT NULL,
    CONSTRAINT "shops_plan_check" CHECK (("plan" = ANY (ARRAY['essai'::"text", 'starter'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shops"."note_activation" IS 'Note libre de l''agent plateforme sur une activation manuelle. Ne JAMAIS y écrire d''identifiant ni de mot de passe.';



COMMENT ON COLUMN "public"."shops"."autoriser_stock_negatif" IS 'Décision D3 du module POS. FALSE (défaut) : une vente qui ferait passer le stock sous zéro est refusée. TRUE : elle passe, et l''écart devient visible à l''inventaire. Jamais un choix silencieux : la vente forcée laisse une note sur son mouvement.';



CREATE TABLE IF NOT EXISTS "public"."stock_adjustment_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "adjustment_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantite_avant" numeric(15,3) DEFAULT 0 NOT NULL,
    "quantite_apres" numeric(15,3) DEFAULT 0 NOT NULL,
    "ecart" numeric(15,3) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."stock_adjustment_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_adjustments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "motif" "text",
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stock_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_levels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "quantite" numeric(15,3) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stock_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "type_mouvement" "text" NOT NULL,
    "quantite" numeric(15,3) NOT NULL,
    "quantite_avant" numeric(15,3) NOT NULL,
    "quantite_apres" numeric(15,3) NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "reference_public_id" "text",
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movements_type_mouvement_check" CHECK (("type_mouvement" = ANY (ARRAY['entree_initiale'::"text", 'vente'::"text", 'retour_vente'::"text", 'reception'::"text", 'retour_fournisseur'::"text", 'transfert_sortie'::"text", 'transfert_entree'::"text", 'ajustement_positif'::"text", 'ajustement_negatif'::"text", 'inventaire'::"text"])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_transfer_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantite" numeric(15,3) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."stock_transfer_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_transfers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "warehouse_from" "uuid" NOT NULL,
    "warehouse_to" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'en_cours'::"text" NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "diff_warehouses" CHECK (("warehouse_from" <> "warehouse_to")),
    CONSTRAINT "stock_transfers_statut_check" CHECK (("statut" = ANY (ARRAY['en_cours'::"text", 'valide'::"text", 'annule'::"text"])))
);


ALTER TABLE "public"."stock_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "purchase_order_id" "uuid",
    "montant" numeric(15,2) NOT NULL,
    "moyen_paiement" "text" DEFAULT 'cash'::"text" NOT NULL,
    "reference" "text",
    "date_paiement" "date" DEFAULT CURRENT_DATE NOT NULL,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "facture_id" "uuid"
);


ALTER TABLE "public"."supplier_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_return_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "supplier_return_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "designation" "text" NOT NULL,
    "quantite" numeric(15,3) DEFAULT 0 NOT NULL,
    "prix_unitaire" numeric(15,2) DEFAULT 0 NOT NULL,
    "montant_ligne" numeric(15,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."supplier_return_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_returns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "motif" "text",
    "montant" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "warehouse_id" "uuid",
    "note" "text"
);


ALTER TABLE "public"."supplier_returns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "nom_contact" "text",
    "poste_contact" "text",
    "telephone" "text",
    "email" "text",
    "adresse" "text",
    "ville" "text",
    "pays" "text",
    "ifu" "text",
    "rccm" "text",
    "notes" "text",
    "solde_dû" numeric(15,2) DEFAULT 0 NOT NULL,
    "est_actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "public_id" "text" NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "description" "text",
    "adresse" "text",
    "est_actif" boolean DEFAULT true NOT NULL,
    "est_defaut" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


ALTER TABLE ONLY "public"."abonnement_alertes"
    ADD CONSTRAINT "abonnement_alertes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."abonnement_alertes"
    ADD CONSTRAINT "abonnement_alertes_shop_id_palier_echeance_key" UNIQUE ("shop_id", "palier", "echeance");



ALTER TABLE ONLY "public"."abonnement_paiements"
    ADD CONSTRAINT "abonnement_paiements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."abonnement_paiements"
    ADD CONSTRAINT "abonnement_paiements_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avoirs"
    ADD CONSTRAINT "avoirs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avoirs"
    ADD CONSTRAINT "avoirs_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."client_balance_operations"
    ADD CONSTRAINT "client_balance_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."devis_items"
    ADD CONSTRAINT "devis_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_shop_id_nom_key" UNIQUE ("shop_id", "nom");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."facture_fournisseur_items"
    ADD CONSTRAINT "facture_fournisseur_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facture_items"
    ADD CONSTRAINT "facture_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."factures_fournisseurs"
    ADD CONSTRAINT "factures_fournisseurs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."platform_id_counters"
    ADD CONSTRAINT "platform_id_counters_pkey" PRIMARY KEY ("prefix");



ALTER TABLE ONLY "public"."platform_sessions"
    ADD CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_shop_id_sku_key" UNIQUE ("shop_id", "sku");



ALTER TABLE ONLY "public"."public_id_counters"
    ADD CONSTRAINT "public_id_counters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_id_counters"
    ADD CONSTRAINT "public_id_counters_shop_id_prefix_key" UNIQUE ("shop_id", "prefix");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."reception_items"
    ADD CONSTRAINT "reception_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_payments"
    ADD CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_return_items"
    ADD CONSTRAINT "sale_return_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_user_permissions"
    ADD CONSTRAINT "shop_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_user_permissions"
    ADD CONSTRAINT "shop_user_permissions_user_id_permission_key" UNIQUE ("user_id", "permission");



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_shop_id_identifiant_key" UNIQUE ("shop_id", "identifiant");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_id_warehouse_id_key" UNIQUE ("product_id", "warehouse_id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."factures_fournisseurs"
    ADD CONSTRAINT "uq_ff_public_id" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "uq_shop_users_shop_public_id" UNIQUE ("shop_id", "public_id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_shop_id_public_id_key" UNIQUE ("shop_id", "public_id");



CREATE UNIQUE INDEX "abonnement_paiements_reference_unique" ON "public"."abonnement_paiements" USING "btree" ("moyen", "reference_transaction") WHERE ("reference_transaction" IS NOT NULL);



CREATE INDEX "abonnement_paiements_shop_idx" ON "public"."abonnement_paiements" USING "btree" ("shop_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_event_type" ON "public"."audit_logs" USING "btree" ("event_type");



CREATE INDEX "idx_audit_logs_shop_id" ON "public"."audit_logs" USING "btree" ("shop_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_avoirs_facture_id" ON "public"."avoirs" USING "btree" ("facture_id");



CREATE INDEX "idx_avoirs_shop_id" ON "public"."avoirs" USING "btree" ("shop_id");



CREATE INDEX "idx_brands_shop_id" ON "public"."brands" USING "btree" ("shop_id");



CREATE INDEX "idx_cash_sessions_shop_jour" ON "public"."cash_sessions" USING "btree" ("shop_id", "jour" DESC);



CREATE UNIQUE INDEX "idx_cash_sessions_une_ouverte" ON "public"."cash_sessions" USING "btree" ("shop_id", "warehouse_id") WHERE ("statut" = 'ouverte'::"text");



CREATE UNIQUE INDEX "idx_cash_sessions_une_par_jour" ON "public"."cash_sessions" USING "btree" ("shop_id", "warehouse_id", "jour");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_shop_id" ON "public"."categories" USING "btree" ("shop_id");



CREATE INDEX "idx_client_ops_client_id" ON "public"."client_balance_operations" USING "btree" ("client_id");



CREATE INDEX "idx_client_ops_shop_id" ON "public"."client_balance_operations" USING "btree" ("shop_id");



CREATE INDEX "idx_clients_actif" ON "public"."clients" USING "btree" ("est_actif");



CREATE INDEX "idx_clients_shop_id" ON "public"."clients" USING "btree" ("shop_id");



CREATE INDEX "idx_clients_telephone" ON "public"."clients" USING "btree" ("telephone");



CREATE UNIQUE INDEX "idx_clients_telephone_unique" ON "public"."clients" USING "btree" ("shop_id", "telephone") WHERE (("telephone" IS NOT NULL) AND (TRIM(BOTH FROM "telephone") <> ''::"text") AND (NOT "est_anonyme"));



COMMENT ON INDEX "public"."idx_clients_telephone_unique" IS 'Un numéro de téléphone désigne une seule fiche client par boutique : deux fiches pour la même personne éclateraient son historique et ses soldes.';



CREATE INDEX "idx_counters_shop_id" ON "public"."public_id_counters" USING "btree" ("shop_id");



CREATE INDEX "idx_devis_client_id" ON "public"."devis" USING "btree" ("client_id");



CREATE INDEX "idx_devis_items_devis_id" ON "public"."devis_items" USING "btree" ("devis_id");



CREATE INDEX "idx_devis_shop_id" ON "public"."devis" USING "btree" ("shop_id");



CREATE INDEX "idx_devis_statut" ON "public"."devis" USING "btree" ("statut");



CREATE INDEX "idx_employees_shop_id" ON "public"."employees" USING "btree" ("shop_id");



CREATE INDEX "idx_expense_cat_shop_id" ON "public"."expense_categories" USING "btree" ("shop_id");



CREATE INDEX "idx_expenses_category" ON "public"."expenses" USING "btree" ("category_id");



CREATE INDEX "idx_expenses_date" ON "public"."expenses" USING "btree" ("date_depense");



CREATE INDEX "idx_expenses_shop_date_actives" ON "public"."expenses" USING "btree" ("shop_id", "date_depense") WHERE (NOT "est_annule");



CREATE INDEX "idx_expenses_shop_id" ON "public"."expenses" USING "btree" ("shop_id");



CREATE INDEX "idx_facture_items_facture_id" ON "public"."facture_items" USING "btree" ("facture_id");



CREATE INDEX "idx_factures_client_id" ON "public"."factures" USING "btree" ("client_id");



CREATE INDEX "idx_factures_echeance" ON "public"."factures" USING "btree" ("date_echeance");



CREATE INDEX "idx_factures_shop_id" ON "public"."factures" USING "btree" ("shop_id");



CREATE INDEX "idx_factures_statut" ON "public"."factures" USING "btree" ("statut");



CREATE INDEX "idx_ff_shop_id" ON "public"."factures_fournisseurs" USING "btree" ("shop_id");



CREATE INDEX "idx_ff_supplier_id" ON "public"."factures_fournisseurs" USING "btree" ("supplier_id");



CREATE INDEX "idx_fpay_facture_actifs" ON "public"."facture_payments" USING "btree" ("facture_id") WHERE (NOT "est_annule");



CREATE INDEX "idx_fpay_facture_id" ON "public"."facture_payments" USING "btree" ("facture_id");



CREATE INDEX "idx_fpay_shop_date_paiement" ON "public"."facture_payments" USING "btree" ("shop_id", "date_paiement");



CREATE INDEX "idx_fpay_shop_id" ON "public"."facture_payments" USING "btree" ("shop_id");



CREATE INDEX "idx_inv_items_inventory_id" ON "public"."inventory_items" USING "btree" ("inventory_id");



CREATE INDEX "idx_inv_items_product_id" ON "public"."inventory_items" USING "btree" ("product_id");



CREATE INDEX "idx_inventories_shop_id" ON "public"."inventories" USING "btree" ("shop_id");



CREATE INDEX "idx_inventories_statut" ON "public"."inventories" USING "btree" ("statut");



CREATE INDEX "idx_movements_created_at" ON "public"."stock_movements" USING "btree" ("created_at");



CREATE INDEX "idx_movements_product_id" ON "public"."stock_movements" USING "btree" ("product_id");



CREATE INDEX "idx_movements_shop_id" ON "public"."stock_movements" USING "btree" ("shop_id");



CREATE INDEX "idx_permissions_shop_id" ON "public"."shop_user_permissions" USING "btree" ("shop_id");



CREATE INDEX "idx_permissions_user_id" ON "public"."shop_user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_platform_admins_actif" ON "public"."platform_admins" USING "btree" ("est_actif");



CREATE INDEX "idx_platform_admins_email" ON "public"."platform_admins" USING "btree" ("email");



CREATE INDEX "idx_platform_admins_role" ON "public"."platform_admins" USING "btree" ("role");



CREATE INDEX "idx_platform_sessions_admin_id" ON "public"."platform_sessions" USING "btree" ("admin_id");



CREATE INDEX "idx_po_shop_id" ON "public"."purchase_orders" USING "btree" ("shop_id");



CREATE INDEX "idx_po_supplier_id" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_poi_po_id" ON "public"."purchase_order_items" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_price_history_product_id" ON "public"."price_history" USING "btree" ("product_id");



CREATE INDEX "idx_products_actif" ON "public"."products" USING "btree" ("est_actif");



CREATE INDEX "idx_products_brand_id" ON "public"."products" USING "btree" ("brand_id");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_shop_id" ON "public"."products" USING "btree" ("shop_id");



CREATE INDEX "idx_products_type" ON "public"."products" USING "btree" ("type_produit");



CREATE INDEX "idx_receptions_facture_id" ON "public"."receptions" USING "btree" ("facture_id");



CREATE INDEX "idx_salaries_employee_id" ON "public"."salary_payments" USING "btree" ("employee_id");



CREATE INDEX "idx_salaries_periode" ON "public"."salary_payments" USING "btree" ("periode_annee", "periode_mois");



CREATE INDEX "idx_salaries_shop_date_actifs" ON "public"."salary_payments" USING "btree" ("shop_id", "date_paiement") WHERE (NOT "est_annule");



CREATE INDEX "idx_salaries_shop_date_paiement" ON "public"."salary_payments" USING "btree" ("shop_id", "date_paiement");



CREATE INDEX "idx_salaries_shop_id" ON "public"."salary_payments" USING "btree" ("shop_id");



CREATE INDEX "idx_sale_items_product_id" ON "public"."sale_items" USING "btree" ("product_id");



CREATE INDEX "idx_sale_items_sale_id" ON "public"."sale_items" USING "btree" ("sale_id");



CREATE INDEX "idx_sale_items_shop_id" ON "public"."sale_items" USING "btree" ("shop_id");



CREATE INDEX "idx_sale_payments_sale_id" ON "public"."sale_payments" USING "btree" ("sale_id");



CREATE INDEX "idx_sale_payments_shop_id" ON "public"."sale_payments" USING "btree" ("shop_id");



CREATE INDEX "idx_sale_return_items_ret" ON "public"."sale_return_items" USING "btree" ("sale_return_id");



CREATE INDEX "idx_sale_returns_sale_id" ON "public"."sale_returns" USING "btree" ("sale_id");



CREATE INDEX "idx_sale_returns_shop_id" ON "public"."sale_returns" USING "btree" ("shop_id");



CREATE INDEX "idx_sales_client_id" ON "public"."sales" USING "btree" ("client_id");



CREATE INDEX "idx_sales_created_at" ON "public"."sales" USING "btree" ("created_at");



CREATE INDEX "idx_sales_shop_date_actives" ON "public"."sales" USING "btree" ("shop_id", "created_at") WHERE ("statut" = 'completee'::"text");



CREATE INDEX "idx_sales_shop_id" ON "public"."sales" USING "btree" ("shop_id");



CREATE INDEX "idx_sales_statut" ON "public"."sales" USING "btree" ("statut");



CREATE INDEX "idx_sales_vendeur_id" ON "public"."sales" USING "btree" ("vendeur_id");



CREATE INDEX "idx_shop_sessions_shop_id" ON "public"."shop_sessions" USING "btree" ("shop_id");



CREATE INDEX "idx_shop_sessions_user_id" ON "public"."shop_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_shop_users_actif" ON "public"."shop_users" USING "btree" ("est_actif");



CREATE INDEX "idx_shop_users_public_id" ON "public"."shop_users" USING "btree" ("public_id");



CREATE INDEX "idx_shop_users_role" ON "public"."shop_users" USING "btree" ("role");



CREATE INDEX "idx_shop_users_shop_id" ON "public"."shop_users" USING "btree" ("shop_id");



CREATE INDEX "idx_shops_active" ON "public"."shops" USING "btree" ("est_active");



CREATE INDEX "idx_shops_plan" ON "public"."shops" USING "btree" ("plan");



CREATE INDEX "idx_shops_public_id" ON "public"."shops" USING "btree" ("public_id");



CREATE INDEX "idx_sp_shop_id" ON "public"."supplier_payments" USING "btree" ("shop_id");



CREATE INDEX "idx_sp_supplier_id" ON "public"."supplier_payments" USING "btree" ("supplier_id");



CREATE INDEX "idx_spay_facture_id" ON "public"."supplier_payments" USING "btree" ("facture_id");



CREATE INDEX "idx_stock_product_id" ON "public"."stock_levels" USING "btree" ("product_id");



CREATE INDEX "idx_stock_shop_id" ON "public"."stock_levels" USING "btree" ("shop_id");



CREATE INDEX "idx_stock_warehouse_id" ON "public"."stock_levels" USING "btree" ("warehouse_id");



CREATE INDEX "idx_supplier_payments_shop_date" ON "public"."supplier_payments" USING "btree" ("shop_id", "date_paiement");



CREATE INDEX "idx_suppliers_public_id" ON "public"."suppliers" USING "btree" ("public_id");



CREATE INDEX "idx_suppliers_shop_id" ON "public"."suppliers" USING "btree" ("shop_id");



CREATE INDEX "idx_variants_product_id" ON "public"."product_variants" USING "btree" ("product_id");



CREATE UNIQUE INDEX "idx_warehouses_defaut" ON "public"."warehouses" USING "btree" ("shop_id") WHERE ("est_defaut" = true);



CREATE INDEX "idx_warehouses_shop_id" ON "public"."warehouses" USING "btree" ("shop_id");



CREATE OR REPLACE TRIGGER "shops_garde_plan" BEFORE UPDATE OF "plan", "plan_expire_le" ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."garde_plan_boutique"();



CREATE OR REPLACE TRIGGER "trg_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_check_client_credit" BEFORE INSERT OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."check_client_credit"();



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_devis_updated_at" BEFORE UPDATE ON "public"."devis" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_facture_immutable" BEFORE UPDATE ON "public"."factures" FOR EACH ROW EXECUTE FUNCTION "public"."check_facture_immutable"();



CREATE OR REPLACE TRIGGER "trg_factures_updated_at" BEFORE UPDATE ON "public"."factures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ff_updated_at" BEFORE UPDATE ON "public"."factures_fournisseurs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventories_updated_at" BEFORE UPDATE ON "public"."inventories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_platform_admins_updated_at" BEFORE UPDATE ON "public"."platform_admins" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_po_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sales_updated_at" BEFORE UPDATE ON "public"."sales" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shop_users_updated_at" BEFORE UPDATE ON "public"."shop_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shops_updated_at" BEFORE UPDATE ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_stock_levels_updated_at" BEFORE UPDATE ON "public"."stock_levels" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_warehouses_updated_at" BEFORE UPDATE ON "public"."warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_po_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."abonnement_alertes"
    ADD CONSTRAINT "abonnement_alertes_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."abonnement_paiements"
    ADD CONSTRAINT "abonnement_paiements_cree_par_plateforme_fkey" FOREIGN KEY ("cree_par_plateforme") REFERENCES "public"."platform_admins"("id");



ALTER TABLE ONLY "public"."abonnement_paiements"
    ADD CONSTRAINT "abonnement_paiements_cree_par_utilisateur_fkey" FOREIGN KEY ("cree_par_utilisateur") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."abonnement_paiements"
    ADD CONSTRAINT "abonnement_paiements_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avoirs"
    ADD CONSTRAINT "avoirs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avoirs"
    ADD CONSTRAINT "avoirs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."avoirs"
    ADD CONSTRAINT "avoirs_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id");



ALTER TABLE ONLY "public"."avoirs"
    ADD CONSTRAINT "avoirs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_fermee_par_fkey" FOREIGN KEY ("fermee_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_ouverte_par_fkey" FOREIGN KEY ("ouverte_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_balance_operations"
    ADD CONSTRAINT "client_balance_operations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_balance_operations"
    ADD CONSTRAINT "client_balance_operations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."client_balance_operations"
    ADD CONSTRAINT "client_balance_operations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."devis_items"
    ADD CONSTRAINT "devis_items_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devis_items"
    ADD CONSTRAINT "devis_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."devis_items"
    ADD CONSTRAINT "devis_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."devis"
    ADD CONSTRAINT "devis_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shop_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_categories"
    ADD CONSTRAINT "expense_categories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_modifie_par_fkey" FOREIGN KEY ("modifie_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_fournisseur_items"
    ADD CONSTRAINT "facture_fournisseur_items_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures_fournisseurs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_fournisseur_items"
    ADD CONSTRAINT "facture_fournisseur_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."facture_fournisseur_items"
    ADD CONSTRAINT "facture_fournisseur_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_items"
    ADD CONSTRAINT "facture_items_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_items"
    ADD CONSTRAINT "facture_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facture_items"
    ADD CONSTRAINT "facture_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_modifie_par_fkey" FOREIGN KEY ("modifie_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."facture_payments"
    ADD CONSTRAINT "facture_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_devis_id_fkey" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."factures_fournisseurs"
    ADD CONSTRAINT "factures_fournisseurs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."factures_fournisseurs"
    ADD CONSTRAINT "factures_fournisseurs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factures_fournisseurs"
    ADD CONSTRAINT "factures_fournisseurs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."factures_fournisseurs"
    ADD CONSTRAINT "factures_fournisseurs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_valide_par_fkey" FOREIGN KEY ("valide_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."inventories"
    ADD CONSTRAINT "inventories_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_sessions"
    ADD CONSTRAINT "platform_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_modifie_par_fkey" FOREIGN KEY ("modifie_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."public_id_counters"
    ADD CONSTRAINT "public_id_counters_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_soumis_par_fkey" FOREIGN KEY ("soumis_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."reception_items"
    ADD CONSTRAINT "reception_items_po_item_id_fkey" FOREIGN KEY ("poi_id") REFERENCES "public"."purchase_order_items"("id");



ALTER TABLE ONLY "public"."reception_items"
    ADD CONSTRAINT "reception_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."reception_items"
    ADD CONSTRAINT "reception_items_reception_id_fkey" FOREIGN KEY ("reception_id") REFERENCES "public"."receptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reception_items"
    ADD CONSTRAINT "reception_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures_fournisseurs"("id");



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_purchase_order_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."receptions"
    ADD CONSTRAINT "receptions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_modifie_par_fkey" FOREIGN KEY ("modifie_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_items"
    ADD CONSTRAINT "sale_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."sale_payments"
    ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_payments"
    ADD CONSTRAINT "sale_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_return_items"
    ADD CONSTRAINT "sale_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."sale_return_items"
    ADD CONSTRAINT "sale_return_items_sale_return_id_fkey" FOREIGN KEY ("sale_return_id") REFERENCES "public"."sale_returns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_return_items"
    ADD CONSTRAINT "sale_return_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id");



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sale_returns"
    ADD CONSTRAINT "sale_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_annule_par_fkey" FOREIGN KEY ("annule_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_vendeur_id_fkey" FOREIGN KEY ("vendeur_id") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."sales"
    ADD CONSTRAINT "sales_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_sessions"
    ADD CONSTRAINT "shop_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shop_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_user_permissions"
    ADD CONSTRAINT "shop_user_permissions_accorde_par_fkey" FOREIGN KEY ("accorde_par") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."shop_user_permissions"
    ADD CONSTRAINT "shop_user_permissions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_user_permissions"
    ADD CONSTRAINT "shop_user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."shop_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."shop_users"
    ADD CONSTRAINT "shop_users_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_active_par_fkey" FOREIGN KEY ("active_par") REFERENCES "public"."platform_admins"("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."platform_admins"("id");



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_warehouse_from_fkey" FOREIGN KEY ("warehouse_from") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_warehouse_to_fkey" FOREIGN KEY ("warehouse_to") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures_fournisseurs"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_supplier_return_id_fkey" FOREIGN KEY ("supplier_return_id") REFERENCES "public"."supplier_returns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."shop_users"("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE "public"."abonnement_alertes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."abonnement_paiements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "abonnement_paiements_isolation" ON "public"."abonnement_paiements" FOR SELECT USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "adj_i_isolation" ON "public"."stock_adjustment_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "adj_isolation" ON "public"."stock_adjustments" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_isolation" ON "public"."audit_logs" FOR SELECT USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."avoirs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "avoirs_isolation" ON "public"."avoirs" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_isolation" ON "public"."brands" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."cash_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cash_sessions_isolation" ON "public"."cash_sessions" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_isolation" ON "public"."categories" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."client_balance_operations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_ops_isolation" ON "public"."client_balance_operations" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_isolation" ON "public"."clients" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "counters_isolation" ON "public"."public_id_counters" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."devis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devis_isolation" ON "public"."devis" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."devis_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "devis_items_isolation" ON "public"."devis_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_isolation" ON "public"."employees" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "expense_cat_isolation" ON "public"."expense_categories" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."expense_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_isolation" ON "public"."expenses" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."facture_fournisseur_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facture_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facture_items_isolation" ON "public"."facture_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."facture_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."factures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."factures_fournisseurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "factures_isolation" ON "public"."factures" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "ff_isolation" ON "public"."factures_fournisseurs" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "ffi_isolation" ON "public"."facture_fournisseur_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "fpay_isolation" ON "public"."facture_payments" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "inv_items_isolation" ON "public"."inventory_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."inventories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventories_isolation" ON "public"."inventories" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "licence_en_service" ON "public"."abonnement_paiements" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."audit_logs" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."avoirs" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."brands" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."cash_sessions" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."categories" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."client_balance_operations" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."clients" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."devis" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."devis_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."employees" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."expense_categories" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."expenses" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."facture_fournisseur_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."facture_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."facture_payments" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."factures" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."factures_fournisseurs" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."inventories" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."inventory_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."price_history" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."product_variants" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."products" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."public_id_counters" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."purchase_order_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."purchase_orders" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."reception_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."receptions" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."salary_payments" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."sale_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."sale_payments" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."sale_return_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."sale_returns" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."sales" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."shop_sessions" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."shop_user_permissions" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."shop_users" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."stock_adjustment_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."stock_adjustments" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."stock_levels" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."stock_movements" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."stock_transfer_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."stock_transfers" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."supplier_payments" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."supplier_return_items" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."supplier_returns" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."suppliers" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service" ON "public"."warehouses" AS RESTRICTIVE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service_ecriture_shops" ON "public"."shops" AS RESTRICTIVE FOR UPDATE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service")) WITH CHECK (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



CREATE POLICY "licence_en_service_suppression_shops" ON "public"."shops" AS RESTRICTIVE FOR DELETE USING (( SELECT "public"."session_boutique_en_service"() AS "session_boutique_en_service"));



ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_id_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "po_isolation" ON "public"."purchase_orders" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "poi_isolation" ON "public"."purchase_order_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "price_history_isolation" ON "public"."price_history" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_isolation" ON "public"."products" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."public_id_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reception_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reception_items_isolation" ON "public"."reception_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."receptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "receptions_isolation" ON "public"."receptions" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "salaries_isolation" ON "public"."salary_payments" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."salary_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sale_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sale_items_isolation" ON "public"."sale_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."sale_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sale_payments_isolation" ON "public"."sale_payments" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."sale_return_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sale_return_items_isolation" ON "public"."sale_return_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."sale_returns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sale_returns_isolation" ON "public"."sale_returns" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_isolation" ON "public"."sales" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "shop_permissions_isolation" ON "public"."shop_user_permissions" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."shop_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shop_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shop_users_isolation" ON "public"."shop_users" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shops_isolation" ON "public"."shops" FOR SELECT USING (("id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."stock_adjustment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_levels_isolation" ON "public"."stock_levels" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_isolation" ON "public"."stock_movements" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."stock_transfer_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_transfers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sup_pay_isolation" ON "public"."supplier_payments" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "sup_ret_i_isolation" ON "public"."supplier_return_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "sup_ret_isolation" ON "public"."supplier_returns" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."supplier_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_return_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_returns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_isolation" ON "public"."suppliers" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "transfer_i_isolation" ON "public"."stock_transfer_items" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "transfers_isolation" ON "public"."stock_transfers" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



CREATE POLICY "variants_isolation" ON "public"."product_variants" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));



ALTER TABLE "public"."warehouses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "warehouses_isolation" ON "public"."warehouses" USING (("shop_id" = ( SELECT ((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'shop_id'::"text"))::"uuid" AS "uuid")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."annuler_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."annuler_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."annuler_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."annuler_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_motif" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."annuler_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_motif" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."annuler_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_motif" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."annuler_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."annuler_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."annuler_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."annuler_vente"("p_shop_id" "uuid", "p_sale_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."annuler_vente"("p_shop_id" "uuid", "p_sale_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."annuler_vente"("p_shop_id" "uuid", "p_sale_id" "uuid", "p_motif" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."appliquer_mouvement_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_champ" "text", "p_delta" numeric, "p_type" "text", "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."appliquer_mouvement_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_champ" "text", "p_delta" numeric, "p_type" "text", "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."appliquer_mouvement_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_champ" "text", "p_delta" numeric, "p_type" "text", "p_note" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."appliquer_mouvement_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_delta" numeric, "p_type_mouvement" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_note" "text", "p_user_id" "uuid", "p_autoriser_negatif" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."appliquer_mouvement_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_delta" numeric, "p_type_mouvement" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_note" "text", "p_user_id" "uuid", "p_autoriser_negatif" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."appliquer_mouvement_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_delta" numeric, "p_type_mouvement" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_note" "text", "p_user_id" "uuid", "p_autoriser_negatif" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."ca_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."ca_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ca_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."changer_statut_bon_commande"("p_shop_id" "uuid", "p_po_id" "uuid", "p_statut" "text", "p_user_id" "uuid", "p_motif" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."changer_statut_bon_commande"("p_shop_id" "uuid", "p_po_id" "uuid", "p_statut" "text", "p_user_id" "uuid", "p_motif" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."changer_statut_bon_commande"("p_shop_id" "uuid", "p_po_id" "uuid", "p_statut" "text", "p_user_id" "uuid", "p_motif" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_client_credit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_client_credit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_client_credit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_facture_immutable"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_facture_immutable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_facture_immutable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clients_encours"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."clients_encours"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clients_encours"("p_shop_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."convertir_devis_en_facture"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."convertir_devis_en_facture"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convertir_devis_en_facture"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."creer_avoir"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_motif" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."creer_avoir"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_motif" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."creer_avoir"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_motif" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."deduire_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_quantite" numeric, "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deduire_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_quantite" numeric, "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduire_stock"("p_shop_id" "uuid", "p_product_id" "uuid", "p_warehouse_id" "uuid", "p_quantite" numeric, "p_reference_type" "text", "p_reference_id" "uuid", "p_reference_pid" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."effectuer_ajustement"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."effectuer_ajustement"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effectuer_ajustement"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."effectuer_retour_fournisseur"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."effectuer_retour_fournisseur"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effectuer_retour_fournisseur"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."effectuer_retour_vente"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."effectuer_retour_vente"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effectuer_retour_vente"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."effectuer_transfert"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."effectuer_transfert"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."effectuer_transfert"("p_data" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."abonnement_paiements" TO "anon";
GRANT ALL ON TABLE "public"."abonnement_paiements" TO "authenticated";
GRANT ALL ON TABLE "public"."abonnement_paiements" TO "service_role";



REVOKE ALL ON FUNCTION "public"."enregistrer_paiement_manuel"("p_shop_id" "uuid", "p_plan" "text", "p_duree" "text", "p_montant" numeric, "p_admin_id" "uuid", "p_note" "text", "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enregistrer_paiement_manuel"("p_shop_id" "uuid", "p_plan" "text", "p_duree" "text", "p_montant" numeric, "p_admin_id" "uuid", "p_note" "text", "p_reference" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enregistrer_reception"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."enregistrer_reception"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enregistrer_reception"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."enregistrer_vente"("p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."enregistrer_vente"("p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enregistrer_vente"("p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."especes_attendues_session"("p_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."especes_attendues_session"("p_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."especes_attendues_session"("p_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."evolution_tresorerie"("p_shop_id" "uuid", "p_mois_fin" integer, "p_annee_fin" integer, "p_nb_mois" integer, "p_decalage" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."evolution_tresorerie"("p_shop_id" "uuid", "p_mois_fin" integer, "p_annee_fin" integer, "p_nb_mois" integer, "p_decalage" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."evolution_tresorerie"("p_shop_id" "uuid", "p_mois_fin" integer, "p_annee_fin" integer, "p_nb_mois" integer, "p_decalage" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."fermer_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_compte" numeric, "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fermer_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_compte" numeric, "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fermer_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_compte" numeric, "p_note" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."garde_plan_boutique"() TO "anon";
GRANT ALL ON FUNCTION "public"."garde_plan_boutique"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."garde_plan_boutique"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_platform_id"("p_prefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_platform_id"("p_prefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_platform_id"("p_prefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_public_id"("p_shop_id" "uuid", "p_prefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_public_id"("p_shop_id" "uuid", "p_prefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_public_id"("p_shop_id" "uuid", "p_prefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."journees_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."journees_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."journees_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."modifier_devis"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_client_id" "uuid", "p_objet" "text", "p_date_validite" "date", "p_remise_pct" numeric, "p_note_client" "text", "p_note_interne" "text", "p_lignes" "jsonb", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."modifier_devis"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_client_id" "uuid", "p_objet" "text", "p_date_validite" "date", "p_remise_pct" numeric, "p_note_client" "text", "p_note_interne" "text", "p_lignes" "jsonb", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."modifier_devis"("p_shop_id" "uuid", "p_devis_id" "uuid", "p_client_id" "uuid", "p_objet" "text", "p_date_validite" "date", "p_remise_pct" numeric, "p_note_client" "text", "p_note_interne" "text", "p_lignes" "jsonb", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."modifier_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."modifier_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."modifier_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."modifier_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."modifier_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."modifier_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_entete" "jsonb", "p_lignes" "jsonb", "p_user_id" "uuid", "p_user_nom" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."modifier_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_date_paiement" "date", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."modifier_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_date_paiement" "date", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."modifier_paiement_facture"("p_shop_id" "uuid", "p_paiement_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_date_paiement" "date", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mouvements_caisse_jour"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."mouvements_caisse_jour"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mouvements_caisse_jour"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."operation_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_type" "text", "p_montant" numeric, "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."operation_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_type" "text", "p_montant" numeric, "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."operation_solde_client"("p_shop_id" "uuid", "p_client_id" "uuid", "p_type" "text", "p_montant" numeric, "p_note" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ouvrir_session_caisse"("p_shop_id" "uuid", "p_warehouse_id" "uuid", "p_fond" numeric, "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ouvrir_session_caisse"("p_shop_id" "uuid", "p_warehouse_id" "uuid", "p_fond" numeric, "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ouvrir_session_caisse"("p_shop_id" "uuid", "p_warehouse_id" "uuid", "p_fond" numeric, "p_note" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."payer_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid", "p_date_paiement" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."payer_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid", "p_date_paiement" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payer_facture"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid", "p_date_paiement" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."payer_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."payer_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payer_facture_fournisseur"("p_shop_id" "uuid", "p_facture_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."payer_fournisseur"("p_shop_id" "uuid", "p_supplier_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."payer_fournisseur"("p_shop_id" "uuid", "p_supplier_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payer_fournisseur"("p_shop_id" "uuid", "p_supplier_id" "uuid", "p_montant" numeric, "p_moyen" "text", "p_reference" "text", "p_note" "text", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prolonger_abonnement"("p_paiement_id" "uuid", "p_reference_transaction" "text", "p_details_prestataire" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prolonger_abonnement"("p_paiement_id" "uuid", "p_reference_transaction" "text", "p_details_prestataire" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculer_statut_facture"("p_facture_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculer_statut_facture"("p_facture_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculer_statut_facture"("p_facture_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."regler_retour_vente"("p_shop_id" "uuid", "p_retour_id" "uuid", "p_mode" "text", "p_note" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."regler_retour_vente"("p_shop_id" "uuid", "p_retour_id" "uuid", "p_mode" "text", "p_note" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regler_retour_vente"("p_shop_id" "uuid", "p_retour_id" "uuid", "p_mode" "text", "p_note" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rouvrir_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rouvrir_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rouvrir_session_caisse"("p_shop_id" "uuid", "p_session_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."session_boutique_en_service"() TO "anon";
GRANT ALL ON FUNCTION "public"."session_boutique_en_service"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_boutique_en_service"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tresorerie_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."tresorerie_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tresorerie_periode"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."valeur_stock"("p_shop_id" "uuid", "p_warehouse_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."valeur_stock"("p_shop_id" "uuid", "p_warehouse_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."valeur_stock"("p_shop_id" "uuid", "p_warehouse_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."valider_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."valider_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."valider_inventaire"("p_inventory_id" "uuid", "p_shop_id" "uuid", "p_user_id" "uuid", "p_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ventilation_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."ventilation_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ventilation_caisse"("p_shop_id" "uuid", "p_debut" "date", "p_fin" "date", "p_decalage" interval) TO "service_role";


















GRANT ALL ON TABLE "public"."abonnement_alertes" TO "anon";
GRANT ALL ON TABLE "public"."abonnement_alertes" TO "authenticated";
GRANT ALL ON TABLE "public"."abonnement_alertes" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."avoirs" TO "anon";
GRANT ALL ON TABLE "public"."avoirs" TO "authenticated";
GRANT ALL ON TABLE "public"."avoirs" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."cash_sessions" TO "anon";
GRANT ALL ON TABLE "public"."cash_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."client_balance_operations" TO "anon";
GRANT ALL ON TABLE "public"."client_balance_operations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_balance_operations" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."devis" TO "anon";
GRANT ALL ON TABLE "public"."devis" TO "authenticated";
GRANT ALL ON TABLE "public"."devis" TO "service_role";



GRANT ALL ON TABLE "public"."devis_items" TO "anon";
GRANT ALL ON TABLE "public"."devis_items" TO "authenticated";
GRANT ALL ON TABLE "public"."devis_items" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expense_categories" TO "anon";
GRANT ALL ON TABLE "public"."expense_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_categories" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."facture_fournisseur_items" TO "anon";
GRANT ALL ON TABLE "public"."facture_fournisseur_items" TO "authenticated";
GRANT ALL ON TABLE "public"."facture_fournisseur_items" TO "service_role";



GRANT ALL ON TABLE "public"."facture_items" TO "anon";
GRANT ALL ON TABLE "public"."facture_items" TO "authenticated";
GRANT ALL ON TABLE "public"."facture_items" TO "service_role";



GRANT ALL ON TABLE "public"."facture_payments" TO "anon";
GRANT ALL ON TABLE "public"."facture_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."facture_payments" TO "service_role";



GRANT ALL ON TABLE "public"."factures" TO "anon";
GRANT ALL ON TABLE "public"."factures" TO "authenticated";
GRANT ALL ON TABLE "public"."factures" TO "service_role";



GRANT ALL ON TABLE "public"."factures_fournisseurs" TO "anon";
GRANT ALL ON TABLE "public"."factures_fournisseurs" TO "authenticated";
GRANT ALL ON TABLE "public"."factures_fournisseurs" TO "service_role";



GRANT ALL ON TABLE "public"."inventories" TO "anon";
GRANT ALL ON TABLE "public"."inventories" TO "authenticated";
GRANT ALL ON TABLE "public"."inventories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."platform_id_counters" TO "anon";
GRANT ALL ON TABLE "public"."platform_id_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_id_counters" TO "service_role";



GRANT ALL ON TABLE "public"."platform_sessions" TO "anon";
GRANT ALL ON TABLE "public"."platform_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."price_history" TO "anon";
GRANT ALL ON TABLE "public"."price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."price_history" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."public_id_counters" TO "anon";
GRANT ALL ON TABLE "public"."public_id_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."public_id_counters" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."reception_items" TO "anon";
GRANT ALL ON TABLE "public"."reception_items" TO "authenticated";
GRANT ALL ON TABLE "public"."reception_items" TO "service_role";



GRANT ALL ON TABLE "public"."receptions" TO "anon";
GRANT ALL ON TABLE "public"."receptions" TO "authenticated";
GRANT ALL ON TABLE "public"."receptions" TO "service_role";



GRANT ALL ON TABLE "public"."salary_payments" TO "anon";
GRANT ALL ON TABLE "public"."salary_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_payments" TO "service_role";



GRANT ALL ON TABLE "public"."sale_items" TO "anon";
GRANT ALL ON TABLE "public"."sale_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_items" TO "service_role";



GRANT ALL ON TABLE "public"."sale_payments" TO "anon";
GRANT ALL ON TABLE "public"."sale_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_payments" TO "service_role";



GRANT ALL ON TABLE "public"."sale_return_items" TO "anon";
GRANT ALL ON TABLE "public"."sale_return_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_return_items" TO "service_role";



GRANT ALL ON TABLE "public"."sale_returns" TO "anon";
GRANT ALL ON TABLE "public"."sale_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."sale_returns" TO "service_role";



GRANT ALL ON TABLE "public"."sales" TO "anon";
GRANT ALL ON TABLE "public"."sales" TO "authenticated";
GRANT ALL ON TABLE "public"."sales" TO "service_role";



GRANT ALL ON TABLE "public"."shop_sessions" TO "anon";
GRANT ALL ON TABLE "public"."shop_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."shop_user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."shop_user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."shop_users" TO "anon";
GRANT ALL ON TABLE "public"."shop_users" TO "authenticated";
GRANT ALL ON TABLE "public"."shop_users" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT ALL ON TABLE "public"."stock_adjustment_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_adjustment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_adjustment_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."stock_levels" TO "anon";
GRANT ALL ON TABLE "public"."stock_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_levels" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transfer_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_transfer_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfer_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_transfers" TO "anon";
GRANT ALL ON TABLE "public"."stock_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_payments" TO "anon";
GRANT ALL ON TABLE "public"."supplier_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_payments" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_return_items" TO "anon";
GRANT ALL ON TABLE "public"."supplier_return_items" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_return_items" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_returns" TO "anon";
GRANT ALL ON TABLE "public"."supplier_returns" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_returns" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."warehouses" TO "anon";
GRANT ALL ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































