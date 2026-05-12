import type { ScrapedListing } from '../types'

export async function scrapeFacebook(_query: string): Promise<ScrapedListing[]> {
  return []
}

export const FACEBOOK_UNRELIABLE = true
export const FACEBOOK_WARNING =
  'Facebook Marketplace requires a logged-in browser session and blocks automated scraping. Results cannot be fetched automatically.'
