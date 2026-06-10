/**
 * Scope-dependent approval vs manual-pricing vs auto-select planning statuses.
 * Rule resolution delegated to scopePricingMatrix (all trades).
 */

const { isAutoSelectEligibleScope } = require('./pricingUnitValidation');
const {
  isNeedsApprovalScope,
  isManualPricingFallback,
  getScopeApprovalHint,
} = require('./scopePricingMatrix');

const APPROVAL_SUBTEXT = 'Confirm what is included before applying.';

const BLOCKED_LABEL = 'Blocked — pricing unit does not match scope.';

const MANUAL_PRICING_LABEL = 'Needs manual pricing — no reliable source found.';

const STATUS = {
  NEEDS_PRICE: 'needs_price',
  NEEDS_APPROVAL: 'needs_approval',
  SUGGESTED_ROUGH: 'suggested_rough_price',
  UNIT_MISMATCH: 'unit_mismatch',
  SCOPE_MISMATCH: 'scope_mismatch',
  MANUAL_REVIEW: 'manual_review_required',
  HIGH_PRICE: 'high_price_warning',
};

const GENERIC_MISMATCH_RE =
  /Possible pricing mismatch|looks high for|full assembly|framing only|different scope|parentAssembly/i;

function stripGenericMismatchWarnings(warnings) {
  return (warnings || []).filter((w) => !GENERIC_MISMATCH_RE.test(w));
}

function uniqueWarnings(list) {
  const out = [];
  for (const w of list) {
    if (w && !out.includes(w)) out.push(w);
  }
  return out;
}

function applyPricingApprovalStatus(scopeItem, result, extra = {}) {
  if (extra.pricingBlocked) {
    const sub = extra.unitMismatchSubtext || null;
    return {
      ...result,
      reviewStatus: STATUS.UNIT_MISMATCH,
      reviewStatuses: [STATUS.UNIT_MISMATCH],
      warnings: uniqueWarnings([BLOCKED_LABEL, sub].filter(Boolean)),
      pricingBlocked: true,
      autoSelectEligible: false,
      approvalSubtext: sub,
      requiresConfirmBeforeApply: false,
    };
  }

  if (!result.proposedRates?.length) {
    return {
      ...result,
      reviewStatus: STATUS.NEEDS_PRICE,
      warnings: uniqueWarnings(
        result.warnings?.length ? result.warnings : [MANUAL_PRICING_LABEL]
      ),
      autoSelectEligible: false,
      approvalSubtext: null,
    };
  }

  if (isNeedsApprovalScope(scopeItem)) {
    const hint = getScopeApprovalHint(scopeItem);
    const warnings = stripGenericMismatchWarnings(result.warnings);
    if (!warnings.some((w) => w === hint)) warnings.unshift(hint);

    return {
      ...result,
      reviewStatus: STATUS.NEEDS_APPROVAL,
      reviewStatuses: [STATUS.NEEDS_APPROVAL],
      warnings: uniqueWarnings(warnings),
      requiresConfirmBeforeApply: true,
      autoSelectEligible: false,
      approvalSubtext: APPROVAL_SUBTEXT,
      pricingBlocked: false,
    };
  }

  const autoEligible =
    isAutoSelectEligibleScope(scopeItem) &&
    !result.reviewStatuses?.includes(STATUS.SCOPE_MISMATCH) &&
    !result.reviewStatuses?.includes(STATUS.UNIT_MISMATCH) &&
    !result.requiresConfirmBeforeApply &&
    !isManualPricingFallback(scopeItem);

  let reviewStatus = result.reviewStatus;
  if (
    autoEligible &&
    (reviewStatus === STATUS.SUGGESTED_ROUGH ||
      reviewStatus === STATUS.HIGH_PRICE ||
      !reviewStatus)
  ) {
    reviewStatus = STATUS.SUGGESTED_ROUGH;
  }

  return {
    ...result,
    reviewStatus,
    autoSelectEligible: autoEligible,
    approvalSubtext: null,
    pricingBlocked: false,
  };
}

module.exports = {
  APPROVAL_SUBTEXT,
  BLOCKED_LABEL,
  MANUAL_PRICING_LABEL,
  isNeedsApprovalScope,
  isManualPricingOnlyScope: isManualPricingFallback,
  getScopeApprovalHint,
  applyPricingApprovalStatus,
  stripGenericMismatchWarnings,
};
