-- ============================================================================
-- Kompi: database schema, as it is in production
--
-- Generated 2026-11-09 from the live Supabase project "Second hand platform"
-- (rszkzmykwsfzdelreisb) by reading its catalog: tables, keys and checks,
-- foreign keys, indexes, functions, triggers and row-level-security rules.
-- It replaces the hand-written file from June, which had drifted from the
-- live database (see tasks/schema-drift.md).
--
-- This is a snapshot to read, not a script to run: the `add constraint` lines
-- fail on a database that already has them. To change the database, add a new
-- file in supabase/migrations/ and update this snapshot to match.
--
-- To regenerate: `supabase db dump --schema public` once the Supabase CLI is
-- linked, or the catalog query described in the PR that added this file.
--
-- Known leftovers, kept here because they exist live:
--   - categories / item_categories: no code uses them; 20261005_drop_categories.sql
--     was never run.
--   - listings has the same unique index twice (listings_item_url_unique and
--     listings_item_id_url_key).
-- ============================================================================

-- EXTENSIONS

create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- SCHEMAS

-- Helper functions for the access rules, not reachable through the API
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- TABLES

create table if not exists public.alert_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  listing_id uuid not null,
  kind text not null,
  price integer,
  sent_at timestamp with time zone default now() not null
);

create table if not exists public.categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  color text default 'zinc'::text not null,
  created_at timestamp with time zone default now(),
  user_id uuid not null
);

create table if not exists public.item_categories (
  item_id uuid not null,
  category_id uuid not null
);

create table if not exists public.item_lists (
  item_id uuid not null,
  list_id uuid not null
);

create table if not exists public.items (
  id uuid default gen_random_uuid() not null,
  name text not null,
  created_at timestamp with time zone default now() not null,
  brand text,
  min_price integer,
  max_price integer,
  user_id uuid not null,
  last_viewed_at timestamp with time zone,
  notify boolean default true not null,
  exclude_words text[] default '{}'::text[] not null,
  target_price integer,
  category text,
  filters jsonb default '{}'::jsonb not null
);

create table if not exists public.list_follows (
  id uuid default gen_random_uuid() not null,
  list_id uuid not null,
  user_id uuid not null,
  followed_at timestamp with time zone default now() not null
);

create table if not exists public.list_invites (
  id uuid default gen_random_uuid() not null,
  list_id uuid not null,
  token text default encode(gen_random_bytes(16), 'hex'::text) not null,
  role text default 'editor'::text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '14 days'::interval) not null,
  max_uses integer default 1 not null,
  use_count integer default 0 not null
);

create table if not exists public.list_members (
  id uuid default gen_random_uuid() not null,
  list_id uuid not null,
  user_id uuid not null,
  role text default 'editor'::text not null,
  joined_at timestamp with time zone default now() not null
);

create table if not exists public.listing_marks (
  user_id uuid not null,
  listing_id uuid not null,
  starred boolean default false not null,
  removed_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.listings (
  id uuid default gen_random_uuid() not null,
  item_id uuid not null,
  site text not null,
  title text not null,
  price integer,
  currency text default 'SEK'::text not null,
  url text not null,
  image_url text,
  found_at timestamp with time zone default now() not null,
  starred boolean default false not null,
  condition text,
  size text,
  shipping_cost integer,
  auction_ends_at timestamp with time zone,
  location text,
  last_seen_at timestamp with time zone default now() not null,
  price_kind text,
  bid_count integer,
  removed_at timestamp with time zone,
  removed_word text,
  match text default 'match'::text not null,
  previous_price integer,
  attributes jsonb default '{}'::jsonb not null
);

create table if not exists public.lists (
  id uuid default gen_random_uuid() not null,
  name text not null,
  color text default 'zinc'::text not null,
  created_at timestamp with time zone default now(),
  user_id uuid not null,
  visibility text default 'private'::text not null
);

create table if not exists public.notified (
  id uuid default gen_random_uuid() not null,
  listing_id uuid not null,
  notified_at timestamp with time zone default now() not null
);

create table if not exists public.profiles (
  id uuid not null,
  display_name text,
  created_at timestamp with time zone default now() not null,
  weekly_email boolean default true not null,
  alerts_enabled boolean default true not null,
  last_digest_at timestamp with time zone
);

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamp with time zone not null,
  count integer default 0 not null
);

create table if not exists public.site_configs (
  id uuid default gen_random_uuid() not null,
  site_name text not null,
  enabled boolean default true not null,
  base_url text not null,
  unreliable boolean default false not null,
  kind text default 'marketplace'::text not null
);

create table if not exists public.user_site_prefs (
  user_id uuid not null,
  site_config_id uuid not null,
  enabled boolean not null,
  updated_at timestamp with time zone default now() not null
);

-- KEYS, UNIQUE AND CHECK RULES

alter table public.alert_log add constraint alert_log_pkey PRIMARY KEY (id);
alter table public.alert_log add constraint alert_log_kind_check CHECK ((kind = ANY (ARRAY['target_price'::text, 'price_drop'::text, 'auction_ending'::text, 'rare_find'::text])));
alter table public.categories add constraint categories_pkey PRIMARY KEY (id);
alter table public.item_categories add constraint item_categories_pkey PRIMARY KEY (item_id, category_id);
alter table public.item_lists add constraint item_lists_pkey PRIMARY KEY (item_id, list_id);
alter table public.items add constraint items_pkey PRIMARY KEY (id);
alter table public.items add constraint items_name_length CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120)));
alter table public.items add constraint items_price_range CHECK ((((min_price IS NULL) OR ((min_price >= 0) AND (min_price <= 10000000))) AND ((max_price IS NULL) OR ((max_price >= 0) AND (max_price <= 10000000))) AND ((target_price IS NULL) OR ((target_price >= 0) AND (target_price <= 10000000)))));
alter table public.items add constraint items_target_price_check CHECK (((target_price IS NULL) OR (target_price >= 0)));
alter table public.list_follows add constraint list_follows_list_id_user_id_key UNIQUE (list_id, user_id);
alter table public.list_follows add constraint list_follows_pkey PRIMARY KEY (id);
alter table public.list_invites add constraint list_invites_token_key UNIQUE (token);
alter table public.list_invites add constraint list_invites_pkey PRIMARY KEY (id);
alter table public.list_invites add constraint list_invites_max_uses_check CHECK (((max_uses >= 1) AND (max_uses <= 100)));
alter table public.list_invites add constraint list_invites_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])));
alter table public.list_invites add constraint list_invites_use_count_check CHECK (((use_count >= 0) AND (use_count <= max_uses)));
alter table public.list_members add constraint list_members_list_id_user_id_key UNIQUE (list_id, user_id);
alter table public.list_members add constraint list_members_pkey PRIMARY KEY (id);
alter table public.list_members add constraint list_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text])));
alter table public.listing_marks add constraint listing_marks_pkey PRIMARY KEY (user_id, listing_id);
alter table public.listings add constraint listings_item_url_unique UNIQUE (item_id, url);
alter table public.listings add constraint listings_pkey PRIMARY KEY (id);
alter table public.listings add constraint listings_match_check CHECK ((match = ANY (ARRAY['match'::text, 'possible'::text])));
alter table public.listings add constraint listings_price_kind_check CHECK ((price_kind = ANY (ARRAY['fixed'::text, 'bid'::text, 'start'::text])));
alter table public.lists add constraint lists_pkey PRIMARY KEY (id);
alter table public.lists add constraint lists_color_known CHECK ((color = ANY (ARRAY['zinc'::text, 'blue'::text, 'green'::text, 'amber'::text, 'red'::text, 'purple'::text, 'orange'::text, 'teal'::text, 'pink'::text, 'indigo'::text])));
alter table public.lists add constraint lists_name_length CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)));
alter table public.lists add constraint lists_visibility_check CHECK ((visibility = ANY (ARRAY['private'::text, 'public'::text, 'collaborative'::text])));
alter table public.notified add constraint notified_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.rate_limits add constraint rate_limits_pkey PRIMARY KEY (key, window_start);
alter table public.site_configs add constraint site_configs_site_name_key UNIQUE (site_name);
alter table public.site_configs add constraint site_configs_pkey PRIMARY KEY (id);
alter table public.site_configs add constraint site_configs_kind_check CHECK ((kind = ANY (ARRAY['marketplace'::text, 'auction'::text])));
alter table public.user_site_prefs add constraint user_site_prefs_pkey PRIMARY KEY (user_id, site_config_id);

-- FOREIGN KEYS

alter table public.alert_log add constraint alert_log_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table public.alert_log add constraint alert_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.categories add constraint categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.item_categories add constraint item_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
alter table public.item_categories add constraint item_categories_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
alter table public.item_lists add constraint item_lists_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
alter table public.item_lists add constraint item_lists_list_id_fkey FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
alter table public.items add constraint items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.list_follows add constraint list_follows_list_id_fkey FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
alter table public.list_follows add constraint list_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.list_invites add constraint list_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.list_invites add constraint list_invites_list_id_fkey FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
alter table public.list_members add constraint list_members_list_id_fkey FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
alter table public.list_members add constraint list_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listing_marks add constraint listing_marks_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table public.listing_marks add constraint listing_marks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.listings add constraint listings_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
alter table public.lists add constraint lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notified add constraint notified_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_site_prefs add constraint user_site_prefs_site_config_id_fkey FOREIGN KEY (site_config_id) REFERENCES site_configs(id) ON DELETE CASCADE;
alter table public.user_site_prefs add constraint user_site_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- INDEXES

CREATE INDEX alert_log_listing_kind_idx ON public.alert_log USING btree (listing_id, kind);
CREATE INDEX item_lists_list_id_idx ON public.item_lists USING btree (list_id);
CREATE INDEX listing_marks_listing_id_idx ON public.listing_marks USING btree (listing_id);
CREATE INDEX listings_found_at_idx ON public.listings USING btree (found_at);
CREATE INDEX listings_item_id_idx ON public.listings USING btree (item_id);
CREATE UNIQUE INDEX listings_item_id_url_key ON public.listings USING btree (item_id, url);
CREATE INDEX listings_last_seen_at_idx ON public.listings USING btree (last_seen_at);
CREATE INDEX rate_limits_window_start_idx ON public.rate_limits USING btree (window_start);

-- FUNCTIONS

-- Items in lists the signed-in user may read (shared-read rules; 20261106_sharing_read_rules.sql)
CREATE OR REPLACE FUNCTION private.viewable_item_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select il.item_id
  from public.item_lists il
  where il.list_id in (select private.viewable_list_ids())
$function$
;
revoke all on function private.viewable_item_ids() from public, anon;
grant execute on function private.viewable_item_ids() to authenticated;

-- Lists the signed-in user may read the items of: own, collaborative member, public followed
CREATE OR REPLACE FUNCTION private.viewable_list_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.id
  from public.lists l
  where l.user_id = (select auth.uid())
     or (l.visibility = 'collaborative' and exists (
           select 1 from public.list_members m
           where m.list_id = l.id and m.user_id = (select auth.uid())))
     or (l.visibility = 'public' and exists (
           select 1 from public.list_follows f
           where f.list_id = l.id and f.user_id = (select auth.uid())))
$function$
;
revoke all on function private.viewable_list_ids() from public, anon;
grant execute on function private.viewable_list_ids() to authenticated;

-- Shared rate limiter (20261110_rate_limits.sql); admin key only
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;
revoke all on function hit_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(text,integer,integer) to service_role;

-- New invites are valid for at most 30 days (20261109_invite_expiry.sql)
CREATE OR REPLACE FUNCTION public.list_invites_cap_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.expires_at := least(new.expires_at, now() + interval '30 days');
  return new;
end;
$function$
;

-- Keeps listings.previous_price for price-drop alerts
CREATE OR REPLACE FUNCTION public.listings_track_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.price is distinct from old.price and old.price is not null then
    new.previous_price := old.price;
  end if;
  return new;
end;
$function$
;

-- "N new" on the watchlist
CREATE OR REPLACE FUNCTION public.new_listings_count(p_user_id uuid)
 RETURNS TABLE(item_id uuid, new_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select i.id as item_id, count(l.id) as new_count
  from items i
  join listings l on l.item_id = i.id
  where i.user_id = p_user_id
    and (i.last_viewed_at is null or l.found_at > i.last_viewed_at)
    and l.removed_at is null
    and l.match = 'match'
  group by i.id;
$function$
;

-- Uses an invite in one step (20261109_invite_expiry.sql); admin key only
CREATE OR REPLACE FUNCTION public.redeem_list_invite(p_token text)
 RETURNS TABLE(list_id uuid, role text)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  update list_invites
     set use_count = use_count + 1
   where token = p_token
     and expires_at > now()
     and use_count < max_uses
  returning list_invites.list_id, list_invites.role
$function$
;
revoke all on function redeem_list_invite(text) from public, anon, authenticated;
grant execute on function redeem_list_invite(text) to service_role;

-- TRIGGERS

CREATE TRIGGER list_invites_cap_expiry BEFORE INSERT ON public.list_invites FOR EACH ROW EXECUTE FUNCTION list_invites_cap_expiry();
CREATE TRIGGER listings_track_price BEFORE UPDATE OF price ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_track_price();

-- ROW LEVEL SECURITY
-- alert_log, notified and rate_limits have no rules on purpose: only the admin key uses them.

alter table public.alert_log enable row level security;
alter table public.categories enable row level security;
alter table public.item_categories enable row level security;
alter table public.item_lists enable row level security;
alter table public.items enable row level security;
alter table public.list_follows enable row level security;
alter table public.list_invites enable row level security;
alter table public.list_members enable row level security;
alter table public.listing_marks enable row level security;
alter table public.listings enable row level security;
alter table public.lists enable row level security;
alter table public.notified enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limits enable row level security;
alter table public.site_configs enable row level security;
alter table public.user_site_prefs enable row level security;

-- POLICIES

create policy "own categories" on public.categories for all to public
  using ((auth.uid() = user_id));

create policy "own item_categories" on public.item_categories for all to public
  using ((item_id IN ( SELECT items.id
   FROM items
  WHERE (items.user_id = auth.uid()))));

create policy "item_lists add to editable list" on public.item_lists for insert to authenticated
  with check (((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = item_lists.item_id) AND (i.user_id = ( SELECT auth.uid() AS uid))))) AND ((EXISTS ( SELECT 1
   FROM lists l
  WHERE ((l.id = item_lists.list_id) AND (l.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (list_members m
     JOIN lists l ON ((l.id = m.list_id)))
  WHERE ((m.list_id = item_lists.list_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])) AND (l.visibility = 'collaborative'::text)))))));

create policy "item_lists own read" on public.item_lists for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = item_lists.item_id) AND (i.user_id = ( SELECT auth.uid() AS uid))))));

create policy "item_lists own remove" on public.item_lists for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM items i
  WHERE ((i.id = item_lists.item_id) AND (i.user_id = ( SELECT auth.uid() AS uid))))));

create policy "item_lists shared read" on public.item_lists for select to authenticated
  using ((list_id IN ( SELECT private.viewable_list_ids() AS viewable_list_ids)));

create policy "items shared read" on public.items for select to authenticated
  using ((id IN ( SELECT private.viewable_item_ids() AS viewable_item_ids)));

create policy "own items" on public.items for all to public
  using ((auth.uid() = user_id));

create policy "list_follows all" on public.list_follows for all to public
  using ((user_id = auth.uid()));

create policy "list_invites delete" on public.list_invites for delete to public
  using ((list_id IN ( SELECT lists.id
   FROM lists
  WHERE (lists.user_id = auth.uid()))));

create policy "list_invites insert" on public.list_invites for insert to public
  with check (((list_id IN ( SELECT lists.id
   FROM lists
  WHERE (lists.user_id = auth.uid()))) OR (list_id IN ( SELECT list_members.list_id
   FROM list_members
  WHERE ((list_members.user_id = auth.uid()) AND (list_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));

create policy "list_invites select" on public.list_invites for select to public
  using (((list_id IN ( SELECT lists.id
   FROM lists
  WHERE (lists.user_id = auth.uid()))) OR (list_id IN ( SELECT list_members.list_id
   FROM list_members
  WHERE ((list_members.user_id = auth.uid()) AND (list_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));

create policy "list_members delete" on public.list_members for delete to public
  using (((list_id IN ( SELECT lists.id
   FROM lists
  WHERE (lists.user_id = auth.uid()))) OR (user_id = auth.uid())));

create policy "list_members insert" on public.list_members for insert to public
  with check (((list_id IN ( SELECT lists.id
   FROM lists
  WHERE (lists.user_id = auth.uid()))) OR (list_id IN ( SELECT list_members_1.list_id
   FROM list_members list_members_1
  WHERE ((list_members_1.user_id = auth.uid()) AND (list_members_1.role = ANY (ARRAY['owner'::text, 'admin'::text])))))));

create policy "list_members select" on public.list_members for select to public
  using ((user_id = auth.uid()));

create policy "list_members update" on public.list_members for update to public
  using ((list_id IN ( SELECT lists.id
   FROM lists
  WHERE (lists.user_id = auth.uid()))));

create policy listing_marks_own on public.listing_marks for all to public
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE (l.id = listing_marks.listing_id)))));

create policy "listings shared read" on public.listings for select to authenticated
  using ((item_id IN ( SELECT private.viewable_item_ids() AS viewable_item_ids)));

create policy "own listings" on public.listings for all to public
  using ((item_id IN ( SELECT items.id
   FROM items
  WHERE (items.user_id = auth.uid()))));

create policy "lists delete" on public.lists for delete to public
  using ((user_id = auth.uid()));

create policy "lists insert" on public.lists for insert to public
  with check ((user_id = auth.uid()));

create policy "lists select" on public.lists for select to public
  using (((user_id = auth.uid()) OR (visibility = 'public'::text) OR ((visibility = 'collaborative'::text) AND (id IN ( SELECT list_members.list_id
   FROM list_members
  WHERE (list_members.user_id = auth.uid()))))));

create policy "lists update" on public.lists for update to public
  using (((user_id = auth.uid()) OR (id IN ( SELECT list_members.list_id
   FROM list_members
  WHERE ((list_members.user_id = auth.uid()) AND (list_members.role = 'admin'::text))))));

create policy "profiles insert" on public.profiles for insert to public
  with check ((id = auth.uid()));

create policy "profiles select" on public.profiles for select to authenticated
  using ((id = ( SELECT auth.uid() AS uid)));

create policy "profiles update" on public.profiles for update to public
  using ((id = auth.uid()));

create policy site_configs_read on public.site_configs for select to authenticated
  using (true);

create policy user_site_prefs_own on public.user_site_prefs for all to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
