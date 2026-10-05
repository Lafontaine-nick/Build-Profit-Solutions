import {
  approvedChangeOrderBudgetLines,
  changeOrderBudgetLineId,
} from '@/src/lib/projectFinancials';

describe('approvedChangeOrderBudgetLines', () => {
  const project = {
    changeOrders: [
      {
        id: 'co-concrete',
        title: 'Concrete',
        amount: 1700,
        materialsAmount: 500,
        laborAmount: 1200,
        status: 'Approved',
        approved: true,
      },
      {
        id: 'co-draft',
        title: 'Paint',
        materialsAmount: 200,
        laborAmount: 100,
        status: 'Submitted',
      },
    ],
  };

  it('lists approved change-order materials apart from the estimate lines', () => {
    const lines = approvedChangeOrderBudgetLines(project, 'materials');
    expect(lines).toEqual([
      {
        id: changeOrderBudgetLineId('materials', 'co-concrete'),
        name: 'Concrete',
        budget: 500,
      },
    ]);
  });

  it('lists approved change-order labor on its own line', () => {
    const lines = approvedChangeOrderBudgetLines(project, 'labor');
    expect(lines).toEqual([
      {
        id: changeOrderBudgetLineId('labor', 'co-concrete'),
        name: 'Concrete',
        budget: 1200,
      },
    ]);
  });
});
