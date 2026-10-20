# Todo: Search phase 5

Plan: `tasks/plan.md`. Spec: `SPEC-categories-phase-5.md`.
Every task also clears the standing bar: `npm test`, `npm run lint`, `npx tsc --noEmit` pass, with no phase 4 test edited.

## Part A: Remove the Brand field

- [ ] **Task 1: Merge brands into names and remove the Brand input**
  - Acceptance:
    - `supabase/migrations/20261022_merge_brand.sql` sets `name = brand || ' ' || name` and `brand = null` where brand is set and the name doesn't already start with it (case-insensitive); `supabase/schema.sql` notes the column is unused.
    - The add/edit panel has no Brand input; saving sends `brand: null`.
    - The search query for a merged item is identical to before (`buildQuery(null, merged) === buildQuery(brand, name)`).
  - Verify: unit test for the query equivalence; a dry-run `select` of the rows the SQL would change, shown to you before it is run; add and edit an item in `npm run dev`.
  - Files: `supabase/migrations/20261022_merge_brand.sql`, `supabase/schema.sql`, `components/AddPanel.tsx`, `lib/scrapers/scrapers.test.ts`
  - Size: S · Depends on: none

- [ ] **Task 2: Remove brand from display and copy**
  - Acceptance:
    - No brand line on the watchlist tile, item page header or scan page title (the name now carries it).
    - The empty-state hint no longer mentions the brand.
    - Alert emails and `buildQuery` still work while old rows have a brand (nothing reads it after the merge, but nothing breaks if it's set).
  - Verify: `npm run build`; visual check of tile, item page and scan page at 375 px and desktop.
  - Files: `components/ui/ItemTile.tsx`, `app/items/[id]/page.tsx`, `app/items/[id]/scan/page.tsx`, `components/ListingGrid.tsx`
  - Size: S · Depends on: Task 1

- [ ] **Checkpoint A:** tests, lint and build green; you run the migration in Supabase; review, then merge Part A.

## Part B1: Framework

- [ ] **Task 3: Live site check**
  - Acceptance:
    - For each new category, a yes/no per *(verify)* site (Sellpy, Vinted) with the query used and the hit counts.
    - The Sellpy category path (`categories.lvl1`) for watches, jewellery, glass/ceramics, and electronics/home if they exist.
    - Blocket sub-category ids under 0.93 (phones, tablets, computers) and 0.78 (furniture types), if the URL exposes them.
    - Whether Bukowskis `/sv/lots` and Tradera HTML search take a category parameter.
    - Results written into the "Site check" table in `tasks/plan.md`, and each category's `sites` list in the spec updated.
  - Verify: each claim has a reproducible URL or request in the table.
  - Files: `tasks/plan.md`, `SPEC-categories-phase-5.md`
  - Size: XS (research) · Depends on: none

- [ ] **Task 4: Field kinds, widened types, sanitize/describe, visibleFields**
  - Acceptance:
    - `CategoryField` has `kind` (`options` | `size` | `min` | `range` | `toggle`), `unit`, `bounds`, `showWhen`, optional `parse`. Existing Clothing/Shoes fields get `kind: 'options'` or `'size'` with no other change.
    - `sanitizeFilters` validates each kind (unknown ids dropped, numbers clamped to `bounds` or dropped, a range with from > to swapped, toggles kept only as `true`) and drops fields hidden by `showWhen`.
    - `describeFilters` renders the new kinds ("Battery 85 %+", "Case 38–41 mm", "Unlocked").
  - Verify: new unit tests with a test-only category fixture covering every kind; all phase 4 tests green, unedited.
  - Files: `lib/categories/types.ts`, `lib/categories/index.ts`, `lib/categories/categories.test.ts`
  - Size: M · Depends on: none

- [ ] **Task 5: Parsers and checkListing by field kind**
  - Acceptance:
    - `extractAttributes` runs each field's `parse` (title + site fields), falling back to word patterns for `options`.
    - `checkListing` handles every kind: `min` drops below, `range` drops outside, `toggle` requires a stated `true`. A missing detail goes to `unstated` (or drops, if strict). Hidden fields never filter.
    - Shared parser helpers, each with positive and negative tests: `numberWithUnit` (GB/TB, mm, tum/″, %), `percentAfter`, `quantity` ("4 st", "ett par", "set om 6", "6 tallrikar"), `decade` ("60-tal", "1960-talet", "1960s").
  - Verify: unit tests through the test-only fixture category; phase 4 tests unedited.
  - Files: `lib/categories/attributes.ts`, `lib/categories/filter.ts`, `lib/categories/parse.ts` (new), `lib/categories/categories.test.ts`
  - Size: M · Depends on: Task 4

- [ ] **Task 6: Registry and native plumbing**
  - Acceptance:
    - `suggestCategory` walks a declared `CATEGORY_PRIORITY` list, with today's results unchanged.
    - `sellpyGroup` is optional; `sellpyFilters` skips the category clause without it. A new `sellpyPaths` (from Task 3) is used when present.
    - `auctionetCategory(category, filters)` and `bukowskisParams(...)` return an id or params only when unambiguous. `scrapeAuctionet` and `scrapeBukowskis` accept `SearchOptions`.
    - `Category.cardFields` exists and `attributeLabels(listing, category)` returns the short card strings.
  - Verify: unit tests for each native helper; `npm run check:scrapers` for Auctionet and Bukowskis still returns listings with no category.
  - Files: `lib/categories/index.ts`, `lib/categories/native.ts`, `lib/scrapers/auctionet.ts`, `lib/scrapers/bukowskis.ts`, `lib/categories/categories.test.ts`
  - Size: M · Depends on: Tasks 3, 4

- [ ] **Checkpoint B1:** phase 4 tests untouched and green. Three saved Clothing/Shoes items return the same listings before and after (compare `listings` row ids after a refresh). Review before the categories.

## Part B2: Categories

- [ ] **Task 7: Phones & tablets**
  - Acceptance:
    - The `phones` category as in the spec: type (incl. Smartwatch), storage, colour, battery min %, unlocked toggle, junk words, sites from Task 3, Blocket 0.93 (plus a sub-category if found).
    - `suggestCategory`: "iPhone 13 Pro", "Samsung Galaxy S23", "iPad Air", "Apple Watch Series 8" → `phones`.
    - At least 8 fixture titles: "iPhone 13 128GB batterihälsa 89%" passes 128 GB / ≥ 85 %; "iPhone 13 skal" is dropped unless "skal" is in the search; "iPhone 13 13 tum"-style traps don't set storage; "iCloud-låst" is dropped.
  - Verify: `npm test`; `npm run check:scrapers` with "iPhone 13" + Phones.
  - Files: `lib/categories/index.ts`, `lib/categories/types.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Tasks 5, 6

- [ ] **Task 8: UI for new field kinds, scrolling chips, card details**
  - Acceptance:
    - `CategoryFields` renders `min` (number + unit), `range` (two numbers, like `PriceRange`) and `toggle` with existing `Form.tsx` parts, and respects `visibleFields`.
    - The category chip row scrolls sideways in one line at 375 px, with no wrap and no page overflow.
    - Listing cards show the category's `cardFields` in the details line ("256 GB · Battery 88 %").
  - Verify: in `npm run dev`, add "iPhone 13" → Phones suggested → set 128 GB, battery 85, unlocked → refresh → cards and item-page chips are correct; check at 375 px and desktop; keyboard focus order works.
  - Files: `components/CategoryFields.tsx`, `components/ui/Cards.tsx`, `components/ui/Form.tsx` (only if a small number input is missing)
  - Size: M · Depends on: Task 7

- [ ] **Checkpoint B2:** a phone item works end to end in the dev app; review the UI with you before the remaining categories.

- [ ] **Task 9: Computers**
  - Acceptance: the spec's fields (type, chip, RAM, storage, screen size, Swedish keyboard toggle), junk words, sites, Blocket 0.93; "MacBook Air M2 8/256" → chip M2, RAM 8, storage 256; a bare "13" never sets screen size; ≥ 8 fixture titles; suggests for "MacBook Pro", "ThinkPad", "iMac".
  - Verify: `npm test`; `npm run check:scrapers` with "MacBook Air M2" + Computers.
  - Files: `lib/categories/index.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [ ] **Task 10: Furniture & design**
  - Acceptance: type, material, colour, quantity, decade; junk words; sites; Blocket 0.78; Auctionet 16, or 1 when the type is only Lamp. "Lilla Åland stolar 4 st" → Chair, set of 4+; "60-tals teakbord" → Table, Teak, 1960s; "Eames miniatyr" is dropped; ≥ 8 fixtures; suggests for "Lilla Åland stol", "String hylla", "PH5 lampa".
  - Verify: `npm test`; `npm run check:scrapers` with "Lilla Åland" + Furniture; Vinted/Sellpy only searched if Task 3 said yes.
  - Files: `lib/categories/index.ts`, `lib/categories/native.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [ ] **Task 11: Watches & jewellery**
  - Acceptance: type (incl. Smartwatch), movement and case size (`showWhen` watch), metal, ring size (`showWhen` ring), box & papers; junk words with the "armband" exception for Bracelet; Auctionet 31 or 13 by type; "Omega Seamaster 41 mm automatic full set" parses all three; "armband till Omega" is dropped; ≥ 8 fixtures; "Apple Watch" can be filed here with type Smartwatch.
  - Verify: `npm test`; `npm run check:scrapers` with "Omega Seamaster" + Watches; in the dev app, ring size only shows when Ring is picked.
  - Files: `lib/categories/index.ts`, `lib/categories/native.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [ ] **Task 12: Glass, ceramics & tableware**
  - Acceptance: piece type, quantity (incl. 6+), Second sort OK toggle (off hides "2:a sortering", "andra sortering", "sekunda"); junk words; Sellpy path from Task 3; no Auctionet/Blocket category (split categories). "Rörstrand Mon Amie 6 st tallrikar" → Plate, 6+; "Ostindia skål nagg" is dropped; ≥ 8 fixtures; suggests for "Rörstrand Ostindia", "Iittala Kastehelmi", "Gustavsberg Spisa Ribb".
  - Verify: `npm test`; `npm run check:scrapers` with "Mon Amie" + Glass.
  - Files: `lib/categories/index.ts`, `lib/categories/categories.test.ts`
  - Size: S · Depends on: Task 8

- [ ] **Checkpoint B3:** all five categories live-checked; `npm run build` green.

## Part B3: Wrap-up

- [ ] **Task 13: Precision check and "Phase 5 as built"**
  - Acceptance:
    - Ten real items (2 per category): relevant listings in the top 20, counted before and after and recorded. The average goes up, and no item drops by more than 2.
    - "Phase 5 as built" in `SEARCH-PLAN.md` (site ids, what was left out, surprises); phase 5 marked done in the Phases list; spec status updated.
  - Verify: the numbers table is in the doc.
  - Files: `SEARCH-PLAN.md`, `SPEC-categories-phase-5.md`
  - Size: S · Depends on: Tasks 9–12

- [ ] **Checkpoint: complete.** All spec success criteria ticked; ready for review.
