import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { Resend } from 'resend'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('list_members')
    .select('user_id, role, joined_at')
    .eq('list_id', id)
    .order('joined_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Enrich with emails from auth.users via service role
  const userIds = (data ?? []).map((m: any) => m.user_id)
  const emails: Record<string, string> = {}
  const displayNames: Record<string, string | null> = {}

  if (userIds.length > 0) {
    const { data: profiles } = await db()
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)

    for (const p of profiles ?? []) {
      displayNames[p.id] = p.display_name
    }

    // Get emails via admin API
    for (const uid of userIds) {
      try {
        const { data: u } = await db().auth.admin.getUserById(uid)
        if (u?.user?.email) emails[uid] = u.user.email
      } catch { /* skip */ }
    }
  }

  // Also include the owner
  const { data: list } = await supabase
    .from('lists')
    .select('user_id')
    .eq('id', id)
    .single()

  const members = (data ?? []).map((m: any) => ({
    user_id: m.user_id,
    email: emails[m.user_id] ?? '',
    display_name: displayNames[m.user_id] ?? null,
    role: m.role,
    joined_at: m.joined_at,
  }))

  if (list && !members.find((m: any) => m.user_id === list.user_id)) {
    try {
      const { data: ownerUser } = await db().auth.admin.getUserById(list.user_id)
      members.unshift({
        user_id: list.user_id,
        email: ownerUser?.user?.email ?? '',
        display_name: displayNames[list.user_id] ?? null,
        role: 'owner',
        joined_at: '',
      })
    } catch { /* skip */ }
  }

  return Response.json(members)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { email, role = 'editor' } = await request.json()

  if (!email?.trim()) return Response.json({ error: 'Email is required' }, { status: 400 })
  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Verify user has permission (owner or admin)
  const { data: list } = await supabase.from('lists').select('user_id, name').eq('id', id).single()
  if (!list) return Response.json({ error: 'List not found' }, { status: 404 })

  const isOwner = list.user_id === user.id
  if (!isOwner) {
    const { data: membership } = await supabase
      .from('list_members')
      .select('role')
      .eq('list_id', id)
      .eq('user_id', user.id)
      .single()
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Create invite token
  const { data: invite, error: inviteError } = await supabase
    .from('list_invites')
    .insert({ list_id: id, role, created_by: user.id })
    .select()
    .single()

  if (inviteError) return Response.json({ error: inviteError.message }, { status: 500 })

  // Send email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://second-hand-deals.vercel.app'
  const joinUrl = `${appUrl}/lists/join/${invite.token}`
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: 'Compy <noreply@resend.dev>',
      to: email.trim(),
      subject: `You've been invited to a list on Compy`,
      html: `
        <p>You've been invited to join the list <strong>${list.name}</strong> on Compy.</p>
        <p><a href="${joinUrl}" style="background:#18181b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Join list</a></p>
        <p style="color:#999;font-size:12px">Or copy this link: ${joinUrl}</p>
      `,
    })
  }

  return Response.json({ ok: true, joinUrl })
}
