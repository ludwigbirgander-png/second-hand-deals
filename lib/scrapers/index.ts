import { scrapeBlocket, enrich as enrichBlocket } from './blocket'
import { scrapeTradera, enrich as enrichTradera, traderaApiEnabled } from './tradera'
import { scrapeSellpy } from './sellpy'
import { scrapeVinted } from './vinted'
import { scrapeFacebook } from './facebook'
import { scrapeAuctionet } from './auctionet'
import { scrapeBukowskis } from './bukowskis'
import type { ScrapedListing } from '../types'

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

/**
 * Search one site: scrape, keep relevant titles, enrich, dedupe by URL.
 * Rejects on error or timeout, so callers can tell a failed site from one with no results.
 */
export async function runSite(
  site: string,
  query: string,
  options?: { enrich?: boolean; timeoutMs?: number }
): Promise<ScrapedListing[]> {
  const scraper = SCRAPERS[site]
  if (!scraper) return []

  const work = async () => {
    const relevant = (await scraper(query)).filter((l) => isRelevant(l.title, query))
    const enrichFn = options?.enrich ? enricherFor(site) : undefined
    const enriched = enrichFn ? await enrichBatch(relevant, enrichFn) : relevant
    return Array.from(new Map(enriched.map((l) => [l.url, l])).values())
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
  options?: { enrich?: boolean }
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

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/å/g, 'a')
    .replace(/é/g, 'e')
    .replace(/ü/g, 'u')
    .replace(/['’]/g, '') // "Levi's" matches "levis"
}

export function isRelevant(title: string, query: string): boolean {
  const normTitle = normalize(title)
  const words = normalize(query)
    .split(/\s+/)
    .filter((w) => w.length >= 3)

  // If the query is very short (all words < 3 chars), skip filtering
  if (words.length === 0) return true

  return words.every((word) => normTitle.includes(word))
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
