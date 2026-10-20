# Spec: Search phase 5 — five more categories

Written 2026-10-20. **Status:** approved 2026-10-20; plan in `tasks/plan.md`. Builds on phase 4 ("Phase 4 as built" in `SEARCH-PLAN.md`).

## Objective
Kompi now has two categories, Clothing and Shoes. Phase 5 adds the five where noise hurts most:

| Id | Label | Typical search | What goes wrong today |
|---|---|---|---|
| `phones` | Phones & tablets | "iPhone 13 Pro" | cases, screen protectors, broken or iCloud-locked phones, wrong storage |
| `computers` | Computers | "MacBook Air M2" | chargers, parts, the wrong RAM or storage |
| `furniture` | Furniture & design | "Lilla Åland stol" | drawings, miniatures, one chair when you want four |
| `watches` | Watches & jewellery | "Omega Seamaster" | straps, boxes, replicas, the wrong case size or metal |
| `glass` | Glass, ceramics & tableware | "Rörstrand Mon Amie" | damaged or chipped pieces, the wrong piece type, one plate when you want six |

**User stories**
- As someone hunting a phone, I pick *Phones & tablets*, choose 128 or 256 GB and "Battery 85 %+", and cases or broken phones no longer show up.
- As someone hunting a sofa table, I pick *Furniture & design*, choose *Table* and *Teak*, and Kompi searches every site that sells furniture and skips the rest.
- As a collector, I pick *Glass, ceramics & tableware*, choose *Plates* and "Set of 6 or more", and lone plates are hidden.
- Typing "MacBook Pro M3" or "Rörstrand Ostindia" suggests the right category on its own, and I can change it.

**Success:** for real items in each new category, more of the top 20 listings are relevant than before (see Success criteria). No migration, and existing Clothing and Shoes items behave exactly as before.

## Assumptions (correct me before planning)
1. **Brand, model, maker and series go in the item name, not in filters.** "iPhone 13 Pro", "Omega Seamaster 300" and "Rörstrand Mon Amie" are already the search. So there are no Model, Reference, Maker or Series fields. Filters cover what the name can't say: storage, size, piece type, quantity, metal and so on.
2. **Every filter is read from the title, plus any site field a scraper already has.** Kompi doesn't open listing pages just to read details. Battery health and box & papers are rarely in titles, so in lenient mode they mostly show as "not stated".
3. **Native site filters stay narrow:** one category id per site (Blocket, Auctionet, and Tradera/Bukowskis if a working parameter turns up). Kompi's own check does the rest, just as on Tradera in phase 4.
4. **Stored data stays flat.** New filter keys sit next to the old ones in `items.filters` (jsonb), and new details in `listings.attributes`. No migration.
5. **One spec, one branch (`search-phase-5`).** The work goes in two steps (see Build order), not as five separate specs. The framework change is shared, and each category after it is small, declarative code.
6. **Left out of v1:** a Manufacturer / designer filter (maybe later), dimensions in cm, pickup radius, year of manufacture, phone "grade", charger/box included, Tradera API filters (keys still on hold).
7. **Every relevant site is always searched.** A category's site list includes every site that sells that kind of thing, not just the best ones. Checked live 2026-10-20: Sellpy and Vinted carry all five categories (see `tasks/plan.md`).

## Also in this phase: remove the Brand field
People type the brand into the name anyway ("Acne läderjacka", "Omega Seamaster"), and the quick-add dock already saves `brand: null`. Today the brand is only glued in front of the name to make the search (`buildQuery`), and shown in muted text above the name on the tile and item page.
- Remove "Brand (optional)" from `components/AddPanel.tsx`.
- **Existing items:** one data update merges the brand into the name (`name = brand || ' ' || name`, `brand = null`), unless the name already starts with the brand. The search query stays exactly the same.
- Keep the `items.brand` column for now and drop it in a later clean-up. That way old code paths don't break mid-deploy.
- Remove the brand line from `ItemTile`, the item page header, and the scan page title. `buildQuery` and `itemTitle` (alert emails) become just the name once the column is dropped.
- Update the empty-state hint in `ListingGrid` ("…or dropping the brand from the search" → "…or a shorter name").
- This can ship on its own, before the category work.

## Categories and their options
Shared options for every category stay the same: condition, sale type, strict/lenient.

### Phones & tablets (`phones`)
- **Type:** Phone, Tablet, Smartwatch
- **Storage:** 32 / 64 / 128 / 256 / 512 GB, 1 TB (options; "256 GB", "256GB", "256 gb")
- **Colour:** the shared colour list
- **Battery health:** a minimum % (`min` field; "batterihälsa 89%", "batteri 91 %", "BH 88%")
- **Unlocked:** a toggle ("olåst", "unlocked", "öppen för alla operatörer")
- **Built-in junk words:** `skal`, `*skal`, `fodral*`, `skärmskydd*`, `case`, `laddare`, `kabel`, `trasig*`, `sprucken`, `spräckt*`, `reservdel*`, `icloud låst`, `icloudlåst`, `låst till operatör*`, `endast kartong*`, `kartong`, `dummy`
- **Sites:** Blocket, Tradera, Facebook Marketplace, Vinted, Sellpy

### Computers (`computers`)
- **Type:** Laptop, Desktop
- **Chip:** M1, M2, M3, M4 (Pro/Max count as the base chip), Intel, AMD Ryzen
- **RAM:** 8 / 16 / 18 / 24 / 32 / 36 / 64 GB
- **Storage:** 128 / 256 / 512 GB, 1 / 2 TB
- **Screen size:** 13 / 14 / 15 / 16 inch (from `13"`, "13 tum", "13-tum", "13,3"; never from a bare "13")
- **Swedish keyboard:** a toggle ("svenskt tangentbord", "svensk layout", "nordiskt tangentbord")
- **Junk words:** `laddare`, `adapter`, `skal`, `fodral`, `väska`, `sleeve`, `trasig*`, `delar`, `reservdel*`, `moderkort`, `skärm till`, `tangentbord till`, `icloud låst`, `mdm`, `bios låst`
- **Sites:** Blocket, Tradera, Facebook Marketplace, Vinted, Sellpy

### Furniture & design (`furniture`)
- **Type:** Chair, Armchair, Sofa, Table, Desk, Shelf & storage, Lamp, Bed, Rug, Mirror
- **Material:** Teak, Oak, Walnut, Birch, Rosewood (jakaranda/palisander), Pine, Leather, Rattan & cane, Metal, Glass, Fabric
- **Colour:** the shared colour list
- **Quantity:** Single, Pair, Set of 4 or more ("2 st", "ett par", "4 st", "set om 6", "6 stolar")
- **Decade:** 1940s–1990s ("60-tal", "1960-tal", "60-talet", "1960s", "mid century" → 1950s and 1960s)
- **Junk words:** `ritning*`, `miniatyr*`, `dockskåp*`, `vitra miniatures`, `affisch*`, `poster`, `katalog*`, `bok`, `dyna`, `dynor`, `överdrag*`, `klädsel till`, `reservdel*`
- **Sites:** Blocket, Tradera, Auctionet, Bukowskis, Facebook Marketplace, Sellpy, Vinted

### Watches & jewellery (`watches`)
- **Type:** Watch, Smartwatch, Ring, Necklace, Bracelet, Earrings, Brooch
- **Movement** (watches): Automatic, Manual winding, Quartz
- **Case size** (watches): a mm range (`range` field; "40 mm", "40mm", "Ø 40")
- **Metal:** Gold 18k (750), Gold 14k (585), Gold 9k (375), Silver (925/830), Platinum, Steel, Gold-plated / doublé
- **Ring size** (rings): a range of Swedish sizes in mm, 14–23 ("stl 17", "storlek 17,5", "17 mm")
- **Box & papers:** a toggle ("box och papper", "box & papers", "full set", "fullset", "kvitto och box")
- **Junk words:** `armband till`, `länk*` (spare links), `rem`, `*armband` unless the type is Bracelet, `endast box`, `endast låda`, `klockask*`, `replika*`, `replica`, `kopia`, `fake`, `inspired`, `reservdel*`, `urverk till`
- **Sites:** Tradera, Auctionet, Bukowskis, Blocket, Sellpy, Vinted, Facebook Marketplace

### Glass, ceramics & tableware (`glass`)
- **Piece type:** Plate, Deep plate, Bowl, Cup & saucer, Mug, Vase, Drinking glass, Dish & serving, Jug & pot
- **Quantity:** Single, Pair, Set of 4 or more, Set of 6 or more ("6 st", "sex st", "set om 6", "6 tallrikar")
- **Second sort OK:** a toggle. Off (the default): listings marked "2:a sortering", "andra sortering" or "sekunda" are hidden. On: they're kept.
- **Junk words:** `skadad*`, `nagg*`, `naggad*`, `kantstött*`, `spricka`, `sprucken`, `limmad*`, `lagad*`, `krakelerad*` (crazed glaze), `bild på`, `affisch*`
- **Sites:** Tradera, Auctionet, Blocket, Bukowskis, Facebook Marketplace, Sellpy, Vinted

Word lists above are the starting point. The plan step fixes the exact patterns against real titles from `npm run check:scrapers`.

## Framework changes
Today the framework assumes clothing: `FilterKey` and `CategoryField.key` are fixed unions, every option field is multi-select, and `sellpyGroup` is required. Phase 5 changes:

1. **Field kinds.** `CategoryField` gets a `kind`:
   - `options` (today's behaviour): multi-select, matched by `words`
   - `size` (unchanged, Clothing and Shoes only)
   - `min`: one number, for example battery ≥ 85 %, with its own parser
   - `range`: from–to numbers, for example case size 38–41 mm or ring size 17–18
   - `toggle`: on means "must state it" (Unlocked, Box & papers, Swedish keyboard). `glass.secondSort` is the inverse: off hides marked listings.
   
   `key` becomes a plain string. Keys are unique within a category, and a shared key (`color`, `type`, `material`, `storage`) means the same thing everywhere.
2. **Parsers per field.** A `min`, `range` or `toggle` field, or an `options` field that needs more than word patterns (storage "256gb", screen `13"`, decade "60-tal"), has `parse(title, siteFields) → value | undefined`. `extractAttributes` calls it. Word-pattern options keep working as they are.
3. **Types.** `ItemFilters` and `ListingAttributes` keep their typed shared keys and gain an index signature for category fields. `FilterKey` becomes `string`. `sanitizeFilters` validates each kind (ids against options, numbers within the field's bounds, toggles as `true`).
4. **Checks.** `checkListing` loops over `category.fields` by kind, with today's rules: a contradiction drops the listing; an unstated detail is kept and marked, unless the item is strict.
5. **Field visibility.** A field can say `showWhen: { type: ['watch'] }`. Movement and case size only appear when the type includes Watch (or no type is chosen). Ring size only appears for Ring.
6. **Category order and hints.** `suggestCategory` walks a declared priority order rather than a hard-coded `['shoes', 'clothing']`. More specific categories come first. Smartwatches ("Apple Watch", "Galaxy Watch", "Garmin") fit both Phones & tablets and Watches & jewellery, as the type Smartwatch in each. The name suggests Phones & tablets with type Smartwatch, and the user can switch to Watches.
7. **Native params.** `sellpyGroup` becomes optional; where Sellpy carries a new category, the plan step finds its Sellpy category path (for example under Accessoarer or Hem) and uses it. New `auctionetCategory` and `bukowskisCategory` fields join `blocketCategory`. `scrapeAuctionet` and `scrapeBukowskis` take `SearchOptions`, like Blocket. Ids are checked live during the plan step.
8. **Cards.** A category can name up to two `cardFields`, shown in the existing details line next to condition and size: "256 GB · Battery 88 %", "M2 · 16 GB · 13″", "Set of 6", "18k gold · 17".

## UI
- **Category chips** (`components/CategoryFields.tsx`): seven chips plus "Any". On phones they scroll sideways in one row and never wrap into a block. Labels stay short ("Phones", "Computers", "Furniture", "Watches & jewellery", "Glass & ceramics").
- **New controls** from existing parts in `components/ui/Form.tsx`:
  - `min`: a small number `Input` with a unit ("Battery at least __ %")
  - `range`: two number inputs, like `PriceRange`
  - `toggle`: `Toggle`
- **Item page:** `describeFilters` covers the new kinds: "Battery 85 %+", "Case 38–41 mm", "Unlocked", "Set of 6 or more", "Second sort OK".
- No new screens, no icons beyond the existing chip style, and the design rules in `PRODUCT.md`/`DESIGN.md` still apply.

## Tech stack
Next.js 16.2.6 (App Router; read `node_modules/next/dist/docs/` before touching routes), React 19.2, TypeScript 5, Tailwind 4, Supabase, scrapers built on axios and cheerio, tests with `node:test` through `tsx`. No new dependencies.

## Commands
```
Test:            npm test
Lint:            npm run lint
Type check:      npx tsc --noEmit
Build:           npm run build
Dev:             npm run dev
Live scrapers:   npm run check:scrapers
```

## Project structure
```
lib/categories/index.ts        → registry: the five new categories, priority order, sanitize/describe for new kinds
lib/categories/types.ts        → field kinds, widened ItemFilters / ListingAttributes
lib/categories/attributes.ts   → per-field parsers (storage, RAM, screen, battery, case/ring size, quantity, decade, metal)
lib/categories/filter.ts       → checkListing by field kind
lib/categories/native.ts       → Blocket, Auctionet, Bukowskis category params
lib/categories/categories.test.ts → fixture titles per new category
lib/scrapers/auctionet.ts, bukowskis.ts → accept SearchOptions
components/CategoryFields.tsx  → chip row scrolling, min/range/toggle controls, showWhen
components/ui/Cards.tsx        → cardFields in the details line
SEARCH-PLAN.md                 → "Phase 5 as built" when done
```

## Code style
Follow `lib/categories/`: declarative data first, small pure functions, comments that explain the *why* in plain English, Swedish title words lowercase with å/ä/ö kept. A new field should read like this:

```ts
{
  key: 'storage',
  label: 'Storage',
  kind: 'options',
  options: [64, 128, 256, 512].map((gb) => ({ id: `${gb}`, label: `${gb} GB`, words: [`${gb} gb`, `${gb}gb`] }))
    .concat({ id: '1024', label: '1 TB', words: ['1 tb', '1tb'] }),
},
{
  key: 'battery',
  label: 'Battery health',
  kind: 'min',
  unit: '%',
  bounds: [50, 100],
  // "batterihälsa 89%", "BH 88 %"; never a bare number
  parse: (title) => percentAfter(title, ['batterihälsa', 'batteri', 'battery', 'bh']),
},
```

## Testing strategy
- **Unit tests** in `lib/categories/categories.test.ts`, following the phase 4 pattern:
  - For each new category, at least 8 real-looking titles: what passes, what's dropped (junk words), and what's "not stated".
  - Every parser has positive and negative cases, for example "iPhone 13 128 GB" → storage 128 but never screen 13; "Rörstrand Mon Amie 6 st tallrikar" → quantity 6+, piece type Plate; "60-tals teakbord" → 1960s, Teak, Table.
  - `suggestCategory` on 10+ names, including tricky ones ("Apple Watch", "Omega Seamaster", "Iittala Kastehelmi", "Eames chair", "Lilla Åland").
  - `sanitizeFilters` rejects out-of-bounds numbers and unknown ids, and keeps phase 4 shapes unchanged.
  - Native params: the Blocket, Auctionet and Bukowskis query strings per category.
- **Regression:** every phase 4 test passes without edits.
- **Live check:** `npm run check:scrapers` with one filtered query per new category.
- **Precision check (manual):** 2 real items per category (10 in all). Count relevant listings in the top 20 before and after, and record them in "Phase 5 as built".

## Boundaries
- **Always:** keep categories declarative in `lib/categories/`; run `npm test`, lint and the type check before each commit; verify native category ids live before hard-coding them; keep Clothing and Shoes behaviour unchanged.
- **Ask first:** any database migration; any new dependency; opening listing pages solely to read details (more requests per search); changing the strict/lenient default; adding categories beyond these five.
- **Never:** hard-code site ids that weren't checked live; delete or loosen a phase 4 test to make phase 5 pass; commit secrets or API keys; merge to `main` without review.

## Build order
1. **Framework:** field kinds, parsers, `showWhen`, priority order, `cardFields`, optional `sellpyGroup`, and Auctionet/Bukowskis options. Proven by porting nothing: Clothing and Shoes stay as they are, and all tests pass.
2. **Categories:** Phones & tablets and Computers (electronics, shared storage parser) → Furniture & design → Watches & jewellery → Glass, ceramics & tableware. Each lands with its tests and a live check.
3. **UI:** the scrolling chip row and the new controls (can start in parallel with step 2 once step 1 is in).
4. **Wrap-up:** precision check, "Phase 5 as built" in `SEARCH-PLAN.md`.

## Success criteria
- [ ] The five categories appear as chips; picking one shows only its fields, and the watch and ring fields follow `showWhen`.
- [ ] `suggestCategory` gets at least 9 of 10 test names right, and returns no category when the name gives no clue (a plain brand like "Acne").
- [ ] Junk-word tests: cases, chargers, drawings, straps, chipped pieces and replicas are dropped in their category, and kept when the word is part of the search ("iPhone 13 skal" still finds cases).
- [ ] Lenient mode keeps listings without the detail and marks them "not stated"; strict mode hides them.
- [ ] Every site in a category's list is searched, and sites outside it aren't. The *(verify)* sites are settled by a live check and recorded in "Phase 5 as built".
- [ ] For the 10 precision items, relevant listings in the top 20 go up on average, and no item gets worse by more than 2.
- [ ] Existing Clothing and Shoes items return the same listings as before (phase 4 tests unchanged and green).
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` pass.
- [ ] No schema migration for categories; the only data change is the one-off brand merge (if approved).

## Decisions (2026-10-20)
1. **Manufacturer / designer filter:** not now, maybe later.
2. **Sites:** every relevant site is always included (assumption 7). Sellpy is added to Watches & jewellery and Glass & ceramics.
3. **Dimensions in cm:** left out.
4. **Second sort:** hidden by default.
5. **Smartwatches:** in both Phones & tablets and Watches & jewellery (type Smartwatch).

6. **Brand:** merge existing brands into item names, then hide the field.

Spec approved 2026-10-20.
