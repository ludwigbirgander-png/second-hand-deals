-- Migration: removing listings, hidden words, and possible matches
-- Run in the Supabase SQL editor BEFORE deploying the code that uses them.

-- A removed listing is kept (not deleted) so later searches don't bring it back.
-- removed_word is set when a hidden word removed it, so undoing the word restores it.
alter table listings add column if not exists removed_at timestamptz;
alter table listings add column if not exists removed_word text;

-- How well the title matched the search. Existing listings count as matches.
alter table listings
  add column if not exists match text not null default 'match'
  check (match in ('match', 'possible'));

-- Words that hide listings for an item, added from the prompt after removing one
alter table items add column if not exists exclude_words text[] not null default '{}';

-- "N new" on the watchlist counts only real matches that haven't been removed
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
    and l.removed_at is null
    and l.match = 'match'
  group by i.id;
$$;
