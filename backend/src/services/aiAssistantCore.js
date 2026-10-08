// ── Portfolio / routing intent (shared by aiAssistant route + regression tests) ──
function normalizeAiMessageForIntent(message = '') {
  return String(message || '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .trim();
}

// Note: messages are lowercased before test — use /i so "am i" matches after normalization
const SIMPLE_PROJECT_BUDGET_STATUS_PATTERN =
  /\b(am i |are we |is (?:this |the )?project )?over budget\b|\bover budget\b|\bbudget status\b|\b(?:within|under|over) budget\b|\bspent over (?:my )?budget\b/i;

const PORTFOLIO_LOSING_MONEY_PATTERN =
  /\b(where am I losing money|losing money across|profit leak|biggest profit leak|show me the biggest profit leak|which\s+(?:projects?|jobs?)\s+(?:are\s+)?losing\s+money|(?:projects?|jobs?)\s+losing\s+money)\b/i;

// Portfolio list phrasing only. Singular project questions must be resolved
// against a named project before this predicate is used.
const PORTFOLIO_OVER_BUDGET_LIST_PATTERN =
  /\b(which\s+)?(active\s+)?projects\s+(are\s+)?over\s+budget\b|\b(show\s+)?projects\s+over\s+budget\b/i;

const PORTFOLIO_BUDGET_RISKS_PATTERN =
  /\b(budget\s+risks?|budget\s+alerts?|identify\s+budget\s+risks?|review\s+budget\s+alerts?|which\s+projects?\s+have\s+budget\s+risks?|what\s+are\s+(?:the\s+)?current\s+risks?\s+(?:of\s+)?(?:my\s+)?(?:active\s+|current\s+)?(?:projects?|jobs?)|current\s+risks?\s+(?:of\s+)?(?:my\s+)?(?:active\s+|current\s+)?(?:projects?|jobs?)|(?:order|rank|sort|list|show|tell\s+me)\b[\s\S]{0,50}\bcurrent\s+risk(?:s)?\b[\s\S]{0,50}\b(?:my\s+)?(?:active\s+|current\s+)?(?:projects?|jobs?))\b/i;

const PORTFOLIO_COMPARE_ACTIVE_PATTERN =
  /\bcompare\s+(?:my\s+)?active\s+(?:projects?|jobs?)\b|\bcompare\s+all\s+my\s+active\s+(?:projects?|jobs?)\b|\bcompare\s+my\s+active\s+work\b/i;

const PORTFOLIO_ACTIVE_FILTER_PATTERN =
  /^\s*(?:only|just)\s+(?:show|include)\s+(?:me\s+)?(?:the\s+)?active\s+(?:projects?|jobs?)(?:\s+only)?\s*[.!?]?\s*$/i;

/** Command Center “What needs attention” / priorities — same tool path as focus-today (compare_projects activeOnly) */
const PORTFOLIO_FOCUS_TODAY_PATTERN =
  /\bwhat\s+should\s+i\s+focus(?:\s+on)?(?:\s+today)?\b|\bwhat\s+needs\s+attention\b|\bgive\s+me\s+my\s+top\s+priorities\b|\bwhat\s+are\s+my\s+top\s+priorities\b|\bneeds\s+my\s+attention\b|\bfocus\s+on\s+today\b/i;

// Exclude "worst-case" (estimate scenario) — use worst(?!-) where relevant
const LOWEST_MARGIN_PHRASE = String.raw`lowest\s+(?:(?:gross|profit)\s+){0,2}margin`;
const PORTFOLIO_WORST_PROJECT_PATTERN =
  new RegExp(
    String.raw`\b(?:which|what)\s+(?:job|project)\s+is\s+(?:the\s+)?worst(?!-)\b|\b(?:what|which)\s+is\s+(?:the\s+)?worst(?!-)\s+(?:job|project)\b|\b(?:worst(?!-)|${LOWEST_MARGIN_PHRASE})\s+(?:job|project)\b|\bwhich\s+(?:one|job|project)\s+has\s+(?:the\s+)?${LOWEST_MARGIN_PHRASE}\b|\b${LOWEST_MARGIN_PHRASE}\s+(?:job|project|across)\b`,
    'i'
  );

function isPortfolioLosingMoneyQuery(message = '') {
  return PORTFOLIO_LOSING_MONEY_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isPortfolioOverBudgetListQuery(message = '') {
  return PORTFOLIO_OVER_BUDGET_LIST_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isBadOutcomeScenarioQuery(message = '') {
  const normalized = normalizeAiMessageForIntent(message);
  return (
    /\b(?:if|when)\s+(?:things|this|the\s+job|it)\s+(?:go|goes|turns?)\s+(?:bad|badly|wrong)\b/i.test(normalized) ||
    /\bwhat\s+if\b[\s\S]*\b(?:go|goes|turns?)\s+(?:bad|badly|wrong)\b/i.test(normalized) ||
    /\b(?:bad\s+outcome|things\s+go\s+bad)\b/i.test(normalized)
  );
}

function isCalculationFollowUpQuery(message = '') {
  const normalized = normalizeAiMessageForIntent(message);
  return (
    /\b(show|give|explain|walk me through|how did you get)\b[\s\S]*\b(calculation|math|formula|numbers)\b/i.test(normalized) ||
    /\bhow did you calculate\b/i.test(normalized) ||
    /\bbudget\s+variance\b/i.test(normalized) ||
    /\bmargin\b/i.test(normalized)
  );
}

function isExplicitExpenseLogQuery(message = '') {
  const text = String(message || '');
  return (
    /\b(log|record|add|create|enter|submit)\b[\s\S]{0,48}\b(expense|expenses)\b/i.test(text) ||
    /\b(expense|expenses)\b[\s\S]{0,48}\b(log|record|add)\b/i.test(text) ||
    (/\b(spent|bought|purchased)\b/i.test(text) && /\$?\d/.test(text))
  );
}

function isExpenseTypeReply(message = '') {
  const text = normalizeAiMessageForIntent(message);
  return /^(materials?|labor|labour|equipment|permit|other)\b/.test(text);
}

function isNewTopicInterruptingWorkflow(message = '') {
  const text = normalizeAiMessageForIntent(message);
  return (
    /\b(profit|margin|markup|over budget|compare|completed (?:jobs?|projects?)|how's it going|how is it going|what should i focus|budget risks?|projected|forecast)\b/i.test(text) ||
    isPortfolioOverBudgetListQuery(text) ||
    isPortfolioLosingMoneyQuery(text) ||
    isPortfolioBudgetRisksQuery(text) ||
    isCalculationFollowUpQuery(text)
  );
}

function shouldContinueExpenseWorkflow(currentMessage = '', lastAssistantMessage = '') {
  if (isNewTopicInterruptingWorkflow(currentMessage)) return false;
  if (isExplicitExpenseLogQuery(currentMessage)) return true;
  const askedForType = /\bwhat type of expense\b/i.test(String(lastAssistantMessage || ''));
  return askedForType && isExpenseTypeReply(currentMessage);
}

function parseCustomRemainingCostIncrease(message = '', history = []) {
  const text = normalizeAiMessageForIntent(message);
  if (!text) return null;
  if (/\b(?:go back to|original forecast|original numbers|baseline forecast)\b/i.test(text)) {
    return { type: 'restore' };
  }
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  const makeThat = /\b(?:make that|actually|instead|change (?:it|that) to)\b/i.test(text);
  const priorIncrease = Array.isArray(history)
    ? [...history].reverse().find((item) => parseCustomRemainingCostIncrease(item?.content || '', []))
    : null;
  if (!pctMatch) return null;
  const percent = Number(pctMatch[1]);
  if (!Number.isFinite(percent)) return null;
  const hasWhatIf = /\bwhat\s+if\b/i.test(text) || /\bincrease/i.test(text) || /\banother\b/i.test(text) || makeThat;
  if (!hasWhatIf && !priorIncrease) return null;
  return {
    type: 'remaining_increase',
    percent,
    replacePrevious: makeThat || /\banother\b/i.test(text),
    basis: /\b(?:over|above)\s+(?:the\s+)?(?:cost\s+)?budget\b/i.test(text)
      ? 'budget'
      : 'remaining',
  };
}

function buildRemainingCostIncreaseReply({ project = null, parsedContext = {}, percent = 0, basis = 'remaining' } = {}) {
  const snapshot = getProjectFinancialSnapshot({ project, parsedContext });
  const revenue = Number(snapshot.revenue || 0);
  const spent = Number(snapshot.spent || 0);
  const money = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`;
  const title = project?.title || project?.name || parsedContext.currentProject || parsedContext.projectName || 'this project';
  if (snapshot.forecastMethod === 'completed' && basis !== 'budget') {
    const raised = spent * (1 + (Number(percent) / 100));
    const baseProfit = revenue - spent;
    const scenarioProfit = revenue - raised;
    const scenarioMargin = revenue > 0 ? (scenarioProfit / revenue) * 100 : null;
    return [
      `**If costs had been ${Number(percent)}% higher — ${title}** · Completed`,
      '',
      'This is a hypothetical. It does not change the saved job.',
      '',
      `• Spent: ${money(spent)} → ${money(raised)}`,
      `• Net profit: ${money(baseProfit)} → ${money(scenarioProfit)}`,
      scenarioMargin == null ? '' : `• Margin: ${scenarioMargin.toFixed(1)}%`,
    ].filter(Boolean).join('\n');
  }
  const increaseBasis = basis === 'budget' ? 'budget' : 'remaining';
  const baselineFinal = snapshot.projectedFinalCost != null
    ? Number(snapshot.projectedFinalCost)
    : Number(snapshot.estimatedCost || 0);
  const baselineBudget = Number(snapshot.estimatedCost || 0);
  const remaining = Math.max(0, baselineFinal - spent);
  const raisedRemaining = remaining * (1 + (Number(percent) / 100));
  const finalCost = increaseBasis === 'budget'
    ? baselineBudget * (1 + (Number(percent) / 100))
    : spent + raisedRemaining;
  const baselineProfit = revenue - (increaseBasis === 'budget' ? baselineBudget : baselineFinal);
  const projectedProfit = revenue - finalCost;
  const margin = revenue > 0 ? (projectedProfit / revenue) * 100 : null;
  return [
    increaseBasis === 'budget'
      ? `**If the cost budget increases ${Number(percent)}% — ${title}**`
      : `**If remaining costs increase ${Number(percent)}% — ${title}**`,
    '',
    `This is a hypothetical. It does not change saved project data.`,
    '',
    increaseBasis === 'budget'
      ? `Original cost budget: ${money(baselineBudget)} → scenario cost budget: ${money(finalCost)}`
      : `Remaining costs: ${money(remaining)} → ${money(raisedRemaining)}`,
    `Projected final cost: ${money(finalCost)}`,
    `Projected profit: ${money(projectedProfit)}`,
    margin == null ? '' : `Projected margin: ${margin.toFixed(1)}%`,
    `Profit lost versus the original forecast: ${money(baselineProfit - projectedProfit)}`,
  ].filter(Boolean).join('\n');
}

function isPortfolioBudgetRisksQuery(message = '') {
  return PORTFOLIO_BUDGET_RISKS_PATTERN.test(normalizeAiMessageForIntent(message));
}

/** Single-project budget status ("am I over budget?") — excludes portfolio list questions */
function isSimpleProjectBudgetStatusQuery(message = '') {
  const s = normalizeAiMessageForIntent(message);
  if (isPortfolioOverBudgetListQuery(s)) return false;
  return SIMPLE_PROJECT_BUDGET_STATUS_PATTERN.test(s);
}

function isPortfolioCompareActiveQuery(message = '') {
  return PORTFOLIO_COMPARE_ACTIVE_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isPortfolioActiveFilterQuery(message = '') {
  return PORTFOLIO_ACTIVE_FILTER_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isPortfolioFocusTodayQuery(message = '') {
  return PORTFOLIO_FOCUS_TODAY_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isPortfolioWorstProjectQuery(message = '') {
  return PORTFOLIO_WORST_PROJECT_PATTERN.test(normalizeAiMessageForIntent(message));
}

/** Same ordering rules as compare_projects in aiAssistant.js */
function sortCompareProjectsResults(items = [], sortBy = '') {
  const key = String(sortBy || '').toLowerCase();
  const arr = [...(Array.isArray(items) ? items : [])];
  return arr.sort((a, b) => {
    if (key === 'progress') return b.progress - a.progress;
    if (key === 'overbudget') return b.overBudgetPct - a.overBudgetPct;
    if (key === 'risk') return (b.riskFlags?.length || 0) - (a.riskFlags?.length || 0);
    if (key === 'lowmargin' || key === 'worst') return (a.margin ?? 0) - (b.margin ?? 0);
    return (b.margin ?? 0) - (a.margin ?? 0);
  });
}

function buildFinishedJobForecastReply(project, opts = {}) {
  const { parsedContext = {}, isCurrent = false } = opts;
  if (!project) return null;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrent ? parsedContext : {},
  });
  const projectStatus = normalizeProjectStatus(project?.status || (isCurrent ? parsedContext?.status : ''));
  const finished = snapshot.forecastMethod === 'completed' || isTerminalProjectStatus(projectStatus);
  const projectedProfit = isCurrent && typeof parsedContext.projectedProfit === 'number' && Number.isFinite(parsedContext.projectedProfit)
    ? Math.round(parsedContext.projectedProfit)
    : (snapshot.projectedProfit != null && Number.isFinite(snapshot.projectedProfit) ? Math.round(snapshot.projectedProfit) : null);
  if (!finished || !(snapshot.revenue > 0) || projectedProfit == null) return null;
  const title = project?.title || project?.name || 'This project';
  const spent = snapshot.revenue - projectedProfit;
  const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const margin = (projectedProfit / snapshot.revenue) * 100;
  return [
    `**Profit forecast — ${title}** · Completed`,
    '',
    `• Revenue: ${money(snapshot.revenue)}`,
    `• Spent: ${money(spent)}`,
    `• Net profit: ${money(projectedProfit)}`,
    `• Margin: ${margin.toFixed(1)}%`,
    '',
    'This job is finished, so this is the actual result, not a forecast.',
  ].join('\n');
}

/** Open-job forecast from the snapshot. Dollars are never supplied by the model. */
function buildLiveForecastReply(project, opts = {}) {
  const { parsedContext = {}, isCurrent = false } = opts;
  if (!project) return null;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrent ? parsedContext : {},
  });
  if (snapshot.forecastMethod === 'completed') return null;
  if (!(snapshot.revenue > 0) || snapshot.projectedFinalCost == null || snapshot.projectedProfit == null) return null;
  const title = project?.title || project?.name || 'this project';
  const actual = Number(snapshot.spent || 0);
  const progressPct = Number(snapshot.progress || 0);
  const baseEstimate = Number(snapshot.estimatedCost || 0);
  const likelyFinalCost = Number(snapshot.projectedFinalCost);
  const likelyProfit = Number(snapshot.projectedProfit);
  const likelyMargin = snapshot.projectedMarginPct != null ? Number(snapshot.projectedMarginPct) : 0;
  const costRiskPct = progressPct > 1 ? 0.08 : 0.1;
  const optimisticFinalCost = Math.max(actual, likelyFinalCost * (1 - costRiskPct));
  const conservativeFinalCost = likelyFinalCost * (1 + costRiskPct);
  const money = (n) => `$${Math.round(Number(n)).toLocaleString()}`;
  const marginOf = (profit) => (snapshot.revenue > 0 ? (profit / snapshot.revenue) * 100 : 0);
  const variance = (finalCost) => {
    if (!(baseEstimate > 0)) return 'No cost budget baseline';
    const delta = finalCost - baseEstimate;
    if (Math.abs(delta) < 1) return 'On budget';
    return delta > 0
      ? `Over budget by ${money(delta)}`
      : `Under budget by ${money(Math.abs(delta))}`;
  };
  const method = actual <= 0 && baseEstimate > 0
    ? 'estimate baseline (no costs logged yet)'
    : (progressPct > 1 && actual > 0
      ? 'progress-adjusted burn rate (CPI blend)'
      : (baseEstimate > 0
        ? 'estimate baseline (insufficient progress data)'
        : 'actuals + committed costs only (no estimate baseline)'));
  const driver = actual <= 0
    ? 'No costs have been logged yet, so this forecast uses the cost budget.'
    : 'Current burn appears consistent with the cost budget baseline.';
  const optimisticProfit = snapshot.revenue - optimisticFinalCost;
  const conservativeProfit = snapshot.revenue - conservativeFinalCost;
  return [
    `📈 Forecast final cost & profit for "${title}":`,
    '',
    '📊 Baseline:',
    `- Contract Value: ${money(snapshot.revenue)}`,
    `- Estimated Cost Baseline: ${money(baseEstimate)}`,
    `- Actual Spent to Date: ${money(actual)}`,
    `- Progress: ${progressPct.toFixed(0)}%`,
    `- Method: ${method}`,
    '',
    '💰 Forecast (EAC):',
    `- Optimistic Final Cost: ${money(optimisticFinalCost)} (${variance(optimisticFinalCost)}) → Projected Profit: ${money(optimisticProfit)} (${marginOf(optimisticProfit).toFixed(1)}%)`,
    `- Likely Final Cost: ${money(likelyFinalCost)} (${variance(likelyFinalCost)}) → Projected Profit: ${money(likelyProfit)} (${likelyMargin.toFixed(1)}%)`,
    `- Worst-case (risk-adjusted) Final Cost: ${money(conservativeFinalCost)} (${variance(conservativeFinalCost)}) → Projected Profit: ${money(conservativeProfit)} (${marginOf(conservativeProfit).toFixed(1)}%)`,
    '',
    '⚠️ Key drivers:',
    `1. ${driver}`,
  ].join('\n');
}

function namesShareStem(left, right) {
  const a = String(left || '').trim().toLowerCase();
  const b = String(right || '').trim().toLowerCase();
  if (!a || !b || a === b || a.length < 3 || b.length < 3) return false;
  const stem = (a.length <= b.length ? a : b).slice(0, 3);
  return a.startsWith(stem) && b.startsWith(stem);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Named-person payment questions stay on that person. Similar names are separate payees. */
function buildSeparatePayeeReply(message, projects) {
  const text = String(message || '');
  if (!/\b(how much|pay|paid)\b/i.test(text)) return null;
  if (isPercentChangeQuestion(text) || isCategoryBudgetQuestion(text)) return null;
  const groups = new Map();
  for (const project of Array.isArray(projects) ? projects : []) {
    const expenses = Array.isArray(project?.expenses)
      ? project.expenses
      : (Array.isArray(project?.projectData?.expenses) ? project.projectData.expenses : []);
    for (const expense of expenses) {
      const name = String(expense?.vendorName || expense?.vendor || '').trim();
      if (name.length < 2) continue;
      const key = name.toLowerCase();
      const current = groups.get(key) || { name, total: 0 };
      current.total += Number(expense?.amount || 0);
      groups.set(key, current);
    }
  }
  const payees = [...groups.values()].sort((a, b) => b.name.length - a.name.length);
  const match = payees.find((payee) => new RegExp(`\\b${escapeRegExp(payee.name)}\\b`, 'i').test(text));
  if (!match) return null;
  const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const similar = payees.filter((other) => namesShareStem(match.name, other.name));
  const lines = [`You paid **${match.name}** **${money(match.total)}**.`];
  if (similar.length) {
    lines.push(similar.map((other) => `**${other.name}** is a separate payee, paid ${money(other.total)}.`).join('\n'));
  }
  return lines.join('\n\n');
}

function formatFinishedJobMarginReply({ title, revenue, spent, profit }) {
  const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return [
    `**Margin — ${title}** · Completed`,
    '',
    `• Revenue: ${money(revenue)}`,
    `• Spent: ${money(spent)}`,
    `• Net profit: ${money(profit)}`,
    `• Margin: ${margin.toFixed(1)}%`,
    '',
    'This job is finished, so this is the actual margin.',
  ].join('\n');
}

function formatMarginReply(opts = {}) {
  const { spendToDatePct, projectedPct, originalEstPct, projectedProfit, followUp = '➡️ Want me to check your PO commitments or anything else?' } = opts;
  const lines = ['### Margin Summary\n'];
  if (spendToDatePct != null) lines.push(`**Spend-to-date:** ${Number(spendToDatePct).toFixed(1)}%`);
  else lines.push('No costs have been logged yet.');
  if (projectedPct != null) lines.push(`**Projected at completion:** ${typeof projectedPct === 'string' ? projectedPct : Number(projectedPct).toFixed(1) + '%'}`);
  if (originalEstPct != null) lines.push(`**Original estimate:** ${typeof originalEstPct === 'string' ? originalEstPct : Number(originalEstPct).toFixed(1) + '%'}`);
  const profitStr = projectedProfit != null
    ? (typeof projectedProfit === 'string' ? projectedProfit : `$${Math.round(projectedProfit).toLocaleString()}`)
    : '—';
  lines.push(`**Projected profit:** ${profitStr}`);
  lines.push('');
  lines.push('_**Spend-to-date margin** = (revenue − spent) ÷ revenue. **Projected at completion** uses run-rate cost from progress vs contract._');
  lines.push('');
  lines.push(followUp);
  return lines.join('\n');
}

function normalizeMoneyValue(value) {
  if (value == null) return 0;
  if (typeof value === 'string') {
    const cleaned = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(cleaned) ? cleaned : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeNonNegativeMoneyValue(value) {
  if (value == null || value === '') return null;
  const num = normalizeMoneyValue(value);
  return num >= 0 ? num : null;
}

const CENTRAL_COMMAND_READONLY_TOOLS = new Set([
  'get_project_by_name',
  'compare_projects',
  'get_project_health',
  'forecast_profit',
  'analyze_expenses',
  'get_timeline_items',
  'get_estimate',
  'run_scenario_analysis',
  'get_project_budget',
  'get_payment_schedule',
  'get_change_orders',
  'get_estimate_lines',
  'get_purchase_orders',
  'get_expenses',
  'get_calendar',
  'search_pricing_library',
]);

function isCentralCommandReadOnlyTool(toolName) {
  return CENTRAL_COMMAND_READONLY_TOOLS.has(String(toolName || '').trim());
}

function normalizeProjectStatus(status) {
  return String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function resolveProjectStatus(project = {}) {
  const topLevel = normalizeProjectStatus(project?.status);
  const nested = normalizeProjectStatus(project?.projectData?.status);
  const visibleStatuses = new Set([
    'bid_submitted',
    'submitted',
    'won',
    'in_progress',
    'active',
    'completed',
    'complete',
    'closed',
    'done',
    'finished',
  ]);
  if ((topLevel === 'draft' || topLevel === 'estimate') && visibleStatuses.has(nested)) {
    return nested;
  }
  return topLevel || nested;
}

function isTerminalProjectStatus(status) {
  return ['completed', 'complete', 'closed', 'done', 'finished', 'lost', 'cancelled', 'canceled']
    .includes(normalizeProjectStatus(status));
}

function isActiveProjectStatus(status) {
  return ['won', 'active', 'in_progress'].includes(normalizeProjectStatus(status));
}

/** Same visibility as Dashboard → All Projects (excludes estimate/draft-only rows). */
function isDashboardListedProjectForAi(project) {
  const status = resolveProjectStatus(project);
  if (status === 'draft' || status === 'estimate') return false;
  return [
    'bid_submitted',
    'submitted',
    'won',
    'in_progress',
    'active',
    'completed',
    'complete',
    'closed',
    'done',
    'finished',
  ].includes(status);
}

function filterPortfolioProjectsForAi(allProjects, parsedContext = {}) {
  const deletedIds = new Set(
    (Array.isArray(parsedContext?.deletedProjectIds) ? parsedContext.deletedProjectIds : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  return (Array.isArray(allProjects) ? allProjects : []).filter((project) => {
    const id = String(project?.id ?? '').trim();
    if (id && deletedIds.has(id)) return false;
    return isDashboardListedProjectForAi({
      ...project,
      status: resolveProjectStatus(project),
    });
  });
}

function hasFiniteNonNegativeValue(value) {
  const num = Number(value);
  return value !== null && value !== undefined && Number.isFinite(num) && num >= 0;
}

function firstKnownMoneyValue(values = []) {
  const list = Array.isArray(values) ? values : [];
  const positive = list.find((value) => hasFiniteNonNegativeValue(value) && Number(value) > 0);
  if (positive !== undefined) return Number(positive);
  if (list.some((value) => hasFiniteNonNegativeValue(value))) return 0;
  return null;
}

function getProjectExpenses(project, parsedContext = {}) {
  const contextProjectId =
    parsedContext?.projectId ||
    parsedContext?.activeProjectId ||
    parsedContext?.resolvedProjectId ||
    parsedContext?.selectedProjectId ||
    null;
  const canUseContextExpenses =
    !project ||
    (contextProjectId != null && String(contextProjectId) === String(project?.id));
  const expenses =
    (Array.isArray(project?.expenses) ? project.expenses : null) ||
    (Array.isArray(project?.projectData?.expenses) ? project.projectData.expenses : null) ||
    (canUseContextExpenses && Array.isArray(parsedContext?.expenses) ? parsedContext.expenses : null);
  return Array.isArray(expenses) ? expenses : [];
}

function getProjectPurchaseOrders(project, parsedContext = {}) {
  const contextProjectId =
    parsedContext?.projectId ||
    parsedContext?.activeProjectId ||
    parsedContext?.resolvedProjectId ||
    parsedContext?.selectedProjectId ||
    null;
  const canUseContextPurchaseOrders =
    !project ||
    (contextProjectId != null && String(contextProjectId) === String(project?.id));
  const purchaseOrders =
    (Array.isArray(project?.purchaseOrders) ? project.purchaseOrders : null) ||
    (Array.isArray(project?.projectData?.purchaseOrders) ? project.projectData.purchaseOrders : null) ||
    (canUseContextPurchaseOrders && Array.isArray(parsedContext?.purchaseOrders) ? parsedContext.purchaseOrders : null);
  return Array.isArray(purchaseOrders) ? purchaseOrders : [];
}

function isPurchaseOrderReceived(order) {
  const status = normalizeProjectStatus(order?.status || order?.state);
  return order?.received === true || ['received', 'complete', 'completed'].includes(status);
}

/** Still on order. Cancelled, rejected, or void orders are not a cost. */
function isPurchaseOrderOpen(order) {
  if (isPurchaseOrderReceived(order)) return false;
  const status = normalizeProjectStatus(order?.status || order?.state);
  return !['cancelled', 'canceled', 'void', 'voided', 'rejected', 'deleted', 'closed'].includes(status);
}

function receiptMissing(row) {
  const amount = normalizeNonNegativeMoneyValue(row?.amount ?? row?.total ?? row?.cost);
  if (!amount) return false;
  return !String(row?.receiptUri ?? '').trim();
}

/** Bills plus received purchase orders with no receipt attached. Matches Tax Center. */
function countMissingReceipts(project, parsedContext = {}) {
  const expenses = getProjectExpenses(project, parsedContext);
  const receivedOrders = getProjectPurchaseOrders(project, parsedContext).filter(isPurchaseOrderReceived);
  return [...expenses, ...receivedOrders].filter(receiptMissing).length;
}

function getProjectSpendBreakdown(project, parsedContext = {}) {
  const expenses = getProjectExpenses(project, parsedContext);
  const purchaseOrders = getProjectPurchaseOrders(project, parsedContext);
  const expenseTotal = expenses.reduce((sum, expense) => {
    const amount = normalizeNonNegativeMoneyValue(expense?.amount ?? expense?.total ?? expense?.cost);
    return sum + (amount ?? 0);
  }, 0);
  const receivedPoTotal = purchaseOrders.reduce((sum, order) => {
    const amount = normalizeNonNegativeMoneyValue(order?.amount ?? order?.total ?? order?.cost);
    return sum + (isPurchaseOrderReceived(order) ? (amount ?? 0) : 0);
  }, 0);
  const committedPoTotal = purchaseOrders.reduce((sum, order) => {
    const amount = normalizeNonNegativeMoneyValue(order?.amount ?? order?.total ?? order?.cost);
    return sum + (isPurchaseOrderOpen(order) ? (amount ?? 0) : 0);
  }, 0);
  const explicitActual = normalizeNonNegativeMoneyValue(
    project?.actualCost ??
    project?.totalSpent ??
    project?.projectData?.actualCost ??
    project?.projectData?.totalSpent ??
    parsedContext?.actualCost ??
    parsedContext?.totalSpent
  );
  const transactionTotal = expenseTotal + receivedPoTotal;
  return {
    expenseTotal,
    receivedPoTotal,
    committedPoTotal,
    spent: explicitActual == null ? transactionTotal : Math.max(explicitActual, transactionTotal),
    hasKnownSpent: explicitActual != null || expenses.length > 0 || purchaseOrders.length > 0,
  };
}

function sumPlannedCostFromBuckets(buckets) {
  if (!Array.isArray(buckets)) return 0;
  return buckets.reduce((sum, bucket) => {
    const name = String(bucket?.name || '').toLowerCase();
    if (
      name.includes('markup') ||
      name.includes('revenue') ||
      name.includes('contract value') ||
      name.includes('sell price') ||
      (name.includes('profit') && !name.includes('cost'))
    ) {
      return sum;
    }
    return sum + normalizeMoneyValue(bucket?.budget);
  }, 0);
}

function getApprovedChangeOrdersTotal(changeOrders = []) {
  if (!Array.isArray(changeOrders)) return 0;
  return changeOrders.reduce((sum, co) => {
    const approved = (typeof co?.approved === 'boolean' && co.approved) ||
      (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
    return approved ? sum + normalizeMoneyValue(co?.amount ?? 0) : sum;
  }, 0);
}

function getProjectMilestones(project, parsedContext = {}, opts = {}) {
  const { preferParsedMilestones = false } = opts;
  if (preferParsedMilestones && Array.isArray(parsedContext?.milestones) && parsedContext.milestones.length > 0) {
    return parsedContext.milestones;
  }
  const sources = [
    project?.milestones,
    project?.timelineItems,
    project?.weeklyPayments,
    project?.projectData?.milestones,
    project?.projectData?.timelineItems,
    project?.projectData?.weeklyPayments,
    project?.estimateData?.milestones,
    project?.estimateData?.paymentMilestones,
    project?.estimateData?.weeklyPayments,
    project?.projectData?.estimateData?.milestones,
    project?.projectData?.estimateData?.paymentMilestones,
    project?.projectData?.estimateData?.weeklyPayments,
    parsedContext?.milestones,
  ];
  return sources.find((source) => Array.isArray(source) && source.length > 0) ||
    sources.find(Array.isArray) ||
    [];
}

function getPaymentDateValue(milestone) {
  return milestone?.plannedDate || milestone?.scheduledDate || milestone?.dueDate || milestone?.date || null;
}

function isPaymentCollectedForAI(milestone, opts = {}) {
  const { projectIsCompleted = false } = opts;
  if (projectIsCompleted) return true;
  const status = String(milestone?.status || milestone?.state || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['complete', 'completed', 'paid', 'collected', 'done', 'finished'].includes(status)) return true;
  if (status.includes('collected') || status.includes('received')) return true;
  if (milestone?.collected === true || milestone?.isPaid === true || milestone?.paid === true) return true;
  if (String(milestone?.collectedAt || '').trim()) return true;
  // A scheduled row can carry a progress field without having been collected.
  const stillOpen = [
    'pending',
    'scheduled',
    'upcoming',
    'overdue',
    'due',
    'unpaid',
    'open',
    'in_progress',
    'not_started',
  ].includes(status);
  if (stillOpen) return false;
  const pct = Number(milestone?.progressPct ?? milestone?.progress ?? 0);
  return !status && Number.isFinite(pct) && pct >= 99.5;
}

function getMilestoneProgressForAI(project, parsedContext = {}) {
  const milestones = getProjectMilestones(project, parsedContext);
  if (!Array.isArray(milestones) || milestones.length === 0) return 0;
  const workMilestones = milestones.filter((milestone) => {
    const title = String(milestone?.title || milestone?.name || '').toLowerCase();
    return !title.includes('deposit') && milestone?.type !== 'deposit';
  });
  if (workMilestones.length === 0) return 0;
  const total = workMilestones.reduce((sum, milestone) => {
    const direct = Number(milestone?.progressPct ?? milestone?.progress ?? 0);
    if (Number.isFinite(direct) && direct > 0) {
      return sum + Math.min(100, Math.max(0, direct));
    }
    const status = String(milestone?.status || milestone?.state || '').toLowerCase();
    return sum + (['complete', 'completed', 'done', 'finished'].includes(status) ? 100 : 0);
  }, 0);
  return total / workMilestones.length;
}

function getProjectFinancialSnapshot({ parsedContext = {}, project = null, progressOverride = null } = {}) {
  const contextProjectId =
    parsedContext?.projectId ||
    parsedContext?.activeProjectId ||
    parsedContext?.resolvedProjectId ||
    parsedContext?.selectedProjectId ||
    null;
  const scopedContext =
    !project ||
    (contextProjectId != null && String(contextProjectId) === String(project?.id))
      ? parsedContext
      : {};
  const estimateData = project?.estimateData || project?.projectData?.estimateData || scopedContext?.estimateData || {};
  const changeOrders = scopedContext?.changeOrders || project?.changeOrders || project?.projectData?.changeOrders || [];
  const costBuckets =
    scopedContext?.buckets ??
    project?.buckets ??
    project?.projectData?.buckets ??
    [];
  const plannedCostFromBuckets = sumPlannedCostFromBuckets(costBuckets);
  const rawProjectAdjustedCostBudget =
    project?.adjustedCostBudget ??
    project?.projectData?.adjustedCostBudget;
  const projectAdjustedCostBudget = normalizeMoneyValue(rawProjectAdjustedCostBudget);
  const rawProjectForecastFinalCost =
    project?.forecastFinalCost ??
    project?.projectData?.forecastFinalCost;
  const projectForecastFinalCost = normalizeMoneyValue(rawProjectForecastFinalCost);
  const approvedChangeOrders = scopedContext?.approvedChangeOrdersTotal != null
    ? normalizeMoneyValue(scopedContext.approvedChangeOrdersTotal)
    : getApprovedChangeOrdersTotal(changeOrders);
  const baseBid = firstKnownMoneyValue([
    project?.bidPrice,
    project?.bidTotal,
    scopedContext?.bidTotal,
    scopedContext?.total,
    scopedContext?.bidPrice,
    estimateData?.totalBid,
  ]);
  const projectRevenue = firstKnownMoneyValue([
    project?.contractValue,
    project?.adjustedContractValue,
  ]);
  const contextRevenue = firstKnownMoneyValue([scopedContext?.contractValue]);
  const revenue = projectRevenue != null
    ? projectRevenue
    : (contextRevenue != null
      ? contextRevenue
      : (baseBid != null ? baseBid + approvedChangeOrders : null));
  const estimatedCost = firstKnownMoneyValue([
    rawProjectAdjustedCostBudget != null ? projectAdjustedCostBudget : null,
    project?.estimatedCost,
    scopedContext?.adjustedCostBudget,
    scopedContext?.estimatedCost,
    project?.estimateData?.totalCost,
    project?.estimateData?.baseCost,
    project?.projectData?.estimateData?.totalCost,
    project?.projectData?.estimateData?.baseCost,
    plannedCostFromBuckets > 0 ? plannedCostFromBuckets : null,
  ]);
  const spendBreakdown = getProjectSpendBreakdown(project, parsedContext);
  const spent = spendBreakdown.hasKnownSpent ? spendBreakdown.spent : null;
  const directProgressRaw = progressOverride ??
    project?.progress ??
    project?.overallProgressPct ??
    project?.projectData?.progress ??
    project?.projectData?.overallProgressPct ??
    scopedContext?.progress ??
    0;
  const progressRaw = Number(directProgressRaw) > 0
    ? directProgressRaw
    : getMilestoneProgressForAI(project, parsedContext) ||
      getMilestoneProgressForAI(null, parsedContext) ||
      directProgressRaw;
  const progress = Math.max(0, Math.min(100, normalizeMoneyValue(progressRaw)));

  const rawBidMargin = scopedContext?.bidMarginPct ??
    project?.bidMarginPct ??
    project?.marginPct ??
    estimateData?.marginPercent ??
    estimateData?.marginPct ??
    estimateData?.margin ??
    project?.margin;
  let bidMarginPct = normalizeMoneyValue(rawBidMargin);
  if (bidMarginPct > 0 && bidMarginPct <= 1) bidMarginPct *= 100;
  if (bidMarginPct <= 0 || bidMarginPct > 100) {
    bidMarginPct = revenue > 0 && estimatedCost > 0 ? ((revenue - estimatedCost) / revenue * 100) : 0;
  }

  // $0 spent is not a 100% margin. There is no spend-to-date margin until a cost is logged.
  const computedSpendToDateMarginPct = revenue > 0 && spent != null && spent > 0 ? ((revenue - spent) / revenue * 100) : null;
  const contextSpendToDateMarginPct = scopedContext?.spendToDateMarginPct ?? project?.spendToDateMarginPct ?? project?.projectData?.spendToDateMarginPct;
  const spendToDateMarginPct =
    spent != null && spent > 0 && typeof contextSpendToDateMarginPct === 'number' && Number.isFinite(contextSpendToDateMarginPct)
      ? contextSpendToDateMarginPct
      : computedSpendToDateMarginPct;
  const contextProjectedFinalCostValue = firstKnownMoneyValue([
    rawProjectForecastFinalCost != null ? projectForecastFinalCost : null,
    scopedContext?.forecastFinalCost,
  ]);
  const contextProjectedFinalCost =
    contextProjectedFinalCostValue != null && contextProjectedFinalCostValue > 0
      ? contextProjectedFinalCostValue
      : null;
  const projectStatus = normalizeProjectStatus(project?.status || scopedContext?.status);
  const isCompletedProject = isTerminalProjectStatus(projectStatus) || progress >= 100;
  const progressStatusConflict = isTerminalProjectStatus(projectStatus) && progress < 100;
  const actualPlusCommitted = (spent ?? 0) + (spendBreakdown.committedPoTotal ?? 0);
  // A finished job's cost is what was paid: bills plus received orders, same as the job budget.
  const derivedProjectedFinalCost = isCompletedProject && spent != null && spent > 0
    ? spent
    : (progress > 5 && spent != null && spent > 0
      ? Math.max(actualPlusCommitted, spent / (progress / 100))
      : estimatedCost != null
        ? Math.max(estimatedCost, actualPlusCommitted)
        : null);
  // Recompute from the selected project's current inputs whenever possible.
  // Cached forecast fields can be stale after timeline or expense updates.
  const hasCurrentForecastInputs =
    revenue != null &&
    spent != null &&
    (progress > 5 || estimatedCost != null);
  const projectedFinalCost = hasCurrentForecastInputs
    ? derivedProjectedFinalCost
    : contextProjectedFinalCost ?? derivedProjectedFinalCost;
  const contextProjectedProfit = scopedContext?.projectedProfit ?? project?.projectedProfit ?? project?.projectData?.projectedProfit;
  const derivedProjectedProfit =
    revenue > 0 && projectedFinalCost != null ? revenue - projectedFinalCost : null;
  // Profit and margin must come from the same cost basis. Prefer the projected
  // final cost when available; otherwise keep a supplied profit, then derive
  // margin from that profit instead of trusting an independent percentage.
  const projectedProfit =
    derivedProjectedProfit != null
      ? derivedProjectedProfit
      : (typeof contextProjectedProfit === 'number' && Number.isFinite(contextProjectedProfit)
        ? contextProjectedProfit
        : null);
  const projectedMarginPct =
    revenue > 0 && projectedProfit != null ? (projectedProfit / revenue) * 100 : null;
  const currentMarginPct = spent != null && spent > 0
    ? spendToDateMarginPct
    : (projectedMarginPct != null ? projectedMarginPct : (bidMarginPct > 0 ? bidMarginPct : null));
  const originalEstimateProfit =
    revenue != null && estimatedCost != null ? revenue - estimatedCost : null;
  const originalEstimateMarginPct =
    revenue > 0 && originalEstimateProfit != null
      ? (originalEstimateProfit / revenue) * 100
      : null;
  const remainingCostBudget =
    estimatedCost != null && spent != null
      ? Math.max(0, estimatedCost - actualPlusCommitted)
      : null;
  const forecastMethod =
    isCompletedProject && spent != null
      ? 'completed'
      : hasCurrentForecastInputs && progress > 5
        ? 'run-rate'
        : projectedFinalCost != null
          ? 'budget-fallback'
          : null;

  return {
    approvedChangeOrders,
    revenue,
    estimatedCost,
    spent,
    receivedPoTotal: spendBreakdown.receivedPoTotal,
    committedPOs: spendBreakdown.committedPoTotal,
    hasKnownSpent: spendBreakdown.hasKnownSpent,
    hasEstimatedCost: estimatedCost != null,
    hasProjectedProfit: projectedProfit != null,
    progress,
    bidMarginPct,
    spendToDateMarginPct,
    projectedFinalCost,
    projectedProfit,
    projectedMarginPct,
    originalEstimateProfit,
    originalEstimateMarginPct,
    currentProjectedProfit: projectedProfit,
    currentProjectedMarginPct: projectedMarginPct,
    remainingCostBudget,
    forecastMethod,
    currentMarginPct,
    dataQuality: {
      progressStatusConflict,
      estimateOnlyForecast: (spent == null || spent === 0) && progress === 0,
      hasActivity: spent != null && spent > 0,
    },
  };
}

function buildMakingEnoughReply(projectName, marginPct, dataQuality = {}) {
  const m = Number(marginPct).toFixed(1);
  const above = parseFloat(m) >= 20 ? 'above' : (parseFloat(m) >= 15 ? 'at' : 'below');
  const noCostsLogged = dataQuality.hasActivity !== true;
  const marginLabel = noCostsLogged ? 'estimated margin' : 'current margin';
  let reply = `The ${marginLabel} on **${projectName}** is **${m}%** based on the current numbers in this view. Many contractors target 15–25%; you're **${above}** that. `;
  if (noCostsLogged) {
    reply += `No costs have been logged yet, so this is the estimate, not money already spent. `;
  }
  if (dataQuality.estimateOnlyForecast) {
    reply += `No spend or progress is recorded yet, so this is not a performance-based result. `;
  }
  if (dataQuality.progressStatusConflict) {
    reply += `The project is marked completed but its progress field is below 100%; confirm that status before treating this as final. `;
  }
  reply += parseFloat(m) < 15 ? `Consider tightening costs or revisiting pricing on the next phase.` : `You're in a healthy range.`;
  reply += `\n\n➡️ Want me to check your biggest profit threat or run a scenario?`;
  return reply;
}

function buildProjectedProfitReply({
  projectName = 'This project',
  projectedProfit = null,
  marginPct = null,
  dataQuality = {},
  followUp = 'Want me to check your PO commitments or run a what-if scenario if the job runs longer?',
} = {}) {
  const projProfitStr = projectedProfit != null ? `$${Math.round(projectedProfit).toLocaleString()}` : '—';
  const marginStr = marginPct != null ? `${Number(marginPct).toFixed(1)}%` : '—';
  let reply = `The projected profit for the "${projectName}" project is ${projProfitStr}`;
  if (marginStr !== '—') reply += `, with a ${marginStr} margin`;
  reply += `. `;
  if (projectedProfit != null && projectedProfit >= 0) {
    reply += `That is a positive projected result, but it does not by itself mean the job is under its cost budget. `;
  } else if (projectedProfit != null) {
    reply += `The projection is currently negative, so cost or scope changes need attention. `;
  }
  if (dataQuality.estimateOnlyForecast) {
    reply += `This is estimate-based because no spend or progress is recorded yet; it is not a performance-based forecast. `;
  }
  if (dataQuality.progressStatusConflict) {
    reply += `The project status is completed, but its progress field is below 100%, so confirm that status before treating this as final. `;
  }
  reply += followUp;
  return reply;
}

function computeMarginAtProgress({ contract = 0, spent = 0, estimatedCost = 0, currentProgressPct = 0, targetProgressPct = 0 } = {}) {
  const progressPct = Math.max(0.1, Math.min(99, Number(currentProgressPct || 0)));
  const targetPct = Math.max(1, Math.min(99, Number(targetProgressPct || 0)));
  const spendAtTarget = progressPct > 0 ? spent * (targetPct / progressPct) : (estimatedCost * (targetPct / 100));
  const profitAtTarget = contract - spendAtTarget;
  const marginAtTarget = contract > 0 ? (profitAtTarget / contract) * 100 : 0;
  const projectedFinalCost = progressPct > 5 && spent > 0 ? spent / (progressPct / 100) : estimatedCost;
  const marginAtCompletion = contract > 0 ? ((contract - projectedFinalCost) / contract) * 100 : 0;
  return {
    targetProgressPct: targetPct,
    spendAtTarget,
    profitAtTarget,
    marginAtTarget,
    projectedFinalCost,
    marginAtCompletion,
  };
}

function buildMarginAtProgressReply({ targetProgressPct, profitAtTarget, marginAtTarget, marginAtCompletion, followUp = 'Want me to run a what-if scenario to pressure-test this?' } = {}) {
  let reply = `At **${targetProgressPct}% complete** (${100 - targetProgressPct}% timeline left), your **margin** would be approximately **${Number(marginAtTarget).toFixed(1)}%** (profit: $${Math.round(profitAtTarget).toLocaleString()}). `;
  reply += `This assumes spend scales linearly with progress. Your current projection at completion is ${Number(marginAtCompletion).toFixed(1)}% margin. `;
  reply += followUp;
  return reply;
}

function buildMarginReplyForProject(project, opts = {}) {
  const {
    parsedContext = {},
    isCurrent = false,
    followUp = '➡️ Want me to check your PO commitments or anything else?',
    progressOverride = null,
  } = opts;
  if (!project) return null;

  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrent ? parsedContext : {},
    progressOverride,
  });

  const projectedProfit = isCurrent && typeof parsedContext.projectedProfit === 'number' && Number.isFinite(parsedContext.projectedProfit)
    ? Math.round(parsedContext.projectedProfit)
    : (snapshot.projectedProfit != null && Number.isFinite(snapshot.projectedProfit) ? Math.round(snapshot.projectedProfit) : null);

  const projectStatus = normalizeProjectStatus(project?.status || parsedContext?.status);
  const finished = snapshot.forecastMethod === 'completed' || isTerminalProjectStatus(projectStatus);
  if (finished && snapshot.revenue > 0 && projectedProfit != null) {
    return {
      snapshot,
      reply: formatFinishedJobMarginReply({
        title: project?.title || project?.name || 'This project',
        revenue: snapshot.revenue,
        spent: snapshot.revenue - projectedProfit,
        profit: projectedProfit,
      }),
    };
  }

  const noSpendYet = snapshot.spent == null || Number(snapshot.spent) <= 0;
  const originalEstPct = snapshot.originalEstimateMarginPct != null
    ? snapshot.originalEstimateMarginPct
    : snapshot.bidMarginPct;
  return {
    snapshot,
    reply: formatMarginReply({
      spendToDatePct: noSpendYet ? null : snapshot.spendToDateMarginPct,
      projectedPct: snapshot.projectedMarginPct,
      originalEstPct,
      projectedProfit,
      followUp,
    }),
  };
}

function normalizeProjectSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rankProjectsByQuery(projects = [], rawQuery = '') {
  const searchName = normalizeProjectSearchText(rawQuery);
  const searchTokens = searchName.split(/\s+/).filter(Boolean);
  if (!searchName || !Array.isArray(projects) || projects.length === 0) return [];

  return projects
    .map((project) => {
      const title = normalizeProjectSearchText(project?.title || project?.name || '');
      const customer = normalizeProjectSearchText(project?.customerName || project?.client || '');
      const locationText = normalizeProjectSearchText(project?.location || '');
      const corpus = [title, customer, locationText].filter(Boolean).join(' ').trim();
      const corpusTokens = corpus.split(/\s+/).filter(Boolean);
      let score = 0;
      if (!corpus) return { project, score, title };

      if (title === searchName || customer === searchName) score += 100;
      if (title && (title.startsWith(`${searchName} `) || title.endsWith(` ${searchName}`) || title.includes(` ${searchName} `))) score += 70;
      if (customer && (customer.startsWith(`${searchName} `) || customer.endsWith(` ${searchName}`) || customer.includes(` ${searchName} `))) score += 55;
      if (title.includes(searchName) || customer.includes(searchName)) score += 40;
      if (searchName.includes(title) && title.length > 3) score += 25;

      const tokenMatches = searchTokens.filter((token) =>
        corpusTokens.some((corpusToken) => corpusToken === token || corpusToken.includes(token) || token.includes(corpusToken))
      ).length;
      if (searchTokens.length > 0) {
        score += Math.round((tokenMatches / searchTokens.length) * 45);
      }
      if (locationText && searchTokens.some((token) => locationText.includes(token))) score += 12;

      return { project, score, title };
    })
    .sort((a, b) => b.score - a.score);
}

function resolveProjectByQuery(projects = [], rawQuery = '', opts = {}) {
  const { minScore = 40, ambiguityGap = 12 } = opts;
  const ranked = rankProjectsByQuery(projects, rawQuery);
  const best = ranked[0];
  const second = ranked[1];
  const confidence = Math.max(0, Math.min(1, (best?.score || 0) / 100));
  const lowConfidence = !best || best.score < minScore || (second && (best.score - second.score) < ambiguityGap);
  return {
    ranked,
    best,
    second,
    confidence,
    lowConfidence,
    project: !lowConfidence && best ? best.project : null,
  };
}

function isCurrentProjectMatch(project, parsedContext = {}) {
  if (!project) return false;
  if (parsedContext?.projectId && String(project?.id) === String(parsedContext.projectId)) return true;
  const currentName = normalizeProjectSearchText(parsedContext?.currentProject || parsedContext?.projectName || '');
  const projectName = normalizeProjectSearchText(project?.title || project?.name || '');
  return !!currentName && !!projectName && currentName === projectName;
}

function collectPaymentBuckets({ parsedContext = {}, projects = [], currentProject = null, now = new Date(), currentProjectIsCompleted = false } = {}) {
  const upcoming = [];
  const overdue = [];
  const unscheduled = [];
  const collected = [];
  let collectedCount = 0;
  const currentProjectId = currentProject?.id != null ? String(currentProject.id) : null;

  const addPaymentsFromProject = (project, milestonesList, opts = {}) => {
    if (!project) return;
    const title = project?.title || project?.name || 'Project';
    const projectIsCompleted = opts.projectIsCompleted === true;
    const rawMilestones = Array.isArray(milestonesList) ? milestonesList : [];
    rawMilestones.forEach((milestone) => {
      if (isPaymentCollectedForAI(milestone, { projectIsCompleted })) {
        collectedCount += 1;
        if (opts.includeCollected !== false) {
          collected.push({
            projectId: project?.id,
            projectTitle: title,
            name: milestone?.title || milestone?.name || 'Payment',
            amount: normalizeMoneyValue(milestone?.amount ?? milestone?.paymentAmount ?? 0),
            date: getPaymentDateValue(milestone),
          });
        }
        return;
      }
      const date = getPaymentDateValue(milestone);
      const dateMs = date ? new Date(date).getTime() : NaN;
      const item = {
        projectId: project?.id,
        projectTitle: title,
        name: milestone?.title || milestone?.name || 'Payment',
        amount: normalizeMoneyValue(milestone?.amount ?? milestone?.paymentAmount ?? 0),
        date,
        dateMs,
      };
      if (Number.isFinite(dateMs)) {
        if (dateMs < now.getTime()) overdue.push(item);
        else upcoming.push(item);
      } else {
        unscheduled.push(item);
      }
    });
  };

  const currentTitle = normalizeProjectSearchText(currentProject?.title || currentProject?.name || '');

  if (currentProject) {
    addPaymentsFromProject(
      currentProject,
      getProjectMilestones(currentProject, parsedContext, { preferParsedMilestones: true }),
      { projectIsCompleted: currentProjectIsCompleted, includeCollected: true }
    );
  }

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    if (!project) return;
    if (currentProjectId && String(project?.id ?? '') === currentProjectId) return;
    const otherTitle = normalizeProjectSearchText(project?.title || project?.name || '');
    // An older save with the same name is not a second job.
    if (currentTitle && otherTitle && otherTitle === currentTitle) return;
    const status = String(project?.status || project?.projectData?.status || '').toLowerCase();
    const projectIsCompleted = status === 'completed' || status === 'done' || status === 'finished';
    addPaymentsFromProject(project, getProjectMilestones(project), {
      projectIsCompleted,
      includeCollected: !currentProject,
    });
  });

  upcoming.sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
  overdue.sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
  return { upcoming, overdue, unscheduled, collected, collectedCount };
}

/** Health-check payment insights from the same buckets as the payments card. */
function buildHealthPaymentInsights(project, { parsedContext = {}, now = new Date() } = {}) {
  if (!project) return { overdueLine: null, nextLine: null };
  const buckets = collectPaymentBuckets({ parsedContext, projects: [], currentProject: project, now });
  const money = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
  let overdueLine = null;
  if (buckets.overdue.length === 1) {
    const late = buckets.overdue[0];
    const when = formatPaymentWhen(late);
    overdueLine = `${late.name} (${money(late.amount)}) is overdue${when ? `, it was due ${when}` : ''}. Follow up with the client.`;
  } else if (buckets.overdue.length > 1) {
    const total = buckets.overdue.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const names = buckets.overdue.map((payment) => payment.name);
    const list = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    overdueLine = `${buckets.overdue.length} payments are overdue (${money(total)}): ${list}. Follow up with the client.`;
  }
  const next = buckets.upcoming[0];
  const nextWhen = next ? formatPaymentWhen(next) : '';
  const nextLine = next
    ? `Next payment: ${next.name}, ${money(next.amount)}${nextWhen ? `, due ${nextWhen}` : ''}.`
    : null;
  return { overdueLine, nextLine };
}

/** One Today's Brief line for a job's overdue payments, or null when nothing is overdue. */
function overduePaymentBriefLine(project, now = new Date()) {
  if (!project) return null;
  const title = project?.title || project?.name || 'Project';
  const overdue = getProjectMilestones(project).filter((milestone) => {
    if (isPaymentCollectedForAI(milestone)) return false;
    const raw = getPaymentDateValue(milestone);
    if (!raw) return false;
    const dateOnly = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    const due = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(raw);
    return Number.isFinite(due.getTime()) && due < now;
  });
  if (overdue.length === 0) return null;
  if (overdue.length === 1) {
    return `${overdue[0]?.title || overdue[0]?.name || 'A payment'} is overdue on ${title}`;
  }
  const total = overdue.reduce(
    (sum, milestone) => sum + normalizeMoneyValue(milestone?.amount ?? milestone?.paymentAmount ?? 0),
    0
  );
  return `${overdue.length} payments are overdue on ${title} ($${Math.round(total).toLocaleString()})`;
}

function formatPaymentWhen(payment) {
  if (!payment?.date) return '';
  const raw = payment.date instanceof Date ? '' : String(payment.date);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : (payment.date instanceof Date ? payment.date : new Date(payment.date));
  if (Number.isNaN(parsed.getTime())) return String(payment.date);
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildPaymentStatusReply({
  upcoming = [],
  overdue = [],
  unscheduled = [],
  collected = [],
  collectedCount = 0,
  finished = false,
  fallbackProjectName = 'your project',
} = {}) {
  const owed = [
    ...overdue.map((payment) => ({ ...payment, kind: 'overdue' })),
    ...upcoming.map((payment) => ({ ...payment, kind: 'upcoming' })),
    ...unscheduled.map((payment) => ({ ...payment, kind: 'unscheduled' })),
  ];
  const received = Array.isArray(collected) ? collected.filter((payment) => Number(payment?.amount || 0) > 0) : [];
  const receivedBlock = received.length
    ? [
      'Already received:',
      '',
      ...received.map((payment) => {
        const amount = `$${Math.round(Number(payment.amount || 0)).toLocaleString()}`;
        const where = payment.projectTitle ? ` on ${payment.projectTitle}` : '';
        return `• **${payment.name}** — ${amount}${where}, received`;
      }),
    ]
    : [];
  if (owed.length > 0) {
    const lines = owed.map((payment) => {
      const amount = `$${Math.round(Number(payment.amount || 0)).toLocaleString()}`;
      const when = formatPaymentWhen(payment);
      const timing = payment.kind === 'overdue'
        ? (when ? `overdue, was due ${when}` : 'overdue')
        : payment.kind === 'unscheduled'
          ? 'no date set'
          : (when ? `due ${when}` : 'no date set');
      const where = payment.projectTitle ? ` on ${payment.projectTitle}` : '';
      return `• **${payment.name}** — ${amount}${where}, ${timing}`;
    });
    const lead = overdue.length > 0
      ? 'You have overdue payments still left to collect:'
      : (owed.length === 1 ? '1 payment is still left to collect:' : `${owed.length} payments are still left to collect:`);
    return [...receivedBlock, ...(receivedBlock.length ? [''] : []), lead, '', ...lines].join('\n');
  }
  if (finished || collectedCount > 0) {
    return `You've received all payments on **${fallbackProjectName}**. Nothing is left to collect.`;
  }
  return `Payments are managed in the Timeline tab (${fallbackProjectName}). Open the project → Timeline to add or edit payment milestones and due dates.`;
}

function paymentMoney(amount) {
  return `$${Math.round(Number(amount || 0)).toLocaleString()}`;
}

function buildCollectedTotalReply(buckets, projectName) {
  const received = (buckets?.collected || []).filter((payment) => Number(payment?.amount || 0) > 0);
  if (received.length === 0) return `Nothing has been collected on **${projectName}** yet.`;
  const total = received.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const lines = received.map((payment) => `• **${payment.name}** — ${paymentMoney(payment.amount)}, received`);
  return [`You've collected **${paymentMoney(total)}** on **${projectName}**.`, '', ...lines].join('\n');
}

function buildIncomingTotalReply(buckets, projectName) {
  const overdue = buckets?.overdue || [];
  const upcoming = buckets?.upcoming || [];
  const unscheduled = buckets?.unscheduled || [];
  const owed = [...overdue, ...upcoming, ...unscheduled];
  if (owed.length === 0) return `Nothing is still coming in on **${projectName}**.`;
  const total = owed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const lines = owed.map((payment) => {
    const when = formatPaymentWhen(payment);
    const late = overdue.includes(payment);
    const timing = late
      ? (when ? `overdue, was due ${when}` : 'overdue')
      : (when ? `due ${when}` : 'no date set');
    return `• **${payment.name}** — ${paymentMoney(payment.amount)}, ${timing}`;
  });
  return [`**${paymentMoney(total)}** is still coming in on **${projectName}**.`, '', ...lines].join('\n');
}

function buildWorryReply(projects = [], { now = new Date() } = {}) {
  const source = (Array.isArray(projects) ? projects : []).filter(Boolean);
  const active = source.filter((project) => {
    const status = String(project?.status || project?.projectData?.status || '').toLowerCase();
    return !['completed', 'complete', 'closed', 'done', 'finished'].includes(status);
  });
  const list = active.length ? active : source;
  const rows = list.map((project) => {
    const buckets = collectPaymentBuckets({ projects: [], currentProject: project, now });
    const overdueTotal = buckets.overdue.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const snapshot = getProjectFinancialSnapshot({ project, parsedContext: {} });
    return {
      title: project?.title || project?.name || 'Project',
      overdue: buckets.overdue,
      overdueTotal,
      margin: snapshot.projectedMarginPct,
    };
  });
  rows.sort((a, b) => b.overdueTotal - a.overdueTotal || (Number(a.margin) || 99) - (Number(b.margin) || 99));
  const top = rows[0];
  if (!top) return 'No active jobs to compare yet.';
  if (top.overdueTotal > 0) {
    const names = top.overdue.map((payment) => payment.name);
    const listText = names.length === 2 ? names.join(' and ') : names.join(', ');
    const count = top.overdue.length === 1 ? '1 payment is' : `${top.overdue.length} payments are`;
    return `**${top.title}**. ${count} overdue (${paymentMoney(top.overdueTotal)}): ${listText}. That is the job to follow up on first.`;
  }
  if (top.margin != null && Number(top.margin) < 15) {
    return `**${top.title}**, because its margin is ${Number(top.margin).toFixed(1)}%, the thinnest of the active jobs.`;
  }
  return `Nothing stands out. **${top.title}** has no overdue payments.`;
}

function unknownFutureCostReply(message, project) {
  const match = String(message || '').match(/\bwhat\s+(?:will|would|does)\s+(?:the\s+|an\s+|a\s+)?([a-z][\w\s-]{1,40}?)\s+cost\b/i);
  if (!match) return null;
  const subject = match[1].trim();
  if (/^(?:labor|labour|materials?|this|it|the job|the project|my job|my project)$/i.test(subject)) return null;
  const title = project?.title || project?.name;
  const label = subject.charAt(0).toUpperCase() + subject.slice(1);
  const where = title ? ` on **${title}**` : '';
  return `I don't have a cost for ${label}${where}. I won't guess one.`;
}

function buildRemainingBudgetReply({ projectName = 'This project', snapshot = {} } = {}) {
  if (!(snapshot.estimatedCost > 0) || snapshot.spent == null) return null;
  const spent = Number(snapshot.spent);
  const budget = Number(snapshot.estimatedCost);
  const money = (amount) => `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const usedPct = budget > 0 ? (spent / budget) * 100 : 0;
  if (snapshot.forecastMethod === 'completed') {
    const unused = budget - spent;
    const varianceLabel = Math.abs(unused) < 1
      ? 'On budget'
      : unused > 0
        ? 'Finished under budget'
        : 'Finished over budget';
    const varianceValue = Math.abs(unused) < 1 ? '$0.00' : money(Math.abs(unused));
    return [
      `**Cost budget — ${projectName}** · Completed`,
      '',
      `- **Cost budget:** ${money(budget)}`,
      `- **Spent:** ${money(spent)}`,
      `- **${varianceLabel}:** ${varianceValue}`,
      `- **Budget used:** ${usedPct.toFixed(1)}%`,
      '',
      'This job is finished, so this is the actual result.',
    ].join('\n');
  }
  const remaining = Number(snapshot.remainingCostBudget ?? Math.max(0, budget - spent));
  return [
    `**Remaining cost budget for ${projectName}**`,
    '',
    `- **Cost budget:** ${money(budget)}`,
    `- **Spent to date:** ${money(spent)}`,
    `- **Remaining:** **${money(remaining)}**`,
    `- **Budget used:** ${usedPct.toFixed(1)}%`,
  ].join('\n');
}

function buildBudgetStatusReply({ projectName = 'This project', budget = 0, spent = 0, finished = false } = {}) {
  if (!(budget > 0)) return null;
  const overBy = spent - budget;
  const spentText = `$${Math.round(spent).toLocaleString()}`;
  const budgetText = `$${Math.round(budget).toLocaleString()}`;
  let reply;
  if (finished && overBy > 0) {
    reply = `Yes — **${projectName}** finished **$${Math.round(overBy).toLocaleString()} over budget** (spent ${spentText} of ${budgetText}).`;
  } else if (finished) {
    reply = `No — **${projectName}** finished under budget (spent ${spentText} of ${budgetText}).`;
  } else if (overBy > 0) {
    reply = `Yes — **${projectName}** is **$${Math.round(overBy).toLocaleString()} over budget** (spent ${spentText} of ${budgetText} budget).`;
  } else {
    const remaining = budget - spent;
    reply = `No — you're within budget for **${projectName}** (spent ${spentText} of ${budgetText}, **$${Math.round(remaining).toLocaleString()}** remaining).`;
  }
  if (!finished) reply += `\n\n➡️ Want me to check margin or PO commitments?`;
  return reply;
}

function buildPortfolioLosingMoneyReply(projects = [], parsedContext = {}) {
  const rows = (Array.isArray(projects) ? projects : [])
    .filter(Boolean)
    .map((project) => analyzePortfolioProject(project, { parsedContext }));
  const money = (n) => {
    const amount = Number(n || 0);
    const formatted = Math.abs(Math.round(amount)).toLocaleString();
    return amount < 0 ? `-$${formatted}` : `$${formatted}`;
  };
  const losing = rows.filter((row) => Number(row.projectedProfit) < 0);
  if (rows.length === 0) return 'No projects in this view yet.';
  if (losing.length === 0) {
    const finished = rows.filter((row) => row.isCompleted);
    if (finished.length === rows.length) {
      const net = finished.reduce((sum, row) => sum + Number(row.projectedProfit || 0), 0);
      const job = finished.length === 1
        ? `**${finished[0].title}** is finished with **${money(finished[0].projectedProfit)}** net profit.`
        : `${finished.length} finished jobs, with **${money(net)}** net profit.`;
      return `None of your jobs are losing money. ${job}`;
    }
    return 'None of your jobs are losing money.';
  }
  const lines = losing.map((row) => `• **${row.title}** — ${row.profitLabel || 'Profit'} ${money(row.projectedProfit)}`);
  return [`${losing.length === 1 ? '1 job is' : `${losing.length} jobs are`} losing money:`, '', ...lines].join('\n');
}

function createProfitLeak({
  projectId = null,
  projectTitle = 'Project',
  type,
  severity = 'medium',
  impactEstimate = 0,
  headline,
  body,
  evidence = [],
  recommendedAction = null,
}) {
  return {
    id: `${type}-${projectId || 'portfolio'}`,
    type,
    severity,
    impactEstimate: Math.round(Number(impactEstimate || 0)),
    headline,
    body,
    evidence: Array.isArray(evidence) ? evidence.filter(Boolean).slice(0, 3) : [],
    recommendedAction,
    projectId: projectId != null ? String(projectId) : null,
    projectTitle,
  };
}

function buildProjectProfitLeaks(project, snapshot = {}, opts = {}) {
  const {
    overdueItems = [],
    overduePayments = [],
    missingReceipts = 0,
  } = opts;

  const title = project?.title || project?.name || 'Untitled Project';
  const projectId = project?.id != null ? String(project.id) : null;
  const status = String(project?.status || '').toLowerCase();
  const isEstimate =
    status === 'estimate' ||
    status === 'draft' ||
    status === 'submitted' ||
    status === 'bid_submitted';
  const isCompleted =
    status === 'completed' ||
    status === 'done' ||
    status === 'finished' ||
    Number(snapshot.progress || 0) >= 100;

  const leaks = [];
  const revenue = Number(snapshot.revenue || 0);
  const budget = Number(snapshot.estimatedCost || 0);
  const spent = Number(snapshot.spent || 0);
  const progress = Number(snapshot.progress || 0);
  const expectedSpend = budget > 0 ? budget * (Math.max(0, Math.min(100, progress)) / 100) : 0;
  const spendAheadBy = Math.max(0, spent - expectedSpend);
  const projectedMarginPct = Number(snapshot.projectedMarginPct || 0);
  const bidMarginPct = Number(snapshot.bidMarginPct || 0);
  const marginDrop = bidMarginPct > 0 && projectedMarginPct > 0 ? (bidMarginPct - projectedMarginPct) : 0;
  const overdueAmount = (Array.isArray(overduePayments) ? overduePayments : []).reduce(
    (sum, item) => sum + normalizeMoneyValue(item?.amount ?? 0),
    0
  );
  const overBudgetBy = Math.max(0, spent - budget);

  if (!isCompleted && progress > 0 && budget > 0 && spendAheadBy > Math.max(1000, budget * 0.08)) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'spend_ahead_of_progress',
      severity: spendAheadBy > budget * 0.15 ? 'high' : 'medium',
      impactEstimate: spendAheadBy,
      headline: `Spend is ahead of progress on ${title}`,
      body: `${title} is ${Math.round((spent / budget) * 100)}% spent at ${Math.round(progress)}% progress. That usually means margin is leaking before the job is complete.`,
      evidence: [
        `Spent: $${Math.round(spent).toLocaleString()} of $${Math.round(budget).toLocaleString()} budget`,
        `Progress: ${Math.round(progress)}%`,
        `Spend ahead by about $${Math.round(spendAheadBy).toLocaleString()}`,
      ],
      recommendedAction: {
        label: `Review cost burn on ${title}`,
        chip: 'Protect margin',
        priority: spendAheadBy > budget * 0.15 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && budget > 0 && spent > budget) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'over_budget',
      severity: overBudgetBy > budget * 0.1 ? 'high' : 'medium',
      impactEstimate: overBudgetBy,
      headline: `${title} is over budget`,
      body: `${title} has already spent more than the current estimate allows. Without correction, projected profit will keep shrinking.`,
      evidence: [
        `Budget: $${Math.round(budget).toLocaleString()}`,
        `Spent: $${Math.round(spent).toLocaleString()}`,
        `Over by about $${Math.round(overBudgetBy).toLocaleString()}`,
      ],
      recommendedAction: {
        label: `Inspect overruns on ${title}`,
        chip: 'Urgent review',
        priority: overBudgetBy > budget * 0.1 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && bidMarginPct > 0 && projectedMarginPct > 0 && marginDrop >= 5) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'margin_erosion',
      severity: marginDrop >= 10 ? 'high' : 'medium',
      impactEstimate: revenue > 0 ? revenue * (marginDrop / 100) : 0,
      headline: `Margin is eroding on ${title}`,
      body: `${title} started around ${bidMarginPct.toFixed(1)}% margin and is now projecting closer to ${projectedMarginPct.toFixed(1)}%.`,
      evidence: [
        `Original margin: ${bidMarginPct.toFixed(1)}%`,
        `Projected margin: ${projectedMarginPct.toFixed(1)}%`,
        `Margin drop: ${marginDrop.toFixed(1)} pts`,
      ],
      recommendedAction: {
        label: `Recover margin on ${title}`,
        chip: 'High impact',
        priority: marginDrop >= 10 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && Array.isArray(overdueItems) && overdueItems.length > 0) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'overdue_collection',
      severity: overdueAmount >= 5000 ? 'high' : 'medium',
      impactEstimate: overdueAmount,
      headline: `Collections are overdue on ${title}`,
      body: `${title} has ${overdueItems.length} overdue payment${overdueItems.length > 1 ? 's' : ''}. Slow collections increase cash pressure even when the job is profitable on paper.`,
      evidence: [
        `${overdueItems.length} overdue payment${overdueItems.length > 1 ? 's' : ''}`,
        overdueAmount > 0 ? `About $${Math.round(overdueAmount).toLocaleString()} is past due` : null,
      ],
      recommendedAction: {
        label: `Follow up on payment for ${title}`,
        chip: 'Improve cash flow',
        priority: overdueAmount >= 5000 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && missingReceipts >= 3) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'missing_receipts',
      severity: missingReceipts >= 6 ? 'medium' : 'low',
      impactEstimate: missingReceipts,
      headline: `${title} has missing cost backup`,
      body: `${title} is missing receipts on ${missingReceipts} expense${missingReceipts > 1 ? 's' : ''}. That makes job costing less trustworthy and can hide profit leaks.`,
      evidence: [
        `${missingReceipts} expenses missing receipts`,
      ],
      recommendedAction: {
        label: `Upload receipts for ${title}`,
        chip: '5 min',
        priority: missingReceipts >= 6 ? 'medium' : 'low',
      },
    }));
  }

  if (isEstimate && revenue >= 20000 && progress === 0) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'stale_high_value_estimate',
      severity: revenue >= 50000 ? 'medium' : 'low',
      impactEstimate: revenue,
      headline: `High-value estimate is sitting idle: ${title}`,
      body: `${title} is a high-value estimate with no progress yet. Unfollowed estimates are revenue leaks, not just pipeline noise.`,
      evidence: [
        `Estimate value: $${Math.round(revenue).toLocaleString()}`,
        `Progress: 0%`,
      ],
      recommendedAction: {
        label: `Follow up on ${title}`,
        chip: 'New revenue',
        priority: revenue >= 50000 ? 'high' : 'medium',
      },
    }));
  }

  return leaks.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    const sevDiff = (sev[b.severity] || 0) - (sev[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    return Number(b.impactEstimate || 0) - Number(a.impactEstimate || 0);
  });
}

function buildDailyCommandCenter(items = [], opts = {}) {
  const upcomingScheduleItems = Array.isArray(opts.upcomingScheduleItems) ? opts.upcomingScheduleItems : [];
  const safeItems = Array.isArray(items) ? items : [];
  const leaks = safeItems.flatMap((item) => Array.isArray(item?.profitLeaks) ? item.profitLeaks : []);
  const topProfitRisks = [...leaks]
    .sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      const sevDiff = (sev[b.severity] || 0) - (sev[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;
      return Number(b.impactEstimate || 0) - Number(a.impactEstimate || 0);
    })
    .slice(0, 5);

  const topActions = [];
  const seenActionLabels = new Set();
  for (const leak of topProfitRisks) {
    const action = leak?.recommendedAction;
    if (!action?.label) continue;
    const key = String(action.label).trim().toLowerCase();
    if (seenActionLabels.has(key)) continue;
    seenActionLabels.add(key);
    topActions.push({
      id: `daily-action-${topActions.length + 1}`,
      label: action.label,
      chip: action.chip || 'Today',
      projectId: leak.projectId || null,
      priority: action.priority || (leak.severity === 'high' ? 'high' : 'medium'),
    });
  }

  const allUpcomingPayments = safeItems
    .flatMap((item) => (Array.isArray(item?.upcomingPayments) ? item.upcomingPayments.map((payment) => ({
      ...payment,
      projectId: item.projectId,
      projectTitle: item.title,
    })) : []))
    .sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b?.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    })
    .slice(0, 5);

  const allUnscheduledPayments = safeItems
    .flatMap((item) => (Array.isArray(item?.unscheduledPayments) ? item.unscheduledPayments.map((payment) => ({
      ...payment,
      projectId: item.projectId,
      projectTitle: item.title,
    })) : []))
    .slice(0, 5);

  const activeItems = safeItems.filter((item) =>
    isActiveProjectStatus(resolveProjectStatus(item)) && Number(item?.progress || 0) < 100
  );
  const uniqueKeys = (items) =>
    items
      .map((item) => {
        const id = String(item?.projectId ?? '').trim();
        if (id) return `id:${id}`;
        const t = String(item?.title || '').trim().toLowerCase();
        return t ? `t:${t}` : '';
      })
      .filter(Boolean);
  const activeProjectCount = new Set(uniqueKeys(activeItems)).size;
  const totalProjectCount = new Set(uniqueKeys(safeItems)).size;
  const projectsWithProfit = activeItems.filter((item) => item?.projectedProfit != null);
  const totalProjectedProfit = projectsWithProfit.reduce((sum, item) => sum + Number(item.projectedProfit), 0);
  const activeRevenue = activeItems.reduce((sum, item) => sum + Number(item?.revenue || 0), 0);
  const averageMargin = activeRevenue > 0 ? (totalProjectedProfit / activeRevenue) * 100 : null;

  return {
    topProfitRisks,
    topActions,
    upcomingPayments: allUpcomingPayments,
    unscheduledPayments: allUnscheduledPayments,
    upcomingScheduleItems: upcomingScheduleItems.slice(0, 5),
    portfolioSummary: {
      activeProjectCount,
      totalProjectCount,
      totalProjectedProfit: Math.round(totalProjectedProfit),
      averageMargin: averageMargin == null ? null : Math.round(averageMargin * 10) / 10,
      forecastCoverage: activeItems.length > 0 ? projectsWithProfit.length / activeItems.length : 0,
      highestRiskProject: topProfitRisks[0]?.projectTitle || null,
    },
  };
}

function buildProfitLeakPromptBlock({ topProfitRisks = [], topActions = [] } = {}) {
  const risks = Array.isArray(topProfitRisks) ? topProfitRisks.slice(0, 5) : [];
  const actions = Array.isArray(topActions) ? topActions.slice(0, 5) : [];
  if (risks.length === 0 && actions.length === 0) return '';
  const riskLines = risks.map((risk, index) => {
    const impact = risk?.impactEstimate ? ` | impact≈$${Math.round(risk.impactEstimate).toLocaleString()}` : '';
    return `${index + 1}. ${risk.headline}${impact}${risk.projectTitle ? ` | project=${risk.projectTitle}` : ''}`;
  });
  const actionLines = actions.map((action, index) => `${index + 1}. ${action.label}${action.chip ? ` | ${action.chip}` : ''}`);
  return `\n\n📉 PROFIT LEAK SNAPSHOT (source of truth — use these before improvising)\n${riskLines.length ? riskLines.join('\n') : 'No major profit leaks detected right now.'}\n${actionLines.length ? `\nTOP ACTIONS:\n${actionLines.join('\n')}` : ''}\n→ When asked where profit is leaking, answer from this block first.\n→ Use direct answer -> evidence -> recommended action.`;
}

function analyzePortfolioProject(project, opts = {}) {
  const {
    parsedContext = {},
    progressOverride = null,
    compareItem = null,
    now = new Date(),
  } = opts;
  const title = project?.title || project?.name || 'Untitled Project';
  const financials = getProjectFinancialSnapshot({ project, parsedContext, progressOverride });
  const budget = financials.estimatedCost;
  const spent = financials.spent;
  const revenue = financials.revenue;
  const estimatedMarginPct = financials.bidMarginPct;
  const progress = financials.progress;
  const projectStatus = String(project?.status || '').toLowerCase();
  const isCompletedProject = isTerminalProjectStatus(projectStatus) || progress >= 100;
  const paymentBuckets = collectPaymentBuckets({
    projects: [],
    currentProject: project,
    now,
    currentProjectIsCompleted: isCompletedProject,
  });
  const overdueItems = paymentBuckets.overdue;
  const upcomingPayments = paymentBuckets.upcoming.map((item) => ({
    name: item.name,
    amount: normalizeMoneyValue(item.amount ?? 0),
    date: item.date,
  }));
  const unscheduledPayments = paymentBuckets.unscheduled.map((item) => ({
    name: item.name,
    amount: normalizeMoneyValue(item.amount ?? 0),
    date: null,
  }));
  const overBudgetPct = budget > 0 && spent != null ? ((spent - budget) / budget) * 100 : null;
  const projectedFinalCost = financials.projectedFinalCost;
  const projectedProfit = financials.projectedProfit;
  const projectedMarginPct = financials.projectedMarginPct;
  const estimatedProfit = revenue > 0 && budget != null ? revenue - budget : null;
  const hasRealSpend = spent != null && spent > 0;
  const displayMargin = isCompletedProject && projectedMarginPct != null
    ? projectedMarginPct
    : hasRealSpend
      ? (financials.currentMarginPct != null ? financials.currentMarginPct : projectedMarginPct)
      : (compareItem?.margin != null && Number.isFinite(compareItem.margin))
        ? Number(compareItem.margin)
        : estimatedMarginPct;
  const missingReceipts = countMissingReceipts(project, parsedContext);
  const profitLeaks = buildProjectProfitLeaks(project, financials, {
    overdueItems,
    overduePayments: overdueItems.map((item) => ({ name: item.name || 'Payment', amount: normalizeMoneyValue(item.amount ?? 0), date: item.date || null })),
    missingReceipts,
  });
  const riskFlags = [...new Set([
    ...(displayMargin > 0 && displayMargin < 10 ? ['low_margin'] : []),
    ...profitLeaks.map((leak) => leak.type === 'overdue_collection' ? 'overdue_milestones' : leak.type),
  ])];

  const marginRounded = Math.round(displayMargin * 10) / 10;
  return {
    projectId: project?.id,
    title,
    status: project?.status || 'unknown',
    margin: marginRounded,
    currentMargin: marginRounded,
    marginLabel: isCompletedProject
      ? 'Margin'
      : financials.dataQuality?.estimateOnlyForecast
        ? 'Estimated margin'
        : 'Current margin',
    profitLabel: isCompletedProject ? 'Net profit' : 'Projected profit',
    isCompleted: isCompletedProject,
    spent,
    budget,
    revenue,
    committedPOs: financials.committedPOs,
    overBudgetPct: overBudgetPct == null ? null : Math.round(overBudgetPct * 10) / 10,
    progress: Math.round(progress),
    overdueItems: overdueItems.length,
    overduePayments: overdueItems.map((item) => ({ name: item.name || 'Payment', amount: normalizeMoneyValue(item.amount ?? 0), date: item.date || null })),
    upcomingPayments,
    unscheduledPayments,
    projectedFinalCost: projectedFinalCost == null ? null : Math.round(projectedFinalCost),
    estimatedProfit: estimatedProfit == null ? null : Math.round(estimatedProfit),
    projectedProfit: projectedProfit == null ? null : Math.round(projectedProfit),
    projectedMarginPct: projectedMarginPct == null ? null : Math.round(projectedMarginPct * 10) / 10,
    missingReceipts,
    riskFlags,
    profitLeaks,
  };
}

function buildPortfolioComparisonReply(data = []) {
  const safeData = Array.isArray(data) ? data : [];
  const getStatus = (item) => resolveProjectStatus(item);
  const isCompleted = (item) => isTerminalProjectStatus(getStatus(item)) || Number(item?.progress || 0) >= 100;
  const isActive = (item) => isActiveProjectStatus(getStatus(item)) && !isCompleted(item);
  const activeData = safeData.filter(isActive);
  const completedData = safeData.filter(isCompleted);
  const totalRevenue = safeData.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const projectedProfitActive = activeData.reduce((sum, item) => sum + Number(item.projectedProfit || 0), 0);
  const netProfitCompleted = completedData.reduce((sum, item) => sum + Number(item.projectedProfit || 0), 0);
  // Active jobs show the margin at completion so it agrees with projected profit on the same card.
  const shownMargin = (item) => {
    if (!isCompleted(item) && item.projectedMarginPct != null && Number.isFinite(Number(item.projectedMarginPct))) {
      return Math.round(Number(item.projectedMarginPct) * 10) / 10;
    }
    return Number(item.margin || 0);
  };
  const highestMargin = safeData.reduce((best, item) => (best == null || shownMargin(item) > shownMargin(best) ? item : best), null);
  const highestProfit = safeData.reduce((best, item) => (best == null || Number(item.projectedProfit || 0) > Number(best.projectedProfit || 0) ? item : best), null);
  // Current attention is scoped to active work. Completed projects remain useful for historical comparison.
  const needsAttention = activeData.filter((item) => item.missingReceipts > 0 || (Array.isArray(item.riskFlags) && item.riskFlags.length > 0));
  const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => (Number(n) < 0 ? `-$${fmt(Math.abs(Number(n)))}` : `$${fmt(n || 0)}`);
  const highestProfitLabel = highestProfit && isCompleted(highestProfit) ? 'net profit' : 'projected profit';

  let summary = '';
  if (safeData.length > 1 && highestMargin && highestProfit) {
    const sameProject = highestMargin.title === highestProfit.title;
    if (sameProject) {
      summary += `${highestMargin.title} has the highest margin (${shownMargin(highestMargin)}%) and highest ${highestProfitLabel} (${money(highestProfit.projectedProfit)})`;
    } else {
      summary += `${highestMargin.title} has the highest margin (${shownMargin(highestMargin)}%); ${highestProfit.title} has the highest ${highestProfitLabel} (${money(highestProfit.projectedProfit)})`;
    }
  }

  if (needsAttention.length > 0) {
    const receiptOnly = needsAttention.filter((item) => item.missingReceipts > 0).length === needsAttention.length &&
      needsAttention.every((item) => !Array.isArray(item.riskFlags) || item.riskFlags.length === 0 || (item.riskFlags.length === 1 && item.riskFlags[0] === 'missing_receipts'));
    if (needsAttention.length === activeData.length && receiptOnly) {
      summary += summary ? '. All projects need attention for missing receipts' : 'All projects need attention for missing receipts';
    } else {
      const names = needsAttention.map((item) => item.title).join(', ');
      summary += summary ? `. ${needsAttention.length} project(s) need attention: ${names}` : `${needsAttention.length} project(s) need attention: ${names}`;
    }
  }
  summary = summary ? `${summary}.\n\n` : '';

  const plural = (count, one, many) => (count === 1 ? one : many);
  const scopeLine = activeData.length > 0
    ? `${activeData.length} active ${plural(activeData.length, 'job', 'jobs')}${completedData.length > 0 ? ` and ${completedData.length} finished` : ''}. Attention flags cover active jobs only.`
    : completedData.length > 0
      ? `${completedData.length} finished ${plural(completedData.length, 'job', 'jobs')}, no active jobs.`
      : 'No active jobs yet.';
  let reply = `Here's how your projects compare.\n\n${scopeLine}\n\n${summary}`;
  safeData.forEach((item) => {
    const done = isCompleted(item);
    const riskParts = [];
    if (item.missingReceipts > 0) {
      riskParts.push(`${item.missingReceipts} ${plural(item.missingReceipts, 'bill', 'bills')} missing receipts`);
    }
    if (Array.isArray(item.riskFlags) && item.riskFlags.length > 0) {
      riskParts.push(...item.riskFlags.filter((risk) => risk !== 'missing_receipts').map((risk) => String(risk).replace(/_/g, ' ')));
    }
    const profitLabel = item.profitLabel || (done ? 'Net profit' : 'Projected profit');
    const marginLabel = done
      ? 'Margin'
      : item.projectedMarginPct != null
        ? 'Projected margin'
        : item.marginLabel || 'Current margin';
    const status = getStatus(item);
    const statusLabel = status === 'in_progress'
      ? 'In progress'
      : status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    reply += `**${item.title}**${item.status ? ` · ${statusLabel}` : ''}\n`;
    if (item.revenue != null && item.revenue > 0) reply += `• Revenue: ${money(item.revenue)}\n`;
    reply += `• Spent: ${money(item.spent)}\n`;
    reply += `• ${profitLabel}: ${money(item.projectedProfit)}\n`;
    reply += `• ${marginLabel}: ${shownMargin(item)}%\n`;
    if (!done) {
      if (item.budget != null && Number(item.budget) > 0) reply += `• Cost budget: ${money(item.budget)}\n`;
      if (item.committedPOs != null && item.committedPOs > 0) reply += `• Committed POs: ${money(item.committedPOs)}\n`;
      if (item.budgetUsedPct != null && item.budgetUsedPct > 0) reply += `• Budget used: ${item.budgetUsedPct}%\n`;
      if (item.progress != null) reply += `• Progress: ${Math.round(item.progress)}%\n`;
    }
    reply += `• Risk: ${riskParts.length > 0 ? riskParts.join(', ') : 'None'}\n\n`;
  });

  if (safeData.length > 1) {
    const portfolioParts = [`Revenue ${money(totalRevenue)}`];
    if (netProfitCompleted !== 0) portfolioParts.push(`Net profit (finished) ${money(netProfitCompleted)}`);
    if (projectedProfitActive !== 0) portfolioParts.push(`Projected profit (active) ${money(projectedProfitActive)}`);
    reply += `**All projects** — ${portfolioParts.join(' · ')}\n\n`;
  }
  if (needsAttention.length > 0) {
    const receiptProjects = needsAttention
      .filter((item) => item.missingReceipts > 0)
      .filter((item) => !isCompleted(item));
    if (receiptProjects.length > 0) {
      reply += `**Focus on:** ${receiptProjects.map((item) => item.title).join(', ')} — upload missing receipts to reduce risk.\n`;
    }
  }
  return reply;
}

function buildPortfolioOverBudgetReply(data = []) {
  const safeData = Array.isArray(data) ? data : [];
  const overBudget = safeData.filter((item) =>
    Number.isFinite(Number(item?.overBudgetPct)) && Number(item.overBudgetPct) > 0
  );
  const fmt = (n) => Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const statusLabel = (item) => {
    const status = String(item?.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (status === 'in_progress') return 'In progress';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
  };

  if (overBudget.length === 0) {
    return [
      '**No projects are over their total cost budget based on recorded spend.**',
      '',
      'This checks total project spend against the current cost budget. Estimate-line alerts and completed-project closeout items are tracked separately.',
    ].join('\n');
  }

  let reply = `**${overBudget.length} project${overBudget.length === 1 ? '' : 's'} over total cost budget**\n\n`;
  overBudget.forEach((item) => {
    const overBy = Math.max(0, Number(item.spent || 0) - Number(item.budget || 0));
    reply += `**${item.title}**\n`;
    reply += `• Status: ${statusLabel(item)}\n`;
    reply += `• Spent: $${fmt(item.spent || 0)}\n`;
    reply += `• Cost budget: $${fmt(item.budget || 0)}\n`;
    reply += `• Over budget by: $${fmt(overBy)} (${Number(item.overBudgetPct).toFixed(1)}%)\n`;
    if (item.progress != null) reply += `• Progress: ${Math.round(item.progress)}%\n`;
    reply += '\n';
  });
  reply += 'This is based on recorded spend versus the total cost budget; estimate-line overruns may explain the variance.';
  return reply.trim();
}

function buildProjectBudgetExplanationReply(project) {
  if (!project) return null;
  const title = project.title || project.name || 'This project';
  // This explanation is explicitly scoped to `project`; never let a caller's
  // current-project context overwrite the selected project's financials.
  const snapshot = getProjectFinancialSnapshot({ project, parsedContext: {} });
  const budget = snapshot.estimatedCost;
  const spent = snapshot.spent ?? 0;
  const variance = budget != null ? spent - budget : null;
  const overPct = budget > 0 ? (variance / budget) * 100 : null;
  const { activeGroups, closeoutGroups } = buildDashboardInsightSections([project]);
  const lineGroups = [...activeGroups, ...closeoutGroups];
  const lineAlerts = lineGroups.flatMap((group) => group.insights || []);
  const status = normalizeProjectStatus(project.status);
  const isCompletedProject = isTerminalProjectStatus(status) || snapshot.progress >= 100;

  let reply = `**Budget review — ${title}**\n\n`;
  if (budget != null && budget > 0) {
    reply += `Recorded spend: **$${Number(spent).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n`;
    reply += `Cost budget: **$${Number(budget).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**\n`;
    if (variance > 0) {
      reply += `Variance: **$${Math.round(variance).toLocaleString()} over budget (${overPct.toFixed(1)}%)**.\n`;
    } else {
      reply += `Remaining: **$${Math.round(Math.abs(variance)).toLocaleString()}**.\n`;
    }
  } else {
    reply += 'I do not have a usable total cost budget for this project, so I cannot calculate a total overage.\n';
  }

  if (lineAlerts.length > 0) {
    reply += '\n**Budget line causes**\n';
    lineAlerts.forEach((insight) => {
      reply += `• ${insight.body}\n`;
    });
  } else {
    reply += '\nI do not have a category-level budget alert for this project in the current data.';
  }

  if (isCompletedProject) {
    reply += '\n\nThis project is marked completed, so any line-item variance should be treated as a closeout review.';
  }
  return reply.trim();
}

function projectHasBudgetAlert(item) {
  const flags = Array.isArray(item?.riskFlags) ? item.riskFlags : [];
  const budgetFlagTypes = new Set(['over_budget', 'spend_ahead_of_progress', 'margin_erosion', 'low_margin']);
  if (flags.some((flag) => budgetFlagTypes.has(flag))) return true;
  if (Number(item?.overBudgetPct || 0) > 0) return true;
  const leaks = Array.isArray(item?.profitLeaks) ? item.profitLeaks : [];
  return leaks.some((leak) => ['over_budget', 'spend_ahead_of_progress', 'margin_erosion'].includes(leak?.type));
}

function budgetAlertScore(item) {
  let score = 0;
  const overPct = Number(item?.overBudgetPct || 0);
  if (overPct > 0) score += 20 + Math.min(overPct, 50);
  const flags = Array.isArray(item?.riskFlags) ? item.riskFlags : [];
  if (flags.includes('over_budget')) score += 25;
  if (flags.includes('spend_ahead_of_progress')) score += 18;
  if (flags.includes('margin_erosion')) score += 14;
  if (flags.includes('low_margin')) score += 8;
  return score;
}

function describeBudgetAlertLines(item) {
  const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines = [];
  const seen = new Set();
  const add = (line) => {
    const key = String(line || '').trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    lines.push(line);
  };

  const overPct = Number(item?.overBudgetPct || 0);
  if (overPct > 0 && item.budget != null && item.spent != null) {
    add(`Over budget by ${overPct}% — $${fmt(item.spent)} spent vs $${fmt(item.budget)} budget`);
  }

  const leaks = Array.isArray(item?.profitLeaks) ? item.profitLeaks : [];
  for (const leak of leaks) {
    if (leak?.type === 'spend_ahead_of_progress') add('Spending ahead of job progress');
    if (leak?.type === 'over_budget' && overPct <= 0) add('Spending has exceeded the current cost budget');
    if (leak?.type === 'margin_erosion') add('Projected margin is eroding vs the original estimate');
  }

  const flags = Array.isArray(item?.riskFlags) ? item.riskFlags : [];
  if (flags.includes('low_margin') && item.margin != null) {
    add(`Low margin at ${item.margin}%`);
  }
  if (flags.includes('over_budget') && overPct <= 0) add('Flagged as over budget');

  if (item.progress != null) add(`Progress: ${Math.round(item.progress)}%`);
  if (item.projectedMarginPct != null && flags.includes('margin_erosion')) {
    add(`Projected margin: ${item.projectedMarginPct}%`);
  }

  return lines;
}

const { buildPortfolioBudgetInsights } = require('./portfolioBudgetInsights');

const DASHBOARD_BUDGET_LEAK_TYPES = new Set([
  'line_over_estimate',
  'category_over_budget',
  'over_budget',
]);

function projectTitleFromDashboardInsight(insight, projectById) {
  const pid = String(insight?.projectId ?? '');
  const proj = projectById.get(pid);
  if (proj) return String(proj.title || proj.name || 'Project').trim() || 'Project';
  const m = /\bon\s+(.+)$/i.exec(String(insight?.title || ''));
  return m?.[1]?.trim() || 'Project';
}

function isProjectCloseoutForBudgetInsight(proj) {
  if (!proj) return false;
  const status = normalizeProjectStatus(proj.status);
  const progress = Number(
    proj.progress ?? proj.overallProgressPct ?? proj.projectData?.progress ?? 0
  );
  return isTerminalProjectStatus(status) || progress >= 100;
}

function buildDashboardInsightSections(allProjects) {
  if (!Array.isArray(allProjects) || allProjects.length === 0) {
    return { activeGroups: [], closeoutGroups: [] };
  }
  const pack = buildPortfolioBudgetInsights(allProjects);
  const raw = (pack.insights || []).filter((i) => DASHBOARD_BUDGET_LEAK_TYPES.has(i.leakType));
  const projectById = new Map(
    allProjects
      .filter((p) => p?.id != null)
      .map((p) => [String(p.id), p])
  );

  const groupMap = new Map();
  for (const ins of raw) {
    const pid = String(ins.projectId ?? '');
    if (!groupMap.has(pid)) {
      const proj = projectById.get(pid);
      groupMap.set(pid, {
        projectId: pid,
        title: projectTitleFromDashboardInsight(ins, projectById),
        closeout: isProjectCloseoutForBudgetInsight(proj),
        insights: [],
      });
    }
    groupMap.get(pid).insights.push(ins);
  }

  const activeGroups = [];
  const closeoutGroups = [];
  for (const group of groupMap.values()) {
    if (group.closeout) closeoutGroups.push(group);
    else activeGroups.push(group);
  }

  const sortGroups = (groups) =>
    [...groups].sort(
      (a, b) =>
        b.insights.reduce((s, i) => s + Number(i.impactDollars || 0), 0) -
        a.insights.reduce((s, i) => s + Number(i.impactDollars || 0), 0)
    );

  return {
    activeGroups: sortGroups(activeGroups),
    closeoutGroups: sortGroups(closeoutGroups),
  };
}

function appendDashboardInsightGroupBlock(reply, group) {
  let out = reply;
  const label = group.closeout ? ' (closeout review)' : '';
  out += `**${group.title}**${label}\n`;
  for (const ins of group.insights) {
    out += `• ${ins.body}\n`;
  }
  out += '\n';
  return out;
}

function buildPortfolioBudgetRisksReply(data = [], options = {}) {
  const safeData = Array.isArray(data) ? data : [];
  const allProjects = Array.isArray(options.allProjects) ? options.allProjects : [];
  const getStatus = (item) => resolveProjectStatus(item);
  const isCompleted = (item) => isTerminalProjectStatus(getStatus(item)) || Number(item?.progress || 0) >= 100;
  const activeData = safeData.filter((item) => !isCompleted(item));
  const activeAlerts = activeData
    .filter(projectHasBudgetAlert)
    .sort((a, b) => budgetAlertScore(b) - budgetAlertScore(a));

  const { activeGroups, closeoutGroups } = buildDashboardInsightSections(allProjects);
  const hasCompareAlerts = activeAlerts.length > 0;
  const hasActiveLineAlerts = activeGroups.length > 0;
  const hasCloseoutAlerts = closeoutGroups.length > 0;

  if (!hasCompareAlerts && !hasActiveLineAlerts && !hasCloseoutAlerts) {
    const projectsForCount = allProjects.length > 0 ? allProjects : safeData;
    const activeCount = projectsForCount.filter((item) => !isCompleted(item)).length;
    if (activeCount === 0) {
      const finishedCount = projectsForCount.length;
      return [
        '**No active jobs to check.**',
        '',
        finishedCount > 0
          ? `Budget alerts cover jobs in progress. Your ${finishedCount === 1 ? 'finished job has' : `${finishedCount} finished jobs have`} no estimate lines over budget.`
          : 'Budget alerts cover jobs in progress. Add a project to start tracking.',
      ].join('\n');
    }
    return [
      '**No active budget alerts right now.**',
      '',
      'Your in-progress projects are within budget based on current spend and estimates.',
      'I’ll flag anything that goes over budget, burns faster than progress, or shows margin erosion.',
    ].join('\n');
  }

  let reply = '';

  if (hasCompareAlerts) {
    reply += `**Budget alert summary** — ${activeAlerts.length} active project${activeAlerts.length === 1 ? '' : 's'} need budget attention:\n\n`;
    activeAlerts.forEach((item) => {
      reply += `**${item.title}**\n`;
      for (const line of describeBudgetAlertLines(item)) {
        reply += `• ${line}\n`;
      }
      reply += '\n';
    });
    const nextMoves = buildPortfolioNextActions(activeAlerts, 3);
    if (nextMoves) reply += `${nextMoves}\n`;
  }

  if (hasActiveLineAlerts) {
    if (!hasCompareAlerts) {
      reply += '**Budget alert summary** — estimate lines over on active work:\n\n';
    } else {
      reply += '**Estimate line alerts (active jobs)**\n\n';
    }
    for (const group of activeGroups) {
      reply = appendDashboardInsightGroupBlock(reply, group);
    }
  }

  if (hasCloseoutAlerts) {
    if (!hasCompareAlerts && !hasActiveLineAlerts) {
      reply += '**Budget alert summary** — completed jobs with estimate lines to review:\n\n';
    } else {
      reply += '**Closeout review — estimate line alerts**\n\n';
    }
    for (const group of closeoutGroups) {
      reply = appendDashboardInsightGroupBlock(reply, group);
    }
    if (!hasCompareAlerts && !hasActiveLineAlerts) {
      reply += 'No active in-progress projects need budget attention right now.\n';
    }
  }

  return reply.trim();
}

function buildPortfolioBudgetRisksReplyForProjects(allProjects = [], parsedContext = {}) {
  const cr = runCompareProjectsPipeline({
    allProjects,
    parsedContext,
    args: { activeOnly: true },
  });
  return buildPortfolioBudgetRisksReply(cr?.sorted || [], { allProjects });
}

/** Trust copy: snapshot timing when client sends it; otherwise generic. */
function buildDataFreshnessFooter(parsedContext = {}) {
  const raw = parsedContext.snapshotAt || parsedContext.dataAsOf || parsedContext.contextTimestamp;
  if (raw) {
    try {
      const d = new Date(raw);
      if (Number.isFinite(d.getTime())) {
        const requestedTimeZone = String(parsedContext.snapshotTimeZone || '').trim();
        let displayTime;
        try {
          displayTime = requestedTimeZone
            ? new Intl.DateTimeFormat('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: requestedTimeZone,
            }).format(d)
            : null;
        } catch (_) {
          displayTime = null;
        }
        const fallbackUtc = `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
        return `\n\n_Numbers reflect your project data as of **${displayTime || fallbackUtc}**. Pull to refresh if you’ve updated costs._`;
      }
    } catch (_) { /* ignore */ }
  }
  return '\n\n_Numbers reflect the latest data included in this assistant view. Pull to refresh on Projects if you’ve updated costs._';
}

function appendDataFreshness(text = '', parsedContext = {}) {
  const t = String(text || '').trimEnd();
  if (!t) return buildDataFreshnessFooter(parsedContext).trim();
  return `${t}${buildDataFreshnessFooter(parsedContext)}`;
}

/**
 * Central Command is an analysis surface, not a write surface.
 * Keep mutation detection intentionally conservative: questions about current
 * data should continue to the deterministic portfolio handlers, while requests
 * to change stored data are declined before any model/tool execution.
 */
function isCentralCommandMutationRequest(message = '') {
  const text = normalizeAiMessageForIntent(message);
  if (!text) return false;
  // Reading upcoming schedule/calendar data contains words like "schedule"
  // and "calendar" but must remain allowed in Central Command read-only mode.
  if (isCalendarEventsListQuery(text)) return false;
  if (isPurchaseOrderListQuestion(text)) return false;

  const mutationVerb =
    /\b(?:add|record|log|create|save|update|edit|modify|mark|apply|remove|delete|rename|put|place|send|message|notify|schedule|assign|approve|submit|purchase)\b/i;
  const mutationObject =
    /\b(?:expense|expenses|material|materials|labor|labou?r|lumber|wood|purchase\s+order|order\b|po\b|daily\s+log|change\s+order|payment|estimate|project|budget|pricing|scope|schedule|team\s+member|message|inspection|appointment|task|calendar)\b/i;

  if (mutationVerb.test(text) && mutationObject.test(text)) return true;
  if (/\b(?:put|place|send|schedule|assign|approve|submit|purchase)\b/i.test(text) &&
      /\b(?:job|project|team|person|tomorrow|today|\$?\d[\d,]*)\b/i.test(text)) {
    return true;
  }
  if (/\b(?:change|move|set)\s+(?:the|my|this|that|a|an)\b/i.test(text) && mutationObject.test(text)) return true;
  return /\b(?:bought|purchased|spent)\b/i.test(text) && /\d/.test(text) && mutationObject.test(text);
}

/** User wants to add something to the project calendar (mobile persists to AsyncStorage). */
function isCalendarEventCreateQuery(message = '') {
  const s = normalizeAiMessageForIntent(message);
  // Note: must match "create **an** event" — older pattern used only `a ` and missed "an"
  const patterns = [
    /\badd\s+(?:an?\s+)?(?:calendar\s+)?event\b/,
    /\bcreate\s+(?:an?\s+)?(?:calendar\s+)?event\b/,
    /\bschedule\s+(?:an?\s+)?(?:calendar\s+)?event\b/,
    /\bschedule\s+(?:an?\s+)?(?:inspection|delivery|meeting)\b/,
    /\bput\s+(?:this\s+)?on\s+(?:my\s+)?calendar\b/,
    /\badd\s+to\s+(?:my\s+)?calendar\b/,
    /\bremind\s+me\s+to\b/,
    /\bbook\s+(?:an?\s+)?(?:inspection|delivery)\b/,
  ];
  return patterns.some((re) => re.test(s));
}

/** List upcoming calendar events / inspections / schedule / deadlines (not create). */
function isCalendarEventsListQuery(message = '') {
  const s = normalizeAiMessageForIntent(message);
  if (isCalendarEventCreateQuery(s)) return false;
  return /\b(?:upcoming\s+events?|events?\s+coming\s+up|what'?s\s+on\s+(?:my\s+)?(?:the\s+)?calendar|what\s+(?:does|is)\s+(?:my\s+)?calendar(?:\s+look\s+like)?|how\s+does\s+(?:my\s+)?calendar\s+look|calendar\s+events?|on\s+my\s+schedule|(?:what|any|show)\s+(?:me\s+)?(?:my\s+)?events?|do\s+i\s+have\s+(?:any\s+)?events?|inspections?\s+coming|any\s+inspections\b|when\s+(?:is|are)\s+(?:my\s+)?inspections?|show\s+(?:me\s+)?(?:my\s+)?(?:upcoming\s+)?(?:schedule|calendar)|what\s+(?:is|does)\s+(?:my\s+)?(?:upcoming\s+)?schedule(?:\s+look\s+like)?|(?:my\s+)?upcoming\s+schedule|anything\s+on\s+(?:my\s+)?calendar|upcoming\s+deadlines?|what\s+(?:are\s+)?(?:my\s+)?deadlines?|deadlines?\s+(?:coming|up|ahead)|payments?\s+or\s+deadlines|what\s+payments?\s+or\s+deadlines|(?:coming\s+up|what)\s+(?:for\s+)?(?:payments?\s+and\s+deadlines|deadlines?\s+and\s+payments))\b/i.test(s);
}

/** Optional filter for event type (inspection, delivery, …). */
function calendarEventTypeFilterFromMessage(message = '') {
  const s = normalizeAiMessageForIntent(message);
  // Broad “deadlines / payments+deadlines” portfolio questions → show all calendar types + timeline payments
  if (/\b(?:payments?\s+or\s+deadlines|what\s+payments?\s+or\s+deadlines|upcoming\s+deadlines?\b|deadlines?\s+(?:coming|up|ahead))\b/i.test(s)) return null;
  if (/\binspections?\b/i.test(s)) return 'inspection';
  if (/\bdeliver(?:y|ies)\b/i.test(s)) return 'delivery';
  if (/\bpayment(?:s)?\b/i.test(s) && /\b(?:calendar|event|schedule)\b/i.test(s)) return 'payment';
  if (/\bdeadline\b/i.test(s)) return 'deadline';
  if (/\bwork\b/i.test(s) && /\b(?:calendar|event|schedule)\b/i.test(s)) return 'work';
  return null;
}

/**
 * Calendar "upcoming events" should only include non-finished jobs (matches Projects "active" intent).
 * Client may send `isCompleted`; otherwise infer from status on the project snapshot.
 */
function isProjectActiveForCalendarEvents(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.isCompleted === true) return false;
  const s = String(
    p.status
    || p.projectData?.status
    || p.projectData?.projectStatus
    || ''
  )
    .toLowerCase()
    .trim();
  if (!s) return true;
  const inactive = new Set([
    'completed',
    'complete',
    'done',
    'finished',
    'closed',
    'lost',
    'cancelled',
    'canceled',
    'archived',
  ]);
  if (inactive.has(s)) return false;
  return true;
}

/**
 * Collect future calendar events from allProjects[].calendarEvents (client snapshot).
 */
function collectUpcomingCalendarEvents({
  allProjects = [],
  now = new Date(),
  daysAhead = 45,
  typeFilter = null,
} = {}) {
  const projects = Array.isArray(allProjects) ? allProjects : [];
  const out = [];
  const cutoff = new Date(now.getTime() + daysAhead * 864e5);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const p of projects) {
    if (!isProjectActiveForCalendarEvents(p)) continue;
    const pid = p?.id;
    const ptitle = p?.title || p?.name || 'Project';
    const raw = p?.calendarEvents || p?.projectData?.calendarEvents;
    const events = Array.isArray(raw) ? raw : [];
    for (const ev of events) {
      if (!ev || ev.completed) continue;
      const t = String(ev.type || 'other').toLowerCase();
      if (typeFilter && t !== typeFilter) continue;
      if (!ev.date) continue;
      const parts = String(ev.date).trim().split('-').map(Number);
      if (parts.length < 3) continue;
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      if (!Number.isFinite(d.getTime())) continue;
      if (d.getTime() < todayStart) continue;
      if (d.getTime() > cutoff.getTime()) continue;
      out.push({
        ...ev,
        projectId: pid,
        projectTitle: ptitle,
        sortDate: d.getTime(),
      });
    }
  }
  out.sort((a, b) => a.sortDate - b.sortDate);
  return out;
}

function buildCalendarEventsReply({ events = [], filterLabel = null, readOnly = false } = {}) {
  const list = Array.isArray(events) ? events : [];
  const suffix = filterLabel ? ` (${filterLabel})` : '';
  if (!list.length) {
    const addLine = readOnly
      ? '_Add events in **Project → Calendar**. Completed jobs are excluded._'
      : '_Add events in **Project → Calendar**, or ask me to **schedule** one (e.g. “Schedule an inspection on 2026-04-01 for [project]”). Completed jobs are excluded._';
    return `### 📅 Upcoming events${suffix}\n\nNo matching events in your **Project Calendar** for **active projects** over the next several weeks.\n\n${addLine}`;
  }
  let r = `### 📅 Your upcoming events${suffix}\n\n`;
  for (const ev of list.slice(0, 30)) {
    const typeLabel = String(ev.type || 'other');
    const dateLine = ev.date ? `${ev.date}${ev.time ? ` · ${ev.time}` : ''}` : '—';
    r += `• **${ev.title || 'Event'}** _(${typeLabel})_ — **${ev.projectTitle || 'Project'}** — ${dateLine}\n`;
    if (ev.notes) r += `  _${String(ev.notes).slice(0, 100)}${String(ev.notes).length > 100 ? '…' : ''}_\n`;
  }
  r += '\n_Types: inspection, delivery, work, payment, deadline, other — manage in **Project → Calendar**._';
  return r;
}

/**
 * Same structure as calendar list, plus upcoming (and overdue) payment milestones from Timeline — “dashboard schedule” view.
 */
function paymentCalendarLine(payment, timing) {
  const when = formatPaymentWhen(payment);
  const amount = `$${Math.round(Number(payment?.amount || 0)).toLocaleString()}`;
  const where = payment?.projectTitle ? ` on ${payment.projectTitle}` : '';
  const whenBit = timing === 'overdue'
    ? (when ? `overdue, was due ${when}` : 'overdue')
    : (when ? `due ${when}` : 'no date set');
  return `• **${payment?.name || 'Payment'}** — ${amount}${where}, ${whenBit}`;
}

function buildCalendarAndPaymentsCombinedReply({
  events = [],
  paymentBuckets = { upcoming: [], overdue: [], unscheduled: [] },
  filterLabel = null,
  readOnly = false,
} = {}) {
  const list = Array.isArray(events) ? events : [];
  const dedupePayments = (items) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((payment) => {
      const key = [
        payment?.projectId || payment?.projectTitle || '',
        payment?.name || '',
        payment?.date || '',
        Math.round(Number(payment?.amount || 0) * 100) / 100,
      ]
        .join('|')
        .toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const upcoming = dedupePayments(paymentBuckets.upcoming);
  const overdue = dedupePayments(paymentBuckets.overdue);
  const unscheduled = dedupePayments(paymentBuckets.unscheduled);
  const payments = [
    ...overdue.map((payment) => paymentCalendarLine(payment, 'overdue')),
    ...upcoming.map((payment) => paymentCalendarLine(payment, 'upcoming')),
    ...unscheduled.map((payment) => paymentCalendarLine(payment, 'unscheduled')),
  ];
  const lines = [];
  if (filterLabel === 'Inspection') {
    lines.push(list.length
      ? buildCalendarEventsReply({ events: list, filterLabel, readOnly })
      : 'No inspections are coming up.');
    if (payments.length) {
      lines.push('', 'The dates I do have are payments:', '', ...payments);
    }
    return lines.join('\n');
  }
  if (filterLabel === 'Deadline' && payments.length) {
    lines.push('Your deadlines are the payments still open.', '', ...payments);
    if (!list.length) lines.push('', 'No inspection, delivery, or work events are on the calendar.');
    return lines.join('\n');
  }
  if (payments.length) {
    lines.push('**Payment calendar**', '', ...payments);
  }
  if (list.length) {
    if (lines.length) lines.push('');
    lines.push(buildCalendarEventsReply({ events: list, filterLabel, readOnly }));
  } else if (payments.length) {
    lines.push('', 'No inspection, delivery, or work events are on the calendar.');
  } else {
    lines.push(buildCalendarEventsReply({ events: [], filterLabel, readOnly }));
  }
  return lines.join('\n');
}

function overdueCollectionSentence(buckets) {
  const overdue = Array.isArray(buckets?.overdue) ? buckets.overdue : [];
  if (!overdue.length) return '';
  const total = overdue.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
  const money = `$${Math.round(total).toLocaleString()}`;
  const names = overdue.map((item) => item?.name).filter(Boolean);
  if (names.length === 1) return `${names[0]} is overdue, **${money}**.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are overdue, **${money}** together.`;
  return `${overdue.length} payments are overdue, **${money}** together.`;
}

const MONTH_NAME_TO_NUM = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function getRecentUserMessages(history, max = 8) {
  return (Array.isArray(history) ? history : [])
    .filter((h) => h && h.role === 'user')
    .slice(-max)
    .map((h) => String(h.content || '').trim())
    .filter(Boolean);
}

/** True when the last assistant turn was our calendar create prompt (follow-up: date, title, or project). */
function isCalendarCreateFollowUp(message = '', history = []) {
  const m = String(message || '').trim();
  if (!m || m.length > 500) return false;
  const lastAssistant = [...(Array.isArray(history) ? history : [])]
    .reverse()
    .find((h) => h && (h.role === 'assistant' || h.role === 'model'));
  const last = String(lastAssistant?.content || lastAssistant?.text || '');
  if (!last) return false;
  if (!/project calendar|calendar event/i.test(last)) return false;
  // Match markdown or plain: **date**, **call**, **project**
  return /what\s+.*\bdate\b|which\s+.*\bproject\b|which\s+active|what\s+should\s+we\s+.*\bcall\b|call\s+this\s+event|inspection,\s+delivery,\s+work|type\s*\(/i.test(last);
}

/** User messages in thread already mention a concrete calendar date (follow-up to detail replies). */
function conversationHasCalendarDate(history = []) {
  const users = getRecentUserMessages(history, 14);
  const blob = users.join('\n');
  return !!extractIsoDateFromText(blob);
}

/** "Let's add framing inspection 9 am" — no "create event" phrase but clearly a calendar detail line */
function isCalendarEventDetailReply(message = '') {
  const s = normalizeAiMessageForIntent(message);
  if (s.length > 220) return false;
  if (/\blet\'?s\s+add\b/i.test(s) && /\b(inspection|delivery|framing|rough|trim|walkthrough|9\s*am|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2})/i.test(s)) return true;
  if (/\b(add|schedule)\s+(?:a\s+)?(?:framing|electrical|rough|plumbing|hvac)\b/i.test(s)) return true;
  return false;
}

/** Use deterministic calendar parser (create intent, assistant follow-up, or detail reply + date in history). */
function shouldUseCalendarCreateParser(message = '', history = []) {
  const m = String(message || '').trim();
  if (!m) return false;
  if (isCalendarEventCreateQuery(m)) return true;
  if (isCalendarCreateFollowUp(m, history)) return true;
  if (isCalendarEventDetailReply(m) && conversationHasCalendarDate(history)) return true;
  return false;
}

/** Extract first ISO date (YYYY-MM-DD) from natural text: ISO, m/d/y, tomorrow, month names. */
function extractIsoDateFromText(text) {
  const s = String(text || '');
  const iso = s.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const md = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (md) {
    let y = md[3] ? (String(md[3]).length === 2 ? 2000 + parseInt(md[3], 10) : parseInt(md[3], 10)) : new Date().getFullYear();
    const mo = parseInt(md[1], 10);
    const day = parseInt(md[2], 10);
    const d = new Date(y, mo - 1, day);
    if (Number.isFinite(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  if (/\btomorrow\b/i.test(s)) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }
  const rx1 = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/i;
  const m1 = s.match(rx1);
  if (m1) {
    const month = MONTH_NAME_TO_NUM[m1[1].toLowerCase()];
    const day = parseInt(m1[2], 10);
    const explicitYear = m1[3] ? parseInt(m1[3], 10) : null;
    const out = isoFromMonthDayYear(month, day, explicitYear);
    if (out) return out;
  }
  const rx2 = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)(?:,?\s*(20\d{2}))?\b/i;
  const m2 = s.match(rx2);
  if (m2) {
    const month = MONTH_NAME_TO_NUM[m2[2].toLowerCase()];
    const day = parseInt(m2[1], 10);
    const explicitYear = m2[3] ? parseInt(m2[3], 10) : null;
    const out = isoFromMonthDayYear(month, day, explicitYear);
    if (out) return out;
  }
  return null;
}

function isoFromMonthDayYear(month, day, explicitYear) {
  if (!month || !day || day < 1 || day > 31) return null;
  let y = explicitYear || new Date().getFullYear();
  let d = new Date(y, month - 1, day);
  if (!Number.isFinite(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (!explicitYear && d < today) {
    y += 1;
    d = new Date(y, month - 1, day);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inferEventTypeFromMessage(text) {
  const s = String(text || '');
  if (/\binspection\b/i.test(s)) return 'inspection';
  if (/\bdeliver(?:y|ies)\b/i.test(s)) return 'delivery';
  if (/\bpayment\b/i.test(s)) return 'payment';
  if (/\bdeadline\b/i.test(s)) return 'deadline';
  if (/\bother\b/i.test(s)) return 'other';
  return 'work';
}

/** User message is only "create/add an event" intent — not a real event title (never use as title). */
function isCalendarMetaIntentOnlyMessage(text) {
  let t = String(text || '')
    .trim()
    .replace(/[\u2018\u2019]/g, "'");
  t = normalizeAiMessageForIntent(t);
  if (!t) return true;
  // Substantive event wording — not meta-only
  if (/\b(inspection|delivery|framing|rough|trim|walkthrough|hvac|plumbing|electrical|concrete|pour|drywall|cabinet|roof|floor|meeting|permit)\b/i.test(t)) return false;
  if (/\b(tomorrow|today)\b/.test(t)) return false;
  if (/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/.test(t)) return false;
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(t)) return false;
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(t) && /\d/.test(t)) return false;
  if (
    /\b(?:add|create|schedule)\b/i.test(t) &&
    /\b(?:event|calendar)\b/i.test(t) &&
    /\b(?:my|the|project)\s+calendar\b/i.test(t)
  ) {
    return true;
  }
  return /^(?:please\s+)?(?:let\'s\s+)?(?:can\s+(?:you|we)\s+)?(?:add|create|schedule)\s+(?:an?\s+)?(?:calendar\s+)?(?:event\b)?\s*\.?\s*$/i.test(t)
    || /^(?:can\s+we\s+)?(?:create|add|schedule)\s+(?:an?\s+)?(?:calendar\s+)?event\s*\.?\s*$/i.test(t)
    || /^(?:add|create|schedule)\s+(?:a\s+)?(?:calendar\s+)?event\s*\.?\s*$/i.test(t);
}

function isPlaceholderCalendarTitle(title, type) {
  const t = String(title || '').trim().replace(/[\u2018\u2019]/g, "'");
  if (t.length < 2) return true;
  if (isCalendarMetaIntentOnlyMessage(t)) return true;
  if (/^(for|on|the|a|an|at|to|and|or)$/i.test(t)) return true;
  if (/^calendar$/i.test(t)) return true;
  if (/^20\d{2}$/i.test(t)) return true;
  const cap = type.charAt(0).toUpperCase() + type.slice(1);
  if (new RegExp(`^${cap}\\s*—\\s*calendar$`, 'i').test(t)) return true;
  return false;
}

function stripCalendarTitleNoise(raw) {
  let t = String(raw || '').trim().replace(/[\u2018\u2019]/g, "'");
  t = t
    .replace(/^(?:please\s+)?(?:let\'s\s+)?(?:can\s+(?:you|we)\s+)?(?:add|create|schedule)\s+(?:an?\s+)?(?:calendar\s+)?(?:event\s*:?\s*)?/i, '')
    .replace(/^(?:let\'s\s+)?(?:we\s+)?(?:create|add|schedule)\s+(?:an?\s+)?(?:calendar\s+)?(?:event\s*)?(?:for\s+)?/i, '')
    .replace(/\b(?:on|for)\s+(?:the\s+)?\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}(?:[\/\-]\d{2,4})?\b/g, '')
    .replace(/\b(?:on|for)\s+(?:the\s+)?\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b(?:for|on)\s+(?:the\s+)?tomorrow\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)\d{4}\b/gi, '')
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
    .replace(/\b(?:for|on)\s+the\s+/gi, '')
    .replace(/^(?:for|on)\s*$/i, '')
    .trim();
  t = t.replace(/\b(?:for|on)\s+[A-Za-z][A-Za-z0-9\s\-']+$/i, '').trim();
  return t;
}

function extractEventTitleFromMessage(raw, type) {
  const m = String(raw || '').trim().replace(/[\u2018\u2019]/g, "'");
  if (isCalendarMetaIntentOnlyMessage(m)) {
    return `${type.charAt(0).toUpperCase() + type.slice(1)} — calendar`;
  }
  const q = m.match(/["']([^"']{2,100})["']/);
  if (q) return q[1].trim().slice(0, 120);
  let title = stripCalendarTitleNoise(m);
  if (!title || title.length < 2 || isCalendarMetaIntentOnlyMessage(title)) {
    title = `${type.charAt(0).toUpperCase() + type.slice(1)} — calendar`;
  }
  return title.slice(0, 120);
}

/** "March 25", "for March 3" — not a project name */
function looksLikeDatePhrase(s) {
  const x = String(s || '').trim().toLowerCase();
  if (!x) return false;
  if (/\d/.test(x)) return true;
  const w = x.split(/\s+/)[0];
  return !!MONTH_NAME_TO_NUM[w];
}

/**
 * Parse "create calendar event" style messages. Returns { ok, projectId, event, needsMore }.
 * needsMore: 'details_and_date' | 'date' | 'details' (name/type) | 'project' | null
 * Pass `history` so follow-up lines ("March 25", "Rough-in") merge with earlier turns.
 */
function parseCalendarEventCreate(message, { allProjects = [], parsedContext = {}, history = [] } = {}) {
  const m = String(message || '').trim();
  const histUsers = getRecentUserMessages(history, 8);
  const combined = [...histUsers, m].join('\n');

  let type = inferEventTypeFromMessage(m);
  if (type === 'work') {
    const t2 = inferEventTypeFromMessage(combined);
    if (t2 !== 'work') type = t2;
  }

  let dateStr = extractIsoDateFromText(m) || extractIsoDateFromText(combined);

  let time = '';
  const tm = m.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) || combined.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (tm) {
    let h = parseInt(tm[1], 10);
    const min = tm[2];
    const ap = (tm[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${min}`;
  }
  if (!time) {
    const t2 = m.match(/\b(\d{1,2})\s*(am|pm)\b/i) || combined.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (t2) {
      let h = parseInt(t2[1], 10);
      const ap = (t2[2] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      time = `${String(h).padStart(2, '0')}:00`;
    }
  }

  let titleSource = m;
  if (looksLikeDatePhrase(m) && !/\b(inspection|delivery|framing|rough|trim|walkthrough|hvac|plumbing|electrical|concrete|pour|drywall|cabinet|roof|floor|meeting|permit)\b/i.test(m)) {
    titleSource = '';
  }
  if (Array.isArray(allProjects) && allProjects.length > 1) {
    const rOnly = resolveProjectByQuery(allProjects, m, { minScore: 42 });
    if (rOnly.project && m.length < 55) {
      titleSource = '';
    }
  }
  let title = extractEventTitleFromMessage(titleSource, type);
  if (isPlaceholderCalendarTitle(title, type)) {
    for (let i = histUsers.length - 1; i >= 0; i--) {
      const hu = histUsers[i];
      if (isCalendarMetaIntentOnlyMessage(hu)) continue;
      if (Array.isArray(allProjects) && allProjects.length > 1) {
        const rHu = resolveProjectByQuery(allProjects, hu, { minScore: 42 });
        if (rHu.project && hu.length < 55) continue;
      }
      const cand = extractEventTitleFromMessage(hu, inferEventTypeFromMessage(hu));
      if (!isPlaceholderCalendarTitle(cand, inferEventTypeFromMessage(hu))) {
        title = cand;
        break;
      }
    }
  }
  if (isPlaceholderCalendarTitle(title, type) && type !== 'work') {
    title = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  let projectId = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId || parsedContext.lastOpenedProjectId || null;
  let projectName = parsedContext.currentProject || parsedContext.projectName || null;
  if (projectId && !projectName && Array.isArray(allProjects)) {
    const lp = allProjects.find((p) => String(p?.id) === String(projectId));
    if (lp) projectName = lp.title || lp.name;
  }

  const forMatch = m.match(/\b(?:for|on)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s\-']+?)(?:\s+project)?\s*[.?!]?\s*$/i)
    || m.match(/\b(?:for|on)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s\-']{2,40})\s+(?:on|for)\s+\d{4}-\d{2}-\d{2}/i);
  if (forMatch && Array.isArray(allProjects) && allProjects.length) {
    const pq = forMatch[1].trim();
    if (!looksLikeDatePhrase(pq)) {
      const r = resolveProjectByQuery(allProjects, pq, { minScore: 30 });
      if (r.project) {
        projectId = r.project.id;
        projectName = r.project.title || r.project.name;
      }
    }
  }

  if (!projectId && Array.isArray(allProjects) && allProjects.length === 1) {
    projectId = allProjects[0].id;
    projectName = allProjects[0].title || allProjects[0].name;
  }

  const haveDate = !!dateStr;
  const haveDetails = !isPlaceholderCalendarTitle(title, type);

  if (!projectId && haveDetails && Array.isArray(allProjects) && allProjects.length > 1) {
    const r = resolveProjectByQuery(allProjects, m, { minScore: 35 });
    if (r.project && m.length < 80) {
      projectId = r.project.id;
      projectName = r.project.title || r.project.name;
    }
  }

  let needsMore = null;
  if (!haveDate && !haveDetails) needsMore = 'details_and_date';
  else if (!haveDate) needsMore = 'date';
  else if (!haveDetails) needsMore = 'details';
  else if (!projectId) needsMore = 'project';

  let titleOut = String(title).trim();
  if (time) {
    titleOut = titleOut
      .replace(/\s*[,.]?\s*\d{1,2}:\d{2}\s*(am|pm)?\s*$/i, '')
      .replace(/\s*[,.]?\s*\d{1,2}\s*(am|pm)\s*$/i, '')
      .trim();
    if (titleOut.length < 2) titleOut = String(title).trim();
  }

  const event = {
    title: titleOut.slice(0, 120),
    date: dateStr,
    time,
    type,
    notes: 'Created from AI Assistant',
  };

  return {
    ok: !needsMore,
    needsMore,
    projectId,
    projectName: projectName || 'Project',
    event,
  };
}

/** Top follow-ups from compare rows (risk flags + margin + receipts). */
function buildPortfolioNextActions(rows = [], max = 3) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '';
  const scored = list
    .map((r) => {
      const flags = Array.isArray(r.riskFlags) ? r.riskFlags : [];
      const ob = Number(r.overBudgetPct || 0);
      const score =
        flags.length * 2 +
        (Number(r.margin) < 10 ? 2 : 0) +
        (ob > 10 ? 2 : 0) +
        (r.missingReceipts > 0 ? 1 : 0) +
        (r.overdueItems > 0 ? 1 : 0);
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);

  const lines = [];
  for (const { r } of scored) {
    if (lines.length >= max) break;
    const parts = [];
    if (r.riskFlags?.includes('over_budget') || Number(r.overBudgetPct) > 10) {
      parts.push(`tighten spend (≈${Number(r.overBudgetPct || 0).toFixed(0)}% over budget)`);
    }
    if (r.riskFlags?.includes('low_margin') || Number(r.margin) < 10) parts.push('protect margin');
    if (r.riskFlags?.includes('overdue_milestones') || r.overdueItems > 0) parts.push('follow up overdue payments');
    if (r.riskFlags?.includes('margin_erosion')) parts.push('stop margin erosion');
    if (r.missingReceipts > 0) parts.push(`upload ${r.missingReceipts} missing receipt(s)`);
    if (r.riskFlags?.includes('spend_ahead_of_progress')) parts.push('check spend vs progress');
    if (parts.length) lines.push(`• **${r.title}:** ${parts.slice(0, 3).join(' · ')}`);
  }
  if (!lines.length) return '';
  return `**Suggested next moves**\n${lines.join('\n')}\n`;
}

/** Last row wins — same as mobile ProjectListContext dedupe; prevents 1k+ duplicate ids blowing compare / “focus today”. */
function dedupeAllProjectsForCompare(allProjects) {
  const list = Array.isArray(allProjects) ? allProjects : [];
  const m = new Map();
  for (const p of list) {
    const id = String(p?.id ?? '').trim();
    const titleKey = String(p?.title || p?.name || '').trim().toLowerCase();
    const key = id || (titleKey ? `t:${titleKey}` : `_:${m.size}`);
    m.set(key, p);
  }
  return [...m.values()];
}

/** compare_projects rows should be one per job; merge duplicate titles from client payloads. */
function dedupeCompareProjectsDataRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const m = new Map();
  for (const c of list) {
    const k = String(c?.title || '').toLowerCase().trim();
    if (!k) continue;
    m.set(k, c);
  }
  return [...m.values()];
}

/**
 * Shared compare_projects analysis (same as aiAssistant route tool). Used by stream + tool executor.
 */
function runCompareProjectsPipeline({ allProjects = [], parsedContext = {}, args = {} } = {}) {
  try {
    const normalize = (v) => {
      if (v == null) return 0;
      if (typeof v === 'string') {
        const n = Number(v.replace(/[$,\s]/g, ''));
        return Number.isFinite(n) ? n : 0;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const statusFilter = String(args?.status || '').toLowerCase().trim();
    const activeOnly = args?.activeOnly === true;
    const nameFilters = Array.isArray(args?.projectNames)
      ? args.projectNames.map((n) => String(n).toLowerCase().trim()).filter(Boolean)
      : [];

    let candidates = dedupeAllProjectsForCompare(
      filterPortfolioProjectsForAi(allProjects, parsedContext)
    );
    if (statusFilter) {
      candidates = candidates.filter((p) => String(p?.status || '').toLowerCase().includes(statusFilter));
    }
    if (activeOnly) {
      candidates = candidates.filter((p) => {
        const statusLower = resolveProjectStatus(p);
        const progress = Number(p?.progress ?? p?.overallProgressPct ?? p?.projectData?.progress ?? 0);
        const hasRealSpend =
          Number(p?.actualCost ?? p?.totalSpent ?? p?.spent ?? p?.projectData?.actualCost ?? 0) > 0 ||
          (Array.isArray(p?.expenses) && p.expenses.length > 0) ||
          (Array.isArray(p?.projectData?.expenses) && p.projectData.expenses.length > 0);
        if (
          (isActiveProjectStatus(statusLower) || (hasRealSpend && !isTerminalProjectStatus(statusLower))) &&
          progress < 100
        ) {
          return true;
        }
        if (!isTerminalProjectStatus(statusLower)) return false;

        const milestonesRaw = getProjectMilestones(p);
        const milestones = Array.isArray(milestonesRaw) ? milestonesRaw : [];
        const hasUnpaid = milestones.some((m) => !isPaymentCollectedForAI(m, { projectIsCompleted: false }));
        return hasUnpaid;
      });
    }
    if (nameFilters.length > 0) {
      candidates = candidates.filter((p) => {
        const title = String(p?.title || p?.name || '').toLowerCase();
        const customer = String(p?.customerName || p?.client || '').toLowerCase();
        return nameFilters.some((q) => title.includes(q) || customer.includes(q));
      });
    }

    const progressByProjectId = parsedContext?.progressByProjectId || {};
    const compareProjectsData = dedupeCompareProjectsDataRows(
      Array.isArray(parsedContext?.compareProjectsData) ? parsedContext.compareProjectsData : []
    );

    const analyzed = candidates.map((p) => {
      const title = p?.title || p?.name || 'Untitled Project';
      const pid = String(p?.id ?? '');
      const titleKey = (title || '').toLowerCase().trim();
      const titleSlug = titleKey.replace(/\s+/g, '-');
      const progressOverride = progressByProjectId[pid] ?? progressByProjectId[titleKey] ?? progressByProjectId[titleSlug]
        ?? compareProjectsData.find((c) => (c?.title || '').toLowerCase().trim() === titleKey)?.progress;
      const compareItem = compareProjectsData.find((c) => (c?.title || '').toLowerCase().trim() === titleKey);
      return analyzePortfolioProject(p, {
        parsedContext,
        progressOverride,
        compareItem,
        now: new Date(),
      });
    });

    let analyzedFinal = analyzed;
    if (analyzed.length === 0 && activeOnly && compareProjectsData.length > 0) {
      const activeFromCompare = compareProjectsData.filter((c) => {
        const statusLower = normalizeProjectStatus(c?.status);
        if (!isTerminalProjectStatus(statusLower)) return true;
        const matchingProject = (Array.isArray(allProjects) ? allProjects : []).find((p) => {
          const pt = String(p?.title || p?.name || '').toLowerCase().trim();
          const ct = String(c?.title || '').toLowerCase().trim();
          return pt && ct && (pt === ct || pt.includes(ct) || ct.includes(pt));
        });
        const mRaw = getProjectMilestones(matchingProject);
        const mList = Array.isArray(mRaw) ? mRaw : [];
        return mList.some((m) => !isPaymentCollectedForAI(m, { projectIsCompleted: false }));
      });
      if (activeFromCompare.length > 0) {
        const now = new Date();
        const getDate = (m) => m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.date;
        analyzedFinal = activeFromCompare.map((c) => {
          const matchingProject = (Array.isArray(allProjects) ? allProjects : []).find((p) => {
            const pt = String(p?.title || p?.name || '').toLowerCase().trim();
            const ct = String(c?.title || '').toLowerCase().trim();
            return pt && ct && (pt === ct || pt.includes(ct) || ct.includes(pt));
          });
          const mpStatus = normalizeProjectStatus(matchingProject?.status || c?.status);
          const mpProgress = Number(matchingProject?.progress ?? c?.progress ?? 0);
          const mpIsCompleted = isTerminalProjectStatus(mpStatus) || mpProgress >= 100;
          const isCollected = (m) => {
            if (mpIsCompleted) return true;
            const st = String(m?.status || m?.state || '').toLowerCase();
            if (['complete', 'completed', 'paid', 'collected', 'done', 'finished'].includes(st)) return true;
            if (m?.collected === true || m?.isPaid === true) return true;
            const pct = Number(m?.progressPct ?? m?.progress ?? 0);
            return Number.isFinite(pct) && pct >= 100;
          };
          const mRaw = matchingProject
            ? (matchingProject.milestones || matchingProject.weeklyPayments || matchingProject.projectData?.milestones || matchingProject.projectData?.weeklyPayments || matchingProject.estimateData?.milestones || matchingProject.estimateData?.paymentMilestones || matchingProject.estimateData?.weeklyPayments || matchingProject.projectData?.estimateData?.milestones || matchingProject.projectData?.estimateData?.paymentMilestones || matchingProject.projectData?.estimateData?.weeklyPayments || [])
            : [];
          const milestones = Array.isArray(mRaw) ? mRaw : [];
          const overdueItems = milestones.filter((m) => {
            if (isCollected(m)) return false;
            const date = getDate(m);
            if (!date) return false;
            const dt = new Date(date);
            return Number.isFinite(dt.getTime()) && dt.getTime() < now.getTime();
          });
          const unpaidM = milestones.filter((m) => !isCollected(m));
          const upcomingPayments = unpaidM.filter((m) => {
            const date = getDate(m);
            if (!date) return false;
            const dt = new Date(date);
            if (!Number.isFinite(dt.getTime())) return false;
            const days = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days >= 0;
          }).sort((a, b) => new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()).map((m) => ({
            name: m?.title || m?.name || 'Payment',
            amount: normalize(m?.amount ?? m?.paymentAmount ?? 0),
            date: getDate(m),
          }));
          const unscheduledPayments = unpaidM.filter((m) => {
            const date = getDate(m);
            if (!date) return true;
            const dt = new Date(date);
            return !Number.isFinite(dt.getTime()) || isNaN(dt.getTime());
          }).map((m) => ({ name: m?.title || m?.name || 'Payment', amount: normalize(m?.amount ?? m?.paymentAmount ?? 0), date: null }));
          const rev = Number(c?.revenue ?? 0);
          const projProfit = c?.projectedProfit != null ? Number(c.projectedProfit) : null;
          const marginVal = rev > 0 && projProfit != null ? (projProfit / rev * 100) : (c?.margin ?? null);
          const marginRounded = Math.round(marginVal * 10) / 10;
          const statusLower = (c?.status || '').toString().toLowerCase();
          const isCompletedProject = isTerminalProjectStatus(statusLower) || Number(c?.progress ?? 0) >= 100;
          return {
            projectId: matchingProject?.id ?? c?.id,
            title: c?.title || 'Untitled',
            status: c?.status || 'unknown',
            margin: marginVal == null ? null : marginRounded,
            currentMargin: marginRounded,
            marginLabel: isCompletedProject ? 'Margin' : 'Current margin',
            profitLabel: isCompletedProject ? 'Net Profit' : 'Projected Profit',
            spent: c?.spent ?? null,
            budget: null,
            revenue: c?.revenue ?? 0,
            overBudgetPct: null,
            progress: c?.progress ?? 0,
            overdueItems: overdueItems.length,
            overduePayments: overdueItems.map((m) => ({ name: m?.title || m?.name || 'Payment', amount: normalize(m?.amount ?? m?.paymentAmount ?? 0), date: getDate(m) })),
            upcomingPayments,
            unscheduledPayments,
            projectedFinalCost: null,
            estimatedProfit: null,
            projectedProfit: projProfit,
            projectedMarginPct: marginRounded,
            missingReceipts: c?.missingReceipts ?? 0,
            riskFlags: c?.riskFlags ?? [],
          };
        });
      }
    }

    const sortBy = String(args?.sortBy || '').toLowerCase();
    const sorted = sortCompareProjectsResults(analyzedFinal, sortBy);

    const totalRevenue = analyzedFinal.reduce((s, x) => s + Number(x.revenue || 0), 0);
    const totalSpent = analyzedFinal.reduce((s, x) => s + Number(x.spent || 0), 0);
    const totalBudget = analyzedFinal.reduce((s, x) => s + Number(x.budget || 0), 0);
    const projectsWithProfit = analyzedFinal.filter((x) => x.projectedProfit != null);
    const totalProjectedProfit = projectsWithProfit.reduce((s, x) => s + Number(x.projectedProfit), 0);
    const avgMargin = totalRevenue > 0 ? (totalProjectedProfit / totalRevenue) * 100 : null;
    const dailyBrief = buildDailyCommandCenter(sorted);

    return {
      success: true,
      comparedCount: sorted.length,
      projects: sorted,
      sorted,
      analyzedFinal,
      summary: sorted.slice(0, 5),
      portfolioTotals: {
        totalRevenue,
        totalSpent,
        totalBudget,
        totalProjectedProfit: Math.round(totalProjectedProfit),
        averageMargin: avgMargin == null ? null : Math.round(avgMargin * 10) / 10,
        forecastCoverage: analyzedFinal.length > 0 ? projectsWithProfit.length / analyzedFinal.length : 0,
      },
      dailyBrief,
      message: sorted.length
        ? `Compared ${sorted.length} project(s): ${sorted.map((x) => x.title).join(', ')}. Portfolio totals: $${totalRevenue.toLocaleString()} revenue, $${totalSpent.toLocaleString()} spent, projected profit $${Math.round(totalProjectedProfit).toLocaleString()}${avgMargin == null ? '' : ` (${avgMargin.toFixed(1)}% weighted margin)`}. Forecast coverage: ${projectsWithProfit.length}/${analyzedFinal.length}. IMPORTANT — PAYMENT QUESTIONS (e.g. "when am I getting paid next", "payments", "next payment"): Always answer from the TIMELINE data (upcomingPayments and overduePayments per project). Format: "Your next payment is the [payment name] for the [project title] project, amounting to $[amount], due on [date]." If multiple upcoming payments across projects, list the soonest first, then others. Use the exact project title and payment name/amount/date from upcomingPayments. You may end with: "Want me to check on any other upcoming payments or project details?" If upcomingPayments is empty but unscheduledPayments has items, list those (name, amount) and say they can set dates in the Timeline. If both empty, say payments are set in the Timeline tab (Projects → [Project] → Timeline) and suggest opening that project's Timeline to sync. Never say "no upcoming payments" without that guidance. Each project also has marginLabel, profitLabel; for completed use "Margin"/"Net Profit", for active use "Current margin"/"Projected Profit".`
        : 'No projects matched the requested filters.',
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/** Closing line for the original-estimate answer. Finished jobs use the actual result. */
function finishedJobActualsNote(snapshot) {
  if (
    snapshot?.forecastMethod !== 'completed' ||
    snapshot.spent == null ||
    !Number.isFinite(Number(snapshot.projectedProfit))
  ) {
    return 'That is different from the current projected profit, which uses actual spend and progress.';
  }
  const profit = Math.round(Number(snapshot.projectedProfit));
  const spent = Math.round(Number(snapshot.spent));
  return `The finished result is $${profit.toLocaleString()} net profit on $${spent.toLocaleString()} spent.`;
}

const CENTRAL_COMMAND_INTENT_LABELS = new Set([
  'profit',
  'margin',
  'labor_budget',
  'material_budget',
  'spent',
  'forecast',
  'payee',
  'payment',
  'collected',
  'incoming',
  'worth',
  'progress',
  'change_orders',
  'purchase_orders',
  'markup',
  'overhead',
  'remaining_budget',
  'budget_status',
  'unknown',
]);

function centralCommandIntentExcluded(text) {
  return (
    /\bhealth\s+check\b/i.test(text) ||
    /\b(what[- ]if|scenario|typical friction|bad remodel|runs long)\b/i.test(text) ||
    /\b(compare|calendar|receipt|1099|w-?9|w-?2)\b/i.test(text) ||
    /\boriginal\s+(?:estimate|forecast|projection)\b/i.test(text) ||
    /\b(weather|rain|temperature|storm|snow)\b/i.test(text) ||
    isPortfolioLosingMoneyQuery(text) ||
    isPortfolioOverBudgetListQuery(text) ||
    isPortfolioBudgetRisksQuery(text) ||
    isPortfolioWorstProjectQuery(text) ||
    isCashFlowConceptQuestion(text) ||
    isProfitGuaranteeQuestion(text) ||
    isCalendarEventsListQuery(text)
  );
}

function isCashFlowConceptQuestion(text) {
  return /\bcash\s*flow\b/i.test(String(text || ''));
}

function isProfitGuaranteeQuestion(text) {
  const q = String(text || '');
  return /\b(guarantee|promise)\b/i.test(q) && /\b(profit|profitable|money|margin|job|project)\b/i.test(q);
}

function isPaymentSnapshotIntent(text) {
  return /\b(when am i getting paid|next payment|upcoming payments?|payments? due|my next payment|what payments?|review payments?|overdue payments?|payments? (?:are )?(?:due|overdue|coming)|getting paid|left to collect|still (?:owed|to collect))\b/i.test(text);
}

function isCollectedTotalIntent(text) {
  if (/\b(mark|record|set)\b/i.test(text)) return false;
  return /\b(?:how much (?:have )?(?:i|we) collected|collected so far|have i collected)\b/i.test(text);
}

function isIncomingPaymentIntent(text) {
  return /\b(?:still coming in|coming in on|left to come in|still to come in|how much is still coming)\b/i.test(text);
}

function isWorryQuery(text) {
  return /\b(?:which|what)\s+(?:job|project)\s+should\s+i\s+worry\b|\bworry about most\b|\bwhat should i worry about\b/i.test(text);
}

function isProgressQuestion(text) {
  const q = String(text || '');
  return (
    /\bhow far along\b/i.test(q) ||
    /\bpercent(?:age)? complete\b/i.test(q) ||
    /\bhow much progress\b/i.test(q) ||
    /\b(?:what(?:'s| is)|how(?:'s| is)) (?:my |the |our )?(?:job |project )?progress\b/i.test(q)
  );
}

function isChangeOrderListQuestion(text) {
  const q = String(text || '');
  if (!/\bchange\s+orders?\b/i.test(q)) return false;
  if (/\b(create|add|make|start|new|draft|record|approve|delete|remove|edit|update|need|want)\b/i.test(q)) return false;
  return /\b(any|have|has|list|show|what|which|there|do i|do we|how many|on this|on the|on my)\b/i.test(q);
}

function isPurchaseOrderListQuestion(text) {
  const q = String(text || '');
  if (!/\bpurchase\s+orders?\b/i.test(q)) return false;
  if (/\b(create|add|make|start|new|draft|record|approve|delete|remove|edit|update|need|want|place|mark)\b/i.test(q)) return false;
  return /\b(any|have|has|list|show|what|which|there|do i|do we|how many|on this|on the|on my|open)\b/i.test(q);
}

function isMarkupMarginDefinitionQuestion(text) {
  const q = String(text || '');
  if (!/\bmarkup\b/i.test(q) || !/\bmargin\b/i.test(q)) return false;
  return /\b(difference|versus|vs\.?|between|explain|mean|means|define|definition)\b/i.test(q);
}

function isMarkupQuestion(text) {
  const q = String(text || '');
  if (!/\bmarkup\b/i.test(q) || isMarkupMarginDefinitionQuestion(q)) return false;
  if (/\b(set|change|update|increase|decrease|raise|lower|recommend|should i)\b/i.test(q)) return false;
  return true;
}

function statedDollarAmounts(text) {
  return (String(text || '').match(/\$\s?[\d,]+(?:\.\d+)?/g) || [])
    .map((raw) => Number(raw.replace(/[$,\s]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function statedMarginPercent(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)\s*%\s*(?:gross\s+)?(?:profit\s+)?margin\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return null;
  return value;
}

/** A cost and a target margin the contractor stated. Not the saved job's margin card. */
function isHypotheticalPriceQuestion(text) {
  return statedDollarAmounts(text).length > 0 && statedMarginPercent(text) != null;
}

function isPriceRecalcFollowUp(text) {
  const q = String(text || '');
  if (isHypotheticalPriceQuestion(q)) return false;
  return (
    /\brecalculate\b/i.test(q) ||
    (/\b(?:increased?|went up|added)\b/i.test(q) && /\$\s?[\d,]+/.test(q) && /\b(?:cost|material|price)\b/i.test(q))
  );
}

function priceFromCostAndMargin(cost, marginPct) {
  const price = cost / (1 - marginPct / 100);
  return { price, profit: price - cost };
}

function buildHypotheticalPriceReply(message) {
  const cost = statedDollarAmounts(message)[0];
  const marginPct = statedMarginPercent(message);
  if (!cost || marginPct == null) return null;
  const { price, profit } = priceFromCostAndMargin(cost, marginPct);
  return [
    `Charge **${paymentMoney(price)}**.`,
    `A **${marginPct}%** gross margin on **${paymentMoney(cost)}** of cost leaves **${paymentMoney(profit)}** of profit.`,
    'That price is the cost divided by (1 − the margin). It is not a saved estimate.',
  ].join('\n');
}

function buildPriceRecalcReply(message, history = []) {
  if (!isPriceRecalcFollowUp(message)) return null;
  const prior = [...(Array.isArray(history) ? history : [])]
    .reverse()
    .find((item) => item?.role === 'user' && isHypotheticalPriceQuestion(item.content || item.text || ''));
  const priorText = prior?.content || prior?.text || '';
  const base = statedDollarAmounts(priorText)[0];
  const marginPct = statedMarginPercent(priorText);
  const delta = statedDollarAmounts(message)[0];
  if (!base || marginPct == null || !delta) return null;
  const decreased = /\b(?:decreas|drop|down|less|reduc)/i.test(message);
  const cost = decreased ? base - delta : base + delta;
  if (!(cost > 0)) return null;
  const { price, profit } = priceFromCostAndMargin(cost, marginPct);
  const change = decreased ? 'minus' : 'plus';
  return [
    `Charge **${paymentMoney(price)}**.`,
    `Cost is now **${paymentMoney(cost)}** (${paymentMoney(base)} ${change} **${paymentMoney(delta)}**).`,
    `At a **${marginPct}%** gross margin, profit is **${paymentMoney(profit)}**.`,
  ].join('\n');
}

function buildFocusTodayReply(projects, now = new Date()) {
  const source = (Array.isArray(projects) ? projects : []).filter(Boolean);
  const active = source.filter((project) => !isTerminalProjectStatus(project?.status || project?.projectData?.status));
  const jobs = active.length ? active : source;
  if (!jobs.length) return 'No jobs are loaded, so I cannot tell you what to focus on.';
  const ranked = jobs.map((project) => {
    const buckets = collectPaymentBuckets({ projects: [], currentProject: project, now });
    const snapshot = getProjectFinancialSnapshot({ project, parsedContext: {} });
    const overdueTotal = buckets.overdue.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { project, buckets, snapshot, overdueTotal };
  }).sort((a, b) => b.overdueTotal - a.overdueTotal);
  const top = ranked[0];
  const title = top.project?.title || top.project?.name || 'This job';
  const lines = [];
  if (top.overdueTotal > 0) {
    const names = top.buckets.overdue.map((payment) => payment.name);
    const listText = names.length === 2 ? names.join(' and ') : names.join(', ');
    lines.push(`**${listText}** ${names.length === 1 ? 'is' : 'are'} overdue on **${title}** (**${paymentMoney(top.overdueTotal)}**). Follow ${names.length === 1 ? 'that' : 'those'} up first.`);
  } else {
    lines.push(`No payments are overdue on **${title}**.`);
  }
  const next = top.buckets.upcoming[0];
  if (next) {
    const when = formatPaymentWhen(next);
    lines.push(`**${next.name}** is due ${when || 'soon'} (**${paymentMoney(next.amount)}**).`);
  }
  const spent = Number(top.snapshot.spent || 0);
  const budget = Number(top.snapshot.estimatedCost || 0);
  if (spent <= 0) {
    lines.push(`Nothing is over budget on **${title}**. No costs have been logged.`);
  } else if (budget > 0 && spent > budget) {
    lines.push(`**${title}** is over its cost budget. Spent is **${paymentMoney(spent)}**.`);
  } else {
    lines.push(`**${title}** is inside its cost budget. Spent is **${paymentMoney(spent)}**.`);
  }
  return ['Three things to focus on today:', '', ...lines.map((text, index) => `${index + 1}. ${text}`)].join('\n');
}

function isPercentChangeQuestion(text) {
  const q = String(text || '');
  if (isHypotheticalPriceQuestion(q)) return false;
  if (!/\d+\s*%/.test(q)) return false;
  return /\b(?:goes?\s+up|go(?:es)?\s+up|increase[sd]?|rise[sd]?|goes?\s+down|decrease[sd]?|drops?)\b/i.test(q);
}

function isCategoryBudgetQuestion(text) {
  return categoryBudgetChoice(text) != null;
}

function isOverheadQuestion(text) {
  const q = String(text || '');
  if (!/\boverhead\b/i.test(q)) return false;
  if (/\b(create|add|set|change|update|explain|difference)\b/i.test(q)) return false;
  return true;
}

function categoryBudgetChoice(text) {
  const labor = /\b(?:labor|labour)\b/i.test(text);
  const material = /\bmaterials?\b/i.test(text);
  if (!labor && !material) return null;
  if (!/\b(budget|number|under|over|spent|cost)\b/i.test(text)) return null;
  const direct = !/\b(under|over|am i|are we)\b/i.test(text);
  return {
    intent: labor && !material ? 'labor_budget' : 'material_budget',
    payeeName: null,
    ...(direct ? { direct: true } : {}),
  };
}

function isRemainingBudgetSnapshotIntent(text) {
  return (
    /\b(?:remaining|left)\b[\s\S]{0,40}\b(?:cost|budget|spend|to spend)\b/i.test(text) ||
    /\b(?:cost|budget)\b[\s\S]{0,24}\bleft\b/i.test(text) ||
    /\bleft to spend\b/i.test(text)
  );
}

function isBudgetStatusSnapshotIntent(text) {
  return /\b(over|under|within)\s+budget\b|\bbudget status\b|\bam i over budget\b/i.test(text);
}

function isForecastSnapshotIntent(text) {
  if (/\b(weather|rain|temperature|storm|snow)\b/i.test(text)) return false;
  return /\bforecast\b/i.test(text) || /\bcosts keep coming\b/i.test(text) || /\bif costs keep\b/i.test(text);
}

function extractCentralCommandPayeeName(message) {
  const text = String(message || '');
  const cost = text.match(/\b(?:what|how much) did ([a-z][a-z'’-]{1,40}(?:\s+[a-z][a-z'’-]{1,40})?) cost\b/i);
  const paid = text.match(/\b(?:pay|paid)\s+([a-z][a-z'’-]{1,40})\b/i);
  const raw = (cost && cost[1]) || (paid && paid[1]) || '';
  const name = raw.replace(/^(?:the|a|my|our)\s+/i, '').trim();
  if (!name || /^(?:i|me|we|us|you|it|job|project|this|that|labor|material|materials)$/i.test(name)) return null;
  return name;
}

/**
 * Closed label for a money question that missed the exact cards.
 * The label is not an answer. Dollar amounts stay in the snapshot reply.
 */
function classifyCentralCommandIntent(message) {
  const text = String(message || '').trim();
  if (!text || centralCommandIntentExcluded(text) || isPercentChangeQuestion(text) || isMarkupMarginDefinitionQuestion(text)) return null;
  const payeeName = extractCentralCommandPayeeName(text);
  if (payeeName && /\b(cost|charge|pay|paid)\b/i.test(text)) return { intent: 'payee', payeeName };
  if (isWorryQuery(text)) return null;
  if (isProgressQuestion(text)) return { intent: 'progress', payeeName: null };
  if (isChangeOrderListQuestion(text)) return { intent: 'change_orders', payeeName: null };
  if (isPurchaseOrderListQuestion(text)) return { intent: 'purchase_orders', payeeName: null };
  if (isCollectedTotalIntent(text)) return { intent: 'collected', payeeName: null };
  if (isIncomingPaymentIntent(text)) return { intent: 'incoming', payeeName: null };
  if (isPaymentSnapshotIntent(text)) return { intent: 'payment', payeeName: null };
  if (isOverheadQuestion(text)) return { intent: 'overhead', payeeName: null, direct: true };
  const category = categoryBudgetChoice(text);
  if (category) return category;
  if (isRemainingBudgetSnapshotIntent(text)) return { intent: 'remaining_budget', payeeName: null };
  if (isBudgetStatusSnapshotIntent(text)) return { intent: 'budget_status', payeeName: null };
  if (isForecastSnapshotIntent(text)) return { intent: 'forecast', payeeName: null };
  if (isMarkupQuestion(text)) return { intent: 'markup', payeeName: null };
  if (/\b(worth it|worth doing|worth taking)\b/i.test(text)) return { intent: 'worth', payeeName: null };
  if (/\b(make money|made money|profitable|come out ahead|making enough)\b/i.test(text)) return { intent: 'profit', payeeName: null };
  if (/\bmargin\b/i.test(text) && !isHypotheticalPriceQuestion(text)) return { intent: 'margin', payeeName: null };
  if (/\b(spent|spend)\b/i.test(text)) return { intent: 'spent', payeeName: null };
  return null;
}

function needsCentralCommandIntentModel(message) {
  const text = String(message || '').trim();
  if (!text || classifyCentralCommandIntent(text) || centralCommandIntentExcluded(text) || isPercentChangeQuestion(text) || isMarkupMarginDefinitionQuestion(text)) return false;
  return /\b(money|profit|margin|budget|spent|spend|cost|paid|pay|labor|materials?|forecast|payment|overdue|collect)\b/i.test(text);
}

function parseCentralCommandIntentChoice(raw, message) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  const intent = String(parsed?.intent || 'unknown').toLowerCase();
  if (!CENTRAL_COMMAND_INTENT_LABELS.has(intent)) return { intent: 'unknown', payeeName: null };
  let payeeName = parsed?.payeeName == null ? null : String(parsed.payeeName).trim();
  if (!payeeName || !String(message || '').toLowerCase().includes(payeeName.toLowerCase())) payeeName = null;
  if (intent === 'payee' && !payeeName) return { intent: 'unknown', payeeName: null };
  return { intent, payeeName };
}

function projectForCentralCommandIntent(projects, parsedContext = {}) {
  const list = Array.isArray(projects) ? projects.filter(Boolean) : [];
  const id = parsedContext?.projectId;
  if (id != null) {
    const byId = list.find((project) => String(project?.id) === String(id));
    if (byId) return byId;
  }
  if (parsedContext?.currentProject) {
    const resolved = resolveProjectByQuery(list, parsedContext.currentProject, { minScore: 35 }).project;
    if (resolved) return resolved;
  }
  return list.length === 1 ? list[0] : null;
}

function categoryBudgetAmount(project, parsedContext, kind) {
  const isLabor = kind === 'labor';
  const estimateData = project?.estimateData || project?.projectData?.estimateData || parsedContext?.estimateData || {};
  const buckets = project?.buckets || project?.projectData?.buckets || parsedContext?.buckets || [];
  const onThisJob = isCurrentProjectMatch(project, parsedContext);
  let budget = 0;
  if (!isLabor && onThisJob && Number(parsedContext?.materialBudgetDirect) > 0) {
    return Number(parsedContext.materialBudgetDirect);
  }
  if (isLabor) {
    budget = Number(estimateData.laborTotal || project?.laborTotal || parsedContext?.laborTotal || 0);
    if (!(budget > 0)) {
      const laborLines = Array.isArray(estimateData.laborLineItems) ? estimateData.laborLineItems : [];
      budget = laborLines.reduce((sum, item) => sum + (Number(item?.total) || Number(item?.amount) || Number(item?.cost) || 0), 0);
    }
    if (!(budget > 0)) {
      budget = (Array.isArray(buckets) ? buckets : []).reduce((sum, bucket) => {
        const name = String(bucket?.name || '').toLowerCase();
        return name.includes('labor') || name.includes('labour')
          ? sum + Number(bucket?.budget || bucket?.bidBudget || 0)
          : sum;
      }, 0);
    }
    return budget;
  }
  const lineItems = Array.isArray(estimateData.materialLineItems) ? estimateData.materialLineItems : [];
  const cart = Array.isArray(estimateData.materialsCart) ? estimateData.materialsCart : [];
  if (lineItems.length > 0) {
    budget = lineItems.reduce((sum, item) => sum + (Number(item?.total) || Number(item?.unitCost) * (Number(item?.quantity) || 0) || 0), 0);
  } else if (cart.length > 0) {
    budget = cart.reduce((sum, item) => sum + (Number(item?.total) || 0), 0);
  }
  if (!(budget > 0)) {
    const materialBuckets = onThisJob && Array.isArray(parsedContext?.buckets) && parsedContext.buckets.length
      ? parsedContext.buckets
      : buckets;
    budget = (Array.isArray(materialBuckets) ? materialBuckets : []).reduce((sum, bucket) => {
      const name = String(bucket?.name || '').toLowerCase();
      const isMaterial = name.includes('material') || name.includes('equipment');
      return isMaterial ? sum + Number(bucket?.budget || bucket?.bidBudget || 0) : sum;
    }, 0);
  }
  if (!(budget > 0)) {
    budget = Number(estimateData.materialTotal || project?.materialTotal || parsedContext?.materialTotal || 0);
  }
  return budget;
}

function positiveMoney(source, keys) {
  if (!source) return 0;
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function overheadLineTotal(source) {
  const lines = source?.overheadLineItems;
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, line) => sum + (Number(line?.amount ?? line?.total ?? line?.totalCost) || 0), 0);
}

function projectOverheadAmount(project, parsedContext = {}) {
  const sources = [
    parsedContext?.estimateData,
    project?.estimateData,
    project?.projectData?.estimateData,
    project,
    parsedContext,
  ].filter(Boolean);
  const pick = (...keys) => {
    for (const source of sources) {
      const amount = positiveMoney(source, keys);
      if (amount > 0) return amount;
    }
    return 0;
  };
  const lineTotal = sources.reduce((max, source) => Math.max(max, overheadLineTotal(source)), 0);
  const fromParts =
    pick('insuranceOverhead') +
    pick('equipmentMaintenance', 'equipmentMaintenanceOverhead') +
    pick('facilities', 'facilitiesOverhead') +
    pick('adminOverhead') +
    pick('otherOverhead') +
    lineTotal;
  if (fromParts > 0) return fromParts;
  const saved = pick('overheadTotal', 'projectOverhead', 'companyOverhead');
  if (saved > 0) return saved;
  const buckets = project?.buckets || project?.projectData?.buckets || parsedContext?.buckets || [];
  return (Array.isArray(buckets) ? buckets : []).reduce((sum, bucket) => {
    const name = String(bucket?.name || '').toLowerCase();
    return name.includes('overhead') ? sum + Number(bucket?.budget || bucket?.bidBudget || 0) : sum;
  }, 0);
}

function buildOverheadReply(project, parsedContext = {}) {
  if (!project) return null;
  const title = project?.title || project?.name || parsedContext?.currentProject || 'This project';
  const budget = projectOverheadAmount(project, isCurrentProjectMatch(project, parsedContext) ? parsedContext : {});
  const expenses = Array.isArray(project?.expenses)
    ? project.expenses
    : (Array.isArray(project?.projectData?.expenses) ? project.projectData.expenses : (parsedContext?.expenses || []));
  const spent = (Array.isArray(expenses) ? expenses : []).reduce((sum, expense) => {
    const category = String(expense?.category || '').toLowerCase();
    return category.includes('overhead') ? sum + Number(expense?.amount || 0) : sum;
  }, 0);
  if (!(budget > 0) && spent <= 0) return `No project overhead is on **${title}**.`;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const finished = snapshot.forecastMethod === 'completed' || isTerminalProjectStatus(project?.status || parsedContext?.status);
  const lines = [
    `**Overhead — ${title}**`,
    '',
    `• **Budget:** $${Math.round(budget).toLocaleString()}`,
    `• **Spent:** $${Math.round(spent).toLocaleString()}`,
  ];
  if (!finished) lines.push(`• **Remaining:** $${Math.round(Math.max(0, budget - spent)).toLocaleString()}`);
  if (!finished && spent <= 0) lines.push('', 'No overhead costs have been logged yet.');
  return lines.join('\n');
}

function categoryBudgetReply(project, parsedContext, kind, options = {}) {
  const isLabor = kind === 'labor';
  const title = project?.title || project?.name || parsedContext?.currentProject || 'This project';
  const expenses = Array.isArray(project?.expenses)
    ? project.expenses
    : (Array.isArray(project?.projectData?.expenses) ? project.projectData.expenses : (parsedContext?.expenses || []));
  const onThisJob = isCurrentProjectMatch(project, parsedContext);
  const budget = categoryBudgetAmount(project, parsedContext, kind);
  const spent = !isLabor && onThisJob && Number(parsedContext?.materialBudgetDirect) > 0
    ? Number(parsedContext.materialSpentDirect || 0)
    : (Array.isArray(expenses) ? expenses : []).reduce((sum, expense) => {
      const category = String(expense?.category || '').toLowerCase();
      const counts = isLabor
        ? category.includes('labor')
        : category.length > 0 && !category.includes('labor');
      return counts ? sum + Number(expense?.amount || 0) : sum;
    }, 0);
  if (!(budget > 0)) return null;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const finished = snapshot.forecastMethod === 'completed' || isTerminalProjectStatus(project?.status || parsedContext?.status);
  const under = spent <= budget;
  const label = isLabor ? 'labor' : 'material';
  if (options.direct) {
    const lines = [
      `**${isLabor ? 'Labor' : 'Material'} budget — ${title}**`,
      '',
      `• **Budget:** $${Math.round(budget).toLocaleString()}`,
      `• **Spent:** $${Math.round(spent).toLocaleString()}`,
    ];
    if (!finished) lines.push(`• **Remaining:** $${Math.round(Math.max(0, budget - spent)).toLocaleString()}`);
    if (!finished && spent <= 0) lines.push('', `No ${label} costs have been logged yet.`);
    return lines.join('\n');
  }
  const lead = finished
    ? `${under ? 'Yes' : 'No'}. **${title}** finished ${under ? 'under' : 'over'} the ${label} budget.`
    : `${under ? 'Yes' : 'No'}. **${title}** is ${under ? 'under' : 'over'} the ${label} budget.`;
  const lines = [
    lead,
    '',
    `**${isLabor ? 'Labor' : 'Material'} Budget**`,
    `• **Total Budget**: $${Math.round(budget).toLocaleString()}`,
    `• **Spent**: $${Math.round(spent).toLocaleString()}`,
  ];
  if (!finished) lines.push(`• **Remaining**: $${Math.round(Math.max(0, budget - spent)).toLocaleString()}`);
  return lines.join('\n');
}

function buildCentralCommandIntentReply(choice, { projects = [], parsedContext = {}, now = new Date() } = {}) {
  const intent = choice?.intent;
  if (!intent || intent === 'unknown') return null;
  const project = projectForCentralCommandIntent(projects, parsedContext);
  const isCurrent = !!(project && isCurrentProjectMatch(project, parsedContext));
  if (intent === 'payee') {
    const probe = choice.payeeName ? `How much did I pay ${choice.payeeName}?` : '';
    return probe ? buildSeparatePayeeReply(probe, projects) : null;
  }
  if (intent === 'payment' || intent === 'collected' || intent === 'incoming') {
    const paymentBuckets = collectPaymentBuckets({
      parsedContext,
      projects,
      currentProject: project,
      now,
    });
    const paymentName = project?.title || project?.name || parsedContext?.currentProject || parsedContext?.projectName || 'your projects';
    if (intent === 'collected') return buildCollectedTotalReply(paymentBuckets, paymentName);
    if (intent === 'incoming') return buildIncomingTotalReply(paymentBuckets, paymentName);
    const status = String(project?.status || parsedContext?.status || '').toLowerCase();
    return buildPaymentStatusReply({
      upcoming: paymentBuckets.upcoming,
      overdue: paymentBuckets.overdue,
      unscheduled: paymentBuckets.unscheduled,
      collected: paymentBuckets.collected,
      collectedCount: paymentBuckets.collectedCount,
      finished: ['completed', 'complete', 'closed', 'done', 'finished'].includes(status),
      fallbackProjectName: project?.title || project?.name || parsedContext?.currentProject || parsedContext?.projectName || 'your project',
    });
  }
  if (!project) return null;
  if (intent === 'progress') return buildProgressReply(project, parsedContext);
  if (intent === 'change_orders') return buildChangeOrderListReply(project, parsedContext);
  if (intent === 'purchase_orders') return buildPurchaseOrderListReply(project, parsedContext);
  if (intent === 'overhead') return buildOverheadReply(project, parsedContext);
  if (intent === 'labor_budget') return categoryBudgetReply(project, parsedContext, 'labor', { direct: choice.direct === true });
  if (intent === 'material_budget') return categoryBudgetReply(project, parsedContext, 'material', { direct: choice.direct === true });
  if (intent === 'remaining_budget') {
    const snapshot = getProjectFinancialSnapshot({
      project,
      parsedContext: isCurrent ? parsedContext : {},
    });
    return buildRemainingBudgetReply({
      projectName: project?.title || project?.name || 'This project',
      snapshot,
    });
  }
  if (intent === 'budget_status') {
    const snapshot = getProjectFinancialSnapshot({
      project,
      parsedContext: isCurrent ? parsedContext : {},
    });
    return buildBudgetStatusReply({
      projectName: project?.title || project?.name || 'This project',
      budget: Number(snapshot.estimatedCost || 0),
      spent: Number(snapshot.spent || 0),
      finished: snapshot.forecastMethod === 'completed',
    });
  }
  if (intent === 'worth') {
    const snapshot = getProjectFinancialSnapshot({
      project,
      parsedContext: isCurrent ? parsedContext : {},
    });
    const margin = snapshot.projectedMarginPct ?? snapshot.bidMarginPct;
    if (margin == null) return null;
    return buildMakingEnoughReply(
      project?.title || project?.name || 'This project',
      margin,
      snapshot.dataQuality
    );
  }
  if (intent === 'markup') return buildMarkupReply(project, parsedContext);
  if (intent === 'profit' || intent === 'margin') {
    return buildMarginReplyForProject(project, { parsedContext, isCurrent })?.reply || null;
  }
  if (intent === 'forecast') {
    return buildFinishedJobForecastReply(project, { parsedContext, isCurrent })
      || buildLiveForecastReply(project, { parsedContext, isCurrent })
      || null;
  }
  if (intent === 'spent') {
    const snapshot = getProjectFinancialSnapshot({
      project,
      parsedContext: isCurrent ? parsedContext : {},
    });
    if (snapshot.spent == null) return null;
    const title = project?.title || project?.name || 'This project';
    const money = Number(snapshot.spent).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    return `**Spent — ${title}**\n\n• Spent: ${money}`;
  }
  return null;
}

/**
 * Central Command money and payee questions that missed every built-in handler.
 * These must not be written by the model.
 */
/** Synchronous snapshot answer. Null means a later handler may still own the question. */
function buildProgressReply(project, parsedContext = {}) {
  if (!project) return null;
  const title = project?.title || project?.name || parsedContext?.currentProject || 'This project';
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const finished = snapshot.forecastMethod === 'completed' || isTerminalProjectStatus(project?.status || parsedContext?.status);
  if (finished) return `**${title}** is finished.`;
  const progress = Number(snapshot.progress);
  if (!Number.isFinite(progress)) return `I don't have a progress percent for **${title}**.`;
  return `**${title}** is **${Math.round(progress)}%** complete.`;
}

function changeOrderRows(project, parsedContext = {}) {
  const sources = [
    parsedContext?.changeOrders,
    project?.changeOrders,
    project?.projectData?.changeOrders,
  ];
  const rows = sources.find((list) => Array.isArray(list) && list.length > 0) || [];
  return rows.filter(Boolean);
}

function purchaseOrderRows(project, parsedContext = {}) {
  const onThisJob = isCurrentProjectMatch(project, parsedContext);
  const sources = onThisJob
    ? [parsedContext?.purchaseOrders, project?.purchaseOrders, project?.projectData?.purchaseOrders]
    : [project?.purchaseOrders, project?.projectData?.purchaseOrders];
  const rows = sources.find((list) => Array.isArray(list) && list.length > 0) || [];
  return rows.filter(Boolean);
}

function buildPurchaseOrderListReply(project, parsedContext = {}) {
  if (!project) return null;
  const title = project?.title || project?.name || parsedContext?.currentProject || 'This project';
  const open = purchaseOrderRows(project, parsedContext).filter(isPurchaseOrderOpen);
  if (open.length === 0) return `No open purchase orders on **${title}**.`;
  const lines = open.map((order) => {
    const vendor = String(order?.vendor || order?.supplier || '').trim();
    const number = String(order?.poNumber || order?.number || '').trim();
    const description = String(order?.description || order?.title || order?.name || '').trim();
    const label = number || vendor || description || 'Purchase order';
    const detail = [vendor, description].filter((part, index, parts) => part && part !== label && parts.indexOf(part) === index);
    const amount = Number(order?.amount ?? order?.total ?? order?.cost ?? 0);
    const money = Number.isFinite(amount) && amount > 0 ? `$${Math.round(amount).toLocaleString()}` : 'no amount';
    const status = String(order?.status || 'pending').trim().toLowerCase() || 'pending';
    const who = detail.length ? `${detail.join(', ')}, ` : '';
    return `• **${label}** — ${who}${money}, ${status}`;
  });
  const count = open.length === 1 ? '1 open purchase order' : `${open.length} open purchase orders`;
  return [`${count} on **${title}**:`, '', ...lines].join('\n');
}

function buildChangeOrderListReply(project, parsedContext = {}) {
  if (!project) return null;
  const title = project?.title || project?.name || parsedContext?.currentProject || 'This project';
  const rows = changeOrderRows(project, isCurrentProjectMatch(project, parsedContext) ? parsedContext : {});
  if (rows.length === 0) return `No change orders on **${title}**.`;
  const lines = rows.map((order) => {
    const name = String(order?.title || order?.description || order?.name || 'Change order').trim();
    const amount = Number(order?.amount ?? order?.total ?? order?.clientPrice ?? order?.price ?? 0);
    const approved = (typeof order?.approved === 'boolean' && order.approved) ||
      String(order?.status || '').toLowerCase() === 'approved';
    const status = approved ? 'approved' : (String(order?.status || 'open').toLowerCase() || 'open');
    const money = Number.isFinite(amount) && amount > 0
      ? `$${Math.round(amount).toLocaleString()}`
      : 'no amount';
    return `• **${name}** — ${money}, ${status}`;
  });
  const count = rows.length === 1 ? '1 change order' : `${rows.length} change orders`;
  return [`${count} on **${title}**:`, '', ...lines].join('\n');
}

function buildPercentChangeReply(message, project, parsedContext = {}) {
  if (!project || !isPercentChangeQuestion(message)) return null;
  const pctMatch = String(message || '').match(/(\d+(?:\.\d+)?)\s*%/);
  const pct = pctMatch ? Number(pctMatch[1]) : 0;
  if (!(pct > 0) || pct > 100) return null;
  const down = /\b(?:down|decrease|drop|lower)\b/i.test(message);
  const isLabor = /\b(?:labor|labour)\b/i.test(message);
  const isMaterial = /\bmaterials?\b/i.test(message);
  const kind = isLabor && !isMaterial ? 'labor' : (isMaterial && !isLabor ? 'material' : null);
  const title = project?.title || project?.name || 'This project';
  const money = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const revenue = Number(snapshot.revenue || 0);
  const baseProfit = snapshot.projectedProfit != null ? Number(snapshot.projectedProfit) : null;
  const baseMargin = snapshot.projectedMarginPct != null ? Number(snapshot.projectedMarginPct) : null;
  let base = 0;
  let label = 'cost budget';
  if (kind) {
    base = categoryBudgetAmount(project, parsedContext, kind);
    label = kind === 'labor' ? 'labor budget' : 'material budget';
  } else {
    base = Number(snapshot.estimatedCost || 0);
  }
  if (!(base > 0) || !(revenue > 0) || baseProfit == null) {
    const which = kind === 'labor' ? 'labor budget' : kind === 'material' ? 'material budget' : 'cost budget';
    return `I don't have a ${which} on **${title}**, so I won't guess what a ${pct}% change does.`;
  }
  const delta = base * (pct / 100);
  const signed = down ? -delta : delta;
  const newProfit = baseProfit - signed;
  const newMargin = (newProfit / revenue) * 100;
  const fromMargin = baseMargin != null ? baseMargin : ((baseProfit / revenue) * 100);
  const drop = fromMargin - newMargin;
  const verb = down ? 'decrease' : 'increase';
  const direction = down ? 'rises' : 'drops';
  const lines = [
    `${kind === 'labor' ? 'Labor' : kind === 'material' ? 'Materials' : 'Cost'} is budgeted at **${money(base)}**. A ${pct}% ${verb} ${down ? 'removes' : 'adds'} **${money(delta)}** ${down ? 'from' : 'to'} cost.`,
    '',
    `• **Projected profit:** ${direction} from **${money(baseProfit)}** to **${money(newProfit)}**`,
    `• **Projected margin:** ${direction} from **${fromMargin.toFixed(1)}%** to **${newMargin.toFixed(1)}%**`,
    `• **Impact:** about ${Math.abs(drop).toFixed(1)} margin points`,
  ];
  if (snapshot.dataQuality?.hasActivity !== true) {
    lines.push('', `No costs have been logged yet, so this uses the ${label}.`);
  }
  return lines.join('\n');
}

function buildMarkupReply(project, parsedContext = {}) {
  if (!project) return null;
  const title = project?.title || project?.name || parsedContext?.currentProject || 'This project';
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const revenue = Number(snapshot.revenue || 0);
  const cost = Number(snapshot.estimatedCost || 0);
  if (!(revenue > 0) || !(cost > 0)) return null;
  const profit = revenue - cost;
  const markup = (profit / cost) * 100;
  const margin = (profit / revenue) * 100;
  const money = (amount) => `$${Math.round(amount).toLocaleString()}`;
  const lines = [
    `**Markup — ${title}**`,
    '',
    'Markup is profit divided by cost. Margin is profit divided by the contract.',
    '',
    `• **Cost budget:** ${money(cost)}`,
    `• **Contract:** ${money(revenue)}`,
    `• **Profit:** ${money(profit)}`,
    `• **Markup:** ${markup.toFixed(1)}%`,
    `• **Margin:** ${margin.toFixed(1)}%`,
  ];
  if (Number(snapshot.spent || 0) <= 0) {
    lines.push('', 'No costs have been logged yet, so this uses the estimate.');
  }
  return lines.join('\n');
}

function buildMarkupMarginDefinitionReply() {
  return [
    '**Markup** is profit divided by cost: (price − cost) ÷ cost.',
    '',
    '**Margin** is profit divided by the selling price: (price − cost) ÷ price.',
    '',
    'The same profit is a higher markup than margin, because the cost is smaller than the price.',
  ].join('\n');
}

function buildCashFlowConceptReply(project, parsedContext = {}, now = new Date()) {
  const concept = 'A job can show a profit and still be short on cash. Profit is the price minus the cost. Cash is what you have actually collected, minus what you have paid out.';
  if (!project) return concept;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const title = project?.title || project?.name || 'This project';
  const money = (amount) => `$${Math.round(Number(amount || 0)).toLocaleString()}`;
  const buckets = collectPaymentBuckets({
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
    projects: [],
    currentProject: project,
    now,
  });
  const lines = [concept, ''];
  if (snapshot.projectedProfit != null && snapshot.projectedMarginPct != null) {
    lines.push(`**${title}** still shows about **${money(snapshot.projectedProfit)}** profit (**${Number(snapshot.projectedMarginPct).toFixed(1)}%**).`);
  }
  if (Number(snapshot.spent || 0) <= 0) {
    lines.push('No costs have been logged yet, so that profit is still the estimate.');
  }
  const overdue = overdueCollectionSentence(buckets);
  if (overdue) lines.push(`The cash gap is collections: ${overdue} That money is not in the account until it comes in.`);
  return lines.join('\n');
}

function buildProfitGuaranteeReply(project, parsedContext = {}, now = new Date()) {
  const lead = "No. I can't guarantee a job will be profitable. The estimate is a plan, and it moves when costs or payments change.";
  if (!project) return lead;
  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
  });
  const title = project?.title || project?.name || 'This project';
  const money = (amount) => `$${Math.round(Number(amount || 0)).toLocaleString()}`;
  const buckets = collectPaymentBuckets({
    parsedContext: isCurrentProjectMatch(project, parsedContext) ? parsedContext : {},
    projects: [],
    currentProject: project,
    now,
  });
  const lines = [lead, ''];
  if (snapshot.projectedProfit != null && snapshot.projectedMarginPct != null) {
    lines.push(`On **${title}**, the estimate shows **${money(snapshot.projectedProfit)}** profit and a **${Number(snapshot.projectedMarginPct).toFixed(1)}%** margin.`);
  }
  if (Number(snapshot.spent || 0) <= 0 && Number(snapshot.estimatedCost || 0) > 0) {
    lines.push(`No costs are logged yet, so that holds only if the work stays inside the **${money(snapshot.estimatedCost)}** cost budget.`);
  }
  const overdue = overdueCollectionSentence(buckets);
  if (overdue) lines.push(overdue);
  return lines.join('\n');
}

function buildLowestMarginReply(projects = []) {
  const rows = [];
  for (const project of Array.isArray(projects) ? projects : []) {
    if (!project) continue;
    const snapshot = getProjectFinancialSnapshot({ project, parsedContext: {} });
    const margin = Number(snapshot.projectedMarginPct);
    if (!Number.isFinite(margin)) continue;
    const finished = snapshot.forecastMethod === 'completed' || isTerminalProjectStatus(project?.status);
    rows.push({
      title: project?.title || project?.name || 'This project',
      margin,
      finished,
    });
  }
  if (!rows.length) return "I don't have a margin on your jobs yet, so I won't guess which one is lowest.";
  rows.sort((a, b) => a.margin - b.margin);
  const lowest = rows[0];
  const state = lowest.finished ? 'finished' : 'in progress';
  if (rows.length === 1) {
    return `**${lowest.title}** is the only job I can score. It's ${state}, at **${lowest.margin.toFixed(1)}%** margin.`;
  }
  const next = rows[1];
  return `**${lowest.title}** has the lowest margin. It's ${state}, at **${lowest.margin.toFixed(1)}%**. Next is **${next.title}** at **${next.margin.toFixed(1)}%**.`;
}

function buildCentralCommandReadOnlyReply(message = '', projectName = '') {
  const name = String(projectName || '').trim();
  const job = name ? ` for **${name}**` : '';
  const text = String(message || '');
  if (/\b(inspection|delivery|meeting|appointment)\b/i.test(text)) {
    return `I can't add that from here. Open the project Timeline${job} and put it on the calendar. I can still tell you what's already scheduled.`;
  }
  if (/\bpurchase\s+orders?\b|\bpo\b/i.test(text)) {
    return `I can't create that from here. Open the project Budget${job} and add the purchase order there. I can still tell you which orders are already open.`;
  }
  if (/\b(labor|labour)\b/i.test(text)) {
    return `I can't log that from here. Open the project Budget${job} and record it as labor. I can still tell you the labor budget and what's been spent.`;
  }
  if (/\b(material|materials|lumber|expense|spent|bought|purchased)\b/i.test(text)) {
    return `I can't record that from here. Open the project Budget${job} and add it as material. I can still tell you the material budget and what's been spent.`;
  }
  if (/\bchange\s+orders?\b/i.test(text)) {
    return `I can't create a change order from here. Add it on the project Budget${job}. I can still tell you whether this job already has change orders.`;
  }
  if (/\bpayments?\b/i.test(text)) {
    return `I can't update a payment from here. Change it on the project Timeline${job}. I can still tell you what's overdue and what's coming in.`;
  }
  return `I can't change saved data from here. Open the project Budget${job} to record material, labor, or a purchase order, or the Timeline to add a date. I can still answer questions about the numbers.`;
}

function trySnapshotTopicReply(message, ctx = {}) {
  if (isMarkupMarginDefinitionQuestion(message)) return buildMarkupMarginDefinitionReply();
  if (isCashFlowConceptQuestion(message)) {
    return buildCashFlowConceptReply(
      projectForCentralCommandIntent(ctx.projects, ctx.parsedContext),
      ctx.parsedContext || {},
      ctx.now || new Date()
    );
  }
  if (isProfitGuaranteeQuestion(message)) {
    return buildProfitGuaranteeReply(
      projectForCentralCommandIntent(ctx.projects, ctx.parsedContext),
      ctx.parsedContext || {},
      ctx.now || new Date()
    );
  }
  if (isPortfolioWorstProjectQuery(message)) {
    return buildLowestMarginReply(ctx.projects);
  }
  if (isPortfolioFocusTodayQuery(message)) {
    return buildFocusTodayReply(ctx.projects, ctx.now || new Date());
  }
  if (isHypotheticalPriceQuestion(message)) return buildHypotheticalPriceReply(message);
  const priceRecalc = buildPriceRecalcReply(message, ctx.history);
  if (priceRecalc) return priceRecalc;
  if (isPercentChangeQuestion(message)) {
    const project = projectForCentralCommandIntent(ctx.projects, ctx.parsedContext);
    const changeReply = project ? buildPercentChangeReply(message, project, ctx.parsedContext || {}) : null;
    if (changeReply) return changeReply;
  }
  if (isWorryQuery(message)) {
    return buildWorryReply(ctx.projects, { now: ctx.now || new Date() });
  }
  const choice = classifyCentralCommandIntent(message);
  if (choice && choice.intent !== 'unknown') {
    const reply = buildCentralCommandIntentReply(choice, ctx);
    if (reply) return reply;
  }
  return unknownFutureCostReply(message, projectForCentralCommandIntent(ctx.projects, ctx.parsedContext));
}

function buildCentralCommandJobIndex(projects) {
  const list = Array.isArray(projects) ? projects : [];
  if (!list.length) return 'JOB INDEX:\nNo jobs are loaded in this conversation.';
  const lines = list.map((project) => {
    const title = project?.title || project?.name || 'Untitled';
    const status = resolveProjectStatus(project) || 'unknown';
    const id = project?.id != null ? String(project.id) : '';
    return `- ${title}${id ? ` (id ${id})` : ''} — ${status}`;
  });
  return `JOB INDEX (names and status only):\n${lines.join('\n')}`;
}

function centralCommandJobToolDefinitions() {
  const properties = {
    projectId: {
      type: 'string',
      description: 'Project id from the job index. Use the current job when the contractor says my or this job.',
    },
    projectName: {
      type: 'string',
      description: 'Project name when the contractor names a job.',
    },
  };
  const tool = (name, description) => ({
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties },
    },
  });
  return [
    tool('get_project_budget', 'Read one job budget: contract, cost budget, spent, labor, material, and project overhead. Call this before stating a budget dollar amount.'),
    tool('get_payment_schedule', 'Read one job payment schedule: collected, overdue, and upcoming amounts with dates. Call this before stating a payment amount or date.'),
    tool('get_change_orders', 'Read change orders on one job. Call this before stating a change-order count or amount.'),
  ];
}

function resolveCentralCommandToolProject(projects, parsedContext = {}, args = {}) {
  const list = Array.isArray(projects) ? projects : [];
  const id = args?.projectId || parsedContext?.projectId || parsedContext?.activeProjectId;
  if (id != null && String(id).trim()) {
    const byId = list.find((project) => String(project?.id) === String(id));
    if (byId) return byId;
  }
  const name = args?.projectName || parsedContext?.currentProject || parsedContext?.projectName || parsedContext?.projectTitle;
  if (name) {
    const resolved = resolveProjectByQuery(list, name, { minScore: 35 });
    if (resolved?.project) return resolved.project;
  }
  return list.length === 1 ? list[0] : null;
}

function buildCentralCommandBudgetToolResult(project, parsedContext = {}) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const context = isCurrentProjectMatch(project, parsedContext) ? parsedContext : {};
  const snapshot = getProjectFinancialSnapshot({ project, parsedContext: context });
  const roundMoney = (value) => (value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value)));
  const roundPct = (value) => (value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 10) / 10);
  return {
    success: true,
    projectId: project.id != null ? String(project.id) : null,
    projectName: project.title || project.name || 'This project',
    contract: roundMoney(snapshot.revenue),
    costBudget: roundMoney(snapshot.estimatedCost),
    spent: roundMoney(snapshot.spent),
    laborBudget: roundMoney(categoryBudgetAmount(project, context, 'labor')),
    materialBudget: roundMoney(categoryBudgetAmount(project, context, 'material')),
    overheadBudget: roundMoney(projectOverheadAmount(project, context)),
    projectedProfit: roundMoney(snapshot.projectedProfit),
    marginPct: roundPct(snapshot.projectedMarginPct),
  };
}

function buildCentralCommandPaymentToolResult(project, parsedContext = {}, now = new Date()) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const context = isCurrentProjectMatch(project, parsedContext) ? parsedContext : {};
  const buckets = collectPaymentBuckets({
    parsedContext: context,
    projects: [project],
    currentProject: project,
    now,
    currentProjectIsCompleted: isTerminalProjectStatus(project?.status || context?.status),
  });
  const slim = (row) => ({
    name: row?.name || 'Payment',
    amount: Math.round(Number(row?.amount || 0)),
    date: row?.date || null,
  });
  return {
    success: true,
    projectId: project.id != null ? String(project.id) : null,
    projectName: project.title || project.name || 'This project',
    collected: (buckets.collected || []).map(slim),
    overdue: (buckets.overdue || []).map(slim),
    upcoming: (buckets.upcoming || []).map(slim),
  };
}

function buildCentralCommandChangeOrderToolResult(project) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const rows = [
    ...(Array.isArray(project?.changeOrders) ? project.changeOrders : []),
    ...(Array.isArray(project?.projectData?.changeOrders) ? project.projectData.changeOrders : []),
  ];
  return {
    success: true,
    projectId: project.id != null ? String(project.id) : null,
    projectName: project.title || project.name || 'This project',
    count: rows.length,
    changeOrders: rows.map((row) => ({
      title: row?.title || row?.name || row?.description || 'Change order',
      amount: Math.round(Number(row?.amount || row?.total || 0)),
      status: row?.status || 'unknown',
    })),
  };
}

function executeCentralCommandReadTool(name, args, { projects, parsedContext, now } = {}) {
  const project = resolveCentralCommandToolProject(projects, parsedContext, args || {});
  if (name === 'get_project_budget') return buildCentralCommandBudgetToolResult(project, parsedContext);
  if (name === 'get_payment_schedule') return buildCentralCommandPaymentToolResult(project, parsedContext, now || new Date());
  if (name === 'get_change_orders') return buildCentralCommandChangeOrderToolResult(project);
  if (name === 'get_estimate_lines') return buildCentralCommandEstimateToolResult(project);
  if (name === 'get_purchase_orders') return buildCentralCommandPurchaseOrderToolResult(project);
  if (name === 'get_expenses') return buildCentralCommandExpenseToolResult(project);
  if (name === 'get_calendar') return buildCentralCommandCalendarToolResult(project, now || new Date());
  return { success: false, error: 'Unknown read tool' };
}

function lineMoney(line) {
  return Math.round(Number(line?.total ?? line?.totalCost ?? line?.amount ?? line?.cost ?? 0));
}

function buildCentralCommandEstimateToolResult(project) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const estimate = project.estimateData || project.projectData?.estimateData || {};
  const materials = Array.isArray(estimate.materialLineItems) ? estimate.materialLineItems : [];
  const labor = Array.isArray(estimate.laborLineItems) ? estimate.laborLineItems : [];
  const slim = (line) => ({
    name: line?.name || line?.description || 'Line',
    amount: lineMoney(line),
  });
  return {
    success: true,
    projectName: project.title || project.name || 'This project',
    materialLines: materials.slice(0, 20).map(slim),
    laborLines: labor.slice(0, 20).map(slim),
  };
}

function buildCentralCommandPurchaseOrderToolResult(project) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const rows = [
    ...(Array.isArray(project.purchaseOrders) ? project.purchaseOrders : []),
    ...(Array.isArray(project.projectData?.purchaseOrders) ? project.projectData.purchaseOrders : []),
  ];
  const open = rows.filter((order) => isPurchaseOrderOpen(order));
  return {
    success: true,
    projectName: project.title || project.name || 'This project',
    openCount: open.length,
    purchaseOrders: open.slice(0, 20).map((order) => ({
      vendor: order?.vendor || order?.supplier || 'Vendor',
      amount: Math.round(Number(order?.amount || order?.total || 0)),
      status: order?.status || 'pending',
    })),
  };
}

function buildCentralCommandExpenseToolResult(project) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const rows = [
    ...(Array.isArray(project.expenses) ? project.expenses : []),
    ...(Array.isArray(project.projectData?.expenses) ? project.projectData.expenses : []),
  ];
  return {
    success: true,
    projectName: project.title || project.name || 'This project',
    count: rows.length,
    expenses: rows.slice(0, 20).map((expense) => ({
      vendor: expense?.vendor || '',
      category: expense?.category || '',
      amount: Math.round(Number(expense?.amount || 0)),
    })),
  };
}

function buildCentralCommandCalendarToolResult(project, now = new Date()) {
  if (!project) return { success: false, error: 'No project matched. Ask which job.' };
  const events = [
    ...(Array.isArray(project.calendarEvents) ? project.calendarEvents : []),
    ...(Array.isArray(project.projectData?.calendarEvents) ? project.projectData.calendarEvents : []),
  ].filter((event) => !event?.completed);
  return {
    success: true,
    projectName: project.title || project.name || 'This project',
    asOf: now.toISOString(),
    events: events.slice(0, 20).map((event) => ({
      title: event?.title || event?.type || 'Event',
      date: event?.date || null,
      type: event?.type || 'other',
    })),
  };
}

function centralCommandNeedsJobGrounding(message) {
  const q = String(message || '');
  if (!q.trim() || isCentralCommandConceptQuestion(q)) return false;
  if (isHypotheticalPriceQuestion(q) || isPriceRecalcFollowUp(q)) return false;
  const aboutBooks = /\b(?:job|project|budget|overhead|margin|payments?|estimate|spent|profit|invoice|retainage|allowance|contingency|change orders?)\b/i.test(q);
  const possessive = /\b(?:my|our|this)\b/i.test(q);
  return aboutBooks && possessive;
}

function centralCommandGroundedNumbers(toolResults) {
  const allowed = new Set();
  const text = (Array.isArray(toolResults) ? toolResults : []).map((result) => JSON.stringify(result)).join(' ');
  const matches = text.match(/\d+(?:\.\d+)?/g) || [];
  matches.forEach((raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    allowed.add(Math.round(value));
    allowed.add(Math.round(value * 10) / 10);
  });
  return allowed;
}

function centralCommandReplyIsUngrounded(reply, toolResults) {
  const amounts = String(reply || '').match(/\$\s?[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*%/g) || [];
  if (!amounts.length) return false;
  const allowed = centralCommandGroundedNumbers(toolResults);
  return amounts.some((token) => {
    const value = Number(String(token).replace(/[$,%\s]/g, '').replace(/,/g, ''));
    if (!Number.isFinite(value)) return true;
    return !allowed.has(Math.round(value)) && !allowed.has(Math.round(value * 10) / 10);
  });
}

function isCentralCommandConceptQuestion(text) {
  const q = String(text || '');
  if (/\b(?:what(?:'s| is) my|how much|how many)\b/i.test(q)) return false;
  return /\b(?:why|explain|what(?:'s| is) the difference|difference between|what does .{0,48} mean|what is (?:a|an) )\b/i.test(q);
}

function isCentralCommandFigureQuestion(text) {
  const q = String(text || '');
  if (isCentralCommandConceptQuestion(q)) return false;
  return (
    /\b(?:how much|how many|what(?:'s| is) (?:my|the|our)|when (?:is|are|does|do|did)|what date|which date)\b/i.test(q) ||
    /\b(?:retainage|allowance|contingency|soft costs?|invoice)\b/i.test(q)
  );
}

/**
 * Null means an earlier handler owns the question, or it is ordinary chat.
 * figure: ask for a number we did not wire. concept: explain the idea, with no job figures.
 */
function centralCommandFallbackKind(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  if (/\b(?:health\s+check|full breakdown)\b/i.test(text)) return null;
  if (/\bwhat[- ]if\b/i.test(text) || isPercentChangeQuestion(text)) return null;
  if (centralCommandIntentExcluded(text)) return null;
  if (isMarkupMarginDefinitionQuestion(text) || isCashFlowConceptQuestion(text) || isProfitGuaranteeQuestion(text)) return null;
  if (isCalendarEventCreateQuery(text)) return null;
  if (isCentralCommandConceptQuestion(text)) return 'concept';
  if (isCentralCommandFigureQuestion(text)) return 'figure';
  return null;
}

function buildCentralCommandFigureFallback(projectName = '') {
  const title = String(projectName || '').trim();
  const job = title ? ` on **${title}**` : '';
  return `I don't have that figure${job}, so I won't guess it. I can answer from the budget, the payments, or the calendar when those numbers are actually there.`;
}

function isUngroundedCentralCommandMoneyQuestion(message) {
  const text = String(message || '');
  if (/\bhealth\s+check\b/i.test(text)) return false;
  if (/\b(what[- ]if|scenario|typical friction|bad remodel|runs long)\b/i.test(text)) return false;
  if (/\b(compare|losing money|calendar|receipt|1099|w-9|w-2)\b/i.test(text)) return false;
  return (
    /\bmargin\b/i.test(text) ||
    /\bforecast\b/i.test(text) ||
    /\b(over|under)\s+budget\b/i.test(text) ||
    /\bhow much (?:did|have) (?:i|we) pay\b/i.test(text) ||
    /\bwho did i pay\b/i.test(text) ||
    /\b(?:projected|expected)\s+profit\b/i.test(text) ||
    /\boriginal\s+(?:estimate|forecast|projection)\b/i.test(text)
  );
}

module.exports = {
  normalizeAiMessageForIntent,
  isPortfolioLosingMoneyQuery,
  isPortfolioOverBudgetListQuery,
  isBadOutcomeScenarioQuery,
  isCalculationFollowUpQuery,
  isExplicitExpenseLogQuery,
  shouldContinueExpenseWorkflow,
  parseCustomRemainingCostIncrease,
  buildRemainingCostIncreaseReply,
  isPortfolioBudgetRisksQuery,
  isSimpleProjectBudgetStatusQuery,
  isPortfolioCompareActiveQuery,
  isPortfolioActiveFilterQuery,
  isPortfolioFocusTodayQuery,
  isPortfolioWorstProjectQuery,
  isCalendarEventCreateQuery,
  isCalendarCreateFollowUp,
  shouldUseCalendarCreateParser,
  isCalendarEventsListQuery,
  calendarEventTypeFilterFromMessage,
  isProjectActiveForCalendarEvents,
  collectUpcomingCalendarEvents,
  buildCalendarEventsReply,
  buildCalendarAndPaymentsCombinedReply,
  parseCalendarEventCreate,
  sortCompareProjectsResults,
  formatMarginReply,
  normalizeMoneyValue,
  normalizeNonNegativeMoneyValue,
  CENTRAL_COMMAND_READONLY_TOOLS,
  isCentralCommandReadOnlyTool,
  normalizeProjectStatus,
  isTerminalProjectStatus,
  isActiveProjectStatus,
  getProjectSpendBreakdown,
  getApprovedChangeOrdersTotal,
  getProjectMilestones,
  getPaymentDateValue,
  isPaymentCollectedForAI,
  getProjectFinancialSnapshot,
  buildMakingEnoughReply,
  buildProjectedProfitReply,
  computeMarginAtProgress,
  buildMarginAtProgressReply,
  buildMarginReplyForProject,
  buildFinishedJobForecastReply,
  buildLiveForecastReply,
  buildSeparatePayeeReply,
  finishedJobActualsNote,
  isUngroundedCentralCommandMoneyQuestion,
  centralCommandFallbackKind,
  buildCentralCommandFigureFallback,
  buildCentralCommandJobIndex,
  centralCommandJobToolDefinitions,
  executeCentralCommandReadTool,
  centralCommandNeedsJobGrounding,
  centralCommandReplyIsUngrounded,
  classifyCentralCommandIntent,
  needsCentralCommandIntentModel,
  parseCentralCommandIntentChoice,
  buildCentralCommandIntentReply,
  trySnapshotTopicReply,
  isHypotheticalPriceQuestion,
  isPriceRecalcFollowUp,
  buildCentralCommandReadOnlyReply,
  normalizeProjectSearchText,
  rankProjectsByQuery,
  resolveProjectByQuery,
  isCurrentProjectMatch,
  collectPaymentBuckets,
  overduePaymentBriefLine,
  buildHealthPaymentInsights,
  buildPaymentStatusReply,
  buildRemainingBudgetReply,
  buildBudgetStatusReply,
  buildPortfolioLosingMoneyReply,
  buildProjectProfitLeaks,
  buildDailyCommandCenter,
  buildProfitLeakPromptBlock,
  analyzePortfolioProject,
  buildPortfolioComparisonReply,
  buildPortfolioOverBudgetReply,
  buildProjectBudgetExplanationReply,
  buildPortfolioBudgetRisksReply,
  buildPortfolioBudgetRisksReplyForProjects,
  buildDataFreshnessFooter,
  appendDataFreshness,
  isCentralCommandMutationRequest,
  buildPortfolioNextActions,
  runCompareProjectsPipeline,
};
