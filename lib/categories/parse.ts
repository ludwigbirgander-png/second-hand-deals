// Reading numbers from listing titles: storage, sizes in mm, battery %, how many pieces, decades.
// Every reader needs a unit or keyword next to the number, so "iPhone 13" is never 13 GB or 13 inches.

const LETTER = 'a-zåäöéü'
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const num = (s: string) => Number(s.replace(',', '.'))

/** Numbers followed by one of the units, in title order ("8 GB / 256 GB" → [8, 256]) */
export function numbersWithUnit(title: string, units: string[]): number[] {
  const text = title.toLowerCase()
  const found: [number, number][] = []
  for (const unit of units) {
    // A word unit must end there ("128gb", not "12 gbit"); quote marks needn't
    const end = /^[a-z]/.test(unit) ? `(?![${LETTER}])` : ''
    // Not inside a number ("13,3"), but a comma between words is fine ("ram,256ssd")
    const re = new RegExp(`(?<!\\d[.,]?)(\\d{1,4}(?:[.,]\\d{1,2})?)\\s?-?\\s?${esc(unit)}${end}`, 'g')
    for (const m of text.matchAll(re)) found.push([m.index ?? 0, num(m[1])])
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, n]) => n)
}

/**
 * Numbers from `allowed` standing on their own ("iPhone 13 Pro 128"), not followed by
 * another unit or a price ("512 kr", "64 MP")
 */
export function bareNumbers(title: string, allowed: number[]): number[] {
  const text = title.toLowerCase()
  const re = new RegExp(`(?<![\\d.,${LETTER}])(${allowed.join('|')})(?![\\d.,${LETTER}]|\\s?(?:kr|sek|:-|%|(?:mp|mb|mah|hz|mm|cm|w|tum|gb|tb)(?![${LETTER}])))`, 'g')
  return [...text.matchAll(re)].map((m) => Number(m[1]))
}

const PAIR_RAM = [4, 8, 12, 16, 18, 24, 32, 36, 48, 64]
const PAIR_STORAGE = [128, 256, 512, 1024, 2048]

/** Computer shorthand for RAM/storage: "8/256", "16GB/512GB", "32/1TB". Empty unless both look right ("12/2021" is a date). */
export function slashPair(title: string): { ram?: number; storage?: number } {
  const m = title.toLowerCase().match(/(?<![\d.,])(\d{1,2})\s?(?:gb)?\s?\/\s?(\d{1,4})\s?(gb|tb)?(?!\d)/)
  if (!m) return {}
  const ram = Number(m[1])
  const n = Number(m[2])
  const storage = m[3] === 'tb' || n <= 2 ? n * 1024 : n
  return PAIR_RAM.includes(ram) && PAIR_STORAGE.includes(storage) ? { ram, storage } : {}
}

/** A percentage right before or after a keyword ("batterihälsa 89%", "86% batterihälsa") */
export function percentNear(title: string, keywords: string[]): number | undefined {
  const text = title.toLowerCase()
  const kw = `(?<![${LETTER}])(?:${keywords.map(esc).join('|')})[${LETTER}]*`
  const m = text.match(new RegExp(`${kw}\\s*[:=]?\\s*(\\d{1,3})\\s?%`)) ?? text.match(new RegExp(`(?<![\\d-])(\\d{1,3})\\s?%\\s*${kw}`))
  const n = m ? Number(m[1]) : NaN
  return n > 0 && n <= 100 ? n : undefined
}

const NUMBER_WORDS: Record<string, number> = { två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9, tio: 10, tolv: 12 }

/**
 * How many pieces a listing offers: "4 st", "6 stycken", "ett par", "set om 6", "6-pack",
 * or a number before one of `nouns` ("6 tallrikar", "sex tallrikar").
 */
export function quantity(title: string, nouns: string[] = []): number | undefined {
  const text = title.toLowerCase()
  const word = (s: string) => `(?<![${LETTER}\\d])${s}(?![${LETTER}])`
  const count = text.match(new RegExp(`(?<![\\d.,])(\\d{1,2})\\s?(?:st|styck|stycken)(?![${LETTER}])`)) ??
    text.match(new RegExp(`${word('set')} om (\\d{1,2})`)) ??
    text.match(new RegExp(`(?<![\\d.,])(\\d{1,2})\\s?-?\\s?pack(?![${LETTER}])`))
  if (count) return Number(count[1])
  if (new RegExp(`${word('ett par')}|${word('paret')}`).test(text)) return 2
  if (nouns.length) {
    const amount = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')})`
    const m = text.match(new RegExp(`(?<![${LETTER}\\d.,])${amount}\\s+(?:${nouns.map(esc).join('|')})(?![${LETTER}])`))
    if (m) return NUMBER_WORDS[m[1]] ?? Number(m[1])
  }
  return undefined
}

/** 20th-century decades in a title: "60-tal", "1950/60-tal", "1950-70-tal", "1970s", "mid century" */
export function decades(title: string): number[] {
  const text = title.toLowerCase()
  const out = new Set<number>()
  const decade = (s: string) => (s.length === 4 ? Number(s) : 1900 + Number(s))
  const d = '(19[1-9]0|[1-9]0)'
  for (const m of text.matchAll(new RegExp(`(?<!\\d)${d}(?:\\s?[-/–]\\s?${d})?\\s?-?\\s?tal`, 'g'))) {
    // "ett 30-tal tallrikar" and "ca 20-tal" mean about thirty and about twenty; "ett 60-tals bord" is a decade
    const before = text.slice(0, m.index)
    const bare = !new RegExp(`^[${LETTER}]`).test(text.slice((m.index ?? 0) + m[0].length))
    if (bare && new RegExp(`(?:^|[^${LETTER}])(?:ett|ca\\.?|cirka|omkring)\\s+$`).test(before)) continue
    const from = decade(m[1])
    const to = m[2] ? decade(m[2]) : from
    for (let y = from; y <= to; y += 10) out.add(y)
  }
  for (const m of text.matchAll(new RegExp(`(?<!\\d)${d}'?s(?![${LETTER}])`, 'g'))) out.add(decade(m[1]))
  if (/mid[\s-]?century/.test(text)) [1950, 1960].forEach((y) => out.add(y))
  return [...out].sort()
}
