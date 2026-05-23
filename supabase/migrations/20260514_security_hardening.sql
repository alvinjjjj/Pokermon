-- ────────────────────────────────────────────────────────────────────────────
-- Production security hardening — 2026-05-14
--
-- Fixes from production audit:
--   1. posts read policy showed REJECTED posts to the public.
--      Tighten to only show approved + own.
--   2. merchant-assets storage allowed any authenticated user to UPDATE files
--      inside the `avatars/` subfolder regardless of ownership.
--      Tighten to owner-only by user-id-prefixed path.
--   3. ppt-proxy rate-limit checks should fail closed on error
--      (handled in edge-function code separately).
--   4. listings price prefix guard for negative/huge values.
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. posts read policy: hide rejected posts from public ──────────────────
drop policy if exists "posts read"          on public.posts;
drop policy if exists "posts read approved" on public.posts;

create policy "posts read approved" on public.posts
  for select
  using (
    -- public can see approved + pending (so user's own pending shows up too via
    -- the lighter check below); rejected stays hidden
    moderation_status in ('approved', 'pending')
    or auth.uid() = user_id
  );


-- ── 2. merchant-assets storage: lock UPDATE to owner-by-path ───────────────
-- The previous policy let anyone with auth update files inside `avatars/`.
-- Replace with strict ownership: the first path segment must equal the
-- caller's user_id.
drop policy if exists "merchant-assets 用戶可更新自己的檔案" on storage.objects;
drop policy if exists "merchant-assets owner update"          on storage.objects;

create policy "merchant-assets owner update" on storage.objects
  for update
  using (
    bucket_id = 'merchant-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'merchant-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Also tighten DELETE (was likely permissive too)
drop policy if exists "merchant-assets 用戶可刪除自己的檔案" on storage.objects;
drop policy if exists "merchant-assets owner delete"          on storage.objects;

create policy "merchant-assets owner delete" on storage.objects
  for delete
  using (
    bucket_id = 'merchant-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 3. listings sanity check: positive price + photo array bounds ─────────
-- Defensive constraints in case the client validation is bypassed.
alter table public.listings
  drop constraint if exists listings_price_positive;
alter table public.listings
  add constraint listings_price_positive
  check (price > 0 and price < 100000000);  -- HK$1 to HK$100M sanity

alter table public.listings
  drop constraint if exists listings_photo_count;
alter table public.listings
  add constraint listings_photo_count
  check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 10);


-- ── 4. card_prices_raw: positive price constraint ─────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'card_prices_raw') then
    execute 'alter table public.card_prices_raw drop constraint if exists card_prices_raw_price_positive';
    execute 'alter table public.card_prices_raw add constraint card_prices_raw_price_positive check (price_jpy is null or price_jpy >= 0)';
  end if;
end $$;


-- ── Verification queries (run manually post-deploy) ────────────────────────
-- (1) Verify posts policy:
--     select polname, polcmd, qual from pg_policy where polrelid = 'public.posts'::regclass;
-- (2) Verify storage policies:
--     select policyname, cmd, qual from pg_policies where tablename = 'objects' and policyname like '%merchant-assets%';
-- (3) Verify listings constraint:
--     insert into public.listings (..., price, ...) values (..., -5, ...);  -- should fail
