import { SYNONYM_GROUPS } from './synonyms'

export type MatchQuality = 'match' | 'possible' | 'none'

/**
 * Lowercase, fold å/ä/ö/é/ü, drop apostrophes ("Levi's" → "levis") and turn
 * other punctuation into spaces ("Fritz-Hansen" → "fritz hansen").
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/ü/g, 'u')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const hasDigit = (word: string) => /\d/.test(word)

/** Query words worth matching: 3+ letters, or anything with a digit ("13", "501", "ea117"). */
function queryWords(query: string): string[] {
  return Array.from(new Set(normalize(query).split(' ').filter((w) => w.length >= 3 || hasDigit(w))))
}

// normalised term → every normalised term it is interchangeable with (itself included)
const SYNONYMS = new Map<string, string[]>()
// normalised English word → the Swedish word to search with
const EN_TO_SV = new Map<string, string>()
for (const group of SYNONYM_GROUPS) {
  const all = [...group.en, ...group.sv].map(normalize)
  for (const term of all) SYNONYMS.set(term, Array.from(new Set([...(SYNONYMS.get(term) ?? []), ...all])))
  for (const en of group.en) if (!en.includes(' ')) EN_TO_SV.set(normalize(en), group.sv[0])
}

/** Levenshtein distance, stopping early once it passes `max`. */
function editDistance(a: string, b: string, max = 1): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/**
 * How well a listing title matches the search.
 * - match: every query word is in the title, or one of its synonyms is. Words
 *   with digits must appear as a whole word, or inside the title with spaces
 *   removed ("EA117" matches "EA 117"), so "iPhone 13" doesn't match "iPhone 12".
 * - possible: the only misses are small typos (one letter off, words of 5+
 *   letters), or a single missing word in a query of 3+ words that has no digits.
 * - none: anything else.
 */
export function matchQuality(title: string, query: string): MatchQuality {
  const words = queryWords(query)
  if (words.length === 0) return 'match'

  const text = normalize(title)
  const titleWords = text.split(' ')
  const compact = text.replace(/ /g, '')

  const found = (word: string) => {
    if (hasDigit(word)) return titleWords.includes(word) || (/[a-z]/.test(word) && compact.includes(word))
    return (SYNONYMS.get(word) ?? [word]).some((term) => text.includes(term)) || text.includes(word)
  }
  const nearMiss = (word: string) =>
    !hasDigit(word) && word.length >= 5 && titleWords.some((w) => editDistance(w, word) <= 1)

  const missing = words.filter((w) => !found(w))
  if (missing.length === 0) return 'match'
  const hard = missing.filter((w) => !nearMiss(w))
  if (hard.length === 0) return 'possible'
  if (hard.length === 1 && words.length >= 3 && !hasDigit(hard[0])) return 'possible'
  return 'none'
}

/**
 * The query with English words swapped for Swedish ones, for sites whose
 * titles are in Swedish ("Eames chair" → "Eames stol"). Null when nothing
 * would change.
 */
export function swedishVariant(query: string): string | null {
  let changed = false
  const out = query.split(/\s+/).filter(Boolean).map((word) => {
    const sv = EN_TO_SV.get(normalize(word))
    if (!sv) return word
    changed = true
    return sv
  })
  return changed ? out.join(' ') : null
}

/** Words of a title as typed (lowercase, å/ä/ö kept), so "skal" (case) never hides "skål" (bowl). */
function titleTokens(title: string): string[] {
  return title.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9åäöéèüæøß]+/).filter(Boolean)
}

/** True if a title has a word starting with one of `words` ("skal" also catches "skalet"). */
export function hasExcludedWord(title: string, words: string[]): boolean {
  if (words.length === 0) return false
  const tokens = titleTokens(title)
  return words.some((w) => {
    const word = w.toLowerCase().trim()
    return word.length > 0 && tokens.some((t) => t.startsWith(word))
  })
}

// Common words that would never be useful to hide
const STOPWORDS = new Set([
  'och', 'med', 'för', 'till', 'från', 'som', 'den', 'det', 'utan', 'helt', 'mycket', 'fint', 'fin', 'bra',
  'skick', 'säljes', 'sälj', 'ny', 'nytt', 'nya', 'storlek', 'the', 'and', 'with', 'for', 'size', 'new',
])

/**
 * Words from a removed listing's title that could be hidden in future: not part
 * of the search (or its synonyms), not numbers, not filler. At most `max`.
 */
export function suggestExcludeWords(title: string, query: string, max = 4): string[] {
  const words = queryWords(query)
  const related = new Set(words.flatMap((w) => SYNONYMS.get(w) ?? [w]))
  const out: string[] = []
  for (const token of titleTokens(title)) {
    if (out.length >= max) break
    if (token.length < 3 || /^\d+$/.test(token) || STOPWORDS.has(token) || out.includes(token)) continue
    const n = normalize(token)
    if (Array.from(related).some((r) => n.includes(r) || r.includes(n))) continue
    out.push(token)
  }
  return out
}
