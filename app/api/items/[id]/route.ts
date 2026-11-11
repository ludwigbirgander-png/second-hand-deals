import { createClient } from '@/lib/supabase/server'
import { parseTargetPrice } from '@/lib/alerts/targetPrice'
import { sanitizeFilters } from '@/lib/categories'
import { serverError } from '@/lib/api/errors'
import { parseItemFields } from '@/lib/validate'
import { listsOf, type ItemRow } from '@/lib/itemRows'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // RLS scopes visibility (own items + items in shared lists)
  const { data, error } = await supabase
    .from('items')
    .select('*, item_lists(lists(*))')
    .eq('id', id)
    .maybeSingle()

  if (error) return serverError('items/[id]', error)
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })

  const { item_lists, ...rest } = data as ItemRow
  return Response.json({
    ...rest,
    lists: listsOf(item_lists),
    // Only the owner can refresh listings (see the scrape route)
    is_owner: rest.user_id === user.id,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { notify, target_price, category, filters } = body
  const fields = parseItemFields(body)
  if (!fields.ok) return Response.json({ error: fields.error }, { status: 400 })
  const target = parseTargetPrice(target_price)
  if (target_price != null && target_price !== '' && target === undefined) {
    return Response.json({ error: 'Target price must be a whole number of kronor' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('items')
    .update({
      ...fields.value,
      ...(notify !== undefined && { notify }),
      ...(target !== undefined && { target_price: target }),
      // Both or neither: filters only make sense for their category
      ...(category !== undefined && sanitizeFilters(category, filters)),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()

  if (error) return serverError('items/[id]', error)
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

  if (error) return serverError('items/[id]', error)
  return new Response(null, { status: 204 })
}
