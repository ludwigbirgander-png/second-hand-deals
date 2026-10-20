import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAuctionet } from './auctionet'
import { parseBukowskis } from './bukowskis'
import { parseTraderaApi, parseTraderaHtml } from './tradera'
import { buildQuery, isRelevant } from './index'
import { nameWithBrand } from '../itemName'

// Saved responses (see __fixtures__). Run from the repo root: npm test
const fixture = (name: string) => readFileSync(`lib/scrapers/__fixtures__/${name}`, 'utf8')
const auctionet = JSON.parse(fixture('auctionet-search.json'))
const bukowskis = fixture('bukowskis-search.html')
const tradera = JSON.parse(fixture('tradera-api-search.json'))
const traderaHtml = fixture('tradera-search.html')

// Before every lot in the fixtures ends, and long after
const BEFORE = Date.UTC(2026, 9, 11)
const AFTER = Date.UTC(2027, 0, 1)

test('Auctionet: keeps SEK lots and prices them by highest bid or starting bid', () => {
  const listings = parseAuctionet(auctionet, BEFORE)
  assert.equal(listings.length, 3, 'the DKK and EUR lots are dropped')
  for (const l of listings) {
    assert.equal(l.site, 'Auctionet')
    assert.equal(l.currency, 'SEK')
    assert.match(l.url, /^https:\/\/auctionet\.com\/sv\//)
    assert.ok(l.title.length > 0)
    assert.ok(l.auctionEndsAt && new Date(l.auctionEndsAt).getTime() > BEFORE)
  }

  const raw = auctionet.items.filter((i: { currency: string }) => i.currency === 'SEK')
  const withBids = listings.filter((l) => l.priceKind === 'bid')
  assert.equal(withBids.length, 2)
  withBids.forEach((l, i) => {
    assert.equal(l.price, Math.max(...raw[i].bids.map((b: { amount: number }) => b.amount)))
    assert.equal(l.bidCount, raw[i].bids.length)
  })
  const noBids = listings.find((l) => l.priceKind === 'start')!
  assert.equal(noBids.price, raw[2].starting_bid_amount)
  assert.equal(noBids.bidCount, 0)
})

test('Auctionet: drops ended lots', () => {
  assert.deepEqual(parseAuctionet(auctionet, AFTER), [])
})

test('Bukowskis: parses lot cards, skipping EUR lots', () => {
  const listings = parseBukowskis(bukowskis, BEFORE)
  assert.equal(listings.length, 3)
  assert.deepEqual(listings.map((l) => [l.price, l.priceKind]), [[800, 'bid'], [2000, 'bid'], [listings[2].price, 'start']])
  assert.ok(listings[2].price! > 0, 'without bids the starting price is used')
  assert.equal(listings[0].title, 'Arne Jacobsen, Stol, "Grand Prix", Fritz Hansen')
  assert.equal(listings[0].url, 'https://www.bukowskis.com/sv/lots/1744675-arne-jacobsen-stol-grand-prix-fritz-hansen')
  assert.equal(listings[0].auctionEndsAt, new Date(1791997200 * 1000).toISOString())
  assert.match(listings[0].imageUrl ?? '', /^https:\/\//)
})

test('Bukowskis: drops ended lots', () => {
  assert.deepEqual(parseBukowskis(bukowskis, AFTER), [])
})

test('Tradera API: auctions show the bid, Buy now items the fixed price', () => {
  const listings = parseTraderaApi(tradera, BEFORE)
  assert.equal(listings.length, 3, 'the ended item is dropped')
  const [withBids, noBids, buyNow] = listings
  assert.deepEqual([withBids.price, withBids.priceKind, withBids.bidCount], [12500, 'bid', 7])
  assert.deepEqual([noBids.price, noBids.priceKind, noBids.bidCount], [300, 'start', 0])
  assert.deepEqual([buyNow.price, buyNow.priceKind, buyNow.auctionEndsAt], [1450, 'fixed', null])
  assert.equal(withBids.auctionEndsAt, '2026-10-20T19:00:00.000Z')
  assert.equal(noBids.imageUrl, 'https://img.tradera.net/images/700000002.jpg')
})

test('Tradera API: also reads PascalCase fields', () => {
  const pascal = {
    Items: [{ Id: 1, ShortDescription: 'Eames stol', ItemType: 'Auction', HasBids: true, BidCount: 1, MaxBid: 400, EndDate: '2026-10-20T19:00:00Z', ItemUrl: 'https://www.tradera.com/item/1' }],
  }
  const [l] = parseTraderaApi(pascal, BEFORE)
  assert.deepEqual([l.title, l.price, l.priceKind], ['Eames stol', 400, 'bid'])
})

test('Tradera HTML: reads title, price and sale type from search cards', () => {
  const listings = parseTraderaHtml(traderaHtml)
  assert.deepEqual(
    listings.map((l) => [l.title, l.price, l.priceKind]),
    [
      ['Apple iPhone 16 Pro', 6250, 'bid'],
      ['iPhone', 2000, 'start'],
      ['iPhone 13 Pro + 2 cases', 1748, null],
      ['iPhone', 3000, 'fixed'],
    ],
  )
  assert.equal(listings[0].url, 'https://www.tradera.com/item/340186/754033846/apple-iphone-16-pro')
  assert.match(listings[0].imageUrl ?? '', /^https:\/\/img\.tradera\.net\//)
})

test('isRelevant matches auction-house titles', () => {
  assert.ok(isRelevant('CHARLES & RAY EAMES, underrede "Eames Segmented Tables", 2000-tal.', 'Eames'))
  assert.ok(isRelevant('Arne Jacobsen, Stol, "Grand Prix", Fritz Hansen', 'Fritz Hansen Grand Prix'))
  assert.ok(isRelevant('Josef Frank, spegel, Firma Svenskt Tenn', 'josef frank svenskt tenn'))
  assert.ok(isRelevant("Levi's 501 jeans", 'levis 501'))
  assert.ok(!isRelevant('Bruno Mathsson, fåtölj "Eva"', 'Eames'))
})

test('brand merge: the brand moves into the name, and the search stays the same', () => {
  assert.equal(nameWithBrand('Sony', 'WH-1000XM4'), 'Sony WH-1000XM4')
  assert.equal(nameWithBrand(null, 'Eames chair'), 'Eames chair')
  assert.equal(nameWithBrand('  ', 'Eames chair'), 'Eames chair')
  // Already in the name: not doubled
  assert.equal(nameWithBrand('Acne', 'Acne läderjacka'), 'Acne läderjacka')
  assert.equal(nameWithBrand('acne', 'Acne läderjacka'), 'Acne läderjacka')
  assert.equal(buildQuery(null, nameWithBrand('Sony', 'WH-1000XM4')), buildQuery('Sony', 'WH-1000XM4'))
})
