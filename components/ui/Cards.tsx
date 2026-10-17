'use client'

import { useEffect, useState } from 'react'
import type { Listing } from '@/lib/types'
import { CONDITION_COLORS } from '@/lib/colors'
import { priceNote } from '@/lib/auction'
import { IconButton } from './Button'
import { Pill, SiteBadge } from './Pill'
import { Badge } from './Badge'
import { Price } from './Price'

// ─── ListingCard ──────────────────────────────────────────────────────────────

function useAuctionCountdown(endsAt: string | null) {
  const [state, setState] = useState<{ text: string; urgent: boolean } | null>(null)
  useEffect(() => {
    if (!endsAt) return
    function update() {
      const diff = new Date(endsAt!).getTime() - Date.now()
      if (diff <= 0) return setState({ text: 'Ended', urgent: false })
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      if (h < 24) setState({ text: h > 0 ? `Ends in ${h}h ${m}m` : `Ends in ${m}m`, urgent: h < 2 })
      else setState({ text: `Ends ${new Date(endsAt!).toLocaleDateString('sv-SE')}`, urgent: false })
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [endsAt])
  return state
}

interface ListingCardProps {
  listing: Listing
  starred: boolean
  onStar: () => void
  /** Hide the listing; Kompi remembers it so it doesn't come back */
  onRemove?: () => void
  /** Found since the user's last visit */
  isNew?: boolean
}

/**
 * Chalk listing card: photo (with "New" and a remove ×), price + favourite star, bid note,
 * title, site, then condition/shipping/auction. A favourite adds an ink ring; an ended
 * auction fades its photo.
 */
export function ListingCard({ listing: l, starred, onStar, onRemove, isNew = false }: ListingCardProps) {
  const auction = useAuctionCountdown(l.auction_ends_at)
  const ended = auction?.text === 'Ended'
  const note = ended ? null : priceNote(l)
  return (
    <div className={`relative flex flex-col gap-2 min-w-0 p-2 pb-3 rounded-lg bg-chalk ${starred ? 'shadow-[inset_0_0_0_2px_var(--ink)]' : ''}`}>
      <a
        href={l.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`k-press relative block aspect-square rounded-md overflow-hidden bg-paper-2 ${ended ? 'opacity-55' : ''}`}
        style={l.image_url ? undefined : { backgroundImage: 'var(--pattern-hatch)' }}
      >
        {l.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image_url} alt={l.title} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {isNew && <Badge size="sm" className="absolute top-2 left-2">New</Badge>}
      </a>
      {onRemove && (
        <IconButton
          icon="x"
          size="sm"
          label="Remove listing"
          onClick={onRemove}
          // Sits on the photo, outside the link; 28px visual, 44px hit area
          className="!absolute top-3.5 right-3.5 !w-7 !h-7 !bg-veil before:content-[''] before:absolute before:-inset-2"
        />
      )}
      <div className="flex flex-col gap-1 px-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <Price value={l.price} size="md" />
          <IconButton
            icon="star"
            size="sm"
            variant="star"
            filled={starred}
            label={starred ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={starred}
            onClick={onStar}
            // 28px visual, 44px hit area
            className="!w-7 !h-7 relative before:content-[''] before:absolute before:-inset-2"
          />
        </div>
        {note && <div className="-mt-1 text-[12px] text-muted">{note}</div>}
        <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[13px] leading-[1.3] text-ink-2 line-clamp-2 no-underline hover:underline">
          {l.title}
        </a>
        <SiteBadge site={l.site} />
        {(l.condition || l.size || l.location || l.shipping_cost != null || auction) && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5 text-[12px] text-muted">
            {l.condition && <Pill variant="solid" size="sm" color={CONDITION_COLORS[l.condition] ?? 'var(--paper-2)'}>{l.condition}</Pill>}
            {l.size && <span>{l.size}</span>}
            {l.location && <span>{l.location}</span>}
            {l.shipping_cost != null && <span>{l.shipping_cost === 0 ? 'Free shipping' : `+${l.shipping_cost} kr shipping`}</span>}
            {auction && <span className={`tabular-nums ${auction.urgent ? 'text-state-danger font-semibold' : ''}`}>{auction.text}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
