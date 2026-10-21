import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCategory, suggestCategory, sanitizeFilters, sanitizeFiltersFor, CATEGORY_PRIORITY, fieldLabel, sitesForCategory, describeFilters, describeFiltersFor, visibleFields } from './index'
import { normalizeCondition, conditionFromTitle, parseSize, extractAttributes, attributeLabels } from './attributes'
import { checkListing, hasNegativeWord } from './filter'
import { decades, numbersWithUnit, percentNear, quantity, slashPair } from './parse'
import { sellpyFilters, sellpyAttributes, vintedParams, blocketParams, siteExcluded, auctionetCategory } from './native'
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
  assert.equal(suggestCategory('Eames chair'), 'furniture', 'phase 5 added Furniture & design')
  assert.equal(suggestCategory('iPhone 13'), 'phones', 'phase 5 added Phones & tablets')
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

// ─── Phase 5: native site params and card details ────────────────────────────

const home: Category = {
  id: 'clothing', // never registered
  label: 'Home',
  hints: [],
  sites: [],
  negativeWords: [],
  sellpyPaths: ['Prylar > Inredning > Möbler', 'Prylar > Inredning > Belysning'],
  auctionet: 16,
  fields: [
    { key: 'type', label: 'Type', kind: 'options', options: [
      { id: 'chair', label: 'Chair', words: ['stol'], auctionet: 16, sellpyPaths: ['Prylar > Inredning > Möbler'] },
      { id: 'table', label: 'Table', words: ['bord'], auctionet: 16, sellpyPaths: ['Prylar > Inredning > Möbler'] },
      { id: 'lamp', label: 'Lamp', words: ['lampa'], auctionet: 1, sellpyPaths: ['Prylar > Inredning > Belysning'] },
      { id: 'other', label: 'Other', words: [] },
    ] },
    { key: 'storage', label: 'Storage', kind: 'options', options: [{ id: '256', label: '256 GB', words: ['256gb'] }] },
    { key: 'battery', label: 'Battery health', short: 'Battery', kind: 'min', unit: '%', bounds: [50, 100] },
    { key: 'caseSize', label: 'Case size', kind: 'range', unit: 'mm' },
    { key: 'unlocked', label: 'Unlocked', kind: 'toggle', toggle: 'require' },
  ],
  cardFields: ['storage', 'battery', 'caseSize', 'unlocked', 'type'],
}

test('Sellpy: category paths for categories without departments', () => {
  assert.equal(sellpyFilters({ category: home, filters: {} }),
    'price_SE.amount > 0 AND (categories.lvl2:"Prylar > Inredning > Möbler" OR categories.lvl2:"Prylar > Inredning > Belysning")')
  assert.equal(sellpyFilters({ category: home, filters: { type: ['lamp'] } }),
    'price_SE.amount > 0 AND (categories.lvl2:"Prylar > Inredning > Belysning")')
  // A type without its own path falls back to the category's paths
  assert.match(sellpyFilters({ category: home, filters: { type: ['lamp', 'other'] } })!, /Möbler.*Belysning/)
  // Clothing is unchanged
  assert.match(sellpyFilters({ category: clothing, filters: {} })!, /categories\.lvl1/)
})

test('Auctionet: one category id, only when it is unambiguous', () => {
  assert.equal(auctionetCategory({ category: home, filters: {} }), 16)
  assert.equal(auctionetCategory({ category: home, filters: { type: ['chair', 'table'] } }), 16)
  assert.equal(auctionetCategory({ category: home, filters: { type: ['lamp'] } }), 1)
  assert.equal(auctionetCategory({ category: home, filters: { type: ['chair', 'lamp'] } }), undefined)
  assert.equal(auctionetCategory({ category: home, filters: { type: ['other'] } }), undefined)
  assert.equal(auctionetCategory({ category: clothing, filters: {} }), undefined)
  assert.equal(auctionetCategory({}), undefined)
})

test('cards: short details from the category', () => {
  assert.deepEqual(attributeLabels({ storage: ['256'], battery: 88, caseSize: 41, unlocked: true, type: ['chair'] }, home),
    ['256 GB', 'Battery 88 %', '41 mm', 'Unlocked', 'Chair'])
  assert.deepEqual(attributeLabels({}, home), [])
  assert.deepEqual(attributeLabels({ storage: ['256'] }, undefined), [])
})

test('suggestCategory: phase 4 results unchanged with the priority list', () => {
  assert.deepEqual(CATEGORY_PRIORITY.slice(-2), ['shoes', 'clothing'])
  assert.equal(suggestCategory('vinterkängor'), 'shoes')
  assert.equal(suggestCategory('Acne läderjacka'), 'clothing')
})

// ─── Review fixes ────────────────────────────────────────────────────────────

test('fieldLabel: names for "not stated", from any category', () => {
  assert.equal(fieldLabel('condition'), 'Condition')
  assert.equal(fieldLabel('size'), 'Size')
  assert.equal(fieldLabel('color'), 'Colour')
  assert.equal(fieldLabel('department'), 'Department')
  assert.equal(fieldLabel('type'), 'Type')
  assert.equal(fieldLabel('material'), 'Material')
  assert.equal(fieldLabel('somethingNew'), 'somethingNew', 'never undefined')
})

test('parse: "ett 30-tal" means about thirty, not the 1930s', () => {
  assert.deepEqual(decades('Rörstrand Mon Amie, ett 30-tal tallrikar'), [])
  assert.deepEqual(decades('Iittala glas, ca 20-tal'), [])
  assert.deepEqual(decades('Glas, cirka 20-tal st'), [])
  assert.deepEqual(decades('Ett 60-tals bord'), [1960], '"ett 60-tals bord" is a 1960s table')
})

test('parse: quantity in "stycken"', () => {
  assert.equal(quantity('Rörstrand tallrikar 6 stycken'), 6)
  assert.equal(quantity('Carl Malmsten. STOLAR, FYRA ST.'), 4)
  assert.equal(quantity('Sex stycken glas'), 6)
  assert.equal(quantity('Stolar, 4 styck'), 4)
})

test('cards: an "allow" switch (second sort) is never shown', () => {
  const sorted: Category = { ...gadget, cardFields: ['secondSort', 'unlocked'] }
  assert.deepEqual(attributeLabels({ secondSort: true, unlocked: true }, sorted), ['Unlocked'])
})

// ─── Phones & tablets ────────────────────────────────────────────────────────

const phones = getCategory('phones')!
const phone = (title: string, attributes = {}) => ({ title, attributes: extractAttributes({ title, attributes }, phones) })

test('phones: suggested from the name', () => {
  for (const name of ['iPhone 13 Pro', 'iphone13', 'Samsung Galaxy S23', 'iPad Air', 'Apple Watch Series 8', 'Google Pixel 7', 'Garmin Fenix 7', 'OnePlus 11', 'mobiltelefon', 'surfplatta'])
    assert.equal(suggestCategory(name), 'phones', name)
  // Phase 4 still wins for its own words
  assert.equal(suggestCategory('Nike Air Max 90'), 'shoes')
})

test('phones: details read from titles', () => {
  assert.deepEqual(phone('iPhone 13 128GB batterihälsa 89% olåst svart').attributes,
    { type: ['phone'], storage: ['128'], color: ['black'], battery: 89, unlocked: true })
  assert.deepEqual(phone('Samsung S23 8 GB RAM 256 GB').attributes.storage, ['256'], 'RAM is not storage')
  assert.deepEqual(phone('iPhone 15 Pro 1TB').attributes.storage, ['1024'])
  assert.deepEqual(phone('iPad Air 64 GB silver').attributes, { type: ['tablet'], storage: ['64'], color: ['silver'] })
  assert.equal(phone('iPhone 13 Pro').attributes.storage, undefined, '"13" is never storage')
  // Phone titles often leave out "GB"
  assert.deepEqual(phone('Apple iPhone 13 Pro 128').attributes.storage, ['128'])
  assert.deepEqual(phone('iPhone 12 64 svart').attributes.storage, ['64'])
  assert.equal(phone('iPhone 13 512 kr').attributes.storage, undefined, 'a price')
  assert.equal(phone('iPhone 11 Pro 64 MP kamera').attributes.storage, undefined)
  assert.deepEqual(phone('Apple Watch Series 8 45mm').attributes.type, ['smartwatch'])
})

test('phones: junk words, unless they are the search', () => {
  for (const t of ['iPhone 13 skal svart', 'Silikonskal iPhone 13', 'iPhone 13 fodral', 'iPhone 13 skärmskydd', 'iPhone 13 trasig skärm',
    'iPhone 13 spräckt', 'iPhone 13 iCloud-låst', 'iPhone 13 reservdelar', 'Endast kartong iPhone 13', 'iPhone 13 dummy'])
    assert.equal(hasNegativeWord(t, 'iPhone 13', phones), true, t)
  assert.equal(hasNegativeWord('iPhone 13 128 GB med laddare och kartong', 'iPhone 13', phones), false, 'charger and box are a plus')
  // Known trade-off: a phone sold with a case is dropped too
  assert.equal(hasNegativeWord('iPhone 13 i nyskick, inkl. skal', 'iPhone 13', phones), true)
  assert.equal(hasNegativeWord('iPhone 13 skal svart', 'iPhone 13 skal', phones), false)
})

test('phones: filters', () => {
  const f: ItemFilters = { storage: ['128', '256'], battery: 85, unlocked: true }
  assert.deepEqual(checkListing(phone('iPhone 13 128GB batteri 90% olåst'), f, phones), { keep: true, unstated: [] })
  assert.equal(checkListing(phone('iPhone 13 64GB batteri 90% olåst'), f, phones).keep, false)
  assert.equal(checkListing(phone('iPhone 13 256GB batteri 80%'), f, phones).keep, false)
  assert.deepEqual(checkListing(phone('iPhone 13 256GB'), f, phones), { keep: true, unstated: ['battery', 'unlocked'] })
})

test('phones: sites and native search', () => {
  assert.deepEqual(sitesForCategory(['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'], 'phones'),
    ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace'])
  assert.deepEqual(blocketParams({ category: phones }), ['category=0.93'])
  assert.equal(sellpyFilters({ category: phones, filters: { type: ['phone'] } }),
    'price_SE.amount > 0 AND (categories.lvl2:"Prylar > Hemelektronik > Mobil & Wearables")')
  assert.match(sellpyFilters({ category: phones, filters: { type: ['tablet'] } })!, /Surf- och Läsplattor/)
  assert.match(sellpyFilters({ category: phones, filters: { color: ['silver'] } })!, /metadata\.color:"Silverfärgad"/)
  assert.deepEqual(attributeLabels(phone('iPhone 13 128GB batterihälsa 88% olåst').attributes, phones), ['128 GB', 'Battery 88 %', 'Unlocked'])
  assert.deepEqual(describeFilters('phones', { storage: ['128'], battery: 85, unlocked: true }), ['Phones & tablets', '128 GB', 'Battery 85 %+', 'Unlocked'])
})

// ─── Computers ───────────────────────────────────────────────────────────────

const computers = getCategory('computers')!
const computer = (title: string) => ({ title, attributes: extractAttributes({ title }, computers) })

test('computers: suggested from the name, phones keep theirs', () => {
  for (const name of ['MacBook Air', 'MacBook Pro M3', 'Lenovo ThinkPad X1', 'iMac 24', 'Mac mini M2', 'laptop', 'Bärbar dator', 'speldator', 'Dell XPS 13'])
    assert.equal(suggestCategory(name), 'computers', name)
  assert.equal(suggestCategory('iPad Pro'), 'phones')
})

test('parse: slash pairs of RAM and storage', () => {
  assert.deepEqual(slashPair('MacBook Air M2 8/256'), { ram: 8, storage: 256 })
  assert.deepEqual(slashPair('MacBook Pro 16GB/512GB'), { ram: 16, storage: 512 })
  assert.deepEqual(slashPair('ThinkPad 32/1TB'), { ram: 32, storage: 1024 })
  assert.deepEqual(slashPair('Köpt 12/2021'), {})
})

test('computers: details read from titles', () => {
  assert.deepEqual(computer('MacBook Air M2 8/256 GB svenskt tangentbord').attributes,
    { type: ['laptop'], chip: ['m2'], ram: ['8'], storage: ['256'], swedishKeyboard: true })
  assert.deepEqual(computer('MacBook Pro 14" M3 Pro 18GB 1TB').attributes,
    { type: ['laptop'], chip: ['m3'], ram: ['18'], storage: ['1024'], screen: ['14'] })
  assert.equal(computer('MacBook Pro 13 M1 16GB 512GB').attributes.screen, undefined, 'a bare 13 is the model, not a size')
  assert.deepEqual(computer('MacBook Pro (13-inch, 2016)').attributes.screen, ['13'])
  assert.deepEqual(computer('Lenovo 15,6 tum i5 8 GB RAM').attributes, { chip: ['intel'], ram: ['8'], screen: ['15'] })
  assert.deepEqual(computer('Asus ROG Ryzen 7 16GB 512GB SSD').attributes, { chip: ['amd'], ram: ['16'], storage: ['512'] })
  assert.equal(computer('Gammal laptop 64GB SSD').attributes.ram, undefined, '64 GB SSD is storage, not RAM')
  assert.deepEqual(computer('iMac 24 M1 8GB 256GB').attributes.type, ['desktop'])
  assert.deepEqual(computer('MacBook Air M2, 15”, 16gb ram,256ssd').attributes.storage, ['256'], '"256ssd" without GB')
})

test('computers: junk words, but a charger or bag included is fine', () => {
  for (const t of ['Laddare till MacBook Air', 'Väska för MacBook 13', 'MacBook Air M1 trasig skärm', 'MacBook Pro delar', 'MacBook moderkort', 'MacBook Air iCloud låst', 'MacBook Pro MDM'])
    assert.equal(hasNegativeWord(t, 'MacBook', computers), true, t)
  for (const t of ['MacBook Air M1 med laddare', 'MacBook Air M2 + väska och laddare'])
    assert.equal(hasNegativeWord(t, 'MacBook', computers), false, t)
})

test('computers: sites, native search, cards', () => {
  assert.deepEqual(sitesForCategory(['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'], 'computers'),
    ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace'])
  assert.deepEqual(blocketParams({ category: computers }), ['category=0.93'])
  assert.match(sellpyFilters({ category: computers, filters: {} })!, /Datorer & Tillbehör/)
  assert.deepEqual(attributeLabels(computer('MacBook Air M2 8/256').attributes, computers), ['M2', '8 GB RAM', '256 GB'])
})

// ─── Furniture & design ──────────────────────────────────────────────────────

const furniture = getCategory('furniture')!
const piece = (title: string) => ({ title, attributes: extractAttributes({ title }, furniture) })

test('furniture: suggested from the name', () => {
  for (const name of ['Lilla Åland stol', 'String hylla', 'PH5 lampa', 'Eames chair', 'teakbord', 'fåtölj', 'Svenskt Tenn soffa', 'skrivbordslampa', 'byrå', 'spegel'])
    assert.equal(suggestCategory(name), 'furniture', name)
  assert.equal(suggestCategory('MacBook Air'), 'computers')
})

test('furniture: details read from titles', () => {
  assert.deepEqual(piece('Lilla Åland stolar 4 st').attributes, { type: ['chair'], quantity: ['set4'] })
  assert.deepEqual(piece('60-tals teakbord').attributes, { type: ['table'], material: ['teak'], decade: ['1960'] })
  assert.deepEqual(piece('Arne Jacobsen stolar 6 st, Sjuan').attributes.quantity, ['set4', 'set6'])
  assert.deepEqual(piece('Fåtöljer, ett par, 1950/60-tal').attributes, { type: ['armchair'], quantity: ['pair'], decade: ['1950', '1960'] })
  assert.deepEqual(piece('Skrivbordslampa mässing').attributes, { type: ['lamp'], material: ['metal'] })
  assert.deepEqual(piece('Matbord i ek, 3 stolar').attributes.quantity, ['three'], 'three: neither a pair nor a set of 4')
  assert.deepEqual(piece('Stol i bok med dyna').attributes.type, ['chair'])
})

test('furniture: junk words', () => {
  for (const t of ['Åland, F 209, Mitt Åland, frimärke', 'Vykort Lilla Åland', 'Eames miniatyr', 'Vitra miniatures Panton', 'Lilla Åland ritning', 'Dockskåp med möbler', 'Affisch Eames', 'Dynor till Lilla Åland', 'Överdrag till soffa'])
    assert.equal(hasNegativeWord(t, 'Eames', furniture), true, t)
  for (const t of ['Stol i bok med dyna', 'Lilla Åland stol, ek'])
    assert.equal(hasNegativeWord(t, 'stol', furniture), false, t)
})

test('furniture: filters', () => {
  const sets: ItemFilters = { quantity: ['set4'] }
  assert.equal(checkListing(piece('Stolar 6 st'), sets, furniture).keep, true)
  assert.equal(checkListing(piece('Stolar, ett par'), sets, furniture).keep, false)
  assert.equal(checkListing(piece('Stolar 3 st'), sets, furniture).keep, false)
  assert.deepEqual(checkListing(piece('Stol'), sets, furniture), { keep: true, unstated: ['quantity'] })
  assert.equal(checkListing(piece('Byrå 1970-tal'), { decade: ['1950', '1960'] }, furniture).keep, false)
})

test('furniture: native search per type', () => {
  assert.deepEqual(blocketParams({ category: furniture }), ['category=0.78'])
  assert.equal(auctionetCategory({ category: furniture, filters: {} }), 16)
  assert.equal(auctionetCategory({ category: furniture, filters: { type: ['chair', 'table'] } }), 16)
  assert.equal(auctionetCategory({ category: furniture, filters: { type: ['lamp'] } }), 1)
  assert.equal(auctionetCategory({ category: furniture, filters: { type: ['mirror'] } }), 42)
  assert.equal(auctionetCategory({ category: furniture, filters: { type: ['rug'] } }), 35)
  assert.equal(auctionetCategory({ category: furniture, filters: { type: ['chair', 'lamp'] } }), undefined)
  assert.match(sellpyFilters({ category: furniture, filters: { type: ['lamp'] } })!, /\(categories\.lvl2:"Prylar > Inredning > Belysning"\)/)
  assert.deepEqual(sitesForCategory(['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'], 'furniture'),
    ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'])
  assert.deepEqual(attributeLabels(piece('Lilla Åland stolar 4 st, 1960-tal, ek').attributes, furniture), ['Set of 4 or more', '1960s', 'Oak'])
})

test('Sellpy: the type from a hit\'s category path, only when one type owns it', () => {
  assert.deepEqual(sellpyAttributes({}, 'furniture', 'Prylar > Inredning > Belysning', undefined).type, ['lamp'])
  assert.equal(sellpyAttributes({}, 'furniture', 'Prylar > Inredning > Möbler', undefined).type, undefined, 'chairs, tables, sofas… share Möbler')
  assert.deepEqual(sellpyAttributes({}, 'phones', 'Prylar > Hemelektronik > Surf- och Läsplattor', undefined).type, ['tablet'])
})

// ─── Watches & jewellery ─────────────────────────────────────────────────────

const watches = getCategory('watches')!
const jewel = (title: string) => ({ title, attributes: extractAttributes({ title }, watches) })

test('watches: suggested from the name; Apple Watch stays Phones', () => {
  for (const name of ['Omega Seamaster', 'Rolex Submariner', 'Seiko 5', 'guldring', 'halsband', 'örhängen', 'Georg Jensen armband', 'fickur'])
    assert.equal(suggestCategory(name), 'watches', name)
  assert.equal(suggestCategory('Apple Watch Series 8'), 'phones')
  assert.equal(suggestCategory('hundhalsband'), null, 'a dog collar')
})

test('watches: details read from titles', () => {
  assert.deepEqual(jewel('Omega Seamaster 41 mm automatic full set').attributes,
    { type: ['watch'], movement: ['automatic'], caseSize: 41, boxPapers: true })
  assert.deepEqual(jewel('Seiko kvarts 38mm stål').attributes, { type: ['watch'], movement: ['quartz'], caseSize: 38, metal: ['steel'] })
  assert.deepEqual(jewel('Guldring 18k storlek 17,5').attributes, { type: ['ring'], metal: ['gold18'], ringSize: 17.5 })
  assert.deepEqual(jewel('Ring 585 guld stl 18').attributes, { type: ['ring'], metal: ['gold14'], ringSize: 18 })
  assert.deepEqual(jewel('Halsband sterling silver 925').attributes, { type: ['necklace'], metal: ['silver'] })
  assert.equal(jewel('Silverfärgat armband 750 kr').attributes.metal, undefined, 'silver-coloured, and 750 is a price')
  assert.equal(jewel('Klocka med gravering').attributes.type?.includes('ring'), false, '"gravering" is not a ring')
  assert.deepEqual(jewel('Omega Seamaster 600 handwinding').attributes.movement, ['manual'])
  assert.deepEqual(jewel('OMEGA. ARMBANDSUR. GULD PÅ STÅL. ÅR 1969').attributes.metal, ['steel', 'plated'])
})

test('watches: junk words (decision 7)', () => {
  for (const t of ['Armband till Omega Seamaster', 'Rem till Rolex', 'Länkar till Omega', 'Endast klockask Rolex', 'Omega replika', 'Urverk till Omega'])
    assert.equal(hasNegativeWord(t, 'Omega', watches), true, t)
  for (const t of ['Omega Seamaster med extra länkar', 'Rolex med klockask och papper', 'Georg Jensen armband silver'])
    assert.equal(hasNegativeWord(t, 'Omega', watches), false, t)
})

test('watches: fields follow the type', () => {
  const keys = (f: ItemFilters) => visibleFields(watches, f).map((x) => x.key)
  assert.ok(keys({ type: ['watch'] }).includes('movement') && keys({ type: ['watch'] }).includes('caseSize'))
  assert.ok(!keys({ type: ['watch'] }).includes('ringSize'))
  assert.ok(keys({ type: ['ring'] }).includes('ringSize'))
  assert.ok(!keys({ type: ['ring'] }).includes('movement') && !keys({ type: ['ring'] }).includes('caseSize'))
  // Half sizes are kept, other decimals rounded to the step
  assert.deepEqual(sanitizeFilters('watches', { type: ['ring'], ringSize: { from: 17.5, to: 18.3 } }).filters, { type: ['ring'], ringSize: { from: 17.5, to: 18.5 } })
})

test('watches: native search and cards', () => {
  assert.equal(auctionetCategory({ category: watches, filters: { type: ['watch'] } }), 31)
  assert.equal(auctionetCategory({ category: watches, filters: { type: ['ring', 'necklace'] } }), 13)
  assert.equal(auctionetCategory({ category: watches, filters: { type: ['watch', 'ring'] } }), undefined)
  assert.equal(auctionetCategory({ category: watches, filters: {} }), undefined)
  assert.match(sellpyFilters({ category: watches, filters: { type: ['watch'] } })!, /Man > Accessoarer > Armbandsur/)
  assert.deepEqual(blocketParams({ category: watches }), [])
  assert.deepEqual(sitesForCategory(['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'], 'watches'),
    ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'])
  assert.deepEqual(attributeLabels(jewel('Omega 41 mm automatic stål').attributes, watches), ['41 mm', 'Steel', 'Automatic'])
  assert.deepEqual(describeFilters('watches', { type: ['ring'], ringSize: { from: 17, to: 17.5 } }), ['Watches & jewellery', 'Ring', 'Ring size 17–17.5 mm'])
})

// ─── Glass, ceramics & tableware ─────────────────────────────────────────────

const glass = getCategory('glass')!
const dish = (title: string) => ({ title, attributes: extractAttributes({ title }, glass) })

test('glass: suggested from the name', () => {
  for (const name of ['Rörstrand Ostindia', 'Iittala Kastehelmi', 'Gustavsberg Spisa Ribb', 'Mon Amie tallrik', 'Aalto vas', 'Orrefors vinglas', 'littala Teema'])
    assert.equal(suggestCategory(name), 'glass', name)
  assert.equal(suggestCategory('Iittala lampa'), 'furniture', 'a lamp is furniture, whoever made it')
})

test('glass: details read from titles', () => {
  assert.deepEqual(dish('Rörstrand Mon Amie 6 st tallrikar').attributes, { type: ['plate'], quantity: ['set4', 'set6'] })
  assert.deepEqual(dish('Sex djupa tallrikar Ostindia').attributes, { type: ['plate', 'deepPlate'], quantity: ['set4', 'set6'] })
  assert.deepEqual(dish('Kastehelmi skål').attributes, { type: ['bowl'] })
  assert.deepEqual(dish('Två kaffekoppar med fat, Pomona').attributes, { type: ['cup', 'dish'], quantity: ['pair'] })
  assert.deepEqual(dish('Spisa Ribb tallrik 2:a sortering').attributes, { type: ['plate'], secondSort: true })
  assert.deepEqual(dish('Mon Amie assiett, andra sortering').attributes.secondSort, true)
  assert.deepEqual(dish('Kaffeservis, 20 delar, Mon Amie').attributes.quantity, ['set4', 'set6'])
})

test('glass: junk words; chip-free is a plus', () => {
  for (const t of ['Zoegas Mon Amie plåtburk', 'Mon amie kaffeburk', 'Mon Amie Paraply', 'Mon Amie kökshandduk', 'Ostindia skål nagg', 'Mon Amie tallrik naggad', 'Vas med spricka', 'Lagad Ostindia kanna', 'Kantstött fat'])
    assert.equal(hasNegativeWord(t, 'Ostindia', glass), true, t)
  for (const t of ['Ostindia tallrik naggfri', 'Mon Amie, inga skador', 'Ostindia skål 21 cm', 'Mon Amie kryddburk porslin'])
    assert.equal(hasNegativeWord(t, 'Ostindia', glass), false, t)
})

test('glass: second sort is hidden unless allowed', () => {
  assert.equal(checkListing(dish('Spisa Ribb tallrik 2:a sortering'), {}, glass).keep, false)
  assert.equal(checkListing(dish('Spisa Ribb tallrik 2:a sortering'), { secondSort: true }, glass).keep, true)
  assert.deepEqual(checkListing(dish('Spisa Ribb tallrik'), {}, glass), { keep: true, unstated: [] })
  assert.deepEqual(describeFilters('glass', { secondSort: true }), ['Glass, ceramics & tableware', 'Second sort OK'])
})

test('glass: sites and native search', () => {
  assert.deepEqual(sitesForCategory(['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'], 'glass'),
    ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'])
  assert.deepEqual(blocketParams({ category: glass }), [], 'glass and ceramics are split on Blocket')
  assert.equal(auctionetCategory({ category: glass, filters: { type: ['plate'] } }), undefined, 'and on Auctionet')
  assert.match(sellpyFilters({ category: glass, filters: {} })!, /Porslin.*Koppar & Glas.*Vaser & Krukor/)
  assert.deepEqual(attributeLabels(dish('Rörstrand Mon Amie 6 st tallrikar').attributes, glass), ['Plate', 'Set of 6 or more'])
})
