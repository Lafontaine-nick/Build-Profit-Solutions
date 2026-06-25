import {
  countNeedsSeparatePricing,
  countUnresolvedScopeDecisions,
  countUnresolvedScopeGaps,
  formatNeedsSeparatePricingLabel,
  formatReviewScopeItemsLabel,
  getReviewableScopeComponents,
  type ScopeGapPricingContext,
  type ScopeGapResolutionsMap,
} from '@/utils/scopeReviewUi';
import type { ScopeItemIntelligence } from '@/utils/scopeIntelligence';
import { buildConciseBenchmarkScopeWarning } from '@/utils/benchmarkScopeAssumptions';
import type { AssemblyComponentStatus, ScopeGapNotice } from '@/utils/scopeAssemblyRegistry';
import type { ResolvedItemQuantity, ScopeItemQuantityValue, SuggestedPricingBlock } from '@/utils/scopeItemQuantities';
import {
  allowanceSplitSubKey,
  formatUnitLabel,
  hasCompleteUserSelectedPricing,
  roughAllowanceSubKey,
} from '@/utils/scopeItemQuantities';

export type ScopePricingAcceptanceMetadata = {
  selectionStatus: 'accepted' | 'user_entered' | 'manual_adjusted';
  pricingSourceLabel: string;
  pricingSourceKind:
    | 'national_average'
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
  confidenceLabel: 'High confidence' | 'Medium confidence' | 'Low confidence' | 'Scope review pending' | null;
  confidenceShortLabel: 'High' | 'Medium' | 'Low' | 'Pending' | null;
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
  const usesTemplate = block.materialSource === 'template' || block.laborSource === 'template';
  if (usesTemplate) return 'Saved company pricing';
  if (block.materialSource === 'notes' || block.laborSource === 'notes') return 'Parsed from notes';
  if (block.rateSourceLabel.includes('National')) return 'National average';
  return 'National average';
}

export function pricingSourceKindFromBlock(block: SuggestedPricingBlock): ScopePricingAcceptanceMetadata['pricingSourceKind'] {
  if (block.materialSource === 'template' || block.laborSource === 'template') return 'saved_rate';
  if (block.materialSource === 'notes' || block.laborSource === 'notes') return 'parsed_from_notes';
  return 'national_average';
}

export function geographicBasisFromSourceKind(
  kind: ScopePricingAcceptanceMetadata['pricingSourceKind'],
  intelligence?: ScopeItemIntelligence
): string {
  if (kind === 'national_average') return 'National';
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

function hasMeaningfulPhysicalQuantity(resolved: ResolvedItemQuantity): boolean {
  const unit = String(resolved.unit || '').toLowerCase();
  if (unit === 'allowance' || unit === 'lump_sum') return false;
  const qty = Number(resolved.dualCount?.quantity ?? resolved.quantity ?? 0);
  return qty > 0 && qty < 100000;
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
  };
}

export function hasAcceptedScopePricing(
  itemId: string,
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }>,
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>
): boolean {
  if (pricingAcceptance?.[itemId]) return true;
  if (hasCompleteUserSelectedPricing(itemQuantities as Record<string, ScopeItemQuantityValue>, itemId)) return true;
  const allowanceKey = allowanceSplitSubKey(itemId, 'allowance');
  const roughKey = roughAllowanceSubKey(itemId);
  const candidates = [itemQuantities[allowanceKey], itemQuantities[roughKey], itemQuantities[itemId]];
  return candidates.some(
    (entry) =>
      entry?.quantitySource === 'user_entered' &&
      Number(String(entry.quantity ?? '').replace(/,/g, '')) > 0
  );
}

export function resolveAcceptedPricingDisplay(params: {
  itemId: string;
  resolved: ResolvedItemQuantity;
  acceptance?: ScopePricingAcceptanceMetadata | null;
  suggestedBlock?: SuggestedPricingBlock | null;
  intelligence: ScopeItemIntelligence;
}): AcceptedPricingDisplay {
  const total =
    params.acceptance?.totalAmount ??
    Number(params.resolved.dualAllowance?.quantity ?? params.resolved.quantity ?? 0);
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
    totalLabel: `$${Number(total).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    selectionStatusLabel: selectionStatusLabel(acceptance, params.resolved),
    pricingSourceLabel: acceptance.pricingSourceLabel,
    pricingTypeLabel: acceptance.pricingTypeLabel,
    subtitleLine: acceptedPricingSubtitleLine({
      display: {
        pricingModel,
        totalLabel: `$${Number(total).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
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
    return 'Scope review pending';
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
  if (acceptance.selectionStatus === 'accepted') return 'Accepted';
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
    pricingSourceLabel: fromNotes ? 'Parsed from notes' : 'User entered',
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
  if (material != null && material > 0) parts.push(`Material ${formatDraftMoney(material)}`);
  if (labor != null && labor > 0) parts.push(`Labor ${formatDraftMoney(labor)}`);
  if (allowance != null && allowance > 0) parts.push(`Allowance ${formatDraftMoney(allowance)}`);
  if (subcontractor != null && subcontractor > 0) {
    parts.push(`Subcontractor ${formatDraftMoney(subcontractor)}`);
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
      label:
        unresolvedDecisionCount === 1
          ? 'Review 1 scope assumption'
          : `Review ${unresolvedDecisionCount} scope assumptions`,
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
      label: formatReviewScopeItemsLabel(fullyUnresolvedCount),
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
    return { kind: 'compare_sources', label: 'Compare sources' };
  }

  if (pricingModel === 'unit_pricing' && hasUnitPricingCalculation(params.resolved, params.suggestedBlock, params.intelligence)) {
    return { kind: 'view_calculation', label: 'View calculation' };
  }

  if (pricingModel === 'material_labor_split' && hasMaterialLaborBreakdown(acceptance, params.resolved)) {
    // Breakdown panel adds structured rows; skip only when nothing beyond the inline summary exists.
    return { kind: 'view_breakdown', label: 'View breakdown' };
  }

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
): 'High confidence' | 'Medium confidence' | 'Low confidence' {
  if (acceptance?.pricingSourceKind === 'national_average') {
    return mapConfidence(intelligence.pricing.confidence);
  }
  if (acceptance?.pricingSourceKind === 'parsed_from_notes') {
    return mapConfidence(intelligence.pricing.confidence === 'missing' ? 'medium' : intelligence.pricing.confidence);
  }
  if (acceptance?.selectionStatus === 'manual_adjusted' || acceptance?.pricingSourceKind === 'user_entered') {
    return 'High confidence';
  }
  if (acceptance?.pricingSourceKind === 'saved_rate') {
    return mapConfidence(intelligence.pricing.confidence === 'missing' ? 'medium' : intelligence.pricing.confidence);
  }
  return mapConfidence(intelligence.pricing.confidence);
}

function mapConfidence(value: string): 'High confidence' | 'Medium confidence' | 'Low confidence' {
  if (value === 'high') return 'High confidence';
  if (value === 'medium') return 'Medium confidence';
  return 'Low confidence';
}

export function confidenceShortLabel(
  label: AcceptedPricingDisplay['confidenceLabel']
): 'High' | 'Medium' | 'Low' | 'Pending' {
  if (label === 'Scope review pending') return 'Pending';
  if (label === 'High confidence') return 'High';
  if (label === 'Medium confidence') return 'Medium';
  return 'Low';
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
  if (mapConfidence(intelligence.pricing.confidence) === 'High confidence') return false;
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

function formatDraftMoney(value: number): string {
  return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

export function shouldHideSuggestedPanel(params: {
  itemId: string;
  itemQuantities: Record<string, ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }>;
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
}): boolean {
  return hasAcceptedScopePricing(params.itemId, params.itemQuantities, params.pricingAcceptance);
}

export function markManualPricingAdjustment(
  acceptance: ScopePricingAcceptanceMetadata | undefined,
  itemId: string,
  pricingAcceptance: Record<string, ScopePricingAcceptanceMetadata> | undefined,
  nextAmount?: number
): Record<string, ScopePricingAcceptanceMetadata> | undefined {
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
    },
  };
}

export function parsePricingAmount(value: string | number | null | undefined): number | null {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
