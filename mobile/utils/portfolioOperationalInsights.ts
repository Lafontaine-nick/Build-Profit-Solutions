import type { AiInsight, AiNextStep } from '@/types/aiDashboard';
import { isPreActivePortfolioStatus } from '@/utils/aiDashboardPortfolioFilter';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { countDraftPricingReadiness } from '@/utils/scopeItemQuantities';
import { computeProjectFinancials } from '@/src/lib/projectFinancials';
import {
  weeklyPaymentProgress,
  workTaskProgressPct,
} from '@/src/lib/timelineScheduleProgress';

export type PortfolioOperationalProjectInput = {
  id: string;
  title: string;
  displayStatus: string;
  slugForUi: string;
  /** Resolved lifecycle status (nested projectData wins over stale top-level estimate). */
  portfolioStatus: string;
  /** Draft estimate open in Estimate tab — excludes Saved bids archive copies. */
  isWorkingEstimate: boolean;
  margin: number;
  progress: number;
  amount: number;
  rawProject: Record<string, unknown>;
  /** Live timeline rows, when the dashboard has them. Payments and work tasks. */
  timelineItems?: any[] | null;
};

export type PortfolioOperationalInsightsResult = {
  insights: AiInsight[];
  nextSteps: AiNextStep[];
};

const REVIEW_PACKAGE_STATUSES = new Set([
  'needs_review',
  'rough_price',
  'ai_suggested',
  'partial_pricing',
  'missing_price',
]);

/** One subtle operational line per dashboard project card. */
export function getDashboardProjectOperationalSignal(
  project: {
    rawProject: Record<string, unknown>;
    margin: number;
    progress: number;
    status: string;
    amount: number;
    marginDisplay?: string;
  },
  timelineLatestPlannedMs?: number | null
): { text: string; variant: 'risk' | 'watch' | 'muted' } {
  const raw = project.rawProject || {};
  const isCompleted = project.status === 'Completed';

  const spent = Number(
    raw.actualCost ||
      (raw.projectData as Record<string, unknown> | undefined)?.spent ||
      ((raw.projectData as Record<string, unknown> | undefined)?.totalSpent as number) ||
      raw.totalSpent ||
      0
  );
  const contract = Number(project.amount || 0);
  if (contract > 0 && spent > 0 && !isCompleted) {
    const ratio = spent / contract;
    if (ratio > 0.98) return { text: 'Cost overrun risk', variant: 'risk' };
    if (ratio > 0.88) return { text: 'Spend nearing budget', variant: 'watch' };
  }

  const m = Number(project.margin || 0);
  if (!isCompleted && m > 0 && m < 10) {
    return { text: 'Low margin risk', variant: 'risk' };
  }
  if (!isCompleted && m >= 10 && m < 16) {
    return { text: 'Margin watch', variant: 'watch' };
  }

  if (isCompleted) {
    return { text: project.marginDisplay || 'Closed out', variant: 'muted' };
  }
  if (project.progress >= 0.92) {
    return { text: 'Nearing completion', variant: 'muted' };
  }
  return { text: 'On track', variant: 'muted' };
}

function resolveEstimateDraft(rawProject: Record<string, unknown>): EstimateAiDraft | null {
  const candidates: unknown[] = [
    rawProject,
    rawProject.projectData,
    rawProject.estimateData,
    (rawProject.projectData as Record<string, unknown> | undefined)?.estimateData,
  ];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const snap = (candidate as Record<string, unknown>).aiEstimateDraftSnapshot as
      | { draft?: EstimateAiDraft }
      | undefined;
    if (snap?.draft) return snap.draft;
  }
  return null;
}

function countEstimateReviewItems(draft: EstimateAiDraft | null): {
  unpricedPackages: number;
  needsMeasurement: number;
  stillNeeded: number;
} {
  if (!draft) {
    return { unpricedPackages: 0, needsMeasurement: 0, stillNeeded: 0 };
  }
  const packages = draft.scopePackages || [];
  const unpricedPackages = packages.filter((pkg) =>
    REVIEW_PACKAGE_STATUSES.has(String(pkg.status || ''))
  ).length;
  const readiness = countDraftPricingReadiness(draft);
  const stillNeeded = Array.isArray(draft.stillNeededReview)
    ? draft.stillNeededReview.length
    : 0;
  return {
    unpricedPackages,
    needsMeasurement: readiness.needsMeasurement,
    stillNeeded,
  };
}

function projectInsight(
  project: PortfolioOperationalProjectInput,
  partial: Omit<AiInsight, 'id' | 'projectId'>
): AiInsight {
  return {
    id: `client-ops-${project.id}-${partial.leakType || partial.title}`,
    projectId: project.id,
    ...partial,
  };
}

function projectNextStep(
  project: PortfolioOperationalProjectInput,
  partial: Omit<AiNextStep, 'id' | 'projectId'>
): AiNextStep {
  return {
    id: `client-ops-step-${project.id}-${partial.label}`,
    projectId: project.id,
    ...partial,
  };
}

function isPipelineProject(slugForUi: string, displayStatus: string): boolean {
  if (slugForUi === 'completed' || slugForUi === 'lost') return false;
  return true;
}

function isActiveJob(project: PortfolioOperationalProjectInput): boolean {
  if (project.slugForUi === 'completed' || project.slugForUi === 'lost') return false;
  const status = String(project.portfolioStatus || '').toLowerCase().replace(/-/g, '_');
  const slug = String(project.slugForUi || '').toLowerCase().replace(/-/g, '_');
  return status === 'won' || status === 'in_progress' || status === 'active' || slug === 'won' || slug === 'in_progress' || slug === 'active';
}

function finiteAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function firstArray(...sources: unknown[]): any[] {
  for (const source of sources) {
    if (Array.isArray(source) && source.length > 0) return source;
  }
  return [];
}

function ledgerActualCost(raw: Record<string, unknown>): number {
  const pd =
    raw.projectData && typeof raw.projectData === 'object'
      ? (raw.projectData as Record<string, unknown>)
      : raw;
  const expenses = firstArray(pd.expenses, raw.expenses);
  const expenseSum = expenses.reduce((sum, row) => sum + finiteAmount(row?.amount), 0);
  const purchaseOrders = firstArray(pd.purchaseOrders, raw.purchaseOrders);
  const received = purchaseOrders
    .filter((row) => String(row?.status || '').toLowerCase() === 'received')
    .reduce((sum, row) => sum + finiteAmount(row?.amount), 0);
  if (expenseSum > 0 || received > 0) return expenseSum + received;
  return 0;
}

function money(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function formatBriefDate(raw: unknown): string {
  const day = String(raw || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function paymentDate(row: any): string {
  return String(row?.plannedDate || row?.scheduledDate || row?.dueDate || row?.date || '').slice(0, 10);
}

function isCollectedPayment(row: any): boolean {
  const status = String(row?.status || '').toLowerCase();
  if (status === 'completed' || status === 'complete' || status === 'paid' || status === 'received') {
    return true;
  }
  if (row?.collected === true) return true;
  if (String(row?.collectedAt || '').trim()) return true;
  return status.includes('collected');
}

function looksLikePayment(row: any): boolean {
  const type = String(row?.type || '').toLowerCase();
  if (type === 'weekly' || type === 'payment' || type === 'deposit' || type === 'holdback') return true;
  const title = String(row?.title || row?.name || row?.description || '');
  return /payment|deposit|holdback|week\s*\d/i.test(title);
}

function briefPaymentLabel(raw: string): string {
  const week = raw.match(/week\s*(\d+)/i);
  if (week) return `Week ${week[1]}`;
  return raw.replace(/\s+payment$/i, '').trim() || 'Payment';
}

function nextOpenPayment(items: any[]): { title: string; amount: number; date: string } | null {
  const open = items
    .filter((row) => {
      if (!row || !looksLikePayment(row) || isCollectedPayment(row)) return false;
      return finiteAmount(row.amount ?? row.paymentAmount) > 0;
    })
    .sort((a, b) => (paymentDate(a) || '9999-99-99').localeCompare(paymentDate(b) || '9999-99-99'));
  const row = open[0];
  if (!row) return null;
  return {
    title: briefPaymentLabel(String(row.title || row.name || 'Payment')),
    amount: finiteAmount(row.amount ?? row.paymentAmount),
    date: paymentDate(row),
  };
}

function scheduleSentences(items: any[] | null | undefined): { text: string; paymentsAheadOfWork: boolean } {
  if (!Array.isArray(items) || items.length === 0) {
    return { text: '', paymentsAheadOfWork: false };
  }
  const work = workTaskProgressPct(items);
  const weeks = weeklyPaymentProgress(items);
  const paymentsAheadOfWork = (work == null || work < 3) && Boolean(weeks && weeks.collectedCount > 0);
  const parts: string[] = [];
  if (paymentsAheadOfWork && weeks) {
    const verb = weeks.collectedCount === 1 ? 'is' : 'are';
    parts.push(
      `${weeks.collectedCount} of ${weeks.weekCount} weekly payments ${verb} in, and no work tasks are done.`
    );
  }
  const next = nextOpenPayment(items);
  if (next) {
    const due = next.date ? `, due ${formatBriefDate(next.date)}` : '';
    parts.push(`Next payment is ${next.title}, ${money(next.amount)}${due}.`);
  }
  return { text: parts.join(' '), paymentsAheadOfWork };
}

type ActiveJobSnapshot = {
  cap: number;
  actual: number;
  profit: number;
  marginPct: number;
};

function readActiveJobSnapshot(raw: Record<string, unknown>): ActiveJobSnapshot | null {
  const fin = computeProjectFinancials(raw);
  const contract = fin.adjustedContractValue;
  const cap = fin.adjustedCostBudget;
  if (!(contract > 0) || !(cap > 0) || !(cap < contract)) return null;
  const profit = contract - cap;
  return {
    cap,
    actual: ledgerActualCost(raw),
    profit,
    marginPct: (profit / contract) * 100,
  };
}

/** One project-manager line for an active job: on the estimate, nearing the cap, or over it. */
function buildActiveJobBrief(project: PortfolioOperationalProjectInput): {
  insight: AiInsight;
  step: AiNextStep | null;
} | null {
  const snapshot = readActiveJobSnapshot(project.rawProject);
  if (!snapshot) return null;
  const schedule = scheduleSentences(project.timelineItems);
  const left = Math.max(0, snapshot.cap - snapshot.actual);
  const spentPct = snapshot.cap > 0 ? (snapshot.actual / snapshot.cap) * 100 : 0;
  const profitLine = `Projected profit is ${money(snapshot.profit)} (${formatPct(snapshot.marginPct)}).`;

  if (snapshot.actual > snapshot.cap + 0.5) {
    return {
      insight: projectInsight(project, {
        type: 'alert',
        title: `${project.title}: costs are over the cap`,
        body: `Logged costs are ${money(snapshot.actual)} against the ${money(snapshot.cap)} cost cap. ${profitLine}`,
        impactScore: 9,
        leakType: 'cost_overrun_risk',
        actionTarget: { kind: 'budget_tab' },
      }),
      step: projectNextStep(project, {
        label: `Review ${project.title} budget`,
        chip: 'Budget',
        priority: 'high',
        leakType: 'cost_overrun_risk',
        actionTarget: { kind: 'budget_tab' },
      }),
    };
  }

  if (snapshot.actual >= snapshot.cap * 0.9 && snapshot.actual > 0) {
    return {
      insight: projectInsight(project, {
        type: 'alert',
        title: `${project.title}: spend is nearing the cost cap`,
        body: `${money(snapshot.actual)} of the ${money(snapshot.cap)} cost cap is spent (${formatPct(spentPct)}). ${money(left)} is left. ${profitLine}`,
        impactScore: 7,
        leakType: 'spend_nearing_budget',
        actionTarget: { kind: 'budget_tab' },
      }),
      step: projectNextStep(project, {
        label: `Review ${project.title} budget`,
        chip: 'Budget',
        priority: 'medium',
        leakType: 'spend_nearing_budget',
        actionTarget: { kind: 'budget_tab' },
      }),
    };
  }

  const spendLine =
    snapshot.actual > 0
      ? `${money(snapshot.actual)} of the ${money(snapshot.cap)} cost cap is spent, with ${money(left)} left.`
      : `The cost cap is ${money(snapshot.cap)}. Nothing is logged yet.`;
  return {
    insight: projectInsight(project, {
      type: 'info',
      title:
        snapshot.actual > 0
          ? `${project.title} is on the estimate`
          : `${project.title} has no costs logged yet`,
      body: [profitLine, spendLine, schedule.text].filter(Boolean).join(' '),
      impactScore: schedule.paymentsAheadOfWork ? 6 : 4,
      leakType: 'project_status',
      actionTarget: { kind: 'project_overview' },
    }),
    step: null,
  };
}

/** Rule-based portfolio flags — margin, spend, and estimate review (no AI brief). */
export function buildPortfolioOperationalInsights(
  projects: PortfolioOperationalProjectInput[]
): PortfolioOperationalInsightsResult {
  const insights: AiInsight[] = [];
  const nextSteps: AiNextStep[] = [];

  for (const project of projects) {
    if (!isPipelineProject(project.slugForUi, project.displayStatus)) continue;

    const activeBrief = isActiveJob(project) ? buildActiveJobBrief(project) : null;
    if (activeBrief) {
      insights.push(activeBrief.insight);
      if (activeBrief.step) nextSteps.push(activeBrief.step);
    }

    const signal = activeBrief
      ? null
      : getDashboardProjectOperationalSignal({
          rawProject: project.rawProject,
          margin: project.margin,
          progress: project.progress,
          status: project.displayStatus,
          amount: project.amount,
        });

    if (signal?.variant === 'risk' && signal.text === 'Cost overrun risk') {
      insights.push(
        projectInsight(project, {
          type: 'alert',
          title: `${project.title}: cost overrun risk`,
          body: 'Logged spend is at or above the contract value. Review budget and remaining scope before more costs hit.',
          impactScore: 9,
          leakType: 'cost_overrun_risk',
          actionTarget: { kind: 'budget_tab' },
        })
      );
      nextSteps.push(
        projectNextStep(project, {
          label: `Review ${project.title} budget`,
          chip: 'Budget',
          priority: 'high',
          leakType: 'cost_overrun_risk',
          actionTarget: { kind: 'budget_tab' },
        })
      );
    } else if (signal?.variant === 'watch' && signal.text === 'Spend nearing budget') {
      insights.push(
        projectInsight(project, {
          type: 'alert',
          title: `${project.title}: spend nearing budget`,
          body: 'Logged costs are approaching the contract amount. Check category spend before margin erodes.',
          impactScore: 7,
          leakType: 'spend_nearing_budget',
          actionTarget: { kind: 'budget_tab' },
        })
      );
    } else if (signal?.text === 'Low margin risk') {
      insights.push(
        projectInsight(project, {
          type: 'alert',
          title: `${project.title}: low projected margin`,
          body: `Projected margin is about ${project.margin.toFixed(1)}%. Review markup and scope before more costs are committed.`,
          impactScore: 8,
          leakType: 'low_margin_risk',
          actionTarget: { kind: 'project_overview' },
        })
      );
      nextSteps.push(
        projectNextStep(project, {
          label: `Review ${project.title} markup`,
          chip: 'Margin',
          priority: 'high',
          leakType: 'low_margin_risk',
          actionTarget: { kind: 'project_overview' },
        })
      );
    } else if (signal?.text === 'Margin watch') {
      insights.push(
        projectInsight(project, {
          type: 'opportunity',
          title: `${project.title}: margin watch`,
          body: `Projected margin is about ${project.margin.toFixed(1)}% — tighten markup or scope before costs accumulate.`,
          impactScore: 6,
          leakType: 'margin_watch',
          actionTarget: { kind: 'project_overview' },
        })
      );
      nextSteps.push(
        projectNextStep(project, {
          label: `Review ${project.title} margin`,
          chip: 'Margin',
          priority: 'medium',
          leakType: 'margin_watch',
          actionTarget: { kind: 'project_overview' },
        })
      );
    }

    const draft = resolveEstimateDraft(project.rawProject);
    const review = countEstimateReviewItems(draft);
    const estimateReviewCount = Math.max(
      review.unpricedPackages,
      review.needsMeasurement,
      review.stillNeeded > 0 ? 1 : 0
    );

    if (
      (estimateReviewCount > 0 || review.stillNeeded > 0) &&
      project.isWorkingEstimate &&
      isPreActivePortfolioStatus(project.portfolioStatus)
    ) {
      const parts: string[] = [];
      if (review.unpricedPackages > 0) {
        parts.push(
          `${review.unpricedPackages} pricing card${review.unpricedPackages === 1 ? '' : 's'} need review`
        );
      }
      if (review.needsMeasurement > 0) {
        parts.push(
          `${review.needsMeasurement} scope line${review.needsMeasurement === 1 ? '' : 's'} need measurements`
        );
      }
      if (review.stillNeeded > 0) {
        parts.push(`${review.stillNeeded} open assumption${review.stillNeeded === 1 ? '' : 's'}`);
      }
      insights.push(
        projectInsight(project, {
          type: 'alert',
          title: `${project.title}: estimate needs review`,
          body: parts.join(' · ') || 'Finish confirm scope and pricing before sending the bid.',
          impactScore: 7,
          leakType: 'estimate_needs_review',
          actionTarget: { kind: 'project_overview' },
        })
      );
      nextSteps.push(
        projectNextStep(project, {
          label: `Finish ${project.title} estimate`,
          chip: 'Estimate',
          priority: isPreActivePortfolioStatus(project.portfolioStatus) ? 'high' : 'medium',
          leakType: 'estimate_needs_review',
          actionTarget: { kind: 'project_overview' },
        })
      );
    } else if (
      isPreActivePortfolioStatus(project.portfolioStatus) &&
      (project.slugForUi === 'bid_submitted' || project.slugForUi === 'submitted')
    ) {
      insights.push(
        projectInsight(project, {
          type: 'info',
          title: `${project.title}: bid submitted`,
          body: 'Follow up with the customer or update status when you hear back.',
          impactScore: 4,
          leakType: 'bid_submitted',
          actionTarget: { kind: 'project_overview' },
        })
      );
    }
  }

  return { insights, nextSteps };
}

export function countPortfolioOperationalFlags(
  result: PortfolioOperationalInsightsResult
): number {
  const flaggedProjectIds = new Set<string>();
  for (const insight of result.insights) {
    if (
      insight.type === 'alert' ||
      insight.type === 'opportunity' ||
      insight.leakType === 'estimate_needs_review'
    ) {
      const pid = String(insight.projectId ?? '').trim();
      if (pid) flaggedProjectIds.add(pid);
    }
  }
  return flaggedProjectIds.size;
}
