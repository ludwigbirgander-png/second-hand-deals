'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

export type EyeKind = 'glance' | 'back' | 'happy' | 'wink' | 'closed'
export type EyeAnimation = 'none' | 'blink' | 'look' | 'double' | 'roll' | 'happy' | 'wink' | 'surprise' | 'drowse' | 'nod' | 'zzz' | 'follow'

interface Props {
  kind?: EyeKind
  animation?: EyeAnimation
  color?: string
  fill?: string
  /** Ring stroke on the 100-unit viewBox */
  stroke?: number
  size?: number | string
  pupilR?: number
  className?: string
  style?: CSSProperties
}

/**
 * The Kompi eye: a ring with a pupil. The "o" in the wordmark and the app's only character.
 * Animations come from the kompi-a-* keyframes in globals.css; under reduced motion they stop
 * and the static `kind` shows.
 */
export function Eye({ kind = 'glance', animation = 'none', color = 'var(--ink)', fill = 'none', stroke = 17, size = 48, pupilR = 14, className, style }: Props) {
  const ref = useRef<SVGSVGElement>(null)

  // Curious: the pupil follows the pointer (desktop only — there is no pointer on touch)
  useEffect(() => {
    if (animation !== 'follow') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const move = (e: MouseEvent) => {
      const s = ref.current
      const p = s?.querySelector<SVGCircleElement>('.p')
      if (!s || !p) return
      const r = s.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1
      const m = Math.min(15, d / 12)
      p.style.transform = `translate(${(dx / d) * m}px,${(dy / d) * m}px)`
    }
    document.addEventListener('mousemove', move)
    return () => document.removeEventListener('mousemove', move)
  }, [animation])

  const rr = 50 - stroke / 2
  const pk = pupilR / 14
  const base = kind === 'glance' ? [60, 47] : kind === 'back' ? [40, 54] : [54, 48]
  const [px, py] = base.map((v) => 50 + (v - 50) * pk)
  const pupil = (cx: number, cy: number) => <circle className="p" cx={cx} cy={cy} r={pupilR} fill={color} />
  const smile = <path className="arc" d="M34 57 Q50 37 66 57" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
  const lid = <path className="l" d="M35 50 H65" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
  const shut = <path d="M35 52 Q50 62 65 52" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />

  let inner
  if (animation === 'happy') inner = <>{pupil(50, 50)}{smile}</>
  else if (animation === 'wink') inner = <>{pupil(50, 50)}{lid}</>
  else if (animation === 'zzz') {
    inner = (
      <>
        {shut}
        {[1, 2, 3].map((n) => <text key={n} className={`z z${n}`} x="84" y="14" fontSize={18 + n * 4} fill={color}>z</text>)}
      </>
    )
  } else if (animation === 'look' || animation === 'roll' || animation === 'surprise' || animation === 'follow') {
    inner = pupil(animation === 'look' ? 50 : 54, animation === 'roll' ? 50 : 48)
  } else if (kind === 'happy') inner = smile
  else if (kind === 'wink') inner = lid
  else if (kind === 'closed') inner = shut
  else inner = pupil(px, py)

  return (
    <svg
      ref={ref}
      className={`kompi-eye ${animation !== 'none' ? `kompi-a-${animation}` : ''} ${className ?? ''}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ display: 'block', overflow: 'visible', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r={rr} fill={fill} stroke={color} strokeWidth={stroke} />
      {inner}
    </svg>
  )
}
