const { listEntries, getSettings } = require('../../contractorPricingMemory/storage');
const { isUnitBasedMemoryEntry, normalizeScopeUnit } = require('../unitBased');
const { getScopeWorkIntent, scoreScopeToLine } = require('../scopeIntentMatching');

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function memoryEntryToLine(entry) {
  const isMaterial =
    entry.category === 'material' ||
    /\bmaterial|allowance|supply\b/i.test(`${entry.scopeItemName || ''} ${entry.category || ''}`);
  return {
    name: entry.scopeItemName || '',
    description: entry.category || '',
    section: entry.category || '',
    category: entry.category || '',
    _source: isMaterial ? 'material' : 'labor',
  };
}

function isMaterialLine(line, source) {
  if (source === 'material') return true;
  return /material|allowance|supply/i.test(`${line.section || ''} ${line.category || ''}`);
}

function findMatchingLibraryEntries(entries, scopeItem, draft, lineSource, unitType) {
  const scopeUnit = normalizeScopeUnit(unitType || scopeItem.unit);
  const matched = [];

  for (const entry of entries) {
    if (!isUnitBasedMemoryEntry(entry)) continue;
    const entryUnit = normalizeScopeUnit(entry.unitType);
    if (scopeUnit && entryUnit && entryUnit !== scopeUnit) continue;

    const line = memoryEntryToLine(entry);
    const source = line._source;
    if (lineSource && source !== lineSource) continue;

    const score = scoreScopeToLine(scopeItem, line, source, draft);
    if (score <= 0) continue;

    matched.push({ entry, score, source });
  }

  return matched;
}

function pickLibraryRates(scopeItem, entries, draft) {
  const scopeIntent = getScopeWorkIntent(scopeItem, draft);
  const scopeUnit = normalizeScopeUnit(scopeItem.unit);
  const rates = [];

  const roles = [];
  if (scopeIntent.pricingRoles.includes('material')) roles.push('material');
  if (scopeIntent.pricingRoles.includes('labor')) roles.push('labor');
  if (!roles.length) roles.push('labor', 'material');

  for (const role of roles) {
    const matched = findMatchingLibraryEntries(entries, scopeItem, draft, role, scopeUnit);
    if (!matched.length) continue;

    matched.sort((a, b) => b.score - a.score);
    const bestScore = matched[0].score;
    const topTier = matched.filter((m) => m.score >= bestScore - 5);
    const unitRates = topTier.map((m) => m.entry.unitRate).filter((r) => r > 0);
    const med = median(unitRates);
    if (med == null) continue;

    const label =
      topTier[0].entry.scopeItemName ||
      (role === 'material' ? 'Material' : role === 'labor' ? 'Labor' : 'Rate');

    rates.push({
      pricingType: role,
      label,
      rate: med,
      unit: topTier[0].entry.unitType || scopeItem.unit,
      confidence: unitRates.length >= 3 ? 'high' : unitRates.length >= 2 ? 'medium' : 'medium',
      sampleCount: unitRates.length,
      matchScore: bestScore,
      assumptions: [
        `From your pricing library (${unitRates.length} past ${role} rate${unitRates.length === 1 ? '' : 's'})`,
        `Median $${med}/${topTier[0].entry.unitType || scopeItem.unit} × ${scopeItem.quantity?.toLocaleString?.() || scopeItem.quantity || '?'} ${scopeItem.unit || ''}`.trim(),
      ],
    });
  }

  return rates;
}

function lookupSavedPricing(scopeItem, userId, context = {}) {
  const draft = context.draft || {};
  const settings = getSettings(userId);
  if (!settings.pricingMemoryEnabled) {
    return { available: false, rates: [], message: 'Pricing memory disabled' };
  }

  const entries = listEntries(userId).filter((e) => !e.isTestBid && isUnitBasedMemoryEntry(e));
  if (!entries.length) {
    return { available: false, rates: [], message: 'No unit-based rates in pricing library yet' };
  }

  const scopeIntent = getScopeWorkIntent(scopeItem, draft);
  const rates = pickLibraryRates(scopeItem, entries, draft);

  if (!rates.length) {
    return {
      available: false,
      rates: [],
      message: `No pricing library lines matched this scope (${scopeIntent.workType}). Capture rates by applying approved bids.`,
      scopeIntent: scopeIntent.workType,
      entryCount: entries.length,
    };
  }

  return {
    available: true,
    rates,
    entryCount: entries.length,
    scopeIntent: scopeIntent.workType,
    message: 'Matched from your pricing library (past approved bids).',
  };
}

module.exports = {
  lookupSavedPricing,
  pickLibraryRates,
  findMatchingLibraryEntries,
  memoryEntryToLine,
};
