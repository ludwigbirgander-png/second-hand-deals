import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { getEnabledSiteNamesForUser } from '@/lib/sites'
import { scrapeItem } from '@/lib/scrapers'
import type { Item } from '@/lib/types'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params

  const { data: item, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error || !item) {
    return Response.json({ error: 'Item not found' }, { status: 404 })
  }

  const siteNames = await getEnabledSiteNamesForUser(user.id)
  const typedItem = item as Item
  const query = [typedItem.brand, typedItem.name].filter(Boolean).join(' ')
  const listings = await scrapeItem(query, siteNames)

  if (listings.length === 0) return Response.json({ added: 0 })

  const { data: existing } = await db()
    .from('listings')
    .select('url')
    .eq('item_id', itemId)

  const existingUrls = new Set((existing ?? []).map((e: { url: string }) => e.url))

  const seen = new Map<string, typeof listings[0]>()
  for (const l of listings) seen.set(l.url, l)
  const deduped = Array.from(seen.values())
  const fresh = deduped.filter((l) => !existingUrls.has(l.url))

  // Upsert everything: refreshes price and last_seen_at on existing listings
  if (deduped.length > 0) {
    await db().from('listings').upsert(
      deduped.map((l) => ({
        item_id: itemId,
        site: l.site,
        title: l.title,
        price: l.price,
        currency: l.currency,
        url: l.url,
        image_url: l.imageUrl,
        last_seen_at: new Date().toISOString(),
      })),
      { onConflict: 'item_id,url', ignoreDuplicates: false }
    )
  }

  return Response.json({ added: fresh.length, total: listings.length })
}
