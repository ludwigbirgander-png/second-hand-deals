import type { Listing } from './types'

/** An auction whose end time has passed. Listings without an end time never end. */
export function isEnded(l: Pick<Listing, 'auction_ends_at'>, now: number): boolean {
  return l.auction_ends_at != null && new Date(l.auction_ends_at).getTime() <= now
}

/** "Current bid · 3 bids", "Starting price", or null for a fixed price. */
export function priceNote(l: Pick<Listing, 'price_kind' | 'bid_count'>): string | null {
  if (l.price_kind === 'start') return 'Starting price'
  if (l.price_kind !== 'bid') return null
  if (l.bid_count == null) return 'Current bid'
  return `Current bid · ${l.bid_count} bid${l.bid_count !== 1 ? 's' : ''}`
}
