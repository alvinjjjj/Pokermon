-- ============================================================================
-- Collectr — JP + EN Pokemon card database schema
-- Migration: 20260508000000_card_database.sql
-- ============================================================================
-- Design notes:
--   • All prices stored in JPY as base currency. Display layer converts via fx_rates.
--   • EN cards: prices come from pokemontcg.io (TCGPlayer/Cardmarket) — converted to JPY on import.
--   • JP cards: prices scraped from Cardrush + Yuyutei daily.
--   • Cross-language search via Postgres tsvector on `cards.search_text`.
--   • Client only reads. All writes happen via Edge Functions using service_role key.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE card_language AS ENUM ('JP', 'EN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE price_source AS ENUM ('cardrush', 'yuyutei', 'pokemontcg_io', 'tcgplayer', 'cardmarket', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE display_currency AS ENUM ('HKD', 'USD', 'JPY', 'CNY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- sets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sets (
  set_code           text         PRIMARY KEY,                -- 'sv1S', 'sv1', 's12a' etc.
  language           card_language NOT NULL,
  name_jp            text,
  name_en            text,
  name_zh            text,
  release_date       date,
  total_cards        int,
  symbol_url         text,
  logo_url           text,
  parallel_set_code  text         REFERENCES public.sets(set_code) ON DELETE SET NULL,
  -- Links a JP set to its closest EN counterpart (and vice versa).
  -- e.g. 'sv1S' (JP Scarlet ex) <-> 'sv1' (EN Scarlet & Violet base)
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sets_language_idx     ON public.sets (language);
CREATE INDEX IF NOT EXISTS sets_release_date_idx ON public.sets (release_date DESC);

-- ----------------------------------------------------------------------------
-- cards
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cards (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  set_code           text         NOT NULL REFERENCES public.sets(set_code) ON DELETE CASCADE,
  language           card_language NOT NULL,
  card_number        text         NOT NULL,                   -- '042/073'
  name_jp            text,
  name_en            text,
  name_zh_hant       text,
  name_zh_hans       text,
  romaji             text,                                    -- 'rizaadon' for JP-only search
  rarity             text,                                    -- RR/RRR/SR/SAR/AR/UR/CHR/etc.
  card_type          text,                                    -- Pokemon/Trainer/Energy
  image_url          text,
  image_url_large    text,
  external_id        text,                                    -- pokemontcg.io id, or pokemon-card.com card id
  parallel_card_id   uuid         REFERENCES public.cards(id) ON DELETE SET NULL,
  -- Links a JP card to its EN counterpart (same Pokemon, same artwork variant).
  search_text        tsvector     GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name_jp, '')),       'A') ||
    setweight(to_tsvector('simple', coalesce(name_en, '')),       'A') ||
    setweight(to_tsvector('simple', coalesce(name_zh_hant, '')),  'A') ||
    setweight(to_tsvector('simple', coalesce(name_zh_hans, '')),  'A') ||
    setweight(to_tsvector('simple', coalesce(romaji, '')),        'B') ||
    setweight(to_tsvector('simple', coalesce(rarity, '')),        'C')
  ) STORED,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (set_code, card_number, language)
);

CREATE INDEX IF NOT EXISTS cards_search_idx       ON public.cards USING gin (search_text);
CREATE INDEX IF NOT EXISTS cards_set_code_idx     ON public.cards (set_code);
CREATE INDEX IF NOT EXISTS cards_language_idx     ON public.cards (language);
CREATE INDEX IF NOT EXISTS cards_parallel_idx     ON public.cards (parallel_card_id);
CREATE INDEX IF NOT EXISTS cards_external_id_idx  ON public.cards (external_id);

-- ----------------------------------------------------------------------------
-- card_prices_raw  (audit trail — every scrape lands here)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_prices_raw (
  id           bigserial    PRIMARY KEY,
  card_id      uuid         NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  source       price_source NOT NULL,
  price_jpy    numeric(12,2) NOT NULL,
  source_url   text,
  fetched_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_prices_raw_card_idx ON public.card_prices_raw (card_id, fetched_at DESC);

-- ----------------------------------------------------------------------------
-- card_prices_daily  (one row per card per day — used for charts + display)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_prices_daily (
  card_id        uuid         NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  date           date         NOT NULL,
  avg_jpy        numeric(12,2) NOT NULL,
  min_jpy        numeric(12,2),
  max_jpy        numeric(12,2),
  sources_count  int          NOT NULL DEFAULT 1,
  PRIMARY KEY (card_id, date)
);

CREATE INDEX IF NOT EXISTS card_prices_daily_date_idx ON public.card_prices_daily (date DESC);

-- View: latest known price per card (used by client almost everywhere)
CREATE OR REPLACE VIEW public.card_latest_price AS
SELECT DISTINCT ON (card_id)
  card_id,
  date         AS as_of,
  avg_jpy,
  min_jpy,
  max_jpy,
  sources_count
FROM public.card_prices_daily
ORDER BY card_id, date DESC;

-- ----------------------------------------------------------------------------
-- fx_rates  (one row per day — JPY base, all rates expressed as 1 JPY = X)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fx_rates (
  date          date          PRIMARY KEY,
  jpy_to_hkd    numeric(10,6) NOT NULL,
  jpy_to_usd    numeric(10,6) NOT NULL,
  jpy_to_cny    numeric(10,6) NOT NULL,
  fetched_at    timestamptz   NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- user_collection  (保留舊版 schema，App 前端繼續使用此結構)
-- ----------------------------------------------------------------------------
-- 舊版 user_collection 使用 card_id text（pokemontcg.io ID），
-- 等前端完全遷移後再切換為 uuid FK 版本。
CREATE TABLE IF NOT EXISTS public.user_collection (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id        text         NOT NULL,
  card_name      text,
  set_name       text,
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  current_price  numeric(12,2) NOT NULL DEFAULT 0,
  quantity       int          NOT NULL DEFAULT 1 CHECK (quantity > 0),
  psa_grade      text,
  image_url      text,
  added_at       timestamptz  NOT NULL DEFAULT now(),
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_collection_user_idx ON public.user_collection (user_id, added_at DESC);
CREATE INDEX IF NOT EXISTS user_collection_card_idx ON public.user_collection (card_id);

-- ----------------------------------------------------------------------------
-- profiles  (display currency lives here)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid              PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username          text              UNIQUE,
  display_name      text,
  avatar_url        text,
  display_currency  display_currency  NOT NULL DEFAULT 'HKD',
  created_at        timestamptz       NOT NULL DEFAULT now(),
  updated_at        timestamptz       NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sets_updated_at            ON public.sets;
DROP TRIGGER IF EXISTS cards_updated_at           ON public.cards;
DROP TRIGGER IF EXISTS user_collection_updated_at ON public.user_collection;
DROP TRIGGER IF EXISTS profiles_updated_at        ON public.profiles;

CREATE TRIGGER sets_updated_at            BEFORE UPDATE ON public.sets            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cards_updated_at           BEFORE UPDATE ON public.cards           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_collection_updated_at BEFORE UPDATE ON public.user_collection FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.sets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_prices_raw    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_prices_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;

-- Wipe ANY pre-existing policy on tables we manage, regardless of policy name.
-- Handles the case where a table was set up via Supabase Dashboard which auto-creates
-- policies named like "Users can insert own collection" that we don't know up-front.
DO $$
DECLARE
  t   text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['sets','cards','card_prices_raw','card_prices_daily',
                            'fx_rates','user_collection','profiles']
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY "sets read"              ON public.sets              FOR SELECT USING (true);
CREATE POLICY "cards read"             ON public.cards             FOR SELECT USING (true);
CREATE POLICY "card_prices_daily read" ON public.card_prices_daily FOR SELECT USING (true);
CREATE POLICY "fx_rates read"          ON public.fx_rates          FOR SELECT USING (true);

-- card_prices_raw is internal — service_role only (no client policy = no client access).

-- user_collection: owner can do everything on own rows.
DROP POLICY IF EXISTS "user_collection owner all" ON public.user_collection;
CREATE POLICY "user_collection owner all" ON public.user_collection
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- profiles: anyone can read (for social features); only owner can update.
DROP POLICY IF EXISTS "profiles read"        ON public.profiles;
DROP POLICY IF EXISTS "profiles owner write" ON public.profiles;
CREATE POLICY "profiles read"        ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles owner write" ON public.profiles FOR ALL    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Helper function: search cards across languages, ranked
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_cards(
  q              text,
  lang_filter    card_language DEFAULT NULL,   -- NULL = both JP + EN
  page_size      int           DEFAULT 30,
  page_offset    int           DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  set_code      text,
  language      card_language,
  card_number   text,
  name_jp       text,
  name_en       text,
  rarity        text,
  image_url     text,
  latest_jpy    numeric,
  rank          real
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id, c.set_code, c.language, c.card_number,
    c.name_jp, c.name_en, c.rarity, c.image_url,
    p.avg_jpy AS latest_jpy,
    ts_rank(c.search_text, plainto_tsquery('simple', q)) AS rank
  FROM public.cards c
  LEFT JOIN public.card_latest_price p ON p.card_id = c.id
  WHERE c.search_text @@ plainto_tsquery('simple', q)
    AND (lang_filter IS NULL OR c.language = lang_filter)
  ORDER BY rank DESC, c.set_code, c.card_number
  LIMIT page_size OFFSET page_offset;
$$;
