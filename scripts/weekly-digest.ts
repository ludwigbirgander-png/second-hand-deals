// Monday morning (GitHub Action): one email per user with the week's new listings, grouped by item.
// Real matches only, without removed listings. No email in a week with nothing new.
// It doesn't scrape: the 3-hourly job (scrape-and-alert.ts) keeps listings fresh.
import type { AlertItem, AlertListing } from '../lib/alerts/rules.js'
import { isLive } from '../lib/alerts/rules.js'
import { weeklyDigestEmail, type DigestGroup } from '../lib/alerts/email.js'
import { db, appUrl, canSend, sendEmail, emailFor, loadSettings, fetchAll } from './jobs.js'

const DAY = 24 * 60 * 60 * 1000
/** Never look back further than this, e.g. after the email was off for a while */
const MAX_WINDOW_MS = 8 * DAY

async function main() {
  const runAt = new Date()
  const now = runAt.getTime()
  const settings = await loadSettings()

  const items = await fetchAll<AlertItem>(() =>
    db.from('items').select('id, user_id, name, brand, notify, min_price, target_price, created_at').eq('notify', true).order('created_at'))

  const byUser = new Map<string, AlertItem[]>()
  for (const item of items) byUser.set(item.user_id, [...(byUser.get(item.user_id) ?? []), item])

  let sentCount = 0
  for (const [userId, userItems] of byUser) {
    const s = settings(userId)
    if (!s.weekly_email) continue

    const since = Math.max(s.last_digest_at ? Date.parse(s.last_digest_at) : now - 7 * DAY, now - MAX_WINDOW_MS)
    const groups: DigestGroup[] = []
    for (const item of userItems) {
      const listings = await fetchAll<AlertListing>(() =>
        db.from('listings')
          .select('id, item_id, site, title, price, previous_price, currency, url, image_url, price_kind, bid_count, auction_ends_at, starred, match, removed_at, found_at')
          .eq('item_id', item.id)
          .gt('found_at', new Date(since).toISOString())
          .order('price', { ascending: true, nullsFirst: false }))
      const live = listings.filter((l) => isLive(l, now))
      if (live.length > 0) groups.push({ item, listings: live })
    }

    if (groups.length > 0) {
      const to = await emailFor(userId)
      if (!to) continue
      const email = weeklyDigestEmail(groups, appUrl)
      if (!(await sendEmail(to, email))) continue
      sentCount++
      console.log(`Sent to ${to}: ${email.subject}`)
    }

    // Mark the week as covered, also when there was nothing to send
    if (canSend) {
      const { error } = await db.from('profiles').upsert({ id: userId, last_digest_at: runAt.toISOString() }, { onConflict: 'id' })
      if (error) console.error(`  Could not save last_digest_at for ${userId}:`, error.message)
    }
  }

  console.log(canSend ? `${sentCount} weekly emails sent` : 'No RESEND_API_KEY: emails printed, not sent')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
