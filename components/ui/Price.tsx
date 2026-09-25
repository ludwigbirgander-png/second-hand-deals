import type { CSSProperties } from 'react'

const SIZES = {
  mega: 'text-mega',
  display: 'text-display',
  headline: 'text-[40px] leading-none tracking-[-0.035em]',
  title: 'text-title',
  lead: 'text-lead tabular-nums',
  body: 'text-[15px] leading-[1.3] tracking-[-0.005em] tabular-nums',
}

/** Swedish thousands grouping with a thin space: 12 450 */
export function formatSEK(n: number) {
  return Math.round(Math.abs(n)).toLocaleString('sv-SE').replace(/ | /g, ' ')
}

interface Props {
  value: number | null | undefined
  currency?: string
  size?: keyof typeof SIZES
  className?: string
  style?: CSSProperties
}

/** Hero numeral: price with a dimmed, smaller currency. null renders a dimmed dash. */
export function Price({ value, currency = 'kr', size = 'title', className, style }: Props) {
  const cls = `font-normal text-ink whitespace-nowrap ${SIZES[size]} ${className ?? ''}`
  if (value == null) return <span className={cls} style={{ opacity: 0.42, ...style }}>–</span>
  return (
    <span className={cls} style={style}>
      {formatSEK(value)}
      {currency && <span className="opacity-[.42] text-[0.62em] tracking-[-0.01em] ml-[0.18em]">{currency}</span>}
    </span>
  )
}
