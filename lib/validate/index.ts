// Input checks for items and lists, shared by the create and edit routes. The
// database has matching limits (20261110_input_limits.sql) for direct writes.
import { COLORS, type Color } from '../colors'

export const ITEM_NAME_MAX = 120
export const LIST_NAME_MAX = 60
/** 10 million kronor: far above anything second-hand, well inside an integer */
export const PRICE_MAX = 10_000_000

type Result<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string) => ({ ok: false as const, error })

/** A price from a request: a whole number of kronor, null when empty, undefined when invalid. */
export function parsePrice(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isInteger(n) && n >= 0 && n <= PRICE_MAX ? n : undefined
}

/** A trimmed text of at most `max` characters, or null if missing/empty. Undefined when too long or not text. */
function parseText(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return undefined
  const text = v.trim()
  if (text === '') return null
  return text.length <= max ? text : undefined
}

export interface ItemFields {
  name: string
  brand: string | null
  min_price: number | null
  max_price: number | null
}

/** The name, brand and price range of an item, checked the same way on create and edit. */
export function parseItemFields(body: Record<string, unknown>): Result<ItemFields> {
  const name = parseText(body.name, ITEM_NAME_MAX)
  if (name === undefined) return fail(`Keep the name under ${ITEM_NAME_MAX} characters`)
  if (name === null) return fail('Name is required')
  const brand = parseText(body.brand, ITEM_NAME_MAX)
  if (brand === undefined) return fail(`Keep the brand under ${ITEM_NAME_MAX} characters`)
  const min = parsePrice(body.min_price)
  const max = parsePrice(body.max_price)
  if (min === undefined || max === undefined) return fail('Prices must be whole numbers of kronor')
  return { ok: true, value: { name, brand, min_price: min, max_price: max } }
}

export interface ListFields {
  name?: string
  color?: Color
}

/**
 * A list's name and colour. On create the name is required; on edit (`partial`)
 * both are optional and only what's sent is checked.
 */
export function parseListFields(body: Record<string, unknown>, { partial = false } = {}): Result<ListFields> {
  const value: ListFields = {}
  if (!partial || body.name !== undefined) {
    const name = parseText(body.name, LIST_NAME_MAX)
    if (name === undefined) return fail(`Keep the list name under ${LIST_NAME_MAX} characters`)
    if (name === null) return fail('Name is required')
    value.name = name
  }
  if (body.color !== undefined && body.color !== null && body.color !== '') {
    if (!COLORS.includes(body.color as Color)) return fail('Pick one of the list colours')
    value.color = body.color as Color
  }
  return { ok: true, value }
}
