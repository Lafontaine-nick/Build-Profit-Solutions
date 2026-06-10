/**
 * Global suggested-price validation pipeline.
 * Every scope item passes all stages — no project-type bypass.
 *
 * 1. pricingUnitValidation
 * 2. sourceValidation (rate filtering)
 * 3. scope/category validation (matrix)
 * 4. trade/category range validation
 * 5. outlier/range validation
 * 6. selectable/apply validation (approval status)
 */

const { validatePricingUnits } = require('./pricingUnitValidation');
const { validateScopeItemPricing } = require('./globalPricingValidation');
const { applyItemPricingAdjustments } = require('./itemPricingAdjustments');
const {
  applyPricingApprovalStatus,
  BLOCKED_LABEL,
  MANUAL_PRICING_LABEL,
} = require('./pricingApprovalStatus');
const {
  resolveScopePricingRule,
  isManualPricingFallback,
  hasSavedSource,
  isSourceValidForRule,
  isQuantityUnitAllowed,
} = require('./scopePricingMatrix');
const { classifyScopeItem } = require('./scopeClassification');

function filterRatesBySourceRule(scopeItem, rates, draft) {
  const rule = resolveScopePricingRule(scopeItem, draft);
  if (isManualPricingFallback(scopeItem, draft) && !hasSavedSource(rates)) {
    return [];
  }
  return (rates || []).filter((r) => {
    if (!r.source) return true;
    if (isManualPricingFallback(scopeItem, draft)) {
      return hasSavedSource([r]);
    }
    return isSourceValidForRule(r.source, rule);
  });
}

/**
 * Run the full global validation pipeline on proposed rates for one scope item.
 * @returns {object} Same shape as validateScopeItemSuggestion output
 */
function runGlobalPricingPipeline(scopeItem, proposedRates, recommended, context = {}) {
  const draft = context.draft || {};
  let rates = filterRatesBySourceRule(scopeItem, proposedRates, draft);

  if (context.filterInvalidRate) {
    rates = rates.filter((r) => !context.filterInvalidRate(scopeItem, r));
  }

  const unitCheck = validatePricingUnits(scopeItem, rates);
  if (unitCheck.blocked) {
    return applyPricingApprovalStatus(
      scopeItem,
      {
        proposedRates: [],
        recommended: null,
        warnings: [BLOCKED_LABEL, ...(unitCheck.warnings || [])],
        confidence: 'low',
        requiresConfirmBeforeApply: false,
        classification: classifyScopeItem(scopeItem, draft),
        reviewStatus: 'unit_mismatch',
        reviewStatuses: ['unit_mismatch'],
        priceRangeHint: null,
      },
      { pricingBlocked: true, unitMismatchSubtext: unitCheck.unitMismatchSubtext }
    );
  }

  rates = applyItemPricingAdjustments(scopeItem, unitCheck.rates);

  if (!rates.length) {
    const manualMsg =
      unitCheck.warnings?.find((w) => /no reliable source/i.test(w)) || MANUAL_PRICING_LABEL;
    return applyPricingApprovalStatus(
      scopeItem,
      {
        proposedRates: [],
        recommended: null,
        warnings: [manualMsg],
        confidence: 'low',
        requiresConfirmBeforeApply: false,
        classification: classifyScopeItem(scopeItem, draft),
        reviewStatus: 'needs_price',
        reviewStatuses: ['needs_price'],
        priceRangeHint: null,
      },
      { pricingBlocked: false }
    );
  }

  if (!isQuantityUnitAllowed(scopeItem, draft)) {
    const rule = resolveScopePricingRule(scopeItem, draft);
    return applyPricingApprovalStatus(
      scopeItem,
      {
        proposedRates: [],
        recommended: null,
        warnings: [
          BLOCKED_LABEL,
          `This item should use ${rule.allowedUnits.join(' or ')} — not ${scopeItem.unit || 'unknown'}.`,
        ],
        confidence: 'low',
        requiresConfirmBeforeApply: false,
        classification: classifyScopeItem(scopeItem, draft),
        reviewStatus: 'unit_mismatch',
        reviewStatuses: ['unit_mismatch'],
        priceRangeHint: null,
      },
      {
        pricingBlocked: true,
        unitMismatchSubtext: `Expected ${rule.allowedUnits.join('/')}, got ${scopeItem.unit || 'unknown'}.`,
      }
    );
  }

  const globalResult = validateScopeItemPricing(scopeItem, rates, draft);
  const merged = applyPricingApprovalStatus(
    scopeItem,
    {
      proposedRates: rates,
      recommended,
      warnings: globalResult.warnings,
      confidence: recommended?.confidence || 'medium',
      requiresConfirmBeforeApply: globalResult.requiresConfirmBeforeApply,
      classification: globalResult.classification,
      reviewStatus: globalResult.reviewStatus,
      reviewStatuses: globalResult.reviewStatuses,
      priceRangeHint: globalResult.priceRangeHint,
    },
    { pricingBlocked: false }
  );

  return {
    ...merged,
    pricingBlocked: merged.pricingBlocked || false,
    autoSelectEligible: merged.autoSelectEligible ?? false,
    unitMismatchSubtext: merged.pricingBlocked ? merged.approvalSubtext : null,
    approvalSubtext: merged.approvalSubtext,
    selectable: !merged.pricingBlocked && (merged.proposedRates?.length ?? 0) > 0,
  };
}

module.exports = {
  runGlobalPricingPipeline,
  filterRatesBySourceRule,
};
