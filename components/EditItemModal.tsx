'use client'

import { useState, useEffect } from 'react'
import type { ItemWithMeta, Category, ItemList } from '@/lib/types'
import { COLORS, COLOR_MAP } from '@/lib/colors'

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
  item: ItemWithMeta
  onClose: () => void
  onSaved: () => void
}

export function EditItemModal({ item, onClose, onSaved }: Props) {
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand ?? '')

  const initialMin = item.min_price ?? 0
  const initialMax = item.max_price ?? PRICE_MAX
  const [minPrice, setMinPrice] = useState(initialMin)
  const [maxPrice, setMaxPrice] = useState(initialMax)
  const [minText, setMinText] = useState(initialMin > 0 ? String(initialMin) : '')
  const [maxText, setMaxText] = useState(initialMax < PRICE_MAX ? String(initialMax) : '')

  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [allLists, setAllLists] = useState<ItemList[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    item.categories.map((c) => c.id)
  )
  const [selectedListIds, setSelectedListIds] = useState<string[]>(
    item.lists.map((l) => l.id)
  )

  const [notify, setNotify] = useState(item.notify !== false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(true)

  useEffect(() => {
    Promise.all([fetch('/api/categories').then((r) => r.json()), fetch('/api/lists').then((r) => r.json())])
      .then(([cats, lists]) => {
        setAllCategories(Array.isArray(cats) ? cats : [])
        setAllLists(Array.isArray(lists) ? lists : [])
        setLoadingOptions(false)
      })
  }, [])

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

  function toggleId(id: string, set: string[], setter: (v: string[]) => void) {
    setter(set.includes(id) ? set.filter((x) => x !== id) : [...set, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || null,
          min_price: minPrice > 0 ? minPrice : null,
          max_price: maxPrice < PRICE_MAX ? maxPrice : null,
          notify,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSaveError(json.error ?? 'Failed to save')
        setSaving(false)
        return
      }

      await fetch(`/api/items/${item.id}/associations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds: selectedListIds, categoryIds: selectedCategoryIds }),
      })

      onSaved()
      onClose()
    } catch {
      setSaveError('Network error — please try again')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Edit item</h2>
          <button onClick={onClose} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name + brand */}
          <div className="flex gap-2">
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand (optional)"
              className="w-36 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-700"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name *"
              required
              className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-700"
            />
          </div>

          {/* Price range */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3">Price range</p>
            <div className="flex items-center gap-3">
              <div className="relative w-20 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  value={minText}
                  onChange={(e) => setMinText(e.target.value)}
                  onBlur={() => commitMin(minText)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitMin(minText) } }}
                  placeholder="Any"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-xs text-center tabular-nums outline-none focus:border-zinc-400 dark:focus:border-zinc-500 pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 pointer-events-none">kr</span>
              </div>

              <div className="relative flex-1 h-5 flex items-center">
                <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 pointer-events-none">
                  <div
                    className="absolute h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                    style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
                  />
                </div>
                <input
                  type="range" min={0} max={SLIDER_MAX} step={1} value={minPos}
                  onChange={(e) => handleMinSlider(Number(e.target.value))}
                  className={`${thumbCls} ${minOnTop ? 'z-20' : 'z-10'}`}
                />
                <input
                  type="range" min={0} max={SLIDER_MAX} step={1} value={maxPos}
                  onChange={(e) => handleMaxSlider(Number(e.target.value))}
                  className={`${thumbCls} z-10`}
                />
              </div>

              <div className="relative w-20 shrink-0">
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxText}
                  onChange={(e) => setMaxText(e.target.value)}
                  onBlur={() => commitMax(maxText)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitMax(maxText) } }}
                  placeholder="No max"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-xs text-center tabular-nums outline-none focus:border-zinc-400 dark:focus:border-zinc-500 pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 pointer-events-none">kr</span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">Categories</p>
            {loadingOptions ? (
              <div className="h-6 w-32 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((cat) => {
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
                {allCategories.length === 0 && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">No categories yet</p>
                )}
              </div>
            )}
          </div>

          {/* Lists */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">Lists</p>
            {loadingOptions ? (
              <div className="h-6 w-32 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allLists.map((list) => {
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
                {allLists.length === 0 && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">No lists yet</p>
                )}
              </div>
            )}
          </div>

          {/* Email notifications */}
          <div className="flex items-center justify-between py-0.5">
            <div>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Email notifications</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Get a daily digest when new listings appear</p>
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

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-200">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
