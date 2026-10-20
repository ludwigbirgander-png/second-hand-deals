import { createClient } from '@/lib/supabase/server'

export interface NotificationSettings {
  weekly_email: boolean
  alerts_enabled: boolean
}

const DEFAULTS: NotificationSettings = { weekly_email: true, alerts_enabled: true }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // No profiles row yet means the defaults
  const { data, error } = await supabase
    .from('profiles')
    .select('weekly_email, alerts_enabled')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ...DEFAULTS, ...data })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const update: Partial<NotificationSettings> = {}
  if (typeof body.weekly_email === 'boolean') update.weekly_email = body.weekly_email
  if (typeof body.alerts_enabled === 'boolean') update.alerts_enabled = body.alerts_enabled
  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...update }, { onConflict: 'id' })
    .select('weekly_email, alerts_enabled')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
