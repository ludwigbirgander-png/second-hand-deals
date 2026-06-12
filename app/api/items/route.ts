import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('items')
    .select('*, item_lists(lists(*)), item_categories(categories(*))')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const transformed = (data ?? []).map((item: any) => {
    const { item_lists, item_categories, ...rest } = item
    return {
      ...rest,
      lists: (item_lists ?? []).map((r: any) => r.lists).filter(Boolean),
      categories: (item_categories ?? []).map((r: any) => r.categories).filter(Boolean),
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
  if (itemIds.length > 0) {
    const { data: priced } = await supabase
      .from('listings')
      .select('id, item_id, price, currency, image_url, url, site, title, found_at')
      .in('item_id', itemIds)
      .not('price', 'is', null)
      .order('price', { ascending: true })

    for (const l of priced ?? []) {
      if (lowestMap[l.item_id]) continue
      const item = itemById[l.item_id]
      if (item?.min_price != null && l.price < item.min_price) continue
      if (item?.max_price != null && l.price > item.max_price) continue
      lowestMap[l.item_id] = l
    }
  }

  const enriched = transformed.map((item: any) => ({
    ...item,
    new_listings_count: countMap[item.id] ?? 0,
    lowestListing: lowestMap[item.id] ?? null,
  }))

  return Response.json(enriched)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, brand, min_price, max_price, notify } = await request.json()
  if (!name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data: item, error } = await supabase
    .from('items')
    .insert({
      name: name.trim(),
      brand: brand?.trim() || null,
      min_price: min_price ?? null,
      max_price: max_price ?? null,
      notify: notify !== false,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Scraping is triggered explicitly by the client via /api/scrape/[itemId]/stream —
  // fire-and-forget work here doesn't survive serverless response completion.
  return Response.json(item, { status: 201 })
}
