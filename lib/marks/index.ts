// Personal favourites and removals for people who don't own an item (followers of a
// public list, members of a shared list). The owner keeps using listings.starred /
// removed_at; everyone else has rows in listing_marks. See
// supabase/migrations/20261105_listing_marks.sql.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ListingMark {
  starred: boolean
  removed_at: string | null
}

interface MarkableListing {
  starred: boolean
  removed_at: string | null
  removed_word: string | null
}

/**
 * How a listing looks to someone who doesn't own its item: their own favourite and
 * removal, never the owner's. Listings the owner hid with a word are no longer part
 * of the search, so they're dropped (null), unless this person favourited them.
 */
export function followerView<L extends MarkableListing>(listing: L, mark: ListingMark | null | undefined): L | null {
  const starred = mark?.starred ?? false
  if (listing.removed_word && !starred) return null
  return { ...listing, starred, removed_at: mark?.removed_at ?? null, removed_word: null }
}

/** The changes to save for a favourite/remove request, matching the owner's rules. */
export function markUpdate(input: { starred?: unknown; removed?: unknown }, now = new Date()): Partial<ListingMark> | null {
  const update: Partial<ListingMark> = {}
  if (typeof input.starred === 'boolean') update.starred = input.starred
  if (typeof input.removed === 'boolean') {
    update.removed_at = input.removed ? now.toISOString() : null
    // A removed listing is no longer a favourite
    if (input.removed) update.starred = false
  }
  return Object.keys(update).length > 0 ? update : null
}

/** True when the error means listing_marks doesn't exist yet (migration not run). */
export function isMissingMarksTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST200' || /listing_marks/.test(error.message ?? '')
}

/**
 * Listings on an item that someone other than the owner has favourited or removed.
 * Clean-ups keep these, like the owner's: favourites stay, and removed ones stay so
 * they remain hidden if they show up again. Returns null when it can't tell (a
 * database error), so the caller can skip pruning rather than delete them.
 */
export async function followerMarkedIds(client: SupabaseClient, itemId: string): Promise<string[] | null> {
  const { data, error } = await client
    .from('listing_marks')
    .select('listing_id, listings!inner(item_id)')
    .or('starred.eq.true,removed_at.not.is.null')
    .eq('listings.item_id', itemId)
  if (error) return isMissingMarksTable(error) ? [] : null
  return [...new Set((data ?? []).map((r: { listing_id: string }) => r.listing_id))]
}

/** A PostgREST `in` list for `.not('id', 'in', …)`. */
export const idList = (ids: string[]) => `(${ids.join(',')})`
