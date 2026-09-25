export const COLORS = ['zinc', 'blue', 'green', 'amber', 'red', 'purple', 'orange', 'teal', 'pink', 'indigo'] as const
export type Color = (typeof COLORS)[number]

// [screen/card color, deep tint for subtitles] per stored list/category color name
export const THEME: Record<Color, [string, string]> = {
  zinc:   ['var(--stone)', 'var(--grey-600)'],
  blue:   ['var(--periwinkle)', 'var(--periwinkle-deep)'],
  green:  ['var(--mint)', 'var(--mint-deep)'],
  amber:  ['var(--lemon)', 'var(--lemon-deep)'],
  red:    ['var(--signal)', 'var(--signal-deep)'],
  purple: ['var(--violet)', 'var(--violet-deep)'],
  orange: ['var(--tangerine)', 'var(--tangerine-deep)'],
  teal:   ['var(--sage)', 'rgba(11,11,10,.42)'],
  pink:   ['var(--bubblegum)', 'var(--bubblegum-deep)'],
  indigo: ['var(--grape)', 'var(--grape-deep)'],
}

// Colors handed out in turn to newly created lists/categories
export const NEW_GROUP_PALETTE: Color[] = ['blue', 'amber', 'orange', 'indigo', 'red']

export function themeOf(color: string | null | undefined): [string, string] {
  return THEME[(color ?? 'zinc') as Color] ?? THEME.zinc
}

/** An item's color: its first list, else its first category, else neutral. */
export function themeFor(item: { lists?: { color: string }[]; categories?: { color: string }[] }): [string, string] {
  return themeOf(item.lists?.[0]?.color ?? item.categories?.[0]?.color)
}

export const SITE_COLORS: Record<string, string> = {
  Blocket: 'var(--site-blocket)',
  Tradera: 'var(--site-tradera)',
  Vinted: 'var(--site-vinted)',
  Sellpy: 'var(--site-sellpy)',
  'Facebook Marketplace': 'var(--site-facebook)',
}

export const CONDITION_COLORS: Record<string, string> = {
  'New with tags': 'var(--mint)',
  'New without tags': 'var(--mint)',
  'Very good': 'var(--periwinkle)',
  Good: 'var(--paper-2)',
  Satisfactory: 'var(--lemon)',
}
