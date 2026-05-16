import axios from 'axios'
import type { ScrapedListing } from '../types'

const APP_ID = 'M6WNFR0LVI'
const API_KEY = '313e09c3b00b6e2da5dbe382cd1c8f4b'
const INDEX = 'prod_marketItem_se_saleStartedAt_desc'
const URL = `https://${APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`

const CONDITION_MAP: Record<string, string> = {
  new_with_tags: 'New with tags',
  new_without_tags: 'New without tags',
  very_good: 'Very good',
  good: 'Good',
  satisfactory: 'Satisfactory',
  // Swedish keys
  nytt_med_lapp: 'New with tags',
  nytt_utan_lapp: 'New without tags',
  mycket_gott_skick: 'Very good',
  gott_skick: 'Good',
  acceptabelt_skick: 'Satisfactory',
}

export async function scrapeSellpy(query: string): Promise<ScrapedListing[]> {
  const { data } = await axios.post(
    URL,
    JSON.stringify({
      requests: [{
        indexName: INDEX,
        query,
        filters: 'price_SE.amount > 0',
        hitsPerPage: 50,
      }],
    }),
    {
      headers: {
        'Content-Type': 'text/plain',
        'x-algolia-api-key': API_KEY,
        'x-algolia-application-id': APP_ID,
      },
      timeout: 10000,
    }
  )

  const hits: any[] = data?.results?.[0]?.hits ?? []

  return hits
    .map((hit): ScrapedListing => {
      const titleParts: string[] = (hit.titleOutputOrder ?? [])
        .map((key: string) => hit.metadata?.[key])
        .filter(Boolean)
      const title = titleParts.join(' ')
      const price = hit.price_SE?.amount != null ? Math.round(hit.price_SE.amount / 100) : null

      // Condition — try common metadata keys
      const rawCondition: string | undefined =
        hit.metadata?.condition ?? hit.metadata?.itemCondition ?? hit.metadata?.skick
      const condition = rawCondition
        ? (CONDITION_MAP[rawCondition.toLowerCase().replace(/\s+/g, '_')] ?? rawCondition)
        : null

      // Size — try common metadata keys
      const size: string | null =
        hit.metadata?.size ?? hit.metadata?.itemSize ?? hit.metadata?.storlek ?? null

      return {
        site: 'Sellpy',
        title,
        price,
        currency: 'SEK',
        url: `https://www.sellpy.se/item/${hit.objectID}`,
        imageUrl: hit.images?.[0] ?? null,
        condition,
        size,
      }
    })
    .filter((l) => l.title && l.url)
    .slice(0, 50)
}
