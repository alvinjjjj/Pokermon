-- 升級 avatars bucket 上限至 5MB，加入 MIME type 限制
update storage.buckets
set
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
where id = 'avatars';
