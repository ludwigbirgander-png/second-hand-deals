-- Migration: shared rate limiter (security Task 5)
--
-- A fixed-window counter in Postgres, so limits hold across Vercel's serverless
-- instances (an in-memory counter resets per instance). Used for invite emails
-- and searches (lib/limits).
--
--   hit_rate_limit(key, window_seconds, max) counts one hit in the current window
--   and returns whether it's within the limit. One statement per hit, so
--   concurrent requests can't slip past. Windows older than a day are cleaned
--   up now and then.
--
-- Only the server (admin key) may call it or touch the table. Safe to run before
-- or after deploying: the app lets requests through if the function is missing.

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create index if not exists rate_limits_window_start_idx on public.rate_limits(window_start);

-- No user rules: only the admin key (which skips RLS) may read or write
alter table public.rate_limits enable row level security;

create or replace function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
volatile
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_window_seconds < 1 or p_max < 1 then
    raise exception 'hit_rate_limit: window and max must be at least 1';
  end if;

  -- Windows line up on multiples of the window length (e.g. midnight UTC for a day)
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  -- About one call in a hundred clears out windows older than a day
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- To undo:
--   drop function public.hit_rate_limit(text, integer, integer);
--   drop table public.rate_limits;
