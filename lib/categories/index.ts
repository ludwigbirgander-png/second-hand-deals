// The category registry. Categories live in code, so they can change without migrations;
// the database only stores each item's choice (items.category, items.filters).
import type {
  Category, CategoryField, CategoryId, ConditionGrade, Department, FieldOption, ItemFilters, NumberRange, SaleType, SizeFilter, SizeSystem,
} from './types'
import { hasPattern, tokens } from './words'
import { bareNumbers, numbersWithUnit, percentNear, slashPair } from './parse'

export * from './types'

// ─── Shared options ──────────────────────────────────────────────────────────

export const CONDITIONS: { id: ConditionGrade; label: string }[] = [
  { id: 'new_with_tags', label: 'New with tags' },
  { id: 'new', label: 'New' },
  { id: 'like_new', label: 'Like new' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
  { id: 'parts', label: 'For parts' },
]

export const conditionLabel = (c: ConditionGrade) => CONDITIONS.find((x) => x.id === c)?.label ?? c

/** 0 is best */
export const conditionRank = (c: ConditionGrade) => CONDITIONS.findIndex((x) => x.id === c)

export const SALE_TYPES: { id: SaleType; label: string }[] = [
  { id: 'fixed', label: 'Fixed price' },
  { id: 'auction', label: 'Auction' },
]

const DEPARTMENTS: (FieldOption & { id: Department })[] = [
  { id: 'women', label: 'Women', words: ['dam*', 'kvinna', 'women*', 'woman', 'ladies', 'tjej*'], sellpy: ['Kvinna'] },
  { id: 'men', label: 'Men', words: ['herr*', 'men', 'mens', 'kille*'], sellpy: ['Man'] },
  { id: 'kids', label: 'Kids', words: ['barn*', 'kids', 'junior', 'flick*', 'pojk*', 'baby', 'bebis'], sellpy: ['Flicka', 'Pojke', 'Unisex (Barn)'] },
  { id: 'unisex', label: 'Unisex', words: ['unisex'], sellpy: ['Unisex (Vuxen)'] },
]

const COLORS: FieldOption[] = [
  { id: 'black', label: 'Black', words: ['svart*', 'black'], sellpy: ['Svart'] },
  { id: 'white', label: 'White', words: ['vit', 'vita', 'vitt', 'white', 'offwhite', 'off white', 'benvit*', 'gräddvit*'], sellpy: ['Vit', 'Benvit', 'Gräddvit'] },
  { id: 'grey', label: 'Grey', words: ['grå', 'gråa', 'grått', '*grå', 'grey', 'gray', 'grafit*'], sellpy: ['Grå', 'Mörkgrå', 'Ljusgrå'] },
  { id: 'blue', label: 'Blue', words: ['blå', 'blåa', 'blått', '*blå', 'blue', 'navy', 'turkos'], sellpy: ['Blå', 'Mörkblå', 'Ljusblå', 'Marinblå', 'Turkos', 'Petrol'] },
  { id: 'green', label: 'Green', words: ['grön', 'gröna', 'grönt', '*grön', 'green', 'oliv*', 'khaki'], sellpy: ['Grön', 'Mörkgrön', 'Olivgrön', 'Mossgrön', 'Mintgrön'] },
  { id: 'brown', label: 'Brown', words: ['brun', 'bruna', 'brunt', '*brun', 'brown', 'cognac', 'konjak*'], sellpy: ['Brun', 'Mörkbrun', 'Ljusbrun'] },
  { id: 'beige', label: 'Beige', words: ['beige', 'sand', 'kräm*', 'cream', 'camel'], sellpy: ['Beige'] },
  { id: 'red', label: 'Red', words: ['röd', 'röda', 'rött', '*röd', 'red', 'bordeaux', 'burgundy'], sellpy: ['Röd', 'Vinröd', 'Ljusröd'] },
  { id: 'pink', label: 'Pink', words: ['rosa', 'pink', 'cerise'], sellpy: ['Rosa', 'Ljusrosa', 'Cerise'] },
  { id: 'yellow', label: 'Yellow', words: ['gul', 'gula', 'gult', 'yellow', 'senap*'], sellpy: ['Gul'] },
  { id: 'purple', label: 'Purple', words: ['lila', 'purple', 'violett'], sellpy: ['Lila', 'Mörklila'] },
  { id: 'orange', label: 'Orange', words: ['orange'], sellpy: ['Orange', 'Aprikos', 'Korallfärgad'] },
  { id: 'multi', label: 'Multicolour', words: ['flerfärgad*', 'multicolor*', 'multi'], sellpy: ['Flerfärgad'] },
]

const LEATHER: FieldOption = { id: 'leather', label: 'Leather', words: ['läder*', '*läder', 'skinn*', '*skinn', 'leather'], sellpy: ['Skinn'] }
const SUEDE: FieldOption = { id: 'suede', label: 'Suede', words: ['mocka*', '*mocka', 'suede'], sellpy: ['Mocka'] }

// Electronics come in silver and gold, which clothing's colour list leaves out
const ELECTRONICS_COLORS: FieldOption[] = [
  ...COLORS,
  { id: 'silver', label: 'Silver', words: ['silver*', 'silvrig*'], sellpy: ['Silverfärgad'] },
  { id: 'gold', label: 'Gold', words: ['guld*', 'gold', 'rose gold', 'roséguld*'], sellpy: ['Guldfärgad', 'Roséguldfärgad'] },
]

// ─── Sizes ───────────────────────────────────────────────────────────────────

export const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)
export const SIZE_VALUES = {
  clothingEu: range(30, 58, 2),
  jeansWaist: range(24, 40),
  jeansLength: range(28, 36, 2),
  kids: [50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164, 170],
  shoesAdult: range(35, 47),
  shoesKids: range(18, 38),
}

export const SIZE_SYSTEM_LABELS: Record<SizeSystem, string> = { letter: 'XS–XXL', eu: 'EU', jeans: 'Jeans W×L', kids: 'Kids (cl)' }

// ─── Shared fields ───────────────────────────────────────────────────────────

/**
 * Storage options, with ids in GB ("128", "1024" for 1 TB). Only the listed sizes count,
 * so "8 GB RAM 256 GB" is 256 GB of storage. With `bare`, a lone listed size counts too
 * ("iPhone 13 Pro 128"), when the title states none with a unit.
 */
const storageField = (gb: number[], tb: number[], { bare = false } = {}): CategoryField => ({
  key: 'storage',
  label: 'Storage',
  kind: 'options',
  options: [
    ...gb.map((n) => ({ id: `${n}`, label: `${n} GB`, words: [] })),
    ...tb.map((n) => ({ id: `${n * 1024}`, label: `${n} TB`, words: [] })),
  ],
  parse: (title) => {
    const ids = [
      ...numbersWithUnit(title, ['gb']).filter((n) => gb.includes(n)).map(String),
      ...numbersWithUnit(title, ['tb']).filter((n) => tb.includes(n)).map((n) => `${n * 1024}`),
    ]
    if (!ids.length && bare) ids.push(...bareNumbers(title, gb.filter((n) => n >= 64)).map(String))
    return ids.length ? Array.from(new Set(ids)) : undefined
  },
})

const PHONE_WORDS = ['iphone*', 'mobiltelefon*', 'mobil', 'telefon', 'smartphone*', 'pixel', 'oneplus*', 'xperia', 'galaxy s*', 'galaxy a*', 'galaxy z*', 'galaxy note*', 'nokia', 'motorola', 'huawei', 'xiaomi', 'fairphone*']
const TABLET_WORDS = ['ipad*', 'surfplatt*', 'tablet*', 'galaxy tab*', 'läsplatt*', 'kindle']
const SMARTWATCH_WORDS = ['apple watch', 'galaxy watch', 'pixel watch', 'smartwatch*', 'smartklock*', 'garmin', 'fitbit']

const LAPTOP_WORDS = ['laptop*', 'bärbar', 'bärbara', 'macbook*', 'thinkpad*', 'chromebook*', 'notebook', 'ultrabook', 'zenbook', 'vivobook', 'xps', 'surface laptop']
const DESKTOP_WORDS = ['stationär*', 'imac*', 'mac mini', 'mac studio', 'mac pro', 'desktop', 'speldator*', 'gamingdator*', 'gaming pc']
const RAM_GB = [8, 16, 18, 24, 32, 36, 64]

/** RAM: "16 GB" in the RAM sizes (not "64GB SSD"), or the first half of "8/256" */
function ramFromTitle(title: string): string[] | undefined {
  const text = title.toLowerCase()
  const ids = numbersWithUnit(text, ['gb'])
    .filter((n) => RAM_GB.includes(n) && !new RegExp(`(?<![\\d.,])${n}\\s?gb\\s?(?:ssd|hdd|emmc|lagring|flash)`).test(text))
    .map(String)
  const pair = slashPair(text).ram
  if (pair && RAM_GB.includes(pair)) ids.push(`${pair}`)
  return ids.length ? Array.from(new Set(ids)) : undefined
}

const SCREEN_INCHES = [13, 14, 15, 16, 17]

/** Screen size only with a unit or as a decimal ("14\"", "13 tum", "13-inch", "15,6"); "MacBook Pro 13" is a model */
function screenFromTitle(title: string): string[] | undefined {
  const text = title.toLowerCase()
  const sizes = [
    ...numbersWithUnit(text, ['"', '″', '”', "''", 'tum', 'inch']),
    ...[...text.matchAll(/(?<![\d.,])(1[3-7][.,]\d)(?![\d.,])/g)].map((m) => Number(m[1].replace(',', '.'))),
  ].map(Math.floor).filter((n) => SCREEN_INCHES.includes(n))
  return sizes.length ? Array.from(new Set(sizes)).map(String) : undefined
}

const computerStorage = storageField([128, 256, 512], [1, 2])

// ─── Categories ──────────────────────────────────────────────────────────────

const MARKETPLACES = ['Sellpy', 'Vinted', 'Tradera', 'Blocket']

export const CATEGORIES: Category[] = [
  {
    id: 'clothing',
    label: 'Clothing',
    hints: [
      '*jacka', '*jackor', '*jacket', 'kappa', '*kappa', 'coat', 'parka*', 'anorak', '*jeans', '*byxor', 'trousers', 'chinos',
      '*shorts', '*klänning', 'dress', '*kjol', 'skirt', '*tröja', 'sweater', 'hoodie', 'kofta', 'cardigan', '*skjorta',
      'blus', 'blouse', 't shirt', 'tshirt', 'blazer', 'kavaj', 'kostym', 'suit', '*väst', 'overall',
    ],
    fields: [
      { key: 'department', label: 'Department', kind: 'options', options: DEPARTMENTS },
      {
        key: 'type',
        label: 'Type',
        kind: 'options',
        options: [
          { id: 'jacket', label: 'Jackets & coats', words: ['*jacka', '*jackor', 'jacket*', '*jacket', 'kappa', '*kappa', 'kappor', 'coat', '*coat', 'parka*', '*parkas', 'anorak*', 'trench*'], sellpy: ['Jackor & Ytterkläder'] },
          { id: 'blazer', label: 'Blazers & suits', words: ['blazer*', 'kavaj*', '*kavaj', 'kostym*', '*kostym', 'suit'], sellpy: ['Kavajer & Kostymer'] },
          { id: 'knit', label: 'Knits & sweaters', words: ['*tröja', '*tröjor', 'kofta', '*kofta', 'koftor', 'sweater*', 'jumper', 'cardigan*', 'hoodie*', 'pullover', 'stickad*', '*stickat'], sellpy: ['Tröjor & Koftor'] },
          { id: 'shirt', label: 'Shirts & blouses', words: ['skjort*', '*skjorta', '*skjortor', 'blus*', 'blouse*', 'oxford'], sellpy: ['Skjortor & Blusar', 'Skjortor'] },
          { id: 'tshirt', label: 'T-shirts & tops', words: ['t shirt', 'tshirt*', 'tee', 'linne', 'topp', '*topp'], sellpy: ['T-shirts & Linnen', 'Toppar'] },
          { id: 'dress', label: 'Dresses', words: ['*klänning', '*klänningar', 'dress'], sellpy: ['Klänningar'] },
          { id: 'skirt', label: 'Skirts', words: ['*kjol', '*kjolar', 'skirt'], sellpy: ['Kjolar'] },
          { id: 'trousers', label: 'Trousers', words: ['*byxor', '*byxa', 'trousers', 'pants', 'chinos'], sellpy: ['Byxor & Jeans'] },
          { id: 'jeans', label: 'Jeans', words: ['*jeans'], sellpy: ['Byxor & Jeans'] },
          { id: 'shorts', label: 'Shorts', words: ['*shorts'], sellpy: ['Shorts'] },
        ],
      },
      { key: 'size', label: 'Size', kind: 'size', sizeSystems: ['letter', 'eu', 'jeans', 'kids'] },
      { key: 'color', label: 'Colour', kind: 'options', options: COLORS },
      {
        key: 'material',
        label: 'Material',
        kind: 'options',
        options: [
          { id: 'wool', label: 'Wool', words: ['ull*', '*merinoull', 'lammull*', 'wool*', 'merino*', 'ylle', 'mohair', 'alpack*'], sellpy: ['Ull', 'Merinoull', 'Alpackaull', 'Mohair', 'Angora'] },
          { id: 'cashmere', label: 'Cashmere', words: ['kashmir*', 'cashmere'], sellpy: ['Kashmir'] },
          { id: 'down', label: 'Down', words: ['dun', 'dunjack*', '*dunjacka', 'dunväst*', 'down jacket'], sellpy: ['Dun'] },
          { id: 'cotton', label: 'Cotton', words: ['bomull*', 'cotton'], sellpy: ['Bomull', 'Ekologisk bomull', 'Återvunnen bomull'] },
          { id: 'linen', label: 'Linen', words: ['linen', 'linnetyg', 'linneskjorta', 'linnebyxor', 'linneklänning'], sellpy: ['Linne'] },
          { id: 'silk', label: 'Silk', words: ['siden*', 'silke*', 'silk'], sellpy: ['Silke'] },
          LEATHER,
          SUEDE,
        ],
      },
    ],
    sites: MARKETPLACES,
    // Not plain "endast" (only): "endast använd en gång" means "worn only once"
    negativeWords: ['defekt*', 'trasig*', 'sönder*', 'fläck', 'fläckar', 'fläckig*', 'hål', 'reservdel*', 'symönster', 'dockkläder'],
    sellpyGroup: 'Kläder',
    blocketCategory: '0.71',
  },
  {
    id: 'shoes',
    label: 'Shoes',
    hints: [
      '*skor', '*sko', 'shoes', 'sneakers', 'sneaker', '*boots', 'känga', '*kängor', '*stövlar', 'stövel', 'sandaler', 'sandals',
      'loafers', 'heels', 'pumps', 'klackskor', 'dr martens', 'converse', 'air max', 'air force', 'yeezy',
    ],
    fields: [
      { key: 'department', label: 'Department', kind: 'options', options: DEPARTMENTS },
      {
        key: 'type',
        label: 'Type',
        kind: 'options',
        options: [
          { id: 'sneakers', label: 'Sneakers', words: ['sneaker*', '*sneakers', 'gympaskor', 'träningssk*', 'löparsk*', 'running', 'joggingsk*'], sellpy: ['Sneakers', 'Träningsskor'] },
          { id: 'boots', label: 'Boots', words: ['boots', '*boots', 'känga', 'kängor', '*kängor', 'stövlar', '*stövlar', 'stövel', '*stövel', 'chelsea'], sellpy: ['Boots & Kängor'] },
          { id: 'heels', label: 'Heels', words: ['klack*', '*klackar', 'heels', 'pumps', 'stilett*'], sellpy: ['Klackskor'] },
          { id: 'sandals', label: 'Sandals', words: ['sandal*', '*sandaler', 'slides'], sellpy: ['Sandaler'] },
          { id: 'smart', label: 'Loafers & dress shoes', words: ['loafer*', 'finskor', 'oxford*', 'derby*', 'brogue*', 'mockasin*'], sellpy: ['Finskor', 'Vardagsskor'] },
          { id: 'hiking', label: 'Hiking', words: ['vandringsk*', 'vandringssk*', 'hiking'], sellpy: ['Vandringsskor'] },
        ],
      },
      { key: 'size', label: 'Size (EU)', kind: 'size', sizeSystems: ['eu'] },
      { key: 'color', label: 'Colour', kind: 'options', options: COLORS },
      {
        key: 'material',
        label: 'Material',
        kind: 'options',
        options: [
          LEATHER,
          SUEDE,
          { id: 'goretex', label: 'Gore-Tex', words: ['gore tex', 'goretex', 'gtx'] },
          { id: 'canvas', label: 'Canvas', words: ['canvas', 'kanvas', 'tygsko*'] },
        ],
      },
    ],
    sites: MARKETPLACES,
    negativeWords: [
      'endast kartong*', 'bara kartong*', 'skokartong*', 'box only', 'kartong only',
      'snören', 'skosnöre*', '*snören', 'laces', 'skoblock*', 'innersul*', 'inlägg*', 'skoputs*',
    ],
    sellpyGroup: 'Skor',
    blocketCategory: '0.71',
  },
  {
    id: 'phones',
    label: 'Phones & tablets',
    short: 'Phones',
    hints: [...PHONE_WORDS, ...TABLET_WORDS, ...SMARTWATCH_WORDS],
    fields: [
      {
        key: 'type',
        label: 'Type',
        kind: 'options',
        options: [
          { id: 'phone', label: 'Phone', words: PHONE_WORDS, sellpyPaths: ['Prylar > Hemelektronik > Mobil & Wearables'] },
          { id: 'tablet', label: 'Tablet', words: TABLET_WORDS, sellpyPaths: ['Prylar > Hemelektronik > Surf- och Läsplattor'] },
          { id: 'smartwatch', label: 'Smartwatch', words: SMARTWATCH_WORDS, sellpyPaths: ['Prylar > Hemelektronik > Mobil & Wearables'] },
        ],
      },
      storageField([32, 64, 128, 256, 512], [1], { bare: true }),
      { key: 'color', label: 'Colour', kind: 'options', options: ELECTRONICS_COLORS },
      {
        key: 'battery',
        label: 'Battery health',
        short: 'Battery',
        kind: 'min',
        unit: '%',
        bounds: [50, 100],
        // "batterihälsa 89%", "86% batterihälsa", "BH 88 %"; never a bare percentage
        parse: (title) => percentNear(title, ['batterihälsa', 'batterikapacitet', 'batteri', 'battery', 'bh', 'maxkapacitet']),
      },
      {
        key: 'unlocked',
        label: 'Unlocked',
        kind: 'toggle',
        toggle: 'require',
        parse: (title) => hasPattern(tokens(title), ['olåst*', 'unlocked', 'operatörsolåst*', 'öppen för alla*', 'fri från operatör*']) || undefined,
      },
    ],
    sites: ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace'],
    // Not "laddare" or "kartong": "med laddare och kartong" is a selling point
    negativeWords: [
      'skal', '*skal', 'skalet', 'fodral*', '*fodral', 'skärmskydd*', 'case',
      'trasig*', 'sprucken', 'spräckt*', 'defekt*', 'reservdel*',
      'icloud låst', 'icloudlåst', 'låst till operatör*',
      'endast kartong*', 'bara kartong*', 'tom kartong', 'dummy', 'attrapp*',
    ],
    sellpyPaths: ['Prylar > Hemelektronik > Mobil & Wearables', 'Prylar > Hemelektronik > Surf- och Läsplattor'],
    blocketCategory: '0.93',
    cardFields: ['storage', 'battery', 'unlocked'],
  },
  {
    id: 'computers',
    label: 'Computers',
    hints: [...LAPTOP_WORDS, ...DESKTOP_WORDS, 'dator', 'datorn', '*dator', 'datorer'],
    fields: [
      {
        key: 'type',
        label: 'Type',
        kind: 'options',
        options: [
          { id: 'laptop', label: 'Laptop', words: LAPTOP_WORDS },
          { id: 'desktop', label: 'Desktop', words: DESKTOP_WORDS },
        ],
      },
      {
        key: 'chip',
        label: 'Chip',
        kind: 'options',
        // "M2 Pro" and "M2 Max" count as M2
        options: [
          ...[1, 2, 3, 4].map((n) => ({ id: `m${n}`, label: `M${n}`, words: [`m${n}`, `m${n}pro`, `m${n}max`, `m${n}ultra`] })),
          { id: 'intel', label: 'Intel', words: ['intel', 'i3', 'i5', 'i7', 'i9', 'celeron', 'pentium', 'xeon', 'core ultra'] },
          { id: 'amd', label: 'AMD Ryzen', words: ['amd', 'ryzen*'] },
        ],
      },
      {
        key: 'ram',
        label: 'RAM',
        short: 'RAM',
        kind: 'options',
        options: RAM_GB.map((n) => ({ id: `${n}`, label: `${n} GB`, words: [] })),
        parse: ramFromTitle,
      },
      {
        ...computerStorage,
        // Also "256ssd" and the second half of "8/256"
        parse: (title) => {
          const pair = slashPair(title).storage
          const ssd = numbersWithUnit(title, ['ssd']).filter((n) => [128, 256, 512].includes(n))
          const ids = [...((computerStorage.parse!(title) as string[] | undefined) ?? []), ...ssd.map(String), ...(pair ? [`${pair}`] : [])]
          return ids.length ? Array.from(new Set(ids)) : undefined
        },
      },
      {
        key: 'screen',
        label: 'Screen size',
        kind: 'options',
        options: SCREEN_INCHES.map((n) => ({ id: `${n}`, label: `${n}″`, words: [] })),
        parse: screenFromTitle,
      },
      {
        key: 'swedishKeyboard',
        label: 'Swedish keyboard',
        kind: 'toggle',
        toggle: 'require',
        parse: (title) => hasPattern(tokens(title), [
          'svenskt tangentbord', 'svenska tangentbord', 'svensk layout', 'svenskt keyboard', 'nordiskt tangentbord', 'nordisk layout', 'swedish keyboard',
        ]) || undefined,
      },
    ],
    sites: ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace'],
    // "till"/"för" forms only: "med laddare" and "+ väska" are a plus on a laptop
    negativeWords: [
      'laddare till', 'laddare för', 'adapter till', 'skal till', 'skal för', 'fodral', 'väska till', 'väska för', 'sleeve',
      'skärm till', 'tangentbord till', 'batteri till', 'delar', 'reservdel*', 'moderkort',
      'trasig*', 'defekt*', 'sprucken', 'spräckt*', 'icloud låst', 'icloudlåst', 'aktiveringslås*', 'mdm', 'bios låst',
    ],
    sellpyPaths: ['Prylar > Hemelektronik > Datorer & Tillbehör'],
    blocketCategory: '0.93',
    cardFields: ['chip', 'ram', 'storage'],
  },
]

export function getCategory(id: string | null | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

/**
 * A field's name for "… not stated" on listing cards, from whichever category has it.
 * Keys mean the same thing in every category, so the card doesn't need the item's category.
 */
export function fieldLabel(key: string): string {
  if (key === 'condition') return 'Condition'
  for (const c of CATEGORIES) {
    const field = c.fields.find((f) => f.key === key)
    if (field) return field.short ?? field.label
  }
  return key
}

/** The order categories are suggested in: more specific first, so "vinterkängor" is Shoes, not Clothing */
export const CATEGORY_PRIORITY: CategoryId[] = ['phones', 'computers', 'shoes', 'clothing']

/** The category an item name points to, or null ("Nike Air Max 90" → Shoes) */
export function suggestCategory(name: string): CategoryId | null {
  const words = tokens(name)
  return CATEGORY_PRIORITY.find((id) => hasPattern(words, getCategory(id)!.hints)) ?? null
}

/** The user's enabled sites, narrowed to the ones the category is relevant on */
export function sitesForCategory(sites: string[], categoryId: string | null | undefined): string[] {
  const c = getCategory(categoryId)
  return c ? sites.filter((s) => c.sites.includes(s)) : sites
}

// ─── Reading filters from a request ──────────────────────────────────────────

const asStrings = (v: unknown, allowed: string[]) =>
  Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))) : []
const asNumbers = (v: unknown, allowed: number[]) =>
  Array.isArray(v) ? Array.from(new Set(v.map(Number).filter((x) => allowed.includes(x)))).sort((a, b) => a - b) : []

function sizeFilter(v: unknown, category: Category): SizeFilter | undefined {
  if (!v || typeof v !== 'object') return undefined
  const s = v as Record<string, unknown>
  const systems = category.fields.find((f) => f.key === 'size')?.sizeSystems ?? []
  if (!systems.includes(s.system as SizeSystem)) return undefined
  const shoes = category.id === 'shoes'
  switch (s.system) {
    case 'letter': {
      const values = asStrings(s.values, LETTER_SIZES)
      return values.length ? { system: 'letter', values } : undefined
    }
    case 'eu': {
      const values = asNumbers(s.values, shoes ? [...SIZE_VALUES.shoesKids, ...SIZE_VALUES.shoesAdult] : SIZE_VALUES.clothingEu)
      return values.length ? { system: 'eu', values } : undefined
    }
    case 'jeans': {
      const waist = asNumbers(s.waist, SIZE_VALUES.jeansWaist)
      const length = asNumbers(s.length, SIZE_VALUES.jeansLength)
      return waist.length || length.length ? { system: 'jeans', waist, length } : undefined
    }
    case 'kids': {
      const values = asNumbers(s.values, SIZE_VALUES.kids)
      return values.length ? { system: 'kids', values } : undefined
    }
  }
  return undefined
}

/** The category's fields for these filters: a field with `showWhen` only counts for its types (or when no type is picked) */
export function visibleFields(category: Category, filters: ItemFilters): CategoryField[] {
  const types = filters.type ?? []
  return category.fields.filter((f) => !f.showWhen || !types.length || f.showWhen.type.some((t) => types.includes(t)))
}

function inBounds(v: unknown, field: CategoryField): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  const [lo, hi] = field.bounds ?? [-Infinity, Infinity]
  return n >= lo && n <= hi ? n : undefined
}

function rangeFilter(v: unknown, field: CategoryField): NumberRange | undefined {
  if (!v || typeof v !== 'object') return undefined
  const r = v as Record<string, unknown>
  let from = inBounds(r.from, field)
  let to = inBounds(r.to, field)
  if (from != null && to != null && from > to) [from, to] = [to, from]
  if (from == null && to == null) return undefined
  return { ...(from != null && { from }), ...(to != null && { to }) }
}

/**
 * Keeps only valid choices for the category. Condition, sale type and strict work without one.
 * Returns the category id (or null) and the cleaned filters.
 */
export function sanitizeFilters(categoryId: unknown, raw: unknown): { category: CategoryId | null; filters: ItemFilters } {
  const category = getCategory(typeof categoryId === 'string' ? categoryId : null)
  return { category: category?.id ?? null, filters: sanitizeFiltersFor(category, raw) }
}

export function sanitizeFiltersFor(category: Category | undefined, raw: unknown): ItemFilters {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: ItemFilters = {}

  if (CONDITIONS.some((c) => c.id === r.condition)) out.condition = r.condition as ConditionGrade
  if (SALE_TYPES.some((s) => s.id === r.saleType)) out.saleType = r.saleType as SaleType
  if (r.strict === true) out.strict = true
  if (!category) return out

  for (const field of category.fields) {
    const v = r[field.key]
    switch (field.kind) {
      case 'size': {
        const size = sizeFilter(v, category)
        if (size) out.size = size
        break
      }
      case 'options': {
        const values = asStrings(v, (field.options ?? []).map((o) => o.id))
        if (values.length) out[field.key] = values
        break
      }
      case 'min': {
        const n = inBounds(v, field)
        if (n != null) out[field.key] = n
        break
      }
      case 'range': {
        const range = rangeFilter(v, field)
        if (range) out[field.key] = range
        break
      }
      case 'toggle':
        if (v === true) out[field.key] = true
        break
    }
  }
  // A field hidden by the chosen type isn't kept
  const visible = new Set(visibleFields(category, out).map((f) => f.key))
  for (const field of category.fields) if (!visible.has(field.key)) delete out[field.key]
  return out
}

/** Short labels for an item's active filters, for chips on the item page */
export function describeFilters(categoryId: string | null | undefined, filters: ItemFilters | null | undefined): string[] {
  return describeFiltersFor(getCategory(categoryId), filters)
}

const withUnit = (n: number, unit?: string) => (unit ? `${n} ${unit}` : `${n}`)

export function describeFiltersFor(category: Category | undefined, filters: ItemFilters | null | undefined): string[] {
  const f = filters ?? {}
  const out: string[] = []
  if (category) {
    out.push(category.label)
    for (const field of visibleFields(category, f)) {
      const name = field.short ?? field.label
      const v = f[field.key]
      if (v == null) continue
      switch (field.kind) {
        case 'size': {
          const s = f.size
          if (!s) break
          if (s.system === 'jeans') {
            const parts = [s.waist.length ? `W${s.waist.join('/')}` : '', s.length.length ? `L${s.length.join('/')}` : ''].filter(Boolean)
            out.push(`Size ${parts.join(' ')}`)
          } else {
            out.push(`Size ${s.values.join(', ')}${s.system === 'kids' ? ' cl' : ''}`)
          }
          break
        }
        case 'options': {
          const labels = (v as string[]).map((id) => field.options?.find((o) => o.id === id)?.label).filter(Boolean)
          if (labels.length) out.push(labels.join(', '))
          break
        }
        case 'min':
          out.push(`${name} ${withUnit(v as number, field.unit)}+`)
          break
        case 'range': {
          const { from, to } = v as NumberRange
          if (from != null && to != null) out.push(`${name} ${from}–${withUnit(to, field.unit)}`)
          else if (from != null) out.push(`${name} ${withUnit(from, field.unit)} or more`)
          else if (to != null) out.push(`${name} up to ${withUnit(to, field.unit)}`)
          break
        }
        case 'toggle':
          if (v === true) out.push(field.label)
          break
      }
    }
  }
  if (f.condition) out.push(f.condition === 'new_with_tags' ? 'New with tags' : `${conditionLabel(f.condition)} or better`)
  if (f.saleType) out.push(f.saleType === 'auction' ? 'Auctions only' : 'Fixed price only')
  if (f.strict && out.length > 0) out.push('Strict')
  return out
}
