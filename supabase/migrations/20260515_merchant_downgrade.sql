-- ────────────────────────────────────────────────────────────────────────────
-- Merchant downgrade — 2026-05-15
--
-- Two RPCs:
--   1. self_downgrade_merchant()                — merchant downgrades themselves
--   2. admin_demote_merchant(p_user_id uuid)    — super_admin removes someone
--
-- Both flip:
--   merchant_profiles.seller_type → 'individual_seller'
--   merchant_profiles.status      → 'individual'  (not 'rejected' — they
--                                                  chose this voluntarily)
--   user_roles.role               → 'individual_seller'
--
-- Why a status of 'individual' (new) instead of clearing the row:
--   • Preserves the user's existing shop banner / logo / store name in case
--     they re-apply later.
--   • Listings stay live (seller_type column on listings is independent).
-- ────────────────────────────────────────────────────────────────────────────

-- 0. Allow merchant_profiles.status to include 'individual' (downgraded state).
alter table public.merchant_profiles
  drop constraint if exists merchant_profiles_status_check;
alter table public.merchant_profiles
  add constraint merchant_profiles_status_check
  check (status in ('pending', 'active', 'rejected', 'individual'));


-- ── 1. Self-downgrade ────────────────────────────────────────
-- A signed-in certified_merchant can call this to drop their own status.
-- No admin check — `auth.uid()` IS the user being downgraded.
create or replace function public.self_downgrade_merchant()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_current_role text;
begin
  if v_uid is null then
    raise exception 'forbidden: not signed in' using errcode = '42501';
  end if;

  -- Sanity: only certified_merchant can self-downgrade. Anyone else has
  -- nothing to drop. (Super_admin path goes through admin_demote_merchant.)
  select role into v_current_role
    from public.user_roles
    where user_id = v_uid;

  if v_current_role is null or v_current_role <> 'certified_merchant' then
    raise exception 'not a certified merchant' using errcode = '42501';
  end if;

  -- Flip merchant_profiles. May not exist (defensive) — skip if so.
  update public.merchant_profiles
    set status = 'individual',
        seller_type = 'individual_seller'
    where user_id = v_uid;

  -- Drop the role.
  update public.user_roles
    set role = 'individual_seller', status = 'active'
    where user_id = v_uid;
end;
$$;

revoke all on function public.self_downgrade_merchant() from public;
grant execute on function public.self_downgrade_merchant() to authenticated;


-- ── 2. Admin demote (only super_admin can call) ──────────────
-- Regular admins can approve / reject applications but cannot strip an
-- active certified_merchant. That power is super_admin-only — matches the
-- existing super_admin pattern from 20260514_super_admin.sql.
create or replace function public.admin_demote_merchant(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
begin
  if auth.uid() is null then
    raise exception 'forbidden: not signed in' using errcode = '42501';
  end if;

  -- Only super_admin can demote. Regular admins denied.
  select role into v_caller_role
    from public.user_roles
    where user_id = auth.uid();

  if v_caller_role is null or v_caller_role <> 'super_admin' then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- Can't demote yourself (defensive — a super_admin should always have
  -- the role, but they may not be a certified_merchant themselves anyway).
  if p_user_id = auth.uid() then
    raise exception 'cannot demote yourself' using errcode = '42501';
  end if;

  update public.merchant_profiles
    set status = 'individual',
        seller_type = 'individual_seller'
    where user_id = p_user_id;

  update public.user_roles
    set role = 'individual_seller', status = 'active'
    where user_id = p_user_id
      and role = 'certified_merchant';   -- never touch admins / super_admins
end;
$$;

revoke all on function public.admin_demote_merchant(uuid) from public;
grant execute on function public.admin_demote_merchant(uuid) to authenticated;


-- ── 3. Helper for admin panel — list certified merchants ─────
-- Used by admin.tsx to render the merchant list with a "remove" button.
drop function if exists public.admin_list_certified_merchants();

create function public.admin_list_certified_merchants()
returns table(
  user_id      uuid,
  merchant_id  uuid,
  shop_name    text,
  username     text,
  avatar_url   text,
  district     text,
  approved_at  timestamptz
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

  return query
    select m.user_id,
           m.id           as merchant_id,
           coalesce(m.shop_name_zh, m.shop_name_en, p.username, 'Merchant') as shop_name,
           p.username,
           p.avatar_url,
           m.district,
           m.updated_at   as approved_at
      from public.merchant_profiles m
      left join public.profiles p on p.id = m.user_id
      where m.status = 'active' and m.seller_type = 'certified_merchant'
      order by m.updated_at desc;
end;
$$;

revoke all on function public.admin_list_certified_merchants() from public;
grant execute on function public.admin_list_certified_merchants() to authenticated;


-- ── Verification (run after deploy) ──────────────────────────
-- (1) Check constraint accepts 'individual':
--     insert into merchant_profiles (user_id, seller_type, status, ...) values (..., 'individual_seller', 'individual', ...);
-- (2) Self-downgrade:
--     select self_downgrade_merchant();   -- as the merchant user
-- (3) Admin demote:
--     select admin_demote_merchant('<user_id>');   -- as super_admin
