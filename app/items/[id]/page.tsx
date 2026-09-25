'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ItemWithMeta, Listing, ListMember } from '@/lib/types'
import { themeFor } from '@/lib/colors'
import { ScreenBackground } from '@/components/ScreenBackground'
import { ListingGrid } from '@/components/ListingGrid'
import { EditItemSheet } from '@/components/EditItemSheet'
import { ScreenTitle } from '@/components/ui/Display'
import { Button, IconButton, buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Pill } from '@/components/ui/Pill'
import { Price } from '@/components/ui/Price'
import { AvatarStack } from '@/components/ui/Avatar'

// Full-bleed panel content lines up with the header's 1280px row
const INSET = 'px-4 md:px-5 min-[900px]:px-[max(32px,calc((100%-1216px)/2))]'

interface Loaded {
  itemData: ItemWithMeta | null
  listings: Listing[]
}

async function loadItem(id: string): Promise<Loaded> {
  const [itemRes, listingsRes] = await Promise.all([fetch(`/api/items/${id}`), fetch(`/api/items/${id}/listings`)])
  const itemData: ItemWithMeta | null = itemRes.ok ? await itemRes.json() : null
  const { listings } = await listingsRes.json().catch(() => ({ listings: [] }))
  return { itemData, listings: listings ?? [] }
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [item, setItem] = useState<ItemWithMeta | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [newCount, setNewCount] = useState(0)
  const [members, setMembers] = useState<{ name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  const apply = useCallback((d: Loaded) => {
    setItem(d.itemData)
    setListings(d.listings)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadItem(id).then((d) => {
      if (cancelled) return
      apply(d)
      const { itemData, listings } = d
      if (!itemData) return
      // New since the last visit — counted before marking the item as viewed
      const since = itemData.last_viewed_at ? new Date(itemData.last_viewed_at).getTime() : 0
      setNewCount(listings.filter((l) => new Date(l.found_at).getTime() > since).length)
      fetch(`/api/items/${id}/viewed`, { method: 'POST' })

      const shared = itemData.lists.find((l) => l.visibility === 'collaborative')
      if (shared) {
        fetch(`/api/lists/${shared.id}/members`)
          .then((r) => r.json())
          .then((data: ListMember[]) => { if (!cancelled && Array.isArray(data)) setMembers(data.map((m) => ({ name: m.display_name || m.email }))) })
          .catch(() => {})
      }
    })
    return () => { cancelled = true }
  }, [apply, id])

  if (loading) {
    return (
      <div className={`${INSET} pt-6`} aria-busy="true">
        <ScreenBackground color="var(--stone)" />
        <div className="h-16 w-2/3 max-w-md rounded-sm bg-shade animate-pulse" />
        <div className="mt-4 h-10 w-40 rounded-pill bg-shade animate-pulse" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-16 px-4">
        <ScreenBackground color="var(--paper)" />
        <p className="m-0 text-[18px]">Item not found</p>
        <Link href="/watchlist" className={`${buttonClass({ variant: 'ghost', size: 'sm' })} mt-2 no-underline`}>← Watchlist</Link>
      </div>
    )
  }

  const [bg, deep] = themeFor(item)
  const list = item.lists[0]
  const inRange = listings.filter((l) =>
    l.price != null && (item.min_price == null || l.price >= item.min_price) && (item.max_price == null || l.price <= item.max_price))
  const lowest = inRange.length ? Math.min(...inRange.map((l) => l.price!)) : null
  const range = item.min_price != null || item.max_price != null
    ? `${item.min_price != null ? `${item.min_price.toLocaleString('sv-SE')} kr` : 'Any'} — ${item.max_price != null ? `${item.max_price.toLocaleString('sv-SE')} kr` : 'no max'}`
    : null
  const refresh = () => router.push(`/items/${id}/scan`)

  return (
    <div className="flex-1 grid grid-rows-[auto_1fr] w-full md:pt-4">
      <ScreenBackground color={bg} />

      <section className={INSET}>
        {/* Mobile top bar (the app header is desktop-only on this screen) */}
        <div className="md:hidden flex items-center gap-2 h-14">
          <IconButton icon="arrow-left" label="Back to watchlist" onClick={() => router.push('/watchlist')} />
          {members.length > 0 && <AvatarStack people={members} ring={bg} />}
          <div className="flex-1" />
          <IconButton icon="pencil" label="Edit" onClick={() => setShowEdit(true)} />
          <IconButton icon="refresh" label="Refresh" onClick={refresh} />
        </div>

        <Link href="/watchlist" className={`max-md:hidden ${buttonClass({ variant: 'ghost', size: 'sm' })} !pl-0 !text-on-color-muted no-underline`}>
          ← Watchlist
        </Link>

        <div className="flex flex-wrap justify-between items-end gap-y-5 gap-x-8 mt-[18px] md:mt-6 mx-1 md:mx-0 pb-[30px] md:pb-8">
          <div className="min-w-0 max-w-full">
            <ScreenTitle title={item.name} subtitle={item.brand} subtitleColor={deep} size={[56, 72]} />
            <div className="max-md:hidden flex flex-wrap items-center gap-2 mt-6">
              <Button onClick={refresh} icon={<Icon name="refresh" size={16} />}>Refresh</Button>
              <Button variant="secondary" onClick={() => setShowEdit(true)} icon={<Icon name="pencil" size={15} />}>Edit</Button>
              {members.length > 0 && (
                <span className="flex items-center gap-2.5 ml-3">
                  <AvatarStack people={members} ring={bg} />
                  <span className="text-[14px] text-on-color-muted">Shared list</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex max-md:w-full max-md:items-end max-md:justify-between md:flex-col md:items-end md:text-right">
            <div>
              <div className="text-[13px] md:text-[14px] text-on-color-muted mb-1.5 md:mb-2">Lowest price{list ? ` · ${list.name}` : ''}</div>
              <Price value={lowest} size="mega" />
              {range && <div className="md:hidden mt-1.5 text-[13px] text-on-color-muted tabular-nums">{range}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2.5 md:mt-3">
              {newCount > 0 && <Pill variant="ink">{newCount} new</Pill>}
              {range && <span className="max-md:hidden text-[14px] text-on-color-muted tabular-nums">{range}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className={`bg-paper rounded-t-xl ${INSET} max-md:!px-3 pt-[22px] pb-10 md:pt-8 md:pb-20 min-h-[400px]`}>
        <ListingGrid key={listings.map((l) => l.id).join()} listings={listings} />
      </section>

      <EditItemSheet
        open={showEdit}
        item={item}
        onClose={() => setShowEdit(false)}
        onSaved={async () => { apply(await loadItem(id)); setShowEdit(false) }}
        onDeleted={() => { setShowEdit(false); router.push('/watchlist') }}
      />
    </div>
  )
}
