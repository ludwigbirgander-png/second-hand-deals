/**
 * Escape a string for safe interpolation into HTML (text content and
 * double-quoted attribute values). Scraped listing titles and user-provided
 * names are untrusted and must always pass through this before being
 * embedded in email HTML.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only allow http(s) URLs in href attributes; everything else becomes "#". */
export function safeHref(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#'
}
