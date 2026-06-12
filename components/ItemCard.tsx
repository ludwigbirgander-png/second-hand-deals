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
  readOnly?: boolean
}

export function ItemCard({ item, lowestListing, onDelete, onEdit, sectionId, sectionType, readOnly }: Props) {
  const [showEdit, setShowEdit] = useState(false)

  function handleDragStart(e: React.DragEvent) {
    if (readOnly) return
    e.dataTransfer.setData('itemId', item.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const visibleCats = item.categories.filter(
    (cat) => !(sectionType === 'category' && cat.id === sectionId)
  )
  const visibleLists = item.lists.filter(
    (list) => !(sectionType === 'list' && list.id === sectionId)
  )

  return (
    <>
      <div
        draggable={!readOnly}
        onDragStart={handleDragStart}
        className="group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        {/* Image area */}
        <Link href={`/items/${item.id}`} className="relative block aspect-square bg-zinc-100 dark:bg-zinc-800" draggable={false}>
          {lowestListing?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lowestListing.image_url}
              alt={item.name}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl font-semibold text-zinc-300 dark:text-zinc-600 select-none">
                {(item.brand || item.name).charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {(item.new_listings_count ?? 0) > 0 && (
            <span
              className="absolute top-2 left-2 h-5 px-1.5 rounded-full bg-zinc-900/90 text-white dark:bg-white/90 dark:text-zinc-900 text-[10px] font-semibold leading-5 text-center tabular-nums"
              title={`${item.new_listings_count} new listing${item.new_listings_count === 1 ? '' : 's'} since your last visit`}
            >
              {item.new_listings_count} new
            </span>
          )}

          {!readOnly && (
            // Visible on hover, keyboard focus, and always on touch devices
            <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowEdit(true) }}
                className="w-10 h-10 flex items-center justify-center group/edit"
                title="Edit"
                aria-label={`Edit ${item.name}`}
              >
                <span className="w-7 h-7 rounded-lg bg-white/90 dark:bg-zinc-800/90 text-zinc-600 dark:text-zinc-300 group-hover/edit:bg-white dark:group-hover/edit:bg-zinc-700 flex items-center justify-center shadow-sm transition-colors">
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z" />
                  </svg>
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(item.id) }}
                className="w-10 h-10 flex items-center justify-center group/del"
                title="Remove"
                aria-label={`Remove ${item.name}`}
              >
                <span className="w-7 h-7 rounded-lg bg-white/90 dark:bg-zinc-800/90 text-zinc-500 group-hover/del:text-red-500 group-hover/del:bg-white dark:group-hover/del:bg-zinc-700 flex items-center justify-center shadow-sm transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </span>
              </button>
            </div>
          )}
        </Link>

        {/* Info section */}
        <Link href={`/items/${item.id}`} className="block p-3" draggable={false}>
          {item.brand && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{item.brand}</p>
          )}
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate leading-snug">
            {item.name}
          </p>

          {(visibleCats.length > 0 || visibleLists.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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
                  <span key={list.id} className={`text-xs px-1.5 py-px rounded-full font-medium border ${c.text} border-current bg-white dark:bg-transparent`}>
                    {list.name}
                  </span>
                )
              })}
            </div>
          )}

          <div className="mt-2">
            {lowestListing ? (
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {lowestListing.price} {lowestListing.currency}
              </span>
            ) : (
              <span className="text-sm text-zinc-300 dark:text-zinc-600">—</span>
            )}
          </div>
        </Link>
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
