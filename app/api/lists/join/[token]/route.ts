import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Use service role so anyone with the link can preview before signing in
  const { data: invite, error } = await db()
    .from('list_invites')
    .select('list_id, role, lists(name)')
    .eq('token', token)
    .single()

  if (error || !invite) return Response.json({ error: 'Invalid or expired invite' }, { status: 404 })

  return Response.json({
    list_id: invite.list_id,
    list_name: (invite.lists as any)?.name,
    role: invite.role,
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params

  // Service role so the joining user can read the invite regardless of RLS
  const { data: invite, error: inviteError } = await db()
    .from('list_invites')
    .select('list_id, role')
    .eq('token', token)
    .single()

  if (inviteError || !invite) {
    return Response.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  const { data: list } = await db()
    .from('lists')
    .select('user_id')
    .eq('id', invite.list_id)
    .single()

  if (list?.user_id === user.id) {
    return Response.json({ error: 'You own this list' }, { status: 400 })
  }

  // Insert via service role — RLS INSERT policy blocks non-owners/non-admins
  const { error } = await db()
    .from('list_members')
    .upsert(
      { list_id: invite.list_id, user_id: user.id, role: invite.role },
      { onConflict: 'list_id,user_id', ignoreDuplicates: false }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Ensure list is collaborative (update via service role since joiner isn't owner)
  await db()
    .from('lists')
    .update({ visibility: 'collaborative' })
    .eq('id', invite.list_id)

  return Response.json({ ok: true, list_id: invite.list_id })
}
