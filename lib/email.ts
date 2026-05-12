import { Resend } from 'resend'
import type { Listing, Item } from './types'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendNewListingsEmail(item: Item, newListings: Listing[]) {
  const toEmail = process.env.NOTIFICATION_EMAIL
  const resend = getResend()
  if (!toEmail || !resend) return

  const rows = newListings
    .map(
      (l) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${l.site}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${l.title}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${l.price != null ? `${l.price} ${l.currency}` : '–'}</td>
          <td style="padding:8px;border-bottom:1px solid #eee"><a href="${l.url}">View</a></td>
        </tr>`
    )
    .join('')

  await resend.emails.send({
    from: 'Second Hand Deals <noreply@resend.dev>',
    to: toEmail,
    subject: `${newListings.length} new listing${newListings.length > 1 ? 's' : ''} for "${item.name}"`,
    html: `
      <h2>New listings for <strong>${item.name}</strong></h2>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Site</th>
            <th style="padding:8px;text-align:left">Title</th>
            <th style="padding:8px;text-align:left">Price</th>
            <th style="padding:8px;text-align:left">Link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `,
  })
}
