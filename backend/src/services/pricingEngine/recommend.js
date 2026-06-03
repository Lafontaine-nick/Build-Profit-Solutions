const { SOURCE_PRIORITY, SOURCE_LABELS } = require('./constants');

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

function rateToProposed(scopeItem, rateRow, source) {
  const qty = scopeItem.quantity;
  const unit = rateRow.unit || scopeItem.unit;
  const rate = rateRow.rate;
  const lump = rateRow.lumpTotal;
  let total = null;
  let formula = null;

  if (lump != null && lump > 0) {
    total = roundMoney(lump);
    formula = `${formatMoney(total)} lump sum`;
  } else if (rate != null && rate > 0 && qty != null && qty > 0) {
    total = roundMoney(rate * qty);
    formula = `${qty.toLocaleString()} ${unit} × ${formatMoney(rate)}/${unit} = ${formatMoney(total)}`;
  } else if (rate != null && rate > 0) {
    total = roundMoney(rate);
    formula = `${formatMoney(rate)}/${unit}`;
  }

  return {
    label: rateRow.label,
    pricingType: rateRow.pricingType || 'labor',
    rate: rate ?? null,
    unit,
    quantity: qty,
    total,
    formula,
    source,
    confidence: rateRow.confidence || 'medium',
    assumptions: rateRow.assumptions || [],
    requiresApproval: source !== 'user_provided',
  };
}

function summarizeSourceOption(sourceKey, lookup) {
  if (!lookup?.available || !lookup.rates?.length) {
    return { available: false, label: SOURCE_LABELS[sourceKey] || sourceKey, summary: 'not found' };
  }
  const primary = lookup.rates[0];
  const qty = lookup._qty;
  let summary = 'available';
  if (primary.lumpTotal != null && primary.lumpTotal > 0) {
    summary = `${formatMoney(primary.lumpTotal)} lump sum (not used for unit pricing)`;
  } else if (primary.rate != null && qty) {
    summary = `${formatMoney(roundMoney(primary.rate * qty))} total`;
  } else if (primary.rate != null) {
    summary = `${formatMoney(primary.rate)}/${primary.unit || 'unit'}`;
  }
  return {
    available: true,
    label: SOURCE_LABELS[sourceKey],
    summary,
    rate: primary.rate,
    unit: primary.unit,
  };
}

function pickRecommended(scopeItem, lookups, options = {}) {
  const { savedOnly = false } = options;
  const qty = scopeItem.quantity;

  const order = savedOnly
    ? ['saved_pricing', 'saved_template', 'company_default']
    : [
        'user_provided',
        'saved_pricing',
        'saved_template',
        'company_default',
        'supplier_pricing',
        'regional_labor_benchmark',
        'construction_cost_database',
        'ai_rough_estimate_fallback',
      ];

  const comparisonKeys = savedOnly
    ? ['saved_pricing', 'saved_template', 'company_default']
    : [
        'saved_pricing',
        'saved_template',
        'company_default',
        'supplier_pricing',
        'regional_labor_benchmark',
        'construction_cost_database',
        'ai_rough_estimate_fallback',
      ];

  const comparison = {};
  for (const key of comparisonKeys) {
    const lk = lookups[key];
    if (lk) {
      lk._qty = qty;
      comparison[key] = summarizeSourceOption(key, lk);
    } else {
      comparison[key] = summarizeSourceOption(key, { available: false, rates: [] });
    }
  }

  let chosenSource = null;
  let chosenRates = [];
  let reason = '';

  for (const src of order) {
    const lk = lookups[src];
    if (lk?.available && lk.rates?.length) {
      chosenSource = src;
      chosenRates = lk.rates;
      if (src === 'saved_pricing') {
        reason = 'Use saved pricing first — matched from your pricing library or past approved bids.';
      } else if (src === 'saved_template') {
        reason = 'Matched rates from a saved bid template.';
      } else if (src === 'company_default') {
        reason = 'Using company or trade default rates.';
      } else if (src === 'supplier_pricing') {
        reason = 'Using supplier/catalog material pricing.';
      } else if (src === 'regional_labor_benchmark') {
        reason =
          'Regional labor benchmark + burden/productivity assumptions — verify before billing.';
      } else if (src === 'construction_cost_database') {
        reason = 'Location-adjusted construction cost database.';
      } else {
        reason =
          'No saved pricing or live source found. AI fallback assumptions for planning only.';
      }
      break;
    }
  }

  const proposedRates = chosenRates.map((r) => rateToProposed(scopeItem, r, chosenSource));
  const confidence = proposedRates.some((p) => p.confidence === 'high')
    ? 'high'
    : proposedRates.some((p) => p.confidence === 'medium')
      ? 'medium'
      : 'low';

  return {
    comparison,
    recommended: chosenSource
      ? {
          source: chosenSource,
          sourceLabel: SOURCE_LABELS[chosenSource],
          reason,
          confidence,
          rates: proposedRates,
        }
      : null,
    proposedRates,
  };
}

module.exports = { pickRecommended, rateToProposed, roundMoney, formatMoney };
