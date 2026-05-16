'use client'

import { useState, useEffect } from 'react'
import type { Listing } from '@/lib/types'

type SortKey = 'price-asc' | 'price-desc' | 'date-desc' | 'date-asc' | 'platform'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'price-asc', label: 'Price ↑' },
  { key: 'price-desc', label: 'Price ↓' },
  { key: 'date-desc', label: 'Newest first' },
  { key: 'date-asc', label: 'Oldest first' },
  { key: 'platform', label: 'Platform' },
]

const SITE_COLORS: Record<string, string> = {
  Blocket: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  Tradera: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  Sellpy: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  Vinted: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400',
  'Facebook Marketplace': 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
}

const CONDITION_COLORS: Record<string, string> = {
  'New with tags': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'New without tags': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'Very good': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'Good': 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  'Satisfactory': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
}

function sortListings(listings: Listing[], key: SortKey): Listing[] {
  const arr = [...listings]
  switch (key) {
    case 'price-asc':
      return arr.sort((a, b) => {
        if (a.price == null) return 1
        if (b.price == null) return -1
        return a.price - b.price
      })
    case 'price-desc':
      return arr.sort((a, b) => {
        if (a.price == null) return 1
        if (b.price == null) return -1
        return b.price - a.price
      })
    case 'date-desc':
      return arr.sort((a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime())
    case 'date-asc':
      return arr.sort((a, b) => new Date(a.found_at).getTime() - new Date(b.found_at).getTime())
    case 'platform':
      return arr.sort((a, b) => a.site.localeCompare(b.site))
  }
}

function AuctionCountdown({ endsAt }: { endsAt: string }) {
  const [display, setDisplay] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    function update() {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setDisplay('Ended')
        setUrgent(false)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setUrgent(h < 2)
      if (h < 24) {
        setDisplay(h > 0 ? `${h}h ${m}m` : `${m}m`)
      } else {
        setDisplay(new Date(endsAt).toLocaleDateString('sv-SE'))
      }
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <span className={`text-xs tabular-nums ${urgent ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-zinc-400 dark:text-zinc-500'}`}>
      {display}
    </span>
  )
}

const PAGE_SIZE = 24

export function ListingTable({ listings }: { listings: Listing[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('price-asc')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(listings.filter((l) => l.starred).map((l) => l.id))
  )

  if (listings.length === 0) {
    return <p className="text-zinc-400 dark:text-zinc-500 text-sm py-8 text-center">No listings found yet</p>
  }

  async function toggleStar(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    const nowStarred = !starredIds.has(id)
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (nowStarred) next.add(id)
      else next.delete(id)
      return next
    })
    await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: nowStarred }),
    })
  }

  const sorted = sortListings(listings, sortKey)
  const pinned = sorted.filter((l) => starredIds.has(l.id))
  const rest = sorted.filter((l) => !starredIds.has(l.id))
  const ordered = [...pinned, ...rest]
  const shown = ordered.slice(0, visible)
  const hasMore = visible < ordered.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setSortKey(key); setVisible(PAGE_SIZE) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortKey === key
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {shown.map((l) => {
          const isStarred = starredIds.has(l.id)
          return (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative flex flex-col rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md transition-shadow ${
                isStarred
                  ? 'border-amber-400 dark:border-amber-500'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {/* Image */}
              <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800 shrink-0">
                {l.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image_url}
                    alt={l.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}

                {/* Star button */}
                <button
                  onClick={(e) => toggleStar(e, l.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/90 dark:bg-zinc-800/90 flex items-center justify-center shadow-sm transition-colors hover:bg-white dark:hover:bg-zinc-700"
                  aria-label={isStarred ? 'Unstar listing' : 'Star listing'}
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-colors ${isStarred ? 'fill-amber-400 text-amber-400' : 'fill-none text-zinc-400'}`}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </button>

                {/* Site badge */}
                <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${SITE_COLORS[l.site] ?? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                  {l.site}
                </span>
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col gap-1 flex-1">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-snug">
                  {l.title}
                </p>

                {(l.condition || l.size || l.location) && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {l.condition && (
                      <span className={`px-1.5 py-px rounded text-xs font-medium ${CONDITION_COLORS[l.condition] ?? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                        {l.condition}
                      </span>
                    )}
                    {l.size && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{l.size}</span>
                    )}
                    {l.location && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{l.location}</span>
                    )}
                  </div>
                )}

                <div className="flex items-end justify-between mt-auto pt-2">
                  <div>
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {l.price != null ? `${l.price} kr` : '–'}
                    </p>
                    {l.shipping_cost === 0 ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">Free shipping</p>
                    ) : l.shipping_cost != null ? (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">+{l.shipping_cost} kr shipping</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    {l.auction_ends_at && (
                      <AuctionCountdown endsAt={l.auction_ends_at} />
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {new Date(l.found_at).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="w-full py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          Load more ({ordered.length - visible} remaining)
        </button>
      )}
    </div>
  )
}
