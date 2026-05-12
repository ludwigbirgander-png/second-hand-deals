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
  Blocket: 'bg-orange-100 text-orange-700',
  Tradera: 'bg-blue-100 text-blue-700',
  Sellpy: 'bg-purple-100 text-purple-700',
  Vinted: 'bg-teal-100 text-teal-700',
  'Facebook Marketplace': 'bg-zinc-100 text-zinc-500',
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

const PAGE_SIZE = 25

interface LightboxImage {
  url: string
  title: string
}

export function ListingTable({ listings }: { listings: Listing[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('price-asc')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(listings.filter((l) => l.starred).map((l) => l.id))
  )
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null)

  useEffect(() => {
    if (!lightbox) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (listings.length === 0) {
    return <p className="text-zinc-400 text-sm py-8 text-center">No listings found yet</p>
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

  function openLightbox(e: React.MouseEvent, url: string, title: string) {
    e.preventDefault()
    e.stopPropagation()
    setLightbox({ url, title })
  }

  const sorted = sortListings(listings, sortKey)
  const pinned = sorted.filter((l) => starredIds.has(l.id))
  const rest = sorted.filter((l) => !starredIds.has(l.id))
  const ordered = [...pinned, ...rest]
  const shown = ordered.slice(0, visible)
  const hasMore = visible < ordered.length

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setSortKey(key); setVisible(PAGE_SIZE) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortKey === key
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {shown.map((l) => {
              const isStarred = starredIds.has(l.id)
              return (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors ${
                    isStarred ? 'bg-amber-50' : ''
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-lg bg-zinc-100 shrink-0 overflow-hidden ${l.image_url ? 'cursor-zoom-in' : ''}`}
                    onClick={(e) => l.image_url && openLightbox(e, l.image_url, l.title)}
                  >
                    {l.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.image_url}
                        alt={l.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate leading-snug">
                      {l.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-block px-2 py-px rounded-full text-xs font-medium ${
                          SITE_COLORS[l.site] ?? 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {l.site}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {new Date(l.found_at).toLocaleDateString('sv-SE')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-base font-semibold text-zinc-900 tabular-nums">
                      {l.price != null ? `${l.price} kr` : '–'}
                    </p>
                    <button
                      onClick={(e) => toggleStar(e, l.id)}
                      className="p-0.5 rounded transition-colors hover:bg-zinc-100"
                      aria-label={isStarred ? 'Unstar listing' : 'Star listing'}
                    >
                      <svg
                        className={`w-4 h-4 transition-colors ${isStarred ? 'fill-amber-400 text-amber-400' : 'fill-none text-zinc-300 hover:text-zinc-400'}`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    </button>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {hasMore && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="w-full py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
          >
            Load more ({ordered.length - visible} remaining)
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.title}
            className="rounded-xl object-contain shadow-2xl"
            style={{ maxWidth: 'min(720px, 90vw)', maxHeight: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
