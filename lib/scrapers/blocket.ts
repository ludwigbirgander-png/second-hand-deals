import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
}

export async function scrapeBlocket(query: string): Promise<ScrapedListing[]> {
  const url = `https://www.blocket.se/recommerce/forsale/search?q=${encodeURIComponent(query)}`
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 })

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

export async function enrich(url: string): Promise<Partial<ScrapedListing>> {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 })
    const $ = cheerio.load(data)

    // Location — look for location-related elements
    let location: string | null = null
    const locationEl = $('[class*="location"], [data-testid*="location"], [class*="municipality"]').first()
    if (locationEl.length) {
      location = locationEl.text().trim() || null
    }
    if (!location) {
      // Fallback: find text nodes near map/location icons or "Plats:" labels
      $('*').each((_, el) => {
        if (location) return
        const text = $(el).clone().children().remove().end().text().trim()
        if (/^plats:/i.test(text)) {
          location = $(el).parent().text().replace(/plats:/i, '').trim() || null
        }
      })
    }

    // Shipping cost — look for "frakt" mentions
    let shippingCost: number | null = null
    const pageText = $.root().text()
    if (/fri frakt|gratis frakt/i.test(pageText)) {
      shippingCost = 0
    } else {
      // Look for "Frakt X kr" pattern
      const match = pageText.match(/frakt[:\s]+(\d[\d\s ]*)\s*kr/i)
      if (match) {
        const n = parseInt(match[1].replace(/[\s ]/g, ''), 10)
        if (!isNaN(n) && n < 10000) shippingCost = n
      }
    }

    return { location, shippingCost }
  } catch {
    return {}
  }
}

function parsePrice(text: string): number | null {
  const noNbsp = text.replace(/ /g, ' ')
  const cleaned = noNbsp.replace(/kr/i, '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.round(n)
}
