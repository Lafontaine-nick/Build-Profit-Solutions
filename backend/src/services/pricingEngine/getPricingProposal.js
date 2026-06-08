const { scopeItemsFromDraft } = require('./scopeFromDraft');
const { SOURCE_LABELS, PRICING_DISCLAIMER, DEFAULT_SUPPLIER_ZIP } = require('./constants');
const { pickRecommended, roundMoney } = require('./recommend');
const { lookupSavedPricing } = require('./sources/savedPricing');
const { lookupSavedTemplate } = require('./sources/savedTemplate');
const { lookupCompanyDefault } = require('./sources/companyDefault');
const { lookupSupplierPricing } = require('./sources/supplierPricing');
const { lookupNationalTradeAverage } = require('./sources/nationalTradeAverage');
const { lookupCostDatabase } = require('./sources/costDatabase');
const { lookupAiFallback } = require('./sources/aiFallback');

/** Resolve ZIP from request, draft field, or originalNotes (e.g. "zip code 89141"). */
function resolveZipFromDraft(draft, zipCode = '') {
  const explicit = String(zipCode || draft?.zipCode || draft?.customerZip || '').trim();
  if (/^\d{5}(-\d{4})?$/.test(explicit)) return explicit.slice(0, 5);
  const notes = String(draft?.originalNotes || draft?.projectDescription || '');
  const labeled = notes.match(/\b(?:zip\s*(?:code)?|zipcode)\s*[:.]?\s*(\d{5})\b/i);
  if (labeled) return labeled[1];
  const bare = notes.match(/\b(\d{5})\b/);
  return bare ? bare[1] : '';
}

/** Always return a ZIP for supplier lookup; flag when using default fallback. */
function resolveSupplierZipContext(draft, zipCode = '') {
  const userZip = resolveZipFromDraft(draft, zipCode);
  if (userZip) {
    const fromRequest = /^\d{5}/.test(String(zipCode || '').trim());
    const fromDraftField = /^\d{5}/.test(String(draft?.zipCode || draft?.customerZip || '').trim());
    const fromNotes = !fromRequest && !fromDraftField;
    return {
      zipCode: userZip,
      supplierZipIsFallback: false,
      supplierZipSource: fromRequest ? 'bid' : fromDraftField ? 'draft' : fromNotes ? 'notes' : 'bid',
    };
  }
  return {
    zipCode: DEFAULT_SUPPLIER_ZIP,
    supplierZipIsFallback: true,
    supplierZipSource: 'default',
  };
}

/**
 * @param {object} params
 * @param {object} params.draft - enriched estimate draft
 * @param {string} [params.userId]
 * @param {string} [params.companyId]
 * @param {string} [params.projectLocation]
 * @param {string} [params.zipCode]
 * @param {Array} [params.savedTemplates]
 * @param {object} [params.companyDefaultRates]
 * @param {'suggest'|'saved_only'} [params.mode]
 */
async function getPricingProposal(params) {
  const {
    draft,
    userId = 'dev-user-1',
    projectLocation = '',
    zipCode = '',
    savedTemplates = [],
    companyDefaultRates = null,
    mode = 'suggest',
  } = params;

  const supplierZipCtx = resolveSupplierZipContext(draft, zipCode);
  const context = {
    userId,
    companyId: params.companyId,
    projectLocation: projectLocation || draft.projectAddress || draft.customerState || '',
    zipCode: supplierZipCtx.zipCode,
    supplierZipIsFallback: supplierZipCtx.supplierZipIsFallback,
    supplierZipSource: supplierZipCtx.supplierZipSource,
    savedTemplates,
    companyDefaultRates,
  };

  const scopeItems = scopeItemsFromDraft(draft).filter((s) => !s.hasUserPrice);
  const items = [];
  const warnings = [];
  let anyRealSource = false;
  let anyFallbackOnly = true;

  const supplierLookups =
    mode === 'saved_only'
      ? []
      : await Promise.all(scopeItems.map((scopeItem) => lookupSupplierPricing(scopeItem, context)));

  for (let i = 0; i < scopeItems.length; i++) {
    const scopeItem = scopeItems[i];
    const lookups = {
      saved_pricing: lookupSavedPricing(scopeItem, userId, { draft }),
      saved_template: lookupSavedTemplate(scopeItem, savedTemplates, {
        draft,
        userId,
      }),
      company_default: lookupCompanyDefault(scopeItem, context),
      supplier_pricing:
        mode === 'saved_only'
          ? { available: false, rates: [] }
          : supplierLookups[i] || { available: false, rates: [] },
      national_trade_average: lookupNationalTradeAverage(scopeItem, { ...context, draft }),
      construction_cost_database: lookupCostDatabase(scopeItem, context),
      ai_rough_estimate_fallback: lookupAiFallback(scopeItem),
    };

    const { comparison, recommended, proposedRates } = pickRecommended(scopeItem, lookups, {
      savedOnly: mode === 'saved_only',
    });

    const isSavedSource =
      recommended?.source === 'saved_pricing' || recommended?.source === 'saved_template';
    if (mode === 'saved_only') {
      if (isSavedSource) {
        anyRealSource = true;
        anyFallbackOnly = false;
      }
    } else if (
      recommended?.source &&
      recommended.source !== 'ai_rough_estimate_fallback' &&
      recommended.source !== 'national_trade_average'
    ) {
      anyRealSource = true;
      anyFallbackOnly = false;
    }

    if (!recommended?.rates?.length) {
      warnings.push(`No pricing source available for ${scopeItem.scopeName}`);
    }

    const itemWarnings =
      !proposedRates.length && mode === 'saved_only'
        ? ['No saved pricing or bid template matched this item.']
        : !proposedRates.length
          ? ['No saved pricing or live pricing source was found. Use manual entry or AI fallback.']
          : [];

    items.push({
      scopeItemId: scopeItem.scopeItemId,
      scopeName: scopeItem.scopeName,
      quantity: scopeItem.quantity,
      unit: scopeItem.unit,
      proposedRates,
      comparison,
      recommended: recommended
        ? {
            source: recommended.source,
            sourceLabel: recommended.sourceLabel,
            reason: recommended.reason,
            confidence: recommended.confidence,
          }
        : null,
      warnings: itemWarnings,
    });
  }

  const allLines = items.flatMap((it) =>
    (it.proposedRates || []).map((p) => ({
      packageName: it.scopeName,
      lineType: p.pricingType === 'material' ? 'material' : p.pricingType === 'lump_sum' ? 'lump_sum' : 'labor',
      label: p.label,
      unitType: p.unit || it.unit,
      quantity: p.quantity,
      unitRate: p.rate,
      total: p.total || 0,
      formula: p.formula,
      priceSource: p.source,
      sourceLabel: SOURCE_LABELS[p.source] || p.source,
      confidence: p.confidence,
      status: p.source === 'ai_rough_estimate_fallback' ? 'rough_price' : 'pricing_memory_suggested',
      requiresApproval: p.requiresApproval !== false,
    }))
  );

  const totalSuggested = allLines.reduce((s, l) => s + (l.total || 0), 0);
  const sourceSet = [...new Set(items.map((i) => i.recommended?.source).filter(Boolean))];
  const priorityOrder = [
    'saved_pricing',
    'saved_template',
    'company_default',
    'supplier_pricing',
    'national_trade_average',
    'construction_cost_database',
    'ai_rough_estimate_fallback',
  ];
  const primarySource =
    priorityOrder.find((s) => sourceSet.includes(s)) || 'ai_rough_estimate_fallback';

  return {
    mode,
    scopeItems: items,
    lines: allLines,
    totalSuggested: roundMoney(totalSuggested),
    empty: allLines.length === 0,
    primarySource,
    primarySourceLabel: SOURCE_LABELS[primarySource] || 'Pricing Engine',
    anyRealSource,
    anyFallbackOnly: !anyRealSource && allLines.length > 0,
    message: allLines.length
      ? null
      : mode === 'saved_only'
        ? 'You have not saved pricing for this scope yet. Add prices manually or request suggested pricing.'
        : 'Could not build pricing from available sources.',
    assumptions: [
      mode === 'saved_only'
        ? anyRealSource
          ? 'Rates matched your pricing library and/or saved bid templates only.'
          : 'No saved pricing or templates matched this scope.'
        : anyRealSource
          ? 'Some rates matched saved pricing or templates — review before applying.'
          : 'No saved pricing matched; national trade averages shown for planning — verify before bidding.',
    ],
    templateCount: (savedTemplates || []).length,
    disclaimer: PRICING_DISCLAIMER,
    warnings,
    supplierZip: context.zipCode,
    supplierZipIsFallback: context.supplierZipIsFallback,
    supplierZipSource: context.supplierZipSource,
  };
}

module.exports = { getPricingProposal, resolveZipFromDraft, resolveSupplierZipContext };
