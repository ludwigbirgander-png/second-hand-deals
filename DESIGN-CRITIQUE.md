# Design Critique: Kompi

Reviewed 2026-06-12 against the app's own DESIGN.md ("The Friendly Edit") and PRODUCT.md (Playful · Light · Friendly, Are.na restraint with a smile). Based on full component code review.

## Overall Impression

The bones are right: lean zinc palette, two-weight Geist hierarchy, borders instead of shadows, a focused single-input home page. But the implementation has drifted toward exactly what DESIGN.md rejects — a uniform marketplace card grid — and the promised warmth ("a smile") is missing entirely. Right now Kompi reads as competent-generic. The biggest opportunities: an accessibility pass (contrast and touch targets currently fail), a feedback layer (errors/undo/loading), and the brand personality the docs describe but the UI never delivers.

## Usability

| Finding | Severity | Recommendation |
|---------|----------|----------------|
| Edit/Delete on item cards are `opacity-0 group-hover:opacity-100` — invisible and unreachable on touch devices | 🔴 Critical | Always show at reduced opacity on touch (`@media (hover: none)`), or move actions into the card menu |
| Delete item has no confirmation and no undo — one mis-tap destroys an item + all its listings | 🔴 Critical | Prefer undo-toast over confirm dialog (friendlier, faster): optimistic delete + 5s "Undo" |
| All mutations are optimistic with zero error feedback — a failed delete/rename silently lies to the user | 🟡 Moderate | Add a minimal toast for failures; revert optimistic state |
| Drag-and-drop is the only in-watchlist way to file items into lists; no keyboard path | 🟡 Moderate | Keep drag, add "Add to list" in the edit flow as the accessible path (it exists — surface it) |
| Blue count badge on item cards has no label — users must guess it means "new since last viewed" | 🟡 Moderate | Add `title`/`aria-label` "3 new listings"; consider showing "3 new" instead of bare number |
| No "forgot password" on login | 🟡 Moderate | Add Supabase password reset flow |
| Two parallel add-item flows (home page form + AddItemModal) with duplicated logic | 🟢 Minor | Extract one shared form component |
| Watchlist has no per-item Refresh — must enter each item page | 🟢 Minor | Add refresh action to the card hover menu |

## Visual Hierarchy

- **What draws the eye first (watchlist):** the saturated blue new-listings badge — the strongest color on the page is a notification dot, not content. Wrong emphasis; it also breaks the system's own One-Accent Rule.
- **Reading flow (listing card):** image → title → metadata → price. Price is the decision-driver for a deal tracker; it holds up (semibold, tabular), but the metadata row mixes three different grays in one line, which reads as noise.
- **Home page:** correctly focused — one question, one input. The best screen in the app.
- **Empty states:** "No listings found yet" in faint gray is the opposite of the promised "encouraging empty states." This is the cheapest place to add the brand's smile: explain what was searched, suggest the fix ("Try removing the brand, or hit Refresh"), give an action button.

## Consistency (vs. the app's own DESIGN.md)

| Element | Issue | Recommendation |
|---------|-------|----------------|
| Amber on auction countdown (`text-amber-600` when <2h) | Violates the One-Accent Rule — amber is contractually "starred only" | Use ink at semibold for urgency, or red-600 (urgency is closer to destructive than favorite) |
| Blue-500 new-listings badge | Saturated categorical color outside the badge rule; second accent | Ink badge (`bg-zinc-900 text-white`) or a 100-level tint |
| `shadow-sm` at rest on home search input/panel, card hover buttons | Violates Flat-by-Default | Remove; borders are already doing the work |
| `hover:shadow-md` on listing cards | Spec says hover whisper is `0 1px 4px` (shadow-sm) | Downgrade to shadow-sm |
| `rounded-2xl` on home inputs/panels | Spec: inputs/cards 12px, 16px reserved for modals | Normalize to `rounded-xl` |
| Uniform square card grid for BOTH watchlist and listings | Spec explicitly: "watchlist and listing rows are different shapes; keep that rhythm" — and the square grid is the marketplace-clone register PRODUCT.md rejects | Differentiate: keep the grid for listings, make the watchlist a denser editorial row/list (name, price, sparkline of new finds) — instantly stops feeling like a Tradera clone |
| Dark mode fully implemented but completely unspecified in DESIGN.md | Doubled class noise, no dark tokens, drift guaranteed | Either spec dark tokens properly or remove dark mode and ship one excellent light theme (more aligned with "bare canvas" anyway) |
| Default Next.js public assets (`file.svg`, `globe.svg`, `vercel.svg`) and favicon | No brand presence at the browser level | Replace favicon with a simple Kompi mark; delete template assets |
| Login page hierarchy: h1 "Sign in", subtitle "Kompi" | Brand demoted to a caption | Kompi as the wordmark, "Sign in" as the action label |

## Accessibility (WCAG AA gaps)

- **Contrast — failing:** `text-zinc-400` (#a1a1aa) on white ≈ 2.5:1, used for real information (dates, locations, prices ranges, empty states). AA requires 4.5:1. Rule: zinc-400 for placeholders only; zinc-500 (#71717a, ≈4.6:1) is the floor for meaningful text; bump 12px metadata to zinc-600.
- **Touch targets:** star/edit/delete buttons are 28px (`w-7 h-7`); minimum is 44px effective. Enlarge the hit area (padding or pseudo-element) without growing the icon.
- **Reduced motion:** PRODUCT.md explicitly requires `prefers-reduced-motion` support; nothing honors it (spinners, progress transitions, countdown). Add `motion-reduce:` variants or a global media query.
- **Language:** `<html lang="sv">` with English UI — screen readers will mangle pronunciation. Pick one (PRODUCT.md implies Swedish users; Swedish copy would also add warmth).
- **State semantics:** sort pills need `aria-pressed`; the new-listings badge needs a text alternative.
- **Good already:** aria-labels on icon buttons, alt text from listing titles, color never the sole signal on starred state.

## What Works Well

- The home page is the brand at its best: one question, one input, progressive disclosure of options.
- The scrape progress view (per-site checklist with live counts) is genuinely delightful and honest — it shows work being done on your behalf. This IS "the friend who searched for you." Lean into it.
- Palette discipline mostly holds: site badges at 100-level tints, green confined to success, structure from borders.
- Single-typeface, two-weight hierarchy is consistently executed.

## Priority Recommendations

1. **Accessibility pass** — contrast floor to zinc-500, 44px touch targets, always-visible actions on touch, reduced-motion support, fix `lang`. Mechanical work, ~a day, and it's currently the largest real-user harm.
2. **Add the missing warmth where it's cheap and high-leverage** — empty states with encouragement + action, microcopy with personality (the difference between "No listings found yet" and "Nothing yet — the flea market restocks daily"), a favicon/wordmark, and one considered color moment. This is the gap between the brand brief and the product.
3. **Break the marketplace-clone rhythm** — differentiate watchlist (editorial rows: image thumb, name, lowest price, "3 new") from listings (the shopping grid). One layout change, two big wins: follows your own spec, and makes the app feel like a tracker rather than a store.
4. **Feedback layer** — undo-toast deletes, error toasts on failed mutations, skeletons on watchlist load. Trust requires the app to admit when something didn't work.
5. **Token cleanup** — amber back to starred-only, blue badge → ink, kill resting shadows, normalize radii, decide dark mode's fate officially.
