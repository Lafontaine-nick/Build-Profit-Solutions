import {
  ESTIMATE_READINESS_VERSION,
  evaluateDraftReadiness,
  evaluateEstimateReadiness,
  type EstimateReviewConfirmation,
} from '@/utils/estimateReadiness';
import type { ScopeItemIntelligence } from '@/utils/scopeIntelligence';

function item(overrides: Partial<ScopeItemIntelligence> = {}): ScopeItemIntelligence {
  const key = overrides.scopeItemKey || 'flooring';
  return {
    scopeItemKey: key,
    unitDefinition: {
      scopeKey: key,
      trade: 'flooring',
      preferredUnits: ['sqft'],
      alternateUnits: [],
      prohibitedUnits: [],
      requiredMeasurementInputs: [],
      directMeasurementTypes: [],
      derivedMeasurementTypes: [],
      requiredMeasurementTypes: [],
      optionalMeasurementTypes: [],
      allowInheritedQuantity: true,
      allowDerivedQuantity: true,
      allowManualOverride: true,
      allowLumpSum: true,
      allowAllowance: true,
      normallyAllowance: false,
      mayBeLumpSum: false,
      incompatibleUnitSeverity: 'warning',
    },
    unitValidation: {
      status: 'valid',
      currentUnit: 'sqft',
      preferredUnits: ['sqft'],
      alternateUnits: [],
    },
    measurementRelationship: { type: 'direct' },
    missingMeasurements: [],
    validationNotices: [],
    formula: null,
    formulaComparison: null,
    assembly: {
      assemblyKey: `${key}_assembly`,
      scopeItemKey: key,
      completeness: 'complete',
      confidence: 'high',
      includedComponents: [],
      missingComponents: [],
      excludedComponents: [],
      unknownComponents: [],
      possibleOverlaps: [],
      dependencies: [],
      notices: [],
    },
    scopeGaps: [],
    overlaps: [],
    dependencies: [],
    canContinue: true,
    quantity: {
      value: 100,
      unit: 'sqft',
      source: 'user_entered',
      sourceLabel: 'User entered',
      confidence: 'high',
      confidenceLabel: 'High confidence',
      reason: '',
      missingInputs: [],
    },
    pricing: {
      source: 'saved_rate',
      confidence: 'medium',
      confidenceLabel: 'Medium confidence',
      reason: '',
    },
    pricingCompleteness: {
      status: 'complete',
      rateType: 'installed_unit_rate',
      includedCostComponents: ['material', 'labor'],
      missingCostComponents: [],
      unknownCostComponents: [],
      minimumCharge: { applies: false, status: 'not_applicable' },
      regionalRelevance: {
        overall: 'high',
        dimensions: {
          unitMatch: 'high',
          scopeMatch: 'high',
          projectContextMatch: 'high',
          regionalMatch: 'high',
          dateRelevance: 'high',
          quantityScaleMatch: 'high',
          inclusionMatch: 'high',
        },
        notices: [],
      },
      dateRelevance: { status: 'current', message: 'Current' },
      quantityScale: { status: 'matched', message: 'Matched' },
      markupRisk: { risk: 'none', notices: [] },
      confidence: 'high',
      notices: [],
    },
    validation: { status: 'ready', issues: [] },
    ...overrides,
  };
}

describe('estimateReadiness', () => {
  it('calculates weighted category scores and total readiness', () => {
    const result = evaluateEstimateReadiness({
      projectContext: 'flooring',
      scopeItems: [item()],
      estimateTotals: { subtotal: 10000, total: 12000 },
      now: new Date('2026-06-01'),
    });

    expect(result.version).toBe(ESTIMATE_READINESS_VERSION);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.categoryScores.scopeCoverage).toBeGreaterThan(80);
    expect(result.categoryScores.quantityReliability).toBeGreaterThan(80);
    expect(result.categoryScores.pricingReliability).toBeGreaterThan(70);
    expect(result.categoryScores.unitCorrectness).toBeGreaterThan(80);
    expect(result.categoryScores.inclusionCompleteness).toBeGreaterThan(80);
    expect(result.categoryScores.regionalRelevance).toBeGreaterThan(80);
  });

  it('returns draft and safe low-confidence fallback when intelligence is unavailable', () => {
    const result = evaluateEstimateReadiness({
      projectContext: null,
      scopeItems: [],
      estimateTotals: { subtotal: 0, total: 0 },
    });

    expect(result.status).toBe('draft');
    expect(result.confidence).toBe('low');
    expect(result.canContinue).toBe(true);
    expect(result.canMarkBidReady).toBe(false);
  });

  it('supports preliminary and budgetary statuses with assumptions', () => {
    const preliminary = evaluateEstimateReadiness({
      projectContext: 'adu',
      scopeItems: [
        item({
          quantity: { ...item().quantity, confidence: 'low', source: 'benchmark_estimate' },
          pricing: { ...item().pricing, source: 'national_average', confidence: 'low' },
        }),
      ],
      estimateTotals: { subtotal: 10000, total: 10000 },
    });
    expect(['preliminary', 'budgetary']).toContain(preliminary.status);
    expect(preliminary.canContinue).toBe(true);

    const budgetary = evaluateEstimateReadiness({
      projectContext: 'kitchen',
      scopeItems: [
        item(),
        item({
          scopeItemKey: 'paint',
          pricing: { ...item().pricing, source: 'national_average', confidence: 'low' },
          pricingCompleteness: {
            ...item().pricingCompleteness!,
            confidence: 'medium',
            regionalRelevance: {
              ...item().pricingCompleteness!.regionalRelevance!,
              overall: 'low',
              dimensions: {
                ...item().pricingCompleteness!.regionalRelevance!.dimensions,
                regionalMatch: 'low',
              },
            },
          },
        }),
      ],
      estimateTotals: { subtotal: 50000, total: 60000 },
    });
    expect(['budgetary', 'bid_ready']).toContain(budgetary.status);
  });

  it('allows bid-ready only when gates are clear', () => {
    const result = evaluateEstimateReadiness({
      projectContext: 'kitchen',
      scopeItems: [item(), item({ scopeItemKey: 'countertops' }), item({ scopeItemKey: 'paint' })],
      estimateTotals: { subtotal: 85000, total: 102000 },
    });

    expect(result.status).toBe('bid_ready');
    expect(result.canMarkBidReady).toBe(true);
    expect(result.canSendWithoutReview).toBe(true);
  });

  it('requires sufficient quote-backed value for quote-backed status', () => {
    const quoteItem = item({
      pricing: { ...item().pricing, source: 'project_quote', confidence: 'high' },
      pricingCompleteness: {
        ...item().pricingCompleteness!,
        rateType: 'project_quote',
        confidence: 'high',
      },
    });
    const result = evaluateEstimateReadiness({
      projectContext: 'bathroom',
      scopeItems: [quoteItem, { ...quoteItem, scopeItemKey: 'tile' }, { ...quoteItem, scopeItemKey: 'plumbing_trim' }],
      estimateTotals: { subtotal: 40000, total: 48000 },
    });

    expect(result.status).toBe('quote_backed');
  });

  it('gates bid-ready for blocking units, critical scope gaps, missing pricing, and markup risks', () => {
    expect(
      evaluateEstimateReadiness({
        scopeItems: [item({ unitValidation: { ...item().unitValidation, status: 'invalid' } })],
        estimateTotals: { subtotal: 100000, total: 100000 },
      }).status
    ).not.toBe('bid_ready');

    expect(
      evaluateEstimateReadiness({
        scopeItems: [
          item({
            scopeGaps: [{ key: 'missing_foundation', scopeGroupKey: 'foundation', label: 'Foundation', severity: 'warning', message: 'Foundation missing', suggestedScopeKeys: ['foundation'] }],
          }),
        ],
        estimateTotals: { subtotal: 100000, total: 100000 },
      }).canMarkBidReady
    ).toBe(false);

    expect(
      evaluateEstimateReadiness({
        scopeItems: [item({ pricing: { ...item().pricing, confidence: 'missing' } })],
        estimateTotals: { subtotal: 100000, total: 100000 },
      }).status
    ).toBe('draft');

    expect(
      evaluateEstimateReadiness({
        scopeItems: [
          item({
            pricingCompleteness: {
              ...item().pricingCompleteness!,
              markupRisk: {
                risk: 'review',
                notices: [{ ruleKey: 'pricing_markup_possible_duplication', severity: 'review', title: 'Markup', message: 'Markup may duplicate.', pricingMayContinue: true }],
              },
            },
          }),
        ],
        estimateTotals: { subtotal: 100000, total: 100000 },
      }).canMarkBidReady
    ).toBe(false);
  });

  it('assigns materiality and sorts high-value risks ahead of low-value risks', () => {
    const result = evaluateEstimateReadiness({
      scopeItems: [
        item({
          scopeItemKey: 'foundation',
          quantity: { ...item().quantity, confidence: 'missing', value: null },
        }),
        item({
          scopeItemKey: 'outlet_cover',
          pricingCompleteness: {
            ...item().pricingCompleteness!,
            minimumCharge: { applies: true, status: 'review', minimumCharge: 25, calculatedUnitTotal: 10 },
          },
        }),
      ],
      estimateTotals: { subtotal: 250000, total: 250000 },
    });

    expect(result.highPriorityReviews[0].scopeItemKey).toBe('foundation');
    expect(result.unresolvedRisks.some((risk) => risk.category === 'minimum_charge')).toBe(true);
  });

  it('groups duplicate root risks and tracks user resolutions', () => {
    const confirmations: EstimateReviewConfirmation[] = [
      {
        riskKey: 'overlap:excavation_trenching',
        resolution: 'priced_elsewhere',
        timestamp: '2026-06-01T00:00:00Z',
      },
      {
        riskKey: 'unit_invalid:concrete',
        resolution: 'dismissed_low_risk',
        timestamp: '2026-06-01T00:00:00Z',
      },
    ];
    const result = evaluateEstimateReadiness({
      scopeItems: [
        item({
          scopeItemKey: 'excavation',
          overlaps: [{ key: 'excavation_trenching', componentKey: 'trench', componentLabel: 'Trench', relatedScopeKeys: ['utility_trenching'], severity: 'review', message: 'Overlap', resolutionOptions: ['Confirm'] }],
        }),
        item({
          scopeItemKey: 'utility_trenching',
          overlaps: [{ key: 'excavation_trenching', componentKey: 'trench', componentLabel: 'Trench', relatedScopeKeys: ['excavation'], severity: 'review', message: 'Overlap again', resolutionOptions: ['Confirm'] }],
        }),
        item({
          scopeItemKey: 'concrete',
          unitValidation: { ...item().unitValidation, status: 'invalid' },
        }),
      ],
      estimateTotals: { subtotal: 100000, total: 100000 },
      userConfirmations: confirmations,
    });

    expect(result.snapshot.resolvedRiskKeys).toContain('overlap:excavation_trenching');
    expect(result.unresolvedRisks.filter((risk) => risk.key === 'overlap:excavation_trenching')).toHaveLength(0);
    expect(result.unresolvedRisks.some((risk) => risk.key === 'unit_invalid:concrete')).toBe(true);
  });

  it('returns readiness counts, analytics, and auditable snapshots', () => {
    const result = evaluateEstimateReadiness({
      scopeItems: [
        item(),
        item({
          scopeItemKey: 'drywall',
          pricing: { ...item().pricing, source: 'national_average', confidence: 'low' },
          pricingCompleteness: {
            ...item().pricingCompleteness!,
            dateRelevance: { status: 'stale', message: 'Stale' },
            regionalRelevance: {
              ...item().pricingCompleteness!.regionalRelevance!,
              overall: 'low',
              dimensions: {
                ...item().pricingCompleteness!.regionalRelevance!.dimensions,
                regionalMatch: 'low',
              },
            },
          },
        }),
      ],
      estimateTotals: { subtotal: 50000, total: 60000 },
      now: new Date('2026-06-01T00:00:00Z'),
    });

    expect(result.counts.totalActiveScopeItems).toBe(2);
    expect(result.counts.nationalAverages).toBe(1);
    expect(result.counts.staleRates).toBe(1);
    expect(result.snapshot.version).toBe(ESTIMATE_READINESS_VERSION);
    expect(result.snapshot.createdAt).toBe('2026-06-01T00:00:00.000Z');
    expect(result.analytics.nationalAveragePercent).toBeGreaterThan(0);
  });

  it('preserves historical snapshots while current readiness can be recalculated', () => {
    const first = evaluateEstimateReadiness({
      scopeItems: [item()],
      estimateTotals: { subtotal: 10000, total: 10000 },
      now: new Date('2026-01-01T00:00:00Z'),
    }).snapshot;
    const second = evaluateEstimateReadiness({
      scopeItems: [item({ pricing: { ...item().pricing, confidence: 'missing' } })],
      estimateTotals: { subtotal: 10000, total: 10000 },
      now: new Date('2026-02-01T00:00:00Z'),
    }).snapshot;

    expect(first.status).not.toBe(second.status);
    expect(first.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('derives safe readiness from legacy drafts without mutating totals', () => {
    const draft = {
      customerName: null,
      projectTitle: 'Kitchen remodel',
      projectType: 'kitchen',
      projectDescription: null,
      rooms: [],
      scopePackages: [
        {
          name: 'Cabinets',
          scope: 'Install cabinets',
          price: 12000,
          laborPrice: 5000,
          materialPrice: 7000,
          pricingType: 'installed',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user',
          status: 'confirmed',
          formula: null,
          missingInfo: [],
          priceIncludesLaborAndMaterials: true,
          splitIsSuggested: false,
          priceProvidedByUser: true,
        },
        {
          name: 'Backsplash',
          scope: 'Tile backsplash',
          price: null,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'unit',
          includesLabor: null,
          includesMaterials: null,
          priceSource: 'missing',
          status: 'missing_price',
          formula: null,
          missingInfo: [],
          priceIncludesLaborAndMaterials: false,
          splitIsSuggested: false,
          priceProvidedByUser: false,
        },
      ],
      allowances: [],
      inclusions: [],
      exclusions: [],
      statedTotal: null,
      calculatedLineItemTotal: 12000,
      calculatedLaborTotal: 5000,
      calculatedMaterialTotal: 7000,
      pricingWarnings: [],
      missingInfo: [],
      contractScope: null,
      suggestedPaymentSchedule: null,
    } as any;

    const result = evaluateDraftReadiness(draft, { markupPct: 20, now: new Date('2026-06-01') });
    expect(result.status).toBe('draft');
    expect(result.counts.missingPricing).toBe(1);
    expect(draft.calculatedLineItemTotal).toBe(12000);
    expect(result.summary.customerFacingLabel).toBe('Draft estimate');
  });
});
