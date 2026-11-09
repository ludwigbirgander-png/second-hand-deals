// Rate limits, counted in Postgres (hit_rate_limit, 20261110_rate_limits.sql) so
// they hold across serverless instances. They fail open: if the counter can't be
// reached, the request goes through and the problem is logged.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface Limit {
  key: string
  windowSeconds: number
  max: number
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const LIMITS = {
  /** Email invites: stops Kompi's address being used to mail strangers in bulk */
  inviteEmails: (userId: string): Limit => ({ key: `invite-email:user:${userId}`, windowSeconds: DAY, max: 20 }),
  /** The same search on the same item again. A changed search has a new signature, so it's always allowed. */
  sameSearch: (itemId: string, signature: string): Limit => ({ key: `search:item:${itemId}:${signature}`, windowSeconds: MINUTE, max: 1 }),
  /** All searches by one person */
  searchesPerUser: (userId: string): Limit => ({ key: `search:user:${userId}`, windowSeconds: HOUR, max: 40 }),
}

/** Seconds until the current window ends (windows line up on multiples of their length). */
export function retryAfterSeconds(windowSeconds: number, now = Date.now()): number {
  const into = Math.floor(now / 1000) % windowSeconds
  return Math.max(1, windowSeconds - into)
}

/** Allowed unless the database clearly said no. Errors and odd answers let the request through. */
export function allowedFrom(data: unknown, error: { message?: string } | null): boolean {
  if (error) return true
  return data !== false
}

/** Count one hit against `limit`. Pass the admin client (`db()`): only it may call the function. */
export async function rateLimit(client: SupabaseClient, limit: Limit): Promise<{ allowed: boolean; retryAfter: number }> {
  const { data, error } = await client.rpc('hit_rate_limit', {
    p_key: limit.key,
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  })
  if (error) console.warn(`rate limit ${limit.key.split(':')[0]} skipped:`, error.message)
  return { allowed: allowedFrom(data, error), retryAfter: retryAfterSeconds(limit.windowSeconds) }
}

/**
 * A short, stable fingerprint of what an item searches for: name, category and
 * filters (not hidden words, prices or alerts, which don't need a new search).
 */
export function searchSignature(item: { name: string; brand?: string | null; category?: string | null; filters?: unknown }): string {
  const text = JSON.stringify([
    `${item.brand ?? ''} ${item.name}`.trim().toLowerCase().replace(/\s+/g, ' '),
    item.category ?? null,
    sortKeys(item.filters ?? {}),
  ])
  // FNV-1a, 32 bit: plenty to tell one item's searches apart
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]))
  }
  return value
}
