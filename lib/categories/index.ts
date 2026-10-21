// The category registry. Categories live in code, so they can change without migrations;
// the database only stores each item's choice (items.category, items.filters).
import type {
  Category, CategoryField, CategoryId, ConditionGrade, Department, FieldOption, ItemFilters, NumberRange, SaleType, SizeFilter, SizeSystem,
} from './types'
import { hasPattern, tokens } from './words'
import { bareNumbers, decades, numbersWithUnit, percentNear, quantity, slashPair } from './parse'

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

/**
 * How many pieces: single, pair, a set of 4 or more, or 6 or more. A set of 6 is also a set of 4,
 * and three pieces ("three", not a choice) contradict every option.
 */
const quantityField = (nouns: string[]): CategoryField => ({
  key: 'quantity',
  label: 'Quantity',
  kind: 'options',
  options: [
    { id: 'single', label: 'Single', words: [] },
    { id: 'pair', label: 'Pair', words: [] },
    { id: 'set4', label: 'Set of 4 or more', words: [] },
    { id: 'set6', label: 'Set of 6 or more', words: [] },
  ],
  parse: (title) => {
    const n = quantity(title, nouns)
    if (n == null) return undefined
    if (n === 1) return ['single']
    if (n === 2) return ['pair']
    if (n === 3) return ['three']
    return n >= 6 ? ['set4', 'set6'] : ['set4']
  },
  cardLabel: (v) => {
    const ids = v as string[]
    return ids.includes('set6') ? 'Set of 6 or more' : ids.includes('set4') ? 'Set of 4 or more'
      : ids.includes('pair') ? 'Pair' : ids.includes('three') ? '3 pieces' : undefined
  },
})

const DECADES = [1940, 1950, 1960, 1970, 1980, 1990]

const decadeField: CategoryField = {
  key: 'decade',
  label: 'Decade',
  kind: 'options',
  options: DECADES.map((d) => ({ id: `${d}`, label: `${d}s`, words: [] })),
  parse: (title) => {
    const ids = decades(title).filter((d) => DECADES.includes(d)).map(String)
    return ids.length ? ids : undefined
  },
}

const CHAIR = ['stol', 'stolar', 'stolen', '*stol', '*stolar', 'pall', 'pallar', '*pall', 'chair', 'chairs', '*chair']
const ARMCHAIR = ['fåtölj*', '*fåtölj', '*fåtöljer', 'armchair', 'lounge chair', 'loungestol*']
const SOFA = ['soffa', 'soffan', '*soffa', 'soffor', '*soffor', 'sofa', 'daybed', 'dagbädd*', 'divan*']
const TABLE = ['bord', 'bordet', '*bord', 'table', '*table', 'matbord*', 'soffbord*', 'sidobord*']
const DESK = ['skrivbord', 'skrivbordet', '*skrivbord', 'desk', 'sekretär*']
const STORAGE = ['hylla', '*hylla', 'hyllor', '*hyllor', 'bokhylla*', 'byrå*', '*byrå', 'skåp', '*skåp', 'skänk*', 'sideboard*', 'vitrinskåp*', 'kommod*', 'string', 'shelf', 'cabinet']
// Not "pendel*": "pendelur" is a clock
const LAMP = ['lampa', '*lampa', 'lampor', '*lampor', 'lamp', '*lamp', 'pendellampa*', 'armatur*', 'ljuskrona*', 'ph5', 'ph 5', 'panthella']
const BED = ['säng', 'sängen', '*säng', 'sängar', 'bed']
const RUG = ['matta', '*matta', 'mattor', '*mattor', 'rug', 'carpet', 'rya*', 'röllakan*']
const MIRROR = ['spegel', '*spegel', 'speglar', 'mirror', '*mirror']
const MOBLER = 'Prylar > Inredning > Möbler'

const WATCH = ['klocka', 'klockan', '*klocka', 'klockor', 'armbandsur*', '*armbandsur', 'ur', 'fickur*', 'watch', 'chronograph', 'kronograf*', 'dykarklocka*']
// Not "*ring": "gravering" and "signering" end in "ring"
const RING = ['ring', 'ringar', 'ringen', 'guldring*', 'silverring*', 'förlovningsring*', 'vigselring*', 'diamantring*', 'solitär*', 'signetring*', 'cocktailring*']
// Not "*halsband": "hundhalsband" is a dog collar
const NECKLACE = ['halsband', 'guldhalsband*', 'silverhalsband*', 'pärlhalsband*', 'collier*', 'hänge', 'hängsmycke*', 'necklace', 'kedja', 'guldkedja*', 'silverkedja*']
const BRACELET = ['armband', '*armband', 'armring*', 'bracelet']
const EARRINGS = ['örhänge*', '*örhängen', 'örstick*', 'earring*', 'creoler']
const BROOCH = ['brosch*', '*brosch', 'brooch']
const WATCH_BRANDS = [
  'rolex', 'omega', 'seiko', 'tissot', 'longines', 'tag heuer', 'cartier', 'breitling', 'iwc', 'tudor', 'casio', 'g shock', 'citizen',
  'hamilton', 'oris', 'sinn', 'swatch', 'certina', 'zenith', 'patek', 'audemars', 'junghans', 'skagen', 'daniel wellington',
]
const JEWELLERY_BRANDS = ['georg jensen', 'pandora', 'efva attling', 'sophie by sophie', 'david andersen', 'kalevala', 'lapponia', 'thomas sabo']
const ARMBANDSUR = ['Kvinna', 'Man', 'Barn'].map((t) => `${t} > Accessoarer > Armbandsur`)
const SMYCKEN = ['Kvinna', 'Man', 'Barn'].map((t) => `${t} > Accessoarer > Smycken`)

const PLATE = ['tallrik', 'tallrikar', '*tallrik', '*tallrikar', 'assiett*', 'plate', 'plates', '*plate']
const DEEP_PLATE = ['djup tallrik*', 'djupa tallrik*', 'djuptallrik*', 'soppskål*', 'pastatallrik*']
const BOWL = ['skål', 'skålar', 'skålen', '*skål', '*skålar', 'bowl*']
const CUP = ['kopp', 'koppar', '*kopp', '*koppar', 'cup', 'cups', 'mokka*']
const MUG = ['mugg', 'muggar', '*mugg', '*muggar', 'mug', 'mugs']
const VASE = ['vas', 'vaser', 'vasen', '*vas', '*vaser', 'vase*']
const DRINKING_GLASS = ['glas', 'dricksglas*', 'vinglas*', 'champagneglas*', 'snapsglas*', 'ölglas*', 'drinkglas*', 'remmare', 'pokal*', 'glass', 'glasses', 'tumbler*']
const DISH = ['fat', '*fat', 'uppläggningsfat*', 'serveringsfat*', 'tårtfat*', 'karott*', 'dish', 'platter']
const JUG = ['kanna', '*kanna', 'kannor', 'tillbringare', 'karaff*', 'gryta', '*gryta', 'jug', 'pitcher', 'teapot']
const TABLEWARE_MAKERS = [
  'rörstrand', 'gustavsberg', 'iittala', 'littala', 'arabia', 'orrefors', 'kosta', 'höganäs', 'upsala ekeby', 'ekeby', 'figgjo', 'porsgrund',
  'royal copenhagen', 'bing grøndahl', 'bing grondahl', 'nuutajärvi', 'reijmyre',
]
const TABLEWARE_SERIES = [
  'ostindia', 'ostindie', 'mon amie', 'kastehelmi', 'spisa ribb', 'blå eld', 'pomona', 'bersa', 'berså', 'aino aalto', 'teema', 'swedish grace',
]

/** Metals from words and hallmarks ("18k", "585", "sterling"); a hallmark that is really a price ("750 kr") doesn't count */
const METALS: { id: string; label: string; words: string[]; stamps?: number[] }[] = [
  { id: 'gold18', label: '18k gold', words: ['18k', '18kt', '18 k', '18 kt', '18 karat*', '18 carat'], stamps: [750] },
  { id: 'gold14', label: '14k gold', words: ['14k', '14kt', '14 k', '14 kt', '14 karat*', '14 carat'], stamps: [585] },
  { id: 'gold9', label: '9k gold', words: ['9k', '9kt', '9 k', '9 kt', '9 karat*', '9 carat'], stamps: [375] },
  { id: 'silver', label: 'Silver', words: ['silver', 'sterling*', 'sterlingsilver', 'silverring*', 'silverhalsband*', 'silverarmband*', 'silverkedja*'], stamps: [925, 830] },
  { id: 'platinum', label: 'Platinum', words: ['platina', 'platinum'] },
  { id: 'steel', label: 'Steel', words: ['stål', 'rostfri*', 'rostfritt', 'stainless', 'steel'] },
  { id: 'plated', label: 'Gold-plated', words: ['förgylld*', 'guldpläterad*', 'gold plated', 'doublé', 'double', 'pläterad*', 'gold filled', 'guld på stål', 'gold on steel'] },
]

function metalFromTitle(title: string): string[] | undefined {
  const words = tokens(title)
  const stamps = bareNumbers(title, [750, 585, 375, 925, 830])
  const ids = METALS.filter((m) => hasPattern(words, m.words) || m.stamps?.some((s) => stamps.includes(s))).map((m) => m.id)
  return ids.length ? ids : undefined
}

/** Ring size after a keyword ("stl 17", "storlek 17,5", "ringstorlek: 18") */
function ringSizeFromTitle(title: string): number | undefined {
  const m = title.toLowerCase().match(/(?:stl|strl|storlek|size|ringstorlek|innerdiameter)\.?\s*:?\s*(\d{2}(?:[.,]\d)?)/)
  const n = m ? Number(m[1].replace(',', '.')) : NaN
  return n >= 14 && n <= 23 ? n : undefined
}

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
      // Screen protectors (found in the precision check)
      'protektion', 'skyddsglas*', 'härdat glas', 'skärmglas*',
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
      // Spare parts (found in the precision check); not plain "batteri" or "skärm": "100 % batteri", "ny skärm" are a plus
      'bottenkåpa*', 'bottenplatta*', 'touchpad', 'trackpad', 'gångjärn*', 'mah', '*mah', 'lego', 'klocków',
    ],
    sellpyPaths: ['Prylar > Hemelektronik > Datorer & Tillbehör'],
    blocketCategory: '0.93',
    cardFields: ['chip', 'ram', 'storage'],
  },
  {
    id: 'furniture',
    label: 'Furniture & design',
    short: 'Furniture',
    hints: [...CHAIR, ...ARMCHAIR, ...SOFA, ...TABLE, ...DESK, ...STORAGE, ...LAMP, ...BED, ...MIRROR, 'möbel*', 'möbler', '*möbel', 'eames', 'lilla åland'],
    fields: [
      {
        key: 'type',
        label: 'Type',
        kind: 'options',
        options: [
          { id: 'chair', label: 'Chair', words: CHAIR, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'armchair', label: 'Armchair', words: ARMCHAIR, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'sofa', label: 'Sofa', words: SOFA, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'table', label: 'Table', words: TABLE, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'desk', label: 'Desk', words: DESK, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'storage', label: 'Shelves & storage', words: STORAGE, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'lamp', label: 'Lamp', words: LAMP, auctionet: 1, sellpyPaths: ['Prylar > Inredning > Belysning'] },
          { id: 'bed', label: 'Bed', words: BED, auctionet: 16, sellpyPaths: [MOBLER] },
          { id: 'rug', label: 'Rug', words: RUG, auctionet: 35, sellpyPaths: ['Prylar > Inredning > Textiler'] },
          { id: 'mirror', label: 'Mirror', words: MIRROR, auctionet: 42, sellpyPaths: [MOBLER] },
        ],
      },
      {
        key: 'material',
        label: 'Material',
        kind: 'options',
        options: [
          { id: 'teak', label: 'Teak', words: ['teak*', '*teak'] },
          { id: 'oak', label: 'Oak', words: ['ek', 'eken', 'oak', 'ekfaner*', 'ekfanér*', 'ekbord*', 'ekstol*', 'ekskänk*', 'ekhylla*', 'ekskåp*', 'massivek'] },
          { id: 'walnut', label: 'Walnut', words: ['valnöt*', 'walnut'] },
          { id: 'birch', label: 'Birch', words: ['björk*', 'birch'] },
          { id: 'rosewood', label: 'Rosewood', words: ['jakaranda*', 'palisander*', 'rosewood', 'rosenträ*'] },
          { id: 'pine', label: 'Pine', words: ['furu*', 'tall', 'pine'] },
          LEATHER,
          { id: 'rattan', label: 'Rattan & cane', words: ['rotting*', '*rotting', 'rattan', 'wicker', 'pedig*', 'flätad*', 'flätat'] },
          { id: 'metal', label: 'Metal', words: ['metall*', 'stål', 'krom*', '*krom', 'förkromad*', 'mässing*', 'aluminium', 'järn*', 'steel', 'brass', 'chrome'] },
          { id: 'glass', label: 'Glass', words: ['glas', 'glasskiva*', 'glasbord*', 'rökglas*', 'glass'] },
          { id: 'fabric', label: 'Fabric', words: ['tyg*', '*tyg', 'textil*', 'sammet*', 'manchester*', 'bouclé', 'boucle', 'fabric', 'velvet'] },
        ],
      },
      { key: 'color', label: 'Colour', kind: 'options', options: COLORS },
      quantityField(['stolar', 'karmstolar', 'fåtöljer', 'pallar', 'lampor', 'bord']),
      decadeField,
    ],
    sites: ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'],
    // Not plain "bok" (beech) or "dyna" ("stol med dyna" comes with a cushion)
    negativeWords: [
      'ritning*', 'miniatyr*', 'miniature*', 'dockskåp*', 'dockmöbler*', 'affisch*', 'poster', 'katalog*', 'boken',
      'dyna till', 'dynor till', 'överdrag till', 'klädsel till', 'reservdel*',
      // Tradera's loose matches for place-named designs ("Lilla Åland")
      'frimärke*', 'vykort*',
      // Copies ("inspirerade av Lilla Åland")
      'inspirerad*', 'inspired',
    ],
    sellpyPaths: [MOBLER, 'Prylar > Inredning > Belysning', 'Prylar > Inredning > Textiler'],
    blocketCategory: '0.78',
    auctionet: 16,
    cardFields: ['quantity', 'decade', 'material'],
  },
  {
    id: 'watches',
    label: 'Watches & jewellery',
    hints: [...WATCH, ...RING, ...NECKLACE, ...BRACELET, ...EARRINGS, ...BROOCH, ...WATCH_BRANDS, ...JEWELLERY_BRANDS, 'smycke*', '*smycke', 'smycken'],
    fields: [
      {
        key: 'type',
        label: 'Type',
        kind: 'options',
        options: [
          // A watch brand alone says watch ("Omega Seamaster 41 mm")
          { id: 'watch', label: 'Watch', words: [...WATCH, ...WATCH_BRANDS], auctionet: 31, sellpyPaths: ARMBANDSUR },
          { id: 'smartwatch', label: 'Smartwatch', words: SMARTWATCH_WORDS, auctionet: 31, sellpyPaths: ['Prylar > Hemelektronik > Mobil & Wearables'] },
          { id: 'ring', label: 'Ring', words: RING, auctionet: 13, sellpyPaths: SMYCKEN },
          { id: 'necklace', label: 'Necklace', words: NECKLACE, auctionet: 13, sellpyPaths: SMYCKEN },
          { id: 'bracelet', label: 'Bracelet', words: BRACELET, auctionet: 13, sellpyPaths: SMYCKEN },
          { id: 'earrings', label: 'Earrings', words: EARRINGS, auctionet: 13, sellpyPaths: SMYCKEN },
          { id: 'brooch', label: 'Brooch', words: BROOCH, auctionet: 13, sellpyPaths: SMYCKEN },
        ],
      },
      {
        key: 'movement',
        label: 'Movement',
        kind: 'options',
        showWhen: { type: ['watch'] },
        options: [
          { id: 'automatic', label: 'Automatic', words: ['automatic', 'automat*', 'automatisk*', 'självdragande', 'självuppdragande'] },
          { id: 'manual', label: 'Manual winding', words: ['handuppdragen', 'handuppdragning', 'manuell*', 'manual', 'hand wound', 'handwound', 'handwinding', 'hand winding'] },
          { id: 'quartz', label: 'Quartz', words: ['quartz', 'kvarts*', 'batteridriven'] },
        ],
      },
      {
        key: 'caseSize',
        label: 'Case size',
        short: 'Case',
        kind: 'range',
        unit: 'mm',
        bounds: [20, 55],
        showWhen: { type: ['watch'] },
        parse: (title) => numbersWithUnit(title, ['mm']).find((n) => n >= 20 && n <= 55),
      },
      {
        key: 'metal',
        label: 'Metal',
        kind: 'options',
        options: METALS.map(({ id, label }) => ({ id, label, words: [] })),
        parse: metalFromTitle,
      },
      {
        key: 'ringSize',
        label: 'Ring size',
        kind: 'range',
        unit: 'mm',
        bounds: [14, 23],
        step: 0.5,
        showWhen: { type: ['ring'] },
        parse: ringSizeFromTitle,
      },
      {
        key: 'boxPapers',
        label: 'Box & papers',
        kind: 'toggle',
        toggle: 'require',
        parse: (title) => hasPattern(tokens(title), [
          'box och papper*', 'box papper*', 'box and papers', 'box papers', 'full set', 'fullset', 'fullt set', 'kvitto och box', 'box och kvitto', 'låda och papper*',
        ]) || undefined,
      },
    ],
    sites: ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'],
    // Decision 7: "armband till", not "armband", so bracelets stay. Not "länkar" or "klockask" alone:
    // "med extra länkar" and "med klockask" are a plus
    negativeWords: [
      'armband till', 'rem till', 'länk till', 'länkar till', 'endast box', 'endast låda', 'endast klockask*', 'klockask till', 'urverk till',
      'replika*', 'replica', 'kopia', 'fake', 'inspired', 'reservdel*',
      // Keyrings (found in the precision check)
      'brelok*', 'nyckelring*', 'keychain', 'keyring',
    ],
    sellpyPaths: [...ARMBANDSUR, ...SMYCKEN],
    cardFields: ['caseSize', 'metal', 'movement'],
  },
  {
    id: 'glass',
    label: 'Glass, ceramics & tableware',
    short: 'Glass & ceramics',
    hints: [...TABLEWARE_MAKERS, ...TABLEWARE_SERIES, ...PLATE, ...BOWL, ...CUP, ...MUG, ...VASE, ...DISH.filter((w) => w !== 'fat'), 'porslin', 'servis', '*servis', 'keramik'],
    fields: [
      {
        key: 'type',
        label: 'Piece',
        kind: 'options',
        options: [
          { id: 'plate', label: 'Plate', words: PLATE },
          { id: 'deepPlate', label: 'Deep plate', words: DEEP_PLATE },
          { id: 'bowl', label: 'Bowl', words: BOWL },
          { id: 'cup', label: 'Cup & saucer', words: CUP },
          { id: 'mug', label: 'Mug', words: MUG },
          { id: 'vase', label: 'Vase', words: VASE },
          { id: 'drinkingGlass', label: 'Drinking glass', words: DRINKING_GLASS },
          { id: 'dish', label: 'Dish & serving', words: DISH },
          { id: 'jug', label: 'Jug & pot', words: JUG },
        ],
      },
      quantityField(['delar', 'tallrikar', 'djupa tallrikar', 'assietter', 'koppar', 'kaffekoppar', 'tekoppar', 'skålar', 'glas', 'vinglas', 'dricksglas', 'muggar', 'fat']),
      {
        key: 'secondSort',
        label: 'Second sort OK',
        kind: 'toggle',
        toggle: 'allow',
        description: 'Off: listings marked "2:a sortering" (factory seconds) are hidden',
        parse: (title) => hasPattern(tokens(title), ['2 a sort*', '2a sort*', 'andra sort*', 'sekunda', 'second sort*', 'seconds']) || undefined,
      },
    ],
    sites: ['Blocket', 'Tradera', 'Sellpy', 'Vinted', 'Facebook Marketplace', 'Auctionet', 'Bukowskis'],
    // Exact chip words: "naggfri" (chip-free) is a plus
    negativeWords: [
      'skadad*', 'nagg', 'naggad*', 'naggar', 'naggning*', 'kantstött*', 'kantstöt*', 'spricka', 'sprickor', 'sprucken', 'spruckna',
      'limmad*', 'lagad*', 'krakelerad*', 'bild på', 'affisch*',
      // Merchandise with a famous pattern; not plain "burk" ("kryddburk" can be porcelain)
      'zoegas', 'zoégas', 'plåtburk*', 'kaffeburk*', 'paraply*', 'handduk*', '*handduk', 'grytlapp*', 'förkläde*', 'vaxduk*', 'servett*', 'tapet*',
    ],
    // Glass and ceramics are separate categories on Blocket and Auctionet, so neither gets one
    sellpyPaths: ['Prylar > Hushåll > Porslin', 'Prylar > Hushåll > Koppar & Glas', 'Prylar > Inredning > Vaser & Krukor'],
    cardFields: ['type', 'quantity'],
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
export const CATEGORY_PRIORITY: CategoryId[] = ['phones', 'computers', 'watches', 'furniture', 'glass', 'shoes', 'clothing']

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
  if (n < lo || n > hi) return undefined
  const step = field.step ?? 1
  return Math.round(n / step) * step
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
