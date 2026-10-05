'use client'

import { useState } from 'react'
import type { Listing } from '@/lib/types'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { ListingCard } from './ui/Cards'
import { Chip } from './ui/Chip'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

type SortKey = 'price-asc' | 'price-desc' | 'date-desc' | 'date-asc' | 'platform'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'platform', label: 'Platform' },
]

function sortListings(listings: Listing[], key: SortKey): Listing[] {
  const arr = [...listings]
  const byPrice = (dir: 1 | -1) => (a: Listing, b: Listing) => {
    if (a.price == null) return 1
    if (b.price == null) return -1
    return (a.price - b.price) * dir
  }
  switch (key) {
    case 'price-asc': return arr.sort(byPrice(1))
    case 'price-desc': return arr.sort(byPrice(-1))
    case 'date-desc': return arr.sort((a, b) => new Date(b.found_at).getTime() - new Date(a.found_at).getTime())
    case 'date-asc': return arr.sort((a, b) => new Date(a.found_at).getTime() - new Date(b.found_at).getTime())
    case 'platform': return arr.sort((a, b) => a.site.localeCompare(b.site))
  }
}

/** `newSince`: the item's last visit; listings found after it get a "New" badge. */
export function ListingGrid({ listings, newSince }: { listings: Listing[]; newSince?: string | null }) {
  const desktop = useMediaQuery(DESKTOP)
  // Whole rows: 5 columns on desktop, 2 on mobile
  const pageSize = desktop ? 15 : 6
  const [sortKey, setSortKey] = useState<SortKey>('price-asc')
  const [pages, setPages] = useState(1)
  const [starredIds, setStarredIds] = useState<Set<string>>(() => new Set(listings.filter((l) => l.starred).map((l) => l.id)))

  async function toggleStar(id: string) {
    const nowStarred = !starredIds.has(id)
    const flip = (on: boolean) => setStarredIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
    flip(nowStarred)
    const res = await fetch(`/api/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: nowStarred }),
    }).catch(() => null)
    if (!res?.ok) flip(!nowStarred)
  }

  const since = newSince ? new Date(newSince).getTime() : null
  const isNew = (l: Listing) => since != null && new Date(l.found_at).getTime() > since
  const newCount = listings.filter(isNew).length

  const heading = (
    <div className="flex items-center gap-2.5 mx-1 md:mx-0">
      <h2 className="m-0 text-[20px] md:text-[26px] font-bold tracking-[-0.02em] leading-[1.1]">
        {listings.length} listing{listings.length !== 1 ? 's' : ''} found
      </h2>
      {newCount > 0 && <Badge>{newCount} new</Badge>}
    </div>
  )

  if (listings.length === 0) {
    return (
      <>
        {heading}
        <div className="text-center py-10 md:py-20 px-4">
          <p className="m-0 text-[15px] md:text-[18px]">Nothing yet — the flea market restocks daily.</p>
          <p className="mt-1.5 md:mt-2 mb-0 text-[14px] md:text-[15px] text-muted">
            Try hitting Refresh, widening the price range, or dropping the brand from the search.
          </p>
        </div>
      </>
    )
  }

  const sorted = sortListings(listings, sortKey)
  const ordered = [...sorted.filter((l) => starredIds.has(l.id)), ...sorted.filter((l) => !starredIds.has(l.id))]
  const visible = pages * pageSize
  const shown = ordered.slice(0, visible)

  return (
    <>
      <div className="flex flex-col items-start gap-3.5 mb-3.5 md:mb-5">
        {heading}
        <div role="group" aria-label="Sort listings" className="flex gap-2 w-[calc(100%_+_32px)] -mx-4 px-4 md:w-auto md:mx-0 md:px-0 md:flex-wrap overflow-x-auto k-noscroll">
          {SORT_OPTIONS.map((o) => (
            <Chip key={o.value} size="sm" label={o.label} active={sortKey === o.value} onClick={() => { setSortKey(o.value); setPages(1) }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 md:grid-cols-5 md:gap-x-3.5 md:gap-y-4">
        {shown.map((l) => <ListingCard key={l.id} listing={l} isNew={isNew(l)} starred={starredIds.has(l.id)} onStar={() => toggleStar(l.id)} />)}
      </div>
      {visible < ordered.length && (
        <Button variant="secondary" block className="mt-3 md:mt-4" onClick={() => setPages((p) => p + 1)}>
          Load more ({ordered.length - visible} remaining)
        </Button>
      )}
    </>
  )
}
