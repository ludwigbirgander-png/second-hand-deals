import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

export async function scrapeVinted(query: string): Promise<ScrapedListing[]> {
  const url = `https://www.vinted.se/catalog?search_text=${encodeURIComponent(query)}`
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

  const $ = cheerio.load(data)
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

    // Full title is typically "Brand Name, Size, Condition" — split on comma
    const fullTitle = $(`[data-testid="product-item-id-${itemId}--overlay-link"]`).attr('title') || ''
    const parts = fullTitle.split(',').map((s) => s.trim()).filter(Boolean)
    const title = parts[0] ?? ''

    // Second comma-separated segment is typically the size
    const size = parts[1] ?? null

    const imageUrl = $(`[data-testid="product-item-id-${itemId}--image--img"]`).attr('src') || null

    // Condition badge — Vinted shows it on the card
    const conditionEl = $(`[data-testid="product-item-id-${itemId}--description-title"]`)
    const condition = conditionEl.length ? conditionEl.text().trim() || null : null

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
