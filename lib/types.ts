export interface Item {
  id: string
  user_id: string
  name: string
  brand: string | null
  min_price: number | null
  max_price: number | null
  notify: boolean
  /** "Alert me when one is under X kr"; checked every 3 hours */
  target_price?: number | null
  /** Words that hide a listing; added from the prompt after removing one */
  exclude_words?: string[]
  created_at: string
}

export interface ItemList {
  id: string
  name: string
  color: string
  visibility: 'private' | 'public' | 'collaborative'
  user_id: string
  created_at: string
}

export interface ItemWithMeta extends Item {
  lists: ItemList[]
  lowestListing?: Listing | null
  new_listings_count?: number
  listing_count?: number
  last_viewed_at?: string | null
}

export interface Listing {
  id: string
  item_id: string
  site: string
  title: string
  price: number | null
  currency: string
  url: string
  image_url: string | null
  found_at: string
  last_seen_at?: string
  starred: boolean
  condition: string | null
  size: string | null
  shipping_cost: number | null
  auction_ends_at: string | null
  location: string | null
  price_kind: PriceKind | null
  bid_count: number | null
  /** How well the title matched the search; possible matches are listed separately */
  match: ListingMatch
  /** Set when the user removed the listing; later searches keep it hidden */
  removed_at: string | null
  /** The hidden word that removed it, if it wasn't removed by hand */
  removed_word: string | null
  /** The price before the last price change; used for price-drop alerts */
  previous_price?: number | null
}

export type ListingMatch = 'match' | 'possible'

export type SiteKind = 'marketplace' | 'auction'

export interface SiteConfig {
  id: string
  site_name: string
  enabled: boolean
  base_url: string
  unreliable?: boolean
  kind?: SiteKind
}

/** What a listing's price means: a fixed asking price, the current highest bid, or the starting price of an auction without bids */
export type PriceKind = 'fixed' | 'bid' | 'start'

export interface ScrapedListing {
  site: string
  title: string
  price: number | null
  currency: string
  url: string
  imageUrl: string | null
  condition?: string | null
  size?: string | null
  shippingCost?: number | null
  auctionEndsAt?: string | null
  location?: string | null
  priceKind?: PriceKind | null
  bidCount?: number | null
  match?: ListingMatch
}

export type ListRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface ListMember {
  user_id: string
  email: string
  display_name: string | null
  role: ListRole
  joined_at: string
}

export interface ListInvite {
  id: string
  list_id: string
  token: string
  role: Exclude<ListRole, 'owner'>
  created_at: string
}
