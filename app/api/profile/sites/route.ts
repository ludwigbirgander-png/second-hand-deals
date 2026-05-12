import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('site_configs')
    .select('*')
    .order('site_name')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { sites } = await request.json()
  if (!Array.isArray(sites)) {
    return Response.json({ error: 'sites must be an array' }, { status: 400 })
  }

  for (const { id, enabled } of sites) {
    await supabase
      .from('site_configs')
      .update({ enabled })
      .eq('id', id)
  }

  return Response.json({ ok: true })
}
