'use client'

import { useState, useEffect } from 'react'
import type { ItemWithMeta, ItemList, Category, ListMember, ListRole } from '@/lib/types'
import { NEW_GROUP_PALETTE } from '@/lib/colors'
import { DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { ScreenBackground } from '@/components/ScreenBackground'
import { WatchlistGroup, type Group } from '@/components/WatchlistGroup'
import { CategorySheet, ListSheet, type ListSheetRole } from '@/components/GroupSheets'
import { ScreenTitle } from '@/components/ui/Display'
import { Segmented, Input } from '@/components/ui/Form'
import { Button } from '@/components/ui/Button'

type View = 'lists' | 'categories' | 'following'
type SharedList = ItemList & { userRole: ListRole }

const VIEWS: { value: View; label: string }[] = [
  { value: 'lists', label: 'Lists' },
  { value: 'categories', label: 'Categories' },
  { value: 'following', label: 'Following' },
]

async function loadWatchlist() {
  const [itemsData, listsData, catsData, followingData] = await Promise.all([
    fetch('/api/items').then((r) => r.json()),
    fetch('/api/lists').then((r) => r.json()),
    fetch('/api/categories').then((r) => r.json()),
    fetch('/api/lists/following').then((r) => r.json()),
  ])
  // lowestListing is computed server-side in /api/items — no per-item fetches
  return {
    items: (Array.isArray(itemsData) ? itemsData : []) as ItemWithMeta[],
    own: (Array.isArray(listsData?.own) ? listsData.own : []) as ItemList[],
    shared: (Array.isArray(listsData?.shared) ? listsData.shared : []) as SharedList[],
    followed: (Array.isArray(followingData) ? followingData : []) as ItemList[],
    categories: (Array.isArray(catsData) ? catsData : []) as Category[],
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

export default function WatchlistPage() {
  const desktop = useMediaQuery(DESKTOP)
  const [items, setItems] = useState<ItemWithMeta[]>([])
  const [lists, setLists] = useState<ItemList[]>([])
  const [sharedLists, setSharedLists] = useState<SharedList[]>([])
  const [followedLists, setFollowedLists] = useState<ItemList[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<Record<string, { name: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('lists')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [managedList, setManagedList] = useState<{ list: ItemList; role: ListSheetRole } | null>(null)
  const [managedCategory, setManagedCategory] = useState<Category | null>(null)

  useEffect(() => {
    let cancelled = false
    loadWatchlist()
      .then((d) => {
        if (cancelled) return
        setItems(d.items)
        setLists(d.own)
        setSharedLists(d.shared)
        setFollowedLists(d.followed)
        setCategories(d.categories)
        setLoading(false)
        return loadMembers([...d.own, ...d.shared])
      })
      .then((m) => { if (m && !cancelled) setMembers(m) })
    return () => { cancelled = true }
  }, [])

  function changeView(v: View) {
    setView(v)
    setExpanded(null)
    setAdding(false)
    setNewName('')
  }

  // ─── List / category mutations ────────────────────────────────────────────

  function listUpdated(updated: ItemList) {
    setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    setSharedLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)))
    setItems((prev) => prev.map((i) => ({ ...i, lists: i.lists.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)) })))
    setManagedList((m) => (m && m.list.id === updated.id ? { ...m, list: { ...m.list, ...updated } } : m))
  }

  function listDeleted(id: string) {
    setLists((prev) => prev.filter((l) => l.id !== id))
    setItems((prev) => prev.map((i) => ({ ...i, lists: i.lists.filter((l) => l.id !== id) })))
  }

  async function unfollowList(id: string) {
    await fetch(`/api/lists/${id}/follow`, { method: 'DELETE' })
    setFollowedLists((prev) => prev.filter((l) => l.id !== id))
  }

  function categoryUpdated(updated: Category) {
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setItems((prev) => prev.map((i) => ({ ...i, categories: i.categories.map((c) => (c.id === updated.id ? updated : c)) })))
  }

  function categoryDeleted(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setItems((prev) => prev.map((i) => ({ ...i, categories: i.categories.filter((c) => c.id !== id) })))
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const isList = view === 'lists'
    const existing = isList ? lists.length : categories.length
    const res = await fetch(isList ? '/api/lists' : '/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: NEW_GROUP_PALETTE[existing % NEW_GROUP_PALETTE.length] }),
    })
    if (!res.ok) return
    const created = await res.json()
    if (isList) setLists((prev) => [...prev, created])
    else setCategories((prev) => [...prev, created])
    setNewName('')
    setAdding(false)
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  const itemsIn = (listId: string) => items.filter((i) => i.lists.some((l) => l.id === listId))
  const emptyHint = 'Pick this list when you add an item'

  const groups: Group[] =
    view === 'lists'
      ? [
          { id: 'all', name: 'All items', color: 'zinc', isDefault: true, items: items.filter((i) => i.lists.length === 0), emptyText: 'No items here yet' },
          ...lists.map((l) => ({
            id: l.id, name: l.name, color: l.color, items: itemsIn(l.id), members: members[l.id], emptyHint,
            onManage: () => setManagedList({ list: l, role: 'owner' }),
          })),
          ...sharedLists.map((l) => ({
            id: l.id, name: l.name, color: l.color, items: itemsIn(l.id), shared: true, members: members[l.id], emptyHint,
            onManage: l.userRole === 'admin' ? () => setManagedList({ list: l, role: 'admin' }) : undefined,
          })),
        ]
      : view === 'categories'
        ? [
            { id: 'none', name: 'Uncategorized', color: 'zinc', isDefault: true, items: items.filter((i) => i.categories.length === 0), emptyText: 'No items here yet' },
            ...categories.map((c) => ({
              id: c.id, name: c.name, color: c.color, emptyHint: 'Pick this category when you add an item',
              items: items.filter((i) => i.categories.some((x) => x.id === c.id)),
              onManage: () => setManagedCategory(c),
            })),
          ]
        : followedLists.map((l) => ({
            id: l.id, name: l.name, color: l.color, items: [], emptyText: 'No items in this list',
            onManage: () => setManagedList({ list: l, role: 'follower' }),
          }))

  const newTotal = items.reduce((a, i) => a + (i.new_listings_count ?? 0), 0)
  const addLabel = view === 'lists' ? '+ New list' : '+ New category'

  const newGroupTile = view !== 'following' && (
    <section className="md:pt-10">
      {adding ? (
        <form onSubmit={createGroup} className="flex flex-col gap-2.5 border border-dashed border-line-dashed rounded-lg md:rounded-xl p-5">
          <Input
            aria-label={view === 'lists' ? 'List name' : 'Category name'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={view === 'lists' ? 'List name' : 'Category name'}
            autoFocus
            onBlur={() => { if (!newName.trim()) setAdding(false) }}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!newName.trim()}>Create</Button>
            <Button variant="secondary" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => { setAdding(false); setNewName('') }}>Cancel</Button>
          </div>
        </form>
      ) : desktop ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full min-h-[150px] border border-dashed border-line-dashed rounded-xl bg-transparent text-[15px] text-muted cursor-pointer hover:text-ink transition-colors"
        >
          {addLabel}
        </button>
      ) : (
        <Button variant="ghost" size="sm" className="!pl-1 text-muted" onClick={() => setAdding(true)}>{addLabel}</Button>
      )}
    </section>
  )

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 md:px-5 wide:px-8 pt-0 md:pt-4 pb-20">
      <ScreenBackground color={desktop ? 'var(--paper-2)' : 'var(--paper)'} />

      <div className="flex flex-col md:flex-row md:flex-wrap md:items-end md:justify-between gap-5 md:gap-6 mt-3.5 mb-[26px] mx-1 md:mx-0 md:mt-6 md:mb-10">
        <ScreenTitle
          weight="bold"
          size={[34, 64]}
          title="Watchlist"
          subtitle={loading ? ' ' : newTotal ? `${newTotal} new finds` : 'Nothing new today'}
          subtitleColor="var(--grey-400)"
        />
        <Segmented options={VIEWS} value={view} onChange={changeView} label="Group by" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-5 gap-y-7" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-7 w-32 rounded-pill bg-shade animate-pulse" />
              <div className="h-[168px] rounded-xl bg-shade animate-pulse" />
            </div>
          ))}
        </div>
      ) : view === 'following' && followedLists.length === 0 ? (
        <div className="py-14 md:py-24 px-3 text-center">
          <p className="m-0 text-[17px] md:text-[22px] tracking-[-0.02em]">You’re not following any lists yet.</p>
          <p className="mt-1.5 md:mt-2 mb-0 text-[13.5px] md:text-[15px] text-muted">When someone shares a public list with you, it will appear here.</p>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-x-5 md:gap-y-7 md:items-start">
          {groups.map((g) => <WatchlistGroup key={g.id} group={g} expandedId={expanded} onExpand={setExpanded} />)}
          {newGroupTile}
        </div>
      )}

      <ListSheet
        list={managedList?.list ?? null}
        role={managedList?.role ?? 'owner'}
        onClose={() => setManagedList(null)}
        onUpdated={listUpdated}
        onDeleted={listDeleted}
        onUnfollow={unfollowList}
      />
      <CategorySheet
        category={managedCategory}
        onClose={() => setManagedCategory(null)}
        onUpdated={categoryUpdated}
        onDeleted={categoryDeleted}
      />
    </div>
  )
}
