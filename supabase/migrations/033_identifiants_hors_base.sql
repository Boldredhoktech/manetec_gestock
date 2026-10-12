-- 033_identifiants_hors_base.sql
-- ═══════════════════════════════════════════════════════════════
-- Abonnement, Lot 1 — ABO-12.
--
-- À la création d'une boutique par la plateforme, l'identifiant et le
-- mot de passe temporaire du propriétaire étaient écrits EN CLAIR dans
-- shops.note_activation, jamais effacés, et affichés sur la fiche. Le
-- code ne les écrit plus (ils sont montrés une seule fois à l'agent).
-- Ici, on purge ceux qui restent : une note commençant par « { » et
-- contenant « mot_de_passe » n'a jamais été autre chose que ce JSON.
-- ═══════════════════════════════════════════════════════════════

UPDATE shops
SET    note_activation = NULL
WHERE  note_activation LIKE '{%"mot_de_passe"%';

COMMENT ON COLUMN shops.note_activation IS
    'Note libre de l''agent plateforme sur une activation manuelle. Ne JAMAIS y écrire d''identifiant ni de mot de passe.';
