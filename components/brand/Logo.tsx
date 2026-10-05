import type { CSSProperties } from 'react'
import { Eye, type EyeAnimation, type EyeKind } from './Eye'

interface Props {
  variant?: 'wordmark' | 'icon'
  /** Font size of the wordmark, or the side of the icon square, in px */
  size?: number
  animation?: EyeAnimation
  kind?: EyeKind
  className?: string
  style?: CSSProperties
}

/**
 * Kompi wordmark: Figtree 500 "K" + eye + "mpi", tracking −0.04em. The eye ring is 15
 * (a touch thinner than the letter stem). Never write it as a plain "o".
 */
export function Logo({ variant = 'wordmark', size = 40, animation = 'blink', kind = 'glance', className, style }: Props) {
  if (variant === 'icon') {
    return (
      <span
        aria-label="Kompi"
        className={`inline-flex items-center justify-center shrink-0 bg-ink ${className ?? ''}`}
        style={{ width: size, height: size, borderRadius: size * 0.26, ...style }}
      >
        <Eye kind={kind} animation={animation} stroke={15} color="var(--chalk)" size={size * 0.56} />
      </span>
    )
  }
  return (
    <span
      role="img"
      aria-label="Kompi"
      className={`inline-flex items-baseline font-medium text-ink whitespace-nowrap leading-none tracking-[-0.04em] ${className ?? ''}`}
      style={{ fontSize: size, ...style }}
    >
      <span aria-hidden="true" style={{ marginRight: '0.02em' }}>K</span>
      <Eye kind={kind} animation={animation} stroke={15} size={size * 0.56} style={{ width: '0.56em', height: '0.56em', margin: '0 -0.005em' }} />
      <span aria-hidden="true" style={{ marginLeft: '0.015em' }}>mpi</span>
    </span>
  )
}
