import { createClient } from '@/lib/supabase/server'
import { getSitesForUser } from '@/lib/sites'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sites = await getSitesForUser(user.id)
  return Response.json(sites)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { sites } = await request.json()
  if (!Array.isArray(sites)) {
    return Response.json({ error: 'sites must be an array' }, { status: 400 })
  }

  // Per-user preference rows — never mutates the shared site_configs table
  const rows = sites
    .filter((s: { id?: string; enabled?: boolean }) => s.id && typeof s.enabled === 'boolean')
    .map((s: { id: string; enabled: boolean }) => ({
      user_id: user.id,
      site_config_id: s.id,
      enabled: s.enabled,
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) {
    return Response.json({ error: 'No valid site entries' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_site_prefs')
    .upsert(rows, { onConflict: 'user_id,site_config_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
