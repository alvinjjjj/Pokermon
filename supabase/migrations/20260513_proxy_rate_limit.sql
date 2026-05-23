-- ─────────────────────────────────────────────────────────────
-- Proxy rate limiting — 2026-05-13
--
-- Per-user, per-hour, per-proxy call counter. Used by Edge
-- Functions (ppt-proxy, pc-proxy) to block a single account
-- from draining upstream API credits.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.proxy_usage (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  bucket     timestamptz not null,  -- truncated to the hour
  proxy_name text        not null,  -- 'ppt' | 'pc'
  count      int         not null default 0,
  primary key (user_id, bucket, proxy_name)
);

create index if not exists proxy_usage_bucket_idx
  on public.proxy_usage (bucket);

alter table public.proxy_usage enable row level security;

-- Only the row owner can read their own counters (for debug / admin UI).
drop policy if exists "proxy_usage_owner_select" on public.proxy_usage;
create policy "proxy_usage_owner_select"
  on public.proxy_usage
  for select
  to authenticated
  using (auth.uid() = user_id);

-- All writes go through the SECURITY DEFINER RPC below — no direct INSERT/UPDATE
-- policy is created on purpose, so clients cannot forge their own counter rows.

-- ─────────────────────────────────────────────────────────────
-- Atomic increment + limit check.
--
-- Returns the new count after incrementing. The Edge Function calls this
-- and compares against its per-proxy limit. Because this function is
-- SECURITY DEFINER, it bypasses RLS (intended) and can write counter rows
-- the caller couldn't write directly.
-- ─────────────────────────────────────────────────────────────

create or replace function public.bump_proxy_usage(
  p_user_id    uuid,
  p_proxy_name text
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz := date_trunc('hour', now());
  v_count  int;
begin
  insert into public.proxy_usage (user_id, bucket, proxy_name, count)
  values (p_user_id, v_bucket, p_proxy_name, 1)
  on conflict (user_id, bucket, proxy_name)
  do update set count = public.proxy_usage.count + 1
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.bump_proxy_usage(uuid, text) from public;
grant execute on function public.bump_proxy_usage(uuid, text) to authenticated, service_role;
