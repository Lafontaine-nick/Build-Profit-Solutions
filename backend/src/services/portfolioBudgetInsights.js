/**
 * Portfolio budget insights — server-side mirror of mobile portfolioBudgetInsights.ts.
 * Uses buckets, expenses, and estimate line items from the dashboard payload.
 */

const MIN_CATEGORY_OVER_USD = 25;
const MIN_LINE_LOGGED_USD = 25;
const MIN_LINE_OVER_USD = 10;
const MIN_LINE_OVER_PCT = 5;
const MIN_PROJECT_OVER_USD = 100;
const MAX_LINE_INSIGHTS_PER_PROJECT = 3;

const ACTIVE_PIPELINE_STATUSES = new Set([
  'won',
  'in_progress',
  'active',
]);

function normalizeStatus(status) {
  return String(status || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function money(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function bucketCategoryLabel(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('material') || lower.includes('equipment')) return 'Materials';
  if (lower.includes('labor')) return 'Labor';
  return String(name || 'Category').trim() || 'Category';
}

function resolveEstimateData(project) {
  const projectData = project.projectData || {};
  return {
    ...(project.bid || {}),
    ...(projectData.estimateData || {}),
    ...(project.estimateData || {}),
  };
}

function normalizeExpense(expense) {
  if (!expense || typeof expense !== 'object') return null;
  return {
    id: String(expense.id || ''),
    category: expense.category != null ? String(expense.category) : undefined,
    amount: Number.isFinite(Number(expense.amount)) && Number(expense.amount) >= 0
      ? Number(expense.amount)
      : 0,
    linkedLineId: expense.linkedLineId != null ? String(expense.linkedLineId) : undefined,
  };
}

function lineEstimatedTotal(line) {
  const total = Number(line.total);
  if (Number.isFinite(total) && total > 0) return total;
  const qty = Number(line.qty ?? line.quantity) || 1;
  const unitPrice = Number(line.unitPrice ?? line.unitRate ?? line.unitCost) || 0;
  return qty * unitPrice;
}

function collectLineItems(estimateData) {
  const materials = Array.isArray(estimateData.materialLineItems)
    ? estimateData.materialLineItems
    : [];
  const labor = Array.isArray(estimateData.laborLineItems)
    ? estimateData.laborLineItems
    : [];
  return [
    ...materials.map((line) => ({ ...line, kind: 'materials' })),
    ...labor.map((line) => ({ ...line, kind: 'labor' })),
  ];
}

function loggedForLine(line, expenses) {
  const lineId = String(line.id || '');
  let total = 0;
  for (const expense of expenses) {
    if (!expense) continue;
    if (lineId && expense.linkedLineId === lineId) {
      total += expense.amount;
      continue;
    }
    const category = String(expense.category || '').toLowerCase();
    const lineName = String(line.name || line.description || '').toLowerCase();
    if (
      lineName &&
      (category.includes(lineName) || lineName.includes(category)) &&
      !expense.linkedLineId
    ) {
      total += expense.amount;
    }
  }
  return total;
}

function qualifiesLineOverrun(estimatedTotal, loggedTotal) {
  if (estimatedTotal <= 0 || loggedTotal <= estimatedTotal) return false;
  const over = loggedTotal - estimatedTotal;
  const pct = (over / estimatedTotal) * 100;
  if (loggedTotal < MIN_LINE_LOGGED_USD && over < MIN_LINE_OVER_USD) return false;
  return over >= MIN_LINE_OVER_USD || pct >= MIN_LINE_OVER_PCT;
}

function pickLineOverruns(rows) {
  const materials = rows.filter((row) => row.kind === 'materials');
  const labor = rows.filter((row) => row.kind === 'labor');
  const other = rows.filter((row) => row.kind !== 'materials' && row.kind !== 'labor');
  const picked = [];
  if (materials[0]) picked.push(materials[0]);
  if (labor[0]) picked.push(labor[0]);
  for (const row of rows) {
    if (picked.length >= MAX_LINE_INSIGHTS_PER_PROJECT) break;
    if (!picked.includes(row)) picked.push(row);
  }
  if (picked.length === 0 && other[0]) picked.push(other[0]);
  return picked.slice(0, MAX_LINE_INSIGHTS_PER_PROJECT);
}

function buildPortfolioBudgetInsights(projects) {
  const insights = [];
  const nextSteps = [];

  for (const project of projects || []) {
    const status = normalizeStatus(project.status);
    if (!ACTIVE_PIPELINE_STATUSES.has(status)) continue;

    const title = String(project.title || project.name || 'Project');
    const projectId = String(project.id || '');
    if (!projectId) continue;

    const estimateData = resolveEstimateData(project);
    const buckets = Array.isArray(project.buckets)
      ? project.buckets
      : Array.isArray(project.projectData?.buckets)
        ? project.projectData.buckets
        : [];
    const rawExpenses = Array.isArray(project.expenses)
      ? project.expenses
      : Array.isArray(project.projectData?.expenses)
        ? project.projectData.expenses
        : [];
    const expenses = rawExpenses
      .map(normalizeExpense)
      .filter(Boolean);

    const bucketBudget = buckets.reduce((sum, bucket) => sum + (Number(bucket.budget) || 0), 0);
    const projectBudget = Number(project.estimatedCost);
    // A partial category breakdown must not replace an authoritative
    // project-level cost budget.
    const plannedBudget = Number.isFinite(projectBudget) && projectBudget > 0
      ? Math.max(projectBudget, bucketBudget)
      : bucketBudget;
    const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const projectOver = totalSpent - plannedBudget;
    if (plannedBudget > 0 && projectOver >= MIN_PROJECT_OVER_USD) {
      insights.push({
        id: `budget-insight-${projectId}-project`,
        type: 'alert',
        title: `${title} is over cost budget`,
        body: `${title} has spent ${money(totalSpent)} against a ${money(plannedBudget)} cost budget — about ${money(projectOver)} over.`,
        projectId,
        impactScore: 9,
        impactDollars: projectOver,
        leakType: 'over_budget',
        actionTarget: { kind: 'budget_tab' },
      });
      nextSteps.push({
        id: `budget-step-${projectId}-project`,
        label: `Inspect overruns on ${title}`,
        chip: 'Urgent review',
        projectId,
        priority: 'high',
        leakType: 'over_budget',
        actionTarget: { kind: 'budget_tab' },
      });
    }

    for (const bucket of buckets) {
      const budget = Number(bucket.budget) || 0;
      const spent = Number(bucket.spent) || 0;
      const overBy = spent - budget;
      if (budget <= 0 || overBy < MIN_CATEGORY_OVER_USD) continue;
      const category = bucketCategoryLabel(bucket.name);
      const bucketName = String(bucket.name || category);
      insights.push({
        id: `budget-insight-${projectId}-cat-${bucketName}`,
        type: 'alert',
        title: `${category} over budget on ${title}`,
        body: `${category} has spent ${money(spent)} against a ${money(budget)} cost budget — ${money(overBy)} over.`,
        projectId,
        impactScore: 7,
        impactDollars: overBy,
        leakType: 'category_over_budget',
        actionTarget: { kind: 'budget_category', category: bucketName },
      });
      nextSteps.push({
        id: `budget-step-${projectId}-cat-${bucketName}`,
        label: `Review ${category.toLowerCase()} on ${title}`,
        chip: 'Budget review',
        projectId,
        priority: overBy >= budget * 0.1 ? 'high' : 'medium',
        leakType: 'category_over_budget',
        actionTarget: { kind: 'budget_category', category: bucketName },
      });
    }

    const lineCandidates = pickLineOverruns(
      collectLineItems(estimateData)
        .map((line) => {
          const estimatedTotal = lineEstimatedTotal(line);
          const loggedTotal = loggedForLine(line, expenses);
          const over = Math.max(0, loggedTotal - estimatedTotal);
          return {
            line,
            kind: line.kind || 'other',
            estimatedTotal,
            loggedTotal,
            over,
            variancePct:
              estimatedTotal > 0 ? ((loggedTotal - estimatedTotal) / estimatedTotal) * 100 : null,
          };
        })
        .filter((row) => qualifiesLineOverrun(row.estimatedTotal, row.loggedTotal))
        .sort((a, b) => b.over - a.over)
    );

    for (const row of lineCandidates) {
      const lineName = String(row.line.name || row.line.description || 'Estimate line');
      const pct =
        row.variancePct != null
          ? `${row.variancePct > 0 ? '+' : ''}${row.variancePct.toFixed(1)}%`
          : '';
      const section = row.kind === 'labor' ? 'labor' : row.kind === 'materials' ? 'materials' : 'other';
      insights.push({
        id: `budget-insight-${projectId}-line-${row.line.id || lineName}`,
        type: 'alert',
        title: `${lineName} over estimate on ${title}`,
        body: `${lineName}: ${money(row.loggedTotal)} logged vs ${money(row.estimatedTotal)} est${pct ? ` (${pct})` : ''}.`,
        projectId,
        impactScore: row.over >= 250 ? 6 : 5,
        impactDollars: row.over,
        leakType: 'line_over_estimate',
        actionTarget: {
          kind: 'rate_insights',
          lineId: String(row.line.id || ''),
          section,
        },
      });
      nextSteps.push({
        id: `budget-step-${projectId}-line-${row.line.id || lineName}`,
        label: lineName,
        chip: section === 'labor' ? 'Labor overrun' : 'Rate insight',
        projectId,
        priority: row.over >= 250 ? 'medium' : 'low',
        leakType: 'line_over_estimate',
        actionTarget: {
          kind: 'rate_insights',
          lineId: String(row.line.id || ''),
          section,
        },
      });
    }
  }

  return { insights, nextSteps };
}

module.exports = {
  buildPortfolioBudgetInsights,
};
