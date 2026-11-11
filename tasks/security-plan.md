# Implementation Plan: Security hardening

Source: security check of 2026-10-21 (findings 1–10 below). Tasks: `tasks/security-todo.md`. Branch: `worktree-security-hardening`, from `main` at `bc0435f`.
The search phase 5 plan in `tasks/plan.md` / `tasks/todo.md` is left untouched.

## Overview
Fix the problems the security check found, the worst first. One high-severity bug in our own code (anyone can change another user's listings through the scrape route), known vulnerabilities in our dependencies (one critical, in Next.js), then the database-rule gaps, abuse limits, headers, and smaller clean-ups. Each task ships on its own and leaves the app working.

| # | Finding | Severity | Task |
|---|---|---|---|
| 1 | Scrape route lets list followers rewrite and prune another user's listings | High | 1 |
| 2 | `next@16.2.6` (critical), axios, undici, follow-redirects, form-data, postcss advisories | High | 2 |
| 3 | `item_lists` rule lets anyone attach their item to any list | Medium | 3 |
| 4 | Invite links never expire and can be reused without limit, including admin invites | Medium | 4 |
| 5 | Invite email endpoint has no rate limit (spam/phishing via our sender) | Medium | 5, 6 |
| 6 | No security headers (CSP, frame-ancestors, nosniff) | Medium | 8 |
| 7 | Raw database error text returned in 26 API responses | Low | 9, 10 |
| 8 | Every list member (viewers too) can see all member emails | Low | 11 |
| 9 | No length caps on names; list `color` not checked | Low | 12, 13 |
| 10 | Scrape endpoint can be triggered without limit | Low | 7 |

## Architecture decisions
- **The database rules (RLS) are the real boundary.** The Supabase public key ships to the browser, so anyone signed in can query tables directly and skip our API routes. Permission fixes go into a migration first, and the route checks second (to give clear errors).
- **Routes that use the admin key (`db()`) must prove ownership themselves**, because that key skips every database rule. Task 1 fixes the one route that doesn't.
- **Rate limits are kept in Postgres, not in memory.** On Vercel each request can land on a different instance, so an in-memory counter never fires. A `rate_limits` table plus a `hit_rate_limit(key, window, max)` function gives one shared counter with no new service. *(Refined 2026-11-09:)* the function lives in `public` with execute for `service_role` only, like `redeem_list_invite` (the `private` schema isn't exposed to the API), and **fails open**: a missing function or a database error never blocks people.
- **Search limits are keyed on the search itself** *(added 2026-11-09)*. The app searches right after an item is added and again after its search is edited. A plain per-item limit would block that second search, so the per-item key includes the item's name, category and filters; a changed search always gets a fresh search. A separate per-user hourly cap protects hosting cost.
- **CSP starts in report-only mode, without nonces** *(nonces decided 2026-11-09)*. Listing images come from many hosts and Next.js adds inline scripts. A wrong policy would break the app silently, so we ship the other headers enforced and run the CSP as `Content-Security-Policy-Report-Only` until the browser console shows no violations, then switch it on. Per the Next.js CSP guide, nonces would force every page to render per request and need the middleware to build the header. The "without nonces" option in `next.config.ts` keeps `'unsafe-inline'` for scripts but still blocks framing, plugins, foreign form targets and unknown connections. Nonces can come later if needed.
- **Pure checks move into `lib/` so they can be unit-tested** with the existing `npm test` (tsx --test). There are no route-level tests today, and this plan doesn't add a test framework.
- **Migrations are new files** (`supabase/migrations/2026102x_*.sql`) with `schema.sql` updated to match, following the existing convention. You run them in Supabase by hand at the checkpoints.

## Task list
See `tasks/security-todo.md` for acceptance criteria and verification.

### Phase 1: High severity (fail fast)
- [x] Task 1: Scrape only your own items (PR #2)
- [x] Task 2: Upgrade Next.js and fix vulnerable dependencies (PR #2; undici in #4; follow-redirects from 2026-11-15)

### Checkpoint 1
- [x] Tests, lint, type check and build green; `npm audit --omit=dev` has no critical left; deployed 2026-11-05

### Phase 2: Database rules
- [x] Task 3: Only add items to lists you may edit (PR #4, migration run)
- [x] Task 4: Invite links expire and have a use limit (PR #6, migration run)
- Also done, outside the original list: sharing read rules (PR #3), database security gaps (PR #5), invite page for signed-out visitors (PR #7). See `tasks/schema-drift.md`.

### Checkpoint 2
- [x] Migrations run; second-account checks done 2026-11-09 (the earselect account's favourites and removals stay its own)

### Phase 3: Abuse limits and headers (refined 2026-11-09)
- [x] Task 5: Shared rate limiter (PR #8, migration run)
- [x] Task 6: Rate-limit invite emails (PR #8)
- [x] Task 7: Rate-limit searches (PR #8)
- [x] Task 8: Security headers, CSP report-only (PR #8)

### Checkpoint 3
- [x] Rate-limit migration run; limits fire in production (double Refresh checked 2026-11-09); headers present on the live site
- [ ] CSP reports reviewed after a week of use (around 2026-11-16)

### Phase 4: Clean-up
- [x] Task 9: Generic errors in item and listing routes (PR #9)
- [x] Task 10: Generic errors in list and profile routes (PR #9)
- [x] Task 11: Member emails for owners and admins only (PR #9)
- [x] Task 12: Input caps for items (PR #9)
- [x] Task 13: Input caps for lists, plus database limits (PR #9, migration run)

### Checkpoint: Complete
- [x] All tasks built, deployed and their migrations run (2026-11-09)
- [ ] `npm audit --omit=dev` clean: follow-redirects fix allowed from 2026-11-15
- [ ] Switch the CSP to enforced if reports are clean (around 2026-11-16)

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Next 16.2 → 16.4 changes behaviour (middleware, caching, Server Actions) | High | Read `node_modules/next/dist/docs/` upgrade notes first (AGENTS.md rule); full build and a click-through of login, watchlist, item page, scrape and join |
| Tightening the `item_lists` rule breaks re-saving an item that a viewer had already put in a shared list | Medium | Route checks all list ids **before** deleting old rows and returns 403 without changing anything; existing rows stay (the rule only checks new writes) |
| CSP blocks images or Next.js scripts | Medium | Report-only first; `img-src https: data:`; enforce only after a clean run |
| Rate limits too tight for normal use (e.g. re-scanning after editing an item) | Low | Per-item key includes the search, so an edited search is never blocked; generous numbers to start (open question 2); limits live in one place |
| Rate limiter breaks the app (migration missing, database slow or down) | Medium | Fails open: allows the request and logs |
| CSP report-only gives a false sense of safety | Low | Other headers are enforced from day one; Checkpoint 3 sets a date to switch the CSP on |
| Existing invite links stop working when expiry lands | Low | Migration gives existing invites `expires_at = now() + 14 days` instead of expiring them at once |
| Migrations not run before the code that needs them is deployed | Medium | Code tolerates a missing column/function where possible; checkpoints say when to run each migration |

## Open questions
1. ~~**Invite lifetime and uses.**~~ Built with the proposal (14 days; email single-use; links 25 uses) in PR #6. Change in `lib/lists/invites.ts` if needed.
2. **Rate-limit numbers.** *Updated proposal (2026-11-09):*
   - invite emails: 20 per user per day
   - the same search again: once per 60 seconds per item and search (a changed search is always allowed)
   - searches per user: 40 per hour

   The October numbers (one run per item per 2 minutes, 30 per user per hour) would have blocked the second search right after adding and then editing an item, and come close to blocking someone adding many items in a row. OK?
3. **Joining flips a list to "collaborative".** Keep this as is (the owner chose to invite), or only allow joining lists that are already collaborative?
4. **Release order.** Ship Phase 1 on its own PR straight away (recommended, since it holds the high-severity fixes), or everything in one PR?
