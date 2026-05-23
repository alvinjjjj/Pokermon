-- ─────────────────────────────────────────────────────────────
-- Admin role + RPCs — 2026-05-14  (PATCHED for SQL Editor)
--
-- NOTE: The original constraint ALTER (drop + re-add user_roles_role_check)
-- has been COMMENTED OUT below because `20260514_super_admin.sql` was
-- already run, which widened the constraint to include both 'admin' and
-- 'super_admin'. Re-running the original ALTER would NARROW it again and
-- fail due to existing super_admin rows.
--
-- Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Extend user_roles.role check to include 'admin' ──────
-- SKIPPED: constraint already widened by 20260514_super_admin.sql
-- alter table public.user_roles
--   drop constraint if exists user_roles_role_check;
--
-- alter table public.user_roles
--   add constraint user_roles_role_check
--   check (role in ('viewer', 'individual_seller', 'certified_merchant', 'admin'));


-- ── 2. is_admin() helper ────────────────────────────────────
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

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;


-- ── 3. Approve a merchant application ───────────────────────
create or replace function public.admin_approve_merchant(p_merchant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_user_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;

  select user_id into v_user_id
    from public.merchant_profiles
    where id = p_merchant_id;
  if v_user_id is null then
    raise exception 'merchant_profile not found: %', p_merchant_id using errcode = 'P0002';
  end if;

  update public.merchant_profiles
    set status = 'active', seller_type = 'certified_merchant'
    where id = p_merchant_id;

  insert into public.user_roles (user_id, role, status)
    values (v_user_id, 'certified_merchant', 'active')
    on conflict (user_id) do update
      set role = 'certified_merchant', status = 'active';
end;
$$;

revoke all on function public.admin_approve_merchant(uuid) from public;
grant execute on function public.admin_approve_merchant(uuid) to authenticated;


-- ── 4. Reject a merchant application ────────────────────────
create or replace function public.admin_reject_merchant(p_merchant_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id   uuid;
  v_user_role text;
  v_has_reason_col boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;

  select mp.user_id, r.role
    into v_user_id, v_user_role
    from public.merchant_profiles mp
    left join public.user_roles r on r.user_id = mp.user_id
    where mp.id = p_merchant_id;

  if v_user_id is null then
    raise exception 'merchant_profile not found: %', p_merchant_id using errcode = 'P0002';
  end if;

  v_has_reason_col := exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'merchant_profiles'
      and column_name  = 'rejection_reason'
  );

  if v_user_role = 'individual_seller' then
    if v_has_reason_col then
      update public.merchant_profiles
        set status           = 'active',
            seller_type      = 'individual_seller',
            rejection_reason = p_reason
        where id = p_merchant_id;
    else
      update public.merchant_profiles
        set status           = 'active',
            seller_type      = 'individual_seller'
        where id = p_merchant_id;
    end if;
  else
    if v_has_reason_col then
      update public.merchant_profiles
        set status = 'rejected', rejection_reason = p_reason
        where id = p_merchant_id;
    else
      update public.merchant_profiles
        set status = 'rejected'
        where id = p_merchant_id;
    end if;
  end if;
end;
$$;

revoke all on function public.admin_reject_merchant(uuid, text) from public;
grant execute on function public.admin_reject_merchant(uuid, text) to authenticated;


-- ── 5. Grant admin role to a user ───────────────────────────
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

revoke all on function public.admin_grant_admin(uuid) from public;
grant execute on function public.admin_grant_admin(uuid) to authenticated;


-- ── 6. Revoke admin role from a user ────────────────────────
create or replace function public.admin_revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot revoke your own admin role' using errcode = '42501';
  end if;

  update public.user_roles
    set role = 'viewer'
    where user_id = p_user_id and role = 'admin';
end;
$$;

revoke all on function public.admin_revoke_admin(uuid) from public;
grant execute on function public.admin_revoke_admin(uuid) to authenticated;


-- ── 7. Find a user by email ─────────────────────────────────
drop function if exists public.admin_find_user_by_email(text);
create or replace function public.admin_find_user_by_email(p_email text)
returns table(user_id uuid, username text, role_name text)
language plpgsql
security definer
stable
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;

  return query
    select u.id           as user_id,
           p.username     as username,
           coalesce(r.role, 'viewer') as role_name
      from auth.users u
      left join public.profiles   p on p.id      = u.id
      left join public.user_roles r on r.user_id = u.id
      where lower(u.email) = lower(p_email)
      limit 1;
end;
$$;

revoke all on function public.admin_find_user_by_email(text) from public;
grant execute on function public.admin_find_user_by_email(text) to authenticated;


-- ── 8a. List merchant applications by status ────────────────
drop function if exists public.admin_list_merchant_applications(text);
create or replace function public.admin_list_merchant_applications(p_status text)
returns table(
  id                  uuid,
  user_id             uuid,
  username            text,
  avatar_url          text,
  display_name        text,
  shop_name_zh        text,
  shop_name_en        text,
  district            text,
  shop_description    text,
  logo_url            text,
  banner_url          text,
  has_physical_store  boolean,
  address             text,
  business_hours      text,
  whatsapp            text,
  website             text,
  instagram           text,
  payment_methods     text[],
  br_number           text,
  br_document_url     text,
  status              text,
  created_at          timestamptz
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden: caller is not admin' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'active', 'rejected') then
    raise exception 'invalid status: %', p_status using errcode = '22023';
  end if;

  return query
    select mp.id, mp.user_id,
           p.username, p.avatar_url,
           mp.display_name, mp.shop_name_zh, mp.shop_name_en,
           mp.district, mp.shop_description,
           mp.logo_url, mp.banner_url,
           mp.has_physical_store, mp.address, mp.business_hours,
           mp.whatsapp, mp.website, mp.instagram,
           mp.payment_methods, mp.br_number, mp.br_document_url,
           mp.status, mp.created_at
      from public.merchant_profiles mp
      left join public.profiles p on p.id = mp.user_id
     where mp.status = p_status
     order by mp.created_at desc;
end;
$$;

revoke all on function public.admin_list_merchant_applications(text) from public;
grant execute on function public.admin_list_merchant_applications(text) to authenticated;


-- ── 8. List all admins ──────────────────────────────────────
drop function if exists public.admin_list_admins();
create or replace function public.admin_list_admins()
returns table(user_id uuid, username text, avatar_url text, granted_at timestamptz)
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
           r.created_at as granted_at
      from public.user_roles r
      left join public.profiles p on p.id = r.user_id
      where r.role in ('admin', 'super_admin')
      order by r.created_at asc;
end;
$$;

revoke all on function public.admin_list_admins() from public;
grant execute on function public.admin_list_admins() to authenticated;
