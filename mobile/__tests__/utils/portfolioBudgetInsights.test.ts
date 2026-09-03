import {
  buildPortfolioBudgetInsights,
  projectToPortfolioBudgetInput,
} from '@/utils/portfolioBudgetInsights';

describe('portfolioBudgetInsights', () => {
  it('flags category and line overruns from logged costs', () => {
    const result = buildPortfolioBudgetInsights([
      {
        id: 'p1',
        title: 'Interior House',
        status: 'in_progress',
        estimateData: {
          materialLineItems: [
            { id: 'walls', name: 'Walls — materials', qty: 1500, unit: 'sq ft', unitPrice: 0.87, total: 1306 },
            { id: 'prep', name: 'Prep & Masking — materials', qty: 1500, unit: 'sq ft', unitPrice: 0.18, total: 270 },
          ],
        },
        buckets: [
          { name: 'Materials/Equipment', budget: 1306, spent: 1600 },
          { name: 'Labor', budget: 5000, spent: 2000 },
        ],
        expenses: [
          { id: 'e1', category: 'Materials', vendor: 'Home Depot', amount: 1000, linkedLineId: 'walls' },
          { id: 'e2', category: 'Materials', vendor: "Lowe's", amount: 600, linkedLineId: 'walls' },
          { id: 'e3', category: 'Materials', vendor: 'Home Depot', amount: 280, linkedLineId: 'prep' },
        ],
        plannedBudget: 6306,
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'category_over_budget')).toBe(true);
    expect(result.insights.some((i) => i.title.includes('Walls'))).toBe(true);
    expect(result.insights.find((i) => i.title.includes('Walls'))?.impactDollars).toBeGreaterThan(
      200
    );
    expect(result.nextSteps.some((s) => /materials/i.test(s.label))).toBe(true);
  });

  it('flags modest line overruns above the lower dollar threshold', () => {
    const result = buildPortfolioBudgetInsights([
      {
        id: 'p4',
        title: 'Paint Job',
        status: 'active',
        estimateData: {
          materialLineItems: [
            { id: 'prep', name: 'Prep & Masking — materials', qty: 1500, unit: 'sq ft', unitPrice: 0.18, total: 270 },
          ],
        },
        buckets: [{ name: 'Materials', budget: 500, spent: 280 }],
        expenses: [{ id: 'e1', category: 'Materials', amount: 280, linkedLineId: 'prep' }],
        plannedBudget: 500,
      },
    ]);

    expect(result.insights.some((i) => i.title.includes('Prep & Masking'))).toBe(true);
    expect(
      result.insights.find((i) => i.title.includes('Prep & Masking'))?.actionTarget
    ).toEqual({ kind: 'rate_insights', lineId: 'prep', section: 'materials' });
  });

  it('flags project-level overrun when total spend exceeds planned budget', () => {
    const result = buildPortfolioBudgetInsights([
      {
        id: 'p2',
        title: 'Kitchen Remodel',
        status: 'active',
        buckets: [
          { name: 'Materials', budget: 4000, spent: 4500 },
          { name: 'Labor', budget: 6000, spent: 2500 },
        ],
        expenses: [
          { id: 'e1', category: 'Materials', amount: 4500 },
          { id: 'e2', category: 'Labor', amount: 6500 },
        ],
        plannedBudget: 10000,
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'over_budget')).toBe(true);
  });

  it('ignores small line overruns below thresholds', () => {
    const result = buildPortfolioBudgetInsights([
      {
        id: 'p3',
        title: 'Bath Touch-up',
        status: 'won',
        estimateData: {
          materialLineItems: [
            { id: 'm1', name: 'Caulk', qty: 1, unit: 'lot', unitPrice: 40, total: 40 },
          ],
        },
        buckets: [{ name: 'Materials', budget: 500, spent: 200 }],
        expenses: [{ id: 'e1', category: 'Materials', amount: 41, linkedLineId: 'm1' }],
        plannedBudget: 500,
      },
    ]);

    expect(result.insights).toHaveLength(0);
  });

  it('flags labor line overruns alongside materials', () => {
    const result = buildPortfolioBudgetInsights([
      {
        id: 'p5',
        title: 'Kitchen Paint',
        status: 'active',
        estimateData: {
          materialLineItems: [
            { id: 'walls', name: 'Walls — materials', qty: 1, unit: 'lot', unitPrice: 1000, total: 1000 },
          ],
          laborLineItems: [
            { id: 'prep-labor', name: 'Prep labor', qty: 8, unit: 'hr', unitPrice: 50, total: 400 },
          ],
        },
        buckets: [
          { name: 'Materials', budget: 1000, spent: 1100 },
          { name: 'Labor', budget: 400, spent: 500 },
        ],
        expenses: [
          { id: 'e1', category: 'Materials', amount: 1100, linkedLineId: 'walls' },
          { id: 'e2', category: 'Labor', amount: 500, linkedLineId: 'prep-labor' },
        ],
        plannedBudget: 1400,
      },
    ]);

    const materialInsight = result.insights.find((i) => i.title.includes('Walls'));
    const laborInsight = result.insights.find((i) => i.title.includes('Prep labor'));
    expect(materialInsight?.actionTarget).toEqual({
      kind: 'rate_insights',
      lineId: 'walls',
      section: 'materials',
    });
    expect(laborInsight?.actionTarget).toEqual({
      kind: 'rate_insights',
      lineId: 'prep-labor',
      section: 'labor',
    });
    expect(result.nextSteps.some((s) => s.label === 'Prep labor')).toBe(true);
  });

  it('maps stored project rows into insight input', () => {
    const input = projectToPortfolioBudgetInput({
      id: 'abc',
      title: 'Deck Build',
      status: 'in_progress',
      bidPrice: 12000,
      projectData: {
        buckets: [{ name: 'Labor', budget: 3000, spent: 3100 }],
        expenses: [{ id: 'e1', category: 'Labor', amount: 3100 }],
      },
      estimateData: {
        laborLineItems: [{ id: 'l1', name: 'Framing', qty: 1, unit: 'lot', unitPrice: 3000, total: 3000 }],
      },
    });

    expect(input?.id).toBe('abc');
    expect(input?.plannedBudget).toBe(3000);
    expect(input?.expenses).toHaveLength(1);
  });
});
