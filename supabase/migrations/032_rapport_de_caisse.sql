-- ═══════════════════════════════════════════════════════════════
-- 032 — De quoi rapporter la caisse
--
-- Le Lot 4 POS a créé la session de caisse : fond du matin, comptage
-- du soir, écart constaté. Rien ne la rapportait. Le gérant qui veut
-- savoir combien de fois le tiroir a manqué ce mois-ci n'avait aucun
-- document à sortir, alors que chaque journée était pourtant écrite.
--
-- Décision D4 : un seul document, deux niveaux. On l'ouvre pour la
-- synthèse du mois, on descend pour comprendre une journée. C'est le
-- même geste que le relevé de compte fournisseur du Lot 4.
--
--   journees_caisse()        une ligne par journée, avec son écart
--   mouvements_caisse_jour() le détail par jour et par moyen
--
-- Les deux datent sur la journée VÉCUE dans la boutique, comme le
-- reste du logiciel depuis le Lot 5 Finances.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Les journées de caisse ─────────────────────────────────
-- Une session porte déjà son attendu et son écart, figés à la
-- fermeture : on ne les recalcule pas — un écart constaté ne se
-- rejoue pas, sinon il finirait par disparaître tout seul. Ce qu'on
-- ajoute ici, c'est le contexte de la journée : ce qui est entré,
-- par quel moyen, et combien de ventes.

CREATE OR REPLACE FUNCTION journees_caisse(
    p_shop_id  UUID,
    p_debut    DATE,
    p_fin      DATE,
    p_decalage INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    session_id       UUID,
    public_id        TEXT,
    jour             DATE,
    entrepot         TEXT,
    statut           TEXT,
    fond_initial     NUMERIC,
    attendu_especes  NUMERIC,
    compte_especes   NUMERIC,
    ecart            NUMERIC,
    ouverte_par      TEXT,
    fermee_par       TEXT,
    note_ouverture   TEXT,
    note_fermeture   TEXT,
    encaisse_especes NUMERIC,
    encaisse_autres  NUMERIC,
    sorties_especes  NUMERIC,
    nb_ventes        INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION journees_caisse IS
'Une ligne par journée de caisse : le fond, l''attendu, le compté, l''écart tel qu''il a été constaté, et ce qui s''est passé ce jour-là.';


-- ── 2. Le détail d'une période, jour par jour et moyen par moyen ──
-- Le récapitulatif dit « il manquait 3 000 F le 12 ». Cette
-- fonction dit par où l'argent est passé ce jour-là.

CREATE OR REPLACE FUNCTION mouvements_caisse_jour(
    p_shop_id  UUID,
    p_debut    DATE,
    p_fin      DATE,
    p_decalage INTERVAL DEFAULT '1 hour'
)
RETURNS TABLE (
    jour    DATE,
    moyen   TEXT,
    entrees NUMERIC,
    sorties NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION mouvements_caisse_jour IS
'Entrées et sorties d''une période, ventilées par journée et par moyen de paiement.';


GRANT EXECUTE ON FUNCTION journees_caisse         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mouvements_caisse_jour  TO authenticated, service_role;
