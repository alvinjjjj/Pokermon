-- ============================================================
-- posts Storage bucket + RLS
-- ============================================================

-- 建立 posts bucket（公開讀取，最大 50MB，支援圖片 + 影片）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  true,
  52428800,  -- 50 MB
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/mov', 'video/avi', 'video/webm'
  ]
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 公開讀取（任何人都可以看帖子媒體）
create policy "posts bucket public read"
  on storage.objects for select
  using (bucket_id = 'posts');

-- 只有登入用戶可以上傳，且只能寫入自己的路徑（user_id/filename）
create policy "posts bucket owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'posts'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 只有本人可以更新/刪除自己上傳的檔案
create policy "posts bucket owner update"
  on storage.objects for update
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "posts bucket owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
