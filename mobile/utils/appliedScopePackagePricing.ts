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
  resolveEnteredGroundUpFlatworkFill,
  resolveGroundUpHvacPlanningFill,
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
/** Same trade, two checklist ids. Apply on either one is the price for that row. */
const DUPLICATE_APPLIED_SCOPE_IDS: string[][] = [
  ['windows', 'window_install'],
  ['exterior_doors', 'exterior_door_install'],
  ['interior_doors', 'interior_door_install'],
  ['paint', 'interior_paint'],
  ['drywall', 'patch_repair'],
  ['trim', 'baseboard_install'],
];

function duplicateAppliedScopeIds(itemId: string | null | undefined): string[] {
  if (!itemId) return [];
  const group = DUPLICATE_APPLIED_SCOPE_IDS.find(ids => ids.includes(itemId));
  if (!group) return [];
  return group.filter(id => id !== itemId);
}

/** Row id plus the other checklist id for the same trade. */
function appliedIdsForPackage(pkg: EstimateDraftScopePackage): string[] {
  const primary =
    pkg.checklistItemId ||
    pkg.costCode ||
    lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
    null;
  if (!primary) return [];
  return [primary, ...duplicateAppliedScopeIds(primary)];
}

/**
 * Applied Step 2 dollars for this row, including when the priced id was
 * collapsed off the visible checklist. Only ids the user Applied are returned.
 */
function directAppliedPricing(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): AppliedConfirmScopePackagePricing | null {
  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptanceMap = measurements.pricingAcceptance || {};
  for (const ruleKey of appliedIdsForPackage(pkg)) {
    // Apply writes pricingAcceptance. A suggested or typed quantity alone stays price needed.
    if (!acceptanceMap[ruleKey]) continue;
    if (!hasAcceptedScopePricing(ruleKey, quantities, acceptanceMap)) continue;
    const total = resolveAppliedScopeMoneyTotal(
      ruleKey,
      quantities,
      acceptanceMap[ruleKey]
    );
    if (!(total > 0)) continue;
    const material = Number(quantities[`${ruleKey}__material`]?.quantity || 0) || 0;
    const labor = Number(quantities[`${ruleKey}__labor`]?.quantity || 0) || 0;
    if (material + labor > 0) {
      return { ruleKey, total, material, labor, allowance: 0 };
    }
    return { ruleKey, total, material: 0, labor: total, allowance: 0 };
  }
  return null;
}

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
  for (const alias of duplicateAppliedScopeIds(primary)) addRuleKey(keys, alias);
  return expandInteriorPaintSurfaceAliases(keys);
}

function checklistItemAllowsAppliedRuleKey(
  ruleKey: string,
  primaryId: string | null | undefined,
  items: ReturnType<typeof confirmScopeDisplayItemsFromDraft>
): boolean {
  const item = items.find((row) => row.id === ruleKey);
  if (item) {
    if (checklistItemInScope(item)) return true;
    // The other id was collapsed off the list. Apply on that id still
    // belongs to the card that stayed.
    if (
      primaryId &&
      duplicateAppliedScopeIds(primaryId).includes(ruleKey)
    ) {
      const primary = items.find((row) => row.id === primaryId);
      return Boolean(primary && checklistItemInScope(primary));
    }
    return false;
  }
  if (!primaryId) return false;
  const primary = items.find((row) => row.id === primaryId);
  return Boolean(primary && checklistItemInScope(primary));
}

function paintingDraftUsesPaintSurfaces(draft: EstimateAiDraft): boolean {
  const template = String(draft.scopeChecklist?.templateKey || '').toLowerCase();
  const trade = String(
    (draft.scopeMeasurements as { planImportTradeKey?: string | null } | null)
      ?.planImportTradeKey || ''
  ).toLowerCase();
  return template === 'painting' || trade === 'painting';
}

/**
 * A surface price is on the bid once Confirm Scope recorded it.
 * Live material/labor fields count, and so does the acceptance total those
 * review rows already display.
 */
function surfacePriceIsApplied(
  itemId: string,
  quantities: ScopeMeasurementsInputExtended['itemQuantities'],
  acceptance: Record<string, ScopePricingAcceptanceMetadata>
): boolean {
  const recorded = acceptance[itemId];
  if (!recorded) return false;
  if (hasAcceptedScopePricing(itemId, quantities || {}, acceptance)) return true;
  return resolveAppliedScopeMoneyTotal(itemId, quantities, recorded) > 0;
}

/**
 * Combined ceiling paint is already inside the interior paint price.
 * Masking is its own card and stays unpriced until that card is applied.
 */
export function isPaintingAddonCoveredByAppliedSurfacePricing(
  itemId: string,
  draft: EstimateAiDraft | null | undefined
): boolean {
  if (!draft || !itemId) return false;
  if (!paintingDraftUsesPaintSurfaces(draft)) return false;
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) {
    return false;
  }

  const normalized =
    itemId === 'paint_prep' || itemId === 'masking' || itemId === 'interior_masking'
      ? 'prep'
      : itemId;
  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptance = measurements.pricingAcceptance || {};
  const surfacePricingApplied = (ids: readonly string[]) =>
    ids.some((id) => surfacePriceIsApplied(id, quantities, acceptance));

  if (normalized === 'prep' || normalized === 'exterior_prep') return false;
  if (normalized === 'ceiling_paint') {
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
  if (!draft.scopeAssumptionsConfirmed && !draft.confirmedAssumptions?.length) return null;
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return directAppliedPricing(pkg, draft);

  const measurements = draftMeasurementsForAppliedPricing(draft);
  const quantities = measurements.itemQuantities || {};
  const acceptanceMap = measurements.pricingAcceptance || {};

  for (const ruleKey of appliedPricingRuleKeysForPackage(pkg)) {
    const primaryId = pkg.checklistItemId || pkg.costCode || null;
    if (!checklistItemAllowsAppliedRuleKey(ruleKey, primaryId, items)) continue;
    if (!hasAcceptedScopePricing(ruleKey, quantities, acceptanceMap)) continue;

    const acceptance = acceptanceMap[ruleKey];
    const manualPrice =
      acceptance?.selectionStatus === 'manual_adjusted' ||
      acceptance?.selectionStatus === 'user_entered';
    if (!manualPrice) {
      const enteredFlatwork = resolveEnteredGroundUpFlatworkFill(
        ruleKey,
        measurements,
        draft.scopeChecklist?.templateKey
      );
      if (enteredFlatwork) {
        return {
          ruleKey,
          total: enteredFlatwork.total,
          material: enteredFlatwork.material,
          labor: enteredFlatwork.labor,
          allowance: 0,
        };
      }
      const hvacPackage = resolveGroundUpHvacPlanningFill(
        ruleKey,
        measurements,
        draft.scopeChecklist?.templateKey
      );
      if (hvacPackage) {
        return {
          ruleKey,
          total: hvacPackage.total,
          material: hvacPackage.material,
          labor: hvacPackage.labor,
          allowance: 0,
        };
      }
    }

    const total = resolveAppliedScopeMoneyTotal(ruleKey, quantities, acceptanceMap[ruleKey]);
    if (!(total > 0)) continue;
    if (
      String(
        draft.scopeChecklist?.templateKey ||
          (measurements as { planImportTradeKey?: string | null }).planImportTradeKey ||
          ''
      ).toLowerCase() === 'painting' &&
      !manualPrice
    ) {
      const suggested = resolveScopeItemSuggestedPricing(
        ruleKey,
        measurements,
        draft.scopeChecklist?.templateKey || 'painting',
        resolveChecklistItemQuantity(ruleKey, measurements, {
          templateKey: draft.scopeChecklist?.templateKey,
          notes: resolveDraftScopeNotes(draft),
        }),
        null,
        null,
        resolveDraftScopeNotes(draft)
      );
      const suggestedTotal = Number(suggested.fill?.total);
      const acceptedTotal = Number(acceptance?.totalAmount);
      const live = liveScopeMoneyFromQuantities(ruleKey, quantities) ?? 0;
      const hasAcceptedTotal = Number.isFinite(acceptedTotal) && acceptedTotal > 0;
      const committed = hasAcceptedTotal ? acceptedTotal : live;
      if (
        !(suggestedTotal > 0) ||
        !(committed > 0) ||
        Math.abs(committed - suggestedTotal) >= 1 ||
        (hasAcceptedTotal && live > 0 && Math.abs(acceptedTotal - live) >= 1)
      ) {
        continue;
      }
    }

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

  return directAppliedPricing(pkg, draft);
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
  draft: EstimateAiDraft | null | undefined,
  options?: { allowPreConfirm?: boolean }
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
  if (
    !options?.allowPreConfirm &&
    !draft.scopeAssumptionsConfirmed &&
    !draft.confirmedAssumptions?.length
  ) {
    return null;
  }

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
  draft: EstimateAiDraft | null | undefined,
  options?: { allowPreConfirm?: boolean }
): number {
  return resolveNationalAverageScopePackagePricing(pkg, draft, options)?.total ?? 0;
}
