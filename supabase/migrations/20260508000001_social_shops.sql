-- ============================================================================
-- Collectr — Social + Shops schema
-- Migration: 20260508000001_social_shops.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles 擴充欄位
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio              text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_name   text NOT NULL DEFAULT 'Main';

-- ----------------------------------------------------------------------------
-- posts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url       text,
  media_type      text        NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  thumbnail_url   text,
  caption         text,
  card_name       text,
  set_name        text,
  likes_count     int         NOT NULL DEFAULT 0,
  comments_count  int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_user_idx       ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_created_idx    ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_mediatype_idx  ON public.posts (media_type, created_at DESC);

-- ----------------------------------------------------------------------------
-- follows
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

-- ----------------------------------------------------------------------------
-- post_likes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id    uuid        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ----------------------------------------------------------------------------
-- shops
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shops (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text          NOT NULL,
  location      text,
  rating        numeric(3,1)  DEFAULT 4.5,
  reviews_count int           DEFAULT 0,
  verified      boolean       DEFAULT false,
  description   text,
  emoji         text          DEFAULT '🃏',
  website_url   text,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops       ENABLE ROW LEVEL SECURITY;

-- Posts: 所有人可讀，只有自己可寫
CREATE POLICY "posts read"        ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts owner write" ON public.posts FOR ALL   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Follows: 所有人可讀，只有自己可寫
CREATE POLICY "follows read"        ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows owner write" ON public.follows FOR ALL   USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- Post likes: 所有人可讀，只有自己可寫
CREATE POLICY "post_likes read"        ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "post_likes owner write" ON public.post_likes FOR ALL   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Shops: 所有人可讀，只有服務端可寫（無用戶端寫入 policy）
CREATE POLICY "shops read" ON public.shops FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 初始商店種子資料（香港）
-- ----------------------------------------------------------------------------
INSERT INTO public.shops (name, location, rating, reviews_count, verified, emoji, description) VALUES
  ('Card Master HK',  '旺角',  4.8, 128, true,  '🃏', '旺角最大型 Pokemon 卡牌專門店，收購/出售/評級代送'),
  ('Pokemon 專門店',  '銅鑼灣', 4.9, 256, true,  '⚡', '官方授權零售商，全港最齊備正版卡包'),
  ('收藏卡中心',      '尖沙咀', 4.7, 89,  true,  '🏆', '專業評級服務，PSA/BGS/CGC 代送一站式'),
  ('TCG Paradise',    '觀塘',  4.6, 64,  false, '🎮', '二手卡交易市場，價格公道收卡不刁難')
ON CONFLICT DO NOTHING;
