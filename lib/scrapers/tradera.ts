import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

export async function scrapeTradera(query: string): Promise<ScrapedListing[]> {
  const url = `https://www.tradera.com/search?q=${encodeURIComponent(query)}&saleType=1`
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'sv-SE,sv;q=0.9',
    },
    timeout: 10000,
  })

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

function parsePrice(text: string): number | null {
  // "100 kr," or "2 900 kr" — spaces/NBSP are thousands separators
  const cleaned = text.replace(/kr/i, '').replace(/[,\s ]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}
