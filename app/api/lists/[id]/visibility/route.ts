import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { visibility } = await request.json()

  if (!['private', 'public', 'collaborative'].includes(visibility)) {
    return Response.json({ error: 'Invalid visibility' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lists')
    .update({ visibility })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Not found or not owner' }, { status: 404 })

  return Response.json(data)
}
