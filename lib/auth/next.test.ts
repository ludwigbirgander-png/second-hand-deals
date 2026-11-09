import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeNextPath, signInHref } from './next'

test('safeNextPath keeps paths on this site', () => {
  assert.equal(safeNextPath('/lists/join/abc123'), '/lists/join/abc123')
  assert.equal(safeNextPath('/reset-password'), '/reset-password')
  assert.equal(safeNextPath('/items/1?tab=sold'), '/items/1?tab=sold')
})

test('safeNextPath refuses anything that leaves the site', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil.example', 'javascript:alert(1)', '/\tjavascript:x', '/ x', ' /x']) {
    assert.equal(safeNextPath(bad), '/watchlist', bad)
  }
})

test('safeNextPath falls back when there is no path', () => {
  assert.equal(safeNextPath(null), '/watchlist')
  assert.equal(safeNextPath(''), '/watchlist')
  assert.equal(safeNextPath(undefined, '/reset-password'), '/reset-password')
})

test('signInHref encodes the path to come back to', () => {
  assert.equal(signInHref('/login', '/lists/join/abc'), '/login?next=%2Flists%2Fjoin%2Fabc')
  assert.equal(signInHref('/signup', '//evil.example'), '/signup?next=%2Fwatchlist')
})
