import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  targetPriceAlerts, priceDropAlerts, auctionEndingAlerts, rareFindAlerts,
  type AlertItem, type AlertListing, type SentAlert,
} from './rules'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const now = Date.parse('2026-10-20T12:00:00Z')
const ago = (ms: number) => new Date(now - ms).toISOString()
const ahead = (ms: number) => new Date(now + ms).toISOString()

const item = (over: Partial<AlertItem> = {}): AlertItem => ({
  id: 'i1', user_id: 'u1', name: 'Eames chair', brand: null, notify: true,
  min_price: null, target_price: null, created_at: ago(60 * DAY), ...over,
})

let n = 0
const listing = (over: Partial<AlertListing> = {}): AlertListing => ({
  id: `l${++n}`, item_id: 'i1', site: 'Blocket', title: 'Eames stol', price: 1000, previous_price: null,
  currency: 'SEK', url: `https://example.com/${n}`, image_url: null, price_kind: 'fixed', bid_count: null,
  auction_ends_at: null, starred: false, match: 'match', removed_at: null, found_at: ago(30 * DAY), ...over,
})

test('target price: real, fixed-price matches at or under the target', () => {
  const it = item({ target_price: 1500 })
  const under = listing({ price: 1400 })
  const at = listing({ price: 1500 })
  const over = listing({ price: 1600 })
  const possible = listing({ price: 900, match: 'possible' })
  const removed = listing({ price: 900, removed_at: ago(HOUR) })
  const bid = listing({ price: 500, price_kind: 'bid' })
  const ended = listing({ price: 500, auction_ends_at: ago(HOUR), price_kind: 'fixed' })
  const got = targetPriceAlerts(it, [under, at, over, possible, removed, bid, ended], [], now).map((a) => a.listing.id)
  assert.deepEqual(got, [under.id, at.id])
})

test('target price: none without a target, and respects the minimum price', () => {
  assert.deepEqual(targetPriceAlerts(item(), [listing({ price: 1 })], [], now), [])
  const it = item({ target_price: 1500, min_price: 500 })
  assert.deepEqual(targetPriceAlerts(it, [listing({ price: 100 })], [], now), [], 'below the minimum is usually junk')
})

test('target price: once per listing, again only if the price drops further', () => {
  const it = item({ target_price: 1500 })
  const l = listing({ price: 1200 })
  const sent: SentAlert[] = [{ listing_id: l.id, kind: 'target_price', price: 1200 }]
  assert.equal(targetPriceAlerts(it, [l], sent, now).length, 0)
  assert.equal(targetPriceAlerts(it, [{ ...l, price: 1300 }], sent, now).length, 0)
  assert.equal(targetPriceAlerts(it, [{ ...l, price: 1100 }], sent, now).length, 1)
})

test('price drop: favourites only, below their previous price', () => {
  const it = item()
  const fav = listing({ starred: true, price: 800, previous_price: 1000 })
  const notFav = listing({ price: 800, previous_price: 1000 })
  const rose = listing({ starred: true, price: 1200, previous_price: 1000 })
  const auction = listing({ starred: true, price: 800, previous_price: 1000, price_kind: 'bid' })
  const alerts = priceDropAlerts(it, [fav, notFav, rose, auction], [], now)
  assert.deepEqual(alerts.map((a) => a.listing.id), [fav.id])
  assert.equal(alerts[0].oldPrice, 1000)
})

test('price drop: not again at the same price, again after a further drop', () => {
  const l = listing({ starred: true, price: 800, previous_price: 1000 })
  const sent: SentAlert[] = [{ listing_id: l.id, kind: 'price_drop', price: 800 }]
  assert.equal(priceDropAlerts(item(), [l], sent, now).length, 0)
  // 800 → 900 → 850: below the previous price but not below what was already sent
  assert.equal(priceDropAlerts(item(), [{ ...l, price: 850, previous_price: 900 }], sent, now).length, 0)
  assert.equal(priceDropAlerts(item(), [{ ...l, price: 700, previous_price: 800 }], sent, now).length, 1)
})

test('auction ending: favourited auctions ending within 3 hours, one reminder each', () => {
  const soon = listing({ starred: true, price_kind: 'bid', auction_ends_at: ahead(2 * HOUR) })
  const later = listing({ starred: true, price_kind: 'bid', auction_ends_at: ahead(5 * HOUR) })
  const over = listing({ starred: true, price_kind: 'bid', auction_ends_at: ago(HOUR) })
  const notFav = listing({ price_kind: 'bid', auction_ends_at: ahead(HOUR) })
  assert.deepEqual(auctionEndingAlerts(item(), [soon, later, over, notFav], [], now).map((a) => a.listing.id), [soon.id])
  const sent: SentAlert[] = [{ listing_id: soon.id, kind: 'auction_ending', price: 500 }]
  assert.equal(auctionEndingAlerts(item(), [soon], sent, now).length, 0)
})

test('rare find: a new match after 7 quiet days', () => {
  const old = listing({ found_at: ago(10 * DAY) })
  const fresh = listing({ found_at: ago(2 * HOUR) })
  assert.deepEqual(rareFindAlerts(item(), [old, fresh], [], now).map((a) => a.listing.id), [fresh.id])
})

test('rare find: not when something was found in the past week', () => {
  const recent = listing({ found_at: ago(3 * DAY) })
  const fresh = listing({ found_at: ago(2 * HOUR) })
  assert.equal(rareFindAlerts(item(), [recent, fresh], [], now).length, 0)
})

test('rare find: listings from the same run alert together', () => {
  const a = listing({ found_at: ago(2 * HOUR) })
  const b = listing({ found_at: ago(2 * HOUR - 30_000) })
  assert.equal(rareFindAlerts(item(), [a, b], [], now).length, 2)
})

test('rare find: not for a new item, a possible match, a removed find, or with notifications off', () => {
  const fresh = listing({ found_at: ago(2 * HOUR) })
  assert.equal(rareFindAlerts(item({ created_at: ago(3 * DAY) }), [fresh], [], now).length, 0)
  assert.equal(rareFindAlerts(item({ notify: false }), [fresh], [], now).length, 0)
  assert.equal(rareFindAlerts(item(), [listing({ found_at: ago(HOUR), match: 'possible' })], [], now).length, 0)
  // A removed listing isn't a find, so it doesn't break the quiet spell either
  const junk = listing({ found_at: ago(2 * DAY), removed_at: ago(DAY) })
  assert.equal(rareFindAlerts(item(), [junk, fresh], [], now).length, 1)
})

test('rare find: once per listing, and only for recent finds', () => {
  const fresh = listing({ found_at: ago(2 * HOUR) })
  assert.equal(rareFindAlerts(item(), [fresh], [{ listing_id: fresh.id, kind: 'rare_find', price: 1000 }], now).length, 0)
  assert.equal(rareFindAlerts(item(), [listing({ found_at: ago(2 * DAY) })], [], now).length, 0)
})
