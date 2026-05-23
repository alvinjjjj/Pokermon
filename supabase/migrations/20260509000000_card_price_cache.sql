-- Card price cache table (PokemonPriceTracker via ppt-proxy).
--
-- Originally named `card_price_cache.sql` without a date prefix; renamed
-- 2026-05-13 to fit the standard YYYYMMDDHHMMSS naming convention.
-- Idempotent — safe to re-run.
--
-- The jtcg_price_cache table created here was deprecated and is dropped
-- in 20260513_drop_dead_jtcg_cache.sql.

create table if not exists public.card_price_cache (
  id          bigserial primary key,
  cache_key   text not null unique,   -- "{cardName_lower}|{setName_lower}|{lang}"
  price_json  jsonb not null,
  fetched_at  timestamptz not null default now()
);

create index if not exists card_price_cache_key_idx
  on public.card_price_cache(cache_key);

-- Legacy JustTCG cache (dropped in 20260513_drop_dead_jtcg_cache.sql)
create table if not exists public.jtcg_price_cache (
  id          bigserial primary key,
  cache_key   text not null unique,
  cards_json  jsonb not null,
  fetched_at  timestamptz not null default now()
);

create index if not exists jtcg_price_cache_key_idx
  on public.jtcg_price_cache(cache_key);
