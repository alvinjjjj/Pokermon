-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove pg_cron (not available on Supabase free plan)
--    The cleanup_price_caches() function is kept — call manually or via
--    a Supabase scheduled Edge Function if needed.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule the job first (ignore error if it doesn't exist)
    BEGIN
      PERFORM cron.unschedule('cleanup-price-caches');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    DROP EXTENSION pg_cron;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix RLS on jtcg_price_cache
--    Old policy allowed anyone (including unauthenticated) to UPDATE and DELETE.
--    New: SELECT = public, INSERT = authenticated only, no UPDATE/DELETE from client.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "jtcg_cache write" ON public.jtcg_price_cache;

CREATE POLICY "jtcg_cache insert authenticated"
  ON public.jtcg_price_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix RLS on tcg_price_snapshots
--    Old policy allowed anyone to UPDATE any row.
--    New: SELECT = public, INSERT = authenticated only, no UPDATE from client.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "snapshots update" ON public.tcg_price_snapshots;
DROP POLICY IF EXISTS "snapshots insert" ON public.tcg_price_snapshots;

CREATE POLICY "snapshots insert authenticated"
  ON public.tcg_price_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);
