'use client'

import { useState } from 'react'
import { ItemCard } from './ItemCard'
import type { ItemWithMeta } from '@/lib/types'
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
  isDefault?: boolean
  sectionId?: string
  sectionType?: 'list' | 'category'
}

export function WatchlistSection({ title, color = 'zinc', items, onDrop, onDeleteItem, onDelete, onRename, onEditItem, isDefault, sectionId, sectionType }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(title)

  const c = COLOR_MAP[color] ?? COLOR_MAP.zinc

  function handleDragOver(e: React.DragEvent) {
    if (isDefault) return
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    if (isDefault) return
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
            className="text-xs font-medium uppercase tracking-wide outline-none bg-transparent border-b border-zinc-400"
          />
        ) : (
          <h2
            className={`text-xs font-medium uppercase tracking-wide text-zinc-400 ${!isDefault ? 'cursor-pointer hover:text-zinc-600 transition-colors' : ''}`}
            onDoubleClick={() => !isDefault && setEditing(true)}
          >
            {title}
          </h2>
        )}

        <span className="text-xs text-zinc-300 tabular-nums">{items.length}</span>

        {!isDefault && !editing && (
          <>
            <button
              onClick={() => { setEditName(title); setEditing(true) }}
              className="text-zinc-300 hover:text-zinc-500 transition-colors p-0.5 rounded"
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
                className="text-zinc-300 hover:text-red-400 transition-colors p-0.5 rounded"
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

        <div className="flex-1 h-px bg-zinc-100 ml-1" />
      </div>

      {items.length === 0 ? (
        <div
          className={`rounded-lg border border-dashed py-5 text-center text-sm transition-colors ${
            dragOver ? 'border-zinc-400 text-zinc-500' : 'border-zinc-200 text-zinc-400'
          }`}
        >
          {isDefault ? 'No items here yet' : 'Drop items here to add them'}
        </div>
      ) : (
        <div className={`divide-y divide-zinc-100 rounded-lg transition-all ${dragOver ? 'ring-2 ring-zinc-200 ring-offset-1' : ''}`}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} lowestListing={item.lowestListing} onDelete={onDeleteItem} onEdit={onEditItem} sectionId={sectionId} sectionType={sectionType} />
          ))}
        </div>
      )}
    </div>
  )
}
