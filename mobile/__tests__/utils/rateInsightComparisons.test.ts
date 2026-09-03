import {
  buildRateInsightSections,
  collectEstimateLineItems,
  countRateInsightRows,
  formatRateInsightLineEstimate,
  getEstimateLineBudgetBadge,
  getEstimateLineLoggedSpendMap,
  getEstimateLineSpendSummaries,
  getRateInsightSpendStatus,
  resolveProjectEstimateData,
  scoreExpenseLineMatch,
  sortEstimateLineOptions,
} from '@/utils/rateInsightComparisons';

describe('buildRateInsightSections', () => {
  it('shows individual material and labor estimate lines with logged expenses', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        materialLineItems: [
          { id: 'mat-1', name: 'Floor tile', qty: 500, unit: 'sqft', unitPrice: 5, total: 2500 },
          { id: 'mat-2', name: 'Thinset', qty: 10, unit: 'bag', unitPrice: 20, total: 200 },
        ],
        laborLineItems: [
          { id: 'lab-1', name: 'Tile install', qty: 500, unit: 'sqft', unitPrice: 6, total: 3000 },
        ],
      },
      expenses: [
        { id: 'e1', category: 'Materials', vendor: 'Home Depot', amount: 800 },
        { id: 'e2', category: 'Materials', vendor: 'Lowes', amount: 200, linkedLineId: 'mat-1' },
        { id: 'e3', category: 'Labor', description: 'Crew week 1', amount: 5000 },
      ],
    });

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Materials & equipment');
    expect(sections[0].lineItems.map((line) => line.name)).toEqual(['Floor tile', 'Thinset']);
    expect(sections[0].lineItems[0].expenses).toEqual([
      { id: 'e2', label: 'Lowes', amount: 200 },
    ]);
    expect(sections[0].unlinkedExpenses).toEqual([
      { id: 'e1', label: 'Home Depot', amount: 800 },
    ]);
    expect(sections[1].lineItems[0].name).toBe('Tile install');
    expect(sections[1].unlinkedExpenses[0].amount).toBe(5000);
    expect(countRateInsightRows(sections)).toBe(5);
  });

  it('formats qty and unit rate instead of lump_sum totals', () => {
    const line = buildRateInsightSections({
      estimateData: {
        laborLineItems: [{ id: 'l1', name: 'Demo', qty: 8, unit: 'hr', unitPrice: 75, total: 600 }],
      },
      expenses: [],
    })[0].lineItems[0];

    expect(formatRateInsightLineEstimate(line)).toBe('8 hr @ $75.00/hr');
  });

  it('derives per-unit rate when stored unitPrice is the line total', () => {
    const line = buildRateInsightSections({
      estimateData: {
        laborLineItems: [
          { id: 'l1', name: 'Walls — labor', qty: 1500, unit: 'sq ft', unitPrice: 3718.5, total: 3718.5 },
        ],
      },
      expenses: [],
    })[0].lineItems[0];

    expect(formatRateInsightLineEstimate(line)).toBe('1500 sq ft @ $2.48/sq ft');
  });

  it('marks linked under-budget spend as on_track', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        materialLineItems: [
          { id: 'mat-1', name: 'Floor tile', qty: 500, unit: 'sqft', unitPrice: 5, total: 2500 },
        ],
      },
      expenses: [{ id: 'e1', category: 'Materials', amount: 2000, linkedLineId: 'mat-1' }],
    });
    const line = sections[0].lineItems[0];
    expect(getRateInsightSpendStatus(line)).toBe('on_track');
  });

  it('marks linked over-budget spend as over', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        materialLineItems: [
          { id: 'mat-1', name: 'Floor tile', qty: 500, unit: 'sqft', unitPrice: 5, total: 2500 },
        ],
      },
      expenses: [{ id: 'e1', category: 'Materials', amount: 3000, linkedLineId: 'mat-1' }],
    });
    const line = sections[0].lineItems[0];
    expect(getRateInsightSpendStatus(line)).toBe('over');
  });

  it('maps logged spend by estimate line id for picker rows', () => {
    const map = getEstimateLineLoggedSpendMap({
      kind: 'materials',
      estimateData: {
        materialLineItems: [
          { id: 'walls', name: 'Walls', total: 1306 },
          { id: 'prep', name: 'Prep & Masking', total: 270 },
        ],
      },
      expenses: [
        { id: 'e1', category: 'Materials', material: 'Walls', amount: 1000, linkedLineId: 'walls' },
        { id: 'e2', category: 'Materials', material: 'Prep & Masking', amount: 280, linkedLineId: 'prep' },
      ],
    });
    expect(map).toEqual({ walls: 1000, prep: 280 });
  });

  it('excludes the expense being edited from spend summaries', () => {
    const summaries = getEstimateLineSpendSummaries({
      kind: 'materials',
      estimateData: {
        materialLineItems: [{ id: 'walls', name: 'Walls', total: 1306 }],
      },
      expenses: [
        { id: 'e1', category: 'Materials', amount: 1000, linkedLineId: 'walls' },
      ],
      excludeExpenseId: 'e1',
    });
    expect(summaries.walls?.loggedTotal ?? 0).toBe(0);
    expect(summaries.walls?.remaining).toBe(1306);
  });

  it('assigns over-budget badge when spend exceeds line budget', () => {
    expect(getEstimateLineBudgetBadge(115, 100)).toBe('over');
    expect(getEstimateLineBudgetBadge(160, 100)).toBe('over');
    expect(getEstimateLineBudgetBadge(100, 100)).toBeNull();
    expect(getEstimateLineBudgetBadge(99, 100)).toBeNull();
  });

  it('sorts estimate lines with spend and overruns first', () => {
    const lines = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Bravo' },
      { id: 'c', name: 'Charlie' },
    ];
    const summaries = {
      a: { loggedTotal: 0, budget: 100, remaining: 100, variancePct: null, badge: null },
      b: { loggedTotal: 200, budget: 100, remaining: -100, variancePct: 100, badge: 'outlier' as const },
      c: { loggedTotal: 50, budget: 100, remaining: 50, variancePct: null, badge: null },
    };
    expect(sortEstimateLineOptions(lines, summaries).map((line) => line.id)).toEqual(['b', 'c', 'a']);
  });

  it('falls back to scope comparisons with expense rows when estimate lines are missing', () => {
    const sections = buildRateInsightSections({
      scopeComparisons: [
        {
          scopeItemKey: 'materials',
          estimateItem: {
            scopeItemKey: 'materials',
            name: 'Materials/Equipment',
            trade: 'Materials/Equipment',
            quantity: 1,
            unit: 'lump_sum',
            unitRate: 6006,
            totalDirectCost: 6006,
          },
          mappingStatus: 'likely_match',
          comparisonStatus: 'directly_comparable',
          normalizationSteps: [],
          estimatedQuantity: 1,
          estimatedDirectCost: 6006,
          actualDirectCost: 1000,
          costVariancePercent: -83.35,
          estimatedEffectiveRate: 6006,
          actualEffectiveRate: 1000,
          confidence: 'medium',
          notices: [],
          excludedFromCalibration: false,
        },
      ],
      expenses: [{ id: 'e1', category: 'Materials', vendor: 'Supplier A', amount: 600 }],
    });

    expect(sections[0].budgetOnly).toBe(true);
    expect(sections[0].lineItems).toHaveLength(0);
    expect(sections[0].estimatedTotal).toBe(6006);
    expect(sections[0].unlinkedExpenses[0].label).toBe('Supplier A');
  });

  it('reads estimate line items from project root estimateData', () => {
    const estimateData = resolveProjectEstimateData({
      id: 'p1',
      estimateData: {
        materialLineItems: [{ name: 'Drywall board', total: 1200, qty: 40, unit: 'sheet', unitPrice: 30 }],
        laborLineItems: [{ name: 'Hang drywall', total: 2400, qty: 800, unit: 'sqft', unitPrice: 3 }],
      },
      projectData: { expenses: [] },
    });
    const { materialLines, laborLines } = collectEstimateLineItems(estimateData);
    expect(materialLines).toHaveLength(1);
    expect(laborLines).toHaveLength(1);
    expect(materialLines[0].name).toBe('Drywall board');
  });

  it('does not auto-match drywall expense to Walls painting labor line', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        laborLineItems: [
          { id: 'lab-walls', name: 'Walls — labor', qty: 1500, unit: 'sq ft', total: 3718.5 },
          { id: 'lab-cabs', name: 'Cabinets — labor', qty: 200, unit: 'lf', total: 8333 },
        ],
      },
      expenses: [{ id: 'e1', category: 'Labor', description: 'Drywall', amount: 5000 }],
    });
    const laborSection = sections.find((section) => section.key === 'labor');
    const walls = laborSection?.lineItems.find((line) => line.id === 'lab-walls');
    expect(walls?.expenses ?? []).toHaveLength(0);
    expect(laborSection?.unlinkedExpenses).toHaveLength(1);
    expect(laborSection?.unlinkedExpenses[0].label).toBe('Drywall');
  });

  it('auto-matches drywall expense to a line that names drywall', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        laborLineItems: [
          { id: 'lab-walls', name: 'Walls — labor', total: 3718.5 },
          { id: 'lab-dw', name: 'Drywall hang — labor', total: 5000 },
        ],
      },
      expenses: [{ id: 'e1', category: 'Labor', description: 'Drywall crew', amount: 3200 }],
    });
    const drywallLine = sections
      .find((section) => section.key === 'labor')
      ?.lineItems.find((line) => line.id === 'lab-dw');
    expect(drywallLine?.expenses).toHaveLength(1);
  });

  it('auto-matches wall painting expense to Walls labor line', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        laborLineItems: [{ id: 'lab-walls', name: 'Walls — labor', total: 3718.5 }],
      },
      expenses: [{ id: 'e1', category: 'Labor', description: 'Interior wall painting', amount: 2000 }],
    });
    const walls = sections[0].lineItems.find((line) => line.id === 'lab-walls');
    expect(walls?.expenses).toHaveLength(1);
  });

  it('auto-matches exterior paint expense to matching material line', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        materialLineItems: [
          { id: 'mat-ext', name: 'Exterior Paint — materials', total: 1800 },
          { id: 'mat-walls', name: 'Walls — materials', total: 1306 },
        ],
      },
      expenses: [{ id: 'e1', category: 'Materials', description: 'Exterior paint supplies', amount: 400 }],
    });
    const exterior = sections[0].lineItems.find((line) => line.id === 'mat-ext');
    expect(exterior?.expenses).toHaveLength(1);
  });

  it('leaves vendor-only expenses unlinked when name does not match a line', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        materialLineItems: [{ id: 'mat-walls', name: 'Walls — materials', total: 1306 }],
      },
      expenses: [{ id: 'e1', category: 'Materials', vendor: 'Home Depot', amount: 1000 }],
    });
    expect(sections[0].lineItems[0].expenses).toHaveLength(0);
    expect(sections[0].unlinkedExpenses).toHaveLength(1);
  });

  it('auto-matches material field text to Cabinets estimate line', () => {
    const sections = buildRateInsightSections({
      estimateData: {
        materialLineItems: [
          { id: 'mat-cabs', name: 'Cabinets — materials', total: 2666 },
          { id: 'mat-walls', name: 'Walls — materials', total: 1306 },
        ],
      },
      expenses: [
        {
          id: 'e1',
          category: 'Materials/Equipment',
          vendor: 'Home Depot',
          material: 'Cabinets',
          amount: 2000,
        },
      ],
    });
    const cabinets = sections[0].lineItems.find((line) => line.id === 'mat-cabs');
    expect(cabinets?.expenses).toHaveLength(1);
    expect(cabinets?.expenses[0].amount).toBe(2000);
    expect(sections[0].unlinkedExpenses).toHaveLength(0);
  });

  it('does not score drywall as a match for Walls painting line', () => {
    const line = {
      id: 'walls',
      name: 'Walls — labor',
      categoryKey: 'labor' as const,
      estimatedTotal: 1000,
      loggedTotal: 0,
      expenses: [],
    };
    expect(scoreExpenseLineMatch({ id: 'e1', category: 'Labor', description: 'Drywall' }, line)).toBeLessThan(
      35
    );
  });
});
