-- #67: Fix user_roles RLS privilege escalation vulnerability
-- Problem: "用戶可更新自己的角色" has no WITH CHECK clause,
--          so any authenticated user can self-promote to certified_merchant.
-- Fix: Drop the permissive update policy, replace with a restricted one
--      that only allows viewer → individual_seller (self-service).
--      certified_merchant can only be granted by service_role.

-- Drop the vulnerable policy
DROP POLICY IF EXISTS "用戶可更新自己的角色" ON public.user_roles;

-- New policy: users can only update their own row,
-- and only to 'individual_seller' (cannot self-promote to certified_merchant)
CREATE POLICY "用戶可升級至個人賣家"
  ON public.user_roles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role IN ('viewer', 'individual_seller')
  );

-- service_role policy already covers certified_merchant grants (admin action only)
-- Verify it exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles'
      AND policyname = 'service role 全權限'
  ) THEN
    CREATE POLICY "service role 全權限"
      ON public.user_roles FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
