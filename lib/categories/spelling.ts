// "Did you mean MacBook?": a misspelt item name finds almost nothing, because the sites
// search for the exact words. Suggest a fix when a word looks like a slip of the keyboard on
// a word Kompi knows: a letter missing or extra ("McBook", "Rörstand") or two letters swapped
// ("Iphoen"). A replaced letter isn't counted: that's how real names differ ("Bruno"/"bruna", "Switch"/"Swatch").
import { CATEGORIES } from './index'
import { hasPattern } from './words'
import { editDistance } from '../search/match'

const MIN_LENGTH = 5
const LETTERS = /^[a-zåäöéüæøß]+$/

let known: { words: Set<string>; patterns: string[] } | null = null

/**
 * The words that name things in Kompi's categories ("macbook", "rörstrand", "fåtölj"): the hints,
 * not every option word, since colours and materials are everyday words ("bruna")
 */
function vocabulary() {
  if (known) return known
  const patterns = CATEGORIES.flatMap((c) => c.hints)
  const words = new Set<string>()
  for (const p of patterns) {
    for (const part of p.split(' ')) {
      // "macbook*" gives "macbook"; "*lampa" is only an ending, not a word on its own
      const word = part.replace(/\*$/, '')
      if (!word.startsWith('*') && word.length >= MIN_LENGTH && LETTERS.test(word)) words.add(word)
    }
  }
  known = { words, patterns }
  return known
}

/** Two words of the same length that differ only by two neighbouring letters swapped ("iphoen", "iphone") */
function swapped(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const diff = [...a].flatMap((ch, i) => (ch === b[i] ? [] : [i]))
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]
}

/** A letter missing or extra, or two swapped */
const slipOf = (typed: string, known: string) =>
  (Math.abs(typed.length - known.length) === 1 && editDistance(typed, known) <= 1) || swapped(typed, known)

/** The word cased like the one it replaces: "McBook" → "Macbook", "iitala" → "iittala" */
const caseLike = (original: string, word: string) => (/^\p{Lu}/u.test(original) ? word[0].toUpperCase() + word.slice(1) : word)

export interface SpellingHint {
  word: string
  suggestion: string
  /** The whole name with the word fixed */
  name: string
}

/** The first word in the name that looks like a typo of a known word, or null */
export function spellingHint(name: string): SpellingHint | null {
  const { words, patterns } = vocabulary()
  for (const m of name.matchAll(/[\p{L}]+/gu)) {
    const original = m[0]
    const word = original.toLowerCase()
    if (word.length < MIN_LENGTH || !LETTERS.test(word) || words.has(word) || hasPattern([word], patterns)) continue
    // Not a longer form of a known word ("lampan", "stolarna"); a cut-off one is fine ("fåtöl")
    const near = [...words].filter((k) => !word.startsWith(k) && slipOf(word, k)).sort()
    if (!near.length) continue
    const suggestion = caseLike(original, near[0])
    const at = m.index ?? 0
    return { word: original, suggestion, name: name.slice(0, at) + suggestion + name.slice(at + original.length) }
  }
  return null
}
