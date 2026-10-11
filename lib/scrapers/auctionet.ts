import axios from 'axios'
import type { ScrapedListing } from '../types'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
}

interface AuctionetItem {
  title: string
  url: string
  currency: string
  state: string
  hammered: boolean
  ends_at: number | null
  starting_bid_amount: number | null
  bids?: { amount: number }[]
  images?: { thumb?: string; w640?: string }[]
  location?: string | null
}

/**
 * Auctionet's public JSON API. It covers auction houses in Sweden, Denmark,
 * Finland and Germany; only SEK lots are kept (the API ignores currency and
 * country filters, so they are applied here).
 */
export async function scrapeAuctionet(query: string): Promise<ScrapedListing[]> {
  const { data } = await axios.get('https://auctionet.com/api/v2/items.json', {
    params: { q: query, per_page: 50 },
    headers: HEADERS,
    timeout: 10000,
  })
  return parseAuctionet(data)
}

export function parseAuctionet(data: { items?: AuctionetItem[] }, now = Date.now()): ScrapedListing[] {
  const listings: ScrapedListing[] = []

  for (const item of data?.items ?? []) {
    if (item.currency !== 'SEK' || item.state !== 'published' || item.hammered) continue
    const endsAt = item.ends_at ? item.ends_at * 1000 : null
    if (endsAt != null && endsAt <= now) continue
    if (!item.title || !item.url) continue

    const bids = item.bids ?? []
    const highest = bids.length ? Math.max(...bids.map((b) => b.amount)) : null

    listings.push({
      site: 'Auctionet',
      title: item.title.trim(),
      price: highest ?? item.starting_bid_amount ?? null,
      currency: 'SEK',
      // The API links to the English page; Kompi's users are Swedish
      url: item.url.replace('auctionet.com/en/', 'auctionet.com/sv/'),
      imageUrl: item.images?.[0]?.w640 ?? item.images?.[0]?.thumb ?? null,
      location: item.location || null,
      auctionEndsAt: endsAt != null ? new Date(endsAt).toISOString() : null,
      priceKind: highest != null ? 'bid' : 'start',
      bidCount: bids.length,
    })
  }

  return listings.slice(0, 50)
}
