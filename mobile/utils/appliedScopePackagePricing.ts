import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import {
  hasAcceptedScopePricing,
  liveScopeMoneyFromQuantities,
  type ScopePricingAcceptanceMetadata,
} from '@/utils/acceptedPricingSummaryUi';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  ruleKeysToTryForPackage,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';

export type AppliedConfirmScopePackagePricing = {
  ruleKey: string;
  total: number;
  material: number;
  labor: number;
  allowance: number;
};

function resolveAppliedScopeMoneyTotal(
  itemId: string,
  itemQuantities: ScopeMeasurementsInputExtended['itemQuantities'],
  acceptance?: ScopePricingAcceptanceMetadata | null
): number {
  const live = liveScopeMoneyFromQuantities(itemId, itemQuantities || {});
  if (live != null && live > 0) return live;
  const acceptedMaterial = Number(acceptance?.materialAmount ?? 0) || 0;
  const acceptedLabor = Number(acceptance?.laborAmount ?? 0) || 0;
  if (acceptedMaterial + acceptedLabor > 0) return acceptedMaterial + acceptedLabor;
  const accepted = Number(acceptance?.totalAmount);
  if (Number.isFinite(accepted) && accepted > 0) return accepted;
  return 0;
}

function draftMeasurementsForAppliedPricing(draft: EstimateAiDraft): ScopeMeasurementsInputExtended {
  const base = initialScopeMeasurementInputExtended(draft);
  const saved = draft.scopeMeasurements;
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    itemQuantities: {
      ...(base.itemQuantities || {}),
      ...(saved.itemQuantities || {}),
    },
    pricingAcceptance: saved.pricingAcceptance || base.pricingAcceptance,
  };
}

function ruleKeysForPackage(pkg: EstimateDraftScopePackage): string[] {
  const keys: string[] = [];
  if (pkg.checklistItemId) keys.push(pkg.checklistItemId);
  for (const key of ruleKeysToTryForPackage(pkg.name, pkg.scope || '')) {
    if (!keys.includes(key)) keys.push(key);
  }
  if (!keys.length) {
    const fallback = lookupRuleKeyForPackage(pkg.name, pkg.scope || '');
    if (fallback) keys.push(fallback);
  }
  return keys;
}

/** Confirm Scope applied dollars for a Step 3 package when package.price is empty. */
export function resolveAppliedConfirmScopePackagePricing(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft | null | undefined
): AppliedConfirmScopePackagePricing | null {
  if (!draft) return null;
  const items = draft.confirmedAssumptions?.length
    ? draft.confirmedAssumptions
    : draft.scopeChecklist?.items;
  if (!items?.length) return null;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) return null;

  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptanceMap = measurements.pricingAcceptance || {};

  for (const ruleKey of ruleKeysForPackage(pkg)) {
    const item = items.find((i) => i.id === ruleKey);
    if (!item || !checklistItemInScope(item)) continue;
    if (!hasAcceptedScopePricing(ruleKey, quantities, acceptanceMap)) continue;

    const total = resolveAppliedScopeMoneyTotal(ruleKey, quantities, acceptanceMap[ruleKey]);
    if (!(total > 0)) continue;

    const material = Number(quantities[`${ruleKey}__material`]?.quantity || 0) || 0;
    const labor = Number(quantities[`${ruleKey}__labor`]?.quantity || 0) || 0;
    const allowance =
      Number(quantities[`${ruleKey}__allowance`]?.quantity || 0) ||
      (['allowance', 'lump_sum'].includes(quantities[ruleKey]?.unit || '')
        ? Number(quantities[ruleKey]?.quantity || 0)
        : 0) ||
      0;

    if (material + labor > 0) {
      return { ruleKey, total, material, labor, allowance: 0 };
    }
    if (allowance > 0 && Math.abs(allowance - total) < 0.02) {
      return { ruleKey, total, material: 0, labor: 0, allowance: total };
    }
    return { ruleKey, total, material: 0, labor: total, allowance: 0 };
  }

  return null;
}

export function resolveAppliedConfirmScopePackageAmount(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft | null | undefined
): number {
  return resolveAppliedConfirmScopePackagePricing(pkg, draft)?.total ?? 0;
}
