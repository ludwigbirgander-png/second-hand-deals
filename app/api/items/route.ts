import { createClient } from '@/lib/supabase/server'
import { parseTargetPrice } from '@/lib/alerts/targetPrice'
import { sanitizeFilters } from '@/lib/categories'
import { isMissingMarksTable } from '@/lib/marks'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('items')
    .select('*, item_lists(lists(*))')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const transformed = (data ?? []).map((item: any) => {
    const { item_lists, ...rest } = item
    return {
      ...rest,
      lists: (item_lists ?? []).map((r: any) => r.lists).filter(Boolean),
    }
  })

  const { data: counts } = await supabase.rpc('new_listings_count', { p_user_id: user.id })
  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.item_id] = Number(row.new_count)
  }

  // Lowest-priced listing per item in a single query (ordered by price, so the
  // first row seen per item is the cheapest). Respects each item's price range.
  const itemById: Record<string, any> = {}
  for (const item of transformed) itemById[item.id] = item

  const lowestMap: Record<string, any> = {}
  const itemIds = transformed.map((i: any) => i.id)
  const isOwn = (itemId: string) => itemById[itemId]?.user_id === user.id
  const otherIds: string[] = itemIds.filter((id: string) => !isOwn(id))

  // On other people's items (followed or shared lists) only your own removals count,
  // plus listings the owner hid with a word (those are no longer part of the search)
  const myRemoved = new Set<string>()
  const myRemovedMatches: Record<string, number> = {}
  if (otherIds.length > 0) {
    const { data: marks, error: marksError } = await supabase
      .from('listing_marks')
      .select('listing_id, listings!inner(item_id, match, removed_word)')
      .eq('user_id', user.id)
      .not('removed_at', 'is', null)
      .in('listings.item_id', otherIds)
    if (marksError && !isMissingMarksTable(marksError)) console.error('listing marks failed:', marksError.message)
    type RemovedMark = { listing_id: string; listings: { item_id: string; match: string; removed_word: string | null } }
    for (const m of (marks ?? []) as unknown as RemovedMark[]) {
      myRemoved.add(m.listing_id)
      if (m.listings.match === 'match' && !m.listings.removed_word) {
        myRemovedMatches[m.listings.item_id] = (myRemovedMatches[m.listings.item_id] ?? 0) + 1
      }
    }
  }

  if (itemIds.length > 0) {
    const { data: priced } = await supabase
      .from('listings')
      .select('id, item_id, price, currency, image_url, url, site, title, found_at, removed_at, removed_word')
      .in('item_id', itemIds)
      .not('price', 'is', null)
      .eq('match', 'match')
      // Ended auctions no longer count
      .or(`auction_ends_at.is.null,auction_ends_at.gt.${new Date().toISOString()}`)
      .order('price', { ascending: true })

    for (const { removed_at, removed_word, ...l } of priced ?? []) {
      if (lowestMap[l.item_id]) continue
      if (isOwn(l.item_id) ? removed_at : (removed_word || myRemoved.has(l.id))) continue
      const item = itemById[l.item_id]
      if (item?.min_price != null && l.price < item.min_price) continue
      if (item?.max_price != null && l.price > item.max_price) continue
      lowestMap[l.item_id] = l
    }
  }

  // Listings per item (real matches, not removed). Exact head counts (no rows transferred) rather than
  // counting fetched rows, which PostgREST caps at 1000 per request.
  const totals = await Promise.all(
    itemIds.map(async (id: string) => {
      const query = supabase.from('listings').select('id', { count: 'exact', head: true })
        .eq('item_id', id).eq('match', 'match')
      if (isOwn(id)) {
        const { count } = await query.is('removed_at', null)
        return [id, count ?? 0] as const
      }
      const { count } = await query.is('removed_word', null)
      return [id, Math.max(0, (count ?? 0) - (myRemovedMatches[id] ?? 0))] as const
    })
  )
  const totalMap: Record<string, number> = Object.fromEntries(totals)

  const enriched = transformed.map((item: any) => ({
    ...item,
    new_listings_count: countMap[item.id] ?? 0,
    listing_count: totalMap[item.id] ?? 0,
    lowestListing: lowestMap[item.id] ?? null,
  }))

  return Response.json(enriched)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, brand, min_price, max_price, notify, target_price, category, filters } = await request.json()
  if (!name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }
  const target = parseTargetPrice(target_price)
  if (target_price != null && target_price !== '' && target === undefined) {
    return Response.json({ error: 'Target price must be a whole number of kronor' }, { status: 400 })
  }

  const { data: item, error } = await supabase
    .from('items')
    .insert({
      name: name.trim(),
      brand: brand?.trim() || null,
      min_price: min_price ?? null,
      max_price: max_price ?? null,
      notify: notify !== false,
      target_price: target ?? null,
      ...sanitizeFilters(category, filters),
      user_id: user.id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Scraping is triggered explicitly by the client via /api/scrape/[itemId]/stream —
  // fire-and-forget work here doesn't survive serverless response completion.
  return Response.json(item, { status: 201 })
}
