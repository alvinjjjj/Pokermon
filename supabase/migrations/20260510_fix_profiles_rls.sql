-- ============================================================
-- Fix profiles table RLS — ensure users can update their own row
-- ============================================================

-- Enable RLS (idempotent)
alter table public.profiles enable row level security;

-- Drop any existing conflicting policies
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Enable read access for all users" on public.profiles;
drop policy if exists "Enable insert for authenticated users only" on public.profiles;
drop policy if exists "Enable update for users based on id" on public.profiles;

-- SELECT: everyone can read all profiles
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- INSERT: user can only create their own profile row
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- UPDATE: user can only update their own profile row
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- DELETE: user can only delete their own profile row
create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);
