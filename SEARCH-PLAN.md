# Kompi search: categories and precision plan

Written 2026-10-17. Nothing here is built yet; pick phases to start.

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
- `items.category text null`, `items.filters jsonb not null default '{}'`, `items.exclude_words text[] not null default '{}'`.
- `listings.attributes jsonb`: normalised details pulled from each site (size, condition grade, storage…), used for filtering and shown on cards.
- `listings.hidden boolean default false`, for "Not relevant".

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

## Beyond categories: ideas
Ordered by value for effort:
1. **Exclude words** per item, plus built-in ones per category. Cheap, and a big precision win.
2. **"Not relevant" on a listing.** It hides the listing and suggests an exclude word from its title, for example "skal" (case).
3. **Synonyms and Swedish ↔ English**, plus brand and spelling aliases. chair ↔ stol, jacket ↔ jacka, "EA117" = "EA 117", "Fritz Hansen" = "Fritz-Hansen". Kompi also sends a Swedish query variant to Swedish-titled sites.
4. **Better relevance than "all words".** Fuzzy matching (typos), exact matching for model numbers, scored tiers ("Exact match" vs "Possible match") instead of a hard drop.
5. **Accessory and outlier detection.** Flag listings priced far below the item's median (likely a case or box only), combined with the category's exclude words.
6. **Price intelligence:**
   - A median price per item and a "deal" badge (e.g. 30% under median).
   - Price history with `recharts`, which is already installed.
   - Sold prices from Auctionet's ended lots and Bukowskis results.
7. **Duplicate grouping.** Group the same item posted on several sites by title and image similarity.
8. **Location.** Your postcode in Settings, distance on cards, and a pickup radius for bulky categories.
9. **Live preview while adding.** "23 listings match right now", so you can tune filters before saving.
10. **Smarter alerts.** Email only when a new listing matches strict filters or is under a target price, plus "auction ending soon" for starred listings.
11. **"Find more like this"** from a listing, prefilled from its attributes.
12. **Search in descriptions** (Tradera `SearchInDescription`), as an opt-in.

### Later, optional: AI-assisted (small model, e.g. Claude Haiku)
- Pull structured details out of free-text titles and descriptions (size, storage, model, defects) into `listings.attributes`. This lets filters work on Blocket and Tradera, which have no structured fields.
- Suggest the category and pre-fill options from the item name ("iPhone 13 Pro 256" → Phones, model, storage).
- Judge relevance on the "Possible match" tier.
- Cost control: only new listings, cached per URL, capped per search.

## Phases
1. **Foundation and quick wins:**
   - Migration
   - `lib/categories.ts` framework
   - Exclude words
   - "Not relevant"
   - Condition normalisation and filter
   - Sale-type filter
2. **First categories:** Clothing and Shoes. Sellpy, Vinted, Tradera and Blocket have the richest native filters for them.
3. **Next categories:** Phones & tablets, Computers, Furniture & design, Watches & jewellery, Glass & ceramics.
4. **Remaining categories:** Bags & accessories, Cameras & lenses, Audio & hi-fi, Gaming, Bikes, Sport & outdoor, Kids & baby, Books, music & film, Art & antiques.
5. **Smarter matching:** synonyms, fuzzy and tiered relevance, outlier detection, duplicates.
6. **Price intelligence and alerts.**
7. **AI-assisted extraction and suggestions** (optional).

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
