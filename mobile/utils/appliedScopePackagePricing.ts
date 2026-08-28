import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import {
  hasAcceptedScopePricing,
  liveScopeMoneyFromQuantities,
  type ScopePricingAcceptanceMetadata,
} from '@/utils/acceptedPricingSummaryUi';
import {
  checklistItemInScope,
  getChecklistItemQuantityRule,
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  ruleKeysToTryForPackage,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
} from '@/utils/scopeItemQuantities';
import { confirmScopeDisplayItemsFromDraft } from '@/utils/scopePackagesForReview';

export type AppliedConfirmScopePackagePricing = {
  ruleKey: string;
  total: number;
  material: number;
  labor: number;
  allowance: number;
};

export type NationalAverageScopePackagePricing = AppliedConfirmScopePackagePricing & {
  source: 'national_average';
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

const INTERIOR_PAINT_SURFACE_KEYS = ['interior_paint', 'paint', 'paint_trim'] as const;

function addRuleKey(keys: string[], key: string | null | undefined): void {
  if (key && !keys.includes(key)) keys.push(key);
}

function expandInteriorPaintSurfaceAliases(keys: string[]): string[] {
  const out = [...keys];
  if (keys.some((key) => INTERIOR_PAINT_SURFACE_KEYS.includes(key as (typeof INTERIOR_PAINT_SURFACE_KEYS)[number]))) {
    for (const alias of INTERIOR_PAINT_SURFACE_KEYS) addRuleKey(out, alias);
  }
  return out;
}

/** Keys that may hold Applied Confirm Scope dollars for a Step 3 package row. */
function appliedPricingRuleKeysForPackage(pkg: EstimateDraftScopePackage): string[] {
  const keys: string[] = [];
  addRuleKey(keys, pkg.checklistItemId);
  addRuleKey(keys, pkg.costCode);
  for (const key of ruleKeysToTryForPackage(pkg.name || '', pkg.scope || '')) {
    addRuleKey(keys, key);
  }
  if (!keys.length) {
    addRuleKey(keys, lookupRuleKeyForPackage(pkg.name || '', pkg.scope || ''));
  }

  const primary = pkg.checklistItemId || pkg.costCode || keys[0] || null;
  // Prep / exterior prep are separate add-ons — never copy wall or exterior paint totals.
  if (primary === 'prep' || primary === 'exterior_prep') {
    return [primary];
  }
  if (primary === 'ceiling_paint') {
    return expandInteriorPaintSurfaceAliases(['ceiling_paint', ...keys]);
  }
  return expandInteriorPaintSurfaceAliases(keys);
}

function checklistItemAllowsAppliedRuleKey(
  ruleKey: string,
  primaryId: string | null | undefined,
  items: ReturnType<typeof confirmScopeDisplayItemsFromDraft>
): boolean {
  const item = items.find((row) => row.id === ruleKey);
  if (item) return checklistItemInScope(item);
  if (!primaryId) return false;
  const primary = items.find((row) => row.id === primaryId);
  return Boolean(primary && checklistItemInScope(primary));
}

/**
 * Painting prep / mask add-ons are included in standard interior or exterior paint
 * when those surfaces already have Applied pricing on Confirm Scope.
 */
export function isPaintingAddonCoveredByAppliedSurfacePricing(
  itemId: string,
  draft: EstimateAiDraft | null | undefined
): boolean {
  if (!draft || !itemId) return false;
  if (String(draft.scopeChecklist?.templateKey || '').toLowerCase() !== 'painting') {
    return false;
  }
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return false;
  }

  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return false;
  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptance = measurements.pricingAcceptance || {};
  const surfacePricingApplied = (ids: readonly string[]) => {
    const inScope = ids.some((id) => {
      const item = items.find((row) => row.id === id);
      return item && checklistItemInScope(item);
    });
    if (!inScope) return false;
    return ids.some((id) => hasAcceptedScopePricing(id, quantities, acceptance));
  };

  if (itemId === 'prep') {
    return surfacePricingApplied([...INTERIOR_PAINT_SURFACE_KEYS, 'ceiling_paint']);
  }
  if (itemId === 'exterior_prep') {
    return surfacePricingApplied(['exterior_paint']);
  }
  if (itemId === 'ceiling_paint') {
    const method = draft.scopeMeasurements?.paintPricingMethod;
    if (method === 'combined') {
      return surfacePricingApplied(INTERIOR_PAINT_SURFACE_KEYS);
    }
  }
  return false;
}

/** Confirm Scope applied dollars for a Step 3 package when package.price is empty. */
export function resolveAppliedConfirmScopePackagePricing(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft | null | undefined
): AppliedConfirmScopePackagePricing | null {
  if (!draft) return null;
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return null;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) return null;

  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptanceMap = measurements.pricingAcceptance || {};

  for (const ruleKey of appliedPricingRuleKeysForPackage(pkg)) {
    const primaryId = pkg.checklistItemId || pkg.costCode || null;
    if (!checklistItemAllowsAppliedRuleKey(ruleKey, primaryId, items)) continue;
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

/** Step 2 pricing acceptance metadata for a Step 3 scope row, when present. */
export function resolveConfirmScopePackagePricingAcceptance(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft | null | undefined
): ScopePricingAcceptanceMetadata | null {
  if (!draft) return null;
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return null;
  const measurements = draftMeasurementsForAppliedPricing(draft);
  const acceptanceMap = measurements.pricingAcceptance || {};
  for (const ruleKey of appliedPricingRuleKeysForPackage(pkg)) {
    const primaryId = pkg.checklistItemId || pkg.costCode || null;
    if (!checklistItemAllowsAppliedRuleKey(ruleKey, primaryId, items)) continue;
    const acceptance = acceptanceMap[ruleKey];
    if (acceptance) return acceptance;
  }
  return null;
}

function pricingContextFromDraft(draft: EstimateAiDraft): ScopePricingContext | null {
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return null;
  return { checklistItems: items };
}

function nationalAveragePricingForRuleKey(
  ruleKey: string,
  item: { choiceId?: string | null; id: string },
  draft: EstimateAiDraft,
  measurements: ScopeMeasurementsInputExtended
): NationalAverageScopePackagePricing | null {
  const templateKey = draft.scopeChecklist?.templateKey;
  const notes = resolveDraftScopeNotes(draft);
  const resolved = resolveChecklistItemQuantity(ruleKey, measurements, {
    templateKey,
    notes,
  });
  const rule = getChecklistItemQuantityRule(ruleKey, templateKey);
  const resolvedForSuggest =
    rule?.defaultQuantity != null &&
    !rule.requiresUserQuantity &&
    (!resolved.quantity || resolved.quantity <= 0)
      ? {
          ...resolved,
          quantity: rule.defaultQuantity,
          unit: rule.defaultUnit,
          quantitySource: 'default_assumption' as const,
          pricingReady: true,
          dualCount: { quantity: rule.defaultQuantity, unit: rule.defaultUnit },
        }
      : resolved;

  const suggested = resolveScopeItemSuggestedPricing(
    ruleKey,
    measurements,
    templateKey,
    resolvedForSuggest,
    pricingContextFromDraft(draft),
    item.choiceId
  );
  const fill = suggested.fill;
  if (!fill?.total || !(fill.total > 0)) return null;

  const material = Number(fill.material ?? 0) || 0;
  const labor = Number(fill.labor ?? 0) || 0;
  const allowance =
    fill.lumpSumOnly && material + labor <= 0 ? fill.total : Math.max(0, fill.total - material - labor);

  if (material + labor > 0) {
    return { ruleKey, total: fill.total, material, labor, allowance: 0, source: 'national_average' };
  }
  if (allowance > 0) {
    return { ruleKey, total: fill.total, material: 0, labor: 0, allowance, source: 'national_average' };
  }
  return { ruleKey, total: fill.total, material: 0, labor: fill.total, allowance: 0, source: 'national_average' };
}

/** Step 3 planning price from national average when Confirm Scope has no accepted dollars yet. */
export function resolveNationalAverageScopePackagePricing(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft | null | undefined
): NationalAverageScopePackagePricing | null {
  if (!draft) return null;
  if (
    pkg.priceProvidedByUser ||
    pkg.status === 'user_provided' ||
    pkg.status === 'confirmed' ||
    pkg.priceSource === 'user_provided'
  ) {
    return null;
  }

  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return null;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) return null;

  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptanceMap = measurements.pricingAcceptance || {};

  for (const ruleKey of appliedPricingRuleKeysForPackage(pkg)) {
    const primaryId = pkg.checklistItemId || pkg.costCode || null;
    if (!checklistItemAllowsAppliedRuleKey(ruleKey, primaryId, items)) continue;
    if (hasAcceptedScopePricing(ruleKey, quantities, acceptanceMap)) continue;
    const item = items.find((i) => i.id === ruleKey) || items.find((i) => i.id === primaryId);
    if (!item) continue;
    return nationalAveragePricingForRuleKey(ruleKey, item, draft, measurements);
  }

  return null;
}

export function resolveNationalAverageScopePackageAmount(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft | null | undefined
): number {
  return resolveNationalAverageScopePackagePricing(pkg, draft)?.total ?? 0;
}
