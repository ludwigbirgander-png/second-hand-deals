-- Migration: track when a listing was last seen by a scrape
-- Run in the Supabase SQL editor BEFORE deploying the stale-listing cleanup code.
--
-- Scrapes now refresh last_seen_at (and price) on every run. The daily scrape
-- deletes unstarred listings not seen for 14 days, so dead/sold listings stop
-- accumulating. Starred listings are never auto-deleted.

alter table listings
  add column if not exists last_seen_at timestamptz not null default now();

-- Backfill: treat existing rows as last seen when they were found
update listings set last_seen_at = found_at where last_seen_at > found_at;

create index if not exists listings_last_seen_at_idx on listings(last_seen_at);
