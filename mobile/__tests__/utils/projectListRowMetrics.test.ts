import { computeProjectListRowFinancials } from '@/lib/projectListRowMetrics';

describe('project list estimate profit', () => {
  it('keeps estimated net profit after job costs are paid', () => {
    const estimateData = {
      bidPrice: 30911.5,
      materialLineItems: [{ total: 5870 }],
      laborLineItems: [{ total: 19340 }],
      equipment: 500,
      allowanceLineItems: [{ amount: 300 }],
      contingencyAllowance: 1000,
      insuranceOverhead: 200,
      equipmentMaintenance: 100,
    };
    const project = {
      id: 'electrical',
      status: 'active',
      bidPrice: 30911.5,
      estimateData,
      expenses: [{ id: 'e1', amount: 2750, category: 'Labor' }],
    };

    const row = computeProjectListRowFinancials({
      mergedProject: project,
      originalRow: project,
      progressPct: 0,
    });

    expect(row.revenue).toBe(30911.5);
    expect(row.projectedProfit).toBeCloseTo(3601.5, 2);
    expect(row.margin).toBeCloseTo(11.65, 1);
  });
});
