import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import { hasAcceptedScopePricing } from '@/utils/acceptedPricingSummaryUi';
import {
  checklistItemInScope,
  initialScopeMeasurementInputExtended,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopePricingContext,
} from '@/utils/scopeItemQuantities';
import {
  confirmScopeDisplayItemsFromDraft,
  scopeReviewDisplayLabel,
} from '@/utils/scopePackagesForReview';
import type {
  PricingProposal,
  PricingScopeItemProposal,
} from '@/utils/estimateAiDraftPricing';
import {
  normalizePricingProposal,
  scopeItemsToProposalLines,
} from '@/utils/estimateAiDraftPricing';
import {
  mergeSuggestedPricingBlocksIntoMeasurements,
  type SuggestedPricingApplyRow,
} from '@/utils/mergeSuggestedPricingBlocks';
import { scopeMeasurementsPayloadForPersist } from '@/utils/scopeItemQuantities';

export type ConfirmScopeUnpricedRow = SuggestedPricingApplyRow & {
  label: string;
  quantity: number | null;
  unit: string;
};

function draftHasConfirmScope(draft: EstimateAiDraft | null | undefined): boolean {
  if (!draft) return false;
  return Boolean(draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length);
}

function pricingContextFromDraft(draft: EstimateAiDraft): ScopePricingContext | null {
  const items = confirmScopeDisplayItemsFromDraft(draft);
  if (!items.length) return null;
  return { checklistItems: items };
}

function suggestedBlockToScopeItem(row: ConfirmScopeUnpricedRow): PricingScopeItemProposal {
  const { itemId, label, block, quantity, unit } = row;
  const qty = quantity ?? block.basis?.quantity ?? 1;
  const unitLabel = unit || block.basis?.unit || 'each';
  const rates: PricingScopeItemProposal['proposedRates'] = [];

  if (block.material > 0 && !block.lumpSumOnly) {
    const rate = qty > 0 ? block.material / qty : block.material;
    rates.push({
      label: 'Material',
      pricingType: 'material',
      rate: Math.round(rate * 100) / 100,
      unit: unitLabel,
      quantity: qty,
      total: block.material,
      formula: `${qty.toLocaleString()} ${unitLabel} × $${rate.toFixed(2)}/${unitLabel} = $${block.material.toLocaleString()}`,
      source: 'national_trade_average',
      confidence: 'low',
      assumptions: [],
      requiresApproval: false,
    });
  }
  if (block.labor > 0) {
    const rate = qty > 0 && !block.lumpSumOnly ? block.labor / qty : block.labor;
    rates.push({
      label: 'Labor',
      pricingType: 'labor',
      rate: Math.round(rate * 100) / 100,
      unit: block.lumpSumOnly ? 'lump_sum' : unitLabel,
      quantity: block.lumpSumOnly ? 1 : qty,
      total: block.labor,
      formula: block.lumpSumOnly
        ? `$${block.labor.toLocaleString()} labor`
        : `${qty.toLocaleString()} ${unitLabel} × $${rate.toFixed(2)}/${unitLabel} = $${block.labor.toLocaleString()}`,
      source: 'national_trade_average',
      confidence: 'medium',
      assumptions: [],
      requiresApproval: false,
    });
  }
  if (!rates.length && block.total > 0) {
    rates.push({
      label: label,
      pricingType: 'lump_sum',
      rate: block.total,
      unit: 'lump_sum',
      quantity: 1,
      total: block.total,
      formula: `$${block.total.toLocaleString()}`,
      source: 'national_trade_average',
      confidence: 'medium',
      assumptions: [],
      requiresApproval: false,
    });
  }

  return {
    scopeItemId: itemId,
    scopeName: label,
    quantity: qty,
    unit: unitLabel,
    proposedRates: rates,
    comparison: {},
    recommended: {
      source: 'national_trade_average',
      sourceLabel: 'Planning estimate',
      reason: 'National average planning price from Confirm Scope.',
      confidence: 'low',
    },
    warnings: [],
    reviewStatus: 'suggested_rough_price',
    autoSelectEligible: true,
    roughPricingTier: 'planning',
  };
}

/** Same rows Step 2 uses for "Use N suggested prices" — in-scope cards without Applied pricing. */
export function listConfirmScopeUnpricedPricingRows(
  draft: EstimateAiDraft
): ConfirmScopeUnpricedRow[] {
  if (!draftHasConfirmScope(draft)) return [];

  const displayItems = confirmScopeDisplayItemsFromDraft(draft);
  if (!displayItems.length) return [];

  const templateKey = draft.scopeChecklist?.templateKey;
  const notes = resolveDraftScopeNotes(draft);
  const measurements = initialScopeMeasurementInputExtended(draft);
  const normMeasurements = normalizeScopeMeasurements(measurements);
  const pricingContext = pricingContextFromDraft(draft);

  const rows: ConfirmScopeUnpricedRow[] = [];

  for (const item of displayItems) {
    if (!checklistItemInScope(item)) continue;
    if (hasAcceptedScopePricing(item.id, measurements.itemQuantities, measurements.pricingAcceptance)) {
      continue;
    }

    const resolved = resolveChecklistItemQuantity(item.id, normMeasurements, {
      choiceId: item.choiceId,
      templateKey,
      notes,
    });

    const initialSuggested = resolveScopeItemSuggestedPricing(
      item.id,
      measurements,
      templateKey,
      resolved,
      pricingContext,
      item.choiceId
    );

    const fill = initialSuggested.fill;

    if (
      !fill ||
      fill.isComparison ||
      fill.benchmarkAction === 'included_in_stage' ||
      fill.benchmarkAction === 'comparison_only' ||
      !(fill.total > 0)
    ) {
      continue;
    }

    rows.push({
      itemId: item.id,
      label: scopeReviewDisplayLabel(item),
      block: fill,
      quantity: resolved.quantity ?? fill.basis?.quantity ?? null,
      unit: resolved.unit || fill.basis?.unit || 'each',
    });
  }

  return rows;
}

export function buildConfirmScopeUnpricedPricingProposal(
  draft: EstimateAiDraft
): PricingProposal {
  const rows = listConfirmScopeUnpricedPricingRows(draft);
  const scopeItems = rows.map(suggestedBlockToScopeItem);
  const lines = scopeItemsToProposalLines(scopeItems);
  const totalSuggested = lines.reduce((sum, line) => sum + (line.total || 0), 0);

  return normalizePricingProposal({
    empty: scopeItems.length === 0,
    source: 'manual',
    sourceLabel: 'Confirm Scope planning prices',
    lines,
    scopeItems,
    totalSuggested,
    pricingMode: 'suggest',
    confirmScopeOnly: true,
    confirmScopeRows: rows.map(({ itemId, block }) => ({ itemId, block })),
    message: scopeItems.length
      ? null
      : 'All included scopes already have pricing from Confirm Scope.',
    assumptions: ['Planning estimates only — same rates shown on Confirm Scope cards.'],
    anyRealSource: true,
    requiresConfirmBeforeApply: false,
    canApplyWithoutConfirm: true,
  });
}

export function applyConfirmScopeUnpricedPricingProposal(
  draft: EstimateAiDraft,
  proposal: PricingProposal,
  includedIds: Set<string>
): EstimateAiDraft {
  const rows = (proposal.confirmScopeRows || []).filter((row) => includedIds.has(row.itemId));
  if (!rows.length) return draft;

  const measurements = initialScopeMeasurementInputExtended(draft);
  const { measurements: nextMeasurements } = mergeSuggestedPricingBlocksIntoMeasurements(
    measurements,
    rows,
    draft.scopeChecklist?.templateKey
  );

  const payload = scopeMeasurementsPayloadForPersist(nextMeasurements, {
    templateKey: draft.scopeChecklist?.templateKey,
  });

  return {
    ...draft,
    scopeMeasurements: {
      ...(draft.scopeMeasurements || {}),
      ...payload,
      itemQuantities: {
        ...(draft.scopeMeasurements?.itemQuantities || {}),
        ...(payload.itemQuantities || {}),
      },
      pricingAcceptance: {
        ...(draft.scopeMeasurements?.pricingAcceptance || {}),
        ...(payload.pricingAcceptance || {}),
      },
    },
    pendingPricingProposal: proposal,
  };
}

export function draftEligibleForConfirmScopeUnpricedPricing(
  draft: EstimateAiDraft | null | undefined
): boolean {
  return draftHasConfirmScope(draft);
}
