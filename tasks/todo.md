# Todo: Search phase 5

Plan: `tasks/plan.md`. Spec: `SPEC-categories-phase-5.md`.
Every task also clears the standing bar: `npm test`, `npm run lint`, `npx tsc --noEmit` pass, with no phase 4 test edited.

## Part A: Remove the Brand field

- [x] **Task 1: Merge brands into names and remove the Brand input**
  - Acceptance:
    - `supabase/migrations/20261022_merge_brand.sql` sets `name = brand || ' ' || name` and `brand = null` where brand is set and the name doesn't already start with it (case-insensitive); `supabase/schema.sql` notes the column is unused.
    - The add/edit panel has no Brand input; saving sends `brand: null`.
    - The search query for a merged item is identical to before (`buildQuery(null, merged) === buildQuery(brand, name)`).
  - Verify: unit test for the query equivalence; a dry-run `select` of the rows the SQL would change, shown to you before it is run; add and edit an item in `npm run dev`.
  - Files: `supabase/migrations/20261022_merge_brand.sql`, `supabase/schema.sql`, `components/AddPanel.tsx`, `lib/scrapers/scrapers.test.ts`
  - Size: S · Depends on: none

- [x] **Task 2: Remove brand from display and copy**
  - Acceptance:
    - No brand line on the watchlist tile, item page header or scan page title (the name now carries it).
    - The empty-state hint no longer mentions the brand.
    - Alert emails and `buildQuery` still work while old rows have a brand (nothing reads it after the merge, but nothing breaks if it's set).
  - Verify: `npm run build`; visual check of tile, item page and scan page at 375 px and desktop.
  - Files: `components/ui/ItemTile.tsx`, `app/items/[id]/page.tsx`, `app/items/[id]/scan/page.tsx`, `components/ListingGrid.tsx`
  - Size: S · Depends on: Task 1

- [ ] **Checkpoint A:** tests, lint and build green; you run the migration in Supabase; review, then merge Part A. (Part A ships with the whole branch instead. Still open: run `supabase/migrations/20261022_merge_brand.sql` when merging.)

## Part B1: Framework

- [x] **Task 3: Live site check**
  - Acceptance:
    - For each new category, a yes/no per *(verify)* site (Sellpy, Vinted) with the query used and the hit counts.
    - The Sellpy category path (`categories.lvl1`) for watches, jewellery, glass/ceramics, and electronics/home if they exist.
    - Blocket sub-category ids under 0.93 (phones, tablets, computers) and 0.78 (furniture types), if the URL exposes them.
    - Whether Bukowskis `/sv/lots` and Tradera HTML search take a category parameter.
    - Results written into the "Site check" table in `tasks/plan.md`, and each category's `sites` list in the spec updated.
  - Verify: each claim has a reproducible URL or request in the table.
  - Files: `tasks/plan.md`, `SPEC-categories-phase-5.md`
  - Size: XS (research) · Depends on: none

- [x] **Task 4: Field kinds, widened types, sanitize/describe, visibleFields**
  - Acceptance:
    - `CategoryField` has `kind` (`options` | `size` | `min` | `range` | `toggle`), `unit`, `bounds`, `showWhen`, optional `parse`. Existing Clothing/Shoes fields get `kind: 'options'` or `'size'` with no other change.
    - `sanitizeFilters` validates each kind (unknown ids dropped, numbers clamped to `bounds` or dropped, a range with from > to swapped, toggles kept only as `true`) and drops fields hidden by `showWhen`.
    - `describeFilters` renders the new kinds ("Battery 85 %+", "Case 38–41 mm", "Unlocked").
  - Verify: new unit tests with a test-only category fixture covering every kind; all phase 4 tests green, unedited.
  - Files: `lib/categories/types.ts`, `lib/categories/index.ts`, `lib/categories/categories.test.ts`
  - Size: M · Depends on: none

- [x] **Task 5: Parsers and checkListing by field kind**
  - Acceptance:
    - `extractAttributes` runs each field's `parse` (title + site fields), falling back to word patterns for `options`.
    - `checkListing` handles every kind: `min` drops below, `range` drops outside, `toggle` requires a stated `true`. A missing detail goes to `unstated` (or drops, if strict). Hidden fields never filter.
    - Shared parser helpers, each with positive and negative tests: `numberWithUnit` (GB/TB, mm, tum/″, %), `percentAfter`, `quantity` ("4 st", "ett par", "set om 6", "6 tallrikar"), `decade` ("60-tal", "1960-talet", "1960s").
  - Verify: unit tests through the test-only fixture category; phase 4 tests unedited.
  - Files: `lib/categories/attributes.ts`, `lib/categories/filter.ts`, `lib/categories/parse.ts` (new), `lib/categories/categories.test.ts`
  - Size: M · Depends on: Task 4

- [x] **Task 6: Registry and native plumbing**
  - Acceptance:
    - `suggestCategory` walks a declared `CATEGORY_PRIORITY` list, with today's results unchanged.
    - `sellpyGroup` is optional; `sellpyFilters` skips the category clause without it. A new `sellpyPaths` (from Task 3) is used when present.
    - `auctionetCategory(category, filters)` returns an id only when unambiguous, and `scrapeAuctionet` accepts `SearchOptions`. (Bukowskis has no category parameter (Task 3), so its scraper is unchanged.)
    - `Category.cardFields` exists and `attributeLabels(listing, category)` returns the short card strings.
  - Verify: unit tests for each native helper; `npm run check:scrapers` for Auctionet and Bukowskis still returns listings with no category.
  - Files: `lib/categories/index.ts`, `lib/categories/native.ts`, `lib/scrapers/auctionet.ts`, `lib/scrapers/bukowskis.ts`, `lib/categories/categories.test.ts`
  - Size: M · Depends on: Tasks 3, 4

- [x] **Checkpoint B1** (2026-10-20: 65 tests green, phase 4 tests unedited; saved raw Vinted/Tradera results for Levi's 501 (clothing, W32), Fjällräven Kånken (no category) and Dr Martens 1460 (shoes, EU 42, good+) give the same 153 listings and details on main and this branch): phase 4 tests untouched and green. Three saved Clothing/Shoes items return the same listings before and after (compare `listings` row ids after a refresh). Review before the categories.

## Part B2: Categories

- [x] **Task 7: Phones & tablets**
  - Acceptance:
    - The `phones` category as in the spec: type (incl. Smartwatch), storage, colour, battery min %, unlocked toggle, junk words, sites from Task 3, Blocket 0.93 (plus a sub-category if found).
    - `suggestCategory`: "iPhone 13 Pro", "Samsung Galaxy S23", "iPad Air", "Apple Watch Series 8" → `phones`.
    - At least 8 fixture titles: "iPhone 13 128GB batterihälsa 89%" passes 128 GB / ≥ 85 %; "iPhone 13 skal" is dropped unless "skal" is in the search; "iPhone 13 13 tum"-style traps don't set storage; "iCloud-låst" is dropped.
  - Verify: `npm test`; `npm run check:scrapers` with "iPhone 13" + Phones.
  - Files: `lib/categories/index.ts`, `lib/categories/types.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Tasks 5, 6

- [x] **Task 8: UI for new field kinds, scrolling chips, card details**
  - Acceptance:
    - `CategoryFields` renders `min` (number + unit), `range` (two numbers, like `PriceRange`) and `toggle` with existing `Form.tsx` parts, and respects `visibleFields`.
    - The category chip row scrolls sideways in one line at 375 px, with no wrap and no page overflow.
    - Listing cards show the category's `cardFields` in the details line ("256 GB · Battery 88 %").
    - (Done early in the review fixes: "not stated" names come from `fieldLabel()`, so new fields can't crash the card.)
  - Verify: in `npm run dev`, add "iPhone 13" → Phones suggested → set 128 GB, battery 85, unlocked → refresh → cards and item-page chips are correct; check at 375 px and desktop; keyboard focus order works.
  - Files: `components/CategoryFields.tsx`, `components/ui/Cards.tsx`, `components/ui/Form.tsx` (only if a small number input is missing)
  - Size: M · Depends on: Task 7

- [x] **Checkpoint B2:** a phone item works end to end in the dev app; review the UI with you before the remaining categories. (Done on my side 2026-10-20: 74 tests, build, 375/1100 px screenshots of a preview page. You tried an iPhone item 2026-10-21: looks good.)

Each category task follows the Phones pattern (Task 7): add the id to `CategoryId`, the category to `CATEGORIES` (with `short` for its chip), its place in `CATEGORY_PRIORITY`, `sellpyPaths` per type, `cardFields`; tests first; a live `runSite` check per site; one commit.

- [x] **Task 9: Computers**
  - Acceptance:
    - Fields: type (laptop, desktop), chip (M1–M4, where "M2 Pro/Max" counts as M2; Intel; AMD Ryzen), RAM (8/16/18/24/32/36/64 GB), storage (`storageField([128, 256, 512], [1, 2])`, no bare numbers), screen size (13/14/15/16), Swedish keyboard toggle.
    - New parser `slashPair` for "8/256" and "16/512 GB" → RAM and storage. RAM also reads "16 GB RAM" and "16GB minne". A GB number only counts as storage when it's in the storage list and not followed by "RAM".
    - Screen size comes only from a unit: `13"`, `13″`, "13 tum", "13-tum", "13,3", "13-inch". A bare "13" (as in "MacBook Pro 13 M1") is never a screen size.
    - Junk words (spec list): laddare, adapter, skal, fodral, väska, sleeve, trasig*, delar, reservdel*, moderkort, "skärm till", "tangentbord till", "icloud låst", mdm, "bios låst". Searching for one of them keeps it.
    - Sites: Blocket (0.93), Tradera, Sellpy (`Prylar > Hemelektronik > Datorer & Tillbehör`), Vinted, Facebook Marketplace. Card fields: chip, RAM, storage.
    - Priority: after `phones`. Suggests "MacBook Air", "MacBook Pro M3", "ThinkPad", "iMac", "laptop", "bärbar dator"; "iPad" stays Phones.
    - ≥ 8 fixture titles, including "MacBook Air M2 8/256 GB" → M2, 8, 256 and "MacBook Pro 13 M1 16GB 512GB" → no screen size.
  - Verify: `npm test`; live `runSite` for "MacBook Air M2" + Computers on every site.
  - Files: `lib/categories/index.ts`, `lib/categories/parse.ts`, `lib/categories/types.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [x] **Task 10: Furniture & design**
  - Acceptance:
    - Fields: type (chair, armchair, sofa, table, desk, shelf & storage, lamp, bed, rug, mirror), material (teak, oak, walnut, birch, rosewood/jakaranda/palisander, pine, leather, rattan & cane, metal, glass, fabric), colour, quantity (single, pair, set of 4+; parsed with `quantity()` and nouns such as stolar/fåtöljer/pallar), decade (1940s–1990s; parsed with `decades()`).
    - Native: Blocket 0.78. Auctionet per type: 16 for furniture types, **1** lamp, **42** mirror, **35** rug; no id for a mix. Sellpy per type: `Prylar > Inredning > Möbler`, lamp `Prylar > Inredning > Belysning`.
    - Review finding 6: `sellpyAttributes` reads the type from a hit's full Sellpy path (`sellpyPaths`), not only `sellpyGroup` trees.
    - Junk words (spec list), e.g. "Eames miniatyr" and "Vitra miniatures" are dropped; "dyna", "dynor" and "överdrag" are dropped unless searched.
    - Sites: Blocket, Tradera, Auctionet, Bukowskis, Facebook Marketplace, Sellpy, Vinted. Card fields: quantity, decade, material.
    - Suggests "Lilla Åland stol", "String hylla", "PH5 lampa", "Eames chair", "teakbord", "fåtölj". Watch the overlaps: "skrivbordslampa" → Lamp, not Desk.
    - ≥ 8 fixtures: "Lilla Åland stolar 4 st" → Chair, set of 4+; "60-tals teakbord" → Table, Teak, 1960s.
  - Verify: `npm test`; live `runSite` for "Lilla Åland" + Furniture on every site.
  - Files: `lib/categories/index.ts`, `lib/categories/native.ts`, `lib/categories/types.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [x] **Task 11: Watches & jewellery**
  - Acceptance:
    - Fields: type (watch, smartwatch, ring, necklace, bracelet, earrings, brooch), movement (automatic/"automat", manual/"handuppdragen", quartz/"kvarts"; `showWhen` watch), case size (range, 20–55 mm; `showWhen` watch), metal (gold 18k/750, 14k/585, 9k/375, silver 925/830, platinum, steel, gold-plated/doublé; read from words and stamps such as "18k", "18 karat", "750"), ring size (range, 14–23 mm; `showWhen` ring; "stl 17", "storlek 17,5"), box & papers toggle.
    - **Decimals:** ring size needs 17.5. Number fields get `step` (0.5 for ring size), and the form accepts "17,5" and "17.5" (today `parseWhole` drops decimals).
    - **Simplified:** the spec's "`*armband` unless the type is Bracelet" needs type-aware junk words, which the framework doesn't have. Instead the junk words are only "armband till", "rem till", "länk till", "länkar"; a plain "armband" is never junk.
    - Native: Auctionet 31 for watch and smartwatch types, 13 for jewellery types, none for a mix. Sellpy per type: `{Kvinna,Man,Barn} > Accessoarer > Armbandsur` for watches, `… > Smycken` for jewellery, `Prylar > Hemelektronik > Mobil & Wearables` for smartwatches. No Blocket category (split over 0.71 and 0.76).
    - Sites: Tradera, Auctionet, Bukowskis, Blocket, Sellpy, Vinted, Facebook Marketplace. Card fields: case size, metal, movement.
    - Priority: after `phones`, so "Apple Watch" stays Phones (decision 5). Suggests "Omega Seamaster", "Rolex", "Seiko 5", "guldring", "halsband", "örhängen".
    - ≥ 8 fixtures: "Omega Seamaster 41 mm automatic full set" → watch, 41, automatic, box & papers; "armband till Omega" is dropped.
  - Verify: `npm test`; live `runSite` for "Omega Seamaster" + Watches; a 375 px screenshot (see B3) with Ring picked shows ring size and hides movement and case size.
  - Files: `lib/categories/index.ts`, `lib/categories/types.ts`, `components/CategoryFields.tsx`, `lib/categories/categories.test.ts`
  - Size: M · Depends on: Task 8

- [x] **Task 12: Glass, ceramics & tableware**
  - Acceptance:
    - Fields: piece type (plate, deep plate, bowl, cup & saucer, mug, vase, drinking glass, dish & serving, jug & pot), quantity (single, pair, set of 4+, set of 6+; nouns tallrikar/assietter/koppar/skålar/glas/muggar/fat), Second sort OK (`toggle: 'allow'`, with a description; hides "2:a sortering", "andra sortering", "sekunda").
    - Native: no Blocket or Auctionet category (glass and ceramics are split on both). Sellpy: `Prylar > Hushåll > Porslin`, `Prylar > Hushåll > Koppar & Glas`, `Prylar > Inredning > Vaser & Krukor`.
    - Junk words (spec list): skadad*, nagg*, kantstött*, spricka, sprucken, limmad*, lagad*, krakelerad*, "bild på", affisch*.
    - Hints: makers (Rörstrand, Gustavsberg, Iittala, Arabia, Orrefors, Kosta, Höganäs, Upsala-Ekeby, Figgjo, Porsgrund, Royal Copenhagen, Bing & Grøndahl), series (Ostindia, Mon Amie, Kastehelmi, Spisa Ribb, Blå Eld, Pomona, Bersa, Aino Aalto, Teema) and pieces (tallrik*, assiett*, skål*, kopp*, vas*). "Iittala lampa" stays Furniture: furniture comes first.
    - Sites: Tradera, Auctionet, Blocket, Bukowskis, Facebook Marketplace, Sellpy, Vinted. Card fields: type, quantity.
    - ≥ 8 fixtures: "Rörstrand Mon Amie 6 st tallrikar" → Plate, 6+; "Ostindia skål nagg" is dropped; "Mon Amie 2:a sortering" is hidden unless Second sort OK is on.
  - Verify: `npm test`; live `runSite` for "Mon Amie" + Glass.
  - Files: `lib/categories/index.ts`, `lib/categories/types.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [x] **Checkpoint B3** (my side done 2026-10-21: 96 tests, lint, build; all five live-checked; 23-name suggestion test; 375 px screenshots of each category's form, no sideways overflow; selected chip scrolls into view. Waiting for your review):
  - All five categories live-checked on every site; `npm test`, lint, type check and `npm run build` green.
  - A priority test: 20 item names across all seven categories each get the right suggestion (or none).
  - 375 px and desktop screenshots via a temporary preview page and Chrome's DevTools Protocol (headless Chrome can't go below 500 px on its own): seven chips scroll in one row with no page overflow; each category's fields render.
  - Review with you.

- [x] **Task 12b: "Did you mean …?" spelling hint** (added 2026-10-21, after "McBook M2" found only possible matches)
  - Acceptance:
    - `spellingHint(name)` suggests a fix when a word of 5+ letters isn't a word Kompi knows but is one letter off one (category words, type words, brands, makers): "McBook M2" → "Macbook M2", "Rörstand" → "Rörstrand", "Iitala" → "Iittala".
    - No hint for known words, their longer forms or compounds ("lampan", "vinterjacka", "taklampa"), names Kompi doesn't know at all ("Fjällräven Kånken"), or words with digits.
    - The add/edit form (mobile, desktop, and the empty-watchlist dock) shows "Did you mean **Macbook M2**?" under the name; tapping it fixes the name.
  - Verify: `npm test`; screenshot of the hint at 375 px and desktop.
  - Files: `lib/categories/spelling.ts` (new), `lib/search/match.ts` (export `editDistance`), `components/AddPanel.tsx`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 12

## Part B3: Wrap-up

- [x] **Task 13: Precision check and "Phase 5 as built"**
  - Acceptance:
    - Ten real items (2 per category): relevant listings in the top 20, counted before and after and recorded. The average goes up, and no item drops by more than 2.
    - "Phase 5 as built" in `SEARCH-PLAN.md` (site ids, what was left out, surprises); phase 5 marked done in the Phases list; spec status updated.
  - Verify: the numbers table is in the doc.
  - Files: `SEARCH-PLAN.md`, `SPEC-categories-phase-5.md`
  - Size: S · Depends on: Tasks 9–12

- [x] **Checkpoint: complete.** All spec success criteria ticked; ready for review.
