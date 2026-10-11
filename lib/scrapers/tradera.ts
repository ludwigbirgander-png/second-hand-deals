import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedListing } from '../types'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9',
}

/** The official API is used once TRADERA_APP_ID and TRADERA_APP_KEY are set (https://api.tradera.com/register). */
export function traderaApiEnabled(): boolean {
  return Boolean(process.env.TRADERA_APP_ID?.trim() && process.env.TRADERA_APP_KEY?.trim())
}

export async function scrapeTradera(query: string): Promise<ScrapedListing[]> {
  if (traderaApiEnabled()) return scrapeTraderaApi(query)
  return scrapeTraderaHtml(query)
}

async function scrapeTraderaApi(query: string): Promise<ScrapedListing[]> {
  const { data } = await axios.get('https://api.tradera.com/v4/search', {
    params: { query },
    headers: {
      'X-App-Id': process.env.TRADERA_APP_ID!.trim(),
      'X-App-Key': process.env.TRADERA_APP_KEY!.trim(),
      Accept: 'application/json',
    },
    timeout: 10000,
  })
  return parseTraderaApi(data)
}

type ApiRecord = Record<string, unknown>

/** Reads a field in either camelCase (REST v4) or PascalCase (the SOAP field names). */
function field<T>(obj: ApiRecord, key: string): T | undefined {
  return (obj[key] ?? obj[key[0].toUpperCase() + key.slice(1)]) as T | undefined
}

/**
 * Search result items carry the end date and bids, so API results need no
 * per-listing enrichment. Auctions show the highest bid, or the opening bid
 * (nextBid) while there are none; Buy now items show their fixed price.
 */
export function parseTraderaApi(data: ApiRecord, now = Date.now()): ScrapedListing[] {
  const items = field<ApiRecord[]>(data ?? {}, 'items') ?? []
  const listings: ScrapedListing[] = []

  for (const item of items) {
    if (field<boolean>(item, 'isEnded')) continue
    const id = field<number>(item, 'id')
    const title = field<string>(item, 'shortDescription')?.trim()
    const url = field<string>(item, 'itemUrl') || (id ? `https://www.tradera.com/item/${id}` : '')
    if (!title || !url) continue

    const endDate = field<string>(item, 'endDate')
    const endsAt = endDate ? new Date(endDate).getTime() : NaN
    if (Number.isFinite(endsAt) && endsAt <= now) continue

    const isAuction = /auction/i.test(field<string>(item, 'itemType') ?? '')
    const bidCount = field<number>(item, 'bidCount') ?? 0
    const hasBids = Boolean(field<boolean>(item, 'hasBids')) || bidCount > 0
    const price = isAuction
      ? (hasBids ? field<number>(item, 'maxBid') : field<number>(item, 'nextBid')) ?? null
      : field<number>(item, 'buyItNowPrice') ?? null

    const images = field<ApiRecord[]>(item, 'imageLinks') ?? []
    listings.push({
      site: 'Tradera',
      title,
      price: price || null,
      currency: 'SEK',
      url,
      imageUrl: field<string>(item, 'thumbnailLink') || (images[0] && field<string>(images[0], 'url')) || null,
      auctionEndsAt: isAuction && Number.isFinite(endsAt) ? new Date(endsAt).toISOString() : null,
      priceKind: isAuction ? (hasBids ? 'bid' : 'start') : 'fixed',
      bidCount: isAuction ? bidCount : null,
    })
  }

  return listings.slice(0, 50)
}

// Fallback without API credentials. Note: Tradera's robots.txt disallows /search.
async function scrapeTraderaHtml(query: string): Promise<ScrapedListing[]> {
  const url = `https://www.tradera.com/search?q=${encodeURIComponent(query)}&saleType=1`
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 })

  return parseTraderaHtml(data)
}

/**
 * Search result cards. The title comes from the image link's title attribute,
 * which has outlived several class-name changes. data-item-type is Auction,
 * AuctionBin or PureBin; auction cards label the price "Ledande bud" (leading
 * bid) or "Utropspris" (starting price).
 */
export function parseTraderaHtml(html: string): ScrapedListing[] {
  const $ = cheerio.load(html)
  const listings: ScrapedListing[] = []

  $('div[data-item-card-id]').each((_, el) => {
    const card = $(el)
    const link = card.find('a[href*="/item/"]').first()
    const title = (link.attr('title') || card.find('a[href*="/item/"][title]').last().text()).trim()
    const href = link.attr('href') || ''
    if (!title || !href) return
    const url = href.startsWith('http') ? href : `https://www.tradera.com${href}`

    const type = card.attr('data-item-type') ?? ''
    const label = card.find('[data-testid="bids-label"]').first().text().trim()
    const priceKind = type === 'PureBin' ? 'fixed' : /ledande bud/i.test(label) ? 'bid' : /utropspris/i.test(label) ? 'start' : null

    listings.push({
      site: 'Tradera',
      title,
      price: parsePrice(card.find('[data-testid="price"]').first().text().trim()),
      currency: 'SEK',
      url,
      imageUrl: card.find('img').first().attr('src') || null,
      priceKind,
    })
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
