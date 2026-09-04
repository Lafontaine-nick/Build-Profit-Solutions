const {
  analyzePortfolioProject,
  buildDailyCommandCenter,
  parseCalendarEventCreate,
  runCompareProjectsPipeline,
  buildPortfolioComparisonReply,
  buildPortfolioOverBudgetReply,
  buildProjectBudgetExplanationReply,
  buildPortfolioBudgetRisksReply,
  buildPortfolioBudgetRisksReplyForProjects,
  isCentralCommandMutationRequest,
  appendDataFreshness,
  buildBudgetStatusReply,
  buildMakingEnoughReply,
  buildProjectedProfitReply,
  getProjectFinancialSnapshot,
  getProjectMilestones,
  collectPaymentBuckets,
  isPaymentCollectedForAI,
  isCentralCommandReadOnlyTool,
  isPortfolioOverBudgetListQuery,
  isBadOutcomeScenarioQuery,
  isCalculationFollowUpQuery,
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

  test('over-budget list intent is distinct from a named project question', () => {
    expect(isPortfolioOverBudgetListQuery('Which projects are over budget?')).toBe(true);
    expect(isPortfolioOverBudgetListQuery('Why is the repaint project over budget?')).toBe(false);
  });

  test('recognizes natural-language downside and calculation follow-ups', () => {
    expect(isBadOutcomeScenarioQuery('What is my projected profit if things go bad?')).toBe(true);
    expect(isBadOutcomeScenarioQuery('What is my projected profit?')).toBe(false);
    expect(isCalculationFollowUpQuery('Show me the calculation')).toBe(true);
    expect(isCalculationFollowUpQuery('What should I focus on today?')).toBe(false);
  });

  test('over-budget reply lists only projects above their total cost budget', () => {
    const reply = buildPortfolioOverBudgetReply([
      {
        title: 'Over Job',
        status: 'in_progress',
        spent: 60000,
        budget: 50000,
        overBudgetPct: 20,
        progress: 60,
      },
      {
        title: 'Under Job',
        status: 'active',
        spent: 30000,
        budget: 50000,
        overBudgetPct: -40,
        progress: 60,
      },
    ]);

    expect(reply).toContain('Over Job');
    expect(reply).toContain('In progress');
    expect(reply).not.toContain('Under Job');
    expect(reply).toContain('Over budget by: $10,000.00');
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

  test('keeps projected profit and margin on the same cost basis', () => {
    const financials = getProjectFinancialSnapshot({
      project: {
        id: 'repaint-1',
        bidPrice: 32273.23,
        estimatedCost: 23534,
        progress: 100,
        projectedProfit: 3530,
        projectedMarginPct: 71.4,
        expenses: [{ amount: 25888 }],
      },
    });

    expect(financials.projectedProfit).toBe(6385.23);
    expect(financials.projectedMarginPct).toBeCloseTo(19.78, 2);
  });

  test('does not use another project context for a portfolio target', () => {
    const financials = getProjectFinancialSnapshot({
      project: {
        id: 'target',
        bidPrice: 10000,
        estimatedCost: 7000,
        expenses: [{ amount: 1000 }],
      },
      parsedContext: {
        projectId: 'other',
        contractValue: 50000,
        expenses: [{ amount: 49000 }],
      },
    });

    expect(financials.revenue).toBe(10000);
    expect(financials.spent).toBe(1000);
  });

  test('labels estimate-only and conflicting progress data instead of overstating certainty', () => {
    const financials = getProjectFinancialSnapshot({
      project: {
        id: 'closed-job',
        title: 'Closed Job',
        status: 'completed',
        bidPrice: 10000,
        estimatedCost: 7000,
        progress: 0,
        expenses: [],
      },
    });

    expect(financials.dataQuality.estimateOnlyForecast).toBe(true);
    expect(financials.dataQuality.progressStatusConflict).toBe(true);
    expect(buildMakingEnoughReply('Closed Job', financials.currentMarginPct, financials.dataQuality))
      .toContain('not a performance-based result');
    expect(buildProjectedProfitReply({
      projectName: 'Closed Job',
      projectedProfit: financials.projectedProfit,
      marginPct: financials.projectedMarginPct,
      dataQuality: financials.dataQuality,
    })).toContain('confirm that status');
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

  test('excludes estimate drafts and deleted projects from portfolio comparisons', () => {
    const result = runCompareProjectsPipeline({
      allProjects: [
        { id: 'active-1', title: 'Active Job', status: 'active', bidPrice: 100, estimatedCost: 80 },
        { id: 'done-1', title: 'Finished Job', status: 'completed', bidPrice: 100, estimatedCost: 80 },
        { id: 'est-1', title: 'Old Estimate', status: 'estimate', bidPrice: 100, estimatedCost: 80 },
        { id: 'deleted-1', title: 'Deleted Job', status: 'completed', bidPrice: 100, estimatedCost: 80 },
        { id: 'new-1', title: 'Deleted Job', status: 'active', bidPrice: 100, estimatedCost: 80 },
      ],
      parsedContext: {
        deletedProjectIds: ['deleted-1'],
        deletedProjectTitles: ['Deleted Job'],
      },
    });

    expect(result.projects.map((project) => project.title).sort()).toEqual([
      'Active Job',
      'Deleted Job',
      'Finished Job',
    ]);
  });

  test('budget risks reply focuses on active alerts, not full comparison', () => {
    const rows = [
      {
        title: 'Active Job',
        status: 'active',
        progress: 40,
        margin: 18,
        spent: 12000,
        budget: 10000,
        overBudgetPct: 20,
        riskFlags: ['over_budget'],
        profitLeaks: [{ type: 'over_budget' }],
      },
      {
        title: 'Healthy Job',
        status: 'active',
        progress: 50,
        margin: 22,
        spent: 4000,
        budget: 10000,
        overBudgetPct: 0,
        riskFlags: [],
        profitLeaks: [],
      },
      {
        title: 'Done Job',
        status: 'completed',
        progress: 100,
        margin: 30,
        spent: 9000,
        budget: 10000,
        overBudgetPct: 0,
        riskFlags: ['over_budget'],
        profitLeaks: [],
      },
    ];

    const compareReply = buildPortfolioComparisonReply(rows);
    const budgetReply = buildPortfolioBudgetRisksReply(rows);

    expect(compareReply).toContain('profitability and risk');
    expect(compareReply).toContain('Healthy Job');
    expect(budgetReply).toContain('Budget alert summary');
    expect(budgetReply).toContain('Active Job');
    expect(budgetReply).not.toContain('Healthy Job');
    expect(budgetReply).not.toContain('profitability and risk');
  });

  test('budget risks reply includes closeout line overruns from dashboard insights', () => {
    const allProjects = [
      {
        id: 'repaint-1',
        title: 'Interior and Exterior House Repaint',
        status: 'completed',
        progress: 100,
        estimatedCost: 7312,
        estimateData: {
          materialLineItems: [
            { id: 'walls', name: 'Walls — materials', total: 1306.5 },
            { id: 'prep', name: 'Prep & Masking — materials', total: 270 },
          ],
        },
        buckets: [{ name: 'Materials/Equipment', budget: 7312, spent: 4235 }],
        expenses: [
          { id: 'e1', category: 'Materials', amount: 1600, linkedLineId: 'walls' },
          { id: 'e2', category: 'Materials', amount: 280, linkedLineId: 'prep' },
        ],
      },
    ];

    const budgetReply = buildPortfolioBudgetRisksReplyForProjects(allProjects, {});

    expect(budgetReply).toContain('completed jobs with estimate lines to review');
    expect(budgetReply).toContain('Walls — materials');
    expect(budgetReply).toContain('Prep & Masking');
    expect(budgetReply).not.toContain('No active budget alerts right now');
  });

  test('isPortfolioBudgetRisksQuery matches alert prompts but not compare-all', () => {
    const { isPortfolioBudgetRisksQuery } = require('../aiAssistantCore');
    expect(isPortfolioBudgetRisksQuery('Which projects have budget risks? Show me specifics.')).toBe(true);
    expect(isPortfolioBudgetRisksQuery('Compare all my projects for profitability and risk')).toBe(false);
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
