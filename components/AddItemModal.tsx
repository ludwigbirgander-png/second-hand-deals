'use client'

import { useState } from 'react'
import type { Category, ItemList } from '@/lib/types'
import { COLORS, COLOR_MAP } from '@/lib/colors'
import { ScrapeProgress } from '@/components/ScrapeProgress'

// Non-linear slider mapping
// Segment 1: positions   0– 50 → prices     0–  500 (step  10, 50 intervals)
// Segment 2: positions  50– 60 → prices   500– 1000 (step  50, 10 intervals)
// Segment 3: positions  60–150 → prices  1000–10000 (step 100, 90 intervals)
// Segment 4: positions 150–190 → prices 10000–50000 (step 1000, 40 intervals)
const SLIDER_MAX = 190
const PRICE_MAX = 50000

function posToPrice(pos: number): number {
  if (pos <= 50)  return pos * 10
  if (pos <= 60)  return 500  + (pos - 50)  * 50
  if (pos <= 150) return 1000 + (pos - 60)  * 100
  return               10000 + (pos - 150) * 1000
}

function priceToPos(price: number): number {
  if (price <= 500)   return price / 10
  if (price <= 1000)  return 50  + (price - 500)  / 50
  if (price <= 10000) return 60  + (price - 1000) / 100
  return                     150 + (price - 10000) / 1000
}

function snapPrice(price: number): number {
  if (price <= 0)      return 0
  if (price <= 500)    return Math.round(price / 10)   * 10
  if (price <= 1000)   return Math.round(price / 50)   * 50
  if (price <= 10000)  return Math.round(price / 100)  * 100
  return Math.min(     Math.round(price / 1000) * 1000, PRICE_MAX)
}

const thumbCls = [
  'absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none',
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:appearance-none',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full',
  '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-900',
  '[&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:border-transparent',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none',
  '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full',
  '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-900',
  '[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow',
].join(' ')

interface Props {
  categories: Category[]
  lists: ItemList[]
  onClose: () => void
  onCreated: () => void
  onNewCategory: (cat: Category) => void
  onNewList: (list: ItemList) => void
}

export function AddItemModal({ categories: initialCategories, lists: initialLists, onClose, onCreated, onNewCategory, onNewList }: Props) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [categories, setCategories] = useState(initialCategories)
  const [lists, setLists] = useState(initialLists)

  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX)
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')

  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('blue')

  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState('zinc')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [scrapingItemId, setScrapingItemId] = useState<string | null>(null)

  const minPos = priceToPos(minPrice)
  const maxPos = priceToPos(maxPrice)
  const leftPct  = (minPos / SLIDER_MAX) * 100
  const rightPct = (maxPos / SLIDER_MAX) * 100
  const minOnTop = minPos > SLIDER_MAX * 0.8

  function handleMinSlider(rawPos: number) {
    const price = posToPrice(Math.min(rawPos, maxPos - 1))
    const val = Math.max(0, Math.min(snapPrice(price), maxPrice - 10))
    setMinPrice(val)
    setMinText(val <= 0 ? '' : String(val))
  }

  function handleMaxSlider(rawPos: number) {
    const price = posToPrice(Math.max(rawPos, minPos + 1))
    const val = Math.min(PRICE_MAX, Math.max(snapPrice(price), minPrice + 10))
    setMaxPrice(val)
    setMaxText(val >= PRICE_MAX ? '' : String(val))
  }

  function commitMin(raw: string) {
    const parsed = parseInt(raw.replace(/\s/g, ''), 10)
    const val = isNaN(parsed) ? 0 : Math.max(0, parsed)
    const snapped = snapPrice(Math.min(val, PRICE_MAX))
    const final = Math.max(0, Math.min(snapped, maxPrice - 10))
    setMinPrice(final)
    setMinText(final <= 0 ? '' : String(final))
  }

  function commitMax(raw: string) {
    const parsed = parseInt(raw.replace(/\s/g, ''), 10)
    const val = isNaN(parsed) ? PRICE_MAX : Math.min(PRICE_MAX, parsed)
    const snapped = snapPrice(val)
    const final = Math.min(PRICE_MAX, Math.max(snapped, minPrice + 10))
    setMaxPrice(final)
    setMaxText(final >= PRICE_MAX ? '' : String(final))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)

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
    } catch {
      setSaveError('Network error — please try again')
      setSaving(false)
    }
  }

  async function createCategory() {
    if (!newCatName.trim()) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    })
    const cat = await res.json()
    setCategories((prev) => [...prev, cat])
    setSelectedCategoryIds((prev) => [...prev, cat.id])
    onNewCategory(cat)
    setNewCatName('')
    setNewCatColor('blue')
    setShowNewCat(false)
  }

  async function createList() {
    if (!newListName.trim()) return
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName.trim(), color: newListColor }),
    })
    const list = await res.json()
    setLists((prev) => [...prev, list])
    setSelectedListIds((prev) => [...prev, list.id])
    onNewList(list)
    setNewListName('')
    setNewListColor('zinc')
    setShowNewList(false)
  }

  function toggleId(id: string, set: string[], setter: (v: string[]) => void) {
    setter(set.includes(id) ? set.filter((x) => x !== id) : [...set, id])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={scrapingItemId ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">

        {scrapingItemId ? (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">Searching for listings…</h2>
            <ScrapeProgress
              itemId={scrapingItemId}
              label={brand ? `${brand} ${name}` : name}
              onComplete={() => { onCreated(); onClose() }}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Add item</h2>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Brand (optional)"
                  className="w-36 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Item name *"
                  required
                  className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-200"
                />
              </div>

              {/* Price range */}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-3">Price range</p>

                <div className="flex items-center gap-3">
                  {/* Min text input */}
                  <div className="relative w-20 shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={minText}
                      onChange={(e) => setMinText(e.target.value)}
                      onBlur={() => commitMin(minText)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitMin(minText) } }}
                      placeholder="Any"
                      className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-center tabular-nums outline-none focus:border-zinc-400 pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">kr</span>
                  </div>

                  {/* Slider */}
                  <div className="relative flex-1 h-5 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-200 pointer-events-none">
                      <div
                        className="absolute h-full rounded-full bg-zinc-900"
                        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
                      />
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={SLIDER_MAX}
                      step={1}
                      value={minPos}
                      onChange={(e) => handleMinSlider(Number(e.target.value))}
                      className={`${thumbCls} ${minOnTop ? 'z-20' : 'z-10'}`}
                    />
                    <input
                      type="range"
                      min={0}
                      max={SLIDER_MAX}
                      step={1}
                      value={maxPos}
                      onChange={(e) => handleMaxSlider(Number(e.target.value))}
                      className={`${thumbCls} z-10`}
                    />
                  </div>

                  {/* Max text input */}
                  <div className="relative w-20 shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={maxText}
                      onChange={(e) => setMaxText(e.target.value)}
                      onBlur={() => commitMax(maxText)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitMax(maxText) } }}
                      placeholder="No max"
                      className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-center tabular-nums outline-none focus:border-zinc-400 pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">kr</span>
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const c = COLOR_MAP[cat.color] ?? COLOR_MAP.zinc
                    const selected = selectedCategoryIds.includes(cat.id)
                    return (
                      <button key={cat.id} type="button"
                        onClick={() => toggleId(cat.id, selectedCategoryIds, setSelectedCategoryIds)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${c.bg} ${c.text} ${selected ? `ring-2 ${c.ring}` : 'opacity-50 hover:opacity-80'}`}
                      >
                        {cat.name}
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => setShowNewCat(!showNewCat)}
                    className="px-2.5 py-1 rounded-full text-xs text-zinc-500 border border-dashed border-zinc-300 hover:border-zinc-400">
                    + New
                  </button>
                </div>
                {showNewCat && (
                  <div className="mt-2 flex gap-2 items-center">
                    <input autoFocus type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-500"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createCategory() } }} />
                    <div className="flex gap-1">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setNewCatColor(c)}
                          className={`w-5 h-5 rounded-full ${COLOR_MAP[c].dot} ${newCatColor === c ? 'ring-2 ring-offset-1 ring-zinc-500' : 'opacity-60'}`} />
                      ))}
                    </div>
                    <button type="button" onClick={createCategory} className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white shrink-0">Add</button>
                  </div>
                )}
              </div>

              {/* Lists */}
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">Lists</p>
                <div className="flex flex-wrap gap-1.5">
                  {lists.map((list) => {
                    const c = COLOR_MAP[list.color] ?? COLOR_MAP.zinc
                    const selected = selectedListIds.includes(list.id)
                    return (
                      <button key={list.id} type="button"
                        onClick={() => toggleId(list.id, selectedListIds, setSelectedListIds)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${c.bg} ${c.text} ${selected ? `ring-2 ${c.ring}` : 'opacity-50 hover:opacity-80'}`}
                      >
                        {list.name}
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => setShowNewList(!showNewList)}
                    className="px-2.5 py-1 rounded-full text-xs text-zinc-500 border border-dashed border-zinc-300 hover:border-zinc-400">
                    + New
                  </button>
                </div>
                {showNewList && (
                  <div className="mt-2 flex gap-2 items-center">
                    <input autoFocus type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)}
                      placeholder="List name"
                      className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-zinc-500"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createList() } }} />
                    <div className="flex gap-1">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setNewListColor(c)}
                          className={`w-5 h-5 rounded-full ${COLOR_MAP[c].dot} ${newListColor === c ? 'ring-2 ring-offset-1 ring-zinc-500' : 'opacity-60'}`} />
                      ))}
                    </div>
                    <button type="button" onClick={createList} className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white shrink-0">Add</button>
                  </div>
                )}
              </div>

              {saveError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving || !name.trim()}
                  className="px-5 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-40 hover:bg-zinc-700">
                  {saving ? 'Adding…' : 'Add item'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
