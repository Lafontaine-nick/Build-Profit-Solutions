export type ReliabilityLine = {
  itemId?: string | null;
  checklistItemId?: string | null;
  sourceItemId?: string | null;
  costCode?: string | null;
  label?: string | null;
  name?: string | null;
  total?: number | string | null;
  amount?: number | string | null;
  price?: number | string | null;
};

export type ReliabilityStage = {
  name: string;
  lines: ReliabilityLine[];
  total?: number | string | null;
};

export type EstimateReliabilityCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type EstimateReliabilityReport = {
  passed: boolean;
  score: number;
  checks: EstimateReliabilityCheck[];
  scorecard: EstimateReliabilityScorecard;
};

export type ReliabilityDimension =
  | 'scopeIntelligence'
  | 'pricingIntegrity'
  | 'pipelineConsistency'
  | 'aiGeneralization';

export type ReliabilityDimensionScore = {
  score: number | null;
  passed: number;
  total: number;
  detail: string;
};

export type EstimateReliabilityScorecard = {
  scopeIntelligence: ReliabilityDimensionScore;
  pricingIntegrity: ReliabilityDimensionScore;
  pipelineConsistency: ReliabilityDimensionScore;
  aiGeneralization: ReliabilityDimensionScore;
  releaseConfidence: number;
};

function normalizedText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function reliabilityLineKey(line: ReliabilityLine): string {
  const explicit = [
    line.itemId,
    line.checklistItemId,
    line.sourceItemId,
    line.costCode,
  ].find(value => String(value ?? '').trim());
  return normalizedText(explicit || line.label || line.name || 'unnamed');
}

export function reliabilityLineAmount(line: ReliabilityLine): number {
  const value = Number(line.total ?? line.amount ?? line.price ?? 0);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function stageKeys(stage: ReliabilityStage): string[] {
  return stage.lines.map(reliabilityLineKey);
}

function duplicateKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

function sameKeys(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((key, index) => key === b[index]);
}

function totalOf(stage: ReliabilityStage): number {
  return Math.round(
    stage.lines.reduce((sum, line) => sum + reliabilityLineAmount(line), 0) * 100
  ) / 100;
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

function dimensionScore(
  checks: EstimateReliabilityCheck[],
  detail: string
): ReliabilityDimensionScore {
  const passed = checks.filter(check => check.passed).length;
  return {
    score: checks.length
      ? Math.round((passed / checks.length) * 1000) / 100
      : null,
    passed,
    total: checks.length,
    detail,
  };
}

function buildReliabilityScorecard(
  checks: EstimateReliabilityCheck[],
  generalization?: { passed: number; total: number }
): EstimateReliabilityScorecard {
  const byId = (predicate: (check: EstimateReliabilityCheck) => boolean) =>
    checks.filter(predicate);
  const scopeChecks = byId(
    check =>
      check.id === 'confirmed-no-duplicates' ||
      check.id === 'explicit-exclusions-stay-out' ||
      check.id.endsWith('-keys')
  );
  const pricingChecks = byId(
    check =>
      check.id === 'confirmed-total-reconciles' ||
      check.id.endsWith('-priced') ||
      check.id.endsWith('-total')
  );
  const pipelineChecks = byId(
    check =>
      check.id.endsWith('-keys') ||
      check.id.endsWith('-no-duplicates') ||
      check.id.endsWith('-total')
  );
  const aiGeneralization =
    generalization && generalization.total > 0
      ? dimensionScore(
          Array.from({ length: generalization.total }, (_, index) => ({
            id: `generalization-${index}`,
            label: 'Contractor note regression',
            passed: index < generalization.passed,
            detail: '',
          })),
          'Canonical contractor-note regression cases.'
        )
      : {
          score: null,
          passed: 0,
          total: 0,
          detail: 'No contractor-note regression cases supplied.',
        };
  const scopeIntelligence = dimensionScore(
    scopeChecks,
    'Scope lines, exclusions, and confirmed identity coverage.'
  );
  const pricingIntegrity = dimensionScore(
    pricingChecks,
    'Line pricing and total reconciliation.'
  );
  const pipelineConsistency = dimensionScore(
    pipelineChecks,
    'Confirmed scope preservation across downstream stages.'
  );
  const availableScores = [
    scopeIntelligence.score,
    pricingIntegrity.score,
    pipelineConsistency.score,
    aiGeneralization.score,
  ].filter((score): score is number => score != null);
  return {
    scopeIntelligence,
    pricingIntegrity,
    pipelineConsistency,
    aiGeneralization,
    // Release confidence is gated by the weakest measured dimension. A
    // strong aggregate must not hide one failing pipeline invariant.
    releaseConfidence: availableScores.length
      ? Math.min(...availableScores)
      : 0,
  };
}

/**
 * Checks the immutable confirmed-estimate contract across review stages.
 *
 * This is deliberately data-only so it can validate both in-memory review
 * stages and the final PDF/bid line payload without importing UI code.
 */
export function evaluateEstimateReliabilityContract(params: {
  confirmed: ReliabilityStage;
  stages: ReliabilityStage[];
  excludedKeys?: string[];
  generalization?: { passed: number; total: number };
}): EstimateReliabilityReport {
  const checks: EstimateReliabilityCheck[] = [];
  const confirmedKeys = stageKeys(params.confirmed);
  const confirmedDuplicates = duplicateKeys(confirmedKeys);
  const confirmedTotal = totalOf(params.confirmed);
  const declaredConfirmedTotal =
    params.confirmed.total == null ? confirmedTotal : Number(params.confirmed.total);

  checks.push({
    id: 'confirmed-no-duplicates',
    label: 'Confirmed scope has no duplicate lines',
    passed: confirmedDuplicates.length === 0,
    detail: confirmedDuplicates.length
      ? `Duplicate keys: ${confirmedDuplicates.join(', ')}`
      : 'No duplicate confirmed scope keys.',
  });
  checks.push({
    id: 'confirmed-total-reconciles',
    label: 'Confirmed total reconciles to its lines',
    passed: closeEnough(confirmedTotal, declaredConfirmedTotal),
    detail: `Lines total $${confirmedTotal.toFixed(2)}; declared total $${declaredConfirmedTotal.toFixed(2)}.`,
  });

  for (const stage of params.stages) {
    const keys = stageKeys(stage);
    const duplicates = duplicateKeys(keys);
    const stageTotal = totalOf(stage);
    const declaredTotal = stage.total == null ? stageTotal : Number(stage.total);
    const missing = confirmedKeys.filter(key => !keys.includes(key));
    const extra = keys.filter(key => !confirmedKeys.includes(key));
    const blankPrice = stage.lines
      .filter(line => reliabilityLineAmount(line) <= 0)
      .map(reliabilityLineKey);

    checks.push({
      id: `${stage.name}-keys`,
      label: `${stage.name} preserves confirmed scope`,
      passed: sameKeys(confirmedKeys, keys),
      detail: [
        missing.length ? `Missing: ${missing.join(', ')}` : '',
        extra.length ? `Extra: ${extra.join(', ')}` : '',
        !missing.length && !extra.length ? 'Exact confirmed scope key set.' : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
    checks.push({
      id: `${stage.name}-no-duplicates`,
      label: `${stage.name} has no duplicate lines`,
      passed: duplicates.length === 0,
      detail: duplicates.length
        ? `Duplicate keys: ${duplicates.join(', ')}`
        : 'No duplicate stage keys.',
    });
    checks.push({
      id: `${stage.name}-priced`,
      label: `${stage.name} has a price for every line`,
      passed: blankPrice.length === 0,
      detail: blankPrice.length
        ? `Missing prices: ${blankPrice.join(', ')}`
        : 'Every line has a positive price.',
    });
    checks.push({
      id: `${stage.name}-total`,
      label: `${stage.name} total matches Confirm Scope`,
      passed: closeEnough(stageTotal, confirmedTotal) &&
        closeEnough(stageTotal, declaredTotal),
      detail: `Stage lines total $${stageTotal.toFixed(2)}; declared total $${declaredTotal.toFixed(2)}; confirmed total $${confirmedTotal.toFixed(2)}.`,
    });
  }

  const excluded = new Set((params.excludedKeys || []).map(normalizedText));
  const returnedExcluded = params.stages
    .flatMap(stage => stage.lines.map(reliabilityLineKey))
    .filter(key => excluded.has(key));
  checks.push({
    id: 'explicit-exclusions-stay-out',
    label: 'Explicit exclusions stay excluded',
    passed: returnedExcluded.length === 0,
    detail: returnedExcluded.length
      ? `Excluded keys returned: ${[...new Set(returnedExcluded)].join(', ')}`
      : 'No excluded scope returned.',
  });

  const passedCount = checks.filter(check => check.passed).length;
  return {
    passed: passedCount === checks.length,
    score: Math.round((passedCount / checks.length) * 1000) / 100,
    checks,
    scorecard: buildReliabilityScorecard(checks, params.generalization),
  };
}
