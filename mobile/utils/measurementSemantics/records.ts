import type {
  MeasurementConfidence,
  MeasurementSource,
  MeasurementStatus,
  MeasurementUnit,
  ScopeMeasurementRecord,
  ScopeMeasurementState,
} from './types';
import { getTradeMeasurementProfile, missingStatusForScope } from './tradeMeasurementRegistry';

export function makeMeasurementRecord(input: {
  role: ScopeMeasurementRecord['role'];
  quantity: number | null;
  unit: MeasurementUnit;
  sourceType?: MeasurementSource;
  sourceLabel?: string | null;
  sourcePage?: number | null;
  sourceSheet?: string | null;
  derivationFormula?: string | null;
  derivationInputs?: Record<string, string | number | null>;
  confidence?: MeasurementConfidence;
  requiresReview?: boolean;
  isUserConfirmed?: boolean;
}): ScopeMeasurementRecord {
  const quantity =
    input.quantity != null && Number.isFinite(Number(input.quantity)) && Number(input.quantity) > 0
      ? Number(input.quantity)
      : null;
  return {
    role: input.role,
    quantity,
    unit: input.unit,
    sourceType: input.sourceType || 'unknown',
    sourceLabel: input.sourceLabel ?? null,
    sourcePage: input.sourcePage ?? null,
    sourceSheet: input.sourceSheet ?? null,
    derivationFormula: input.derivationFormula ?? null,
    derivationInputs: input.derivationInputs,
    confidence: input.confidence || (quantity != null ? 'medium' : 'unknown'),
    requiresReview: input.requiresReview ?? quantity == null,
    isUserConfirmed: input.isUserConfirmed ?? false,
  };
}

export function emptyMeasurementState(scopeKey: string): ScopeMeasurementState {
  return {
    primaryTakeoff: null,
    pricing: null,
    benchmark: null,
    status: missingStatusForScope(scopeKey),
  };
}

export function resolveMeasurementStatus(state: ScopeMeasurementState, scopeKey: string): MeasurementStatus {
  if (state.status) return state.status;
  const primary = state.primaryTakeoff?.quantity;
  const pricing = state.pricing?.quantity;
  const benchmark = state.benchmark?.quantity;
  if (primary != null && primary > 0) {
    return pricing != null || benchmark != null ? 'partially_measured' : 'measured';
  }
  if (benchmark != null && benchmark > 0 && (primary == null || primary <= 0)) {
    return 'benchmark_only';
  }
  return missingStatusForScope(scopeKey);
}

export function livingSfBenchmarkRecord(
  livingSf: number,
  extras?: Partial<ScopeMeasurementRecord>
): ScopeMeasurementRecord {
  return makeMeasurementRecord({
    role: 'benchmark',
    quantity: livingSf,
    unit: 'living_sqft',
    sourceType: 'plan_explicit',
    sourceLabel: extras?.sourceLabel || 'Living area from plan schedule',
    sourcePage: extras?.sourcePage,
    sourceSheet: extras?.sourceSheet,
    confidence: 'high',
    requiresReview: false,
    isUserConfirmed: false,
    ...extras,
    role: 'benchmark',
    unit: 'living_sqft',
  });
}

export function livingSfPricingRecord(
  livingSf: number,
  sourceType: MeasurementSource = 'local_benchmark'
): ScopeMeasurementRecord {
  return makeMeasurementRecord({
    role: 'pricing',
    quantity: livingSf,
    unit: 'living_sqft',
    sourceType,
    sourceLabel: 'Pricing basis · living SF benchmark rate',
    confidence: 'medium',
    requiresReview: true,
    isUserConfirmed: false,
  });
}

export function buildSemanticsStateForScope(input: {
  scopeKey: string;
  livingSf?: number | null;
  primaryQuantity?: number | null;
  primaryUnit?: MeasurementUnit | null;
  primarySourceType?: MeasurementSource;
  primarySourceLabel?: string | null;
  drywallSf?: number | null;
  roofSquares?: number | null;
  flooringSf?: number | null;
}): ScopeMeasurementState {
  const profile = getTradeMeasurementProfile(input.scopeKey);
  const living = Number(input.livingSf);
  const hasLiving = Number.isFinite(living) && living > 0;

  let primaryQty = input.primaryQuantity ?? null;
  let primaryUnit: MeasurementUnit =
    input.primaryUnit || profile?.preferredPrimaryUnits[0] || 'unknown';

  if (input.scopeKey === 'drywall' && Number(input.drywallSf) > 0) {
    primaryQty = Number(input.drywallSf);
    primaryUnit = 'surface_sqft';
  } else if (input.scopeKey === 'roofing' && Number(input.roofSquares) > 0) {
    primaryQty = Number(input.roofSquares);
    primaryUnit = 'roof_square';
  } else if (
    (input.scopeKey === 'flooring' || input.scopeKey === 'tile_flooring') &&
    Number(input.flooringSf) > 0
  ) {
    primaryQty = Number(input.flooringSf);
    primaryUnit = 'floor_sqft';
  }

  const primaryTakeoff =
    primaryQty != null && primaryQty > 0
      ? makeMeasurementRecord({
          role: 'primary_takeoff',
          quantity: primaryQty,
          unit: primaryUnit,
          sourceType: input.primarySourceType || 'plan_explicit',
          sourceLabel: input.primarySourceLabel || null,
          confidence: 'medium',
          requiresReview: false,
        })
      : null;

  const benchmark =
    hasLiving && (profile?.canUseLivingSfAsBenchmark ?? true)
      ? livingSfBenchmarkRecord(living)
      : null;

  const status = primaryTakeoff
    ? 'measured'
    : hasLiving && (profile?.canUseLivingSfAsBenchmark ?? true)
      ? profile?.missingQuantityBehavior === 'needs_structural_takeoff'
        ? 'needs_structural_takeoff'
        : profile?.missingQuantityBehavior === 'needs_count'
          ? 'needs_count'
          : profile?.missingQuantityBehavior === 'needs_allowance'
            ? 'needs_allowance'
            : 'needs_takeoff'
      : missingStatusForScope(input.scopeKey);

  return {
    primaryTakeoff,
    pricing: null,
    benchmark,
    status,
  };
}

export function measurementStatusLabel(status: MeasurementStatus | undefined): string {
  switch (status) {
    case 'measured':
      return 'Measured';
    case 'partially_measured':
      return 'Partially measured';
    case 'needs_takeoff':
      return 'Needs takeoff';
    case 'needs_structural_takeoff':
      return 'Needs structural takeoff';
    case 'needs_count':
      return 'Needs count';
    case 'needs_allowance':
      return 'Needs allowance';
    case 'benchmark_only':
      return 'Benchmark pricing only';
    case 'not_applicable':
      return 'Not applicable';
    case 'manual_review':
      return 'Manual review';
    default:
      return 'Needs review';
  }
}
