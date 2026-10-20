-- Migration: alerts (search plan phase 3)
-- Run in the Supabase SQL editor BEFORE deploying the code that uses them.

-- "Alert me when one is under X kr"
alter table items add column if not exists target_price integer check (target_price is null or target_price >= 0);

-- The price a listing had before its last price change, for price-drop alerts.
-- Set by a trigger, so both scrape paths (background job and Refresh) keep it up to date.
alter table listings add column if not exists previous_price integer;

create or replace function listings_track_price()
returns trigger
language plpgsql
as $$
begin
  if new.price is distinct from old.price and old.price is not null then
    new.previous_price := old.price;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_track_price on listings;
create trigger listings_track_price
  before update of price on listings
  for each row execute function listings_track_price();

-- Every alert email sent, so the same alert isn't sent twice.
-- A listing alerts again only if its price drops below the logged price.
create table if not exists alert_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  kind text not null check (kind in ('target_price', 'price_drop', 'auction_ending', 'rare_find')),
  price integer,
  sent_at timestamptz not null default now()
);

create index if not exists alert_log_listing_kind_idx on alert_log(listing_id, kind);

-- Service role only (no user policies)
alter table alert_log enable row level security;

-- Per-user email settings. A user without a profiles row gets the defaults.
alter table profiles add column if not exists weekly_email boolean not null default true;
alter table profiles add column if not exists alerts_enabled boolean not null default true;
-- When the last weekly email went out; the next one covers listings found since then
alter table profiles add column if not exists last_digest_at timestamptz;
