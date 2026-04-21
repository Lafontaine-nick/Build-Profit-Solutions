const assert = require('node:assert/strict');
const {
  resolveProjectByQuery,
  isCurrentProjectMatch,
  getProjectFinancialSnapshot,
  collectPaymentBuckets,
  buildPaymentStatusReply,
  buildMarginReplyForProject,
  buildBudgetStatusReply,
  analyzePortfolioProject,
  buildPortfolioComparisonReply,
  formatMarginReply,
  buildProjectedProfitReply,
  computeMarginAtProgress,
  buildMarginAtProgressReply,
  isPortfolioLosingMoneyQuery,
  isPortfolioOverBudgetListQuery,
  isSimpleProjectBudgetStatusQuery,
  isPortfolioCompareActiveQuery,
  isPortfolioWorstProjectQuery,
  sortCompareProjectsResults,
  runCompareProjectsPipeline,
  appendDataFreshness,
  buildPortfolioNextActions,
  collectUpcomingCalendarEvents,
  isCalendarEventCreateQuery,
  parseCalendarEventCreate,
} = require('./src/services/aiAssistantCore');
const {
  deepClone,
  assistantQueryProjects,
  ambiguousProjects,
  rankingProjects,
  calendarProjects,
  calendarStatusProjects,
  calendarCreateProjects,
} = require('./test-fixtures/aiEvalFixtures');

if (!resolveProjectByQuery || !isCurrentProjectMatch || !getProjectFinancialSnapshot || !collectPaymentBuckets || !buildPaymentStatusReply || !buildMarginReplyForProject || !buildBudgetStatusReply || !analyzePortfolioProject || !buildPortfolioComparisonReply || !buildProjectedProfitReply || !computeMarginAtProgress || !buildMarginAtProgressReply || !isPortfolioLosingMoneyQuery || !sortCompareProjectsResults || !runCompareProjectsPipeline || !collectUpcomingCalendarEvents || !isCalendarEventCreateQuery || !parseCalendarEventCreate) {
  throw new Error('AI assistant test utilities are not available.');
}

// Portfolio intent phrases (Command Center / projects list)
assert.equal(isPortfolioLosingMoneyQuery('Where am I losing money across my active projects?'), true);
assert.equal(isPortfolioLosingMoneyQuery('Show me the biggest profit leak'), true);
assert.equal(isPortfolioOverBudgetListQuery('Which active projects are over budget and by how much?'), true);
assert.equal(isPortfolioOverBudgetListQuery('Show projects over budget'), true);
assert.equal(isSimpleProjectBudgetStatusQuery('Am I over budget on this job?'), true);
assert.equal(isSimpleProjectBudgetStatusQuery('Which projects are over budget?'), false, 'Portfolio list should not use single-project budget reply');
assert.equal(isPortfolioCompareActiveQuery('Compare my active projects'), true);
assert.equal(isPortfolioWorstProjectQuery('Which project is the worst?'), true);
assert.equal(isPortfolioWorstProjectQuery('Which job has the lowest margin?'), true);
assert.equal(isPortfolioWorstProjectQuery('Show me a worst-case scenario'), false, 'Worst-case estimate scenario is not portfolio worst-project intent');

const sortRows = [
  { title: 'A', margin: 20, overBudgetPct: 0, progress: 50, riskFlags: [] },
  { title: 'B', margin: 8, overBudgetPct: 15, progress: 30, riskFlags: ['over_budget'] },
  { title: 'C', margin: 12, overBudgetPct: 2, progress: 80, riskFlags: [] },
];
const byLowMargin = sortCompareProjectsResults(sortRows, 'lowMargin');
assert.equal(byLowMargin[0].title, 'B', 'lowMargin sort should surface lowest margin first');
const byOver = sortCompareProjectsResults(sortRows, 'overbudget');
assert.equal(byOver[0].title, 'B', 'overbudget sort should surface highest overrun first');

const projects = deepClone(assistantQueryProjects);

const resolvedJerry = resolveProjectByQuery(projects, 'Jerry');
assert.equal(resolvedJerry.project?.id, '1', 'Expected Jerry query to resolve Jerry Remodel');

const resolvedKitchen = resolveProjectByQuery(projects, 'kitchen upgrade');
assert.equal(resolvedKitchen.project?.id, '2', 'Expected kitchen query to resolve Jason Kitchen Upgrade');

const ambiguousResult = resolveProjectByQuery(deepClone(ambiguousProjects), 'oak');
assert.equal(ambiguousResult.project, null, 'Ambiguous project query should not auto-resolve');

assert.equal(
  isCurrentProjectMatch({ id: '1', title: 'Jerry Remodel' }, { projectId: '1', currentProject: 'Other Project' }),
  true,
  'Current project match should prefer projectId'
);

const financialSnapshot = getProjectFinancialSnapshot({ project: projects[0] });
assert.equal(Math.round(financialSnapshot.bidMarginPct * 10) / 10, 20.0, 'Bid margin should be 20.0%');
assert.equal(Math.round(financialSnapshot.spendToDateMarginPct * 10) / 10, 70.0, 'Spend-to-date margin should be 70.0%');
assert.equal(Math.round(financialSnapshot.projectedFinalCost), 75000, 'Projected final cost should use run-rate');

const marginReply = buildMarginReplyForProject(projects[0], {});
assert.match(marginReply.reply, /Spend-to-date:/, 'Margin reply should include spend-to-date');
assert.match(marginReply.reply, /Projected at completion:/, 'Margin reply should include projected margin');

const paymentBuckets = collectPaymentBuckets({
  projects,
  now: new Date('2026-03-10T12:00:00Z'),
});
assert.equal(paymentBuckets.upcoming.length, 2, 'Should detect two upcoming dated payments');
assert.equal(paymentBuckets.unscheduled.length, 1, 'Should detect one unscheduled payment');

const paymentReply = buildPaymentStatusReply({
  upcoming: paymentBuckets.upcoming,
  overdue: paymentBuckets.overdue,
  unscheduled: paymentBuckets.unscheduled,
  fallbackProjectName: 'Jerry Remodel',
});

assert.match(paymentReply, /Week 2 Payment/, 'Payment reply should mention the next payment');
assert.match(paymentReply, /Jerry Remodel|Jason Kitchen Upgrade/, 'Payment reply should include a project name');

const overdueBuckets = collectPaymentBuckets({
  projects: [
    {
      id: '3',
      title: 'Chris Basement Finish',
      milestones: [{ title: 'Deposit', amount: 9000, dueDate: '2026-03-01' }],
    },
  ],
  now: new Date('2026-03-10T12:00:00Z'),
});
const overdueReply = buildPaymentStatusReply({
  upcoming: overdueBuckets.upcoming,
  overdue: overdueBuckets.overdue,
  unscheduled: overdueBuckets.unscheduled,
  fallbackProjectName: 'Chris Basement Finish',
});
assert.match(overdueReply, /overdue payments/i, 'Overdue payment reply should mention overdue payments');

const portfolioProjects = deepClone(rankingProjects);

const analyzedPortfolio = portfolioProjects
  .map((project) => analyzePortfolioProject(project))
  .sort((a, b) => (a.currentMargin ?? 0) - (b.currentMargin ?? 0));

assert.equal(analyzedPortfolio[0].title, 'Beta', 'Lowest current margin project should be Beta');
assert.match(analyzedPortfolio[0].riskFlags.join(','), /over_budget/, 'Beta should be flagged over budget');

const overBudgetProjects = portfolioProjects.filter((project) => {
  const snapshot = getProjectFinancialSnapshot({ project });
  return snapshot.spent > snapshot.estimatedCost;
});
assert.deepEqual(overBudgetProjects.map((p) => p.title), ['Beta'], 'Only Beta should be over budget');

const budgetReply = buildBudgetStatusReply({ projectName: 'Beta', budget: 70000, spent: 79000 });
assert.match(budgetReply, /over budget/i, 'Budget reply should indicate over budget when spent exceeds budget');

const portfolioReply = buildPortfolioComparisonReply(analyzedPortfolio);
assert.match(portfolioReply, /comparison of all your projects/i, 'Portfolio reply should contain comparison heading');
assert.match(portfolioReply, /Beta/, 'Portfolio reply should mention lowest margin project');
assert.match(portfolioReply, /Portfolio totals/i, 'Portfolio reply should include portfolio totals');

const pipeline = runCompareProjectsPipeline({
  allProjects: portfolioProjects,
  parsedContext: {},
  args: { sortBy: 'lowMargin' },
});
assert.equal(pipeline.success, true);
assert.equal(pipeline.sorted[0].title, 'Beta', 'Pipeline lowMargin sort should match lowest margin project');

assert.match(appendDataFreshness('Hello', { snapshotAt: new Date('2026-03-01T12:00:00Z').toISOString() }), /as of/i);
assert.match(buildPortfolioNextActions(pipeline.sorted), /Suggested next moves/i);

const marginFmt = formatMarginReply({ spendToDatePct: 10, projectedPct: 12, originalEstPct: 15, projectedProfit: 1000 });
assert.match(marginFmt, /Spend-to-date margin/i, 'Margin summary should define spend-to-date vs projected');

const projectedProfitReply = buildProjectedProfitReply({
  projectName: 'Jerry Remodel',
  projectedProfit: 25000,
  marginPct: 18.5,
});
assert.match(projectedProfitReply, /Jerry Remodel/, 'Projected profit reply should include project name');
assert.match(projectedProfitReply, /25,000/, 'Projected profit reply should include projected profit');
assert.match(projectedProfitReply, /18.5%/, 'Projected profit reply should include margin percent');

const marginAtProgress = computeMarginAtProgress({
  contract: 100000,
  spent: 30000,
  estimatedCost: 80000,
  currentProgressPct: 40,
  targetProgressPct: 60,
});
assert.equal(Math.round(marginAtProgress.profitAtTarget), 55000, 'Margin-at-progress profit should scale from current burn');
const marginAtProgressReply = buildMarginAtProgressReply(marginAtProgress);
assert.match(marginAtProgressReply, /60% complete/, 'Margin-at-progress reply should mention target progress');
assert.match(marginAtProgressReply, /55,000/, 'Margin-at-progress reply should include projected profit at target');

const calEv = { date: '2026-03-15', title: 'Rough inspection', type: 'inspection' };
const calNow = new Date('2026-03-10T12:00:00Z');
const calFixtureProjects = deepClone(calendarProjects).map((project) => ({
  ...project,
  calendarEvents: [calEv],
}));
const calUpcoming = collectUpcomingCalendarEvents({
  allProjects: calFixtureProjects,
  now: calNow,
});
assert.equal(calUpcoming.length, 1, 'Completed projects should not contribute calendar events');
assert.equal(calUpcoming[0].projectId, 'active');

const calStatusFixtureProjects = deepClone(calendarStatusProjects).map((project) => ({
  ...project,
  calendarEvents: [calEv],
}));
const calUpcoming2 = collectUpcomingCalendarEvents({
  allProjects: calStatusFixtureProjects,
  now: calNow,
});
assert.equal(calUpcoming2.length, 1);
assert.equal(calUpcoming2[0].projectId, 'y');

assert.equal(isCalendarEventCreateQuery('Can we create an event?'), true, '"create an event" must match (not only "create a event")');
assert.equal(isCalendarEventCreateQuery('Please create an event for tomorrow'), true);
assert.equal(isCalendarEventCreateQuery('What is on my calendar?'), false);

const twoProjects = deepClone(calendarCreateProjects);
const p1 = parseCalendarEventCreate("Let's create an event for March 25", { allProjects: twoProjects, parsedContext: {}, history: [] });
assert.equal(p1.needsMore, 'details', 'After date, ask event name/type before project');
assert.ok(p1.event?.date, 'Should parse March 25 to ISO date');

const p2 = parseCalendarEventCreate('Electrical rough-in', {
  allProjects: twoProjects,
  parsedContext: {},
  history: [
    { role: 'user', content: "Let's create an event for March 25" },
  ],
});
assert.equal(p2.needsMore, 'project', 'Title from follow-up + date from history → ask project');
assert.ok(String(p2.event?.title || '').toLowerCase().includes('electrical') || String(p2.event?.title || '').toLowerCase().includes('rough'), 'Title should come from follow-up message');

const p3 = parseCalendarEventCreate('Jerry', {
  allProjects: twoProjects,
  parsedContext: {},
  history: [
    { role: 'user', content: "Let's create an event for March 25" },
    { role: 'user', content: 'Cabinet delivery' },
  ],
});
assert.equal(p3.needsMore, null, 'Should resolve project when title in history');
assert.equal(p3.projectId, 'j');

const metaHistory = [{ role: 'user', content: "Let's create an event" }];
const afterDateOnly = parseCalendarEventCreate('March 25', {
  allProjects: twoProjects,
  parsedContext: { lastOpenedProjectId: 'n' },
  history: metaHistory,
});
assert.equal(afterDateOnly.needsMore, 'details', 'Do not use prior "create an event" as title — ask for event name');
assert.ok(!String(afterDateOnly.event?.title || '').toLowerCase().includes('create an event'));

const metaOnly = parseCalendarEventCreate("Let's create an event", { allProjects: twoProjects, parsedContext: {}, history: [] });
assert.equal(metaOnly.needsMore, 'date', 'Meta-only first message needs date first');

console.log('AI assistant core verification passed.');
