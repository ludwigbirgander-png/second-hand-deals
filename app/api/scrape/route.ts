import { db } from '@/lib/db'
import { scrapeItem } from '@/lib/scrapers'
import { sendNewListingsEmail } from '@/lib/email'
import type { Item } from '@/lib/types'

export const maxDuration = 60

export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: items } = await db()
    .from('items')
    .select('*')
    .order('created_at', { ascending: true })

  const { data: sites } = await db()
    .from('site_configs')
    .select('site_name')
    .eq('enabled', true)

  const siteNames = (sites ?? []).map((s: { site_name: string }) => s.site_name)

  let totalNew = 0

  for (const item of (items ?? []) as Item[]) {
    const newCount = await scrapeAndNotify(item, siteNames)
    totalNew += newCount
  }

  return Response.json({ ok: true, newListings: totalNew })
}

function buildQuery(item: Item): string {
  return [item.brand, item.name].filter(Boolean).join(' ')
}

async function scrapeAndNotify(item: Item, sites: string[]): Promise<number> {
  const listings = await scrapeItem(buildQuery(item), sites)
  if (listings.length === 0) return 0

  const { data: existing } = await db()
    .from('listings')
    .select('url')
    .eq('item_id', item.id)

  const existingUrls = new Set((existing ?? []).map((e: { url: string }) => e.url))
  const fresh = listings.filter((l) => !existingUrls.has(l.url))
  if (fresh.length === 0) return 0

  const { data: inserted } = await db()
    .from('listings')
    .insert(
      fresh.map((l) => ({
        item_id: item.id,
        site: l.site,
        title: l.title,
        price: l.price,
        currency: l.currency,
        url: l.url,
        image_url: l.imageUrl,
      }))
    )
    .select()

  if (!inserted || inserted.length === 0) return 0

  const listingIds = inserted.map((l: { id: string }) => l.id)
  await db().from('notified').insert(listingIds.map((id: string) => ({ listing_id: id })))
  await sendNewListingsEmail(item, inserted)

  return inserted.length
}
