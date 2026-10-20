# Implementation Plan: Search phase 5 — five more categories and no Brand field

Spec: `SPEC-categories-phase-5.md` (approved 2026-10-20). Tasks: `tasks/todo.md`. Branch: `search-phase-5`.

## Overview
Two parts. **Part A** removes the Brand field and merges existing brands into item names. It is small and ships on its own. **Part B** generalises the category framework (new field kinds, parsers, field visibility, more native site params). It then adds Phones & tablets, Computers, Furniture & design, Watches & jewellery, and Glass, ceramics & tableware, one category per task, each with its tests. Clothing and Shoes must behave exactly as before throughout.

## Site check (done while planning, 2026-10-20)
| Site | Finding | Use |
|---|---|---|
| Auctionet | `category_id` works on `api/v2/items.json`, **one id per request** (`6,9` returns 0). Top-level ids: Möbler **16** (chairs **18** inside it), Belysning & lampor **1**, Speglar **42**, Mattor & textil **35**, Klockor & ur **31**, Smycken & ädelstenar **13**, Glas **6**, Keramik & porslin **9**. Tested: "stol" 2,838 → 2,024 (16); "omega" 111 → 106 (31); "iittala" 97 → 81 (6); "rörstrand" 380 → 367 (9); "ring" 8,517 → 2,624 (13). | Send an id only when one id covers the item's choices: Furniture → 16, or 1 if the type is only Lamp; Watches → 31 for watch types, 13 for jewellery types, none for a mix; Glass → none (glass and ceramics are split). |
| Blocket | Top-level `category`: Elektronik och vitvaror **0.93**, Möbler och inredning **0.78**, Kläder, kosmetika och accessoarer **0.71**, Konst och antikt **0.76**. Sub-categories still unknown. | Phones and Computers → 0.93, Furniture → 0.78. Watches and Glass: none for now (they're split across 0.71/0.76 and 0.78/0.76). Sub-categories are checked in Task 3. |
| Sellpy, Vinted, Bukowskis, Tradera HTML | Not checked yet | Task 3 |

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
- [ ] Task 1: Merge brands into names and remove the Brand input
- [ ] Task 2: Remove brand from display and copy
- [ ] Checkpoint A: tests, lint, build; manual add/edit; merge after review

### Part B1: Framework
- [ ] Task 3: Live site check for Sellpy, Vinted, Bukowskis, Tradera and Blocket sub-categories
- [ ] Task 4: Field kinds, widened types, sanitize/describe, `visibleFields`
- [ ] Task 5: Parsers and `checkListing` by field kind
- [ ] Task 6: Registry and native plumbing (priority order, optional `sellpyGroup`, `cardFields`, Auctionet/Bukowskis options)
- [ ] Checkpoint B1: phase 4 tests untouched and green; no behaviour change

### Part B2: Categories (vertical slices)
- [ ] Task 7: Phones & tablets
- [ ] Task 8: UI for the new field kinds, scrolling chips, card details
- [ ] Checkpoint B2: add a phone item end to end in the dev app
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
| Widening the types breaks phase 4 behaviour | High | Task 4–6 rule: no edits to existing phase 4 tests; Checkpoint B1 compares listings for 3 saved Clothing/Shoes items before and after |
| Number parsers misread titles ("iPhone 13" as a 13″ screen, "Lilla Åland 4 st" vs model numbers) | Med | Parsers only read numbers next to a unit or keyword; negative test cases for each |
| Junk words drop good listings ("armband" in "klocka med armband") | Med | Junk words skip words in the search and type-aware lists; a fixture test for each known trap |
| Brand merge doubles words ("Sony Sony WH-1000XM4") | Low | SQL skips names that already start with the brand (case-insensitive); dry-run `select` first |
| Site markup or API changes during the build | Med | Native params are optional; a failure falls back to Kompi's own check; `npm run check:scrapers` at each category |
| Seven chips crowd the add panel on phones | Low | One scrolling row, short labels, checked at 375 px |

## Open questions
None blocking. Task 3 may move a *(verify)* site in or out of a category; I'll record the result in this file and in "Phase 5 as built".
