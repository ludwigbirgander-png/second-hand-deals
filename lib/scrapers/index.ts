import { scrapeBlocket } from './blocket'
import { scrapeTradera } from './tradera'
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

export async function scrapeItem(
  query: string,
  sites: string[]
): Promise<ScrapedListing[]> {
  const results: ScrapedListing[] = []

  for (const site of sites) {
    const fn = SCRAPERS[site]
    if (!fn) continue
    try {
      const listings = await fn(query)
      const filtered = listings.filter((l) => isRelevant(l.title, query))
      results.push(...filtered)
    } catch {
      // site unavailable — skip silently
    }
    await delay(1000)
  }

  return results
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
