'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Category, ItemList } from '@/lib/types'
import { COLOR_MAP } from '@/lib/colors'
import { ScrapeProgress } from '@/components/ScrapeProgress'

const PRICE_MAX = 50000

export default function HomePage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [lists, setLists] = useState<ItemList[]>([])
  const [notify, setNotify] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'scraping'>('idle')
  const [scrapingItemId, setScrapingItemId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded) return
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/lists').then((r) => r.json()),
    ]).then(([cats, listsData]) => {
      setCategories(Array.isArray(cats) ? cats : [])
      setLists(Array.isArray(listsData?.own) ? listsData.own : [])
    })
  }, [expanded])

  const handleComplete = useCallback(() => {
    router.push('/watchlist')
  }, [router])

  function toggleId(id: string, set: string[], setter: (v: string[]) => void) {
    setter(set.includes(id) ? set.filter((x) => x !== id) : [...set, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)

    const minPrice = parseInt(minText.replace(/\s/g, ''), 10) || 0
    const maxPrice = parseInt(maxText.replace(/\s/g, ''), 10) || PRICE_MAX

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || null,
          noScrape: true,
          min_price: minPrice > 0 ? minPrice : null,
          max_price: maxPrice < PRICE_MAX ? maxPrice : null,
          notify,
        }),
      })
      const item = await res.json()
      if (!res.ok) {
        setSaveError(item.error ?? 'Failed to create item')
        setSaving(false)
        return
      }

      if (selectedListIds.length > 0 || selectedCategoryIds.length > 0) {
        await fetch(`/api/items/${item.id}/associations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listIds: selectedListIds, categoryIds: selectedCategoryIds }),
        })
      }

      setSaving(false)
      setScrapingItemId(item.id)
      setPhase('scraping')
    } catch {
      setSaveError('Network error — please try again')
      setSaving(false)
    }
  }

  if (phase === 'scraping' && scrapingItemId) {
    return (
      <div className="flex flex-col items-center pt-16 pb-12">
        <div className="w-full max-w-xl">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Searching for listings…
          </h2>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-6">
            {brand ? `${brand} ${name}` : name}
          </p>
          <ScrapeProgress
            itemId={scrapingItemId}
            onComplete={handleComplete}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center pt-16 pb-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          What are you looking for?
        </h1>
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          Track prices across Blocket, Tradera, Sellpy, Vinted and more
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xl">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (e.target.value) setExpanded(true) }}
          onFocus={() => setExpanded(true)}
          placeholder="Item name, e.g. Sony WH-1000XM5"
          autoFocus
          required
          className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4 text-base outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 transition-all shadow-sm"
        />

        {expanded && (
          <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-sm">
            {/* Brand */}
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">
                Brand (optional)
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Sony"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              />
            </div>

            {/* Price range */}
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">
                Price range
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={minText}
                    onChange={(e) => setMinText(e.target.value)}
                    placeholder="Any"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">kr</span>
                </div>
                <span className="text-zinc-300 dark:text-zinc-600">—</span>
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxText}
                    onChange={(e) => setMaxText(e.target.value)}
                    placeholder="No max"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">kr</span>
                </div>
              </div>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const c = COLOR_MAP[cat.color] ?? COLOR_MAP.zinc
                    const selected = selectedCategoryIds.includes(cat.id)
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleId(cat.id, selectedCategoryIds, setSelectedCategoryIds)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${c.bg} ${c.text} ${selected ? `ring-2 ${c.ring}` : 'opacity-50 hover:opacity-80'}`}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lists */}
            {lists.length > 0 && (
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5">
                  List
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {lists.map((list) => {
                    const c = COLOR_MAP[list.color] ?? COLOR_MAP.zinc
                    const selected = selectedListIds.includes(list.id)
                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => toggleId(list.id, selectedListIds, setSelectedListIds)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${c.bg} ${c.text} ${selected ? `ring-2 ${c.ring}` : 'opacity-50 hover:opacity-80'}`}
                      >
                        {list.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Notify toggle */}
            <div className="flex items-center justify-between py-0.5">
              <div>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email notifications</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Daily digest when new listings appear</p>
              </div>
              <button
                type="button"
                onClick={() => setNotify((v) => !v)}
                className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${notify ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${notify ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {saveError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              {saving ? 'Adding…' : 'Add to watchlist'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
