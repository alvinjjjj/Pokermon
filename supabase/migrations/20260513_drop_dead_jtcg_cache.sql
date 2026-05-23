-- ─────────────────────────────────────────────────────────────
-- Drop dead JustTCG cache — 2026-05-13
--
-- JustTCG was replaced by PokemonPriceTracker (see lib/pokeprice.ts).
-- The `jtcg_price_cache` table + its RLS policies are unreferenced
-- in any current client code; lib/justtcg.ts has been removed.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "jtcg_price_cache_select" on public.jtcg_price_cache;
drop policy if exists "jtcg_price_cache_upsert" on public.jtcg_price_cache;
drop policy if exists "jtcg_price_cache_update" on public.jtcg_price_cache;
drop table  if exists public.jtcg_price_cache;
