'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ListingTable } from '@/components/ListingTable'
import { ScrapeProgress } from '@/components/ScrapeProgress'
import { EditItemModal } from '@/components/EditItemModal'
import type { ItemWithMeta, Listing } from '@/lib/types'

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [item, setItem] = useState<ItemWithMeta | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const fetchData = useCallback(async () => {
    const [itemRes, listingsRes] = await Promise.all([
      fetch('/api/items'),
      fetch(`/api/items/${id}/listings`),
    ])
    const items: ItemWithMeta[] = await itemRes.json()
    const { listings } = await listingsRes.json()

    setItem(items.find((i) => i.id === id) ?? null)
    setListings(listings ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function refresh() {
    setRefreshing(true)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-zinc-200 animate-pulse" />
        <div className="h-48 rounded-xl bg-zinc-200 animate-pulse" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">Item not found</p>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700 underline mt-2 block">← Back</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">← Watchlist</Link>
        <h1 className="text-2xl font-semibold flex-1">
          {item.brand && <span className="text-zinc-400 font-normal">{item.brand} </span>}
          {item.name}
        </h1>
        <button
          onClick={() => setShowEdit(true)}
          className="px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 transition-colors"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {showEdit && (
        <EditItemModal
          item={item}
          onClose={() => setShowEdit(false)}
          onSaved={async () => { await fetchData(); setShowEdit(false) }}
        />
      )}

      {refreshing ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">Searching for listings…</h2>
          <ScrapeProgress
            itemId={id}
            onComplete={async () => {
              await fetchData()
              setRefreshing(false)
            }}
          />
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="text-sm font-medium text-zinc-500">
              {listings.length} listing{listings.length !== 1 ? 's' : ''} found
            </h2>
            {(item.min_price != null || item.max_price != null) && (
              <span className="text-xs text-zinc-400 tabular-nums">
                {item.min_price != null ? `${item.min_price.toLocaleString('sv-SE')} kr` : 'Any'}
                {' — '}
                {item.max_price != null ? `${item.max_price.toLocaleString('sv-SE')} kr` : 'no max'}
              </span>
            )}
          </div>
          <ListingTable listings={listings} />
        </div>
      )}
    </div>
  )
}
