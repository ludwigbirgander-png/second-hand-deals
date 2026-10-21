# Implementation Plan: Search phase 5 — five more categories and no Brand field

Spec: `SPEC-categories-phase-5.md` (approved 2026-10-20). Tasks: `tasks/todo.md`. Branch: `search-phase-5`.

## Overview
_Updated 2026-10-21 after tasks 1–8: tasks 9–12 now carry the site ids, parsers and decisions learned so far (see `tasks/todo.md`)._

Two parts. **Part A** removes the Brand field and merges existing brands into item names. It is small and ships on its own. **Part B** generalises the category framework (new field kinds, parsers, field visibility, more native site params). It then adds Phones & tablets, Computers, Furniture & design, Watches & jewellery, and Glass, ceramics & tableware, one category per task, each with its tests. Clothing and Shoes must behave exactly as before throughout.

## Site check (done while planning, 2026-10-20)
| Site | Finding | Use |
|---|---|---|
| Auctionet | `category_id` works on `api/v2/items.json`, **one id per request** (`6,9` returns 0). Top-level ids: Möbler **16** (chairs **18** inside it), Belysning & lampor **1**, Speglar **42**, Mattor & textil **35**, Klockor & ur **31**, Smycken & ädelstenar **13**, Glas **6**, Keramik & porslin **9**. Tested: "stol" 2,838 → 2,024 (16); "omega" 111 → 106 (31); "iittala" 97 → 81 (6); "rörstrand" 380 → 367 (9); "ring" 8,517 → 2,624 (13). | Send an id only when one id covers the item's choices: Furniture → 16, or 1 if the type is only Lamp; Watches → 31 for watch types, 13 for jewellery types, none for a mix; Glass → none (glass and ceramics are split). |
| Blocket | Top-level `category`: Elektronik och vitvaror **0.93**, Möbler och inredning **0.78**, Kläder, kosmetika och accessoarer **0.71**, Konst och antikt **0.76**. Sub-categories still unknown. | Phones and Computers → 0.93, Furniture → 0.78. Watches and Glass: none for now (they're split across 0.71/0.76 and 0.78/0.76). Sub-categories are checked in Task 3. |
| Sellpy | Algolia facets (query with `facets: ['categories.lvl2']`). All five are there: phones `Prylar > Hemelektronik > Mobil & Wearables` ("iphone" 201 hits); computers `Prylar > Hemelektronik > Datorer & Tillbehör` ("macbook" 49); watches `{Kvinna,Man,Barn} > Accessoarer > Armbandsur` ("klocka" 2,798 + 904 + 142); jewellery `{Kvinna,Man,Barn} > Accessoarer > Smycken` ("ring guld" 555 + 79); glass & ceramics `Prylar > Hushåll > Porslin`, `Prylar > Hushåll > Koppar & Glas`, `Prylar > Inredning > Vaser & Krukor` ("rörstrand" 227 + 84); furniture `Prylar > Inredning > Möbler`, lamps `Prylar > Inredning > Belysning` ("lampa" 5,721). Smartwatches also sit under Mobil & Wearables. | Sellpy goes in **all five**. Send an OR of the `categories.lvl2` paths (these paths replace `sellpyGroup` for the new categories). Phones: the Mobil & Wearables path only, so the 725 "Mobilaccessoarer" (cases) are never fetched. |
| Vinted | Plain search returns relevant listings for all five ("iPhone 13, 86% batterihälsa", "MacBook Air 2025 (M4)", "Omega Seamaster 600 vintage", "Nuran guldring (14 karat)", "4 st assietter Isolde från Rörstrand", "Teak stol"). Some are Polish or Danish listings, as today. | Vinted goes in **all five**; no native category for now. |
| Blocket sub-categories | Under 0.93: Telefoner och tillbehör **1.93.3217**, Datorer **1.93.3215**. Under 0.78: Bord och stolar **1.78.5196**, Soffor och fåtöljer **1.78.7756**, Hyllor och byråer **1.78.8345**, Sängar **1.78.5197**, Lampor **1.78.5181**, Mattor **1.78.5180**, Köksutrustning och porslin **1.78.5223**, Dekoration **1.78.5222**. | v1 sends the top level only (0.93, 0.78): the sub-categories split phones from tablets and glass from antiques in ways we can't map safely yet. Recorded for later. |
| Bukowskis | `/sv/lots?query=` has no category parameter in its links. | No native filter; Kompi's own check. |
| Tradera HTML | Categories are URL paths (`/category/<id>`), not a search parameter. | No native filter in v1 (the API keys are still on hold). |

## Architecture decisions
- **Field kinds on `CategoryField`** (`options`, `size`, `min`, `range`, `toggle`) rather than one-off code per category. Every later category is then declarative data, with an optional `parse` for anything word patterns can't read.
- **Flat, widened types.** `ItemFilters` and `ListingAttributes` keep their typed shared keys and gain category keys. The stored jsonb shape is unchanged, so there's no schema migration, and phase 4 items need no rewrite.
- **`showWhen` lives in the registry and is evaluated by one pure helper** (`visibleFields(category, filters)`). The UI, `sanitizeFilters` and `checkListing` all use it, so a hidden field can never filter.
- **Native params are optional per site and only sent when unambiguous** (see the Auctionet and Blocket rules above). Kompi's own check is always the safety net.
- **Brand merge is a one-off SQL data update.** The `items.brand` column stays until a later clean-up, and code tolerates a non-null brand until then.
- **Order:** risky unknowns first (the site check in Task 3), then the framework, then categories as vertical slices. Phones comes first because it exercises `options` + `min` + `toggle`, and its UI is built in the same stretch.

## Task list
See `tasks/todo.md` for acceptance criteria, verification and files per task.

### Part A: Remove the Brand field (ships alone)
- [x] Task 1: Merge brands into names and remove the Brand input
- [x] Task 2: Remove brand from display and copy
- [ ] Checkpoint A: tests, lint, build; manual add/edit; merge after review

### Part B1: Framework
- [x] Task 3: Live site check for Sellpy, Vinted, Bukowskis, Tradera and Blocket sub-categories
- [x] Task 4: Field kinds, widened types, sanitize/describe, `visibleFields`
- [x] Task 5: Parsers and `checkListing` by field kind
- [x] Task 6: Registry and native plumbing (priority order, optional `sellpyGroup`, `cardFields`, Auctionet/Bukowskis options)
- [x] Checkpoint B1: phase 4 tests untouched and green; no behaviour change

### Part B2: Categories (vertical slices)
- [x] Task 7: Phones & tablets
- [x] Task 8: UI for the new field kinds, scrolling chips, card details
- [x] Checkpoint B2: add a phone item end to end in the dev app
- [ ] Task 9: Computers
- [ ] Task 10: Furniture & design
- [ ] Task 11: Watches & jewellery
- [ ] Task 12: Glass, ceramics & tableware
- [ ] Checkpoint B3: all five live-checked

### Part B3: Wrap-up
- [ ] Task 13: Precision check and "Phase 5 as built"
- [ ] Checkpoint: complete; ready for review

## Parallelisation
Tasks 9–12 are independent once Task 8 is in. They touch different parts of `lib/categories/index.ts` and the test file, so run them in sequence or expect simple merge conflicts. Part A is independent of Part B.

## Risks and mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Suggestion overlaps across seven categories ("Iittala lampa", "Apple Watch", "skrivbordslampa") | Med | A declared `CATEGORY_PRIORITY` (phones → computers → watches → furniture → glass → shoes → clothing) and a 20-name priority test at Checkpoint B3 |
| RAM vs storage vs screen numbers in computer titles ("8/256", "MacBook Pro 13 M1") | Med | Storage only from its own size list; RAM from "RAM"/"minne" or a slash pair; screen size only with a unit |
| Decimal values (ring size 17.5) can't be typed: the form reads whole numbers | Med | `step` on number fields; the form accepts "17,5" (Task 11) |
| Type-aware junk words ("armband" is junk for a watch, not for a bracelet) | Low | Not built: only "armband till" and similar are junk (Task 11); revisit if bracelets show up as noise |
| Widening the types breaks phase 4 behaviour | High | Task 4–6 rule: no edits to existing phase 4 tests; Checkpoint B1 compares listings for 3 saved Clothing/Shoes items before and after |
| Number parsers misread titles ("iPhone 13" as a 13″ screen, "Lilla Åland 4 st" vs model numbers) | Med | Parsers only read numbers next to a unit or keyword; negative test cases for each |
| Junk words drop good listings ("armband" in "klocka med armband") | Med | Junk words skip words in the search and type-aware lists; a fixture test for each known trap |
| Brand merge doubles words ("Sony Sony WH-1000XM4") | Low | SQL skips names that already start with the brand (case-insensitive); dry-run `select` first |
| Site markup or API changes during the build | Med | Native params are optional; a failure falls back to Kompi's own check; `npm run check:scrapers` at each category |
| Seven chips crowd the add panel on phones | Low | One scrolling row, short labels, checked at 375 px |

## Open questions
None blocking. Task 3 may move a *(verify)* site in or out of a category; I'll record the result in this file and in "Phase 5 as built".
