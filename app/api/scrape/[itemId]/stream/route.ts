import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { getEnabledSiteNamesForUser } from '@/lib/sites'
import { SCRAPERS, runSite, toListingRow, buildQuery } from '@/lib/scrapers'

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

      // All sites at once; each reports back as soon as it finishes
      await Promise.all(siteNames.map(async (site) => {
        if (!SCRAPERS[site]) {
          send({ type: 'done', site, count: 0 })
          return
        }

        send({ type: 'start', site })

        try {
          const listings = await runSite(site, query, { enrich: true })
          const fresh = listings.filter((l) => !existingUrls.has(l.url))

          // Upsert everything (not just new): refreshes price and last_seen_at
          // on existing listings so stale ones can be pruned later
          if (listings.length > 0) {
            const { error } = await db().from('listings').upsert(
              listings.map((l) => toListingRow(itemId, l)),
              { onConflict: 'item_id,url', ignoreDuplicates: false }
            )
            if (error) throw error
            fresh.forEach((l) => existingUrls.add(l.url))
            total += fresh.length
          }

          succeededSites.push(site)
          send({ type: 'done', site, count: fresh.length })
        } catch {
          send({ type: 'done', site, count: 0 })
        }
      }))

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
