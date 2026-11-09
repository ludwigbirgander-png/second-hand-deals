import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMITS, allowedFrom, retryAfterSeconds, searchSignature } from './index'

test('allowedFrom only refuses on a clear "no" from the database', () => {
  assert.equal(allowedFrom(true, null), true)
  assert.equal(allowedFrom(false, null), false)
  // Fails open: missing function, database error, odd answers
  assert.equal(allowedFrom(null, { message: 'Could not find the function public.hit_rate_limit' }), true)
  assert.equal(allowedFrom(false, { message: 'timeout' }), true)
  assert.equal(allowedFrom(null, null), true)
  assert.equal(allowedFrom(undefined, null), true)
})

test('retryAfterSeconds counts down to the end of the window', () => {
  const at = (iso: string) => Date.parse(iso)
  assert.equal(retryAfterSeconds(60, at('2026-11-10T12:00:15Z')), 45)
  assert.equal(retryAfterSeconds(60, at('2026-11-10T12:00:59.500Z')), 1)
  assert.equal(retryAfterSeconds(3600, at('2026-11-10T12:30:00Z')), 1800)
  assert.equal(retryAfterSeconds(86400, at('2026-11-10T18:00:00Z')), 6 * 3600)
})

test('limits are keyed per person and per item', () => {
  assert.notEqual(LIMITS.inviteEmails('a').key, LIMITS.inviteEmails('b').key)
  assert.notEqual(LIMITS.searchesPerUser('a').key, LIMITS.sameSearch('a', 'x').key)
  assert.equal(LIMITS.inviteEmails('a').max, 20)
  assert.equal(LIMITS.searchesPerUser('a').max, 40)
  assert.deepEqual([LIMITS.sameSearch('i', 's').windowSeconds, LIMITS.sameSearch('i', 's').max], [60, 1])
})

test('searchSignature is the same for the same search', () => {
  const a = { name: 'Lilla Åland stol', category: 'furniture', filters: { type: ['chair'], color: ['white'] } }
  const b = { name: '  lilla  åland STOL ', category: 'furniture', filters: { color: ['white'], type: ['chair'] } }
  assert.equal(searchSignature(a), searchSignature(b))
  assert.match(searchSignature(a), /^[0-9a-f]{8}$/)
})

test('searchSignature changes when the search changes', () => {
  const base = { name: 'Lilla Åland stol', category: 'furniture', filters: { type: ['chair'] } }
  const sig = searchSignature(base)
  assert.notEqual(searchSignature({ ...base, name: 'Lilla Åland bänk' }), sig)
  assert.notEqual(searchSignature({ ...base, category: null }), sig)
  assert.notEqual(searchSignature({ ...base, filters: { type: ['stool'] } }), sig)
  assert.notEqual(searchSignature({ ...base, brand: 'Carl Malmsten' }), sig)
})
