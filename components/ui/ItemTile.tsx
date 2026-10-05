import Link from 'next/link'
import type { ItemWithMeta } from '@/lib/types'
import { themeFor } from '@/lib/colors'
import { Badge } from './Badge'
import type { ReactNode } from 'react'

interface Props {
  item: ItemWithMeta
  /** Shown centred on the photo placeholder when there is no image (e.g. the eye) */
  placeholder?: ReactNode
  className?: string
}

/**
 * Watchlist tile, option D "Photo + text below": the photo of the cheapest listing is the
 * card; the list dot, brand, name and listing count sit underneath on the page.
 */
export function ItemTile({ item, placeholder, className }: Props) {
  const image = item.lowestListing?.image_url
  const newCount = item.new_listings_count ?? 0
  const total = item.listing_count ?? 0
  return (
    <Link
      href={`/items/${item.id}`}
      className={`k-press flex flex-col gap-2 min-w-0 rounded-[14px] text-ink no-underline ${className ?? ''}`}
    >
      <span
        className="relative block aspect-square rounded-[14px] overflow-hidden bg-paper-2"
        style={image ? undefined : { backgroundImage: 'var(--pattern-hatch)' }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : (
          placeholder && <span className="absolute inset-0 flex items-center justify-center">{placeholder}</span>
        )}
        {newCount > 0 && (
          <Badge size="sm" className="absolute top-2 left-2" title={`${newCount} new listing${newCount === 1 ? '' : 's'} since your last visit`}>
            {newCount} new
          </Badge>
        )}
      </span>
      <span className="block px-0.5 min-w-0">
        <span className="flex items-center gap-1.5 text-[12px] font-medium leading-tight text-muted min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: themeFor(item)[0] }} />
          {item.brand && <span className="truncate">{item.brand}</span>}
        </span>
        <span className="block mt-0.5 text-[16px] font-semibold leading-[1.2] truncate">{item.name}</span>
        <span className="block mt-0.5 text-[13px] font-medium tabular-nums">
          {total} listing{total === 1 ? '' : 's'}
        </span>
      </span>
    </Link>
  )
}
