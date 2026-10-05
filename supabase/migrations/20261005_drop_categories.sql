-- Migration: remove categories — items are organised by lists only (redesign v2)
-- Run in the Supabase SQL editor AFTER deploying the code that no longer reads
-- or writes categories.
--
-- ⚠ This permanently deletes every category and every item→category link.
--   Back up first, e.g. Dashboard → Database → Backups, or export both tables:
--     copy (select * from categories)      to stdout with csv header;
--     copy (select * from item_categories) to stdout with csv header;
--
-- item_categories goes first: it references categories. Their RLS policies are
-- dropped together with the tables.

drop table if exists item_categories;
drop table if exists categories;
