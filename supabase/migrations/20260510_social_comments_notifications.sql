-- ============================================================
-- 社交功能擴充：post_comments + notifications
-- ============================================================

-- ── 1. post_comments ─────────────────────────────────────────
create table if not exists public.post_comments (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.posts(id)       on delete cascade,
  user_id    uuid        not null references auth.users(id)         on delete cascade,
  content    text        not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx
  on public.post_comments(post_id, created_at);
create index if not exists post_comments_user_idx
  on public.post_comments(user_id);

alter table public.post_comments enable row level security;
create policy "comments read"        on public.post_comments for select using (true);
create policy "comments owner write" on public.post_comments for insert with check (auth.uid() = user_id);
create policy "comments owner delete" on public.post_comments for delete using (auth.uid() = user_id);

-- ── 2. notifications ─────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,  -- recipient
  actor_id    uuid        references auth.users(id) on delete set null,          -- who triggered it
  type        text        not null check (type in ('like', 'comment', 'follow')),
  post_id     uuid        references public.posts(id) on delete cascade,
  comment_id  uuid        references public.post_comments(id) on delete cascade,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id, read) where read = false;

alter table public.notifications enable row level security;
create policy "notifications read own"   on public.notifications for select using (auth.uid() = user_id);
create policy "notifications update own" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications insert"     on public.notifications for insert with check (true);

-- ── 3. 自動同步 comments_count ───────────────────────────────

create or replace function public.sync_comments_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comments_count on public.post_comments;
create trigger trg_comments_count
  after insert or delete on public.post_comments
  for each row execute function public.sync_comments_count();

-- ── 4. 自動建立通知（like / comment / follow）────────────────

-- 讚好通知
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;
  -- 不通知自己
  if v_post_owner is distinct from new.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id)
    values (v_post_owner, new.user_id, 'like', new.post_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_like on public.post_likes;
create trigger trg_notify_like
  after insert on public.post_likes
  for each row execute function public.notify_on_like();

-- 留言通知
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;
  if v_post_owner is distinct from new.user_id then
    insert into public.notifications(user_id, actor_id, type, post_id, comment_id)
    values (v_post_owner, new.user_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment on public.post_comments;
create trigger trg_notify_comment
  after insert on public.post_comments
  for each row execute function public.notify_on_comment();

-- 關注通知
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications(user_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_notify_follow on public.follows;
create trigger trg_notify_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();
