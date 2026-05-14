export const COLORS = ['zinc', 'blue', 'green', 'amber', 'red', 'purple', 'orange', 'teal', 'pink', 'indigo'] as const
export type Color = (typeof COLORS)[number]

export const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  zinc:   { bg: 'bg-zinc-100 dark:bg-zinc-700',   text: 'text-zinc-700 dark:text-zinc-200',   ring: 'ring-zinc-300 dark:ring-zinc-500',   dot: 'bg-zinc-400 dark:bg-zinc-500'   },
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900/50',   text: 'text-blue-700 dark:text-blue-300',   ring: 'ring-blue-300 dark:ring-blue-600',   dot: 'bg-blue-500'   },
  green:  { bg: 'bg-green-100 dark:bg-green-900/50',  text: 'text-green-700 dark:text-green-300',  ring: 'ring-green-300 dark:ring-green-600',  dot: 'bg-green-500'  },
  amber:  { bg: 'bg-amber-100 dark:bg-amber-900/50',  text: 'text-amber-700 dark:text-amber-300',  ring: 'ring-amber-300 dark:ring-amber-600',  dot: 'bg-amber-500'  },
  red:    { bg: 'bg-red-100 dark:bg-red-900/50',    text: 'text-red-700 dark:text-red-300',    ring: 'ring-red-300 dark:ring-red-600',    dot: 'bg-red-500'    },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-300 dark:ring-purple-600', dot: 'bg-purple-500' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300', ring: 'ring-orange-300 dark:ring-orange-600', dot: 'bg-orange-500' },
  teal:   { bg: 'bg-teal-100 dark:bg-teal-900/50',   text: 'text-teal-700 dark:text-teal-300',   ring: 'ring-teal-300 dark:ring-teal-600',   dot: 'bg-teal-500'   },
  pink:   { bg: 'bg-pink-100 dark:bg-pink-900/50',   text: 'text-pink-700 dark:text-pink-300',   ring: 'ring-pink-300 dark:ring-pink-600',   dot: 'bg-pink-500'   },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-300', ring: 'ring-indigo-300 dark:ring-indigo-600', dot: 'bg-indigo-500' },
}

export function colorClasses(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.zinc
}
