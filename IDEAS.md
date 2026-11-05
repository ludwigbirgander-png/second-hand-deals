# Kompi ideas

Ideas saved for later. Nothing here is planned or built.

## To do: favourites when a listing sells
Saved 2026-11-05. Change how favourites behave once the listing is sold or taken down. How it should work is still to be decided.

- **How it works today:** searches delete listings that stop showing up (sold or taken down), but never favourites. A sold favourite stays on the item page and in the favourites view forever, with its last known price and a link that no longer works. Nothing marks it as gone. Auctions are the exception: an ended auction is hidden unless it's a favourite, and then it stays.
- **This now applies to everyone:** the owner's favourites live on the listing (`listings.starred`); followers' and list members' favourites live in `listing_marks` and are kept the same way.
- **Things to decide:**
  - How to tell it's sold: not seen for N searches or days (`last_seen_at`), an ended auction, or a check of the listing page.
  - What the user sees: a "Sold" or "Gone" badge, greyed out, moved to a "Sold" section, or removed after a while.
  - What alerts should do: the target-price alert skips ended auctions, but can't tell a sold fixed-price favourite from a live one.
  - Whether to keep the last price as a record of what it went for.

## Push notifications on mobile
Saved 2026-10-17, not part of any plan yet. It would add phone notifications as a second channel for Kompi's alerts, with no App Store app needed ("web push"). It only makes sense once the email alerts in SEARCH-PLAN.md work.

- **How it works for the user:**
  - **iPhone:** open Kompi in Safari → Share → "Add to Home Screen". Apple only allows push for websites installed this way, and needs iOS 16.4 or later.
  - **Android:** works in Chrome directly; installing is optional.
  - In Settings, a "Phone notifications" switch triggers the phone's own "Allow notifications?" question. Each allowed device is saved to the account.
  - Alerts appear on the lock screen, for example "Under your target: Lilla Åland stol, 1 200 kr". Tapping one opens the listing in Kompi.
- **To build:**
  1. Make Kompi installable: a web app manifest with name, icon and colours.
  2. Add a service worker that receives and shows notifications.
  3. Create VAPID keys (env vars) and a `push_subscriptions (user_id, endpoint, keys, created_at)` table.
  4. Send from the alert job with the `web-push` library, next to the email, and delete subscriptions that report as expired.
  5. Add per-user settings for which alerts go to the phone, email or both.
- **Trade-offs:**
  - On iPhone it only works after "Add to Home Screen", so email stays the baseline.
  - Notifications are only as fast as the alert check, which runs every 3 hours.
