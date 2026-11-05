import { createClient } from '@/lib/supabase/server'
import { ownsItem } from '@/lib/access'
import { markUpdate } from '@/lib/marks'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // starred: favourite or not. removed: hide it (kept, so later searches don't bring it back) or restore it.
  const { starred, removed } = await request.json()
  if (typeof starred !== 'boolean' && typeof removed !== 'boolean') {
    return Response.json({ error: 'Send starred or removed as a boolean' }, { status: 400 })
  }
  const update: { starred?: boolean; removed_at?: string | null; removed_word?: null } = {}
  if (typeof starred === 'boolean') update.starred = starred
  if (typeof removed === 'boolean') {
    update.removed_at = removed ? new Date().toISOString() : null
    update.removed_word = null
    // A removed listing is no longer a favourite
    if (removed) update.starred = false
  }

  // Database rules only return listings the caller can see (own items, or lists they follow or belong to)
  const { data: listing } = await supabase
    .from('listings')
    .select('item_id')
    .eq('id', id)
    .maybeSingle()
  if (!listing) return Response.json({ error: 'Not found' }, { status: 404 })

  // Someone else's item: save it as this person's own mark, so the owner and
  // other followers aren't affected
  if (!(await ownsItem(supabase, listing.item_id, user.id))) {
    const mark = markUpdate({ starred, removed })
    const { data, error } = await supabase
      .from('listing_marks')
      .upsert({ user_id: user.id, listing_id: id, ...mark, updated_at: new Date().toISOString() }, { onConflict: 'user_id,listing_id' })
      .select('listing_id, starred, removed_at')
      .single()
    if (error) {
      console.error('listing mark failed:', error.message)
      return Response.json({ error: 'Couldn’t save that. Try again.' }, { status: 500 })
    }
    return Response.json(data)
  }

  const { data, error } = await supabase
    .from('listings')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
