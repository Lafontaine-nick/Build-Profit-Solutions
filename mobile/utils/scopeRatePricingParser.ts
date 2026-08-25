/**
 * Client mirror of backend scopeRatePricingParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import type { ParsedScopeMeasurements } from '@/utils/scopeMeasurementParser';

const UNIT_DENOMS = {
  sqft: '(?:sq\\.?\\s*ft\\.?|sqft|\\bsf\\b|ft\\.?\\s*(?:²|2\\b|\\?)|square\\s+(?:foot|feet))',
  lf: '(?:lf|linear\\s+(?:foot|feet)|linear\\s+ft|ln\\s*ft)',
  cy: '(?:cy|cubic\\s+yards?)',
  ton: '(?:tons?)',
  squares: '(?:roofing\\s+)?squares?',
} as const;
const RATE_UNIT = new RegExp(
  `(?:${UNIT_DENOMS.sqft}|${UNIT_DENOMS.lf}|${UNIT_DENOMS.cy}|${UNIT_DENOMS.ton}|${UNIT_DENOMS.squares})`,
  'i'
);
const PER = '(?:\\/|per|a|@)\\s*(?:the\\s+)?';
const MONEY = '[\\$]?';
// Dictated filler between label and amount: "material is going to be three dollars…"
const VERB_FILLER =
  '(?:(?:is|are|will|runs?|costs?)\\s*)?(?:going\\s+to\\s+be\\s*|gonna\\s+be\\s*|be\\s*)?(?:about\\s*|around\\s*|approximately\\s*|roughly\\s*)?';
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};
const RATE_AMOUNT = `(?:\\d[\\d,]*(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join('|')})`;

type RateUnit = keyof typeof UNIT_DENOMS;
type ItemRateConfig = {
  key?: keyof ParsedScopeMeasurements;
  keys?: Array<keyof ParsedScopeMeasurements>;
  unit?: RateUnit;
  units?: RateUnit[];
  split?: boolean;
};

const ITEM_RATE_MEASUREMENT: Record<string, ItemRateConfig> = {
  hvac: {
    keys: ['hvacSystemCount', 'hvacSystemTons'],
    units: ['each', 'ton'],
  },
  service_call: { key: 'hvacServiceCallCount', unit: 'each' },
  equipment_replace: { key: 'hvacEquipmentReplacementCount', unit: 'each' },
  refrigerant: { key: 'hvacRefrigerantCount', unit: 'each' },
  thermostat: { key: 'hvacThermostatCount', unit: 'each' },
  ductwork: { key: 'hvacDuctworkLf', unit: 'lf' },
  supply_registers: { key: 'hvacSupplyRegisterCount', unit: 'each' },
  return_grilles: { key: 'hvacReturnGrilleCount', unit: 'each' },
  ventilation: { key: 'hvacVentilationCount', unit: 'each' },
  backsplash: { key: 'backsplashSqft', unit: 'sqft', split: true },
  paint: { key: 'wallPaintSqft', unit: 'sqft', split: true },
  shower_tile: { key: 'showerWallTileSqft', unit: 'sqft', split: true },
  interior_paint: { key: 'wallPaintSqft', unit: 'sqft' },
  exterior_paint: { key: 'exteriorPaintSqft', unit: 'sqft' },
  floor_demo: { keys: ['floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'], unit: 'sqft' },
  flooring: { keys: ['floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'], unit: 'sqft' },
  floor_tile: { keys: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'], unit: 'sqft' },
  drywall: { key: 'drywallSqft', unit: 'sqft' },
  hang: { key: 'drywallSqft', unit: 'sqft' },
  finish_tape: { key: 'drywallSqft', unit: 'sqft' },
  patch_repair: { key: 'drywallSqft', unit: 'sqft' },
  sod_turf: { key: 'sodSqft', unit: 'sqft' },
  artificial_turf: { key: 'artificialTurfSqft', unit: 'sqft' },
  pavers: { key: 'paverSqft', unit: 'sqft' },
  rock: { keys: ['landscapeTons', 'rockMulchSqft', 'landscapeSqft'], units: ['ton', 'sqft', 'sqft'] },
  mulch: { keys: ['landscapeTons', 'rockMulchSqft', 'landscapeSqft'], units: ['ton', 'sqft', 'sqft'] },
  plants: { key: 'plantCount', unit: 'each' },
  trees: { key: 'treeCount', unit: 'each' },
  landscape_boulders: { key: 'boulderCount', unit: 'each' },
  concrete: { keys: ['concreteSqft', 'concreteCy'], units: ['sqft', 'cy'] },
  pour_flatwork: { keys: ['concreteSqft', 'concreteCy'], units: ['sqft', 'cy'] },
  concrete_patio: { keys: ['concreteSqft', 'concreteCy'], units: ['sqft', 'cy'] },
  excavation: { key: 'excavationCy', unit: 'cy' },
  decking: { key: 'deckSqft', unit: 'sqft' },
  railing: { key: 'railingLf', unit: 'lf' },
  trim: { key: 'baseboardLf', unit: 'lf' },
  tear_off: { key: 'roofSquares', unit: 'squares' },
  shingles_roofing: { key: 'roofSquares', unit: 'squares' },
};

const RATE_PRICING_MATCHERS: Array<{ id: string; match: RegExp; exclude?: RegExp }> = [
  {
    id: 'equipment_replace',
    match: /\b(?:hvac|mechanical|furnace|heat\s*pump|air\s*handler|condenser)\b[^.;]{0,60}\b(?:replace|replacement|install(?:ation)?)\b/i,
  },
  {
    id: 'refrigerant',
    match: /\b(?:refrigerant|freon)\s+(?:service|recharge|recovery)\b/i,
  },
  {
    id: 'thermostat',
    match: /\b(?:thermostat|controls?)\s+(?:install(?:ation)?|replacement)\b/i,
  },
  {
    id: 'ductwork',
    match: /\b(?:ductwork|ducts?|flex\s*duct)\b/i,
  },
  {
    id: 'ventilation',
    match: /\b(?:hvac|mechanical)\s+ventilation\b/i,
  },
  {
    id: 'hvac',
    match: /\b(?:hvac|mechanical)\s+(?:system|install(?:ation)?|tonnage|tons?)\b/i,
  },
  {
    id: 'backsplash',
    match: /\b(backsplash|back\s*splash)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'interior_paint',
    match: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/i,
    exclude: /\b(exterior)\b/i,
  },
  {
    id: 'shower_tile',
    match: /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower)\b/i,
  },
  {
    id: 'waterproofing',
    match: /\b(waterproof|backer\s+board|kerdi|red\s*gard|redgard|schluter|membrane)\b/i,
    exclude: /\b(floor\s+tile|bath(?:room)?\s+floor)\b/i,
  },
  {
    id: 'paint',
    match: /\b(paint(?:ing)?|primer|walls?\s+and\s+(?:the\s+)?ceiling)\b/i,
    exclude: /\b(exterior|interior\s+paint|paint\s+interior)\b/i,
  },
  {
    id: 'exterior_paint',
    match: /\b(exterior\s+paint|paint\s+exterior)\b/i,
  },
  {
    id: 'floor_demo',
    match: /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b.*\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b|\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b.*\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i,
  },
  {
    id: 'flooring',
    match: /\b(flooring|laminate|lvp|vinyl\s+floor|carpet)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'floor_tile',
    match: /\b(floor\s+tile|tile\s+floor)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'drywall',
    match: /\b(drywall|sheetrock)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  { id: 'hang', match: /\b(hang\s+drywall|drywall\s+hang)\b/i },
  { id: 'finish_tape', match: /\b(tape|mud|finish\s+drywall)\b/i },
  { id: 'patch_repair', match: /\b(drywall\s+patch|patch\s+drywall|patch\s+repair)\b/i },
  { id: 'artificial_turf', match: /\b(?:artificial|fake|synthetic)\s+(?:grass|turf)\b|\bturf\b/i },
  { id: 'sod_turf', match: /\b(sod|natural\s+grass)\b/i },
  { id: 'pavers', match: /\bpavers?\b/i },
  { id: 'rock', match: /\b(rock|gravel)\b/i },
  { id: 'mulch', match: /\bmulch\b/i },
  { id: 'plants', match: /\b(plants?|shrubs?|planting)\b/i },
  { id: 'trees', match: /\b(trees?)\b/i },
  { id: 'landscape_boulders', match: /\b(?:landscape\s+)?boulders?\b/i },
  { id: 'concrete', match: /\bconcrete\b/i },
  { id: 'pour_flatwork', match: /\b(flatwork|slab|driveway|sidewalk|concrete\s+patio)\b/i },
  { id: 'concrete_patio', match: /\bconcrete\s+patio\b/i },
  { id: 'excavation', match: /\b(excavat(?:e|ion)|grading|trench(?:ing)?)\b/i },
  { id: 'decking', match: /\b(decking|deck\s+surface|composite\s+deck)\b/i },
  { id: 'railing', match: /\b(rail(?:ing)?|guardrail)\b/i },
  { id: 'trim', match: /\b(baseboard|trim)\b/i },
  { id: 'tear_off', match: /\b(tear[\s-]?off|roof\s+demo|remove\s+shingles?)\b/i },
  { id: 'shingles_roofing', match: /\b(shingles?|roof(?:ing)?\s+install|new\s+roof)\b/i },
];

/**
 * Trade-family matcher for a checklist item id, reused for template/bid rate lookup.
 * Returns the keyword regexes that define which line items belong to the same trade.
 */
export function getRatePricingMatcher(
  itemId: string
): { match: RegExp; exclude?: RegExp } | null {
  const matcher = RATE_PRICING_MATCHERS.find((entry) => entry.id === itemId);
  return matcher ? { match: matcher.match, exclude: matcher.exclude } : null;
}

/** Match backend splitNoteClauses — sentence breaks without splitting $1.50 decimals. */
function splitRatePricingClauses(text: string): string[] {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  let sentences = normalized
    .split(
      /(?<!\d)\.\s+(?=[A-Z])|\.\s+(?=(?:demo|install|final|baseboards?|remove|tear|new|paint|interior|cleanup|haul|trim|replace|lvp|vinyl|carpet|flooring|backsplash|back\s*splash|cabinet|countertops?|counters?|appliance)\b)/gi
    )
    .map((x) => x.trim())
    .filter(Boolean);
  if (sentences.length === 1) {
    sentences = normalized
      .split(/[\n;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const clauses: string[] = [];
  for (let sentence of sentences) {
    sentence = sentence.replace(/\bwalls?\s+and\s+(?:the\s+)?ceiling\b/gi, (m) =>
      m.replace(/\s+and\s+/i, ' __WALLS_CEILING__ ')
    );
    sentence = sentence.replace(/\bfinal\s+clean\s+and\s+haul(?:[\s-]?off?)\b/gi, (m) =>
      m.replace(/\s+and\s+/i, ' __FINAL_CLEAN_HAUL__ ')
    );
    const parts = sentence
      .split(
        /\s+(?:and|&|\+)\s+|\s+in\s+(?=\d[\d,]*\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|linear\s*feet|ln\.?\s*ft\.?|\blf\b))/i
      )
      .map((p) => p.trim().replace(/__WALLS_CEILING__/g, ' and ').replace(/__FINAL_CLEAN_HAUL__/g, ' and '))
      .filter(Boolean);
    if (parts.length > 1) clauses.push(...parts);
    else clauses.push(sentence.replace(/__WALLS_CEILING__/g, ' and ').replace(/__FINAL_CLEAN_HAUL__/g, ' and '));
  }
  const raw = clauses
    .flatMap((clause) =>
      clause.split(
        /\b(?:next|then|also(?:\s+we\s+have)?)\s+(?=(?:install|baseboard|trim|flooring|lvp|laminate|vinyl|carpet)\b)/i
      )
    )
    .flatMap((clause) =>
      clause.split(/,\s+(?=(?:paint|primer|demo|demolition|cabinet|countertop|flooring|drywall|shingle|roof|concrete|deck|landscape|excavat|plumb|electrical)\b|[a-z])/i)
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const clause of raw) {
    if (
      merged.length &&
      /^(?:(?:and\s+)?(?:the\s+)?(?:materials?|material\s+(?:cost|price)|labor(?:\s+(?:cost|price))?)\b)|\$\s*\d[\d,]*(?:\.\d+)?\s*(?:\/|per|a|@)?/i.test(clause) &&
      !RATE_PRICING_MATCHERS.some((matcher) => matcher.match.test(clause))
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}, ${clause}`;
    } else {
      merged.push(clause);
    }
  }
  return merged;
}

function parseRateToken(raw: string): number | null {
  const normalized = String(raw || '').trim().toLowerCase();
  if (NUMBER_WORDS[normalized]) return NUMBER_WORDS[normalized];
  const n = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pushRateMatches(clause: string, re: RegExp, bucket: number[]): void {
  let m: RegExpExecArray | null;
  while ((m = re.exec(clause)) !== null) {
    const rate = parseRateToken(m[1]);
    if (rate) bucket.push(rate);
  }
}

function unitDenomFor(unit: RateUnit): string {
  return UNIT_DENOMS[unit] || UNIT_DENOMS.sqft;
}

function pickLaborRate(
  materialRate: number | null,
  laborBeforePrice: number[],
  laborSuffix: number[]
): number | null {
  if (laborBeforePrice.length) {
    return laborBeforePrice[laborBeforePrice.length - 1];
  }
  const fromSuffix = laborSuffix.filter((rate) => rate !== materialRate);
  if (fromSuffix.length) return fromSuffix[fromSuffix.length - 1];
  return laborSuffix[0] ?? null;
}

function extractUnitRates(clause: string, unit: RateUnit = 'sqft'): {
  materialRate: number | null;
  laborRate: number | null;
  generalRate: number | null;
} {
  const denom = unitDenomFor(unit);
  const materialRates: number[] = [];
  const laborBeforePrice: number[] = [];
  const laborSuffix: number[] = [];
  const generalRates: number[] = [];
  const laborSuffixTail = '(?!\\s*\\$)';

  pushRateMatches(
    clause,
    new RegExp(
      `\\b(?:materials?|material\\s+(?:cost|price))\\s*${VERB_FILLER}${MONEY}\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER}${denom}|${denom})\\b`,
      'gi'
    ),
    materialRates
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\blabor(?:\\s+(?:cost|price))?\\s*${VERB_FILLER}${MONEY}\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER})?${denom}\\b`,
      'gi'
    ),
    laborBeforePrice
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\$\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER})?${denom}\\s*(?:for\\s+)?labor\\b${laborSuffixTail}`,
      'gi'
    ),
    laborSuffix
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\$\\s*(${RATE_AMOUNT})\\s+(?:dollars?\\s*)?(?:${denom})\\s*(?:for\\s+)?labor\\b${laborSuffixTail}`,
      'gi'
    ),
    laborSuffix
  );
  pushRateMatches(
    clause,
    new RegExp(`\\$\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER})?${denom}\\b`, 'gi'),
    generalRates
  );

  const materialRate = materialRates[0] ?? null;
  const laborRate = pickLaborRate(materialRate, laborBeforePrice, laborSuffix);

  return {
    materialRate,
    laborRate,
    generalRate:
      generalRates.find((rate) => rate !== materialRate && rate !== laborRate) ??
      generalRates[0] ??
      null,
  };
}

export function extractSqftUnitRates(clause: string): {
  materialRate: number | null;
  laborRate: number | null;
} {
  const { materialRate, laborRate } = extractUnitRates(clause, 'sqft');
  return { materialRate, laborRate };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function quantityForItem(
  itemId: string,
  measurements: ParsedScopeMeasurements
): { quantity: number | null; unit: RateUnit | null } {
  const config = ITEM_RATE_MEASUREMENT[itemId];
  if (!config) return { quantity: null, unit: null };

  if (config.key && measurements[config.key]) {
    return { quantity: Number(measurements[config.key]), unit: config.unit || 'sqft' };
  }

  if (config.keys?.length) {
    for (let i = 0; i < config.keys.length; i += 1) {
      const key = config.keys[i];
      if (measurements[key]) {
        return {
          quantity: Number(measurements[key]),
          unit: config.units?.[i] || config.unit || 'sqft',
        };
      }
    }
  }

  return { quantity: null, unit: config.unit || null };
}

function quantityFromClauseForUnit(clause: string, unit: RateUnit): number | null {
  const denom = unitDenomFor(unit);
  const re = new RegExp(`\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*${denom}\\b`, 'gi');
  let m: RegExpExecArray | null;

  while ((m = re.exec(clause)) !== null) {
    const before = clause.slice(Math.max(0, m.index - 6), m.index);
    if (/\$\s*$/.test(before)) continue;

    const quantity = Number(String(m[1]).replace(/,/g, ''));
    if (Number.isFinite(quantity) && quantity > 0) {
      return quantity;
    }
  }

  return null;
}

function explicitQuantityForMatchedClause(
  itemId: string,
  clause: string
): { quantity: number; unit: RateUnit } | null {
  const config = ITEM_RATE_MEASUREMENT[itemId];
  if (!config) return null;

  const units = new Set<RateUnit>();
  if (config.unit) units.add(config.unit);
  if (config.units?.length) {
    config.units.forEach((unit) => units.add(unit));
  }

  for (const unit of units) {
    const quantity = quantityFromClauseForUnit(clause, unit);
    if (quantity) return { quantity, unit };
  }

  return null;
}

function ratePricingItemIdFromKey(key: string): string | null {
  const match = String(key || '').match(/^(.+)__(?:material|labor|allowance)$/);
  return match ? match[1] : null;
}

function mergeRatePricingEntries(
  out: Record<string, ScopeItemQuantity>,
  itemId: string,
  entries: Record<string, ScopeItemQuantity>
): Record<string, ScopeItemQuantity> {
  const allowanceKey = ITEM_RATE_MEASUREMENT[itemId]?.split ? `${itemId}__allowance` : itemId;
  const matKey = `${itemId}__material`;
  const labKey = `${itemId}__labor`;
  const nextTotal = Number(entries[allowanceKey]?.quantity || 0);
  const prevTotal = Number(out[allowanceKey]?.quantity || 0);
  const prevMaterial = Number(out[matKey]?.quantity || 0);
  const prevLabor = Number(out[labKey]?.quantity || 0);
  const nextMaterial = Number(entries[matKey]?.quantity || 0);
  const nextLabor = Number(entries[labKey]?.quantity || 0);

  // Complementary clauses ("tile material $3/sqft" + "tile labor $5/sqft") combine
  // instead of the later clause replacing the earlier one.
  const complementary =
    prevTotal > 0 &&
    nextTotal > 0 &&
    ((prevMaterial > 0 && !prevLabor && nextLabor > 0 && !nextMaterial) ||
      (prevLabor > 0 && !prevMaterial && nextMaterial > 0 && !nextLabor));
  if (complementary) {
    const material = prevMaterial || nextMaterial;
    const labor = prevLabor || nextLabor;
    out[matKey] = { quantity: material, unit: 'allowance', quantitySource: 'notes' };
    out[labKey] = { quantity: labor, unit: 'allowance', quantitySource: 'notes' };
    out[allowanceKey] = {
      quantity: roundMoney(material + labor),
      unit: 'allowance',
      quantitySource: 'notes',
    };
    return out;
  }

  const shouldReplace =
    !prevTotal ||
    nextTotal > prevTotal ||
    (nextLabor > 0 && nextLabor !== prevLabor) ||
    (nextTotal === prevTotal && nextLabor > prevLabor);
  if (!shouldReplace) return out;
  delete out[matKey];
  delete out[labKey];
  delete out[allowanceKey];
  delete out[itemId];
  return Object.assign(out, entries);
}

function buildRatePricingEntries(
  itemId: string,
  quantity: number,
  rates: { materialRate: number | null; laborRate: number | null; generalRate?: number | null },
  options: ItemRateConfig = {}
): Record<string, ScopeItemQuantity> {
  const { materialRate, laborRate, generalRate } = rates;
  const materialTotal = materialRate ? roundMoney(quantity * materialRate) : 0;
  const laborTotal = laborRate ? roundMoney(quantity * laborRate) : 0;
  const generalTotal = !materialTotal && !laborTotal && generalRate ? roundMoney(quantity * generalRate) : 0;
  const total = roundMoney(materialTotal + laborTotal + generalTotal);
  if (total <= 0) return {};

  const out: Record<string, ScopeItemQuantity> = {};
  if (materialTotal > 0) {
    out[`${itemId}__material`] = { quantity: materialTotal, unit: 'allowance', quantitySource: 'notes' };
  }
  if (laborTotal > 0) {
    out[`${itemId}__labor`] = { quantity: laborTotal, unit: 'allowance', quantitySource: 'notes' };
  }
  out[options.split ? `${itemId}__allowance` : itemId] = {
    quantity: total,
    unit: 'allowance',
    quantitySource: 'notes',
  };
  return out;
}

export type ItemRatePricingBreakdown = {
  material: number | null;
  labor: number | null;
  total: number;
};

/** Sqft × $/sqft rates from notes → material, labor, and total for one checklist item. */
export function resolveItemRatePricingFromNotes(
  itemId: string,
  measurements: ParsedScopeMeasurements,
  notes: string,
  ctx: { templateKey?: string; projectType?: string } = {}
): ItemRatePricingBreakdown | null {
  const entries = parseScopeItemRatePricingFromNotes(notes, measurements, ctx);
  const totalEntry = entries[`${itemId}__allowance`] || entries[itemId];
  if (!totalEntry?.quantity) return null;
  return {
    material: entries[`${itemId}__material`]?.quantity ?? null,
    labor: entries[`${itemId}__labor`]?.quantity ?? null,
    total: Number(totalEntry.quantity),
  };
}

/**
 * Bathroom/shower jobs often price "tile" without repeating "shower tile" in the
 * rate clause ("Tile material is $3 a square foot"). Map bare tile → shower_tile
 * only in shower context; floor tile / backsplash clauses stay excluded.
 * Mirrors backend scopeRatePricingParser.
 */
function ratePricingMatchersForContext(
  notes: string,
  ctx: { templateKey?: string; projectType?: string } = {}
): Array<{ id: string; match: RegExp; exclude?: RegExp }> {
  const showerContext =
    ctx.templateKey === 'bathroom' ||
    ctx.projectType === 'bathroom' ||
    /\bshower\b/i.test(String(notes || ''));
  if (!showerContext) return RATE_PRICING_MATCHERS;
  return [
    ...RATE_PRICING_MATCHERS,
    {
      id: 'shower_tile',
      match: /\btile\b/i,
      exclude: /\b(floors?|flooring|backsplash|demo|demolition|remove|removal|tear[\s-]?out)\b/i,
    },
  ];
}

export function parseScopeItemRatePricingFromNotes(
  notes: string,
  measurements: ParsedScopeMeasurements = {},
  ctx: { templateKey?: string; projectType?: string } = {}
): Record<string, ScopeItemQuantity> {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out: Record<string, ScopeItemQuantity> = {};
  const matchers = ratePricingMatchersForContext(text, ctx);
  const clauses = splitRatePricingClauses(text);

  for (const clause of clauses) {
    if (!RATE_UNIT.test(clause)) continue;

    for (const matcher of matchers) {
      if (!matcher.match.test(clause)) continue;
      if (matcher.exclude?.test(clause)) continue;

      const { quantity, unit } =
        explicitQuantityForMatchedClause(matcher.id, clause) || quantityForItem(matcher.id, measurements);
      if (!quantity || !unit) continue;
      const rates = extractUnitRates(clause, unit);
      if (!rates.materialRate && !rates.laborRate && !rates.generalRate) continue;

      const entries = buildRatePricingEntries(
        matcher.id,
        quantity,
        rates,
        ITEM_RATE_MEASUREMENT[matcher.id]
      );
      if (!Object.keys(entries).length) continue;
      mergeRatePricingEntries(out, matcher.id, entries);
    }
  }

  return out;
}
