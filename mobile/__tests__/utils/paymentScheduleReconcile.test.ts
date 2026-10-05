import {
  getEstimateContractValue,
  hasDepositOnlyInOtherList,
  keepReceivedInBidList,
  keepReceivedPaymentAmounts,
  reconcileBidPaymentSchedule,
  reconcilePaymentRowsToContract,
} from '@/src/lib/paymentScheduleReconcile';

const sum = (rows: { amount?: unknown }[]) =>
  Math.round(rows.reduce((s, r) => s + Number(r.amount || 0), 0) * 100) / 100;

describe('reconcilePaymentRowsToContract', () => {
  const staleSchedule = () => [
    { id: 'deposit', type: 'deposit', amount: 4831.8, status: 'completed' },
    { id: 'w1', type: 'weekly', amount: 8590.94, status: 'completed' },
    { id: 'w2', type: 'weekly', amount: 8590.94, status: 'pending' },
    { id: 'w3', type: 'weekly', amount: 8590.94, status: 'pending' },
    { id: 'holdback', type: 'holdback', amount: 1607.38, status: 'pending' },
  ];

  it('rescales only pending rows so the schedule matches the contract', () => {
    const rows = staleSchedule();
    expect(sum(rows)).toBe(32212);

    const fixed = reconcilePaymentRowsToContract(rows, 30911.5);

    expect(sum(fixed)).toBe(30911.5);
    expect(fixed[0].amount).toBe(4831.8);
    expect(fixed[1].amount).toBe(8590.94);
    expect(Number(fixed[2].amount)).toBeLessThan(8590.94);
    expect(fixed[2].amount).toBe(fixed[3].amount);
    expect(sum(fixed.slice(2))).toBe(17488.76);
  });

  it('treats collectedAt as received even when status is pending', () => {
    const rows = staleSchedule().map((r) =>
      r.id === 'w2' ? { ...r, status: 'pending', collectedAt: '2026-10-21' } : r
    );
    const fixed = reconcilePaymentRowsToContract(rows, 30911.5);
    expect(fixed[2].amount).toBe(8590.94);
    expect(sum(fixed)).toBe(30911.5);
  });

  it('leaves a schedule that already matches within $1 untouched', () => {
    const rows = [
      { id: 'a', amount: 15000.5, status: 'pending' },
      { id: 'b', amount: 15911.3, status: 'pending' },
    ];
    expect(reconcilePaymentRowsToContract(rows, 30911.5)).toBe(rows);
  });

  it('ignores change-order rows when comparing to the base contract', () => {
    const rows = [
      { id: 'a', amount: 20000, status: 'pending' },
      { id: 'b', amount: 10911.5, status: 'pending' },
      { id: 'bps-co-1', type: 'change_order', amount: 2400, status: 'pending' },
    ];
    expect(reconcilePaymentRowsToContract(rows, 30911.5)).toBe(rows);
  });

  it('ignores Timeline change-order rows that only carry the bps-co- id', () => {
    const rows = [
      { id: 'a', amount: 20000, status: 'pending' },
      { id: 'b', amount: 10911.5, status: 'pending' },
      { id: 'bps-co-1', amount: 2400, status: 'pending' },
    ];
    expect(reconcilePaymentRowsToContract(rows, 30911.5)).toBe(rows);
  });

  it('does nothing when nothing is pending or received exceeds the contract', () => {
    const allReceived = staleSchedule().map((r) => ({ ...r, status: 'completed' }));
    expect(reconcilePaymentRowsToContract(allReceived, 30911.5)).toBe(allReceived);

    const overReceived = [
      { id: 'a', amount: 31000, status: 'completed' },
      { id: 'b', amount: 5000, status: 'pending' },
    ];
    expect(reconcilePaymentRowsToContract(overReceived, 30911.5)).toBe(overReceived);
  });

  it('leaves gaps larger than 15% of the contract alone', () => {
    const rows = [
      { id: 'a', amount: 5000, status: 'pending' },
      { id: 'b', amount: 5000, status: 'pending' },
    ];
    expect(reconcilePaymentRowsToContract(rows, 8000)).toBe(rows);
    expect(reconcilePaymentRowsToContract(rows, 9000)).not.toBe(rows);
  });

  it('fills a large shortfall on pending rows when earlier payments were collected', () => {
    const rows = [
      { id: 'deposit', amount: 5382, status: 'completed' },
      { id: 'w1', amount: 9568, status: 'completed' },
      { id: 'w2', amount: 6440, status: 'completed' },
      { id: 'w3', amount: 3485.33, status: 'pending' },
      { id: 'w4', amount: 3485.33, status: 'pending' },
      { id: 'holdback', amount: 871.34, status: 'pending' },
    ];
    const fixed = reconcilePaymentRowsToContract(rows, 35880);
    expect(fixed[0].amount).toBe(5382);
    expect(fixed[1].amount).toBe(9568);
    expect(fixed[2].amount).toBe(6440);
    expect(sum(fixed.slice(3))).toBe(14490);
    expect(sum(fixed)).toBe(35880);
  });

  it('skips when the contract value is missing', () => {
    const rows = staleSchedule();
    expect(reconcilePaymentRowsToContract(rows, 0)).toBe(rows);
    expect(reconcilePaymentRowsToContract(rows, null)).toBe(rows);
  });

  it('keeps paymentAmount and percentage in step with the new amount', () => {
    const rows = [
      { id: 'a', amount: 5000, paymentAmount: 5000, percentage: 50, status: 'pending' },
      { id: 'b', amount: 5000, paymentAmount: 5000, percentage: 50, status: 'pending' },
    ];
    const fixed = reconcilePaymentRowsToContract(rows, 9000);
    expect(fixed[0]).toMatchObject({ amount: 4500, paymentAmount: 4500, percentage: 50 });
    expect(fixed[1]).toMatchObject({ amount: 4500, paymentAmount: 4500, percentage: 50 });
  });
});

describe('reconcileBidPaymentSchedule', () => {
  const weekly = [
    { id: 'd', type: 'deposit', amount: 4831.8 },
    { id: 'w1', type: 'weekly', amount: 27380.2 },
  ];

  it('fixes weeklyPayments for weekly schedules and leaves milestones alone', () => {
    const milestones = [{ id: 'm', amount: 999 }];
    const out = reconcileBidPaymentSchedule(
      { paymentSchedule: 'weekly', paymentMilestones: milestones, weeklyPayments: weekly },
      30911.5
    );
    expect(sum(out.weeklyPayments)).toBe(30911.5);
    expect(out.paymentMilestones).toBe(milestones);
  });

  it('skips weekly schedules whose deposit lives in paymentMilestones', () => {
    const weeksOnly = [
      { id: 'w1', type: 'weekly', weekNumber: 1, amount: 13000 },
      { id: 'w2', type: 'weekly', weekNumber: 2, amount: 13000 },
    ];
    const depositElsewhere = [{ id: 'd', type: 'deposit', amount: 4831.8 }];
    expect(hasDepositOnlyInOtherList(weeksOnly, depositElsewhere)).toBe(true);
    const out = reconcileBidPaymentSchedule(
      { paymentSchedule: 'weekly', paymentMilestones: depositElsewhere, weeklyPayments: weeksOnly },
      30911.5
    );
    expect(out.weeklyPayments).toBe(weeksOnly);
  });

  it('skips mixed milestone + weekly schedules', () => {
    const milestones = [{ id: 'm', amount: 4000 }];
    const out = reconcileBidPaymentSchedule(
      { paymentSchedule: 'milestone-based', paymentMilestones: milestones, weeklyPayments: weekly },
      30911.5
    );
    expect(out.paymentMilestones).toBe(milestones);
    expect(out.weeklyPayments).toBe(weekly);
  });
});

describe('getEstimateContractValue', () => {
  it('uses the saved estimate price fields only', () => {
    expect(getEstimateContractValue({ grandTotal: 30911.5, bidPrice: 1 })).toBe(30911.5);
    expect(getEstimateContractValue({ bidPrice: 30911.5 })).toBe(30911.5);
    expect(getEstimateContractValue({ estimatedCost: 27010 })).toBeNull();
    expect(getEstimateContractValue(undefined)).toBeNull();
  });
});

describe('keepReceivedPaymentAmounts', () => {
  // Fresh Estimate rebuild at $30,911.50: new ids, every row recomputed from percentages.
  const rebuiltRows = () => [
    { id: 'weekly-progress-deposit-2', name: 'Deposit', description: 'Deposit', type: 'deposit', weekNumber: 0, amount: 4636.72, percentage: 15 },
    { id: 'weekly-progress-week-2-1', name: 'Week 1 Progress Payment', description: 'Week 1 Progress Payment', type: 'weekly', weekNumber: 1, amount: 8244.1, percentage: 26.67 },
    { id: 'weekly-progress-week-2-2', name: 'Week 2 Progress Payment', description: 'Week 2 Progress Payment', type: 'weekly', weekNumber: 2, amount: 8244.1, percentage: 26.67 },
    { id: 'weekly-progress-week-2-3', name: 'Week 3 Progress Payment', description: 'Week 3 Progress Payment', type: 'weekly', weekNumber: 3, amount: 8244.1, percentage: 26.67 },
    { id: 'weekly-progress-holdback-2', name: 'Final Holdback', description: 'Final Holdback', type: 'holdback', weekNumber: 4, amount: 1542.48, percentage: 4.99 },
  ];
  // Timeline store from the old schedule (old ids), deposit and Week 1 collected.
  const savedTimeline = () => [
    { id: 'weekly-progress-deposit-1', title: 'Deposit', amount: 4831.8, status: 'completed', collectedAt: '2026-10-07' },
    { id: 'weekly-progress-week-1-1', title: 'Week 1 Progress Payment', amount: 8590.94, status: 'completed' },
    { id: 'weekly-progress-week-1-2', title: 'Week 2 Progress Payment', amount: 8590.94, status: 'pending' },
    { id: 'bps-co-co-1', title: 'Change order', amount: 2400, status: 'completed' },
  ];

  it('keeps collected amounts through a rebuild and spreads the rest over pending rows', () => {
    const out = keepReceivedPaymentAmounts(rebuiltRows(), savedTimeline(), 30911.5);

    expect(out[0].amount).toBe(4831.8);
    expect(out[1].amount).toBe(8590.94);
    expect(sum(out)).toBe(30911.5);
    expect(sum(out.slice(2))).toBe(17488.76);
    expect(out[2].amount).toBe(out[3].amount);
    expect(out[2].id).toBe('weekly-progress-week-2-2');
  });

  it('survives the Estimate recomputing amounts from percentages', () => {
    const out = keepReceivedPaymentAmounts(rebuiltRows(), savedTimeline(), 30911.5);
    const recomputed = out.map((row) => ({
      ...row,
      amount: Math.round((row.percentage / 100) * 30911.5 * 100) / 100,
    }));
    expect(recomputed.map((r) => r.amount)).toEqual(out.map((r) => r.amount));
  });

  it('prefers the collected amount over the scheduled amount', () => {
    const saved = [{ id: 'x', title: 'Deposit', amount: 4831.8, collectedAmount: 4800, status: 'completed' }];
    const out = keepReceivedPaymentAmounts(rebuiltRows(), saved, 30911.5);
    expect(out[0].amount).toBe(4800);
    expect(sum(out)).toBe(30911.5);
  });

  it('matches by id before label', () => {
    const rows = rebuiltRows();
    const saved = [{ id: rows[2].id, title: 'Renamed', amount: 9000, status: 'paid' }];
    const out = keepReceivedPaymentAmounts(rows, saved, 30911.5);
    expect(out[2].amount).toBe(9000);
    expect(out[0].amount).not.toBe(4636.72);
  });

  it('returns the same rows when nothing was received', () => {
    const rows = rebuiltRows();
    const saved = savedTimeline().map((s) => ({ ...s, status: 'pending', collectedAt: undefined }));
    expect(keepReceivedPaymentAmounts(rows, saved, 30911.5)).toBe(rows);
    expect(keepReceivedPaymentAmounts(rows, null, 30911.5)).toBe(rows);
  });

  it('owes nothing more when collections already cover the contract', () => {
    const saved = [{ id: 'x', title: 'Deposit', amount: 31000, status: 'completed' }];
    const out = keepReceivedPaymentAmounts(rebuiltRows(), saved, 30911.5);
    expect(out[0].amount).toBe(31000);
    expect(sum(out.slice(1))).toBe(0);
  });
});

describe('keepReceivedInBidList', () => {
  const saved = [{ id: 'x', title: 'Deposit', amount: 5000, status: 'completed' }];
  const weekly = [
    { id: 'd', name: 'Deposit', description: 'Deposit', type: 'deposit', amount: 4000 },
    { id: 'w1', name: 'Week 1 Progress Payment', type: 'weekly', amount: 6000 },
  ];

  it('locks the weekly list on weekly schedules', () => {
    const out = keepReceivedInBidList('weeklyPayments', { paymentSchedule: 'weekly' }, weekly, saved, 10000);
    expect(out[0].amount).toBe(5000);
    expect(out[1].amount).toBe(5000);
  });

  it('leaves a weekly list alone when its deposit lives in paymentMilestones', () => {
    const weeksOnly = weekly.slice(1);
    const bid = { paymentSchedule: 'weekly', paymentMilestones: [{ name: 'Deposit', type: 'deposit', amount: 4000 }] };
    expect(keepReceivedInBidList('weeklyPayments', bid, weeksOnly, saved, 10000)).toBe(weeksOnly);
  });

  it('only locks paymentMilestones when they are the whole schedule', () => {
    const milestones = [
      { id: 'd', name: 'Deposit', amount: 4000, paymentAmount: 4000 },
      { id: 'f', name: 'Final', amount: 6000, paymentAmount: 6000 },
    ];
    expect(keepReceivedInBidList('paymentMilestones', { paymentSchedule: 'weekly' }, milestones, saved, 10000)).toBe(milestones);
    expect(
      keepReceivedInBidList('paymentMilestones', { paymentSchedule: 'milestone-based', weeklyPayments: weekly }, milestones, saved, 10000)
    ).toBe(milestones);
    const out = keepReceivedInBidList('paymentMilestones', { paymentSchedule: 'milestone-based', weeklyPayments: [] }, milestones, saved, 10000);
    expect(out[0]).toMatchObject({ amount: 5000, paymentAmount: 5000 });
    expect(out[1]).toMatchObject({ amount: 5000, paymentAmount: 5000 });
  });
});
