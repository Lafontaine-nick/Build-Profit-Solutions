const { SOURCE_LABELS, PRICING_DISCLAIMER } = require('./constants');

/**
 * Convert engine output to mobile PricingProposal shape.
 */
function toLegacyProposal(engineResult, options = {}) {
  const { forSaved = false } = options;
  const source = engineResult.primarySource || 'ai_rough_estimate_fallback';
  const isFallback =
    source === 'ai_rough_estimate_fallback' ||
    source === 'national_trade_average' ||
    engineResult.anyFallbackOnly;

  let sourceLabel = engineResult.primarySourceLabel || SOURCE_LABELS[source];
  if (forSaved && source === 'saved_template') {
    const n = engineResult.templateCount || 0;
    sourceLabel = n
      ? `Saved bid template (${n} on file)`
      : SOURCE_LABELS.saved_template;
  } else if (forSaved && source === 'saved_pricing') {
    sourceLabel = 'Based on your past approved bids';
  } else if (forSaved && !engineResult.anyRealSource) {
    sourceLabel = 'Saved Pricing';
  }

  return {
    empty: engineResult.empty,
    source: forSaved
      ? source === 'saved_template'
        ? 'saved_template'
        : 'saved_pricing'
      : isFallback
        ? 'ai_rough_estimate'
        : 'saved_pricing',
    sourceLabel,
    primarySource: source,
    templateCount: engineResult.templateCount,
    lines: engineResult.lines || [],
    totalSuggested: engineResult.totalSuggested || 0,
    message: engineResult.message,
    assumptions: engineResult.assumptions,
    disclaimer: engineResult.disclaimer || PRICING_DISCLAIMER,
    scopeItems: engineResult.scopeItems,
    warnings: engineResult.warnings,
    requiresConfirmBeforeApply: engineResult.requiresConfirmBeforeApply,
    canApplyWithoutConfirm: engineResult.canApplyWithoutConfirm,
    anyRealSource: engineResult.anyRealSource,
    anyFallbackOnly: engineResult.anyFallbackOnly,
    engine: true,
    supplierZip: engineResult.supplierZip,
    supplierZipIsFallback: engineResult.supplierZipIsFallback,
    supplierZipSource: engineResult.supplierZipSource,
    pricingMode: forSaved ? 'saved_only' : 'suggest',
  };
}

module.exports = { toLegacyProposal };
