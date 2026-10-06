import {
  approvedChangeOrderBudgetLines,
  bidMarkupPercent,
  changeOrderCardTitle,
  changeOrderBudgetLineId,
  changeOrderClientPrice,
  changeOrderIdFromBudgetLineId,
  changeOrderLineSpendSummaries,
  changeOrderUnspentBillAmounts,
  findSavedTimelineMilestone,
  getApprovedChangeOrderPaymentRows,
  mergeTimelineMilestoneWithSaved,
  isChangeOrderPaymentReceivedInMilestones,
  sumApprovedChangeOrderEstimatedCost,
  sumApprovedChangeOrderRevenue,
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
        clientPrice: 1700,
      },
    ]);
  });

  it('tracks spend against the change-order materials line', () => {
    const id = changeOrderBudgetLineId('materials', 'co-concrete');
    const summaries = changeOrderLineSpendSummaries(project, 'materials', [
      { linkedLineId: id, amount: 350 },
    ]);
    expect(summaries[id].loggedTotal).toBe(350);
    expect(summaries[id].budget).toBe(500);
    expect(summaries[id].remaining).toBe(150);
    expect(summaries[id].badge).toBeNull();
  });

  it('lists approved change-order labor on its own line', () => {
    const lines = approvedChangeOrderBudgetLines(project, 'labor');
    expect(lines).toEqual([
      {
        id: changeOrderBudgetLineId('labor', 'co-concrete'),
        name: 'Concrete',
        budget: 1200,
        clientPrice: 1700,
      },
    ]);
  });

  it('uses the client price so two orders with the same name stay distinct', () => {
    const orders = [
      {
        id: 'co-1',
        title: 'Concrete',
        amount: 1700,
        materialsAmount: 500,
        laborAmount: 1200,
        approved: true,
        status: 'Approved',
      },
      {
        id: 'co-2',
        title: 'Concrete',
        amount: 1200,
        clientPrice: 1200,
        materialsAmount: 500,
        laborAmount: 500,
        markupPct: 20,
        approved: true,
        status: 'Approved',
      },
      {
        id: 'co-3',
        title: 'Drywall',
        amount: 600,
        clientPrice: 600,
        materialsAmount: 200,
        laborAmount: 300,
        approved: true,
        status: 'Approved',
      },
    ];
    const project = { changeOrders: orders };
    expect(changeOrderCardTitle(orders[0], orders)).toBe('Concrete · $1,700.00');
    expect(changeOrderCardTitle(orders[1], orders)).toBe('Concrete · $1,200.00');
    expect(changeOrderCardTitle(orders[2], orders)).toBe('Drywall');
    expect(approvedChangeOrderBudgetLines(project, 'materials').map((line) => line.name)).toEqual([
      'Concrete · $1,700.00',
      'Concrete · $1,200.00',
      'Drywall',
    ]);
    expect(approvedChangeOrderBudgetLines(project, 'labor').map((line) => [line.name, line.budget])).toEqual([
      ['Concrete · $1,700.00', 1200],
      ['Concrete · $1,200.00', 500],
      ['Drywall', 300],
    ]);
    expect(getApprovedChangeOrderPaymentRows(project).map((row) => [row.title, row.amount])).toEqual([
      ['Change order: Concrete · $1,700.00', 1700],
      ['Change order: Concrete · $1,200.00', 1200],
      ['Change order: Drywall', 600],
    ]);
  });
});

describe('change order markup', () => {
  it('adds markup as profit on top of material and labor cost', () => {
    expect(changeOrderClientPrice(1700, 20)).toBe(2040);
    expect(changeOrderClientPrice(1700, 0)).toBe(1700);
    expect(bidMarkupPercent({ estimateData: { markupPct: 20 } })).toBe(20);
  });

  it('leaves a flat approved change order at its stored price', () => {
    const orders = [
      {
        id: 'co-concrete',
        amount: 1700,
        materialsAmount: 500,
        laborAmount: 1200,
        approved: true,
        status: 'Approved',
      },
    ];
    expect(sumApprovedChangeOrderRevenue(orders, 20)).toBe(1700);
    expect(sumApprovedChangeOrderEstimatedCost(orders, 33950, 28625, 20)).toBe(1700);
  });

  it('bills the client price and keeps the cost cap at material plus labor', () => {
    const orders = [
      {
        id: 'co-concrete',
        amount: 2040,
        clientPrice: 2040,
        materialsAmount: 500,
        laborAmount: 1200,
        markupPct: 20,
        approved: true,
        status: 'Approved',
      },
    ];
    expect(sumApprovedChangeOrderRevenue(orders, 20)).toBe(2040);
    expect(sumApprovedChangeOrderEstimatedCost(orders, 33950, 28625, 20)).toBe(1700);
    expect(approvedChangeOrderBudgetLines({ changeOrders: orders }, 'materials')[0].budget).toBe(500);
    expect(approvedChangeOrderBudgetLines({ changeOrders: orders }, 'labor')[0].budget).toBe(1200);
  });

  it('requires the Timeline payment to be received before a change-order bill can be logged', () => {
    expect(changeOrderIdFromBudgetLineId(changeOrderBudgetLineId('materials', 'co-drywall'))).toBe('co-drywall');
    expect(changeOrderIdFromBudgetLineId(changeOrderBudgetLineId('labor', 'co-drywall'))).toBe('co-drywall');
    expect(changeOrderIdFromBudgetLineId('panel')).toBeNull();
    const milestones = [
      { id: 'bps-co-co-concrete', status: 'completed' },
      { id: 'bps-co-co-drywall', status: 'pending' },
    ];
    expect(isChangeOrderPaymentReceivedInMilestones(milestones, 'co-concrete')).toBe(true);
    expect(isChangeOrderPaymentReceivedInMilestones(milestones, 'co-drywall')).toBe(false);
  });

  it('keeps the bill prompt until the change-order materials and labor are logged', () => {
    const drywall = {
      changeOrders: [
        {
          id: 'co-drywall',
          title: 'Drywall',
          materialsAmount: 200,
          laborAmount: 300,
          approved: true,
          status: 'Approved',
        },
      ],
    };
    expect(changeOrderUnspentBillAmounts(drywall, [], 'co-drywall')).toEqual({
      name: 'Drywall',
      materialsRemaining: 200,
      laborRemaining: 300,
    });
    expect(
      changeOrderUnspentBillAmounts(
        drywall,
        [
          { linkedLineId: changeOrderBudgetLineId('materials', 'co-drywall'), amount: 200 },
          { linkedLineId: changeOrderBudgetLineId('labor', 'co-drywall'), amount: 300 },
        ],
        'co-drywall'
      )
    ).toBeNull();
  });

  it('does not copy one change order payment onto another with the same name', () => {
    const saved = [
      { id: 'bps-co-co-1', title: 'Change order: Concrete', status: 'completed', amount: 1700 },
    ];
    expect(findSavedTimelineMilestone(saved, { id: 'bps-co-co-1', title: 'Change order: Concrete' })?.amount).toBe(1700);
    expect(findSavedTimelineMilestone(saved, { id: 'bps-co-co-2', title: 'Change order: Concrete' })).toBeUndefined();
    expect(findSavedTimelineMilestone(
      [{ id: 'legacy', title: 'Change order: Paint', status: 'pending' }],
      { id: 'bps-co-paint', title: 'Change order: Paint' }
    )?.id).toBe('legacy');
  });

  it('keeps a received change order and drops a copied receipt with the wrong price', () => {
    const original = mergeTimelineMilestoneWithSaved(
      { id: 'bps-co-co-1', title: 'Change order: Concrete', amount: 1700, status: 'pending' },
      { id: 'bps-co-co-1', title: 'Change order: Concrete', amount: 1700, status: 'completed', collectedAt: '2026-10-04T12:00:00.000Z' }
    );
    expect(original.amount).toBe(1700);
    expect(original.status).toBe('completed');

    const copied = mergeTimelineMilestoneWithSaved(
      { id: 'bps-co-co-2', title: 'Change order: Concrete', amount: 1200, status: 'pending' },
      { id: 'bps-co-co-2', title: 'Change order: Concrete', amount: 1700, status: 'completed', collectedAt: '2026-10-04T12:00:00.000Z' }
    );
    expect(copied.amount).toBe(1200);
    expect(copied.status).toBe('pending');
    expect(copied.collectedAt).toBeUndefined();
  });
});
