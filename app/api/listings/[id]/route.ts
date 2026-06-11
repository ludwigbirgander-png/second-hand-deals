import { createClient } from '@/lib/supabase/server'
import { ownsItem } from '@/lib/access'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { starred } = await request.json()
  if (typeof starred !== 'boolean') {
    return Response.json({ error: 'starred must be a boolean' }, { status: 400 })
  }

  // Verify the listing belongs to one of the caller's items
  const { data: listing } = await supabase
    .from('listings')
    .select('item_id')
    .eq('id', id)
    .maybeSingle()
  if (!listing || !(await ownsItem(supabase, listing.item_id, user.id))) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('listings')
    .update({ starred })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
