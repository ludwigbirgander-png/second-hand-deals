export const COLORS = ['zinc', 'blue', 'green', 'amber', 'red', 'purple', 'orange', 'teal', 'pink', 'indigo'] as const
export type Color = (typeof COLORS)[number]

export const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  zinc:   { bg: 'bg-zinc-100',   text: 'text-zinc-700',   ring: 'ring-zinc-300',   dot: 'bg-zinc-400'   },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-300',   dot: 'bg-blue-500'   },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  ring: 'ring-green-300',  dot: 'bg-green-500'  },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-700',  ring: 'ring-amber-300',  dot: 'bg-amber-500'  },
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    ring: 'ring-red-300',    dot: 'bg-red-500'    },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-300', dot: 'bg-purple-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-300', dot: 'bg-orange-500' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   ring: 'ring-teal-300',   dot: 'bg-teal-500'   },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700',   ring: 'ring-pink-300',   dot: 'bg-pink-500'   },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-300', dot: 'bg-indigo-500' },
}

export function colorClasses(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.zinc
}
