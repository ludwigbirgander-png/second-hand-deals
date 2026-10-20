// Which alerts to send. Pure functions over database rows, so they can be tested without a database.

export type AlertKind = 'target_price' | 'price_drop' | 'auction_ending' | 'rare_find'

export interface AlertItem {
  id: string
  user_id: string
  name: string
  brand: string | null
  notify: boolean
  min_price: number | null
  target_price: number | null
  created_at: string
}

export interface AlertListing {
  id: string
  item_id: string
  site: string
  title: string
  price: number | null
  previous_price: number | null
  currency: string
  url: string
  image_url: string | null
  price_kind: 'fixed' | 'bid' | 'start' | null
  bid_count: number | null
  auction_ends_at: string | null
  starred: boolean
  match: 'match' | 'possible'
  removed_at: string | null
  found_at: string
}

/** A row from alert_log */
export interface SentAlert {
  listing_id: string
  kind: AlertKind
  price: number | null
}

export interface Alert {
  kind: AlertKind
  item: AlertItem
  listing: AlertListing
  /** For price drops: the price before the drop */
  oldPrice?: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** How far ahead "auction ending soon" looks; matches the 3-hourly schedule */
export const AUCTION_WINDOW_MS = 3 * HOUR
/** An item counts as quiet after this long without a new real match */
export const QUIET_MS = 7 * DAY
/** Listings found this close together count as one find (one scrape run) */
const SAME_RUN_MS = HOUR
/** How old a find can be and still trigger a rare-find alert */
const RARE_FIND_LOOKBACK_MS = DAY

const time = (iso: string) => new Date(iso).getTime()

function ended(l: AlertListing, now: number) {
  return l.auction_ends_at != null && time(l.auction_ends_at) <= now
}

/** Not removed, a real match, and not an auction that has ended */
export function isLive(l: AlertListing, now: number) {
  return !l.removed_at && l.match === 'match' && !ended(l, now)
}

/** Auction prices are bids that still rise, so price alerts only use fixed (or unknown) prices */
function fixedPrice(l: AlertListing) {
  return l.price != null && l.price_kind !== 'bid' && l.price_kind !== 'start'
}

/** True if an alert of this kind was already sent for the listing at this price or lower */
function alreadySent(sent: SentAlert[], listingId: string, kind: AlertKind, price: number | null) {
  return sent.some((s) =>
    s.listing_id === listingId && s.kind === kind &&
    (price == null || s.price == null || s.price <= price))
}

/** Real matches at or under the item's target price */
export function targetPriceAlerts(item: AlertItem, listings: AlertListing[], sent: SentAlert[], now: number): Alert[] {
  const target = item.target_price
  if (target == null) return []
  return listings
    .filter((l) =>
      l.item_id === item.id && isLive(l, now) && fixedPrice(l) &&
      l.price! <= target &&
      (item.min_price == null || l.price! >= item.min_price) &&
      !alreadySent(sent, l.id, 'target_price', l.price))
    .map((listing) => ({ kind: 'target_price', item, listing }))
}

/** Favourites whose price fell since the last check */
export function priceDropAlerts(item: AlertItem, listings: AlertListing[], sent: SentAlert[], now: number): Alert[] {
  return listings
    .filter((l) =>
      l.item_id === item.id && l.starred && !l.removed_at && !ended(l, now) && fixedPrice(l) &&
      l.previous_price != null && l.price! < l.previous_price &&
      !alreadySent(sent, l.id, 'price_drop', l.price))
    .map((listing) => ({ kind: 'price_drop', item, listing, oldPrice: listing.previous_price! }))
}

/** Favourited auctions that end within the next 3 hours; one reminder each */
export function auctionEndingAlerts(item: AlertItem, listings: AlertListing[], sent: SentAlert[], now: number): Alert[] {
  return listings
    .filter((l) => {
      if (l.item_id !== item.id || !l.starred || l.removed_at || !l.auction_ends_at) return false
      const ends = time(l.auction_ends_at)
      return ends > now && ends <= now + AUCTION_WINDOW_MS &&
        !sent.some((s) => s.listing_id === l.id && s.kind === 'auction_ending')
    })
    .map((listing) => ({ kind: 'auction_ending', item, listing }))
}

/**
 * New real matches for an item that had none for 7 days or more.
 * Listings from the same scrape run count as one find, so they alert together.
 */
export function rareFindAlerts(item: AlertItem, listings: AlertListing[], sent: SentAlert[], now: number): Alert[] {
  if (!item.notify) return []
  const real = listings.filter((l) => l.item_id === item.id && !l.removed_at && l.match === 'match')
  return real
    .filter((c) => {
      const found = time(c.found_at)
      if (found < now - RARE_FIND_LOOKBACK_MS || ended(c, now)) return false
      // A brand-new item's first results aren't rare
      if (time(item.created_at) > found - QUIET_MS) return false
      const quiet = !real.some((o) => {
        const t = time(o.found_at)
        return o.id !== c.id && t >= found - QUIET_MS && t < found - SAME_RUN_MS
      })
      return quiet && !sent.some((s) => s.listing_id === c.id && s.kind === 'rare_find')
    })
    .map((listing) => ({ kind: 'rare_find', item, listing }))
}

/** Every alert due for one item */
export function alertsForItem(item: AlertItem, listings: AlertListing[], sent: SentAlert[], now: number): Alert[] {
  return [
    ...targetPriceAlerts(item, listings, sent, now),
    ...priceDropAlerts(item, listings, sent, now),
    ...auctionEndingAlerts(item, listings, sent, now),
    ...rareFindAlerts(item, listings, sent, now),
  ]
}
