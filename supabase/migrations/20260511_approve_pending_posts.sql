-- ============================================================
-- 把所有 pending 帖子設為 approved
-- 修復：moderation_status column 存在但帖子卡在 pending 狀態
-- ============================================================

-- 確保 column 存在（如果還沒跑過 content_moderation migration）
alter table public.posts
  add column if not exists moderation_status text
    not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected'));

-- 把所有 pending 帖子批准（包括之前測試時發的帖子）
update public.posts
  set moderation_status = 'approved'
  where moderation_status = 'pending';

-- 以後新帖子預設直接 approved（不需等 AI 審核才顯示）
alter table public.posts
  alter column moderation_status set default 'approved';
