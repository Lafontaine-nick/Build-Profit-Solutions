import type { AiInsight, AiNextStep } from '@/types/aiDashboard';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import {
  buildRateInsightSections,
  getRateInsightSpendStatus,
  normalizeExpenseForMatching,
  resolveProjectEstimateData,
  type RateInsightLineItem,
} from '@/utils/rateInsightComparisons';

export type PortfolioBudgetBucket = {
  id?: string;
  stableId?: string;
  name?: string;
  budget?: number;
  spent?: number;
};

export type PortfolioBudgetProjectInput = {
  id: string;
  title: string;
  status: string;
  estimateData?: Record<string, unknown> | null;
  buckets?: PortfolioBudgetBucket[];
  expenses?: unknown[];
  plannedBudget?: number;
  finalCustomerPrice?: number;
};

export type PortfolioBudgetInsightsResult = {
  insights: AiInsight[];
  nextSteps: AiNextStep[];
};

const ACTIVE_PIPELINE_STATUSES = new Set([
  'won',
  'in_progress',
  'active',
  'completed',
  'complete',
  'done',
  'finished',
]);

const MIN_CATEGORY_OVER_USD = 25;
const MIN_LINE_LOGGED_USD = 25;
const MIN_LINE_OVER_USD = 10;
const MIN_LINE_OVER_PCT = 5;
const MIN_PROJECT_OVER_USD = 100;
const MAX_LINE_INSIGHTS_PER_PROJECT = 3;

function normalizeStatus(status: unknown): string {
  return String(status ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function isEligibleProject(status: string): boolean {
  return ACTIVE_PIPELINE_STATUSES.has(status);
}

function money(amount: number): string {
  return formatMoneyFull(amount);
}

function lineOverAmount(line: RateInsightLineItem): number {
  return Math.max(0, line.loggedTotal - line.estimatedTotal);
}

function qualifiesLineOverrun(line: RateInsightLineItem): boolean {
  if (getRateInsightSpendStatus(line) !== 'over') return false;
  const over = lineOverAmount(line);
  const pct = line.variancePct ?? 0;
  if (line.loggedTotal < MIN_LINE_LOGGED_USD && over < MIN_LINE_OVER_USD) return false;
  return over >= MIN_LINE_OVER_USD || pct >= MIN_LINE_OVER_PCT;
}

function bucketCategoryLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('material') || lower.includes('equipment')) return 'Materials';
  if (lower.includes('labor')) return 'Labor';
  return name.trim() || 'Category';
}

function projectInsight(
  project: PortfolioBudgetProjectInput,
  partial: Omit<AiInsight, 'id' | 'projectId'>
): AiInsight {
  return {
    id: partial.leakType
      ? `client-budget-${project.id}-${partial.leakType}-${partial.title}`
      : `client-budget-${project.id}-${partial.title}`,
    projectId: project.id,
    ...partial,
  };
}

function projectNextStep(
  project: PortfolioBudgetProjectInput,
  partial: Omit<AiNextStep, 'id' | 'projectId'>
): AiNextStep {
  return {
    id: `client-budget-step-${project.id}-${partial.label}`,
    projectId: project.id,
    ...partial,
  };
}

function buildProjectLevelInsights(
  project: PortfolioBudgetProjectInput,
  plannedBudget: number,
  totalSpent: number
): PortfolioBudgetInsightsResult {
  const overBy = totalSpent - plannedBudget;
  if (plannedBudget <= 0 || overBy < MIN_PROJECT_OVER_USD) {
    return { insights: [], nextSteps: [] };
  }

  const title = `${project.title} is over cost budget`;
  const body = `${project.title} has spent ${money(totalSpent)} against a ${money(plannedBudget)} cost budget — about ${money(overBy)} over. Review category and line overruns before margin erodes further.`;

  return {
    insights: [
      projectInsight(project, {
        type: 'alert',
        title,
        body,
        impactScore: 9,
        impactDollars: overBy,
        leakType: 'over_budget',
        actionTarget: { kind: 'budget_tab' },
        evidence: [
          `Budget: ${money(plannedBudget)}`,
          `Spent: ${money(totalSpent)}`,
          `Over by ${money(overBy)}`,
        ],
      }),
    ],
    nextSteps: [
      projectNextStep(project, {
        label: `Inspect overruns on ${project.title}`,
        chip: 'Urgent review',
        priority: 'high',
        leakType: 'over_budget',
        actionTarget: { kind: 'budget_tab' },
      }),
    ],
  };
}

function buildCategoryInsights(project: PortfolioBudgetProjectInput): PortfolioBudgetInsightsResult {
  const insights: AiInsight[] = [];
  const nextSteps: AiNextStep[] = [];

  for (const bucket of project.buckets || []) {
    const budget = Number(bucket.budget) || 0;
    const spent = Number(bucket.spent) || 0;
    const overBy = spent - budget;
    if (budget <= 0 || overBy < MIN_CATEGORY_OVER_USD) continue;

    const category = bucketCategoryLabel(String(bucket.name || 'Category'));
    const bucketName = String(bucket.name || category);
    const title = `${category} over budget on ${project.title}`;
    const body = `${category}: ${money(spent)} logged vs ${money(budget)} budget — ${money(overBy)} over.`;

    insights.push(
      projectInsight(project, {
        type: 'alert',
        title,
        body,
        impactScore: 7,
        impactDollars: overBy,
        leakType: 'category_over_budget',
        actionTarget: { kind: 'budget_category', category: bucketName },
        evidence: [
          `${category} budget: ${money(budget)}`,
          `Logged: ${money(spent)}`,
          `Over by ${money(overBy)}`,
        ],
      })
    );
    nextSteps.push(
      projectNextStep(project, {
        label: `Review ${category.toLowerCase()} on ${project.title}`,
        chip: 'Budget review',
        priority: overBy >= budget * 0.1 ? 'high' : 'medium',
        leakType: 'category_over_budget',
        actionTarget: { kind: 'budget_category', category: bucketName },
      })
    );
  }

  return { insights, nextSteps };
}

function pickLineOverruns(
  overrunLines: Array<{
    line: RateInsightLineItem;
    sectionKey: 'materials' | 'labor' | 'other';
    sectionTitle: string;
  }>
): typeof overrunLines {
  const materials = overrunLines.filter((row) => row.sectionKey === 'materials');
  const labor = overrunLines.filter((row) => row.sectionKey === 'labor');
  const other = overrunLines.filter((row) => row.sectionKey === 'other');
  const picked: typeof overrunLines = [];

  if (materials[0]) picked.push(materials[0]);
  if (labor[0]) picked.push(labor[0]);
  for (const row of overrunLines) {
    if (picked.length >= MAX_LINE_INSIGHTS_PER_PROJECT) break;
    if (!picked.includes(row)) picked.push(row);
  }
  if (picked.length === 0 && other[0]) picked.push(other[0]);
  return picked.slice(0, MAX_LINE_INSIGHTS_PER_PROJECT);
}

function buildLineInsights(project: PortfolioBudgetProjectInput): PortfolioBudgetInsightsResult {
  const estimateData = project.estimateData || {};
  const expenses = (project.expenses || []).map((expense) =>
    normalizeExpenseForMatching(expense as Record<string, unknown>)
  );
  const sections = buildRateInsightSections({ estimateData, expenses });

  const overrunLines = pickLineOverruns(
    sections
      .flatMap((section) =>
        section.lineItems.map((line) => ({
          line,
          sectionKey: section.key,
          sectionTitle: section.title,
        }))
      )
      .filter(({ line }) => qualifiesLineOverrun(line))
      .sort((a, b) => lineOverAmount(b.line) - lineOverAmount(a.line))
  );

  const insights: AiInsight[] = [];
  const nextSteps: AiNextStep[] = [];

  for (const { line, sectionKey, sectionTitle } of overrunLines) {
    const overBy = lineOverAmount(line);
    const pct = line.variancePct != null ? `${line.variancePct > 0 ? '+' : ''}${line.variancePct}%` : '';
    const title = `${line.name} over estimate on ${project.title}`;
    const body = `${line.name}: ${money(line.loggedTotal)} logged vs ${money(line.estimatedTotal)} est${pct ? ` (${pct})` : ''}.`;

    insights.push(
      projectInsight(project, {
        type: 'alert',
        title,
        body,
        impactScore: overBy >= 250 ? 6 : 5,
        impactDollars: overBy,
        leakType: 'line_over_estimate',
        actionTarget: {
          kind: 'rate_insights',
          lineId: line.id,
          section: sectionKey,
        },
        evidence: [
          `${sectionTitle}`,
          `Estimate: ${money(line.estimatedTotal)}`,
          `Logged: ${money(line.loggedTotal)}`,
          `Over by ${money(overBy)}`,
        ],
      })
    );
    nextSteps.push(
      projectNextStep(project, {
        label: line.name,
        chip: sectionKey === 'labor' ? 'Labor overrun' : 'Rate insight',
        priority: overBy >= 250 ? 'medium' : 'low',
        leakType: 'line_over_estimate',
        actionTarget: {
          kind: 'rate_insights',
          lineId: line.id,
          section: sectionKey,
        },
      })
    );
  }

  return { insights, nextSteps };
}

/** Build portfolio insights from logged costs vs estimate / category budgets. */
export function buildPortfolioBudgetInsights(
  projects: PortfolioBudgetProjectInput[]
): PortfolioBudgetInsightsResult {
  const insights: AiInsight[] = [];
  const nextSteps: AiNextStep[] = [];

  for (const project of projects) {
    const status = normalizeStatus(project.status);
    if (!isEligibleProject(status)) continue;

    const estimateData = resolveProjectEstimateData({
      estimateData: project.estimateData,
      projectData: { estimateData: project.estimateData },
    });
    const buckets = project.buckets || [];
    const expenses = project.expenses || [];
    const plannedBudget =
      buckets.reduce((sum, bucket) => sum + (Number(bucket.budget) || 0), 0) ||
      Number(project.plannedBudget) ||
      0;
    const totalSpent = expenses.reduce((sum, expense) => {
      const normalized = normalizeExpenseForMatching(expense as Record<string, unknown>);
      return sum + (Number(normalized.amount) || 0);
    }, 0);

    const enriched: PortfolioBudgetProjectInput = {
      ...project,
      estimateData,
      buckets,
      expenses,
      plannedBudget,
    };

    const projectLevel = buildProjectLevelInsights(enriched, plannedBudget, totalSpent);
    const categoryLevel = buildCategoryInsights(enriched);
    const lineLevel = buildLineInsights(enriched);

    insights.push(...projectLevel.insights, ...categoryLevel.insights, ...lineLevel.insights);
    nextSteps.push(...projectLevel.nextSteps, ...categoryLevel.nextSteps, ...lineLevel.nextSteps);
  }

  return { insights, nextSteps };
}

/** Map a stored project row into portfolio budget insight input. */
export function projectToPortfolioBudgetInput(project: Record<string, unknown>): PortfolioBudgetProjectInput | null {
  const id = String(project?.id ?? '').trim();
  if (!id) return null;

  const projectData = (project.projectData as Record<string, unknown> | undefined) || {};
  const estimateData = resolveProjectEstimateData(project);
  const buckets = (projectData.buckets as PortfolioBudgetBucket[] | undefined) || [];
  const expenses =
    (projectData.expenses as unknown[] | undefined) ||
    (project.expenses as unknown[] | undefined) ||
    [];

  const plannedBudget =
    buckets.reduce((sum, bucket) => sum + (Number(bucket.budget) || 0), 0) ||
    Number(project.estimatedCost || projectData.estimatedCost || 0);

  return {
    id,
    title: String(project.title || project.name || 'Project'),
    status: String(project.status || ''),
    estimateData,
    buckets,
    expenses,
    plannedBudget,
    finalCustomerPrice: Number(project.bidPrice || projectData.bidPrice || 0),
  };
}
