-- Migration: full links for Vinted listings
-- Vinted's cards link relatively ("/items/123-omega?referrer=catalog"), and Kompi saved that,
-- so tapping a Vinted listing opened Kompi's own /items page. The scraper now saves
-- "https://www.vinted.se/items/123-omega" (lib/scrapers/vinted.ts, vintedUrl). This fixes the
-- listings already saved. Run in the Supabase SQL editor in two steps (below).

-- 1. Dry run: the Vinted listings whose link changes, and their new link
select id, item_id, url,
  'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1) as new_url
from listings
where site = 'Vinted'
  and url <> 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1);

-- 2. The fix. Commented out so running this file only shows the dry run above.
--    Check that list, then select the lines from the "begin" line to the "commit" line and run them.
--    No temporary table: Supabase's "enable RLS" option appends an alter table for one,
--    which failed after the commit had dropped it.
--    Copies of the same listing (same item and link) are merged into one row: the one that
--    already has the full link, else the oldest. Every step ranks the copies the same way.
/*
begin;

-- 1. The kept row gets a star if any copy had one, and a removal if any copy was removed
with v as (
  select id, item_id, starred, removed_at, removed_word,
    'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1) as new_url,
    row_number() over (
      partition by item_id, 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)
      order by (url = 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)) desc, found_at, id
    ) as keep_rank
  from listings
  where site = 'Vinted'
), merged as (
  select item_id, new_url, bool_or(starred) as starred, min(removed_at) as removed_at, min(removed_word) as removed_word
  from v group by item_id, new_url
)
update listings l
set starred = m.starred,
    removed_at = coalesce(l.removed_at, m.removed_at),
    removed_word = coalesce(l.removed_word, m.removed_word)
from v join merged m on m.item_id = v.item_id and m.new_url = v.new_url
where v.keep_rank = 1 and l.id = v.id;

-- 2. Alerts already sent for a copy count for the kept row, so nothing is emailed twice
with v as (
  select id, item_id, starred, removed_at, removed_word,
    'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1) as new_url,
    row_number() over (
      partition by item_id, 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)
      order by (url = 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)) desc, found_at, id
    ) as keep_rank
  from listings
  where site = 'Vinted'
)
update alert_log a
set listing_id = keep.id
from v dup join v keep on keep.item_id = dup.item_id and keep.new_url = dup.new_url and keep.keep_rank = 1
where dup.keep_rank > 1 and a.listing_id = dup.id;

-- 3. Drop the copies
with v as (
  select id, item_id, starred, removed_at, removed_word,
    'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1) as new_url,
    row_number() over (
      partition by item_id, 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)
      order by (url = 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)) desc, found_at, id
    ) as keep_rank
  from listings
  where site = 'Vinted'
)
delete from listings l using v where v.keep_rank > 1 and l.id = v.id;

-- 4. Full links
update listings
set url = 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)
where site = 'Vinted' and url <> 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1);

commit;
*/
