'use client'

import { useState, useEffect, useCallback } from 'react'
import { AddItemModal } from '@/components/AddItemModal'
import { WatchlistSection } from '@/components/WatchlistSection'
import type { ItemWithMeta, ItemList, Category } from '@/lib/types'

export default function WatchlistPage() {
  const [items, setItems] = useState<ItemWithMeta[]>([])
  const [lists, setLists] = useState<ItemList[]>([])
  const [sharedLists, setSharedLists] = useState<(ItemList & { userRole: string })[]>([])
  const [followedLists, setFollowedLists] = useState<ItemList[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [view, setView] = useState<'lists' | 'categories' | 'following'>('lists')
  const [newListInput, setNewListInput] = useState('')
  const [showNewList, setShowNewList] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const fetchAll = useCallback(async () => {
    const [itemsRes, listsRes, catsRes, followingRes] = await Promise.all([
      fetch('/api/items'),
      fetch('/api/lists'),
      fetch('/api/categories'),
      fetch('/api/lists/following'),
    ])
    const [itemsData, listsData, catsData, followingData] = await Promise.all([
      itemsRes.json(),
      listsRes.json(),
      catsRes.json(),
      followingRes.json(),
    ])

    // lowestListing is computed server-side in /api/items — no per-item fetches
    const baseItems: ItemWithMeta[] = Array.isArray(itemsData) ? itemsData : []

    setItems(baseItems)
    setLists(Array.isArray(listsData?.own) ? listsData.own : [])
    setSharedLists(Array.isArray(listsData?.shared) ? listsData.shared : [])
    setFollowedLists(Array.isArray(followingData) ? followingData : [])
    setCategories(Array.isArray(catsData) ? catsData : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function deleteItem(id: string) {
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleDrop(itemId: string, targetId: string, type: 'list' | 'category') {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    const listIds = item.lists.map((l) => l.id)
    const categoryIds = item.categories.map((c) => c.id)

    if (type === 'list') {
      if (listIds.includes(targetId)) return
      const newListIds = [...listIds, targetId]
      await fetch(`/api/items/${itemId}/associations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds: newListIds, categoryIds }),
      })
      const list = lists.find((l) => l.id === targetId) ?? sharedLists.find((l) => l.id === targetId)
      if (list) setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, lists: [...i.lists, list] } : i))
    } else {
      if (categoryIds.includes(targetId)) return
      const newCategoryIds = [...categoryIds, targetId]
      await fetch(`/api/items/${itemId}/associations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listIds, categoryIds: newCategoryIds }),
      })
      const cat = categories.find((c) => c.id === targetId)
      if (cat) setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, categories: [...i.categories, cat] } : i))
    }
  }

  async function deleteList(id: string) {
    await fetch(`/api/lists/${id}`, { method: 'DELETE' })
    setLists((prev) => prev.filter((l) => l.id !== id))
    setItems((prev) => prev.map((i) => ({ ...i, lists: i.lists.filter((l) => l.id !== id) })))
  }

  async function renameList(id: string, name: string) {
    await fetch(`/api/lists/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setLists((prev) => prev.map((l) => l.id === id ? { ...l, name } : l))
    setItems((prev) => prev.map((i) => ({ ...i, lists: i.lists.map((l) => l.id === id ? { ...l, name } : l) })))
  }

  function handleListUpdated(updated: ItemList) {
    setLists((prev) => prev.map((l) => l.id === updated.id ? updated : l))
  }

  async function unfollowList(id: string) {
    await fetch(`/api/lists/${id}/follow`, { method: 'DELETE' })
    setFollowedLists((prev) => prev.filter((l) => l.id !== id))
  }

  async function deleteCategory(id: string) {
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setItems((prev) => prev.map((i) => ({ ...i, categories: i.categories.filter((c) => c.id !== id) })))
  }

  async function renameCategory(id: string, name: string) {
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name } : c))
    setItems((prev) => prev.map((i) => ({ ...i, categories: i.categories.map((c) => c.id === id ? { ...c, name } : c) })))
  }

  async function addList() {
    if (!newListInput.trim()) return
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListInput.trim(), color: 'zinc' }),
    })
    const list = await res.json()
    setLists((prev) => [...prev, list])
    setNewListInput('')
    setShowNewList(false)
  }

  async function addCategory() {
    if (!newCatInput.trim()) return
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatInput.trim(), color: 'zinc' }),
    })
    const cat = await res.json()
    setCategories((prev) => [...prev, cat])
    setNewCatInput('')
    setShowNewCat(false)
  }

  const unassignedItems = items.filter((i) => i.lists.length === 0)
  const uncategorizedItems = items.filter((i) => i.categories.length === 0)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 rounded-xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        <div className="h-32 rounded-2xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        <div className="h-32 rounded-2xl bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold flex-1">Watchlist</h1>

        <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-700 p-0.5 text-sm">
          <button
            onClick={() => setView('lists')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${view === 'lists' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            Lists
          </button>
          <button
            onClick={() => setView('categories')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${view === 'categories' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            Categories
          </button>
          <button
            onClick={() => setView('following')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${view === 'following' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
          >
            Following
          </button>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          + Add item
        </button>
      </div>

      {items.length === 0 && view !== 'following' && (
        <div className="py-16 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Your watchlist is empty.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Add your first item
          </button>
        </div>
      )}

      <div className="space-y-6">
        {view === 'lists' && (
          <>
            <WatchlistSection
              title="All items"
              items={unassignedItems}
              onDrop={() => {}}
              onDeleteItem={deleteItem}
              onEditItem={fetchAll}
              isDefault
            />
            {lists.map((list) => (
              <WatchlistSection
                key={list.id}
                title={list.name}
                color={list.color}
                items={items.filter((i) => i.lists.some((l) => l.id === list.id))}
                onDrop={(itemId) => handleDrop(itemId, list.id, 'list')}
                onDeleteItem={deleteItem}
                onDelete={() => deleteList(list.id)}
                onRename={(name) => renameList(list.id, name)}
                onEditItem={fetchAll}
                onListUpdated={handleListUpdated}
                sectionId={list.id}
                sectionType="list"
                list={list}
                userRole="owner"
              />
            ))}

            {sharedLists.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-300 dark:text-zinc-600">Shared with me</span>
                  <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                </div>
                {sharedLists.map((list) => (
                  <WatchlistSection
                    key={list.id}
                    title={list.name}
                    color={list.color}
                    items={items.filter((i) => i.lists.some((l) => l.id === list.id))}
                    onDrop={(itemId) => handleDrop(itemId, list.id, 'list')}
                    onDeleteItem={deleteItem}
                    onEditItem={fetchAll}
                    sectionId={list.id}
                    sectionType="list"
                    list={list}
                    userRole={list.userRole as any}
                  />
                ))}
              </>
            )}

            {showNewList ? (
              <form onSubmit={(e) => { e.preventDefault(); addList() }} className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newListInput}
                  onChange={(e) => setNewListInput(e.target.value)}
                  onBlur={() => { if (!newListInput.trim()) setShowNewList(false) }}
                  placeholder="List name"
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400 bg-transparent"
                />
                <button type="submit" disabled={!newListInput.trim()} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm disabled:opacity-40">
                  Create
                </button>
                <button type="button" onClick={() => setShowNewList(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400">
                  Cancel
                </button>
              </form>
            ) : (
              <button onClick={() => setShowNewList(true)} className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-1">
                + New list
              </button>
            )}
          </>
        )}

        {view === 'categories' && (
          <>
            <WatchlistSection
              title="Uncategorized"
              items={uncategorizedItems}
              onDrop={() => {}}
              onDeleteItem={deleteItem}
              onEditItem={fetchAll}
              isDefault
            />
            {categories.map((cat) => (
              <WatchlistSection
                key={cat.id}
                title={cat.name}
                color={cat.color}
                items={items.filter((i) => i.categories.some((c) => c.id === cat.id))}
                onDrop={(itemId) => handleDrop(itemId, cat.id, 'category')}
                onDeleteItem={deleteItem}
                onDelete={() => deleteCategory(cat.id)}
                onRename={(name) => renameCategory(cat.id, name)}
                onEditItem={fetchAll}
                sectionId={cat.id}
                sectionType="category"
              />
            ))}

            {showNewCat ? (
              <form onSubmit={(e) => { e.preventDefault(); addCategory() }} className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  onBlur={() => { if (!newCatInput.trim()) setShowNewCat(false) }}
                  placeholder="Category name"
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-400 bg-transparent"
                />
                <button type="submit" disabled={!newCatInput.trim()} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm disabled:opacity-40">
                  Create
                </button>
                <button type="button" onClick={() => setShowNewCat(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400">
                  Cancel
                </button>
              </form>
            ) : (
              <button onClick={() => setShowNewCat(true)} className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-1">
                + New category
              </button>
            )}
          </>
        )}

        {view === 'following' && (
          <>
            {followedLists.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">You&apos;re not following any lists yet.</p>
                <p className="mt-1 text-xs text-zinc-300 dark:text-zinc-600">When someone shares a public list with you, it will appear here.</p>
              </div>
            )}
            {followedLists.map((list) => (
              <WatchlistSection
                key={list.id}
                title={list.name}
                color={list.color}
                items={[]}
                onDrop={() => {}}
                onDeleteItem={() => {}}
                onEditItem={() => {}}
                onDelete={() => unfollowList(list.id)}
                sectionId={list.id}
                sectionType="list"
                list={list}
                userRole="follower"
              />
            ))}
          </>
        )}
      </div>

      {modalOpen && (
        <AddItemModal
          categories={categories}
          lists={lists}
          onClose={() => setModalOpen(false)}
          onCreated={fetchAll}
          onNewCategory={(cat) => setCategories((prev) => [...prev, cat])}
          onNewList={(list) => setLists((prev) => [...prev, list])}
        />
      )}
    </div>
  )
}
