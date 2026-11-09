import { createClient } from '@/lib/supabase/server'
import { followerView, isMissingMarksTable, type ListingMark } from '@/lib/marks'
import type { Listing } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [{ data: item }, { data: listings, error }] = await Promise.all([
    supabase.from('items').select('user_id, min_price, max_price').eq('id', id).single(),
    supabase.from('listings').select('*').eq('item_id', id).order('found_at', { ascending: false }),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const minPrice = item?.min_price ?? null
  const maxPrice = item?.max_price ?? null

  let filtered = (listings ?? []).filter((l: { price: number | null }) => {
    if (l.price == null) return true
    if (minPrice != null && l.price < minPrice) return false
    if (maxPrice != null && l.price > maxPrice) return false
    return true
  })

  // Someone else's item: show this person's own favourites and removals, not the owner's
  if (item && item.user_id !== user.id) {
    const { data: marks, error: marksError } = await supabase
      .from('listing_marks')
      .select('listing_id, starred, removed_at, listings!inner(item_id)')
      .eq('user_id', user.id)
      .eq('listings.item_id', id)
    if (marksError && !isMissingMarksTable(marksError)) console.error('listing marks failed:', marksError.message)
    const byListing = new Map<string, ListingMark>(
      (marks ?? []).map((m: { listing_id: string } & ListingMark) => [m.listing_id, { starred: m.starred, removed_at: m.removed_at }])
    )
    filtered = filtered
      .map((l: Listing) => followerView(l, byListing.get(l.id)))
      .filter((l: Listing | null): l is Listing => l !== null)
  }

  return Response.json({ listings: filtered })
}
