/**
 * Suggest missing prices from contractor history (priority 1).
 */

const { parseSquareFeetFromText, parseLinearFeetFromText, extractProjectSquareFeet } = require('../estimateDraftFromNotes');
const { listEntries, getSettings } = require('./storage');

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function matchTrade(entry, projectType, detectedTrades = []) {
  if (entry.trade === projectType) return true;
  if (detectedTrades.includes(entry.trade)) return true;
  if (entry.projectType === projectType) return true;
  return false;
}

function confidenceFromSampleCount(n) {
  if (n >= 4) return 'high';
  if (n >= 2) return 'medium';
  return 'low';
}

function groupKey(e) {
  return `${(e.scopeItemName || '').toLowerCase()}|${e.unitType}|${e.category}`;
}

function buildSuggestionsForDraft(draft, userId) {
  const settings = getSettings(userId);
  if (!settings.pricingMemoryEnabled) {
    return {
      enabled: false,
      suggestions: [],
      message: 'Pricing memory is disabled in settings.',
    };
  }

  const entries = listEntries(userId);
  if (entries.length === 0) {
    return {
      enabled: true,
      suggestions: [],
      message:
        'No past pricing found. Use a saved template, enter manually, or request an AI rough estimate.',
    };
  }

  const projectType = draft.projectType || 'other';
  const trades = draft.detectedTrades || [projectType];
  const notesBlob = `${draft.originalNotes || ''} ${draft.projectDescription || ''}`;
  const sqft = extractProjectSquareFeet(draft) || parseSquareFeetFromText(notesBlob);
  const lf = parseLinearFeetFromText(notesBlob);

  const relevant = entries.filter(
    (e) => !e.isTestBid && matchTrade(e, projectType, trades) && e.unitRate != null && e.unitRate > 0
  );

  const groups = new Map();
  for (const e of relevant) {
    const key = groupKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const suggestions = [];
  for (const [, group] of groups) {
    const rates = group.map((g) => g.unitRate).filter((r) => r > 0);
    const rate = median(rates);
    if (rate == null) continue;

    const sample = group[0];
    const unitType = sample.unitType || 'sqft';
    let quantity = null;
    if (unitType === 'lf' && lf) quantity = lf;
    else if (unitType === 'sqft' && sqft) quantity = sqft;
    else quantity = median(group.map((g) => g.quantity).filter((q) => q > 0));

    const estimatedTotal =
      quantity != null && quantity > 0 ? roundMoney(rate * quantity) : null;

    const tradeLabel = (sample.trade || projectType).replace(/_/g, ' ');
    suggestions.push({
      scopeItemName: sample.scopeItemName,
      category: sample.category,
      unitType,
      suggestedUnitRate: rate,
      quantity,
      estimatedTotal,
      source: 'pricing_history',
      sourceLabel: `Your past ${tradeLabel} bids`,
      sourcePriority: 1,
      label: 'Based on your past approved bids',
      confidence: confidenceFromSampleCount(group.length),
      sampleCount: group.length,
      requiresApproval: true,
      status: 'pricing_memory_suggested',
    });
  }

  suggestions.sort((a, b) => (b.sampleCount || 0) - (a.sampleCount || 0));

  const summary =
    suggestions.length > 0
      ? {
          label: 'Based on your pricing history',
          lines: suggestions.slice(0, 6).map((s) => {
            const qtyPart =
              s.quantity != null ? `${s.quantity.toLocaleString()} ${s.unitType} × ` : '';
            return `${s.scopeItemName}: ${qtyPart}$${s.suggestedUnitRate}/${s.unitType}${
              s.estimatedTotal != null ? ` ≈ ${roundMoney(s.estimatedTotal).toLocaleString()}` : ''
            } (${s.sourceLabel})`;
          }),
        }
      : null;

  return {
    enabled: true,
    suggestions: suggestions.slice(0, 12),
    summary,
    message:
      suggestions.length === 0
        ? 'No matching past pricing for this trade. Use a saved template, enter manually, or request an AI rough estimate.'
        : null,
  };
}

/**
 * Flag when actual costs exceed historical estimates (long-term learning hook).
 */
function buildActualCostInsights(userId, projectType) {
  const entries = listEntries(userId).filter(
    (e) => e.actualJobCost != null && e.unitRate != null && matchTrade(e, projectType, [])
  );
  const insights = [];
  const groups = new Map();
  for (const e of entries) {
    const key = groupKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const [key, group] of groups) {
    const withActual = group.filter((g) => g.actualJobCost != null && g.quantity > 0);
    if (withActual.length < 2) continue;
    const avgActualRate = median(
      withActual.map((g) => g.actualJobCost / g.quantity).filter((r) => r > 0)
    );
    const avgBidRate = median(group.map((g) => g.unitRate).filter((r) => r > 0));
    if (avgActualRate != null && avgBidRate != null && avgActualRate > avgBidRate * 1.08) {
      const sample = group[0];
      insights.push({
        scopeItemName: sample.scopeItemName,
        historicalBidRate: roundMoney(avgBidRate * 100) / 100,
        actualAverageRate: roundMoney(avgActualRate * 100) / 100,
        message: `Your actual cost for similar ${sample.trade?.replace(/_/g, ' ') || 'jobs'} has averaged $${roundMoney(avgActualRate * 100) / 100}/${sample.unitType}. Consider updating your default rate (you often bid $${roundMoney(avgBidRate * 100) / 100}/${sample.unitType}).`,
      });
    }
  }
  return insights.slice(0, 5);
}

module.exports = {
  buildSuggestionsForDraft,
  buildActualCostInsights,
};
