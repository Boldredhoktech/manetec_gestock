-- ════════════════════════════════════════════════════════════════
-- 040 — Connexion sans ShopId
--
-- Décisions (2026-11-14) :
--   • l'identifiant de connexion devient UNIQUE SUR TOUTE LA PLATEFORME,
--     de la forme  <nom>@<suffixe de la boutique>  (ex. admin@boldboutik) ;
--   • le suffixe est propre à chaque boutique (shops.suffixe_identifiant) ;
--   • les comptes existants sont renommés ici, de façon TRACÉE
--     (audit_logs + shop_users.identifiant_ancien), mot de passe inchangé ;
--   • l'ancien identifiant reste accepté à la connexion pendant une période
--     de transition (côté application), pour ne bloquer personne.
--
-- Règles de forme (vérifiées par la base) :
--   suffixe      ^[a-z0-9]{2,30}$
--   identifiant  ^[a-z0-9][a-z0-9._-]{0,39}@<suffixe de SA boutique>$
-- ════════════════════════════════════════════════════════════════

-- ── 1. Normalisation : minuscules, sans accents, sans espaces ───
CREATE OR REPLACE FUNCTION public.normaliser_identifiant(p_texte TEXT, p_garder_ponctuation BOOLEAN)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
    SELECT regexp_replace(
        lower(translate(coalesce(p_texte, ''),
            'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ',
            'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuyy')),
        CASE WHEN p_garder_ponctuation THEN '[^a-z0-9._-]' ELSE '[^a-z0-9]' END,
        '', 'g')
$$;

COMMENT ON FUNCTION public.normaliser_identifiant(TEXT, BOOLEAN) IS
    'Minuscules, sans accents ni espaces. Avec ponctuation : garde . _ - (partie nom d''un identifiant) ; sans : lettres et chiffres seuls (suffixe de boutique). Même règle que lib/auth/identifiant.ts.';

-- ── 2. Suffixe de chaque boutique ───────────────────────────────
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS suffixe_identifiant TEXT;

DO $$
DECLARE
    v_shop  RECORD;
    v_base  TEXT;
    v_cand  TEXT;
    v_n     INT;
BEGIN
    FOR v_shop IN
        SELECT id, nom FROM public.shops
        WHERE suffixe_identifiant IS NULL
        ORDER BY created_at, public_id
    LOOP
        v_base := left(public.normaliser_identifiant(v_shop.nom, FALSE), 26);
        IF length(v_base) < 2 THEN v_base := 'boutique'; END IF;
        v_cand := v_base;
        v_n := 1;
        WHILE EXISTS (SELECT 1 FROM public.shops WHERE suffixe_identifiant = v_cand) LOOP
            v_n := v_n + 1;
            v_cand := v_base || v_n;
        END LOOP;
        UPDATE public.shops SET suffixe_identifiant = v_cand WHERE id = v_shop.id;
    END LOOP;
END $$;

ALTER TABLE public.shops ALTER COLUMN suffixe_identifiant SET NOT NULL;
ALTER TABLE public.shops ADD CONSTRAINT shops_suffixe_identifiant_key UNIQUE (suffixe_identifiant);
ALTER TABLE public.shops ADD CONSTRAINT shops_suffixe_identifiant_forme
    CHECK (suffixe_identifiant ~ '^[a-z0-9]{2,30}$');

COMMENT ON COLUMN public.shops.suffixe_identifiant IS
    'Partie après @ des identifiants de connexion de la boutique (ex. boldboutik → admin@boldboutik). Unique sur la plateforme.';

-- ── 3. Renommage tracé des comptes existants ────────────────────
ALTER TABLE public.shop_users ADD COLUMN IF NOT EXISTS identifiant_ancien TEXT;

COMMENT ON COLUMN public.shop_users.identifiant_ancien IS
    'Identifiant d''avant la mig 040 (connexion avec ShopId). Accepté à la connexion pendant la transition, puis sans usage.';

DO $$
DECLARE
    v_u        RECORD;
    v_nom      TEXT;
    v_nouveau  TEXT;
    v_n        INT;
BEGIN
    FOR v_u IN
        SELECT u.id, u.public_id, u.shop_id, u.identifiant, u.role, s.suffixe_identifiant
        FROM public.shop_users u
        JOIN public.shops s ON s.id = u.shop_id
        WHERE u.identifiant NOT LIKE '%@%'
        -- Le propriétaire d'abord : c'est lui qui prend « admin ».
        ORDER BY u.shop_id, (u.role = 'super_admin_boutique') DESC, u.created_at
    LOOP
        -- « admin.nom.de.la.boutique » répétait le nom de la boutique, que
        -- le suffixe porte désormais : le propriétaire devient « admin@… ».
        IF v_u.role = 'super_admin_boutique' AND v_u.identifiant LIKE 'admin.%' THEN
            v_nom := 'admin';
        ELSE
            v_nom := public.normaliser_identifiant(v_u.identifiant, TRUE);
        END IF;
        v_nom := left(regexp_replace(v_nom, '^[._-]+', ''), 40);
        IF v_nom = '' THEN v_nom := 'utilisateur'; END IF;

        v_nouveau := v_nom || '@' || v_u.suffixe_identifiant;
        v_n := 1;
        WHILE EXISTS (SELECT 1 FROM public.shop_users WHERE identifiant = v_nouveau) LOOP
            v_n := v_n + 1;
            v_nouveau := v_nom || v_n || '@' || v_u.suffixe_identifiant;
        END LOOP;

        UPDATE public.shop_users
        SET identifiant_ancien = identifiant,
            identifiant        = v_nouveau
        WHERE id = v_u.id;

        INSERT INTO public.audit_logs (
            shop_id, type_acteur, event_type, reference_type, reference_id,
            reference_public_id, user_nom, details_json
        ) VALUES (
            v_u.shop_id, 'platform', 'SHOP_USER_IDENTIFIANT_CHANGED', 'shop_user', v_u.id,
            v_u.public_id, 'Migration 040',
            jsonb_build_object(
                'ancien',  v_u.identifiant,
                'nouveau', v_nouveau,
                'motif',   'Connexion sans ShopId : identifiant unique sur la plateforme (mig 040)')
        );
    END LOOP;
END $$;

-- ── 4. Unicité et forme ─────────────────────────────────────────
CREATE UNIQUE INDEX shop_users_identifiant_unique ON public.shop_users (identifiant);
-- PAS unique : deux boutiques pouvaient avoir le même identifiant avant 040.
-- L'application n'accepte un ancien identifiant que s'il désigne UN seul compte.
CREATE INDEX shop_users_identifiant_ancien_idx
    ON public.shop_users (identifiant_ancien) WHERE identifiant_ancien IS NOT NULL;

ALTER TABLE public.shop_users ADD CONSTRAINT shop_users_identifiant_forme
    CHECK (identifiant ~ '^[a-z0-9][a-z0-9._-]{0,39}@[a-z0-9]{2,30}$');

-- Le suffixe d'un identifiant est TOUJOURS celui de sa boutique :
-- sans cette garde, un compte pourrait se faire passer pour une autre
-- boutique (jean@autreboutique créé dans la mienne).
CREATE OR REPLACE FUNCTION public.garde_suffixe_identifiant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_suffixe TEXT;
BEGIN
    SELECT suffixe_identifiant INTO v_suffixe FROM public.shops WHERE id = NEW.shop_id;
    IF split_part(NEW.identifiant, '@', 2) IS DISTINCT FROM v_suffixe THEN
        RAISE EXCEPTION 'Identifiant « % » : le suffixe doit être celui de la boutique (@%).',
            NEW.identifiant, v_suffixe
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER shop_users_garde_suffixe
    BEFORE INSERT OR UPDATE OF identifiant, shop_id ON public.shop_users
    FOR EACH ROW EXECUTE FUNCTION public.garde_suffixe_identifiant();

-- Un changement de suffixe renomme tous les comptes de la boutique.
CREATE OR REPLACE FUNCTION public.propager_suffixe_identifiant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.suffixe_identifiant IS DISTINCT FROM OLD.suffixe_identifiant THEN
        UPDATE public.shop_users
        SET identifiant = split_part(identifiant, '@', 1) || '@' || NEW.suffixe_identifiant
        WHERE shop_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER shops_propager_suffixe
    AFTER UPDATE OF suffixe_identifiant ON public.shops
    FOR EACH ROW EXECUTE FUNCTION public.propager_suffixe_identifiant();

-- L'ancienne unicité (shop_id, identifiant) est contenue dans la nouvelle.
ALTER TABLE public.shop_users DROP CONSTRAINT IF EXISTS shop_users_shop_id_identifiant_key;
