import type { AiInsight, AiNextStep } from '@/types/aiDashboard';

export type AiInsightActionTarget =
  | { kind: 'project_overview' }
  | { kind: 'budget_tab' }
  | { kind: 'budget_category'; category: string }
  | { kind: 'rate_insights'; lineId?: string; section?: 'materials' | 'labor' | 'other' };

type ActionableInsight = Pick<AiInsight, 'leakType' | 'actionTarget'>;
type ActionableStep = Pick<AiNextStep, 'leakType' | 'actionTarget'>;

export function resolveInsightActionTarget(
  item: ActionableInsight | ActionableStep
): AiInsightActionTarget | undefined {
  if (item.actionTarget) return item.actionTarget;
  switch (item.leakType) {
    case 'over_budget':
      return { kind: 'budget_tab' };
    case 'category_over_budget':
      return { kind: 'budget_tab' };
    case 'line_over_estimate':
      return { kind: 'rate_insights' };
    default:
      return undefined;
  }
}

export type DashboardReturnTab = 'overview' | 'analytics' | 'calendar' | 'insights';

export type InsightNavigationParams = {
  id: string;
  activeTab?: string;
  budgetCategory?: string;
  openRateInsights?: string;
  rateInsightLineId?: string;
  returnToDashboardTab?: DashboardReturnTab;
};

export type BuildInsightNavigationOptions = {
  returnToDashboardTab?: DashboardReturnTab;
};

export function parseDashboardReturnTab(
  raw: string | string[] | undefined | null
): DashboardReturnTab | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === 'overview' ||
    value === 'analytics' ||
    value === 'calendar' ||
    value === 'insights'
  ) {
    return value;
  }
  return null;
}

export function buildInsightNavigationParams(
  projectId: string,
  target?: AiInsightActionTarget,
  options?: BuildInsightNavigationOptions
): InsightNavigationParams {
  const params: InsightNavigationParams = { id: projectId };
  if (!target || target.kind === 'project_overview') {
    return params;
  }
  if (target.kind === 'budget_tab') {
    params.activeTab = 'Budget';
    return params;
  }
  if (target.kind === 'budget_category') {
    params.activeTab = 'Budget';
    params.budgetCategory = target.category;
    return params;
  }
  if (target.kind === 'rate_insights') {
    params.activeTab = 'Budget';
    params.openRateInsights = '1';
    if (target.lineId) params.rateInsightLineId = target.lineId;
    if (options?.returnToDashboardTab) {
      params.returnToDashboardTab = options.returnToDashboardTab;
    }
    return params;
  }
  return params;
}

export function navigateToInsightTarget(
  router: { push: (href: never) => void },
  insight: {
    projectId?: string | null;
    leakType?: string;
    actionTarget?: AiInsightActionTarget;
  },
  options?: BuildInsightNavigationOptions
): void {
  const projectId = insight.projectId;
  if (!projectId) return;
  const params = buildInsightNavigationParams(
    String(projectId),
    resolveInsightActionTarget(insight),
    options
  );
  router.push({
    pathname: "/(tabs)/project-detail/[id]",
    params,
  } as never);
}

export function parseOpenRateInsightsParam(
  raw: string | string[] | undefined | null
): boolean {
  if (raw === '1') return true;
  if (Array.isArray(raw)) return raw[0] === '1';
  return false;
}

export function insightActionCtaLabel(target?: AiInsightActionTarget): string {
  if (!target || target.kind === 'project_overview') return 'Review project';
  if (target.kind === 'budget_category') return 'Open category';
  if (target.kind === 'rate_insights') return 'View rate insights';
  return 'Open budget';
}
