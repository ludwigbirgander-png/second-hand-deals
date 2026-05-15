import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { scrapeItem, buildQuery } from '../lib/scrapers/index.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceKey)

async function main() {
  console.log('Starting daily scrape…')

  const { data: items, error: itemsError } = await db
    .from('items')
    .select('id, user_id, name, brand')

  if (itemsError) {
    console.error('Failed to fetch items:', itemsError.message)
    process.exit(1)
  }

  const { data: sites } = await db
    .from('site_configs')
    .select('site_name')
    .eq('enabled', true)

  const siteNames: string[] = (sites ?? []).map((s: { site_name: string }) => s.site_name)
  console.log(`Enabled sites: ${siteNames.join(', ')}`)

  // Track new listings per user for the email digest
  const newListingsByUser: Record<string, Array<{ itemName: string; site: string; title: string; price: number | null; currency: string; url: string }>> = {}

  for (const item of items ?? []) {
    const query = buildQuery(item.brand, item.name)
    console.log(`Scraping "${query}" (${item.id})…`)

    const { data: existing } = await db
      .from('listings')
      .select('url')
      .eq('item_id', item.id)

    const existingUrls = new Set((existing ?? []).map((e: { url: string }) => e.url))

    let scraped: Awaited<ReturnType<typeof scrapeItem>> = []
    try {
      scraped = await scrapeItem(query, siteNames)
    } catch (err) {
      console.error(`  Scrape failed for ${item.id}:`, err)
      continue
    }

    const fresh = scraped.filter((l) => !existingUrls.has(l.url))
    if (fresh.length === 0) {
      console.log(`  No new listings.`)
      continue
    }

    const { error: insertError } = await db.from('listings').upsert(
      fresh.map((l) => ({
        item_id: item.id,
        site: l.site,
        title: l.title,
        price: l.price,
        currency: l.currency,
        url: l.url,
        image_url: l.imageUrl,
      })),
      { onConflict: 'item_id,url', ignoreDuplicates: true }
    )

    if (insertError) {
      console.error(`  Insert failed:`, insertError.message)
      continue
    }

    console.log(`  +${fresh.length} new listings`)

    if (!newListingsByUser[item.user_id]) newListingsByUser[item.user_id] = []
    for (const l of fresh) {
      newListingsByUser[item.user_id].push({
        itemName: buildQuery(item.brand, item.name),
        site: l.site,
        title: l.title,
        price: l.price,
        currency: l.currency,
        url: l.url,
      })
    }
  }

  // Send digest emails
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '') || 'https://second-hand-deals.vercel.app'

  if (!resendKey) {
    console.log('No RESEND_API_KEY — skipping email digest')
    return
  }

  const resend = new Resend(resendKey)

  for (const [userId, listings] of Object.entries(newListingsByUser)) {
    try {
      const { data: userRecord } = await db.auth.admin.getUserById(userId)
      const email = userRecord?.user?.email
      if (!email) continue

      // Group by item name
      const byItem: Record<string, typeof listings> = {}
      for (const l of listings) {
        if (!byItem[l.itemName]) byItem[l.itemName] = []
        byItem[l.itemName].push(l)
      }

      const rows = Object.entries(byItem)
        .map(([itemName, ls]) => {
          const listingRows = ls
            .map(
              (l) =>
                `<tr>
                  <td style="padding:4px 8px;color:#555">${l.site}</td>
                  <td style="padding:4px 8px">${l.title}</td>
                  <td style="padding:4px 8px;white-space:nowrap">${l.price != null ? `${l.price} ${l.currency}` : '—'}</td>
                  <td style="padding:4px 8px"><a href="${l.url}" style="color:#2563eb">View</a></td>
                </tr>`
            )
            .join('')
          return `<h3 style="margin:24px 0 8px;font-size:15px;color:#18181b">${itemName}</h3>
                  <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#f4f4f5">
                      <th style="padding:4px 8px;text-align:left;font-weight:500">Site</th>
                      <th style="padding:4px 8px;text-align:left;font-weight:500">Title</th>
                      <th style="padding:4px 8px;text-align:left;font-weight:500">Price</th>
                      <th style="padding:4px 8px;text-align:left;font-weight:500"></th>
                    </tr></thead>
                    <tbody>${listingRows}</tbody>
                  </table>`
        })
        .join('')

      await resend.emails.send({
        from: `Compy <${fromEmail}>`,
        to: email,
        subject: `${listings.length} new listing${listings.length !== 1 ? 's' : ''} on your watchlist`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 4px;font-size:18px;color:#18181b">Your daily digest</h2>
            <p style="margin:0 0 24px;color:#71717a;font-size:13px">New listings found across your watchlist</p>
            ${rows}
            <p style="margin:32px 0 0;font-size:12px;color:#a1a1aa">
              <a href="${appUrl}" style="color:#2563eb">Open Compy</a> to see all listings
            </p>
          </div>
        `,
      })

      console.log(`Sent digest to ${email} (${listings.length} listings)`)
    } catch (err) {
      console.error(`Failed to send digest to user ${userId}:`, err)
    }
  }

  console.log('Daily scrape complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
