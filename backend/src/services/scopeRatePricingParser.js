/**
 * Compute checklist item $ totals from notes sqft + material/labor unit rates.
 * e.g. "45 sqft backsplash, material $8/sqft, labor $12/sqft" → $900 allowance
 */

const { splitAllowanceClauses } = require('./scopeAllowanceParser');

const SQFT_UNIT = /(?:sq\.?\s*ft|sqft|\bsf\b)/i;

/** @type {Record<string, keyof import('./scopeMeasurementParser').ParsedScopeMeasurements>} */
const ITEM_SQFT_MEASUREMENT_KEY = {
  backsplash: 'backsplashSqft',
  paint: 'wallPaintSqft',
  interior_paint: 'wallPaintSqft',
  flooring: 'kitchenFloorSqft',
  floor_tile: 'kitchenFloorSqft',
  drywall: 'drywallSqft',
};

function parseRateToken(raw) {
  const n = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractSqftUnitRates(clause) {
  const materialRates = [];
  const laborRates = [];

  const materialRe =
    /\bmaterials?\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per\s*)?\s*(?:sq\.?\s*ft|sqft)\b/gi;
  let m;
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
    materialRate: materialRates[0] || null,
    laborRate: laborRates[0] || null,
  };
}

function clauseMatchesMatcher(clause, matcher) {
  if (!matcher.match.test(clause)) return false;
  if (matcher.exclude?.test(clause)) return false;
  return true;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function sqftForItem(itemId, measurements, ctx = {}) {
  const key = ITEM_SQFT_MEASUREMENT_KEY[itemId];
  if (key && measurements[key]) return measurements[key];

  if (itemId === 'flooring' || itemId === 'floor_tile') {
    return measurements.kitchenFloorSqft || measurements.floorAreaSqft || measurements.bathroomFloorSqft || null;
  }

  return null;
}

function buildRatePricingEntries(itemId, sqft, rates) {
  const { materialRate, laborRate } = rates;
  if (!sqft || (!materialRate && !laborRate)) return {};

  const materialTotal = materialRate ? roundMoney(sqft * materialRate) : 0;
  const laborTotal = laborRate ? roundMoney(sqft * laborRate) : 0;
  const total = roundMoney(materialTotal + laborTotal);
  if (total <= 0) return {};

  const out = {};
  if (materialTotal > 0) {
    out[`${itemId}__material`] = {
      quantity: materialTotal,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  if (laborTotal > 0) {
    out[`${itemId}__labor`] = {
      quantity: laborTotal,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  out[`${itemId}__allowance`] = {
    quantity: total,
    unit: 'allowance',
    quantitySource: 'notes',
  };
  return out;
}

/** Rate matchers — do not exclude material$/labor$ (those clauses are rate-based). */
const RATE_PRICING_MATCHERS = [
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
    id: 'interior_paint',
    match: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/i,
    exclude: /\b(exterior)\b/i,
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
];

/**
 * @param {string} notes
 * @param {Record<string, number|undefined>} measurements parsed sqft fields
 * @param {{ templateKey?: string, projectType?: string }} [ctx]
 */
function parseScopeItemRatePricingFromNotes(notes, measurements = {}, ctx = {}) {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out = {};
  const clauses = splitAllowanceClauses(text);
  for (const clause of clauses) {
    const rates = extractSqftUnitRates(clause);
    if (!rates.materialRate && !rates.laborRate) continue;
    if (!SQFT_UNIT.test(clause)) continue;

    for (const matcher of RATE_PRICING_MATCHERS) {
      if (!clauseMatchesMatcher(clause, matcher)) continue;
      if (out[`${matcher.id}__allowance`]) break;

      const sqft = sqftForItem(matcher.id, measurements, ctx);
      if (!sqft) break;

      Object.assign(out, buildRatePricingEntries(matcher.id, sqft, rates));
      break;
    }
  }

  return out;
}

module.exports = {
  parseScopeItemRatePricingFromNotes,
  extractSqftUnitRates,
  ITEM_SQFT_MEASUREMENT_KEY,
};
