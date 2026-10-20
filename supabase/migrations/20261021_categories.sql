-- Migration: categories (search plan phase 4)
-- Run in the Supabase SQL editor BEFORE deploying the code that uses them.

-- The item's category (lib/categories, e.g. 'clothing', 'shoes'); null means "Any".
-- Categories and their options live in code, so only the user's choices are stored.
alter table items add column if not exists category text;

-- The item's filters: category options (size, colour…), minimum condition, sale type, strict
alter table items add column if not exists filters jsonb not null default '{}';

-- A listing's normalised details: condition on one scale, size, colour…,
-- and which filtered details it didn't state
alter table listings add column if not exists attributes jsonb not null default '{}';
