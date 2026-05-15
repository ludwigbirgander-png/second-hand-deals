import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { scrapeItem, buildQuery } from '@/lib/scrapers'

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

  const enriched = transformed.map((item: any) => ({
    ...item,
    new_listings_count: countMap[item.id] ?? 0,
  }))

  return Response.json(enriched)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, brand, noScrape, min_price, max_price } = await request.json()
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
      user_id: user.id,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!noScrape) triggerScrape(item.id, buildQuery(item.brand, item.name))

  return Response.json(item, { status: 201 })
}

async function triggerScrape(itemId: string, itemName: string) {
  const { data: sites } = await db()
    .from('site_configs')
    .select('site_name')
    .eq('enabled', true)

  const siteNames = (sites ?? []).map((s: { site_name: string }) => s.site_name)
  const listings = await scrapeItem(itemName, siteNames)

  if (listings.length === 0) return

  await db().from('listings').insert(
    listings.map((l) => ({
      item_id: itemId,
      site: l.site,
      title: l.title,
      price: l.price,
      currency: l.currency,
      url: l.url,
      image_url: l.imageUrl,
    }))
  )
}
