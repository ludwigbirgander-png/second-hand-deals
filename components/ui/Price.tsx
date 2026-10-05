import type { CSSProperties } from 'react'

// font size / weight: sm 15/600, md 18/700, lg 28/700, xl 44/700, mega 72/700
const SIZES = {
  sm: 'text-[15px] font-semibold tracking-[-0.02em]',
  md: 'text-[18px] font-bold tracking-[-0.02em]',
  lg: 'text-[28px] font-bold tracking-[-0.02em]',
  xl: 'text-[44px] font-bold tracking-[-0.04em]',
  mega: 'text-[72px] font-bold tracking-[-0.04em]',
}

/** Swedish thousands grouping with a non-breaking space: 12 450 */
export function formatSEK(n: number) {
  return Math.round(n).toLocaleString('sv-SE').replace(/\s/g, ' ')
}

interface Props {
  value: number | null | undefined
  currency?: string
  size?: keyof typeof SIZES
  className?: string
  style?: CSSProperties
}

/** Tabular price with a smaller, dimmed currency. null renders a dimmed dash. */
export function Price({ value, currency = 'kr', size = 'md', className, style }: Props) {
  const cls = `k-num leading-none whitespace-nowrap text-ink ${SIZES[size]} ${className ?? ''}`
  if (value == null) return <span className={cls} style={{ opacity: 0.42, ...style }}>–</span>
  return (
    <span className={cls} style={style}>
      {formatSEK(value)}
      {currency && <span className="text-[0.55em] font-medium ml-[0.25em] opacity-60 tracking-normal">{currency}</span>}
    </span>
  )
}
