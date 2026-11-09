import { createClient } from '@/lib/supabase/server'
import { canManageList } from '@/lib/access'
import { inviteUsable, LINK_MAX_USES } from '@/lib/lists/invites'
import { serverError } from '@/lib/api/errors'

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
    .select('token, role, created_at, expires_at, max_uses, use_count')
    .eq('list_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('list invites failed:', error.message)
    return Response.json({ error: 'Couldn’t load the invites' }, { status: 500 })
  }
  // Only invites that still work: expired and used-up ones are hidden
  return Response.json((data ?? []).filter((invite) => inviteUsable(invite)))
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

  // A copyable link: shared with a group, so several uses; expires after INVITE_DAYS
  const { data, error } = await supabase
    .from('list_invites')
    .insert({ list_id: id, role, created_by: user.id, max_uses: LINK_MAX_USES })
    .select('token, role, created_at, expires_at, max_uses, use_count')
    .single()

  if (error) {
    console.error('create invite failed:', error.message)
    return Response.json({ error: 'Couldn’t create the link' }, { status: 500 })
  }
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

  if (error) return serverError('lists/[id]/invite', error)
  return Response.json({ ok: true })
}
