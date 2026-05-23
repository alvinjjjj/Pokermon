-- ============================================================================
-- QA 全功能測試資料 — 2026-05-13
--
-- 把 3 個 @test.com 帳號全部升級成商家，建立 cross-conversations、
-- cross-listings、posts、follows、likes、comments、portfolio entries。
--
-- 全 idempotent — 每次跑都會先清掉這 3 個 user 的舊測試資料再重建。
-- 不會影響正式用戶的資料（uid 比對嚴格限定在 @test.com）。
--
-- 跑法：
--   把整個檔案內容貼進 Supabase Dashboard → SQL Editor → Run
--
-- 跑完用以下三組登入：
--   user_normal@test.com     / Test1234!   (個人賣家)
--   seller_personal@test.com / Test1234!   (個人賣家)
--   seller_business@test.com / Test1234!   (認證商家)
-- ============================================================================

DO $$
DECLARE
  v_normal_id    uuid;
  v_personal_id  uuid;
  v_business_id  uuid;

  v_normal_mp    uuid;
  v_personal_mp  uuid;
  v_business_mp  uuid;

  v_listing_b1   uuid;
  v_listing_b2   uuid;
  v_listing_p1   uuid;
  v_listing_p2   uuid;
  v_listing_n1   uuid;
  v_listing_n2   uuid;

  v_conv_nb      uuid;   -- normal ↔ business
  v_conv_np      uuid;   -- normal ↔ personal
  v_conv_pb      uuid;   -- personal ↔ business

  v_post_n       uuid;
  v_post_p       uuid;
  v_post_b       uuid;
BEGIN

  -- ─────────────────────────────────────────────────────────────
  -- 0. 取得 3 個測試帳號的 uid
  -- ─────────────────────────────────────────────────────────────
  SELECT id INTO v_normal_id   FROM auth.users WHERE email = 'user_normal@test.com'     LIMIT 1;
  SELECT id INTO v_personal_id FROM auth.users WHERE email = 'seller_personal@test.com' LIMIT 1;
  SELECT id INTO v_business_id FROM auth.users WHERE email = 'seller_business@test.com' LIMIT 1;

  IF v_normal_id IS NULL OR v_personal_id IS NULL OR v_business_id IS NULL THEN
    RAISE EXCEPTION '❌ 找不到全部 3 個測試帳號。請先跑 node scripts/qa-setup.mjs 建立帳號';
  END IF;

  RAISE NOTICE '✅ 3 個 user 都存在: normal=%, personal=%, business=%',
    v_normal_id, v_personal_id, v_business_id;

  -- ─────────────────────────────────────────────────────────────
  -- 1. 清掉舊 QA 資料（idempotency）
  --    只清這 3 個 user 的 row，不會影響其他用戶
  -- ─────────────────────────────────────────────────────────────
  DELETE FROM public.user_collection WHERE user_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.post_likes      WHERE user_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.post_comments   WHERE user_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.follows
    WHERE follower_id IN (v_normal_id, v_personal_id, v_business_id)
       OR following_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.posts           WHERE user_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.messages        WHERE sender_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.conversations
    WHERE buyer_id  IN (v_normal_id, v_personal_id, v_business_id)
       OR seller_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.listings        WHERE seller_id IN (v_normal_id, v_personal_id, v_business_id);
  DELETE FROM public.notifications   WHERE user_id IN (v_normal_id, v_personal_id, v_business_id);

  RAISE NOTICE '🧹 清完舊 QA 資料';

  -- ─────────────────────────────────────────────────────────────
  -- 2. 確保 profile 都齊全
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, username, bio)
  VALUES
    (v_normal_id,   'normal_user',      '一般 QA 測試帳號 — 之前是 buyer，現在也是個人賣家'),
    (v_personal_id, 'personal_seller',  '個人賣家 QA 帳號'),
    (v_business_id, 'business_seller',  '認證商家 QA 帳號（旺角店）')
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        bio      = EXCLUDED.bio;

  -- ─────────────────────────────────────────────────────────────
  -- 3. user_roles — 3 個都是 active seller
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.user_roles (user_id, role, status)
  VALUES
    (v_normal_id,   'individual_seller',  'active'),
    (v_personal_id, 'individual_seller',  'active'),
    (v_business_id, 'certified_merchant', 'active')
  ON CONFLICT (user_id) DO UPDATE
    SET role   = EXCLUDED.role,
        status = EXCLUDED.status;

  -- ─────────────────────────────────────────────────────────────
  -- 4. merchant_profiles — user_normal 新增；其他兩個 upsert
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.merchant_profiles (
    user_id, seller_type, display_name, district, shop_description,
    declaration_agreed, status
  )
  VALUES (
    v_normal_id, 'individual_seller', 'Normal QA Seller', '中環',
    '個人賣家 — QA 普通用戶升級而來', true, 'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET seller_type        = 'individual_seller',
        display_name       = 'Normal QA Seller',
        declaration_agreed = true,
        status             = 'active';

  INSERT INTO public.merchant_profiles (
    user_id, seller_type, display_name, district, shop_description,
    declaration_agreed, status
  )
  VALUES (
    v_personal_id, 'individual_seller', 'Test Personal Seller', '銅鑼灣',
    '測試個人賣家帳號', true, 'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET seller_type        = 'individual_seller',
        display_name       = 'Test Personal Seller',
        declaration_agreed = true,
        status             = 'active';

  INSERT INTO public.merchant_profiles (
    user_id, seller_type, display_name, district,
    shop_name_zh, shop_name_en, shop_description, status
  )
  VALUES (
    v_business_id, 'certified_merchant', 'Test Business Store', '旺角',
    '測試商店', 'Test Business Store', '測試商業賣家帳號 — 旺角實體店', 'active'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET seller_type   = 'certified_merchant',
        display_name  = 'Test Business Store',
        shop_name_zh  = '測試商店',
        shop_name_en  = 'Test Business Store',
        status        = 'active';

  -- 取得新建立的 merchant_profile id（用於 listings.merchant_id FK）
  SELECT id INTO v_normal_mp   FROM public.merchant_profiles WHERE user_id = v_normal_id;
  SELECT id INTO v_personal_mp FROM public.merchant_profiles WHERE user_id = v_personal_id;
  SELECT id INTO v_business_mp FROM public.merchant_profiles WHERE user_id = v_business_id;

  RAISE NOTICE '✅ 3 個 merchant_profiles 都 active';

  -- ─────────────────────────────────────────────────────────────
  -- 5. Listings — 每人 2 張，cover 不同 condition / language
  -- ─────────────────────────────────────────────────────────────
  v_listing_b1 := gen_random_uuid();
  v_listing_b2 := gen_random_uuid();
  v_listing_p1 := gen_random_uuid();
  v_listing_p2 := gen_random_uuid();
  v_listing_n1 := gen_random_uuid();
  v_listing_n2 := gen_random_uuid();

  INSERT INTO public.listings (
    id, seller_id, merchant_id, seller_type, card_id, card_name, set_name,
    rarity, card_image_url, photo_urls, condition, price, is_negotiable,
    quantity, language, notes, status
  ) VALUES
    -- Business listings (高價，認證商家) — 1 張 PSA 10 + 1 張 Raw
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
     '日版 promo，未拆封', 'active'),

    -- Personal seller listings (中價，個人賣家)
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

    -- Normal user listings (新升級的賣家，價低)
    (v_listing_n1, v_normal_id, v_normal_mp, 'individual_seller',
     'base1-4', 'Charizard', 'Base Set',
     'Holo Rare',
     'https://images.pokemontcg.io/base1/4.png',
     ARRAY[]::text[],
     'Raw', 180, true, 1, ARRAY['EN']::text[],
     '邊角磨損但圖案清晰', 'active'),

    (v_listing_n2, v_normal_id, v_normal_mp, 'individual_seller',
     'sv3-205', 'Squirtle', '151',
     'Illustration Rare',
     'https://images.pokemontcg.io/sv3pt5/205.png',
     ARRAY[]::text[],
     'Raw', 95, false, 1, ARRAY['JP']::text[],
     NULL, 'active');

  RAISE NOTICE '✅ 6 張 listings 建立完成';

  -- ─────────────────────────────────────────────────────────────
  -- 6. Conversations + Messages — 3 條 cross-chat
  -- ─────────────────────────────────────────────────────────────
  -- Conv 1: normal (buyer) ↔ business (seller) 關於 business 的 Charizard
  v_conv_nb := gen_random_uuid();
  INSERT INTO public.conversations (id, buyer_id, seller_id, listing_id, merchant_id, created_at)
  VALUES (v_conv_nb, v_normal_id, v_business_id, v_listing_b1, v_business_mp, now() - interval '2 hours');

  INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (v_conv_nb, v_normal_id,   '你好，這張 Charizard ex 還在嗎？',                  true,  now() - interval '2 hours'),
    (v_conv_nb, v_business_id, '在的，PSA 10 評級卡套保護中', true,  now() - interval '110 minutes'),
    (v_conv_nb, v_normal_id,   '可以面交嗎？我在中環',                              true,  now() - interval '100 minutes'),
    (v_conv_nb, v_business_id, '可以，我們旺角店有實體交收，或可以順豐到付',         false, now() - interval '90 minutes');
  -- ↑ 最後一則 is_read = false → normal user 進 inbox 會看到 unread badge

  -- Conv 2: normal (buyer) ↔ personal (seller) 關於 Iono
  v_conv_np := gen_random_uuid();
  INSERT INTO public.conversations (id, buyer_id, seller_id, listing_id, created_at)
  VALUES (v_conv_np, v_normal_id, v_personal_id, v_listing_p2, now() - interval '1 day');

  INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (v_conv_np, v_normal_id,   'Iono 這張可以議價嗎？',                        true, now() - interval '1 day'),
    (v_conv_np, v_personal_id, '$1200 已經是底價了 sorry',                     true, now() - interval '23 hours'),
    (v_conv_np, v_normal_id,   '了解，再考慮下',                               true, now() - interval '22 hours'),
    (v_conv_np, v_personal_id, '如果連 Squirtle 一起拿可以打 9 折',             true, now() - interval '21 hours');

  -- Conv 3: personal (buyer) ↔ business (seller) 關於 business 的 Pikachu promo
  v_conv_pb := gen_random_uuid();
  INSERT INTO public.conversations (id, buyer_id, seller_id, listing_id, merchant_id, created_at)
  VALUES (v_conv_pb, v_personal_id, v_business_id, v_listing_b2, v_business_mp, now() - interval '3 days');

  INSERT INTO public.messages (conversation_id, sender_id, content, is_read, created_at) VALUES
    (v_conv_pb, v_personal_id, 'Pikachu promo 還有幾張？',                     true,  now() - interval '3 days'),
    (v_conv_pb, v_business_id, '3 張，全新未拆',                                true,  now() - interval '70 hours'),
    (v_conv_pb, v_personal_id, '我全包，可以多便宜嗎？',                        false, now() - interval '69 hours'),
    (v_conv_pb, v_personal_id, '在嗎？',                                         false, now() - interval '12 hours');
  -- ↑ 最後兩則 is_read = false → business 進 inbox 會看到 unread badge

  RAISE NOTICE '✅ 3 條 conversations + 12 則 messages 建立完成（每條 4 則來回）';

  -- ─────────────────────────────────────────────────────────────
  -- 7. Posts — 每人 1 篇，auto-approved 避免卡 moderation
  -- ─────────────────────────────────────────────────────────────
  v_post_n := gen_random_uuid();
  v_post_p := gen_random_uuid();
  v_post_b := gen_random_uuid();

  INSERT INTO public.posts (
    id, user_id, media_url, media_type, thumbnail_url, caption,
    card_name, set_name, post_category, moderation_status, created_at
  ) VALUES
    (v_post_n, v_normal_id,
     'https://images.pokemontcg.io/base1/4_hires.png',
     'image',
     'https://images.pokemontcg.io/base1/4.png',
     '新手收藏入手 Base Set Charizard 🔥 雖然 MP 但邊角還能看',
     'Charizard', 'Base Set', 'post', 'approved',
     now() - interval '2 days'),

    (v_post_p, v_personal_id,
     'https://images.pokemontcg.io/sv3pt5/247_hires.png',
     'image',
     'https://images.pokemontcg.io/sv3pt5/247.png',
     '今日開盒運氣超好，連抽到 SAR Iono ✨',
     'Iono', '151', 'unboxing', 'approved',
     now() - interval '5 days'),

    (v_post_b, v_business_id,
     'https://images.pokemontcg.io/sv4/198_hires.png',
     'image',
     'https://images.pokemontcg.io/sv4/198.png',
     'Charizard ex SIR 已 PSA 10 評級完成 — 旺角店實物展示中',
     'Charizard ex', 'Paradox Rift', 'post', 'approved',
     now() - interval '1 day');

  RAISE NOTICE '✅ 3 篇 posts 建立完成（全 approved）';

  -- ─────────────────────────────────────────────────────────────
  -- 8. Follows — 每人 follow 另外兩個（會觸發 notify_on_follow trigger）
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.follows (follower_id, following_id) VALUES
    (v_normal_id,   v_personal_id),
    (v_normal_id,   v_business_id),
    (v_personal_id, v_normal_id),
    (v_personal_id, v_business_id),
    (v_business_id, v_normal_id),
    (v_business_id, v_personal_id);

  RAISE NOTICE '✅ 6 條 cross-follows 建立完成（會自動產生 follow notifications）';

  -- ─────────────────────────────────────────────────────────────
  -- 9. Likes — 每人 like 別人的 post（會觸發 notify_on_like + likes_count trigger）
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.post_likes (post_id, user_id) VALUES
    (v_post_b, v_normal_id),
    (v_post_p, v_normal_id),
    (v_post_n, v_personal_id),
    (v_post_b, v_personal_id),
    (v_post_n, v_business_id),
    (v_post_p, v_business_id);

  -- ─────────────────────────────────────────────────────────────
  -- 10. Comments — 每人在別人 post 留言（會觸發 notify_on_comment + count trigger）
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.post_comments (post_id, user_id, content, created_at) VALUES
    (v_post_b, v_normal_id,   '這張品相也太好！',                 now() - interval '20 hours'),
    (v_post_b, v_personal_id, '幾錢出手？',                       now() - interval '18 hours'),
    (v_post_p, v_normal_id,   '羨慕，我抽 10 盒都沒中',            now() - interval '4 days'),
    (v_post_p, v_business_id, 'SAR Iono 真的香',                  now() - interval '4 days'),
    (v_post_n, v_personal_id, 'Base Set 永遠的神',                 now() - interval '1 day'),
    (v_post_n, v_business_id, 'MP 都有人收的，加油 💪',            now() - interval '1 day');

  RAISE NOTICE '✅ 6 條 likes + 6 條 comments 建立完成（會自動產生 like/comment notifications）';

  -- ─────────────────────────────────────────────────────────────
  -- 11. Portfolio — 每人 2-3 張卡進收藏
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO public.user_collection (
    user_id, card_id, card_name, set_name, purchase_price,
    current_price, quantity, psa_grade, image_url
  ) VALUES
    -- Normal user 的收藏
    (v_normal_id, 'base1-4',  'Charizard',    'Base Set',      150,  180, 1, 'Raw',
     'https://images.pokemontcg.io/base1/4.png'),
    (v_normal_id, 'sv3-205',  'Squirtle',     '151',           80,   95, 1, 'Raw',
     'https://images.pokemontcg.io/sv3pt5/205.png'),

    -- Personal seller 的收藏（個人也是收藏家）
    (v_personal_id, 'sv4-25',     'Mimikyu', 'Paradox Rift', 280,  320,  1, 'Raw',
     'https://images.pokemontcg.io/sv4/25.png'),
    (v_personal_id, 'sv3-247',    'Iono',    '151',           1000, 1200, 1, 'Raw',
     'https://images.pokemontcg.io/sv3pt5/247.png'),
    (v_personal_id, 'sv4-26',     'Pikachu', 'Paradox Rift', 150,  175,  2, 'Raw',
     'https://images.pokemontcg.io/sv4/26.png'),

    -- Business seller 的收藏（高價 PSA10）
    (v_business_id, 'sv4-198',    'Charizard ex',   'Paradox Rift', 2500, 2800, 1, '10',
     'https://images.pokemontcg.io/sv4/198.png'),
    (v_business_id, 'sv-p-066',   'Pikachu',        'SV-P Promos',   400,  580, 3, 'Raw',
     'https://images.pokemontcg.io/svp/66.png'),
    (v_business_id, 'sv3pt5-185', 'Charizard ex',   '151',           1800, 2100, 1, '9',
     'https://images.pokemontcg.io/sv3pt5/185.png');

  RAISE NOTICE '✅ Portfolio: normal(2 cards), personal(3), business(3)';

  -- ─────────────────────────────────────────────────────────────
  -- 12. 摘要
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '🎉 QA Setup 完成！';
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE '3 個帳號全是 active merchant';
  RAISE NOTICE '6 listings · 3 conversations · 12 messages';
  RAISE NOTICE '3 posts · 6 follows · 6 likes · 6 comments';
  RAISE NOTICE '8 portfolio entries';
  RAISE NOTICE '────────────────────────────────────────────────────';
  RAISE NOTICE '登入測試：';
  RAISE NOTICE '  user_normal@test.com     / Test1234!';
  RAISE NOTICE '  seller_personal@test.com / Test1234!';
  RAISE NOTICE '  seller_business@test.com / Test1234!';
  RAISE NOTICE '════════════════════════════════════════════════════';

END $$;

-- ──────────────────────────────────────────────────────────────────────
-- 驗證 query — 跑完上面 DO block 後，這條會列出每個 user 的全部狀態
-- ──────────────────────────────────────────────────────────────────────
SELECT
  u.email,
  p.username,
  r.role                                          AS user_role,
  mp.seller_type,
  mp.status                                       AS merchant_status,
  (SELECT count(*) FROM public.listings        WHERE seller_id  = u.id)               AS listings_count,
  (SELECT count(*) FROM public.conversations   WHERE buyer_id   = u.id OR seller_id = u.id) AS conv_count,
  (SELECT count(*) FROM public.posts           WHERE user_id    = u.id)               AS posts_count,
  (SELECT count(*) FROM public.follows         WHERE follower_id = u.id)              AS following,
  (SELECT count(*) FROM public.follows         WHERE following_id = u.id)             AS followers,
  (SELECT count(*) FROM public.user_collection WHERE user_id    = u.id)               AS portfolio_cards,
  (SELECT count(*) FROM public.notifications   WHERE user_id    = u.id AND read = false) AS unread_notifs
FROM auth.users u
LEFT JOIN public.profiles          p  ON p.id       = u.id
LEFT JOIN public.user_roles        r  ON r.user_id  = u.id
LEFT JOIN public.merchant_profiles mp ON mp.user_id = u.id
WHERE u.email IN ('user_normal@test.com', 'seller_personal@test.com', 'seller_business@test.com')
ORDER BY u.email;
