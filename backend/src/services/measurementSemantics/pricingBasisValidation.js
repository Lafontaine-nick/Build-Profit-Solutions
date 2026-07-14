const {
  measurementSemanticsV1Enabled,
  measurementValidationRequiredForBenchmark,
} = require('./flags');

function normalizeUnit(raw) {
  const u = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  if (!u) return 'unknown';
  if (u === 'sf' || u === 'sq_ft' || u === 'square_feet') return 'sqft';
  if (u === 'squares' || u === 'square') return 'roof_square';
  if (u === 'each' || u === 'count') return 'ea';
  if (u === 'allowance' || u === 'lump_sum' || u === 'lot') return 'ls';
  if (u === 'living_sf') return 'living_sqft';
  return u;
}

function unitsCompatible(pricingUnit, rateUnit) {
  const p = normalizeUnit(pricingUnit);
  const r = normalizeUnit(rateUnit);
  if (!p || !r || p === 'unknown' || r === 'unknown') return false;
  if (p === r) return true;
  if (
    (p === 'sqft' || p === 'floor_sqft' || p === 'surface_sqft') &&
    (r === 'sqft' || r === 'surface_sqft' || r === 'floor_sqft')
  ) {
    return true;
  }
  return false;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function validatePricingBasis(input = {}) {
  const warnings = [];
  const pricingQty = Number(input.pricingQuantity);
  const rate = Number(input.rate);
  const hasPricing = Number.isFinite(pricingQty) && pricingQty > 0;
  const hasRate = Number.isFinite(rate) && rate > 0;
  const expectedTotal = hasPricing && hasRate ? round2(pricingQty * rate) : null;
  const calculated = Number(input.calculatedTotal);
  const totalMismatch =
    expectedTotal != null && Number.isFinite(calculated) && Math.abs(calculated - expectedTotal) > 0.01;
  const unitMismatch = !unitsCompatible(input.pricingUnit, input.rateUnit);

  if (unitMismatch) {
    warnings.push(
      `Unit mismatch: pricing uses ${normalizeUnit(input.pricingUnit)}, rate uses ${normalizeUnit(input.rateUnit)}.`
    );
  }
  if (totalMismatch) {
    warnings.push(
      `Total mismatch: expected ${expectedTotal} from quantity × rate, got ${round2(calculated)}.`
    );
  }
  if (
    input.measurementStatus === 'needs_takeoff' ||
    input.measurementStatus === 'needs_structural_takeoff' ||
    input.measurementStatus === 'benchmark_only'
  ) {
    warnings.push('Benchmark pricing only — detailed takeoff still required.');
  }

  const isBenchmarkSource = /benchmark|local_benchmark|national/i.test(String(input.selectedSource || ''));
  const mustValidate =
    measurementSemanticsV1Enabled() &&
    (isBenchmarkSource || measurementValidationRequiredForBenchmark());
  const requiresExplicitOverride = mustValidate && (unitMismatch || totalMismatch);
  const blocked = requiresExplicitOverride && !input.overrideConfirmed;

  return {
    ok: !blocked && !totalMismatch && !unitMismatch,
    blocked,
    warnings,
    requiresExplicitOverride,
    unitMismatch,
    totalMismatch,
    expectedTotal,
    preservePrimaryTakeoff: true,
  };
}

module.exports = {
  normalizeUnit,
  unitsCompatible,
  validatePricingBasis,
};
