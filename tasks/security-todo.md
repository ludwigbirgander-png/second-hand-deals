# Todo: Security hardening

Plan: `tasks/security-plan.md`.
Every task also clears the standing bar: `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass. "Second account" means a separate test user signed in in a private window.

## Phase 1: High severity

- [x] **Task 1: Scrape only your own items**
  - Description: `app/api/scrape/[itemId]/stream/route.ts` reads the item with the user's session, which also returns items in public lists the user follows, and then writes and deletes listings with the admin key. Limit it to items the caller owns.
  - Acceptance:
    - The item query adds `.eq('user_id', user.id)`; anyone else gets 404 before any database write.
    - The owner's scrape behaves exactly as before.
  - Verification: second account follows a public list containing your item and POSTs `/api/scrape/<itemId>/stream` → 404, and your listing count is unchanged; your own scan still streams results.
  - Dependencies: none
  - Files: `app/api/scrape/[itemId]/stream/route.ts`
  - Scope: XS
  - **Done 2026-11-05** (branch `security-phase-1`). Also: `GET /api/items/[id]` returns `is_owner`, and the item page hides Refresh on items you don't own (members of a shared list could see it, and it would now fail). Not done: Edit and Delete are still shown to non-owners and fail quietly; this was already the case before. Still to check by you: the second-account test above.

- [x] **Task 2: Upgrade Next.js and fix vulnerable dependencies**
  - Description: move `next` and `eslint-config-next` to `16.4.2` and apply the non-forced `npm audit fix` (axios, undici, follow-redirects, form-data, nanoid, source-map-js, baseline-browser-mapping). Never `--force`.
  - Acceptance:
    - `npm audit --omit=dev` reports no high or critical issues (or each one left is written here with a reason and a review date).
    - Release notes / `node_modules/next/dist/docs/` checked for 16.3–16.4 changes affecting `middleware.ts`, route handlers or Server Actions; any needed changes made.
    - Only `package.json` and `package-lock.json` change, unless the docs require code changes.
  - Verification: `npm ci` from clean; standing bar; manual click-through: sign up, log in, add item, scan, open item, favourite, join a list by link, log out (signed-out visitor is sent to /login).
  - Dependencies: none
  - Files: `package.json`, `package-lock.json`
  - Scope: S
  - **Done 2026-11-05** (branch `security-phase-1`), with these notes:
    - **16.4.1, not 16.4.2.** `~/.npmrc` has `min-release-age=21`, and 16.4.2 was under 21 days old. 16.4.1 already fixes the critical advisory (affected range ends at 16.4.0) and ships the fixed `postcss` 8.5.23 and `sharp` 0.35.5. Move to the latest 16.4.x once it's 21 days old.
    - **Docs:** 16.3–16.4 only add opt-in features; no code changes needed. `middleware.ts` still works but is deprecated (since 16.0) in favour of `proxy.ts`; renaming it is left for later. `next dev` may add a marked "agent rules" block to `AGENTS.md` (`agentRules` option, on by default).
    - **Audit (`--omit=dev`): 0 critical, 0 moderate, 2 high left**, both with fixes that are still under 21 days old:
      | Package | Why it can wait | Fix | Review on |
      |---|---|---|---|
      | ~~`undici` 7.30.0 (via `cheerio`)~~ | **Fixed 2026-11-09:** 7.30.1 (branch `security-phase-2`) | 7.30.1 | done |
      | `follow-redirects` 1.16.1 (via `axios`) | The advisories leak login headers on redirects; the scrapers send no cookies or auth headers | 1.16.2 | 2026-11-15 |
    - **Lint:** 18 `no-explicit-any` errors, the same before and after the upgrade (mostly `app/api/items` and `app/api/lists`, which Tasks 9–10 touch). ESLint also reads the untracked old copy in `.claude/worktrees/security-hardening`, which doubles the count.
    - **Checked:** `npm ci` from clean; 100 tests, type check and build pass; dev server on 16.4.1 sends signed-out visitors to /login and returns 401 from the API. **Still to check by you:** the signed-in click-through above.

- [x] **Checkpoint 1:** standing bar green; audit clean; deploy Phase 1 (recommended as its own PR).
  - **Done 2026-11-05:** PR #2 merged and deployed to production (second-hand-deals.vercel.app); no runtime errors. You did the signed-in click-through. The second-account check can't show anything in production yet: the live database has no rules that let followers read other people's items (see `tasks/schema-drift.md`).

## Phase 2: Database rules

> **Read first:** this phase was planned from `supabase/schema.sql`, which doesn't match the live database. `tasks/schema-drift.md` lists the live rules. Each migration below starts from those.

- [x] **Task 3: Only add items to lists you may edit**
  - **Built 2026-11-09** (branch `security-phase-2`). The migration is `supabase/migrations/20261109_item_lists_check.sql` (not `20261024_…`). It replaces the live `own item_lists` rule with three: read and remove your own item's links; add only to a list you own, or a *collaborative* list where you're an owner, admin or editor member.
    - **Route:** it now only adds and removes what changed, instead of deleting every link and re-adding. So re-saving an item that sits in a list you can no longer edit still works, and taking your own item out of a list is always allowed. A refused list returns 403 with nothing changed. The helpers (`parseListIds`, `diffLinks`, `editableListIds`) are in `lib/lists/links.ts`.
    - **UI:** the item page shows the error if the lists can't be saved. Adding an item from the watchlist still adds it, just without the refused list.
    - **Tested** on the live database in a rolled-back transaction. Under the old rule an outsider could add their item to the public list. Under the new rules:
      - the outsider is refused
      - the owner can add their own item, but not someone else's
      - an editor of a collaborative list can add; a viewer, or an editor once the list is private again, can't
      - nobody can change a link in place, and outsiders can't read or remove the owner's links
    - **Migration run in Supabase 2026-11-09.** Checked afterwards on real data: saving an item the way the deployed code does (delete all links, re-add) still works, and an outsider adding to the public list is refused. No new Supabase security warnings.
  - Description: the `item_lists_item_owner` rule only checks that you own the item, so you can attach it to any list, and public list ids are readable by everyone. Require list access too, in the database and in the route.
  - Acceptance:
    - New migration replaces the rule's `with check` with: you own the item **and** (you own the list **or** you are its `editor`/`admin` member). Reads and deletes keep working as before. `schema.sql` updated.
    - `PUT /api/items/[id]/associations` checks `listIds` is an array of at most 50 UUID strings and that the caller may edit every one, **before** deleting existing rows; otherwise 400/403 with nothing changed.
    - The UI's list picker still works for own lists and lists where you're editor/admin.
  - Verification: second account inserts `{item_id: <their item>, list_id: <your public list>}` straight through the Supabase client → refused by the database rule; same through the route → 403; your normal add/remove still works. A pure helper (e.g. `parseListIds`) gets unit tests.
  - Dependencies: none
  - Files: `supabase/migrations/20261024_item_lists_check.sql`, `supabase/schema.sql`, `app/api/items/[id]/associations/route.ts`, `lib/access.ts`
  - Scope: M

- [x] **Task 4: Invite links expire and have a use limit**
  - **Built 2026-11-09** (branch `security-task-4`), using the proposed numbers from open question 1. Migration `supabase/migrations/20261109_invite_expiry.sql` (not `20261025_…`).
    - **Limits:** invites expire after 14 days. Email invites work once; copyable links work 25 times. The one existing invite (from May) gets 25 uses and 14 days from when the migration runs. In the database, new invites are capped at 30 days (on creation) and 100 uses.
    - **Joining:** the join route checks the invite first. It doesn't use up an invite when an existing member with the same role opens it again. It counts the use with `redeem_list_invite()`, one database step that also checks expiry and uses, so two people can't both use a single-use invite. Only the server may call it.
    - **Messages:** unknown, expired and used-up invites all answer with the same 404: "This invite has expired or is no longer valid. Ask for a new link." Signed-out joiners get "Sign in to join this list" instead of "Unauthorized".
    - **Sharing settings:** "Active links" only lists invites that still work, with "Expires in N days · 3 of 25 used" or "single use". The invite email says the link works once and expires in 14 days.
    - **Tested** on the live database in a rolled-back transaction. The existing invite gets 25 uses / 14 days; a new email invite gets 1 use / 14 days; a year-long invite is capped to 30 days; 1000 uses are refused; owners can't edit an invite's expiry; a single-use invite works once, then not again; expired and unknown tokens don't work; signed-in and signed-out users can't count a use directly. The first test run caught a rule that would have rejected the existing invite, now fixed.
    - **Order:** run the migration **before** deploying. The new code reads the new columns and calls `redeem_list_invite()`.
  - Description: invite tokens never expire and can be used without limit, including admin invites.
  - Acceptance:
    - Migration adds `expires_at` (default `now() + 14 days`), `max_uses` and `use_count` to `list_invites`; existing invites get a 14-day expiry. `schema.sql` updated.
    - Email invites are created with `max_uses = 1`; copyable links with the agreed limit (open question 1).
    - `GET` and `POST /api/lists/join/[token]` treat expired or used-up tokens as invalid (404, same message as an unknown token). Redeeming increments `use_count` in a single conditional update so two people can't race past the limit.
    - The join page shows a clear "This invite has expired" message.
  - Verification: an invite with `expires_at` in the past → join refused; a single-use invite joined twice by two accounts → second refused; a fresh invite still works. Unit test for the "is this invite usable" helper.
  - Dependencies: none
  - Files: `supabase/migrations/20261025_invite_expiry.sql`, `supabase/schema.sql`, `app/api/lists/join/[token]/route.ts`, `app/api/lists/[id]/members/route.ts`, `app/api/lists/[id]/invite/route.ts`
  - Scope: M

- [ ] **Checkpoint 2:** you run both migrations in Supabase; repeat the second-account checks from Tasks 3–4 against the deployed app.

## Phase 3: Abuse limits and headers

> **Refined 2026-11-09** after Phases 1–2 shipped. Changes from the October draft: the limiter function lives in `public` with execute for `service_role` only (like `redeem_list_invite`; the `private` schema isn't reachable through the API), old rows are cleaned up, the per-item search limit is keyed on the search itself so editing a search can always rescan, and the CSP follows the Next.js "without nonces" option (see the plan). Numbers are open question 2.
>
> Order: Task 8 has no dependencies and can ship first or alongside. Tasks 6 and 7 need Task 5. Each task is its own PR; the Task 5 migration runs before Tasks 6–7 deploy (the limiter fails open without it, so the order can't break anything).

- [ ] **Task 5: Shared rate limiter**
  - Description: a Postgres-backed fixed-window counter, so limits hold across Vercel's serverless instances (an in-memory counter would reset per instance).
  - Acceptance:
    - Migration adds `rate_limits(key text, window_start timestamptz, count int, primary key (key, window_start))` with RLS on and no user rules, and `hit_rate_limit(p_key text, p_window_seconds int, p_max int) returns boolean`: one statement that counts the hit in the current window and returns whether it's allowed. Execute for `service_role` only; signed-in and signed-out users can't call it. It also deletes windows older than a day, so the table stays small.
    - `lib/rateLimit.ts` exposes `rateLimit(key, windowSeconds, max)`. It calls the function with `db()` and **fails open**: if the function is missing or errors, it allows the request and logs, so deploying before the migration (or a database hiccup) never blocks people.
    - Pure helpers (key building, reading the result) are unit-tested; the database call is the only untested line.
  - Verification: `npm test`; in a rolled-back transaction on the live database, `max + 1` calls in one window → the last returns false; a new window allows again; `anon` and `authenticated` get "permission denied".
  - Dependencies: none
  - Files: `supabase/migrations/20261110_rate_limits.sql`, `supabase/schema.sql`, `lib/rateLimit.ts`, `lib/rateLimit.test.ts`
  - Scope: S

- [ ] **Task 6: Rate-limit invite emails**
  - Description: stop the email-invite endpoint being used to send mail from Kompi's address to strangers in bulk.
  - Acceptance:
    - `POST /api/lists/[id]/members` checks the email first: valid format, at most 254 characters, else 400.
    - Then the limit (open question 2; proposed 20 per user per day), else 429 "You've sent a lot of invites today. Try again tomorrow." **before** an invite is created or any mail is sent.
    - The invite form in the list's sharing settings shows the 400/429 message (it already shows `error` text; check it does for these).
  - Verification: unit test for the email check; with the limit temporarily set to 2 in a dev run, the 3rd invite → 429 and no invite row created.
  - Dependencies: Task 5
  - Files: `app/api/lists/[id]/members/route.ts`, `lib/lists/invites.ts` (email check), `lib/lists/invites.test.ts`, `components/GroupSheets.tsx`
  - Scope: S

- [ ] **Task 7: Rate-limit searches**
  - Description: cap how often one user can start a search (the scrape route), to protect hosting cost and keep the marketplaces from blocking Kompi's server.
  - Acceptance:
    - Two limits, checked after the owner check and **before** any outbound request; either one → 429 with `{ error, retryAfter }`:
      - **Same search again:** keyed on item + the search itself (name, category, filters), so saving a changed search always gets a fresh search. Proposed: once per 60 seconds.
      - **Per user:** proposed 40 searches per hour (adding a dozen items in a row stays well under).
    - The scan screen shows "You searched this a moment ago. Try again in a minute." instead of "The search could not finish". The watchlist's automatic search on a new item keeps its placeholder (it already handles a failed search).
    - The 3-hourly GitHub job is unaffected (it doesn't use this route).
  - Verification: unit test for the search signature (same search → same key; changed name, category or filters → new key); in a dev run, Refresh twice → second shows the message; editing the name and saving still searches.
  - Dependencies: Task 5
  - Files: `app/api/scrape/[itemId]/stream/route.ts`, `components/ScrapeProgress.tsx`, `lib/rateLimit.ts` (signature), `lib/rateLimit.test.ts`
  - Scope: S

- [ ] **Task 8: Security headers (CSP report-only)**
  - Description: the standard headers through `headers()` in `next.config.ts`, following the Next.js CSP guide's "Without Nonces" option (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
  - Acceptance:
    - Enforced on every route:
      - `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`
      - `Referrer-Policy: strict-origin-when-cross-origin`
      - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
      - `Strict-Transport-Security: max-age=31536000` (production only)
    - `Content-Security-Policy-Report-Only`:
      - `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev only); `style-src 'self' 'unsafe-inline'`
      - `img-src 'self' https: data: blob:` (listing photos come from every marketplace); `font-src 'self'` (next/font self-hosts)
      - `connect-src 'self'` + the Supabase URL (used by the browser on the invite, password and settings pages)
      - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`
  - Verification: `curl -I` on `/login` and `/watchlist` in the preview deploy shows every header; browse login, watchlist, an item, a scan, settings and an invite page with the console open and list every CSP report in this file.
  - Dependencies: none
  - Files: `next.config.ts`
  - Scope: XS

- [ ] **Checkpoint 3:** the rate-limit migration is run; limits fire in production (a quick double Refresh); headers present on the live site; CSP reports reviewed. If the console shows no reports after a week of normal use, switch the CSP from report-only to enforced (one-line change, can ride along with Phase 4).

## Phase 4: Clean-up

- [ ] **Task 9: Generic errors in item and listing routes**
  - Description: stop sending raw database error text to the browser.
  - Acceptance:
    - New `lib/apiError.ts` with `serverError(context, error)` that logs the details with `console.error` and returns `{ error: 'Something went wrong' }` with status 500.
    - Every `error.message` response under `app/api/items/**`, `app/api/listings/**` and `app/api/scrape/**` uses it.
    - Deliberate user-facing messages (400/404 texts) are unchanged.
  - Verification: `grep -rn "error.message" app/api/items app/api/listings app/api/scrape` → nothing; unit test for `serverError`.
  - Dependencies: none
  - Files: `lib/apiError.ts`, `lib/apiError.test.ts`, the 5–6 route files under `app/api/items`, `app/api/listings`
  - Scope: M

- [ ] **Task 10: Generic errors in list and profile routes**
  - Acceptance:
    - The same for `app/api/lists/**` and `app/api/profile/**`, except the friendly "already following" case.
    - `loginAction`/`signupAction` keep Supabase's auth messages (they're meant for users) but never include anything else.
  - Verification: `grep -rn "error.message" app/api` → nothing.
  - Dependencies: Task 9
  - Files: route files under `app/api/lists`, `app/api/profile` (about 10 files, but each is a one-line mechanical swap)
  - Scope: M

- [ ] **Task 11: Member emails for owners and admins only**
  - Description: `GET /api/lists/[id]/members` returns every member's email to anyone on the list.
  - Acceptance:
    - Owners and admins get emails as today; editors and viewers get `email: ''` (name and role only).
    - The members panel (shown only to owners/admins today) is unchanged.
  - Verification: as a viewer, call the endpoint → no emails; as owner → emails present.
  - Dependencies: none
  - Files: `app/api/lists/[id]/members/route.ts`
  - Scope: XS

- [ ] **Task 12: Input caps for items**
  - Acceptance:
    - Item `name` ≤ 120 characters; prices are whole numbers ≥ 0 or empty; else 400. Same rules on create and edit.
    - The checks live in a small `lib/validate.ts` with unit tests; both item routes call it.
  - Verification: unit tests for each rule; a 500-character name through the route → 400.
  - Dependencies: none
  - Files: `lib/validate.ts`, `lib/validate.test.ts`, `app/api/items/route.ts`, `app/api/items/[id]/route.ts`
  - Scope: S

- [ ] **Task 13: Input caps for lists, plus database limits**
  - Acceptance:
    - List `name` ≤ 60 characters; `color` must be one of the colors in `lib/colors.ts`, else 400. Same rules on create and edit (rules added to `lib/validate.ts`).
    - A migration adds `check` constraints for item and list name lengths, so direct client writes are capped too. Existing rows are checked first; any too long are reported, not truncated.
  - Verification: unit tests; a bad color → 400; a 500-character list name through the Supabase client → refused.
  - Dependencies: Task 12
  - Files: `lib/validate.ts`, `lib/validate.test.ts`, `app/api/lists/route.ts`, `app/api/lists/[id]/route.ts`, `supabase/migrations/20261027_length_caps.sql`
  - Scope: M

- [ ] **Checkpoint: Complete**
  - [ ] Every acceptance criterion above met; standing bar green
  - [ ] `npm audit --omit=dev` clean
  - [ ] CSP reports clean for a week → switch to enforced `Content-Security-Policy`
  - [ ] Re-run the security check; open PR(s)
