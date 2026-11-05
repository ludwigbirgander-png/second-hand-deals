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
- **Rate limits are kept in Postgres, not in memory.** On Vercel each request can land on a different instance, so an in-memory counter never fires. A `rate_limits` table plus a `hit_rate_limit(key, window, max)` function (`security definer`, callable only with the admin key) gives one shared counter with no new service.
- **CSP starts in report-only mode.** Listing images come from many hosts and Next.js adds inline scripts. A wrong policy would break the app silently, so we ship the other headers enforced and run the CSP as `Content-Security-Policy-Report-Only` until the browser console shows no violations, then switch it on.
- **Pure checks move into `lib/` so they can be unit-tested** with the existing `npm test` (tsx --test). There are no route-level tests today, and this plan doesn't add a test framework.
- **Migrations are new files** (`supabase/migrations/2026102x_*.sql`) with `schema.sql` updated to match, following the existing convention. You run them in Supabase by hand at the checkpoints.

## Task list
See `tasks/security-todo.md` for acceptance criteria and verification.

### Phase 1: High severity (fail fast)
- [ ] Task 1: Scrape only your own items
- [ ] Task 2: Upgrade Next.js and fix vulnerable dependencies

### Checkpoint 1
- [ ] Tests, lint, type check and build green; `npm audit --omit=dev` has no high/critical left; deploy

### Phase 2: Database rules
- [ ] Task 3: Only add items to lists you may edit
- [ ] Task 4: Invite links expire and have a use limit

### Checkpoint 2
- [ ] You run the two migrations in Supabase; second-account abuse checks pass

### Phase 3: Abuse limits and headers
- [ ] Task 5: Shared rate limiter
- [ ] Task 6: Rate-limit invite emails
- [ ] Task 7: Rate-limit scraping
- [ ] Task 8: Security headers (CSP report-only)

### Checkpoint 3
- [ ] Rate-limit migration run; limits fire; headers present; no CSP reports on main pages

### Phase 4: Clean-up
- [ ] Task 9: Generic errors in item and listing routes
- [ ] Task 10: Generic errors in list and profile routes
- [ ] Task 11: Member emails for owners and admins only
- [ ] Task 12: Input caps for items
- [ ] Task 13: Input caps for lists, plus database limits

### Checkpoint: Complete
- [ ] All acceptance criteria met; audit clean; switch CSP to enforced if reports are clean; open PR

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Next 16.2 → 16.4 changes behaviour (middleware, caching, Server Actions) | High | Read `node_modules/next/dist/docs/` upgrade notes first (AGENTS.md rule); full build and a click-through of login, watchlist, item page, scrape and join |
| Tightening the `item_lists` rule breaks re-saving an item that a viewer had already put in a shared list | Medium | Route checks all list ids **before** deleting old rows and returns 403 without changing anything; existing rows stay (the rule only checks new writes) |
| CSP blocks images or Next.js scripts | Medium | Report-only first; `img-src https: data:`; enforce only after a clean run |
| Rate limits too tight for normal use (e.g. re-scanning after editing an item) | Low | Generous numbers to start (see open questions); limits live in one place |
| Existing invite links stop working when expiry lands | Low | Migration gives existing invites `expires_at = now() + 14 days` instead of expiring them at once |
| Migrations not run before the code that needs them is deployed | Medium | Code tolerates a missing column/function where possible; checkpoints say when to run each migration |

## Open questions
1. **Invite lifetime and uses.** Proposal: links expire after 14 days; email invites are single-use; copyable links allow up to 25 uses. OK?
2. **Rate-limit numbers.** Proposal: invite emails 20 per user per day; scraping one run per item per 2 minutes and 30 runs per user per hour. OK?
3. **Joining flips a list to "collaborative".** Keep this as is (the owner chose to invite), or only allow joining lists that are already collaborative?
4. **Release order.** Ship Phase 1 on its own PR straight away (recommended, since it holds the high-severity fixes), or everything in one PR?
