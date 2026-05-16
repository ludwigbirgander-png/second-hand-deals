import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9',
}

export async function scrapeTradera(query: string): Promise<ScrapedListing[]> {
  const url = `https://www.tradera.com/search?q=${encodeURIComponent(query)}&saleType=1`
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 })

  const $ = cheerio.load(data)
  const listings: ScrapedListing[] = []

  $('div[id^="item-card-"]').each((_, el) => {
    // Title link has class textTruncateOneLine — the first a[href*="/item/"] is the image wrapper (no text)
    const titleEl = $(el).find('a[class*="textTruncateOneLine"]').first()
    const title = titleEl.text().trim()
    const href = titleEl.attr('href') || $(el).find('a[href*="/item/"]').first().attr('href') || ''
    const url = href.startsWith('http') ? href : `https://www.tradera.com${href}`
    const priceText = $(el).find('[data-testid="price"]').first().text().trim()
    const price = parsePrice(priceText)
    const imageUrl = $(el).find('img').first().attr('src') || null

    if (title && url && url !== 'https://www.tradera.com') {
      listings.push({ site: 'Tradera', title, price, currency: 'SEK', url, imageUrl })
    }
  })

  return listings.slice(0, 50)
}

export async function enrich(url: string): Promise<Partial<ScrapedListing>> {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 })
    const $ = cheerio.load(data)

    // Auction end date — look for time element or "slutar" nearby text
    let auctionEndsAt: string | null = null
    const timeEl = $('time[datetime]').first()
    if (timeEl.length) {
      const dt = timeEl.attr('datetime')
      if (dt) auctionEndsAt = new Date(dt).toISOString()
    }
    if (!auctionEndsAt) {
      // Fallback: find text containing "slutar" and grab the following date
      $('*').each((_, el) => {
        if (auctionEndsAt) return
        const text = $(el).text()
        if (/slutar/i.test(text) && $(el).children().length === 0) {
          const match = text.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2})/)
          if (match) {
            const parsed = new Date(match[1].replace(' ', 'T'))
            if (!isNaN(parsed.getTime())) auctionEndsAt = parsed.toISOString()
          }
        }
      })
    }

    // Shipping cost — look for "frakt" in item detail rows
    let shippingCost: number | null = null
    $('*').each((_, el) => {
      if (shippingCost !== null) return
      const text = $(el).clone().children().remove().end().text().trim()
      if (/frakt/i.test(text) && $(el).children().length === 0) {
        const parent = $(el).parent()
        const siblingText = parent.text()
        if (/gratis|fri frakt/i.test(siblingText)) {
          shippingCost = 0
        } else {
          const match = siblingText.match(/(\d[\d\s ]*)\s*kr/i)
          if (match) {
            const n = parseInt(match[1].replace(/[\s ]/g, ''), 10)
            if (!isNaN(n) && n < 10000) shippingCost = n
          }
        }
      }
    })

    return { auctionEndsAt, shippingCost }
  } catch {
    return {}
  }
}

function parsePrice(text: string): number | null {
  // "100 kr," or "2 900 kr" — spaces/NBSP are thousands separators
  const cleaned = text.replace(/kr/i, '').replace(/[,\s ]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}
