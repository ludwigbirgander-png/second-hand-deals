// Types for categories, an item's filters and a listing's normalised details.

export type CategoryId = 'clothing' | 'shoes' | 'phones' | 'computers'

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

/** From–to numbers (case size in mm, ring size); either end can be open */
export interface NumberRange {
  from?: number
  to?: number
}

/** A category field's value in an item's filters or a listing's details */
export type FieldValue = string | string[] | number | boolean | NumberRange | SizeFilter | ParsedSize

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
  /** Category fields beyond the shared ones above (storage, battery, caseSize…), keyed by CategoryField.key */
  [key: string]: FieldValue | undefined
}

/** 'condition' or a category field's key */
export type FilterKey = string

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
  /** Category fields beyond the shared ones above, keyed by CategoryField.key */
  [key: string]: FieldValue | FilterKey[] | undefined
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
  /** Type options: Sellpy's full category paths (categories.lvl2) for this type */
  sellpyPaths?: string[]
  /** Type options: Auctionet's category_id for this type */
  auctionet?: number
}

/**
 * How a field is picked and checked:
 * - options: pick any of `options`; a listing passes if it has one of them
 * - size: clothing and shoe sizes (`sizeSystems`)
 * - min: one number; a listing passes at or above it (battery ≥ 85 %)
 * - range: from–to numbers; a listing passes inside it (case size 38–41 mm)
 * - toggle: a switch, see `toggle`
 */
export type FieldKind = 'options' | 'size' | 'min' | 'range' | 'toggle'

export interface CategoryField {
  /** Unique within the category; a key shared across categories means the same thing (color, type, storage) */
  key: string
  label: string
  kind: FieldKind
  /** A shorter label for chips on the item page ("Battery" for "Battery health") */
  short?: string
  options?: FieldOption[]
  /** For size: which size systems the category offers, first is the default */
  sizeSystems?: SizeSystem[]
  /** min and range: the unit shown after numbers ('%', 'mm') */
  unit?: string
  /** min and range: the lowest and highest number that can be picked */
  bounds?: [number, number]
  /**
   * toggle: 'require' (on: the listing must say so, e.g. Unlocked) or
   * 'allow' (off, the default: listings that say so are hidden, e.g. second sort)
   */
  toggle?: 'require' | 'allow'
  /** A line under a toggle, explaining what on and off do */
  description?: string
  /** Only shown, saved and checked when the item's type includes one of these, or no type is picked */
  showWhen?: { type: string[] }
  /**
   * Reads the detail from a title, for anything word patterns can't (numbers, units).
   * Returns option ids for options, a number for min and range, true for toggle.
   */
  parse?: (title: string) => string[] | number | boolean | undefined
}

export interface Category {
  id: CategoryId
  label: string
  /** A shorter label for the category chip ("Phones" for "Phones & tablets") */
  short?: string
  /** Words in an item's name that suggest this category ("iPhone 13" → Phones) */
  hints: string[]
  fields: CategoryField[]
  /** Sites searched by default; others are skipped even if enabled */
  sites: string[]
  /** Built-in words that mark junk for this category, same patterns as FieldOption.words */
  negativeWords: string[]
  /** Sellpy's level-1 category suffix ("Kläder", "Skor"), for categories split by department */
  sellpyGroup?: string
  /** Blocket's category id */
  blocketCategory?: string
  /** Sellpy's full category paths (categories.lvl2), for categories not split by department */
  sellpyPaths?: string[]
  /** Auctionet's category_id when no type is picked */
  auctionet?: number
  /** Field keys shown as short details on listing cards, in order */
  cardFields?: string[]
}
