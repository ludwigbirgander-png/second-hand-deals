import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCategory, suggestCategory, sanitizeFilters, sanitizeFiltersFor, sitesForCategory, describeFilters, describeFiltersFor, visibleFields } from './index'
import { normalizeCondition, conditionFromTitle, parseSize, extractAttributes } from './attributes'
import { checkListing, hasNegativeWord } from './filter'
import { decades, numbersWithUnit, percentNear, quantity } from './parse'
import { sellpyFilters, sellpyAttributes, vintedParams, blocketParams, siteExcluded } from './native'
import { parseVintedCardTitle } from '../scrapers/vinted'
import type { Category, ItemFilters } from './types'

const clothing = getCategory('clothing')!
const shoes = getCategory('shoes')!

test('suggests a category from the item name', () => {
  assert.equal(suggestCategory('Acne läderjacka'), 'clothing')
  assert.equal(suggestCategory("Levi's 501 jeans"), 'clothing')
  assert.equal(suggestCategory('Nike Air Max 90'), 'shoes')
  assert.equal(suggestCategory('Dr Martens 1460'), 'shoes')
  assert.equal(suggestCategory('vinterkängor'), 'shoes')
  assert.equal(suggestCategory('Eames chair'), null)
  assert.equal(suggestCategory('iPhone 13'), null)
})

test('condition: site wordings on one scale', () => {
  assert.equal(normalizeCondition('Ny med prislapp'), 'new_with_tags')
  assert.equal(normalizeCondition('Ny utan prislapp'), 'new')
  assert.equal(normalizeCondition('Mycket bra'), 'like_new')
  assert.equal(normalizeCondition('Bra'), 'good')
  assert.equal(normalizeCondition('Hyfsat'), 'fair')
  assert.equal(normalizeCondition('Acceptabelt'), 'fair')
  assert.equal(normalizeCondition('Very good'), 'like_new', 'the old Sellpy English label')
  assert.equal(normalizeCondition('Skick: Bra'), 'good')
  assert.equal(normalizeCondition('Something else'), undefined)
})

test('condition: a few title phrases, never a guess', () => {
  assert.equal(conditionFromTitle('Acne jacka med lappar kvar'), 'new_with_tags')
  assert.equal(conditionFromTitle('Oanvänd Fjällräven Kånken'), 'new')
  assert.equal(conditionFromTitle('Hästens säng i nyskick'), 'like_new')
  assert.equal(conditionFromTitle('Nike skor, trasig sula'), 'parts')
  assert.equal(conditionFromTitle('Nike sneakers stl 42 vita'), undefined)
})

test('size: Sellpy codes', () => {
  assert.deepEqual(parseSize('WMN-INT-M', '', false), { letter: ['M'] })
  assert.deepEqual(parseSize('WMN-INT-S/M', '', false), { letter: ['S', 'M'] })
  assert.deepEqual(parseSize('MEN-EU-48', '', false), { eu: 48 })
  assert.deepEqual(parseSize('PANTS-INCH-32', '', false), { waist: 32 })
  assert.deepEqual(parseSize('CHILD-CM-140', '', false), { kids: 140 })
  assert.deepEqual(parseSize('SHOES-EU-38.5', '', true), { eu: 38.5 })
})

test('size: Vinted size field', () => {
  assert.deepEqual(parseSize('48 | W32', '', false), { eu: 48, waist: 32 })
  assert.deepEqual(parseSize('L', '', false), { letter: ['L'] })
  assert.deepEqual(parseSize('42', '', true), { eu: 42 })
})

test('size: from titles', () => {
  assert.deepEqual(parseSize(null, 'Lexington jacka XS svart dam', false), { letter: ['XS'] })
  assert.deepEqual(parseSize(null, 'Lindex quiltad jacka M svart dam', false), { letter: ['M'] })
  assert.deepEqual(parseSize(null, 'Jacka storlek M', false), { letter: ['M'] })
  assert.deepEqual(parseSize(null, 'St Martins jacka stl 34 flerfärgad', false), { eu: 34 })
  assert.deepEqual(parseSize(null, "Levi's 501 W32 L34", false), { waist: 32, length: 34 })
  assert.deepEqual(parseSize(null, 'Overall stl 140 cl', false), { kids: 140 })
  assert.deepEqual(parseSize(null, "Levi's 501 vintage 31/34", false), { waist: 31, length: 34 })
  assert.deepEqual(parseSize(null, 'Levis 501 32/32', false), { waist: 32, length: 32 })
  assert.deepEqual(parseSize(null, 'Levis 501 Rolled shorts - storlek 34', false), { waist: 34 })
  assert.deepEqual(parseSize(null, 'Klänning stl 38/40', false), { eu: 38 }, 'outside trousers, 38/40 means either size')
  assert.deepEqual(parseSize(null, 'Nike sneakers svart stl 44', true), { eu: 44 })
  assert.deepEqual(parseSize(null, 'Nike ”vinter-sneakers” storlek 38,5', true), { eu: 38.5 })
  assert.deepEqual(parseSize(null, 'Adidas Samba EU 42 2/3', true), { eu: 42.67 })
  assert.deepEqual(parseSize(null, 'jacka i fint skick, m', false), {}, 'a lone lowercase s/m/l is not a size')
  assert.deepEqual(parseSize(null, 'Jacka 2 fickor', false), {}, 'a plain number without "stl" is not a size')
})

test('size: Vinted size "Annat" means not stated', () => {
  assert.deepEqual(parseVintedCardTitle("Levi’s 501 CT, Varumärke: Levi's, Skick: Mycket bra, Storlek: Annat, 200.00 kr, 217.50 kr"),
    { title: 'Levi’s 501 CT', brand: "Levi's", condition: 'Mycket bra', size: null })
  assert.deepEqual(parseVintedCardTitle('Levis herr jeans, W32, Varumärke: Levi\'s, Skick: Ny utan prislapp, Storlek: 48 | W32, 250.00 kr, 270.00 kr'),
    { title: 'Levis herr jeans, W32', brand: "Levi's", condition: 'Ny utan prislapp', size: '48 | W32' })
})

test('attributes: options found in titles', () => {
  const a = extractAttributes({ title: 'Svart läderjacka dam stl 38, nyskick' }, clothing)
  assert.equal(a.department, 'women')
  assert.deepEqual(a.type, ['jacket'])
  assert.deepEqual(a.color, ['black'])
  assert.deepEqual(a.material, ['leather'])
  assert.deepEqual(a.size, { eu: 38 })
  assert.equal(a.condition, 'like_new')
  // Without a category, only the condition
  assert.deepEqual(extractAttributes({ title: 'Svart läderjacka dam stl 38, nyskick' }), { condition: 'like_new' })
})

test('attributes: what the site states wins over the title', () => {
  const a = extractAttributes({ title: 'Jacka', attributes: { color: ['blue'], department: 'men' } }, clothing)
  assert.deepEqual(a.color, ['blue'])
  assert.equal(a.department, 'men')
})

test('built-in junk words, unless part of the search', () => {
  assert.equal(hasNegativeWord('Nike Air Max endast kartong', 'Nike Air Max', shoes), true)
  assert.equal(hasNegativeWord('Nike skosnören vita', 'Nike Air Max', shoes), true)
  assert.equal(hasNegativeWord('Nike skosnören vita', 'Nike skosnören', shoes), false)
  assert.equal(hasNegativeWord('Grå Nike sneakers med svart sula', 'Nike sneakers', shoes), false)
  assert.equal(hasNegativeWord('Acne jacka med fläck på ärmen', 'Acne jacka', clothing), true)
  assert.equal(hasNegativeWord('Acne jacka, endast använd en gång', 'Acne jacka', clothing), false)
  assert.equal(hasNegativeWord('Acne jacka endast kartong', 'Acne jacka', undefined), false)
})

const listing = (title: string, attrs: object = {}, extra: object = {}) => {
  const attributes = { ...extractAttributes({ title }, clothing), ...attrs }
  return { title, attributes, ...extra }
}

test('filters: a contradicting detail drops the listing, a missing one is kept and noted', () => {
  const f: ItemFilters = { size: { system: 'letter', values: ['M', 'L'] }, color: ['black'] }
  assert.deepEqual(checkListing(listing('Svart jacka stl M'), f, clothing), { keep: true, unstated: [] })
  assert.equal(checkListing(listing('Svart jacka stl S'), f, clothing).keep, false)
  assert.equal(checkListing(listing('Blå jacka stl M'), f, clothing).keep, false)
  assert.deepEqual(checkListing(listing('Jacka'), f, clothing), { keep: true, unstated: ['color', 'size'] })
})

test('filters: strict drops listings that don\'t state a detail, but only on the final check', () => {
  const f: ItemFilters = { size: { system: 'letter', values: ['M'] }, strict: true }
  assert.equal(checkListing(listing('Jacka'), f, clothing).keep, false)
  assert.equal(checkListing(listing('Jacka'), f, clothing, { final: false }).keep, true)
})

test('filters: minimum condition', () => {
  const f: ItemFilters = { condition: 'like_new' }
  assert.equal(checkListing(listing('Jacka', { condition: 'new' }), f, clothing).keep, true)
  assert.equal(checkListing(listing('Jacka', { condition: 'like_new' }), f, clothing).keep, true)
  assert.equal(checkListing(listing('Jacka', { condition: 'good' }), f, clothing).keep, false)
  assert.deepEqual(checkListing(listing('Jacka'), f, undefined).unstated, ['condition'])
})

test('filters: sale type', () => {
  const auction = listing('Jacka', {}, { priceKind: 'bid' })
  const fixed = listing('Jacka', {}, { priceKind: 'fixed' })
  const unknown = listing('Jacka')
  assert.equal(checkListing(auction, { saleType: 'auction' }, undefined).keep, true)
  assert.equal(checkListing(fixed, { saleType: 'auction' }, undefined).keep, false)
  assert.equal(checkListing(unknown, { saleType: 'fixed' }, undefined).keep, true, 'marketplace listings are fixed price')
  assert.equal(checkListing(listing('Jacka', {}, { auctionEndsAt: '2026-11-01T12:00:00Z' }), { saleType: 'fixed' }, undefined).keep, false)
})

test('filters: department, unisex counts for women and men', () => {
  const f: ItemFilters = { department: ['women'] }
  assert.equal(checkListing(listing('Jacka dam'), f, clothing).keep, true)
  assert.equal(checkListing(listing('Jacka herr'), f, clothing).keep, false)
  assert.equal(checkListing(listing('Jacka unisex'), f, clothing).keep, true)
})

test('filters: shoe sizes count half and third sizes as the whole size', () => {
  const f: ItemFilters = { size: { system: 'eu', values: [42] } }
  const shoe = (title: string) => ({ title, attributes: extractAttributes({ title }, shoes) })
  assert.equal(checkListing(shoe('Nike stl 42'), f, shoes).keep, true)
  assert.equal(checkListing(shoe('Nike stl 42,5'), f, shoes).keep, true)
  assert.equal(checkListing(shoe('Adidas EU 42 2/3'), f, shoes).keep, true)
  assert.equal(checkListing(shoe('Nike stl 43'), f, shoes).keep, false)
})

test('filters: jeans waist and length', () => {
  const f: ItemFilters = { size: { system: 'jeans', waist: [32], length: [32, 34] } }
  assert.equal(checkListing(listing("Levi's 501 W32 L34"), f, clothing).keep, true)
  assert.equal(checkListing(listing("Levi's 501 W33 L34"), f, clothing).keep, false)
  assert.deepEqual(checkListing(listing("Levi's 501 W32"), f, clothing).unstated, ['size'])
})

test('Sellpy: filters go into the search', () => {
  const f = sellpyFilters({ category: clothing, filters: {
    department: ['men'], type: ['jacket'], size: { system: 'letter', values: ['M'] }, color: ['black'], condition: 'like_new',
  } })!
  assert.match(f, /^price_SE\.amount > 0/)
  assert.match(f, /metadata\.condition:"Nytt" OR metadata\.condition:"Mycket bra"\)/)
  assert.match(f, /categories\.lvl2:"Man > Kläder > Jackor & Ytterkläder"/)
  assert.match(f, /metadata\.demography:"Man"/)
  assert.match(f, /metadata\.color:"Svart"/)
  assert.match(f, /metadata\.size:"MEN-INT-M" OR metadata\.size:"MEN-INT-S\/M" OR metadata\.size:"MEN-INT-M\/L"/)
  assert.doesNotMatch(f, /WMN/)

  const s = sellpyFilters({ category: shoes, filters: { size: { system: 'eu', values: [42] } } })!
  assert.match(s, /categories\.lvl1:"Kvinna > Skor" OR categories\.lvl1:"Man > Skor" OR categories\.lvl1:"Barn > Skor"/)
  assert.match(s, /SHOES-EU-42" OR .*SHOES-EU-42\.5"/)

  assert.equal(sellpyFilters({ filters: { saleType: 'auction' } }), null, 'Sellpy has no auctions')
  assert.equal(sellpyFilters({ filters: { condition: 'new_with_tags' } }), null)
  assert.equal(sellpyFilters({}), 'price_SE.amount > 0')
})

test('Sellpy: hit metadata as option ids', () => {
  const a = sellpyAttributes(
    { condition: 'Mycket bra', color: ['Brun'], material: ['Akryl', 'Ull'], demography: 'Kvinna' },
    'clothing', 'Kvinna > Kläder > Jackor & Ytterkläder', { eu: 42 })
  assert.deepEqual(a, { condition: 'like_new', size: { eu: 42 }, department: 'women', color: ['brown'], material: ['wool'], type: ['jacket'] })
})

test('Vinted and Blocket parameters', () => {
  assert.deepEqual(vintedParams({ filters: { condition: 'like_new' } }), ['status_ids[]=6', 'status_ids[]=1', 'status_ids[]=2'])
  assert.deepEqual(vintedParams({}), [])
  assert.equal(vintedParams({ filters: { saleType: 'auction' } }), null)
  assert.deepEqual(blocketParams({ category: clothing }), ['category=0.71'])
  assert.deepEqual(blocketParams({}), [])
})

test('sites: the category narrows them, the sale type can rule some out', () => {
  assert.deepEqual(sitesForCategory(['Blocket', 'Auctionet', 'Sellpy', 'Bukowskis'], 'clothing'), ['Blocket', 'Sellpy'])
  assert.deepEqual(sitesForCategory(['Blocket', 'Auctionet'], null), ['Blocket', 'Auctionet'])
  assert.equal(siteExcluded('Sellpy', { saleType: 'auction' }), true)
  assert.equal(siteExcluded('Tradera', { saleType: 'auction' }), false)
  assert.equal(siteExcluded('Auctionet', { saleType: 'fixed' }), true)
})

test('sanitizeFilters keeps only valid choices', () => {
  assert.deepEqual(sanitizeFilters('clothing', {
    color: ['black', 'plaid'], size: { system: 'letter', values: ['M', 'Q'] }, condition: 'good', saleType: 'barter', strict: 'yes', bogus: 1,
  }), { category: 'clothing', filters: { condition: 'good', color: ['black'], size: { system: 'letter', values: ['M'] } } })
  assert.deepEqual(sanitizeFilters('cars', { color: ['black'], condition: 'new' }), { category: null, filters: { condition: 'new' } })
  assert.deepEqual(sanitizeFilters('shoes', { size: { system: 'letter', values: ['M'] } }), { category: 'shoes', filters: {} }, 'shoes have EU sizes only')
})

test('describeFilters: chips for the item page', () => {
  assert.deepEqual(describeFilters('clothing', { department: ['men'], size: { system: 'jeans', waist: [32], length: [34] }, condition: 'good', strict: true }),
    ['Clothing', 'Men', 'Size W32 L34', 'Good or better', 'Strict'])
  assert.deepEqual(describeFilters(null, {}), [])
})

// ─── Phase 5: field kinds, on a test-only category ───────────────────────────

const gadget: Category = {
  id: 'clothing', // any id; this category is never registered
  label: 'Gadget',
  hints: [],
  sites: [],
  negativeWords: [],
  fields: [
    { key: 'type', label: 'Type', kind: 'options', options: [
      { id: 'watch', label: 'Watch', words: ['klocka'] },
      { id: 'ring', label: 'Ring', words: ['ring'] },
    ] },
    { key: 'battery', label: 'Battery health', short: 'Battery', kind: 'min', unit: '%', bounds: [50, 100] },
    { key: 'caseSize', label: 'Case size', short: 'Case', kind: 'range', unit: 'mm', bounds: [20, 55], showWhen: { type: ['watch'] } },
    { key: 'unlocked', label: 'Unlocked', kind: 'toggle', toggle: 'require' },
    { key: 'secondSort', label: 'Second sort OK', kind: 'toggle', toggle: 'allow' },
  ],
}

test('sanitize: each field kind keeps only valid values', () => {
  assert.deepEqual(sanitizeFiltersFor(gadget, { battery: 85, unlocked: true, secondSort: true }), { battery: 85, unlocked: true, secondSort: true })
  assert.deepEqual(sanitizeFiltersFor(gadget, { battery: '90' }), { battery: 90 }, 'numbers from a form')
  assert.deepEqual(sanitizeFiltersFor(gadget, { battery: 120 }), {}, 'out of bounds')
  assert.deepEqual(sanitizeFiltersFor(gadget, { battery: 'lots' }), {})
  assert.deepEqual(sanitizeFiltersFor(gadget, { unlocked: false, secondSort: 'yes' }), {}, 'toggles only as true')
  assert.deepEqual(sanitizeFiltersFor(gadget, { caseSize: { from: 38, to: 41 } }), { caseSize: { from: 38, to: 41 } })
  assert.deepEqual(sanitizeFiltersFor(gadget, { caseSize: { from: 42, to: 38 } }), { caseSize: { from: 38, to: 42 } }, 'swapped')
  assert.deepEqual(sanitizeFiltersFor(gadget, { caseSize: { from: 40 } }), { caseSize: { from: 40 } }, 'open end')
  assert.deepEqual(sanitizeFiltersFor(gadget, { caseSize: { from: 5, to: 99 } }), {}, 'both ends out of bounds')
  assert.deepEqual(sanitizeFiltersFor(gadget, { caseSize: {} }), {})
  assert.deepEqual(sanitizeFiltersFor(gadget, { type: ['watch', 'phone'] }), { type: ['watch'] })
})

test('visibleFields: showWhen hides fields for other types', () => {
  const keys = (f: ItemFilters) => visibleFields(gadget, f).map((x) => x.key)
  assert.ok(keys({}).includes('caseSize'), 'no type picked: shown')
  assert.ok(keys({ type: ['watch'] }).includes('caseSize'))
  assert.ok(keys({ type: ['watch', 'ring'] }).includes('caseSize'))
  assert.ok(!keys({ type: ['ring'] }).includes('caseSize'))
  // A hidden field isn't saved
  assert.deepEqual(sanitizeFiltersFor(gadget, { type: ['ring'], caseSize: { from: 38 } }), { type: ['ring'] })
})

test('describe: chips for the new field kinds', () => {
  assert.deepEqual(describeFiltersFor(gadget, { battery: 85 }), ['Gadget', 'Battery 85 %+'])
  assert.deepEqual(describeFiltersFor(gadget, { caseSize: { from: 38, to: 41 } }), ['Gadget', 'Case 38–41 mm'])
  assert.deepEqual(describeFiltersFor(gadget, { caseSize: { from: 40 } }), ['Gadget', 'Case 40 mm or more'])
  assert.deepEqual(describeFiltersFor(gadget, { caseSize: { to: 40 } }), ['Gadget', 'Case up to 40 mm'])
  assert.deepEqual(describeFiltersFor(gadget, { unlocked: true, secondSort: true }), ['Gadget', 'Unlocked', 'Second sort OK'])
})

// ─── Phase 5: reading numbers from titles ────────────────────────────────────

test('parse: numbers with a unit, never bare numbers', () => {
  assert.deepEqual(numbersWithUnit('iPhone 13 128GB svart', ['gb']), [128])
  assert.deepEqual(numbersWithUnit('MacBook Air M2 8 GB / 256 GB', ['gb']), [8, 256])
  assert.deepEqual(numbersWithUnit('Samsung S23 1 TB', ['tb']), [1])
  assert.deepEqual(numbersWithUnit('Omega Seamaster 41 mm', ['mm']), [41])
  assert.deepEqual(numbersWithUnit('Omega 41mm automatic', ['mm']), [41])
  assert.deepEqual(numbersWithUnit('MacBook Pro 13" 2019', ['"', '″', 'tum']), [13])
  assert.deepEqual(numbersWithUnit('MacBook Pro 13,3 tum', ['"', '″', 'tum']), [13.3])
  assert.deepEqual(numbersWithUnit('MacBook Pro 16-tum', ['"', '″', 'tum']), [16])
  assert.deepEqual(numbersWithUnit('iPhone 13 Pro', ['"', '″', 'tum']), [])
  assert.deepEqual(numbersWithUnit('iPhone 13 Pro', ['gb']), [])
})

test('parse: percent next to a keyword', () => {
  const battery = ['batterihälsa', 'batteri', 'battery', 'bh']
  assert.equal(percentNear('iPhone 13 128 GB batterihälsa 89%', battery), 89)
  assert.equal(percentNear('iPhone 13, 86% batterihälsa!', battery), 86)
  assert.equal(percentNear('iPhone 12 Batteri: 91 %', battery), 91)
  assert.equal(percentNear('iPhone 12 BH 100%', battery), 100)
  assert.equal(percentNear('iPhone 12 -20% rea', battery), undefined)
  assert.equal(percentNear('iPhone 12', battery), undefined)
})

test('parse: quantity', () => {
  assert.equal(quantity('Lilla Åland stolar 4 st'), 4)
  assert.equal(quantity('4st tallrikar Mon Amie'), 4)
  assert.equal(quantity('Arne Jacobsen stolar, 6 st, Sjuan'), 6)
  assert.equal(quantity('Stolar, ett par, rokoko'), 2)
  assert.equal(quantity('Ett par fåtöljer'), 2)
  assert.equal(quantity('Set om 6 glas Iittala'), 6)
  assert.equal(quantity('Sex tallrikar Ostindia', ['tallrikar']), 6)
  assert.equal(quantity('6 tallrikar Mon Amie', ['tallrikar']), 6)
  assert.equal(quantity('Mon Amie tallrik 25 cm'), undefined)
  assert.equal(quantity('Matgrupp 1960-tal'), undefined)
  assert.equal(quantity('iPhone 13 Pro'), undefined)
})

test('parse: decades', () => {
  assert.deepEqual(decades('60-tals teakbord'), [1960])
  assert.deepEqual(decades('Fåtölj 1950-tal'), [1950])
  assert.deepEqual(decades('Byrå, 1960-talet'), [1960])
  assert.deepEqual(decades('Sideboard 1950/60-tal'), [1950, 1960])
  assert.deepEqual(decades('Ilmari Tapiovaara stolar 1950-60-tal'), [1950, 1960])
  assert.deepEqual(decades('Vintage lamp 1970s'), [1970])
  assert.deepEqual(decades('Mid century chair'), [1950, 1960])
  assert.deepEqual(decades('Stolar 1800-talets första hälft'), [])
  assert.deepEqual(decades('Stol 1900-tal'), [])
  assert.deepEqual(decades('Bord 120 cm'), [])
})

// ─── Phase 5: details and checks by field kind ───────────────────────────────

const parsed: Category = {
  ...gadget,
  fields: gadget.fields.map((f) => ({
    ...f,
    parse: {
      battery: (t: string) => percentNear(t, ['batterihälsa', 'batteri']),
      caseSize: (t: string) => numbersWithUnit(t, ['mm'])[0],
      unlocked: (t: string) => /olåst/i.test(t) || undefined,
      secondSort: (t: string) => /2:a sortering/i.test(t) || undefined,
    }[f.key],
  })),
}
const gadgetListing = (title: string) => ({ title, attributes: extractAttributes({ title }, parsed) })

test('attributes: each field kind read from the title', () => {
  assert.deepEqual(extractAttributes({ title: 'Klocka 41 mm, batteri 88%, olåst' }, parsed), { type: ['watch'], battery: 88, caseSize: 41, unlocked: true })
  assert.deepEqual(extractAttributes({ title: 'Tallrik 2:a sortering' }, parsed), { secondSort: true })
  // What the site states wins
  assert.deepEqual(extractAttributes({ title: 'Klocka batteri 88%', attributes: { battery: 95 } }, parsed).battery, 95)
})

test('filters: min, range and toggle', () => {
  const check = (title: string, f: ItemFilters) => checkListing(gadgetListing(title), f, parsed)
  assert.deepEqual(check('Klocka batteri 90%', { battery: 85 }), { keep: true, unstated: [] })
  assert.deepEqual(check('Klocka batteri 85%', { battery: 85 }), { keep: true, unstated: [] })
  assert.equal(check('Klocka batteri 80%', { battery: 85 }).keep, false)
  assert.deepEqual(check('Klocka', { battery: 85 }), { keep: true, unstated: ['battery'] })
  assert.equal(check('Klocka', { battery: 85, strict: true }).keep, false)

  assert.equal(check('Klocka 40 mm', { caseSize: { from: 38, to: 41 } }).keep, true)
  assert.equal(check('Klocka 42 mm', { caseSize: { from: 38, to: 41 } }).keep, false)
  assert.equal(check('Klocka 36 mm', { caseSize: { from: 38 } }).keep, false)
  assert.equal(check('Klocka 44 mm', { caseSize: { from: 38 } }).keep, true)
  assert.deepEqual(check('Klocka', { caseSize: { to: 40 } }), { keep: true, unstated: ['caseSize'] })

  assert.deepEqual(check('Telefon olåst', { unlocked: true }), { keep: true, unstated: [] })
  assert.deepEqual(check('Telefon', { unlocked: true }), { keep: true, unstated: ['unlocked'] })

  // 'allow' toggles: off hides listings that say so; nothing is "not stated"
  assert.equal(check('Tallrik 2:a sortering', {}).keep, false)
  assert.equal(check('Tallrik 2:a sortering', { secondSort: true }).keep, true)
  assert.deepEqual(check('Tallrik', {}), { keep: true, unstated: [] })
})

test('filters: a field hidden by the type never filters', () => {
  assert.equal(checkListing(gadgetListing('Ring 50 mm'), { type: ['ring'], caseSize: { to: 40 } }, parsed).keep, true)
  assert.equal(checkListing(gadgetListing('Klocka 50 mm'), { type: ['watch'], caseSize: { to: 40 } }, parsed).keep, false)
})
