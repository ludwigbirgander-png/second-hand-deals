import type { CSSProperties, ReactNode } from 'react'

/**
 * Fluid size between the mobile (at a 390px viewport) and desktop px sizes,
 * so oversized titles shrink on narrow screens instead of overflowing.
 */
export function fluid(mobile: number, desktop: number) {
  return `clamp(${Math.min(mobile, desktop)}px, ${((mobile / 390) * 100).toFixed(2)}vw, ${desktop}px)`
}

interface ScreenTitleProps {
  title: ReactNode
  subtitle?: ReactNode
  subtitleColor?: string
  weight?: 'regular' | 'bold'
  /** [mobile, desktop] font size in px */
  size?: [number, number]
  className?: string
  as?: 'h1' | 'h2'
}

/** Oversized screen title with a second line in the screen's deep tint. */
export function ScreenTitle({ title, subtitle, subtitleColor = 'var(--on-color-faint)', weight = 'regular', size, className, as: Tag = 'h1' }: ScreenTitleProps) {
  const bold = weight === 'bold'
  const [m, d] = size ?? (bold ? [34, 34] : [60, 60])
  const head: CSSProperties = {
    fontSize: fluid(m, d),
    fontWeight: bold ? 700 : 400,
    lineHeight: bold ? 1.02 : 0.94,
    letterSpacing: bold ? '-0.032em' : '-0.045em',
    textWrap: 'balance',
    overflowWrap: 'anywhere',
  }
  return (
    <div className={className}>
      <Tag className="m-0 text-ink" style={head}>
        {title}
        {subtitle && (
          <span className="block" style={{ color: subtitleColor, marginTop: bold ? 0 : 2 }}>
            {subtitle}
          </span>
        )}
      </Tag>
    </div>
  )
}

interface TickProgressProps {
  value: number
  ticks?: number
  height?: number
  startLabel?: string
  endLabel?: string
}

/** Tick-ruler progress: filled ink ticks for done, thin ticks for remaining, a needle at the edge. */
export function TickProgress({ value, ticks = 36, height = 40, startLabel, endLabel }: TickProgressProps) {
  const clamped = Math.min(1, Math.max(0, value))
  const done = Math.round(clamped * ticks)
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)} aria-label={endLabel}>
      {(startLabel || endLabel) && (
        <div className="flex justify-between text-[12px] text-on-color-muted mb-2 tabular-nums">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
      <div className="relative flex items-stretch gap-px" style={{ height }}>
        {Array.from({ length: ticks }).map((_, i) => {
          const isDone = i < done
          return (
            <div key={i} className="flex-1 flex justify-center items-center">
              <div
                className="rounded-[1px] transition-[width,height] duration-[var(--dur-base)] ease-out"
                style={{ width: isDone ? '100%' : 2, height: isDone ? '100%' : '62%', background: isDone ? 'var(--ink)' : 'var(--on-color-muted)' }}
              />
            </div>
          )
        })}
        {clamped > 0 && clamped < 1 && (
          <div
            className="absolute top-0 w-0.5 bg-ink transition-[left] duration-[var(--dur-base)] ease-out"
            style={{ left: `calc(${(done / ticks) * 100}% - 1px)`, height: height + 18 }}
          />
        )}
      </div>
    </div>
  )
}
