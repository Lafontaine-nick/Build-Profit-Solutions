const { SOURCE_PRIORITY, SOURCE_LABELS } = require('./constants');

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

/** Per-unit rate in formulas (avoid rounding $1.91/LF up to $2/LF). */
function formatUnitRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return '$0';
  if (n >= 20) return `$${Math.round(n).toLocaleString()}`;
  const rounded = Math.round(n * 100) / 100;
  return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

function rateToProposed(scopeItem, rateRow, source) {
  const qty =
    scopeItem.quantity != null && scopeItem.quantity > 0
      ? scopeItem.quantity
      : rateRow.quantity != null && rateRow.quantity > 0
        ? rateRow.quantity
        : null;
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
    formula = `${qty.toLocaleString()} ${unit} × ${formatUnitRate(rate)}/${unit} = ${formatMoney(total)}`;
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

function summarizeRateRow(rateRow, qty) {
  if (!rateRow?.rate) return null;
  if (rateRow.lumpTotal != null && rateRow.lumpTotal > 0) {
    return {
      rate: rateRow.rate,
      unit: rateRow.unit,
      summary: `${formatMoney(rateRow.lumpTotal)} lump sum`,
    };
  }
  if (qty) {
    return {
      rate: rateRow.rate,
      unit: rateRow.unit,
      summary: `${formatUnitRate(rateRow.rate)}/${rateRow.unit || 'unit'} · ${formatMoney(roundMoney(rateRow.rate * qty))} total`,
    };
  }
  return {
    rate: rateRow.rate,
    unit: rateRow.unit,
    summary: `${formatUnitRate(rateRow.rate)}/${rateRow.unit || 'unit'}`,
  };
}

function summarizeSourceOption(sourceKey, lookup) {
  if (!lookup?.available || !lookup.rates?.length) {
    return { available: false, label: SOURCE_LABELS[sourceKey] || sourceKey, summary: 'not found' };
  }
  const qty = lookup._qty;
  const materialRow = lookup.rates.find((r) => r.pricingType === 'material');
  const laborRow = lookup.rates.find((r) => r.pricingType === 'labor');
  const material = materialRow ? summarizeRateRow(materialRow, qty) : null;
  const labor = laborRow ? summarizeRateRow(laborRow, qty) : null;
  const primary = materialRow || laborRow || lookup.rates[0];

  let summary = 'available';
  if (primary.lumpTotal != null && primary.lumpTotal > 0) {
    summary = `${formatMoney(primary.lumpTotal)} lump sum (not used for unit pricing)`;
  } else if (material && labor && qty) {
    summary = `${formatMoney(roundMoney(material.rate * qty + labor.rate * qty))} total (material + labor)`;
  } else if (material) {
    summary = material.summary;
  } else if (labor) {
    summary = labor.summary;
  } else if (primary.rate != null && qty) {
    summary = `${formatMoney(roundMoney(primary.rate * qty))} total`;
  } else if (primary.rate != null) {
    summary = `${formatUnitRate(primary.rate)}/${primary.unit || 'unit'}`;
  }

  return {
    available: true,
    label: SOURCE_LABELS[sourceKey],
    summary,
    rate: primary.rate,
    unit: primary.unit,
    material,
    labor,
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
        'national_trade_average',
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
        'national_trade_average',
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
  let blendedLaborSource = null;
  let blendedMaterialSource = null;
  let reason = '';

  for (const src of order) {
    if (src === 'supplier_pricing') {
      const lk = lookups.supplier_pricing;
      const supplierMaterial = (lk?.rates || []).filter((r) => r.pricingType === 'material');
      if (!lk?.available || !supplierMaterial.length) continue;

      const highVarianceMaterial = lk.highVarianceMaterial === true;

      let laborRates = [];
      let laborSource = null;
      for (const ls of ['saved_pricing', 'saved_template', 'company_default', 'national_trade_average']) {
        const laborLookup = lookups[ls];
        if (!laborLookup?.available || !laborLookup.rates?.length) continue;
        const found = laborLookup.rates.filter((r) => r.pricingType === 'labor');
        if (found.length) {
          laborRates = found;
          laborSource = ls;
          break;
        }
      }

      let materialRates = supplierMaterial;
      blendedMaterialSource = 'supplier_pricing';

      if (highVarianceMaterial) {
        for (const ms of ['saved_pricing', 'saved_template', 'company_default', 'national_trade_average']) {
          const matLookup = lookups[ms];
          if (!matLookup?.available || !matLookup.rates?.length) continue;
          const found = matLookup.rates.filter((r) => r.pricingType === 'material');
          if (found.length) {
            materialRates = found;
            blendedMaterialSource = ms;
            break;
          }
        }
        chosenSource = blendedMaterialSource || 'national_trade_average';
      } else {
        chosenSource = 'supplier_pricing';
      }

      blendedLaborSource = laborSource;
      chosenRates = [...materialRates, ...laborRates];

      const ref = supplierMaterial[0];
      const refRate =
        ref?.rate != null && ref?.unit
          ? `${formatUnitRate(ref.rate)}/${ref.unit} HD reference`
          : 'see comparison';

      if (highVarianceMaterial) {
        if (blendedMaterialSource === 'saved_pricing') {
          reason = `Saved material pricing for the bid. Live Home Depot reference (${refRate}) shown in comparison — many SKU tiers exist.`;
        } else if (blendedMaterialSource === 'saved_template') {
          reason = `Saved template material for the bid. Live Home Depot reference (${refRate}) shown in comparison — many SKU tiers exist.`;
        } else if (blendedMaterialSource === 'company_default') {
          reason = `Company default material for the bid. Live Home Depot reference (${refRate}) shown in comparison.`;
        } else {
          reason = `National average material for planning — tile, paint, drywall, and similar scopes have wide price ranges at Home Depot (${refRate}). Pick a SKU or use saved pricing before billing.`;
        }
        if (laborSource === 'saved_pricing') {
          reason += ' Labor from your pricing library.';
        } else if (laborSource === 'saved_template') {
          reason += ' Labor from a saved bid template.';
        } else if (laborSource === 'national_trade_average') {
          reason += ' Labor from national average — verify before billing.';
        }
      } else if (laborSource === 'saved_pricing') {
        reason =
          'Live supplier material pricing combined with saved labor from your pricing library.';
      } else if (laborSource === 'saved_template') {
        reason = 'Live supplier material pricing combined with labor from a saved bid template.';
      } else if (laborSource === 'company_default') {
        reason = 'Live supplier material pricing combined with company default labor rates.';
      } else if (laborSource === 'national_trade_average') {
        reason =
          'Live supplier material pricing combined with national average labor — verify before billing.';
      } else {
        reason =
          'Live supplier material pricing only — add labor manually or verify national average rates.';
      }
      break;
    }

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
      } else if (src === 'national_trade_average') {
        reason =
          'National trade average for material and labor from your scope — planning only. Use saved bids when you have them; verify before billing.';
      } else if (src === 'construction_cost_database') {
        reason = 'Location-adjusted construction cost database.';
      } else {
        reason =
          'No saved pricing or live source found. AI fallback assumptions for planning only.';
      }
      break;
    }
  }

  const proposedRates = chosenRates.map((r) => {
    let lineSource = chosenSource;
    if (blendedMaterialSource && r.pricingType === 'material') {
      lineSource = blendedMaterialSource;
    } else if (blendedLaborSource && r.pricingType === 'labor') {
      lineSource = blendedLaborSource;
    } else if (chosenSource === 'supplier_pricing') {
      if (r.pricingType === 'material') {
        lineSource = 'supplier_pricing';
      } else if (r.pricingType === 'labor' && blendedLaborSource) {
        lineSource = blendedLaborSource;
      }
    }
    return rateToProposed(scopeItem, r, lineSource);
  });
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
