-- Migration: close the security gaps found in the live database (tasks/schema-drift.md, section 2)
--
-- 1. notified had no access rules (RLS off), so anyone with the public key could
--    read and change it. No code uses it; the admin key skips RLS anyway.
-- 2. site_configs could be changed by any signed-in user ("write site_configs"),
--    e.g. switching a marketplace off for everyone. The app only reads it, with the
--    admin key. Also drops the duplicate read rule.
-- 3. profiles were readable by anyone, even signed out ("profiles select": true).
--    Now you read only your own. Other people's display names are read with the
--    admin key (the members list), so that keeps working.
-- 4. Two functions had no fixed search path (Supabase warning: a function's table
--    lookups could be redirected). Pinned to public.
--
-- Not covered here: leaked-password protection is a Supabase Auth setting
-- (Dashboard → Authentication → Policies / Passwords).

-- 1. notified: service role only
alter table public.notified enable row level security;

-- 2. site_configs: read-only for signed-in users
drop policy if exists "write site_configs" on public.site_configs;
drop policy if exists "read site_configs" on public.site_configs;
drop policy if exists site_configs_read on public.site_configs;
create policy site_configs_read on public.site_configs
  for select to authenticated
  using (true);

-- 3. profiles: your own only
drop policy if exists "profiles select" on public.profiles;
create policy "profiles select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- 4. fixed search path
alter function public.listings_track_price() set search_path = public;
alter function public.new_listings_count(uuid) set search_path = public;

-- To undo:
--   alter table public.notified disable row level security;
--   drop policy site_configs_read on public.site_configs;
--   create policy "read site_configs" on public.site_configs for select using (auth.role() = 'authenticated');
--   create policy "write site_configs" on public.site_configs for update using (auth.role() = 'authenticated');
--   drop policy "profiles select" on public.profiles;
--   create policy "profiles select" on public.profiles for select using (true);
--   alter function public.listings_track_price() reset search_path;
--   alter function public.new_listings_count(uuid) reset search_path;
