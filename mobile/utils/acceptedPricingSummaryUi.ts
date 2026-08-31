import {
  countNeedsSeparatePricing,
  countUnresolvedScopeDecisions,
  countUnresolvedScopeGaps,
  formatNeedsSeparatePricingLabel,
  getReviewableScopeComponents,
  type ScopeGapPricingContext,
  type ScopeGapResolutionsMap,
} from '@/utils/scopeReviewUi';
import type { ScopeItemIntelligence } from '@/utils/scopeIntelligence';
import { buildConciseBenchmarkScopeWarning } from '@/utils/benchmarkScopeAssumptions';
import type { AssemblyComponentStatus, ScopeGapNotice } from '@/utils/scopeAssemblyRegistry';
import type { ResolvedItemQuantity, ScopeItemQuantityValue, SuggestedPricingBlock } from '@/utils/scopeItemQuantities';
import { displayPriceSourceLabel } from '@/utils/suggestedPricingCardUi';
import {
  allowanceSplitSubKey,
  clearSuggestedPrefillPricing,
  formatUnitLabel,
  getChecklistItemQuantityRuleOrDefault,
  hasCompleteUserSelectedPricing,
  hasOnlySuggestedPrefillPricing,
  isPlaceholderAllowancePricing,
  roughAllowanceSubKey,
  shouldSuppressSuggestedPricingAfterApply,
  usesAllowanceSplitEditor,
  type ScopeItemQuantityRule,
} from '@/utils/scopeItemQuantities';
import { formatDraftMoney, formatPlanningMoney } from '@/utils/estimateAiDraft';

/** User-facing confidence badges on Confirm Scope applied-pricing cards. */
export const PRICING_CONFIDENCE_LABEL = {
  HIGH: 'High confidence',
  REVIEW_BEFORE_BID: 'Review before bid',
  PLANNING_ESTIMATE: 'Planning estimate',
  ASSUMPTIONS_TO_REVIEW: 'Assumptions to review',
} as const;

export type PricingConfidenceLabel =
  | (typeof PRICING_CONFIDENCE_LABEL)[keyof typeof PRICING_CONFIDENCE_LABEL]
  | null;

export type ScopePricingAcceptanceMetadata = {
  selectionStatus: 'accepted' | 'user_entered' | 'manual_adjusted';
  pricingSourceLabel: string;
  pricingSourceKind:
    | 'national_average'
    | 'local_benchmark'
    | 'saved_rate'
    | 'parsed_from_notes'
    | 'user_entered'
    | 'allowance'
    | 'unknown';
  pricingTypeLabel: string;
  geographicBasis?: string;
  originalSuggestionLabel?: string;
  originalPricingSourceLabel?: string;
  rateSourceLabel?: string;
  lumpSumOnly?: boolean;
  materialAmount?: number;
  laborAmount?: number;
  allowanceAmount?: number;
  subcontractorAmount?: number;
  totalAmount: number;
  benchmarkProvenance?: import('@/utils/benchmarkEngine').BenchmarkProvenance;
};

export type PricingSecondaryActionKind =
  | 'view_calculation'
  | 'view_breakdown'
  | 'compare_sources'
  | 'view_original_suggestion'
  | 'review_missing_scope'
  | 'needs_separate_pricing';

export type PricingSecondaryAction = {
  kind: PricingSecondaryActionKind;
  label: string;
  unresolvedScopeGapCount?: number;
};

export type PricingSecondaryDisclosure =
  | {
      kind: 'rows';
      heading: string;
      rows: PricingDetailRow[];
    }
  | {
      kind: 'scope_review';
      heading: string;
      components: AssemblyComponentStatus[];
    };

export type AcceptedPricingDisplay = {
  totalLabel: string;
  selectionStatusLabel: string;
  pricingSourceLabel: string;
  pricingTypeLabel: string;
  subtitleLine: string | null;
  geographicBasis: string;
  confidenceLabel: PricingConfidenceLabel;
  confidenceShortLabel: 'High' | 'Review' | 'Planning' | 'Assumptions' | null;
  showConfidenceBadge: boolean;
  warningMessage: string | null;
  acceptance: ScopePricingAcceptanceMetadata;
  pricingModel: AcceptedPricingModel;
};

export type AcceptedPricingModel =
  | 'flat_allowance'
  | 'lump_sum'
  | 'unit_pricing'
  | 'material_labor_split'
  | 'manual';

export type PricingDetailRow = {
  label: string;
  value: string;
};

const PROJECT_WIDE_SCOPE_KEYS = new Set([
  'utility_coordination',
  'exterior_finish',
  'cleanup',
  'temporary_utilities',
  'plans_engineering',
  'engineering',
  'meter_fees',
]);

const GEOGRAPHIC_CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'unknown']);

export function pricingSourceLabelFromBlock(block: SuggestedPricingBlock): string {
  if (block.materialSource === 'local_benchmark' || block.laborSource === 'local_benchmark') {
    return 'Local benchmark';
  }
  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  if (usesTemplate) {
    return displayPriceSourceLabel(block.rateSourceLabel);
  }
  if (block.materialSource === 'notes' || block.laborSource === 'notes') return 'From notes';
  if (block.rateSourceLabel.includes('National') || /builder-budget/i.test(block.rateSourceLabel)) {
    return 'National planning rate';
  }
  return 'National planning rate';
}

export function pricingSourceKindFromBlock(block: SuggestedPricingBlock): ScopePricingAcceptanceMetadata['pricingSourceKind'] {
  if (block.materialSource === 'local_benchmark' || block.laborSource === 'local_benchmark') return 'local_benchmark';
  if (block.materialSource === 'template' || block.laborSource === 'template') return 'saved_rate';
  if (block.materialSource === 'notes' || block.laborSource === 'notes') return 'parsed_from_notes';
  return 'national_average';
}

export function geographicBasisFromSourceKind(
  kind: ScopePricingAcceptanceMetadata['pricingSourceKind'],
  intelligence?: ScopeItemIntelligence
): string {
  if (kind === 'national_average') return 'National';
  if (kind === 'local_benchmark') return 'Southern Utah';
  if (kind === 'parsed_from_notes') return 'Not applicable';
  if (kind === 'user_entered') return 'Not applicable';
  if (kind === 'saved_rate') {
    const market = intelligence?.pricingCompleteness?.regionalRelevance?.dimensions.regionalMatch;
    if (market && !GEOGRAPHIC_CONFIDENCE_VALUES.has(market)) return titleCase(market.replace(/_/g, ' '));
    return 'Unknown';
  }
  return 'Unknown';
}

export function pricingTypeLabelFromContext(params: {
  lumpSumOnly?: boolean;
  hasMaterial?: boolean;
  hasLabor?: boolean;
  unit?: string;
}): string {
  if (params.lumpSumOnly) return 'Flat allowance';
  if (params.unit === 'lump_sum') return 'Lump sum';
  if (params.hasMaterial && params.hasLabor) return 'Material + labor';
  if (params.hasLabor) return 'Labor';
  if (params.hasMaterial) return 'Material';
  if (params.unit === 'allowance') return 'Flat allowance';
  return 'Unit pricing';
}

export function inferPricingModel(
  acceptance: ScopePricingAcceptanceMetadata,
  resolved: ResolvedItemQuantity
): AcceptedPricingModel {
  if (acceptance.lumpSumOnly || acceptance.pricingTypeLabel === 'Flat allowance') return 'flat_allowance';
  if (acceptance.pricingTypeLabel === 'Lump sum' || resolved.unit === 'lump_sum') return 'lump_sum';
  if (
    acceptance.materialAmount != null &&
    acceptance.laborAmount != null &&
    acceptance.materialAmount > 0 &&
    acceptance.laborAmount > 0
  ) {
    return 'material_labor_split';
  }
  if (resolved.dualMaterial && resolved.dualLabor) return 'material_labor_split';
  if (resolved.dualCount && !['allowance', 'lump_sum'].includes(resolved.dualCount.unit)) return 'unit_pricing';
  if (resolved.unit && !['allowance', 'lump_sum'].includes(resolved.unit) && hasMeaningfulPhysicalQuantity(resolved)) {
    return 'unit_pricing';
  }
  if (acceptance.selectionStatus === 'manual_adjusted' || acceptance.pricingSourceKind === 'user_entered') {
    return 'manual';
  }
  return acceptance.lumpSumOnly ? 'flat_allowance' : 'manual';
}

export function buildAcceptanceFromSuggestedBlock(block: SuggestedPricingBlock): ScopePricingAcceptanceMetadata {
  const pricingSourceKind = pricingSourceKindFromBlock(block);
  const pricingSourceLabel = pricingSourceLabelFromBlock(block);
  return {
    selectionStatus: 'accepted',
    pricingSourceLabel,
    pricingSourceKind,
    pricingTypeLabel: pricingTypeLabelFromContext({
      lumpSumOnly: block.lumpSumOnly,
      hasMaterial: block.material > 0,
      hasLabor: block.labor > 0,
    }),
    geographicBasis: geographicBasisFromSourceKind(pricingSourceKind),
    originalSuggestionLabel: block.rateSourceLabel,
    originalPricingSourceLabel: pricingSourceLabel,
    rateSourceLabel: block.rateSourceLabel,
    lumpSumOnly: block.lumpSumOnly,
    materialAmount: block.material > 0 ? block.material : undefined,
    laborAmount: block.labor > 0 ? block.labor : undefined,
    totalAmount: block.total,
    benchmarkProvenance: block.benchmarkProvenance,
  };
}

/** Applied Confirm Scope card for manually added custom scope lines. */
export function buildAcceptanceFromCustomScopePricing(params: {
  material: number;
  labor: number;
  total: number;
  lumpSumOnly?: boolean;
}): ScopePricingAcceptanceMetadata {
  return {
    selectionStatus: 'accepted',
    pricingSourceLabel: 'User entered',
    pricingSourceKind: 'user_entered',
    pricingTypeLabel: pricingTypeLabelFromContext({
      lumpSumOnly: params.lumpSumOnly ?? false,
      hasMaterial: params.material > 0,
      hasLabor: params.labor > 0,
    }),
    geographicBasis: geographicBasisFromSourceKind('user_entered'),
    originalPricingSourceLabel: 'User entered',
    rateSourceLabel: 'User entered',
    lumpSumOnly: params.lumpSumOnly ?? false,
    materialAmount: params.material > 0 ? params.material : undefined,
    laborAmount: params.labor > 0 ? params.labor : undefined,
    totalAmount: params.total,
  };
}

function hasMeaningfulPhysicalQuantity(resolved: ResolvedItemQuantity): boolean {
  const unit = String(resolved.unit || '').toLowerCase();
  if (unit === 'allowance' || unit === 'lump_sum') return false;
  const qty = Number(resolved.dualCount?.quantity ?? resolved.quantity ?? 0);
  return qty > 0 && qty < 100000;
}

/** Drop primary count/allowance on item id when it only existed for cleared pricing. */
export function shouldClearPrimaryItemQuantityOnPricingReset(
  itemId: string,
  direct: ScopeItemQuantityValue | undefined,
  rule: ScopeItemQuantityRule
): boolean {
  if (!direct?.quantity || !(Number(direct.quantity) > 0)) return false;
  const unit = String(direct.unit || '').toLowerCase();
  if (['allowance', 'lump_sum'].includes(unit)) return true;
  if (isPlaceholderAllowancePricing(Number(direct.quantity), unit, itemId)) return true;

  const defaultUnit = String(rule.defaultUnit || '').toLowerCase();
  const hasIndependentTakeoff =
    Boolean(rule.measurementKey) ||
    Boolean(rule.measurementKeys?.length) ||
    Boolean(rule.aggregateMeasurementKeys?.length);

  if (defaultUnit && unit !== defaultUnit) return true;

  // Keep an explicit takeoff count on the correct physical unit (e.g. 2 each).
  if (
    (direct.quantitySource === 'user_entered' || direct.quantitySource === 'manual_override') &&
    defaultUnit &&
    unit === defaultUnit
  ) {
    return false;
  }

  return (
    !hasIndependentTakeoff &&
    usesAllowanceSplitEditor(rule) &&
    !rule.dualAllowanceField
  );
}

/** Move editor takeoff basis onto the primary item id so the collapsed card can show it. */
export function promoteEditorTakeoffBasisToPrimaryItem(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityValue>
): Record<string, ScopeItemQuantityValue> {
  const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
  const basis = itemQuantities[basisKey];
  if (!basis) return itemQuantities;
  const qty = parsePricingAmount(basis.quantity);
  if (qty == null) return itemQuantities;
  const unit = String(basis.unit || '').toLowerCase();
  if (['allowance', 'lump_sum'].includes(unit)) return itemQuantities;
  const source = basis.quantitySource;
  if (source !== 'user_entered' && source !== 'manual_override') return itemQuantities;

  const rule = getChecklistItemQuantityRuleOrDefault(itemId);
  return {
    ...itemQuantities,
    [itemId]: {
      quantity: String(qty),
      unit: basis.unit || rule.defaultUnit,
      quantitySource: source,
    },
  };
}

/**
 * Clear an applied Suggest / national / Edit price so the original Apply card returns.
 * Keeps physical takeoff counts (CY, SF, each) on the item id when present.
 */
export function clearAcceptedScopeItemPricing(params: {
  itemId: string;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
}): {
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
} {
  const itemId = params.itemId;
  const itemQuantities = { ...params.itemQuantities };
  const pricingAcceptance = { ...(params.pricingAcceptance || {}) };
  delete pricingAcceptance[itemId];
  for (const key of [
    `${itemId}__material`,
    `${itemId}__labor`,
    allowanceSplitSubKey(itemId, 'allowance'),
    allowanceSplitSubKey(itemId, 'sqft_basis'),
    roughAllowanceSubKey(itemId),
  ]) {
    delete itemQuantities[key];
  }
  const primaryEntry = itemQuantities[itemId];
  const primaryUnit = String(primaryEntry?.unit || '').toLowerCase();
  if (primaryUnit === 'allowance' || primaryUnit === 'lump_sum') {
    // Legacy flat pricing can live on the primary item key. Always remove it
    // during Change pricing; otherwise the accepted amount survives the reset.
    delete itemQuantities[itemId];
  } else {
    const liveMoney = liveScopeMoneyFromQuantities(itemId, itemQuantities);
    if (!(liveMoney != null && liveMoney > 0)) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId);
      if (shouldClearPrimaryItemQuantityOnPricingReset(itemId, primaryEntry, rule)) {
        delete itemQuantities[itemId];
      }
    }
  }
  return { itemQuantities, pricingAcceptance };
}

/** Live dollars from quantity fields only — ignores sticky pricingAcceptance. */
export function liveScopeMoneyFromQuantities(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }>
): number | null {
  const parseQty = (entry?: { quantity?: string | number | null }) => {
    const n = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const materialEntry = itemQuantities[allowanceSplitSubKey(itemId, 'material')];
  const laborEntry = itemQuantities[allowanceSplitSubKey(itemId, 'labor')];
  const material = parseQty(materialEntry) || 0;
  const labor = parseQty(laborEntry) || 0;
  if (material + labor > 0) return material + labor;

  // Split editor wiped Material + Labor but left __allowance at the last typed
  // digit (e.g. $2). Do not treat that orphan total as live pricing.
  const splitLegsPresent = Boolean(materialEntry || laborEntry);
  const splitLegsEmpty = !(material > 0) && !(labor > 0);
  if (splitLegsPresent && splitLegsEmpty) {
    return null;
  }

  const allowance = parseQty(itemQuantities[allowanceSplitSubKey(itemId, 'allowance')]);
  if (allowance != null) return allowance;
  const rough = parseQty(itemQuantities[roughAllowanceSubKey(itemId)]);
  if (rough != null) return rough;
  const direct = itemQuantities[itemId];
  const unit = String(direct?.unit || '').toLowerCase();
  if (['allowance', 'lump_sum'].includes(unit)) return parseQty(direct);
  return null;
}

export function hasAcceptedScopePricing(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }>,
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>
): boolean {
  if (hasCompleteUserSelectedPricing(itemQuantities as Record<string, ScopeItemQuantityValue>, itemId)) return true;

  // Single source of truth: orphan __allowance after wiped Material/Labor does not count.
  const live = liveScopeMoneyFromQuantities(itemId, itemQuantities);
  if (!(live != null && live > 0)) return false;

  const moneyEntries = [
    itemQuantities[allowanceSplitSubKey(itemId, 'material')],
    itemQuantities[allowanceSplitSubKey(itemId, 'labor')],
    itemQuantities[allowanceSplitSubKey(itemId, 'allowance')],
    itemQuantities[roughAllowanceSubKey(itemId)],
  ];
  if (
    moneyEntries.some(
      (entry) =>
        entry?.quantitySource === 'user_entered' &&
        Number(String(entry.quantity ?? '').replace(/,/g, '')) > 0
    )
  ) {
    return true;
  }

  const direct = itemQuantities[itemId];
  const directUnit = String(direct?.unit || '').toLowerCase();
  if (
    direct?.quantitySource === 'user_entered' &&
    ['allowance', 'lump_sum'].includes(directUnit) &&
    Number(String(direct.quantity ?? '').replace(/,/g, '')) > 0
  ) {
    return true;
  }

  // Applied suggestion: live dollars present and acceptance recorded.
  return Boolean(pricingAcceptance?.[itemId]);
}

/** Dollar total for display/acceptance — never treat physical takeoff (sqft/lf/…) as money. */
export function resolveAcceptedMoneyTotal(params: {
  resolved: ResolvedItemQuantity;
  acceptance?: ScopePricingAcceptanceMetadata | null;
}): number {
  // Live editor quantities win over stale acceptance (e.g. deleted 2000→2 left in totalAmount
  // while Labor still holds 2000, or fields wiped empty while acceptance still says $2).
  const liveMaterial = Number(params.resolved.dualMaterial?.quantity ?? 0) || 0;
  const liveLabor = Number(params.resolved.dualLabor?.quantity ?? 0) || 0;
  const liveSplit = liveMaterial + liveLabor > 0 ? liveMaterial + liveLabor : null;
  if (liveSplit != null) return liveSplit;

  const dualAllowance = Number(params.resolved.dualAllowance?.quantity);
  if (Number.isFinite(dualAllowance) && dualAllowance > 0) return dualAllowance;

  const acceptedMaterial = Number(params.acceptance?.materialAmount ?? 0) || 0;
  const acceptedLabor = Number(params.acceptance?.laborAmount ?? 0) || 0;
  if (acceptedMaterial + acceptedLabor > 0) return acceptedMaterial + acceptedLabor;

  const unit = String(params.resolved.unit || '').toLowerCase();
  if ((unit === 'allowance' || unit === 'lump_sum') && params.resolved.quantity != null) {
    const qty = Number(params.resolved.quantity);
    if (Number.isFinite(qty) && qty > 0) return qty;
  }

  const accepted = Number(params.acceptance?.totalAmount);
  if (Number.isFinite(accepted) && accepted > 0) return accepted;

  return 0;
}

/**
 * After a material/labor/allowance/basis edit, the acceptance total must be money —
 * never the raw value of a sqft/lf basis field.
 */
export function moneyTotalAfterQuantityEdit(
  baseItemId: string,
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity?: string | number | null }>,
  editedItemId: string,
  editedQuantity: string
): number | null {
  const materialKey = allowanceSplitSubKey(baseItemId, 'material');
  const laborKey = allowanceSplitSubKey(baseItemId, 'labor');
  const allowanceKey = allowanceSplitSubKey(baseItemId, 'allowance');
  const roughKey = roughAllowanceSubKey(baseItemId);
  const read = (key: string) => {
    if (key === editedItemId) return parsePricingAmount(editedQuantity);
    return parsePricingAmount(itemQuantities[key]?.quantity);
  };

  if (editedItemId.endsWith('__sqft_basis')) {
    const split = (read(materialKey) || 0) + (read(laborKey) || 0);
    if (split > 0) return split;
    return read(allowanceKey) ?? read(roughKey);
  }

  const material = read(materialKey) || 0;
  const labor = read(laborKey) || 0;
  if (material + labor > 0) return material + labor;

  if (
    editedItemId === allowanceKey ||
    editedItemId === roughKey ||
    editedItemId.endsWith('__allowance')
  ) {
    return parsePricingAmount(editedQuantity);
  }

  // Editing Material/Labor to empty must not resurrect a stale __allowance total
  // (classic path: delete $2000 → $2 left in __allowance while Labor is blank).
  if (editedItemId === materialKey || editedItemId === laborKey) {
    return null;
  }

  return read(allowanceKey) ?? read(roughKey);
}

export function resolveAcceptedPricingDisplay(params: {
  itemId: string;
  resolved: ResolvedItemQuantity;
  acceptance?: ScopePricingAcceptanceMetadata | null;
  suggestedBlock?: SuggestedPricingBlock | null;
  intelligence: ScopeItemIntelligence;
}): AcceptedPricingDisplay {
  const total = resolveAcceptedMoneyTotal({
    resolved: params.resolved,
    acceptance: params.acceptance,
  });
  const inferredFromSuggestion =
    !params.acceptance &&
    params.suggestedBlock &&
    Math.abs(Number(params.suggestedBlock.total) - Number(total)) < 0.01
      ? buildAcceptanceFromSuggestedBlock(params.suggestedBlock)
      : null;
  const acceptance = normalizeAcceptanceMetadata(
    params.acceptance || inferredFromSuggestion || buildFallbackAcceptance(params.resolved, total),
    params.suggestedBlock,
    params.intelligence
  );
  const confidenceLabel = resolveAcceptedConfidenceLabel(params.intelligence, acceptance);
  const pricingModel = inferPricingModel(acceptance, params.resolved);
  const showConfidenceBadge = shouldShowConfidenceBadge(acceptance);

  return {
    totalLabel: formatPlanningMoney(total),
    selectionStatusLabel: selectionStatusLabel(acceptance, params.resolved),
    pricingSourceLabel: acceptance.pricingSourceLabel,
    pricingTypeLabel: acceptance.pricingTypeLabel,
    subtitleLine: acceptedPricingSubtitleLine({
      display: {
        pricingModel,
        totalLabel: formatPlanningMoney(total),
        acceptance,
      },
      resolved: params.resolved,
      suggestedBlock: params.suggestedBlock,
    }),
    geographicBasis: acceptance.geographicBasis || geographicBasisFromSourceKind(acceptance.pricingSourceKind, params.intelligence),
    confidenceLabel: showConfidenceBadge ? confidenceLabel : null,
    confidenceShortLabel: showConfidenceBadge ? confidenceShortLabel(confidenceLabel) : null,
    showConfidenceBadge,
    warningMessage: getPricingSourceMessage(params.intelligence, acceptance),
    acceptance,
    pricingModel,
  };
}

function resolveAcceptedConfidenceLabel(
  intelligence: ScopeItemIntelligence,
  acceptance: ScopePricingAcceptanceMetadata
): NonNullable<AcceptedPricingDisplay['confidenceLabel']> {
  if ((intelligence.unresolvedAssumptionCount ?? 0) > 0) {
    return PRICING_CONFIDENCE_LABEL.ASSUMPTIONS_TO_REVIEW;
  }
  return confidenceBadgeLabel(intelligence, acceptance);
}

function normalizeAcceptanceMetadata(
  acceptance: ScopePricingAcceptanceMetadata,
  suggestedBlock: SuggestedPricingBlock | null | undefined,
  intelligence: ScopeItemIntelligence
): ScopePricingAcceptanceMetadata {
  if (
    acceptance.selectionStatus !== 'accepted' &&
    acceptance.selectionStatus !== 'manual_adjusted' &&
    acceptance.pricingSourceKind === 'user_entered' &&
    suggestedBlock &&
    Math.abs(Number(suggestedBlock.total) - Number(acceptance.totalAmount)) < 0.01
  ) {
    return buildAcceptanceFromSuggestedBlock(suggestedBlock);
  }
  if (acceptance.selectionStatus === 'manual_adjusted' && !acceptance.originalPricingSourceLabel && suggestedBlock) {
    return {
      ...acceptance,
      originalPricingSourceLabel: pricingSourceLabelFromBlock(suggestedBlock),
      originalSuggestionLabel: acceptance.originalSuggestionLabel || suggestedBlock.rateSourceLabel,
    };
  }
  return {
    ...acceptance,
    geographicBasis:
      acceptance.geographicBasis && !GEOGRAPHIC_CONFIDENCE_VALUES.has(acceptance.geographicBasis.toLowerCase())
        ? acceptance.geographicBasis
        : geographicBasisFromSourceKind(acceptance.pricingSourceKind, intelligence),
  };
}

function selectionStatusLabel(
  acceptance: ScopePricingAcceptanceMetadata,
  resolved: ResolvedItemQuantity
): string {
  if (acceptance.selectionStatus === 'accepted') return 'Selected';
  if (acceptance.selectionStatus === 'manual_adjusted') return 'User adjusted';
  if (resolved.quantitySource === 'notes') return 'From notes';
  if (acceptance.selectionStatus === 'user_entered') return 'User entered';
  return 'User entered';
}

function buildFallbackAcceptance(resolved: ResolvedItemQuantity, total: number): ScopePricingAcceptanceMetadata {
  const fromNotes = resolved.quantitySource === 'notes';
  const kind = fromNotes ? 'parsed_from_notes' : 'user_entered';
  return {
    selectionStatus: 'user_entered',
    pricingSourceLabel: fromNotes ? 'From notes' : 'User entered',
    pricingSourceKind: kind,
    pricingTypeLabel: pricingTypeLabelFromContext({
      lumpSumOnly: resolved.unit === 'allowance' || resolved.unit === 'lump_sum',
      hasMaterial: Boolean(resolved.dualMaterial),
      hasLabor: Boolean(resolved.dualLabor),
      unit: resolved.unit,
    }),
    geographicBasis: geographicBasisFromSourceKind(kind),
    totalAmount: total,
  };
}

export function shouldShowConfidenceBadge(acceptance: ScopePricingAcceptanceMetadata): boolean {
  if (acceptance.selectionStatus === 'user_entered' && acceptance.pricingSourceKind === 'user_entered') {
    return false;
  }
  return true;
}

export function acceptedPricingSubtitleLine(params: {
  display: { pricingModel: AcceptedPricingModel; totalLabel: string; acceptance: ScopePricingAcceptanceMetadata };
  resolved: ResolvedItemQuantity;
  suggestedBlock?: SuggestedPricingBlock | null;
}): string | null {
  const { display, resolved, suggestedBlock } = params;
  if (display.pricingModel === 'unit_pricing') {
    return buildUnitPricingSubtitleLine(resolved, suggestedBlock, display.acceptance.totalAmount);
  }
  if (display.pricingModel === 'material_labor_split') {
    return buildMaterialLaborSummaryLine(display.acceptance, resolved);
  }
  return null;
}

function buildUnitPricingSubtitleLine(
  resolved: ResolvedItemQuantity,
  suggestedBlock: SuggestedPricingBlock | null | undefined,
  totalAmount: number
): string | null {
  const qty = resolved.dualCount?.quantity ?? (hasMeaningfulPhysicalQuantity(resolved) ? resolved.quantity : null);
  const unit = resolved.dualCount?.unit ?? resolved.unit;
  if (qty == null || !unit || ['allowance', 'lump_sum'].includes(unit)) return null;
  const unitLabel = formatUnitLabel(unit);
  const combinedRate = totalAmount / Number(qty);
  if (!Number.isFinite(combinedRate) || combinedRate <= 0) return null;
  return `${Number(qty).toLocaleString()} ${unitLabel} × $${combinedRate.toFixed(2)}/${unitLabel}`;
}

function buildMaterialLaborSummaryLine(
  acceptance: ScopePricingAcceptanceMetadata,
  resolved: ResolvedItemQuantity
): string | null {
  const parts: string[] = [];
  const material = acceptance.materialAmount ?? resolved.dualMaterial?.quantity;
  const labor = acceptance.laborAmount ?? resolved.dualLabor?.quantity;
  const allowance = acceptance.allowanceAmount;
  const subcontractor = acceptance.subcontractorAmount;
  if (material != null && material > 0) parts.push(`Material ${formatPlanningMoney(material)}`);
  if (labor != null && labor > 0) parts.push(`Labor ${formatPlanningMoney(labor)}`);
  if (allowance != null && allowance > 0) parts.push(`Allowance ${formatPlanningMoney(allowance)}`);
  if (subcontractor != null && subcontractor > 0) {
    parts.push(`Subcontractor ${formatPlanningMoney(subcontractor)}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

export function getPricingSecondaryAction(params: {
  display: AcceptedPricingDisplay;
  intelligence: ScopeItemIntelligence;
  resolved: ResolvedItemQuantity;
  suggestedBlock?: SuggestedPricingBlock | null;
  comparisonBlock?: SuggestedPricingBlock | null;
  scopeKey: string;
  originalNotes?: string | null;
  scopeGapResolutions?: ScopeGapResolutionsMap;
  scopeGapPricingContext?: ScopeGapPricingContext;
}): PricingSecondaryAction | null {
  const reviewable = getReviewableScopeComponents(
    params.intelligence.assembly?.unknownComponents,
    params.scopeKey,
    params.originalNotes,
    params.suggestedBlock?.benchmarkScopeProfile
  );
  const pricingContext = params.scopeGapPricingContext;
  const unresolvedDecisionCount = countUnresolvedScopeDecisions(
    params.scopeKey,
    reviewable,
    params.scopeGapResolutions
  );
  if (unresolvedDecisionCount > 0) {
    return {
      kind: 'review_missing_scope',
      label: 'Review assumptions',
      unresolvedScopeGapCount: unresolvedDecisionCount,
    };
  }

  const needsPricingCount = countNeedsSeparatePricing(
    params.scopeKey,
    reviewable,
    params.scopeGapResolutions,
    pricingContext
  );
  if (needsPricingCount > 0) {
    return {
      kind: 'needs_separate_pricing',
      label: formatNeedsSeparatePricingLabel(needsPricingCount),
      unresolvedScopeGapCount: needsPricingCount,
    };
  }

  const fullyUnresolvedCount = countUnresolvedScopeGaps(
    params.scopeKey,
    reviewable,
    params.scopeGapResolutions,
    pricingContext
  );
  if (fullyUnresolvedCount > 0) {
    return {
      kind: 'review_missing_scope',
      label: 'Review assumptions',
      unresolvedScopeGapCount: fullyUnresolvedCount,
    };
  }

  const { acceptance, pricingModel } = params.display;
  if (
    acceptance.selectionStatus === 'manual_adjusted' &&
    (acceptance.originalPricingSourceLabel || acceptance.originalSuggestionLabel) &&
    (
      (params.suggestedBlock &&
        Math.abs(params.suggestedBlock.total - acceptance.totalAmount) >= 0.01) ||
      Boolean(acceptance.originalPricingSourceLabel)
    )
  ) {
    return { kind: 'view_original_suggestion', label: 'View original suggestion' };
  }

  if (hasMultiplePricingSources(params.suggestedBlock, params.comparisonBlock, acceptance)) {
    return { kind: 'compare_sources', label: 'Compare benchmarks' };
  }

  if (pricingModel === 'unit_pricing' && hasUnitPricingCalculation(params.resolved, params.suggestedBlock, params.intelligence)) {
    return { kind: 'view_calculation', label: 'View calculation' };
  }

  // Material/labor is already shown inline on Applied cards — no separate "View breakdown".
  return null;
}

function hasUnitPricingCalculation(
  resolved: ResolvedItemQuantity,
  suggestedBlock: SuggestedPricingBlock | null | undefined,
  intelligence: ScopeItemIntelligence
): boolean {
  const qty = resolved.dualCount?.quantity ?? (hasMeaningfulPhysicalQuantity(resolved) ? resolved.quantity : null);
  const unit = resolved.dualCount?.unit ?? resolved.unit;
  if (qty != null && unit && !['allowance', 'lump_sum'].includes(unit)) return true;
  if (intelligence.formula?.formulaExplanation) return true;
  if (suggestedBlock?.basis?.quantity) return true;
  return false;
}

function hasMaterialLaborBreakdown(
  acceptance: ScopePricingAcceptanceMetadata,
  resolved: ResolvedItemQuantity
): boolean {
  const material = acceptance.materialAmount ?? resolved.dualMaterial?.quantity;
  const labor = acceptance.laborAmount ?? resolved.dualLabor?.quantity;
  return material != null && labor != null && material > 0 && labor > 0;
}

function hasMultiplePricingSources(
  suggestedBlock: SuggestedPricingBlock | null | undefined,
  comparisonBlock: SuggestedPricingBlock | null | undefined,
  acceptance: ScopePricingAcceptanceMetadata
): boolean {
  if (!comparisonBlock) return false;
  const selectedLabel = acceptance.pricingSourceLabel;
  const comparisonLabel = pricingSourceLabelFromBlock(comparisonBlock);
  if (comparisonLabel === selectedLabel && Math.abs(comparisonBlock.total - acceptance.totalAmount) < 0.01) {
    return false;
  }
  if (suggestedBlock && suggestedBlock !== comparisonBlock) {
    const fillLabel = pricingSourceLabelFromBlock(suggestedBlock);
    if (fillLabel !== comparisonLabel) return true;
  }
  return comparisonBlock.total > 0;
}

export function buildSecondaryDisclosureContent(params: {
  action: PricingSecondaryAction;
  display: AcceptedPricingDisplay;
  intelligence: ScopeItemIntelligence;
  resolved: ResolvedItemQuantity;
  suggestedBlock?: SuggestedPricingBlock | null;
  comparisonBlock?: SuggestedPricingBlock | null;
  scopeKey: string;
}): PricingSecondaryDisclosure | null {
  const { action, display, intelligence, resolved, suggestedBlock, comparisonBlock } = params;
  const rows: PricingDetailRow[] = [];
  const push = (label: string, value?: string | number | null) => {
    const text = value == null ? '' : String(value).trim();
    if (text) rows.push({ label, value: text });
  };

  switch (action.kind) {
    case 'view_calculation': {
      const qty = resolved.dualCount?.quantity ?? (hasMeaningfulPhysicalQuantity(resolved) ? resolved.quantity : null);
      const unit = resolved.dualCount?.unit ?? resolved.unit;
      if (qty != null && unit) {
        push('Quantity', qty.toLocaleString());
        push('Unit', formatUnitLabel(unit));
      }
      if (suggestedBlock && suggestedBlock.basis?.quantity && qty) {
        const materialRate = suggestedBlock.material > 0 ? suggestedBlock.material / qty : null;
        const laborRate = suggestedBlock.labor > 0 ? suggestedBlock.labor / qty : null;
        if (materialRate != null && materialRate > 0) {
          push('Material rate', `$${materialRate.toFixed(2)}/${formatUnitLabel(unit || '')}`);
        }
        if (laborRate != null && laborRate > 0) {
          push('Labor rate', `$${laborRate.toFixed(2)}/${formatUnitLabel(unit || '')}`);
        }
        const combinedRate = display.acceptance.totalAmount / Number(qty);
        if (Number.isFinite(combinedRate) && combinedRate > 0) {
          push('Combined rate', `$${combinedRate.toFixed(2)}/${formatUnitLabel(unit || '')}`);
        }
      }
      if (intelligence.formula?.formulaExplanation) {
        push('Formula', intelligence.formula.formulaExplanation);
      }
      push('Total', display.totalLabel);
      if (!rows.length) return null;
      return { kind: 'rows', heading: 'Calculation', rows };
    }
    case 'view_breakdown': {
      const { acceptance } = display;
      const material = acceptance.materialAmount ?? resolved.dualMaterial?.quantity;
      const labor = acceptance.laborAmount ?? resolved.dualLabor?.quantity;
      if (material != null && material > 0) push('Material amount', formatDraftMoney(material));
      if (labor != null && labor > 0) push('Labor amount', formatDraftMoney(labor));
      push('Total', display.totalLabel);
      if (rows.length <= 1) return null;
      return { kind: 'rows', heading: 'Breakdown', rows };
    }
    case 'compare_sources': {
      push('Selected source', display.pricingSourceLabel);
      if (suggestedBlock) {
        push(pricingSourceLabelFromBlock(suggestedBlock), `$${suggestedBlock.total.toLocaleString()}`);
      }
      if (comparisonBlock) {
        push(pricingSourceLabelFromBlock(comparisonBlock), `$${comparisonBlock.total.toLocaleString()}`);
      }
      if (rows.length <= 1) return null;
      return { kind: 'rows', heading: 'Source comparison', rows };
    }
    case 'view_original_suggestion': {
      const { acceptance } = display;
      push('Current amount', display.totalLabel);
      if (acceptance.originalPricingSourceLabel) {
        push('Original source', acceptance.originalPricingSourceLabel);
      }
      if (suggestedBlock && Math.abs(suggestedBlock.total - acceptance.totalAmount) >= 0.01) {
        push('Original suggested amount', `$${suggestedBlock.total.toLocaleString()}`);
        const diff = acceptance.totalAmount - suggestedBlock.total;
        const pct = suggestedBlock.total > 0 ? ((diff / suggestedBlock.total) * 100).toFixed(1) : null;
        push('Difference', `${diff >= 0 ? '+' : ''}$${Math.abs(diff).toLocaleString()}${pct ? ` (${pct}%)` : ''}`);
      } else if (acceptance.originalSuggestionLabel) {
        push('Original suggestion', acceptance.originalSuggestionLabel);
      }
      if (rows.length <= 1) return null;
      return { kind: 'rows', heading: 'Original suggestion', rows };
    }
    case 'review_missing_scope':
      return null;
    default:
      return null;
  }
}

export function confidenceBadgeLabel(
  intelligence: ScopeItemIntelligence,
  acceptance?: ScopePricingAcceptanceMetadata
): Exclude<PricingConfidenceLabel, null> {
  if (acceptance?.pricingSourceKind === 'national_average') {
    return mapConfidence(intelligence.pricing.confidence);
  }
  if (acceptance?.pricingSourceKind === 'parsed_from_notes') {
    return mapConfidence(intelligence.pricing.confidence === 'missing' ? 'medium' : intelligence.pricing.confidence);
  }
  if (acceptance?.selectionStatus === 'manual_adjusted' || acceptance?.pricingSourceKind === 'user_entered') {
    return PRICING_CONFIDENCE_LABEL.HIGH;
  }
  if (acceptance?.pricingSourceKind === 'saved_rate') {
    return mapConfidence(intelligence.pricing.confidence === 'missing' ? 'medium' : intelligence.pricing.confidence);
  }
  return mapConfidence(intelligence.pricing.confidence);
}

function mapConfidence(
  value: string
): typeof PRICING_CONFIDENCE_LABEL.HIGH | typeof PRICING_CONFIDENCE_LABEL.REVIEW_BEFORE_BID | typeof PRICING_CONFIDENCE_LABEL.PLANNING_ESTIMATE {
  if (value === 'high') return PRICING_CONFIDENCE_LABEL.HIGH;
  if (value === 'medium') return PRICING_CONFIDENCE_LABEL.REVIEW_BEFORE_BID;
  return PRICING_CONFIDENCE_LABEL.PLANNING_ESTIMATE;
}

export function confidenceShortLabel(
  label: AcceptedPricingDisplay['confidenceLabel']
): 'High' | 'Review' | 'Planning' | 'Assumptions' {
  if (label === PRICING_CONFIDENCE_LABEL.ASSUMPTIONS_TO_REVIEW) return 'Assumptions';
  if (label === PRICING_CONFIDENCE_LABEL.HIGH) return 'High';
  if (label === PRICING_CONFIDENCE_LABEL.REVIEW_BEFORE_BID) return 'Review';
  return 'Planning';
}

type SourceMessageKey =
  | 'national_average'
  | 'regional_average'
  | 'local_market'
  | 'saved_company'
  | 'historical_company'
  | 'supplier'
  | 'subcontractor'
  | 'imported_price_book'
  | 'ai_estimate';

const SOURCE_MESSAGE_COPY: Record<SourceMessageKey, string> = {
  national_average: 'Based on national average pricing. Review before sending the estimate.',
  regional_average: 'Based on regional average pricing. Confirm local rates before sending.',
  local_market: 'Based on local market pricing.',
  saved_company: 'Based on your saved company pricing.',
  historical_company: "Based on your company's historical pricing. Review if this rate is no longer current.",
  supplier: 'Based on supplier pricing. Confirm current availability and rate before sending.',
  subcontractor: 'Based on a subcontractor quote. Confirm the quote is still valid before sending.',
  imported_price_book: 'Based on your imported price book.',
  ai_estimate: 'AI-estimated pricing. Review before sending the estimate.',
};

function resolveSourceMessageKey(
  acceptance: ScopePricingAcceptanceMetadata,
  intelligence: ScopeItemIntelligence
): SourceMessageKey | null {
  const label = acceptance.pricingSourceLabel.toLowerCase();
  const rateLabel = (acceptance.rateSourceLabel || acceptance.originalSuggestionLabel || '').toLowerCase();
  const geo = (acceptance.geographicBasis || '').toLowerCase();
  const pricingSource = intelligence.pricing.source;

  if (acceptance.pricingSourceKind === 'national_average' || label.includes('national average')) {
    return 'national_average';
  }
  if (
    label.includes('regional average') ||
    label.includes('regional pricing') ||
    label.includes('regional benchmark') ||
    /^(regional|metro|state)$/.test(geo)
  ) {
    return 'regional_average';
  }
  if (
    pricingSource === 'local_average' ||
    label.includes('local market') ||
    label.includes('local average') ||
    geo === 'local market' ||
    geo === 'zip code'
  ) {
    return 'local_market';
  }
  if (label.includes('historical') || rateLabel.includes('historical')) {
    return 'historical_company';
  }
  if (label.includes('supplier') || rateLabel.includes('supplier')) {
    return 'supplier';
  }
  if (label.includes('subcontractor') || rateLabel.includes('subcontractor')) {
    return 'subcontractor';
  }
  if (label.includes('imported price book') || label.includes('price book')) {
    return 'imported_price_book';
  }
  if (
    label.includes('ai-estimated') ||
    label.includes('ai estimate') ||
    label.includes('ai fallback') ||
    rateLabel.includes('ai ')
  ) {
    return 'ai_estimate';
  }
  if (
    acceptance.pricingSourceKind === 'saved_rate' ||
    pricingSource === 'saved_rate' ||
    pricingSource === 'company_rate' ||
    label.includes('saved company')
  ) {
    return 'saved_company';
  }
  return null;
}

function isStalePricing(intelligence: ScopeItemIntelligence): boolean {
  const status = intelligence.pricingCompleteness?.dateRelevance?.status;
  return status === 'stale' || status === 'expired';
}

function validationIssueMessage(intelligence: ScopeItemIntelligence): string | null {
  const issue = intelligence.validation.issues.find(
    (i) =>
      (i.severity === 'warning' || i.severity === 'blocking') &&
      i.ruleKey !== 'scope_possible_overlap'
  );
  return issue?.message || null;
}

function shouldShowSourceMessage(
  key: SourceMessageKey,
  intelligence: ScopeItemIntelligence,
  acceptance: ScopePricingAcceptanceMetadata
): boolean {
  if (key === 'national_average' || key === 'regional_average' || key === 'ai_estimate') {
    return true;
  }
  if (key === 'historical_company') return true;
  if (key === 'supplier' || key === 'subcontractor') return true;
  if (isStalePricing(intelligence)) return true;
  if (key === 'local_market') return false;
  if (key === 'saved_company' || key === 'imported_price_book') return false;
  if (mapConfidence(intelligence.pricing.confidence) === PRICING_CONFIDENCE_LABEL.HIGH) return false;
  return false;
}

/** Neutral source-based guidance for accepted Confirm Scope pricing cards. */
export function getPricingSourceMessage(
  intelligence: ScopeItemIntelligence,
  acceptance: ScopePricingAcceptanceMetadata
): string | null {
  const unresolvedAssumptionCount = intelligence.unresolvedAssumptionCount ?? intelligence.reviewableAssumptionCount ?? 0;
  const conciseBenchmarkWarning = buildConciseBenchmarkScopeWarning({
    profile: intelligence.benchmarkScopeProfile,
    pricingSource: intelligence.pricing.source,
    assumptionCount: unresolvedAssumptionCount,
    pricingAccepted: acceptance.selectionStatus === 'accepted' || acceptance.selectionStatus === 'manual_adjusted',
    scopeKey: intelligence.scopeItemKey,
  });
  if (conciseBenchmarkWarning) return conciseBenchmarkWarning;

  if (intelligence.overlapRisk?.hasOverlapRisk && intelligence.overlapRisk.reason) {
    return intelligence.overlapRisk.reason;
  }

  if (acceptance.selectionStatus === 'user_entered' && acceptance.pricingSourceKind === 'user_entered') {
    return validationIssueMessage(intelligence);
  }

  if (acceptance.selectionStatus === 'manual_adjusted') {
    return validationIssueMessage(intelligence);
  }

  const sourceKey = resolveSourceMessageKey(acceptance, intelligence);
  if (sourceKey && shouldShowSourceMessage(sourceKey, intelligence, acceptance)) {
    if (isStalePricing(intelligence)) {
      if (sourceKey === 'saved_company') {
        return "Based on your saved company pricing. Review if this rate is no longer current.";
      }
      if (sourceKey === 'supplier') {
        return SOURCE_MESSAGE_COPY.supplier;
      }
      if (sourceKey === 'subcontractor') {
        return SOURCE_MESSAGE_COPY.subcontractor;
      }
    }
    return SOURCE_MESSAGE_COPY[sourceKey];
  }

  if (isStalePricing(intelligence) && acceptance.pricingSourceKind === 'saved_rate') {
    return "Based on your saved company pricing. Review if this rate is no longer current.";
  }

  return validationIssueMessage(intelligence);
}

/** @deprecated Use getPricingSourceMessage */
export function conciseConfidenceWarning(
  intelligence: ScopeItemIntelligence,
  acceptance: ScopePricingAcceptanceMetadata
): string | null {
  return getPricingSourceMessage(intelligence, acceptance);
}

export function formatFreshnessLabel(intelligence: ScopeItemIntelligence): string | null {
  const status = intelligence.pricingCompleteness?.dateRelevance?.status;
  const message = intelligence.pricingCompleteness?.dateRelevance?.message;
  if (!message || /unknown/i.test(message)) return 'Update date unavailable';
  if (status === 'current' || status === 'aging') {
    const months = intelligence.pricingCompleteness?.dateRelevance?.ageMonths;
    if (months != null && months <= 1) return 'Updated recently';
    if (months != null) return `Last verified ${months * 30} days ago`;
  }
  if (status === 'stale') return 'May be outdated';
  if (status === 'expired') return 'Expired — confirm current rate';
  return null;
}

export function buildPricingDetailRows(params: {
  display: AcceptedPricingDisplay;
  intelligence: ScopeItemIntelligence;
  resolved: ResolvedItemQuantity;
  suggestedBlock?: SuggestedPricingBlock | null;
}): PricingDetailRow[] {
  const rows: PricingDetailRow[] = [];
  const push = (label: string, value?: string | number | null) => {
    const text = value == null ? '' : String(value).trim();
    if (!text) return;
    if (GEOGRAPHIC_CONFIDENCE_VALUES.has(text.toLowerCase()) && label.toLowerCase().includes('geographic')) {
      return;
    }
    rows.push({ label, value: text });
  };

  const { display, intelligence, resolved, suggestedBlock } = params;
  const { acceptance, pricingModel } = display;

  if (acceptance.selectionStatus === 'manual_adjusted') {
    push('Current source', 'User adjusted');
    if (acceptance.originalPricingSourceLabel) {
      push('Original suggestion', acceptance.originalPricingSourceLabel);
    } else if (acceptance.originalSuggestionLabel) {
      push('Original suggestion', acceptance.originalSuggestionLabel);
    }
  } else {
    push('Source', acceptance.pricingSourceLabel);
  }

  push('Pricing method', acceptance.pricingTypeLabel);

  if (pricingModel === 'unit_pricing') {
    const qty = resolved.dualCount?.quantity ?? (hasMeaningfulPhysicalQuantity(resolved) ? resolved.quantity : null);
    const unit = resolved.dualCount?.unit ?? resolved.unit;
    if (qty != null && unit) {
      push('Quantity', qty.toLocaleString());
      push('Unit', formatUnitLabel(unit));
    }
    if (suggestedBlock && suggestedBlock.basis?.quantity && qty) {
      const materialRate = suggestedBlock.material > 0 ? suggestedBlock.material / qty : null;
      const laborRate = suggestedBlock.labor > 0 ? suggestedBlock.labor / qty : null;
      if (materialRate != null && materialRate > 0) {
        push('Material rate', `$${materialRate.toFixed(2)}/${formatUnitLabel(unit || '')}`);
      }
      if (laborRate != null && laborRate > 0) {
        push('Labor rate', `$${laborRate.toFixed(2)}/${formatUnitLabel(unit || '')}`);
      }
    }
    if (intelligence.formula?.formulaExplanation) {
      push('Calculation formula', intelligence.formula.formulaExplanation);
    }
  }

  if (pricingModel === 'material_labor_split') {
    if (acceptance.materialAmount != null) push('Material amount', `$${acceptance.materialAmount.toLocaleString()}`);
    if (acceptance.laborAmount != null) push('Labor amount', `$${acceptance.laborAmount.toLocaleString()}`);
    if (resolved.dualMaterial && !acceptance.materialAmount) {
      push('Material amount', formatDraftMoney(resolved.dualMaterial.quantity));
    }
    if (resolved.dualLabor && !acceptance.laborAmount) {
      push('Labor amount', formatDraftMoney(resolved.dualLabor.quantity));
    }
  }

  push('Geographic basis', display.geographicBasis);
  push('Total', display.totalLabel);
  push('Confidence', display.confidenceShortLabel);

  const freshness = formatFreshnessLabel(intelligence);
  if (freshness) push('Last updated', freshness);

  return rows;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isItemSpecificAssemblyComponent(component: AssemblyComponentStatus, scopeKey: string): boolean {
  const keys = component.relatedScopeKeys || [];
  if (!keys.length) return true;
  if (keys.includes(scopeKey)) return true;
  return !keys.some((key) => PROJECT_WIDE_SCOPE_KEYS.has(key));
}

export function itemSpecificAssemblyComponents(
  components: AssemblyComponentStatus[] | undefined,
  scopeKey: string
): AssemblyComponentStatus[] {
  return (components || []).filter((component) => isItemSpecificAssemblyComponent(component, scopeKey));
}

export function collectProjectWideScopeGaps(gaps: ScopeGapNotice[]): ScopeGapNotice[] {
  return gaps.filter(
    (gap) =>
      gap.suggestedScopeKeys.some((key) => PROJECT_WIDE_SCOPE_KEYS.has(key)) ||
      PROJECT_WIDE_SCOPE_KEYS.has(gap.scopeGroupKey)
  );
}

/** Current applied/entered total for a scope, if any. */
export function currentScopePricingTotal(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }>,
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>
): number | null {
  const live = liveScopeMoneyFromQuantities(itemId, itemQuantities);
  if (live != null && live > 0) return live;
  // Do not fall back to sticky acceptance when quantity fields were cleared.
  void pricingAcceptance;
  return null;
}

/**
 * Hide the suggested panel only when pricing was applied from Suggest and matches
 * the benchmark. User-entered / manual pricing always keeps the comparison row.
 */
export function shouldHideSuggestedPanel(params: {
  itemId: string;
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }>;
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
  suggestedTotal?: number | null;
}): boolean {
  if (
    shouldSuppressSuggestedPricingAfterApply(
      params.itemId,
      params.itemQuantities,
      params.pricingAcceptance
    )
  ) {
    return true;
  }
  if (!hasAcceptedScopePricing(params.itemId, params.itemQuantities, params.pricingAcceptance)) {
    return false;
  }
  const suggested = Number(params.suggestedTotal);
  if (!(Number.isFinite(suggested) && suggested > 0)) return true;

  // Manual entry (not applied from Suggest) — always show benchmark for comparison.
  if (params.pricingAcceptance?.[params.itemId]?.selectionStatus !== 'accepted') {
    return false;
  }

  const current = currentScopePricingTotal(
    params.itemId,
    params.itemQuantities,
    params.pricingAcceptance
  );
  if (current == null) return false;
  return Math.abs(current - suggested) < 0.01;
}

export function markManualPricingAdjustment(
  acceptance: ScopePricingAcceptanceMetadata | undefined,
  itemId: string,
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata> | undefined,
  /**
   * New money total after the edit.
   * - `number > 0`: update acceptance total
   * - `null` / `0`: user cleared dollars — drop acceptance (do not keep stale $2, etc.)
   * - `undefined`: leave totalAmount unchanged (metadata-only adjustment)
   */
  nextAmount?: number | null
): Record<string, ScopePricingAcceptanceMetadata> | undefined {
  // Cleared allowance/split fields must not leave a sticky accepted total on Step 2.
  if (nextAmount === null || nextAmount === 0) {
    if (!pricingAcceptance?.[itemId] && !acceptance) return pricingAcceptance;
    const next = { ...(pricingAcceptance || {}) };
    delete next[itemId];
    return next;
  }

  const current = acceptance || pricingAcceptance?.[itemId];
  if (!current) return pricingAcceptance;
  if (nextAmount != null && Math.abs(nextAmount - current.totalAmount) < 0.01) {
    return pricingAcceptance;
  }
  return {
    ...(pricingAcceptance || {}),
    [itemId]: {
      ...current,
      selectionStatus: 'manual_adjusted',
      pricingSourceLabel: 'User adjusted',
      pricingSourceKind: 'user_entered',
      totalAmount: nextAmount ?? current.totalAmount,
      originalPricingSourceLabel: current.originalPricingSourceLabel || current.pricingSourceLabel,
      originalSuggestionLabel: current.originalSuggestionLabel || current.rateSourceLabel,
      benchmarkProvenance: current.benchmarkProvenance
        ? { ...current.benchmarkProvenance, overriddenByUser: true }
        : undefined,
    },
  };
}

/** After pricing editor Done: drop Suggest seeds and orphan split totals only. */
export function finalizeScopePricingAfterEditorClose(params: {
  itemId: string;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
}): {
  itemQuantities: Record<string, ScopeItemQuantityValue>;
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata>;
} {
  const itemId = params.itemId;
  let itemQuantities = { ...(params.itemQuantities || {}) };
  let pricingAcceptance = { ...(params.pricingAcceptance || {}) };

  if (hasOnlySuggestedPrefillPricing(itemQuantities, itemId)) {
    itemQuantities = clearSuggestedPrefillPricing(itemQuantities, itemId);
  }

  itemQuantities = promoteEditorTakeoffBasisToPrimaryItem(itemId, itemQuantities);

  const materialKey = allowanceSplitSubKey(itemId, 'material');
  const laborKey = allowanceSplitSubKey(itemId, 'labor');
  const materialEntry = itemQuantities[materialKey];
  const laborEntry = itemQuantities[laborKey];
  const materialQty = parsePricingAmount(materialEntry?.quantity);
  const laborQty = parsePricingAmount(laborEntry?.quantity);
  const splitLegsPresent = Boolean(materialEntry || laborEntry);
  const splitLegsEmpty = !(materialQty != null && materialQty > 0) && !(laborQty != null && laborQty > 0);

  // Only clear orphan __allowance when Material/Labor legs were edited then wiped.
  if (splitLegsPresent && splitLegsEmpty) {
    return clearAcceptedScopeItemPricing({ itemId, itemQuantities, pricingAcceptance });
  }

  if (!(liveScopeMoneyFromQuantities(itemId, itemQuantities) > 0)) {
    return clearAcceptedScopeItemPricing({ itemId, itemQuantities, pricingAcceptance });
  }

  return { itemQuantities, pricingAcceptance };
}

export function parsePricingAmount(value: string | number | null | undefined): number | null {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
