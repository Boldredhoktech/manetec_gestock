-- ════════════════════════════════════════════════════════════════
-- Jeu de test LOCAL — données 100 % fictives (jamais de copie de la prod).
-- Chargé par `npx supabase db reset` après schema_prod.sql.
--
-- Mot de passe de TOUS les comptes : Local1234!
--   Plateforme : admin@local.test           (/redhok/login)
--   Boutiques  : SHOP-00001 « Boutique Alpha » (Pro)     → admin@boutiquealpha, awa@boutiquealpha (vendeur)
--                SHOP-00002 « Boutique Beta »  (Starter) → admin@boutiquebeta
-- Anciens identifiants (avant mig 040) gardés pour tester la transition :
-- « admin » existe dans les deux boutiques (ambigu → refusé), « awa » est unique.
-- ════════════════════════════════════════════════════════════════

-- schema_prod.sql vide le search_path : on le remet pour ce fichier.
SET search_path = public, extensions;

DO $$
DECLARE
    v_hash  TEXT := '$argon2id$v=19$m=65536,t=3,p=1$xX1wvvVeXdRYVSR11tP26Q$vNj4byl8eYhR6pZ5W2Hm9qYJoSB1aukk2U72JPD3ftY';
    v_alpha UUID := '00000000-0000-4000-a000-000000000001';
    v_beta  UUID := '00000000-0000-4000-a000-000000000002';
    v_pref  TEXT;
BEGIN
    -- ── Plateforme ─────────────────────────────────────────────
    INSERT INTO platform_id_counters (prefix, last_value) VALUES
        ('PLAT', 1), ('SHOP', 2), ('ABO', 0);

    INSERT INTO platform_admins (public_id, nom_complet, email, password_hash, role)
    VALUES ('PLAT-00001', 'Admin Local', 'admin@local.test', v_hash, 'super_platform_admin');

    -- ── Boutiques ──────────────────────────────────────────────
    INSERT INTO shops (id, public_id, nom, suffixe_identifiant, ville, telephone_1, email, plan, plan_expire_le) VALUES
        (v_alpha, 'SHOP-00001', 'Boutique Alpha', 'boutiquealpha', 'Cotonou',    '+229 01 00 00 00 01', 'alpha@exemple.test', 'pro',     NOW() + INTERVAL '1 year'),
        (v_beta,  'SHOP-00002', 'Boutique Beta',  'boutiquebeta',  'Porto-Novo', '+229 01 00 00 00 02', NULL,                 'starter', NOW() + INTERVAL '1 year');

    FOREACH v_pref IN ARRAY ARRAY['ADJ','AVO','BRD','CAISSE','CAT','CLI','DEV','EXP','FACT','FF',
                                  'FPAY','INV','ITM','MVT','PO','PSAL','REC','SPAY','SRET','SUP',
                                  'TRF','UTS','VENTE','WH']
    LOOP
        INSERT INTO public_id_counters (shop_id, prefix, last_value) VALUES
            (v_alpha, v_pref, CASE v_pref WHEN 'UTS' THEN 2 WHEN 'WH' THEN 2 ELSE 0 END),
            (v_beta,  v_pref, CASE v_pref WHEN 'UTS' THEN 1 WHEN 'WH' THEN 1 ELSE 0 END);
    END LOOP;

    INSERT INTO warehouses (public_id, shop_id, nom, est_defaut) VALUES
        ('WH-00001', v_alpha, 'Magasin principal', TRUE),
        ('WH-00002', v_alpha, 'Dépôt Cotonou',     FALSE),
        ('WH-00001', v_beta,  'Magasin principal', TRUE);

    -- ── Utilisateurs ───────────────────────────────────────────
    INSERT INTO shop_users (public_id, shop_id, nom_complet, identifiant, identifiant_ancien, password_hash, role) VALUES
        ('UTS-00001', v_alpha, 'Admin Alpha',  'admin@boutiquealpha', 'admin', v_hash, 'super_admin_boutique'),
        ('UTS-00002', v_alpha, 'Awa Vendeuse', 'awa@boutiquealpha',   'awa',   v_hash, 'vendeur'),
        ('UTS-00001', v_beta,  'Admin Beta',   'admin@boutiquebeta',  'admin', v_hash, 'super_admin_boutique');
END $$;
