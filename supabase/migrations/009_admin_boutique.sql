-- ============================================================
-- MIGRATION 009 — Rôle "administrateur de boutique" (second admin)
-- ------------------------------------------------------------
-- Permet à chaque boutique de créer des comptes administrateurs
-- (accès complet, comme le propriétaire) en plus des vendeurs,
-- comptables et gestionnaires de stock.
--
-- Le propriétaire d'origine conserve le rôle 'super_admin_boutique'
-- et reste seul habilité à créer/gérer d'autres administrateurs.
-- Les nouveaux administrateurs prennent le rôle 'admin_boutique'.
-- ============================================================

ALTER TABLE shop_users
    DROP CONSTRAINT IF EXISTS shop_users_role_check;

ALTER TABLE shop_users
    ADD CONSTRAINT shop_users_role_check CHECK (role IN (
        'super_admin_boutique',
        'admin_boutique',
        'vendeur',
        'stock_manager',
        'comptable'
    ));
