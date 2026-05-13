import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, userId } = await params
  const { role } = await request.json()

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Only owner can change roles
  const { data: list } = await supabase.from('lists').select('user_id').eq('id', id).single()
  if (!list || list.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('list_members')
    .update({ role })
    .eq('list_id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, userId } = await params

  // Owner can remove anyone; members can remove themselves
  const { data: list } = await supabase.from('lists').select('user_id').eq('id', id).single()
  const isOwner = list?.user_id === user.id
  const isSelf = userId === user.id

  if (!isOwner && !isSelf) {
    const { data: membership } = await supabase
      .from('list_members')
      .select('role')
      .eq('list_id', id)
      .eq('user_id', user.id)
      .single()
    if (!membership || membership.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('list_members')
    .delete()
    .eq('list_id', id)
    .eq('user_id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
