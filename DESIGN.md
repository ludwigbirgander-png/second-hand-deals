---
name: Kompi
description: A curated deal tracker for Swedish second-hand marketplaces — warm paper, pop colors, flat surfaces.
colors:
  ink: "#0b0b0a"
  ink-2: "#262623"
  paper: "#ecebe4"
  paper-2: "#e2e0d6"
  paper-3: "#d5d1c1"
  chalk: "#faf9f5"
  grey-600: "#5f5d57"
  grey-400: "#a09d94"
  grey-300: "#c4c1b7"
  signal: "#ff2438"
  signal-deep: "#a8101f"
  mint: "#cdf6cf"
  mint-deep: "#3f8a4d"
  violet: "#c67cf7"
  periwinkle: "#c7d2fa"
  lemon: "#f1f79c"
  tangerine: "#f5821f"
  bubblegum: "#ffc6e7"
  grape: "#a88bf5"
  sage: "#a0b8ab"
  stone: "#ababab"
typography:
  mega: { fontFamily: Geist, fontSize: 88px, fontWeight: 400, lineHeight: 0.9, letterSpacing: "-0.055em" }
  display: { fontFamily: Geist, fontSize: 60px, fontWeight: 400, lineHeight: 0.94, letterSpacing: "-0.045em" }
  headline: { fontFamily: Geist, fontSize: 34px, fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.032em" }
  title: { fontFamily: Geist, fontSize: 24px, fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.022em" }
  body: { fontFamily: Geist, fontSize: 15px, fontWeight: 400, lineHeight: 1.4, letterSpacing: "-0.005em" }
  label: { fontFamily: Geist, fontSize: 13px, fontWeight: 400, lineHeight: 1.3 }
rounded: { xs: 8px, sm: 12px, md: 20px, lg: 28px, xl: 36px, pill: 999px }
spacing: [4px, 6px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 56px]
---

# Design System: Kompi

The source of truth is the design handoff (`../design_handoff_kompi_redesign/`, kept next to the repo) and its tokens, which live in code in [`app/globals.css`](app/globals.css). This file summarises the rules.

## Principles
- **Full-bleed screen color.** Each screen owns one background: Watchlist is `paper-2` (desktop) / `paper` (mobile), Scan is `signal`, and an Item takes its first list's color (then its category's, then `stone`). Pages set it with `<ScreenBackground>`; the body transitions over `--dur-slow`.
- **Flat by default.** Depth comes from color and overlap. Shadows appear only on detached surfaces: sheets and the open search panel.
- **Ink is the single heavy accent.** Primary buttons, active segmented options, "N new" pills and the starred ring are ink. There is no separate star color.
- **Oversized, tight type.** Geist 400/500/600/700 with negative tracking. Screen titles use a second line in the screen's deep tint (`ScreenTitle`), sized fluidly between the mobile and desktop values.
- **Light only.** There is no dark mode.

## Color roles
- List/category color names stored in the DB map to screen colors in `lib/colors.ts` (`THEME`): zinc→stone, blue→periwinkle, green→mint, amber→lemon, red→signal, purple→violet, orange→tangerine, teal→sage, pink→bubblegum, indigo→grape.
- Marketplaces: Blocket tangerine, Tradera periwinkle-deep, Vinted moss, Sellpy violet, Facebook stone. Shown only as a dot on a veil pill (`SiteBadge`).
- Text: `ink` for content, `grey-600` (`text-muted`) for secondary text on paper and chalk, `on-color-muted` (58% ink) on color screens.

## Components (`components/ui/`)
Button / IconButton (pill and circle, press scales to .97), Pill / SiteBadge, Thumb (hatched placeholder), Avatar / AvatarStack, Price (Swedish grouping, dimmed `kr`), Input, Segmented (track or chips), TagToggle, Toggle, Sheet (bottom sheet on mobile, right drawer from `md`), ScreenTitle, TickProgress, StackCard, ListingCard.

## Motion
Easing `cubic-bezier(.2,.8,.2,1)`; durations 140 / 240 / 420ms. Expanding panels animate `grid-template-rows: 0fr → 1fr`. Everything respects `prefers-reduced-motion`.

## Known contrast exceptions (accepted as designed)
The deep-tint subtitles on list colors (2.0–2.8:1), the grey "N new finds" subtitle, muted text on bright colors (3.0–3.7:1) and hairline input edges are below WCAG AA by design.
