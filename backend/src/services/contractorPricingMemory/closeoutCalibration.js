/**
 * Phase 3 — actuals feedback loop.
 *
 * On job close-out: map expenses → estimate lines, compute variance / rate
 * suggestions, write actualJobCost onto pricing-memory entries for the project,
 * and optionally capture bidStatus: 'completed' so learnOnCompleted matters.
 *
 * Approvals are explicit — this never auto-overwrites unit rates.
 */

const { listEntries, updateEntry, upsertEntries } = require('./storage');
const { buildActualCostInsights } = require('./suggest');

/** Lazy require to avoid circular dependency with index.js */
function capturePricingMemory(userId, payload) {
  return require('./index').capturePricingMemory(userId, payload);
}

const CLOSEOUT_VERSION = '1.0.0';
const RATE_VARIANCE_THRESHOLD = 0.08; // 8% — matches buildActualCostInsights
const MIN_ACTUAL_FOR_SUGGESTION = 1;

function positive(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function roundRate(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isApprovedChangeOrder(co) {
  return Boolean(co?.approved) || /approved|accepted/i.test(String(co?.status || ''));
}

/**
 * Sum change-order amounts that should be excluded from calibration evidence.
 * Approved COs are excluded by default (excludeFromCalibration !== false).
 */
function changeOrderExclusionTotal(changeOrders = []) {
  return (changeOrders || []).reduce((sum, co) => {
    const exclude = co?.excludeFromCalibration !== false;
    if (!exclude) return sum;
    if (!isApprovedChangeOrder(co) && co?.excludeFromCalibration !== true) return sum;
    const direct =
      positive(co.directCost) ||
      sumDefined(co.materialsAmount, co.laborAmount) ||
      positive(co.amount) ||
      0;
    return sum + direct;
  }, 0);
}

function sumDefined(...vals) {
  let total = 0;
  let any = false;
  for (const v of vals) {
    const n = positive(v);
    if (n != null) {
      total += n;
      any = true;
    }
  }
  return any ? total : null;
}

function matchExpensesToLine(line, expenses) {
  const lineId = String(line.id || '');
  const lineCat = normalizeText(line.category);
  return (expenses || []).filter((expense) => {
    if (expense.linkedLineId && String(expense.linkedLineId) === lineId) return true;
    if (lineCat && normalizeText(expense.category) === lineCat) return true;
    return false;
  });
}

function buildScopeComparisons({ lines = [], expenses = [], changeOrders = [] }) {
  const coExclusion = changeOrderExclusionTotal(changeOrders);
  const comparisons = [];
  const unmatchedExpenses = [];

  const matchedExpenseIds = new Set();

  for (const line of lines) {
    const matched = matchExpensesToLine(line, expenses);
    matched.forEach((e) => matchedExpenseIds.add(String(e.id)));

    const estimated =
      positive(line.qty) && positive(line.unitCost)
        ? Number(line.qty) * Number(line.unitCost)
        : positive(line.unitCost) || positive(line.estimatedTotal) || null;

    const actualRaw = matched.reduce((sum, e) => sum + (positive(e.amount) || 0), 0);
    const actual = actualRaw > 0 ? actualRaw : null;
    if (estimated == null && actual == null) continue;

    const qty = positive(line.qty);
    const estimatedUnitRate = positive(line.unitCost);
    const actualUnitRate =
      actual != null && qty != null && qty > 0 ? roundRate(actual / qty) : null;

    let variancePct = null;
    if (estimated != null && estimated > 0 && actual != null) {
      variancePct = roundRate(((actual - estimated) / estimated) * 100);
    }

    let classification = 'other';
    if (actual == null) classification = 'mapping_uncertainty';
    else if (variancePct != null && Math.abs(variancePct) < 5) classification = 'unit_rate_variance';
    else if (estimatedUnitRate != null && actualUnitRate != null) classification = 'unit_rate_variance';
    else if (variancePct != null) classification = 'unit_rate_variance';

    comparisons.push({
      scopeItemKey: String(line.id || normalizeText(line.category) || line.description),
      name: line.description || line.category || 'Scope item',
      trade: line.category || 'other',
      category: line.category || 'other',
      unit: line.unit || null,
      quantity: qty,
      estimatedTotal: estimated != null ? roundMoney(estimated) : null,
      actualTotal: actual != null ? roundMoney(actual) : null,
      estimatedUnitRate,
      actualUnitRate,
      variancePct,
      classification,
      mappingStatus: matched.length
        ? matched.some((e) => e.linkedLineId)
          ? 'exact_match'
          : 'likely_match'
        : 'unmatched',
      expenseIds: matched.map((e) => e.id),
      comparable: estimated != null && actual != null,
    });
  }

  for (const expense of expenses || []) {
    if (!matchedExpenseIds.has(String(expense.id))) {
      unmatchedExpenses.push({
        id: expense.id,
        category: expense.category || null,
        description: expense.description || null,
        amount: positive(expense.amount),
      });
    }
  }

  return { comparisons, unmatchedExpenses, changeOrderExclusionTotal: roundMoney(coExclusion) };
}

function buildRateSuggestions(comparisons, { projectId, estimateId }) {
  const suggestions = [];
  for (const c of comparisons) {
    if (!c.comparable || c.actualUnitRate == null || c.estimatedUnitRate == null) continue;
    if (c.quantity == null || c.quantity < MIN_ACTUAL_FOR_SUGGESTION) continue;
    const delta =
      Math.abs(c.actualUnitRate - c.estimatedUnitRate) / Math.max(c.estimatedUnitRate, 0.01);
    if (delta < RATE_VARIANCE_THRESHOLD) continue;

    const reason =
      c.actualUnitRate > c.estimatedUnitRate
        ? 'consistent_underestimate'
        : 'consistent_overestimate';

    suggestions.push({
      suggestionId: `closeout:${projectId}:${c.scopeItemKey}`,
      scopeItemKey: c.scopeItemKey,
      scopeItemName: c.name,
      trade: c.trade,
      category: c.category,
      unit: c.unit || 'each',
      currentRate: c.estimatedUnitRate,
      suggestedRate: c.actualUnitRate,
      target: 'saved_rate',
      reason,
      confidence: c.mappingStatus === 'exact_match' ? 'medium' : 'low',
      variancePct: c.variancePct,
      evidence: [
        {
          projectId,
          estimateId: estimateId || null,
          estimatedTotal: c.estimatedTotal,
          actualTotal: c.actualTotal,
          quantity: c.quantity,
        },
      ],
      message:
        c.actualUnitRate > c.estimatedUnitRate
          ? `Actual cost ran ~${Math.abs(c.variancePct)}% over estimate for ${c.name}. Consider raising your saved rate from $${c.estimatedUnitRate}/${c.unit || 'unit'} to ~$${c.actualUnitRate}/${c.unit || 'unit'}.`
          : `Actual cost ran ~${Math.abs(c.variancePct)}% under estimate for ${c.name}. Consider lowering your saved rate from $${c.estimatedUnitRate}/${c.unit || 'unit'} to ~$${c.actualUnitRate}/${c.unit || 'unit'}.`,
    });
  }
  return suggestions;
}

function projectSummary(comparisons, expenses, finalCustomerPrice) {
  const comparable = comparisons.filter((c) => c.comparable);
  const estimatedSum = comparable.reduce((s, c) => s + (c.estimatedTotal || 0), 0);
  const actualSum = comparable.reduce((s, c) => s + (c.actualTotal || 0), 0);
  const totalActual =
    (expenses || []).reduce((s, e) => s + (positive(e.amount) || 0), 0) || actualSum;
  const coverage =
    comparisons.length === 0
      ? 0
      : Math.round((comparable.length / comparisons.length) * 1000) / 10;
  let overallVariancePct = null;
  if (estimatedSum > 0) {
    overallVariancePct = roundRate(((actualSum - estimatedSum) / estimatedSum) * 100);
  }
  const profit =
    positive(finalCustomerPrice) != null
      ? roundMoney(Number(finalCustomerPrice) - totalActual)
      : null;
  const marginPct =
    positive(finalCustomerPrice) != null && Number(finalCustomerPrice) > 0
      ? roundRate((profit / Number(finalCustomerPrice)) * 100)
      : null;

  return {
    mappedActualCoveragePercent: coverage,
    comparableScopeCount: comparable.length,
    totalScopeCount: comparisons.length,
    estimatedMappedTotal: roundMoney(estimatedSum),
    actualMappedTotal: roundMoney(actualSum),
    totalActualCost: roundMoney(totalActual),
    overallVariancePct,
    finalCustomerPrice: positive(finalCustomerPrice) || null,
    finalProfit: profit,
    finalProfitMarginPct: marginPct,
  };
}

function statusFor(summary, suggestions, unmatched) {
  if (!summary.totalActualCost || summary.comparableScopeCount === 0) {
    return 'insufficient_data';
  }
  if (summary.mappedActualCoveragePercent < 40 || unmatched.length > summary.comparableScopeCount) {
    return 'partial';
  }
  if (suggestions.length > 0) return 'ready_for_review';
  return 'reviewed';
}

/**
 * Write actualJobCost onto pricing-memory entries for this project (and
 * scope-name matches when projectId is missing on older entries).
 */
function writeActualsToPricingMemory(userId, { projectId, comparisons, summary }) {
  const entries = listEntries(userId);
  let updated = 0;
  const byProject = entries.filter((e) => String(e.projectId || '') === String(projectId));

  for (const comparison of comparisons) {
    if (comparison.actualTotal == null) continue;
    const nameNorm = normalizeText(comparison.name);
    const catNorm = normalizeText(comparison.category);

    const candidates = (byProject.length ? byProject : entries).filter((e) => {
      const scopeNorm = normalizeText(e.scopeItemName);
      if (!scopeNorm) return false;
      if (nameNorm && (scopeNorm.includes(nameNorm) || nameNorm.includes(scopeNorm))) return true;
      if (catNorm && scopeNorm.includes(catNorm)) return true;
      if (catNorm && normalizeText(e.trade) === catNorm) return true;
      return false;
    });

    for (const entry of candidates) {
      const patch = {
        actualJobCost: comparison.actualTotal,
        bidStatus: 'completed',
      };
      if (summary.finalProfitMarginPct != null) {
        patch.finalProfitMargin = summary.finalProfitMarginPct;
      }
      const next = updateEntry(userId, entry.id, patch);
      if (next) updated += 1;
    }
  }

  // If nothing matched by name but we have project-level actuals, stamp
  // project entries with a proportional share so buildActualCostInsights can fire.
  if (updated === 0 && byProject.length && summary.totalActualCost > 0) {
    const share = roundMoney(summary.totalActualCost / byProject.length);
    for (const entry of byProject) {
      updateEntry(userId, entry.id, {
        actualJobCost: share,
        bidStatus: 'completed',
        finalProfitMargin: summary.finalProfitMarginPct,
      });
      updated += 1;
    }
  }

  return { updated };
}

/**
 * Run close-out calibration for a completed job.
 *
 * @param {string} userId
 * @param {object} payload
 * @param {string} payload.projectId
 * @param {boolean} [payload.completionConfirmed]
 * @param {Array} [payload.lines] budget/estimate lines
 * @param {Array} [payload.expenses]
 * @param {Array} [payload.changeOrders]
 * @param {number} [payload.finalCustomerPrice]
 * @param {number} [payload.plannedBudget]
 * @param {string} [payload.estimateId]
 * @param {string} [payload.projectType]
 * @param {object} [payload.draft] optional draft for completed capture
 * @param {object} [payload.bid] optional bid for completed capture
 * @param {boolean} [payload.applyActualsToMemory=true]
 * @param {boolean} [payload.captureCompleted=true]
 */
function runCloseoutCalibration(userId, payload = {}) {
  const projectId = String(payload.projectId || '').trim();
  if (!projectId) {
    throw new Error('projectId is required');
  }
  if (payload.completionConfirmed !== true) {
    throw new Error('completionConfirmed must be true to run close-out calibration');
  }

  const lines = payload.lines || [];
  const expenses = payload.expenses || [];
  const changeOrders = (payload.changeOrders || []).map((co) => ({
    ...co,
    excludeFromCalibration: co.excludeFromCalibration !== false,
  }));

  const { comparisons, unmatchedExpenses, changeOrderExclusionTotal: coExcluded } =
    buildScopeComparisons({ lines, expenses, changeOrders });

  const summary = projectSummary(comparisons, expenses, payload.finalCustomerPrice);
  const rateSuggestions = buildRateSuggestions(comparisons, {
    projectId,
    estimateId: payload.estimateId,
  });

  const status = statusFor(summary, rateSuggestions, unmatchedExpenses);

  let memoryWrite = { updated: 0 };
  if (payload.applyActualsToMemory !== false) {
    memoryWrite = writeActualsToPricingMemory(userId, {
      projectId,
      comparisons,
      summary,
    });
  }

  let captureResult = null;
  if (payload.captureCompleted !== false && (payload.draft || payload.bid)) {
    captureResult = capturePricingMemory(userId, {
      draft: payload.draft,
      bid: payload.bid,
      meta: {
        bidStatus: 'completed',
        projectId,
        estimateId: payload.estimateId || null,
        projectTitle: payload.projectTitle || null,
        region: payload.region || null,
        marginPct: summary.finalProfitMarginPct,
      },
    });
  }

  // Also upsert lightweight completed entries from comparisons when no draft/bid
  // was provided but we have comparable actuals — keeps learnOnCompleted useful.
  if (
    payload.captureCompleted !== false &&
    !payload.draft &&
    !payload.bid &&
    comparisons.some((c) => c.actualTotal != null)
  ) {
    const synthetic = comparisons
      .filter((c) => c.actualTotal != null && c.estimatedUnitRate != null)
      .map((c) => ({
        projectType: payload.projectType || 'other',
        trade: normalizeText(c.trade).replace(/\s+/g, '_') || 'other',
        category: /labor/i.test(c.category) ? 'labor' : /material/i.test(c.category) ? 'material' : 'labor',
        scopeItemName: c.name,
        unitType: c.unit || 'lump_sum',
        quantity: c.quantity,
        unitRate: c.estimatedUnitRate,
        totalAmount: c.estimatedTotal,
        actualJobCost: c.actualTotal,
        finalProfitMargin: summary.finalProfitMarginPct,
        pricingSource: 'user_provided',
        bidStatus: 'completed',
        projectId,
        estimateId: payload.estimateId || null,
      }));
    if (synthetic.length) {
      const upserted = upsertEntries(userId, synthetic);
      captureResult = {
        captured: upserted.added + upserted.updated,
        added: upserted.added,
        updated: upserted.updated,
        total: upserted.total,
        source: 'closeout_synthetic',
      };
    }
  }

  const insights = buildActualCostInsights(userId, payload.projectType || 'other');

  return {
    version: CLOSEOUT_VERSION,
    projectId,
    estimateId: payload.estimateId || null,
    status,
    confidence:
      status === 'ready_for_review' || status === 'reviewed'
        ? summary.mappedActualCoveragePercent >= 70
          ? 'medium'
          : 'low'
        : 'low',
    summary: {
      ...summary,
      changeOrderExclusionTotal: coExcluded,
    },
    scopeComparisons: comparisons,
    unmatchedExpenses,
    rateSuggestions,
    pendingSuggestionCount: rateSuggestions.length,
    memoryWrite,
    capture: captureResult,
    actualCostInsights: insights,
    closedAt: new Date().toISOString(),
    message:
      status === 'insufficient_data'
        ? 'Not enough mapped actuals yet — add expenses linked to budget lines, then re-run close-out.'
        : rateSuggestions.length
          ? `${rateSuggestions.length} rate suggestion${rateSuggestions.length === 1 ? '' : 's'} ready for review. Actuals were written to pricing memory; rates are not changed until you approve.`
          : 'Close-out recorded. Actuals written to pricing memory; no rate changes suggested.',
  };
}

/**
 * Approve one or more calibration suggestions — updates saved unit rates.
 */
function approveCalibrationSuggestions(userId, { suggestionIds = [], suggestions = [], role = 'manager' } = {}) {
  const allowed = new Set(['manager', 'admin', 'owner']);
  if (!allowed.has(String(role || '').toLowerCase())) {
    throw new Error('Role cannot approve calibration (manager, admin, or owner required)');
  }

  const toApply = suggestions.filter(
    (s) => !suggestionIds.length || suggestionIds.includes(s.suggestionId)
  );
  if (!toApply.length) {
    return { approved: 0, rates: [], message: 'No suggestions to approve' };
  }

  const entries = listEntries(userId);
  const updatedRates = [];

  for (const suggestion of toApply) {
    const nameNorm = normalizeText(suggestion.scopeItemName);
    const match =
      entries.find((e) => e.id === suggestion.rateId) ||
      entries.find((e) => {
        const scopeNorm = normalizeText(e.scopeItemName);
        return nameNorm && (scopeNorm.includes(nameNorm) || nameNorm.includes(scopeNorm));
      });

    if (match) {
      const next = updateEntry(userId, match.id, {
        unitRate: suggestion.suggestedRate,
        bidStatus: match.bidStatus || 'completed',
      });
      if (next) {
        updatedRates.push({
          id: next.id,
          scopeItemName: next.scopeItemName,
          previousRate: suggestion.currentRate,
          unitRate: next.unitRate,
          changeReason: 'actual_cost_calibration',
        });
      }
    } else {
      // Create a new library rate from the suggestion
      const upserted = upsertEntries(userId, [
        {
          scopeItemName: suggestion.scopeItemName,
          trade: suggestion.trade || 'other',
          projectType: suggestion.trade || 'other',
          category: suggestion.category || 'labor',
          unitType: suggestion.unit || 'each',
          unitRate: suggestion.suggestedRate,
          pricingSource: 'user_provided',
          bidStatus: 'completed',
          projectId: suggestion.evidence?.[0]?.projectId || null,
        },
      ]);
      updatedRates.push({
        id: null,
        scopeItemName: suggestion.scopeItemName,
        previousRate: suggestion.currentRate,
        unitRate: suggestion.suggestedRate,
        changeReason: 'actual_cost_calibration',
        created: upserted.added > 0,
      });
    }
  }

  return {
    approved: updatedRates.length,
    rates: updatedRates,
    message:
      updatedRates.length > 0
        ? `Updated ${updatedRates.length} saved rate${updatedRates.length === 1 ? '' : 's'} from actual-cost calibration.`
        : 'No matching rates found to update.',
  };
}

module.exports = {
  CLOSEOUT_VERSION,
  runCloseoutCalibration,
  approveCalibrationSuggestions,
  buildScopeComparisons,
  buildRateSuggestions,
  normalizeText,
};
