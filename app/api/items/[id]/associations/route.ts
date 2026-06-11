import { createClient } from '@/lib/supabase/server'
import { ownsItem } from '@/lib/access'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { listIds = [], categoryIds = [] } = await request.json()

  if (!(await ownsItem(supabase, id, user.id))) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase.from('item_lists').delete().eq('item_id', id)
  if (listIds.length > 0) {
    await supabase.from('item_lists').insert(
      listIds.map((list_id: string) => ({ item_id: id, list_id }))
    )
  }

  await supabase.from('item_categories').delete().eq('item_id', id)
  if (categoryIds.length > 0) {
    await supabase.from('item_categories').insert(
      categoryIds.map((category_id: string) => ({ item_id: id, category_id }))
    )
  }

  return Response.json({ ok: true })
}
