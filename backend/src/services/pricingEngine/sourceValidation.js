/**
 * Validate suggested pricing sources per scope item.
 * Prevents vendor live / generic rates from attaching to unrelated trades.
 */

const PLANNING_DISCLAIMER =
  'Suggested prices are planning estimates. Verify scope, material selections, labor rates, taxes, permits, overhead, and markup before sending to a client.';

const SOURCE_TYPE_MAP = {
  saved_pricing: 'saved_pricing',
  saved_template: 'saved_template',
  company_default: 'saved_pricing',
  supplier_pricing: 'vendor_live',
  national_trade_average: 'national_average',
  regional_labor_benchmark: 'regional_labor',
  construction_cost_database: 'regional_labor',
  ai_rough_estimate_fallback: 'ai_rough',
  ai_rough_estimate: 'ai_rough',
  user_provided: 'saved_pricing',
  manually_entered: 'saved_pricing',
};

const SOURCE_NAME_MAP = {
  saved_pricing: 'Saved contractor pricing',
  saved_template: 'Saved bid template',
  company_default: 'Company default rates',
  supplier_pricing: 'Home Depot',
  national_trade_average: 'National planning average',
  regional_labor_benchmark: 'BLS wage benchmark',
  construction_cost_database: 'Regional cost database',
  ai_rough_estimate_fallback: 'AI rough estimate',
  ai_rough_estimate: 'AI rough estimate',
};

function scopeBlob(scopeItem) {
  return `${scopeItem.scopeName || ''} ${scopeItem.scope || ''}`.toLowerCase();
}

function isPlumbingTrimScope(scopeItem) {
  return /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb/.test(scopeBlob(scopeItem));
}

function isElectricalTrimScope(scopeItem) {
  return /\belectrical\s+trim|\bdevices.*\bplates/.test(scopeBlob(scopeItem));
}

function isPermitsScope(scopeItem) {
  return /\bpermits?\b|\binspection\s+fees?/.test(scopeBlob(scopeItem));
}

function isCleanupScope(scopeItem) {
  return /\bcleanup|\bdisposal|\bhaul[\s-]?off|\bdumpster|\bjobsite\s+clean/.test(scopeBlob(scopeItem));
}

function isDrywallRepairScope(scopeItem) {
  return /\bdrywall\b.*\b(repair|patch|patching)\b|\bpatch.*\bdrywall/.test(scopeBlob(scopeItem));
}

function isBaseboardTrimScope(scopeItem) {
  if (isPlumbingTrimScope(scopeItem) || isElectricalTrimScope(scopeItem)) return false;
  const blob = scopeBlob(scopeItem);
  return (
    scopeItem.trade === 'baseboard' ||
    /\bbaseboard|\btrim install|\bcrown|\bmoulding|\bmolding|\bcasing/.test(blob)
  );
}

function isLumpSumUnit(unit) {
  const u = String(unit || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  return u === 'lump_sum' || u === 'lump' || u === 'lot' || u === 'allowance';
}

function vendorLiveAllowedForScope(scopeItem) {
  if (isPlumbingTrimScope(scopeItem)) return false;
  if (isElectricalTrimScope(scopeItem)) return false;
  if (isCleanupScope(scopeItem)) return false;
  if (isPermitsScope(scopeItem)) return false;
  if (isDrywallRepairScope(scopeItem) && scopeItem.unit !== 'sqft') return false;
  if (isLumpSumUnit(scopeItem.unit) && !isBaseboardTrimScope(scopeItem)) return false;
  return isBaseboardTrimScope(scopeItem) || scopeItem.trade === 'flooring' || /\btile\b|\blaminate|\blvp|\bpaint\b|\bcarpet|\bcountertop|\bdrywall\b/.test(scopeBlob(scopeItem));
}

function savedOnlyScope(scopeItem) {
  return (
    isPermitsScope(scopeItem) ||
    isPlumbingTrimScope(scopeItem) ||
    isElectricalTrimScope(scopeItem) ||
    isCleanupScope(scopeItem)
  );
}

function cleanupTemplateLineLabel(rate) {
  return `${rate.label || ''} ${rate.name || ''} ${rate.description || ''}`.toLowerCase();
}

function cleanupTemplateLineValid(rate) {
  return /\b(cleanup|disposal|dumpster|haul[\s-]?off|final\s+clean|jobsite\s+clean)\b/.test(
    cleanupTemplateLineLabel(rate)
  );
}

function mapSourceType(source) {
  return SOURCE_TYPE_MAP[source] || 'ai_rough';
}

function mapSourceName(source) {
  return SOURCE_NAME_MAP[source] || 'Planning estimate';
}

function enrichProposedRate(rate, scopeItem) {
  const sourceType = mapSourceType(rate.source);
  const sourceName = mapSourceName(rate.source);
  const isRough = sourceType === 'ai_rough' || rate.source === 'national_trade_average';
  return {
    ...rate,
    sourceType,
    sourceName,
    sourceDate: null,
    disclaimerText: isRough ? PLANNING_DISCLAIMER : `${sourceName} — ${PLANNING_DISCLAIMER}`,
    requiresApproval: true,
    planningEstimate: isRough || rate.source === 'national_trade_average',
  };
}

function rateIsInvalidForScope(scopeItem, rate) {
  if (rate.pricingType === 'labor' && rate.source === 'supplier_pricing') return true;
  if (rate.source === 'supplier_pricing' && !vendorLiveAllowedForScope(scopeItem)) return true;
  if (isLumpSumUnit(scopeItem.unit) && rate.unit && !isLumpSumUnit(rate.unit) && rate.rate != null) {
    if (!rate.lumpTotal && rate.pricingType === 'material') return true;
  }
  if (savedOnlyScope(scopeItem) && !['saved_pricing', 'saved_template', 'company_default'].includes(rate.source)) {
    return true;
  }
  if (isCleanupScope(scopeItem) && rate.source === 'saved_template' && !cleanupTemplateLineValid(rate)) {
    return true;
  }
  const cleanupAmount = rate.lumpTotal ?? rate.total ?? rate.rate ?? 0;
  if (
    isCleanupScope(scopeItem) &&
    isLumpSumUnit(scopeItem.unit) &&
    cleanupAmount > 0 &&
    cleanupAmount < 50
  ) {
    return true;
  }
  if (
    isCleanupScope(scopeItem) &&
    isLumpSumUnit(scopeItem.unit) &&
    rate.rate != null &&
    rate.rate > 0 &&
    rate.rate < 50 &&
    !rate.lumpTotal
  ) {
    return true;
  }
  return false;
}

/**
 * @returns {{ proposedRates, recommended, warnings, confidence }}
 */
function validateScopeItemSuggestion(scopeItem, proposedRates, recommended) {
  const warnings = [];
  let rates = (proposedRates || []).filter((r) => !rateIsInvalidForScope(scopeItem, r));

  if (savedOnlyScope(scopeItem)) {
    const hasSaved = rates.some((r) =>
      ['saved_pricing', 'saved_template', 'company_default'].includes(r.source)
    );
    if (!hasSaved) {
      return {
        proposedRates: [],
        recommended: null,
        warnings: ['Needs manual pricing — no reliable source found.'],
        confidence: 'low',
      };
    }
  }

  if (!rates.length) {
    return {
      proposedRates: [],
      recommended: null,
      warnings: ['Needs manual pricing — no reliable source found.'],
      confidence: 'low',
    };
  }

  rates = rates.map((r) => enrichProposedRate(r, scopeItem));

  let confidence = recommended?.confidence || 'medium';
  if (rates.some((r) => r.source === 'ai_rough_estimate_fallback')) confidence = 'low';
  else if (rates.every((r) => r.source === 'national_trade_average')) confidence = 'low';
  else if (rates.some((r) => r.source === 'supplier_pricing')) confidence = 'medium';
  else if (rates.some((r) => ['saved_pricing', 'saved_template'].includes(r.source))) confidence = 'high';

  if (recommended?.source === 'supplier_pricing' && !vendorLiveAllowedForScope(scopeItem)) {
    const primary = rates[0]?.source;
    recommended = {
      ...recommended,
      source: primary,
      sourceLabel: mapSourceName(primary),
      reason: 'Vendor live pricing not used — scope item requires saved or manual pricing.',
      confidence,
    };
  } else if (recommended) {
    recommended = {
      ...recommended,
      sourceType: mapSourceType(recommended.source),
      sourceName: mapSourceName(recommended.source),
      confidence,
      disclaimerText: PLANNING_DISCLAIMER,
    };
  }

  if (rates.some((r) => r.planningEstimate)) {
    warnings.push('Planning estimate — verify before billing.');
  }

  return { proposedRates: rates, recommended, warnings, confidence };
}

module.exports = {
  PLANNING_DISCLAIMER,
  scopeBlob,
  isPlumbingTrimScope,
  isElectricalTrimScope,
  isPermitsScope,
  isCleanupScope,
  isDrywallRepairScope,
  isBaseboardTrimScope,
  isLumpSumUnit,
  vendorLiveAllowedForScope,
  savedOnlyScope,
  validateScopeItemSuggestion,
  enrichProposedRate,
  mapSourceType,
  mapSourceName,
};
