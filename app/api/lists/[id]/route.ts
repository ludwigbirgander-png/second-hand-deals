import { createClient } from '@/lib/supabase/server'
import { serverError } from '@/lib/api/errors'
import { parseListFields } from '@/lib/validate'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const fields = parseListFields(await request.json().catch(() => ({})), { partial: true })
  if (!fields.ok) return Response.json({ error: fields.error }, { status: 400 })
  const updates = fields.value
  if (Object.keys(updates).length === 0) return Response.json({ error: 'Nothing to change' }, { status: 400 })

  const { data, error } = await supabase
    .from('lists')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()

  if (error) return serverError('lists/[id]', error)
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
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
    .from('lists')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return serverError('lists/[id]', error)
  return Response.json({ ok: true })
}
