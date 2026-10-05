---
name: Kompi
description: A curated deal tracker for Swedish second-hand marketplaces — warm paper canvas, palette H list colours, Figtree, and the eye as the only character.
colors:
  ink: "#1d1b16"
  ink-2: "#34312a"
  ink-3: "#5b574c"
  paper: "#f6f1e7"
  paper-2: "#ece5d7"
  paper-3: "#ddd4c2"
  chalk: "#fffdf8"
  grey-600: "#6b665a"
  grey-400: "#aaa498"
  state-new: "#ff4a2b"
  state-danger: "#b8260c"
  add-bg: "#ffbdd6"
lists:
  zinc: { fill: "#D6D6D6", on: ink }
  blue: { fill: "#466FFF", on: ink }
  green: { fill: "#14B828", on: ink }
  amber: { fill: "#FFD500", on: ink }
  red: { fill: "#FF1A4F", on: ink }
  purple: { fill: "#9100C2", on: chalk }
  orange: { fill: "#FFA500", on: ink }
  teal: { fill: "#00BAA6", on: ink }
  pink: { fill: "#FFBDD6", on: ink }
  indigo: { fill: "#0000AA", on: chalk }
typography:
  family: Figtree (next/font/google, 400/500/600/700)
  mega: { size: 88px, lineHeight: 0.9, tracking: "-0.05em" }
  display: { size: 64px, lineHeight: 0.95, tracking: "-0.045em" }
  title: { size: 40px, lineHeight: 1, tracking: "-0.035em" }
  headline: { size: 28px, lineHeight: 1.05, tracking: "-0.025em" }
  subhead: { size: 20px, lineHeight: 1.2, tracking: "-0.015em" }
  body: { size: 16px, lineHeight: 1.45, tracking: "-0.005em" }
  small: { size: 14px, lineHeight: 1.4 }
  label: { size: 13px, lineHeight: 1.3 }
  micro: { size: 11px, tracking: "0.06em" }
rounded: { xs: 6px, sm: 10px, md: 12px, lg: 16px, xl: 20px, pill: 999px }
spacing: [4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 56px, 72px]
controls: { sm: 32px, md: 40px, lg: 48px, minHitMobile: 44px }
---

# Design System: Kompi (v2)

The source of truth is the v2 design handoff (`../design_handoff_kompi_redesign_v2/`, kept next to the repo: `README.md`, `IMPLEMENTATION.md`, `tokens/*.css`). In code the tokens live in [`app/globals.css`](app/globals.css). The v1 handoff is archived and should not be followed.

## Principles
- **The canvas is always light paper.** Pop colour lives on chips, tiles, badges and the eye — never on the page background.
- **Lists only.** Items are organised by lists; categories were removed. A list's colour shows as its chip, the dot on its tiles and the active-chip fill.
- **One floating action.** "+ Add item" on the watchlist and "Edit item" on an item page (pink pill, ink disc). It grows into the add/edit card; `/` or typing opens it.
- **Mostly flat.** Shadows only on things that float: the floating button (`--shadow-float`) and open panels (`--shadow-panel`).
- **Figtree throughout.** Headlines 700, body 400, UI labels and buttons 500–600. Prices are tabular (`.k-num`).

## Colour
- Neutrals are warm: ink `#1d1b16` on paper `#f6f1e7`, chalk `#fffdf8` for cards and fields, `--text-muted` for secondary text.
- List colours are palette H "Crayon box", keyed by the stored names in `lists.color` (`lib/colors.ts` → `THEME[name] = [fill, textOnFill]`, i.e. `--list-<name>` / `--on-list-<name>`). The names never change; only their values do.
- `--state-new` (red dot on "N new" badges), `--state-danger` (delete), `--focus-ring` (periwinkle).
- Marketplaces show only as a coloured dot beside the site name (`SiteBadge`).

## The eye — the only character
`components/brand/Eye.tsx` (keyframes in `globals.css`). It is the "o" in the logo and the app's only illustration.

| State | Animation | Where |
|---|---|---|
| Looking | `blink` | Logo, idle |
| Curious | `follow` | Empty watchlist |
| Thinking | `roll` | Scrape running (scan screen, new tile) |
| Happy | `happy` | New listings arrived after a refresh (~2s) |
| Winking | `wink` | Logo, once, after adding an item |
| Sleepy | `drowse` | "Nothing new today" |
| Asleep | `zzz` | Item with no listings |

One-off states play once and return to Looking. Under `prefers-reduced-motion` the eye shows a still pose instead.

## Components (`components/ui/`, `components/brand/`)
Logo (wordmark and icon), Eye, Button / IconButton (32/40/48, pill, `.k-press` scales to .96), Chip (list filter/picker, add and followed variants), Badge (new/soft/outline), ItemTile (photo + text below), ListingCard, Price (sm–mega), Input, PriceRange, Toggle, Segmented, Sheet, FloatingButton, Avatar/AvatarStack, Pill, SiteBadge. `AddPanel` is the add/edit card (desktop) or full-screen sheet (mobile).

## Motion
Easing `--ease-out cubic-bezier(.2,.8,.2,1)` and `--ease-spring cubic-bezier(.34,1.5,.64,1)`; durations 140 / 240 / 420ms. The add card grows from the button with the spring; a new tile drops in (40px, scale .8). Everything respects `prefers-reduced-motion`.
