import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify list exists and is public
  const { data: list } = await supabase
    .from('lists')
    .select('id, visibility, user_id')
    .eq('id', id)
    .single()

  if (!list) return Response.json({ error: 'List not found' }, { status: 404 })
  if (list.visibility !== 'public') {
    return Response.json({ error: 'List is not public' }, { status: 400 })
  }
  if (list.user_id === user.id) {
    return Response.json({ error: 'Cannot follow your own list' }, { status: 400 })
  }

  const { error } = await supabase
    .from('list_follows')
    .insert({ list_id: id, user_id: user.id })

  if (error?.code === '23505') return Response.json({ ok: true }) // already following
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true }, { status: 201 })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('list_follows')
    .delete()
    .eq('list_id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
