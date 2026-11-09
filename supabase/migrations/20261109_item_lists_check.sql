-- Migration: only add items to lists you may edit (security Task 3)
--
-- The live rule `own item_lists` let you add your item to ANY list, because it
-- only checked that you own the item. List ids of public lists are readable by
-- everyone, so anyone could push their items into someone else's list. Once
-- followers can read a list's items (20261106_sharing_read_rules.sql), those
-- items would show up for that list's followers.
--
-- New rules on item_lists (the item → list links):
--   read:   links of your own items (unchanged)
--   remove: links of your own items (unchanged; taking your item out of a list)
--   add:    your own item, to a list you own or a collaborative list where you're
--           an owner, admin or editor member (not a viewer)
--   change: not allowed (the app only adds and removes links)
--
-- Existing links aren't touched. Safe to run before or after deploying the code
-- that checks the same thing in PUT /api/items/[id]/associations.

drop policy if exists "own item_lists" on public.item_lists;
drop policy if exists item_lists_item_owner on public.item_lists;  -- name used in schema.sql

drop policy if exists "item_lists own read" on public.item_lists;
create policy "item_lists own read" on public.item_lists
  for select to authenticated
  using (exists (select 1 from public.items i where i.id = item_lists.item_id and i.user_id = (select auth.uid())));

drop policy if exists "item_lists own remove" on public.item_lists;
create policy "item_lists own remove" on public.item_lists
  for delete to authenticated
  using (exists (select 1 from public.items i where i.id = item_lists.item_id and i.user_id = (select auth.uid())));

drop policy if exists "item_lists add to editable list" on public.item_lists;
create policy "item_lists add to editable list" on public.item_lists
  for insert to authenticated
  with check (
    exists (select 1 from public.items i where i.id = item_lists.item_id and i.user_id = (select auth.uid()))
    and (
      exists (select 1 from public.lists l where l.id = item_lists.list_id and l.user_id = (select auth.uid()))
      or exists (
        select 1 from public.list_members m
        join public.lists l on l.id = m.list_id
        where m.list_id = item_lists.list_id
          and m.user_id = (select auth.uid())
          and m.role in ('owner', 'admin', 'editor')
          and l.visibility = 'collaborative'
      )
    )
  );

-- To undo (back to the old rule):
--   drop policy "item_lists add to editable list" on public.item_lists;
--   drop policy "item_lists own remove" on public.item_lists;
--   drop policy "item_lists own read" on public.item_lists;
--   create policy "own item_lists" on public.item_lists for all
--     using (item_id in (select id from public.items where user_id = auth.uid()));
