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
  weekly_email boolean not null default true,
  alerts_enabled boolean not null default true,
  last_digest_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Items (watchlist entries) ───────────────────────────────────────────────

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text, -- unused since phase 5: brands are merged into name (20261022_merge_brand.sql)
  min_price integer,
  max_price integer,
  notify boolean not null default true,
  exclude_words text[] not null default '{}',
  target_price integer check (target_price is null or target_price >= 0),
  category text,
  filters jsonb not null default '{}',
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
  price_kind text check (price_kind in ('fixed', 'bid', 'start')),
  bid_count integer,
  match text not null default 'match' check (match in ('match', 'possible')),
  removed_at timestamptz,
  removed_word text,
  previous_price integer,
  attributes jsonb not null default '{}',
  found_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists listings_item_id_idx on listings(item_id);
create index if not exists listings_found_at_idx on listings(found_at);
create index if not exists listings_last_seen_at_idx on listings(last_seen_at);
-- Required by upsert(..., { onConflict: 'item_id,url' }) in the scrape paths
create unique index if not exists listings_item_id_url_key on listings(item_id, url);

-- Keeps listings.previous_price for price-drop alerts
create or replace function listings_track_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.price is distinct from old.price and old.price is not null then
    new.previous_price := old.price;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_track_price on listings;
create trigger listings_track_price
  before update of price on listings
  for each row execute function listings_track_price();

-- Personal favourites and removals for people who don't own the item (followers,
-- shared-list members). The owner uses listings.starred / removed_at instead.
create table if not exists listing_marks (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  starred boolean not null default false,
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists listing_marks_listing_id_idx on listing_marks(listing_id);

-- Alert emails sent, so the same alert isn't sent twice
create table if not exists alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  kind text not null check (kind in ('target_price', 'price_drop', 'auction_ending', 'rare_find')),
  price integer,
  sent_at timestamptz not null default now()
);

create index if not exists alert_log_listing_kind_idx on alert_log(listing_id, kind);

create table if not exists notified (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  notified_at timestamptz not null default now()
);

-- ── Lists ──────────────────────────────────────────────────────────────────

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'zinc',
  visibility text not null default 'private'
    check (visibility in ('private', 'public', 'collaborative')),
  created_at timestamptz not null default now()
);

create table if not exists item_lists (
  item_id uuid not null references items(id) on delete cascade,
  list_id uuid not null references lists(id) on delete cascade,
  primary key (item_id, list_id)
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
  created_at timestamptz not null default now(),
  -- Expiry and use limit (20261109_invite_expiry.sql): 1 use for email invites, 25 for links
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses integer not null default 1,
  use_count integer not null default 0,
  constraint list_invites_max_uses_check check (max_uses between 1 and 100),
  constraint list_invites_use_count_check check (use_count >= 0 and use_count <= max_uses)
);

-- New invites are valid for at most 30 days (capped on creation)
create or replace function list_invites_cap_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.expires_at := least(new.expires_at, now() + interval '30 days');
  return new;
end;
$$;

drop trigger if exists list_invites_cap_expiry on list_invites;
create trigger list_invites_cap_expiry
  before insert on list_invites
  for each row execute function list_invites_cap_expiry();

-- Uses an invite in one step (checks expiry and uses, counts the use). Admin key only.
create or replace function redeem_list_invite(p_token text)
returns table (list_id uuid, role text)
language sql
volatile
set search_path = public
as $$
  update list_invites
     set use_count = use_count + 1
   where token = p_token
     and expires_at > now()
     and use_count < max_uses
  returning list_invites.list_id, list_invites.role
$$;
revoke all on function redeem_list_invite(text) from public, anon, authenticated;
grant execute on function redeem_list_invite(text) to service_role;

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
  unreliable boolean not null default false,
  kind text not null default 'marketplace' check (kind in ('marketplace', 'auction'))
);

create table if not exists user_site_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  site_config_id uuid not null references site_configs(id) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, site_config_id)
);

insert into site_configs (site_name, enabled, base_url, unreliable, kind) values
  ('Blocket', true, 'https://www.blocket.se', false, 'marketplace'),
  ('Tradera', true, 'https://www.tradera.com', false, 'marketplace'),
  ('Sellpy', true, 'https://www.sellpy.se', false, 'marketplace'),
  ('Vinted', true, 'https://www.vinted.se', false, 'marketplace'),
  ('Facebook Marketplace', false, 'https://www.facebook.com/marketplace', true, 'marketplace'),
  ('Auctionet', true, 'https://auctionet.com', false, 'auction'),
  ('Bukowskis', true, 'https://www.bukowskis.com', false, 'auction')
on conflict (site_name) do nothing;

-- ── RPC: new listings since last view, per item ─────────────────────────────

create or replace function new_listings_count(p_user_id uuid)
returns table (item_id uuid, new_count bigint)
language sql
stable
set search_path = public
as $$
  select i.id as item_id, count(l.id) as new_count
  from items i
  join listings l on l.item_id = i.id
  where i.user_id = p_user_id
    and (i.last_viewed_at is null or l.found_at > i.last_viewed_at)
    and l.removed_at is null
    and l.match = 'match'
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
alter table alert_log enable row level security;
alter table lists enable row level security;
alter table item_lists enable row level security;
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

-- Listing marks: your own only, on listings you can see
alter table listing_marks enable row level security;
drop policy if exists listing_marks_own on listing_marks;
create policy listing_marks_own on listing_marks
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from listings l where l.id = listing_marks.listing_id)
  );

-- Notified and alert_log: service-role only (no user policies)

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

-- item_lists: the item owner reads and removes links, and adds links only to lists
-- they may edit: their own, or a collaborative list where they're an owner, admin
-- or editor member (20261109_item_lists_check.sql)
drop policy if exists "item_lists own read" on item_lists;
create policy "item_lists own read" on item_lists
  for select to authenticated
  using (exists (select 1 from items i where i.id = item_lists.item_id and i.user_id = (select auth.uid())));

drop policy if exists "item_lists own remove" on item_lists;
create policy "item_lists own remove" on item_lists
  for delete to authenticated
  using (exists (select 1 from items i where i.id = item_lists.item_id and i.user_id = (select auth.uid())));

drop policy if exists "item_lists add to editable list" on item_lists;
create policy "item_lists add to editable list" on item_lists
  for insert to authenticated
  with check (
    exists (select 1 from items i where i.id = item_lists.item_id and i.user_id = (select auth.uid()))
    and (
      exists (select 1 from lists l where l.id = item_lists.list_id and l.user_id = (select auth.uid()))
      or exists (
        select 1 from list_members m
        join lists l on l.id = m.list_id
        where m.list_id = item_lists.list_id
          and m.user_id = (select auth.uid())
          and m.role in ('owner', 'admin', 'editor')
          and l.visibility = 'collaborative'
      )
    )
  );

drop policy if exists item_lists_member_read on item_lists;
create policy item_lists_member_read on item_lists
  for select using (
    exists (select 1 from list_members m where m.list_id = item_lists.list_id and m.user_id = auth.uid())
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

-- ── Rate limits (20261110_rate_limits.sql) ───────────────────────────────────
-- Fixed-window counters for invite emails and searches. Admin key only.

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create index if not exists rate_limits_window_start_idx on rate_limits(window_start);
alter table rate_limits enable row level security;

create or replace function hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
volatile
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_window_seconds < 1 or p_max < 1 then
    raise exception 'hit_rate_limit: window and max must be at least 1';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_max;
end;
$$;

revoke all on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, integer, integer) to service_role;

-- ── Input limits (20261110_input_limits.sql) ─────────────────────────────────
-- Same limits as lib/validate, for writes that go straight to the database.
alter table items drop constraint if exists items_name_length;
alter table items add constraint items_name_length check (char_length(btrim(name)) between 1 and 120);
alter table items drop constraint if exists items_price_range;
alter table items add constraint items_price_range check (
  (min_price is null or min_price between 0 and 10000000)
  and (max_price is null or max_price between 0 and 10000000)
  and (target_price is null or target_price between 0 and 10000000)
);
alter table lists drop constraint if exists lists_name_length;
alter table lists add constraint lists_name_length check (char_length(btrim(name)) between 1 and 60);
alter table lists drop constraint if exists lists_color_known;
alter table lists add constraint lists_color_known
  check (color in ('zinc', 'blue', 'green', 'amber', 'red', 'purple', 'orange', 'teal', 'pink', 'indigo'));
