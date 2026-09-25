import type { CSSProperties } from 'react'

// Stroke icons. star/pencil/x/check/gear paths come from the Kompi codebase; the rest are Lucide paths.
const ICONS = {
  star: { vb: 24, d: ['M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'], fillable: true },
  pencil: { vb: 16, d: ['M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z'] },
  x: { vb: 16, d: ['M4 4l8 8M12 4l-8 8'] },
  check: { vb: 24, d: ['M5 13l4 4L19 7'] },
  gear: { vb: 24, d: ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'] },
  plus: { vb: 24, d: ['M5 12h14', 'M12 5v14'] },
  more: { vb: 24, d: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'] },
  'arrow-left': { vb: 24, d: ['m12 19-7-7 7-7', 'M19 12H5'] },
  search: { vb: 24, d: ['M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z', 'm21 21-4.3-4.3'] },
  refresh: { vb: 24, d: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'] },
} as const

export type IconName = keyof typeof ICONS

interface Props {
  name: IconName
  size?: number
  strokeWidth?: number
  filled?: boolean
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 18, strokeWidth = 1.75, filled = false, className, style }: Props) {
  const ic = ICONS[name]
  const solid = filled && 'fillable' in ic
  // `more` dots need a heavier stroke to read as dots
  const sw = (name === 'more' ? 3 : strokeWidth) * (ic.vb / 24)
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ic.vb} ${ic.vb}`}
      fill={solid ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block shrink-0 ${className ?? ''}`}
      style={style}
      aria-hidden="true"
    >
      {ic.d.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
