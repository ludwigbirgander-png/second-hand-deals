import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { getEnabledSiteNamesForUser } from '@/lib/sites'
import { SCRAPERS, ENRICHERS, enrichBatch, isRelevant, buildQuery } from '@/lib/scrapers'

export const maxDuration = 60

// POST because this endpoint has side effects (writes listings to the DB) —
// GETs can be prefetched or retried by browsers and proxies.
export async function POST(
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

  const siteNames = await getEnabledSiteNamesForUser(user.id)
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
      const scrapeStart = new Date().toISOString()
      const succeededSites: string[] = []

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
          const deduped = Array.from(seen.values())
          const fresh = deduped.filter((l) => !existingUrls.has(l.url))

          // Upsert everything (not just new): refreshes price and last_seen_at
          // on existing listings so stale ones can be pruned later
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
                condition: l.condition ?? null,
                size: l.size ?? null,
                shipping_cost: l.shippingCost ?? null,
                auction_ends_at: l.auctionEndsAt ?? null,
                location: l.location ?? null,
                last_seen_at: new Date().toISOString(),
              })),
              { onConflict: 'item_id,url', ignoreDuplicates: false }
            )
            fresh.forEach((l) => existingUrls.add(l.url))
            total += fresh.length
          }

          succeededSites.push(site)
          send({ type: 'done', site, count: fresh.length })
        } catch {
          send({ type: 'done', site, count: 0 })
        }

        await new Promise((r) => setTimeout(r, 800))
      }

      // Prune: listings from successfully scraped sites that were NOT returned
      // this run are no longer available — delete them (starred ones are kept).
      // Sites that errored or are disabled are left untouched.
      let pruned = 0
      if (succeededSites.length > 0) {
        const { count } = await db()
          .from('listings')
          .delete({ count: 'exact' })
          .eq('item_id', itemId)
          .eq('starred', false)
          .in('site', succeededSites)
          .lt('last_seen_at', scrapeStart)
        pruned = count ?? 0
      }

      send({ type: 'complete', total, pruned })
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
