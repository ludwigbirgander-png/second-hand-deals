// Finding words in listing titles, for category options and built-in junk words.

/** Words of a title, lowercase with å/ä/ö kept, so "rött" and "rotting" stay apart */
export function tokens(text: string): string[] {
  return text.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9åäöéèüæøß]+/).filter(Boolean)
}

function tokenMatches(token: string, pattern: string): boolean {
  const start = pattern.startsWith('*')
  const end = pattern.endsWith('*')
  const core = pattern.replace(/^\*|\*$/g, '')
  if (start && end) return token.includes(core)
  if (start) return token.endsWith(core)
  if (end) return token.startsWith(core)
  return token === core
}

/** True if one of `patterns` is in the tokens (see FieldOption.words for the pattern syntax) */
export function hasPattern(words: string[], patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const parts = pattern.split(' ')
    if (parts.length === 1) return words.some((w) => tokenMatches(w, pattern))
    for (let i = 0; i + parts.length <= words.length; i++) {
      if (parts.every((p, j) => tokenMatches(words[i + j], p))) return true
    }
    return false
  })
}
