import { isBillingTimelineMilestone, isChangeOrderTimelineMilestone } from '@/src/lib/projectFinancials';

/** Week N progress rows. Deposit and holdback are billing events, not a week of work. */
export function isWeeklyProgressPaymentRow(milestone: any): boolean {
  if (!milestone || isChangeOrderTimelineMilestone(milestone)) return false;
  const type = String(milestone.type || '').toLowerCase();
  if (type === 'deposit' || type === 'holdback') return false;
  if (type === 'weekly') return true;
  const title = String(milestone.title || milestone.name || milestone.description || '').toLowerCase();
  if (title.includes('deposit') || title.includes('holdback') || title.includes('retainage')) return false;
  return /week\s*\d/i.test(title) && (title.includes('pay') || title.includes('progress'));
}

function isRowCollected(milestone: any): boolean {
  const status = String(milestone?.status || '').toLowerCase();
  if (status === 'completed' || status === 'complete' || status === 'paid') return true;
  if (milestone?.collected === true) return true;
  if (String(milestone?.collectedAt || '').trim()) return true;
  if (status.includes('collected') || status.includes('received')) return true;
  return !status && (Number(milestone?.progressPct) || 0) >= 99.5;
}

export type WeeklyPaymentProgress = {
  pct: number;
  collectedCount: number;
  weekCount: number;
};

/** Share of weekly progress payments that have been collected. */
export function weeklyPaymentProgress(items: any[] | null | undefined): WeeklyPaymentProgress | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const weeks = items.filter(isWeeklyProgressPaymentRow);
  if (!weeks.length) return null;
  const collectedCount = weeks.filter(isRowCollected).length;
  return {
    pct: Math.round((collectedCount / weeks.length) * 100),
    collectedCount,
    weekCount: weeks.length,
  };
}

/** Average progress of work tasks. Null when the timeline is only payments. */
export function workTaskProgressPct(items: any[] | null | undefined): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const workItems = items.filter((milestone) => !isBillingTimelineMilestone(milestone));
  if (workItems.length === 0) return null;
  const sum = workItems.reduce((acc, milestone) => {
    const pct = Math.min(
      100,
      Math.max(
        0,
        Number(milestone?.progressPct) ||
          (milestone?.status === 'completed' ? 100 : milestone?.status === 'in_progress' ? 50 : 0)
      )
    );
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
}

/**
 * Work tasks win when the job has any. A payment-only timeline uses collected weekly payments.
 * Deposit and holdback stay out of that count.
 */
export function timelineScheduleProgressPct(items: any[] | null | undefined): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const workPct = workTaskProgressPct(items);
  if (workPct != null) return workPct;
  return weeklyPaymentProgress(items)?.pct ?? 0;
}
