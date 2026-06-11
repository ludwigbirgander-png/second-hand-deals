import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, brand, min_price, max_price, notify } = await request.json()

  if (!name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('items')
    .update({
      name: name.trim(),
      brand: brand?.trim() || null,
      min_price: min_price ?? null,
      max_price: max_price ?? null,
      ...(notify !== undefined && { notify }),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
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

  // Verify ownership before touching related rows
  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!item) return Response.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('listings').delete().eq('item_id', id)
  const { error } = await supabase.from('items').delete().eq('id', id).eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
