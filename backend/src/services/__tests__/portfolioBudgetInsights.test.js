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
});
