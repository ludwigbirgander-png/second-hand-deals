'use client'

import { useEffect, useState } from 'react'
import type { ItemList } from '@/lib/types'
import { themeOf } from '@/lib/colors'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { Icon } from './ui/Icon'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { FieldLabel, Input, PriceRange, Toggle, parsePrice, priceRangeError } from './ui/Form'

export interface ItemFormValues {
  name: string
  brand: string | null
  min_price: number | null
  max_price: number | null
  notify: boolean
  listIds: string[]
}

export interface ItemFormInitial {
  name?: string
  brand?: string | null
  min_price?: number | null
  max_price?: number | null
  notify?: boolean
  listIds?: string[]
}

interface Props {
  open: boolean
  mode?: 'add' | 'edit'
  /** Lists the item can be filed in (own + shared lists you can edit) */
  lists: ItemList[]
  initial?: ItemFormInitial
  /** Resolves to an error message, or null on success (the parent then closes the panel) */
  onSubmit: (v: ItemFormValues) => Promise<string | null>
  onDelete?: () => Promise<string | null>
  onClose: () => void
  onCreateList: (name: string) => Promise<ItemList | null>
}

/**
 * The floating button's open state: add a new item, or edit one.
 * Desktop: a 760px card over a scrim that grows out of the button. Mobile: a full-screen sheet.
 */
export function AddPanel({ open, ...rest }: Props) {
  const desktop = useMediaQuery(DESKTOP)
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  // Keep it mounted through the exit animation; the form remounts fresh on the next open
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => setMounted(false), 240)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') rest.onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, rest.onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null
  return <PanelBody {...rest} closing={!open} desktop={desktop} />
}

function PanelBody({ mode = 'add', lists, initial, onSubmit, onDelete, onClose, onCreateList, closing, desktop }: Omit<Props, 'open'> & { closing: boolean; desktop: boolean }) {
  const edit = mode === 'edit'
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [range, setRange] = useState({
    min: initial?.min_price ? String(initial.min_price) : '',
    max: initial?.max_price ? String(initial.max_price) : '',
  })
  const [listIds, setListIds] = useState<string[]>(initial?.listIds ?? [])
  const [notify, setNotify] = useState(initial?.notify !== false)
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rangeError = priceRangeError(range.min, range.max)
  const canSubmit = !!name.trim() && !rangeError && !saving
  const submitLabel = edit ? (saving ? 'Saving…' : 'Save') : saving ? 'Adding…' : 'Add to watchlist'

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    const err = await onSubmit({
      name: name.trim(),
      brand: brand.trim() || null,
      min_price: parsePrice(range.min) || null,
      max_price: parsePrice(range.max) || null,
      notify,
      listIds,
    })
    if (err) { setError(err); setSaving(false) }
  }

  async function remove() {
    if (!onDelete) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setSaving(true)
    const err = await onDelete()
    if (err) { setError(err); setSaving(false); setConfirmDelete(false) }
  }

  async function createList() {
    const n = newListName.trim()
    if (!n) return
    const list = await onCreateList(n)
    if (!list) { setError('Could not create the list'); return }
    setListIds((ids) => [...ids, list.id])
    setNewListName('')
    setCreating(false)
  }

  const toggleList = (id: string) => setListIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const deleteButton = onDelete && (
    <Button variant="danger" size="sm" className="!px-0" onClick={remove} disabled={saving}>
      {confirmDelete ? 'Confirm delete' : 'Delete item'}
    </Button>
  )

  const fields = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-5">
        <Input label="Brand (optional)" placeholder="e.g. Sony" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <PriceRange min={range.min} max={range.max} onChange={setRange} />
      </div>
      <div>
        <FieldLabel>List</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          {lists.map((l) => (
            <Chip key={l.id} label={l.name} color={themeOf(l.color)} active={listIds.includes(l.id)} onClick={() => toggleList(l.id)} />
          ))}
          {creating ? (
            <span className="inline-flex items-center gap-1.5">
              <Input
                aria-label="New list name"
                inputSize="sm"
                autoFocus
                placeholder="List name"
                value={newListName}
                wrapperClassName="w-40"
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); createList() }
                  if (e.key === 'Escape') { e.stopPropagation(); setCreating(false); setNewListName('') }
                }}
              />
              <Button size="sm" onClick={createList} disabled={!newListName.trim()}>Create</Button>
            </span>
          ) : (
            <Chip variant="add" label="New list" onClick={() => setCreating(true)} />
          )}
        </div>
      </div>
      <Toggle checked={notify} onChange={setNotify} label="Email notifications" description="Daily digest when new listings appear" />
      {confirmDelete && <p className="m-0 text-[13px] text-muted">This removes the item and all its listings. Press again to confirm.</p>}
    </>
  )

  // ─── Mobile: full-screen sheet ─────────────────────────────────────────────
  if (!desktop) {
    const title = edit ? 'Edit item' : 'Add an item'
    return (
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-0 z-40 flex flex-col bg-chalk ${closing ? 'k-sink' : 'k-rise'}`}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-14 px-4 border-b border-line-hair shrink-0">
          {edit ? (
            <>
              <button type="button" onClick={onClose} className="justify-self-start text-[15px] font-medium text-ink cursor-pointer">Cancel</button>
              <span className="text-[16px] font-bold tracking-[-0.01em]">{title}</span>
              <button type="submit" disabled={!canSubmit} className="justify-self-end text-[15px] font-semibold text-ink cursor-pointer disabled:opacity-40">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <span className="col-span-2 text-[17px] font-bold tracking-[-0.015em]">{title}</span>
              <button type="button" onClick={onClose} className="justify-self-end text-[15px] font-medium text-ink cursor-pointer">Cancel</button>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
          <Input aria-label="Item name" icon="search" placeholder="Add an item" autoFocus={!edit} value={name} onChange={(e) => setName(e.target.value)} />
          {fields}
          {error && <p role="alert" className="m-0 text-[13px] text-state-danger">{error}</p>}
          {edit && <div className="mt-auto pt-4 border-t border-dashed border-line-dashed flex justify-center">{deleteButton}</div>}
        </div>
        {!edit && (
          <div className="p-4 pt-3 shrink-0">
            <Button type="submit" size="lg" block disabled={!canSubmit}>{submitLabel}</Button>
          </div>
        )}
      </form>
    )
  }

  // ─── Desktop: card over a scrim, grown out of the floating button ──────────
  return (
    <div className="fixed inset-0 z-40">
      <div className={`absolute inset-0 bg-scrim ${closing ? 'k-fade-out' : 'k-fade-in'}`} onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={edit ? 'Edit item' : 'Add an item'}
        className="absolute left-1/2 -translate-x-1/2 bottom-7 w-[min(760px,calc(100%_-_32px))]"
      >
        <div className={`bg-chalk rounded-[18px] shadow-panel overflow-hidden ${closing ? 'k-shrink' : 'k-grow'}`}>
          <div className="flex flex-col gap-[18px] px-6 py-5">
            {edit && (
              <div className="flex items-center justify-between">
                <span className="text-[18px] font-bold tracking-[-0.02em]">Edit item</span>
                {deleteButton}
              </div>
            )}
            {fields}
          </div>
          <div className="flex items-center gap-2.5 pl-4 pr-3 py-3 border-t border-dashed border-line-dashed">
            <Icon name="search" size={18} className="text-muted" />
            <input
              aria-label="Item name"
              autoFocus={!edit}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add an item to track, e.g. Sony WH-1000XM5"
              className="flex-1 min-w-0 h-12 bg-transparent outline-none text-[17px] text-ink placeholder:text-faint"
            />
            <Button type="submit" size="lg" disabled={!canSubmit}>{submitLabel}</Button>
          </div>
          {error && <p role="alert" className="m-0 px-6 pb-4 -mt-1 text-[13px] text-state-danger">{error}</p>}
        </div>
      </form>
    </div>
  )
}

/**
 * Empty-watchlist dock (desktop): the add card starts expanded at 620px, showing only the
 * field row. Adding the first item collapses it to the floating button.
 */
export function AddDock({ onSubmit }: { onSubmit: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    const err = await onSubmit(name.trim())
    if (err) { setError(err); setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="fixed z-30 left-1/2 -translate-x-1/2 bottom-7 w-[min(620px,calc(100%_-_32px))]">
      <div className="bg-chalk rounded-[18px] shadow-panel overflow-hidden">
        <div className="flex items-center gap-2.5 pl-4 pr-3 py-3">
          <Icon name="search" size={18} className="text-muted" />
          <input
            aria-label="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an item to track, e.g. Sony WH-1000XM5"
            className="flex-1 min-w-0 h-12 bg-transparent outline-none text-[17px] text-ink placeholder:text-faint"
          />
          <Button type="submit" size="lg" disabled={!name.trim() || saving}>{saving ? 'Adding…' : 'Add to watchlist'}</Button>
        </div>
        {error && <p role="alert" className="m-0 px-5 pb-3 text-[13px] text-state-danger">{error}</p>}
      </div>
    </form>
  )
}
