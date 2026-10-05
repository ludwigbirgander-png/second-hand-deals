'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './brand/Logo'
import type { EyeAnimation } from './brand/Eye'
import { SettingsSheet } from './SettingsSheet'
import { IconButton } from './ui/Button'

/** Fire to make the logo eye wink once (e.g. after an item is added). */
export const WINK_EVENT = 'kompi:wink'

/**
 * Sticky header: logo on the left, settings on the right. Adding moved to the floating button.
 * Desktop: every screen except Scan. Mobile: the Watchlist only (the item page has its own top bar).
 */
export function AppHeader({ email }: { email: string }) {
  const pathname = usePathname()
  const [settings, setSettings] = useState(false)
  const [eye, setEye] = useState<EyeAnimation>('blink')

  // One-off wink (2–3s), then back to Looking
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const wink = () => {
      setEye('wink')
      clearTimeout(t)
      t = setTimeout(() => setEye('blink'), 2600)
    }
    window.addEventListener(WINK_EVENT, wink)
    return () => { window.removeEventListener(WINK_EVENT, wink); clearTimeout(t) }
  }, [])

  if (/^\/items\/[^/]+\/scan/.test(pathname) || pathname.startsWith('/lists/join') || pathname.startsWith('/reset-password')) return null
  const mobileVisible = pathname === '/watchlist'

  return (
    <div className={`sticky top-0 z-20 bg-paper ${mobileVisible ? '' : 'max-md:hidden'}`}>
      <header className="max-w-[1280px] mx-auto flex items-center justify-between px-[14px] py-[10px] md:px-6 md:py-3">
        <Link href="/watchlist" aria-label="Kompi — watchlist" className="k-press rounded-xs no-underline">
          <Logo size={19} animation={eye} className="md:hidden" />
          <Logo size={22} animation={eye} className="max-md:hidden" />
        </Link>
        <IconButton icon="gear" label="Settings" variant="ghost" onClick={() => setSettings(true)} />
      </header>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} email={email} />
    </div>
  )
}
