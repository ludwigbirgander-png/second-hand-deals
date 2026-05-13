import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Own lists
  const { data: ownLists, error: ownError } = await supabase
    .from('lists')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (ownError) return Response.json({ error: ownError.message }, { status: 500 })

  // Collaborative lists user is a member of (but not owner) — two-step to avoid join shape ambiguity
  const { data: memberRows, error: memberError } = await supabase
    .from('list_members')
    .select('list_id, role')
    .eq('user_id', user.id)

  if (memberError) return Response.json({ error: memberError.message }, { status: 500 })

  const memberListIds = (memberRows ?? []).map((r: any) => r.list_id)
  let sharedLists: any[] = []
  if (memberListIds.length > 0) {
    const { data: memberListData } = await supabase
      .from('lists')
      .select('*')
      .in('id', memberListIds)
      .neq('user_id', user.id)
    const roleMap = Object.fromEntries((memberRows ?? []).map((r: any) => [r.list_id, r.role]))
    sharedLists = (memberListData ?? []).map((list: any) => ({ ...list, userRole: roleMap[list.id] }))
  }

  return Response.json({ own: ownLists ?? [], shared: sharedLists })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, color = 'zinc' } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('lists')
    .insert({ name: name.trim(), color, user_id: user.id, visibility: 'private' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
