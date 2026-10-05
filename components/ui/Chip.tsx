'use client'

import { useRef, type ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  label: string
  /** [fill, text on fill] of a list — omit for "All" (ink when active) */
  color?: [string, string]
  active?: boolean
  /** add: "+ Add list" / "+ New list". followed: a list you follow (outline). */
  variant?: 'default' | 'add' | 'followed'
  size?: 'sm' | 'md'
  /** Long-press (≈500ms) — e.g. open the list's settings */
  onLongPress?: () => void
}

const SIZE = { sm: 'h-[30px] px-3 text-[13px]', md: 'h-9 px-3.5 text-[14px]' }

/** List chip: filters the watchlist and picks lists in the add panel. */
export function Chip({ label, color, active = false, variant = 'default', size = 'md', onLongPress, onClick, className, ...rest }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressed = useRef(false)

  const press = onLongPress
    ? {
        onPointerDown: () => {
          longPressed.current = false
          timer.current = setTimeout(() => { longPressed.current = true; onLongPress() }, 500)
        },
        onPointerUp: () => clearTimeout(timer.current),
        onPointerLeave: () => clearTimeout(timer.current),
        onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clearTimeout(timer.current); onLongPress() },
      }
    : {}

  const base = `k-press inline-flex items-center gap-[7px] shrink-0 rounded-pill font-medium leading-none whitespace-nowrap cursor-pointer ${SIZE[size]}`

  if (variant === 'add') {
    return (
      <button type="button" className={`${base} bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--border-dashed)] ${className ?? ''}`} onClick={onClick} {...rest}>
        <Icon name="plus" size={14} strokeWidth={2} />
        {label}
      </button>
    )
  }

  const look = active
    ? color ? '' : 'bg-ink text-chalk'
    : variant === 'followed'
      ? 'bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--border-soft)]'
      : 'bg-chalk text-ink shadow-[inset_0_0_0_1px_var(--border-hair)]'

  return (
    <button
      type="button"
      aria-pressed={active}
      className={`${base} ${look} ${className ?? ''}`}
      style={active && color ? { background: color[0], color: color[1] } : undefined}
      // A long-press must not also toggle the filter
      onClick={(e) => { if (longPressed.current) { longPressed.current = false; return } onClick?.(e) }}
      {...press}
      {...rest}
    >
      {color && !active && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color[0] }} />}
      {color && active && <Icon name="check" size={14} strokeWidth={2.4} />}
      {label}
    </button>
  )
}
