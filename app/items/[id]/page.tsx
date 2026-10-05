'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ItemList, ItemWithMeta, Listing, ListMember, ListRole } from '@/lib/types'
import { NEW_GROUP_PALETTE } from '@/lib/colors'
import { ScreenBackground } from '@/components/ScreenBackground'
import { ListingGrid } from '@/components/ListingGrid'
import { AddPanel, type ItemFormValues } from '@/components/AddPanel'
import { Button, IconButton, buttonClass } from '@/components/ui/Button'
import { FloatingButton } from '@/components/ui/FloatingButton'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { Price } from '@/components/ui/Price'
import { AvatarStack } from '@/components/ui/Avatar'

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

async function loadEditableLists(): Promise<ItemList[]> {
  const data = await fetch('/api/lists').then((r) => r.json()).catch(() => null)
  const shared = (data?.shared ?? []).filter((l: ItemList & { userRole?: ListRole }) => l.userRole !== 'viewer')
  return [...(data?.own ?? []), ...shared]
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [item, setItem] = useState<ItemWithMeta | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [newSince, setNewSince] = useState<string | null>(null)
  const [members, setMembers] = useState<{ name: string }[]>([])
  const [lists, setLists] = useState<ItemList[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)

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
      if (!d.itemData) return
      // Listings found after the previous visit count as new — read before marking it viewed
      setNewSince(d.itemData.last_viewed_at ?? '1970-01-01T00:00:00Z')
      fetch(`/api/items/${id}/viewed`, { method: 'POST' })

      const shared = d.itemData.lists.find((l) => l.visibility === 'collaborative')
      if (shared) {
        fetch(`/api/lists/${shared.id}/members`)
          .then((r) => r.json())
          .then((data: ListMember[]) => { if (!cancelled && Array.isArray(data)) setMembers(data.map((m) => ({ name: m.display_name || m.email }))) })
          .catch(() => {})
      }
    })
    loadEditableLists().then((l) => { if (!cancelled) setLists(l) })
    return () => { cancelled = true }
  }, [apply, id])

  function closeEdit() {
    setEditOpen(false)
    requestAnimationFrame(() => fabRef.current?.focus())
  }

  async function save(v: ItemFormValues): Promise<string | null> {
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v.name, brand: v.brand, min_price: v.min_price, max_price: v.max_price, notify: v.notify }),
      })
      const json = await res.json()
      if (!res.ok) return json.error ?? 'Could not save'
      await fetch(`/api/items/${id}/associations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds: v.listIds }),
      })
      apply(await loadItem(id))
      closeEdit()
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  async function remove(): Promise<string | null> {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) return 'Could not delete — please try again'
    router.push('/watchlist')
    return null
  }

  async function createList(name: string): Promise<ItemList | null> {
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: NEW_GROUP_PALETTE[lists.length % NEW_GROUP_PALETTE.length] }),
    }).catch(() => null)
    if (!res?.ok) return null
    const created: ItemList = await res.json()
    setLists((prev) => [...prev, created])
    return created
  }

  const shell = 'w-full max-w-[1280px] mx-auto px-[14px] md:px-8'

  if (loading) {
    return (
      <div className={`${shell} pt-6`} aria-busy="true">
        <ScreenBackground color="var(--paper)" />
        <div className="h-5 w-24 rounded-pill bg-shade animate-pulse" />
        <div className="mt-6 h-12 w-2/3 max-w-md rounded-md bg-shade animate-pulse" />
        <div className="mt-4 h-8 w-28 rounded-pill bg-shade animate-pulse" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-16 px-4">
        <ScreenBackground color="var(--paper)" />
        <p className="m-0 text-[18px] font-semibold">Item not found</p>
        <Link href="/watchlist" className={`${buttonClass({ variant: 'ghost', size: 'sm' })} mt-2 no-underline`}>← Watchlist</Link>
      </div>
    )
  }

  const list = item.lists[0]
  const shared = item.lists.some((l) => l.visibility === 'collaborative')
  const inRange = listings.filter((l) =>
    l.price != null && (item.min_price == null || l.price >= item.min_price) && (item.max_price == null || l.price <= item.max_price))
  const lowest = inRange.length ? Math.min(...inRange.map((l) => l.price!)) : null
  const fmt = (n: number) => n.toLocaleString('sv-SE')
  const range = item.min_price != null || item.max_price != null
    ? `${item.min_price != null ? fmt(item.min_price) : 'Any'} — ${item.max_price != null ? `${fmt(item.max_price)} kr` : 'no max'}`
    : null
  const refresh = () => router.push(`/items/${id}/scan`)

  return (
    <div className="flex-1 w-full pb-32">
      <ScreenBackground color="var(--paper)" />

      {/* Header block */}
      <section className={`${shell} pt-2 pb-[18px] md:pt-[18px] md:pb-6`}>
        {/* Mobile top row: back, avatars, spacer, refresh (the app header is desktop-only here) */}
        <div className="md:hidden flex items-center gap-2 h-12">
          <IconButton icon="arrow-left" variant="ghost" label="Back to watchlist" onClick={() => router.push('/watchlist')} />
          {members.length > 0 && <AvatarStack people={members} size={26} />}
          <div className="flex-1" />
          <IconButton icon="refresh" label="Refresh listings" onClick={refresh} />
        </div>

        <Link href="/watchlist" className={`max-md:hidden ${buttonClass({ variant: 'ghost', size: 'sm' })} !px-0 !text-muted no-underline`}>
          ← Watchlist
        </Link>

        <div className="flex flex-col md:flex-row md:flex-wrap md:items-end md:justify-between gap-y-4 gap-x-8 mt-2 md:mt-4">
          <div className="min-w-0">
            {item.brand && <p className="m-0 text-[16px] md:text-[22px] font-medium text-muted tracking-[-0.01em]">{item.brand}</p>}
            <h1 className="m-0 text-[34px] md:text-[52px] font-bold leading-[1.02] tracking-[-0.035em] [overflow-wrap:anywhere]">{item.name}</h1>
            <div className="max-md:hidden flex flex-wrap items-center gap-2.5 mt-4">
              <Button size="sm" onClick={refresh} icon={<Icon name="refresh" size={15} strokeWidth={2} />}>Refresh</Button>
              {shared && (
                <span className="flex items-center gap-2.5">
                  <Badge variant="outline">Shared list</Badge>
                  {members.length > 0 && <AvatarStack people={members} size={26} />}
                </span>
              )}
            </div>
            {shared && <Badge variant="outline" className="md:hidden mt-3">Shared list</Badge>}
          </div>

          <div className="md:text-right">
            <div className="text-[14px] text-muted mb-1.5">Lowest price{list ? ` · ${list.name}` : ''}</div>
            <Price value={lowest} size="xl" />
            {range && <div className="mt-1.5 text-[14px] text-muted tabular-nums">{range}</div>}
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className={`${shell} pt-2`}>
        <ListingGrid key={listings.map((l) => l.id).join()} listings={listings} newSince={newSince} />
      </section>

      <FloatingButton ref={fabRef} label="Edit item" icon="pencil" hidden={editOpen} onClick={() => setEditOpen(true)} />

      <AddPanel
        open={editOpen}
        mode="edit"
        lists={lists}
        initial={{
          name: item.name,
          brand: item.brand,
          min_price: item.min_price,
          max_price: item.max_price,
          notify: item.notify,
          listIds: item.lists.map((l) => l.id),
        }}
        onSubmit={save}
        onDelete={remove}
        onClose={closeEdit}
        onCreateList={createList}
      />
    </div>
  )
}
