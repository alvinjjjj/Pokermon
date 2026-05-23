-- ─────────────────────────────────────────────────────────────
-- Security fixes – 2026-05-13
-- Run this once in Supabase SQL Editor (idempotent)
-- ─────────────────────────────────────────────────────────────

-- ── 1. card_price_cache – ensure RLS + correct policies ──────
--    (Covers the case where the unversioned card_price_cache.sql
--     was applied before fix_rls_policies.sql added RLS.)

alter table if exists public.card_price_cache enable row level security;

drop policy if exists "card_price_cache_select" on public.card_price_cache;
drop policy if exists "card_price_cache_upsert" on public.card_price_cache;
drop policy if exists "card_price_cache_update" on public.card_price_cache;

-- Anyone (including anon) can read cached prices
create policy "card_price_cache_select"
  on public.card_price_cache
  for select using (true);

-- Only authenticated users can write new cache entries
create policy "card_price_cache_upsert"
  on public.card_price_cache
  for insert
  to authenticated
  with check (true);

-- Only authenticated users can refresh existing cache entries
create policy "card_price_cache_update"
  on public.card_price_cache
  for update
  to authenticated
  using (true)
  with check (true);


-- ── 2. notifications – tighten insert policy ─────────────────
--    All legitimate notification rows are created by
--    SECURITY DEFINER trigger functions that bypass RLS.
--    The client-facing INSERT policy should therefore only
--    allow a user to insert a row where actor_id = their own uid,
--    preventing any authenticated user from spoofing notifications
--    as someone else.

drop policy if exists "notifications insert"         on public.notifications;
drop policy if exists "notifications_insert"         on public.notifications;
drop policy if exists "Allow authenticated insert"   on public.notifications;

create policy "notifications_insert"
  on public.notifications
  for insert
  with check (actor_id = auth.uid());


-- ── 3. artofpkm_card_images – allow authenticated inserts ────
--    The seeding script (import-to-supabase.mjs) needs to write rows.
--    Service role bypasses RLS entirely, but authenticated users
--    (e.g. signed-in admin scripts) also need insert/update access.

drop policy if exists "artofpkm_authenticated_insert" on public.artofpkm_card_images;
drop policy if exists "artofpkm_authenticated_update" on public.artofpkm_card_images;

create policy "artofpkm_authenticated_insert"
  on public.artofpkm_card_images
  for insert
  to authenticated
  with check (true);

create policy "artofpkm_authenticated_update"
  on public.artofpkm_card_images
  for update
  to authenticated
  using (true)
  with check (true);


-- ── 4. messages – add upper content length limit ─────────────
--    The existing check only enforces > 0 chars.
--    Add a 2 000-character upper bound to prevent abuse.

alter table public.messages
  drop constraint if exists messages_content_length_check;

alter table public.messages
  drop constraint if exists messages_content_check;

-- Re-add the combined constraint (non-empty AND ≤ 2 000 chars)
alter table public.messages
  add constraint messages_content_check
  check (char_length(trim(content)) > 0 and char_length(content) <= 2000);
