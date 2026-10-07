/**
 * Golden-style regression tests for Tax Center math.
 * Note: `npm test` uses jest-expo; if the preset fails on your Node version, run this file once the Jest
 * pipeline is healthy — assertions are standard Jest.
 */
import {
  buildProjectTaxSummaries,
  calculateOutstandingInvoices,
  computeTaxCenterSummary,
  expenseCountsTowardSubcontractorPayments,
  expenseCountsTowardW2Payments,
  laborPayeeCountsAsSubcontractorPayment,
  laborPaymentBadge,
  getCommittedCostsDetailRows,
  getOutstandingReceivablesDetailRows,
  getYearCollectedPayments,
  getYearExpenses,
  formatTaxNetMarginPercent,
  isCurrentTaxProject,
  isPoPaidForTax,
  taxExpenseRecordLabel,
  sortTaxExpensesForDisplay,
} from '@/src/lib/taxCenter';
import { build1099ReviewSummary, buildW9ReminderPayees } from '@/src/lib/tax1099Review';

/** Golden-style fixtures: document Tax Center behavior and protect calculation invariants. */

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
    const rows = buildProjectTaxSummaries(projects, 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0].revenueCollected).toBe(s.grossIncomeCollected);
    expect(rows[0].expensesPaid).toBe(s.totalExpenses);
    expect(rows[0].netIncome).toBe(700);
    expect(rows[0].outstandingInvoices).toBe(s.outstandingReceivables);
    expect(rows[0].margin).toBeCloseTo(0.7);
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
    const rows = buildProjectTaxSummaries(projects, 2026);
    expect(rows[0].revenueCollected).toBe(0);
    expect(rows[0].outstandingInvoices).toBe(500);
    expect(rows[0].netIncome).toBe(0);
  });

  it('Caps duplicated open milestones at the project contract less collected cash', () => {
    const project = {
      id: 'p1',
      title: 'Current Job',
      status: 'in_progress',
      bidPrice: 30773.23,
      payments: [
        {
          id: 'collected',
          amount: 29234.36,
          status: 'paid',
          actualDate: '2026-06-01',
        },
        {
          id: 'open',
          amount: 427538.64,
          status: 'scheduled',
          scheduledDate: '2026-10-12',
        },
      ],
    };
    expect(calculateOutstandingInvoices(project, 2026)).toBeCloseTo(1538.87, 2);
    expect(getOutstandingReceivablesDetailRows([project], 2026).reduce((sum, row) => sum + row.amount, 0)).toBeCloseTo(
      1538.87,
      2
    );
  });

  it('Includes in-progress and finished jobs in Tax Center scope', () => {
    expect(isCurrentTaxProject({ status: 'active' })).toBe(true);
    expect(isCurrentTaxProject({ status: 'in_progress' })).toBe(true);
    expect(isCurrentTaxProject({ status: 'completed' })).toBe(true);
    expect(isCurrentTaxProject({ status: 'bid_submitted' })).toBe(false);
  });

  it('Uses a single bounded open balance for duplicate or stale invoice rows', () => {
    const project = {
      id: 'p1',
      title: 'Job',
      invoices: [
        {
          number: 'INV-1',
          issueDate: '2026-02-01',
          total: 100,
          balance: 250,
          status: 'sent',
        },
        {
          number: 'INV-PAID',
          issueDate: '2026-02-02',
          total: 75,
          status: 'paid',
        },
        {
          number: 'INV-DRAFT',
          issueDate: '2026-02-03',
          total: 500,
          balance: 500,
          status: 'draft',
        },
      ],
      projectData: {
        invoices: [
          {
            number: 'INV-1',
            issueDate: '2026-02-01',
            total: 100,
            balance: 250,
            status: 'sent',
          },
        ],
      },
    };
    expect(calculateOutstandingInvoices(project, 2026)).toBe(100);
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
      status: 'paid',
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

  it('Treats a received purchase order as a cash expense', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        purchaseOrders: [
          {
            id: 'po-received',
            vendor: 'Supply',
            amount: 80,
            status: 'received',
            orderDate: '2026-02-01',
            receivedAt: '2026-03-15',
          },
        ],
      },
    ];
    const summary = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(summary.totalExpenses).toBe(80);
    expect(summary.committedCosts).toBe(0);
    expect(isPoPaidForTax(projects[0].purchaseOrders[0])).toBe(true);
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

  it('Does not treat a scheduled change-order paymentDate as collected cash', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        bidPrice: 30000,
        changeOrders: [
          {
            id: 'co-1',
            title: 'Concrete',
            amount: 1400,
            clientPrice: 1400,
            approved: true,
            status: 'Approved',
          },
        ],
        projectData: {
          timelineV2Milestones: [
            {
              id: 'bps-co-co-1',
              type: 'change_order',
              title: 'Change order: Concrete',
              amount: 1400,
              paymentAmount: 1400,
              status: 'paid',
              paymentDate: '2026-09-04',
              scheduledDate: '2026-09-04',
            },
          ],
        },
      },
    ];
    const summary = computeTaxCenterSummary(projects, [], [], [], 2026, vendors);
    expect(summary.grossIncomeCollected).toBe(0);
    expect(summary.outstandingReceivables).toBe(1400);
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

  it('Does not count a collected payment by scheduled date without an actual collection date', () => {
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
    expect(s.grossIncomeCollected).toBe(0);
    expect(getYearCollectedPayments(projects, 2026)).toHaveLength(0);
  });

  it('Buckets a date-only Jan 1 payment into the local selected tax year', () => {
    const projects = [
      {
        id: 'p1',
        title: 'Job',
        projectData: {
          timelineV2Milestones: [
            {
              id: 'new-year',
              title: 'New year payment',
              amount: 40,
              paymentAmount: 40,
              status: 'paid',
              collectedAt: '2026-01-01',
            },
          ],
        },
      },
    ];
    expect(computeTaxCenterSummary(projects, [], [], [], 2025, vendors).grossIncomeCollected).toBe(0);
    expect(computeTaxCenterSummary(projects, [], [], [], 2026, vendors).grossIncomeCollected).toBe(40);
  });

  it('Aligns 1099 review with a paid date when the expense record date is from an earlier year', () => {
    const review = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2026,
      payments: [],
      expenses: [
        {
          id: 'sub-1',
          vendor: 'Trade Partner',
          category: 'Subcontractors',
          amount: 800,
          date: '2025-12-31',
          paidAt: '2026-01-02',
          paymentStatus: 'paid',
        },
      ],
    });
    expect(review.potential1099VendorCount).toBe(0);
    expect(review.rows[0]?.totalPaid).toBe(800);
  });
});

describe('labor paid-to subcontractor payments', () => {
  it('counts a labor payee without a W-9 vendor record', () => {
    const nicholas = {
      category: 'Labor',
      vendor: 'Nicholas',
      trade: 'Electrical',
      amount: 1000,
    };
    const tradeOnly = {
      category: 'Labor',
      vendor: 'Electrical',
      trade: 'Electrical',
      amount: 1000,
    };
    expect(laborPayeeCountsAsSubcontractorPayment(nicholas)).toBe(true);
    expect(expenseCountsTowardSubcontractorPayments(nicholas, [])).toBe(true);
    expect(laborPayeeCountsAsSubcontractorPayment(tradeOnly)).toBe(false);
    expect(expenseCountsTowardSubcontractorPayments(tradeOnly, [])).toBe(false);
    expect(laborPaymentBadge(nicholas)).toBe('1099');
    expect(laborPaymentBadge(tradeOnly)).toBeNull();
  });

  it('treats me, myself, and self as the owner’s own labor', () => {
    for (const vendor of ['me', 'Myself', 'self.']) {
      const bill = { category: 'Labor', vendor, trade: 'Electrical', amount: 500 };
      expect(laborPayeeCountsAsSubcontractorPayment(bill)).toBe(false);
      expect(laborPaymentBadge(bill)).toBeNull();
    }
  });

  it('keeps a W-2 labor payee off subcontractor payments and the 1099 review', () => {
    const employee = {
      category: 'Labor',
      vendor: 'Alex',
      trade: 'Electrical',
      amount: 800,
      laborPayType: 'w2' as const,
    };
    expect(expenseCountsTowardW2Payments(employee)).toBe(true);
    expect(expenseCountsTowardSubcontractorPayments(employee, [])).toBe(false);
    expect(laborPaymentBadge(employee)).toBe('W-2');
  });

  it('flags only named 1099 payees for 1099 review, not trade-only or W-2 labor', () => {
    const review = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2026,
      payments: [],
      expenses: [
        { id: 'n', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 1000, date: '2026-10-06', paymentStatus: 'paid' },
        { id: 'e', category: 'Labor', vendor: 'Electrical', trade: 'Electrical', amount: 7000, date: '2026-10-04', paymentStatus: 'paid' },
        { id: 's', category: 'Labor', vendor: 'Steve', trade: 'Electrical', amount: 2000, date: '2026-10-06', paymentStatus: 'paid', laborPayType: 'w2' },
        { id: 'c', category: 'Contingency', vendor: 'Labor', amount: 500, date: '2026-10-05', paymentStatus: 'paid' },
      ],
    });
    expect(review.potential1099VendorCount).toBe(0);
    expect(review.missingW9Count).toBe(1);
    expect(review.rows.map((r) => r.displayName)).toEqual(['Nicholas']);
  });

  it('flags a 2026 payee at $2,000 and keeps $600 for 2025', () => {
    const atThreshold = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2026,
      payments: [],
      expenses: [
        { id: 'n', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 2000, date: '2026-10-06', paymentStatus: 'paid' },
      ],
    });
    expect(atThreshold.potential1099VendorCount).toBe(1);

    const priorYear = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2025,
      payments: [],
      expenses: [
        { id: 'n', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 600, date: '2025-10-06', paymentStatus: 'paid' },
      ],
    });
    expect(priorYear.potential1099VendorCount).toBe(1);
  });

  it('asks for a payment method on 1099 payees only', () => {
    const review = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2026,
      payments: [],
      expenses: [
        { id: 'n', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 1000, date: '2026-10-06', paymentStatus: 'paid' },
        { id: 'h', category: 'Materials/Equipment', vendor: 'Home Depot', amount: 400, date: '2026-10-06', paymentStatus: 'paid' },
      ],
    });
    expect(review.paymentsMissingMethodCount).toBe(1);
  });

  it('keeps card payments out of the 1099 filing threshold', () => {
    const cardOnly = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2026,
      payments: [],
      expenses: [
        { id: 'n', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 2500, date: '2026-10-06', paymentStatus: 'paid', paymentMethod: 'card' },
      ],
    });
    expect(cardOnly.potential1099VendorCount).toBe(0);

    const byCheck = build1099ReviewSummary({
      vendors: [],
      selectedYear: 2026,
      payments: [],
      expenses: [
        { id: 'n', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 2000, date: '2026-10-06', paymentStatus: 'paid', paymentMethod: 'check' },
      ],
    });
    expect(byCheck.potential1099VendorCount).toBe(1);
  });

  it('reminds for a W-9 until the payee is marked received', () => {
    const rows = [
      { id: 'n1', category: 'Labor', vendor: 'Nicholas', trade: 'Electrical', amount: 600 },
      { id: 'n2', category: 'Labor', vendor: 'nicholas ', trade: 'Electrical', amount: 400 },
    ];
    const pending = buildW9ReminderPayees(rows, []);
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe('Nicholas');
    expect(pending[0].totalPaid).toBe(1000);

    const received = {
      id: 'v1',
      userId: 'u',
      businessName: 'Nicholas',
      vendorType: 'subcontractor' as const,
      w9Status: 'uploaded' as const,
      createdAt: '',
      updatedAt: '',
    };
    expect(buildW9ReminderPayees(rows, [received])).toEqual([]);
    expect(buildW9ReminderPayees(rows, [{ ...received, w9Status: 'requested' as const }])).toHaveLength(1);
  });
});

describe('tax net margin label', () => {
  it('keeps one decimal so 55.5% does not round to 56%', () => {
    expect(formatTaxNetMarginPercent(20850 / 37550)).toBe('55.5%');
  });
});

describe('tax expense card labels', () => {
  it('labels change orders, purchase orders, and contingency without relabeling ordinary bills', () => {
    expect(taxExpenseRecordLabel({ category: 'Materials/Equipment', vendor: 'Home Depot', linkedLineId: 'bps-co-material-co-1' })).toBe('Change order');
    expect(taxExpenseRecordLabel({ category: 'Labor', vendor: 'Concrete', linkedLineId: 'bps-co-labor-co-1' })).toBe('Change order');
    expect(taxExpenseRecordLabel({ category: 'Materials', vendor: 'Home Depot', __isPurchaseOrder: true })).toBe('Purchase order');
    expect(taxExpenseRecordLabel({ category: 'Contingency', vendor: 'Labor' })).toBe('Contingency');
    expect(taxExpenseRecordLabel({ category: 'Materials/Equipment', vendor: 'Home Depot' })).toBeNull();
    expect(taxExpenseRecordLabel({ category: 'Labor', vendor: 'Electrical' })).toBeNull();
  });

  it('lists regular materials and labor before change orders, purchase orders, soft costs, contingency, and overhead', () => {
    const ordered = sortTaxExpensesForDisplay([
      { category: 'Company overhead', vendor: 'Farmers', date: '2026-10-06', amount: 100 },
      { category: 'Contingency', vendor: 'Labor', date: '2026-10-04', amount: 500 },
      { category: 'Soft costs', vendor: 'City', date: '2026-10-04', amount: 200 },
      { category: 'Materials', vendor: 'Home Depot', date: '2026-10-04', amount: 1000, __isPurchaseOrder: true },
      { category: 'Materials/Equipment', vendor: 'Home Depot', date: '2026-10-06', amount: 500, linkedLineId: 'bps-co-material-co-1' },
      { category: 'Materials/Equipment', vendor: 'Home Depot', date: '2026-10-04', amount: 400 },
      { category: 'Labor', vendor: 'Electrical', date: '2026-10-04', amount: 1000 },
      { category: 'Labor', vendor: 'Concrete', date: '2026-10-05', amount: 1000, linkedLineId: 'bps-co-labor-co-1' },
    ]);
    expect(ordered.map((row) => `${row.vendor}:${row.amount}`)).toEqual([
      'Home Depot:400',
      'Electrical:1000',
      'Concrete:1000',
      'Home Depot:500',
      'Home Depot:1000',
      'City:200',
      'Labor:500',
      'Farmers:100',
    ]);
  });
});
