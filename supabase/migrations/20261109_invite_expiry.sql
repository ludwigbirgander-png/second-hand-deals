-- Migration: invite links expire and have a use limit (security Task 4)
--
-- Invite tokens never expired and could be used any number of times, including
-- invites that make someone an admin. Now:
--   expires_at  14 days after creation (existing invites: 14 days from now)
--   max_uses    1 for email invites, 25 for copyable links (set by the app)
--   use_count   counted up by redeem_list_invite(), in one step with the checks,
--               so two people can't both use a single-use invite
--
-- Limits so an owner/admin writing directly to the table can't create a
-- never-ending invite: at most 30 days (capped on creation), at most 100 uses.
--
-- Safe to run before deploying the code: until the new code is live, the old
-- join route ignores the new columns (invites keep working as before).

-- Existing invites get the link limit (25) when the column is added; new ones
-- default to single use. Safe to run twice: `if not exists` skips the add.
alter table public.list_invites
  add column if not exists expires_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists max_uses integer not null default 25,
  add column if not exists use_count integer not null default 0;
alter table public.list_invites alter column max_uses set default 1;

alter table public.list_invites drop constraint if exists list_invites_max_uses_check;
alter table public.list_invites add constraint list_invites_max_uses_check
  check (max_uses between 1 and 100);
alter table public.list_invites drop constraint if exists list_invites_use_count_check;
alter table public.list_invites add constraint list_invites_use_count_check
  check (use_count >= 0 and use_count <= max_uses);
-- New invites can't be valid for more than 30 days. Done when an invite is created
-- (not as a table rule, which would reject existing invites from before this
-- migration). Users can't update invites at all, so creation is the only way in.
create or replace function public.list_invites_cap_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.expires_at := least(new.expires_at, now() + interval '30 days');
  return new;
end;
$$;

drop trigger if exists list_invites_cap_expiry on public.list_invites;
create trigger list_invites_cap_expiry
  before insert on public.list_invites
  for each row execute function public.list_invites_cap_expiry();

-- Use an invite: counts one use and returns its list and role, or nothing if the
-- token is unknown, expired or used up. One statement, so concurrent joins can't
-- go past the limit. Only the server (admin key) may call it.
create or replace function public.redeem_list_invite(p_token text)
returns table (list_id uuid, role text)
language sql
volatile
set search_path = public
as $$
  update list_invites
     set use_count = use_count + 1
   where token = p_token
     and expires_at > now()
     and use_count < max_uses
  returning list_invites.list_id, list_invites.role
$$;

revoke all on function public.redeem_list_invite(text) from public, anon, authenticated;
grant execute on function public.redeem_list_invite(text) to service_role;

-- To undo:
--   drop function public.redeem_list_invite(text);
--   drop trigger list_invites_cap_expiry on public.list_invites;
--   drop function public.list_invites_cap_expiry();
--   alter table public.list_invites
--     drop constraint list_invites_use_count_check, drop constraint list_invites_max_uses_check,
--     drop column use_count, drop column max_uses, drop column expires_at;
