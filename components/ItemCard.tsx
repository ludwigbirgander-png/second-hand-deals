'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ItemWithMeta, Listing } from '@/lib/types'
import { COLOR_MAP } from '@/lib/colors'
import { EditItemModal } from './EditItemModal'

interface Props {
  item: ItemWithMeta
  lowestListing?: Listing | null
  onDelete: (id: string) => void
  onEdit: () => void
  sectionId?: string
  sectionType?: 'list' | 'category'
}

export function ItemCard({ item, lowestListing, onDelete, onEdit, sectionId, sectionType }: Props) {
  const [showEdit, setShowEdit] = useState(false)

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('itemId', item.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        className="group flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors cursor-grab active:cursor-grabbing select-none"
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -ml-1">
          <svg className="w-3 h-4 text-zinc-300" viewBox="0 0 6 14" fill="currentColor">
            <circle cx="1.5" cy="2" r="1" />
            <circle cx="4.5" cy="2" r="1" />
            <circle cx="1.5" cy="7" r="1" />
            <circle cx="4.5" cy="7" r="1" />
            <circle cx="1.5" cy="12" r="1" />
            <circle cx="4.5" cy="12" r="1" />
          </svg>
        </div>

        <div className="w-9 h-9 rounded-md bg-zinc-100 shrink-0 overflow-hidden">
          {lowestListing?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lowestListing.image_url} alt={item.name} className="w-full h-full object-cover" />
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/items/${item.id}`}
            className="text-sm font-medium text-zinc-900 hover:underline truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {item.brand ? (
              <><span className="text-zinc-400 font-normal">{item.brand} </span>{item.name}</>
            ) : item.name}
          </Link>

          {(() => {
            const visibleCats = item.categories.filter(
              (cat) => !(sectionType === 'category' && cat.id === sectionId)
            )
            const visibleLists = item.lists.filter(
              (list) => !(sectionType === 'list' && list.id === sectionId)
            )
            if (visibleCats.length === 0 && visibleLists.length === 0) return null
            return (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {visibleCats.map((cat) => {
                  const c = COLOR_MAP[cat.color] ?? COLOR_MAP.zinc
                  return (
                    <span key={cat.id} className={`text-xs px-1.5 py-px rounded-full font-medium ${c.bg} ${c.text}`}>
                      {cat.name}
                    </span>
                  )
                })}
                {visibleLists.map((list) => {
                  const c = COLOR_MAP[list.color] ?? COLOR_MAP.zinc
                  return (
                    <span key={list.id} className={`text-xs px-1.5 py-px rounded-full font-medium border ${c.text} border-current bg-white`}>
                      {list.name}
                    </span>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {lowestListing ? (
          <span className="text-sm font-semibold text-zinc-900 tabular-nums shrink-0">
            {lowestListing.price} {lowestListing.currency}
          </span>
        ) : (
          <span className="text-sm text-zinc-300 shrink-0">—</span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); setShowEdit(true) }}
          className="shrink-0 text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all p-1 rounded"
          title="Edit"
          aria-label={`Edit ${item.name}`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" />
          </svg>
        </button>

        <button
          onClick={() => onDelete(item.id)}
          className="shrink-0 text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all p-1 rounded"
          title="Remove"
          aria-label={`Remove ${item.name}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {showEdit && (
        <EditItemModal
          item={item}
          onClose={() => setShowEdit(false)}
          onSaved={() => { onEdit(); setShowEdit(false) }}
        />
      )}
    </>
  )
}
