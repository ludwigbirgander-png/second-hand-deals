-- DRAFT — NOT RUN YET. See tasks/schema-drift.md.
--
-- Migration: let followers and list members read the items in shared lists
--
-- The live database only lets people read their own items, listings and
-- item_lists rows, so followers of a public list and members of a collaborative
-- list see none of its items. This adds read access (never write access):
--
--   You can read an item, its listings and its list links when the item is in a list
--   - that you own, or
--   - that is collaborative and you're a member of, or
--   - that is public and you follow.
--
-- (The same three cases the live `lists select` rule uses, except that a public
-- list's items need a follow, not just the link.)
--
-- Why helper functions: a rule on items that reads item_lists, while item_lists'
-- own rule reads items, makes Postgres stop with "infinite recursion detected in
-- policy". The two functions below run as their owner (security definer), so they
-- read lists / list_members / list_follows / item_lists without those rules.
-- They only ever answer for the signed-in user (auth.uid()), and live in a
-- `private` schema that the public API doesn't expose.
--
-- RUN ONLY AFTER:
--   1. PR 2 (owner-only scans) is deployed. Otherwise a follower could rewrite
--      the listings of items they can now read.
--   2. Security Task 3 (only add items to lists you may edit). Otherwise anyone
--      could attach their item to someone else's public list, and that list's
--      followers would now see it.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Lists whose items the signed-in user may read
create or replace function private.viewable_list_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.lists l
  where l.user_id = (select auth.uid())
     or (l.visibility = 'collaborative' and exists (
           select 1 from public.list_members m
           where m.list_id = l.id and m.user_id = (select auth.uid())))
     or (l.visibility = 'public' and exists (
           select 1 from public.list_follows f
           where f.list_id = l.id and f.user_id = (select auth.uid())))
$$;

-- Items in those lists
create or replace function private.viewable_item_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select il.item_id
  from public.item_lists il
  where il.list_id in (select private.viewable_list_ids())
$$;

revoke all on function private.viewable_list_ids() from public, anon;
revoke all on function private.viewable_item_ids() from public, anon;
grant execute on function private.viewable_list_ids() to authenticated;
grant execute on function private.viewable_item_ids() to authenticated;

-- The new rules look up item_lists by list
create index if not exists item_lists_list_id_idx on public.item_lists(list_id);

-- Read-only rules, next to the existing "own …" rules (Postgres allows a row
-- when any rule allows it)
drop policy if exists "item_lists shared read" on public.item_lists;
create policy "item_lists shared read" on public.item_lists
  for select to authenticated
  using (list_id in (select private.viewable_list_ids()));

drop policy if exists "items shared read" on public.items;
create policy "items shared read" on public.items
  for select to authenticated
  using (id in (select private.viewable_item_ids()));

drop policy if exists "listings shared read" on public.listings;
create policy "listings shared read" on public.listings
  for select to authenticated
  using (item_id in (select private.viewable_item_ids()));

-- To undo:
--   drop policy "listings shared read" on public.listings;
--   drop policy "items shared read" on public.items;
--   drop policy "item_lists shared read" on public.item_lists;
--   drop function private.viewable_item_ids();
--   drop function private.viewable_list_ids();
