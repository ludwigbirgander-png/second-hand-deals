/**
 * English ↔ Swedish synonyms for matching listing titles, and for sending a
 * Swedish version of the query to sites whose titles are in Swedish.
 *
 * Matching is by substring after normalising (see `normalize` in ./match), so
 * base forms also cover plurals and definite forms: "stol" matches "stolar"
 * and "stolen". The first Swedish word is the one used in Swedish queries.
 * Leave out words that are the same in both languages (ring, jeans, vas) and
 * words that collide once å/ä/ö are folded (skål "bowl" would become "skal",
 * a phone case), and very short words that hide inside others (fat → fåtölj).
 */
export const SYNONYM_GROUPS: { en: string[]; sv: string[] }[] = [
  // Furniture and home
  { en: ['chair'], sv: ['stol'] },
  { en: ['armchair', 'lounge chair', 'easy chair'], sv: ['fåtölj', 'karmstol'] },
  { en: ['stool'], sv: ['pall'] },
  { en: ['table'], sv: ['bord'] },
  { en: ['coffee table'], sv: ['soffbord'] },
  { en: ['desk'], sv: ['skrivbord'] },
  { en: ['sofa', 'couch'], sv: ['soffa'] },
  { en: ['bench'], sv: ['bänk'] },
  { en: ['bed'], sv: ['säng'] },
  { en: ['shelf', 'shelves', 'bookcase'], sv: ['hylla', 'bokhylla'] },
  { en: ['cabinet', 'cupboard'], sv: ['skåp'] },
  { en: ['dresser', 'chest of drawers'], sv: ['byrå'] },
  { en: ['sideboard'], sv: ['skänk'] },
  { en: ['mirror'], sv: ['spegel'] },
  { en: ['lamp'], sv: ['lampa'] },
  { en: ['ceiling lamp', 'pendant'], sv: ['taklampa'] },
  { en: ['floor lamp'], sv: ['golvlampa'] },
  { en: ['table lamp'], sv: ['bordslampa'] },
  { en: ['rug', 'carpet'], sv: ['matta'] },
  { en: ['candlestick', 'candle holder'], sv: ['ljusstake'] },
  { en: ['clock'], sv: ['klocka'] },
  // Glass, ceramics and kitchen
  { en: ['plate'], sv: ['tallrik'] },
  { en: ['cup'], sv: ['kopp'] },
  { en: ['mug'], sv: ['mugg'] },
  { en: ['jug', 'pitcher'], sv: ['kanna', 'tillbringare'] },
  { en: ['teapot'], sv: ['tekanna'] },
  { en: ['pot', 'saucepan'], sv: ['kastrull', 'gryta'] },
  { en: ['frying pan'], sv: ['stekpanna'] },
  { en: ['cutlery'], sv: ['bestick'] },
  // Clothing and shoes
  { en: ['jacket'], sv: ['jacka'] },
  { en: ['coat'], sv: ['kappa', 'rock'] },
  { en: ['sweater', 'jumper', 'pullover', 'knit'], sv: ['tröja', 'stickad'] },
  { en: ['cardigan'], sv: ['kofta'] },
  { en: ['shirt'], sv: ['skjorta'] },
  { en: ['blouse'], sv: ['blus'] },
  { en: ['dress'], sv: ['klänning'] },
  { en: ['skirt'], sv: ['kjol'] },
  { en: ['trousers', 'pants'], sv: ['byxor'] },
  { en: ['hoodie'], sv: ['huvtröja'] },
  { en: ['shoes', 'shoe'], sv: ['skor'] },
  { en: ['boots', 'boot'], sv: ['kängor', 'känga', 'stövlar', 'stövel'] },
  { en: ['sandals'], sv: ['sandaler'] },
  { en: ['gloves'], sv: ['handskar'] },
  { en: ['scarf'], sv: ['halsduk', 'sjal'] },
  { en: ['hat'], sv: ['hatt', 'mössa'] },
  // Bags, watches and jewellery
  { en: ['bag', 'handbag'], sv: ['väska', 'handväska'] },
  { en: ['backpack'], sv: ['ryggsäck'] },
  { en: ['wallet'], sv: ['plånbok'] },
  { en: ['watch', 'wristwatch'], sv: ['armbandsur', 'klocka'] },
  { en: ['necklace'], sv: ['halsband'] },
  { en: ['bracelet'], sv: ['armband'] },
  { en: ['earrings'], sv: ['örhängen'] },
  // Electronics
  { en: ['phone', 'mobile'], sv: ['mobil', 'telefon'] },
  { en: ['laptop'], sv: ['bärbar dator'] },
  { en: ['computer'], sv: ['dator'] },
  { en: ['headphones'], sv: ['hörlurar'] },
  { en: ['speaker', 'speakers'], sv: ['högtalare'] },
  { en: ['turntable', 'record player'], sv: ['skivspelare'] },
  { en: ['amplifier'], sv: ['förstärkare'] },
  { en: ['camera'], sv: ['kamera'] },
  { en: ['lens'], sv: ['objektiv'] },
  { en: ['charger'], sv: ['laddare'] },
  // Other
  { en: ['bike', 'bicycle'], sv: ['cykel'] },
  { en: ['painting'], sv: ['målning', 'tavla'] },
  { en: ['print', 'lithograph'], sv: ['litografi', 'tryck'] },
  { en: ['poster'], sv: ['affisch'] },
  { en: ['book'], sv: ['bok'] },
  { en: ['record', 'vinyl'], sv: ['skiva', 'vinylskiva'] },
  { en: ['toy', 'toys'], sv: ['leksak', 'leksaker'] },
  { en: ['pram', 'stroller'], sv: ['barnvagn'] },
]
