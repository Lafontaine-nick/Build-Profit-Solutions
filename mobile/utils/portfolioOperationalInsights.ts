import type { AiInsight, AiNextStep } from '@/types/aiDashboard';
import { isPreActivePortfolioStatus } from '@/utils/aiDashboardPortfolioFilter';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { countDraftPricingReadiness } from '@/utils/scopeItemQuantities';

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

/** Rule-based portfolio flags — margin, spend, and estimate review (no AI brief). */
export function buildPortfolioOperationalInsights(
  projects: PortfolioOperationalProjectInput[]
): PortfolioOperationalInsightsResult {
  const insights: AiInsight[] = [];
  const nextSteps: AiNextStep[] = [];

  for (const project of projects) {
    if (!isPipelineProject(project.slugForUi, project.displayStatus)) continue;

    const signal = getDashboardProjectOperationalSignal({
      rawProject: project.rawProject,
      margin: project.margin,
      progress: project.progress,
      status: project.displayStatus,
      amount: project.amount,
    });

    if (signal.variant === 'risk' && signal.text === 'Cost overrun risk') {
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
    } else if (signal.variant === 'watch' && signal.text === 'Spend nearing budget') {
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
    } else if (signal.text === 'Low margin risk') {
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
    } else if (signal.text === 'Margin watch') {
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
