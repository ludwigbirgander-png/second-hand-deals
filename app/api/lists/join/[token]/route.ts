import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { inviteUsable, INVITE_GONE } from '@/lib/lists/invites'

const gone = () => Response.json({ error: INVITE_GONE }, { status: 404 })

/** Find an invite by token (admin key: the person joining can't read invites). Null if it can't be used. */
async function findUsableInvite(token: string) {
  const { data: invite } = await db()
    .from('list_invites')
    .select('*, lists(name)')
    .eq('token', token)
    .maybeSingle()
  return invite && inviteUsable(invite) ? invite : null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Anyone with the link can preview it before signing in
  const invite = await findUsableInvite(token)
  if (!invite) return gone()

  return Response.json({
    list_id: invite.list_id,
    list_name: (invite.lists as { name?: string } | null)?.name,
    role: invite.role,
  })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Sign in to join this list' }, { status: 401 })

  const { token } = await params

  const invite = await findUsableInvite(token)
  if (!invite) return gone()

  const { data: list } = await db()
    .from('lists')
    .select('user_id')
    .eq('id', invite.list_id)
    .single()

  if (list?.user_id === user.id) {
    return Response.json({ error: 'You own this list' }, { status: 400 })
  }

  // Already a member with this role: nothing to do, and the invite isn't used up
  const { data: membership } = await db()
    .from('list_members')
    .select('role')
    .eq('list_id', invite.list_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membership?.role === invite.role) {
    return Response.json({ ok: true, list_id: invite.list_id })
  }

  // Count one use, checking expiry and the use limit in the same step, so two
  // people can't both use a single-use invite
  const { data: redeemed, error: redeemError } = await db().rpc('redeem_list_invite', { p_token: token })
  if (redeemError) {
    console.error('redeem_list_invite failed:', redeemError.message)
    return Response.json({ error: 'Couldn’t join the list. Try again.' }, { status: 500 })
  }
  const use = (redeemed as { list_id: string; role: string }[] | null)?.[0]
  if (!use) return gone()

  // Insert via service role: the database only lets owners and admins add members
  const { error } = await db()
    .from('list_members')
    .upsert(
      { list_id: use.list_id, user_id: user.id, role: use.role },
      { onConflict: 'list_id,user_id', ignoreDuplicates: false }
    )
  if (error) {
    console.error('join list failed:', error.message)
    return Response.json({ error: 'Couldn’t join the list. Try again.' }, { status: 500 })
  }

  // Ensure list is collaborative (update via service role since joiner isn't owner)
  await db()
    .from('lists')
    .update({ visibility: 'collaborative' })
    .eq('id', use.list_id)

  return Response.json({ ok: true, list_id: use.list_id })
}
