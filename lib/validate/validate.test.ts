import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parsePrice, parseItemFields, parseListFields, ITEM_NAME_MAX, LIST_NAME_MAX, PRICE_MAX } from './index'
import { COLORS } from '../colors'

test('the database limits match these checks', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261110_input_limits.sql', import.meta.url), 'utf8')
  const colors = sql.match(/color in \(([^)]*)\)/)?.[1].match(/'([a-z]+)'/g)?.map((c) => c.slice(1, -1))
  assert.deepEqual(colors, [...COLORS])
  assert.match(sql, new RegExp(`items_name_length[\\s\\S]*between 1 and ${ITEM_NAME_MAX}\\)`))
  assert.match(sql, new RegExp(`lists_name_length[\\s\\S]*between 1 and ${LIST_NAME_MAX}\\)`))
  assert.match(sql, new RegExp(`between 0 and ${PRICE_MAX}\\)`))
})

test('parsePrice accepts whole kronor and empty values', () => {
  assert.equal(parsePrice(1500), 1500)
  assert.equal(parsePrice('1500'), 1500)
  assert.equal(parsePrice(0), 0)
  assert.equal(parsePrice(PRICE_MAX), PRICE_MAX)
  assert.equal(parsePrice(null), null)
  assert.equal(parsePrice(undefined), null)
  assert.equal(parsePrice(''), null)
})

test('parsePrice refuses anything else', () => {
  for (const bad of [-1, 12.5, '12,5', 'abc', ' ', PRICE_MAX + 1, Infinity, NaN, true, {}, [100]]) {
    assert.equal(parsePrice(bad), undefined, String(bad))
  }
})

test('parseItemFields trims and checks the name', () => {
  assert.deepEqual(parseItemFields({ name: '  Lilla Åland stol ', min_price: 500, max_price: '2000' }), {
    ok: true, value: { name: 'Lilla Åland stol', brand: null, min_price: 500, max_price: 2000 },
  })
  assert.deepEqual(parseItemFields({ name: '   ' }), { ok: false, error: 'Name is required' })
  assert.equal(parseItemFields({ name: 'x'.repeat(ITEM_NAME_MAX) }).ok, true)
  assert.equal(parseItemFields({ name: 'x'.repeat(ITEM_NAME_MAX + 1) }).ok, false)
  assert.equal(parseItemFields({ name: 42 }).ok, false)
})

test('parseItemFields checks brand and prices', () => {
  assert.equal(parseItemFields({ name: 'Stol', brand: 'x'.repeat(ITEM_NAME_MAX + 1) }).ok, false)
  assert.deepEqual(parseItemFields({ name: 'Stol', min_price: -5 }), { ok: false, error: 'Prices must be whole numbers of kronor' })
  assert.equal(parseItemFields({ name: 'Stol', max_price: 99.9 }).ok, false)
})

test('parseListFields on create needs a name and allows a known colour', () => {
  assert.deepEqual(parseListFields({ name: ' Vardagsrum ', color: 'blue' }), { ok: true, value: { name: 'Vardagsrum', color: 'blue' } })
  assert.deepEqual(parseListFields({ name: 'Kök' }), { ok: true, value: { name: 'Kök' } })
  assert.deepEqual(parseListFields({}), { ok: false, error: 'Name is required' })
  assert.equal(parseListFields({ name: 'x'.repeat(LIST_NAME_MAX + 1) }).ok, false)
  assert.deepEqual(parseListFields({ name: 'Kök', color: 'url(javascript:alert(1))' }), { ok: false, error: 'Pick one of the list colours' })
})

test('parseListFields on edit only checks what is sent', () => {
  assert.deepEqual(parseListFields({ color: 'red' }, { partial: true }), { ok: true, value: { color: 'red' } })
  assert.deepEqual(parseListFields({}, { partial: true }), { ok: true, value: {} })
  assert.equal(parseListFields({ name: '' }, { partial: true }).ok, false)
  assert.equal(parseListFields({ color: 'chartreuse' }, { partial: true }).ok, false)
})
