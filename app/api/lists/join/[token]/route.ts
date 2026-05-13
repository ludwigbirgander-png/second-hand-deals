import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient()
  const { token } = await params

  // Use service role to read invite (bypasses RLS so unauthenticated preview works)
  const { data: invite, error } = await supabase
    .from('list_invites')
    .select('list_id, role, lists(name, user_id)')
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

  const { data: invite, error: inviteError } = await supabase
    .from('list_invites')
    .select('list_id, role')
    .eq('token', token)
    .single()

  if (inviteError || !invite) {
    return Response.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  // Check not already a member or owner
  const { data: list } = await supabase
    .from('lists')
    .select('user_id')
    .eq('id', invite.list_id)
    .single()

  if (list?.user_id === user.id) {
    return Response.json({ error: 'You own this list' }, { status: 400 })
  }

  const { error } = await supabase
    .from('list_members')
    .upsert(
      { list_id: invite.list_id, user_id: user.id, role: invite.role },
      { onConflict: 'list_id,user_id', ignoreDuplicates: false }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Also make sure list is set to collaborative
  await supabase
    .from('lists')
    .update({ visibility: 'collaborative' })
    .eq('id', invite.list_id)
    .eq('user_id', list?.user_id ?? '')

  return Response.json({ ok: true, list_id: invite.list_id })
}
