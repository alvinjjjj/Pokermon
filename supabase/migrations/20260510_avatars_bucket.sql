-- ============================================================
-- HKCARDCOLL — Avatars Storage Bucket
-- 建立日期：2026-05-10
-- ============================================================

-- ─── 1. avatars bucket ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,   -- 5MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ─── 2. RLS Policies ─────────────────────────────────────────

-- 公開可讀（頭像需要公開顯示）
create policy "avatars 公開可讀"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- 已登入用戶可上傳（檔名含自己 user_id）
create policy "avatars 用戶可上傳"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 用戶可更新自己的頭像
create policy "avatars 用戶可更新"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 用戶可刪除自己的頭像
create policy "avatars 用戶可刪除"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
