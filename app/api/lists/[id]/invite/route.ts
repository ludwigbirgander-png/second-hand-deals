import { createClient } from '@/lib/supabase/server'
import { canManageList } from '@/lib/access'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!(await canManageList(supabase, id, user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('list_invites')
    .select('token, role, created_at')
    .eq('list_id', id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { role = 'editor' } = await request.json().catch(() => ({}))

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (!(await canManageList(supabase, id, user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('list_invites')
    .insert({ list_id: id, role, created_by: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { token } = await request.json()

  if (!(await canManageList(supabase, id, user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('list_invites')
    .delete()
    .eq('list_id', id)
    .eq('token', token)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
