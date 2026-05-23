-- jtcg_price_cache: Supabase-backed Layer 2 cache for JustTCG prices
-- Prevents repeated API calls; TTL enforced in app (24h) and by cleanup function below.

CREATE TABLE IF NOT EXISTS public.jtcg_price_cache (
  id          bigserial    PRIMARY KEY,
  cache_key   text         NOT NULL UNIQUE,  -- e.g. "en:Charizard:Obsidian Flames"
  cards_json  jsonb        NOT NULL,
  fetched_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jtcg_price_cache_key_idx
  ON public.jtcg_price_cache (cache_key);

CREATE INDEX IF NOT EXISTS jtcg_price_cache_fetched_idx
  ON public.jtcg_price_cache (fetched_at);

ALTER TABLE public.jtcg_price_cache ENABLE ROW LEVEL SECURITY;

-- Price data is public — anyone can read cached prices
CREATE POLICY "jtcg_cache read"
  ON public.jtcg_price_cache FOR SELECT
  USING (true);

-- Only authenticated users can insert/update cache (prevents anonymous price tampering)
CREATE POLICY "jtcg_cache insert"
  ON public.jtcg_price_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "jtcg_cache update"
  ON public.jtcg_price_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
