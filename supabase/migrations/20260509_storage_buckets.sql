-- ============================================================
-- HKCARDCOLL — Storage Buckets
-- 建立日期：2026-05-09
-- 包含：merchant-assets bucket, listing-photos bucket
--       + Storage RLS policies
-- ============================================================

-- ─── 1. merchant-assets bucket ───────────────────────────────
-- 用於：商家 Logo、Banner、頭像、BR 文件
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'merchant-assets',
  'merchant-assets',
  true,
  5242880,   -- 5MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ─── 2. listing-photos bucket ────────────────────────────────
-- 用於：商品實物照片（最多 4 張）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  8388608,   -- 8MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ─── 3. merchant-assets RLS policies ─────────────────────────

-- 公開可讀（Logo、Banner 等需要公開顯示）
create policy "merchant-assets 公開可讀"
  on storage.objects for select
  using (bucket_id = 'merchant-assets');

-- 已登入用戶可上傳自己的資料夾
create policy "merchant-assets 用戶可上傳"
  on storage.objects for insert
  with check (
    bucket_id = 'merchant-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in ('avatars', 'logos', 'banners', 'br')
  );

-- 用戶只能更新自己的檔案（檔名包含 user_id）
create policy "merchant-assets 用戶可更新自己的檔案"
  on storage.objects for update
  using (
    bucket_id = 'merchant-assets'
    and auth.role() = 'authenticated'
    and (storage.filename(name) like auth.uid()::text || '%'
         or (storage.foldername(name))[1] = 'avatars')
  );

-- 用戶可刪除自己的檔案
create policy "merchant-assets 用戶可刪除自己的檔案"
  on storage.objects for delete
  using (
    bucket_id = 'merchant-assets'
    and auth.role() = 'authenticated'
  );

-- service role 全權限
create policy "merchant-assets service role 全權限"
  on storage.objects for all
  using (
    bucket_id = 'merchant-assets'
    and auth.role() = 'service_role'
  );

-- ─── 4. listing-photos RLS policies ──────────────────────────

-- 公開可讀（商品圖片需要公開顯示）
create policy "listing-photos 公開可讀"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

-- 已登入用戶可上傳到自己的子資料夾 listings/{user_id}/
create policy "listing-photos 用戶可上傳"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = 'listings'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 用戶可更新自己的照片
create policy "listing-photos 用戶可更新自己的照片"
  on storage.objects for update
  using (
    bucket_id = 'listing-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 用戶可刪除自己的照片
create policy "listing-photos 用戶可刪除自己的照片"
  on storage.objects for delete
  using (
    bucket_id = 'listing-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- service role 全權限
create policy "listing-photos service role 全權限"
  on storage.objects for all
  using (
    bucket_id = 'listing-photos'
    and auth.role() = 'service_role'
  );
