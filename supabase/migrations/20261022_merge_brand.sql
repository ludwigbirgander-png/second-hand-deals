-- Migration: merge brands into item names (search plan phase 5)
-- The Brand field is gone from the app; the brand now goes in the name ("Sony WH-1000XM4").
-- The search stays the same, since Kompi used to search for "<brand> <name>".
-- Run in the Supabase SQL editor. Safe to deploy the code before or after.

-- 1. Dry run: the rows that will change, and their new names
select id, brand, name,
  case when left(lower(name), length(trim(brand))) = lower(trim(brand)) then name
       else trim(brand) || ' ' || name end as new_name
from items
where brand is not null and trim(brand) <> '';

-- 2. The update
update items
set name = case when left(lower(name), length(trim(brand))) = lower(trim(brand)) then name
                else trim(brand) || ' ' || name end,
    brand = null
where brand is not null;

-- The items.brand column stays for now (unused) and is dropped in a later clean-up.
