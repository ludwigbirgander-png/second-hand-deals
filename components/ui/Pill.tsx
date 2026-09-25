import type { CSSProperties, HTMLAttributes } from 'react'
import { SITE_COLORS } from '@/lib/colors'

type Variant = 'veil' | 'solid' | 'ink' | 'dashed'

const VARIANTS: Record<Variant, string> = {
  veil: 'bg-veil-strong text-ink',
  solid: 'text-ink',
  ink: 'bg-ink text-chalk',
  dashed: 'bg-transparent text-on-color-muted border border-dashed border-line-dashed',
}

const SIZES = { sm: 'h-[22px] px-2 text-[11px]', md: 'h-7 px-[11px] text-[12.5px]', lg: 'h-[34px] px-[11px] text-[14px]' }

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: keyof typeof SIZES
  /** Background for the `solid` variant */
  color?: string
  /** Colored dot before the label */
  dot?: string
}

export function Pill({ variant = 'veil', size = 'md', color, dot, className, style, children, ...rest }: Props) {
  const bg: CSSProperties = variant === 'solid' ? { background: color ?? 'var(--paper-2)' } : {}
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill font-medium tracking-[-0.005em] whitespace-nowrap tabular-nums box-border ${SIZES[size]} ${VARIANTS[variant]} ${className ?? ''}`}
      style={{ ...bg, ...style }}
      {...rest}
    >
      {dot && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: dot }} />}
      {children}
    </span>
  )
}

export function SiteBadge({ site, className }: { site: string; className?: string }) {
  return (
    <Pill variant="veil" size="sm" dot={SITE_COLORS[site] ?? 'var(--stone)'} className={className}>
      {site}
    </Pill>
  )
}
