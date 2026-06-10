/**
 * Item-specific pricing adjustments: labels, small-job minimums, demo vs install.
 */

const { normalizePricingUnit } = require('./pricingUnitValidation');

function scopeBlob(scopeItem) {
  return `${scopeItem.scopeName || ''} ${scopeItem.scope || ''}`.toLowerCase();
}

function isShowerFloorTile(scopeItem) {
  return /\bshower\s+floor\s+tile|\bshower\s+pan\s+floor/.test(scopeBlob(scopeItem));
}

function isDemoScope(scopeItem) {
  const blob = scopeBlob(scopeItem);
  return (
    scopeItem.trade === 'demo' ||
    /\b(demo|demolition|removal|tear[\s-]?out|rip[\s-]?out)\b/.test(blob)
  );
}

function isShowerPanDemo(scopeItem) {
  const blob = scopeBlob(scopeItem);
  return /\bshower\s+pan|\bshower\s+floor|\bmud\s+pan/.test(blob) && /\b(demo|removal)/.test(blob);
}

/** Relabel demo material lines; strip tile-install material from demo rows. */
function adjustDemoRateLabels(scopeItem, rates) {
  if (!isDemoScope(scopeItem)) return rates;
  return (rates || []).map((r) => {
    if (r.pricingType === 'material') {
      return {
        ...r,
        label: isShowerPanDemo(scopeItem)
          ? 'Demo disposal / consumables'
          : 'Disposal / consumables',
      };
    }
    if (r.pricingType === 'labor') {
      return {
        ...r,
        label: isShowerPanDemo(scopeItem) ? 'Shower pan / floor demo labor' : 'Demo labor',
      };
    }
    return r;
  });
}

/** Shower floor tile small-job minimum ($600 planning default). */
function applySmallJobMinimums(scopeItem, rates) {
  if (!isShowerFloorTile(scopeItem)) return rates;
  const qty = scopeItem.quantity || 0;
  if (qty >= 40) return rates;

  const minimumTotal = 600;
  const current = (rates || []).reduce((s, r) => s + (r.total || 0), 0);
  if (current >= minimumTotal) return rates;

  const bump = minimumTotal - current;
  const out = [...rates];
  const laborIdx = out.findIndex((r) => r.pricingType === 'labor');
  if (laborIdx >= 0) {
    const lab = out[laborIdx];
    const newTotal = (lab.total || 0) + bump;
    out[laborIdx] = {
      ...lab,
      total: newTotal,
      assumptions: [
        ...(lab.assumptions || []),
        `Small shower floor tile job minimum applied ($${minimumTotal} planning floor)`,
      ],
    };
  } else if (out.length) {
    out.push({
      pricingType: 'labor',
      label: 'Shower floor tile — small job minimum labor',
      rate: bump,
      unit: 'lump_sum',
      quantity: 1,
      total: bump,
      lumpTotal: bump,
      confidence: 'low',
      assumptions: ['Small shower floor tile job minimum applied'],
    });
  }
  return out;
}

/** Painting bathroom — cap excessive totals from wrong trade bands. */
function adjustPaintingRates(scopeItem, rates) {
  const blob = scopeBlob(scopeItem);
  if (!/\bpaint|\bpainting/.test(blob) || /\b(floor|tile)\b/.test(blob)) return rates;
  const qty = scopeItem.quantity || 0;
  if (qty <= 0) return rates;

  const maxPerSqft = 5.5;
  const perSqft = (rates || []).reduce((s, r) => s + (r.rate || 0), 0);
  if (perSqft <= maxPerSqft) return rates;

  return rates.map((r) => {
    if (r.pricingType === 'material') {
      const rate = Math.min(r.rate || 0, 1.25);
      return { ...r, rate, total: Math.round(rate * qty), label: 'Paint / primer materials' };
    }
    if (r.pricingType === 'labor') {
      const rate = Math.min(r.rate || 0, 3.5);
      return { ...r, rate, total: Math.round(rate * qty), label: 'Painting labor' };
    }
    return r;
  });
}

function applyItemPricingAdjustments(scopeItem, rates) {
  let adjusted = adjustDemoRateLabels(scopeItem, rates);
  adjusted = adjustPaintingRates(scopeItem, adjusted);
  adjusted = applySmallJobMinimums(scopeItem, adjusted);
  return adjusted;
}

module.exports = {
  applyItemPricingAdjustments,
  isShowerFloorTile,
  isDemoScope,
  isShowerPanDemo,
};
