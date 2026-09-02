import {
  buildRateInsightSections,
  countRateInsightRows,
  formatRateInsightLineEstimate,
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

    expect(formatRateInsightLineEstimate(line)).toBe('8 hr @ $75/hr');
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

    expect(sections[0].lineItems[0].name).toBe('Materials/Equipment');
    expect(sections[0].lineItems[0].estimatedTotal).toBe(6006);
    expect(sections[0].unlinkedExpenses[0].label).toBe('Supplier A');
  });
});
