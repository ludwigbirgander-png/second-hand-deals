import { createClient } from '@/lib/supabase/server'
import { serverError } from '@/lib/api/errors'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('items')
    .update({ last_viewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return serverError('items/[id]/viewed', error)

  return Response.json({ ok: true })
}
