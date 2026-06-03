/**
 * Build scoped pricing proposals for Review Draft actions (saved vs rough).
 */

const { extractScopeQuantitiesForPackage } = require('../estimateDraftQuantityPrice');
const { listEntries, getSettings } = require('./storage');
const { buildSuggestionsForDraft } = require('./suggest');

const REGIONAL_ROUGH = {
  flooring: {
    demoLabor: 5,
    laminateMaterial: 4,
    laminateLabor: 5,
    baseboardMaterial: 0.85,
    baseboardLabor: 2.5,
  },
  bathroom: { allInLow: 120, allInHigh: 220 },
  kitchen: { allInLow: 150, allInHigh: 280 },
  other: { allInLow: 25, allInHigh: 75 },
};

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function packageKey(name) {
  return String(name || '').toLowerCase();
}

function findHistoryRate(entries, matchers, unitType) {
  const matched = entries.filter(
    (e) =>
      e.unitRate > 0 &&
      (unitType ? e.unitType === unitType : true) &&
      matchers.some((re) => re.test(`${e.scopeItemName} ${e.category}`))
  );
  if (matched.length === 0) return null;
  return {
    rate: median(matched.map((m) => m.unitRate)),
    sampleCount: matched.length,
  };
}

function getPackageQuantity(pkg, originalNotes) {
  const fromPkg = (pkg.scopeQuantities || [])[0];
  if (fromPkg) return fromPkg;
  const extracted = extractScopeQuantitiesForPackage(pkg.name, pkg.scope, originalNotes);
  return extracted[0] || null;
}

function addLine(lines, payload) {
  const {
    packageName,
    lineType,
    label,
    unitType,
    quantity,
    unitRate,
    priceSource,
    sourceLabel,
    confidence,
  } = payload;
  if (unitRate == null || unitRate <= 0) return;
  const qty = quantity != null && quantity > 0 ? quantity : null;
  const total = qty != null ? roundMoney(unitRate * qty) : roundMoney(unitRate);
  const formula =
    qty != null
      ? `${qty.toLocaleString()} ${unitType} × ${formatMoney(unitRate)}/${unitType} = ${formatMoney(total)}`
      : `${formatMoney(total)} lump sum`;
  lines.push({
    packageName,
    lineType,
    label,
    unitType,
    quantity: qty,
    unitRate,
    total,
    formula,
    priceSource,
    sourceLabel,
    confidence: confidence || 'medium',
    status: priceSource === 'ai_rough_estimate' ? 'rough_price' : 'pricing_memory_suggested',
    requiresApproval: true,
  });
}

function buildLinesForPackage(pkg, draft, entries, sourceMode) {
  const lines = [];
  const name = packageKey(pkg.name);
  const notes = draft.originalNotes || '';
  const qty = getPackageQuantity(pkg, notes);
  const trade = draft.projectType || 'other';
  const rough = REGIONAL_ROUGH.flooring;
  const isRough = sourceMode === 'rough';
  const priceSource = isRough ? 'ai_rough_estimate' : 'pricing_history';
  const sourceLabel = isRough
    ? 'AI Rough Estimate'
    : 'Based on your past approved bids';

  const hist = (matchers, unitType, fallbackRate) => {
    if (!isRough && entries.length > 0) {
      const h = findHistoryRate(entries, matchers, unitType);
      if (h?.rate) return { rate: h.rate, confidence: h.sampleCount >= 3 ? 'high' : 'medium' };
    }
    if (isRough && fallbackRate != null) {
      return { rate: fallbackRate, confidence: 'low' };
    }
    return null;
  };

  if (/tile|demo/.test(name)) {
    const q = qty?.unit === 'sqft' ? qty.quantity : qty?.quantity;
    const r = hist([/demo/, /removal/], 'sqft', rough.demoLabor);
    if (r && q) {
      addLine(lines, {
        packageName: pkg.name,
        lineType: 'labor',
        label: 'Tile demo',
        unitType: 'sqft',
        quantity: q,
        unitRate: r.rate,
        priceSource,
        sourceLabel,
        confidence: r.confidence,
      });
    }
    return lines;
  }

  if ((/laminate|flooring/.test(name) || /install/.test(name)) && !/baseboard/.test(name)) {
    const q = qty?.unit === 'sqft' ? qty.quantity : null;
    const mat = hist([/material/, /allowance/, /lvp/, /laminate/], 'sqft', rough.laminateMaterial);
    const lab = hist([/labor/, /install/], 'sqft', rough.laminateLabor);
    if (mat && q) {
      addLine(lines, {
        packageName: pkg.name,
        lineType: 'material',
        label: 'Laminate material allowance',
        unitType: 'sqft',
        quantity: q,
        unitRate: mat.rate,
        priceSource,
        sourceLabel,
        confidence: mat.confidence,
      });
    }
    if (lab && q) {
      addLine(lines, {
        packageName: pkg.name,
        lineType: 'labor',
        label: 'Laminate install labor',
        unitType: 'sqft',
        quantity: q,
        unitRate: lab.rate,
        priceSource,
        sourceLabel,
        confidence: lab.confidence,
      });
    }
    return lines;
  }

  if (/baseboard|trim/.test(name)) {
    const q = qty?.unit === 'lf' ? qty.quantity : null;
    const mat = hist([/material/, /baseboard/], 'lf', rough.baseboardMaterial);
    const lab = hist([/labor/, /install/], 'lf', rough.baseboardLabor);
    if (mat && q) {
      addLine(lines, {
        packageName: pkg.name,
        lineType: 'material',
        label: 'Baseboard material',
        unitType: 'lf',
        quantity: q,
        unitRate: mat.rate,
        priceSource,
        sourceLabel,
        confidence: mat.confidence,
      });
    }
    if (lab && q) {
      addLine(lines, {
        packageName: pkg.name,
        lineType: 'labor',
        label: 'Baseboard install labor',
        unitType: 'lf',
        quantity: q,
        unitRate: lab.rate,
        priceSource,
        sourceLabel,
        confidence: lab.confidence,
      });
    }
    return lines;
  }

  if (isRough && qty) {
    const band = REGIONAL_ROUGH[trade] || REGIONAL_ROUGH.other;
    const rate = (band.allInLow + band.allInHigh) / 2;
    addLine(lines, {
      packageName: pkg.name,
      lineType: 'labor',
      label: pkg.name,
      unitType: qty.unit,
      quantity: qty.quantity,
      unitRate: rate / (qty.unit === 'lf' ? 1 : 1),
      priceSource,
      sourceLabel,
      confidence: 'low',
    });
  }

  return lines;
}

function buildSavedPricingProposal(draft, userId, options = {}) {
  const settings = getSettings(userId);
  const scopePackages = draft.scopePackages || draft.rooms || [];
  const packages = Array.isArray(scopePackages) && scopePackages[0]?.scope != null
    ? scopePackages
    : (draft.rooms || []).map((r) => ({ name: r.name, scope: r.scope, scopeQuantities: r.scopeQuantities }));

  if (!settings.pricingMemoryEnabled) {
    return {
      empty: true,
      source: 'saved_pricing',
      sourceLabel: 'Based on your saved pricing',
      lines: [],
      totalSuggested: 0,
      message: 'Pricing memory is disabled in settings. Enable it or add prices manually.',
    };
  }

  const entries = listEntries(userId).filter((e) => !e.isTestBid && e.unitRate > 0);
  const memory = buildSuggestionsForDraft(draft, userId);

  const lines = [];
  for (const pkg of packages) {
    if (pkg.status && pkg.status !== 'missing_price' && pkg.price > 0) continue;
    lines.push(...buildLinesForPackage(pkg, draft, entries, 'saved'));
  }

  if (lines.length === 0 && (memory.suggestions || []).length === 0) {
    return {
      empty: true,
      source: 'saved_pricing',
      sourceLabel: 'Based on your saved pricing',
      lines: [],
      totalSuggested: 0,
      message:
        options.emptyMessage ||
        'No saved pricing found yet. You can add prices manually, use a saved bid template, or request rough AI pricing.',
    };
  }

  const totalSuggested = lines.reduce((sum, l) => sum + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'saved_pricing',
    sourceLabel: entries.length > 0 ? 'Based on your past approved bids' : 'Based on your saved pricing',
    lines,
    totalSuggested,
    message: lines.length > 0 ? null : memory.message,
    assumptions:
      entries.length > 0
        ? [`Matched ${entries.length} saved rate(s) from your pricing library`]
        : ['No historical rates matched — add pricing manually or use rough estimate'],
  };
}

function buildRoughPricingProposal(draft) {
  const scopePackages = draft.scopePackages || draft.rooms || [];
  const packages = Array.isArray(scopePackages) && scopePackages[0]?.scope != null
    ? scopePackages
    : (draft.rooms || []).map((r) => ({ name: r.name, scope: r.scope, scopeQuantities: r.scopeQuantities }));

  const lines = [];
  for (const pkg of packages) {
    lines.push(...buildLinesForPackage(pkg, draft, [], 'rough'));
  }

  const totalSuggested = lines.reduce((sum, l) => sum + l.total, 0);

  return {
    empty: lines.length === 0,
    source: 'ai_rough_estimate',
    sourceLabel: 'AI Rough Estimate',
    lines,
    totalSuggested,
    message: lines.length === 0 ? 'Could not build per-item rough pricing. Add square footage in notes.' : null,
    assumptions: [
      'Suggested prices use general trade assumptions — not from your notes or saved bids',
      'Review each rate before applying',
    ],
    disclaimer:
      'Indicative only. Approve before applying; line items will be labeled AI Rough Estimate.',
  };
}

module.exports = {
  buildSavedPricingProposal,
  buildRoughPricingProposal,
  buildLinesForPackage,
};
