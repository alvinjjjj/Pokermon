-- ============================================================
-- Fix auth triggers — robust handle_new_user + handle_new_user_role
-- 問題：Supabase 預設 handle_new_user() 嘗試插入 updated_at
--       但 profiles 表實際上沒有該欄位，導致每次建立用戶都報錯
-- ============================================================

-- ─── 1. 重寫 handle_new_user ────────────────────────────────
-- 只插入確定存在的欄位：id, username, created_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, created_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 不讓任何錯誤阻止用戶建立
    RETURN NEW;
END;
$$;

-- 重建 trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 2. 重寫 handle_new_user_role ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, status)
  VALUES (NEW.id, 'viewer', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- 重建 trigger
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ─── 3. 確保 profiles RLS 允許 trigger（SECURITY DEFINER）插入 ──
-- SECURITY DEFINER 函數以 postgres（BYPASSRLS）身份執行
-- 但為保險起見，額外允許 service_role 完整存取
DROP POLICY IF EXISTS "service_role_profiles_all" ON public.profiles;
CREATE POLICY "service_role_profiles_all"
  ON public.profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 驗證 triggers 存在 ─────────────────────────────────────
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;
