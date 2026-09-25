'use client'

import { useSyncExternalStore } from 'react'

/** True when the media query matches. Always false during SSR and hydration. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const DESKTOP = '(min-width: 768px)'
