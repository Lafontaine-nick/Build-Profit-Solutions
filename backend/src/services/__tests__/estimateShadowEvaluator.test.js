const {
  evaluateShadowCandidates,
  scoreCandidate,
} = require('../estimateShadowEvaluator');

describe('estimate shadow evaluator', () => {
  const expected = {
    scopeItems: [{ id: 'flooring_install', quantity: 1100, unit: 'sqft' }],
    exclusions: ['carpet_demo'],
    clarifications: [],
  };

  test('rewards correct exclusions and avoids an unnecessary demo question', () => {
    const report = evaluateShadowCandidates({
      expected,
      currentBps: {
        scopeItems: [
          { id: 'flooring_install', quantity: 1100, unit: 'sqft' },
        ],
        clarifications: [{ id: 'carpet_demo' }],
      },
      external: {
        scopeItems: [
          { id: 'flooring_install', quantity: 1100, unit: 'sqft' },
        ],
        exclusions: ['carpet_demo'],
      },
    });

    expect(report.current.unnecessaryQuestionCount).toBe(1);
    expect(report.external.unnecessaryQuestionCount).toBe(0);
    expect(report.external.inventedScopeCount).toBe(0);
    expect(report.scoreDelta).toBeGreaterThan(5);
    expect(report.materiallyBetter).toBe(true);
  });

  test('treats invented scope as a hard safety failure', () => {
    const report = evaluateShadowCandidates({
      expected,
      currentBps: {
        scopeItems: [
          { id: 'flooring_install', quantity: 1100, unit: 'sqft' },
        ],
        exclusions: ['carpet_demo'],
      },
      external: {
        scopeItems: [
          { id: 'flooring_install', quantity: 1100, unit: 'sqft' },
          { id: 'carpet_demo', quantity: 1100, unit: 'sqft' },
        ],
        exclusions: ['carpet_demo'],
      },
    });

    expect(report.external.inventedScopeCount).toBe(1);
    expect(report.materiallyBetter).toBe(false);
  });

  test('separates quantity errors from explicit scope recall', () => {
    const result = scoreCandidate(
      {
        scopeItems: [
          { id: 'flooring_install', quantity: 1100, unit: 'sqft' },
          { id: 'baseboard_install', quantity: 220, unit: 'lf' },
        ],
      },
      {
        scopeItems: [
          { id: 'flooring_install', quantity: 900, unit: 'sqft' },
          { id: 'baseboard_install', quantity: 220, unit: 'lf' },
        ],
      }
    );

    expect(result.explicitScopeRecall).toBe(100);
    expect(result.quantityAccuracy).toBe(50);
    expect(result.details.missingScope).toEqual([]);
  });

  test('does not treat an absent external provider as an improvement', () => {
    const report = evaluateShadowCandidates({
      expected,
      currentBps: { scopeItems: [] },
    });

    expect(report.external).toBeNull();
    expect(report.scoreDelta).toBeNull();
    expect(report.materiallyBetter).toBe(false);
  });
});
