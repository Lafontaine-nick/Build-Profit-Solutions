import type { QuickMeasurementSourceMap } from '@/utils/quickMeasurementProvenance';

export type PlanReviewLockRow = {
  key: string;
  value: string;
  include: boolean;
  pricingEligible?: boolean;
};

/** Rows accepted in Plan Review and written into the estimate on Apply. */
export function buildPlanReviewLockedProvenance(
  rows: PlanReviewLockRow[],
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  return Object.fromEntries(
    rows
      .filter(row => row.include && Number(row.value) > 0)
      .map(row => [
        row.key,
        planReviewLockProvenanceEntry(Number(row.value), {
          existing: existing?.[row.key],
          pricingEligible: row.pricingEligible,
        }),
      ])
  );
}

export function planReviewLockProvenanceEntry(
  value: number,
  opts?: {
    existing?: unknown;
    pricingEligible?: boolean;
  }
): Record<string, unknown> {
  const existing =
    opts?.existing && typeof opts.existing === 'object'
      ? (opts.existing as Record<string, unknown>)
      : {};
  return {
    ...existing,
    value,
    source: 'contractor_confirmed_from_plan_review',
    normalizedSource: 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW',
    status: 'user_confirmed',
    evidenceKind: 'user_confirmed',
    confirmedFrom: 'PLAN_REVIEW',
    pricingEligible: opts?.pricingEligible !== false,
    reason: 'Contractor confirmed this quantity during plan review.',
  };
}

export function isPlanReviewLockedProvenance(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as Record<string, unknown>;
  const normalized = String(record.normalizedSource || '').toUpperCase();
  const confirmedFrom = String(record.confirmedFrom || '').toUpperCase();
  const source = String(record.source || '').toLowerCase();
  return (
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW' ||
    confirmedFrom === 'PLAN_REVIEW' ||
    source === 'contractor_confirmed_from_plan_review'
  );
}

export function tagPlanReviewLockedQuickMeasurementSources(
  provenance: Record<string, unknown> | null | undefined,
  measurementKeys: string[],
  existing?: QuickMeasurementSourceMap
): QuickMeasurementSourceMap {
  const next: QuickMeasurementSourceMap = { ...(existing || {}) };
  for (const key of measurementKeys) {
    if (!isPlanReviewLockedProvenance(provenance?.[key])) continue;
    next[key] = 'contractor_confirmed_from_plan_review';
  }
  return next;
}
