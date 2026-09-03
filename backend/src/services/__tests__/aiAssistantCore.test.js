const {
  analyzePortfolioProject,
  buildDailyCommandCenter,
  parseCalendarEventCreate,
  runCompareProjectsPipeline,
  buildPortfolioComparisonReply,
  isCentralCommandMutationRequest,
  appendDataFreshness,
  buildBudgetStatusReply,
  getProjectFinancialSnapshot,
  getProjectMilestones,
  collectPaymentBuckets,
  isPaymentCollectedForAI,
  isCentralCommandReadOnlyTool,
} = require('../aiAssistantCore');
const {
  deepClone,
  rankingProjects,
  dashboardProjects,
} = require('../../../test-fixtures/aiEvalFixtures');

describe('aiAssistantCore', () => {
  test('builds a daily brief from deterministic profit leak signals', () => {
    const analyzed = deepClone(dashboardProjects).map((project) =>
      analyzePortfolioProject(project, {
        compareItem: { margin: project.margin },
        now: new Date('2026-04-10T00:00:00.000Z'),
      })
    );

    const dailyBrief = buildDailyCommandCenter(analyzed);

    expect(dailyBrief.topProfitRisks[0].headline).toContain('Copper Valley Rehab');
    expect(dailyBrief.topActions[0].label).toContain('Copper Valley Rehab');
    expect(dailyBrief.upcomingPayments[0].name).toBe('Final Draw');
    expect(dailyBrief.portfolioSummary.activeProjectCount).toBe(2);
    expect(dailyBrief.portfolioSummary.highestRiskProject).toBe('Copper Valley Rehab');
  });

  test('uses completed-project labels and avoids active leak flags for closed work', () => {
    const completedProject = {
      id: 'closed-1',
      title: 'Silver leaf project',
      status: 'completed',
      bidPrice: 120000,
      estimatedCost: 95000,
      actualCost: 100000,
      progress: 100,
      milestones: [{ title: 'Final Draw', amount: 15000, dueDate: '2026-04-20', collected: true }],
      expenses: [{ id: 'r1', amount: 5000 }],
    };

    const analyzed = analyzePortfolioProject(completedProject, {
      compareItem: { margin: 16.7 },
    });

    expect(analyzed.marginLabel).toBe('Margin');
    expect(analyzed.profitLabel).toBe('Net Profit');
    expect(analyzed.profitLeaks).toEqual([]);
  });

  test('compare pipeline keeps low-margin ranking and returns a daily brief', () => {
    const pipeline = runCompareProjectsPipeline({
      allProjects: deepClone(rankingProjects),
      parsedContext: {},
      args: { sortBy: 'lowMargin' },
    });

    expect(pipeline.success).toBe(true);
    expect(pipeline.sorted[0].title).toBe('Beta');
    expect(pipeline.dailyBrief.topProfitRisks[0].projectTitle).toBe('Beta');
    expect(pipeline.dailyBrief.topActions.length).toBeGreaterThan(0);
  });

  test('portfolio comparison scopes attention to active work and preserves profit labels', () => {
    const reply = buildPortfolioComparisonReply([
      {
        title: 'Active Job',
        status: 'active',
        revenue: 100000,
        projectedProfit: 20000,
        margin: 20,
        marginLabel: 'Current margin',
        profitLabel: 'Projected Profit',
        missingReceipts: 1,
        riskFlags: ['missing_receipts'],
      },
      {
        title: 'Closed Job',
        status: 'completed',
        revenue: 80000,
        projectedProfit: 30000,
        margin: 37.5,
        marginLabel: 'Margin',
        profitLabel: 'Net Profit',
        missingReceipts: 2,
        riskFlags: ['missing_receipts'],
      },
    ]);

    expect(reply).toContain('Current attention flags use active projects only (1 active)');
    expect(reply).toContain('Active Job');
    expect(reply).not.toContain('Closed Job — upload missing receipts');
    expect(reply).toContain('Projected Profit: $20,000.00');
    expect(reply).toContain('Net Profit: $30,000.00');
  });

  test('generic calendar create requests ask for both event details and date', () => {
    const parsed = parseCalendarEventCreate('Can you create an event for my calendar?', {
      allProjects: [{ id: 'p1', title: 'Duplex Build' }],
      parsedContext: { projectId: 'p1', currentProject: 'Duplex Build' },
      history: [],
    });

    expect(parsed.needsMore).toBe('details_and_date');
    expect(parsed.ok).toBe(false);
  });

  test('date-only follow-up does not become the calendar event title', () => {
    const parsed = parseCalendarEventCreate('May 25, 2026', {
      allProjects: [{ id: 'p1', title: 'Duplex Build' }],
      parsedContext: { projectId: 'p1', currentProject: 'Duplex Build' },
      history: [{ role: 'user', content: 'Can you create an event for my calendar?' }],
    });

    expect(parsed.needsMore).toBe('details');
    expect(parsed.event.title).not.toBe('2026');
  });

  test('identifies Central Command mutation requests before tool execution', () => {
    expect(isCentralCommandMutationRequest('Add a $450 lumber expense from Lowe’s')).toBe(true);
    expect(isCentralCommandMutationRequest('Mark the final payment collected')).toBe(true);
    expect(isCentralCommandMutationRequest('Change the budget for the kitchen project')).toBe(true);
    expect(isCentralCommandMutationRequest('Which project has the lowest margin?')).toBe(false);
    expect(isCentralCommandMutationRequest('How much have I spent on materials?')).toBe(false);
  });

  test('keeps freshness metadata attached to deterministic answers', () => {
    const reply = appendDataFreshness('Portfolio totals are available.', {
      snapshotAt: '2026-09-03T18:00:00.000Z',
    });

    expect(reply).toContain('Portfolio totals are available.');
    expect(reply).toContain('2026-09-03 18:00 UTC');
    expect(reply).toContain('Pull to refresh');
  });

  test('does not manufacture a budget answer when the budget is unavailable', () => {
    expect(buildBudgetStatusReply({ projectName: 'Unpriced Job', spent: 1200 })).toBeNull();
  });

  test('uses realized spend for completed projects without progress', () => {
    const analyzed = analyzePortfolioProject({
      id: 'closed-no-progress',
      title: 'Closed Remodel',
      status: 'completed',
      bidPrice: 120000,
      estimatedCost: 95000,
      actualCost: 100000,
    });
    expect(analyzed.profitLabel).toBe('Net Profit');
    expect(analyzed.projectedProfit).toBe(20000);
    expect(analyzed.estimatedProfit).toBe(25000);
  });

  test('keeps undated payments unscheduled instead of overdue', () => {
    const buckets = collectPaymentBuckets({
      currentProject: {
        id: 'p1',
        title: 'Unscheduled Remodel',
        status: 'active',
        milestones: [{ title: 'Final draw', amount: 5000 }],
      },
      now: new Date('2026-09-03T00:00:00.000Z'),
    });
    expect(buckets.overdue).toHaveLength(0);
    expect(buckets.unscheduled).toHaveLength(1);
  });

  test('does not treat unpaid or incomplete statuses as collected', () => {
    expect(isPaymentCollectedForAI({ status: 'unpaid' })).toBe(false);
    expect(isPaymentCollectedForAI({ status: 'incomplete' })).toBe(false);
    expect(isPaymentCollectedForAI({ status: 'paid' })).toBe(true);
  });

  test('uses expense and received PO spend while excluding pending POs', () => {
    const financials = getProjectFinancialSnapshot({
      project: {
        bidPrice: 50000,
        estimatedCost: 30000,
        expenses: [{ amount: 4000 }],
        purchaseOrders: [
          { amount: 3000, status: 'received' },
          { amount: 2000, status: 'pending' },
        ],
      },
    });
    expect(financials.spent).toBe(7000);
    expect(financials.committedPOs).toBe(2000);
  });

  test('does not let an empty milestone source mask a populated fallback', () => {
    expect(getProjectMilestones({
      milestones: [],
      projectData: { weeklyPayments: [{ title: 'Progress draw', amount: 2500 }] },
    })).toEqual([{ title: 'Progress draw', amount: 2500 }]);
  });

  test('allows only analytical tools in Central Command', () => {
    expect(isCentralCommandReadOnlyTool('compare_projects')).toBe(true);
    expect(isCentralCommandReadOnlyTool('run_scenario_analysis')).toBe(true);
    expect(isCentralCommandReadOnlyTool('add_material_expense')).toBe(false);
    expect(isCentralCommandReadOnlyTool('message_team_member')).toBe(false);
  });

  test('blocks common mutation wording before model routing', () => {
    expect(isCentralCommandMutationRequest('Put $450 of lumber on the kitchen job')).toBe(true);
    expect(isCentralCommandMutationRequest('Send a message to John saying call me')).toBe(true);
    expect(isCentralCommandMutationRequest('Place an order for $500 from Home Depot')).toBe(true);
    expect(isCentralCommandMutationRequest('Please schedule an inspection tomorrow')).toBe(true);
    expect(isCentralCommandMutationRequest('What if labor increases by $2,000?')).toBe(false);
  });

  test('uses weighted portfolio margin and preserves negative profit', () => {
    const result = runCompareProjectsPipeline({
      allProjects: [
        { id: 'positive', title: 'Positive', status: 'active', bidPrice: 100, estimatedCost: 80 },
        { id: 'loss', title: 'Loss', status: 'active', bidPrice: 100, estimatedCost: 110 },
      ],
    });

    expect(result.portfolioTotals.totalProjectedProfit).toBe(10);
    expect(result.portfolioTotals.averageMargin).toBe(5);
  });

  test('excludes a 100-percent project from active-only comparisons', () => {
    const result = runCompareProjectsPipeline({
      allProjects: [
        { id: 'finished', title: 'Finished', status: 'active', bidPrice: 100, estimatedCost: 80, progress: 100 },
        { id: 'open', title: 'Open', status: 'active', bidPrice: 100, estimatedCost: 80, progress: 50 },
      ],
      args: { activeOnly: true },
    });

    expect(result.projects.map((project) => project.title)).toEqual(['Open']);
  });

  test('comparison calculations do not mutate project context', () => {
    const project = {
      id: 'scenario-project',
      title: 'Scenario Project',
      status: 'active',
      bidPrice: 100000,
      estimatedCost: 70000,
      actualCost: 30000,
      progress: 40,
    };
    const before = JSON.stringify(project);
    runCompareProjectsPipeline({ allProjects: [project] });
    expect(JSON.stringify(project)).toBe(before);
  });
});
