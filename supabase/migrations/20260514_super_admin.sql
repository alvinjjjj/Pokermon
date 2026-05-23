-- ─────────────────────────────────────────────────────────────
-- Super Admin role — 2026-05-14
--
-- Adds a 'super_admin' role that:
--   • has every admin power (via is_admin() check)
--   • CANNOT be revoked by anyone (including other super_admins)
--   • CAN revoke regular admins
--
-- Use case: founder / owner account that must never be locked out.
-- ─────────────────────────────────────────────────────────────

-- 1. Extend user_roles.role check constraint
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('viewer', 'individual_seller', 'certified_merchant', 'admin', 'super_admin'));


-- 2. Update is_admin() to recognise both 'admin' and 'super_admin'
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role in ('admin', 'super_admin')
  );
$$;


-- 3. Update admin_revoke_admin() to protect super_admin from being revoked
create or replace function public.admin_revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_role text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot revoke your own admin role' using errcode = '42501';
  end if;

  -- Look up target's current role
  select role into v_target_role
    from public.user_roles
    where user_id = p_user_id;

  -- super_admin is untouchable — even other super_admins can't remove them.
  -- (If you really need to demote a super_admin, do it via direct service_role SQL.)
  if v_target_role = 'super_admin' then
    raise exception 'super admin cannot be revoked' using errcode = '42501';
  end if;

  update public.user_roles
    set role = 'viewer'
    where user_id = p_user_id and role = 'admin';
end;
$$;


-- 4. Update admin_grant_admin() so a regular admin can't accidentally
--    grant 'super_admin' through this function (it only sets role='admin').
--    Already the case in the current implementation — re-deploy for safety.
create or replace function public.admin_grant_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role, status)
    values (p_user_id, 'admin', 'active')
    on conflict (user_id) do update
      set role = 'admin', status = 'active';
end;
$$;


-- 4b. Update admin_list_admins() so super_admins also appear in the panel.
-- The return-type signature is changing (added `role` column), so DROP first —
-- Postgres won't let CREATE OR REPLACE change OUT params.
drop function if exists public.admin_list_admins();

create function public.admin_list_admins()
returns table(user_id uuid, username text, avatar_url text, granted_at timestamptz, role text)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;

  return query
    select r.user_id,
           p.username,
           p.avatar_url,
           r.created_at as granted_at,
           r.role
      from public.user_roles r
      left join public.profiles p on p.id = r.user_id
      where r.role in ('admin', 'super_admin')
      order by
        case when r.role = 'super_admin' then 0 else 1 end,  -- super first
        r.created_at asc;
end;
$$;

revoke all on function public.admin_list_admins() from public;
grant execute on function public.admin_list_admins() to authenticated;


-- 5. Crown the founder account as super_admin.
--    Run this manually in the Supabase SQL editor with your actual user UUID:
--
--      update public.user_roles
--         set role = 'super_admin', status = 'active'
--         where user_id = '<YOUR_USER_UUID>';
--
--    Do NOT commit real phone numbers or UUIDs to version control.

-- ─────────────────────────────────────────────────────────────
-- Verification — should list at least one super_admin
-- ─────────────────────────────────────────────────────────────
-- After running this migration, run:
--
--   select u.phone, u.email, r.role, r.status
--   from auth.users u join public.user_roles r on r.user_id = u.id
--   where r.role in ('admin', 'super_admin')
--   order by r.role desc;
--
-- ─────────────────────────────────────────────────────────────
