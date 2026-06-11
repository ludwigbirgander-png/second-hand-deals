import type { SupabaseClient } from '@supabase/supabase-js'

/** True if the user owns the item. */
export async function ownsItem(
  supabase: SupabaseClient,
  itemId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

/** True if the user owns the list, or is an admin member of it. */
export async function canManageList(
  supabase: SupabaseClient,
  listId: string,
  userId: string
): Promise<boolean> {
  const { data: list } = await supabase
    .from('lists')
    .select('user_id')
    .eq('id', listId)
    .maybeSingle()
  if (!list) return false
  if (list.user_id === userId) return true

  const { data: membership } = await supabase
    .from('list_members')
    .select('role')
    .eq('list_id', listId)
    .eq('user_id', userId)
    .maybeSingle()
  return membership?.role === 'admin'
}
