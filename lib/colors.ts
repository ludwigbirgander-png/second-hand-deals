export const COLORS = ['zinc', 'blue', 'green', 'amber', 'red', 'purple', 'orange', 'teal', 'pink', 'indigo'] as const
export type Color = (typeof COLORS)[number]

// [fill, text on that fill] per stored list color name (palette H "Crayon box").
// The stored names never change; only their values do.
export const THEME: Record<Color, [string, string]> = Object.fromEntries(
  COLORS.map((c) => [c, [`var(--list-${c})`, `var(--on-list-${c})`]]),
) as Record<Color, [string, string]>

// Colors handed out in turn to newly created lists
export const NEW_GROUP_PALETTE: Color[] = ['blue', 'amber', 'orange', 'indigo', 'red']

export function themeOf(color: string | null | undefined): [string, string] {
  return THEME[(color ?? 'zinc') as Color] ?? THEME.zinc
}

/** An item's color: its first list, else neutral. */
export function themeFor(item: { lists?: { color: string }[] }): [string, string] {
  return themeOf(item.lists?.[0]?.color)
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
