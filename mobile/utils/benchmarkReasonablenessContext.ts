import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import type { EstimateAiDraft, ScopeMeasurements } from '@/utils/estimateAiDraft';
import {
  currentScopePricingTotal,
  hasAcceptedScopePricing,
  type ScopePricingAcceptanceMetadata,
} from '@/utils/acceptedPricingSummaryUi';
import {
  acceptedTradeScopeKeysForStage,
  benchmarkStageForScopeKey,
  GROUND_UP_COMPARISON_ONLY_STAGE_KEYS,
  isGroundUpStageComparisonOnly,
  isIncludedInStageChild,
  isStageBenchmarkOwner,
  STAGE_BENCHMARK_OWNERS,
} from '@/utils/measurementSemantics/scopePriceUi';
import { planTotalLivingSqft } from '@/utils/planMeasurementFacts';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import {
  allowanceSplitSubKey,
  checklistItemInScope,
  initialScopeMeasurementInputExtended,
  roughAllowanceSubKey,
  type NormalizedScopeMeasurements,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import {
  APPLIED_PRICING_MATERIAL_LABOR_SCOPE_KEYS,
  appliedPricingBucketForScope,
  inferNationalMaterialLaborSplit,
} from '@/utils/appliedPricingBreakdownBuckets';

export type ConfirmScopeAppliedPricingBreakdown = {
  total: number;
  material: number;
  labor: number;
  allowance: number;
};

/** Saved Confirm Scope M/L/allowance must win over note-parsed measurements on restore. */
export function mergeConfirmScopeSavedMeasurements(
  base: ScopeMeasurementsInputExtended,
  saved?: ScopeMeasurements | null
): ScopeMeasurementsInputExtended {
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    itemQuantities: {
      ...(base.itemQuantities || {}),
      ...(saved.itemQuantities || {}),
    },
    pricingAcceptance: saved.pricingAcceptance || base.pricingAcceptance,
    scopeGapResolutions: saved.scopeGapResolutions || base.scopeGapResolutions,
    appliedBenchmarkKeys: saved.appliedBenchmarkKeys || base.appliedBenchmarkKeys,
    pricingOverrideLog: saved.pricingOverrideLog || base.pricingOverrideLog,
    quickMeasurementSources: {
      ...(base.quickMeasurementSources || {}),
      ...(saved.quickMeasurementSources || {}),
    },
    quickMeasurementUserOverrides: {
      ...(base.quickMeasurementUserOverrides || {}),
      ...(saved.quickMeasurementUserOverrides || {}),
    },
    quickMeasurementSuggestionMetadata: {
      ...(base.quickMeasurementSuggestionMetadata || {}),
      ...(saved.quickMeasurementSuggestionMetadata || {}),
    },
    quickMeasurementFieldConfidence: {
      ...(base.quickMeasurementFieldConfidence || {}),
      ...(saved.quickMeasurementFieldConfidence || {}),
    },
  };
}

function parseQtyMoney(entry?: { quantity?: string | number | null }): number {
  const n = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resolveMaterialLaborSplit(
  itemId: string,
  quantities: ScopeMeasurementsInputExtended['itemQuantities'],
  acceptance: ScopePricingAcceptanceMetadata | null | undefined,
  total: number
): { material: number; labor: number } {
  const material = parseQtyMoney(quantities?.[allowanceSplitSubKey(itemId, 'material')]);
  const labor = parseQtyMoney(quantities?.[allowanceSplitSubKey(itemId, 'labor')]);
  if (material + labor > 0) {
    return { material, labor };
  }
  const acceptedMaterial = Number(acceptance?.materialAmount ?? 0) || 0;
  const acceptedLabor = Number(acceptance?.laborAmount ?? 0) || 0;
  if (
    APPLIED_PRICING_MATERIAL_LABOR_SCOPE_KEYS.has(itemId) &&
    (acceptance?.lumpSumOnly || !(acceptedMaterial > 0))
  ) {
    return inferNationalMaterialLaborSplit(itemId, total);
  }
  if (acceptedMaterial + acceptedLabor > 0) {
    return { material: acceptedMaterial, labor: acceptedLabor };
  }
  return inferNationalMaterialLaborSplit(itemId, total);
}

function splitAppliedScopeDollars(
  itemId: string,
  measurements: ScopeMeasurementsInputExtended,
  _templateKey?: string | null
): { material: number; labor: number; allowance: number } {
  const quantities = measurements.itemQuantities || {};
  const acceptance = measurements.pricingAcceptance?.[itemId];
  const total =
    currentScopePricingTotal(itemId, quantities, measurements.pricingAcceptance) ||
    Number(acceptance?.totalAmount ?? 0) ||
    0;
  if (!(total > 0)) return { material: 0, labor: 0, allowance: 0 };

  switch (appliedPricingBucketForScope(itemId)) {
    case 'allowance':
      return { material: 0, labor: 0, allowance: total };
    case 'labor_only':
      return { material: 0, labor: total, allowance: 0 };
    default: {
      const { material, labor } = resolveMaterialLaborSplit(itemId, quantities, acceptance, total);
      return { material, labor, allowance: 0 };
    }
  }
}

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

/** True when this scope's Applied dollars must not count in Confirm Scope / Step 3 totals. */
export function shouldSkipConfirmScopeAppliedTotal(
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
    isStageBenchmarkOwner(itemId, stageKey)
  ) {
    // Only skip the host when a *different* trade child is priced.
    // The host's own national/mat+labor Apply must still count (e.g. Framing).
    const tradeChildren = acceptedTradeScopeKeysForStage(stageKey, acceptance).filter(
      (key) => key !== owner
    );
    if (tradeChildren.length > 0) return true;
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

/** @deprecated Use shouldSkipConfirmScopeAppliedTotal */
function shouldSkipReasonablenessScopeTotal(
  itemId: string,
  templateKey: string | null | undefined,
  pricingAcceptance?: Record<string, unknown> | null
): boolean {
  return shouldSkipConfirmScopeAppliedTotal(itemId, templateKey, pricingAcceptance);
}

/**
 * Drop superseded ground-up stage-host Applied dollars when trade children are priced.
 * Keeps card "Applied" badges aligned with the Applied pricing summary total.
 */
export function clearSupersededStageHostPricing<T extends ScopeMeasurementsInputExtended>(
  measurements: T,
  templateKey?: string | null
): T {
  if (String(templateKey || '').toLowerCase() !== 'ground_up') return measurements;
  const pricingAcceptance = { ...(measurements.pricingAcceptance || {}) };
  const itemQuantities = { ...(measurements.itemQuantities || {}) };
  let changed = false;

  for (const stageKey of GROUND_UP_COMPARISON_ONLY_STAGE_KEYS) {
    const owner = STAGE_BENCHMARK_OWNERS[stageKey];
    if (!owner) continue;
    // Require a priced child trade — never wipe the host for its own Apply
    // (Framing stage owner === framing trade).
    const tradeChildren = acceptedTradeScopeKeysForStage(stageKey, pricingAcceptance).filter(
      (key) => key !== owner
    );
    if (!tradeChildren.length) continue;
    if (!hasAcceptedScopePricing(owner, itemQuantities, pricingAcceptance)) continue;
    // Only drop a stage *planning allowance* — never Foundation/Framing trade $.
    if (pricingAcceptance[owner]?.pricingSourceKind !== 'local_benchmark') continue;

    delete pricingAcceptance[owner];
    for (const key of [
      owner,
      allowanceSplitSubKey(owner, 'allowance'),
      allowanceSplitSubKey(owner, 'sqft_basis'),
      allowanceSplitSubKey(owner, 'material'),
      allowanceSplitSubKey(owner, 'labor'),
      roughAllowanceSubKey(owner),
    ]) {
      if (itemQuantities[key] != null) {
        delete itemQuantities[key];
        changed = true;
      }
    }
    changed = true;
  }

  if (!changed) return measurements;
  return {
    ...measurements,
    itemQuantities,
    pricingAcceptance,
    appliedBenchmarkKeys: (measurements.appliedBenchmarkKeys || []).filter(
      (key) => !/::stage::/.test(String(key))
    ),
  };
}

/**
 * True when this scope should show Applied dollars on its card.
 * Matches Applied pricing summary — excludes superseded stage hosts / included children.
 */
export function scopeShowsConfirmScopeAppliedPricing(
  itemId: string,
  measurements: Pick<ScopeMeasurementsInputExtended, 'itemQuantities' | 'pricingAcceptance'>,
  templateKey?: string | null
): boolean {
  if (
    !hasAcceptedScopePricing(
      itemId,
      measurements.itemQuantities || {},
      measurements.pricingAcceptance
    )
  ) {
    return false;
  }
  return !shouldSkipConfirmScopeAppliedTotal(
    itemId,
    templateKey,
    measurements.pricingAcceptance
  );
}

/** Sum of Applied Confirm Scope dollars — excludes stage double-counts. */
export function sumConfirmScopeAppliedPricingTotal(params: {
  items: ScopeChecklistItem[];
  measurements: ScopeMeasurementsInputExtended;
  templateKey?: string | null;
}): number {
  return sumConfirmScopeAppliedPricingBreakdown(params).total;
}

/** Applied Confirm Scope dollars split into material / labor / allowances. */
export function sumConfirmScopeAppliedPricingBreakdown(params: {
  items: ScopeChecklistItem[];
  measurements: ScopeMeasurementsInputExtended;
  templateKey?: string | null;
}): ConfirmScopeAppliedPricingBreakdown {
  const out: ConfirmScopeAppliedPricingBreakdown = {
    total: 0,
    material: 0,
    labor: 0,
    allowance: 0,
  };
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
    const split = splitAppliedScopeDollars(item.id, params.measurements, params.templateKey);
    const itemTotal = split.material + split.labor + split.allowance;
    if (!(itemTotal > 0)) continue;
    out.material += split.material;
    out.labor += split.labor;
    out.allowance += split.allowance;
    out.total += itemTotal;
  }
  return {
    total: Math.round(out.total * 100) / 100,
    material: Math.round(out.material * 100) / 100,
    labor: Math.round(out.labor * 100) / 100,
    allowance: Math.round(out.allowance * 100) / 100,
  };
}

/** Step 3 totals — same applied-only math as Confirm Scope "Applied pricing". */
export function sumAppliedScopePricingFromDraft(
  draft: EstimateAiDraft | null | undefined
): ConfirmScopeAppliedPricingBreakdown | null {
  if (!draft) return null;
  const items = draft.confirmedAssumptions?.length
    ? draft.confirmedAssumptions
    : draft.scopeChecklist?.items;
  if (!items?.length) return null;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) return null;

  const base = initialScopeMeasurementInputExtended(draft);
  const templateKey = draft.scopeChecklist?.templateKey;
  const measurements = clearSupersededStageHostPricing(
    mergeConfirmScopeSavedMeasurements(base, draft.scopeMeasurements),
    templateKey
  );
  return sumConfirmScopeAppliedPricingBreakdown({
    items,
    measurements,
    templateKey,
  });
}
