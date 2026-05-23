-- ============================================================
-- 測試帳號設定腳本
-- 在 Supabase SQL Editor 執行
-- 設定：seller_business@test.com 為認證商業賣家
--       seller_personal@test.com 為個人賣家
-- ============================================================

DO $$
DECLARE
  v_business_id  uuid;
  v_personal_id  uuid;
BEGIN

  -- ──────────────────────────────────────────────────────────
  -- 1. 取得兩個測試用戶的 ID
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_business_id
  FROM auth.users
  WHERE email = 'seller_business@test.com'
  LIMIT 1;

  SELECT id INTO v_personal_id
  FROM auth.users
  WHERE email = 'seller_personal@test.com'
  LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE NOTICE 'seller_business@test.com 用戶不存在，請先在 Authentication > Users 建立';
  END IF;

  IF v_personal_id IS NULL THEN
    RAISE NOTICE 'seller_personal@test.com 用戶不存在，請先在 Authentication > Users 建立';
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- 2. 設定商業賣家 (seller_business@test.com)
  -- ──────────────────────────────────────────────────────────
  IF v_business_id IS NOT NULL THEN

    -- 確保 profiles 存在
    INSERT INTO public.profiles (id, username)
    VALUES (v_business_id, 'business_seller')
    ON CONFLICT (id) DO UPDATE SET username = 'business_seller';

    -- 設定角色為 certified_merchant
    INSERT INTO public.user_roles (user_id, role, status)
    VALUES (v_business_id, 'certified_merchant', 'active')
    ON CONFLICT (user_id) DO UPDATE
      SET role = 'certified_merchant', status = 'active';

    -- 建立 merchant_profiles
    INSERT INTO public.merchant_profiles (
      user_id,
      seller_type,
      display_name,
      district,
      shop_name_zh,
      shop_name_en,
      shop_description,
      status
    )
    VALUES (
      v_business_id,
      'certified_merchant',
      'Test Business Store',
      '旺角',
      '測試商店',
      'Test Business Store',
      '測試商業賣家帳號',
      'active'
    )
    ON CONFLICT (user_id) DO UPDATE
      SET seller_type   = 'certified_merchant',
          display_name  = 'Test Business Store',
          shop_name_zh  = '測試商店',
          shop_name_en  = 'Test Business Store',
          status        = 'active';

    RAISE NOTICE '✅ seller_business@test.com 已設定為 certified_merchant (active)';
  END IF;

  -- ──────────────────────────────────────────────────────────
  -- 3. 設定個人賣家 (seller_personal@test.com)
  -- ──────────────────────────────────────────────────────────
  IF v_personal_id IS NOT NULL THEN

    -- 確保 profiles 存在
    INSERT INTO public.profiles (id, username)
    VALUES (v_personal_id, 'personal_seller')
    ON CONFLICT (id) DO UPDATE SET username = 'personal_seller';

    -- 設定角色為 individual_seller
    INSERT INTO public.user_roles (user_id, role, status)
    VALUES (v_personal_id, 'individual_seller', 'active')
    ON CONFLICT (user_id) DO UPDATE
      SET role = 'individual_seller', status = 'active';

    -- 建立 merchant_profiles
    INSERT INTO public.merchant_profiles (
      user_id,
      seller_type,
      display_name,
      district,
      shop_description,
      declaration_agreed,
      status
    )
    VALUES (
      v_personal_id,
      'individual_seller',
      'Test Personal Seller',
      '銅鑼灣',
      '測試個人賣家帳號',
      true,
      'active'
    )
    ON CONFLICT (user_id) DO UPDATE
      SET seller_type        = 'individual_seller',
          display_name       = 'Test Personal Seller',
          declaration_agreed = true,
          status             = 'active';

    RAISE NOTICE '✅ seller_personal@test.com 已設定為 individual_seller (active)';
  END IF;

END $$;

-- ──────────────────────────────────────────────────────────
-- 驗證結果
-- ──────────────────────────────────────────────────────────
SELECT
  u.email,
  p.username,
  r.role,
  r.status         AS role_status,
  mp.seller_type,
  mp.display_name,
  mp.status        AS merchant_status
FROM auth.users u
LEFT JOIN public.profiles          p  ON p.id       = u.id
LEFT JOIN public.user_roles        r  ON r.user_id  = u.id
LEFT JOIN public.merchant_profiles mp ON mp.user_id = u.id
WHERE u.email IN ('seller_business@test.com', 'seller_personal@test.com');
