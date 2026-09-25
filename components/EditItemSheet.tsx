'use client'

import { useEffect, useState } from 'react'
import type { Category, ItemList, ItemWithMeta } from '@/lib/types'
import { themeOf } from '@/lib/colors'
import { Sheet } from './ui/Sheet'
import { Button } from './ui/Button'
import { FieldLabel, Input, TagToggle, Toggle } from './ui/Form'

interface Props {
  open: boolean
  item: ItemWithMeta
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const toText = (n: number | null) => (n != null && n > 0 ? String(n) : '')
const parse = (t: string) => parseInt(t.replace(/\s/g, ''), 10) || 0

export function EditItemSheet({ open, onClose, ...rest }: Props) {
  // The Sheet unmounts its content after closing, so the form starts fresh on every open
  return (
    <Sheet open={open} onClose={onClose} title="Edit item">
      <EditItemForm onClose={onClose} {...rest} />
    </Sheet>
  )
}

function EditItemForm({ item, onClose, onSaved, onDeleted }: Omit<Props, 'open'>) {
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand ?? '')
  const [minText, setMinText] = useState(toText(item.min_price))
  const [maxText, setMaxText] = useState(toText(item.max_price))
  const [notify, setNotify] = useState(item.notify !== false)
  const [catIds, setCatIds] = useState<string[]>(() => item.categories.map((c) => c.id))
  const [listIds, setListIds] = useState<string[]>(() => item.lists.map((l) => l.id))
  const [allCats, setAllCats] = useState<Category[]>([])
  const [allLists, setAllLists] = useState<ItemList[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    Promise.all([fetch('/api/categories').then((r) => r.json()), fetch('/api/lists').then((r) => r.json())])
      .then(([cats, lists]) => {
        setAllCats(Array.isArray(cats) ? cats : [])
        // /api/lists returns { own, shared }; items can be filed in shared lists you can edit
        const shared = (lists?.shared ?? []).filter((l: { userRole?: string }) => l.userRole !== 'viewer')
        setAllLists([...(lists?.own ?? []), ...shared])
      })
      .catch(() => {})
  }, [])

  const min = parse(minText)
  const max = parse(maxText)
  const rangeError = min && max && max < min ? 'Max must be above min' : null

  function toggle(id: string, arr: string[], set: (v: string[]) => void) {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  async function save() {
    if (!name.trim() || rangeError) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brand: brand.trim() || null, min_price: min || null, max_price: max || null, notify }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save')
        setSaving(false)
        return
      }
      await fetch(`/api/items/${item.id}/associations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds, categoryIds: catIds }),
      })
      onSaved()
    } catch {
      setError('Network error — please try again')
      setSaving(false)
    }
  }

  async function remove() {
    const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) onDeleted()
    else setError('Could not delete — please try again')
  }

  const tags = (arr: { id: string; name: string; color: string }[], sel: string[], set: (v: string[]) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {arr.map((x) => <TagToggle key={x.id} label={x.name} color={themeOf(x.color)[0]} selected={sel.includes(x.id)} onClick={() => toggle(x.id, sel, set)} />)}
    </div>
  )

  return (
    <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex flex-col gap-4">
      <Input label="Item name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input label="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Sony" />
      <div className="flex items-start gap-2.5">
        <Input label="Min" value={minText} onChange={(e) => setMinText(e.target.value)} placeholder="Any" suffix="kr" inputMode="numeric" wrapperClassName="flex-1" />
        <Input label="Max" value={maxText} onChange={(e) => setMaxText(e.target.value)} placeholder="No max" suffix="kr" inputMode="numeric" error={rangeError} wrapperClassName="flex-1" />
      </div>
      {allCats.length > 0 && <div><FieldLabel>Category</FieldLabel>{tags(allCats, catIds, setCatIds)}</div>}
      {allLists.length > 0 && <div><FieldLabel>List</FieldLabel>{tags(allLists, listIds, setListIds)}</div>}
      <Toggle checked={notify} onChange={setNotify} label="Email notifications" description="Daily digest when new listings appear" />
      {error && <p role="alert" className="m-0 text-[13px] text-signal-deep">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {confirmDelete ? (
          <>
            <Button variant="danger" onClick={remove}>Confirm delete</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
        )}
        <div className="flex-1" />
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving || !name.trim() || !!rangeError}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      {confirmDelete && <p className="m-0 -mt-1 text-[13px] text-muted">This removes the item and all its listings.</p>}
    </form>
  )
}
