import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'
import { vintedParams, type SearchOptions } from '../categories/native'

export async function scrapeVinted(query: string, opts: SearchOptions = {}): Promise<ScrapedListing[]> {
  // Condition goes into Vinted's own filter; the rest is checked by Kompi
  const extra = vintedParams(opts)
  if (extra == null) return []
  const url = [`https://www.vinted.se/catalog?search_text=${encodeURIComponent(query)}`, ...extra].join('&')
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'sv-SE,sv;q=0.9',
      'sec-fetch-site': 'none',
      'sec-fetch-mode': 'navigate',
    },
    timeout: 10000,
  })

  return parseVinted(data)
}

/**
 * The card link's title reads "Title, Varumärke: Levi's, Skick: Mycket bra, Storlek: M, 105.58 kr, 118.36 kr".
 * The title itself can contain commas, so everything before the first labelled part is the title.
 */
export function parseVintedCardTitle(full: string): { title: string; brand: string | null; condition: string | null; size: string | null } {
  const parts = full.split(', ')
  const labelled = (label: string) => parts.find((p) => p.startsWith(`${label}:`))?.slice(label.length + 1).trim() || null
  const first = parts.findIndex((p) => /^(Varumärke|Skick|Storlek):/.test(p))
  const title = (first === -1 ? parts.filter((p) => !/^\d[\d.,\s]*kr$/.test(p)) : parts.slice(0, first)).join(', ').trim()
  const size = labelled('Storlek')
  return { title, brand: labelled('Varumärke'), condition: labelled('Skick'), size: size === 'Annat' ? null : size }
}

export function parseVinted(html: string): ScrapedListing[] {
  const $ = cheerio.load(html)
  const listings: ScrapedListing[] = []

  // Each item has testids like "product-item-id-XXXXX--price-text", "--overlay-link", etc.
  $('[data-testid$="--price-text"]').each((_, el) => {
    const testid = $(el).attr('data-testid') || ''
    const idMatch = testid.match(/product-item-id-(\d+)--/)
    const itemId = idMatch?.[1]
    if (!itemId) return

    const priceText = $(el).text().trim()
    const price = parsePrice(priceText)
    const url = $(`[data-testid="product-item-id-${itemId}--overlay-link"]`).attr('href') || ''

    const fullTitle = $(`[data-testid="product-item-id-${itemId}--overlay-link"]`).attr('title') || ''
    const { title, condition, size } = parseVintedCardTitle(fullTitle)

    const imageUrl = $(`[data-testid="product-item-id-${itemId}--image--img"]`).attr('src') || null

    if (title && url) {
      listings.push({ site: 'Vinted', title, price, currency: 'SEK', url, imageUrl, size, condition })
    }
  })

  return listings.slice(0, 50)
}

function parsePrice(text: string): number | null {
  // "50,00 kr", "1 057,50 kr" — comma is decimal, space/NBSP is thousands
  const cleaned = text.replace(/kr/i, '').replace(/[\s ]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}
