'use client'

import { useState } from 'react'
import { ItemCard } from './ItemCard'
import { ListSettingsModal } from './ListSettingsModal'
import type { ItemWithMeta, ItemList } from '@/lib/types'
import { COLOR_MAP } from '@/lib/colors'

interface Props {
  title: string
  color?: string
  items: ItemWithMeta[]
  onDrop: (itemId: string) => void
  onDeleteItem: (id: string) => void
  onDelete?: () => void
  onRename?: (name: string) => void
  onEditItem: () => void
  onListUpdated?: (updated: ItemList) => void
  isDefault?: boolean
  sectionId?: string
  sectionType?: 'list' | 'category'
  list?: ItemList
  userRole?: 'owner' | 'admin' | 'editor' | 'viewer' | 'follower'
}

export function WatchlistSection({
  title, color = 'zinc', items, onDrop, onDeleteItem, onDelete, onRename,
  onEditItem, onListUpdated, isDefault, sectionId, sectionType, list, userRole,
}: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(title)
  const [showSettings, setShowSettings] = useState(false)

  const c = COLOR_MAP[color] ?? COLOR_MAP.zinc
  const isReadOnly = userRole === 'viewer' || userRole === 'follower'
  const canManage = !isDefault && !isReadOnly
  const canSettings = sectionType === 'list' && list && (userRole === 'owner' || userRole === 'admin' || !userRole)

  function handleDragOver(e: React.DragEvent) {
    if (isDefault || isReadOnly) return
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (isDefault || isReadOnly) return
    e.preventDefault()
    setDragOver(false)
    const itemId = e.dataTransfer.getData('itemId')
    if (itemId) onDrop(itemId)
  }

  function commitRename() {
    if (editName.trim() && editName.trim() !== title) onRename?.(editName.trim())
    setEditing(false)
  }

  return (
    <>
      <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <div className="flex items-center gap-2 mb-1">
          {!isDefault && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
          )}

          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setEditName(title); setEditing(false) }
              }}
              className="text-xs font-medium uppercase tracking-wide outline-none bg-transparent border-b border-zinc-400 dark:border-zinc-500"
            />
          ) : (
            <h2
              className={`text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${canManage ? 'cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors' : ''}`}
              onDoubleClick={() => canManage && setEditing(true)}
            >
              {title}
            </h2>
          )}

          <span className="text-xs text-zinc-300 dark:text-zinc-600 tabular-nums">{items.length}</span>

          {userRole === 'follower' && (
            <span className="text-xs text-zinc-300 dark:text-zinc-600 italic">following</span>
          )}

          {canManage && !editing && (
            <>
              <button
                onClick={() => { setEditName(title); setEditing(true) }}
                className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors p-0.5 rounded"
                title="Rename"
                aria-label={`Rename ${title}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" />
                </svg>
              </button>
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors p-0.5 rounded"
                  title="Delete"
                  aria-label={`Delete ${title}`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </>
          )}

          {canSettings && !editing && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors p-0.5 rounded"
              title="List settings"
              aria-label={`Settings for ${title}`}
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="2" />
                <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.9 3.9l.7.7M11.4 11.4l.7.7M3.9 12.1l.7-.7M11.4 4.6l.7-.7" />
              </svg>
            </button>
          )}

          <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800 ml-1" />
        </div>

        {items.length === 0 ? (
          <div
            className={`rounded-lg border border-dashed py-5 text-center text-sm transition-colors ${
              dragOver ? 'border-zinc-400 dark:border-zinc-500 text-zinc-500 dark:text-zinc-400' : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
            }`}
          >
            {isDefault ? 'No items here yet' : isReadOnly ? 'No items in this list' : 'Drop items here to add them'}
          </div>
        ) : (
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 transition-all ${dragOver ? 'ring-2 ring-zinc-200 dark:ring-zinc-700 ring-offset-2 rounded-xl p-1' : ''}`}>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                lowestListing={item.lowestListing}
                onDelete={onDeleteItem}
                onEdit={onEditItem}
                sectionId={sectionId}
                sectionType={sectionType}
                readOnly={isReadOnly}
              />
            ))}
          </div>
        )}
      </div>

      {showSettings && list && (
        <ListSettingsModal
          list={list}
          onClose={() => setShowSettings(false)}
          onUpdated={(updated) => {
            onListUpdated?.(updated)
            setShowSettings(false)
          }}
        />
      )}
    </>
  )
}
