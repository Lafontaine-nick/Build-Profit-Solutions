/**
 * Client mirror of backend scopeRatePricingParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import type { ParsedScopeMeasurements } from '@/utils/scopeMeasurementParser';

const SQFT_UNIT = /(?:sq\.?\s*ft|sqft|\bsf\b)/i;

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
    match: /\b(paint(?:ing)?|primer)\b/i,
    exclude: /\b(exterior)\b/i,
  },
  {
    id: 'flooring',
    match: /\b(flooring|laminate|lvp|vinyl\s+floor|carpet)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
];

function splitAllowanceClauses(text: string): string[] {
  return String(text || '')
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRateToken(raw: string): number | null {
  const n = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractSqftUnitRates(clause: string): {
  materialRate: number | null;
  laborRate: number | null;
} {
  const materialRates: number[] = [];
  const laborRates: number[] = [];

  const materialRe =
    /\bmaterials?\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per\s*)?\s*(?:sq\.?\s*ft|sqft)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = materialRe.exec(clause)) !== null) {
    const rate = parseRateToken(m[1]);
    if (rate) materialRates.push(rate);
  }

  const laborRe = /\blabor\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per\s*)?\s*(?:sq\.?\s*ft|sqft)\b/gi;
  while ((m = laborRe.exec(clause)) !== null) {
    const rate = parseRateToken(m[1]);
    if (rate) laborRates.push(rate);
  }

  const laborLeadRe =
    /\$\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per\s*)?\s*(?:sq\.?\s*ft|sqft)\s*labor\b/gi;
  while ((m = laborLeadRe.exec(clause)) !== null) {
    const rate = parseRateToken(m[1]);
    if (rate) laborRates.push(rate);
  }

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

export function parseScopeItemRatePricingFromNotes(
  notes: string,
  measurements: ParsedScopeMeasurements = {},
  _ctx: { templateKey?: string; projectType?: string } = {}
): Record<string, ScopeItemQuantity> {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out: Record<string, ScopeItemQuantity> = {};
  const clauses = splitAllowanceClauses(text);

  for (const clause of clauses) {
    const rates = extractSqftUnitRates(clause);
    if (!rates.materialRate && !rates.laborRate) continue;
    if (!SQFT_UNIT.test(clause)) continue;

    for (const matcher of RATE_PRICING_MATCHERS) {
      if (!matcher.match.test(clause)) continue;
      if (matcher.exclude?.test(clause)) continue;
      if (out[`${matcher.id}__allowance`]) break;

      const sqft = sqftForItem(matcher.id, measurements);
      if (!sqft) break;

      Object.assign(out, buildRatePricingEntries(matcher.id, sqft, rates));
      break;
    }
  }

  return out;
}
