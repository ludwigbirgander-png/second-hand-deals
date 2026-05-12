---
name: Second Hand Deals
description: A curated deal tracker for Swedish secondhand marketplaces.
colors:
  bare-canvas: "#fafafa"
  surface: "#ffffff"
  surface-subtle: "#f4f4f5"
  border-default: "#e4e4e7"
  border-strong: "#d4d4d8"
  text-faint: "#a1a1aa"
  text-muted: "#71717a"
  text-secondary: "#52525b"
  ink: "#18181b"
  amber-star: "#fbbf24"
  amber-star-border: "#fcd34d"
  green-confirm: "#22c55e"
typography:
  headline:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  badge-site:
    rounded: "{rounded.full}"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Second Hand Deals

## 1. Overview

**Creative North Star: "The Friendly Edit"**

Second Hand Deals is a curated deal tracker, not a comparison engine. The interface should feel like a trusted friend who has done the searching for you and laid the results out on a clean table. Every screen is an invitation to browse, not a wall of data to parse. Restraint earns the warmth; warmth earns the trust.

The palette is intentionally lean: bare canvas, ink, and borders do almost all the structural work. Color appears as signal (amber for favorites, green for success, site-tinted badges for provenance) rather than decoration. This sparseness is what lets items feel curated rather than dumped.

The visual language owes a debt to Are.na: considered spacing, clean typographic hierarchy, surfaces that recede so content can breathe. But unlike Are.na's cool neutrality, this system has a smile. Proportions are a touch warmer, interactions a touch friendlier, empty states a touch more encouraging.

This system explicitly rejects: generic SaaS dashboard chrome (sidebar nav, metric cards, gradient banners); marketplace-clone density (Blocket, Tradera, eBay); dark-mode-with-neon hacker aesthetics; startup landing page theatrics (hero sections, gradient text, animations for their own sake).

**Key Characteristics:**
- Near-flat surfaces separated by borders, never shadows at rest
- Geist Sans at two weights (400, 600) for nearly all hierarchy
- Ink (near-black) as the single primary action color
- Amber as the one personal accent: appears only on starred/favorited items
- Site provenance communicated through soft tinted badge pills, not icons
- Rounded corners throughout: inputs and buttons at 12px, pills at full

## 2. Colors: The Bare Canvas Palette

One ink, one canvas, one personal accent. Everything else is neutral signal.

### Primary
- **Ink** (`#18181b`): The primary action color and dominant text. Used for primary buttons, active toggle states, primary text, and the progress bar fill. Ink is the only "heavy" color on any given screen.

### Secondary
- **Amber Star** (`#fbbf24`): The personal accent. Appears exclusively on starred/favorited listings: the filled star icon, the border of a starred card, and the ring highlight. Its rarity is the point. If it appears on more than 5% of a screen at once, something has gone wrong.
- **Amber Star Border** (`#fcd34d`): The softer companion to Amber Star, used for the card ring on starred listings.

### Tertiary
- **Green Confirm** (`#22c55e`): Success signal only. Appears on the scrape progress checkmarks when a site finishes. Not a brand color; purely functional.

### Neutral
- **Bare Canvas** (`#fafafa`): Page background. Not white. The slight off-white keeps the white surface cards from flattening into the page.
- **Surface** (`#ffffff`): Card backgrounds, modal backgrounds, nav background. Everything that "sits" on the canvas.
- **Surface Subtle** (`#f4f4f5`): Nested backgrounds, hover states, progress bar tracks, unselected toggle backgrounds.
- **Border Default** (`#e4e4e7`): The primary dividing line. Used on cards, inputs at rest, nav bottom, section separators.
- **Border Strong** (`#d4d4d8`): Inputs on focus-adjacent states, dashed new-category borders on hover.
- **Text Faint** (`#a1a1aa`): The quietest text: empty-state descriptions, icon defaults, placeholder text.
- **Text Muted** (`#71717a`): Supporting metadata: dates, secondary nav links, count labels.
- **Text Secondary** (`#52525b`): Body text that isn't primary: descriptions, sub-labels, ghost button text.

**The One-Accent Rule.** Amber is the only personal color in the system. It marks what the user has decided matters. Never use amber for anything except the starred/favorite state. If you need a positive signal color elsewhere, use green. Everything else uses the neutral ramp.

**The Site Badge Rule.** Platform provenance (Blocket, Tradera, Vinted, Sellpy) is the only place where categorical color appears. These badge tints (orange, blue, teal, purple) are functional labels, not brand elements. They must always appear at low saturation (100-level tint) and never bleed into the surrounding UI.

## 3. Typography

**Display Font:** Geist (with Arial, Helvetica, sans-serif as fallback)
**Body Font:** Geist (same family throughout)

**Character:** A single geometric sans at two weights. Hierarchy comes entirely from size and weight contrast, not from mixing families. The result is quiet, consistent, and fast to parse: you feel the structure before you consciously read it.

### Hierarchy
- **Headline** (semibold 600, 24px, leading-tight): Page titles. One per screen. Used on the watchlist heading, item detail title.
- **Title** (semibold 600, 18px, leading-snug): Section headers, modal titles, card headings at emphasis.
- **Body** (regular 400, 14px, 1.5 line-height): All listing titles, descriptions, form labels, navigation links. The workhorse. Max 65-75ch line length.
- **Label** (medium 500, 12px, slight tracking): Badges, chips, date stamps, sort buttons, count labels. Always one line.

**The Two-Weight Rule.** Only regular (400) and semibold (600) are used. Medium (500) appears only on label-scale text (12px badges). No bold (700), no light (300). Hierarchy is achieved through size ratios, not weight proliferation.

## 4. Elevation

This system is flat by default. Surfaces are separated by borders, not shadows. A white card on a bare-canvas background reads as elevated because of the background contrast and the 1px border, not because of any drop shadow.

**The Flat-by-Default Rule.** No surface carries a shadow at rest. The only exception is the modal overlay (`shadow-xl`), which sits above the entire page and needs to communicate maximum z-elevation clearly. Everything else: borders only.

### Shadow Vocabulary
- **Modal lift** (`box-shadow: 0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)`): Used only on the `AddItemModal`. Signals that this surface is detached from the page entirely.
- **Listing hover** (`box-shadow: 0 1px 4px rgba(0,0,0,0.06)`): A whisper of shadow on listing card hover to confirm interactivity. Not a resting state.

## 5. Components

### Buttons
- **Shape:** Gently rounded (12px radius). Approachable but not bubbly.
- **Primary:** Ink background (`#18181b`), white text, 12px radius, `px-5 py-2` (20px × 8px). Hover: `#3f3f46` (zinc-700), slight background lighten.
- **Secondary / Ghost:** White background, `border-zinc-200`, `text-zinc-600`, same radius and padding. Hover: `bg-zinc-50`.
- **Destructive:** `bg-red-50 text-red-600`, hover `bg-red-100`. Same shape.
- **Sort pills:** `bg-zinc-100 text-zinc-600 rounded-lg` at rest; `bg-zinc-900 text-white rounded-lg` when active. 8px radius (one step smaller, feels more compact for filter controls).

### Chips / Badges
- **Site badges:** Rounded-full, 12px text, `px-2 py-0.5`. Tinted backgrounds at the 100-level: orange (Blocket), blue (Tradera), teal (Vinted), purple (Sellpy), zinc (Facebook). Color is informational; never decorative.
- **Category / List tags:** Rounded-full, 12px text, `px-2.5 py-1`, `font-medium`. Selected state: `ring-2` in the color's ring token. Unselected: `opacity-50`.
- **Starred indicator:** Amber-filled star icon (16px). The card grows a 1px amber border and an amber ring on the starred state.

### Cards / Containers
- **Corner Style:** Gently curved (12px radius, `rounded-xl`). Modals and large overlays use 16px (`rounded-2xl`).
- **Background:** White surface on bare-canvas background. Never card-on-card.
- **Shadow Strategy:** None at rest (see Elevation). `shadow-sm` on hover for interactive listing rows.
- **Border:** 1px `border-zinc-200` at rest. Becomes `border-zinc-400` on drag-over states.
- **Internal Padding:** 12-16px (`p-3` / `p-4`). Modals use 24px (`p-6`).

### Inputs / Fields
- **Style:** White background, 1px `border-zinc-300`, 12px radius, `px-3 py-2`, 14px text.
- **Focus:** Border shifts to `border-zinc-500` + `ring-1 ring-zinc-200`. No glow, no color.
- **Placeholder:** `text-zinc-400`. Clear and quiet.

### Navigation
- White background, `border-b border-zinc-200`. `font-semibold text-zinc-900` for the brand name; `text-sm text-zinc-500` for secondary links. Hover: `text-zinc-700`. No active-indicator bar; the page title communicates current location.

### Progress / Scrape Feedback
- **Progress bar:** Full-width, `h-2 rounded-full`, `bg-zinc-100` track, `bg-zinc-900` fill. Transitions `duration-500`. Width animated via inline style.
- **Site status rows:** Gray dot (pending) → spinning ring (scraping) → green checkmark (done). Count badge appears only when done: `bg-green-100 text-green-700` for results, `bg-zinc-100 text-zinc-400` for none.
- **Toggle:** `h-5 w-9 rounded-full`. Off: `bg-zinc-200`. On: `bg-zinc-900`. Sliding white circle `h-3.5 w-3.5`.

## 6. Do's and Don'ts

### Do:
- **Do** use `border-zinc-200` as the default dividing line. Borders do all structural separation work.
- **Do** reserve amber entirely for the starred/favorite state. Its scarcity is what makes it meaningful.
- **Do** use site-tinted badges at the 100-level tint only. Higher saturation badges would compete with content.
- **Do** keep modals as a last resort. Most interactions (rename, toggle, filter) should happen inline.
- **Do** use `rounded-xl` (12px) for interactive surfaces (buttons, inputs, cards). `rounded-full` for pills only.
- **Do** allow white cards to "float" on bare-canvas by using `border-zinc-200`, not shadow, as the separator.
- **Do** communicate status through typography weight and color shifts (zinc-400 → zinc-900), not icons alone.

### Don't:
- **Don't** use a sidebar nav, metric cards, or gradient banners. This is not a SaaS dashboard.
- **Don't** make this look or feel like Blocket, Tradera, or eBay. The app aggregates those; it must feel like a different register entirely.
- **Don't** use dark mode with neon accents, terminal aesthetics, or glassmorphism.
- **Don't** use hero sections, gradient text, or animations for their own sake.
- **Don't** use `border-left` or `border-right` as a colored accent stripe on any card, callout, or alert. Rewrite with background tints, full borders, or nothing.
- **Don't** use `background-clip: text` gradient text. Use a solid color; emphasis comes from weight and size.
- **Don't** add a second accent color. One ink, one amber, that's the system. Adding a second accent dissolves the amber's meaning.
- **Don't** use card grids with identical dimensions and icon + heading + text repeated endlessly. The watchlist and listing rows are different shapes; keep that rhythm.
- **Don't** nest cards. A card inside a card is always a layout problem in disguise.
