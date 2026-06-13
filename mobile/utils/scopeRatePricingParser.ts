/**
 * Client mirror of backend scopeRatePricingParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import type { ParsedScopeMeasurements } from '@/utils/scopeMeasurementParser';

const UNIT_DENOMS = {
  sqft: '(?:sq\\.?\\s*ft\\.?|sqft|\\bsf\\b|square\\s+(?:foot|feet))',
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

type RateUnit = keyof typeof UNIT_DENOMS;
type ItemRateConfig = {
  key?: keyof ParsedScopeMeasurements;
  keys?: Array<keyof ParsedScopeMeasurements>;
  unit?: RateUnit;
  units?: RateUnit[];
  split?: boolean;
};

const ITEM_RATE_MEASUREMENT: Record<string, ItemRateConfig> = {
  backsplash: { key: 'backsplashSqft', unit: 'sqft', split: true },
  paint: { key: 'wallPaintSqft', unit: 'sqft', split: true },
  interior_paint: { key: 'wallPaintSqft', unit: 'sqft' },
  exterior_paint: { key: 'exteriorPaintSqft', unit: 'sqft' },
  flooring: { keys: ['kitchenFloorSqft', 'floorAreaSqft', 'bathroomFloorSqft'], unit: 'sqft' },
  floor_tile: { keys: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'], unit: 'sqft' },
  drywall: { key: 'drywallSqft', unit: 'sqft' },
  hang: { key: 'drywallSqft', unit: 'sqft' },
  finish_tape: { key: 'drywallSqft', unit: 'sqft' },
  patch_repair: { key: 'drywallSqft', unit: 'sqft' },
  sod_turf: { keys: ['sodSqft', 'landscapeSqft'], unit: 'sqft' },
  pavers: { keys: ['paverSqft', 'landscapeSqft'], unit: 'sqft' },
  rock_mulch: { keys: ['landscapeTons', 'rockMulchSqft', 'landscapeSqft'], units: ['ton', 'sqft', 'sqft'] },
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
    id: 'backsplash',
    match: /\b(backsplash|back\s*splash)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'paint',
    match: /\b(paint(?:ing)?|primer|walls?\s+and\s+(?:the\s+)?ceiling)\b/i,
    exclude: /\b(exterior)\b/i,
  },
  {
    id: 'interior_paint',
    match: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/i,
    exclude: /\b(exterior)\b/i,
  },
  {
    id: 'exterior_paint',
    match: /\b(exterior\s+paint|paint\s+exterior)\b/i,
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
  { id: 'sod_turf', match: /\b(sod|turf|grass)\b/i },
  { id: 'pavers', match: /\bpavers?\b/i },
  { id: 'rock_mulch', match: /\b(rock|mulch|gravel)\b/i },
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

/** Match backend splitNoteClauses — sentence breaks without splitting $1.50 decimals. */
function splitRatePricingClauses(text: string): string[] {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  let sentences = normalized
    .split(/(?<!\d)\.\s+(?=[a-z])/gi)
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
    const parts = sentence
      .split(
        /\s+(?:and|&|\+)\s+|\s+in\s+(?=\d[\d,]*\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|linear\s*feet|ln\.?\s*ft\.?|\blf\b))/i
      )
      .map((p) => p.trim().replace(/__WALLS_CEILING__/g, ' and '))
      .filter(Boolean);
    if (parts.length > 1) clauses.push(...parts);
    else clauses.push(sentence.replace(/__WALLS_CEILING__/g, ' and '));
  }
  const raw = clauses
    .flatMap((clause) =>
      clause.split(/,\s+(?=(?:paint|primer|demo|demolition|cabinet|countertop|flooring|drywall|shingle|roof|concrete|deck|landscape|excavat|plumb|electrical)\b|[a-z])/i)
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const clause of raw) {
    if (
      merged.length &&
      /^(?:materials?|labor)\b|\$\s*\d[\d,]*(?:\.\d+)?\s*(?:\/|per|a|@)?/i.test(clause) &&
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
  const n = Number(String(raw || '').replace(/,/g, ''));
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
    new RegExp(`\\bmaterials?\\s*${MONEY}\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER}${denom}|${denom})\\b`, 'gi'),
    materialRates
  );
  pushRateMatches(
    clause,
    new RegExp(`\\blabor\\s*${MONEY}\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER})?${denom}\\b`, 'gi'),
    laborBeforePrice
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\$\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER})?${denom}\\s*labor\\b${laborSuffixTail}`,
      'gi'
    ),
    laborSuffix
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\$\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s+(?:${denom})\\s*labor\\b${laborSuffixTail}`,
      'gi'
    ),
    laborSuffix
  );
  pushRateMatches(
    clause,
    new RegExp(`\\$\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER})?${denom}\\b`, 'gi'),
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
  const nextTotal = Number(entries[allowanceKey]?.quantity || 0);
  const prevTotal = Number(out[allowanceKey]?.quantity || 0);
  const prevLabor = Number(out[`${itemId}__labor`]?.quantity || 0);
  const nextLabor = Number(entries[`${itemId}__labor`]?.quantity || 0);
  const shouldReplace =
    !prevTotal ||
    nextTotal > prevTotal ||
    (nextLabor > 0 && nextLabor !== prevLabor) ||
    (nextTotal === prevTotal && nextLabor > prevLabor);
  if (!shouldReplace) return out;
  delete out[`${itemId}__material`];
  delete out[`${itemId}__labor`];
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
  if (options.split && materialTotal > 0) {
    out[`${itemId}__material`] = { quantity: materialTotal, unit: 'allowance', quantitySource: 'notes' };
  }
  if (options.split && laborTotal > 0) {
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
  const totalEntry = entries[`${itemId}__allowance`];
  if (!totalEntry?.quantity) return null;
  return {
    material: entries[`${itemId}__material`]?.quantity ?? null,
    labor: entries[`${itemId}__labor`]?.quantity ?? null,
    total: Number(totalEntry.quantity),
  };
}

export function parseScopeItemRatePricingFromNotes(
  notes: string,
  measurements: ParsedScopeMeasurements = {},
  _ctx: { templateKey?: string; projectType?: string } = {}
): Record<string, ScopeItemQuantity> {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out: Record<string, ScopeItemQuantity> = {};
  const clauses = splitRatePricingClauses(text);

  for (const clause of clauses) {
    if (!RATE_UNIT.test(clause)) continue;

    for (const matcher of RATE_PRICING_MATCHERS) {
      if (!matcher.match.test(clause)) continue;
      if (matcher.exclude?.test(clause)) continue;

      const { quantity, unit } = quantityForItem(matcher.id, measurements);
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
