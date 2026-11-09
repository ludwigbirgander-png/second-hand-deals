import { createClient } from '@/lib/supabase/server'
import { ownsItem } from '@/lib/access'
import { parseListIds, diffLinks, editableListIds } from '@/lib/lists/links'

/** Set which lists an item is in. Only adds and removes what changed. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const listIds = parseListIds(body?.listIds)
  if (!listIds) return Response.json({ error: 'Send listIds as a list of up to 50 list ids' }, { status: 400 })

  if (!(await ownsItem(supabase, id, user.id))) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: current, error: currentError } = await supabase
    .from('item_lists')
    .select('list_id')
    .eq('item_id', id)
  if (currentError) {
    console.error('item_lists read failed:', currentError.message)
    return Response.json({ error: 'Couldn’t save the lists. Try again.' }, { status: 500 })
  }
  const { add, remove } = diffLinks((current ?? []).map((r: { list_id: string }) => r.list_id), listIds)

  // New lists must be ones you may edit. Checked before changing anything, so a
  // refused request leaves the item's lists as they were. Taking your own item
  // out of a list is always allowed.
  if (add.length > 0) {
    const editable = await editableListIds(supabase, user.id, add)
    if (add.some((listId) => !editable.has(listId))) {
      return Response.json({ error: 'You can’t add items to that list' }, { status: 403 })
    }
  }

  if (remove.length > 0) {
    const { error } = await supabase.from('item_lists').delete().eq('item_id', id).in('list_id', remove)
    if (error) {
      console.error('item_lists delete failed:', error.message)
      return Response.json({ error: 'Couldn’t save the lists. Try again.' }, { status: 500 })
    }
  }
  if (add.length > 0) {
    const { error } = await supabase.from('item_lists').insert(add.map((list_id) => ({ item_id: id, list_id })))
    if (error) {
      console.error('item_lists insert failed:', error.message)
      return Response.json({ error: 'Couldn’t save the lists. Try again.' }, { status: 500 })
    }
  }

  return Response.json({ ok: true, added: add.length, removed: remove.length })
}
