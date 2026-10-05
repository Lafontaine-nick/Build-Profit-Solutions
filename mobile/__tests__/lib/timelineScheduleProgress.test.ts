import { timelineScheduleProgressPct, weeklyPaymentProgress, workTaskProgressPct } from '@/src/lib/timelineScheduleProgress';

describe('weeklyPaymentProgress', () => {
  const schedule = () => [
    { id: 'd', title: 'Deposit', type: 'deposit', amount: 5382, status: 'completed' },
    { id: 'w1', title: 'Week 1 Progress Payment', amount: 9568, status: 'completed', progressPct: 100 },
    { id: 'w2', title: 'Week 2 Progress Payment', amount: 6440, status: 'pending', progressPct: 0 },
    { id: 'w3', title: 'Week 3 Progress Payment', amount: 3485.33, status: 'pending' },
    { id: 'w4', title: 'Week 4 Progress Payment', amount: 3485.33, status: 'pending' },
    { id: 'h', title: 'Final Holdback', type: 'holdback', amount: 871.34, status: 'pending' },
  ];

  it('counts only received weeks and leaves deposit and holdback out', () => {
    expect(weeklyPaymentProgress(schedule())).toEqual({ pct: 25, collectedCount: 1, weekCount: 4 });
  });

  it('does not count a week set back to pending that still has 100% progress saved', () => {
    const rows = schedule().map((r) => (r.id === 'w2' ? { ...r, progressPct: 100 } : r));
    expect(weeklyPaymentProgress(rows)?.collectedCount).toBe(1);
  });

  it('still counts a legacy row with no status at 100%', () => {
    const rows = schedule().map((r) => (r.id === 'w2' ? { ...r, status: undefined, progressPct: 100 } : r));
    expect(weeklyPaymentProgress(rows)?.collectedCount).toBe(2);
  });

  it('keeps payment collection on the timeline bar and off the work forecast', () => {
    const rows = [
      { id: 'd', title: 'Deposit', type: 'deposit', status: 'completed' },
      { id: 'w1', title: 'Week 1 Progress Payment', status: 'completed' },
      { id: 'w2', title: 'Week 2 Progress Payment', status: 'pending' },
      { id: 'w3', title: 'Week 3 Progress Payment', status: 'pending' },
      { id: 'w4', title: 'Week 4 Progress Payment', status: 'pending' },
      { id: 'w5', title: 'Week 5 Progress Payment', status: 'pending' },
    ];
    expect(timelineScheduleProgressPct(rows)).toBe(20);
    expect(workTaskProgressPct(rows)).toBeNull();
  });

  it('averages work tasks and ignores collected payments', () => {
    const rows = [
      { id: 'w1', title: 'Week 1 Progress Payment', status: 'completed' },
      { id: 'task', title: 'Rough-in', status: 'in_progress', progressPct: 40 },
    ];
    expect(workTaskProgressPct(rows)).toBe(40);
    expect(timelineScheduleProgressPct(rows)).toBe(40);
  });
});
