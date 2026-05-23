-- TTL cleanup for card_prices_daily and jtcg_price_cache
-- Prevents unbounded DB growth (Supabase Pro limit: 8GB)
-- card_prices_daily: keep 90 days of history (enough for charts)
-- jtcg_price_cache: keep 7 days (stale price data not useful)

CREATE OR REPLACE FUNCTION public.cleanup_price_caches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove card price history older than 90 days
  DELETE FROM public.card_prices_daily
  WHERE recorded_at < now() - INTERVAL '90 days';

  -- Remove stale JustTCG cache entries older than 7 days
  DELETE FROM public.jtcg_price_cache
  WHERE fetched_at < now() - INTERVAL '7 days';
END;
$$;

-- Schedule: run daily at 3am UTC via pg_cron (Supabase Pro supports this)
-- Enable pg_cron extension first if not already enabled:
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-price-caches',   -- job name (unique)
  '0 3 * * *',              -- daily at 3am UTC
  'SELECT public.cleanup_price_caches()'
);
