-- Migration: personal favourites and removals for people who don't own the item
-- (followers of a public list, members of a shared list).
-- Run in the Supabase SQL editor. The code works before it is run (followers just
-- can't save marks yet), so it can be deployed first.
--
-- The item's owner keeps using listings.starred / listings.removed_at, which also
-- drive alerts and the digest. Everyone else gets one row here per listing they
-- favourite or remove, so nobody's marks affect anyone else.

create table if not exists listing_marks (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  starred boolean not null default false,
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists listing_marks_listing_id_idx on listing_marks(listing_id);

alter table listing_marks enable row level security;

-- Your own marks only, and only on listings you can see (the listings policies
-- decide that: your own items, or items in lists you follow or are a member of)
drop policy if exists listing_marks_own on listing_marks;
create policy listing_marks_own on listing_marks
  for all using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from listings l where l.id = listing_marks.listing_id)
  );
