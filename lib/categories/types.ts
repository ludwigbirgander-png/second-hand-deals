// Types for categories, an item's filters and a listing's normalised details.

export type CategoryId = 'clothing' | 'shoes'

export type Department = 'women' | 'men' | 'kids' | 'unisex'

/** One condition scale for every site, best first */
export type ConditionGrade = 'new_with_tags' | 'new' | 'like_new' | 'good' | 'fair' | 'parts'

export type SaleType = 'fixed' | 'auction'

export type SizeSystem = 'letter' | 'eu' | 'jeans' | 'kids'

/** Sizes the user wants, in one size system */
export type SizeFilter =
  | { system: 'letter'; values: string[] }
  | { system: 'eu'; values: number[] }
  | { system: 'jeans'; waist: number[]; length: number[] }
  | { system: 'kids'; values: number[] }

/** What the user picked for an item (stored in items.filters). Every key is optional. */
export interface ItemFilters {
  /** Minimum condition */
  condition?: ConditionGrade
  saleType?: SaleType
  /** Hide listings that don't state a filtered detail. Off: keep them, marked "not stated". */
  strict?: boolean
  department?: Department[]
  type?: string[]
  size?: SizeFilter
  color?: string[]
  material?: string[]
}

export type FilterKey = 'condition' | 'department' | 'type' | 'size' | 'color' | 'material'

/** A listing's sizes, read from the site's size field or the title */
export interface ParsedSize {
  letter?: string[]
  eu?: number
  waist?: number
  length?: number
  kids?: number
}

/** Normalised details of a listing (stored in listings.attributes) */
export interface ListingAttributes {
  condition?: ConditionGrade
  department?: Department
  type?: string[]
  size?: ParsedSize
  color?: string[]
  material?: string[]
  /** Filtered details the listing didn't state; it was kept because the item isn't strict */
  unstated?: FilterKey[]
}

/** A choice in a category field. `words` find it in titles; `sellpy` is Sellpy's own value. */
export interface FieldOption {
  id: string
  label: string
  /**
   * Title words, lowercase with å/ä/ö kept. "jacka" matches the whole word, "skinn*" a word
   * starting with it, "*jacka" a word ending with it ("vinterjacka"), "*jack*" a word containing it.
   * A space means consecutive words ("gore tex").
   */
  words: string[]
  /** Sellpy's value for this option (category name, colour, material…) */
  sellpy?: string[]
}

export interface CategoryField {
  key: 'department' | 'type' | 'size' | 'color' | 'material'
  label: string
  options?: FieldOption[]
  /** For size: which size systems the category offers, first is the default */
  sizeSystems?: SizeSystem[]
}

export interface Category {
  id: CategoryId
  label: string
  /** Words in an item's name that suggest this category ("iPhone 13" → Phones) */
  hints: string[]
  fields: CategoryField[]
  /** Sites searched by default; others are skipped even if enabled */
  sites: string[]
  /** Built-in words that mark junk for this category, same patterns as FieldOption.words */
  negativeWords: string[]
  /** Sellpy's level-1 category suffix ("Kläder", "Skor") */
  sellpyGroup: string
  /** Blocket's category id */
  blocketCategory?: string
}
