import type { CSSProperties, HTMLAttributes } from 'react'
import { SITE_COLORS } from '@/lib/colors'

type Variant = 'veil' | 'solid' | 'ink' | 'dashed'

const VARIANTS: Record<Variant, string> = {
  veil: 'bg-veil text-ink',
  solid: 'text-ink',
  ink: 'bg-ink text-chalk',
  dashed: 'bg-transparent text-muted shadow-[inset_0_0_0_1.5px_var(--border-dashed)]',
}

const SIZES = { sm: 'h-5 px-2 text-[11px]', md: 'h-6 px-2.5 text-[12px]', lg: 'h-8 px-3 text-[14px]' }

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: keyof typeof SIZES
  /** Background for the `solid` variant */
  color?: string
}

/** Capsule label for tags such as listing condition or "shared". */
export function Pill({ variant = 'veil', size = 'md', color, className, style, children, ...rest }: Props) {
  const bg: CSSProperties = variant === 'solid' ? { background: color ?? 'var(--paper-2)' } : {}
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill font-semibold leading-none whitespace-nowrap box-border ${SIZES[size]} ${VARIANTS[variant]} ${className ?? ''}`}
      style={{ ...bg, ...style }}
      {...rest}
    >
      {children}
    </span>
  )
}

/** Marketplace provenance: a site-coloured dot, the site name and optional meta ("· 2d"). */
export function SiteBadge({ site, meta, className }: { site: string; meta?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 text-[12px] font-medium leading-[1.2] text-muted whitespace-nowrap ${className ?? ''}`}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SITE_COLORS[site] ?? 'var(--stone-deep)' }} />
      <span className="truncate">
        {site === 'Facebook Marketplace' ? 'Facebook' : site}
        {meta ? ` · ${meta}` : ''}
      </span>
    </span>
  )
}
