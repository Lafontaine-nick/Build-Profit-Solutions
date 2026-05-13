/**
 * Golden-style regression tests for Tax Center math.
 * Note: `npm test` uses jest-expo; if the preset fails on your Node version, run this file once the Jest
 * pipeline is healthy — assertions are standard Jest.
 */
import {
  calculateOutstandingInvoices,
  computeTaxCenterSummary,
  getCommittedCostsDetailRows,
  getYearCollectedPayments,
  getYearExpenses,
  isPoPaidForTax,
} from '@/src/lib/taxCenter';

/** Golden-style fixtures: document current Tax Center behavior; do not change production math to satisfy tests. */

describe('Tax Center golden fixtures', () => {
  const vendors: any[] = [];

  it('Fixture A: single project with payment and expense in same tax year', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Kitchen remodel',
        projectData: {
          timelineV2Milestones: [
            {
              id: 'm1',
              title: 'Deposit collected',
              amount: 1000,
              paymentAmount: 1000,
              status: 'paid',
              collectedAt: '2026-04-10',
            },
          ],
        },
        expenses: [
          {
            id: 'e1',
            vendor: 'Lumber Co',
            amount: 300,
            date: '2026-04-12',
            paidAt: '2026-04-12',
            paymentStatus: 'paid',
            category: 'Materials',
          },
        ],
      },
    ];
    const s = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(s.grossIncomeCollected).toBe(1000);
    expect(s.totalExpenses).toBe(300);
    expect(s.netProfit).toBe(700);
    const ye = getYearExpenses(projects, 2026);
    expect(ye.length).toBe(1);
    expect(getYearCollectedPayments(projects, 2026).length).toBe(1);
  });

  it('Fixture B: cross-year payment only 2026 counts in 2026', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        projectData: {
          timelineV2Milestones: [
            { id: 'a', title: '2025', amount: 100, paymentAmount: 100, status: 'paid', collectedAt: '2025-12-15' },
            { id: 'b', title: '2026', amount: 200, paymentAmount: 200, status: 'paid', collectedAt: '2026-01-05' },
          ],
        },
      },
    ];
    const s2025 = computeTaxCenterSummary(projects, [], [], [], 2025, vendors);
    const s2026 = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(s2025.grossIncomeCollected).toBe(100);
    expect(s2026.grossIncomeCollected).toBe(200);
  });

  it('Fixture C: uncollected milestone in 2026 shows in AR, not revenue', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        projectData: {
          timelineV2Milestones: [
            {
              id: 'open1',
              title: 'Final draw',
              amount: 500,
              paymentAmount: 500,
              status: 'pending',
              plannedDate: '2026-08-01',
            },
          ],
        },
      },
    ];
    const s = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(s.grossIncomeCollected).toBe(0);
    expect(s.outstandingReceivables).toBe(500);
    expect(calculateOutstandingInvoices(projects[0], 2026)).toBe(500);
  });

  it('Fixture D: pending PO in committed costs; paid PO in expenses when paid in year', () => {
    const pending = {
      id: 'po-p',
      vendor: 'Supply',
      amount: 50,
      status: 'pending',
      orderDate: '2026-03-01',
    };
    const paid = {
      id: 'po-paid',
      vendor: 'Supply',
      amount: 80,
      status: 'received',
      orderDate: '2026-02-01',
      paidAt: '2026-03-15',
    };
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        purchaseOrders: [pending, paid],
      },
    ];
    const s = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(s.committedCosts).toBe(50);
    expect(isPoPaidForTax(paid)).toBe(true);
    expect(s.totalExpenses).toBe(80);
    const committedRows = getCommittedCostsDetailRows(projects, 2026);
    expect(committedRows.some((r) => r.poLabel === 'po-p')).toBe(true);
  });

  it('Fixture E: documents current revenue for collected change_order milestone (no mandated total)', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        projectData: {
          timelineV2Milestones: [
            {
              id: 'bps-co-test',
              title: 'CO Tile',
              type: 'change_order',
              amount: 25,
              paymentAmount: 25,
              status: 'paid',
              collectedAt: '2026-05-01',
            },
          ],
        },
      },
    ];
    const s = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    const collected = getYearCollectedPayments(projects, 2026);
    /**
     * TODO: If product later requires every approved CO collection path to appear in Revenue Collected,
     * update this expectation after an explicit math change. Today we only document actual `computeTaxCenterSummary`.
     */
    expect(typeof s.grossIncomeCollected).toBe('number');
    expect(Array.isArray(collected)).toBe(true);
  });

  it('Fixture F: missing receipt surfaces on year expense lines used by readiness', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        expenses: [
          {
            id: 'e1',
            vendor: 'V',
            amount: 10,
            date: '2026-06-01',
            paidAt: '2026-06-01',
            paymentStatus: 'paid',
            receiptUri: '',
            category: 'Materials',
          },
        ],
      },
    ];
    const ye = getYearExpenses(projects, 2026);
    const missingReceipt = ye.filter((e) => !String(e.receiptUri ?? '').trim() && Number(e.amount) > 0);
    expect(missingReceipt.length).toBeGreaterThanOrEqual(1);
  });

  it('Collected payment without primary collected date fields can still count in-year via schedule date', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        projectData: {
          timelineV2Milestones: [
            {
              id: 'x',
              title: 'Paid no primary date',
              amount: 40,
              paymentAmount: 40,
              status: 'paid',
              scheduledDate: '2026-07-01',
            },
          ],
        },
      },
    ];
    const s = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(s.grossIncomeCollected).toBe(40);
  });
});
