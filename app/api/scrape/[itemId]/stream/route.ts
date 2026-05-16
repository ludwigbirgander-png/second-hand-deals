import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { SCRAPERS, ENRICHERS, enrichBatch, isRelevant, buildQuery } from '@/lib/scrapers'

export const maxDuration = 60

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params

  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (itemError || !item) {
    return Response.json({ error: 'Item not found' }, { status: 404 })
  }

  const { data: sites } = await db()
    .from('site_configs')
    .select('site_name')
    .eq('enabled', true)

  const siteNames = (sites ?? []).map((s: { site_name: string }) => s.site_name)
  const query = buildQuery(item.brand, item.name)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      send({ type: 'sites', sites: siteNames })

      const { data: existing } = await db()
        .from('listings')
        .select('url')
        .eq('item_id', itemId)
      const existingUrls = new Set((existing ?? []).map((e: { url: string }) => e.url))

      let total = 0

      for (const site of siteNames) {
        const scraper = SCRAPERS[site]
        if (!scraper) {
          send({ type: 'done', site, count: 0 })
          continue
        }

        send({ type: 'start', site })

        try {
          const raw = await scraper(query)
          const relevant = raw.filter((l) => isRelevant(l.title, query))

          const enrichFn = ENRICHERS[site]
          const enriched = enrichFn ? await enrichBatch(relevant, enrichFn) : relevant

          const seen = new Map<string, typeof enriched[0]>()
          for (const l of enriched) seen.set(l.url, l)
          const fresh = Array.from(seen.values()).filter((l) => !existingUrls.has(l.url))

          if (fresh.length > 0) {
            await db().from('listings').upsert(
              fresh.map((l) => ({
                item_id: itemId,
                site: l.site,
                title: l.title,
                price: l.price,
                currency: l.currency,
                url: l.url,
                image_url: l.imageUrl,
                condition: l.condition ?? null,
                size: l.size ?? null,
                shipping_cost: l.shippingCost ?? null,
                auction_ends_at: l.auctionEndsAt ?? null,
                location: l.location ?? null,
              })),
              { onConflict: 'item_id,url', ignoreDuplicates: true }
            )
            fresh.forEach((l) => existingUrls.add(l.url))
            total += fresh.length
          }

          send({ type: 'done', site, count: fresh.length })
        } catch {
          send({ type: 'done', site, count: 0 })
        }

        await new Promise((r) => setTimeout(r, 800))
      }

      send({ type: 'complete', total })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
