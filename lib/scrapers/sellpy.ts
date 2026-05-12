import axios from 'axios'
import type { ScrapedListing } from '../types'

const APP_ID = 'M6WNFR0LVI'
const API_KEY = '313e09c3b00b6e2da5dbe382cd1c8f4b'
const INDEX = 'prod_marketItem_se_saleStartedAt_desc'
const URL = `https://${APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`

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

      return {
        site: 'Sellpy',
        title,
        price,
        currency: 'SEK',
        url: `https://www.sellpy.se/item/${hit.objectID}`,
        imageUrl: hit.images?.[0] ?? null,
      }
    })
    .filter((l) => l.title && l.url)
    .slice(0, 50)
}
