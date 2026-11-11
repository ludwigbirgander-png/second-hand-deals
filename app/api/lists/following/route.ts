import { createClient } from '@/lib/supabase/server'
import { serverError } from '@/lib/api/errors'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: follows, error: followsError } = await supabase
    .from('list_follows')
    .select('list_id')
    .eq('user_id', user.id)

  if (followsError) return serverError('lists/following', followsError)

  const listIds = (follows ?? []).map((f: { list_id: string }) => f.list_id)
  if (listIds.length === 0) return Response.json([])

  const { data: lists, error: listsError } = await supabase
    .from('lists')
    .select('*')
    .in('id', listIds)

  if (listsError) return serverError('lists/following', listsError)
  return Response.json(lists ?? [])
}
