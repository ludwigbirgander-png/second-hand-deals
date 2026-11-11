// Shapes of item rows as the item routes read them from Supabase.
import type { Item, ItemList, Listing } from './types'

/** An item with its list links embedded (`select('*, item_lists(lists(*))')`) */
export type ItemRow = Item & { item_lists?: { lists: ItemList | null }[] | null }

/** An item with its lists flattened, as the routes send it */
export type ItemWithLists = Item & { lists: ItemList[] }

/** The cheapest listing shown on a watchlist tile */
export type LowestListing = Pick<Listing, 'id' | 'item_id' | 'price' | 'currency' | 'image_url' | 'url' | 'site' | 'title' | 'found_at'>

/** The lists from an item's embedded links, skipping links to lists the reader can't see */
export function listsOf(links: ItemRow['item_lists']): ItemList[] {
  return (links ?? []).map((r) => r.lists).filter((l): l is ItemList => l !== null)
}
