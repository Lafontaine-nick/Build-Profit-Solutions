import type { MeasurementStatus, MeasurementUnit, PricingOverrideLog } from './types';
import { measurementSemanticsV1Enabled, measurementValidationRequiredForBenchmark } from './flags';

export type PricingBasisValidationInput = {
  itemId: string;
  primaryQuantity?: number | null;
  primaryUnit?: string | null;
  pricingQuantity?: number | null;
  pricingUnit?: string | null;
  rate?: number | null;
  rateUnit?: string | null;
  calculatedTotal?: number | null;
  measurementStatus?: MeasurementStatus | null;
  selectedSource?: string | null;
  allowOverride?: boolean;
  overrideConfirmed?: boolean;
};

export type PricingBasisValidationResult = {
  ok: boolean;
  blocked: boolean;
  warnings: string[];
  requiresExplicitOverride: boolean;
  unitMismatch: boolean;
  totalMismatch: boolean;
  expectedTotal: number | null;
  preservePrimaryTakeoff: true;
  overrideLog?: PricingOverrideLog;
};

function normalizeUnit(raw?: string | null): string {
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

function unitsCompatible(pricingUnit?: string | null, rateUnit?: string | null): boolean {
  const p = normalizeUnit(pricingUnit);
  const r = normalizeUnit(rateUnit);
  if (!p || !r || p === 'unknown' || r === 'unknown') return false;
  if (p === r) return true;
  if ((p === 'sqft' || p === 'floor_sqft' || p === 'surface_sqft') && (r === 'sqft' || r === 'surface_sqft' || r === 'floor_sqft')) {
    return true;
  }
  if ((p === 'roof_square' || p === 'roof_sqft') && (r === 'roof_square' || r === 'roof_sqft' || r === 'sqft')) {
    return p === r || (p === 'roof_sqft' && r === 'sqft');
  }
  if ((p === 'ea' || p === 'fixture' || p === 'opening') && (r === 'ea' || r === 'fixture' || r === 'opening')) {
    return true;
  }
  if ((p === 'ls' || r === 'ls') && p === r) return true;
  return false;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validatePricingBasis(input: PricingBasisValidationInput): PricingBasisValidationResult {
  const warnings: string[] = [];
  const pricingQty = Number(input.pricingQuantity);
  const rate = Number(input.rate);
  const hasPricing = Number.isFinite(pricingQty) && pricingQty > 0;
  const hasRate = Number.isFinite(rate) && rate > 0;
  const expectedTotal = hasPricing && hasRate ? round2(pricingQty * rate) : null;
  const calculated = Number(input.calculatedTotal);
  const totalMismatch =
    expectedTotal != null &&
    Number.isFinite(calculated) &&
    Math.abs(calculated - expectedTotal) > 0.01;
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
  const mustValidate = measurementSemanticsV1Enabled() && (isBenchmarkSource || measurementValidationRequiredForBenchmark());
  const requiresExplicitOverride = mustValidate && (unitMismatch || totalMismatch);
  const blocked = requiresExplicitOverride && !input.overrideConfirmed;

  let overrideLog: PricingOverrideLog | undefined;
  if (requiresExplicitOverride && input.overrideConfirmed) {
    overrideLog = {
      itemId: input.itemId,
      reason: unitMismatch ? 'unit_mismatch_override' : 'total_mismatch_override',
      confirmedAt: new Date().toISOString(),
      pricingUnit: normalizeUnit(input.pricingUnit),
      rateUnit: normalizeUnit(input.rateUnit),
      pricingQuantity: hasPricing ? pricingQty : null,
      rate: hasRate ? rate : null,
      calculatedTotal: Number.isFinite(calculated) ? round2(calculated) : null,
    };
  }

  return {
    ok: !blocked && !totalMismatch && !unitMismatch,
    blocked,
    warnings,
    requiresExplicitOverride,
    unitMismatch,
    totalMismatch,
    expectedTotal,
    preservePrimaryTakeoff: true,
    overrideLog,
  };
}

export function assertBenchmarkDoesNotOverwritePrimary(params: {
  previousPrimaryQuantity?: number | null;
  previousPrimaryUnit?: string | null;
  nextPrimaryQuantity?: number | null;
  nextPrimaryUnit?: string | null;
  appliedPricingUnit?: string | null;
}): { ok: boolean; message?: string } {
  if (!measurementSemanticsV1Enabled()) return { ok: true };
  const pricingUnit = normalizeUnit(params.appliedPricingUnit);
  if (pricingUnit !== 'living_sqft') return { ok: true };
  const nextUnit = normalizeUnit(params.nextPrimaryUnit);
  if (nextUnit === 'living_sqft' && Number(params.nextPrimaryQuantity) > 0) {
    // Living SF must not become primary takeoff via benchmark apply.
    if (
      params.previousPrimaryQuantity == null ||
      normalizeUnit(params.previousPrimaryUnit) !== 'living_sqft'
    ) {
      return {
        ok: false,
        message: 'Benchmark living SF must not overwrite primary takeoff quantity.',
      };
    }
  }
  return { ok: true };
}

export type CanonicalMeasurementUnit = MeasurementUnit;
