-- ═══════════════════════════════════════════════════════════════
-- 031 — Une seule source pour les chiffres
--
-- Ce module n'avait pas un défaut de conception : il avait un défaut
-- de SYNCHRONISATION. Le chiffre d'affaires d'une période était
-- recalculé dans le rapport de ventes, dans le compte de résultat et
-- dans le tableau de bord, avec trois requêtes distinctes écrites à
-- trois moments différents. Elles coïncidaient par chance, sur des
-- données simples. Puis le Lot 2 POS a décidé que le crédit accordé
-- n'entrait pas en caisse : une seule des trois l'a su.
--
-- On pose ici les agrégats qui comptent, en SQL, à un seul endroit.
-- Une règle qui change s'applique alors partout d'un coup, au lieu
-- d'être recopiée à la main dans chaque écran.
--
--   ca_periode()          l'argent des ventes : facturé ET encaissé
--   tresorerie_periode()  ce qui entre et ce qui sort d'une période
--   clients_encours()     la dette client, face à son plafond
--   valeur_stock()        le stock, au prix RÉELLEMENT payé
--
-- Et deux fonctions existantes reprises, parce qu'elles portaient la
-- même erreur : ventilation_caisse() comptait les règlements de
-- facture annulés et datait les ventes sur l'heure du serveur ;
-- evolution_tresorerie() traçait une courbe de « trésorerie » qui
-- ignorait les règlements de facture et comptait le crédit accordé.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. L'argent des ventes ────────────────────────────────────
-- Décision D1 : on ne choisit pas entre le facturé et l'encaissé, on
-- rend les deux, plus ce qui explique leur écart. La règle, écrite
-- ici une fois pour toutes :
--
--     facturé − crédit accordé − soldes utilisés + ardoise remboursée
--   = encaissé au comptoir
--
-- `sale_payments` ne porte que l'argent réellement reçu depuis le
-- Lot 2 POS ; c'est lui qui fait foi pour l'encaissé.

CREATE OR REPLACE FUNCTION ca_periode(
    p_shop_id  UUID,
    p_debut    DATE,
    p_fin      DATE,
    p_decalage INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    nb_ventes         INTEGER,
    ca_facture        NUMERIC,
    encaisse_pos      NUMERIC,
    credit_accorde    NUMERIC,
    soldes_utilises   NUMERIC,
    remb_ardoise      NUMERIC,
    encaisse_factures NUMERIC,
    encaisse_total    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION ca_periode IS
'L''argent des ventes d''une période : facturé, encaissé, et ce qui explique l''écart. Source unique du CA — rapport de ventes, compte de résultat et tableau de bord lisent ceci.';


-- ── 2. Ce qui entre et ce qui sort ────────────────────────────
-- Le compte de résultat et le tableau de bord comptaient les mêmes
-- cinq postes, chacun de son côté. Ils lisent maintenant la même
-- ligne. Les écarts d'inventaire sont rendus à part : ce n'est PAS
-- de la trésorerie, et les confondre ferait mentir les deux.

CREATE OR REPLACE FUNCTION tresorerie_periode(
    p_shop_id  UUID,
    p_debut    DATE,
    p_fin      DATE,
    p_decalage INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    entrees_pos          NUMERIC,
    entrees_factures     NUMERIC,
    total_entrees        NUMERIC,
    sorties_depenses     NUMERIC,
    sorties_salaires     NUMERIC,
    sorties_fournisseurs NUMERIC,
    total_sorties        NUMERIC,
    resultat             NUMERIC,
    ventes_facturees     NUMERIC,
    non_encaisse         NUMERIC,
    stock_pertes         NUMERIC,
    stock_gains          NUMERIC,
    resultat_economique  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION tresorerie_periode IS
'Entrées, sorties et résultat d''une période. Les écarts d''inventaire sont rendus à part : ce n''est pas de la trésorerie.';


-- ── 3. La dette client, face à son plafond ────────────────────
-- Le rapport clients affichait le crédit dû sans jamais le situer
-- face au plafond créé au Lot 3 Facturation : impossible de repérer
-- un client au-delà de sa limite, ce qui est pourtant la question
-- qu'on se pose en ouvrant ce rapport.

CREATE OR REPLACE FUNCTION clients_encours(p_shop_id UUID)
RETURNS TABLE (
    client_id          UUID,
    public_id          TEXT,
    nom                TEXT,
    telephone          TEXT,
    credit_balance     NUMERIC,
    advance_balance    NUMERIC,
    change_balance     NUMERIC,
    plafond_credit     NUMERIC,
    depasse_plafond    BOOLEAN,
    nb_achats          INTEGER,
    ca_total           NUMERIC,
    nb_operations      INTEGER,
    derniere_operation TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION clients_encours IS
'Encours de chaque client actif, son plafond, et son historique de soldes. Source unique du rapport clients.';


-- ── 4. Le stock, au prix réellement payé ──────────────────────
-- La valeur du stock multipliait les quantités par products.prix_achat
-- — le prix COURANT, pas celui payé. Après une hausse fournisseur, la
-- valeur du stock bondissait sans qu'un seul article soit entré.
--
-- On prend donc le dernier prix effectivement réglé à la réception, et
-- on dit sur quelle base chaque ligne est valorisée : un produit jamais
-- reçu retombe sur son prix courant, mais il le dit.

CREATE OR REPLACE FUNCTION valeur_stock(
    p_shop_id      UUID,
    p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE (
    product_id    UUID,
    warehouse_id  UUID,
    quantite      NUMERIC,
    prix_unitaire NUMERIC,
    base_prix     TEXT,
    valeur        NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION valeur_stock IS
'Valeur du stock au dernier prix réellement payé à la réception, avec la base retenue par ligne (payé / courant).';


-- ── 5. La ventilation par moyen portait deux erreurs ──────────
-- Elle comptait les règlements de facture annulés, et datait les
-- ventes sur l'heure du serveur alors que tout le reste du logiciel
-- date sur la journée vécue dans la boutique depuis le Lot 5 Finances.
--
-- L'ancienne signature à trois arguments est supprimée AVANT : sans
-- cela, ajouter un paramètre créerait une seconde fonction et un
-- appel à trois arguments deviendrait ambigu.

DROP FUNCTION IF EXISTS ventilation_caisse(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION ventilation_caisse(
    p_shop_id  UUID,
    p_debut    DATE,
    p_fin      DATE,
    p_decalage INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    moyen           TEXT,
    entrees_periode NUMERIC,
    sorties_periode NUMERIC,
    entrees_cumul   NUMERIC,
    sorties_cumul   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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


-- ── 6. La courbe des six mois disait autre chose que la page ──
-- Elle appelait « CA » le montant facturé, et oubliait purement et
-- simplement les règlements de facture : le compte de résultat
-- affichait donc, sur la même feuille, un total d'entrées et une
-- courbe qui ne pouvaient pas coïncider.
--
-- Elle repose maintenant sur tresorerie_periode : une seule règle,
-- un seul endroit. Les colonnes sont renommées pour dire ce qu'elles
-- contiennent — d'où le DROP, un CREATE OR REPLACE ne peut pas
-- changer les colonnes de sortie.

DROP FUNCTION IF EXISTS evolution_tresorerie(UUID, INTEGER, INTEGER, INTEGER, INTERVAL);

CREATE OR REPLACE FUNCTION evolution_tresorerie(
    p_shop_id   UUID,
    p_mois_fin  INTEGER,
    p_annee_fin INTEGER,
    p_nb_mois   INTEGER DEFAULT 6,
    p_decalage  INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    mois     INTEGER,
    annee    INTEGER,
    entrees  NUMERIC,
    sorties  NUMERIC,
    resultat NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION evolution_tresorerie IS
'Six mois de trésorerie, calculés par tresorerie_periode : la courbe et le total de la page disent forcément la même chose.';


-- ── Droits ────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION ca_periode           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION tresorerie_periode   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION clients_encours      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION valeur_stock         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION ventilation_caisse   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION evolution_tresorerie TO authenticated, service_role;
