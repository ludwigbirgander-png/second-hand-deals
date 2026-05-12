import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [{ data: item }, { data: listings, error }] = await Promise.all([
    supabase.from('items').select('min_price, max_price').eq('id', id).single(),
    supabase.from('listings').select('*').eq('item_id', id).order('found_at', { ascending: false }),
  ])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const minPrice = item?.min_price ?? null
  const maxPrice = item?.max_price ?? null

  const filtered = (listings ?? []).filter((l: { price: number | null }) => {
    if (l.price == null) return true
    if (minPrice != null && l.price < minPrice) return false
    if (maxPrice != null && l.price > maxPrice) return false
    return true
  })

  return Response.json({ listings: filtered })
}
