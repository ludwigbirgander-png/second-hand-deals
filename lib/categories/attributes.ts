// Normalised details of a listing: condition on one scale, sizes, and category options found in the title.
import type { Category, ConditionGrade, ListingAttributes, ParsedSize } from './types'
import { hasPattern, tokens } from './words'

// ─── Condition ───────────────────────────────────────────────────────────────

// Site wordings (Vinted, Sellpy, Tradera, the old English labels), lowercased
const CONDITION_WORDS: Record<string, ConditionGrade> = {
  'ny med prislapp': 'new_with_tags',
  'nytt med lapp': 'new_with_tags',
  'new with tags': 'new_with_tags',
  'ny utan prislapp': 'new',
  'nytt utan lapp': 'new',
  'new without tags': 'new',
  nytt: 'new',
  ny: 'new',
  oanvänd: 'new',
  oanvänt: 'new',
  new: 'new',
  'mycket bra': 'like_new',
  'mycket gott skick': 'like_new',
  'very good': 'like_new',
  'som ny': 'like_new',
  nyskick: 'like_new',
  'like new': 'like_new',
  bra: 'good',
  'gott skick': 'good',
  'bra skick': 'good',
  good: 'good',
  begagnad: 'good',
  normalt: 'fair',
  acceptabelt: 'fair',
  'acceptabelt skick': 'fair',
  hyfsat: 'fair',
  satisfactory: 'fair',
  fair: 'fair',
  dåligt: 'parts',
  defekt: 'parts',
  'for parts': 'parts',
}

/** A site's condition label on Kompi's scale, or undefined if it's not one we know */
export function normalizeCondition(raw: string | null | undefined): ConditionGrade | undefined {
  if (!raw) return undefined
  const key = raw.toLowerCase().replace(/^skick:\s*/, '').replace(/[_\s]+/g, ' ').trim()
  return CONDITION_WORDS[key]
}

// Wordings in titles, checked best first; deliberately few, to avoid guessing
const TITLE_CONDITIONS: [ConditionGrade, string[]][] = [
  ['new_with_tags', ['med lapp*', 'med prislapp*', 'lappar kvar', 'lapp kvar', 'prislapp kvar', 'new with tags', 'nwt']],
  ['new', ['oanvänd*', 'aldrig använd*', 'unused', 'helt ny', 'helt nya', 'helt nytt']],
  ['like_new', ['nyskick', 'som ny', 'som nya', 'som nytt', 'like new', 'knappt använd*']],
  ['parts', ['trasig*', 'defekt*', 'reservdel*', 'for parts']],
]

export function conditionFromTitle(title: string): ConditionGrade | undefined {
  const words = tokens(title)
  return TITLE_CONDITIONS.find(([, patterns]) => hasPattern(words, patterns))?.[0]
}

// ─── Sizes ───────────────────────────────────────────────────────────────────

function letterSizes(text: string): string[] {
  const out: string[] = []
  for (const raw of text.toUpperCase().split(/[\s/|,-]+/)) {
    const t = raw.replace(/\.$/, '')
    if (/^(XXS|XS|S|M|L|XL)$/.test(t)) out.push(t)
    else if (/^(XXL|2XL)$/.test(t)) out.push('XXL')
    else if (/^(XXXL|3XL)$/.test(t)) out.push('3XL')
  }
  return Array.from(new Set(out))
}

/** "42", "38,5", "42 2/3", "42.33" → a number */
function sizeNumber(text: string): number | undefined {
  const m = text.match(/^(\d{2,3})(?:[.,](\d{1,2})|\s+([12])\/3|\s+1\/2)?$/)
  if (!m) return undefined
  const whole = Number(m[1])
  if (m[2]) return Number(`${whole}.${m[2]}`)
  if (m[3]) return Math.round((whole + Number(m[3]) / 3) * 100) / 100
  if (/1\/2$/.test(text)) return whole + 0.5
  return whole
}

function isWaistLength(w: string, l: string) {
  return Number(w) >= 23 && Number(w) <= 40 && Number(l) >= 26 && Number(l) <= 38
}

/** One number from a size field or after "stl": shoe size, EU clothing size or kids' height */
function placeNumber(n: number, out: ParsedSize, shoes: boolean, unit: string) {
  if (shoes) {
    if (n >= 15 && n <= 50) out.eu ??= n
    return
  }
  if (/c[lm]/i.test(unit) || (n >= 60 && n <= 176)) {
    if (n >= 44 && n <= 176) out.kids ??= n
  } else if (n >= 30 && n <= 58 && Number.isInteger(n)) {
    out.eu ??= n
  }
}

/** Sellpy's size codes: WMN-INT-M, MEN-EU-48, PANTS-INCH-32, CHILD-CM-140, SHOES-EU-38.5 */
function sellpyCode(code: string, out: ParsedSize): boolean {
  const m = code.match(/^(WMN|MEN|CHILD|PANTS|SHOES)-(INT|EU|CM|INCH)-([\w./]+)$/i)
  if (!m) return false
  const [, , system, value] = m
  if (system.toUpperCase() === 'INT') out.letter = letterSizes(value)
  else if (system.toUpperCase() === 'INCH') out.waist = Number(value)
  else if (system.toUpperCase() === 'CM') out.kids = Number(value)
  else out.eu = Number(value)
  return true
}

const SIZE_KEYWORD = /(?:^|[\s,(])(?:stl|strl|str|storlek|size|sz|eu|eur)\.?\s*:?\s*([0-9a-z]+(?:[.,]\d{1,2})?(?:\s*[/-]\s*[0-9a-z]+)?)/gi

/**
 * Sizes from a site's size field and the title. The size field wins; the title fills gaps.
 * Plain S, M and L only count in the title after "stl"/"storlek" or in capitals on their own.
 */
// Titles about trousers, where "32/34" and "stl 32" are waist and length
const TROUSERS = /jeans|byxor|denim|chinos|\b50[1-5]\b|levi/i

export function parseSize(sizeField: string | null | undefined, title: string, shoes: boolean): ParsedSize {
  const out: ParsedSize = {}
  const trousers = !shoes && TROUSERS.test(title)

  for (const part of (sizeField ?? '').split(/\s*[|]\s*/).filter(Boolean)) {
    if (sellpyCode(part.trim(), out)) continue
    const p = part.trim()
    const wl = p.match(/W\s?(\d{2})(?:\s*[/x×]?\s*L\s?(\d{2}))?/i)
    if (wl) {
      out.waist ??= Number(wl[1])
      if (wl[2]) out.length ??= Number(wl[2])
      continue
    }
    const letters = letterSizes(p)
    if (letters.length && !out.letter) { out.letter = letters; continue }
    const unit = p.match(/c[lm]\b/i)?.[0] ?? ''
    const n = sizeNumber(p.replace(/\s*(c[lm]|eu|eur)\b/gi, '').trim())
    if (n != null) placeNumber(n, out, shoes, unit)
  }

  // Jeans: "W32 L34", "W32/L34", "32/34" after "stl"
  const wl = title.match(/\bW\s?(\d{2})\s*[/x×-]?\s*L\s?(\d{2})\b/i) ?? title.match(/\bW\s?(\d{2})\b/i)
  if (wl) {
    out.waist ??= Number(wl[1])
    if (wl[2]) out.length ??= Number(wl[2])
  }

  for (const m of title.matchAll(SIZE_KEYWORD)) {
    const value = m[1]
    const after = title.slice((m.index ?? 0) + m[0].length)
    const letters = letterSizes(value)
    if (letters.length) { out.letter ??= letters; continue }
    const jeans = !shoes && value.match(/^(\d{2})\s*\/\s*(\d{2})$/)
    // "38/40" outside trousers means EU 38 or 40
    if (jeans && isWaistLength(jeans[1], jeans[2]) && (trousers || Number(jeans[1]) !== Number(jeans[2]) - 2)) {
      out.waist ??= Number(jeans[1])
      out.length ??= Number(jeans[2])
      continue
    }
    // "storlek 32" on jeans is the waist
    const waist = trousers && value.match(/^(2[3-9]|3[0-9]|40)$/)
    if (waist) {
      out.waist ??= Number(waist[1])
      continue
    }
    // "38/40" means either; keep the first
    const n = sizeNumber(value.split(/\s*[/-]\s*/)[0])
    const fraction = after.match(/^\s+([12])\/3\b/) ?? after.match(/^\s+1\/2\b/)
    const unit = after.match(/^\s*(c[lm])\b/i)?.[1] ?? ''
    if (n != null) placeNumber(fraction ? sizeNumber(`${n} ${fraction[0].trim()}`) ?? n : n, out, shoes, unit)
  }

  // "Levis 501 32/34" without a keyword
  if (trousers && out.waist == null) {
    const pair = title.match(/\b(\d{2})\s?\/\s?(\d{2})\b/)
    if (pair && isWaistLength(pair[1], pair[2])) {
      out.waist = Number(pair[1])
      out.length ??= Number(pair[2])
    }
  }

  // "140 cl" without a keyword
  if (!shoes && out.kids == null) {
    const cl = title.match(/\b(\d{2,3})\s?cl\b/i)
    if (cl) placeNumber(Number(cl[1]), out, false, 'cl')
  }

  if (!out.letter) {
    // On their own: XS, XL, XXL in any case; S, M, L only in capitals
    const standalone = title.split(/[\s,()]+/).filter((w) => /^(XXS|XS|XL|XXL|XXXL|2XL|3XL)$/i.test(w) || /^[SML]$/.test(w))
    const letters = letterSizes(standalone.join(' '))
    if (letters.length) out.letter = letters
  }

  return out
}

export function hasSize(s: ParsedSize | undefined): boolean {
  return !!s && (!!s.letter?.length || s.eu != null || s.waist != null || s.length != null || s.kids != null)
}

/** "M", "W32 L34", "EU 42.5", "140 cl" */
export function sizeLabel(s: ParsedSize | undefined): string | null {
  if (!s) return null
  if (s.letter?.length) return s.letter.join('/')
  if (s.waist != null) return `W${s.waist}${s.length != null ? ` L${s.length}` : ''}`
  if (s.eu != null) return `EU ${s.eu}`
  if (s.kids != null) return `${s.kids} cl`
  return null
}

// ─── Everything at once ──────────────────────────────────────────────────────

/** Details a scraper read from the site's own fields; they win over what the title suggests */
export type SiteAttributes = Omit<ListingAttributes, 'unstated'>

export interface AttributeSource {
  title: string
  condition?: string | null
  size?: string | null
  attributes?: SiteAttributes
}

/** A listing's normalised details. Without a category, only the condition. */
export function extractAttributes(l: AttributeSource, category?: Category): ListingAttributes {
  const site = l.attributes ?? {}
  const out: ListingAttributes = {}
  const condition = site.condition ?? normalizeCondition(l.condition) ?? conditionFromTitle(l.title)
  if (condition) out.condition = condition
  if (!category) return out

  const words = tokens(l.title)
  for (const field of category.fields) {
    if (field.key === 'size' || !field.options) continue
    const fromSite = site[field.key]
    if (fromSite != null && (!Array.isArray(fromSite) || fromSite.length)) {
      ;(out as Record<string, unknown>)[field.key] = fromSite
      continue
    }
    const found = field.options.filter((o) => hasPattern(words, o.words)).map((o) => o.id)
    if (!found.length) continue
    if (field.key === 'department') out.department = found[0] as ListingAttributes['department']
    else (out as Record<string, unknown>)[field.key] = found
  }

  const size = hasSize(site.size) ? site.size! : parseSize(l.size, l.title, category.id === 'shoes')
  if (hasSize(size)) out.size = size
  return out
}
