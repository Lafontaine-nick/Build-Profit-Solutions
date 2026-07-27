import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackagesRaw } from '@/utils/estimateAiDraft';
import {
  ensureBathroomChecklistItems,
  expandWetAreaDerivedScopeItems,
  groupScopeChecklistItems,
  normalizeScopeChecklistItems,
  WET_AREA_DERIVED_ITEM_IDS,
  type ScopeChecklistItem,
} from '@/utils/estimateScopeChecklistUi';
import type { NormalizedScopeMeasurements } from '@/utils/scopeItemQuantities';
import {
  syncBathroomFixtureQmScopeItems,
  bathroomFixtureScopeCardVisible,
  expandBathroomFixtureScopeDisplayItems,
} from '@/utils/qmScopePanels/bathroomFixtures';
import { syncQmPanelScopeItems } from '@/utils/qmScopePanels';
import { checklistItemInScope, lookupRuleKeyForPackage, ruleKeysToTryForPackage } from '@/utils/scopeItemQuantities';
import {
  finalizeWetAreaInstallScopeFromMeasurements,
  tileShowerPanStepperActive,
  wetAreaInstallSteppersActive,
} from '@/utils/wetAreaInstallScopeGate';

function isChecklistItemExcluded(item: ScopeChecklistItem): boolean {
  if (item.id === 'interior_finishes') return true;
  if (item.state === 'excluded') return true;
  if (item.inputType === 'choice' && item.choiceId === 'not_in_scope') return true;
  if (item.inputType === 'multi_choice' && item.choiceIds?.includes('not_in_scope')) return true;
  return false;
}

/** Step 3 row title — same cleanup as Confirm Scope yes/no cards. */
export function scopeReviewDisplayLabel(item: ScopeChecklistItem): string {
  return String(item.label || 'Scope item')
    .replace(/\s*—\s*.*$/u, '')
    .replace(/\s*included\?\s*$/i, '')
    .trim();
}

/** Merge QM stepper counts into checklist rows before Step 3 / apply reconciliation. */
export function hydrateChecklistItemsForScopeReview(
  draft: EstimateAiDraft,
  overrideItems?: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const base = overrideItems?.length
    ? overrideItems
    : draft.confirmedAssumptions?.length
      ? draft.confirmedAssumptions
      : draft.scopeChecklist?.items;
  if (!base?.length) return [];

  const templateKey = draft.scopeChecklist?.templateKey;
  const notes = draft.originalNotes || draft.scopeNotes || null;
  let items = base.map((item) => ({ ...item }));
  items = ensureBathroomChecklistItems(items, templateKey);

  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  items = syncBathroomFixtureQmScopeItems(items, measurements);
  items = syncQmPanelScopeItems(
    items,
    { templateKey, wholeHomeLayout: false },
    measurements
  );
  items = normalizeScopeChecklistItems(items, templateKey, {
    notes,
    measurements: measurements as NormalizedScopeMeasurements,
  });
  items = expandBathroomFixtureScopeDisplayItems(items, measurements, templateKey);

  return finalizeWetAreaInstallScopeFromMeasurements(items, measurements);
}

/** Same top-to-bottom order as Step 2 Confirm Scope (groups + wet-area derived rows). */
export function flattenChecklistDisplayOrder(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  const expanded = expandWetAreaDerivedScopeItems(items);
  const groups = groupScopeChecklistItems(expanded, templateKey || undefined);
  return groups.flatMap((group) => group.items);
}

function packageMatchesChecklistItem(
  pkg: EstimateDraftScopePackage,
  itemId: string
): boolean {
  if (pkg.checklistItemId === itemId || pkg.costCode === itemId) return true;
  const primary = lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '');
  if (primary === itemId) return true;
  if (
    (primary === 'patch_repair' && itemId === 'drywall') ||
    (primary === 'drywall' && itemId === 'patch_repair')
  ) {
    return true;
  }
  if (itemId === 'wet_area_install' && /\bwet\s+area\s+install\b/i.test(`${pkg.name || ''} ${pkg.scope || ''}`)) {
    return true;
  }
  // Fallback: only when the package has no resolvable primary key.
  if (!primary) {
    return ruleKeysToTryForPackage(pkg.name || '', pkg.scope || '').includes(itemId);
  }
  return false;
}

function packageFromChecklistItem(
  item: ScopeChecklistItem,
  matched?: EstimateDraftScopePackage
): EstimateDraftScopePackage {
  const name = scopeReviewDisplayLabel(item);
  const scope = item.helperText || matched?.scope || name;
  if (matched) {
    return {
      ...matched,
      name,
      scope,
      checklistItemId: item.id,
      costCode: item.id,
    };
  }
  return {
    name,
    scope,
    checklistItemId: item.id,
    costCode: item.id,
    status: 'missing_price',
    priceSource: 'missing',
    price: null,
    knownSubtotal: null,
    applyEligible: false,
    missingPriceItems: ['Materials / supplies', 'Install labor'],
    pricingItems: [],
  };
}

function stubPackageFromChecklistItem(item: ScopeChecklistItem): EstimateDraftScopePackage {
  return packageFromChecklistItem(item);
}

/** Closeout cleanup is always the last Confirm Scope card — keep Step 3 aligned. */
function pinCleanupLast(packages: EstimateDraftScopePackage[]): EstimateDraftScopePackage[] {
  const cleanupIdx = packages.findIndex(
    (pkg) => pkg.checklistItemId === 'cleanup' || pkg.costCode === 'cleanup'
  );
  if (cleanupIdx < 0 || cleanupIdx === packages.length - 1) return packages;
  const cleanup = packages[cleanupIdx];
  return [...packages.slice(0, cleanupIdx), ...packages.slice(cleanupIdx + 1), cleanup];
}

/**
 * Step 3 scope list — one row per Confirm Scope checklist item (Step 2 order),
 * reusing AI packages where they exist and adding stubs for missing rows.
 */
export function reconcileScopePackagesForReview(
  draft: EstimateAiDraft,
  checklistItems?: ScopeChecklistItem[]
): EstimateDraftScopePackage[] {
  const base = getScopePackagesRaw(draft);
  const items = checklistItems?.length
    ? checklistItems
    : hydrateChecklistItemsForScopeReview(draft);
  if (!items.length) return base;

  const templateKey = draft.scopeChecklist?.templateKey;
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const orderedItems = flattenChecklistDisplayOrder(items, templateKey).filter(
    (item) => {
      // Step 2 picker only — review shows derived install lines (tub, prefab pan, mud pan).
      if (item.id === 'wet_area_install') return false;
      if (item.id === 'shower_pan' && !tileShowerPanStepperActive(measurements)) {
        return false;
      }
      if (
        item.derivedFrom === 'wet_area_install' &&
        !wetAreaInstallSteppersActive(measurements)
      ) {
        return false;
      }
      return (
        !isChecklistItemExcluded(item) &&
        (checklistItemInScope(item) ||
          bathroomFixtureScopeCardVisible(item.id, measurements, items))
      );
    }
  );
  if (!orderedItems.length) return base;

  const usedPackageIndices = new Set<number>();
  const result: EstimateDraftScopePackage[] = [];

  for (const item of orderedItems) {
    if (
      WET_AREA_DERIVED_ITEM_IDS.has(item.id) &&
      !item.derivedFrom &&
      orderedItems.some((row) => row.id === 'wet_area_install')
    ) {
      continue;
    }
    if (item.derivedFrom === 'wet_area_install') {
      const parent = items.find((row) => row.id === 'wet_area_install');
      if (!parent || !checklistItemInScope(parent)) continue;
    }
    const matchIdx = base.findIndex(
      (pkg, idx) => !usedPackageIndices.has(idx) && packageMatchesChecklistItem(pkg, item.id)
    );
    if (matchIdx >= 0) {
      usedPackageIndices.add(matchIdx);
      result.push(packageFromChecklistItem(item, base[matchIdx]));
      continue;
    }
    result.push(stubPackageFromChecklistItem(item));
  }

  return pinCleanupLast(result);
}

export function getScopePackagesForReview(draft: EstimateAiDraft): EstimateDraftScopePackage[] {
  return reconcileScopePackagesForReview(draft);
}

/** Persist checklist-ordered scopePackages after Confirm Scope. */
export function withReconciledScopePackages(
  draft: EstimateAiDraft,
  confirmedItemsOverride?: ScopeChecklistItem[]
): EstimateAiDraft {
  const checklistItems = hydrateChecklistItemsForScopeReview(draft, confirmedItemsOverride);
  if (!checklistItems.length) return draft;
  return {
    ...draft,
    scopePackages: reconcileScopePackagesForReview(draft, checklistItems),
  };
}
