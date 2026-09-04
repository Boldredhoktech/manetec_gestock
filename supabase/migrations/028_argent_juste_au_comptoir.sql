-- ============================================================
-- MIGRATION 028 — L'argent de la caisse devient juste
-- ============================================================
--
-- Constat central du cadrage POS, ouvert par le module Finances sous le
-- nom FIN-27 : la vente inscrit dans `sale_payments` la TOTALITÉ de son
-- montant, y compris la part accordée à crédit que le client n'a pas
-- payée. En production, VENTE-00001 de DODO STORE vaut 445 500 F dont
-- 10 000 F à crédit et déclare 445 500 F de règlements — 10 000 F
-- d'entrées de trésorerie qui n'existent pas.
--
-- Toute lecture d'argent en hérite : tableau de bord comptable, P&P,
-- rapport de ventes, et la ventilation de la caisse livrée au Lot 4
-- Finances. C'est ici que cela se corrige, à la source.
--
-- Deuxième constat, découvert en corrigeant le premier : `credit_utilise`
-- est écrit sur `sales` et n'affecte AUCUN solde — ni avant, ni après la
-- migration 026 qui a pourtant repris tous les autres mouvements. Le
-- champ traversait toute la chaîne sans rien produire. Il reçoit ici sa
-- seule lecture sensée : un remboursement d'ardoise encaissé en même
-- temps que la vente.
-- ============================================================

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

COMMENT ON FUNCTION enregistrer_vente(JSONB) IS
    'Enregistre une vente. Les sale_payments ne reçoivent QUE l''argent réellement entré : total moins soldes utilisés moins crédit accordé, plus le remboursement d''ardoise. Le crédit accordé n''est pas une entrée de trésorerie.';

-- ── Régularisation de la vente déjà en base ──────────────────
-- VENTE-00001 de DODO STORE déclare 445 500 F encaissés alors que
-- 10 000 F ont été accordés à crédit. Le règlement est ramené à ce qui
-- est réellement entré, et la correction est tracée : jamais
-- silencieusement.
DO $$
DECLARE
    v_vente   RECORD;
    v_regle   NUMERIC;
    v_reel    NUMERIC;
    v_nb      INTEGER := 0;
BEGIN
    FOR v_vente IN
        SELECT s.id, s.public_id, s.shop_id, s.montant_total, s.credit_accorde,
               s.advance_utilise, s.change_utilise,
               COALESCE((SELECT SUM(p.montant) FROM sale_payments p WHERE p.sale_id = s.id), 0) AS montant_declare
          FROM sales s
         WHERE s.credit_accorde > 0
    LOOP
        v_reel := GREATEST(
            v_vente.montant_total - v_vente.advance_utilise
            - v_vente.change_utilise - v_vente.credit_accorde, 0);

        IF ABS(v_vente.montant_declare - v_reel) < 0.01 THEN CONTINUE; END IF;

        -- Une seule ligne de règlement par vente en production : on la
        -- ramène au montant réel plutôt que de répartir.
        UPDATE sale_payments
           SET montant = v_reel,
               reference = COALESCE(reference, '')
                         || ' [régularisé le ' || CURRENT_DATE
                         || ' : ' || v_vente.montant_declare || ' déclarés, '
                         || v_vente.credit_accorde || ' accordés à crédit]'
         WHERE sale_id = v_vente.id;

        v_nb := v_nb + 1;
        RAISE NOTICE 'Migration 028 : % — règlement ramené de % à % (% à crédit).',
            v_vente.public_id, v_vente.montant_declare, v_reel, v_vente.credit_accorde;
    END LOOP;

    RAISE NOTICE 'Migration 028 : % vente(s) régularisée(s).', v_nb;
END $$;

-- ── Contrôle ─────────────────────────────────────────────────
DO $$
DECLARE
    v_restantes INTEGER;
BEGIN
    SELECT count(*) INTO v_restantes
      FROM sales s
     WHERE ABS(
             COALESCE((SELECT SUM(p.montant) FROM sale_payments p WHERE p.sale_id = s.id), 0)
             - GREATEST(s.montant_total - s.advance_utilise - s.change_utilise - s.credit_accorde, 0)
             - s.credit_utilise
           ) > 0.01;

    IF v_restantes > 0 THEN
        RAISE EXCEPTION 'Migration 028 : % vente(s) déclarent encore un encaissement incohérent.', v_restantes;
    END IF;
    RAISE NOTICE 'Migration 028 : toutes les ventes déclarent exactement ce qui est entré en caisse.';
END $$;
