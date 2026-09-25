'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category, ItemList, ItemWithMeta } from '@/lib/types'
import { themeOf } from '@/lib/colors'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { Icon } from './ui/Icon'
import { Button } from './ui/Button'
import { FieldLabel, Input, TagToggle, Toggle } from './ui/Form'
import { Thumb } from './ui/Thumb'
import { Price } from './ui/Price'

function parsePrice(text: string) {
  return parseInt(text.replace(/\s/g, ''), 10) || 0
}

/**
 * Header search bar that grows into the add-item panel. Typing also surfaces
 * matching watchlist items. Submitting creates the item and opens its scan.
 */
export function SearchPanel() {
  const router = useRouter()
  const desktop = useMediaQuery(DESKTOP)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [lists, setLists] = useState<string[]>([])
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState<ItemWithMeta[]>([])
  const [allLists, setAllLists] = useState<ItemList[]>([])
  const [allCats, setAllCats] = useState<Category[]>([])

  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load watchlist data the first time the panel opens; refresh on later opens
  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/items').then((r) => r.json()),
      fetch('/api/lists').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([itemsData, listsData, catsData]) => {
        setItems(Array.isArray(itemsData) ? itemsData : [])
        setAllLists(Array.isArray(listsData?.own) ? listsData.own : [])
        setAllCats(Array.isArray(catsData) ? catsData : [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [open])

  // Escape and outside clicks collapse the panel but keep what was typed
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  const min = parsePrice(minText)
  const max = parsePrice(maxText)
  const rangeError = min && max && max < min ? 'Max must be above min' : null
  const q = name.trim().toLowerCase()
  const matches = q ? items.filter((i) => `${i.brand ?? ''} ${i.name}`.toLowerCase().includes(q)).slice(0, 4) : []

  function reset() {
    setName(''); setBrand(''); setMinText(''); setMaxText(''); setCats([]); setLists([]); setNotify(true); setSaving(false); setError(null)
  }

  function close() {
    reset()
    setOpen(false)
    inputRef.current?.blur()
  }

  function toggle(id: string, arr: string[], set: (v: string[]) => void) {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || rangeError || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || null,
          min_price: min || null,
          max_price: max || null,
          notify,
        }),
      })
      const item = await res.json()
      if (!res.ok) {
        setError(item.error ?? 'Could not add the item')
        setSaving(false)
        return
      }
      if (lists.length > 0 || cats.length > 0) {
        await fetch(`/api/items/${item.id}/associations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listIds: lists, categoryIds: cats }),
        })
      }
      close()
      router.push(`/items/${item.id}/scan`)
    } catch {
      setError('Network error — please try again')
      setSaving(false)
    }
  }

  const tags = (arr: { id: string; name: string; color: string }[], sel: string[], set: (v: string[]) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {arr.map((x) => (
        <TagToggle key={x.id} label={x.name} color={themeOf(x.color)[0]} selected={sel.includes(x.id)} onClick={() => toggle(x.id, sel, set)} />
      ))}
    </div>
  )

  return (
    // On mobile the open panel covers the whole top bar row (the row is the positioning parent)
    <div ref={ref} className={`h-11 min-w-0 z-[15] ${open ? 'max-md:static md:relative' : 'relative'}`}>
      <form
        onSubmit={submit}
        className={
          'absolute left-0 right-0 z-[15] rounded-sm bg-screen transition-[box-shadow,background] duration-[var(--dur-base)] ease-out ' +
          (open ? 'shadow-[0_16px_40px_rgba(11,11,10,.12),inset_0_0_0_1px_var(--border-soft)] max-md:top-[calc(50%_-_22px)] md:top-0' : 'top-0 shadow-[inset_0_0_0_1px_var(--border-soft)]')
        }
      >
        <div className="flex items-center gap-3 h-11 pl-3.5 pr-0.5 md:pl-4 md:pr-1 cursor-text" onClick={() => inputRef.current?.focus()}>
          <Icon name="search" size={16} strokeWidth={1.5} className="text-muted" />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setOpen(true)}
            aria-label="Add an item to track"
            placeholder={desktop ? 'Add an item to track, e.g. Sony WH-1000XM5' : 'Add an item'}
            className="flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] md:text-[16px] tracking-[-0.01em] text-ink placeholder:text-muted"
          />
          {open && (
            <button
              type="button"
              aria-label="Close"
              onClick={(e) => { e.stopPropagation(); close() }}
              className="w-11 h-11 shrink-0 rounded-xs text-muted flex items-center justify-center cursor-pointer"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="grid transition-[grid-template-rows] duration-[var(--dur-slow)] ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
          <div className="overflow-hidden min-h-0" inert={!open}>
            {/* Full-width scroller, so the match rows' negative margins don't cause a sideways scrollbar */}
            <div className="max-h-[calc(100dvh_-_120px)] overflow-y-auto overflow-x-hidden">
            <div className="border-t border-line-hair mx-[18px] md:mx-7 py-[18px] md:pt-6 md:pb-7 flex flex-col gap-5 md:gap-6">
              {matches.length > 0 && (
                <div>
                  <FieldLabel>Already in your watchlist</FieldLabel>
                  <div className="flex flex-col gap-0.5 -mx-2.5">
                    {matches.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => { setOpen(false); router.push(`/items/${it.id}`) }}
                        className="flex items-center gap-3 px-2.5 py-2 min-h-[52px] rounded-xs text-ink text-left cursor-pointer hover:bg-shade transition-colors"
                      >
                        <Thumb shape="circle" size={36} src={it.lowestListing?.image_url} />
                        <span className="flex-1 min-w-0">
                          {it.brand && <span className="block text-[12.5px] text-muted">{it.brand}</span>}
                          <span className="block text-[15px] tracking-[-0.01em] truncate">{it.name}</span>
                        </span>
                        <Price value={it.lowestListing?.price} size="body" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 md:gap-6">
                <Input label="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Sony" />
                <div>
                  <FieldLabel>Price range</FieldLabel>
                  <div className="flex items-start gap-2.5">
                    <Input aria-label="Minimum price" value={minText} onChange={(e) => setMinText(e.target.value)} placeholder="Any" suffix="kr" inputMode="numeric" wrapperClassName="flex-1" />
                    <span className="text-grey-300 leading-[48px]">—</span>
                    <Input aria-label="Maximum price" value={maxText} onChange={(e) => setMaxText(e.target.value)} placeholder="No max" suffix="kr" inputMode="numeric" error={rangeError} wrapperClassName="flex-1" />
                  </div>
                </div>
              </div>

              {loaded && (allCats.length > 0 || allLists.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 md:gap-6">
                  {allCats.length > 0 && <div><FieldLabel>Category</FieldLabel>{tags(allCats, cats, setCats)}</div>}
                  {allLists.length > 0 && <div><FieldLabel>List</FieldLabel>{tags(allLists, lists, setLists)}</div>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                <div className="flex-[1_1_240px]">
                  <Toggle checked={notify} onChange={setNotify} label="Email notifications" description="Daily digest when new listings appear" />
                </div>
                <Button type="submit" size="lg" className="max-md:w-full" disabled={saving || !name.trim() || !!rangeError}>
                  {saving ? 'Adding…' : 'Add to watchlist'}
                </Button>
              </div>
              {error && <p role="alert" className="-mt-2 text-[13px] text-signal-deep">{error}</p>}
            </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
