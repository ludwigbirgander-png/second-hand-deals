'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Item } from '@/lib/types'
import { ScreenBackground } from '@/components/ScreenBackground'
import { ScrapeProgress, useScrapeStream } from '@/components/ScrapeProgress'
import { ScreenTitle, TickProgress, fluid } from '@/components/ui/Display'
import { Button, buttonClass } from '@/components/ui/Button'
import { Price } from '@/components/ui/Price'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const desktop = useMediaQuery(DESKTOP)
  const [item, setItem] = useState<Item | null>(null)
  const [attempt, setAttempt] = useState(0)
  const state = useScrapeStream(id, attempt)

  useEffect(() => {
    fetch(`/api/items/${id}`).then((r) => (r.ok ? r.json() : null)).then(setItem).catch(() => {})
  }, [id])

  // Hand over to the item page shortly after the last site reports in
  useEffect(() => {
    if (!state.finished) return
    const t = setTimeout(() => router.replace(`/items/${id}`), 1000)
    return () => clearTimeout(t)
  }, [state.finished, id, router])

  const done = state.sites.filter((s) => s.status === 'done')
  const found = done.reduce((a, s) => a + (s.count ?? 0), 0)
  const progress = state.sites.length ? done.length / state.sites.length : 0
  const name = item ? (item.brand ? `${item.brand} ${item.name}` : item.name) : ' '

  return (
    <div className="flex-1 flex flex-col w-full max-w-[1280px] mx-auto md:px-5 min-[900px]:px-8 md:pt-6 md:pb-20">
      <ScreenBackground color="var(--signal)" />

      <div className="px-5 md:px-0 pt-3 md:pt-0">
        <Link href="/watchlist" className={`${buttonClass({ variant: 'ghost', size: 'sm' })} !pl-0 !text-on-color-muted no-underline`}>← Watchlist</Link>
      </div>

      <div className="flex-1 flex flex-col md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-10 md:items-end">
        <div className="px-5 md:px-0">
          <ScreenTitle title="Searching" subtitle={name} subtitleColor="var(--signal-deep)" size={[52, 96]} className="mt-8 mb-7 md:mt-6 md:mb-12" />
          <TickProgress
            value={progress}
            ticks={desktop ? 56 : 36}
            height={desktop ? 56 : 40}
            startLabel={`${done.length} of ${state.sites.length || '–'} sites`}
            endLabel={state.error ? 'Search stopped' : state.finished ? 'Done' : 'Searching for listings…'}
          />
          <div className="flex items-baseline gap-2.5 md:gap-3.5 mt-[30px] mb-[22px] md:mt-11 md:mb-0">
            <Price value={found} currency="" size="mega" style={{ fontSize: fluid(88, 144) }} />
            <span className="text-[15px] md:text-[18px] text-on-color-muted">listings found</span>
          </div>
        </div>

        <div className="flex-1 md:flex-none bg-chalk rounded-t-xl md:rounded-xl px-5 pt-3.5 pb-10 md:px-7 md:pt-4 md:pb-7">
          {state.error ? (
            <div role="alert" className="py-6">
              <p className="m-0 text-[18px] tracking-[-0.015em]">{state.error}</p>
              <p className="mt-1.5 mb-5 text-[14px] text-muted">A marketplace may be slow or down. Anything already found has been saved.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
                <Link href={`/items/${id}`} className={`${buttonClass({ variant: 'secondary' })} no-underline`}>See listings</Link>
              </div>
            </div>
          ) : state.sites.length === 0 ? (
            <p className="m-0 py-4 text-[15px] text-muted">Getting ready…</p>
          ) : (
            <ScrapeProgress state={state} />
          )}
        </div>
      </div>
    </div>
  )
}
