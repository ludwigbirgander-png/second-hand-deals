'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ItemWithMeta, ItemList, ListMember, ListRole } from '@/lib/types'
import { NEW_GROUP_PALETTE, themeOf } from '@/lib/colors'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { ScreenBackground } from '@/components/ScreenBackground'
import { ListSheet, type ListSheetRole } from '@/components/GroupSheets'
import { AddPanel, AddDock, type ItemFormValues } from '@/components/AddPanel'
import { WINK_EVENT } from '@/components/AppHeader'
import { Eye } from '@/components/brand/Eye'
import { ScreenTitle } from '@/components/ui/Display'
import { Chip } from '@/components/ui/Chip'
import { ItemTile } from '@/components/ui/ItemTile'
import { FloatingButton } from '@/components/ui/FloatingButton'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { AvatarStack } from '@/components/ui/Avatar'

type SharedList = ItemList & { userRole: ListRole }

async function loadWatchlist() {
  const [itemsData, listsData, followingData] = await Promise.all([
    fetch('/api/items').then((r) => r.json()),
    fetch('/api/lists').then((r) => r.json()),
    fetch('/api/lists/following').then((r) => r.json()),
  ])
  // lowestListing and listing_count are computed server-side in /api/items
  return {
    items: (Array.isArray(itemsData) ? itemsData : []) as ItemWithMeta[],
    own: (Array.isArray(listsData?.own) ? listsData.own : []) as ItemList[],
    shared: (Array.isArray(listsData?.shared) ? listsData.shared : []) as SharedList[],
    followed: (Array.isArray(followingData) ? followingData : []) as ItemList[],
  }
}

/** Member avatars, only for collaborative lists (usually few). */
async function loadMembers(lists: ItemList[]) {
  const entries = await Promise.all(
    lists
      .filter((l) => l.visibility === 'collaborative')
      .map(async (l) => {
        const data: ListMember[] = await fetch(`/api/lists/${l.id}/members`).then((r) => r.json()).catch(() => [])
        return [l.id, Array.isArray(data) ? data.map((m) => ({ name: m.display_name || m.email })) : []] as const
      }),
  )
  return Object.fromEntries(entries) as Record<string, { name: string }[]>
}

/** Runs an item's scrape stream to completion. Resolves to the number of new listings. */
async function runScrape(itemId: string) {
  const res = await fetch(`/api/scrape/${itemId}/stream`, { method: 'POST' })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      try { const ev = JSON.parse(line); if (ev.type === 'complete') total = ev.total ?? 0 } catch { /* partial or malformed line */ }
    }
  }
  return total
}

/** Items with new listings first, then newest first. */
function ordered(items: ItemWithMeta[]) {
  return [...items].sort((a, b) => {
    const an = (a.new_listings_count ?? 0) > 0 ? 1 : 0
    const bn = (b.new_listings_count ?? 0) > 0 ? 1 : 0
    if (an !== bn) return bn - an
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export default function WatchlistPage() {
  const desktop = useMediaQuery(DESKTOP)
  const [items, setItems] = useState<ItemWithMeta[]>([])
  const [lists, setLists] = useState<ItemList[]>([])
  const [sharedLists, setSharedLists] = useState<SharedList[]>([])
  const [followedLists, setFollowedLists] = useState<ItemList[]>([])
  const [members, setMembers] = useState<Record<string, { name: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeListId, setActiveListId] = useState<'all' | string>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [managedList, setManagedList] = useState<{ list: ItemList; role: ListSheetRole } | null>(null)
  const [scanning, setScanning] = useState<Set<string>>(new Set())
  const [dropId, setDropId] = useState<string | null>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    loadWatchlist()
      .then((d) => {
        if (cancelled) return
        setItems(d.items)
        setLists(d.own)
        setSharedLists(d.shared)
        setFollowedLists(d.followed)
        setLoading(false)
        return loadMembers([...d.own, ...d.shared])
      })
      .then((m) => { if (m && !cancelled) setMembers(m) })
    return () => { cancelled = true }
  }, [])

  const openAdd = useCallback((initialName = '') => {
    setAddName(initialName)
    setAddOpen(true)
  }, [])

  function closeAdd() {
    setAddOpen(false)
    // Return focus to the button the panel grew out of
    requestAnimationFrame(() => fabRef.current?.focus())
  }

  // "/" opens Add; so does starting to type anywhere on the page (outside inputs and dialogs)
  useEffect(() => {
    if (addOpen || loading || items.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === '/') { e.preventDefault(); openAdd() }
      else if (e.key.length === 1 && e.key.trim()) { e.preventDefault(); openAdd(e.key) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [addOpen, loading, items.length, openAdd])

  // ─── Lists ────────────────────────────────────────────────────────────────

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

  async function submitNewList(e: React.FormEvent) {
    e.preventDefault()
    const name = newListName.trim()
    if (!name) return
    const created = await createList(name)
    if (created) setActiveListId(created.id)
    setNewListName('')
    setAddingList(false)
  }

  function listUpdated(updated: ItemList) {
    const merge = <T extends ItemList>(l: T) => (l.id === updated.id ? { ...l, ...updated } : l)
    setLists((prev) => prev.map(merge))
    setSharedLists((prev) => prev.map(merge))
    setItems((prev) => prev.map((i) => ({ ...i, lists: i.lists.map(merge) })))
    setManagedList((m) => (m && m.list.id === updated.id ? { ...m, list: { ...m.list, ...updated } } : m))
  }

  function listDeleted(id: string) {
    setLists((prev) => prev.filter((l) => l.id !== id))
    setItems((prev) => prev.map((i) => ({ ...i, lists: i.lists.filter((l) => l.id !== id) })))
    if (activeListId === id) setActiveListId('all')
  }

  async function unfollowList(id: string) {
    await fetch(`/api/lists/${id}/follow`, { method: 'DELETE' })
    setFollowedLists((prev) => prev.filter((l) => l.id !== id))
    if (activeListId === id) setActiveListId('all')
  }

  // ─── Adding ───────────────────────────────────────────────────────────────

  async function scrapeNewItem(id: string) {
    setScanning((s) => new Set(s).add(id))
    try {
      await runScrape(id)
      // Pick up the new listing count, photo and lowest price
      const fresh: ItemWithMeta[] = await fetch('/api/items').then((r) => r.json())
      const updated = Array.isArray(fresh) ? fresh.find((i) => i.id === id) : undefined
      if (updated) setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
    } catch {
      // The tile keeps its placeholder; Refresh on the item page retries
    } finally {
      setScanning((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function addItem(v: ItemFormValues): Promise<string | null> {
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v.name, brand: v.brand, min_price: v.min_price, max_price: v.max_price, notify: v.notify }),
      })
      const created = await res.json()
      if (!res.ok) return created.error ?? 'Could not add the item'
      if (v.listIds.length > 0) {
        await fetch(`/api/items/${created.id}/associations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listIds: v.listIds }),
        })
      }
      const item: ItemWithMeta = {
        ...created,
        lists: [...lists, ...sharedLists].filter((l) => v.listIds.includes(l.id)),
        lowestListing: null,
        new_listings_count: 0,
        listing_count: 0,
      }
      setItems((prev) => [item, ...prev])
      // Make sure the new tile is visible under the current filter
      if (activeListId !== 'all' && !v.listIds.includes(activeListId)) setActiveListId('all')
      setDropId(item.id)
      setAddOpen(false)
      requestAnimationFrame(() => fabRef.current?.focus())
      window.dispatchEvent(new Event(WINK_EVENT))
      scrapeNewItem(item.id)
      return null
    } catch {
      return 'Network error — please try again'
    }
  }

  // ─── View ─────────────────────────────────────────────────────────────────

  const editableLists = [...lists, ...sharedLists.filter((l) => l.userRole !== 'viewer')]
  const followed = followedLists.find((l) => l.id === activeListId)
  const visible = ordered(activeListId === 'all' ? items : items.filter((i) => i.lists.some((l) => l.id === activeListId)))
  const newTotal = items.reduce((a, i) => a + (i.new_listings_count ?? 0), 0)
  const empty = !loading && items.length === 0
  const subtitle = loading ? ' ' : empty ? 'Nothing tracked yet' : newTotal ? `${newTotal} new finds` : (
    // Sleepy eye beside "Nothing new today"
    <span className="inline-flex items-center gap-[0.25em]">
      Nothing new today
      <Eye animation="drowse" stroke={15} color="var(--text-muted)" style={{ width: '0.6em', height: '0.6em' }} />
    </span>
  )

  const manage = (list: ItemList, role: ListSheetRole) => () => setManagedList({ list, role })
  const ownActive = lists.find((l) => l.id === activeListId)
  const sharedActive = sharedLists.find((l) => l.id === activeListId && l.userRole === 'admin')
  const activeManage = ownActive ? manage(ownActive, 'owner') : sharedActive ? manage(sharedActive, 'admin') : followed ? manage(followed, 'follower') : null

  const chip = (l: ItemList, role: ListSheetRole | null, variant: 'default' | 'followed' = 'default') => (
    <Chip
      key={l.id}
      label={l.name}
      color={themeOf(l.color)}
      variant={variant}
      active={activeListId === l.id}
      onClick={() => setActiveListId(activeListId === l.id ? 'all' : l.id)}
      onLongPress={role ? manage(l, role) : undefined}
    />
  )

  const addListControl = addingList ? (
    <form onSubmit={submitNewList} className="inline-flex items-center gap-1.5 shrink-0">
      <Input
        aria-label="List name"
        inputSize="sm"
        autoFocus
        placeholder="List name"
        value={newListName}
        wrapperClassName="w-40"
        onChange={(e) => setNewListName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setAddingList(false); setNewListName('') } }}
        onBlur={() => { if (!newListName.trim()) setAddingList(false) }}
      />
      <Button type="submit" size="sm" disabled={!newListName.trim()} onMouseDown={(e) => e.preventDefault()}>Create</Button>
    </form>
  ) : (
    <Chip variant="add" label="Add list" onClick={() => setAddingList(true)} />
  )

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 wide:px-8 pt-1 md:pt-4 pb-32">
      <ScreenBackground color="var(--paper)" />

      <ScreenTitle
        weight="bold"
        size={[34, 64]}
        title="Watchlist"
        subtitle={subtitle}
        subtitleColor="var(--text-muted)"
        className="mt-3 md:mt-6 mb-5 md:mb-8"
      />

      {!empty && (
        // Chip row: All, own lists, shared lists, followed lists, then "+ Add list" (pinned right on mobile)
        <div className="flex items-center gap-2 mb-6 md:mb-8 -mx-4 md:mx-0">
          <div role="group" aria-label="Filter by list" className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto k-noscroll px-4 md:px-0 md:flex-wrap md:overflow-visible">
            <Chip label="All" active={activeListId === 'all'} onClick={() => setActiveListId('all')} />
            {lists.map((l) => chip(l, 'owner'))}
            {sharedLists.map((l) => chip(l, l.userRole === 'admin' ? 'admin' : null))}
            {followedLists.map((l) => chip(l, 'follower', 'followed'))}
            {activeManage && <IconButton icon="more" size="sm" variant="ghost" label="List settings" onClick={activeManage} />}
            {members[activeListId]?.length ? <AvatarStack people={members[activeListId]} size={26} /> : null}
            <span className="max-md:hidden">{addListControl}</span>
          </div>
          <span className="md:hidden pr-4 shrink-0">{addListControl}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 md:grid-cols-5 md:gap-x-3.5 md:gap-y-4" aria-busy="true" aria-label="Loading watchlist">
          {Array.from({ length: desktop ? 10 : 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 animate-pulse">
              <div className="aspect-square rounded-[14px] bg-shade" />
              <div className="h-3 w-1/2 rounded-pill bg-shade" />
              <div className="h-4 w-3/4 rounded-pill bg-shade" />
            </div>
          ))}
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center text-center gap-3 pt-10 md:pt-20 px-4">
          <Eye animation="follow" size={72} className="mb-2" />
          <h2 className="m-0 text-[26px] font-bold tracking-[-0.025em] leading-[1.1]">Track your first item</h2>
          <p className="m-0 max-w-[360px] text-[15px] leading-[1.45] text-muted">Add something you want secondhand. New listings show up here.</p>
          {!desktop && <Button className="mt-3" onClick={() => openAdd()}>+ Add item</Button>}
        </div>
      ) : followed ? (
        <div className="py-14 md:py-20 text-center">
          <p className="m-0 text-[17px] font-semibold">You follow “{followed.name}”.</p>
          <p className="mt-1.5 mb-0 text-[14px] text-muted">Items from lists you follow aren’t shown here yet.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-14 md:py-20 text-center">
          <p className="m-0 text-[17px] font-semibold">No items in this list yet</p>
          <p className="mt-1.5 mb-0 text-[14px] text-muted">Pick this list when you add an item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 md:grid-cols-5 md:gap-x-3.5 md:gap-y-4">
          {visible.map((it) => (
            <ItemTile
              key={it.id}
              item={it}
              className={it.id === dropId ? 'k-drop-in' : undefined}
              placeholder={
                scanning.has(it.id) ? <Eye animation="roll" size={48} />
                  : (it.listing_count ?? 0) === 0 ? <Eye animation="zzz" size={48} />
                    : null
              }
            />
          ))}
        </div>
      )}

      {/* Desktop: fade the last row out above the floating button */}
      {!empty && (
        <div
          aria-hidden="true"
          className="max-md:hidden fixed inset-x-0 bottom-0 h-[120px] pointer-events-none z-20"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--paper))' }}
        />
      )}

      {!loading && (empty
        ? desktop && <AddDock onSubmit={(name) => addItem({ name, brand: null, min_price: null, max_price: null, notify: true, listIds: [] })} />
        : <FloatingButton ref={fabRef} label="Add item" hint="or press /" hidden={addOpen} onClick={() => openAdd()} />)}

      <AddPanel
        open={addOpen}
        lists={editableLists}
        initial={{ name: addName }}
        onSubmit={addItem}
        onClose={closeAdd}
        onCreateList={createList}
      />

      <ListSheet
        list={managedList?.list ?? null}
        role={managedList?.role ?? 'owner'}
        onClose={() => setManagedList(null)}
        onUpdated={listUpdated}
        onDeleted={listDeleted}
        onUnfollow={unfollowList}
      />
    </div>
  )
}
