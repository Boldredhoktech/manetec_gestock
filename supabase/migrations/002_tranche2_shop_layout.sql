-- ============================================================
-- MIGRATION 002 — Tranche 2 : Politiques RLS boutiques
-- ============================================================

-- Politique RLS : un utilisateur ne voit que les données
-- de sa propre boutique (via shop_id dans le JWT metadata)

-- shop_users : voir uniquement les users de sa boutique
CREATE POLICY "shop_users_isolation"
ON shop_users
FOR ALL
USING (
  shop_id = (
    SELECT (auth.jwt() -> 'user_metadata' ->> 'shop_id')::uuid
  )
);

-- shop_user_permissions : idem
CREATE POLICY "shop_permissions_isolation"
ON shop_user_permissions
FOR ALL
USING (
  shop_id = (
    SELECT (auth.jwt() -> 'user_metadata' ->> 'shop_id')::uuid
  )
);

-- shops : une boutique ne voit que ses propres infos
CREATE POLICY "shops_isolation"
ON shops
FOR SELECT
                             USING (
                             id = (
                             SELECT (auth.jwt() -> 'user_metadata' ->> 'shop_id')::uuid
                             )
                             );

-- audit_logs : voir uniquement les logs de sa boutique
CREATE POLICY "audit_logs_isolation"
ON audit_logs
FOR SELECT
               USING (
               shop_id = (
               SELECT (auth.jwt() -> 'user_metadata' ->> 'shop_id')::uuid
               )
               );

-- public_id_counters : accès uniquement à sa boutique
CREATE POLICY "counters_isolation"
ON public_id_counters
FOR ALL
USING (
  shop_id = (
    SELECT (auth.jwt() -> 'user_metadata' ->> 'shop_id')::uuid
  )
);