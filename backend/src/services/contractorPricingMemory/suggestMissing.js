/**
 * Suggest missing prices using priority: history → templates → defaults → regional → rough.
 */

const { parseSquareFeetFromText, parseLinearFeetFromText, extractProjectSquareFeet } = require('../estimateDraftFromNotes');
const { NATIONAL_TRADE_AVERAGES } = require('../pricingEngine/constants');
const { listLibraryEntries, getSettings } = require('./storage');
const { buildSuggestionsForDraft } = require('./suggest');
const { entryMatchesMissingItem, normalizeScopeKey } = require('./normalize');

const REGIONAL_DEFAULTS = Object.fromEntries(
  Object.entries(NATIONAL_TRADE_AVERAGES).map(([trade, band]) => [
    trade,
    { material: band.material, labor: band.labor, unit: band.unit },
  ])
);

const LUMP_SUM_DEFAULTS = {
  glass: 1200,
  'shower door': 1200,
  faucet: 450,
  sink: 650,
  toilet: 550,
  vanity: 1800,
  cabinet: 8500,
  countertop: 4200,
};

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const LOOSE_KEYWORD_STOPWORDS = new Set([
  'install',
  'installation',
  'material',
  'materials',
  'labor',
  'pricing',
  'package',
  'full',
  'rate',
  'rates',
  'allowance',
  'linear',
  'feet',
  'scope',
  'item',
  'items',
  'needs',
  'review',
  'per',
  'from',
  'your',
  'bids',
  'typical',
]);

function specificKeywordKeys(label) {
  const keys = normalizeScopeKey(label).split('_').filter((k) => k.length > 3);
  const specific = keys.filter((k) => !LOOSE_KEYWORD_STOPWORDS.has(k));
  return specific.length ? specific : keys.filter((k) => !LOOSE_KEYWORD_STOPWORDS.has(k));
}

function keywordInText(a, b) {
  const keys = specificKeywordKeys(a);
  if (!keys.length) return false;
  const blob = b.toLowerCase();
  return keys.some((k) => blob.includes(k.replace(/_/g, ' ')) || blob.includes(k));
}

function templateLineMatchesMissingEntry(entry, line) {
  const name = `${line.name || ''} ${line.description || ''}`.trim();
  if (!name) return false;
  const pkg = String(entry.packageName || '').toLowerCase();
  const lineBlob = name.toLowerCase();
  if (pkg && pkg.length > 2) {
    const pkgToken = pkg.replace(/[^a-z0-9]+/g, ' ').trim();
    if (pkgToken && lineBlob.includes(pkgToken)) return true;
    if (keywordInText(entry.packageName, lineBlob)) return true;
  }
  return keywordInText(entry.label, lineBlob);
}

function quantityForContext(entry, unit) {
  const qs = entry.scopeQuantities || [];
  const match = qs.find((q) => q.unit === unit) || qs[0];
  if (match?.quantity > 0) return match.quantity;
  const scopeBlob = `${entry.scope || ''} ${entry.packageName || ''}`;
  if (unit === 'sqft') return parseSquareFeetFromText(scopeBlob) || null;
  if (unit === 'lf') return parseLinearFeetFromText(scopeBlob) || null;
  return null;
}

function entryUsesLinearFeet(entry) {
  if ((entry.scopeQuantities || []).some((q) => q.unit === 'lf' && q.quantity > 0)) return true;
  return /\b(\d[\d,]*\s*(?:linear\s*feet|ln\.?\s*ft|\blf\b))\b/i.test(
    `${entry.label} ${entry.scope || ''} ${entry.packageName || ''}`
  );
}

function inferTradeForMissing(entry) {
  const blob = `${entry.label} ${entry.scope || ''} ${entry.packageName || ''}`.toLowerCase();
  if (/\b(demo|removal|haul|tear[\s-]?out|rip[\s-]?out)\b/.test(blob)) return 'demo';
  // Baseboard/trim before paint — notes often say "install baseboards … paint and prep"
  if (
    /\b(baseboard|baseboards|trim|crown|moulding|molding|casing)\b/.test(blob) ||
    (entryUsesLinearFeet(entry) &&
      /\b(install|prep|caulk)\b/.test(blob) &&
      !/\b(tile|laminate|lvp|vinyl|carpet)\b/.test(blob))
  ) {
    return 'baseboard';
  }
  if (/\b(paint|painting|primer|repaint)\b/.test(blob)) return 'painting';
  if (/\b(plumb|faucet|drain|valve|shower|toilet|sink|pipe)\b/.test(blob)) return 'plumbing';
  if (/\b(electric|wiring|outlet|panel|light)\b/.test(blob)) return 'electrical';
  if (/\b(concrete|deck|patio|pump)\b/.test(blob)) return 'concrete';
  if (/\b(roof|shingle|flashing)\b/.test(blob)) return 'roofing';
  if (/\b(floor|lvp|laminate|carpet|tile|baseboard)\b/.test(blob)) return 'flooring';
  if (/\b(bath|shower|vanity|tub)\b/.test(blob)) return 'bathroom';
  if (/\b(kitchen|cabinet|counter|backsplash)\b/.test(blob)) return 'kitchen';
  if (entry.trade && REGIONAL_DEFAULTS[entry.trade]) return entry.trade;
  return 'other';
}

function lumpSumForMissing(label) {
  const blob = label.toLowerCase();
  for (const [key, amount] of Object.entries(LUMP_SUM_DEFAULTS)) {
    if (blob.includes(key)) return amount;
  }
  if (/\bglass\b/.test(blob) || /\bshower door\b/.test(blob)) return LUMP_SUM_DEFAULTS.glass;
  return null;
}

function collectMissingEntries(draft) {
  const entries = [];
  const seen = new Set();
  for (const pkg of draft.scopePackages || []) {
    if (pkg.status !== 'partial_pricing' && pkg.status !== 'missing_price') continue;
    for (const item of pkg.missingPriceItems || []) {
      const label = String(item || '').trim();
      if (!label) continue;
      const key = `${pkg.name}|${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        label,
        packageName: pkg.name,
        scope: pkg.scope || '',
        trade: pkg.trade || null,
        scopeQuantities: pkg.scopeQuantities || [],
      });
    }
    if (pkg.status === 'missing_price' && !(pkg.missingPriceItems || []).length) {
      const label = `${pkg.name} — full package pricing`;
      const key = `${pkg.name}|${label.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          label,
          packageName: pkg.name,
          scope: pkg.scope || '',
          trade: pkg.trade || null,
          scopeQuantities: pkg.scopeQuantities || [],
        });
      }
    }
  }
  return entries;
}

function suggestionsFromTemplates(templates, draft, missingEntries) {
  const suggestions = [];
  for (const tpl of templates || []) {
    const payload = tpl.payload || tpl;
    const labor = payload.laborLineItems || [];
    const materials = payload.materialLineItems || [];
    const lines = [...labor, ...materials];
    for (const entry of missingEntries) {
      const matchLine = lines.find((line) => templateLineMatchesMissingEntry(entry, line));
      if (!matchLine) continue;
      const amount = Number(matchLine.total || matchLine.rate || matchLine.unitPrice || 0);
      if (amount <= 0) continue;
      suggestions.push({
        missingItem: entry.label,
        packageName: entry.packageName,
        scopeItemName: matchLine.name || entry.label,
        suggestedAmount: roundMoney(amount),
        unitType: 'lump_sum',
        source: 'saved_template',
        sourceLabel: `Template: ${tpl.name || 'Saved bid'}`,
        sourcePriority: 2,
        label: 'From saved template',
        confidence: 'medium',
        requiresApproval: true,
        status: 'template_suggested',
      });
    }
  }
  return suggestions;
}

function suggestionsFromHistory(entries, draft, missingEntries) {
  const suggestions = [];
  for (const entry of missingEntries) {
    const matched = entries.filter((e) => entryMatchesMissingItem(e, entry.label) && e.unitRate > 0);
    if (matched.length === 0) continue;
    const rate = median(matched.map((m) => m.unitRate));
    const sample = matched[0];
    const unitType = sample.unitType || 'sqft';
    const qty = quantityForContext(entry, unitType);
    suggestions.push({
      missingItem: entry.label,
      packageName: entry.packageName,
      scopeItemName: sample.scopeItemName,
      suggestedUnitRate: rate,
      quantity: qty,
      estimatedTotal: qty ? roundMoney(rate * qty) : null,
      unitType,
      source: 'pricing_history',
      sourceLabel: 'Your past approved bids',
      sourcePriority: 1,
      label: 'Based on your past approved bids',
      confidence: matched.length >= 3 ? 'high' : matched.length >= 2 ? 'medium' : 'low',
      sampleCount: matched.length,
      requiresApproval: true,
      status: 'pricing_memory_suggested',
    });
  }
  return suggestions;
}

function entryWantsMaterialOnly(labelBlob) {
  return (
    /\b(material|allowance|supply|fixture)\b/.test(labelBlob) &&
    !/\b(labor|install(?:ation)?)\b/.test(labelBlob)
  );
}

function entryWantsLaborOnly(labelBlob) {
  return (
    /\b(labor|install(?:ation)?)\b/.test(labelBlob) &&
    !/\b(material|allowance|supply)\b/.test(labelBlob)
  );
}

function suggestionsFromRegional(draft, missingEntries) {
  const suggestions = [];
  const fallbackSqft =
    extractProjectSquareFeet(draft) || parseSquareFeetFromText(draft.originalNotes) || null;
  /** @type {Map<string, Set<string>>} */
  const regionalLineTypesByPackage = new Map();

  for (const entry of missingEntries) {
    const blob = entry.label.toLowerCase();
    const lump = lumpSumForMissing(entry.label);
    if (lump != null) {
      suggestions.push({
        missingItem: entry.label,
        packageName: entry.packageName,
        scopeItemName: entry.label,
        suggestedAmount: lump,
        unitType: 'lump_sum',
        source: 'regional_default',
        sourceLabel: 'Typical lump-sum allowance (review carefully)',
        sourcePriority: 4,
        label: 'AI regional default — not from your bids',
        confidence: 'low',
        requiresApproval: true,
        status: 'needs_review',
      });
      continue;
    }

    const trade = inferTradeForMissing(entry);
    const band = REGIONAL_DEFAULTS[trade] || REGIONAL_DEFAULTS.other;
    const unit = band.unit || 'sqft';
    const qty =
      quantityForContext(entry, unit) ||
      (unit === 'sqft' ? fallbackSqft : unit === 'lf' ? parseLinearFeetFromText(draft.originalNotes) : null) ||
      (unit === 'hour' ? 8 : unit === 'sqft' ? 200 : unit === 'lf' ? 100 : 1);

    const pkgKey = entry.packageName || entry.label;
    if (!regionalLineTypesByPackage.has(pkgKey)) {
      regionalLineTypesByPackage.set(pkgKey, new Set());
    }
    const seenLineTypes = regionalLineTypesByPackage.get(pkgKey);

    const pushRate = (rate, lineType, scopeItemName) => {
      if (rate == null || rate <= 0) return;
      if (seenLineTypes.has(lineType)) return;
      seenLineTypes.add(lineType);
      suggestions.push({
        missingItem: entry.label,
        packageName: entry.packageName,
        scopeItemName,
        suggestedUnitRate: rate,
        quantity: qty,
        estimatedTotal: qty ? roundMoney(rate * qty) : null,
        unitType: unit,
        lineType,
        source: 'regional_default',
        sourceLabel: `Regional ${trade.replace(/_/g, ' ')} assumption (review carefully)`,
        sourcePriority: 4,
        label: 'AI regional default — not from your bids',
        confidence: 'low',
        requiresApproval: true,
        status: 'needs_review',
      });
    };

    // Per-unit trades: one material + one labor per package (multiple missing hints share the same rates)
    if ((unit === 'lf' || unit === 'sqft') && band.material != null && band.labor != null) {
      const baseName = entry.packageName || entry.label.replace(/\s*—\s*full package pricing$/i, '');
      if (entryWantsMaterialOnly(blob)) {
        pushRate(band.material, 'material', `${baseName} material`);
      } else if (entryWantsLaborOnly(blob)) {
        pushRate(band.labor, 'labor', `${baseName} labor`);
      } else {
        pushRate(band.material, 'material', `${baseName} material`);
        pushRate(band.labor, 'labor', `${baseName} labor`);
      }
      continue;
    }

    let rate = null;
    if (/\b(material|tile|lvp|cabinet|counter|fixture|supply)\b/.test(blob) && band.material != null) {
      rate = band.material;
    } else {
      rate = band.labor;
    }
    if (rate == null) continue;

    pushRate(rate, 'labor', entry.label);
  }
  return suggestions;
}

/**
 * Build per-missing-item suggestions for partial_pricing packages.
 */
function buildMissingPriceSuggestions(draft, userId, options = {}) {
  const settings = getSettings(userId);
  const missingEntries = collectMissingEntries(draft);
  const missingLabels = missingEntries.map((e) => e.label);

  if (missingLabels.length === 0) {
    return { suggestions: [], message: 'No missing price items to suggest for.' };
  }

  const seen = new Set();
  const merged = [];

  const add = (list) => {
    for (const s of list) {
      const lineType = s.lineType || (s.unitType === 'lump_sum' ? 'lump_sum' : '');
      const key =
        lineType === 'material' || lineType === 'labor'
          ? `${s.packageName || ''}|${lineType}`
          : `${s.packageName || ''}|${lineType}|${s.scopeItemName || s.missingItem}|${s.sourcePriority}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  };

  if (settings.pricingMemoryEnabled) {
    const entries = listLibraryEntries(userId).filter((e) => !e.isTestBid);
    add(suggestionsFromHistory(entries, draft, missingEntries));
  }

  if (options.savedTemplates?.length) {
    add(suggestionsFromTemplates(options.savedTemplates, draft, missingEntries));
  }

  const uncovered = missingEntries.filter(
    (entry) =>
      !merged.some(
        (s) => s.missingItem === entry.label && s.packageName === entry.packageName && s.sourcePriority <= 2
      )
  );
  if (uncovered.length > 0) {
    add(suggestionsFromRegional(draft, uncovered));
  }

  merged.sort((a, b) => a.sourcePriority - b.sourcePriority);

  const history = buildSuggestionsForDraft(draft, userId);

  return {
    suggestions: merged,
    generalMemory: history.suggestions,
    message:
      merged.length === 0
        ? 'No past pricing found. Enter manually, use a saved template, or request an AI rough estimate.'
        : null,
  };
}

module.exports = {
  buildMissingPriceSuggestions,
  REGIONAL_DEFAULTS,
  inferTradeForMissing,
  collectMissingEntries,
};
