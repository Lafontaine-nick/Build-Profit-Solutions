const { listEntries, getSettings } = require('../../contractorPricingMemory/storage');
const { isUnitBasedMemoryEntry } = require('../unitBased');
const { getScopeWorkIntent } = require('../scopeIntentMatching');

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function entryText(entry) {
  return `${entry.scopeItemName || ''} ${entry.category || ''}`.toLowerCase();
}

function entryMatchesIntent(entry, scopeItem, draft, pricingRole) {
  const scopeIntent = getScopeWorkIntent(scopeItem, draft);
  const text = entryText(entry);
  const isMaterial =
    entry.category === 'material' || /\bmaterial|allowance\b/.test(text);
  const isLabor =
    entry.category === 'labor' || /\blabor\b/.test(text) || (!isMaterial && !entry.category);

  if (pricingRole === 'material' && !isMaterial) return false;
  if (pricingRole === 'labor' && isMaterial) return false;

  if (scopeIntent.workType === 'demo') {
    return /\b(demo|demolition|removal|tear)\b/.test(text) && !/\binstall\b/.test(text);
  }

  if (scopeIntent.workType === 'install') {
    if (/\b(demo|demolition|removal)\b/.test(text) && !/\binstall/.test(text)) return false;
    if (/\b(laminate|lvp|flooring|floor|install)\b/.test(text)) return true;
    if (/\btile\b/.test(text) && !/\b(demo|demolition|removal)\b/.test(text)) return true;
    if (/\b(baseboard|trim)\b/.test(text)) return true;
    return false;
  }

  return true;
}

function findHistoryRate(entries, scopeItem, draft, pricingRole, unitType) {
  const matched = entries.filter(
    (e) =>
      isUnitBasedMemoryEntry(e) &&
      (unitType ? e.unitType === unitType : true) &&
      entryMatchesIntent(e, scopeItem, draft, pricingRole)
  );
  if (!matched.length) return null;
  return {
    rate: median(matched.map((m) => m.unitRate)),
    sampleCount: matched.length,
    confidence: matched.length >= 3 ? 'high' : 'medium',
  };
}

function lookupSavedPricing(scopeItem, userId, context = {}) {
  const draft = context.draft || {};
  const settings = getSettings(userId);
  if (!settings.pricingMemoryEnabled) {
    return { available: false, rates: [], message: 'Pricing memory disabled' };
  }
  const entries = listEntries(userId).filter((e) => !e.isTestBid && isUnitBasedMemoryEntry(e));
  const scopeIntent = getScopeWorkIntent(scopeItem, draft);
  const rates = [];

  if (scopeItem.unit === 'sqft') {
    if (scopeIntent.workType === 'demo') {
      const h = findHistoryRate(entries, scopeItem, draft, 'labor', 'sqft');
      if (h) {
        rates.push({
          pricingType: 'labor',
          label: 'Demo labor',
          rate: h.rate,
          unit: 'sqft',
          confidence: h.confidence,
          sampleCount: h.sampleCount,
        });
      }
    } else if (scopeIntent.workType === 'install' || /flooring|laminate|tile/i.test(scopeItem.scopeName)) {
      const mat = findHistoryRate(entries, scopeItem, draft, 'material', 'sqft');
      const lab = findHistoryRate(entries, scopeItem, draft, 'labor', 'sqft');
      if (mat) {
        rates.push({
          pricingType: 'material',
          label: 'Material',
          rate: mat.rate,
          unit: 'sqft',
          confidence: mat.confidence,
          sampleCount: mat.sampleCount,
        });
      }
      if (lab) {
        rates.push({
          pricingType: 'labor',
          label: 'Install labor',
          rate: lab.rate,
          unit: 'sqft',
          confidence: lab.confidence,
          sampleCount: lab.sampleCount,
        });
      }
    }
  } else if (scopeItem.unit === 'lf' && scopeIntent.workType === 'install') {
    const mat = findHistoryRate(entries, scopeItem, draft, 'material', 'lf');
    const lab = findHistoryRate(entries, scopeItem, draft, 'labor', 'lf');
    if (mat) {
      rates.push({
        pricingType: 'material',
        label: 'Trim material',
        rate: mat.rate,
        unit: 'lf',
        confidence: mat.confidence,
        sampleCount: mat.sampleCount,
      });
    }
    if (lab) {
      rates.push({
        pricingType: 'labor',
        label: 'Trim labor',
        rate: lab.rate,
        unit: 'lf',
        confidence: lab.confidence,
        sampleCount: lab.sampleCount,
      });
    }
  }

  return {
    available: rates.length > 0,
    rates,
    entryCount: entries.length,
    scopeIntent: scopeIntent.workType,
  };
}

module.exports = { lookupSavedPricing, findHistoryRate, entryMatchesIntent };
