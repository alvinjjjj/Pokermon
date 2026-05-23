-- ============================================================
-- 擴充 notifications.type — 加入審核結果通知
-- ============================================================

-- 1. 先刪除舊 check constraint
alter table public.notifications
  drop constraint if exists notifications_type_check;

-- 2. 加入新 check constraint（包含審核結果）
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'moderation_approved', 'moderation_rejected'));

-- 3. 當帖子 moderation_status 改變時，通知帖子作者
create or replace function public.notify_on_moderation()
returns trigger language plpgsql security definer as $$
begin
  -- 只在狀態真的改變時觸發
  if old.moderation_status = new.moderation_status then
    return new;
  end if;

  if new.moderation_status = 'approved' then
    insert into public.notifications(user_id, actor_id, type, post_id)
    values (new.user_id, null, 'moderation_approved', new.id);

  elsif new.moderation_status = 'rejected' then
    insert into public.notifications(user_id, actor_id, type, post_id)
    values (new.user_id, null, 'moderation_rejected', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_moderation on public.posts;
create trigger trg_notify_moderation
  after update of moderation_status on public.posts
  for each row execute function public.notify_on_moderation();
