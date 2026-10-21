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
--    Check that list, then select the lines from "begin;" to "commit;" and run them.
/*
begin;

-- One row per item and new link: prefer a row that already has it, else the oldest
create temp table vinted_links on commit drop as
select id, item_id,
  'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1) as new_url,
  starred, removed_at, removed_word,
  row_number() over (
    partition by item_id, 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)
    order by (url = 'https://www.vinted.se' || split_part(regexp_replace(url, '^https?://[^/]+', ''), '?', 1)) desc, found_at
  ) as keep_rank
from listings
where site = 'Vinted';

-- The kept row gets a star if any copy had one, and a removal if any copy was removed
update listings l
set starred = g.starred,
    removed_at = coalesce(l.removed_at, g.removed_at),
    removed_word = coalesce(l.removed_word, g.removed_word)
from vinted_links k
join (
  select item_id, new_url, bool_or(starred) as starred, min(removed_at) as removed_at, min(removed_word) as removed_word
  from vinted_links group by item_id, new_url
) g on g.item_id = k.item_id and g.new_url = k.new_url
where k.keep_rank = 1 and l.id = k.id;

-- Alerts already sent for a duplicate count for the kept row, so nothing is emailed twice
update alert_log a
set listing_id = keep.id
from vinted_links dup
join vinted_links keep on keep.item_id = dup.item_id and keep.new_url = dup.new_url and keep.keep_rank = 1
where dup.keep_rank > 1 and a.listing_id = dup.id;

-- Drop the duplicates
delete from listings l using vinted_links k where k.keep_rank > 1 and l.id = k.id;

-- Full links for the rest
update listings l set url = k.new_url from vinted_links k where k.keep_rank = 1 and l.id = k.id and l.url <> k.new_url;

commit;
*/
