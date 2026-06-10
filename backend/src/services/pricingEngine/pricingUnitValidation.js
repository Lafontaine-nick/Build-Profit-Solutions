/**
 * pricingUnitValidation — global quantity ↔ rate unit rules.
 * Selection behavior delegated to scopePricingMatrix.
 */

const {
  isManualPricingFallback,
  isNeedsApprovalScope,
  isAutoSelectAllowed,
  hasSavedSource,
} = require('./scopePricingMatrix');

const MANUAL_PRICING_MESSAGE =
  'Needs manual pricing — available pricing source does not match this item\u2019s unit.';

function normalizePricingUnit(raw) {
  const u = String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (!u) return 'lump_sum';
  if (u === 'sq_ft' || u === 'square_feet' || u === 'sf') return 'sqft';
  if (u === 'linear_foot' || u === 'linear_ft' || u === 'ln_ft' || u === 'linearfoot') return 'lf';
  if (u === 'lump' || u === 'lot' || u === 'flat' || u === 'allowance') return 'lump_sum';
  if (u === 'hr' || u === 'hrs' || u === 'hours') return 'hour';
  if (u === 'fixture_count' || u === 'count') return 'each';
  if (u === 'assembly_sqft') return 'sqft';
  if (u === 'square' || u === 'squares') return 'square';
  if (u === 'cy' || u === 'cubic_yard' || u === 'cubic_yards') return 'cy';
  return u;
}

function allowedPricingUnitsForQuantity(quantityUnit) {
  const q = normalizePricingUnit(quantityUnit);
  if (q === 'each') return new Set(['each', 'lump_sum', 'allowance', 'fixture_count']);
  if (q === 'sqft') return new Set(['sqft', 'assembly_sqft']);
  if (q === 'lf') return new Set(['lf', 'linear_foot', 'linear_ft']);
  if (q === 'lump_sum') return new Set(['lump_sum', 'allowance']);
  if (q === 'hour') return new Set(['hour']);
  if (q === 'square') return new Set(['square', 'sqft']);
  if (q === 'cy') return new Set(['cy', 'lump_sum']);
  if (q === 'day') return new Set(['day', 'hour', 'lump_sum']);
  return new Set([q, 'lump_sum']);
}

function isLumpSumRate(rate) {
  if (rate?.lumpTotal != null && rate.lumpTotal > 0) return true;
  const u = normalizePricingUnit(rate?.unit);
  return u === 'lump_sum' && (rate?.total > 0 || rate?.rate > 0);
}

function isRateUnitCompatibleWithQuantity(quantityUnit, rate) {
  const q = normalizePricingUnit(quantityUnit);
  const allowed = allowedPricingUnitsForQuantity(q);

  if (isLumpSumRate(rate)) {
    return q === 'lump_sum' || allowed.has('lump_sum');
  }

  const rateUnit = normalizePricingUnit(rate?.unit);
  if (!rateUnit || rateUnit === 'lump_sum') {
    return q === 'lump_sum';
  }
  return allowed.has(rateUnit);
}

function unitMismatchSubtext(quantityUnit, rateUnits) {
  const q = normalizePricingUnit(quantityUnit);
  const qLabel =
    q === 'each'
      ? 'each'
      : q === 'lf'
        ? 'LF'
        : q === 'sqft'
          ? 'sqft'
          : q === 'lump_sum'
            ? 'lump sum'
            : q;
  const rateLabel = [...rateUnits]
    .map((u) => (u === 'sqft' ? 'sqft' : u === 'lf' ? 'LF' : u))
    .join(', ');
  return `Available rate is ${rateLabel}, but this item is priced by ${qLabel}.`;
}

function scopeBlob(scopeItem) {
  return `${scopeItem.scopeName || ''} ${scopeItem.scope || ''}`.toLowerCase();
}

/** @deprecated use isManualPricingFallback from scopePricingMatrix */
function isManualPricingScope(scopeItem) {
  return isManualPricingFallback(scopeItem);
}

function validatePricingUnits(scopeItem, proposedRates) {
  const rates = proposedRates || [];
  if (!rates.length) {
    return { rates: [], blocked: false, warnings: [], unitMismatchSubtext: null };
  }

  if (isManualPricingFallback(scopeItem)) {
    if (!hasSavedSource(rates)) {
      return {
        rates: [],
        blocked: false,
        warnings: ['Needs manual pricing — no reliable source found.'],
        unitMismatchSubtext: null,
      };
    }
  }

  const quantityUnit = scopeItem.unit || 'lump_sum';
  const incompatibleRateUnits = new Set();
  const compatible = [];

  for (const rate of rates) {
    if (isRateUnitCompatibleWithQuantity(quantityUnit, rate)) {
      compatible.push(rate);
    } else if (rate.rate != null || rate.lumpTotal != null || rate.total != null) {
      incompatibleRateUnits.add(normalizePricingUnit(rate.unit || 'sqft'));
    }
  }

  if (incompatibleRateUnits.size > 0) {
    const sub = unitMismatchSubtext(quantityUnit, incompatibleRateUnits);
    return {
      rates: [],
      blocked: true,
      warnings: [MANUAL_PRICING_MESSAGE, sub],
      unitMismatchSubtext: sub,
    };
  }

  if (!compatible.length) {
    return { rates: [], blocked: false, warnings: [MANUAL_PRICING_MESSAGE], unitMismatchSubtext: null };
  }

  return { rates: compatible, blocked: false, warnings: [], unitMismatchSubtext: null };
}

function isAutoSelectEligibleScope(scopeItem) {
  return isAutoSelectAllowed(scopeItem);
}

module.exports = {
  MANUAL_PRICING_MESSAGE,
  normalizePricingUnit,
  allowedPricingUnitsForQuantity,
  isRateUnitCompatibleWithQuantity,
  validatePricingUnits,
  isManualPricingScope,
  isNeedsApprovalScope,
  isNeverAutoSelectScope: (item) => isNeedsApprovalScope(item) || isManualPricingFallback(item),
  isAutoSelectEligibleScope,
  unitMismatchSubtext,
  isLumpSumRate,
};
