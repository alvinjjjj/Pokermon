-- ============================================================
-- 內容審核系統
-- ============================================================

-- ── 1. posts 加入 moderation_status ──────────────────────────
alter table public.posts
  add column if not exists moderation_status text
    not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected'));

create index if not exists posts_moderation_idx
  on public.posts(moderation_status, created_at desc);

-- ── 2. profiles 加入 tos_agreed_at ───────────────────────────
alter table public.profiles
  add column if not exists tos_agreed_at timestamptz;

-- ── 3. post_reports 表 ───────────────────────────────────────
create table if not exists public.post_reports (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references public.posts(id) on delete cascade,
  reporter_id uuid        not null references auth.users(id)   on delete cascade,
  reason      text        not null check (reason in (
                            'adult_content',
                            'violence',
                            'spam',
                            'misinformation',
                            'other'
                          )),
  note        text,
  status      text        not null default 'pending'
                            check (status in ('pending', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (post_id, reporter_id)   -- 每人每帖只能舉報一次
);

create index if not exists post_reports_post_idx
  on public.post_reports(post_id);
create index if not exists post_reports_status_idx
  on public.post_reports(status, created_at desc);

alter table public.post_reports enable row level security;

-- 任何登入用戶可以提交舉報
create policy "reports insert"
  on public.post_reports for insert
  with check (auth.uid() = reporter_id);

-- 只有舉報者可以看自己的舉報
create policy "reports read own"
  on public.post_reports for select
  using (auth.uid() = reporter_id);

-- ── 4. 自動隱藏：超過 3 個待審舉報的帖子自動轉為 pending ─────
create or replace function public.auto_flag_reported_post()
returns trigger language plpgsql security definer as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.post_reports
  where post_id = new.post_id and status = 'pending';

  -- 達到 3 個舉報，自動重置為 pending 讓 AI 重新審核
  if v_count >= 3 then
    update public.posts
    set moderation_status = 'pending'
    where id = new.post_id
    and moderation_status = 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_flag_post on public.post_reports;
create trigger trg_auto_flag_post
  after insert on public.post_reports
  for each row execute function public.auto_flag_reported_post();

-- ── 5. 現有帖子全部設為 approved（migration 前的舊帖） ────────
update public.posts
  set moderation_status = 'approved'
  where moderation_status = 'pending';
