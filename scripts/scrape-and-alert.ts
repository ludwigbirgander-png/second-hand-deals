// Every 3 hours (GitHub Action): search every item, then send the alerts that are due.
// The weekly email is a separate job (weekly-digest.ts).
//
//   npx tsx scripts/scrape-and-alert.ts               scrape, then alert
//   npx tsx scripts/scrape-and-alert.ts --alerts-only  alert from what's already saved
import { scrapeItem, buildQuery, toListingRow } from '../lib/scrapers/index.js'
import { alertsForItem, type Alert, type AlertItem, type AlertListing, type SentAlert } from '../lib/alerts/rules.js'
import { listingAlertEmail, rareFindEmail } from '../lib/alerts/email.js'
import { db, appUrl, canSend, sendEmail, emailFor, loadSettings, fetchAll } from './jobs.js'

const ITEM_COLUMNS = 'id, user_id, name, brand, notify, min_price, target_price, created_at, exclude_words'
const LISTING_COLUMNS =
  'id, item_id, site, title, price, previous_price, currency, url, image_url, price_kind, bid_count, auction_ends_at, starred, match, removed_at, found_at'

type JobItem = AlertItem & { exclude_words: string[] | null }

async function main() {
  const items = await fetchAll<JobItem>(() => db.from('items').select(ITEM_COLUMNS).order('created_at'))
  console.log(`${items.length} items`)

  if (!process.argv.includes('--alerts-only')) await scrapeAll(items)
  await sendAlerts(items)
  console.log('Done.')
}

// ─── Scrape ──────────────────────────────────────────────────────────────────

async function scrapeAll(items: JobItem[]) {
  // Per-user sites: site_configs.enabled is the default, user_site_prefs rows override it
  const [{ data: configs }, { data: prefs }] = await Promise.all([
    db.from('site_configs').select('id, site_name, enabled'),
    db.from('user_site_prefs').select('user_id, site_config_id, enabled'),
  ])
  const prefMap = new Map<string, boolean>(
    (prefs ?? []).map((p: { user_id: string; site_config_id: string; enabled: boolean }) =>
      [`${p.user_id}:${p.site_config_id}`, p.enabled] as const))
  const sitesForUser = (userId: string) =>
    (configs ?? [])
      .filter((c: { id: string; enabled: boolean }) => prefMap.get(`${userId}:${c.id}`) ?? c.enabled)
      .map((c: { site_name: string }) => c.site_name)

  for (const item of items) {
    const query = buildQuery(item.brand, item.name)
    const sites = sitesForUser(item.user_id)
    console.log(`Scraping "${query}" (${item.id}) on ${sites.length} sites…`)

    let scraped: Awaited<ReturnType<typeof scrapeItem>> = []
    try {
      scraped = await scrapeItem(query, sites, { enrich: true, excludeWords: item.exclude_words ?? [] })
    } catch (err) {
      console.error(`  Scrape failed:`, err)
      continue
    }
    if (scraped.length === 0) {
      console.log('  No relevant listings.')
      continue
    }

    // New listings are inserted; existing ones get fresh prices (a database trigger keeps
    // previous_price for price-drop alerts) and last_seen_at
    const { error: upsertError } = await db.from('listings').upsert(
      scraped.map((l) => toListingRow(item.id, l)),
      { onConflict: 'item_id,url' })
    if (upsertError) {
      console.error('  Upsert failed:', upsertError.message)
      continue
    }

    // Prune stale listings: not favourited and not seen for 14 days (sold listings stop
    // being returned). Removed ones are kept so they stay hidden.
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: pruneError, count: pruned } = await db
      .from('listings')
      .delete({ count: 'exact' })
      .eq('item_id', item.id)
      .eq('starred', false)
      .is('removed_at', null)
      .lt('last_seen_at', cutoff)
    if (pruneError) console.error('  Prune failed:', pruneError.message)
    console.log(`  ${scraped.length} relevant${pruned ? `, pruned ${pruned} stale` : ''}`)
  }
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

async function sendAlerts(items: JobItem[]) {
  const settings = await loadSettings()
  const now = Date.now()
  let sentCount = 0

  const byUser = new Map<string, JobItem[]>()
  for (const item of items) byUser.set(item.user_id, [...(byUser.get(item.user_id) ?? []), item])

  for (const [userId, userItems] of byUser) {
    if (!settings(userId).alerts_enabled) continue

    const sent = await fetchAll<SentAlert>(() =>
      db.from('alert_log').select('listing_id, kind, price').eq('user_id', userId).order('sent_at'))

    const due: Alert[] = []
    for (const item of userItems) {
      const listings = await fetchAll<AlertListing>(() =>
        db.from('listings').select(LISTING_COLUMNS).eq('item_id', item.id).order('found_at'))
      due.push(...alertsForItem(item, listings, sent, now))
    }
    if (due.length === 0) continue

    const to = await emailFor(userId)
    if (!to) continue

    // One email per listing (target price, price drop, auction ending), one per item for rare finds
    const perListing = new Map<string, Alert[]>()
    const rareByItem = new Map<string, Alert[]>()
    for (const a of due) {
      const groups = a.kind === 'rare_find' ? rareByItem : perListing
      const key = a.kind === 'rare_find' ? a.item.id : a.listing.id
      groups.set(key, [...(groups.get(key) ?? []), a])
    }

    const emails = [
      ...[...perListing.values()].map((alerts) => ({ alerts, email: listingAlertEmail(alerts, appUrl) })),
      ...[...rareByItem.values()].map((alerts) => ({
        alerts,
        email: rareFindEmail(alerts[0].item, alerts.map((a) => a.listing), appUrl),
      })),
    ]

    for (const { alerts, email } of emails) {
      if (!(await sendEmail(to, email))) continue
      sentCount++
      const { error } = await db.from('alert_log').insert(alerts.map((a) => ({
        user_id: userId,
        listing_id: a.listing.id,
        kind: a.kind,
        price: a.listing.price,
      })))
      if (error) console.error('  Could not log alert:', error.message)
      console.log(`  Sent to ${to}: ${email.subject}`)
    }
  }

  console.log(canSend ? `${sentCount} alert emails sent` : 'No RESEND_API_KEY: alerts printed, not sent')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
