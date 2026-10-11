# Auction sites — suggestions and integration plan

## Status (2026-10-11, branch `auction-sites`)

- **Done:**
  - Steps 0–4, 6 and 7, plus Auctionet and Bukowskis.
  - Tradera API support (step 5). It switches on once `TRADERA_APP_ID` and `TRADERA_APP_KEY` are set.
- **Before deploying:** run `supabase/migrations/20261011_auction_sites.sql` in the Supabase SQL editor.
- **Tradera API:** register at https://api.tradera.com/register. Add both keys in Vercel and as GitHub Action secrets, then capture a real response to replace the hand-written `__fixtures__/tradera-api-search.json`.
- **Pantbanken and Klaravik:** left out by choice.
- **Tests:** `npm test` runs the parser tests on saved responses. `npm run check:scrapers` searches every site live.

Researched 2026-10-11. There is no public ranking of Swedish auction sites by traffic, so the order below comes from reach, how well the site fits Kompi's items (design, furniture, clothes, electronics, watches) and how easy it is to search from code. Every site was tested with a real search request from a script.

## Suggested sites

### Tier 1: add first

| Site | What's on it | How to search it | Notes |
|---|---|---|---|
| **Auctionet** (auctionet.com) | 60+ auction houses, among them Stockholms Auktionsverk, Kolonn and many local houses. Design, furniture, art, silver, watches. | Public JSON API: `GET https://auctionet.com/api/v2/items.json?q=…&per_page=50`. It returns title, current bids, starting bid, estimate, `ends_at` (Unix time), images, house, location and currency. | Easiest and most valuable to add. Results include houses in Denmark, Germany and Finland (EUR and DKK prices, Danish or German titles), so keep only `currency === 'SEK'` at first. The end time comes in the search response, so no per-listing enrichment is needed. |
| **Tradera auctions** (already added) | Sweden's largest consumer auction site. | The official Tradera API (api.tradera.com, free app key). | The current scraper loads `tradera.com/search?…`, which Tradera's `robots.txt` disallows (`Disallow: /search?*`). Moving to the API fixes that and returns the end time and bids in the same call, so the slow per-listing enrichment can go. The limits aren't clear: v3 docs say 100 calls a day, v4 (REST, beta) reportedly allows 10,000 a day. Ask apiadmin@tradera.com. Also check that the scraper includes auctions and not only Buy now (`saleType=1` didn't visibly change the results). |

### Tier 2: worth adding, but needs HTML parsing

| Site | What's on it | How to search it | Notes |
|---|---|---|---|
| **Bukowskis** (bukowskis.com) | High-end design, art, watches, jewellery. Online auctions every day. | The pages are rendered on the server with lot links like `/sv/lots/1712364-…`. `robots.txt` allows it. | Confirm the search parameter first: `?q=eames` returned generic lots, not Eames results. |
| **Pantbanken** (pantbanken.se/auktioner) | Watches, jewellery, gold, electronics and designer bags from pawned items. | `/auktioner/?fritext=rolex&length=20` returns rendered results. | Keep away from `/auktioner/avslutade-auktioner`, which `robots.txt` disallows. Good fit for watches and jewellery. |
| **Klaravik** (klaravik.se) | Machines, tools, vehicles and garden equipment. | `/auktion/?searchtext=…` works and the page includes `ld+json`. | Only useful if Kompi users track tools and vehicles. Turn it off by default. |

### Tier 3: skip for now

| Site | Why |
|---|---|
| **Lauritz.com** | Blocks scripted requests (HTTP 403). Its status in Sweden is unclear too: there are both bankruptcy reports and expansion news. |
| **Blinto** | Behind a Cloudflare bot challenge (403 `cf-mitigated: challenge`). Getting past it would mean bypassing bot protection, which we shouldn't do. |
| **Barnebys** | Collects listings from many auction houses, but its `robots.txt` says crawling is prohibited without written permission. Only worth it through a partnership. |
| **KVD, Bilweb Auctions, Tovek, Hoba, PS Auction** | Cars, machinery and farm equipment, which doesn't fit Kompi's items. |

## Integration plan

### 0. Make the search fast enough first (required)
Today both `app/api/scrape/[itemId]/stream/route.ts` and `scrapeItem()` in `lib/scrapers/index.ts` search sites **one after another**. They pause 800–1000 ms between sites, and Blocket and Tradera fetch every listing page for enrichment, all inside `maxDuration = 60`. Adding 2–4 more sites would hit that limit.
- Run all sites at once with `Promise.allSettled`, and send each site's `start`/`done` event as it finishes. `ScrapeProgress` already handles any order.
- Give each site its own timeout (for example 15 s, using `AbortSignal.timeout`). A site that times out counts as failed, so its old listings aren't removed.
- Keep a short delay only between requests to the **same** site (enrichment batches).

### 1. Data model (one migration)
- Add rows to `site_configs`:
  - `Auctionet` and `Bukowskis`: on by default.
  - `Pantbanken` and `Klaravik`: off by default (`enabled false`).
- Add `site_configs.kind text not null default 'marketplace'`, with `'auction'` for the auction houses, so Settings can group them.
- Add `listings.price_kind text` (`'fixed' | 'bid' | 'start'`) and `listings.bid_count int`, so the app can tell "1 200 kr Buy now" apart from "1 200 kr current bid".
- Extend `ScrapedListing` in `lib/types.ts` with `priceKind?` and `bidCount?`. Write both in the upsert in the stream route and in `scripts/daily-scrape.ts`.

### 2. Scrapers
- `lib/scrapers/auctionet.ts`:
  - Call the JSON API. Keep only `currency === 'SEK'` and `state === 'published'`, and drop items whose `ends_at` has passed.
  - Price is the highest bid if there are bids, otherwise the starting bid (`priceKind: 'start'`).
  - `auctionEndsAt = new Date(ends_at * 1000)`, `location = house + ', ' + location`, and `imageUrl` = the first image's thumbnail.
- `lib/scrapers/bukowskis.ts`, `pantbanken.ts` and `klaravik.ts`: cheerio parsers in the same style as `tradera.ts`.
- Register them in `SCRAPERS`. The stream route and the daily GitHub Action both read that map, so the sites appear in both places.
- Check that `isRelevant()` copes with auction-style titles such as `"STOL, 'Lounge chair', Charles & Ray Eames"`. The word-match approach should work, but test it against real titles.

### 3. Auction life cycle
- When an auction ends it stops appearing in search results, so the existing prune step removes it on the next run. Between runs, the UI should hide or grey out listings whose `auction_ends_at < now()`, except starred ones.
- The price-range filter should compare the current bid. Mark bid prices as "current bid" because they will go up.
- Later: an "Ending soon" email for starred auctions, building on the price-drop idea in REVIEW.md.

### 4. UI
- Add `--site-auctionet`, `--site-bukowskis`, `--site-pantbanken` and `--site-klaravik` to `globals.css`, and add the sites to `SITE_COLORS` in `lib/colors.ts`.
- Settings sheet: split the site toggles into "Marketplaces" and "Auction houses" using `site_configs.kind`.
- `ListingCard`: show "Bid" or "Start price" next to the price when `price_kind !== 'fixed'`, plus the bid count. The countdown already exists (`useAuctionCountdown`).
- `ListingGrid`: add an "Ending soon" sort.

### 5. Tradera to the official API
Register a Tradera developer app, put the AppId and AppKey in env vars (Vercel and the GitHub Action secrets), and replace the HTML scraper and `enrich()` with the search API. Do this as its own change, because the daily call limit decides how often items can be searched.

### 6. Testing and upkeep
- Save one real response per site under `lib/scrapers/__fixtures__/` and write parser tests against it. When a site changes its markup, the test shows exactly what broke.
- Add `scripts/check-scrapers.ts`: it runs one known query per site and prints the count. If a site returns 0, set `unreliable = true` (the Settings sheet already shows a note for that).
- Be a good citizen: at most 50 results per query, one request at a time per site, respect `robots.txt`, and link out to the site for bidding. Kompi never places bids.

### Order of work
1. Parallel search and per-site timeouts (step 0).
2. Migration, plus Auctionet, the UI labels and the colour. Ship.
3. Bukowskis and Pantbanken. Ship.
4. Tradera API migration (needs the app key).
5. Klaravik, if users ask for it.
