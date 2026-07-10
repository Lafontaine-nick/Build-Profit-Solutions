/**
 * Construction cost database source — location-adjusted planning rates.
 *
 * Phase 1 (no licensed API key): static county/metro/state cost index applied
 * over NATIONAL_TRADE_AVERAGES. Prefer this over plain national when a location
 * is known (see recommend.js order).
 *
 * Future: set COST_DATABASE_PROVIDER=onebuild + COST_DATABASE_API_KEY to swap
 * in a live licensed adapter without changing callers.
 */

const { NATIONAL_TRADE_AVERAGES, SOURCE_LABELS } = require('../constants');
const { classifyTradeForPricing } = require('../tradeClassifier');
const { lookupFixturePlanningRates } = require('../planningQuantities');
const { resolveUnitAndQuantity } = require('./nationalTradeAverage');
const {
  resolveCountyCostFactor,
  factorToPercentLabel,
} = require('../regionalCostFactors');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function liveProviderConfigured() {
  const provider = String(process.env.COST_DATABASE_PROVIDER || '').toLowerCase();
  const key = String(process.env.COST_DATABASE_API_KEY || '').trim();
  return Boolean(provider && provider !== 'none' && key);
}

/**
 * Static county/metro/state adapter — ships without an external API key.
 */
function lookupStaticCountyRates(scopeItem, context = {}) {
  const draft = context.draft || {};
  const { isPermitsScope, savedOnlyScope } = require('../sourceValidation');
  if (isPermitsScope(scopeItem) || savedOnlyScope(scopeItem)) {
    return { available: false, rates: [], message: 'Requires manual pricing or saved rates' };
  }

  const regionZip = context.supplierZipIsFallback ? '' : context.zipCode;
  const region = resolveCountyCostFactor(context.projectLocation, regionZip);

  // Only claim the cost-database slot when we have better-than-national precision.
  if (region.isDefault || region.geographicPrecision === 'national') {
    return {
      available: false,
      rates: [],
      message: 'No project location — using national trade averages',
      geographicPrecision: 'national',
      dataSource: 'static_index',
    };
  }

  const trade =
    scopeItem.trade ||
    classifyTradeForPricing(
      scopeItem.scopeName,
      scopeItem.scope,
      draft.originalNotes,
      draft.projectType
    );

  if (trade === 'bathroom_fixture') {
    const fixtureResult = lookupFixturePlanningRates(scopeItem);
    if (!fixtureResult.available) {
      return { available: false, rates: [], trade, dataSource: 'static_index' };
    }
    const rates = (fixtureResult.rates || []).map((r) => ({
      ...r,
      rate:
        r.pricingType === 'material'
          ? round2((r.rate || 0) * region.materialFactor)
          : round2((r.rate || 0) * region.laborFactor),
      confidence: r.confidence === 'high' ? 'medium' : r.confidence || 'medium',
      assumptions: [
        ...(r.assumptions || []),
        `Location-adjusted for ${region.label} (${region.geographicPrecision}) — planning only`,
      ],
    }));
    return {
      available: rates.length > 0,
      rates,
      trade,
      region: region.region,
      regionLabel: region.label,
      geographicPrecision: region.geographicPrecision,
      dataSource: 'static_index',
      sourceLabel: SOURCE_LABELS.construction_cost_database,
    };
  }

  const band = NATIONAL_TRADE_AVERAGES[trade] || NATIONAL_TRADE_AVERAGES.other;
  const resolved = resolveUnitAndQuantity(scopeItem, band, draft);
  if (!resolved || !resolved.quantity) {
    return { available: false, rates: [], trade, dataSource: 'static_index' };
  }

  const assumptions = [
    `Construction cost database (static ${region.geographicPrecision} index) for ${trade.replace(/_/g, ' ')}`,
    `Adjusted for ${region.label} — labor ${factorToPercentLabel(region.laborFactor)}, material ${factorToPercentLabel(region.materialFactor)} vs national`,
    'Planning only — not a live licensed quote. Verify with supplier and local labor.',
  ];

  const rates = [];
  if (band.material != null && band.material > 0) {
    rates.push({
      pricingType: 'material',
      label: band.materialLabel || `${scopeItem.scopeName} material`,
      rate: round2(band.material * region.materialFactor),
      unit: resolved.unit,
      quantity: resolved.quantity,
      confidence: region.geographicPrecision === 'county' || region.geographicPrecision === 'metro' ? 'medium' : 'low',
      assumptions,
    });
  }
  if (band.labor != null && band.labor > 0) {
    rates.push({
      pricingType: 'labor',
      label: band.laborLabel || `${scopeItem.scopeName} labor`,
      rate: round2(band.labor * region.laborFactor),
      unit: resolved.unit,
      quantity: resolved.quantity,
      confidence: 'medium',
      assumptions,
    });
  }

  return {
    available: rates.length > 0,
    rates,
    trade,
    region: region.region,
    regionLabel: region.label,
    geographicPrecision: region.geographicPrecision,
    regionFactor: { labor: region.laborFactor, material: region.materialFactor, source: region.source },
    dataSource: 'static_index',
    sourceLabel: SOURCE_LABELS.construction_cost_database,
  };
}

/**
 * Licensed provider adapter stub — activates when COST_DATABASE_API_KEY is set.
 * Falls back to static county index until a real provider client is wired.
 */
async function lookupLicensedProvider(_scopeItem, _context) {
  return {
    available: false,
    rates: [],
    message: `Licensed provider "${process.env.COST_DATABASE_PROVIDER}" not yet implemented — using static county index`,
    dataSource: 'onebuild',
  };
}

/**
 * @param {object} scopeItem
 * @param {object} context
 */
function lookupCostDatabase(scopeItem, context = {}) {
  if (liveProviderConfigured()) {
    // Sync wrapper: licensed path reserved; static fills until client lands.
    const licensed = { available: false, rates: [] };
    if (licensed.available) return licensed;
  }
  return lookupStaticCountyRates(scopeItem, context);
}

module.exports = {
  lookupCostDatabase,
  lookupStaticCountyRates,
  liveProviderConfigured,
  lookupLicensedProvider,
};
