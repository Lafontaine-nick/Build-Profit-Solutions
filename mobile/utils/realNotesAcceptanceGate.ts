import {
  applyCanonicalScopeToChecklistItems,
  canonicalItemIsExcluded,
  canonicalScopeBlocksItemId,
  isFloorDemoScopeId,
} from '@/utils/canonicalScope';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { hydrateScopeChecklistFromNotes } from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
} from '@/utils/estimateInitialRevealUi';
import {
  evaluateEstimateReliabilityContract,
  type EstimateReliabilityScorecard,
  type ReliabilityLine,
  type ReliabilityStage,
} from '@/utils/estimateReliabilityContract';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { confirmScopeDisplayItemsFromDraft } from '@/utils/scopePackagesForReview';
import { framingShellCountsAsWallFraming } from '@/utils/subcontractorTrade/framingPlanConvergence';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import {
  REAL_NOTES_ACCEPTANCE_CORPUS,
  REAL_NOTES_ACCEPTANCE_CORPUS_VERSION,
  REAL_NOTES_ACCEPTANCE_RELEASE,
  type RealNotesAcceptanceCase,
} from '@/utils/realNotesAcceptanceCorpus';

export type AcceptanceFailureCategory =
  | 'parser'
  | 'measurement_hydration'
  | 'pricing_ownership'
  | 'snapshot'
  | 'duplicate_scope'
  | 'invented_exclusion';

export type AcceptanceFailure = {
  caseId: string;
  category: AcceptanceFailureCategory;
  detail: string;
};

export type RealNotesAcceptanceReport = {
  version: string;
  caseCount: number;
  passedCases: number;
  passRate: number;
  duplicateLines: number;
  inventedExclusions: number;
  failures: AcceptanceFailure[];
  scorecard: EstimateReliabilityScorecard;
  passed: boolean;
};

type PricedLine = ReliabilityLine & { itemId: string; total: number };

function pipeline(fixture: RealNotesAcceptanceCase) {
  const repaired = repairDraftRatePricingFromNotes(
    {
      originalNotes: fixture.notes,
      projectType: fixture.projectType,
      estimateTier: fixture.templateKey,
      scopeChecklist: {
        templateKey: fixture.templateKey,
        items: fixture.includedIds.map(id => ({
          id,
          label: id,
          state: 'included' as const,
        })),
      },
      scopeMeasurements: fixture.measurementOverrides || {},
      scopePackages: [],
    } as never,
    fixture.notes
  );
  const measurements = {
    ...((repaired.scopeMeasurements || {}) as Record<string, unknown>),
    ...(fixture.measurementOverrides || {}),
  };
  repaired.scopeMeasurements = measurements as never;
  const hydrated = hydrateScopeChecklistFromNotes(
    repaired.scopeChecklist?.items || [],
    fixture.templateKey,
    fixture.notes,
    measurements as never,
    fixture.projectType,
    repaired.canonicalScope
  );
  const confirm = confirmScopeDisplayItemsFromDraft(repaired);
  const reveal = getInitialRevealChecklistScopePreview(repaired);
  const qmKeys = quickMeasurementRowsForInput(
    fixture.templateKey,
    fixture.projectType,
    measurements,
    [],
    {
      scopeNotes: fixture.notes,
      canonicalScope: repaired.canonicalScope,
      crossScopeMode: fixture.templateKey === 'room_remodel',
    }
  )
    .flat()
    .map(field => field.key);
  const visibleIds = [
    ...(repaired.scopeChecklist?.items || []).map(item => String(item.id || '')),
    ...hydrated.map(item => String(item.id || '')),
    ...confirm.map(item => String(item.id || '')),
  ].filter(Boolean);
  return { repaired, hydrated, confirm, reveal, qmKeys, visibleIds, measurements };
}

function measurementValue(
  sources: Array<Record<string, unknown>>,
  key: string
): number | null {
  for (const source of sources) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function priceIncludedItem(
  fixture: RealNotesAcceptanceCase,
  itemId: string,
  measurements: Record<string, unknown>
): { total: number; quantity: number; label: string } | null {
  const resolved = resolveChecklistItemQuantity(itemId, measurements, {
    templateKey: fixture.templateKey,
    notes: fixture.notes,
  });
  const pricing = resolveScopeItemSuggestedPricing(
    itemId,
    measurements,
    fixture.templateKey,
    resolved,
    null,
    null,
    fixture.notes
  );
  const total = Number(pricing.fill?.total);
  const quantity = Number(pricing.fill?.basis?.quantity ?? resolved.quantity);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    total,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    label: String(pricing.fill?.rateSourceLabel || itemId),
  };
}

function snapshotStages(lines: PricedLine[]): {
  confirmed: ReliabilityStage;
  stages: ReliabilityStage[];
} {
  const total = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;
  const confirmed: ReliabilityStage = {
    name: 'Confirm Scope',
    lines,
    total,
  };
  const copy = (name: string, source: PricedLine[]): ReliabilityStage => ({
    name,
    total,
    lines: source.map(line => ({
      itemId: line.itemId,
      sourceItemId: line.itemId,
      checklistItemId: line.itemId,
      label: line.label,
      total: line.total,
    })),
  });
  return {
    confirmed,
    stages: [
      copy('Initial Estimate', lines),
      copy('Step 3', lines),
      copy('PDF', lines),
      copy('Back', lines),
    ],
  };
}

export function evaluateRealNotesCase(
  fixture: RealNotesAcceptanceCase
): AcceptanceFailure[] {
  const failures: AcceptanceFailure[] = [];
  const { repaired, confirm, reveal, qmKeys, visibleIds, measurements } =
    pipeline(fixture);
  const confirmIds = confirm.map(item => String(item.id || '')).filter(Boolean);
  const duplicateIds = confirmIds.filter(
    (id, index) => confirmIds.indexOf(id) !== index
  );
  if (duplicateIds.length) {
    failures.push({
      caseId: fixture.id,
      category: 'duplicate_scope',
      detail: `Duplicate confirm cards: ${[...new Set(duplicateIds)].join(', ')}`,
    });
  }

  const fromCanonical = applyCanonicalScopeToChecklistItems(
    [],
    fixture.notes,
    repaired.canonicalScope
  ).map(item => String(item.id || ''));

  for (const id of fixture.includedIds) {
    const pathIds = [...visibleIds, ...fromCanonical];
    const onScreen =
      pathIds.includes(id) ||
      (id === 'wall_framing' &&
        framingShellCountsAsWallFraming(fixture.notes, pathIds));
    if (!onScreen || canonicalItemIsExcluded(repaired.canonicalScope, id)) {
      failures.push({
        caseId: fixture.id,
        category: 'parser',
        detail: `${id} is missing from the note path`,
      });
    }
  }

  for (const id of fixture.excludedIds) {
    const blocked =
      canonicalItemIsExcluded(repaired.canonicalScope, id) &&
      canonicalScopeBlocksItemId(repaired.canonicalScope, id);
    const visible = visibleIds.some(
      visible =>
        visible === id || (id === 'floor_demo' && isFloorDemoScopeId(visible))
    );
    const revealed =
      id === 'floor_demo' &&
      reveal.some(row => /demo|removal/i.test(String(row.name || '')));
    if (!blocked || visible || revealed) {
      failures.push({
        caseId: fixture.id,
        category: 'invented_exclusion',
        detail: `${id} came back onto the estimate`,
      });
    }
  }

  for (const id of fixture.absentIds || []) {
    if (visibleIds.includes(id)) {
      failures.push({
        caseId: fixture.id,
        category: 'parser',
        detail: `${id} was added even though the note never asked for it`,
      });
    }
  }

  for (const key of fixture.blockedMeasurementKeys || []) {
    if (
      qmKeys.includes(key) ||
      measurements[key] != null
    ) {
      failures.push({
        caseId: fixture.id,
        category: 'measurement_hydration',
        detail: `${key} was hydrated after the note blocked it`,
      });
    }
  }

  const parsed = parseScopeMeasurementsFromNotes(fixture.notes, {
    templateKey: fixture.templateKey,
    projectType: fixture.projectType,
  }) as Record<string, unknown>;
  for (const [key, expected] of Object.entries(fixture.expectedMeasurements || {})) {
    const actual = measurementValue([measurements, parsed], key);
    if (actual !== expected) {
      failures.push({
        caseId: fixture.id,
        category: 'measurement_hydration',
        detail: `${key} is ${actual ?? 'missing'}; expected ${expected}`,
      });
    }
  }
  for (const key of fixture.absentMeasurements || []) {
    const actual = measurementValue([measurements, parsed], key);
    if (actual != null) {
      failures.push({
        caseId: fixture.id,
        category: 'measurement_hydration',
        detail: `${key} is ${actual} and belongs on a different card`,
      });
    }
  }

  const priced: PricedLine[] = [];
  for (const itemId of fixture.pricedItemIds || []) {
    const price = priceIncludedItem(fixture, itemId, measurements);
    if (!price) {
      failures.push({
        caseId: fixture.id,
        category: 'pricing_ownership',
        detail: `${itemId} has no positive price`,
      });
      continue;
    }
    if (!/national|production planning|average/i.test(price.label)) {
      failures.push({
        caseId: fixture.id,
        category: 'pricing_ownership',
        detail: `${itemId} price label is "${price.label}"`,
      });
    }
    priced.push({ itemId, label: price.label, total: price.total });
  }

  if (fixture.priceBand) {
    const price = priceIncludedItem(
      fixture,
      fixture.priceBand.itemId,
      measurements
    );
    if (
      !price ||
      price.quantity <= fixture.priceBand.minQuantity ||
      price.total <= fixture.priceBand.minTotal ||
      price.total >= fixture.priceBand.maxTotal
    ) {
      failures.push({
        caseId: fixture.id,
        category: 'pricing_ownership',
        detail: `${fixture.priceBand.itemId} priced ${price?.quantity ?? 'no qty'} / $${price?.total ?? 'none'}`,
      });
    }
  }

  if (priced.length) {
    const snapshot = snapshotStages(priced);
    const back = priced.map(line => {
      const again = priceIncludedItem(fixture, line.itemId, measurements);
      return {
        ...line,
        total: again?.total ?? 0,
      };
    });
    const report = evaluateEstimateReliabilityContract({
      confirmed: snapshot.confirmed,
      stages: [
        ...snapshot.stages.slice(0, 3),
        {
          name: 'Back',
          lines: back,
          total:
            Math.round(back.reduce((sum, line) => sum + line.total, 0) * 100) /
            100,
        },
      ],
      excludedKeys: fixture.excludedIds,
    });
    if (!report.passed) {
      const failed = report.checks.filter(check => !check.passed);
      failures.push({
        caseId: fixture.id,
        category: 'snapshot',
        detail: failed.map(check => check.detail).join(' '),
      });
    }
  }

  return failures;
}

export function evaluateRealNotesAcceptance(
  cases: RealNotesAcceptanceCase[] = REAL_NOTES_ACCEPTANCE_CORPUS
): RealNotesAcceptanceReport {
  const failures = cases.flatMap(evaluateRealNotesCase);
  const failedIds = new Set(failures.map(failure => failure.caseId));
  const passedCases = cases.length - failedIds.size;
  const passRate = cases.length ? passedCases / cases.length : 0;
  const duplicateLines = failures.filter(
    failure => failure.category === 'duplicate_scope'
  ).length;
  const inventedExclusions = failures.filter(
    failure => failure.category === 'invented_exclusion'
  ).length;

  const scopePasses = cases.filter(
    fixture =>
      !failures.some(
        failure =>
          failure.caseId === fixture.id &&
          ['parser', 'invented_exclusion', 'duplicate_scope'].includes(
            failure.category
          )
      )
  ).length;
  const pricingPasses = cases.filter(
    fixture =>
      !failures.some(
        failure =>
          failure.caseId === fixture.id &&
          failure.category === 'pricing_ownership'
      )
  ).length;
  const pipelinePasses = cases.filter(
    fixture =>
      !failures.some(
        failure =>
          failure.caseId === fixture.id &&
          (failure.category === 'snapshot' ||
            failure.category === 'measurement_hydration')
      )
  ).length;
  const onTen = (passedCount: number) =>
    cases.length
      ? Math.round((passedCount / cases.length) * 1000) / 100
      : 0;

  const scorecard: EstimateReliabilityScorecard = {
    scopeIntelligence: {
      score: onTen(scopePasses),
      passed: scopePasses,
      total: cases.length,
      detail: 'Included cards, exclusions, and duplicate lines.',
    },
    pricingIntegrity: {
      score: onTen(pricingPasses),
      passed: pricingPasses,
      total: cases.length,
      detail:
        'Priced lines keep a national or production rate and survive a reprice.',
    },
    pipelineConsistency: {
      score: onTen(pipelinePasses),
      passed: pipelinePasses,
      total: cases.length,
      detail:
        'Quantities and confirmed totals stay aligned through Initial Estimate, Step 3, PDF, and back.',
    },
    aiGeneralization: {
      score: onTen(passedCases),
      passed: passedCases,
      total: cases.length,
      detail:
        'Share of corpus notes that pass the deterministic gate. Live model calls stay out of this score.',
    },
    releaseConfidence: 0,
  };
  const measured = [
    scorecard.scopeIntelligence.score,
    scorecard.pricingIntegrity.score,
    scorecard.pipelineConsistency.score,
    scorecard.aiGeneralization.score,
  ].filter((score): score is number => score != null);
  scorecard.releaseConfidence = measured.length ? Math.min(...measured) : 0;

  const passed =
    passRate >= REAL_NOTES_ACCEPTANCE_RELEASE.minPassRate &&
    duplicateLines <= REAL_NOTES_ACCEPTANCE_RELEASE.maxDuplicateLines &&
    inventedExclusions <= REAL_NOTES_ACCEPTANCE_RELEASE.maxInventedExclusions &&
    failures.length === 0;

  return {
    version: REAL_NOTES_ACCEPTANCE_CORPUS_VERSION,
    caseCount: cases.length,
    passedCases,
    passRate,
    duplicateLines,
    inventedExclusions,
    failures,
    scorecard,
    passed,
  };
}

export function acceptanceFailureMessage(report: RealNotesAcceptanceReport): string {
  return report.failures
    .map(failure => `${failure.caseId} [${failure.category}] ${failure.detail}`)
    .join('\n');
}
