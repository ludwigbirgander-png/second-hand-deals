# Todo: Security hardening

Plan: `tasks/security-plan.md`.
Every task also clears the standing bar: `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass. "Second account" means a separate test user signed in in a private window.

## Phase 1: High severity

- [ ] **Task 1: Scrape only your own items**
  - Description: `app/api/scrape/[itemId]/stream/route.ts` reads the item with the user's session, which also returns items in public lists the user follows, and then writes and deletes listings with the admin key. Limit it to items the caller owns.
  - Acceptance:
    - The item query adds `.eq('user_id', user.id)`; anyone else gets 404 before any database write.
    - The owner's scrape behaves exactly as before.
  - Verification: second account follows a public list containing your item and POSTs `/api/scrape/<itemId>/stream` → 404, and your listing count is unchanged; your own scan still streams results.
  - Dependencies: none
  - Files: `app/api/scrape/[itemId]/stream/route.ts`
  - Scope: XS

- [ ] **Task 2: Upgrade Next.js and fix vulnerable dependencies**
  - Description: move `next` and `eslint-config-next` to `16.4.2` and apply the non-forced `npm audit fix` (axios, undici, follow-redirects, form-data, nanoid, source-map-js, baseline-browser-mapping). Never `--force`.
  - Acceptance:
    - `npm audit --omit=dev` reports no high or critical issues (or each one left is written here with a reason and a review date).
    - Release notes / `node_modules/next/dist/docs/` checked for 16.3–16.4 changes affecting `middleware.ts`, route handlers or Server Actions; any needed changes made.
    - Only `package.json` and `package-lock.json` change, unless the docs require code changes.
  - Verification: `npm ci` from clean; standing bar; manual click-through: sign up, log in, add item, scan, open item, favourite, join a list by link, log out (signed-out visitor is sent to /login).
  - Dependencies: none
  - Files: `package.json`, `package-lock.json`
  - Scope: S

- [ ] **Checkpoint 1:** standing bar green; audit clean; deploy Phase 1 (recommended as its own PR).

## Phase 2: Database rules

- [ ] **Task 3: Only add items to lists you may edit**
  - Description: the `item_lists_item_owner` rule only checks that you own the item, so you can attach it to any list, and public list ids are readable by everyone. Require list access too, in the database and in the route.
  - Acceptance:
    - New migration replaces the rule's `with check` with: you own the item **and** (you own the list **or** you are its `editor`/`admin` member). Reads and deletes keep working as before. `schema.sql` updated.
    - `PUT /api/items/[id]/associations` checks `listIds` is an array of at most 50 UUID strings and that the caller may edit every one, **before** deleting existing rows; otherwise 400/403 with nothing changed.
    - The UI's list picker still works for own lists and lists where you're editor/admin.
  - Verification: second account inserts `{item_id: <their item>, list_id: <your public list>}` straight through the Supabase client → refused by the database rule; same through the route → 403; your normal add/remove still works. A pure helper (e.g. `parseListIds`) gets unit tests.
  - Dependencies: none
  - Files: `supabase/migrations/20261024_item_lists_check.sql`, `supabase/schema.sql`, `app/api/items/[id]/associations/route.ts`, `lib/access.ts`
  - Scope: M

- [ ] **Task 4: Invite links expire and have a use limit**
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

- [ ] **Task 5: Shared rate limiter**
  - Description: a Postgres-backed fixed-window counter, so limits hold across serverless instances.
  - Acceptance:
    - Migration adds a `rate_limits(key text, window_start timestamptz, count int)` table with RLS on and no user policies, plus a `hit_rate_limit(p_key text, p_window_seconds int, p_max int) returns boolean` function (`security definer`, execute granted to `service_role` only) that increments and returns whether the call is allowed.
    - `lib/rateLimit.ts` exposes `rateLimit(key, windowSeconds, max)`; it calls the function with `db()` and **fails open** (allows and logs) if the function is missing, so deploying before the migration doesn't break the app.
  - Verification: unit tests for key building and fail-open handling; in Supabase, calling the function `max + 1` times returns false on the last call.
  - Dependencies: none
  - Files: `supabase/migrations/20261026_rate_limits.sql`, `supabase/schema.sql`, `lib/rateLimit.ts`, `lib/rateLimit.test.ts`
  - Scope: S

- [ ] **Task 6: Rate-limit invite emails**
  - Description: stop the invite endpoint being used to email strangers in bulk.
  - Acceptance:
    - `POST /api/lists/[id]/members` allows the agreed number of emails per user per day (open question 2), then returns 429 with a plain message, before creating an invite or sending mail.
    - The email address is checked for a sane format and length (≤ 254 characters).
    - The invite form shows the 429 message.
  - Verification: the limit + 1 invites in a row → last one 429 and no email sent (Resend dashboard).
  - Dependencies: Task 5
  - Files: `app/api/lists/[id]/members/route.ts`, `components/GroupSheets.tsx`
  - Scope: S

- [ ] **Task 7: Rate-limit scraping**
  - Description: cap how often one user can start scrapes, to protect hosting cost and avoid our server being blocked by the sites.
  - Acceptance:
    - The scrape route allows the agreed rate per item and per user, else 429 before any outbound request.
    - The scan screen shows "Searched a moment ago, try again shortly" instead of a generic error.
    - The scheduled GitHub Actions job is unaffected (it doesn't use this route).
  - Verification: two scans of the same item within the window → second returns 429; scanning a different item still works.
  - Dependencies: Tasks 1, 5
  - Files: `app/api/scrape/[itemId]/stream/route.ts`, `components/ScrapeProgress.tsx`
  - Scope: S

- [ ] **Task 8: Security headers (CSP report-only)**
  - Description: add the standard headers through `headers()` in `next.config.ts` (check the Next.js docs in `node_modules/next/dist/docs/` for the current API and CSP guidance first).
  - Acceptance:
    - Enforced on every route: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` turning off camera, microphone and geolocation.
    - `Content-Security-Policy-Report-Only` with `default-src 'self'`, `img-src 'self' https: data:`, `connect-src 'self'` + the Supabase URL, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and whatever script/style sources Next.js needs per its docs.
  - Verification: `curl -I` on `/login` and `/watchlist` shows the headers; browse login, watchlist, an item, a scan and the profile with DevTools open and note every CSP report.
  - Dependencies: Task 2
  - Files: `next.config.ts`
  - Scope: XS

- [ ] **Checkpoint 3:** you run the rate-limit migration; limits fire in production; headers present; CSP reports reviewed.

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
