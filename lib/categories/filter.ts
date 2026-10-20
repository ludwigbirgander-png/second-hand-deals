// Does a listing pass an item's filters? Runs after the title match, for whatever a site couldn't filter itself.
import type { Category, FilterKey, ItemFilters, ListingAttributes, NumberRange, ParsedSize, SizeFilter } from './types'
import { conditionRank, visibleFields } from './index'
import { hasPattern, tokens } from './words'

export interface FilterInput {
  title: string
  priceKind?: string | null
  auctionEndsAt?: string | null
  attributes: ListingAttributes
}

export interface FilterResult {
  keep: boolean
  /** Filtered details the listing didn't state */
  unstated: FilterKey[]
}

/** Built-in junk words for the category, except ones that are part of the search ("Nike skosnören") */
export function hasNegativeWord(title: string, query: string, category: Category | undefined): boolean {
  if (!category) return false
  const queryWords = tokens(query)
  const active = category.negativeWords.filter((p) => !hasPattern(queryWords, [p]))
  return hasPattern(tokens(title), active)
}

export function isAuction(l: Pick<FilterInput, 'priceKind' | 'auctionEndsAt'>): boolean {
  return l.priceKind === 'bid' || l.priceKind === 'start' || (l.priceKind == null && !!l.auctionEndsAt)
}

/** 'yes' / 'no', or 'unknown' when the listing doesn't state a size in the filter's system */
function sizeMatches(size: ParsedSize | undefined, filter: SizeFilter, shoes: boolean): 'yes' | 'no' | 'unknown' {
  if (!size) return 'unknown'
  switch (filter.system) {
    case 'letter':
      if (!size.letter?.length) return 'unknown'
      return size.letter.some((l) => filter.values.includes(l)) ? 'yes' : 'no'
    case 'eu':
      if (size.eu == null) return 'unknown'
      // Shoes: 42, 42.5 and 42 2/3 all count as 42
      return filter.values.includes(shoes ? Math.floor(size.eu) : size.eu) ? 'yes' : 'no'
    case 'kids':
      if (size.kids == null) return 'unknown'
      return filter.values.includes(size.kids) ? 'yes' : 'no'
    case 'jeans': {
      const checks: ('yes' | 'no' | 'unknown')[] = []
      if (filter.waist.length) checks.push(size.waist == null ? 'unknown' : filter.waist.includes(size.waist) ? 'yes' : 'no')
      if (filter.length.length) checks.push(size.length == null ? 'unknown' : filter.length.includes(size.length) ? 'yes' : 'no')
      if (checks.includes('no')) return 'no'
      return checks.includes('unknown') ? 'unknown' : 'yes'
    }
  }
}

/**
 * Checks a listing against the item's filters. A listing that contradicts a filter is dropped.
 * One that doesn't state a detail is kept and reported in `unstated`, unless the item is strict
 * and this is the final check (`final: false` is a cheap first pass before enrichment).
 */
export function checkListing(
  l: FilterInput,
  filters: ItemFilters,
  category: Category | undefined,
  { final = true }: { final?: boolean } = {},
): FilterResult {
  const a = l.attributes
  const unstated: FilterKey[] = []
  const drop = { keep: false, unstated: [] }

  if (filters.saleType && (filters.saleType === 'auction') !== isAuction(l)) return drop

  if (filters.condition) {
    if (!a.condition) unstated.push('condition')
    else if (conditionRank(a.condition) > conditionRank(filters.condition)) return drop
  }

  if (category) {
    for (const field of visibleFields(category, filters)) {
      const want = filters[field.key]
      const have = a[field.key]
      switch (field.kind) {
        case 'size':
          break // checked last, below
        case 'options': {
          const wanted = want as string[] | undefined
          if (!wanted?.length) break
          if (field.key === 'department') {
            if (!a.department) { unstated.push('department'); break }
            const ok = wanted.includes(a.department) ||
              (a.department === 'unisex' && wanted.some((d) => d === 'women' || d === 'men'))
            if (!ok) return drop
            break
          }
          const found = have as string[] | undefined
          if (!found?.length) unstated.push(field.key)
          else if (!found.some((v) => wanted.includes(v))) return drop
          break
        }
        case 'min':
          if (typeof want !== 'number') break
          if (typeof have !== 'number') unstated.push(field.key)
          else if (have < want) return drop
          break
        case 'range': {
          if (!want || typeof want !== 'object') break
          const { from, to } = want as NumberRange
          if (typeof have !== 'number') unstated.push(field.key)
          else if ((from != null && have < from) || (to != null && have > to)) return drop
          break
        }
        case 'toggle':
          // 'allow': off hides listings that say so (second sort). 'require': on needs the listing to say so.
          if (field.toggle === 'allow') {
            if (want !== true && have === true) return drop
          } else if (want === true && have !== true) {
            unstated.push(field.key)
          }
          break
      }
    }

    if (filters.size) {
      const m = sizeMatches(a.size, filters.size, category.id === 'shoes')
      if (m === 'no') return drop
      if (m === 'unknown') unstated.push('size')
    }
  }

  if (final && filters.strict && unstated.length > 0) return drop
  return { keep: true, unstated }
}
