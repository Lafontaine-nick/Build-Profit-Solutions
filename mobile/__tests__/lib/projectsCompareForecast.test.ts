import { computeProjectsCompareData } from '@/src/lib/projectsCompareData';

describe('computeProjectsCompareData profit forecast', () => {
  const payments = [
    { id: 'd', title: 'Deposit', type: 'deposit', status: 'completed', progressPct: 100 },
    { id: 'w1', title: 'Week 1 Progress Payment', status: 'completed', progressPct: 100 },
    { id: 'w2', title: 'Week 2 Progress Payment', status: 'pending', progressPct: 0 },
    { id: 'w3', title: 'Week 3 Progress Payment', status: 'pending', progressPct: 0 },
    { id: 'w4', title: 'Week 4 Progress Payment', status: 'pending', progressPct: 0 },
    { id: 'w5', title: 'Week 5 Progress Payment', status: 'pending', progressPct: 0 },
  ];

  it('keeps projected profit on the estimate when the timeline is only payments', () => {
    const [row] = computeProjectsCompareData(
      [
        {
          id: 'job-1',
          title: 'Electrical',
          status: 'active',
          bidPrice: 33950,
          estimatedCost: 28625,
          actualCost: 1400,
          companyOverhead: 300,
        },
      ],
      [],
      {},
      { 'job-1': 20 },
      { 'job-1': payments }
    );

    expect(row.progress).toBe(20);
    expect(row.projectedProfit).toBe(5025);
  });
});
