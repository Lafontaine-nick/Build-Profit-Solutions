/**
 * Suggest missing prices using priority: history → templates → defaults → regional → rough.
 */

const { parseSquareFeetFromText, parseLinearFeetFromText, extractProjectSquareFeet } = require('../estimateDraftFromNotes');
const { listEntries, getSettings } = require('./storage');
const { buildSuggestionsForDraft } = require('./suggest');
const { entryMatchesMissingItem, normalizeScopeKey } = require('./normalize');

const REGIONAL_DEFAULTS = {
  flooring: { material: 3.5, labor: 4.5, unit: 'sqft' },
  bathroom: { labor: 85, material: 45, unit: 'sqft' },
  kitchen: { labor: 95, material: 55, unit: 'sqft' },
  roofing: { labor: 450, material: 350, unit: 'square' },
  concrete: { labor: 6, material: 4, unit: 'sqft' },
  painting: { labor: 2.5, material: 0.85, unit: 'sqft' },
  plumbing_service: { labor: 125, material: 75, unit: 'hour' },
  electrical: { labor: 95, material: 45, unit: 'hour' },
  other: { labor: 50, material: 35, unit: 'sqft' },
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

function suggestionsFromTemplates(templates, draft, missingLabels) {
  const suggestions = [];
  const projectType = draft.projectType || 'other';
  const sqft = extractProjectSquareFeet(draft) || parseSquareFeetFromText(draft.originalNotes);
  const lf = parseLinearFeetFromText(draft.originalNotes);

  for (const tpl of templates || []) {
    const payload = tpl.payload || tpl;
    const labor = payload.laborLineItems || [];
    const materials = payload.materialLineItems || [];
    const lines = [...labor, ...materials];
    for (const missing of missingLabels) {
      const matchLine = lines.find((line) => {
        const name = `${line.name || ''} ${line.description || ''}`.toLowerCase();
        return keywordInText(missing, name) || keywordInText(name, missing);
      });
      if (!matchLine) continue;
      const amount = Number(matchLine.total || matchLine.rate || matchLine.unitPrice || 0);
      if (amount <= 0) continue;
      suggestions.push({
        missingItem: missing,
        scopeItemName: matchLine.name || missing,
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

function keywordInText(a, b) {
  const keys = normalizeScopeKey(a).split('_').filter((k) => k.length > 3);
  const blob = b.toLowerCase();
  return keys.some((k) => blob.includes(k.replace(/_/g, ' ')) || blob.includes(k));
}

function suggestionsFromHistory(entries, draft, missingLabels) {
  const suggestions = [];
  const sqft = extractProjectSquareFeet(draft) || parseSquareFeetFromText(draft.originalNotes);
  const lf = parseLinearFeetFromText(draft.originalNotes);

  for (const missing of missingLabels) {
    const matched = entries.filter((e) => entryMatchesMissingItem(e, missing) && e.unitRate > 0);
    if (matched.length === 0) continue;
    const rate = median(matched.map((m) => m.unitRate));
    const sample = matched[0];
    const unitType = sample.unitType || 'sqft';
    let qty = unitType === 'lf' && lf ? lf : unitType === 'sqft' && sqft ? sqft : null;
    suggestions.push({
      missingItem: missing,
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

function suggestionsFromRegional(draft, missingLabels) {
  const trade = draft.detectedTrades?.[0] || draft.projectType || 'other';
  const band = REGIONAL_DEFAULTS[trade] || REGIONAL_DEFAULTS.other;
  const sqft = extractProjectSquareFeet(draft) || parseSquareFeetFromText(draft.originalNotes) || 500;
  const suggestions = [];

  for (const missing of missingLabels) {
    const blob = missing.toLowerCase();
    let rate = null;
    let category = 'labor';
    if (/\b(material|tile|lvp|cabinet|counter|fixture|supply)\b/.test(blob)) {
      rate = band.material;
      category = 'material';
    } else {
      rate = band.labor;
    }
    if (rate == null) continue;
    const qty = band.unit === 'sqft' ? sqft : band.unit === 'lf' ? parseLinearFeetFromText(draft.originalNotes) || 100 : 1;
    suggestions.push({
      missingItem: missing,
      scopeItemName: missing,
      suggestedUnitRate: rate,
      quantity: qty,
      estimatedTotal: roundMoney(rate * qty),
      unitType: band.unit,
      source: 'regional_default',
      sourceLabel: 'Regional trade assumption (review carefully)',
      sourcePriority: 4,
      label: 'AI regional default — not from your bids',
      confidence: 'low',
      requiresApproval: true,
      status: 'needs_review',
    });
  }
  return suggestions;
}

/**
 * Build per-missing-item suggestions for partial_pricing packages.
 */
function buildMissingPriceSuggestions(draft, userId, options = {}) {
  const settings = getSettings(userId);
  const missingLabels = [];
  for (const pkg of draft.scopePackages || []) {
    if (pkg.status !== 'partial_pricing' && pkg.status !== 'missing_price') continue;
    for (const item of pkg.missingPriceItems || []) {
      if (item && !missingLabels.includes(item)) missingLabels.push(String(item));
    }
    if (pkg.status === 'missing_price' && missingLabels.length === 0) {
      missingLabels.push(`${pkg.name} — full package pricing`);
    }
  }

  if (missingLabels.length === 0) {
    return { suggestions: [], message: 'No missing price items to suggest for.' };
  }

  const seen = new Set();
  const merged = [];

  const add = (list) => {
    for (const s of list) {
      const key = `${s.missingItem}|${s.sourcePriority}|${s.scopeItemName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  };

  if (settings.pricingMemoryEnabled) {
    const entries = listEntries(userId).filter((e) => !e.isTestBid);
    add(suggestionsFromHistory(entries, draft, missingLabels));
  }

  if (options.savedTemplates?.length) {
    add(suggestionsFromTemplates(options.savedTemplates, draft, missingLabels));
  }

  const uncovered = missingLabels.filter(
    (m) => !merged.some((s) => s.missingItem === m && s.sourcePriority <= 2)
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
};
