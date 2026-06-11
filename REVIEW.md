# Code & Functionality Review — Kompi (second-hand-deals)

Reviewed 2026-06-11. Full read of `app/`, `components/`, `lib/`, `scripts/`, `middleware.ts`, `supabase/schema.sql`, CI, and Vercel config.

---

## Critical

### 1. `supabase/schema.sql` is severely out of date
The committed schema only has `items`, `site_configs`, `listings`, `notified` — and `items` has just `id`, `name`, `created_at`. The code depends on far more:

- Tables: `lists`, `list_members`, `list_invites`, `list_follows`, `categories`, `item_lists`, `item_categories`, `profiles`
- Columns: `items.user_id / brand / min_price / max_price / notify / last_viewed_at`, `listings.starred / condition / size / shipping_cost / auction_ends_at / location`
- Constraints: the `upsert(..., { onConflict: 'item_id,url' })` calls require a unique index on `listings(item_id, url)` that isn't in the schema
- RPC: `new_listings_count(p_user_id)`
- **RLS policies** — none are in the repo at all

You can't recreate the database from the repo, and nobody can verify the security model. Export the live schema (`supabase db dump`) and commit it, ideally as migrations.

### 2. Authorization relies entirely on (unverifiable) RLS
Many routes never check ownership and just trust RLS:

- `PATCH/DELETE /api/items/[id]` — no `.eq('user_id', user.id)`
- `PATCH /api/listings/[id]` (star) — no ownership check
- `PATCH/DELETE /api/lists/[id]`, `PATCH/DELETE /api/categories/[id]` — same
- `PUT /api/items/[id]/associations` — same
- `GET/POST /api/lists/[id]/invite` — **any authenticated user** can list or create invite tokens for any list id if RLS doesn't block it (note: `members/route.ts POST` *does* check owner/admin — the two invite paths are inconsistent)

Since RLS isn't in the repo, these may be IDOR holes. Add explicit ownership checks as defense-in-depth (the `viewed` route already does it right).

### 3. `site_configs` is global but exposed as a per-user setting
The Settings page ("`/api/profile/sites`") toggles rows in a shared `site_configs` table with no `user_id`. One user disabling Blocket disables it for **every** user and for the daily scrape. Either make it per-user (`user_site_prefs`) or make it admin-only.

### 4. `/api/scrape` (Vercel cron) is broken legacy — and fails open
- `vercel.json` schedules `/api/scrape`, but Vercel cron sends **GET** with `Authorization: Bearer CRON_SECRET`; the route only exports **POST** and checks an `x-cron-secret` header → the cron never runs.
- Auth fails open: `if (process.env.CRON_SECRET && ...)` — if the env var is missing, the endpoint is public (middleware exempts it) and triggers scraping + emails for all users' items.
- It duplicates `scripts/daily-scrape.ts` (the GitHub Action) but with worse behavior: ignores `item.notify`, no enrichment, plain `insert` instead of upsert, and emails everything to one global `NOTIFICATION_EMAIL` — every user's items to a single address (privacy issue).
- Sequential scraping with 1s delays × items × sites blows the 60s `maxDuration` after ~2 items.

Delete the route + `vercel.json` cron and keep only the GitHub Action, or fix the route and remove the action. Two diverging copies of the same job is the worst option.

### 5. HTML injection in emails
`lib/email.ts`, `scripts/daily-scrape.ts`, and the invite email interpolate scraped listing titles, item names, and list names into HTML unescaped. Scraped titles are attacker-controlled content from external marketplaces — a listing titled `<a href="https://phish...">` lands as live HTML in your inbox. Escape all interpolated values.

---

## High

### 6. Fire-and-forget scrape on item creation doesn't survive serverless
`POST /api/items` calls `triggerScrape(...)` without `await`. On Vercel, the function is frozen as soon as the response returns, so the scrape may silently never finish. Use `waitUntil()` from `next/server`, or drop this path entirely (the home page already passes `noScrape: true` and uses the streaming endpoint).

### 7. N+1 queries everywhere
- Watchlist page: one `fetch('/api/items/{id}/listings')` **per item** just to compute the lowest price. With 30 items that's 31 requests on every load. Compute lowest price server-side (join or RPC, like `new_listings_count` already does).
- Item page: fetches **all** items via `/api/items` to find one. Add `GET /api/items/[id]`.
- `GET /api/lists/[id]/members`: one `auth.admin.getUserById` call per member. Use `listUsers` or store email on `profiles`.

### 8. NDJSON parsing breaks on chunk boundaries
`ScrapeProgress` decodes each chunk and splits on `\n` without buffering partial lines. A JSON line split across two reads fails `JSON.parse` and is silently dropped — lost progress events, possibly a stuck UI. Keep a string buffer across reads; also pass `{ stream: true }` to `decoder.decode`.

### 9. Scrape stream is a GET with side effects
`GET /api/scrape/[itemId]/stream` writes to the DB. GETs can be prefetched/retried by browsers and proxies. Make it POST.

### 10. Listings are never cleaned up
Sold/removed listings stay forever — the table accumulates dead links and the "lowest price" can point to an item sold months ago. Add staleness handling: mark listings not seen in N scrapes as inactive (you already upsert on `item_id,url`, so "last_seen_at" is a one-column change), and let users hide/dismiss listings.

### 11. Type bug: `Omit` on a union
`lib/types.ts`: `role: Omit<ListRole, 'owner'>` — `Omit` is for object types; on a string union it produces a useless type. You want `Exclude<ListRole, 'owner'>`. Also `Item` lacks `user_id` though the code reads it (`daily-scrape.ts`).

---

## Medium

12. **`PATCH /api/items/[id]` rejects partial updates** — it 400s without `name`, so a notify-only toggle must resend everything. Build the update object from provided fields only.
13. **Associations PUT is delete-then-insert without a transaction** — a failure between the two calls wipes the item's lists/categories. Use an RPC or compute a diff.
14. **Inconsistent price parsing** — Blocket's `parsePrice` converts `,` to a decimal point ("1,234" → 1.23), Tradera's strips commas, Vinted treats comma as decimal. Centralize one Swedish-format parser in `lib/scrapers/index.ts`.
15. **`isRelevant` over-filters** — every ≥3-char word of `brand + name` must appear in the title. Sellers often omit the brand ("WH-1000XM5 hörlurar" won't match query "Sony WH-1000XM5"). Consider requiring name words only, or fuzzy/majority matching.
16. **Silent error swallowing** — every scraper failure is `catch {}` with no logging. You can't tell "Blocket changed their markup" from "no results", and the UI shows both as "none". Log errors; surface a "site failed" state in the stream events (you already have the `unreliable` flag concept).
17. **Facebook Marketplace is misleading UX** — it's listed like a working site but the scraper always returns `[]`. `FACEBOOK_WARNING` exists but is never shown. Display it, or hide the site.
18. **Invite tokens never expire** — the error message says "Invalid or expired" but there's no expiry or single-use logic, and `GET .../invite` returns raw tokens. Add `expires_at` and revoke-on-use (or max uses).
19. **Joining via invite silently flips a private list to `collaborative`** — surprising owner-side effect; gate it or notify the owner.
20. **Sender inconsistencies** — `lib/email.ts` hardcodes `noreply@resend.dev` and the name "Second Hand Deals", elsewhere it's `RESEND_FROM_EMAIL` and "Kompi". `resend.dev` senders only deliver to your own account email.
21. **Middleware matcher** only excludes `_next/*` and favicon — `/public` assets (svg files etc.) get redirected to `/login` for logged-out users. Extend the matcher.
22. **Hardcoded Algolia credentials in `sellpy.ts`** — it's a public search key so not a leak, but move to env/config so a rotation doesn't require a deploy.
23. **`html lang="sv"` but UI text is English** — screen readers will pronounce English with Swedish rules. Pick one (PRODUCT.md suggests Swedish users).

---

## Low / cleanup

24. `recharts` is in dependencies but never imported (was a price-history chart planned?). `axios` could be replaced with native `fetch` to slim the bundle, and `@types/cheerio` is unnecessary (cheerio ships its own types).
25. README is untouched create-next-app boilerplate — replace with setup instructions (env vars, schema, cron).
26. `buildQuery` is reimplemented inside `app/api/scrape/route.ts` — import from `lib/scrapers`.
27. `app/api/items/route.ts` and lists route use `any` liberally — type the Supabase join shapes.
28. Item page back-link says "← Watchlist" but `href="/"` (watchlist lives at `/watchlist`).
29. Tradera/Blocket `enrich()` does `$('*').each` full-DOM scans — fragile and slow; scope the selectors.
30. No tests and no CI for lint/typecheck — even one GitHub Action running `tsc --noEmit` + `eslint` + a unit test for `parsePrice`/`isRelevant` (pure functions, easy wins) would catch most regressions, since scrapers break silently by design.

---

## Functionality ideas (product gaps)

- **Price history chart** per item — you scrape daily and have `found_at`; recharts is already installed. This is the obvious "is this a good deal?" feature.
- **Price-drop alerts** — notify when a listing appears *below* `min`/target price, not just "new listings" digests.
- **Hide/dismiss listings** — irrelevant scrape hits currently pollute the table forever; star exists, hide doesn't.
- **Auction awareness** — `auction_ends_at` is scraped (Tradera) but a "ending soon" sort/notification would make it useful.
- **Forgot password** — login has no reset flow.
- **Per-user scrape trigger / freshness indicator** — show "last scraped X hours ago" per item so users know how stale results are.
- **Pagination** — `/api/items/[id]/listings` returns everything; fine now, painful at 1000+ rows.
