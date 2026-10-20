// Filters pushed down to each site's own search, so fewer wrong listings come back.
// Kompi still checks every listing afterwards (filter.ts); these only narrow the request.
import type { Category, ConditionGrade, Department, ItemFilters, ParsedSize } from './types'
import type { SiteAttributes } from './attributes'
import { LETTER_SIZES, conditionRank, getCategory } from './index'
import { normalizeCondition } from './attributes'

export interface SearchOptions {
  category?: Category
  filters?: ItemFilters
}

const AUCTION_ONLY = new Set(['Auctionet', 'Bukowskis'])
const FIXED_ONLY = new Set(['Blocket', 'Sellpy', 'Vinted', 'Facebook Marketplace'])

/** True if nothing on this site can pass the sale-type filter, so it needn't be searched */
export function siteExcluded(site: string, filters: ItemFilters | undefined): boolean {
  if (filters?.saleType === 'auction') return FIXED_ONLY.has(site)
  if (filters?.saleType === 'fixed') return AUCTION_ONLY.has(site)
  return false
}

const atLeast = (min: ConditionGrade | undefined, grade: ConditionGrade) => !min || conditionRank(grade) <= conditionRank(min)

// ─── Sellpy (Algolia filters) ────────────────────────────────────────────────

// Sellpy files unisex adult items under both the women's and men's trees
const SELLPY_TREES: Record<Department, string[]> = { women: ['Kvinna'], men: ['Man'], kids: ['Barn'], unisex: ['Kvinna', 'Man'] }
const SELLPY_CONDITIONS: Record<string, ConditionGrade> = {
  Nytt: 'new', 'Mycket bra': 'like_new', Bra: 'good', Normalt: 'fair', Acceptabelt: 'fair', Dåligt: 'parts',
}

const quote = (v: string) => `"${v.replace(/"/g, '\\"')}"`
const anyOf = (attr: string, values: string[]) => `(${values.map((v) => `${attr}:${quote(v)}`).join(' OR ')})`
const uniq = <T,>(xs: T[]) => Array.from(new Set(xs))

function sellpySizes(category: Category, filters: ItemFilters): string[] {
  const s = filters.size
  if (!s) return []
  const depts = filters.department?.length ? filters.department : ['women', 'men']
  const adult = uniq(depts.flatMap((d) => (d === 'men' ? ['MEN'] : d === 'kids' ? [] : ['WMN'])))
  switch (s.system) {
    case 'letter':
      // Sellpy writes XXL as 2XL and also has in-between sizes like S/M
      return s.values.flatMap((v) => {
        const code = v === 'XXL' ? '2XL' : v
        const i = LETTER_SIZES.indexOf(v)
        const between = [i > 0 ? `${LETTER_SIZES[i - 1]}/${v}` : null, i < LETTER_SIZES.length - 1 ? `${v}/${LETTER_SIZES[i + 1]}` : null]
        return adult.flatMap((p) => [code, ...between].filter(Boolean).map((x) => `${p}-INT-${x}`))
      })
    case 'eu':
      if (category.id === 'shoes') return s.values.flatMap((n) => [`${n}`, `${n}.33`, `${n}.5`, `${n}.67`].map((x) => `SHOES-EU-${x}`))
      return s.values.flatMap((n) => adult.map((p) => `${p}-EU-${n}`))
    case 'jeans':
      return s.waist.map((w) => `PANTS-INCH-${w}`)
    case 'kids':
      return s.values.map((n) => `CHILD-CM-${n}`)
  }
}

/**
 * The Algolia `filters` string for an item, or null when no Sellpy listing can match
 * (Sellpy has no auctions, and nothing tagged "New with tags").
 */
export function sellpyFilters({ category, filters = {} }: SearchOptions): string | null {
  const clauses = ['price_SE.amount > 0']
  if (filters.saleType === 'auction') return null

  if (filters.condition) {
    const ok = Object.entries(SELLPY_CONDITIONS).filter(([, g]) => atLeast(filters.condition, g)).map(([v]) => v)
    if (!ok.length) return null
    clauses.push(anyOf('metadata.condition', ok))
  }
  if (!category) return clauses.join(' AND ')

  const depts = filters.department?.length ? filters.department : (['women', 'men', 'kids'] as Department[])
  const trees = uniq(depts.flatMap((d) => SELLPY_TREES[d]))
  const field = (key: string) => category.fields.find((f) => f.key === key)

  const types = (filters.type ?? []).flatMap((id) => field('type')?.options?.find((o) => o.id === id)?.sellpy ?? [])
  if (types.length) {
    clauses.push(anyOf('categories.lvl2', trees.flatMap((t) => uniq(types).map((name) => `${t} > ${category.sellpyGroup} > ${name}`))))
  } else {
    clauses.push(anyOf('categories.lvl1', trees.map((t) => `${t} > ${category.sellpyGroup}`)))
  }

  if (filters.department?.length) {
    clauses.push(anyOf('metadata.demography', filters.department.flatMap((d) => field('department')?.options?.find((o) => o.id === d)?.sellpy ?? [])))
  }

  for (const key of ['color', 'material'] as const) {
    const values = (filters[key] ?? []).flatMap((id) => field(key)?.options?.find((o) => o.id === id)?.sellpy ?? [])
    // An option Sellpy has no value for (Gore-Tex) is left to Kompi's own check
    if (values.length && (filters[key] ?? []).every((id) => field(key)?.options?.find((o) => o.id === id)?.sellpy)) {
      clauses.push(anyOf(`metadata.${key}`, values))
    }
  }

  const sizes = sellpySizes(category, filters)
  if (sizes.length) clauses.push(anyOf('metadata.size', sizes))

  return clauses.join(' AND ')
}

/** Category options from a Sellpy hit's metadata, as Kompi's option ids */
export function sellpyAttributes(meta: Record<string, unknown> | undefined, categoryId: string | undefined, lvl2: string | undefined, size: ParsedSize | undefined): SiteAttributes {
  const out: SiteAttributes = {}
  const condition = typeof meta?.condition === 'string' ? (SELLPY_CONDITIONS[meta.condition] ?? normalizeCondition(meta.condition)) : undefined
  if (condition) out.condition = condition
  if (size) out.size = size

  const category = getCategory(categoryId)
  if (!category || !meta) return out
  const options = (key: string) => category.fields.find((f) => f.key === key)?.options ?? []
  const pick = (key: string, values: unknown) => {
    const list = (Array.isArray(values) ? values : [values]).filter((v): v is string => typeof v === 'string')
    return options(key).filter((o) => o.sellpy?.some((s) => list.includes(s))).map((o) => o.id)
  }

  const dept = pick('department', meta.demography)
  if (dept.length) out.department = dept[0] as Department
  const color = pick('color', meta.color)
  if (color.length) out.color = color
  const material = pick('material', meta.material)
  if (material.length) out.material = material
  const sub = lvl2?.split(' > ').slice(2).join(' > ')
  const type = sub ? options('type').filter((o) => o.sellpy?.includes(sub)).map((o) => o.id) : []
  if (type.length) out.type = type
  return out
}

// ─── Vinted (catalog URL parameters) ─────────────────────────────────────────

// Vinted's status ids: 6 new with tags, 1 new without tags, 2 very good, 3 good, 4 satisfactory
const VINTED_STATUS: [number, ConditionGrade][] = [[6, 'new_with_tags'], [1, 'new'], [2, 'like_new'], [3, 'good'], [4, 'fair']]

/** Extra query parameters for Vinted's catalog, or null when nothing on Vinted can match */
export function vintedParams({ filters = {} }: SearchOptions): string[] | null {
  if (filters.saleType === 'auction') return null
  if (!filters.condition) return []
  return VINTED_STATUS.filter(([, g]) => atLeast(filters.condition, g)).map(([id]) => `status_ids[]=${id}`)
}

// ─── Blocket ─────────────────────────────────────────────────────────────────

export function blocketParams({ category, filters = {} }: SearchOptions): string[] | null {
  if (filters.saleType === 'auction') return null
  return category?.blocketCategory ? [`category=${category.blocketCategory}`] : []
}
