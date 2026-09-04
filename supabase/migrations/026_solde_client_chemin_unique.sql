-- ============================================================
-- MIGRATION 026 — Un seul chemin vers le solde client
-- ============================================================
--
-- Constat du cadrage : le solde d'un client bougeait par DEUX chemins,
-- et un seul tenait le registre.
--
--   • `enregistrer_vente` (SQL) modifiait `credit_balance`,
--     `advance_balance` et `change_balance` par quatre UPDATE directs —
--     sans verrou, sans cloisonnement `shop_id`, et SANS jamais écrire
--     dans `client_balance_operations`.
--   • `operationSoldeClient` (TypeScript) lisait le solde, calculait en
--     JavaScript, puis écrivait — sans verrou non plus, mais en tenant
--     le registre.
--
-- Résultat en production : JEAN BOSQUO doit 10 000 F et son historique
-- d'opérations est vide. L'écran de fiche client affiche un solde et,
-- juste en dessous, rien qui l'explique.
--
-- Tout passe désormais par `appliquer_mouvement_solde_client` (créée au
-- Lot 2 pour l'avoir) : verrou FOR UPDATE, solde et registre écrits
-- ensemble. C'est la même correction que celle du module Stock, où cinq
-- chemins d'écriture concurrents avaient été ramenés à un seul.
--
-- Décision D2 : plafond de crédit par client, AVERTISSEMENT et non
-- blocage. Un plafond nul vaut « pas de limite », donc rien ne change
-- pour les boutiques qui n'en veulent pas. Le gérant est sur place et
-- connaît son client mieux que le logiciel ; l'empêcher de vendre
-- serait mal reçu, ne pas le prévenir serait fautif.
-- ============================================================

-- ── 1. Plafond de crédit (décision D2) ───────────────────────
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS plafond_credit NUMERIC(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN clients.plafond_credit IS
    'Encours de crédit au-delà duquel la vente AVERTIT (jamais ne bloque, décision D2). 0 = pas de limite.';

-- ── 2. Le mouvement de solde connaît le plafond ──────────────
-- Même fonction qu'au Lot 2, enrichie : elle renvoie désormais un
-- avertissement quand le crédit dépasse le plafond, sans refuser
-- l'opération. Le POS et la fiche client l'affichent.
CREATE OR REPLACE FUNCTION appliquer_mouvement_solde_client(
    p_shop_id   UUID,
    p_client_id UUID,
    p_champ     TEXT,
    p_delta     NUMERIC,
    p_type      TEXT,
    p_note      TEXT,
    p_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
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
$$;

-- ── 3. La vente au comptoir cesse d'écrire les soldes ────────
-- Seule la section « soldes client » change : les quatre UPDATE directs
-- deviennent quatre appels à la fonction unique. Le reste de la
-- fonction est repris à l'identique.
CREATE OR REPLACE FUNCTION enregistrer_vente(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
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
BEGIN
  v_shop_id      := (p_data->>'shop_id')::UUID;
  v_warehouse_id := (p_data->>'warehouse_id')::UUID;
  v_user_id      := (p_data->>'vendeur_id')::UUID;
  v_client_id    := NULLIF(p_data->>'client_id', '')::UUID;

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
    (p_data->>'montant_total')::NUMERIC,
    (p_data->>'montant_recu')::NUMERIC,
    (p_data->>'montant_rendu')::NUMERIC,
    (p_data->>'credit_utilise')::NUMERIC,
    (p_data->>'advance_utilise')::NUMERIC,
    (p_data->>'change_utilise')::NUMERIC,
    (p_data->>'credit_accorde')::NUMERIC,
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_data->'paiements')
  LOOP
    INSERT INTO sale_payments (
      shop_id, sale_id, moyen_paiement, montant, reference
    ) VALUES (
      v_shop_id, v_sale_id,
      v_item->>'moyen_paiement',
      (v_item->>'montant')::NUMERIC,
      NULLIF(v_item->>'reference', '')
    );
  END LOOP;

  -- ── Soldes client ──────────────────────────────────────────
  -- Quatre UPDATE directs, sans verrou ni registre, devenus quatre
  -- appels à la fonction unique. Chacun laisse sa trace : un solde
  -- s'explique désormais toujours par ses opérations.
  IF v_client_id IS NOT NULL THEN

    IF COALESCE((p_data->>'advance_utilise')::NUMERIC, 0) > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'advance_balance',
        -(p_data->>'advance_utilise')::NUMERIC,
        'vente_avance', 'Avance utilisée sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF COALESCE((p_data->>'change_utilise')::NUMERIC, 0) > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'change_balance',
        -(p_data->>'change_utilise')::NUMERIC,
        'vente_monnaie', 'Monnaie utilisée sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
    END IF;

    IF COALESCE((p_data->>'credit_accorde')::NUMERIC, 0) > 0 THEN
      SELECT appliquer_mouvement_solde_client(
        v_shop_id, v_client_id, 'credit_balance',
        (p_data->>'credit_accorde')::NUMERIC,
        'vente_credit', 'Crédit accordé sur ' || v_sale_public_id, v_user_id
      ) INTO v_solde;
      IF NOT (v_solde->>'succes')::BOOLEAN THEN
        RAISE EXCEPTION '%', v_solde->>'erreur';
      END IF;
      -- Le plafond avertit, il ne bloque pas (décision D2).
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
    'avertissements', to_jsonb(v_avertissements)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

-- ── 4. Opération manuelle de solde ───────────────────────────
-- L'action TypeScript lisait le solde, calculait, puis écrivait : deux
-- opérations simultanées sur le même client et la seconde écrasait la
-- première. Elle appelle désormais la fonction unique, qui verrouille.
CREATE OR REPLACE FUNCTION operation_solde_client(
    p_shop_id   UUID,
    p_client_id UUID,
    p_type      TEXT,
    p_montant   NUMERIC,
    p_note      TEXT,
    p_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
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

-- ── 5. Régularisation des soldes sans opération ──────────────
-- Les soldes déjà en base n'ont, pour la plupart, aucune opération qui
-- les explique : ils viennent de la vente au comptoir, qui n'écrivait
-- pas le registre. On crée l'opération manquante, datée et annotée —
-- jamais silencieusement, et SANS toucher au solde lui-même, qui est
-- juste : c'est sa justification qui manquait.
DO $$
DECLARE
    v_client  RECORD;
    v_champ   TEXT;
    v_solde   NUMERIC;
    v_deja    NUMERIC;
    v_ecart   NUMERIC;
    v_total   INTEGER := 0;
BEGIN
    FOR v_client IN
        SELECT id, shop_id, nom, credit_balance, advance_balance, change_balance
          FROM clients
         WHERE credit_balance <> 0 OR advance_balance <> 0 OR change_balance <> 0
    LOOP
        FOREACH v_champ IN ARRAY ARRAY['credit_balance', 'advance_balance', 'change_balance']
        LOOP
            v_solde := CASE v_champ
                WHEN 'credit_balance'  THEN v_client.credit_balance
                WHEN 'advance_balance' THEN v_client.advance_balance
                ELSE v_client.change_balance
            END;

            IF v_solde = 0 THEN CONTINUE; END IF;

            -- Ce que le registre explique déjà pour ce solde.
            SELECT COALESCE(MAX(solde_apres), 0) INTO v_deja
              FROM client_balance_operations
             WHERE client_id = v_client.id
               AND type_operation IN (
                   CASE v_champ
                       WHEN 'credit_balance'  THEN 'credit_utilisation'
                       WHEN 'advance_balance' THEN 'advance_depot'
                       ELSE 'change_depot'
                   END,
                   'regularisation', 'avoir_facture',
                   'vente_credit', 'vente_avance', 'vente_monnaie'
               );

            v_ecart := v_solde - v_deja;
            IF v_ecart = 0 THEN CONTINUE; END IF;

            INSERT INTO client_balance_operations (
                shop_id, client_id, type_operation, montant,
                solde_avant, solde_apres, note
            ) VALUES (
                v_client.shop_id, v_client.id, 'regularisation', ABS(v_ecart),
                v_solde - v_ecart, v_solde,
                'Régularisation du ' || CURRENT_DATE
                || ' : solde constaté en base sans opération d''origine, '
                || 'antérieur au passage par le chemin unique (migration 026).'
            );

            v_total := v_total + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migration 026 : % solde(s) régularisé(s) — aucune quantité modifiée, seule la justification manquait.', v_total;
END $$;

-- ── 6. Contrôle ──────────────────────────────────────────────
DO $$
DECLARE
    v_orphelins INTEGER;
BEGIN
    SELECT count(*) INTO v_orphelins
      FROM clients c
     WHERE (c.credit_balance <> 0 OR c.advance_balance <> 0 OR c.change_balance <> 0)
       AND NOT EXISTS (
           SELECT 1 FROM client_balance_operations o WHERE o.client_id = c.id
       );

    IF v_orphelins > 0 THEN
        RAISE EXCEPTION 'Migration 026 : % client(s) portent encore un solde sans aucune opération.', v_orphelins;
    END IF;
    RAISE NOTICE 'Migration 026 : plus aucun solde client sans opération qui l''explique.';
END $$;
