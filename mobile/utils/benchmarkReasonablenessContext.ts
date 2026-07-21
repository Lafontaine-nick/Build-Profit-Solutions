import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import type { ScopeMeasurements } from '@/utils/estimateAiDraft';
import {
  currentScopePricingTotal,
  hasAcceptedScopePricing,
} from '@/utils/acceptedPricingSummaryUi';
import {
  benchmarkStageForScopeKey,
  isGroundUpStageComparisonOnly,
  isIncludedInStageChild,
  isStageBenchmarkOwner,
  stageHasAcceptedTradePricing,
  STAGE_BENCHMARK_OWNERS,
} from '@/utils/measurementSemantics/scopePriceUi';
import { planTotalLivingSqft } from '@/utils/planMeasurementFacts';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import {
  checklistItemInScope,
  type NormalizedScopeMeasurements,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';

/** Merge scope measurements without wiping plan fields with null from an empty modal close. */
export function mergeScopeMeasurementsPreservingFields(
  base: ScopeMeasurements | null | undefined,
  patch: ScopeMeasurements | null | undefined
): ScopeMeasurements {
  if (!patch) return { ...(base || {}) };
  const out: ScopeMeasurements = { ...(base || {}) };

  for (const [key, value] of Object.entries(patch)) {
    if (
      key === 'itemQuantities' ||
      key === 'pricingAcceptance' ||
      key === 'scopeGapResolutions' ||
      key === 'pricingOverrideLog' ||
      key === 'appliedBenchmarkKeys'
    ) {
      continue;
    }
    if (value == null) continue;
    if (typeof value === 'number' && !(value > 0)) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (out as Record<string, unknown>)[key] = value;
  }

  out.itemQuantities = {
    ...(base?.itemQuantities || {}),
    ...(patch.itemQuantities || {}),
  };
  out.pricingAcceptance = {
    ...(base?.pricingAcceptance || {}),
    ...(patch.pricingAcceptance || {}),
  };
  if (patch.scopeGapResolutions) {
    out.scopeGapResolutions = {
      ...(base?.scopeGapResolutions || {}),
      ...patch.scopeGapResolutions,
    };
  }

  return out;
}

function readLivingCandidate(value: unknown): number | null {
  return parseScopeMeasurementInput(String(value ?? ''));
}

/**
 * Living SF for Build cost / SF — never treat roof squares as living area.
 */
export function resolveBenchmarkLivingSf(params: {
  measurementsInput?: ScopeMeasurementsInputExtended | null;
  norm?: NormalizedScopeMeasurements | null;
  draftMeasurements?: ScopeMeasurements | null;
  templateKey?: string | null;
}): number | null {
  const planFacts =
    params.measurementsInput?.planFacts ?? params.draftMeasurements?.planFacts ?? null;

  const candidates = [
    readLivingCandidate(params.measurementsInput?.floorAreaSqft),
    params.norm?.floorAreaSqft ?? null,
    params.draftMeasurements?.floorAreaSqft ?? null,
    planTotalLivingSqft(planFacts, params.draftMeasurements?.floorAreaSqft),
    planTotalLivingSqft(planFacts, params.norm?.floorAreaSqft),
  ].filter((value): value is number => value != null && value > 0);

  const roof =
    readLivingCandidate(params.measurementsInput?.roofSquares) ??
    params.norm?.roofSquares ??
    params.draftMeasurements?.roofSquares ??
    null;

  const unique = [...new Set(candidates.map((value) => Math.round(value)))];
  for (const living of unique.sort((a, b) => b - a)) {
    if (roof != null && living < 200 && Math.abs(living - roof) < 0.51) continue;
    if (roof != null && living <= 120 && living < roof * 1.5) continue;
    if (living >= 400) return living;
    if (living >= 200) return living;
  }

  return unique[0] ?? null;
}

function benchmarkStageForReasonablenessItem(itemId: string): string | null {
  const covered = benchmarkStageForScopeKey(itemId);
  if (covered) return covered;
  for (const [stageKey, owner] of Object.entries(STAGE_BENCHMARK_OWNERS)) {
    if (owner === itemId) return stageKey;
  }
  return null;
}

function shouldSkipReasonablenessScopeTotal(
  itemId: string,
  templateKey: string | null | undefined,
  pricingAcceptance?: Record<string, unknown> | null
): boolean {
  const stageKey = benchmarkStageForReasonablenessItem(itemId);
  if (!stageKey) return false;

  const owner = STAGE_BENCHMARK_OWNERS[stageKey];
  const acceptance = pricingAcceptance as Record<
    string,
    { selectionStatus?: string | null; totalAmount?: number | null } | null | undefined
  > | null;

  if (
    isGroundUpStageComparisonOnly(stageKey, templateKey) &&
    isStageBenchmarkOwner(itemId, stageKey) &&
    stageHasAcceptedTradePricing(stageKey, acceptance)
  ) {
    return true;
  }

  if (
    owner &&
    isIncludedInStageChild(itemId, stageKey) &&
    hasAcceptedScopePricing(owner, {}, acceptance as never)
  ) {
    return true;
  }

  return false;
}

/** Sum of Applied Confirm Scope dollars — excludes stage double-counts. */
export function sumConfirmScopeAppliedPricingTotal(params: {
  items: ScopeChecklistItem[];
  measurements: ScopeMeasurementsInputExtended;
  templateKey?: string | null;
}): number {
  let total = 0;
  for (const item of params.items) {
    if (!checklistItemInScope(item)) continue;
    if (
      !hasAcceptedScopePricing(
        item.id,
        params.measurements.itemQuantities,
        params.measurements.pricingAcceptance
      )
    ) {
      continue;
    }
    if (shouldSkipReasonablenessScopeTotal(item.id, params.templateKey, params.measurements.pricingAcceptance)) {
      continue;
    }
    const live = currentScopePricingTotal(
      item.id,
      params.measurements.itemQuantities,
      params.measurements.pricingAcceptance
    );
    if (live != null && live > 0) total += live;
  }
  return Math.round(total * 100) / 100;
}
