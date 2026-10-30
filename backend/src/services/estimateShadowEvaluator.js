/**
 * Provider-neutral evaluator for estimate interpretation proposals.
 *
 * This module intentionally has no model, network, pricing, or persistence
 * dependency. It scores the canonical answer, the current BPS answer, and an
 * optional external-model answer without changing the live estimate pipeline.
 *
 * Candidate shape:
 * {
 *   scopeItems: [{ id, quantity?, unit? }],
 *   exclusions: ['carpet_demo'],
 *   clarifications: [{ id: 'flooring_demo' }]
 * }
 */

const DEFAULT_WEIGHTS = Object.freeze({
  explicitScopeRecall: 0.3,
  exclusionAccuracy: 0.25,
  quantityAccuracy: 0.25,
  clarificationRecall: 0.15,
  unnecessaryQuestionAvoidance: 0.05,
});

function normalizedId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function finiteQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : null;
}

function normalizedUnit(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeScopeItems(items) {
  const result = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = normalizedId(item?.id || item?.itemId || item?.scopeId);
    if (!id) continue;
    result.set(id, {
      id,
      quantity: finiteQuantity(item?.quantity),
      unit: normalizedUnit(item?.unit),
    });
  }
  return result;
}

function normalizeIdSet(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizedId)
      .filter(Boolean)
  );
}

function normalizeClarifications(values) {
  const ids = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id =
      typeof value === 'string'
        ? normalizedId(value)
        : normalizedId(value?.id || value?.scopeId || value?.targetKey);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return new Set(ids);
}

function percentage(numerator, denominator, emptyValue = 100) {
  if (denominator === 0) return emptyValue;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function scoreCandidate(expected, candidate, weights = DEFAULT_WEIGHTS) {
  const expectedScope = normalizeScopeItems(expected?.scopeItems);
  const actualScope = normalizeScopeItems(candidate?.scopeItems);
  const expectedExclusions = normalizeIdSet(expected?.exclusions);
  const actualExclusions = normalizeIdSet(candidate?.exclusions);
  const expectedQuestions = normalizeClarifications(expected?.clarifications);
  const actualQuestions = normalizeClarifications(candidate?.clarifications);

  const matchedScope = [...expectedScope.keys()].filter((id) => actualScope.has(id));
  const inventedScope = [...actualScope.keys()].filter((id) => !expectedScope.has(id));
  const explicitScopeRecall = percentage(matchedScope.length, expectedScope.size);

  const expectedExclusionHits = [...expectedExclusions].filter((id) =>
    actualExclusions.has(id)
  );
  const falsePositiveExclusions = [...actualExclusions].filter(
    (id) => !expectedExclusions.has(id)
  );
  const exclusionAccuracy =
    expectedExclusions.size === 0 && actualExclusions.size === 0
      ? 100
      : percentage(
          expectedExclusionHits.length,
          expectedExclusions.size + falsePositiveExclusions.length
        );

  const expectedQuantities = [...expectedScope.entries()].filter(
    ([, item]) => item.quantity != null || item.unit
  );
  const quantityHits = expectedQuantities.filter(([id, expectedItem]) => {
    const actualItem = actualScope.get(id);
    if (!actualItem) return false;
    const quantityMatches =
      expectedItem.quantity == null ||
      (actualItem.quantity != null &&
        Math.abs(actualItem.quantity - expectedItem.quantity) < 0.01);
    const unitMatches =
      !expectedItem.unit || actualItem.unit === expectedItem.unit;
    return quantityMatches && unitMatches;
  });
  const quantityAccuracy = percentage(
    quantityHits.length,
    expectedQuantities.length
  );

  const clarificationHits = [...expectedQuestions].filter((id) =>
    actualQuestions.has(id)
  );
  const unnecessaryQuestions = [...actualQuestions].filter(
    (id) => !expectedQuestions.has(id)
  );
  const clarificationRecall = percentage(
    clarificationHits.length,
    expectedQuestions.size
  );
  const unnecessaryQuestionAvoidance = percentage(
    actualQuestions.size - unnecessaryQuestions.length,
    actualQuestions.size
  );

  const weightedScore = Math.round(
    (explicitScopeRecall * weights.explicitScopeRecall +
      exclusionAccuracy * weights.exclusionAccuracy +
      quantityAccuracy * weights.quantityAccuracy +
      clarificationRecall * weights.clarificationRecall +
      unnecessaryQuestionAvoidance * weights.unnecessaryQuestionAvoidance) *
      10
  ) / 10;

  return {
    weightedScore,
    explicitScopeRecall,
    exclusionAccuracy,
    quantityAccuracy,
    clarificationRecall,
    unnecessaryQuestionAvoidance,
    inventedScopeCount: inventedScope.length,
    inventedScopeRate: percentage(inventedScope.length, actualScope.size, 0),
    falsePositiveExclusionCount: falsePositiveExclusions.length,
    unnecessaryQuestionCount: unnecessaryQuestions.length,
    counts: {
      expectedScope: expectedScope.size,
      actualScope: actualScope.size,
      expectedExclusions: expectedExclusions.size,
      actualExclusions: actualExclusions.size,
      expectedClarifications: expectedQuestions.size,
      actualClarifications: actualQuestions.size,
    },
    details: {
      matchedScope,
      inventedScope,
      missingScope: [...expectedScope.keys()].filter(
        (id) => !actualScope.has(id)
      ),
      falsePositiveExclusions,
      missingExclusions: [...expectedExclusions].filter(
        (id) => !actualExclusions.has(id)
      ),
      unnecessaryQuestions,
      missingClarifications: [...expectedQuestions].filter(
        (id) => !actualQuestions.has(id)
      ),
    },
  };
}

/**
 * Compare BPS and an external provider against the same canonical answer.
 *
 * `materiallyBetter` is deliberately conservative: the external proposal must
 * improve the weighted score by the requested margin and introduce no
 * invented scope. The caller can apply a stricter gate for production.
 */
function evaluateShadowCandidates({
  expected,
  currentBps,
  external,
  improvementThreshold = 5,
  weights = DEFAULT_WEIGHTS,
}) {
  const current = scoreCandidate(expected, currentBps, weights);
  const externalScore = external
    ? scoreCandidate(expected, external, weights)
    : null;
  const scoreDelta =
    externalScore == null
      ? null
      : Math.round((externalScore.weightedScore - current.weightedScore) * 10) /
        10;

  return {
    current,
    external: externalScore,
    scoreDelta,
    materiallyBetter: Boolean(
      externalScore &&
        scoreDelta >= improvementThreshold &&
        externalScore.inventedScopeCount === 0 &&
        externalScore.falsePositiveExclusionCount === 0
    ),
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  normalizeScopeItems,
  scoreCandidate,
  evaluateShadowCandidates,
};
