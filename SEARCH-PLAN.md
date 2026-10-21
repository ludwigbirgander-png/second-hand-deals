# Kompi search: categories and precision plan

Written 2026-10-17. **Status:** phases 1 and 2 built on branch `search-phase-1-2` (needs `supabase/migrations/20261018_remove_and_match.sql`). Phase 3 built on `search-phase-3`, on top of it (needs `supabase/migrations/20261020_alerts.sql`). Phases 1–3 merged into `main` 2026-10-20. Phase 4 built on `search-phase-4` (needs `supabase/migrations/20261021_categories.sql`); see "Phase 4 as built". Phase 5 built on `search-phase-5` (needs `supabase/migrations/20261022_merge_brand.sql`); see "Phase 5 as built" and `SPEC-categories-phase-5.md`. Decisions from 2026-10-17 are under "Beyond categories: decided features" and "Phases".

## Context
Today a Kompi item is only a name, an optional brand and a price range (`items` table). Kompi sends the same text query to every site and keeps a listing when every word of 3+ letters appears in its title (`isRelevant` in `lib/scrapers/index.ts`). That causes three problems:
- **Noise:** cases, boxes and broken items come through, along with the wrong size.
- **Missed matches:** "Eames chair" never matches the Swedish title "stol".
- **No way to say what matters:** a size-M jacket, a 256 GB phone or a set of four chairs.

The goal is **categories**. Picking one (for example Clothing) reveals options specific to it (size, department, material…). Kompi pushes those options down to each site's own filters where it can, and filters the rest itself. The plan also covers improvements outside categories.

Decision so far: AI-assisted features go in a **later, optional phase**.

## How other sites do it (inspiration)
- **Vinted:** pick a category tree (Women > Clothes > Jackets) and the filters change to size (by type), brand, condition (5 levels), colour, material and price.
- **Sellpy:** facets per item type: size, department, colour, material, condition, season. Even measurements in cm (waist, inner leg) for trousers.
- **Blocket:** category and sub-category first. Some categories add their own fields (cars: year, mileage). Location and "ships / pickup only".
- **Tradera:** category plus attributes such as "Skick" (condition) and brand. Auction or Buy now. County or postcode.
- **eBay:** "item specifics" per category, such as phones (storage, network, colour) and watches (movement, case size).
- **Chrono24 (watches):** brand, model, reference number, year, box & papers, condition.
- **Back Market (phones):** model, storage, colour and condition grade, with battery health.
- **Discogs (records):** format, pressing and the Goldmine grading scale, with media and sleeve graded separately.

### What Kompi's sites can filter natively (checked 2026-10-17)
| Site | Native filters found | Notes |
|---|---|---|
| Sellpy | Algolia facets: `categories.lvl0–3`, `metadata.size/brand/color/material/condition/type/demography`, measurements (`waistInCm`, `innerLegLengthInCm`…), season, pattern, sleeve length | Very rich; filters go straight into the existing Algolia request |
| Tradera (API) | `CategoryId`, `ItemCondition`, `ItemType` (auction / Buy now), `Brands`, `Attributes`, `PriceMinimum/Maximum`, `CountyId`/`ZipCode`, `SearchInDescription` | Needs the API keys (on hold) |
| Blocket | `category` (e.g. `0.71` Clothes, `0.78` Furniture, `0.93` Electronics) and `sub_category` (`1.71.3941`…) | Deeper filters are unconfirmed |
| Vinted | Catalog URL params `catalog[]`, `size_ids[]`, `brand_ids[]`, `status_ids[]` (condition), `color_ids[]`, `material_ids[]`, `price_from/to` | Commonly used; verify which ones the current HTML scraper honours |
| Auctionet | `category_id` (tested: "stol" goes from 2,935 to 1,858 hits in category 18) | Filters by category, not by size |
| Bukowskis | Category filters on `/sv/lots` | To map |

## Design

### 1. Category model (one declarative file)
Add `lib/categories.ts`, a typed registry. Each category has:
- `id`, `label`, `icon`, and keyword hints for auto-suggesting it from the item name.
- `fields`: `{ key, label, type: 'select' | 'multi' | 'range' | 'size' | 'text' | 'toggle', options, unit }`.
- `sites`: which sites are relevant by default. Phones skip Bukowskis; furniture skips Vinted and Sellpy. This means fewer requests and less noise.
- `toSiteParams(site, filters)`: native filters per site, as in the table above.
- `matches(listing, filters)`: a post-filter for whatever a site couldn't filter.
- `negativeWords`: built-in accessory and junk words for the category.

Nothing about categories is stored in the database except the user's choices. Categories and options can then change in code without migrations.

### 2. Data model (one migration)
- `items.category text null`, `items.filters jsonb not null default '{}'`, (`items.exclude_words` and `listings.removed_at` come earlier, in phase 1.)
- `listings.attributes jsonb`: normalised details pulled from each site (size, condition grade, storage…), used for filtering and shown on cards.

### 3. Search pipeline changes
- Scrapers become `(query, options) => ScrapedListing[]`, where `options` holds `{ category, filters, minPrice, maxPrice }`. Each scraper maps what it can into native params. The current signature in `SCRAPERS` (`lib/scrapers/index.ts`) and `runSite` stay the entry points.
- In `runSite`, after `isRelevant`, the order is:
  1. Exclude words: built-in ones plus the user's own.
  2. `category.matches()`.
  3. Normalise attributes.
- Each filter has a **strict/lenient** setting. In lenient mode a listing whose size is unknown is kept, marked "size not stated". In strict mode it's dropped.
- Condition is normalised to one scale (New with tags / New / Like new / Good / Fair / For parts) from each site's wording: Vinted "Mycket bra skick", Sellpy "Mycket bra", Tradera "Skick", Blocket text.

### 4. UI
- **AddPanel** (`components/AddPanel.tsx`):
  - A row of category chips ("Any", Clothing, Shoes…), reusing `Chip` from `components/ui/Chip.tsx`.
  - Picking one expands its fields below brand and price, built with existing form parts (`Segmented`, `Toggle`, `Input`, `PriceRange` in `components/ui/Form.tsx`).
  - Kompi suggests a category from the item name ("iPhone 13" → Phones), and you can override it.
- **Item page:** active filters shown as chips under the title, editable through the existing Edit panel.
- **Listing cards:** show key attributes (size, storage) and a "Not relevant" action next to the star (`components/ui/Cards.tsx`).

## Categories and their options
Every category also gets the **shared options** (section "Beyond categories" lists more):
- Price range
- Condition
- Sale type (auction / fixed price / both)
- Delivery (ships / pickup within X km)
- Exclude words
- Sites

| Category | Specific options | Built-in exclude words | Best sites |
|---|---|---|---|
| **Clothing** | Department (women / men / kids / unisex); type (jacket, jeans, knit, dress…); size by type (XS–XXL, EU 32–54, jeans W×L, kids 50–170 cl); optional measurements (waist, inner leg cm); colour; material (wool, down, cotton…); season | "endast", "defekt", "fläck" (stain) | Sellpy, Vinted, Tradera, Blocket |
| **Shoes** | Department; type (sneakers, boots, heels…); EU size incl. half sizes, or a size range; colour; material (leather, suede, Gore-Tex) | "endast kartong" (box only), "snören" (laces) | Vinted, Sellpy, Tradera, Blocket |
| **Bags & accessories** | Type (handbag, backpack, wallet, belt, scarf); colour; material; dust bag / receipt included; authenticity proof | "replika", "inspired" | Vinted, Tradera, Sellpy, Bukowskis |
| **Watches & jewellery** | Watches: brand, model / reference, movement (automatic / quartz / manual), case size mm, box & papers, year. Jewellery: metal & stamp (585 / 750 / 925), ring size, stone | "armband till" (strap for), "replika", "låda" (box) | Tradera, Auctionet, Bukowskis, Blocket |
| **Phones & tablets** | Model; storage (64 GB–1 TB); colour; minimum battery health %; unlocked; grade; charger / box included | "skal", "fodral" (case), "skärmskydd", "trasig", "reservdel" (spare part), "iCloud-låst" | Blocket, Tradera, Facebook |
| **Computers** | Type (laptop / desktop); model; chip / CPU (e.g. M1–M4); RAM; storage; screen size; year; Swedish keyboard | "laddare" (charger), "trasig", "delar" (parts) | Blocket, Tradera |
| **Cameras & lenses** | Type (body / lens / kit); mount (Sony E, Canon RF / EF, Nikon Z / F, Fuji X, M43); maximum shutter count; focal length | "lock" (cap), "väska" (bag), "manual" | Blocket, Tradera |
| **Audio & hi-fi** | Type (headphones, speakers, amplifier, turntable); connection (wireless / wired); vintage era | "kabel", "fjärrkontroll" (remote) | Blocket, Tradera, Auctionet |
| **Gaming** | Platform (PS5, PS4, Switch, Xbox, retro); type (console / game / accessory); complete in box; region | "endast kartong" (box only), "fodral" (case) | Tradera, Blocket |
| **Furniture & design** | Type (chair, table, sofa, lamp, shelf…); designer; manufacturer (Fritz Hansen, Svenskt Tenn, String…); material; colour; max width / depth / height cm; quantity (single / pair / set of 4+); decade; pickup radius | "ritning" (drawing), "miniatyr" | Blocket, Auctionet, Bukowskis, Tradera |
| **Glass, ceramics & tableware** | Maker (Rörstrand, Gustavsberg, Iittala, Orrefors…); series (Ostindia, Kastehelmi, Mon Amie…); piece type (plate, bowl, cup…); quantity; second sort OK | "skadad" (damaged), "nagg" (chip) | Tradera, Auctionet, Blocket |
| **Bikes** | Type (road, gravel, MTB, city, cargo, e-bike); frame size (cm or S–XL); wheel size; brakes (disc / rim); e-bike battery Wh; pickup radius | "ram" (frame), "delar" (parts), "hjul" (wheel) | Blocket, Tradera |
| **Sport & outdoor** | Sport (ski, golf, running, climbing, camping…); size / length (ski length cm, shoe size); type | "skydd" (cover), "påse" (bag) | Blocket, Tradera, Sellpy |
| **Kids & baby** | Type (pram, car seat, clothes, toys); age or size (50–170 cl); for car seats, maximum age / production year (safety) | "endast sufflett" (hood only) | Blocket, Sellpy, Tradera, Vinted |
| **Books, music & film** | Format (LP, 7", CD, cassette, hardcover, paperback, DVD / Blu-ray); artist / author; first edition / original pressing; media and sleeve grade (Goldmine); language | "kopia" (copy), "endast omslag" (cover only) | Tradera, Blocket, Auctionet |
| **Art & antiques** | Artist; technique (oil, watercolour, lithograph, print); signed; numbered edition; size cm; framed; era | "affisch" (poster), "reproduktion" | Auctionet, Bukowskis, Tradera |

Vehicles and property are left out, because they fall outside Kompi's second-hand-goods focus.

## Beyond categories: decided features
Decided 2026-10-17. Built before the categories, in the phase order below.

### A. Remove and favourite listings
- **Favorite (★):** the existing star, labelled "Favorite" in the app.
  - Favourites stay at the top and are never cleaned up.
  - A "Favourites" filter chip on the item page shows only those.
  - Favourites get extra alerts (section D, Alerts).
- **Remove (×):** on every listing card. The listing disappears and Kompi remembers it, so later searches don't bring it back.
  - Stored as a mark on the listing (`listings.removed_at`), not a delete.
  - The automatic clean-up of unseen listings must skip removed ones, or a removed listing could return when it shows up again.
- **Undo:** a short "Listing removed · Undo" message, plus "Show removed (N)" at the bottom of the item page.
- **Hide similar listings:** after a removal, Kompi offers words from the removed title that aren't part of the search.
  - Example: removing "iPhone 13 skal svart" offers `skal` and `svart`. Tapping "Hide future listings with 'skal'" saves the word on the item.
  - From then on, titles with that word are dropped. Matching ignores case and matches the start of words, so `skal` also catches "skalet". It keeps å/ä/ö, so `skal` (case) never hides `skål` (bowl).
  - Already-found listings with the word are hidden too, with Undo.
  - This prompt is the only way to add these words for now. A manual "exclude words" field is a future idea.
- Data:
  - `listings.removed_at timestamptz`
  - `items.exclude_words text[] default '{}'` (filled from the prompt)
  - A new `PATCH /api/listings/[id]` field for removing and restoring

### B. Swedish ↔ English synonyms and aliases
- A synonym table in code, `lib/search/synonyms.ts`, grouped by category later:
  - chair ↔ stol, jacket ↔ jacka, lamp ↔ lampa, table ↔ bord, shoes ↔ skor, glass ↔ glas…
  - Brand and spelling aliases: "Fritz Hansen" = "Fritz-Hansen", "Levi's" = "Levis".
  - Model numbers with and without spaces: "EA117" = "EA 117".
- Synonyms are used in two places:
  1. **Matching:** a title passes if it has each search word **or one of its synonyms**.
  2. **Querying:** sites with Swedish titles (Blocket, Tradera, Auctionet, Bukowskis) also get a Swedish variant of the query, so "Eames chair" also searches "Eames stol". Both result sets are merged and de-duplicated by URL.

### C. Fuzzy matching and "Possible match"
- `isRelevant` in `lib/scrapers/index.ts` becomes a score. It returns `match`, `possible` or `none`, rather than a yes/no.
  - **match:** every search word (or a synonym) is in the title. Model numbers must match exactly once spaces and dashes are ignored.
  - **possible:** small typos (edit distance 1 for words of 5+ letters, e.g. "Malmsten" ~ "Malmstén"), or all but one of 3+ words present.
- Possible matches are saved too (`listings.match = 'possible'`). The item page shows them in a separate "Possible matches" section below the main grid.
- Counts and the lowest price use only real matches. Alerts never fire on possible matches.

### D. Alerts
Baseline: **one weekly email** (Monday morning) per user, grouped by item. It only covers real matches that pass removed listings and hidden words. No email in a week with nothing new.

On top of that, a **frequent check every 3 hours** for:
1. **Target price:** an item setting "Alert me when one is under X kr" (`items.target_price`). Any new or re-priced real match at or under the target sends one email per listing, right away. The watchlist tile shows a bell badge "Under 1 500 kr".
2. **Price drop on a favourite:** a favourited listing whose price falls below the price it had when last checked. The email shows old → new price.
3. **Auction ending soon:** a favourited auction ending within the next 3 hours gets one reminder, with the current bid and a link. Kompi never bids.
4. **Rare find:** an item with no new real match for 7 days or more sends its own alert as soon as one appears, rather than waiting for Monday.

To build this:
- **Background job:** `scripts/daily-scrape.ts` is restarted and split into a weekly digest run and a 3-hourly check, both on the GitHub Action schedule (`.github/workflows/`). Vercel's free cron can't run every 3 hours.
  - Built as `scripts/scrape-and-alert.ts` (every 3 hours: scrape, then alerts) and `scripts/weekly-digest.ts` (Mondays 06:00 UTC). The rules are in `lib/alerts/rules.ts`, with tests.
  - Price alerts (target price, price drops) skip auction bids, since bids keep rising. Auction alerts are the "ending soon" reminder.
  - The per-item "notify" switch now means "Email me about this item": the weekly email and rare finds. Target price alerts follow the target price alone.
- **Price history:** `listings.previous_price`, updated when an upsert changes the price.
- **No duplicate alerts:** an `alert_log (user_id, listing_id, kind, price, sent_at)` table; a listing alerts again only if its price drops further.
- **Settings:** per user, the weekly email on or off and alerts on or off; per item, the target price.

## Future ideas (not planned yet)
- Manual "exclude words" field per item, plus built-in words per category
- Deal badges, price history charts and sold prices (skipped for now)
- Pickup distance and postcode (skipped for now)
- Grouping the same item posted on several sites
- "Find more like this" from a listing
- Search in descriptions (Tradera `SearchInDescription`)
- Live count while adding an item (skipped 2026-10-17): "14 listings match right now · 6 possible" under the search field, from a `POST /api/search/preview` that runs a quick search without saving anything.
- Alerts for collaborators on shared lists

### Later, optional: AI-assisted (small model, e.g. Claude Haiku)
- Pull structured details out of free-text titles and descriptions (size, storage, model, defects) into `listings.attributes`. This lets filters work on Blocket and Tradera, which have no structured fields.
- Suggest the category and pre-fill options from the item name ("iPhone 13 Pro 256" → Phones, model, storage).
- Judge relevance on the "Possible match" tier.
- Cost control: only new listings, cached per URL, capped per search.

## Phases
1. **Remove and favourite listings** (A): migration, × on cards, Undo, "Show removed", Favourites filter, the "hide future listings with this word" prompt.
2. **Synonyms, fuzzy matching and Possible matches** (B, C).
3. **Alerts** (D): restart the background job, weekly email, 3-hourly checks for target price, favourite price drops, auctions ending soon and rare finds.
4. **Category framework, Clothing and Shoes:** `lib/categories.ts`, condition normalisation and sale-type filter.
5. **Next categories:** Phones & tablets, Computers, Furniture & design, Watches & jewellery, Glass & ceramics. *Built 2026-10-21.*
6. **Remaining categories.**
7. **AI-assisted extraction and suggestions** (optional).

## Phase 4 as built
- `lib/categories/`: the registry (`index.ts`), title and size parsing with condition normalisation (`attributes.ts`), the post-filter (`filter.ts`), native site filters (`native.ts`), tests.
- Native filters, checked live 2026-10-20:
  - Sellpy: category, department, type, size, colour, material and condition all go into the Algolia `filters`.
  - Vinted: condition via `status_ids[]` (6 new with tags, 1 new, 2 very good, 3 good, 4 satisfactory).
  - Blocket: `category=0.71` (clothes, which includes shoes).
  - Tradera: nothing yet (the HTML search); Kompi's own check does it all.
- Strict/lenient is one switch per item ("Only listings that state these details"), not per filter.
- Not built yet: measurements in cm and season (Sellpy-only details).
- Built-in junk words: plain "endast" was left out, because "endast använd en gång" means "worn only once".
- Fixed on the way: the Vinted scraper saved "Varumärke: …" as the size; Sellpy titles showed raw size codes.
- Changing an item's category or filters refreshes its search; listings from sites the category rules out are pruned on that refresh (favourites and removed ones stay).

## Phase 5 as built
Spec: `SPEC-categories-phase-5.md`. Plan and task log: `tasks/plan.md`, `tasks/todo.md`.

- **Five categories** in `lib/categories/index.ts`:
  - Phones & tablets: type, storage, colour, battery health, Unlocked.
  - Computers: type, chip, RAM, storage, screen, Swedish keyboard.
  - Furniture & design: type, material, colour, quantity, decade.
  - Watches & jewellery: type, movement, case size, metal, ring size, box & papers.
  - Glass, ceramics & tableware: piece, quantity, Second sort OK.
- **Framework:**
  - Field kinds `options`, `size`, `min`, `range` and `toggle` (`require`, or `allow` for second sort).
  - `showWhen` per type, `step` for half sizes, `parse` per field (`lib/categories/parse.ts`), and `cardFields`/`cardLabel` for card details.
  - `CATEGORY_PRIORITY`: phones → computers → watches → furniture → glass → shoes → clothing.
  - Stored data stays flat in `items.filters` and `listings.attributes`, with no schema migration.
- **Brand field removed:** brands merged into item names (`20261022_merge_brand.sql`); the `items.brand` column stays until a later clean-up.
- **"Did you mean …?"** (`lib/categories/spelling.ts`): a letter missing, extra or swapped, on a word Kompi knows.
- **Native filters, checked live 2026-10-20:**
  - Sellpy: full `categories.lvl2` paths per type, for example `Prylar > Hemelektronik > Mobil & Wearables`, `{Kvinna,Man,Barn} > Accessoarer > Armbandsur` / `Smycken`, `Prylar > Inredning > Möbler` / `Belysning` / `Textiler`, and `Prylar > Hushåll > Porslin` / `Koppar & Glas`. A hit's path sets the type only when one type owns it.
  - Auctionet: one `category_id` per search: 16 furniture, 1 lamps, 42 mirrors, 35 rugs, 31 watches, 13 jewellery. None for a mix of types, and none for glass, since glass (6) and ceramics (9) are split.
  - Blocket: 0.93 (phones, computers) and 0.78 (furniture). None for watches and glass, which are split over several categories. Sub-categories (1.93.3217 phones, 1.93.3215 computers, 1.78.5196 tables and chairs…) are recorded but not used.
  - Vinted, Bukowskis, Tradera HTML: no category parameter; Kompi's own check.
- **Sites:** Sellpy and Vinted carry all five categories, so every category searches them (decision 2: every relevant site).
- **Junk words that turned out to be a plus**, so only the "till"/"för" forms count as junk:
  - "med laddare och kartong" (phones), "med laddare", "+ väska" (computers).
  - "stol med dyna", "stol i bok" (beech) (furniture).
  - "med extra länkar", "med klockask" (watches; decision 7: "armband till", not "armband").
  - "naggfri" (glass).
- **Other junk words learned from live results:**
  - Tradera's Åland stamps and postcards.
  - Mon Amie merchandise (Zoégas tins, umbrellas, tea towels).
  - Screen protectors ("glas protektion").
  - Laptop parts (bottom cover, touchpad, mAh batteries).
  - Keyrings ("brelok").
  - "Inspirerade av" copies.
- **Fixed on the way:**
  - Vinted listing links were relative and opened Kompi's own `/items` page. Fixed on `main` too (`20261023_vinted_full_links.sql`).
  - "ett 30-tal" (about thirty) is no longer read as the 1930s.
  - Listing cards look "not stated" names up with `fieldLabel()`.
- **Not built:** Manufacturer/designer filter, dimensions in cm, pickup radius, phone grade, type-aware junk words, Blocket sub-categories, Tradera API filters.

### Precision check (2026-10-21)
Top 20 real matches from all sites, one site at a time in turn, without and with the suggested category (no other filters). A listing counts as relevant when it is the thing itself, not a case, part, copy or other model.

| Item | Category | Before | After |
|---|---|---|---|
| iPhone 13 | Phones | 15 | 20 |
| Samsung Galaxy S23 | Phones | 16 | 20 |
| MacBook Air M2 | Computers | 20 | 20 |
| ThinkPad X1 Carbon | Computers | 14 | 15 |
| Lilla Åland stol | Furniture | 18 | 18 |
| String hylla | Furniture | 19 | 19 |
| Omega Seamaster | Watches | 20 | 20 |
| Seiko 5 | Watches | 20 | 20 |
| Rörstrand Mon Amie | Glass | 17 | 20 |
| Iittala Kastehelmi | Glass | 20 | 20 |
| **Average** | | **17.9** | **19.2** |

No item got worse. The biggest gains are from Sellpy's category paths (no more iPhone cases) and junk words (Zoégas tins, screen protectors). Laptop spare parts are a long tail: a ThinkPad fingerprint reader, a Norwegian keyboard and a Polish battery still get through.

## Files the later implementation will touch
- `lib/categories.ts` (new)
- `lib/scrapers/*.ts`: native params per site
- `lib/scrapers/index.ts`: `runSite`, `isRelevant`, post-filter
- `lib/types.ts`
- `supabase/migrations/…_search_categories.sql`, `supabase/schema.sql`
- `components/AddPanel.tsx`, `components/ui/Cards.tsx`, `components/ListingGrid.tsx`, `app/items/[id]/page.tsx`
- `app/api/items/*` (save category, filters, exclude words)
- `app/api/listings/[id]`: hide

## Verification
When phases are built:
- Extend the fixture tests in `lib/scrapers/scrapers.test.ts`:
  - native-param mapping per site
  - `category.matches()`
  - condition normalisation
  - exclude words
- Run `npm run check:scrapers` with a filtered query per site.
- Compare precision: for 5 real items (e.g. "Levi's 501 W32 L32", "iPhone 13 256 GB", "Eames chair"), count relevant listings out of the top 20 before and after.
