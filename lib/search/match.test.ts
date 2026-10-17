import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchQuality, swedishVariant, hasExcludedWord, suggestExcludeWords, normalize } from './match'

test('normalize folds case, å/ä/ö, apostrophes and punctuation', () => {
  assert.equal(normalize("Levi's 501"), 'levis 501')
  assert.equal(normalize('Fritz-Hansen, Rörstrand'), 'fritz hansen rorstrand')
})

test('match: every word, in any order', () => {
  assert.equal(matchQuality('Arne Jacobsen, Stol, "Grand Prix", Fritz Hansen', 'Fritz Hansen Grand Prix'), 'match')
  assert.equal(matchQuality('Josef Frank, spegel, Firma Svenskt Tenn', 'josef frank svenskt tenn'), 'match')
  assert.equal(matchQuality("Levi's 501 jeans", 'levis 501'), 'match')
})

test('match: synonyms in either language', () => {
  assert.equal(matchQuality('CHARLES & RAY EAMES, stol, "Lounge chair"', 'Eames chair'), 'match')
  assert.equal(matchQuality('Eames Lounge stol med ottoman', 'Eames chair'), 'match')
  assert.equal(matchQuality('Vintage leather jacket', 'skinn jacka'), 'none', '"skinn" has no synonym, and a two-word query needs both')
  assert.equal(matchQuality('Svart läderjacka från Acne', 'Acne jacket'), 'match')
  assert.equal(matchQuality('Bärbar dator Lenovo ThinkPad', 'Lenovo laptop'), 'match')
})

test('match: model numbers ignore spaces but must not change', () => {
  assert.equal(matchQuality('Vitra Eames EA 117 kontorsstol', 'Eames EA117'), 'match')
  assert.equal(matchQuality('iPhone 13 Pro 128 GB', 'iPhone 13'), 'match')
  assert.equal(matchQuality('iPhone 12 Pro 128 GB', 'iPhone 13'), 'none')
  assert.equal(matchQuality('iPhone 13 Pro 256 GB', 'iPhone 13 128'), 'none', 'a missing number is never a possible match')
})

test('possible: small typos and one missing word', () => {
  assert.equal(matchQuality('Carl Malmsten, stol, Lilla Åland', 'Carl Malmstem Lilla Åland'), 'possible')
  assert.equal(matchQuality('Eames lounge chair, Vitra', 'Eames lounge chair ottoman'), 'possible')
  assert.equal(matchQuality('Bruno Mathsson, fåtölj "Eva"', 'Eames'), 'none')
  assert.equal(matchQuality('Lounge chair', 'Eames lounge'), 'none', 'a two-word query needs both words')
})

test('swedishVariant swaps English words for Swedish ones', () => {
  assert.equal(swedishVariant('Eames chair'), 'Eames stol')
  assert.equal(swedishVariant('Acne jacket'), 'Acne jacka')
  assert.equal(swedishVariant('Josef Frank'), null)
})

test('hasExcludedWord matches word starts and keeps å/ä/ö apart', () => {
  assert.ok(hasExcludedWord('iPhone 13 skal svart', ['skal']))
  assert.ok(hasExcludedWord('iPhone 13 skalet ingår', ['skal']))
  assert.ok(hasExcludedWord('iPhone 13 SKAL', ['skal']))
  assert.ok(!hasExcludedWord('Rörstrand skål', ['skal']), 'skål (bowl) is not skal (case)')
  assert.ok(!hasExcludedWord('Vågskål', ['skal']))
  assert.ok(!hasExcludedWord('iPhone 13 Pro', []))
})

test('suggestExcludeWords skips search words, synonyms, numbers and filler', () => {
  assert.deepEqual(suggestExcludeWords('iPhone 13 skal svart', 'iPhone 13'), ['skal', 'svart'])
  assert.deepEqual(suggestExcludeWords('Eames stol, miniatyr, Vitra Design Museum', 'Eames chair'), ['miniatyr', 'vitra', 'design', 'museum'])
  assert.deepEqual(suggestExcludeWords('Levis 501 jeans i fint skick, storlek 32', "Levi's 501"), ['jeans'])
})
