const { buildPortfolioBudgetInsights } = require('../portfolioBudgetInsights');

describe('portfolioBudgetInsights', () => {
  test('flags category and line overruns', () => {
    const result = buildPortfolioBudgetInsights([
      {
        id: 'p1',
        title: 'Interior House',
        status: 'in_progress',
        estimateData: {
          materialLineItems: [
            { id: 'walls', name: 'Walls — materials', qty: 1500, unit: 'sq ft', unitPrice: 0.87, total: 1306 },
          ],
        },
        buckets: [{ name: 'Materials/Equipment', budget: 1306, spent: 1600 }],
        expenses: [{ id: 'e1', category: 'Materials', amount: 1600, linkedLineId: 'walls' }],
        estimatedCost: 1306,
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'category_over_budget')).toBe(true);
    expect(result.insights.some((i) => i.leakType === 'line_over_estimate')).toBe(true);
    expect(result.insights[0].actionTarget).toBeDefined();
  });

  test('uses the full project budget when buckets are only partial', () => {
    const result = buildPortfolioBudgetInsights([{
      id: 'p2',
      title: 'Kitchen Remodel',
      status: 'active',
      estimatedCost: 70000,
      buckets: [{ name: 'Materials', budget: 10000, spent: 20000 }],
      expenses: [{ id: 'e1', category: 'Materials', amount: 20000 }],
    }]);

    expect(result.insights.find((i) => i.leakType === 'over_budget')).toBeUndefined();
  });

  test('completed projects get line closeout insights but not project-level operational alerts', () => {
    const result = buildPortfolioBudgetInsights([{
      id: 'p3',
      title: 'Closed Remodel',
      status: 'completed',
      estimatedCost: 10000,
      buckets: [{ name: 'Materials', budget: 10000, spent: 15000 }],
      estimateData: {
        materialLineItems: [
          { id: 'w', name: 'Walls — materials', total: 1306 },
        ],
      },
      expenses: [{ id: 'e1', category: 'Materials', amount: 1600, linkedLineId: 'w' }],
    }]);

    expect(result.insights.some((i) => i.leakType === 'line_over_estimate')).toBe(true);
    expect(result.insights.some((i) => i.leakType === 'over_budget')).toBe(false);
    expect(result.insights.some((i) => i.leakType === 'category_over_budget')).toBe(false);
    expect(result.nextSteps.some((s) => s.leakType === 'line_over_estimate')).toBe(true);
  });
});
