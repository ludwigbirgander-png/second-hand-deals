-- Migration: per-user site preferences + listings dedup index
-- Run this in the Supabase SQL editor BEFORE deploying the code that
-- introduces per-user site settings (app/api/profile/sites, lib/sites.ts).

-- 1. Per-user site preferences. site_configs.enabled remains the global
--    default / admin kill-switch; rows here override it per user.
create table if not exists user_site_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_config_id uuid not null references site_configs(id) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, site_config_id)
);

alter table user_site_prefs enable row level security;

drop policy if exists user_site_prefs_own on user_site_prefs;
create policy user_site_prefs_own on user_site_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Make site_configs read-only for normal users (previously any
--    authenticated user could toggle sites globally).
alter table site_configs enable row level security;

drop policy if exists site_configs_read on site_configs;
create policy site_configs_read on site_configs
  for select using (auth.role() = 'authenticated');

-- 3. Unique index required by upsert(..., onConflict: 'item_id,url').
--    Likely already exists in production — harmless if so.
create unique index if not exists listings_item_id_url_key on listings(item_id, url);
