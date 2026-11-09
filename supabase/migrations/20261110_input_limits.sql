-- Migration: input limits in the database (security Task 13)
--
-- The API routes check these (lib/validate), but the Supabase public key lets
-- signed-in users write to their own items and lists directly. These limits hold
-- for those writes too.
--
--   items.name     at most 120 characters, not empty
--   items prices   0 to 10 000 000 kronor (target_price already had >= 0)
--   lists.name     at most 60 characters, not empty
--   lists.color    one of the colours in lib/colors.ts
--
-- Checked against the live data on 2026-11-09: longest item name 26, longest list
-- name 14, colours amber/blue/red/zinc, no negative prices. NOT VALID is not used:
-- if any row broke a limit, the migration would stop and report it instead of
-- changing data.

alter table public.items drop constraint if exists items_name_length;
alter table public.items add constraint items_name_length
  check (char_length(btrim(name)) between 1 and 120);

alter table public.items drop constraint if exists items_price_range;
alter table public.items add constraint items_price_range
  check (
    (min_price is null or min_price between 0 and 10000000)
    and (max_price is null or max_price between 0 and 10000000)
    and (target_price is null or target_price between 0 and 10000000)
  );

alter table public.lists drop constraint if exists lists_name_length;
alter table public.lists add constraint lists_name_length
  check (char_length(btrim(name)) between 1 and 60);

alter table public.lists drop constraint if exists lists_color_known;
alter table public.lists add constraint lists_color_known
  check (color in ('zinc', 'blue', 'green', 'amber', 'red', 'purple', 'orange', 'teal', 'pink', 'indigo'));

-- To undo:
--   alter table public.items drop constraint items_name_length, drop constraint items_price_range;
--   alter table public.lists drop constraint lists_name_length, drop constraint lists_color_known;
