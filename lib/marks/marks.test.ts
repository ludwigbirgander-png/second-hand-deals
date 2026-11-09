import { test } from 'node:test'
import assert from 'node:assert/strict'
import { followerView, markUpdate, isMissingMarksTable, idList } from './index'

const listing = (over: Partial<{ starred: boolean; removed_at: string | null; removed_word: string | null }> = {}) => ({
  id: 'l1', title: 'Lilla Åland stol', starred: false, removed_at: null as string | null, removed_word: null as string | null, ...over,
})

test("a follower doesn't see the owner's favourite or removal", () => {
  const owners = listing({ starred: true })
  assert.equal(followerView(owners, null)?.starred, false)

  const removedByOwner = listing({ removed_at: '2026-11-01T00:00:00Z' })
  assert.equal(followerView(removedByOwner, null)?.removed_at, null)
})

test("a follower sees their own favourite and removal", () => {
  assert.equal(followerView(listing(), { starred: true, removed_at: null })?.starred, true)
  assert.equal(followerView(listing({ starred: true }), { starred: false, removed_at: '2026-11-02T00:00:00Z' })?.removed_at, '2026-11-02T00:00:00Z')
})

test("listings the owner hid with a word are dropped, unless the follower favourited them", () => {
  const hidden = listing({ removed_at: '2026-11-01T00:00:00Z', removed_word: 'barnstol' })
  assert.equal(followerView(hidden, null), null)
  assert.equal(followerView(hidden, { starred: false, removed_at: null }), null)

  const kept = followerView(hidden, { starred: true, removed_at: null })
  assert.ok(kept)
  assert.equal(kept.removed_at, null)
  assert.equal(kept.removed_word, null)
})

test('followerView keeps the other fields', () => {
  assert.equal(followerView(listing(), null)?.title, 'Lilla Åland stol')
})

test('markUpdate follows the same rules as the owner', () => {
  const now = new Date('2026-11-05T10:00:00Z')
  assert.deepEqual(markUpdate({ starred: true }, now), { starred: true })
  assert.deepEqual(markUpdate({ removed: true }, now), { removed_at: '2026-11-05T10:00:00.000Z', starred: false })
  assert.deepEqual(markUpdate({ removed: false, starred: true }, now), { starred: true, removed_at: null })
  assert.equal(markUpdate({}, now), null)
  assert.equal(markUpdate({ starred: 'yes', removed: 1 }, now), null)
})

test('isMissingMarksTable spots a missing table, not other errors', () => {
  assert.equal(isMissingMarksTable({ code: '42P01', message: 'relation "listing_marks" does not exist' }), true)
  assert.equal(isMissingMarksTable({ code: 'PGRST205', message: "Could not find the table 'public.listing_marks'" }), true)
  assert.equal(isMissingMarksTable({ code: '57014', message: 'canceling statement due to statement timeout' }), false)
  assert.equal(isMissingMarksTable(null), false)
})

test('idList formats a PostgREST list', () => {
  assert.equal(idList(['a', 'b']), '(a,b)')
})
