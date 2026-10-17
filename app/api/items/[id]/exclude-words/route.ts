import { createClient } from '@/lib/supabase/server'
import { ownsItem } from '@/lib/access'
import { hasExcludedWord } from '@/lib/search/match'

type Params = { params: Promise<{ id: string }> }

async function readWord(request: Request): Promise<string | null> {
  const body = await request.json().catch(() => null)
  const word = typeof body?.word === 'string' ? body.word.toLowerCase().trim() : ''
  return word.length >= 2 && word.length <= 40 && !/\s/.test(word) ? word : null
}

/**
 * Hide a word for this item: future searches drop titles containing it, and
 * listings already found with it are removed (favourites are kept).
 */
export async function POST(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const word = await readWord(request)
  if (!word) return Response.json({ error: 'Send one word' }, { status: 400 })
  if (!(await ownsItem(supabase, id, user.id))) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: item } = await supabase.from('items').select('exclude_words').eq('id', id).single()
  const words: string[] = item?.exclude_words ?? []
  const next = words.includes(word) ? words : [...words, word]
  const { error } = await supabase.from('items').update({ exclude_words: next }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title')
    .eq('item_id', id)
    .eq('starred', false)
    .is('removed_at', null)
  const hidden = (listings ?? []).filter((l: { title: string }) => hasExcludedWord(l.title, [word])).map((l: { id: string }) => l.id)
  const removedAt = new Date().toISOString()
  if (hidden.length > 0) {
    await supabase.from('listings').update({ removed_at: removedAt, removed_word: word }).in('id', hidden)
  }

  return Response.json({ word, exclude_words: next, hidden, removed_at: removedAt })
}

/** Stop hiding a word, and bring back the listings it removed. */
export async function DELETE(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const word = await readWord(request)
  if (!word) return Response.json({ error: 'Send one word' }, { status: 400 })
  if (!(await ownsItem(supabase, id, user.id))) return Response.json({ error: 'Not found' }, { status: 404 })

  const { data: item } = await supabase.from('items').select('exclude_words').eq('id', id).single()
  const next = (item?.exclude_words ?? []).filter((w: string) => w !== word)
  const { error } = await supabase.from('items').update({ exclude_words: next }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: restored } = await supabase
    .from('listings')
    .update({ removed_at: null, removed_word: null })
    .eq('item_id', id)
    .eq('removed_word', word)
    .select('id')

  return Response.json({ word, exclude_words: next, restored: (restored ?? []).map((l: { id: string }) => l.id) })
}
