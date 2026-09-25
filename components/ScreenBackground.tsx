'use client'

import { useEffect } from 'react'

/** Sets the full-bleed page color; <body> and the header transition to it. */
export function ScreenBackground({ color }: { color: string }) {
  useEffect(() => {
    document.body.style.setProperty('--screen-bg', color)
  }, [color])
  return null
}
