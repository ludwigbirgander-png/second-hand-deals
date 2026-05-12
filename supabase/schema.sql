-- Run this in the Supabase SQL editor to set up the database

create extension if not exists "pgcrypto";

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists site_configs (
  id uuid primary key default gen_random_uuid(),
  site_name text not null unique,
  enabled boolean not null default true,
  base_url text not null,
  unreliable boolean not null default false
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  site text not null,
  title text not null,
  price integer,
  currency text not null default 'SEK',
  url text not null,
  image_url text,
  found_at timestamptz not null default now()
);

create index if not exists listings_item_id_idx on listings(item_id);
create index if not exists listings_found_at_idx on listings(found_at);

create table if not exists notified (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  notified_at timestamptz not null default now()
);

-- Seed default sites
insert into site_configs (site_name, enabled, base_url, unreliable) values
  ('Blocket', true, 'https://www.blocket.se', false),
  ('Tradera', true, 'https://www.tradera.com', false),
  ('Sellpy', true, 'https://www.sellpy.se', false),
  ('Vinted', true, 'https://www.vinted.se', false),
  ('Facebook Marketplace', false, 'https://www.facebook.com/marketplace', true)
on conflict (site_name) do nothing;
