import { BUILD_WITH_AI_GOLDEN_FIXTURES } from '@/__tests__/fixtures/buildWithAiGoldenFixtures';
import {
  BUILD_WITH_AI_PERFORMANCE_BUDGETS,
  BUILD_WITH_AI_PRODUCTION_HARDENING_VERSION,
  DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS,
  buildSupportDiagnostics,
  canPerformBuildWithAiAction,
  createAuditEntry,
  createIdempotencyKey,
  createSafeError,
  evaluatePerformanceBudget,
  isDuplicateOperation,
  validateEstimateIntegrity,
  validateUploadForBuildWithAi,
} from '@/utils/buildWithAiProductionHardening';
import { ESTIMATE_FEEDBACK_VERSION, createRateVersionFromSuggestion } from '@/utils/estimateFeedback';
import { ESTIMATE_READINESS_VERSION, evaluateEstimateReadiness } from '@/utils/estimateReadiness';

describe('buildWithAiProductionHardening', () => {
  it('versions the production hardening contract and defaults risky flags conservatively', () => {
    expect(BUILD_WITH_AI_PRODUCTION_HARDENING_VERSION).toBe('1.0.0');
    expect(DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS.readinessScoring).toBe(true);
    expect(DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS.actualVsEstimatedFeedback).toBe(true);
    expect(DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS.calibrationApproval).toBe(true);
  });

  it('defines golden workflow fixtures for major project types without live pricing dependency', () => {
    expect(BUILD_WITH_AI_GOLDEN_FIXTURES).toHaveLength(14);
    expect(BUILD_WITH_AI_GOLDEN_FIXTURES.map((fixture) => fixture.key)).toEqual([
      'new_adu',
      'new_single_family_home',
      'bathroom_remodel',
      'kitchen_remodel',
      'room_addition',
      'roofing_replacement',
      'flooring_only',
      'concrete_flatwork',
      'sitework_utility_trenching',
      'landscaping',
      'plumbing_service',
      'electrical_service',
      'hvac_replacement',
      'commercial_tenant_improvement',
    ]);
    for (const fixture of BUILD_WITH_AI_GOLDEN_FIXTURES) {
      expect(fixture.notes.length).toBeGreaterThan(20);
      expect(fixture.expectedScope.length).toBeGreaterThan(0);
      expect(fixture.expectedUnits.length).toBeGreaterThan(0);
      expect(fixture.expectedReadinessRange.low).toBeGreaterThanOrEqual(0);
      expect(fixture.expectedReadinessRange.high).toBeLessThanOrEqual(100);
      expect(fixture.expectedReadinessRange.low).toBeLessThanOrEqual(fixture.expectedReadinessRange.high);
    }
  });

  it('creates stable idempotency keys and detects duplicate retry-sensitive operations', () => {
    const payloadA = { estimateId: 'est-1', quantity: 100, unit: 'sqft' };
    const payloadB = { unit: 'sqft', quantity: 100, estimateId: 'est-1' };
    const keyA = createIdempotencyKey('formula_acceptance', payloadA, 'user-1');
    const keyB = createIdempotencyKey('formula_acceptance', payloadB, 'user-1');
    expect(keyA).toBe(keyB);
    expect(
      isDuplicateOperation(
        {
          operation: 'formula_acceptance',
          idempotencyKey: keyA,
          fingerprint: 'fingerprint',
          createdAt: '2026-06-01T00:00:00Z',
        },
        'formula_acceptance',
        payloadB,
        'user-1'
      )
    ).toBe(true);
  });

  it('standardizes safe errors without leaking internals', () => {
    const err = createSafeError({
      code: 'AI_INVALID_RESPONSE',
      correlationId: 'corr-1',
      partialWorkSaved: true,
      diagnosticContext: {
        route: 'ai-assistant',
        prompt: undefined,
        status: 502,
      },
    });

    expect(err.code).toBe('AI_INVALID_RESPONSE');
    expect(err.userMessage).toMatch(/could not be safely used/i);
    expect(err.retryGuidance).toBe('continue_manually');
    expect(err.partialWorkSaved).toBe(true);
    expect(err.correlationId).toBe('corr-1');
    expect(err.diagnosticContext).toEqual({ route: 'ai-assistant', status: 502 });
    expect(JSON.stringify(err)).not.toMatch(/stack|secret|prompt/i);
  });

  it('enforces role permissions for sensitive estimate and calibration actions', () => {
    expect(canPerformBuildWithAiAction('field', 'approve_calibration')).toBe(false);
    expect(canPerformBuildWithAiAction('field', 'view_profit')).toBe(false);
    expect(canPerformBuildWithAiAction('foreman', 'resolve_risk')).toBe(true);
    expect(canPerformBuildWithAiAction('manager', 'approve_calibration')).toBe(true);
    expect(canPerformBuildWithAiAction('manager', 'update_company_rates')).toBe(false);
    expect(canPerformBuildWithAiAction('admin', 'update_company_rates')).toBe(true);
    expect(canPerformBuildWithAiAction('view_only', 'edit_pricing')).toBe(false);
  });

  it('validates estimate integrity while allowing missing optional legacy metadata', () => {
    const issues = validateEstimateIntegrity({
      quantities: [
        { path: 'scope.flooring.quantity', value: 100, unit: 'sqft' },
        { path: 'scope.outlets.quantity', value: 2.5, unit: 'each' },
        { path: 'scope.bad.quantity', value: -1, unit: 'widgets' },
      ],
      rates: [{ path: 'rates.flooring', value: -5 }],
      percentages: [{ path: 'markupPct', value: 150 }],
      totals: [{ path: 'total', value: Number.NaN }],
      readinessSnapshot: { score: 80 } as any,
      feedbackResult: { estimateId: 'est-1' } as any,
      rateVersion: { parentRateId: '', evidenceReferences: [] },
      historicalSnapshotMutationAttempt: true,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'FRACTIONAL_EACH_COUNT',
        'NEGATIVE_QUANTITY',
        'UNSUPPORTED_UNIT',
        'NEGATIVE_RATE',
        'INVALID_PERCENTAGE',
        'INVALID_TOTAL',
        'MISSING_RULE_VERSION',
        'MISSING_ALGORITHM_VERSION',
        'MISSING_RATE_PARENT',
        'MISSING_RATE_EVIDENCE',
        'MUTABLE_HISTORICAL_SNAPSHOT',
      ])
    );
    expect(validateEstimateIntegrity({ quantities: [{ path: 'legacy.quantity', value: null }] })).toEqual([]);
  });

  it('requires readiness and feedback version identifiers for historical interpretability', () => {
    const readiness = evaluateEstimateReadiness({
      scopeItems: [],
      estimateTotals: { subtotal: 0, total: 0 },
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(readiness.snapshot.version).toBe(ESTIMATE_READINESS_VERSION);

    const feedbackIssues = validateEstimateIntegrity({
      feedbackResult: {
        estimateId: 'est-1',
        algorithmVersion: ESTIMATE_FEEDBACK_VERSION,
      } as any,
      readinessSnapshot: readiness.snapshot,
    });
    expect(feedbackIssues).toEqual([]);
  });

  it('rejects unsafe uploads and sanitizes filenames', () => {
    const good = validateUploadForBuildWithAi({
      filename: 'Supplier Receipt 1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      pdfPageCount: 3,
    });
    expect(good.allowed).toBe(true);
    expect(good.sanitizedFilename).toBe('Supplier Receipt 1.pdf');

    const bad = validateUploadForBuildWithAi({
      filename: '../evil<script>.exe',
      mimeType: 'application/octet-stream',
      sizeBytes: 50 * 1024 * 1024,
      pdfPageCount: 500,
    });
    expect(bad.allowed).toBe(false);
    expect(bad.issues).toEqual(
      expect.arrayContaining([
        'Unsupported file extension.',
        'Unsupported or missing MIME type.',
        'File size must be greater than 0 and no more than 20 MB.',
        'PDF page count exceeds the supported limit.',
      ])
    );
    expect(bad.sanitizedFilename).not.toMatch(/[<>/]/);
  });

  it('evaluates performance budgets for large-estimate safeguards', () => {
    expect(BUILD_WITH_AI_PERFORMANCE_BUDGETS.scopeIntelligenceEvaluationMs).toBe(100);
    expect(evaluatePerformanceBudget('readinessEvaluationMs', 80)).toMatchObject({
      withinBudget: true,
      overByMs: 0,
    });
    expect(evaluatePerformanceBudget('largeEstimateReviewRenderMs', 2000)).toMatchObject({
      withinBudget: false,
      overByMs: 500,
    });
  });

  it('creates support-safe diagnostics without sensitive notes or pricing detail', () => {
    const diagnostics = buildSupportDiagnostics({
      estimateId: 'est-1',
      appVersion: '1.0.0',
      readinessVersion: ESTIMATE_READINESS_VERSION,
      feedbackVersion: ESTIMATE_FEEDBACK_VERSION,
      lastErrorCode: 'NETWORK_FAILURE',
      userRole: 'foreman',
      featureFlags: { readinessScoring: true },
      correlationIds: ['corr-1'],
      network: { state: 'degraded' },
    });

    expect(diagnostics).toMatchObject({
      estimateId: 'est-1',
      lastErrorCode: 'NETWORK_FAILURE',
      userRole: 'foreman',
      correlationIds: ['corr-1'],
    });
    expect(JSON.stringify(diagnostics)).not.toMatch(/customerName|walkthrough|secret|fullPricing/i);
  });

  it('creates structured audit entries for important actions', () => {
    const entry = createAuditEntry({
      action: 'readiness_snapshot_created',
      entityType: 'snapshot',
      entityId: 'snap-1',
      userId: 'user-1',
      source: 'mobile',
      correlationId: 'corr-1',
      createdAt: '2026-06-01T00:00:00Z',
      before: { status: 'budgetary' },
      after: { status: 'bid_ready' },
    });

    expect(entry.id).toMatch(/^readiness_snapshot_created:snapshot:snap-1:/);
    expect(entry.correlationId).toBe('corr-1');
    expect(entry.before).toEqual({ status: 'budgetary' });
    expect(entry.after).toEqual({ status: 'bid_ready' });
  });

  it('prevents duplicate rate version creation through deterministic version id inputs', () => {
    const suggestion = {
      key: 'rate_calibration:saved_rate:flooring:sqft',
      scopeKey: 'flooring',
      unit: 'sqft',
      target: 'saved_rate' as const,
      suggestedRate: 7.25,
      evidence: [{ evidenceId: 'ev-1', estimateId: 'est-1', scopeKey: 'flooring', confidence: 'high' as const }],
      comparableProjectCount: 2,
      confidence: 'medium' as const,
      reason: 'consistent_underestimate' as const,
      requiresUserApproval: true as const,
    };
    const first = createRateVersionFromSuggestion({
      suggestion,
      parentRateId: 'rate-1',
      metadata: { rateType: 'installed_unit_rate' },
      approvedBy: 'manager-1',
      approvedByRole: 'manager',
      now: new Date('2026-06-01T00:00:00Z'),
    });
    const second = createRateVersionFromSuggestion({
      suggestion,
      parentRateId: 'rate-1',
      metadata: { rateType: 'installed_unit_rate' },
      approvedBy: 'manager-1',
      approvedByRole: 'manager',
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(first.versionId).toBe(second.versionId);
    expect(first.evidenceReferences).toEqual([{ evidenceId: 'ev-1', estimateId: 'est-1', projectId: undefined }]);
  });
});
