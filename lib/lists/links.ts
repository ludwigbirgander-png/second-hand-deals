// Which lists an item may be put in. You can add your item to a list you own, or
// to a collaborative list where you're an owner, admin or editor member (not a
// viewer). The database enforces the same rule (20261109_item_lists_check.sql).
import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_LISTS_PER_ITEM = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const EDIT_ROLES = ['owner', 'admin', 'editor'] as const

/** The list ids from a request: unique UUID strings, at most 50. Null if invalid. */
export function parseListIds(input: unknown): string[] | null {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input) || input.length > MAX_LISTS_PER_ITEM) return null
  if (!input.every((id) => typeof id === 'string' && UUID.test(id))) return null
  return [...new Set((input as string[]).map((id) => id.toLowerCase()))]
}

/** What to add and remove to go from the current links to the requested ones. */
export function diffLinks(current: string[], requested: string[]) {
  const have = new Set(current)
  const want = new Set(requested)
  return {
    add: requested.filter((id) => !have.has(id)),
    remove: current.filter((id) => !want.has(id)),
  }
}

/** The subset of `listIds` the user may add items to. */
export async function editableListIds(supabase: SupabaseClient, userId: string, listIds: string[]): Promise<Set<string>> {
  if (listIds.length === 0) return new Set()
  const [{ data: own }, { data: memberships }] = await Promise.all([
    supabase.from('lists').select('id').in('id', listIds).eq('user_id', userId),
    supabase
      .from('list_members')
      .select('list_id, role, lists!inner(visibility)')
      .eq('user_id', userId)
      .in('list_id', listIds)
      .in('role', [...EDIT_ROLES])
      .eq('lists.visibility', 'collaborative'),
  ])
  return new Set([
    ...(own ?? []).map((l: { id: string }) => l.id),
    ...(memberships ?? []).map((m: { list_id: string }) => m.list_id),
  ])
}
