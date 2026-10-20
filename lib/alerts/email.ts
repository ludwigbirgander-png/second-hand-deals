// Email subjects and HTML for the weekly digest and the alerts.
import { escapeHtml, safeHref } from '../escapeHtml'
import type { Alert, AlertItem, AlertListing } from './rules'

export interface Email {
  subject: string
  html: string
}

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

export function itemTitle(item: Pick<AlertItem, 'brand' | 'name'>) {
  return [item.brand, item.name].filter(Boolean).join(' ')
}

function priceText(l: AlertListing) {
  if (l.price == null) return '—'
  if (l.currency !== 'SEK') return `${l.price.toLocaleString('sv-SE')} ${escapeHtml(l.currency)}`
  return kr(l.price)
}

function layout(heading: string, intro: string, body: string, appUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#18181b">
      <h2 style="margin:0 0 4px;font-size:18px">${heading}</h2>
      <p style="margin:0 0 24px;color:#71717a;font-size:13px">${intro}</p>
      ${body}
      <p style="margin:32px 0 0;font-size:12px;color:#a1a1aa">
        <a href="${safeHref(appUrl)}" style="color:#2563eb">Open Kompi</a> to see all listings.
        You can turn these emails off in Kompi's settings.
      </p>
    </div>`
}

function listingTable(listings: AlertListing[]) {
  const rows = listings
    .map((l) => `<tr>
        <td style="padding:4px 8px;color:#555">${escapeHtml(l.site)}</td>
        <td style="padding:4px 8px">${escapeHtml(l.title)}</td>
        <td style="padding:4px 8px;white-space:nowrap">${priceText(l)}</td>
        <td style="padding:4px 8px"><a href="${safeHref(l.url)}" style="color:#2563eb">View</a></td>
      </tr>`)
    .join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rows}</tbody></table>`
}

/** One listing as a card, for single-listing alerts */
function listingCard(l: AlertListing, extra: string) {
  const img = l.image_url
    ? `<img src="${safeHref(l.image_url)}" alt="" width="96" height="96" style="width:96px;height:96px;object-fit:cover;border-radius:8px;display:block" />`
    : ''
  return `
    <table style="width:100%;border-collapse:collapse"><tr>
      ${img ? `<td style="width:108px;vertical-align:top">${img}</td>` : ''}
      <td style="vertical-align:top;font-size:14px">
        <div style="color:#71717a;font-size:12px">${escapeHtml(l.site)}</div>
        <div style="margin:2px 0 6px;font-weight:600">${escapeHtml(l.title)}</div>
        ${extra}
        <a href="${safeHref(l.url)}" style="display:inline-block;margin-top:10px;color:#2563eb">View listing</a>
      </td>
    </tr></table>`
}

export interface DigestGroup {
  item: Pick<AlertItem, 'brand' | 'name'>
  listings: AlertListing[]
}

/** The Monday email: new real matches since the last one, grouped by item */
export function weeklyDigestEmail(groups: DigestGroup[], appUrl: string): Email {
  const count = groups.reduce((sum, g) => sum + g.listings.length, 0)
  const body = groups
    .map((g) => `<h3 style="margin:24px 0 8px;font-size:15px">${escapeHtml(itemTitle(g.item))}</h3>${listingTable(g.listings)}`)
    .join('')
  return {
    subject: `${count} new listing${count === 1 ? '' : 's'} on your watchlist this week`,
    html: layout('Your week on Kompi', 'New listings found across your watchlist', body, appUrl),
  }
}

/**
 * Alerts about one listing (target price, price drop, auction ending), in one email
 * even when several apply.
 */
export function listingAlertEmail(alerts: Alert[], appUrl: string): Email {
  const { item, listing: l } = alerts[0]
  const name = escapeHtml(itemTitle(item))
  const kinds = new Set(alerts.map((a) => a.kind))
  const drop = alerts.find((a) => a.kind === 'price_drop')
  const lines: string[] = []

  if (drop?.oldPrice != null && l.price != null) {
    lines.push(`<div style="font-size:16px"><s style="color:#a1a1aa">${kr(drop.oldPrice)}</s> → <strong>${priceText(l)}</strong></div>`)
  } else {
    lines.push(`<div style="font-size:16px"><strong>${priceText(l)}</strong>${l.price_kind === 'bid' ? ' <span style="color:#71717a;font-size:13px">current bid</span>' : ''}</div>`)
  }
  if (kinds.has('target_price') && item.target_price != null) {
    lines.push(`<div style="color:#71717a;font-size:13px">Your target: under ${kr(item.target_price)}</div>`)
  }
  if (kinds.has('auction_ending') && l.auction_ends_at) {
    const ends = new Date(l.auction_ends_at).toLocaleString('en-GB', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    const bids = l.bid_count ? ` · ${l.bid_count} bid${l.bid_count === 1 ? '' : 's'}` : ''
    lines.push(`<div style="color:#71717a;font-size:13px">Ends ${escapeHtml(ends)}${bids}. Kompi never bids for you.</div>`)
  }

  const price = l.price != null ? priceText(l) : ''
  let subject: string
  let heading: string
  if (kinds.has('target_price')) {
    subject = `${itemTitle(item)} for ${price}: under your target`
    heading = `Under your target price: ${name}`
  } else if (drop) {
    subject = `Price drop: ${itemTitle(item)} now ${price}`
    heading = `A favourite dropped in price: ${name}`
  } else {
    subject = `Auction ending soon: ${itemTitle(item)}`
    heading = `A favourite auction ends soon: ${name}`
  }

  return { subject, html: layout(heading, 'Kompi checks your watchlist every 3 hours.', listingCard(l, lines.join('')), appUrl) }
}

/** New matches for an item that had been quiet for a week or more */
export function rareFindEmail(item: AlertItem, listings: AlertListing[], appUrl: string): Email {
  const many = listings.length > 1
  return {
    subject: `Rare find: ${many ? `${listings.length} new listings` : 'a new listing'} for ${itemTitle(item)}`,
    html: layout(
      `Rare find: ${escapeHtml(itemTitle(item))}`,
      'Nothing new had turned up for this item in over a week.',
      listingTable(listings),
      appUrl,
    ),
  }
}
