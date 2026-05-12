import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

export async function scrapeBlocket(query: string): Promise<ScrapedListing[]> {
  const url = `https://www.blocket.se/recommerce/forsale/search?q=${encodeURIComponent(query)}`
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
    timeout: 10000,
  })

  const $ = cheerio.load(data)
  const listings: ScrapedListing[] = []

  $('article[class*="sf-search-ad"]').each((_, el) => {
    const href = $(el).find('a.sf-search-ad-link').attr('href') || ''
    const url = href.startsWith('http') ? href : `https://www.blocket.se${href}`
    const title = $(el).find('h2').first().text().trim()
    const priceText = $(el).find('div[class*="justify-between"] span').first().text().trim()
    const price = parsePrice(priceText)
    const imageUrl = $(el).find('img[class*="sf-ad-carousel-desktop-item--active"]').attr('src')
      || $(el).find('img').first().attr('src')
      || null

    if (title && url && url !== 'https://www.blocket.se') {
      listings.push({ site: 'Blocket', title, price, currency: 'SEK', url, imageUrl })
    }
  })

  return listings.slice(0, 50)
}

function parsePrice(text: string): number | null {
  const noNbsp = text.replace(/ /g, ' ')
  const cleaned = noNbsp.replace(/kr/i, '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}
