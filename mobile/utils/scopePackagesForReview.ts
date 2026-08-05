import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackagesRaw } from '@/utils/estimateAiDraft';
import {
  ensureBathroomChecklistItems,
  ensureGroundUpFlatworkScopeCard,
  ensureGroundUpOpeningScopeCards,
  expandWetAreaDerivedScopeItems,
  groupScopeChecklistItems,
  normalizeScopeChecklistItems,
  WET_AREA_DERIVED_ITEM_IDS,
  type ScopeChecklistItem,
} from '@/utils/estimateScopeChecklistUi';
import { benchmarkEngineV1Enabled } from '@/utils/benchmarkEngine';
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics/flags';
import type { NormalizedScopeMeasurements } from '@/utils/scopeItemQuantities';
import {
  syncBathroomFixtureQmScopeItems,
  expandBathroomFixtureScopeDisplayItems,
  shouldHideBathroomFixtureScopeCardInQmEmbed,
  bathroomFixtureScopeCardVisible,
  BATHROOM_FIXTURES_QM_EMBEDDED_IDS,
} from '@/utils/qmScopePanels/bathroomFixtures';
import {
  getQmEmbeddedScopeIds,
  isPhotoNotesScopeJob,
  syncQmPanelScopeItems,
} from '@/utils/qmScopePanels';
import type { QmPhotoNotesContext } from '@/utils/qmScopePanels/types';
import {
  isWholeHomeQuickMeasurementTemplate,
  resolveEffectiveQuickMeasurementTemplateKey,
} from '@/utils/scopeQuickMeasurements';
import { checklistItemInScope, lookupRuleKeyForPackage, ruleKeysToTryForPackage } from '@/utils/scopeItemQuantities';
import {
  finalizeWetAreaInstallScopeFromMeasurements,
} from '@/utils/wetAreaInstallScopeGate';

export type ConfirmScopeVisibleRowsContext = {
  templateKey?: string | null;
  projectType?: string | null;
  measurements: Record<string, unknown>;
  /** Step 3 hides the wet-area picker row and shows derived install lines instead. */
  forStep3Review?: boolean;
};

const INTERIOR_FINISH_CHILD_IDS = new Set([
  'insulation',
  'drywall',
  'paint_trim',
  'cabinets_counters',
  'cabinets',
  'countertops',
  'tile_flooring',
  'floor_tile',
  'shower_tile',
  'shower_floor_tile',
  'appliances',
]);

/**
 * Expand checklist rows for Confirm Scope UI and Applied-pricing totals.
 * Step 2 and Step 3 must share this list so footer totals match review rows.
 */
export function buildConfirmScopeDisplayItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  templateKey?: string | null
): ScopeChecklistItem[] {
  let expanded = expandWetAreaDerivedScopeItems(items).map((row) =>
    row.id === 'exterior' && row.label === 'Exterior finishes'
      ? { ...row, label: 'Exterior Envelope' }
      : row
  );
  if (String(templateKey || '').toLowerCase() === 'bathroom') {
    expanded = expandBathroomFixtureScopeDisplayItems(expanded, measurements, templateKey);
    // One paint/patch card only — drop legacy QM paint IDs from the ready list.
    if (expanded.some((row) => row.id === 'paint_repair')) {
      expanded = expanded.filter(
        (row) =>
          row.id !== 'interior_paint' &&
          row.id !== 'paint' &&
          row.id !== 'paint_trim' &&
          row.id !== 'prep' &&
          row.id !== 'drywall' &&
          row.id !== 'patch_repair'
      );
    }
  }
  if (String(templateKey || '').toLowerCase() === 'ground_up') {
    expanded = ensureGroundUpFlatworkScopeCard(expanded);
    expanded = ensureGroundUpOpeningScopeCards(expanded);
  }
  if (String(templateKey || '').toLowerCase() === 'flooring') {
    const existingTypes = Array.isArray(measurements.flooringExistingTypes)
      ? measurements.flooringExistingTypes
          .filter((type): type is string => typeof type === 'string' && type !== 'unknown')
          .map((type) => type.replace(/_/g, ' '))
      : [];
    const existingDescription = existingTypes.length
      ? `Remove existing ${existingTypes.join(', ')} flooring before installing the selected new flooring.`
      : 'Remove existing flooring before installing the selected new flooring.';
    expanded = expanded.map((row) =>
      row.id === 'floor_demo'
        ? { ...row, label: 'Demo Existing Flooring', helperText: existingDescription }
        : row
    );
  }
  if (!measurementSemanticsV1Enabled() || !benchmarkEngineV1Enabled()) return expanded;
  if (expanded.some((row) => row.id === 'interior_finishes')) return expanded;
  const hasFinishChild = expanded.some(
    (row) => INTERIOR_FINISH_CHILD_IDS.has(row.id) && checklistItemInScope(row)
  );
  if (!hasFinishChild) return expanded;
  const stageCard: ScopeChecklistItem = {
    id: 'interior_finishes',
    label: 'Interior Finishes',
    helperText:
      'Planning comparison only — price drywall, paint, cabinets, counters, and tile separately.',
    state: 'excluded',
    category: 'Finishes',
  };
  const drywallIdx = expanded.findIndex((row) => row.id === 'drywall');
  if (drywallIdx >= 0) {
    return [...expanded.slice(0, drywallIdx), stageCard, ...expanded.slice(drywallIdx)];
  }
  return [...expanded, stageCard];
}

/** Checklist rows for Applied-pricing math after Continue — mirrors Step 2 displayItems. */
export function confirmScopeDisplayItemsFromDraft(draft: EstimateAiDraft): ScopeChecklistItem[] {
  const base = draft.confirmedAssumptions?.length
    ? draft.confirmedAssumptions
    : draft.scopeChecklist?.items;
  if (!base?.length) return [];
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  return buildConfirmScopeDisplayItems(base, measurements, draft.scopeChecklist?.templateKey);
}

/** QM embed context — same template resolution as Confirm Scope Step 2. */
export function resolveConfirmScopeQmContext(
  measurements: Record<string, unknown>,
  templateKey?: string | null,
  projectType?: string | null
): QmPhotoNotesContext {
  const living =
    Number(String(measurements.floorAreaSqft || '').replace(/,/g, '')) ||
    Number(
      (measurements.planFacts as { buildingAreas?: { mainFloorLivingSqft?: number } } | undefined)
        ?.buildingAreas?.mainFloorLivingSqft
    ) ||
    null;
  const garage =
    Number(String(measurements.garageSqft || '').replace(/,/g, '')) ||
    Number(
      (measurements.planFacts as { buildingAreas?: { garageSqft?: number } } | undefined)?.buildingAreas
        ?.garageSqft
    ) ||
    null;
  const effectiveKey = resolveEffectiveQuickMeasurementTemplateKey({
    templateKey,
    projectType,
    planRoomCount: Array.isArray(measurements.planRooms) ? measurements.planRooms.length : 0,
    livingSf: living,
    garageSf: garage,
  });
  return {
    templateKey: effectiveKey,
    wholeHomeLayout: isWholeHomeQuickMeasurementTemplate(effectiveKey),
  };
}

/** Match Step 2 `renderItem` — hide scope cards absorbed into Quick measurements. */
export function isScopeCardHiddenInQmEmbed(
  itemId: string,
  displayItems: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  qmCtx: QmPhotoNotesContext
): boolean {
  if (!isPhotoNotesScopeJob(qmCtx)) return false;
  const qmEmbeddedScopeIds = getQmEmbeddedScopeIds(qmCtx);
  if (!qmEmbeddedScopeIds.has(itemId)) return false;
  if (shouldHideBathroomFixtureScopeCardInQmEmbed(itemId, measurements, displayItems)) return true;
  if (BATHROOM_FIXTURES_QM_EMBEDDED_IDS.has(itemId)) return false;
  return true;
}

/** Step 3 review — selected scope only (Yes / chosen options), same rules as Applied pricing. */
function isConfirmScopeReviewRowSelected(
  item: ScopeChecklistItem,
  displayItems: ScopeChecklistItem[],
  measurements: Record<string, unknown>
): boolean {
  if (item.id === 'interior_finishes') return false;
  if (checklistItemInScope(item)) return true;
  return bathroomFixtureScopeCardVisible(item.id, measurements, displayItems);
}

/**
 * Flat scope row order shared by Step 2 cards and Step 3 review lines.
 * Step 3 uses the same top-to-bottom order but only rows selected on Confirm Scope.
 */
export function flattenConfirmScopeVisibleRows(
  displayItems: ScopeChecklistItem[],
  ctx: ConfirmScopeVisibleRowsContext
): ScopeChecklistItem[] {
  const qmCtx = resolveConfirmScopeQmContext(ctx.measurements, ctx.templateKey, ctx.projectType);
  const ordered = flattenChecklistDisplayOrder(displayItems, ctx.templateKey);

  return ordered.filter((item) => {
    if (isScopeCardHiddenInQmEmbed(item.id, displayItems, ctx.measurements, qmCtx)) return false;

    if (ctx.forStep3Review) {
      if (item.id === 'wet_area_install') return false;
      if (!isConfirmScopeReviewRowSelected(item, displayItems, ctx.measurements)) return false;
      if (item.derivedFrom === 'wet_area_install') {
        const parent = displayItems.find((row) => row.id === 'wet_area_install');
        if (!parent || !checklistItemInScope(parent)) return false;
      }
    }

    return true;
  });
}

export function confirmScopeReviewRowsFromDraft(draft: EstimateAiDraft): ScopeChecklistItem[] {
  const displayItems = confirmScopeDisplayItemsFromDraft(draft);
  if (!displayItems.length) return [];
  return flattenConfirmScopeVisibleRows(displayItems, {
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
    measurements: (draft.scopeMeasurements || {}) as Record<string, unknown>,
    forStep3Review: true,
  });
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
    : draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
      ? confirmScopeDisplayItemsFromDraft(draft)
      : hydrateChecklistItemsForScopeReview(draft);
  if (!items.length) return base;

  const templateKey = draft.scopeChecklist?.templateKey;
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const orderedItems = flattenConfirmScopeVisibleRows(items, {
    templateKey,
    projectType: draft.projectType,
    measurements,
    forStep3Review: true,
  });
  if (!orderedItems.length) return base;

  const usedPackageIndices = new Set<number>();
  const result: EstimateDraftScopePackage[] = [];

  for (const item of orderedItems) {
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
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const checklistItems = confirmedItemsOverride?.length
    ? buildConfirmScopeDisplayItems(
        confirmedItemsOverride,
        measurements,
        draft.scopeChecklist?.templateKey
      )
    : confirmScopeDisplayItemsFromDraft(draft);
  if (!checklistItems.length) return draft;
  return {
    ...draft,
    scopePackages: reconcileScopePackagesForReview(draft, checklistItems),
  };
}
