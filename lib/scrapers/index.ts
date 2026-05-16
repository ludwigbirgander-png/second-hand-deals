import { scrapeBlocket, enrich as enrichBlocket } from './blocket'
import { scrapeTradera, enrich as enrichTradera } from './tradera'
import { scrapeSellpy } from './sellpy'
import { scrapeVinted } from './vinted'
import { scrapeFacebook } from './facebook'
import type { ScrapedListing } from '../types'

export const SCRAPERS: Record<string, (q: string) => Promise<ScrapedListing[]>> = {
  Blocket: scrapeBlocket,
  Tradera: scrapeTradera,
  Sellpy: scrapeSellpy,
  Vinted: scrapeVinted,
  'Facebook Marketplace': scrapeFacebook,
}

const ENRICHERS: Record<string, (url: string) => Promise<Partial<ScrapedListing>>> = {
  Blocket: enrichBlocket,
  Tradera: enrichTradera,
}

export async function scrapeItem(
  query: string,
  sites: string[],
  options?: { enrich?: boolean }
): Promise<ScrapedListing[]> {
  const results: ScrapedListing[] = []

  for (const site of sites) {
    const fn = SCRAPERS[site]
    if (!fn) continue
    try {
      const listings = await fn(query)
      const filtered = listings.filter((l) => isRelevant(l.title, query))

      let enriched = filtered
      if (options?.enrich) {
        const enrichFn = ENRICHERS[site]
        if (enrichFn) {
          enriched = await enrichBatch(filtered, enrichFn)
        }
      }

      results.push(...enriched)
    } catch {
      // site unavailable — skip silently
    }
    await delay(1000)
  }

  return results
}

async function enrichBatch(
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
