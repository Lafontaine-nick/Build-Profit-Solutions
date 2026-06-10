/**
 * Global pricing validation — works across all trades.
 * Detects wrong units, scope/assembly mismatches, and extreme rates before apply.
 */

const { classifyScopeItem } = require('./scopeClassification');
const { getPricingRange, normalizeUnit, unitAllowedForCategory } = require('./pricingRangeCatalog');
const { isNeedsApprovalScope } = require('./scopePricingMatrix');

const OUTLIER_MULTIPLIER = 2;

const REVIEW_STATUS = {
  CONFIRMED: 'confirmed',
  NEEDS_PRICE: 'needs_price',
  NEEDS_APPROVAL: 'needs_approval',
  SUGGESTED_ROUGH: 'suggested_rough_price',
  HIGH_PRICE: 'high_price_warning',
  UNIT_MISMATCH: 'unit_mismatch',
  SCOPE_MISMATCH: 'scope_mismatch',
  MANUAL_REVIEW: 'manual_review_required',
};

const ROUGH_SOURCES = new Set([
  'ai_rough_estimate_fallback',
  'ai_rough_estimate',
  'national_trade_average',
  'construction_cost_database',
  'regional_labor_benchmark',
]);

const SAVED_SOURCES = new Set(['saved_pricing', 'saved_template', 'company_default']);

function rateTotal(rate, qty) {
  if (rate.total != null && rate.total > 0) return rate.total;
  if (rate.rate != null && rate.rate > 0 && qty > 0) return rate.rate * qty;
  if (rate.lumpTotal != null && rate.lumpTotal > 0) return rate.lumpTotal;
  return rate.rate ?? 0;
}

function checkRateAgainstBand(rate, band, pricingType, warnings, reviewStatuses) {
  if (!band || rate == null || rate <= 0) return;
  if (rate > band.extremeWarning) {
    warnings.push(
      `Possible pricing mismatch: ${pricingType} rate ($${rate}) looks high for this scope. Confirm this is not a full assembly or different scope.`
    );
    reviewStatuses.add(REVIEW_STATUS.SCOPE_MISMATCH);
    reviewStatuses.add(REVIEW_STATUS.MANUAL_REVIEW);
  } else if (rate > band.high) {
    warnings.push(`Review recommended: ${pricingType} rate is higher than typical for this scope.`);
    reviewStatuses.add(REVIEW_STATUS.HIGH_PRICE);
  }
}

function isAssemblyRateOnSubScope(classification, matRate, labRate, range) {
  if (classification.scopeType !== 'subScope' && classification.scopeType !== 'materialOnly') {
    return false;
  }
  const parentKey = classification.parentAssemblyCategory;
  if (!parentKey) {
    // Sub-scope priced like full project (bathroom/kitchen)
    if (classification.pricingCategory === 'bathroom' || classification.pricingCategory === 'kitchen') {
      return false;
    }
    const projectRange = getPricingRange('bathroom');
    if (
      classification.pricingCategory !== 'bathroom' &&
      classification.pricingCategory !== 'kitchen' &&
      (matRate >= (projectRange.material?.typical ?? 999) * 0.85 ||
        labRate >= (projectRange.labor?.typical ?? 999) * 0.85)
    ) {
      return true;
    }
    return false;
  }
  const parent = getPricingRange(parentKey);
  if (!parent) return false;
  return (
    matRate >= (parent.material?.low ?? 999) * 0.9 || labRate >= (parent.labor?.low ?? 999) * 0.9
  );
}

function isOutlierVsHighRange(combinedPerUnit, range) {
  const highCombined =
    (range.material?.high ?? 0) + (range.labor?.high ?? 0) || range.maxReasonablePerUnit;
  if (!highCombined || highCombined <= 0) return false;
  return combinedPerUnit > highCombined * OUTLIER_MULTIPLIER;
}

function suggestUnitFix(scopeUnit, range) {
  const u = normalizeUnit(scopeUnit);
  const allowed = range.allowedUnits || [];
  if (allowed.includes('lf') && u === 'sqft') return 'lf';
  if (allowed.includes('sqft') && u === 'lf') return 'sqft';
  if (allowed.includes('each') && (u === 'sqft' || u === 'hour')) return 'each';
  if (allowed.includes('hour') && u === 'each') return 'hour';
  if (allowed.includes('lump_sum')) return 'lump_sum';
  return allowed[0] || u;
}

/**
 * Validate proposed rates for one scope item.
 * @returns {{ warnings: string[], reviewStatuses: string[], reviewStatus: string, requiresConfirmBeforeApply: boolean, classification: object, priceRangeHint: object|null }}
 */
function validateScopeItemPricing(scopeItem, proposedRates, draft = {}, options = {}) {
  const warnings = [];
  const reviewStatuses = new Set();
  const classification = classifyScopeItem(scopeItem, draft);
  const range = getPricingRange(classification.pricingCategory);
  let requiresConfirmBeforeApply = false;

  if (!proposedRates?.length) {
    reviewStatuses.add(REVIEW_STATUS.NEEDS_PRICE);
    return {
      warnings: ['Needs manual pricing — no reliable source found.'],
      reviewStatuses: [REVIEW_STATUS.NEEDS_PRICE],
      reviewStatus: REVIEW_STATUS.NEEDS_PRICE,
      requiresConfirmBeforeApply: false,
      classification,
      priceRangeHint: buildPriceRangeHint(range, scopeItem.quantity),
    };
  }

  const scopeUnit = normalizeUnit(scopeItem.unit);
  if (!unitAllowedForCategory(scopeUnit, range) && scopeUnit !== 'lump_sum') {
    const fix = suggestUnitFix(scopeUnit, range);
    warnings.push(
      `Unit mismatch: this item may need ${fix === 'lf' ? 'LF' : fix} instead of ${scopeUnit}.`
    );
    reviewStatuses.add(REVIEW_STATUS.UNIT_MISMATCH);
  }

  const qty = scopeItem.quantity || 1;
  const usesUnitPricing = proposedRates.some(
    (r) => r.rate != null && r.rate > 0 && !r.lumpTotal && normalizeUnit(r.unit) !== 'lump_sum'
  );
  if (usesUnitPricing && (!scopeItem.quantity || scopeItem.quantity <= 0)) {
    warnings.push('Quantity missing — unit pricing requires a quantity before applying.');
    reviewStatuses.add(REVIEW_STATUS.MANUAL_REVIEW);
  }

  const matRate = proposedRates.find((r) => r.pricingType === 'material')?.rate ?? 0;
  const labRate = proposedRates.find((r) => r.pricingType === 'labor')?.rate ?? 0;
  const combinedPerUnit = matRate + labRate;
  const total = proposedRates.reduce((s, r) => s + rateTotal(r, qty), 0);

  checkRateAgainstBand(matRate, range.material, 'material', warnings, reviewStatuses);
  checkRateAgainstBand(labRate, range.labor, 'labor', warnings, reviewStatuses);

  if (range.maxReasonablePerUnit && combinedPerUnit > range.maxReasonablePerUnit) {
    if (!isNeedsApprovalScope(scopeItem)) {
      warnings.push(
        `Possible pricing mismatch: combined rate ($${combinedPerUnit}/unit) exceeds normal range for ${classification.pricingCategory.replace(/_/g, ' ')}. Confirm scope.`
      );
      reviewStatuses.add(REVIEW_STATUS.SCOPE_MISMATCH);
    }
  }

  if (isAssemblyRateOnSubScope(classification, matRate, labRate, range)) {
    const label = classification.pricingCategory.replace(/_/g, ' ');
    if (!isNeedsApprovalScope(scopeItem)) {
      warnings.push(
        `This looks high for ${label} only. Confirm this is not a full assembly or ${classification.parentAssemblyCategory?.replace(/_/g, ' ') || 'room package'}.`
      );
      reviewStatuses.add(REVIEW_STATUS.SCOPE_MISMATCH);
      requiresConfirmBeforeApply = true;
    }
  }

  if (isOutlierVsHighRange(combinedPerUnit, range)) {
    warnings.push(
      'Rate is more than 2× the high normal range — confirm before applying.'
    );
    reviewStatuses.add(REVIEW_STATUS.MANUAL_REVIEW);
    requiresConfirmBeforeApply = true;
  }

  const primarySource = proposedRates[0]?.source;
  if (ROUGH_SOURCES.has(primarySource)) {
    reviewStatuses.add(REVIEW_STATUS.SUGGESTED_ROUGH);
    if (!warnings.some((w) => /planning estimate/i.test(w))) {
      warnings.push('Planning estimate only — verify before billing.');
    }
  }

  if (SAVED_SOURCES.has(primarySource) && combinedPerUnit > 0) {
    const typicalCombined =
      (range.material?.typical ?? 0) + (range.labor?.typical ?? 0);
    const highCombined = (range.material?.high ?? 0) + (range.labor?.high ?? 0);
    if (highCombined > 0 && combinedPerUnit > highCombined) {
      warnings.push('This saved rate looks high for this scope. Review before applying.');
      reviewStatuses.add(REVIEW_STATUS.HIGH_PRICE);
    } else if (typicalCombined > 0 && combinedPerUnit > typicalCombined * 2.5) {
      warnings.push('This saved rate looks high for this scope. Review before applying.');
      reviewStatuses.add(REVIEW_STATUS.HIGH_PRICE);
    }
  }

  if (total > 2500 && classification.scopeType === 'subScope' && classification.pricingCategory === 'shower_waterproofing') {
    warnings.push('Total exceeds $2,500 for waterproofing/backer board only — verify scope.');
    reviewStatuses.add(REVIEW_STATUS.HIGH_PRICE);
  }
  if (total > 5000 && classification.pricingCategory === 'shower_waterproofing') {
    requiresConfirmBeforeApply = true;
  }

  if (
    range &&
    total > 0 &&
    !unitAllowedForCategory(scopeUnit, range) &&
    scopeUnit !== 'lump_sum'
  ) {
    requiresConfirmBeforeApply = true;
  }

  const combinedLow =
    (range.material?.low ?? 0) + (range.labor?.low ?? 0);
  const combinedHigh =
    (range.material?.high ?? 0) + (range.labor?.high ?? 0);
  if (combinedLow > 0 && total > 0 && total < combinedLow * 0.35) {
    warnings.push(
      `Total ($${Math.round(total)}) looks too low for this scope — likely a unit mismatch. Price manually or adjust quantity.`
    );
    reviewStatuses.add(REVIEW_STATUS.UNIT_MISMATCH);
    reviewStatuses.add(REVIEW_STATUS.MANUAL_REVIEW);
    requiresConfirmBeforeApply = true;
  }

  if (options.blockRoughWithoutApproval && ROUGH_SOURCES.has(primarySource)) {
    requiresConfirmBeforeApply = true;
  }

  const reviewStatus = pickPrimaryReviewStatus(reviewStatuses, proposedRates);
  return {
    warnings: [...new Set(warnings)],
    reviewStatuses: [...reviewStatuses],
    reviewStatus,
    requiresConfirmBeforeApply,
    classification,
    priceRangeHint: buildPriceRangeHint(range, scopeItem.quantity),
  };
}

function pickPrimaryReviewStatus(statuses, proposedRates) {
  if (!proposedRates?.length) return REVIEW_STATUS.NEEDS_PRICE;
  if (statuses.has(REVIEW_STATUS.NEEDS_APPROVAL)) return REVIEW_STATUS.NEEDS_APPROVAL;
  if (statuses.has(REVIEW_STATUS.MANUAL_REVIEW)) return REVIEW_STATUS.MANUAL_REVIEW;
  if (statuses.has(REVIEW_STATUS.SCOPE_MISMATCH)) return REVIEW_STATUS.SCOPE_MISMATCH;
  if (statuses.has(REVIEW_STATUS.UNIT_MISMATCH)) return REVIEW_STATUS.UNIT_MISMATCH;
  if (statuses.has(REVIEW_STATUS.HIGH_PRICE)) return REVIEW_STATUS.HIGH_PRICE;
  if (statuses.has(REVIEW_STATUS.SUGGESTED_ROUGH)) return REVIEW_STATUS.SUGGESTED_ROUGH;
  return REVIEW_STATUS.SUGGESTED_ROUGH;
}

function buildPriceRangeHint(range, quantity) {
  if (!range) return null;
  const mat = range.material;
  const lab = range.labor;
  if (!mat && !lab) return null;
  const low = (mat?.low ?? 0) + (lab?.low ?? 0);
  const high = (mat?.high ?? 0) + (lab?.high ?? 0);
  const hint = {
    unit: range.unit,
    material: mat ? { low: mat.low, typical: mat.typical, high: mat.high } : null,
    labor: lab ? { low: lab.low, typical: lab.typical, high: lab.high } : null,
    combinedPerUnit: { low, typical: (mat?.typical ?? 0) + (lab?.typical ?? 0), high },
  };
  if (quantity > 0 && low > 0 && high > 0) {
    hint.combinedTotal = { low: low * quantity, high: high * quantity };
  }
  return hint;
}

/**
 * Proposal-level validation — aggregate flags across items.
 */
function validatePricingProposal(scopeItems, draft = {}) {
  const proposalWarnings = [];
  let anyRequiresConfirm = false;
  let anyManualReview = false;

  for (const item of scopeItems || []) {
    const result = validateScopeItemPricing(item, item.proposedRates, draft);
    if (result.requiresConfirmBeforeApply) anyRequiresConfirm = true;
    if (result.reviewStatus === REVIEW_STATUS.MANUAL_REVIEW) anyManualReview = true;
  }

  if (anyManualReview) {
    proposalWarnings.push('Some items need manual review before applying this pricing.');
  }
  if (anyRequiresConfirm) {
    proposalWarnings.push('Confirm flagged items before applying — rates may not match scope.');
  }

  return {
    proposalWarnings,
    canApplyWithoutConfirm: !anyRequiresConfirm,
    requiresConfirmBeforeApply: anyRequiresConfirm,
  };
}

module.exports = {
  REVIEW_STATUS,
  validateScopeItemPricing,
  validatePricingProposal,
  buildPriceRangeHint,
  isOutlierVsHighRange,
};
