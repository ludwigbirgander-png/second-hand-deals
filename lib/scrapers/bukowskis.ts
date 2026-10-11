import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9',
}

export async function scrapeBukowskis(query: string): Promise<ScrapedListing[]> {
  const { data } = await axios.get('https://www.bukowskis.com/sv/lots', {
    params: { query },
    headers: HEADERS,
    timeout: 10000,
  })
  return parseBukowskis(data)
}

/**
 * Lot cards on /sv/lots. Each shows "Aktuellt bud" (current bid) or "Inga bud"
 * (no bids) plus the "Utropspris" (starting price). Helsinki lots are in EUR
 * and are skipped.
 */
export function parseBukowskis(html: string, now = Date.now()): ScrapedListing[] {
  const $ = cheerio.load(html)
  const listings: ScrapedListing[] = []

  $('.c-lot-index-lot[data-lot-id]').each((_, el) => {
    const card = $(el)
    const href = card.find('a.c-lot-index-lot__title-link').attr('href') || card.find('a[href*="/lots/"]').first().attr('href') || ''
    if (!href) return
    const url = href.startsWith('http') ? href : `https://www.bukowskis.com${href}`

    const artist = card.find('.c-lot-index-lot__artist').first().text().trim()
    const name = card.find('.c-lot-index-lot__title').first().text().trim()
    const title = [artist, name].filter(Boolean).join(', ').replace(/[\s,.]+$/, '')
    if (!title) return

    const bid = parseAmount(card.find('.c-lot-index-lot__result-value').first().text())
    const start = parseAmount(card.find('.c-lot-index-lot__estimate-value').first().text())
    const shown = bid ?? start
    if (shown && shown.currency !== 'SEK') return

    const endSeconds = Number(card.find('[data-end-date]').first().attr('data-end-date'))
    const endsAt = Number.isFinite(endSeconds) && endSeconds > 0 ? endSeconds * 1000 : null
    if (endsAt != null && endsAt <= now) return

    listings.push({
      site: 'Bukowskis',
      title,
      price: shown?.amount ?? null,
      currency: 'SEK',
      url,
      imageUrl: card.find('img').first().attr('src') || null,
      auctionEndsAt: endsAt != null ? new Date(endsAt).toISOString() : null,
      priceKind: bid ? 'bid' : 'start',
    })
  })

  return listings.slice(0, 50)
}

/** "6 200 SEK" → { amount: 6200, currency: 'SEK' }; "Inga bud" → null */
function parseAmount(text: string): { amount: number; currency: string } | null {
  const match = text.replace(/[\s ]/g, '').match(/^(\d+)([A-Z]{3})$/)
  return match ? { amount: parseInt(match[1], 10), currency: match[2] } : null
}
