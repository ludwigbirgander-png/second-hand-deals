import { scrapeBlocket, enrich as enrichBlocket } from './blocket'
import { scrapeTradera, enrich as enrichTradera, traderaApiEnabled } from './tradera'
import { scrapeSellpy } from './sellpy'
import { scrapeVinted } from './vinted'
import { scrapeFacebook } from './facebook'
import { scrapeAuctionet } from './auctionet'
import { scrapeBukowskis } from './bukowskis'
import type { ScrapedListing } from '../types'
import { matchQuality, swedishVariant, hasExcludedWord } from '../search/match'

export const SCRAPERS: Record<string, (q: string) => Promise<ScrapedListing[]>> = {
  Blocket: scrapeBlocket,
  Tradera: scrapeTradera,
  Sellpy: scrapeSellpy,
  Vinted: scrapeVinted,
  'Facebook Marketplace': scrapeFacebook,
  Auctionet: scrapeAuctionet,
  Bukowskis: scrapeBukowskis,
}

/** Per-listing page fetches for details the search results lack. Tradera's API returns them already. */
function enricherFor(site: string): ((url: string) => Promise<Partial<ScrapedListing>>) | undefined {
  if (site === 'Blocket') return enrichBlocket
  if (site === 'Tradera' && !traderaApiEnabled()) return enrichTradera
  return undefined
}

/** One site's time budget, enrichment included. Sites run in parallel inside a 60 s function. */
export const SITE_TIMEOUT_MS = 45_000

// Sites with Swedish titles also get a Swedish version of the query ("Eames chair" → "Eames stol")
const SWEDISH_TITLE_SITES = new Set(['Blocket', 'Tradera', 'Auctionet', 'Bukowskis'])

export interface RunOptions {
  enrich?: boolean
  timeoutMs?: number
  /** Titles with a word starting with one of these are dropped */
  excludeWords?: string[]
}

/**
 * Search one site: scrape (plus a Swedish query variant where useful), dedupe
 * by URL, keep matches and possible matches, drop hidden words, enrich.
 * Rejects on error or timeout, so callers can tell a failed site from one with no results.
 */
export async function runSite(site: string, query: string, options?: RunOptions): Promise<ScrapedListing[]> {
  const scraper = SCRAPERS[site]
  if (!scraper) return []

  const work = async () => {
    const variant = SWEDISH_TITLE_SITES.has(site) ? swedishVariant(query) : null
    const raw = await scraper(query)
    if (variant) raw.push(...(await scraper(variant).catch(() => [])))

    const byUrl = new Map<string, ScrapedListing>()
    for (const l of raw) {
      if (byUrl.has(l.url)) continue
      const match = matchQuality(l.title, query)
      if (match === 'none' || hasExcludedWord(l.title, options?.excludeWords ?? [])) continue
      byUrl.set(l.url, { ...l, match })
    }
    // Real matches first, then cap: two queries can return up to 100, and enrichment is slow
    const kept = Array.from(byUrl.values())
      .sort((a, b) => (a.match === b.match ? 0 : a.match === 'match' ? -1 : 1))
      .slice(0, 50)

    const enrichFn = options?.enrich ? enricherFor(site) : undefined
    return enrichFn ? enrichBatch(kept, enrichFn) : kept
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${site} timed out`)), options?.timeoutMs ?? SITE_TIMEOUT_MS)
  })
  try {
    return await Promise.race([work(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** All sites in parallel; a failed site contributes nothing. */
export async function scrapeItem(
  query: string,
  sites: string[],
  options?: RunOptions
): Promise<ScrapedListing[]> {
  const settled = await Promise.allSettled(sites.map((site) => runSite(site, query, options)))
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/** A scraped listing as a `listings` row, for upserts on (item_id, url). */
export function toListingRow(itemId: string, l: ScrapedListing) {
  return {
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
    price_kind: l.priceKind ?? null,
    bid_count: l.bidCount ?? null,
    match: l.match ?? 'match',
    last_seen_at: new Date().toISOString(),
  }
}

export async function enrichBatch(
  listings: ScrapedListing[],
  enrichFn: (url: string) => Promise<Partial<ScrapedListing>>,
  concurrency = 3,
  batchDelay = 500
): Promise<ScrapedListing[]> {
  const result = listings.map((l) => ({ ...l }))

  for (let i = 0; i < listings.length; i += concurrency) {
    const batch = listings.slice(i, i + concurrency)
    const enrichments = await Promise.all(
      batch.map(async (l) => {
        try {
          return await enrichFn(l.url)
        } catch {
          return {}
        }
      })
    )
    for (let j = 0; j < batch.length; j++) {
      Object.assign(result[i + j], enrichments[j])
    }
    if (i + concurrency < listings.length) {
      await delay(batchDelay)
    }
  }

  return result
}

export function buildQuery(brand: string | null, name: string): string {
  return [brand, name].filter(Boolean).join(' ')
}

/** True if the title is a real match for the query (not just a possible one). */
export function isRelevant(title: string, query: string): boolean {
  return matchQuality(title, query) === 'match'
}

export { normalize } from '../search/match'

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
