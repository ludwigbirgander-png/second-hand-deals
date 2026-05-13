import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _db: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (!_db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '')
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!url || !key) throw new Error('Supabase env vars not configured — check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel')
    _db = createClient(url, key)
  }
  return _db
}
