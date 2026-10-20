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
    const re = new RegExp(`(?<![\\d.,])(\\d{1,4}(?:[.,]\\d{1,2})?)\\s?-?\\s?${esc(unit)}${end}`, 'g')
    for (const m of text.matchAll(re)) found.push([m.index ?? 0, num(m[1])])
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, n]) => n)
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
 * How many pieces a listing offers: "4 st", "ett par", "set om 6", "6-pack",
 * or a number before one of `nouns` ("6 tallrikar", "sex tallrikar").
 */
export function quantity(title: string, nouns: string[] = []): number | undefined {
  const text = title.toLowerCase()
  const word = (s: string) => `(?<![${LETTER}\\d])${s}(?![${LETTER}])`
  const count = text.match(new RegExp(`(?<![\\d.,])(\\d{1,2})\\s?st(?![${LETTER}])`)) ??
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
    const from = decade(m[1])
    const to = m[2] ? decade(m[2]) : from
    for (let y = from; y <= to; y += 10) out.add(y)
  }
  for (const m of text.matchAll(new RegExp(`(?<!\\d)${d}'?s(?![${LETTER}])`, 'g'))) out.add(decade(m[1]))
  if (/mid[\s-]?century/.test(text)) [1950, 1960].forEach((y) => out.add(y))
  return [...out].sort()
}
