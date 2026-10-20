// Shared setup for the background jobs (scrape-and-alert.ts, weekly-digest.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { Email } from '../lib/alerts/email.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

export const db: SupabaseClient = createClient(supabaseUrl, serviceKey)

export const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '') || 'https://second-hand-deals.vercel.app'

const resendKey = process.env.RESEND_API_KEY
const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const resend = resendKey ? new Resend(resendKey) : null

/** False when RESEND_API_KEY is missing: emails are printed instead of sent, and nothing is logged as sent */
export const canSend = resend != null

/** Sends an email; returns true only if Resend accepted it */
export async function sendEmail(to: string, email: Email): Promise<boolean> {
  if (!resend) {
    console.log(`  [no RESEND_API_KEY] would send to ${to}: ${email.subject}`)
    return false
  }
  const { error } = await resend.emails.send({ from: `Kompi <${fromEmail}>`, to, subject: email.subject, html: email.html })
  if (error) {
    console.error(`  Email to ${to} failed:`, error.message)
    return false
  }
  return true
}

const emailCache = new Map<string, string | null>()

export async function emailFor(userId: string): Promise<string | null> {
  if (!emailCache.has(userId)) {
    const { data } = await db.auth.admin.getUserById(userId)
    emailCache.set(userId, data?.user?.email ?? null)
  }
  return emailCache.get(userId) ?? null
}

export interface UserSettings {
  weekly_email: boolean
  alerts_enabled: boolean
  last_digest_at: string | null
}

const DEFAULT_SETTINGS: UserSettings = { weekly_email: true, alerts_enabled: true, last_digest_at: null }

/** Email settings per user. Users without a profiles row get the defaults. */
export async function loadSettings(): Promise<(userId: string) => UserSettings> {
  const rows = await fetchAll<UserSettings & { id: string }>(() =>
    db.from('profiles').select('id, weekly_email, alerts_enabled, last_digest_at'))
  const map = new Map(rows.map((r) => [r.id, r]))
  return (userId) => map.get(userId) ?? DEFAULT_SETTINGS
}

/** Reads every row of a query, a page at a time (PostgREST returns at most 1000 per request). */
export async function fetchAll<T>(query: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> }): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}
