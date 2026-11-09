# Live database vs `supabase/schema.sql`

Compared 2026-11-05 against the live project "Second hand platform" (`rszkzmykwsfzdelreisb`).
`schema.sql` says at the top that it was reconstructed from the code in June and never checked against production; this is that check.

**Short version:** the tables and columns match. The access rules (RLS) don't. The live database has no rules that let followers or list members read anyone else's items, so sharing doesn't work in production. There are also a few security gaps that `schema.sql` doesn't show.

## 1. Sharing: missing in the live database (the big one)

| Table | Live rules | What `schema.sql` describes |
|---|---|---|
| `items` | `own items`: only your own | Also readable for members of a list it's in, and followers of a public list it's in |
| `listings` | `own listings`: only listings on your own items | Also readable when you can read the item |
| `item_lists` | `own item_lists`: only rows for your own items | Also readable by members of the list |

**Effect today:** a follower sees a public list's name but no items. A member of a collaborative list sees only the items they added. Nobody follows a list or is a member yet (0 follows, 0 members), so nobody has noticed.

**`schema.sql`'s version wouldn't work either:**
- Its `items` rule looks up `item_lists`, but its `item_lists` rule only lets *members* read rows, so followers would still see nothing.
- The `items` rule reads `item_lists`, whose rule reads `items` again. Postgres stops that with "infinite recursion detected in policy".

**Fix:** `supabase/migrations/20261106_sharing_read_rules.sql`, **run in Supabase on 2026-11-09**. It adds two small helper functions that work out "lists I can view" and "items in those lists" without going through the table rules (so no recursion). It then adds one read rule each to `item_lists`, `items` and `listings`. It only adds read access; nothing gets write access it didn't have.

**Tested 2026-11-05** on the live database inside a transaction that was rolled back (nothing was left behind). The tests used real accounts and the one public list (1 item, 675 listings):
- **Another user, not following:** sees only their own 8 items, none of the list's. Can't save a favourite on its listings.
- **Same user after following:** sees the list's item, its 675 listings and the list link. Editing or deleting the item or its listings changes 0 rows. Can save their own favourite, but not one in someone else's name.
- **Owner:** sees all their items and listings as before, and none of the other user's items.
- **Signed out:** sees nothing, and can't call the helper functions.
- No recursion error.

**Run order, all done:**
1. **PR 2 deployed** (2026-11-05). Once followers can read other people's items, the old scan route would have let them rewrite those items' listings.
2. **Security Task 3 done** (PR 4, 2026-11-09; migration `20261109_item_lists_check.sql`). Before it, anyone could attach their own item to *any* list, and with sharing on it would have shown up for that list's followers.
3. **Sharing rules run** (2026-11-09). Checked again on the live rules with real accounts (rolled back):
   - A follower sees the list's item and its 657 listings, but can't edit or delete them, or add their own item to the list.
   - Their own favourite saves, and the owner doesn't see it.
   - Signed-out visitors see nothing.
   - No new Supabase security warnings.

PR 3 (personal favourites) needs this migration to do anything for followers.

## 2. Security gaps in the live database

| Problem | Was | Risk | Status |
|---|---|---|---|
| `notified` had no RLS | RLS off | Anyone with the public key could read and change it (Supabase **error**) | **Fixed 2026-11-09:** RLS on, admin key only. No code uses the table. |
| `site_configs` writable by any user | `write site_configs`: any signed-in user could `UPDATE` | Anyone could switch a marketplace off, or change its URL, for everyone | **Fixed 2026-11-09:** read-only for signed-in users; the duplicate read rule is gone. |
| Every profile public | `profiles select`: `true` | Anyone, even signed out, could list every user's display name | **Fixed 2026-11-09:** own profile only. The members list reads names with the admin key. |
| Functions without a fixed search path | `listings_track_price`, `new_listings_count` | Supabase warning: a function's lookups could be redirected | **Fixed 2026-11-09:** both pinned to `public`. |
| Leaked-password check off | Supabase Auth setting | Users can sign up with passwords known from breaches | **Still open, yours:** Dashboard → Authentication → Passwords → leaked password protection. |

The four fixes are in `supabase/migrations/20261109_database_gaps.sql`. They were tested on the live database in a rolled-back transaction first, with real accounts:
- Signed-out visitors can no longer read profiles or marketplace settings, or write to `notified`.
- Signed-in users can read the 7 marketplace settings but not change them, and see only their own profile.
- Saving your own profile, the new-listing counts and the price-history trigger still work.

Supabase's security checks now show only the leaked-password setting, plus two informational notes that `alert_log` and `notified` have no user rules (intended: admin key only).

## 3. Other differences (harmless, but `schema.sql` is wrong)

- **Leftover tables:** `categories` (9 rows) and `item_categories` (1 row) still exist. `20261005_drop_categories.sql` was never run; no code uses them. Run it after a backup if you want them gone.
- **`list_members`:** live has an `id` primary key plus unique `(list_id, user_id)`, and `role` also allows `'owner'` (the code uses it). `schema.sql` has a composite key and no `'owner'`.
- **`list_follows`:** live has an `id` primary key plus unique `(list_id, user_id)`.
- **`lists` rules:** live has separate select/insert/update/delete rules. Admins may update the list; members can read only *collaborative* lists. `schema.sql` has one owner rule plus one read rule.
- **`list_members` / `list_invites` rules:** live lets owners and admin members add members and manage invites; `schema.sql` lets only the owner add members.
- **Indexes:**
  - `items_user_id_idx` is missing live.
  - `listings` has the same unique index twice (`listings_item_id_url_key` and `listings_item_url_unique`); one can go.
  - `item_lists(list_id)` has no index (the draft adds it, since the new rules look up by list).
- **Matching:** all columns, the `listings_track_price` trigger, both function bodies, `alert_log`, `listing_marks`.

## 4. Keeping them in sync

`schema.sql` should be replaced by a dump of the live database, so the next plan starts from the truth:

```bash
supabase db dump --schema public > supabase/schema.sql
```

That needs the Supabase CLI linked to the project (`supabase link --project-ref rszkzmykwsfzdelreisb`, which asks for the database password).
