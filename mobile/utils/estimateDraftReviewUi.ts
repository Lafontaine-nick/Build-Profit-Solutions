import { SCOPE_PARSED_FROM_NOTES_LABEL } from '@/constants/scopeNoteSourceLabels';

import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages, formatPlanningMoney } from '@/utils/estimateAiDraft';
import { draftHasApplyablePricing, formatDisplayUnit, proposalTotalForScopeName } from '@/utils/estimateAiDraftPricing';
import { displayPriceSourceLabel } from '@/utils/suggestedPricingCardUi';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  resolveScopePackageBudgetBreakdown,
  type BudgetSplitSource,
  type ItemBudgetBreakdown,
} from '@/utils/scopeBudgetBreakdown';
import {
  isPaintingAddonCoveredByAppliedSurfacePricing,
  resolveAppliedConfirmScopePackageAmount,
  resolveConfirmScopePackagePricingAcceptance,
  resolveNationalAverageScopePackageAmount,
} from '@/utils/appliedScopePackagePricing';
import type { ScopePricingAcceptanceMetadata } from '@/utils/acceptedPricingSummaryUi';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import {
  electricalDeviceReviewQuantityLabel,
  isPlanElectricalDeviceCard,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  notesNameWallAreaFramingWithFlooring,
  parseFramingMeasurementsFromNotes,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import { notesDescribeGroundUpHome } from '@/utils/scopeItemNoteHints';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import { flooringDemoStyleFromItemId } from '@/utils/qmScopePanels/flooringRemodel';

export type ScopePackageBudgetBreakdown = ItemBudgetBreakdown;
export type { BudgetSplitSource };

/** Material/labor breakdown for Step 3 scope rows — mirrors Step 2 Confirm Scope logic. */
export { resolveScopePackageBudgetBreakdown };

export function budgetSplitSourceLabel(source: BudgetSplitSource): string {
  if (source === 'notes') return SCOPE_PARSED_FROM_NOTES_LABEL;
  if (source === 'manual') return 'Manual';
  return 'National Average';
}

export function budgetSplitSourceColor(source: BudgetSplitSource): string {
  if (source === 'notes') return 'rgba(34, 197, 94, 0.85)';
  if (source === 'manual') return 'rgba(251, 191, 36, 0.85)';
  return 'rgba(148, 163, 184, 0.95)';
}

export function isScopeOnlyDraft(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  if (draftHasApplyablePricing(draft)) return false;
  if (draft.noPricingDetected) return true;
  if (draft.noteProfile?.primary === 'scope_only') return true;
  const pkgs = getScopePackages(draft);
  if (pkgs.length > 0 && pkgs.every((p) => p.status === 'missing_price')) return true;
  return false;
}

/** True when one or more scope packages still need pricing (show Add pricing actions). */
export function draftHasUnpricedScope(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  return getScopePackages(draft).some((p) => scopePackageNeedsManualPrice(p, draft));
}

/** Step 3 review — hide Finish pricing once Confirm Scope is done (pricing lives on scope rows + Ask AI). */
export function shouldShowStep3FinishPricingCard(
  draft: EstimateAiDraft | null | undefined,
  options?: { showUseSavedPricing?: boolean }
): boolean {
  if (!draft) return false;
  if (draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length) {
    return false;
  }
  return (
    draftHasUnpricedScope(draft) ||
    Boolean(options?.showUseSavedPricing && !draft.savedPricingApplySummary)
  );
}

export function isStep3ScopeConfirmed(
  draft: EstimateAiDraft | null | undefined
): boolean {
  return Boolean(draft?.scopeAssumptionsConfirmed || draft?.confirmedAssumptions?.length);
}

/** Step 3 — hide template-rate nudge after Confirm Scope (rates already applied on rows). */
export function shouldShowStep3TemplateRatesCard(
  draft: EstimateAiDraft | null | undefined,
  options: {
    roughSuggestionLineCount: number;
    hasRoughOnScope: boolean;
    pricingReady: boolean;
  }
): boolean {
  if (!draft || isStep3ScopeConfirmed(draft)) return false;
  if (options.pricingReady) return false;
  return options.roughSuggestionLineCount > 0 || options.hasRoughOnScope;
}

/**
 * Plan device counts are part of the bid once the contractor confirms them.
 * Show that fixture price on the review row even before a separate Apply tap.
 */
function planConfirmedElectricalDeviceAmount(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): number {
  const itemId = String(pkg.checklistItemId || pkg.costCode || '').trim();
  if (!isPlanElectricalDeviceCard(itemId)) return 0;
  const saved = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  if (!saved.planImportFingerprint || saved.planImportMode === 'selected_trade') return 0;
  const measurements = initialScopeMeasurementInputExtended(draft);
  const templateKey = draft.scopeChecklist?.templateKey;
  const notes = draft.originalNotes;
  const resolved = resolveChecklistItemQuantity(itemId, measurements, {
    templateKey,
    notes,
  });
  const suggested = resolveScopeItemSuggestedPricing(
    itemId,
    measurements,
    templateKey,
    resolved,
    undefined,
    null,
    notes
  );
  const total = Number(suggested.fill?.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** Effective priced amount for a scope row — includes Confirm Scope budget splits. */
export function scopePackagePricedAmount(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): number {
  const fromPkg = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0;
  const userProvided = Boolean(
    pkg.priceProvidedByUser ||
      pkg.status === 'user_provided' ||
      pkg.priceSource === 'user_provided'
  );
  const confirmedFromScope = Boolean(
    draft?.scopeAssumptionsConfirmed || draft?.confirmedAssumptions?.length
  );

  if (draft) {
    const applied = resolveAppliedConfirmScopePackageAmount(pkg, draft);

    if (confirmedFromScope) {
      if (userProvided && fromPkg > 0) {
        const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
        if (breakdown?.total && breakdown.total > 0) {
          if (Math.abs(fromPkg - breakdown.total) > 0.01) return fromPkg;
          return breakdown.total;
        }
        return fromPkg;
      }
      if (applied > 0) return applied;
      const planDevice = planConfirmedElectricalDeviceAmount(pkg, draft);
      if (planDevice > 0) return planDevice;
      // After Confirm Scope, Step 3 hero totals are applied-only — do not show
      // national-average planning $ on rows that were never Applied (keeps row sum = hero).
      return 0;
    }

    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
    if (breakdown?.total && breakdown.total > 0) {
      if (userProvided && fromPkg > 0 && Math.abs(fromPkg - breakdown.total) > 0.01) {
        return fromPkg;
      }
      return breakdown.total;
    }
  }

  if (fromPkg > 0) return fromPkg;
  if (draft) {
    const applied = resolveAppliedConfirmScopePackageAmount(pkg, draft);
    if (applied > 0) return applied;
    const nationalAverage = resolveNationalAverageScopePackageAmount(pkg, draft);
    if (nationalAverage > 0) return nationalAverage;
  }
  return proposalTotalForScopeName(draft?.pendingPricingProposal, pkg.name);
}

/** Scope found hero — include national-average planning $ before Confirm Scope when possible. */
export function scopePackageIndicativePricedAmount(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): number {
  const priced = scopePackagePricedAmount(pkg, draft);
  if (priced > 0) return priced;
  if (!draft) return 0;
  return resolveNationalAverageScopePackageAmount(pkg, draft, {
    allowPreConfirm: true,
  });
}

/** Sum of indicative scope row amounts for Scope found (pre-confirm planning totals). */
export function sumIndicativeScopePackageTotals(
  draft: EstimateAiDraft | null | undefined
): number {
  if (!draft) return 0;
  let total = 0;
  for (const pkg of getScopePackages(draft)) {
    const amount = scopePackageIndicativePricedAmount(pkg, draft);
    if (amount > 0) total += amount;
  }
  return Math.round(total * 100) / 100;
}

/** Scope row still needs a user-entered price (tap-to-price on review step 3). */
export function scopePackageNeedsManualPrice(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): boolean {
  if (scopePackagePricedAmount(pkg, draft) > 0) return false;
  // Cleared to $0 or never priced — allow add/edit again (except explicitly confirmed rows).
  if (pkg.status === 'confirmed') return false;
  const ruleKey =
    pkg.checklistItemId ||
    pkg.costCode ||
    lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
    null;
  if (ruleKey && draft && isPaintingAddonCoveredByAppliedSurfacePricing(ruleKey, draft)) {
    return false;
  }
  return true;
}

export function scopePackagePricingHint(pkg: EstimateDraftScopePackage): string {
  const n = pkg.name.toLowerCase();
  if (/tile/.test(n) && /install/.test(n) && !/demo/.test(n)) return 'needs material + install price';
  if (/tile|demo/.test(n)) return 'needs demo price';
  if (/laminate|flooring|lvp/.test(n) && !/baseboard/.test(n)) return 'needs material + labor price';
  if (/baseboard|trim/.test(n)) return 'needs material + labor price';
  return 'needs price';
}

const NOTE_BOUND_LANDSCAPE_QUANTITY_KEYS = new Set([
  'sod_turf',
  'artificial_turf',
  'pavers',
  'rock',
  'mulch',
]);

function draftIsGroundUpHome(draft?: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  const template = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  return (
    template === 'ground_up' ||
    template === 'new_build' ||
    notesDescribeGroundUpHome(draft.originalNotes)
  );
}

/**
 * Whole-house package allowances. A stored takeoff above one unit still shows
 * that quantity. A 1 sqft / 1 each placeholder, living area copied onto
 * flatwork, or the interior-door count copied onto finish carpentry does not.
 */
function groundUpPlaceholderAllowance(
  draft: EstimateAiDraft | null | undefined,
  ruleKey: string,
  displayedQuantity: number | null,
  displayedUnit?: string | null
): string | null {
  if (!draftIsGroundUpHome(draft)) return null;
  const measurements = (draft?.scopeMeasurements || {}) as Record<string, unknown>;
  const unit = String(displayedUnit || '').toLowerCase();
  const qty = displayedQuantity ?? 1;
  if (ruleKey === 'pour_flatwork') {
    const concrete = Number(String(measurements.concreteSqft ?? '').replace(/,/g, ''));
    if (Number.isFinite(concrete) && concrete > 1) {
      return `${concrete.toLocaleString()} sqft`;
    }
    const living = Number(String(measurements.floorAreaSqft ?? '').replace(/,/g, ''));
    if (qty <= 1 || (living > 1 && Math.abs(qty - living) < 0.01)) return 'Allowance';
    return null;
  }
  if (ruleKey === 'interior_trim') {
    const trimLf = Number(
      String(measurements.interiorTrimLf ?? measurements.trimLf ?? '').replace(/,/g, '')
    );
    if (Number.isFinite(trimLf) && trimLf > 1 && unit !== 'each') {
      return `${trimLf.toLocaleString()} lf`;
    }
    const doors = Number(String(measurements.interiorDoorCount ?? '').replace(/,/g, ''));
    const copiedDoorCount =
      doors > 0 &&
      Math.abs(qty - doors) < 0.01 &&
      unit !== 'lf' &&
      unit !== 'lin ft';
    if (qty <= 1 || copiedDoorCount) return 'Allowance';
    return null;
  }
  if (
    ruleKey === 'stucco' ||
    ruleKey === 'drywall' ||
    ruleKey === 'plumbing_rough' ||
    ruleKey === 'hvac'
  ) {
    if (ruleKey === 'drywall') {
      const area = Number(String(measurements.drywallSqft ?? '').replace(/,/g, ''));
      if (Number.isFinite(area) && area > 1) {
        return `${area.toLocaleString()} sqft`;
      }
    }
    if (qty <= 1) return 'Allowance';
    return null;
  }
  if (
    ruleKey !== 'shower_tile' &&
    ruleKey !== 'glass_door' &&
    ruleKey !== 'interior_paint' &&
    ruleKey !== 'exterior_paint'
  ) {
    return null;
  }
  if (ruleKey === 'interior_paint' || ruleKey === 'exterior_paint') {
    const areaKey = ruleKey === 'interior_paint' ? 'wallPaintSqft' : 'exteriorPaintSqft';
    const area = Number(String(measurements[areaKey] ?? '').replace(/,/g, ''));
    if (Number.isFinite(area) && area > 1) {
      return `${area.toLocaleString()} sqft`;
    }
    if ((displayedQuantity ?? 1) <= 1) return 'Allowance';
    return null;
  }
  if (ruleKey === 'shower_tile') {
    const wall = Number(String(measurements.showerWallTileSqft ?? '').replace(/,/g, ''));
    if (Number.isFinite(wall) && wall > 1) {
      return `${wall.toLocaleString()} sqft`;
    }
    if ((displayedQuantity ?? 1) <= 1) return 'Allowance';
    return null;
  }
  const raw = measurements.showerDoorCount;
  const doors = Number(String(raw ?? '').replace(/,/g, ''));
  if (raw != null && String(raw).trim() !== '' && Number.isFinite(doors) && doors > 0) {
    return `${doors.toLocaleString()} each`;
  }
  if ((displayedQuantity ?? 1) <= 1) return 'Allowance';
  return null;
}

const REVIEW_COUNT_EACH_KEYS: Record<string, string> = {
  window_install: 'windowCount',
  windows: 'windowCount',
  windows_doors: 'windowCount',
  window_replacement: 'windowCount',
  window_installation: 'windowCount',
  interior_door_install: 'interiorDoorCount',
  interior_doors: 'interiorDoorCount',
  exterior_doors: 'exteriorDoorCount',
  exterior_door_install: 'exteriorDoorCount',
  sliding_doors: 'slidingDoorCount',
  sliding_door_install: 'slidingDoorCount',
};

/**
 * Wall-area framing is priced per linear foot (sqft ÷ 8). Review draft keeps
 * the note quantity, "400 sqft", instead of replacing it with the 50 LF basis.
 */
function reviewWallAreaFramingQuantity(
  draft: EstimateAiDraft | null | undefined,
  ruleKey: string,
  pkg: EstimateDraftScopePackage,
  stored?: { quantity: number; unit: string } | null
): string | null {
  if (!draft || !notesNameWallAreaFramingWithFlooring(draft.originalNotes)) return null;
  const isWall =
    ruleKey === 'wall_framing' || /wall framing/i.test(String(pkg.name || ''));
  if (!isWall) return null;
  if (stored && !/^(?:lf|lin(?:ear)?\s*f(?:ee)?t)$/i.test(String(stored.unit || ''))) {
    return null;
  }
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const fromMeasurement = Number(
    String(measurements.wallFramingSqft ?? '').replace(/,/g, '')
  );
  const sqft =
    Number.isFinite(fromMeasurement) && fromMeasurement > 0
      ? fromMeasurement
      : parseFramingMeasurementsFromNotes(String(draft.originalNotes || '')).wallFramingSqft;
  if (!sqft || sqft <= 0) return null;
  return `${sqft.toLocaleString()} ${formatDisplayUnit('sqft')}`;
}

/** Step 2 prices these by count. A leftover sqft on the package is not that count. */
function reviewCountEachQuantity(
  draft: EstimateAiDraft | null | undefined,
  ruleKey: string,
  stored?: { quantity: number; unit: string } | null
): string | null {
  const measurementKey = REVIEW_COUNT_EACH_KEYS[ruleKey];
  if (!draft || !measurementKey) return null;
  if (stored && /^(?:each|ea)$/i.test(String(stored.unit || ''))) return null;
  const raw = (draft.scopeMeasurements as Record<string, unknown> | undefined)?.[
    measurementKey
  ];
  const count = Number(String(raw ?? '').replace(/,/g, ''));
  if (!Number.isFinite(count) || count <= 0) return null;
  return `${count.toLocaleString()} each`;
}

function positiveReviewSqft(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Painting review rows were keeping the wall sqft on masking and ceiling paint.
 * Each line shows the area that line was priced on.
 */
function paintingReviewQuantity(
  draft: EstimateAiDraft,
  pkg: EstimateDraftScopePackage,
  ruleKey: string
): string | null {
  const template = String(draft.scopeChecklist?.templateKey || '').toLowerCase();
  if (template !== 'painting') return null;
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const wall = positiveReviewSqft(measurements.wallPaintSqft);
  const ceiling = positiveReviewSqft(measurements.ceilingPaintSqft);
  const combined =
    positiveReviewSqft(measurements.combinedPaintableAreaSqft) ||
    positiveReviewSqft(measurements.paintAreaSqft);
  const separate =
    measurements.paintPricingMethod === 'separate' ||
    (measurements.paintPricingMethod !== 'combined' && wall > 0 && ceiling > 0);
  const name = String(pkg.name || '');
  const ceilingLine =
    ruleKey === 'ceiling_paint' || /^ceiling\s+paint(?:ing)?$/i.test(name);
  const prepLine =
    ruleKey === 'prep' ||
    /masking/i.test(name) ||
    /\bprep\b/i.test(name);
  const wallLine =
    !ceilingLine &&
    !prepLine &&
    (ruleKey === 'interior_paint' ||
      ruleKey === 'paint' ||
      /interior\s+paint/i.test(name));
  const area = ceilingLine
    ? ceiling
    : prepLine
      ? separate
        ? wall + ceiling
        : combined || wall || ceiling
      : wallLine
        ? separate
          ? wall
          : combined || wall
        : 0;
  if (!(area > 0)) return null;
  return `${area.toLocaleString()} sqft`;
}

export function formatScopeQuantity(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): string | null {
  const q = pkg.scopeQuantities?.[0];
  const previewRuleKey = draft
    ? pkg.checklistItemId ||
      pkg.costCode ||
      lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
      ''
    : '';
  const demoStyle = flooringDemoStyleFromItemId(previewRuleKey);
  if (demoStyle && draft) {
    const entered = Number(
      String(
        (
          draft.scopeMeasurements?.itemQuantities as
            | Record<string, { quantity?: unknown }>
            | undefined
        )?.[`floor_demo__${demoStyle}`]?.quantity ?? ''
      ).replace(/,/g, '')
    );
    if (Number.isFinite(entered) && entered > 0) {
      return `${entered.toLocaleString()} sqft`;
    }
  }
  if (draft) {
    const painted = paintingReviewQuantity(draft, pkg, previewRuleKey);
    if (painted) return painted;
    const electrical = electricalDeviceReviewQuantityLabel(
      previewRuleKey,
      pkg.name,
      (draft.scopeMeasurements || {}) as Record<string, unknown>
    );
    if (electrical) return electrical;
  }
  if (
    draft &&
    (previewRuleKey === 'shower_tile' ||
      previewRuleKey === 'glass_door' ||
      previewRuleKey === 'interior_paint' ||
      previewRuleKey === 'exterior_paint' ||
      previewRuleKey === 'stucco' ||
      previewRuleKey === 'drywall' ||
      previewRuleKey === 'plumbing_rough' ||
      previewRuleKey === 'hvac' ||
      previewRuleKey === 'pour_flatwork' ||
      previewRuleKey === 'interior_trim')
  ) {
    const allowance = groundUpPlaceholderAllowance(
      draft,
      previewRuleKey,
      q?.quantity ?? null,
      q?.unit
    );
    if (allowance) return allowance;
  }
  // Sod, mulch, rock, and pavers only show a quantity the note attached to
  // that material. A shared sentence must not copy sod sqft onto mulch.
  if (
    draft &&
    NOTE_BOUND_LANDSCAPE_QUANTITY_KEYS.has(previewRuleKey)
  ) {
    const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
    const bound =
      previewRuleKey === 'sod_turf'
        ? measurements.sodSqft
        : previewRuleKey === 'artificial_turf'
          ? measurements.artificialTurfSqft
          : previewRuleKey === 'pavers'
            ? measurements.paverSqft
            : measurements.landscapeTons ?? measurements.rockMulchSqft;
    const boundValue = Number(String(bound ?? '').replace(/,/g, ''));
    if (Number.isFinite(boundValue) && boundValue > 0) {
      const unit =
        previewRuleKey !== 'sod_turf' &&
        previewRuleKey !== 'artificial_turf' &&
        previewRuleKey !== 'pavers' &&
        measurements.landscapeTons
          ? 'ton'
          : 'sqft';
      return `${boundValue.toLocaleString()} ${formatDisplayUnit(unit)}`;
    }
    return null;
  }
  if (!q && draft) {
    const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
    const itemQuantities =
      measurements.itemQuantities &&
      typeof measurements.itemQuantities === 'object' &&
      !Array.isArray(measurements.itemQuantities)
        ? (measurements.itemQuantities as Record<string, { quantity?: unknown }>)
        : {};
    const ruleKey =
      pkg.checklistItemId ||
      pkg.costCode ||
      lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '') ||
      '';
    const measurementByRule: Record<string, { value?: unknown; unit: string }> = {
      roofing: { value: measurements.roofSquares, unit: 'squares' },
      shingles_roofing: { value: measurements.roofSquares, unit: 'squares' },
      tear_off: { value: measurements.roofSquares, unit: 'squares' },
      decking_repair: { value: measurements.roofDeckingReplacementSqft, unit: 'sqft' },
      window_install: { value: measurements.windowCount, unit: 'each' },
      windows: { value: measurements.windowCount, unit: 'each' },
      windows_doors: { value: measurements.windowCount, unit: 'each' },
      window_replacement: { value: measurements.windowCount, unit: 'each' },
      window_installation: { value: measurements.windowCount, unit: 'each' },
      exterior_doors: { value: measurements.exteriorDoorCount, unit: 'each' },
      drywall: { value: measurements.drywallSqft, unit: 'sqft' },
      patch_repair: { value: measurements.drywallSqft, unit: 'sqft' },
      ceiling_paint: { value: measurements.ceilingPaintSqft, unit: 'sqft' },
      gutters: { value: measurements.roofGutterLf, unit: 'lf' },
      downspouts: { value: measurements.roofDownspoutCount, unit: 'each' },
      demo_clearing: { value: measurements.demoClearingSqft, unit: 'sqft' },
      grading: { value: measurements.gradingSqft, unit: 'sqft' },
      soil_prep: { value: measurements.soilPrepSqft, unit: 'sqft' },
      drainage: { value: measurements.drainageLf, unit: 'lf' },
      sod_turf: { value: measurements.sodSqft, unit: 'sqft' },
      artificial_turf: { value: measurements.artificialTurfSqft, unit: 'sqft' },
      pavers: { value: measurements.paverSqft, unit: 'sqft' },
      rock: {
        value: measurements.landscapeTons ?? measurements.rockMulchSqft,
        unit: measurements.landscapeTons ? 'ton' : 'sqft',
      },
      mulch: {
        value: measurements.landscapeTons ?? measurements.rockMulchSqft,
        unit: measurements.landscapeTons ? 'ton' : 'sqft',
      },
      plants: { value: measurements.plantCount, unit: 'each' },
      trees: { value: measurements.treeCount, unit: 'each' },
      irrigation: { value: measurements.irrigationZoneCount, unit: 'zone' },
      landscape_lighting: {
        value: measurements.landscapeLightCount,
        unit: 'each',
      },
      concrete_edging: { value: measurements.concreteEdgingLf, unit: 'lf' },
      concrete: { value: measurements.concreteSqft, unit: 'sqft' },
      pour_flatwork: { value: measurements.concreteSqft, unit: 'sqft' },
      insulation: {
        value: measurements.atticInsulationSqft,
        unit: 'sqft',
      },
    };
    const resolved = measurementByRule[ruleKey];
    const itemQuantity =
      itemQuantities[ruleKey]?.quantity ??
      (['windows', 'windows_doors', 'window_replacement', 'window_installation'].includes(ruleKey)
        ? itemQuantities.window_install?.quantity
        : undefined);
    const value = Number(String(resolved?.value ?? itemQuantity ?? '').replace(/,/g, ''));
    if (resolved && Number.isFinite(value) && value > 0) {
      return `${value.toLocaleString()} ${formatDisplayUnit(resolved.unit)}`;
    }
    if (ruleKey === 'insulation' && measurements.insulationRValue) {
      return String(measurements.insulationRValue);
    }
  }
  const wallAreaSqft = reviewWallAreaFramingQuantity(draft, previewRuleKey, pkg, q);
  if (wallAreaSqft) return wallAreaSqft;
  const countedEach = reviewCountEachQuantity(draft, previewRuleKey, q);
  if (countedEach) return countedEach;
  if (!q) return null;
  // Trade dollar lumps are not soft-cost allowances — show "lump sum" on Step 3.
  const unit =
    q.unit === 'allowance' && draft && !isSoftCostScopePackage(pkg, draft) ? 'lump_sum' : q.unit;
  return `${q.quantity.toLocaleString()} ${formatDisplayUnit(unit)}`;
}

export function getStillNeededList(draft: EstimateAiDraft): string[] {
  if (draft.stillNeededReview?.length) return draft.stillNeededReview;
  const items: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      items.push(s);
    }
  };
  for (const pkg of getScopePackages(draft)) {
    if (pkg.status === 'missing_price') {
      const hint = scopePackagePricingHint(pkg);
      if (hint.includes('demo')) add(`Pricing for ${pkg.name} (demo)`);
      else if (hint.includes('material')) add(`Pricing for ${pkg.name} (material + labor)`);
      else add(`Pricing for ${pkg.name}`);
    }
  }
  if (!draft.customerName) add('Customer name');
  if (!draft.projectAddress) add('Project address');
  for (const m of draft.missingInfo || []) {
    if (/payment/i.test(m)) add('Payment terms');
    if (/permit/i.test(m)) add('Permit responsibility');
  }
  return items;
}

function canonicalStillNeededKey(item: string): string {
  const k = item.trim().toLowerCase();
  if (/customer name/.test(k)) return 'customer-name';
  if (/customer phone|phone/.test(k)) return 'customer-phone';
  if (/payment/.test(k)) return 'payment-terms';
  if (/project address|address missing/.test(k)) return 'project-address';
  if (/permit/.test(k)) return 'permit-responsibility';
  if (/start date/.test(k)) return 'start-date';
  return k;
}

function shouldHideStillNeededItem(draft: EstimateAiDraft, item: string): boolean {
  const calculatedTotal =
    draft.totalValidation?.calculatedLineItemsTotal ?? draft.calculatedLineItemTotal ?? draft.calculatedTotal;
  if (calculatedTotal != null && calculatedTotal > 0 && /no overall bid total was found/i.test(item)) {
    return true;
  }
  if (/labor vs material breakdown per room|suggest material.*labor split|combined prices\)/i.test(item)) {
    return true;
  }
  if (/demo \/ removal|flooring labor and materials/i.test(item)) {
    return true;
  }
  if (!draftHasUnpricedScope(draft) && /need pricing|pricing for|finish pricing on partial scope/i.test(item)) {
    return true;
  }
  return false;
}

function normalizeStillNeededItems(draft: EstimateAiDraft, items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const text = item.trim();
    if (!text || shouldHideStillNeededItem(draft, text)) continue;
    const key = canonicalStillNeededKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function dedupeDraftWarnings(draft: EstimateAiDraft): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...(draft.pricingWarnings || []), ...(draft.warnings || [])]) {
    const key = String(w).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(w).trim());
  }
  return out;
}

const STATUS_SHORT: Record<string, string> = {
  confirmed: 'Confirmed',
  user_provided: SCOPE_PARSED_FROM_NOTES_LABEL,
  rough_price: 'Rough',
  partial_pricing: 'Partial',
  calculated: 'Calculated',
  ai_suggested: 'AI split',
  needs_review: 'Review',
  missing_price: 'Needs price',
};

function paintingAddonRuleKey(pkg: EstimateDraftScopePackage): string | null {
  const direct = String(pkg.checklistItemId || pkg.costCode || '').trim();
  if (direct) return direct;
  return lookupRuleKeyForPackage(pkg.name || '', pkg.scope || '');
}

/**
 * Right-hand label for a review row that has no dollar amount.
 * A separate masking card stays "Add price" until that card is applied.
 */
export function scopePackageReviewUnpricedLabel(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): string {
  const ruleKey = paintingAddonRuleKey(pkg);
  if (
    ruleKey &&
    draft &&
    isPaintingAddonCoveredByAppliedSurfacePricing(ruleKey, draft)
  ) {
    return 'Included';
  }
  if (scopePackageNeedsManualPrice(pkg, draft)) return 'Add price';
  return compactPackageStatusLabel(pkg, draft);
}

export function compactPackageStatusLabel(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): string {
  const pendingTotal = proposalTotalForScopeName(draft?.pendingPricingProposal, pkg.name);
  if (pendingTotal > 0 && (pkg.status === 'missing_price' || !pkg.status)) {
    const src = draft?.pendingPricingProposal?.primarySource || draft?.pendingPricingProposal?.source;
    if (src === 'saved_template') return 'Saved template';
    if (src === 'saved_pricing') return 'Saved pricing';
    return 'Matched rate';
  }
  return STATUS_SHORT[pkg.status || ''] || 'Review';
}

function pricingAcceptanceSourceLabel(
  acceptance: ScopePricingAcceptanceMetadata
): string {
  if (acceptance.selectionStatus === 'accepted') return 'Selected';
  if (acceptance.selectionStatus === 'manual_adjusted') return 'User adjusted';
  if (acceptance.selectionStatus === 'user_entered') return 'User entered';
  const label = String(acceptance.pricingSourceLabel || '').trim();
  if (label) return label;
  if (acceptance.pricingSourceKind === 'national_average') return 'National average';
  if (acceptance.pricingSourceKind === 'saved_rate') {
    return displayPriceSourceLabel(acceptance.pricingSourceLabel) || 'Saved pricing';
  }
  if (acceptance.pricingSourceKind === 'local_benchmark') return 'Local benchmark';
  return 'Selected';
}

/** Pricing provenance for Step 3 scope rows (mirrors Step 2 Applied card status). */
export function compactPackagePricingSourceLabel(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): string | null {
  if (!draft) return null;
  const acceptance = resolveConfirmScopePackagePricingAcceptance(pkg, draft);
  if (acceptance) return pricingAcceptanceSourceLabel(acceptance);
  if (
    pkg.priceProvidedByUser ||
    pkg.status === 'user_provided' ||
    pkg.priceSource === 'user_provided'
  ) {
    return 'User entered';
  }
  if (pkg.status === 'confirmed') return 'Confirmed';
  if (pkg.status === 'rough_price') return 'Rough estimate';
  return null;
}

export function compactPackagePricingSourceColor(
  label: string,
  darkMode: boolean,
  subColor: string
): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'user entered' || normalized === 'user adjusted') {
    return darkMode ? '#4ade80' : '#22c55e';
  }
  if (normalized === 'applied' || normalized === 'selected' || normalized === 'bps national benchmark') {
    return darkMode ? 'rgba(255,255,255,0.62)' : subColor;
  }
  return darkMode ? 'rgba(255,255,255,0.62)' : subColor;
}

export function pendingProposalCalculatedTotal(draft: EstimateAiDraft | null | undefined): number {
  const p = draft?.pendingPricingProposal;
  if (!p || p.empty) return 0;
  if ((p.totalSuggested || 0) > 0) return p.totalSuggested;
  return (p.lines || []).reduce((sum, line) => sum + (line.total || 0), 0);
}

export function compactPackageAmount(
  pkg: EstimateDraftScopePackage,
  draft?: EstimateAiDraft | null
): string | null {
  const amount = scopePackagePricedAmount(pkg, draft);
  if (amount > 0) return formatPlanningMoney(amount);
  return null;
}

/** Live sum of what Step 3 rows display — preferred over stale calculatedLineItemTotal. */
export function sumLiveScopePackageTotals(draft: EstimateAiDraft | null | undefined): number {
  if (!draft) return 0;
  let total = 0;
  for (const pkg of getScopePackages(draft)) {
    const amount = scopePackagePricedAmount(pkg, draft);
    if (amount > 0) total += amount;
  }
  return Math.round(total * 100) / 100;
}

export function getCompactProjectSummary(draft: EstimateAiDraft): string {
  const parts: string[] = [];
  const formatLabel = (raw: string) => {
    const text = raw.trim();
    if (!text) return '';
    if (/^adu$/i.test(text)) return 'ADU';
    if (/_/.test(text)) {
      return text
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    // Preserve intentional casing for titles; only fix all-lowercase labels.
    if (text === text.toLowerCase() && text.length <= 24) {
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return text;
  };
  if (draft.projectTitle?.trim()) parts.push(formatLabel(draft.projectTitle));
  else if (draft.projectType && draft.projectType !== 'other') {
    parts.push(formatLabel(draft.projectType));
  }
  if (draft.customerName?.trim()) parts.push(draft.customerName.trim());
  const pkgs = getScopePackages(draft);
  if (pkgs.length > 0) parts.push(`${pkgs.length} scope item${pkgs.length === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'Draft from your notes';
}

export function getCompactStillNeeded(draft: EstimateAiDraft, max = 5): { items: string[]; overflow: number } {
  const scopeConfirmed = Boolean(
    draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
  );

  if (scopeConfirmed) {
    const merged: string[] = [];
    const seen = new Set<string>();
    const add = (s: string) => {
      const k = s.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      merged.push(s.trim());
    };

    for (const pkg of getScopePackagesForReview(draft)) {
      if (!scopePackageNeedsManualPrice(pkg, draft)) continue;
      const name = String(pkg.name || pkg.scope || 'Scope item').trim();
      add(`Pricing for ${name}`);
    }

    const grouped = groupGenericMissingScopeItems(normalizeStillNeededItems(draft, merged));
    return { items: grouped.slice(0, max), overflow: Math.max(0, grouped.length - max) };
  }

  const raw =
    draft.stillNeededReview?.length ? draft.stillNeededReview : getStillNeededList(draft);
  const needsReview = draft.needsReviewItems?.length ? draft.needsReviewItems : draft.missingInfo || [];
  const merged: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    merged.push(s.trim());
  };
  for (const s of raw) add(s);
  for (const s of needsReview) {
    if (/partial pricing for/i.test(s)) continue;
    if (/:\s*partial pricing/i.test(s)) continue;
    add(s);
  }
  if (!merged.length && !scopeConfirmed) {
    for (const pkg of getScopePackagesForReview(draft)) {
      if (!scopePackageNeedsManualPrice(pkg, draft)) continue;
      const name = String(pkg.name || pkg.scope || 'Scope item').trim();
      add(`Pricing for ${name}`);
    }
  }
  const grouped = groupGenericMissingScopeItems(normalizeStillNeededItems(draft, merged));
  return { items: grouped.slice(0, max), overflow: Math.max(0, grouped.length - max) };
}

export function summarizeWhatAiDidForDisplay(lines: string[], max = 4): string[] {
  const cleaned = lines
    .map((line) => String(line).replace(/\bjob job\b/gi, 'job').trim())
    .filter(Boolean);
  if (cleaned.length <= max) return cleaned;
  const preserved = cleaned.filter((l) => /preserved your total/i.test(l));
  const partial = cleaned.filter((l) => /partial pricing for/i.test(l));
  const rest = cleaned.filter(
    (l) => !/preserved your total/i.test(l) && !/partial pricing for/i.test(l)
  );
  const out = [...rest];
  if (preserved.length >= 2) {
    out.push(`Preserved ${preserved.length} room totals from your notes (unchanged).`);
  } else {
    out.push(...preserved);
  }
  if (partial.length >= 2) {
    out.push(`${partial.length} areas have partial pricing — finish missing items before bidding.`);
  } else {
    out.push(...partial);
  }
  return out.slice(0, max);
}

export function compactNeedsReviewForDisplay(items: string[], max = 6): { items: string[]; overflow: number } {
  const filtered = items.filter(
    (s) =>
      !/^[^:]+:\s*partial pricing/i.test(s) &&
      !/^[^:]+:\s*user-provided total/i.test(s) &&
      !/package\(s\) have partial pricing/i.test(s)
  );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of filtered) {
    const k = s.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(s.trim());
  }
  const grouped = groupGenericMissingScopeItems(unique);
  return { items: grouped.slice(0, max), overflow: Math.max(0, grouped.length - max) };
}

const GENERIC_SCOPE_MISSING = [
  'demo / removal',
  'plumbing reconnect / hookup',
  'glass / shower door',
  'painting labor and materials',
  'flooring labor and materials',
  'sink and faucet (supply + install)',
  'haul-off / disposal',
  'concrete labor / finish / pump',
  'deck / patio labor and materials',
];

export function groupGenericMissingScopeItems(items: string[]): string[] {
  const genericHits: string[] = [];
  const rest: string[] = [];
  for (const item of items) {
    const k = item.trim().toLowerCase();
    if (GENERIC_SCOPE_MISSING.includes(k)) genericHits.push(item);
    else rest.push(item);
  }
  if (genericHits.length >= 3) {
    return [...rest, 'Finish pricing on partial scope (demo, plumbing, paint, flooring, etc.)'];
  }
  return items;
}

const EXCEEDS_KNOWN_RE =
  /^(.+?):\s*user total \$[\d,]+ exceeds itemized known \$[\d,]+(?:\s*—\s*confirm line items)?\.?$/i;

export function summarizePricingWarnings(warnings: string[]): string[] {
  if (warnings.length === 0) return [];
  const exceededRooms: string[] = [];
  const other: string[] = [];
  for (const w of warnings) {
    const text = String(w).trim();
    if (/line items match stated total/i.test(text)) continue;
    const m = text.match(EXCEEDS_KNOWN_RE);
    if (m) exceededRooms.push(m[1].trim());
    else other.push(text);
  }
  const out: string[] = [];
  if (exceededRooms.length >= 2) {
    out.push(
      `${exceededRooms.length} rooms: note total is higher than itemized prices — confirm totals or finish line-item pricing.`
    );
  } else if (exceededRooms.length === 1) {
    out.push(
      warnings.find((w) => EXCEEDS_KNOWN_RE.test(String(w))) ||
        `${exceededRooms[0]}: note total exceeds itemized prices — confirm line items.`
    );
  }
  const partialLine = other.find((w) => /partial pricing|scope package/i.test(w));
  if (partialLine) out.push(partialLine.replace(/\d+ scope package/, (n) => n));
  for (const w of other) {
    if (w === partialLine) continue;
    if (/lump-sum package/i.test(w) && /suggest material.*labor split/i.test(w)) continue;
    if (/combined labor \+ materials total/i.test(w) && /suggest material.*labor split/i.test(w)) continue;
    if (out.length >= 4) break;
    if (!out.some((x) => x.toLowerCase() === w.toLowerCase())) out.push(w);
  }
  return out.slice(0, 4);
}

export function dedupeMissingPriceSuggestions(
  suggestions: Array<{ missingItem?: string; scopeItemName?: string; suggestedUnitRate?: number; unitType?: string }>,
  max = 4
): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const s of suggestions) {
    const label = (s.missingItem || s.scopeItemName || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const rate =
      s.suggestedUnitRate != null ? `: $${s.suggestedUnitRate}/${s.unitType || 'unit'}` : '';
    lines.push(`${label}${rate}`);
    if (lines.length >= max) break;
  }
  return lines;
}

export const SCOPE_LIST_DEFAULT_LIMIT = 6;

export function shouldHidePerRowStatus(packages: EstimateDraftScopePackage[]): boolean {
  if (packages.length === 0) return false;
  const statuses = new Set(packages.map((p) => p.status));
  if (statuses.size !== 1) return false;
  const only = packages[0].status;
  return only === 'partial_pricing' || only === 'user_provided' || only === 'confirmed';
}

export function getUniformStatusLabel(packages: EstimateDraftScopePackage[]): string | null {
  if (!shouldHidePerRowStatus(packages)) return null;
  const status = packages[0].status;
  if (status === 'partial_pricing') return 'Partial pricing on all items';
  // Confirm Scope / Suggested Pricing also mark packages user_provided — not "from notes".
  if (status === 'user_provided' || status === 'confirmed') return 'All items have prices';
  return null;
}
