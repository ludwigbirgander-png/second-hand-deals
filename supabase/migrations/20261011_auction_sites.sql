-- Migration: auction sites (Auctionet, Bukowskis) and auction-aware prices
-- Run in the Supabase SQL editor BEFORE deploying the code that adds them:
-- scrapes write price_kind/bid_count and Settings reads site_configs.kind.

-- Marketplaces and auction houses are grouped separately in Settings
alter table site_configs
  add column if not exists kind text not null default 'marketplace'
  check (kind in ('marketplace', 'auction'));

-- What a listing's price means: fixed asking price, current highest bid,
-- or the starting price of an auction without bids
alter table listings
  add column if not exists price_kind text check (price_kind in ('fixed', 'bid', 'start'));
alter table listings
  add column if not exists bid_count integer;

insert into site_configs (site_name, enabled, base_url, unreliable, kind) values
  ('Auctionet', true, 'https://auctionet.com', false, 'auction'),
  ('Bukowskis', true, 'https://www.bukowskis.com', false, 'auction')
on conflict (site_name) do update set kind = excluded.kind;
