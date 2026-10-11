// Live health check: one known query per site, so a site that changed its
// markup or API shows up as "0" or an error. Run: npm run check:scrapers
import { SCRAPERS, isRelevant } from '../lib/scrapers/index.js'

// Queries that every site normally has results for
const QUERIES: Record<string, string> = {
  Blocket: 'iphone',
  Tradera: 'iphone',
  Sellpy: 'levis',
  Vinted: 'levis',
  Auctionet: 'stol',
  Bukowskis: 'stol',
}

// Facebook needs a logged-in session and always returns nothing
const SKIP = new Set(['Facebook Marketplace'])

async function main() {
  const sites = Object.keys(SCRAPERS).filter((s) => !SKIP.has(s))
  const results = await Promise.all(sites.map(async (site) => {
    const query = QUERIES[site] ?? 'stol'
    const started = Date.now()
    try {
      const listings = await SCRAPERS[site](query)
      const relevant = listings.filter((l) => isRelevant(l.title, query))
      const priced = listings.filter((l) => l.price != null)
      return { site, query, ok: listings.length > 0, found: listings.length, relevant: relevant.length, priced: priced.length, ms: Date.now() - started, error: '' }
    } catch (err) {
      return { site, query, ok: false, found: 0, relevant: 0, priced: 0, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) }
    }
  }))

  for (const r of results) {
    const status = r.ok ? 'ok  ' : 'FAIL'
    console.log(`${status} ${r.site.padEnd(10)} "${r.query}": ${r.found} found, ${r.relevant} relevant, ${r.priced} priced (${r.ms} ms)${r.error ? ` — ${r.error}` : ''}`)
  }

  if (results.some((r) => !r.ok)) process.exit(1)
}

main()
