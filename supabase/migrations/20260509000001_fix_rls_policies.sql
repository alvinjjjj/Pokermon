-- Create cache tables + fix RLS policies.
--
-- Originally named `fix_rls_policies.sql` without a date prefix; renamed
-- 2026-05-13 to fit the standard YYYYMMDDHHMMSS naming convention.
-- Idempotent — safe to re-run.

-- ── card_price_cache ──────────────────────────────────────────────────────────
create table if not exists public.card_price_cache (
  id          bigserial primary key,
  cache_key   text not null unique,
  price_json  jsonb not null,
  fetched_at  timestamptz not null default now()
);
create index if not exists card_price_cache_key_idx on public.card_price_cache(cache_key);
alter table public.card_price_cache enable row level security;
drop policy if exists "card_price_cache_select" on public.card_price_cache;
drop policy if exists "card_price_cache_upsert" on public.card_price_cache;
drop policy if exists "card_price_cache_update" on public.card_price_cache;
-- Anyone can read cached prices
create policy "card_price_cache_select" on public.card_price_cache for select using (true);
-- Only authenticated users can insert new cache entries
create policy "card_price_cache_upsert" on public.card_price_cache for insert to authenticated with check (true);
-- Only authenticated users can update cache entries (required for upsert ON CONFLICT UPDATE)
-- Note: service_role bypasses RLS entirely and never hits this policy
create policy "card_price_cache_update" on public.card_price_cache for update to authenticated using (true) with check (true);

-- ── jtcg_price_cache ──────────────────────────────────────────────────────────
create table if not exists public.jtcg_price_cache (
  id          bigserial primary key,
  cache_key   text not null unique,
  cards_json  jsonb not null,
  fetched_at  timestamptz not null default now()
);
create index if not exists jtcg_price_cache_key_idx on public.jtcg_price_cache(cache_key);
alter table public.jtcg_price_cache enable row level security;
drop policy if exists "jtcg_price_cache_select" on public.jtcg_price_cache;
drop policy if exists "jtcg_price_cache_upsert" on public.jtcg_price_cache;
drop policy if exists "jtcg_price_cache_update" on public.jtcg_price_cache;
-- Anyone can read cached prices
create policy "jtcg_price_cache_select" on public.jtcg_price_cache for select using (true);
-- Only authenticated users can insert/update cache entries
create policy "jtcg_price_cache_upsert" on public.jtcg_price_cache for insert to authenticated with check (true);
create policy "jtcg_price_cache_update" on public.jtcg_price_cache for update to authenticated using (true) with check (true);

-- ── tcg_price_snapshots ───────────────────────────────────────────────────────
create table if not exists public.tcg_price_snapshots (
  id           bigserial primary key,
  tcg_card_id  text not null,
  date         date not null,
  price_usd    numeric(10,4) not null default 0,
  psa10_usd    numeric(10,4),
  psa9_usd     numeric(10,4),
  created_at   timestamptz not null default now(),
  unique (tcg_card_id, date)
);
create index if not exists tcg_price_snapshots_card_idx on public.tcg_price_snapshots(tcg_card_id);
create index if not exists tcg_price_snapshots_date_idx on public.tcg_price_snapshots(date);
alter table public.tcg_price_snapshots enable row level security;
drop policy if exists "snapshots_select" on public.tcg_price_snapshots;
drop policy if exists "snapshots_insert" on public.tcg_price_snapshots;
drop policy if exists "snapshots_update" on public.tcg_price_snapshots;
-- Anyone can read price history
create policy "snapshots_select" on public.tcg_price_snapshots for select using (true);
-- Only authenticated users can insert/update snapshots
create policy "snapshots_insert" on public.tcg_price_snapshots for insert to authenticated with check (true);
create policy "snapshots_update" on public.tcg_price_snapshots for update to authenticated using (true) with check (true);

-- ── booster_box_prices ────────────────────────────────────────────────────────
alter table public.booster_box_prices enable row level security;
drop policy if exists "booster_box_prices_select" on public.booster_box_prices;
drop policy if exists "booster_box_prices_upsert" on public.booster_box_prices;
drop policy if exists "booster_box_prices_update" on public.booster_box_prices;
-- Anyone can read booster box prices
create policy "booster_box_prices_select" on public.booster_box_prices for select using (true);
-- Only authenticated users can insert/update prices
create policy "booster_box_prices_upsert" on public.booster_box_prices for insert to authenticated with check (true);
create policy "booster_box_prices_update" on public.booster_box_prices for update to authenticated using (true) with check (true);
