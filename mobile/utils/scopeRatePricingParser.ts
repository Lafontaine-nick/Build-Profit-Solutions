/**
 * Client mirror of backend scopeRatePricingParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import type { ParsedScopeMeasurements } from '@/utils/scopeMeasurementParser';

const SQFT_UNIT = /(?:sq\.?\s*ft\.?|sqft|\bsf\b|square\s+(?:foot|feet))/i;
const SQFT_DENOM = '(?:sq\\.?\\s*ft\\.?|sqft|\\bsf\\b|square\\s+(?:foot|feet))';
const PER = '(?:\\/|per|a|@)\\s*(?:the\\s+)?';
const MONEY = '[\\$]?';

const ITEM_SQFT_MEASUREMENT_KEY: Record<string, keyof ParsedScopeMeasurements> = {
  backsplash: 'backsplashSqft',
  paint: 'wallPaintSqft',
  interior_paint: 'wallPaintSqft',
  flooring: 'kitchenFloorSqft',
  floor_tile: 'kitchenFloorSqft',
  drywall: 'drywallSqft',
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
    id: 'flooring',
    match: /\b(flooring|laminate|lvp|vinyl\s+floor|carpet)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
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
  return clauses;
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

export function extractSqftUnitRates(clause: string): {
  materialRate: number | null;
  laborRate: number | null;
} {
  const materialRates: number[] = [];
  const laborRates: number[] = [];

  pushRateMatches(
    clause,
    new RegExp(`\\bmaterials?\\s*${MONEY}\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER}${SQFT_DENOM}|${SQFT_DENOM})\\b`, 'gi'),
    materialRates
  );
  pushRateMatches(
    clause,
    new RegExp(`\\blabor\\s*${MONEY}\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER})?${SQFT_DENOM}\\b`, 'gi'),
    laborRates
  );
  pushRateMatches(
    clause,
    new RegExp(`\\$\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:${PER})?${SQFT_DENOM}\\s*labor\\b`, 'gi'),
    laborRates
  );
  pushRateMatches(
    clause,
    new RegExp(`\\$\\s*(\\d[\\d,]*(?:\\.\\d+)?)\\s+square\\s+(?:foot|feet)\\s*labor\\b`, 'gi'),
    laborRates
  );

  return {
    materialRate: materialRates[0] ?? null,
    laborRate: laborRates[0] ?? null,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function sqftForItem(itemId: string, measurements: ParsedScopeMeasurements): number | null {
  const key = ITEM_SQFT_MEASUREMENT_KEY[itemId];
  if (key && measurements[key]) return Number(measurements[key]);

  if (itemId === 'flooring' || itemId === 'floor_tile') {
    return (
      measurements.kitchenFloorSqft ||
      measurements.floorAreaSqft ||
      measurements.bathroomFloorSqft ||
      null
    );
  }

  return null;
}

function buildRatePricingEntries(
  itemId: string,
  sqft: number,
  rates: { materialRate: number | null; laborRate: number | null }
): Record<string, ScopeItemQuantity> {
  const { materialRate, laborRate } = rates;
  const materialTotal = materialRate ? roundMoney(sqft * materialRate) : 0;
  const laborTotal = laborRate ? roundMoney(sqft * laborRate) : 0;
  const total = roundMoney(materialTotal + laborTotal);
  if (total <= 0) return {};

  const out: Record<string, ScopeItemQuantity> = {};
  if (materialTotal > 0) {
    out[`${itemId}__material`] = { quantity: materialTotal, unit: 'allowance', quantitySource: 'notes' };
  }
  if (laborTotal > 0) {
    out[`${itemId}__labor`] = { quantity: laborTotal, unit: 'allowance', quantitySource: 'notes' };
  }
  out[`${itemId}__allowance`] = { quantity: total, unit: 'allowance', quantitySource: 'notes' };
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
    const rates = extractSqftUnitRates(clause);
    if (!rates.materialRate && !rates.laborRate) continue;
    if (!SQFT_UNIT.test(clause)) continue;

    for (const matcher of RATE_PRICING_MATCHERS) {
      if (!matcher.match.test(clause)) continue;
      if (matcher.exclude?.test(clause)) continue;
      if (out[`${matcher.id}__allowance`]) continue;

      const sqft = sqftForItem(matcher.id, measurements);
      if (!sqft) continue;

      Object.assign(out, buildRatePricingEntries(matcher.id, sqft, rates));
    }
  }

  return out;
}
