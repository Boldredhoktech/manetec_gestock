-- ════════════════════════════════════════════════════════════════
-- 041 — Comptes de trésorerie
--
-- Jusqu'ici l'argent n'était rangé que par « moyen de paiement » (texte
-- libre) : impossible de dire combien contient LA caisse du dépôt ou LE
-- compte MTN, et un dépôt d'espèces en banque n'était écrit nulle part
-- (d'où un solde « théorique », cf. mig 022).
--
-- Désormais chaque mouvement d'argent désigne un COMPTE :
--   caisse · banque · mobile_money · tpe
-- et le moyen de paiement en est DÉDUIT (trigger) : il reste lisible par
-- les rapports existants, mais ne se saisit plus.
--
-- Décisions (2026-11-14) :
--   • une caisse par entrepôt, créée automatiquement (y compris pour un
--     entrepôt créé plus tard) ; banque / Mobile Money / TPE : créés par
--     la boutique ;
--   • l'historique est rattaché à ces caisses (ou à un compte « repris »
--     créé pour un moyen déjà utilisé), de façon tracée ;
--   • solde négatif REFUSÉ pour une caisse ou un Mobile Money, simple
--     avertissement (côté écran) pour une banque ou un TPE ;
--   • virements internes (frais = dépense sur le compte de départ) ;
--   • solde d'ouverture daté ; rapprochement = écart CONSTATÉ, jamais
--     corrigé en silence.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Comptes ──────────────────────────────────────────────────
CREATE TABLE public.comptes_tresorerie (
    id                     UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    public_id              TEXT NOT NULL,
    shop_id                UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    type                   TEXT NOT NULL CHECK (type IN ('caisse', 'banque', 'mobile_money', 'tpe')),
    nom                    TEXT NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 80),
    -- Mobile Money : opérateur (obligatoire). Banque : nom de la banque.
    operateur              TEXT CHECK (operateur IN ('mtn', 'moov', 'celtiis', 'wave', 'autre')),
    banque                 TEXT,
    -- N° de compte, IBAN ou n° de téléphone marchand.
    numero                 TEXT,
    -- Caisse : l'entrepôt dont elle est le tiroir (une seule par entrepôt).
    warehouse_id           UUID REFERENCES public.warehouses(id),
    -- TPE : le compte bancaire sur lequel l'opérateur reverse.
    compte_reversement_id  UUID REFERENCES public.comptes_tresorerie(id),
    solde_ouverture        NUMERIC(15,2) NOT NULL DEFAULT 0,
    date_ouverture         DATE NOT NULL DEFAULT CURRENT_DATE,
    est_actif              BOOLEAN NOT NULL DEFAULT TRUE,
    note                   TEXT,
    created_by             UUID,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comptes_tresorerie_public_id_key UNIQUE (shop_id, public_id),
    CONSTRAINT comptes_tresorerie_nom_key       UNIQUE (shop_id, nom),
    CONSTRAINT comptes_mm_operateur  CHECK (type <> 'mobile_money' OR operateur IS NOT NULL),
    CONSTRAINT comptes_entrepot_caisse CHECK (warehouse_id IS NULL OR type = 'caisse'),
    CONSTRAINT comptes_reversement_tpe CHECK (compte_reversement_id IS NULL OR type = 'tpe')
);

CREATE UNIQUE INDEX comptes_tresorerie_une_caisse_par_entrepot
    ON public.comptes_tresorerie (warehouse_id) WHERE type = 'caisse' AND warehouse_id IS NOT NULL;
CREATE INDEX comptes_tresorerie_shop_idx ON public.comptes_tresorerie (shop_id, type);

CREATE TRIGGER trg_comptes_tresorerie_updated_at
    BEFORE UPDATE ON public.comptes_tresorerie
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.comptes_tresorerie IS
    'Où se trouve l''argent de la boutique : caisses (une par entrepôt), comptes bancaires, Mobile Money, TPE. Tout mouvement d''argent désigne un compte (compte_id) ; le moyen de paiement en est déduit.';

-- Moyen de paiement déduit du compte : mêmes codes que
-- lib/constants/moyens-paiement.ts, que lisent les rapports existants.
CREATE OR REPLACE FUNCTION public.moyen_du_compte(p_type TEXT, p_operateur TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE p_type
        WHEN 'caisse' THEN 'cash'
        WHEN 'banque' THEN 'bank_transfer'
        WHEN 'tpe'    THEN 'bank_card'
        ELSE CASE p_operateur
            WHEN 'mtn'     THEN 'mtn_momo'
            WHEN 'moov'    THEN 'moov_money'
            WHEN 'celtiis' THEN 'celtiis_cash'
            WHEN 'wave'    THEN 'wave'
            ELSE 'other_mobile'
        END
    END
$$;

-- ── 2. Virements et rapprochements ──────────────────────────────
CREATE TABLE public.virements_tresorerie (
    id                     UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    public_id              TEXT NOT NULL,
    shop_id                UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    compte_source_id       UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
    compte_destination_id  UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
    montant                NUMERIC(15,2) NOT NULL CHECK (montant > 0),
    frais                  NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (frais >= 0),
    -- Les frais sont une DÉPENSE sur le compte de départ.
    expense_id             UUID REFERENCES public.expenses(id),
    date_virement          DATE NOT NULL DEFAULT CURRENT_DATE,
    reference              TEXT,
    note                   TEXT,
    est_annule             BOOLEAN NOT NULL DEFAULT FALSE,
    annule_le              TIMESTAMPTZ,
    annule_par             UUID,
    motif_annulation       TEXT,
    created_by             UUID,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT virements_public_id_key UNIQUE (shop_id, public_id),
    CONSTRAINT virements_comptes_distincts CHECK (compte_source_id <> compte_destination_id)
);
CREATE INDEX virements_source_idx      ON public.virements_tresorerie (compte_source_id);
CREATE INDEX virements_destination_idx ON public.virements_tresorerie (compte_destination_id);

CREATE TABLE public.rapprochements_tresorerie (
    id                 UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    shop_id            UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    compte_id          UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
    date_rapprochement DATE NOT NULL,
    solde_reel         NUMERIC(15,2) NOT NULL,
    solde_theorique    NUMERIC(15,2) NOT NULL,
    ecart              NUMERIC(15,2) GENERATED ALWAYS AS (solde_reel - solde_theorique) STORED,
    note               TEXT,
    created_by         UUID,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX rapprochements_compte_idx ON public.rapprochements_tresorerie (compte_id, date_rapprochement DESC);

COMMENT ON TABLE public.rapprochements_tresorerie IS
    'Solde réel constaté (relevé, solde MoMo, comptage) face au solde du logiciel à une date. L''écart est CONSTATÉ, jamais corrigé automatiquement.';

-- Retraits et apports du propriétaire : l'argent qu'il sort de la
-- boutique pour lui, ou qu'il y remet. Ni chiffre d'affaires ni charge :
-- ils changent le solde du compte sans fausser le résultat.
CREATE TABLE public.operations_proprietaire (
    id                 UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    public_id          TEXT NOT NULL,
    shop_id            UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    compte_id          UUID NOT NULL REFERENCES public.comptes_tresorerie(id),
    type               TEXT NOT NULL CHECK (type IN ('retrait', 'apport')),
    montant            NUMERIC(15,2) NOT NULL CHECK (montant > 0),
    -- Déduit du compte par le trigger de garde, comme partout.
    moyen_paiement     TEXT,
    date_operation     DATE NOT NULL DEFAULT CURRENT_DATE,
    beneficiaire       TEXT,
    motif              TEXT NOT NULL CHECK (length(trim(motif)) >= 2),
    reference          TEXT,
    est_annule         BOOLEAN NOT NULL DEFAULT FALSE,
    annule_le          TIMESTAMPTZ,
    annule_par         UUID,
    motif_annulation   TEXT,
    created_by         UUID,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT operations_proprietaire_public_id_key UNIQUE (shop_id, public_id)
);
CREATE INDEX operations_proprietaire_compte_idx ON public.operations_proprietaire (compte_id);

COMMENT ON TABLE public.operations_proprietaire IS
    'Retraits (sorties pour le propriétaire) et apports (argent remis par le propriétaire). Hors chiffre d''affaires et hors charges.';

-- ── 3. Isolation par boutique (même modèle que les autres tables) ──
DO $$
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['comptes_tresorerie', 'virements_tresorerie', 'rapprochements_tresorerie', 'operations_proprietaire']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
        EXECUTE format($p$CREATE POLICY %I ON public.%I
            USING (shop_id = (SELECT ((auth.jwt() -> 'user_metadata') ->> 'shop_id')::uuid))$p$,
            v_table || '_isolation', v_table);
        EXECUTE format($p$CREATE POLICY licence_en_service ON public.%I AS RESTRICTIVE
            USING ((SELECT public.session_boutique_en_service()))
            WITH CHECK ((SELECT public.session_boutique_en_service()))$p$, v_table);
    END LOOP;
END $$;

-- ── 4. Compteurs de numéros (CPT-, VIR-) ────────────────────────
INSERT INTO public.public_id_counters (shop_id, prefix, last_value)
SELECT s.id, p.prefix, 0
  FROM public.shops s
 CROSS JOIN (VALUES ('CPT'), ('VIR'), ('OPR')) AS p(prefix)
ON CONFLICT (shop_id, prefix) DO NOTHING;

-- Numéro suivant, en créant le compteur s'il manque (boutique créée
-- avant l'ajout d'un préfixe) : evite le repli sur 0 de generate_public_id.
CREATE OR REPLACE FUNCTION public.prochain_numero(p_shop_id UUID, p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    INSERT INTO public_id_counters (shop_id, prefix, last_value)
    VALUES (p_shop_id, p_prefix, 0)
    ON CONFLICT (shop_id, prefix) DO NOTHING;
    RETURN generate_public_id(p_shop_id, p_prefix);
END;
$$;

-- ── 5. Une caisse par entrepôt, y compris les entrepôts futurs ───
CREATE OR REPLACE FUNCTION public.creer_caisse_entrepot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_nom TEXT := left('Caisse — ' || NEW.nom, 80);
BEGIN
    IF EXISTS (SELECT 1 FROM comptes_tresorerie WHERE warehouse_id = NEW.id AND type = 'caisse') THEN
        RETURN NEW;
    END IF;
    -- Deux entrepôts de même nom : le nom du compte doit rester unique.
    IF EXISTS (SELECT 1 FROM comptes_tresorerie WHERE shop_id = NEW.shop_id AND nom = v_nom) THEN
        v_nom := left(v_nom, 70) || ' (' || NEW.public_id || ')';
    END IF;
    INSERT INTO comptes_tresorerie (public_id, shop_id, type, nom, warehouse_id, date_ouverture, note)
    VALUES (prochain_numero(NEW.shop_id, 'CPT'), NEW.shop_id, 'caisse', v_nom, NEW.id,
            COALESCE(NEW.created_at::date, CURRENT_DATE),
            'Créée automatiquement avec l''entrepôt.');
    RETURN NEW;
END;
$$;

CREATE TRIGGER warehouses_creer_caisse
    AFTER INSERT ON public.warehouses
    FOR EACH ROW EXECUTE FUNCTION public.creer_caisse_entrepot();

-- Entrepôts existants : leur caisse, ouverte à la date de l'entrepôt
-- (les mouvements passés y sont rattachés plus bas).
DO $$
DECLARE
    v_w RECORD;
    v_nom TEXT;
BEGIN
    FOR v_w IN SELECT * FROM public.warehouses ORDER BY shop_id, created_at, public_id LOOP
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.comptes_tresorerie WHERE warehouse_id = v_w.id);
        v_nom := left('Caisse — ' || v_w.nom, 80);
        IF EXISTS (SELECT 1 FROM public.comptes_tresorerie WHERE shop_id = v_w.shop_id AND nom = v_nom) THEN
            v_nom := left(v_nom, 70) || ' (' || v_w.public_id || ')';
        END IF;
        INSERT INTO public.comptes_tresorerie (public_id, shop_id, type, nom, warehouse_id, date_ouverture, note)
        VALUES (public.prochain_numero(v_w.shop_id, 'CPT'), v_w.shop_id, 'caisse', v_nom, v_w.id,
                v_w.created_at::date, 'Créée par la migration 041 (une caisse par entrepôt).');
    END LOOP;
END $$;

-- ── 6. compte_id sur les 5 tables d'argent ──────────────────────
ALTER TABLE public.sale_payments     ADD COLUMN compte_id UUID REFERENCES public.comptes_tresorerie(id);
ALTER TABLE public.facture_payments  ADD COLUMN compte_id UUID REFERENCES public.comptes_tresorerie(id);
ALTER TABLE public.expenses          ADD COLUMN compte_id UUID REFERENCES public.comptes_tresorerie(id);
ALTER TABLE public.salary_payments   ADD COLUMN compte_id UUID REFERENCES public.comptes_tresorerie(id);
ALTER TABLE public.supplier_payments ADD COLUMN compte_id UUID REFERENCES public.comptes_tresorerie(id);

-- Rattachement de l'historique. Espèces → caisse de l'entrepôt de la
-- vente, sinon de l'entrepôt par défaut. Autre moyen déjà utilisé →
-- un compte « (repris) » de ce type, créé une fois par boutique.
CREATE OR REPLACE FUNCTION pg_temp.compte_repris(p_shop UUID, p_moyen TEXT, p_warehouse UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id    UUID;
    v_type  TEXT;
    v_op    TEXT;
    v_nom   TEXT;
BEGIN
    IF COALESCE(p_moyen, 'cash') = 'cash' THEN
        SELECT c.id INTO v_id FROM public.comptes_tresorerie c
         WHERE c.shop_id = p_shop AND c.type = 'caisse' AND c.warehouse_id = p_warehouse;
        IF v_id IS NULL THEN
            SELECT c.id INTO v_id FROM public.comptes_tresorerie c
              JOIN public.warehouses w ON w.id = c.warehouse_id
             WHERE c.shop_id = p_shop AND c.type = 'caisse'
             ORDER BY w.est_defaut DESC, w.created_at LIMIT 1;
        END IF;
        IF v_id IS NOT NULL THEN RETURN v_id; END IF;
        v_type := 'caisse'; v_nom := 'Caisse (reprise)';
    ELSE
        v_type := CASE
            WHEN p_moyen = 'bank_card' THEN 'tpe'
            WHEN p_moyen IN ('mtn_momo', 'moov_money', 'celtiis_cash', 'wave', 'other_mobile') THEN 'mobile_money'
            ELSE 'banque' END;
        v_op := CASE p_moyen WHEN 'mtn_momo' THEN 'mtn' WHEN 'moov_money' THEN 'moov'
                WHEN 'celtiis_cash' THEN 'celtiis' WHEN 'wave' THEN 'wave'
                WHEN 'other_mobile' THEN 'autre' END;
        v_nom := CASE p_moyen
            WHEN 'mtn_momo' THEN 'MTN Mobile Money' WHEN 'moov_money' THEN 'Moov Money'
            WHEN 'celtiis_cash' THEN 'Celtiis Cash' WHEN 'wave' THEN 'Wave'
            WHEN 'other_mobile' THEN 'Mobile Money' WHEN 'bank_card' THEN 'Terminal carte'
            ELSE 'Banque' END || ' (repris)';
    END IF;

    SELECT id INTO v_id FROM public.comptes_tresorerie WHERE shop_id = p_shop AND nom = v_nom;
    IF v_id IS NULL THEN
        INSERT INTO public.comptes_tresorerie (public_id, shop_id, type, operateur, nom, date_ouverture, note)
        VALUES (public.prochain_numero(p_shop, 'CPT'), p_shop, v_type, v_op, v_nom, DATE '2000-01-01',
                'Créé par la migration 041 pour l''historique payé en « ' || coalesce(p_moyen, '?') || ' ». À renommer ou compléter (numéro).')
        RETURNING id INTO v_id;
    END IF;
    RETURN v_id;
END;
$$;

UPDATE public.sale_payments sp
   SET compte_id = pg_temp.compte_repris(sp.shop_id, sp.moyen_paiement, s.warehouse_id)
  FROM public.sales s
 WHERE s.id = sp.sale_id AND sp.compte_id IS NULL;

UPDATE public.facture_payments  SET compte_id = pg_temp.compte_repris(shop_id, moyen_paiement, NULL) WHERE compte_id IS NULL;
UPDATE public.expenses          SET compte_id = pg_temp.compte_repris(shop_id, moyen_paiement, NULL) WHERE compte_id IS NULL;
UPDATE public.salary_payments   SET compte_id = pg_temp.compte_repris(shop_id, moyen_paiement, NULL) WHERE compte_id IS NULL;
UPDATE public.supplier_payments SET compte_id = pg_temp.compte_repris(shop_id, moyen_paiement, NULL) WHERE compte_id IS NULL;

-- Les caisses doivent couvrir l'historique qu'on vient de leur confier.
UPDATE public.comptes_tresorerie c
   SET date_ouverture = LEAST(c.date_ouverture, DATE '2000-01-01')
 WHERE EXISTS (SELECT 1 FROM public.sale_payments     WHERE compte_id = c.id)
    OR EXISTS (SELECT 1 FROM public.facture_payments  WHERE compte_id = c.id)
    OR EXISTS (SELECT 1 FROM public.expenses          WHERE compte_id = c.id)
    OR EXISTS (SELECT 1 FROM public.salary_payments   WHERE compte_id = c.id)
    OR EXISTS (SELECT 1 FROM public.supplier_payments WHERE compte_id = c.id);

INSERT INTO public.audit_logs (shop_id, type_acteur, event_type, reference_type, user_nom, details_json)
SELECT c.shop_id, 'platform', 'TRESORERIE_HISTORIQUE_RATTACHE', 'compte_tresorerie', 'Migration 041',
       jsonb_build_object('comptes', jsonb_agg(jsonb_build_object('compte', c.public_id, 'nom', c.nom)),
                          'motif', 'Comptes de trésorerie : mouvements existants rattachés à un compte (mig 041)')
  FROM public.comptes_tresorerie c
 GROUP BY c.shop_id;

ALTER TABLE public.sale_payments     ALTER COLUMN compte_id SET NOT NULL;
ALTER TABLE public.facture_payments  ALTER COLUMN compte_id SET NOT NULL;
ALTER TABLE public.expenses          ALTER COLUMN compte_id SET NOT NULL;
ALTER TABLE public.salary_payments   ALTER COLUMN compte_id SET NOT NULL;
ALTER TABLE public.supplier_payments ALTER COLUMN compte_id SET NOT NULL;

CREATE INDEX sale_payments_compte_idx     ON public.sale_payments (compte_id);
CREATE INDEX facture_payments_compte_idx  ON public.facture_payments (compte_id);
CREATE INDEX expenses_compte_idx          ON public.expenses (compte_id);
CREATE INDEX salary_payments_compte_idx   ON public.salary_payments (compte_id);
CREATE INDEX supplier_payments_compte_idx ON public.supplier_payments (compte_id);

-- ── 7. Le grand livre : UNE vue de tous les mouvements ──────────
-- security_invoker : la RLS de chaque table s'applique au lecteur.
-- Les lignes ANNULÉES restent (est_annule = true) pour que la fiche du
-- compte montre aussi les corrections ; les soldes les écartent.
CREATE VIEW public.mouvements_tresorerie WITH (security_invoker = true) AS
    SELECT sp.shop_id, sp.compte_id,
           (s.created_at + INTERVAL '1 hour')::date AS jour,
           'entree'::text AS sens, sp.montant,
           'vente'::text AS origine, s.id AS origine_id, s.public_id,
           'Vente ' || s.public_id AS libelle, sp.reference,
           (s.statut <> 'completee') AS est_annule,
           NULL::timestamptz AS modifie_le, sp.created_at
      FROM public.sale_payments sp
      JOIN public.sales s ON s.id = sp.sale_id
    UNION ALL
    SELECT fp.shop_id, fp.compte_id, fp.date_paiement, 'entree', fp.montant,
           'reglement_facture', fp.facture_id, fp.public_id,
           'Règlement de la facture ' || f.public_id, fp.reference,
           fp.est_annule, fp.modifie_le, fp.created_at
      FROM public.facture_payments fp
      JOIN public.factures f ON f.id = fp.facture_id
    UNION ALL
    SELECT e.shop_id, e.compte_id, e.date_depense, 'sortie', e.montant,
           'depense', e.id, e.public_id, e.libelle, e.reference,
           e.est_annule, e.modifie_le, e.created_at
      FROM public.expenses e
    UNION ALL
    SELECT sal.shop_id, sal.compte_id, sal.date_paiement, 'sortie', sal.montant_net,
           'salaire', sal.id, sal.public_id, 'Salaire ' || sal.public_id, sal.reference,
           sal.est_annule, sal.modifie_le, sal.created_at
      FROM public.salary_payments sal
    UNION ALL
    SELECT f.shop_id, f.compte_id, f.date_paiement, 'sortie', f.montant,
           'paiement_fournisseur', f.id, f.public_id, 'Paiement fournisseur ' || f.public_id, f.reference,
           FALSE, NULL::timestamptz, f.created_at
      FROM public.supplier_payments f
    UNION ALL
    SELECT v.shop_id, v.compte_source_id, v.date_virement, 'sortie', v.montant,
           'virement', v.id, v.public_id, 'Virement vers ' || d.nom, v.reference,
           v.est_annule, NULL::timestamptz, v.created_at
      FROM public.virements_tresorerie v
      JOIN public.comptes_tresorerie d ON d.id = v.compte_destination_id
    UNION ALL
    SELECT v.shop_id, v.compte_destination_id, v.date_virement, 'entree', v.montant,
           'virement', v.id, v.public_id, 'Virement depuis ' || o.nom, v.reference,
           v.est_annule, NULL::timestamptz, v.created_at
      FROM public.virements_tresorerie v
      JOIN public.comptes_tresorerie o ON o.id = v.compte_source_id
    UNION ALL
    SELECT op.shop_id, op.compte_id, op.date_operation,
           CASE op.type WHEN 'retrait' THEN 'sortie' ELSE 'entree' END,
           op.montant, op.type, op.id, op.public_id,
           CASE op.type WHEN 'retrait' THEN 'Retrait du propriétaire' ELSE 'Apport du propriétaire' END
             || COALESCE(' — ' || op.motif, ''),
           op.reference, op.est_annule, NULL::timestamptz, op.created_at
      FROM public.operations_proprietaire op;

COMMENT ON VIEW public.mouvements_tresorerie IS
    'Grand livre de trésorerie : chaque entrée/sortie d''argent rattachée à son compte, annulations comprises (est_annule). Seule source des soldes, qui écartent les lignes annulées.';

-- Soldes de tous les comptes d'une boutique, arrêtés à une date
-- (NULL = tout, futur compris).
CREATE OR REPLACE FUNCTION public.soldes_comptes(p_shop_id UUID, p_au DATE DEFAULT NULL)
RETURNS TABLE (compte_id UUID, solde_ouverture NUMERIC, entrees NUMERIC, sorties NUMERIC, solde NUMERIC)
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT c.id,
           CASE WHEN p_au IS NULL OR c.date_ouverture <= p_au THEN c.solde_ouverture ELSE 0 END,
           COALESCE(SUM(m.montant) FILTER (WHERE m.sens = 'entree'), 0),
           COALESCE(SUM(m.montant) FILTER (WHERE m.sens = 'sortie'), 0),
           CASE WHEN p_au IS NULL OR c.date_ouverture <= p_au THEN c.solde_ouverture ELSE 0 END
             + COALESCE(SUM(m.montant) FILTER (WHERE m.sens = 'entree'), 0)
             - COALESCE(SUM(m.montant) FILTER (WHERE m.sens = 'sortie'), 0)
      FROM comptes_tresorerie c
      LEFT JOIN mouvements_tresorerie m
             ON m.compte_id = c.id AND NOT m.est_annule AND (p_au IS NULL OR m.jour <= p_au)
     WHERE c.shop_id = p_shop_id
     GROUP BY c.id
$$;

CREATE OR REPLACE FUNCTION public.solde_compte(p_compte_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT c.solde_ouverture
         + COALESCE((SELECT SUM(CASE m.sens WHEN 'entree' THEN m.montant ELSE -m.montant END)
                       FROM mouvements_tresorerie m
                      WHERE m.compte_id = c.id AND NOT m.est_annule), 0)
      FROM comptes_tresorerie c WHERE c.id = p_compte_id
$$;

-- Montant lisible dans un message : « 70 000 F ».
CREATE OR REPLACE FUNCTION public.montant_fr(p NUMERIC)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT replace(to_char(round(p), 'FM999G999G999G990'), ',', ' ') || ' F'
$$;

-- ── 8. Garde de chaque mouvement d'argent ───────────────────────
-- TG_ARGV[0] = colonne du montant, TG_ARGV[1] = 'entree' | 'sortie'.
--   • le compte appartient à la boutique et est actif ;
--   • le moyen de paiement est DÉDUIT du compte ;
--   • une sortie ne peut pas mettre une caisse ou un Mobile Money à découvert.
CREATE OR REPLACE FUNCTION public.garde_mouvement_tresorerie()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_compte   comptes_tresorerie%ROWTYPE;
    v_nouveau  JSONB := to_jsonb(NEW);
    v_ancien   JSONB;
    v_montant  NUMERIC := (v_nouveau ->> TG_ARGV[0])::NUMERIC;
    v_sens     TEXT := CASE TG_ARGV[1]
                           WHEN 'selon_type' THEN CASE v_nouveau ->> 'type' WHEN 'retrait' THEN 'sortie' ELSE 'entree' END
                           ELSE TG_ARGV[1] END;
    v_solde    NUMERIC;
BEGIN
    IF NEW.compte_id IS NULL THEN
        RAISE EXCEPTION 'Choisissez le compte (caisse, banque, Mobile Money ou TPE) de ce mouvement.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_compte FROM comptes_tresorerie WHERE id = NEW.compte_id FOR UPDATE;

    IF NOT FOUND OR v_compte.shop_id <> NEW.shop_id THEN
        RAISE EXCEPTION 'Compte de trésorerie introuvable.' USING ERRCODE = 'P0001';
    END IF;

    NEW.moyen_paiement := moyen_du_compte(v_compte.type, v_compte.operateur);

    IF TG_OP = 'UPDATE' THEN
        v_ancien := to_jsonb(OLD);
    END IF;

    -- Un compte désactivé ne reçoit plus de NOUVEAU mouvement.
    IF NOT v_compte.est_actif AND (TG_OP = 'INSERT' OR OLD.compte_id IS DISTINCT FROM NEW.compte_id) THEN
        RAISE EXCEPTION 'Le compte « % » est désactivé.', v_compte.nom USING ERRCODE = 'P0001';
    END IF;

    IF v_sens = 'sortie'
       AND v_compte.type IN ('caisse', 'mobile_money')
       AND COALESCE((v_nouveau ->> 'est_annule')::BOOLEAN, FALSE) = FALSE
    THEN
        v_solde := solde_compte(v_compte.id);
        -- Une correction : l'ancienne version de la ligne est déjà dans le solde.
        IF TG_OP = 'UPDATE' AND OLD.compte_id = NEW.compte_id
           AND COALESCE((v_ancien ->> 'est_annule')::BOOLEAN, FALSE) = FALSE THEN
            v_solde := v_solde + (v_ancien ->> TG_ARGV[0])::NUMERIC;
        END IF;
        IF v_solde - v_montant < 0 THEN
            RAISE EXCEPTION 'Solde insuffisant sur « % » : % disponibles pour une sortie de %.',
                v_compte.nom, montant_fr(v_solde), montant_fr(v_montant)
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sale_payments_garde_compte BEFORE INSERT OR UPDATE ON public.sale_payments
    FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_tresorerie('montant', 'entree');
CREATE TRIGGER facture_payments_garde_compte BEFORE INSERT OR UPDATE ON public.facture_payments
    FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_tresorerie('montant', 'entree');
CREATE TRIGGER expenses_garde_compte BEFORE INSERT OR UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_tresorerie('montant', 'sortie');
CREATE TRIGGER salary_payments_garde_compte BEFORE INSERT OR UPDATE ON public.salary_payments
    FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_tresorerie('montant_net', 'sortie');
CREATE TRIGGER supplier_payments_garde_compte BEFORE INSERT OR UPDATE ON public.supplier_payments
    FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_tresorerie('montant', 'sortie');
CREATE TRIGGER operations_proprietaire_garde_compte BEFORE INSERT OR UPDATE ON public.operations_proprietaire
    FOR EACH ROW EXECUTE FUNCTION public.garde_mouvement_tresorerie('montant', 'selon_type');

-- ── 9. Les fonctions de paiement prennent un COMPTE ─────────────
-- On repart de la définition EN BASE (pas d'une copie qui pourrait
-- avoir dérivé) et on n'y change que les lignes de paiement ; chaque
-- remplacement est vérifié. Ajouter un paramètre créerait une surcharge
-- (piège vu à la mig 025) : l'ancienne version est supprimée.
CREATE OR REPLACE FUNCTION pg_temp.remplacer(p_texte TEXT, p_avant TEXT, p_apres TEXT, p_ou TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    IF position(p_avant IN p_texte) = 0 THEN
        RAISE EXCEPTION 'Mig 041 : « % » introuvable dans %.', p_avant, p_ou;
    END IF;
    RETURN replace(p_texte, p_avant, p_apres);
END;
$$;

DO $$
DECLARE
    v_def  TEXT;
    v_fn   TEXT;
    v_sig  TEXT;
BEGIN
    -- 9a. p_moyen TEXT → p_compte_id UUID (même position)
    FOREACH v_fn IN ARRAY ARRAY['payer_facture', 'payer_facture_fournisseur', 'payer_fournisseur', 'modifier_paiement_facture']
    LOOP
        SELECT pg_get_functiondef(p.oid), pg_get_function_identity_arguments(p.oid)
          INTO v_def, v_sig
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = v_fn;

        v_def := pg_temp.remplacer(v_def, 'p_moyen text', 'p_compte_id uuid', v_fn);
        IF v_fn = 'modifier_paiement_facture' THEN
            v_def := pg_temp.remplacer(v_def, 'moyen_paiement = p_moyen', 'compte_id      = p_compte_id', v_fn);
        ELSE
            v_def := pg_temp.remplacer(v_def, 'moyen_paiement', 'compte_id', v_fn);
            v_def := pg_temp.remplacer(v_def, 'p_moyen', 'p_compte_id', v_fn);
        END IF;

        EXECUTE format('DROP FUNCTION public.%I(%s)', v_fn, v_sig);
        EXECUTE v_def;
    END LOOP;

    -- 9b. enregistrer_vente : chaque paiement du JSON porte son compte_id
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'enregistrer_vente';
    v_def := pg_temp.remplacer(v_def,
        'shop_id, sale_id, moyen_paiement, montant, reference',
        'shop_id, sale_id, compte_id, montant, reference', 'enregistrer_vente');
    v_def := pg_temp.remplacer(v_def,
        'v_item->>''moyen_paiement'',',
        '(v_item->>''compte_id'')::UUID,', 'enregistrer_vente');
    EXECUTE v_def;

    -- 9c. regler_retour_vente : remboursement depuis le compte choisi,
    --     par défaut la caisse de l'entrepôt du retour.
    SELECT pg_get_functiondef(p.oid), pg_get_function_identity_arguments(p.oid)
      INTO v_def, v_sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'regler_retour_vente';
    v_def := pg_temp.remplacer(v_def, 'p_user_id uuid)', 'p_user_id uuid, p_compte_id uuid DEFAULT NULL::uuid)', 'regler_retour_vente');
    v_def := pg_temp.remplacer(v_def, 'moyen_paiement, date_depense', 'compte_id, date_depense', 'regler_retour_vente');
    v_def := pg_temp.remplacer(v_def,
        'v_retour.montant, ''cash'', CURRENT_DATE',
        'v_retour.montant, COALESCE(p_compte_id, (SELECT c.id FROM comptes_tresorerie c WHERE c.type = ''caisse'' AND c.warehouse_id = v_retour.warehouse_id)), CURRENT_DATE',
        'regler_retour_vente');
    EXECUTE format('DROP FUNCTION public.regler_retour_vente(%s)', v_sig);
    EXECUTE v_def;
END $$;

-- ── 10. Espèces attendues : la caisse DE CET ENTREPÔT ───────────
-- Avant : tous les mouvements en espèces de la boutique (une boutique à
-- deux entrepôts voyait les ventes de l'autre dans son tiroir) et aucun
-- dépôt en banque. Désormais : le grand livre de la caisse de l'entrepôt.
CREATE OR REPLACE FUNCTION public.especes_attendues_session(p_session_id UUID)
RETURNS NUMERIC
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT s.fond_initial
         + COALESCE(SUM(CASE m.sens WHEN 'entree' THEN m.montant ELSE -m.montant END), 0)
      FROM cash_sessions s
      LEFT JOIN comptes_tresorerie c
             ON c.warehouse_id = s.warehouse_id AND c.type = 'caisse'
      LEFT JOIN mouvements_tresorerie m
             ON m.compte_id = c.id AND m.jour = s.jour AND NOT m.est_annule
     WHERE s.id = p_session_id
     GROUP BY s.id, s.fond_initial
$$;

COMMENT ON FUNCTION public.especes_attendues_session(UUID) IS
    'Espèces que le tiroir devrait contenir : fond initial + entrées − sorties du jour sur la CAISSE de l''entrepôt de la session (ventes, règlements, dépenses, salaires, fournisseurs, virements).';

-- ── 11. Virements ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.effectuer_virement(
    p_shop_id UUID, p_source_id UUID, p_destination_id UUID,
    p_montant NUMERIC, p_frais NUMERIC, p_date DATE,
    p_reference TEXT, p_note TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_source  comptes_tresorerie%ROWTYPE;
    v_dest    comptes_tresorerie%ROWTYPE;
    v_frais   NUMERIC := COALESCE(p_frais, 0);
    v_solde   NUMERIC;
    v_pid     TEXT;
    v_vir_id  UUID;
    v_cat     UUID;
    v_exp     UUID;
BEGIN
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;
    IF v_frais < 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Frais invalides.');
    END IF;
    IF p_source_id = p_destination_id THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Choisissez deux comptes différents.');
    END IF;
    IF COALESCE(p_date, CURRENT_DATE) > CURRENT_DATE THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'La date ne peut pas être dans le futur.');
    END IF;

    -- Verrou dans un ordre fixe : deux virements croisés ne s'attendent pas.
    PERFORM 1 FROM comptes_tresorerie WHERE id IN (p_source_id, p_destination_id) ORDER BY id FOR UPDATE;
    SELECT * INTO v_source FROM comptes_tresorerie WHERE id = p_source_id AND shop_id = p_shop_id;
    SELECT * INTO v_dest   FROM comptes_tresorerie WHERE id = p_destination_id AND shop_id = p_shop_id;
    IF v_source.id IS NULL OR v_dest.id IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Compte introuvable.');
    END IF;
    IF NOT v_source.est_actif OR NOT v_dest.est_actif THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Un des deux comptes est désactivé.');
    END IF;

    IF v_source.type IN ('caisse', 'mobile_money') THEN
        v_solde := solde_compte(v_source.id);
        IF v_solde < p_montant + v_frais THEN
            RETURN jsonb_build_object('succes', false, 'erreur',
                'Solde insuffisant sur « ' || v_source.nom || ' » : ' || montant_fr(v_solde) || ' disponibles.');
        END IF;
    END IF;

    v_pid := prochain_numero(p_shop_id, 'VIR');
    INSERT INTO virements_tresorerie (
        public_id, shop_id, compte_source_id, compte_destination_id,
        montant, frais, date_virement, reference, note, created_by
    ) VALUES (
        v_pid, p_shop_id, p_source_id, p_destination_id,
        p_montant, v_frais, COALESCE(p_date, CURRENT_DATE),
        NULLIF(trim(p_reference), ''), NULLIF(trim(p_note), ''), p_user_id
    ) RETURNING id INTO v_vir_id;

    IF v_frais > 0 THEN
        SELECT id INTO v_cat FROM expense_categories
         WHERE shop_id = p_shop_id AND nom = 'Frais bancaires et de transfert' LIMIT 1;
        IF v_cat IS NULL THEN
            INSERT INTO expense_categories (shop_id, nom, description, est_actif)
            VALUES (p_shop_id, 'Frais bancaires et de transfert',
                    'Créée automatiquement : frais des virements entre comptes.', TRUE)
            RETURNING id INTO v_cat;
        END IF;
        INSERT INTO expenses (public_id, shop_id, category_id, libelle, montant, compte_id,
                              reference, date_depense, note, created_by)
        VALUES (prochain_numero(p_shop_id, 'EXP'), p_shop_id, v_cat,
                'Frais du virement ' || v_pid, v_frais, p_source_id,
                NULLIF(trim(p_reference), ''), COALESCE(p_date, CURRENT_DATE), NULL, p_user_id)
        RETURNING id INTO v_exp;
        UPDATE virements_tresorerie SET expense_id = v_exp WHERE id = v_vir_id;
    END IF;

    RETURN jsonb_build_object('succes', true, 'id', v_vir_id, 'public_id', v_pid);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_virement(
    p_shop_id UUID, p_virement_id UUID, p_motif TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_vir   virements_tresorerie%ROWTYPE;
    v_dest  comptes_tresorerie%ROWTYPE;
BEGIN
    IF NULLIF(trim(p_motif), '') IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Indiquez le motif de l''annulation.');
    END IF;

    SELECT * INTO v_vir FROM virements_tresorerie
     WHERE id = p_virement_id AND shop_id = p_shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Virement introuvable.');
    END IF;
    IF v_vir.est_annule THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Ce virement est déjà annulé.');
    END IF;

    -- Annuler retire l'argent du compte d'arrivée : il doit encore l'avoir.
    SELECT * INTO v_dest FROM comptes_tresorerie WHERE id = v_vir.compte_destination_id FOR UPDATE;
    IF v_dest.type IN ('caisse', 'mobile_money') AND solde_compte(v_dest.id) < v_vir.montant THEN
        RETURN jsonb_build_object('succes', false, 'erreur',
            'Impossible : « ' || v_dest.nom || ' » ne contient plus ces ' || montant_fr(v_vir.montant) || '.');
    END IF;

    UPDATE virements_tresorerie
       SET est_annule = TRUE, annule_le = NOW(), annule_par = p_user_id, motif_annulation = trim(p_motif)
     WHERE id = p_virement_id;

    IF v_vir.expense_id IS NOT NULL THEN
        UPDATE expenses
           SET est_annule = TRUE, annule_le = NOW(), annule_par = p_user_id,
               motif_annulation = 'Virement ' || v_vir.public_id || ' annulé : ' || trim(p_motif)
         WHERE id = v_vir.expense_id;
    END IF;

    RETURN jsonb_build_object('succes', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

-- ── 11 bis. Retraits et apports du propriétaire ─────────────────
CREATE OR REPLACE FUNCTION public.enregistrer_operation_proprietaire(
    p_shop_id UUID, p_compte_id UUID, p_type TEXT, p_montant NUMERIC, p_date DATE,
    p_beneficiaire TEXT, p_motif TEXT, p_reference TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_pid TEXT;
    v_id  UUID;
BEGIN
    IF p_type NOT IN ('retrait', 'apport') THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Opération invalide.');
    END IF;
    IF p_montant IS NULL OR p_montant <= 0 THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Montant invalide.');
    END IF;
    IF NULLIF(trim(p_motif), '') IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Indiquez le motif.');
    END IF;
    IF COALESCE(p_date, CURRENT_DATE) > CURRENT_DATE THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'La date ne peut pas être dans le futur.');
    END IF;

    v_pid := prochain_numero(p_shop_id, 'OPR');
    -- Le trigger de garde vérifie le compte et refuse un découvert
    -- de caisse ou de Mobile Money.
    INSERT INTO operations_proprietaire (public_id, shop_id, compte_id, type, montant, date_operation,
                                         beneficiaire, motif, reference, created_by)
    VALUES (v_pid, p_shop_id, p_compte_id, p_type, p_montant, COALESCE(p_date, CURRENT_DATE),
            NULLIF(trim(p_beneficiaire), ''), trim(p_motif), NULLIF(trim(p_reference), ''), p_user_id)
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('succes', true, 'id', v_id, 'public_id', v_pid);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.annuler_operation_proprietaire(
    p_shop_id UUID, p_operation_id UUID, p_motif TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_op     operations_proprietaire%ROWTYPE;
    v_compte comptes_tresorerie%ROWTYPE;
BEGIN
    IF NULLIF(trim(p_motif), '') IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Indiquez le motif de l''annulation.');
    END IF;
    SELECT * INTO v_op FROM operations_proprietaire
     WHERE id = p_operation_id AND shop_id = p_shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Opération introuvable.');
    END IF;
    IF v_op.est_annule THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Cette opération est déjà annulée.');
    END IF;
    -- Annuler un APPORT retire l'argent du compte : il doit encore l'avoir.
    SELECT * INTO v_compte FROM comptes_tresorerie WHERE id = v_op.compte_id FOR UPDATE;
    IF v_op.type = 'apport' AND v_compte.type IN ('caisse', 'mobile_money')
       AND solde_compte(v_compte.id) < v_op.montant THEN
        RETURN jsonb_build_object('succes', false, 'erreur',
            'Impossible : « ' || v_compte.nom || ' » ne contient plus ces ' || montant_fr(v_op.montant) || '.');
    END IF;
    UPDATE operations_proprietaire
       SET est_annule = TRUE, annule_le = NOW(), annule_par = p_user_id, motif_annulation = trim(p_motif)
     WHERE id = p_operation_id;
    RETURN jsonb_build_object('succes', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$;

-- ── 12. Rapprochement : un écart constaté ───────────────────────
CREATE OR REPLACE FUNCTION public.enregistrer_rapprochement(
    p_shop_id UUID, p_compte_id UUID, p_date DATE, p_solde_reel NUMERIC, p_note TEXT, p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_theorique NUMERIC;
    v_ecart     NUMERIC;
BEGIN
    IF p_solde_reel IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Indiquez le solde réel.');
    END IF;
    IF COALESCE(p_date, CURRENT_DATE) > CURRENT_DATE THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'La date ne peut pas être dans le futur.');
    END IF;

    SELECT s.solde INTO v_theorique
      FROM soldes_comptes(p_shop_id, COALESCE(p_date, CURRENT_DATE)) s
     WHERE s.compte_id = p_compte_id;
    IF v_theorique IS NULL THEN
        RETURN jsonb_build_object('succes', false, 'erreur', 'Compte introuvable.');
    END IF;

    INSERT INTO rapprochements_tresorerie (shop_id, compte_id, date_rapprochement, solde_reel, solde_theorique, note, created_by)
    VALUES (p_shop_id, p_compte_id, COALESCE(p_date, CURRENT_DATE), p_solde_reel, v_theorique,
            NULLIF(trim(p_note), ''), p_user_id)
    RETURNING ecart INTO v_ecart;

    RETURN jsonb_build_object('succes', true, 'solde_theorique', v_theorique, 'ecart', v_ecart);
END;
$$;
