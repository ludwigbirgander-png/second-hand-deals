import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseListIds, diffLinks, MAX_LISTS_PER_ITEM } from './links'

const A = '34d4f0d9-cc64-4940-8a08-a6ae24fc57ed'
const B = '0ff5b9a7-50b0-42d2-84cf-2bde472f1e52'
const C = 'b926c2d5-5c95-4048-bd7e-95d4c6ef7ed8'

test('parseListIds accepts unique UUIDs', () => {
  assert.deepEqual(parseListIds([A, B]), [A, B])
  assert.deepEqual(parseListIds([A, A.toUpperCase()]), [A])
  assert.deepEqual(parseListIds([]), [])
  assert.deepEqual(parseListIds(undefined), [])
})

test('parseListIds rejects anything else', () => {
  assert.equal(parseListIds('not-an-array'), null)
  assert.equal(parseListIds([A, 'abc']), null)
  assert.equal(parseListIds([A, 42]), null)
  assert.equal(parseListIds([`${A}' or 1=1`]), null)
  assert.equal(parseListIds({ 0: A }), null)
})

test(`parseListIds allows at most ${MAX_LISTS_PER_ITEM} lists`, () => {
  const many = Array.from({ length: MAX_LISTS_PER_ITEM + 1 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`)
  assert.equal(parseListIds(many), null)
  assert.equal(parseListIds(many.slice(0, MAX_LISTS_PER_ITEM))?.length, MAX_LISTS_PER_ITEM)
})

test('diffLinks only adds and removes what changed', () => {
  assert.deepEqual(diffLinks([A, B], [B, C]), { add: [C], remove: [A] })
  assert.deepEqual(diffLinks([A], [A]), { add: [], remove: [] })
  assert.deepEqual(diffLinks([], [A]), { add: [A], remove: [] })
  assert.deepEqual(diffLinks([A, B], []), { add: [], remove: [A, B] })
})
