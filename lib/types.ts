export interface Item {
  id: string
  user_id: string
  name: string
  brand: string | null
  min_price: number | null
  max_price: number | null
  notify: boolean
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

export interface Category {
  id: string
  name: string
  color: string
  created_at: string
}

export interface ItemWithMeta extends Item {
  lists: ItemList[]
  categories: Category[]
  lowestListing?: Listing | null
  new_listings_count?: number
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
}

export interface SiteConfig {
  id: string
  site_name: string
  enabled: boolean
  base_url: string
  unreliable?: boolean
}

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
