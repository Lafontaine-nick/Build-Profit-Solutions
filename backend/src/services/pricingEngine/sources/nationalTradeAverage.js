const { NATIONAL_TRADE_AVERAGES, SOURCE_LABELS } = require('../constants');
const { classifyTradeForPricing } = require('../tradeClassifier');
const { lookupFixturePlanningRates } = require('../planningQuantities');

function resolveUnitAndQuantity(scopeItem, band, draft) {
  const notes = draft?.originalNotes || '';
  const unit = band.unit;
  let quantity =
    scopeItem.quantity != null && Number(scopeItem.quantity) > 0
      ? Number(scopeItem.quantity)
      : null;

  if (quantity == null && notes) {
    const { parseSquareFeetFromText, parseLinearFeetFromText } = require('../../estimateDraftFromNotes');
    if (unit === 'sqft') quantity = parseSquareFeetFromText(`${scopeItem.scope} ${notes}`, scopeItem.scopeName);
    if (unit === 'lf') quantity = parseLinearFeetFromText(`${scopeItem.scope} ${notes}`, scopeItem.scopeName);
  }

  if (scopeItem.unit === unit && quantity > 0) return { unit, quantity };
  if (unit === 'sqft' && (scopeItem.unit === 'sqft' || scopeItem.unit === 'lump_sum') && quantity > 0) {
    return { unit: 'sqft', quantity };
  }
  if (unit === 'lf' && scopeItem.unit === 'lf' && quantity > 0) return { unit, quantity };
  if (unit === 'hour') {
    return { unit, quantity: quantity > 0 ? quantity : band.defaultQuantity || 8 };
  }
  if (unit === 'square') {
    return { unit, quantity: quantity > 0 ? quantity : band.defaultQuantity || 20 };
  }
  if (unit === 'each') {
    return { unit, quantity: quantity > 0 ? quantity : 1 };
  }
  if (quantity > 0) return { unit, quantity };
  return null;
}

/**
 * National planning midpoints by trade (material + labor). Used when saved pricing/templates do not match.
 */
function lookupNationalTradeAverage(scopeItem, context = {}) {
  const draft = context.draft || {};
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
    if (fixtureResult.available) {
      return {
        ...fixtureResult,
        sourceLabel: SOURCE_LABELS.national_trade_average,
      };
    }
    return { available: false, rates: [], trade };
  }

  const band = NATIONAL_TRADE_AVERAGES[trade] || NATIONAL_TRADE_AVERAGES.other;
  const resolved = resolveUnitAndQuantity(scopeItem, band, draft);
  if (!resolved || !resolved.quantity) {
    return { available: false, rates: [], trade };
  }

  const assumptions = [
    `National trade average for ${trade.replace(/_/g, ' ')} (planning only, not live pricing)`,
    `Typical ${band.unit} rates — verify with supplier quotes and your labor burden`,
    'Your saved bids and templates override these when they match',
  ];

  const rates = [];
  if (band.material != null && band.material > 0) {
    rates.push({
      pricingType: 'material',
      label: band.materialLabel || `${scopeItem.scopeName} material`,
      rate: band.material,
      unit: resolved.unit,
      quantity: resolved.quantity,
      confidence: 'low',
      assumptions,
    });
  }
  if (band.labor != null && band.labor > 0) {
    rates.push({
      pricingType: 'labor',
      label: band.laborLabel || `${scopeItem.scopeName} labor`,
      rate: band.labor,
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
    sourceLabel: SOURCE_LABELS.national_trade_average,
  };
}

module.exports = { lookupNationalTradeAverage, resolveUnitAndQuantity };
