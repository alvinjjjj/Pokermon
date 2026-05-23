-- ============================================================================
-- QA 全功能測試資料（手機假帳號版）— 2026-05-14
--
-- 前置作業（你必須先做）：
--   在 app 內依序註冊這 4 個手機，每個輸入對應的測試 OTP：
--     1. +85261000001  →  OTP: 111111   (將設為 admin)
--     2. +85261000002  →  OTP: 222222   (將設為個人賣家)
--     3. +85261000003  →  OTP: 333333   (將設為認證商家)
--     4. +85261000004  →  OTP: 444444   (將設為普通買家)
--
-- 這些是 Supabase「Test Phone Numbers and OTPs」設定的假號碼，
-- 不會真的發 SMS，輸入對應 OTP 即可完成註冊。
--
-- 跑法：4 個帳號都註冊完之後，把整個檔案內容貼進 SQL Editor → Run。
--
-- 全 idempotent — 隨時可以重跑會清掉舊測試資料再重建。
-- 嚴格限定只動 phone like '8526100%' 的帳號，不會影響真實用戶。
-- ============================================================================

DO $$
DECLARE
  v_admin_id     uuid;   -- 85261000001
  v_personal_id  uuid;   -- 85261000002
  v_business_id  uuid;   -- 85261000003
  v_buyer_id     uuid;   -- 85261000004

  v_personal_mp  uuid;
  v_business_mp  uuid;

  v_listing_p1   uuid;
  v_listing_p2   uuid;
  v_listing_b1   uuid;
  v_listing_b2   uuid;

  v_conv_bp      uuid;   -- buyer ↔ personal
  v_conv_bb      uuid;   -- buyer ↔ business
  v_conv_pb      uuid;   -- personal ↔ business

  v_post_personal uuid;
  v_post_business uuid;
  v_post_buyer    uuid;
BEGIN

  -- ─────────────────────────────────────────────────────────────
  -- 0. 確認 4 個帳號都存在
  -- ─────────────────────────────────────────────────────────────
  SELECT id INTO v_admin_id    FROM auth.users WHERE phone = '85261000001' LIMIT 1;
  SELECT id INTO v_personal_id FROM auth.users WHERE phone = '85261000002' LIMIT 1;
  SELECT id INTO v_business_id FROM auth.users WHERE phone = '85261000003' LIMIT 1;
  SELECT id INTO v_buyer_id    FROM auth.users WHERE phone = '85261000004' LIMIT 1;

  IF v_admin_id IS NULL OR v_personal_id IS NULL OR v_business_id IS NULL OR v_buyer_id IS NULL THEN
    RAISE EXCEPTION
      E'\n❌ 找不到全部 4 個手機帳號。請先在 app 內完成註冊：\n  85261000001 (OTP 111111): %\n  85261000002 (OTP 222222): %\n  85261000003 (OTP 333333): %\n  85261000004 (OTP 444444): %',
      coalesce(v_admin_id::text,    '缺少'),
      coalesce(v_personal_id::text, '缺少'),
      coalesce(v_business_id::text, '缺少'),
      coalesce(v_buyer_id::text,    '缺少');
  END IF;

  RAISE NOTICE '✅ 4 個 phone user 都存在';

  -- ─────────────────────────────────────────────────────────────
  -- 1. 清掉舊 QA 資料（idempotency）
  -- ─────────────────────────────────────────────────────────────
  DELETE FROM public.user_collection WHERE user_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.post_likes      WHERE user_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.post_comments   WHERE user_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.follows
    WHERE follower_id  IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id)
       OR following_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.posts           WHERE user_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.messages        WHERE sender_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.conversations
    WHERE buyer_id  IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id)
       OR seller_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.listings        WHERE seller_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);
  DELETE FROM public.notifications   WHERE user_id IN (v_admin_id, v_personal_id, v_business_id, v_buyer_id);

  RAISE NOTICE '🧹 清完舊 QA 資料';

  -- ─────────────────────────────────────────────────────────────
  -- 2. profiles + 角色設定
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, username, bio)
  VALUES
    (v_admin_id,    'admin_test',     '測試 admin 帳號（手機 61000001）'),
    (v_personal_id, 'personal_test',  '測試個人賣家（手機 61000002）'),
    (v_business_id, 'business_test',  '測試認證商家（手機 61000003）'),
    (v_buyer_id,    'buyer_test',     '測試普通買家（手機 61000004）')
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        bio      = EXCLUDED.bio;

  INSERT INTO public.user_roles (user_id, role, status)
  VALUES
    (v_admin_id,    'admin',              'active'),
    (v_personal_id, 'individual_seller',  'active'),
    (v_business_id, 'certified_merchant', 'active'),
    (v_buyer_id,    'viewer',             'active')
  ON CONFLICT (user_id) DO UPDATE
    SET role   = EXCLUDED.role,
        status = EXCLUDED.status;

  -- ─────────────────────────────────────────────────────────────
  -- 3. merchant_profiles — personal + business（buyer 沒有）
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.merchant_profiles (
    user_id, seller_type, display_name, district, shop_description,
    declaration_agreed, status
  )
  VALUES (
    v_personal_id, 'individual_seller', 'Personal QA Seller', '銅鑼灣',
    '個人賣家測試帳號', true, 'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET seller_type        = 'individual_seller',
        display_name       = 'Personal QA Seller',
        declaration_agreed = true,
        status             = 'active';

  INSERT INTO public.merchant_profiles (
    user_id, seller_type, display_name, district,
    shop_name_zh, shop_name_en, shop_description, status
  )
  VALUES (
    v_business_id, 'certified_merchant', 'Business QA Store', '旺角',
    '測試商店', 'Business QA Store', '認證商家測試帳號 — 旺角實體店', 'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET seller_type   = 'certified_merchant',
        display_name  = 'Business QA Store',
        shop_name_zh  = '測試商店',
        shop_name_en  = 'Business QA Store',
        status        = 'active';

  SELECT id INTO v_personal_mp FROM public.merchant_profiles WHERE user_id = v_personal_id;
  SELECT id INTO v_business_mp FROM public.merchant_profiles WHERE user_id = v_business_id;

  RAISE NOTICE '✅ 4 帳號角色設定完成 (admin / personal_seller / certified_merchant / viewer)';

  -- ─────────────────────────────────────────────────────────────
  -- 4. Listings — personal × 2 + business × 2
  -- ─────────────────────────────────────────────────────────────
  v_listing_p1 := gen_random_uuid();
  v_listing_p2 := gen_random_uuid();
  v_listing_b1 := gen_random_uuid();
  v_listing_b2 := gen_random_uuid();

  INSERT INTO public.listings (
    id, seller_id, merchant_id, seller_type, card_id, card_name, set_name,
    rarity, card_image_url, photo_urls, condition, price, is_negotiable,
    quantity, language, notes, status
  ) VALUES
    -- Personal seller listings
    (v_listing_p1, v_personal_id, v_personal_mp, 'individual_seller',
     'sv4-25', 'Mimikyu', 'Paradox Rift',
     'Illustration Rare',
     'https://images.pokemontcg.io/sv4/25.png',
     ARRAY[]::text[],
     'Raw', 320, true, 2, ARRAY['EN', 'JP']::text[],
     '輕微邊損', 'active'),

    (v_listing_p2, v_personal_id, v_personal_mp, 'individual_seller',
     'sv3-247', 'Iono', '151',
     'Special Illustration Rare',
     'https://images.pokemontcg.io/sv3pt5/247.png',
     ARRAY[]::text[],
     'PSA 9', 1200, false, 1, ARRAY['JP']::text[],
     'PSA 9 評級卡', 'active'),

    -- Business listings
    (v_listing_b1, v_business_id, v_business_mp, 'certified_merchant',
     'sv4-198', 'Charizard ex', 'Paradox Rift',
     'Special Illustration Rare',
     'https://images.pokemontcg.io/sv4/198.png',
     ARRAY['https://images.pokemontcg.io/sv4/198_hires.png']::text[],
     'PSA 10', 2800, false, 1, ARRAY['EN']::text[],
     'PSA 10 評級卡', 'active'),

    (v_listing_b2, v_business_id, v_business_mp, 'certified_merchant',
     'sv-p-066', 'Pikachu', 'SV-P Promos',
     'Promo',
     'https://images.pokemontcg.io/svp/66.png',
     ARRAY[]::text[],
     'Raw', 580, true, 3, ARRAY['JP']::text[],
     '日版 promo，未拆封', 'active');

  RAISE NOTICE '✅ 4 張 listings 建立完成';

  -- ─────────────────────────────────────────────────────────────
  -- 5. Conversations + Messages
  -- ─────────────────────────────────────────────────────────────
  -- Conv 1: buyer ↔ business 關於 Charizard ex
  v_conv_bb := gen_random_uuid();
  INSERT INTO public.conversations (id, buyer_id, seller_id, listing_id, merchant_id, created_at)
  VALUES (v_conv_bb, v_buyer_id, v_business_id, v_listing_b1, v_business_mp, now() - interval '2 hours');

  INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (v_conv_bb, v_buyer_id,    '你好，Charizard ex PSA 10 還在嗎？',          true,  now() - interval '2 hours'),
    (v_conv_bb, v_business_id, '在的，旺角店實物展示中',                     true,  now() - interval '110 minutes'),
    (v_conv_bb, v_buyer_id,    '可以面交嗎？',                                true,  now() - interval '100 minutes'),
    (v_conv_bb, v_business_id, '可以，或可順豐到付。週末旺角店有見面',         false, now() - interval '90 minutes');

  -- Conv 2: buyer ↔ personal 關於 Iono
  v_conv_bp := gen_random_uuid();
  INSERT INTO public.conversations (id, buyer_id, seller_id, listing_id, created_at)
  VALUES (v_conv_bp, v_buyer_id, v_personal_id, v_listing_p2, now() - interval '1 day');

  INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (v_conv_bp, v_buyer_id,    'Iono PSA 9 可以議價嗎？',                    true, now() - interval '1 day'),
    (v_conv_bp, v_personal_id, '$1200 已經是底價了 sorry',                   true, now() - interval '23 hours'),
    (v_conv_bp, v_buyer_id,    '了解，再考慮下',                             true, now() - interval '22 hours'),
    (v_conv_bp, v_personal_id, '加 Mimikyu 一起拿可以打 9 折',                true, now() - interval '21 hours');

  -- Conv 3: personal (as buyer) ↔ business 關於 Pikachu promo
  v_conv_pb := gen_random_uuid();
  INSERT INTO public.conversations (id, buyer_id, seller_id, listing_id, merchant_id, created_at)
  VALUES (v_conv_pb, v_personal_id, v_business_id, v_listing_b2, v_business_mp, now() - interval '3 days');

  INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (v_conv_pb, v_personal_id, 'Pikachu promo 還有幾張？',                    true,  now() - interval '3 days'),
    (v_conv_pb, v_business_id, '3 張，全新未拆',                              true,  now() - interval '70 hours'),
    (v_conv_pb, v_personal_id, '我全包，可以多便宜嗎？',                       false, now() - interval '12 hours'),
    (v_conv_pb, v_personal_id, '在嗎？',                                       false, now() - interval '6 hours');

  RAISE NOTICE '✅ 3 cross-conversations + 12 messages 建立完成';

  -- ─────────────────────────────────────────────────────────────
  -- 6. Posts — personal / business / buyer 各 1 篇（admin 不發 post）
  -- ─────────────────────────────────────────────────────────────
  v_post_personal := gen_random_uuid();
  v_post_business := gen_random_uuid();
  v_post_buyer    := gen_random_uuid();

  INSERT INTO public.posts (
    id, user_id, media_url, media_type, thumbnail_url, caption,
    card_name, set_name, post_category, moderation_status, created_at
  ) VALUES
    (v_post_personal, v_personal_id,
     'https://images.pokemontcg.io/sv3pt5/247_hires.png',
     'image',
     'https://images.pokemontcg.io/sv3pt5/247.png',
     '剛收到 PSA 9 Iono ✨ 真係靚！',
     'Iono', '151', 'unboxing', 'approved',
     now() - interval '5 days'),

    (v_post_business, v_business_id,
     'https://images.pokemontcg.io/sv4/198_hires.png',
     'image',
     'https://images.pokemontcg.io/sv4/198.png',
     'Charizard ex SIR PSA 10 — 旺角店實物展示中',
     'Charizard ex', 'Paradox Rift', 'post', 'approved',
     now() - interval '1 day'),

    (v_post_buyer, v_buyer_id,
     'https://images.pokemontcg.io/base1/4_hires.png',
     'image',
     'https://images.pokemontcg.io/base1/4.png',
     '新手收藏入手 Base Set Charizard 🔥',
     'Charizard', 'Base Set', 'post', 'approved',
     now() - interval '2 days');

  RAISE NOTICE '✅ 3 篇 posts 建立完成（全 approved）';

  -- ─────────────────────────────────────────────────────────────
  -- 7. Follows — 全部互相 follow（admin 也 follow 其他 3 個）
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.follows (follower_id, following_id) VALUES
    -- admin → 其他 3 個
    (v_admin_id, v_personal_id), (v_admin_id, v_business_id), (v_admin_id, v_buyer_id),
    -- personal → 其他 3 個
    (v_personal_id, v_admin_id), (v_personal_id, v_business_id), (v_personal_id, v_buyer_id),
    -- business → 其他 3 個
    (v_business_id, v_admin_id), (v_business_id, v_personal_id), (v_business_id, v_buyer_id),
    -- buyer → 其他 3 個
    (v_buyer_id, v_admin_id), (v_buyer_id, v_personal_id), (v_buyer_id, v_business_id);

  RAISE NOTICE '✅ 12 cross-follows 建立完成';

  -- ─────────────────────────────────────────────────────────────
  -- 8. Likes + Comments — 每人對其他 3 人的 post 互動
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.post_likes (post_id, user_id) VALUES
    -- admin likes all 3 posts
    (v_post_personal, v_admin_id), (v_post_business, v_admin_id), (v_post_buyer, v_admin_id),
    -- personal likes business + buyer
    (v_post_business, v_personal_id), (v_post_buyer, v_personal_id),
    -- business likes personal + buyer
    (v_post_personal, v_business_id), (v_post_buyer, v_business_id),
    -- buyer likes personal + business
    (v_post_personal, v_buyer_id), (v_post_business, v_buyer_id);

  INSERT INTO public.post_comments (post_id, user_id, content, created_at) VALUES
    (v_post_personal, v_admin_id,    '幾錢出？',                      now() - interval '4 days'),
    (v_post_personal, v_business_id, 'SAR Iono PSA 9 抵買',           now() - interval '4 days'),
    (v_post_personal, v_buyer_id,    '羨慕！',                        now() - interval '4 days'),
    (v_post_business, v_admin_id,    '品相靚 👌',                     now() - interval '20 hours'),
    (v_post_business, v_personal_id, '出售嗎？',                       now() - interval '18 hours'),
    (v_post_business, v_buyer_id,    '已私訊',                         now() - interval '16 hours'),
    (v_post_buyer, v_admin_id,       '經典！',                         now() - interval '1 day'),
    (v_post_buyer, v_personal_id,    'Base Set 永遠的神',              now() - interval '1 day'),
    (v_post_buyer, v_business_id,    '收得不錯',                       now() - interval '1 day');

  RAISE NOTICE '✅ 9 likes + 9 comments 建立完成';

  -- ─────────────────────────────────────────────────────────────
  -- 9. Portfolio — 每人 2-3 張卡
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.user_collection (
    user_id, card_id, card_name, set_name, purchase_price,
    current_price, quantity, psa_grade, image_url
  ) VALUES
    -- admin 的收藏
    (v_admin_id, 'sv4-198', 'Charizard ex', 'Paradox Rift', 2500, 2800, 1, '10',
     'https://images.pokemontcg.io/sv4/198.png'),
    (v_admin_id, 'sv3-247', 'Iono', '151', 1000, 1200, 1, '9',
     'https://images.pokemontcg.io/sv3pt5/247.png'),

    -- personal seller 的收藏
    (v_personal_id, 'sv4-25', 'Mimikyu', 'Paradox Rift', 280, 320, 1, 'Raw',
     'https://images.pokemontcg.io/sv4/25.png'),
    (v_personal_id, 'sv3-247', 'Iono', '151', 1000, 1200, 1, '9',
     'https://images.pokemontcg.io/sv3pt5/247.png'),
    (v_personal_id, 'sv4-26', 'Pikachu', 'Paradox Rift', 150, 175, 2, 'Raw',
     'https://images.pokemontcg.io/sv4/26.png'),

    -- business seller 的收藏
    (v_business_id, 'sv4-198', 'Charizard ex', 'Paradox Rift', 2500, 2800, 1, '10',
     'https://images.pokemontcg.io/sv4/198.png'),
    (v_business_id, 'sv-p-066', 'Pikachu', 'SV-P Promos', 400, 580, 3, 'Raw',
     'https://images.pokemontcg.io/svp/66.png'),
    (v_business_id, 'sv3pt5-185', 'Charizard ex', '151', 1800, 2100, 1, '9',
     'https://images.pokemontcg.io/sv3pt5/185.png'),

    -- buyer 的收藏（普通買家，有點藏品）
    (v_buyer_id, 'base1-4', 'Charizard', 'Base Set', 150, 180, 1, 'Raw',
     'https://images.pokemontcg.io/base1/4.png'),
    (v_buyer_id, 'sv3-205', 'Squirtle', '151', 80, 95, 1, 'Raw',
     'https://images.pokemontcg.io/sv3pt5/205.png');

  RAISE NOTICE '✅ Portfolio: admin(2), personal(3), business(3), buyer(2)';

  -- ─────────────────────────────────────────────────────────────
  -- 10. 摘要
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 Phone QA Setup 完成！';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '4 phone 帳號全部設定好';
  RAISE NOTICE '4 listings · 3 conversations · 12 messages';
  RAISE NOTICE '3 posts · 12 follows · 9 likes · 9 comments';
  RAISE NOTICE '10 portfolio entries';
  RAISE NOTICE '────────────────────────────────────────────────────';
  RAISE NOTICE '登入測試（app 內輸入後 8 位）：';
  RAISE NOTICE '  61000001 (OTP 111111) — admin';
  RAISE NOTICE '  61000002 (OTP 222222) — 個人賣家';
  RAISE NOTICE '  61000003 (OTP 333333) — 認證商家';
  RAISE NOTICE '  61000004 (OTP 444444) — 普通買家';
  RAISE NOTICE '════════════════════════════════════════════════════';

END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 驗證 query — 跑完上面 DO block 後執行
-- ──────────────────────────────────────────────────────────────────────
SELECT
  u.phone,
  p.username,
  r.role,
  r.status                                          AS role_status,
  mp.seller_type,
  mp.status                                         AS merchant_status,
  (SELECT count(*) FROM public.listings        WHERE seller_id  = u.id)                AS listings,
  (SELECT count(*) FROM public.conversations   WHERE buyer_id   = u.id OR seller_id = u.id) AS conv,
  (SELECT count(*) FROM public.posts           WHERE user_id    = u.id)                AS posts,
  (SELECT count(*) FROM public.follows         WHERE follower_id = u.id)               AS following,
  (SELECT count(*) FROM public.follows         WHERE following_id = u.id)              AS followers,
  (SELECT count(*) FROM public.user_collection WHERE user_id    = u.id)                AS portfolio,
  (SELECT count(*) FROM public.notifications   WHERE user_id    = u.id AND read = false) AS unread
FROM auth.users u
LEFT JOIN public.profiles          p  ON p.id       = u.id
LEFT JOIN public.user_roles        r  ON r.user_id  = u.id
LEFT JOIN public.merchant_profiles mp ON mp.user_id = u.id
WHERE u.phone LIKE '8526100%'
ORDER BY u.phone;
