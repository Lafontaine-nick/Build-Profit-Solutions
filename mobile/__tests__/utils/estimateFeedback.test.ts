import {
  CALIBRATION_THRESHOLDS,
  ESTIMATE_FEEDBACK_VERSION,
  createRateVersionFromSuggestion,
  deriveEstimateFeedbackFromBudgetData,
  evaluateEstimateFeedback,
  permissionForCalibration,
  robustRateStats,
  type ActualProjectData,
  type CalibrationEvidence,
  type EstimateSnapshot,
} from '@/utils/estimateFeedback';

function snapshot(overrides: Partial<EstimateSnapshot> = {}): EstimateSnapshot {
  return {
    estimateId: 'est-1',
    estimateVersion: 'v1',
    createdAt: '2026-01-01T00:00:00Z',
    scopeItems: [
      {
        scopeItemKey: 'flooring',
        name: 'Flooring',
        trade: 'flooring',
        quantity: 1000,
        unit: 'sqft',
        totalDirectCost: 6000,
        unitRate: 6,
        pricingSource: 'saved_rate',
        rateType: 'direct_cost',
        costBasis: 'direct_cost',
        rateId: 'rate-flooring',
        rateVersionId: 'rate-flooring:v1',
        formulaKey: 'flooring_area_waste',
        expectedQuantityRange: { low: 950, high: 1100 },
        assumptions: [{ assumptionKey: 'flooring_waste_lvp', value: 0.08 }],
      },
      {
        scopeItemKey: 'electrical',
        name: 'Electrical',
        trade: 'electrical',
        quantity: 40,
        unit: 'hr',
        laborCost: 3200,
        totalDirectCost: 3200,
        unitRate: 80,
        pricingSource: 'company_rate',
        rateType: 'direct_cost',
        costBasis: 'direct_cost',
      },
    ],
    totals: {
      directCost: 9200,
      sellingPrice: 12000,
      markup: 2800,
    },
    markupPercent: 30,
    ...overrides,
  };
}

function actual(overrides: Partial<ActualProjectData> = {}): ActualProjectData {
  return {
    projectId: 'proj-1',
    completionStatus: 'complete',
    scopeActuals: [
      {
        scopeItemKey: 'flooring',
        actualQuantity: 1120,
        actualUnit: 'sqft',
        materialCost: 5200,
        laborCost: 2200,
        totalDirectCost: 7400,
        sourceRecords: [
          {
            sourceType: 'supplier_receipt',
            sourceId: 'receipt-1',
            date: '2026-02-01',
            vendorOrEmployee: 'Floor Supply',
            mappedScopeItemKeys: ['flooring'],
            confidence: 'high',
            userConfirmed: true,
          },
        ],
        confidence: 'high',
      },
      {
        scopeItemKey: 'electrical',
        actualQuantity: 45,
        actualUnit: 'hr',
        laborCost: 4050,
        laborHours: 45,
        totalDirectCost: 4050,
        sourceRecords: [
          {
            sourceType: 'employee_time_entry',
            sourceId: 'time-1',
            date: '2026-02-03',
            vendorOrEmployee: 'Crew',
            mappedScopeItemKeys: ['electrical'],
            confidence: 'high',
            userConfirmed: true,
          },
        ],
        confidence: 'high',
      },
    ],
    projectLevelActuals: {
      totalActualCost: 11450,
      finalCustomerPrice: 13000,
      contingencyUsed: 250,
    },
    changeOrders: [
      {
        id: 'co-1',
        title: 'Owner selected upgraded flooring',
        amount: 1500,
        directCost: 1000,
        sellingPrice: 1500,
        status: 'approved',
        classification: 'owner_upgrade',
        scopeItemKeys: ['flooring'],
        excludeFromCalibration: true,
      },
    ],
    dataSources: [
      { sourceType: 'supplier_receipt', sourceId: 'receipt-1', confidence: 'high', userConfirmed: true },
      { sourceType: 'employee_time_entry', sourceId: 'time-1', confidence: 'high', userConfirmed: true },
    ],
    ...overrides,
  };
}

describe('estimateFeedback', () => {
  it('does not report project variance percent when mapped coverage is below threshold', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot({
        scopeItems: [
          {
            scopeItemKey: 'flooring',
            name: 'Flooring',
            trade: 'flooring',
            quantity: 1000,
            unit: 'sqft',
            totalDirectCost: 2000,
            unitRate: 2,
            pricingSource: 'saved_rate',
            rateType: 'direct_cost',
            costBasis: 'direct_cost',
          },
          {
            scopeItemKey: 'electrical',
            name: 'Electrical',
            trade: 'electrical',
            quantity: 40,
            unit: 'hr',
            laborCost: 8000,
            totalDirectCost: 8000,
            unitRate: 200,
            pricingSource: 'company_rate',
            rateType: 'direct_cost',
            costBasis: 'direct_cost',
          },
        ],
        totals: {
          directCost: 10000,
          sellingPrice: 13000,
          markup: 3000,
        },
      }),
      actualProjectData: actual({
        scopeActuals: [
          {
            scopeItemKey: 'flooring',
            actualQuantity: 1000,
            actualUnit: 'sqft',
            totalDirectCost: 80,
            sourceRecords: [{ sourceType: 'supplier_receipt', sourceId: 'r1', confidence: 'high', userConfirmed: true }],
            confidence: 'high',
          },
        ],
        projectLevelActuals: {
          totalActualCost: 5000,
          finalCustomerPrice: 13000,
        },
      }),
    });

    expect(result.projectSummary.mappedActualCoveragePercent).toBe(20);
    expect(result.projectSummary.varianceIsReliable).toBe(false);
    expect(result.projectSummary.directCostVariancePercent).toBeNull();
  });

  it('normalizes actual data and calculates project and scope variance safely', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      projectId: 'proj-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual(),
      now: new Date('2026-03-01T00:00:00Z'),
    });

    expect(result.algorithmVersion).toBe(ESTIMATE_FEEDBACK_VERSION);
    expect(result.status).toBe('ready_for_review');
    expect(result.confidence).toBe('high');
    expect(result.projectSummary.directCostVariance).toBe(2250);
    expect(result.projectSummary.directCostVariancePercent).toBe(24.46);
    expect(result.projectSummary.changeOrderTotal).toBe(1500);
    expect(result.projectSummary.mappedActualCoveragePercent).toBe(100);

    const flooring = result.scopeComparisons.find((comparison) => comparison.scopeItemKey === 'flooring')!;
    expect(flooring.quantityVariance).toBe(120);
    expect(flooring.quantityVariancePercent).toBe(12);
    expect(flooring.estimatedEffectiveRate).toBe(6);
    expect(flooring.actualEffectiveRate).toBeCloseTo(6.6071);
    expect(flooring.rateVariancePercent).toBe(10.12);
  });

  it('returns partial comparisons for in-progress projects and avoids high-confidence permanent suggestions', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual({
        completionStatus: 'in_progress',
        dataSources: [{ sourceType: 'manual_entry', sourceId: 'manual-1', confidence: 'medium', userConfirmed: true }],
      }),
    });

    expect(result.status).toBe('ready_for_review');
    expect(result.confidence).toBe('medium');
    expect(result.rateSuggestions.every((suggestion) => suggestion.confidence !== 'high')).toBe(true);
  });

  it('keeps ambiguous mappings unresolved and excludes them from calibration', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual({
        scopeActuals: [
          {
            mappedScopeItemKeys: ['flooring', 'electrical'],
            description: 'Combined subcontractor invoice',
            totalDirectCost: 9000,
            sourceRecords: [{ sourceType: 'subcontractor_invoice', sourceId: 'sub-1', confidence: 'medium' }],
            confidence: 'medium',
          },
        ],
      }),
    });

    expect(result.status).toBe('partial');
    expect(result.unresolvedMappings[0].status).toBe('split_across_scopes');
    expect(result.scopeComparisons.every((comparison) => comparison.excludedFromCalibration)).toBe(true);
  });

  it('supports likely and user-confirmed mapping statuses', () => {
    const likely = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual({
        scopeActuals: [
          {
            trade: 'flooring',
            description: 'Flooring supplier receipt',
            actualQuantity: 1000,
            actualUnit: 'sqft',
            totalDirectCost: 6100,
            sourceRecords: [{ sourceType: 'supplier_receipt', sourceId: 'r1', confidence: 'medium' }],
            confidence: 'medium',
          },
        ],
      }),
    });
    expect(likely.unresolvedMappings[0].status).toBe('likely_match');
    expect(likely.scopeComparisons.find((c) => c.scopeItemKey === 'flooring')?.excludedFromCalibration).toBe(true);

    const confirmed = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual({
        scopeActuals: [
          {
            scopeItemKey: 'flooring',
            userConfirmedMapping: true,
            actualQuantity: 1000,
            actualUnit: 'sqft',
            totalDirectCost: 6100,
            sourceRecords: [{ sourceType: 'supplier_receipt', sourceId: 'r1', confidence: 'high', userConfirmed: true }],
            confidence: 'high',
          },
        ],
      }),
    });
    expect(confirmed.scopeComparisons.find((c) => c.scopeItemKey === 'flooring')?.mappingStatus).toBe('user_confirmed');
  });

  it('handles zero denominators, unit mismatch, and not-comparable cost basis safely', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-zero',
      estimateSnapshot: snapshot({
        scopeItems: [
          {
            scopeItemKey: 'allowance',
            quantity: 0,
            unit: 'each',
            sellingPrice: 1000,
            pricingSource: 'user_entered',
            rateType: 'selling_price',
            costBasis: 'selling_price',
          },
        ],
        totals: { directCost: 0, sellingPrice: 1000 },
      }),
      actualProjectData: actual({
        scopeActuals: [
          {
            scopeItemKey: 'allowance',
            actualQuantity: 10,
            actualUnit: 'sqft',
            totalDirectCost: 800,
            costBasis: 'direct_cost',
            sourceRecords: [{ sourceType: 'manual_entry', sourceId: 'm1', confidence: 'medium', userConfirmed: true }],
            confidence: 'medium',
          },
        ],
      }),
    });

    const comparison = result.scopeComparisons[0];
    expect(comparison.quantityVariancePercent).toBeNull();
    expect(comparison.costVariancePercent).toBeNull();
    expect(comparison.comparisonStatus).toBe('not_comparable');
    expect(comparison.notices.join(' ')).toMatch(/not comparable|unit/i);
  });

  it('separates change orders, owner upgrades, and rework from calibration evidence', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual({
        scopeActuals: [
          {
            scopeItemKey: 'flooring',
            actualQuantity: 1300,
            actualUnit: 'sqft',
            totalDirectCost: 9000,
            varianceClassification: 'owner_upgrade',
            sourceRecords: [{ sourceType: 'change_order', sourceId: 'co-1', confidence: 'high', userConfirmed: true }],
            confidence: 'high',
          },
        ],
      }),
    });

    const flooring = result.scopeComparisons.find((comparison) => comparison.scopeItemKey === 'flooring')!;
    expect(flooring.excludedFromCalibration).toBe(true);
    expect(result.rateSuggestions.every((suggestion) => suggestion.scopeKey !== 'flooring' || suggestion.target === 'project_rate')).toBe(true);
  });

  it('uses robust calibration statistics and excludes outliers traceably', () => {
    const stats = robustRateStats([
      { evidenceId: '1', estimateId: 'e1', scopeKey: 'tile', actualRate: 10, confidence: 'high' },
      { evidenceId: '2', estimateId: 'e2', scopeKey: 'tile', actualRate: 11, confidence: 'high' },
      { evidenceId: '3', estimateId: 'e3', scopeKey: 'tile', actualRate: 12, confidence: 'high' },
      { evidenceId: '4', estimateId: 'e4', scopeKey: 'tile', actualRate: 100, confidence: 'high' },
    ]);

    expect(stats.median).toBe(11);
    expect(stats.excludedOutlierCount).toBe(1);
  });

  it('creates project, saved-rate, and company-rate suggestions according to evidence thresholds', () => {
    const baseEvidence: CalibrationEvidence[] = [
      { evidenceId: 'hist-1', estimateId: 'e2', projectId: 'p2', scopeKey: 'flooring', unit: 'sqft', estimatedRate: 6, actualRate: 7, variancePercent: 16, quantity: 800, confidence: 'high' },
      { evidenceId: 'hist-2', estimateId: 'e3', projectId: 'p3', scopeKey: 'flooring', unit: 'sqft', estimatedRate: 6, actualRate: 7.2, variancePercent: 20, quantity: 900, confidence: 'high' },
    ];
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      projectId: 'p1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual(),
      comparableEvidence: baseEvidence,
    });

    const flooringSuggestion = result.rateSuggestions.find((suggestion) => suggestion.scopeKey === 'flooring')!;
    expect(flooringSuggestion.target).toBe('company_rate');
    expect(flooringSuggestion.comparableProjectCount).toBeGreaterThanOrEqual(CALIBRATION_THRESHOLDS.minimumProjectsForCompanyRateSuggestion);
    expect(flooringSuggestion.requiresUserApproval).toBe(true);
  });

  it('creates assumption suggestions only after evidence thresholds are met', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual(),
      assumptionEvidence: Array.from({ length: 5 }).map((_, index) => ({
        assumptionKey: 'flooring_waste_lvp',
        currentValue: 0.08,
        observedValue: 0.11 + index * 0.001,
        scopeItemKey: 'flooring',
        confidence: 'high',
      })),
    });

    expect(result.assumptionFindings.length).toBeGreaterThan(0);
    expect(result.assumptionSuggestions[0]).toMatchObject({
      assumptionKey: 'flooring_waste_lvp',
      requiresUserApproval: true,
    });
  });

  it('monitors formula and benchmark performance without changing registries', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual(),
      formulaEvidence: [
        { formulaKey: 'flooring_area_waste', quantityVariancePercent: 22, insideExpectedRange: false, confidence: 'high' },
        { formulaKey: 'flooring_area_waste', quantityVariancePercent: 18, insideExpectedRange: false, confidence: 'high' },
      ],
      comparableEvidence: [
        { evidenceId: 'b1', estimateId: 'b1', projectId: 'p1', scopeKey: 'roofing', unit: 'square', estimatedRate: 500, actualRate: 650, variancePercent: 30, confidence: 'high', sourceType: 'national_average' },
        { evidenceId: 'b2', estimateId: 'b2', projectId: 'p2', scopeKey: 'roofing', unit: 'square', estimatedRate: 500, actualRate: 660, variancePercent: 32, confidence: 'high', sourceType: 'national_average' },
        { evidenceId: 'b3', estimateId: 'b3', projectId: 'p3', scopeKey: 'roofing', unit: 'square', estimatedRate: 500, actualRate: 640, variancePercent: 28, confidence: 'high', sourceType: 'national_average' },
        { evidenceId: 'b4', estimateId: 'b4', projectId: 'p4', scopeKey: 'roofing', unit: 'square', estimatedRate: 500, actualRate: 670, variancePercent: 34, confidence: 'high', sourceType: 'national_average' },
        { evidenceId: 'b5', estimateId: 'b5', projectId: 'p5', scopeKey: 'roofing', unit: 'square', estimatedRate: 500, actualRate: 655, variancePercent: 31, confidence: 'high', sourceType: 'national_average' },
      ],
    });

    expect(result.formulaPerformance[0].status).toBe('slight_underestimate_bias');
    expect(result.formulaFindings[0].category).toBe('formula');
    expect(result.benchmarkPerformance.find((entry) => entry.scopeKey === 'roofing')?.status).toBe('poor_fit');
    expect(result.benchmarkFindings.length).toBeGreaterThan(0);
  });

  it('enforces permissions and creates auditable rate versions only after approval', () => {
    expect(permissionForCalibration('field', 'company_rate').mayApproveCalibration).toBe(false);
    expect(permissionForCalibration('foreman', 'saved_rate').mayProposeCalibration).toBe(true);
    expect(permissionForCalibration('manager', 'saved_rate').mayApproveCalibration).toBe(true);
    expect(permissionForCalibration('manager', 'company_rate').mayApproveCalibration).toBe(false);
    expect(permissionForCalibration('admin', 'company_rate').mayApproveCalibration).toBe(true);

    const suggestion = evaluateEstimateFeedback({
      estimateId: 'est-1',
      estimateSnapshot: snapshot(),
      actualProjectData: actual(),
    }).rateSuggestions[0];

    expect(() =>
      createRateVersionFromSuggestion({
        suggestion,
        parentRateId: 'rate-flooring',
        metadata: { rateType: 'installed_unit_rate' },
        approvedBy: 'field-user',
        approvedByRole: 'field',
      })
    ).toThrow(/cannot approve/i);

    const version = createRateVersionFromSuggestion({
      suggestion,
      parentRateId: 'rate-flooring',
      supersedesVersionId: 'rate-flooring:v1',
      metadata: { rateType: 'installed_unit_rate' },
      approvedBy: 'admin-user',
      approvedByRole: 'admin',
      now: new Date('2026-03-01T00:00:00Z'),
    });

    expect(version.value).toBe(suggestion.suggestedRate);
    expect(version.supersedesVersionId).toBe('rate-flooring:v1');
    expect(version.changeReason).toBe('actual_cost_calibration');
    expect(version.evidenceReferences?.length).toBeGreaterThan(0);
    expect(version.createdBy).toBe('admin-user');
  });

  it('hides profit analysis from unauthorized roles', () => {
    expect(permissionForCalibration('field', 'project_rate').mayViewProfitAnalysis).toBe(false);
    expect(permissionForCalibration('owner', 'project_rate').mayViewProfitAnalysis).toBe(true);
  });

  it('returns safe fallback for legacy projects without snapshots or actuals', () => {
    const result = evaluateEstimateFeedback({
      estimateId: 'legacy',
      estimateSnapshot: null,
      actualProjectData: null,
    });

    expect(result.status).toBe('insufficient_data');
    expect(result.confidence).toBe('low');
    expect(result.scopeComparisons).toHaveLength(0);
  });

  it('derives a compact feedback result from existing BudgetTab data', () => {
    const result = deriveEstimateFeedbackFromBudgetData(
      {
        projectId: 'budget-1',
        status: 'completed',
        plannedBudget: 1000,
        finalCustomerPrice: 1500,
        lines: [{ id: 'materials', category: 'Materials', qty: 10, unit: 'each', unitCost: 100 }],
        expenses: [
          {
            id: 'exp-1',
            category: 'Materials',
            vendor: 'Supplier',
            amount: 1100,
            receiptUri: 'file://receipt.jpg',
          },
        ],
        changeOrders: [{ id: 'co-1', title: 'Upgrade', amount: 200, status: 'Approved' }],
      },
      { now: new Date('2026-03-01T00:00:00Z') }
    );

    expect(result.projectId).toBe('budget-1');
    expect(result.projectSummary.mappedActualCoveragePercent).toBe(100);
    expect(result.projectSummary.directCostVariancePercent).toBe(10);
    expect(result.status).toBe('reviewed');
  });

  it('does not mutate the original estimate snapshot or saved rate metadata', () => {
    const original = snapshot();
    const before = JSON.stringify(original);
    evaluateEstimateFeedback({
      estimateId: original.estimateId,
      estimateSnapshot: original,
      actualProjectData: actual(),
    });

    expect(JSON.stringify(original)).toBe(before);
    expect(original.scopeItems[0].unitRate).toBe(6);
    expect(original.scopeItems[0].rateVersionId).toBe('rate-flooring:v1');
  });
});
