'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Listing } from '@/lib/types'
import { CONDITION_COLORS } from '@/lib/colors'
import { IconButton } from './Button'
import { Thumb } from './Thumb'
import { Pill, SiteBadge } from './Pill'
import { Price } from './Price'

// ─── StackCard ────────────────────────────────────────────────────────────────

interface StackCardProps {
  href: string
  label: string
  color: string
  leading?: ReactNode
  badge?: ReactNode
  eyebrow?: string | null
  title: string
  value?: ReactNode
  /** Mobile only: tapping expands the card to show this instead of navigating */
  expanded?: boolean
  onToggle?: () => void
  details?: ReactNode
}

/**
 * Full-color rounded card for a watched item. From md up the whole card links to the item;
 * on mobile a tap expands it to reveal `details`.
 */
export function StackCard({ href, label, color, leading, badge, eyebrow, title, value, expanded = false, onToggle, details }: StackCardProps) {
  return (
    <div
      className="relative flex flex-col min-h-[150px] md:min-h-[168px] rounded-xl px-5 pt-4 pb-5 box-border text-ink origin-top transition-transform duration-[var(--dur-fast)] ease-out has-[.k-hit:active]:scale-[.985] has-[.k-hit:focus-visible]:outline-2 has-[.k-hit:focus-visible]:outline-offset-2 has-[.k-hit:focus-visible]:outline-ink"
      style={{ background: color }}
    >
      <Link href={href} aria-label={label} className="k-hit absolute inset-0 rounded-xl outline-none max-md:hidden" />
      <button
        type="button"
        aria-label={label}
        aria-expanded={expanded}
        onClick={onToggle}
        className="k-hit absolute inset-0 rounded-xl outline-none cursor-pointer md:hidden"
      />
      <div className="flex items-start justify-between gap-3 pointer-events-none">
        {leading ?? <span />}
        {badge}
      </div>
      <div className="flex-1 min-h-4" />
      {eyebrow && <div className="text-[13px] text-on-color-muted mb-0.5 pointer-events-none">{eyebrow}</div>}
      <div className="flex items-baseline justify-between gap-3 pointer-events-none">
        <div className="text-[22px] tracking-[-0.022em] leading-[1.12] min-w-0 truncate">{title}</div>
        {value && <div className="shrink-0">{value}</div>}
      </div>
      {details && (
        <div className="md:hidden grid transition-[grid-template-rows] duration-[var(--dur-slow)] ease-out" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
          <div className="overflow-hidden min-h-0">
            <div className="relative z-10 pt-5" inert={!expanded}>{details}</div>
          </div>
        </div>
      )}
    </div>
  )
}

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
}

/** Chalk listing tile: photo with star + site badge, title, condition, price. Starred adds a 2px ink ring. */
export function ListingCard({ listing: l, starred, onStar }: ListingCardProps) {
  const auction = useAuctionCountdown(l.auction_ends_at)
  return (
    <div className={`relative flex flex-col min-w-0 bg-chalk rounded-[24px] p-1.5 ${starred ? 'shadow-[inset_0_0_0_2px_var(--ink)]' : ''}`}>
      <a
        href={l.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col flex-1 text-ink no-underline rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <div className="relative">
          <Thumb src={l.image_url} alt={l.title} />
          <SiteBadge site={l.site} className="absolute left-2 bottom-2" />
        </div>
        <div className="flex flex-col flex-1 gap-1.5 px-2 pt-2.5 pb-2">
          <div className="text-[14.5px] leading-[1.3] tracking-[-0.01em] line-clamp-2">{l.title}</div>
          {(l.condition || l.size || l.location) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              {l.condition && <Pill variant="solid" size="sm" color={CONDITION_COLORS[l.condition] ?? 'var(--paper-2)'}>{l.condition}</Pill>}
              {l.size && <span>{l.size}</span>}
              {l.location && <span>{l.location}</span>}
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-end justify-between gap-1.5">
            <div>
              <Price value={l.price} size="title" />
              {l.shipping_cost != null && (
                <div className="text-[12px] text-muted mt-0.5">{l.shipping_cost === 0 ? 'Free shipping' : `+${l.shipping_cost} kr shipping`}</div>
              )}
            </div>
            {auction && (
              <span className={`text-[12px] tabular-nums text-right ${auction.urgent ? 'text-signal-deep font-medium' : 'text-muted'}`}>{auction.text}</span>
            )}
          </div>
        </div>
      </a>
      <IconButton
        icon="star"
        size="sm"
        filled={starred}
        variant={starred ? 'ink' : 'chalk'}
        label={starred ? 'Unstar listing' : 'Star listing'}
        aria-pressed={starred}
        onClick={onStar}
        // 32px visual chip, 44px hit area
        className="absolute top-3 right-3 before:content-[''] before:absolute before:-inset-1.5"
      />
    </div>
  )
}
