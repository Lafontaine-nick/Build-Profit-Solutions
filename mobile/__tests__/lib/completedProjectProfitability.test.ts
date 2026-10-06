import {
  completedJobActualCost,
  getCompletedProjectMarginPercent,
  getCompletedProjectProfit,
} from '@/lib/completedProjectProfitability';

describe('completed project profit', () => {
  it('includes received purchase orders when the stored actual cost is bills only', () => {
    const project = {
      status: 'completed',
      actualCost: 2000,
      estimateData: { grandTotal: 10000 },
      expenses: [{ amount: 2000 }],
      purchaseOrders: [
        { status: 'Received', amount: 800 },
        { status: 'Cancelled', amount: 500 },
      ],
    };

    expect(completedJobActualCost(project)).toBe(2800);
    expect(getCompletedProjectProfit(project)).toBe(7200);
    expect(getCompletedProjectMarginPercent(project)).toBeCloseTo(72, 5);
  });
});
