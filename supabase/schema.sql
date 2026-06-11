-- ============================================================================
-- Kompi — full database schema
--
-- NOTE: Reconstructed 2026-06-11 from what the application code requires,
-- because the previous schema.sql was severely out of date. The live database
-- predates this file. Verify against production with:
--   supabase db dump --schema public > supabase/schema.sql
-- and reconcile any differences (especially RLS policies).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Profiles ────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- ── Items (watchlist entries) ───────────────────────────────────────────────

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  min_price integer,
  max_price integer,
  notify boolean not null default true,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists items_user_id_idx on items(user_id);

-- ── Listings (scraped results) ──────────────────────────────────────────────

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  site text not null,
  title text not null,
  price integer,
  currency text not null default 'SEK',
  url text not null,
  image_url text,
  starred boolean not null default false,
  condition text,
  size text,
  shipping_cost integer,
  auction_ends_at timestamptz,
  location text,
  found_at timestamptz not null default now()
);

create index if not exists listings_item_id_idx on listings(item_id);
create index if not exists listings_found_at_idx on listings(found_at);
-- Required by upsert(..., { onConflict: 'item_id,url' }) in the scrape paths
create unique index if not exists listings_item_id_url_key on listings(item_id, url);

create table if not exists notified (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  notified_at timestamptz not null default now()
);

-- ── Lists & categories ──────────────────────────────────────────────────────

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'zinc',
  visibility text not null default 'private'
    check (visibility in ('private', 'public', 'collaborative')),
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'zinc',
  created_at timestamptz not null default now()
);

create table if not exists item_lists (
  item_id uuid not null references items(id) on delete cascade,
  list_id uuid not null references lists(id) on delete cascade,
  primary key (item_id, list_id)
);

create table if not exists item_categories (
  item_id uuid not null references items(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (item_id, category_id)
);

-- ── Sharing: members, invites, follows ──────────────────────────────────────

create table if not exists list_members (
  list_id uuid not null references lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists list_invites (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists list_follows (
  list_id uuid not null references lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  followed_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- ── Scrape sites ────────────────────────────────────────────────────────────

-- Global catalog of supported sites. `enabled` is the global default /
-- admin kill-switch; per-user preferences live in user_site_prefs.
create table if not exists site_configs (
  id uuid primary key default gen_random_uuid(),
  site_name text not null unique,
  enabled boolean not null default true,
  base_url text not null,
  unreliable boolean not null default false
);

create table if not exists user_site_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_config_id uuid not null references site_configs(id) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, site_config_id)
);

insert into site_configs (site_name, enabled, base_url, unreliable) values
  ('Blocket', true, 'https://www.blocket.se', false),
  ('Tradera', true, 'https://www.tradera.com', false),
  ('Sellpy', true, 'https://www.sellpy.se', false),
  ('Vinted', true, 'https://www.vinted.se', false),
  ('Facebook Marketplace', false, 'https://www.facebook.com/marketplace', true)
on conflict (site_name) do nothing;

-- ── RPC: new listings since last view, per item ─────────────────────────────

create or replace function new_listings_count(p_user_id uuid)
returns table (item_id uuid, new_count bigint)
language sql
stable
as $$
  select i.id as item_id, count(l.id) as new_count
  from items i
  join listings l on l.item_id = i.id
  where i.user_id = p_user_id
    and (i.last_viewed_at is null or l.found_at > i.last_viewed_at)
  group by i.id;
$$;

-- ============================================================================
-- Row Level Security
-- API routes now also enforce ownership explicitly; RLS is the backstop.
-- ============================================================================

alter table profiles enable row level security;
alter table items enable row level security;
alter table listings enable row level security;
alter table notified enable row level security;
alter table lists enable row level security;
alter table categories enable row level security;
alter table item_lists enable row level security;
alter table item_categories enable row level security;
alter table list_members enable row level security;
alter table list_invites enable row level security;
alter table list_follows enable row level security;
alter table site_configs enable row level security;
alter table user_site_prefs enable row level security;

-- Profiles: read own, write own
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Items: full access to own items; members/followers of a list containing the
-- item get read access
drop policy if exists items_own on items;
create policy items_own on items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists items_shared_read on items;
create policy items_shared_read on items
  for select using (
    exists (
      select 1 from item_lists il
      join lists l on l.id = il.list_id
      where il.item_id = items.id
        and (
          exists (select 1 from list_members m where m.list_id = l.id and m.user_id = auth.uid())
          or (l.visibility = 'public'
              and exists (select 1 from list_follows f where f.list_id = l.id and f.user_id = auth.uid()))
        )
    )
  );

-- Listings: full access via own parent item; read access follows item SELECT
drop policy if exists listings_via_item on listings;
create policy listings_via_item on listings
  for all using (
    exists (select 1 from items i where i.id = listings.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from items i where i.id = listings.item_id and i.user_id = auth.uid())
  );

drop policy if exists listings_shared_read on listings;
create policy listings_shared_read on listings
  for select using (
    -- delegates to the items SELECT policies (own + shared) via the subquery
    exists (select 1 from items i where i.id = listings.item_id)
  );

-- Notified: service-role only (no user policies)

-- Lists: owner full access; members read; public lists readable
drop policy if exists lists_own on lists;
create policy lists_own on lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists lists_member_read on lists;
create policy lists_member_read on lists
  for select using (
    visibility = 'public'
    or exists (select 1 from list_members m where m.list_id = lists.id and m.user_id = auth.uid())
  );

-- Categories: own only
drop policy if exists categories_own on categories;
create policy categories_own on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- item_lists: item owner manages; list members read
drop policy if exists item_lists_item_owner on item_lists;
create policy item_lists_item_owner on item_lists
  for all using (
    exists (select 1 from items i where i.id = item_lists.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from items i where i.id = item_lists.item_id and i.user_id = auth.uid())
  );

drop policy if exists item_lists_member_read on item_lists;
create policy item_lists_member_read on item_lists
  for select using (
    exists (select 1 from list_members m where m.list_id = item_lists.list_id and m.user_id = auth.uid())
  );

-- item_categories: item owner only
drop policy if exists item_categories_item_owner on item_categories;
create policy item_categories_item_owner on item_categories
  for all using (
    exists (select 1 from items i where i.id = item_categories.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from items i where i.id = item_categories.item_id and i.user_id = auth.uid())
  );

-- list_members: read own memberships; list owner manages members
drop policy if exists list_members_self_read on list_members;
create policy list_members_self_read on list_members
  for select using (user_id = auth.uid());

drop policy if exists list_members_owner_all on list_members;
create policy list_members_owner_all on list_members
  for all using (
    exists (select 1 from lists l where l.id = list_members.list_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from lists l where l.id = list_members.list_id and l.user_id = auth.uid())
  );

-- Members may remove themselves
drop policy if exists list_members_self_delete on list_members;
create policy list_members_self_delete on list_members
  for delete using (user_id = auth.uid());

-- list_invites: only list owner or admin members
drop policy if exists list_invites_manage on list_invites;
create policy list_invites_manage on list_invites
  for all using (
    exists (select 1 from lists l where l.id = list_invites.list_id and l.user_id = auth.uid())
    or exists (select 1 from list_members m
               where m.list_id = list_invites.list_id and m.user_id = auth.uid() and m.role = 'admin')
  ) with check (
    exists (select 1 from lists l where l.id = list_invites.list_id and l.user_id = auth.uid())
    or exists (select 1 from list_members m
               where m.list_id = list_invites.list_id and m.user_id = auth.uid() and m.role = 'admin')
  );

-- list_follows: manage own follows
drop policy if exists list_follows_own on list_follows;
create policy list_follows_own on list_follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- site_configs: read-only for authenticated users (writes via service role)
drop policy if exists site_configs_read on site_configs;
create policy site_configs_read on site_configs
  for select using (auth.role() = 'authenticated');

-- user_site_prefs: own prefs only
drop policy if exists user_site_prefs_own on user_site_prefs;
create policy user_site_prefs_own on user_site_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
