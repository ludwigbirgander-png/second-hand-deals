'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SearchPanel } from './SearchPanel'
import { SettingsSheet } from './SettingsSheet'
import { IconButton } from './ui/Button'

/**
 * Sticky header: wordmark, search/add panel, settings.
 * Desktop: every screen except Scan. Mobile: the Watchlist only (the item page has its own top bar).
 */
export function AppHeader({ email }: { email: string }) {
  const pathname = usePathname()
  const [settings, setSettings] = useState(false)

  if (/^\/items\/[^/]+\/scan/.test(pathname) || pathname.startsWith('/lists/join')) return null
  const mobileVisible = pathname === '/watchlist'

  return (
    <div className={`sticky top-0 z-20 bg-screen transition-[background] duration-[var(--dur-slow)] ease-out ${mobileVisible ? '' : 'max-md:hidden'}`}>
      <header className="max-w-[1280px] mx-auto px-4 md:px-5 min-[900px]:px-8 md:py-5">
        <div className="relative flex items-center gap-2.5 md:gap-3 h-14 md:h-11">
          <Link
            href="/watchlist"
            className="shrink-0 pl-1 md:pl-0 text-[22px] md:text-[26px] font-semibold tracking-[-0.04em] md:tracking-[-0.045em] text-ink no-underline"
          >
            Kompi
          </Link>
          <div className="flex-1 min-w-0 md:mx-4">
            <SearchPanel />
          </div>
          <IconButton icon="gear" label="Settings" onClick={() => setSettings(true)} />
        </div>
      </header>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} email={email} />
    </div>
  )
}
