// Where to send someone after signing in. Only paths on this site are allowed, so a
// link like /login?next=https://evil.example can't send people somewhere else.

export const DEFAULT_AFTER_SIGN_IN = '/watchlist'

export function safeNextPath(input: string | null | undefined, fallback = DEFAULT_AFTER_SIGN_IN): string {
  if (!input) return fallback
  // A single leading slash; not "//host" or "/\host" (browsers treat both as another site)
  if (!input.startsWith('/') || input.startsWith('//') || input.startsWith('/\\')) return fallback
  // No control characters or whitespace tricks
  if (/[\u0000-\u001f\u007f\s]/.test(input)) return fallback
  return input
}

/** `/login?next=…` for coming back to `path` after signing in. */
export function signInHref(page: '/login' | '/signup', path: string): string {
  return `${page}?next=${encodeURIComponent(safeNextPath(path))}`
}
