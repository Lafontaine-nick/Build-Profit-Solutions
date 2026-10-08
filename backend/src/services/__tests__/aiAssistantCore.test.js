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
  buildMarginReplyForProject,
  buildFinishedJobForecastReply,
  buildSeparatePayeeReply,
  finishedJobActualsNote,
  classifyCentralCommandIntent,
  parseCentralCommandIntentChoice,
  buildCentralCommandIntentReply,
  trySnapshotTopicReply,
  isUngroundedCentralCommandMoneyQuestion,
  isCentralCommandMutationRequest,
  appendDataFreshness,
  buildRemainingBudgetReply,
  buildBudgetStatusReply,
  buildPortfolioLosingMoneyReply,
  isPortfolioLosingMoneyQuery,
  buildMakingEnoughReply,
  buildProjectedProfitReply,
  getProjectFinancialSnapshot,
  getProjectMilestones,
  collectPaymentBuckets,
  buildPaymentStatusReply,
  isPaymentCollectedForAI,
  isCentralCommandReadOnlyTool,
  isPortfolioOverBudgetListQuery,
  isPortfolioActiveFilterQuery,
  isBadOutcomeScenarioQuery,
  isCalculationFollowUpQuery,
  shouldContinueExpenseWorkflow,
  parseCustomRemainingCostIncrease,
  buildRemainingCostIncreaseReply,
  isCalendarEventsListQuery,
  isCalendarEventCreateQuery,
  shouldUseCalendarCreateParser,
} = require('../aiAssistantCore');
const {
  deepClone,
  rankingProjects,
  dashboardProjects,
} = require('../../../test-fixtures/aiEvalFixtures');

describe('aiAssistantCore', () => {
  test('recognizes budget variance as a calculation follow-up', () => {
    expect(isCalculationFollowUpQuery('Budget variance')).toBe(true);
  });

  test('recognizes margin as a calculation follow-up', () => {
    expect(isCalculationFollowUpQuery('Margin')).toBe(true);
  });

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
    expect(analyzed.profitLabel).toBe('Net profit');
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

    expect(reply).toContain('1 active job and 1 finished. Attention flags cover active jobs only.');
    expect(reply).toContain('Active Job');
    expect(reply).not.toContain('Closed Job — upload missing receipts');
    expect(reply).toContain('Projected Profit: $20,000.00');
    expect(reply).toContain('Net Profit: $30,000.00');
  });

  test('over-budget list intent is distinct from a named project question', () => {
    expect(isPortfolioOverBudgetListQuery('Which projects are over budget?')).toBe(true);
    expect(isPortfolioOverBudgetListQuery('Why is the repaint project over budget?')).toBe(false);
  });

  test('does not keep an abandoned expense workflow on a new question', () => {
    expect(shouldContinueExpenseWorkflow(
      'How is it going today?',
      'What type of expense are you logging?'
    )).toBe(false);
    expect(shouldContinueExpenseWorkflow(
      'What is my project profit for my completed jobs?',
      'What type of expense are you logging?'
    )).toBe(false);
    expect(shouldContinueExpenseWorkflow('Labor', 'What type of expense are you logging?')).toBe(true);
    expect(shouldContinueExpenseWorkflow('Add a $500 expense to Repaint', '')).toBe(true);
  });

  test('parses remaining-cost increases and does not stack them', () => {
    expect(parseCustomRemainingCostIncrease('What if remaining costs increase by 10%?')?.percent).toBe(10);
    expect(parseCustomRemainingCostIncrease('Actually, make that 20% instead.')?.percent).toBe(20);
    expect(parseCustomRemainingCostIncrease('Go back to the original forecast')?.type).toBe('restore');
    const reply = buildRemainingCostIncreaseReply({
      percent: 10,
      project: {
        title: 'Test Job',
        bidPrice: 30000,
        estimatedCost: 24000,
        totalSpent: 10000,
        progress: 0,
      },
    });
    expect(reply).toContain('$15,400');
    expect(reply).toContain('$25,400');
    expect(reply).toContain('$4,600');
    expect(reply).toContain('15.3%');
    expect(reply).toContain('does not change saved project data');
  });

  test('uses the original cost budget for an over-budget scenario', () => {
    const parsed = parseCustomRemainingCostIncrease('What if this job goes 20% over budget?');
    expect(parsed?.basis).toBe('budget');
    const reply = buildRemainingCostIncreaseReply({
      basis: parsed.basis,
      percent: parsed.percent,
      project: {
        title: 'Overrun Job',
        bidPrice: 30000,
        estimatedCost: 24000,
        totalSpent: 10000,
        progress: 50,
      },
    });
    expect(reply).toContain('Original cost budget: $24,000 → scenario cost budget: $28,800');
    expect(reply).toContain('Projected profit: $1,200');
  });

  test('recognizes natural-language downside and calculation follow-ups', () => {
    expect(isBadOutcomeScenarioQuery('What is my projected profit if things go bad?')).toBe(true);
    expect(isBadOutcomeScenarioQuery('What is my projected profit?')).toBe(false);
    expect(isCalculationFollowUpQuery('Show me the calculation')).toBe(true);
    expect(isCalculationFollowUpQuery('What should I focus on today?')).toBe(false);
  });

  test('recognizes active-project filtering as a portfolio follow-up', () => {
    expect(isPortfolioActiveFilterQuery('Only show me the active projects')).toBe(true);
    expect(isPortfolioActiveFilterQuery('Compare my active projects')).toBe(false);
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

  test('routes calendar reads and creates as calendar capabilities', () => {
    expect(isCalendarEventsListQuery('Do I have any upcoming event events on my calendar?')).toBe(true);
    expect(isCalendarEventCreateQuery('Can you create an event to my calendar?')).toBe(true);
    expect(shouldUseCalendarCreateParser('Can you create an event to my calendar?', [])).toBe(true);
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

  test('a 10% cost increase on a finished job is a hypothetical on the actual cost', () => {
    const reply = buildRemainingCostIncreaseReply({
      project: {
        id: 'done-1',
        title: 'Electrical Estimate Draft',
        status: 'completed',
        progress: 100,
        contractValue: 37550,
        actualCost: 20200,
      },
      percent: 10,
    });
    expect(reply).toContain('If costs had been 10% higher');
    expect(reply).toContain('does not change the saved job');
    expect(reply).toContain('$20,200 → $22,220');
    expect(reply).toContain('$17,350 → $15,330');
    expect(reply).toContain('40.8%');
  });

  test('a finished job remaining-cost question reports the unused budget', () => {
    const snapshot = getProjectFinancialSnapshot({
      project: {
        id: 'done-1',
        title: 'Electrical Estimate Draft',
        status: 'completed',
        progress: 100,
        contractValue: 37550,
        estimatedCost: 31925,
        actualCost: 20200,
      },
      parsedContext: { projectId: 'done-1' },
    });
    const reply = buildRemainingBudgetReply({
      projectName: 'Electrical Estimate Draft',
      snapshot,
    });
    expect(reply).toContain('**Finished under budget:** $11,725.00');
    expect(reply).toContain('$31,925.00');
    expect(reply).toContain('$20,200.00');
    expect(reply).toContain('actual result');
    expect(reply).not.toContain('Remaining');
  });

  test('an in-progress job still reports the cost still left', () => {
    const snapshot = getProjectFinancialSnapshot({
      project: {
        id: 'live-1',
        title: 'Kitchen',
        status: 'active',
        progress: 40,
        contractValue: 37550,
        estimatedCost: 31925,
        actualCost: 10000,
      },
      parsedContext: { projectId: 'live-1' },
    });
    const reply = buildRemainingBudgetReply({ projectName: 'Kitchen', snapshot });
    expect(reply).toContain('**Remaining:**');
    expect(reply).not.toContain('Finished under budget');
  });

  test('a finished job under budget does not say money is still remaining', () => {
    const reply = buildBudgetStatusReply({
      projectName: 'Electrical Estimate Draft',
      budget: 31925,
      spent: 20200,
      finished: true,
    });
    expect(reply).toContain('finished under budget');
    expect(reply).toContain('$20,200');
    expect(reply).not.toContain('remaining');
    expect(reply).not.toContain('PO commitments');
  });

  test('which projects are losing money answers from profit, including a finished job', () => {
    expect(isPortfolioLosingMoneyQuery('Which projects are losing money?')).toBe(true);
    const reply = buildPortfolioLosingMoneyReply([
      {
        id: 'done-1',
        title: 'Electrical Estimate Draft',
        status: 'completed',
        progress: 100,
        contractValue: 37550,
        actualCost: 20200,
      },
    ]);
    expect(reply).toContain('None of your jobs are losing money');
    expect(reply).toContain('Electrical Estimate Draft');
    expect(reply).toContain('$17,350');
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
    expect(analyzed.profitLabel).toBe('Net profit');
    expect(analyzed.projectedProfit).toBe(20000);
    expect(analyzed.estimatedProfit).toBe(25000);
  });

  test('a finished job with nothing owed says every payment was received', () => {
    const reply = buildPaymentStatusReply({
      upcoming: [],
      overdue: [],
      unscheduled: [],
      collectedCount: 0,
      finished: true,
      fallbackProjectName: 'Electrical Estimate Draft',
    });
    expect(reply).toContain("You've received all payments on **Electrical Estimate Draft**.");
    expect(reply).toContain('Nothing is left to collect.');
    expect(reply).not.toContain('Timeline');
  });

  test('payments still owed are listed with the amount and date', () => {
    const reply = buildPaymentStatusReply({
      upcoming: [{ name: 'Draw 2', projectTitle: 'Kitchen', amount: 5000, date: '2026-04-15' }],
      overdue: [{ name: 'Deposit', projectTitle: 'Kitchen', amount: 2000, date: '2026-03-01' }],
      unscheduled: [],
      fallbackProjectName: 'Kitchen',
    });
    expect(reply).toContain('overdue payments');
    expect(reply).toContain('**Deposit** — $2,000');
    expect(reply).toContain('**Draw 2** — $5,000');
    expect(reply).toContain('due April 15, 2026');
  });

  test('a pending draw stays owed even when its progress field is 100', () => {
    expect(isPaymentCollectedForAI({ title: 'Deposit', status: 'pending', progressPct: 100 })).toBe(false);
    expect(isPaymentCollectedForAI({ title: 'Week 1 Progress Payment', status: 'completed', progressPct: 100 })).toBe(true);
    const buckets = collectPaymentBuckets({
      currentProject: {
        id: 'live-1',
        title: 'Electrical Estimate Draft',
        status: 'active',
        milestones: [
          { title: 'Deposit', amount: 5492, status: 'pending', progressPct: 100, plannedDate: '2026-09-15' },
          { title: 'Week 1 Progress Payment', amount: 5149, status: 'pending', plannedDate: '2026-09-22' },
          { title: 'Week 2 Progress Payment', amount: 5149, status: 'pending', plannedDate: '2026-09-29' },
        ],
      },
      now: new Date('2026-10-07T18:00:00'),
    });
    const reply = buildPaymentStatusReply({
      ...buckets,
      fallbackProjectName: 'Electrical Estimate Draft',
    });
    expect(reply).toContain('**Deposit**');
    expect(reply).toContain('**Week 1 Progress Payment**');
    expect(reply).toContain('**Week 2 Progress Payment**');
  });

  test('payments already received are named before the ones still owed', () => {
    const buckets = collectPaymentBuckets({
      currentProject: {
        id: 'live-1',
        title: 'Electrical Estimate Draft',
        status: 'active',
        milestones: [
          { title: 'Deposit', amount: 5492, status: 'completed', collectedAt: '2026-10-07', plannedDate: '2026-09-15' },
          { title: 'Week 1 Progress Payment', amount: 5149, status: 'completed', plannedDate: '2026-09-22' },
          { title: 'Week 2 Progress Payment', amount: 5149, status: 'pending', plannedDate: '2026-09-29' },
        ],
      },
      now: new Date('2026-10-07T18:00:00'),
    });
    const reply = buildPaymentStatusReply({
      ...buckets,
      fallbackProjectName: 'Electrical Estimate Draft',
    });
    expect(reply).toContain('Already received:');
    expect(reply).toContain('**Deposit** — $5,492');
    expect(reply).toContain('**Week 1 Progress Payment** — $5,149');
    expect(reply.indexOf('Already received:')).toBeLessThan(reply.indexOf('overdue payments'));
    expect(reply).toContain('**Week 2 Progress Payment**');
    expect(reply).toContain('overdue, was due September 29, 2026');
  });

  test("today's brief names every overdue payment once, not just the first", () => {
    const { overduePaymentBriefLine } = require('../aiAssistantCore');
    const project = {
      title: 'Electrical Estimate Draft',
      milestones: [
        { title: 'Deposit', amount: 5492, status: 'completed', plannedDate: '2026-09-15' },
        { title: 'Week 2 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-09-29' },
        { title: 'Week 3 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-06' },
        { title: 'Week 4 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-13' },
      ],
    };
    const now = new Date('2026-10-07T16:00:00');
    expect(overduePaymentBriefLine(project, now))
      .toBe('2 payments are overdue on Electrical Estimate Draft ($10,298)');
    const oneLate = { ...project, milestones: project.milestones.slice(0, 2) };
    expect(overduePaymentBriefLine(oneLate, now))
      .toBe('Week 2 Progress Payment is overdue on Electrical Estimate Draft');
    expect(overduePaymentBriefLine({ ...project, milestones: project.milestones.slice(0, 1) }, now)).toBeNull();
  });

  test('health-check insights name overdue draws and the next real upcoming payment', () => {
    const { buildHealthPaymentInsights } = require('../aiAssistantCore');
    const project = {
      id: 'current',
      title: 'Electrical Estimate Draft',
      status: 'active',
      milestones: [
        { title: 'Deposit', amount: 5492, status: 'completed', plannedDate: '2026-09-15' },
        { title: 'Week 1 Progress Payment', amount: 5148.75, status: 'completed', plannedDate: '2026-09-22' },
        { title: 'Week 2 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-09-29' },
        { title: 'Week 3 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-06' },
        { title: 'Week 4 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-13' },
      ],
    };
    const insights = buildHealthPaymentInsights(project, { now: new Date('2026-10-07T18:00:00') });
    expect(insights.overdueLine).toBe(
      '2 payments are overdue ($10,298): Week 2 Progress Payment and Week 3 Progress Payment. Follow up with the client.'
    );
    expect(insights.nextLine).toBe('Next payment: Week 4 Progress Payment, $5,149, due October 13, 2026.');
  });

  test('an older project with the same name does not mix its payments into the current job', () => {
    const buckets = collectPaymentBuckets({
      currentProject: {
        id: 'current',
        title: 'Electrical Estimate Draft',
        status: 'active',
        milestones: [
          { title: 'Deposit', amount: 5492, status: 'completed', plannedDate: '2026-09-15' },
          { title: 'Week 2 Progress Payment', amount: 5149, status: 'pending', plannedDate: '2026-09-29' },
        ],
      },
      projects: [
        {
          id: 'older',
          title: 'Electrical Estimate Draft',
          status: 'completed',
          milestones: [
            { title: 'Deposit', amount: 6790, status: 'completed', plannedDate: '2026-09-08' },
            { title: 'Week 5 Progress Payment', amount: 6232, status: 'completed', plannedDate: '2026-11-17' },
            { title: 'Change order: Concrete', amount: 1200, status: 'completed', plannedDate: '2026-11-24' },
          ],
        },
      ],
      now: new Date('2026-10-07T18:00:00'),
    });
    const reply = buildPaymentStatusReply({
      ...buckets,
      fallbackProjectName: 'Electrical Estimate Draft',
    });
    expect(reply).toContain('**Deposit** — $5,492');
    expect(reply).toContain('**Week 2 Progress Payment** — $5,149');
    expect(reply).not.toContain('$6,790');
    expect(reply).not.toContain('Week 5');
    expect(reply).not.toContain('Concrete');
  });

  test('material budget uses the health-check sources, not a stale material total', () => {
    const reply = buildCentralCommandIntentReply(
      { intent: 'material_budget', payeeName: null },
      {
        projects: [{
          id: 'done-1',
          title: 'Electrical Estimate Draft',
          status: 'completed',
          progress: 100,
          contractValue: 37550,
          materialTotal: 6430,
          estimateData: { materialLineItems: [{ total: 5830 }] },
          expenses: [
            { category: 'Labor', amount: 15000 },
            { category: 'Materials', amount: 2600 },
            { category: 'Equipment', amount: 800 },
          ],
        }],
        parsedContext: { projectId: 'done-1' },
      }
    );
    expect(reply).toContain('$5,830');
    expect(reply).toContain('$3,400');
    expect(reply).not.toContain('$6,430');
    expect(reply).not.toContain('Remaining');
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
    expect(financials.receivedPoTotal).toBe(3000);
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

  test('recomputes stale forecast fields from the selected project inputs', () => {
    const financials = getProjectFinancialSnapshot({
      project: {
        id: 'repaint-live',
        contractValue: 30773.23,
        adjustedCostBudget: 26759.33,
        progress: 80,
        forecastFinalCost: 47200,
        projectedProfit: -16427,
        expenses: [{ amount: 11800 }],
      },
      parsedContext: {
        projectId: 'repaint-live',
        progress: 0,
        forecastFinalCost: 47200,
        projectedProfit: -16427,
      },
    });

    expect(financials.progress).toBe(80);
    expect(financials.projectedFinalCost).toBeCloseTo(14750, 2);
    expect(financials.projectedProfit).toBeCloseTo(16023.23, 2);
    expect(financials.projectedMarginPct).toBeCloseTo(52.07, 2);
    expect(financials.originalEstimateProfit).toBeCloseTo(4013.90, 2);
    expect(financials.originalEstimateMarginPct).toBeCloseTo(13.04, 2);
    expect(financials.currentProjectedProfit).toBeCloseTo(16023.23, 2);
    expect(financials.remainingCostBudget).toBeCloseTo(14959.33, 2);
    expect(financials.forecastMethod).toBe('run-rate');
  });

  test('uses timeline milestone progress when direct project progress is stale', () => {
    const financials = getProjectFinancialSnapshot({
      project: {
        id: 'repaint-live',
        contractValue: 30773.23,
        adjustedCostBudget: 26759.33,
        progress: 0,
        expenses: [{ amount: 11800 }],
        milestones: [{ title: 'Painting', progressPct: 80 }],
      },
    });

    expect(financials.progress).toBe(80);
    expect(financials.projectedProfit).toBeCloseTo(16023.23, 2);
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
    const openNoSpend = buildMakingEnoughReply('Electrical Estimate Draft', 14.2, {
      estimateOnlyForecast: false,
      hasActivity: false,
      progressStatusConflict: false,
    });
    expect(openNoSpend).toContain('estimated margin');
    expect(openNoSpend).toContain('14.2%');
    expect(openNoSpend).toContain('No costs have been logged yet, so this is the estimate, not money already spent.');
    expect(openNoSpend).not.toContain('current margin');
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

  test('recovers an active nested status when the top-level estimate status is stale', () => {
    const result = runCompareProjectsPipeline({
      allProjects: [
        {
          id: 'recovered-1',
          title: 'Recovered Active Job',
          status: 'estimate',
          projectData: { status: 'in_progress' },
          bidPrice: 100,
          estimatedCost: 80,
          progress: 20,
        },
      ],
      parsedContext: {},
      args: { activeOnly: true },
    });

    expect(result.projects.map((project) => project.title)).toEqual(['Recovered Active Job']);
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

    expect(compareReply).toContain('how your projects compare');
    expect(compareReply).toContain('Healthy Job');
    expect(budgetReply).toContain('Budget alert summary');
    expect(budgetReply).toContain('Active Job');
    expect(budgetReply).not.toContain('Healthy Job');
    expect(budgetReply).not.toContain('how your projects compare');
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

  test('a finished job profit forecast reports the actual result', () => {
    const reply = buildFinishedJobForecastReply(
      {
        id: 'done-1',
        title: 'Electrical Estimate Draft',
        status: 'completed',
        progress: 100,
        contractValue: 37550,
        actualCost: 18400,
      },
      { parsedContext: { projectId: 'done-1', projectedProfit: 17350 }, isCurrent: true }
    );
    expect(reply).toContain('**Profit forecast — Electrical Estimate Draft** · Completed');
    expect(reply).toContain('• Spent: $20,200.00');
    expect(reply).toContain('• Net profit: $17,350.00');
    expect(reply).toContain('• Margin: 46.2%');
    expect(reply).toContain('actual result, not a forecast');
    expect(reply).not.toContain('Optimistic');
    expect(reply).not.toContain('matches app UI');
  });

  test('a named payee stays separate from a longer similar name', () => {
    const reply = buildSeparatePayeeReply('How much did I pay Nick?', [
      {
        title: 'Electrical Estimate Draft',
        expenses: [
          { vendor: 'Nick', amount: 500 },
          { vendor: 'Nicholas', amount: 1000 },
        ],
      },
    ]);
    expect(reply).toContain('You paid **Nick** **$500.00**');
    expect(reply).toContain('**Nicholas** is a separate payee, paid $1,000.00');
    expect(reply).not.toContain('same person');
  });

  test('a finished original estimate points at the actual result', () => {
    const snapshot = getProjectFinancialSnapshot({
      project: {
        id: 'done-1',
        title: 'Electrical Estimate Draft',
        status: 'completed',
        progress: 100,
        contractValue: 37550,
        estimatedCost: 31925,
        actualCost: 20200,
      },
      parsedContext: { projectId: 'done-1' },
    });
    const note = finishedJobActualsNote(snapshot);
    expect(note).toContain('The finished result is $17,350 net profit on $20,200 spent.');
    expect(note).not.toContain('current projected profit');
  });

  test('an in-progress original estimate still names the current projection', () => {
    const snapshot = getProjectFinancialSnapshot({
      project: {
        id: 'live-1',
        status: 'active',
        progress: 40,
        contractValue: 37550,
        estimatedCost: 31925,
        actualCost: 10000,
      },
      parsedContext: { projectId: 'live-1' },
    });
    expect(finishedJobActualsNote(snapshot)).toContain('current projected profit');
  });

  test('a new wording of a finished job uses the same snapshot cards', () => {
    const projects = [{
      id: 'done-1',
      title: 'Electrical Estimate Draft',
      status: 'completed',
      progress: 100,
      contractValue: 37550,
      estimatedCost: 31925,
      actualCost: 20200,
      laborTotal: 19895,
      materialTotal: 5830,
      expenses: [
        { category: 'Labor', vendor: 'Nick', amount: 500 },
        { category: 'Labor', vendor: 'Nicholas', amount: 1000 },
        { category: 'Labor', vendor: 'Steve', amount: 13500 },
        { category: 'Materials', amount: 3400 },
      ],
    }];
    const parsedContext = { projectId: 'done-1', projectedProfit: 17350 };
    expect(classifyCentralCommandIntent('Did this job make money?')).toEqual({ intent: 'profit', payeeName: null });
    expect(classifyCentralCommandIntent('Are we under the labor number?')).toEqual({ intent: 'labor_budget', payeeName: null });
    expect(classifyCentralCommandIntent('What did Nick cost me?')).toEqual({ intent: 'payee', payeeName: 'Nick' });
    expect(classifyCentralCommandIntent('Give me a health check')).toBeNull();
    expect(classifyCentralCommandIntent('What if costs go up 10%?')).toBeNull();

    const profit = buildCentralCommandIntentReply(
      { intent: 'profit', payeeName: null },
      { projects, parsedContext }
    );
    expect(profit).toContain('$17,350.00');
    expect(profit).toContain('46.2%');

    const labor = buildCentralCommandIntentReply(
      { intent: 'labor_budget', payeeName: null },
      { projects, parsedContext }
    );
    expect(labor).toContain('$19,895');
    expect(labor).toContain('$15,000');
    expect(labor).not.toContain('Remaining');

    const nick = buildCentralCommandIntentReply(
      { intent: 'payee', payeeName: 'Nick' },
      { projects, parsedContext }
    );
    expect(nick).toContain('**Nick**');
    expect(nick).toContain('$500.00');
    expect(nick).toContain('**Nicholas** is a separate payee');
    expect(nick).not.toContain('same person');

    expect(buildCentralCommandIntentReply(
      { intent: 'payee', payeeName: 'Bob' },
      { projects, parsedContext }
    )).toBeNull();
    expect(parseCentralCommandIntentChoice('{"intent":"payee","payeeName":"Someone Else","amount":999}', 'What did Nick cost me?'))
      .toEqual({ intent: 'unknown', payeeName: null });
  });

  test('paraphrases of the active Electrical Estimate Draft hit the same snapshot cards', () => {
    const current = {
      id: '1790902852864',
      title: 'Electrical Estimate Draft',
      status: 'active',
      progress: 25,
      bidPrice: 27460,
      estimatedCost: 23550,
      actualCost: 0,
      milestones: [
        { title: 'Deposit', amount: 5492, status: 'completed', plannedDate: '2026-09-15' },
        { title: 'Week 1 Progress Payment', amount: 5148.75, status: 'completed', plannedDate: '2026-09-22' },
        { title: 'Week 2 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-09-29' },
        { title: 'Week 3 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-06' },
        { title: 'Week 4 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-13' },
      ],
    };
    const older = {
      id: 'older',
      title: 'Electrical Estimate Draft',
      status: 'completed',
      progress: 100,
      milestones: [
        { title: 'Deposit', amount: 6790, status: 'completed', plannedDate: '2026-09-08' },
        { title: 'Week 5 Progress Payment', amount: 6232, status: 'completed', plannedDate: '2026-11-17' },
        { title: 'Change order: Concrete', amount: 1200, status: 'completed', plannedDate: '2026-11-24' },
      ],
    };
    const ctx = {
      projects: [older, current],
      parsedContext: { projectId: current.id, currentProject: current.title },
      now: new Date('2026-10-07T18:00:00'),
    };
    const replyFor = (message) => buildCentralCommandIntentReply(classifyCentralCommandIntent(message), ctx);

    expect(classifyCentralCommandIntent('What payments are overdue on Electrical Estimate Draft?').intent).toBe('payment');
    expect(classifyCentralCommandIntent('When am I getting paid?').intent).toBe('payment');
    expect(classifyCentralCommandIntent('Review payments').intent).toBe('payment');
    expect(classifyCentralCommandIntent("What's still left to collect?").intent).toBe('payment');
    for (const message of [
      'What payments are overdue on Electrical Estimate Draft?',
      'When am I getting paid?',
      'Review payments',
      "What's still left to collect?",
    ]) {
      const reply = replyFor(message);
      expect(reply).toContain('**Deposit** — $5,492');
      expect(reply).toContain('**Week 1 Progress Payment** — $5,149');
      expect(reply).toContain('**Week 2 Progress Payment** — $5,149');
      expect(reply).toContain('**Week 3 Progress Payment** — $5,149');
      expect(reply).not.toContain('$6,790');
      expect(reply).not.toContain('Week 5');
      expect(reply).not.toContain('Concrete');
    }

    expect(classifyCentralCommandIntent("What's left to spend?").intent).toBe('remaining_budget');
    expect(classifyCentralCommandIntent('Remaining cost').intent).toBe('remaining_budget');
    expect(classifyCentralCommandIntent('How much budget is left?').intent).toBe('remaining_budget');
    for (const message of ["What's left to spend?", 'Remaining cost', 'How much budget is left?']) {
      const reply = replyFor(message);
      expect(reply).toContain('$23,550.00');
      expect(reply).toContain('**Remaining:** **$23,550.00**');
      expect(reply).toContain('0.0%');
    }

    expect(classifyCentralCommandIntent("What's my profit forecast?").intent).toBe('forecast');
    expect(classifyCentralCommandIntent('If costs keep coming in, what do I make?').intent).toBe('forecast');
    for (const message of ["What's my profit forecast?", 'If costs keep coming in, what do I make?']) {
      const reply = replyFor(message);
      expect(reply).toContain('$23,550');
      expect(reply).toContain('$3,910');
      expect(reply).toContain('14.2%');
      expect(reply).toContain('No costs have been logged yet, so this forecast uses the cost budget.');
      expect(reply).toContain('$21,666');
      expect(reply).toContain('$25,434');
      expect(reply).not.toContain('This job is finished');
    }

    expect(classifyCentralCommandIntent("What's my margin?").intent).toBe('margin');
    expect(classifyCentralCommandIntent('Did this job make money?').intent).toBe('profit');
    expect(classifyCentralCommandIntent('Am I making enough on this job?').intent).toBe('profit');
    for (const message of ["What's my margin?", 'Did this job make money?', 'Am I making enough on this job?']) {
      const reply = replyFor(message);
      expect(reply).toContain('14.2%');
      expect(reply).toContain('$3,910');
      expect(reply).toContain('No costs have been logged yet.');
      expect(reply).not.toMatch(/Spend-to-date:\s*100/);
    }

    expect(classifyCentralCommandIntent('Give me a health check')).toBeNull();
    expect(classifyCentralCommandIntent('Which projects are over budget?')).toBeNull();
  });

  test('answers collected, still coming in, category budget, worth, worry, and unknown cost from the snapshot', () => {
    const current = {
      id: '1790902852864',
      title: 'Electrical Estimate Draft',
      status: 'active',
      progress: 25,
      bidPrice: 27460,
      estimatedCost: 23550,
      actualCost: 0,
      estimateData: {
        materialLineItems: [{ total: 5190 }],
        laborTotal: 16060,
      },
      milestones: [
        { title: 'Deposit', amount: 5492, status: 'completed', plannedDate: '2026-09-15' },
        { title: 'Week 1 Progress Payment', amount: 5148.75, status: 'completed', plannedDate: '2026-09-22' },
        { title: 'Week 2 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-09-29' },
        { title: 'Week 3 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-06' },
        { title: 'Week 4 Progress Payment', amount: 5148.75, status: 'pending', plannedDate: '2026-10-13' },
        { title: 'Holdback', amount: 1373, status: 'pending', plannedDate: '2026-11-03' },
      ],
    };
    const quiet = {
      id: 'quiet',
      title: 'Quiet Remodel',
      status: 'active',
      progress: 10,
      bidPrice: 10000,
      estimatedCost: 8000,
      milestones: [
        { title: 'Deposit', amount: 2000, status: 'completed', plannedDate: '2026-09-01' },
      ],
    };
    const ctx = {
      projects: [quiet, current],
      parsedContext: { projectId: current.id, currentProject: current.title },
      now: new Date('2026-10-07T18:00:00'),
    };
    const replyFor = (message) => trySnapshotTopicReply(message, ctx);

    const collected = replyFor('How much have I collected so far?');
    expect(collected).toContain("You've collected **$10,641**");
    expect(collected).toContain('**Deposit** — $5,492');
    expect(collected).toContain('**Week 1 Progress Payment** — $5,149');
    expect(collected).not.toContain('Week 2');

    const incoming = replyFor('How much is still coming in on this job?');
    expect(incoming).toContain('**$16,819** is still coming in');
    expect(incoming).toContain('Week 2 Progress Payment');
    expect(incoming).toContain('overdue, was due September 29, 2026');
    expect(incoming).toContain('**Holdback** — $1,373, due November 3, 2026');

    const material = replyFor("What's my material budget?");
    expect(material).toContain('**Material budget — Electrical Estimate Draft**');
    expect(material).toContain('**Budget:** $5,190');
    expect(material).toContain('**Spent:** $0');
    expect(material).toContain('No material costs have been logged yet.');

    const labor = replyFor('How much labor budget do I have left?');
    expect(labor).toContain('**Labor budget — Electrical Estimate Draft**');
    expect(labor).toContain('**Budget:** $16,060');
    expect(labor).toContain('**Remaining:** $16,060');

    const worth = replyFor('Is this job worth it?');
    expect(worth).toContain('estimated margin');
    expect(worth).toContain('14.2%');
    expect(worth).toContain('below');
    expect(worth).toContain('No costs have been logged yet');

    const worry = replyFor('Which job should I worry about most?');
    expect(worry).toContain('**Electrical Estimate Draft**');
    expect(worry).toContain('2 payments are overdue ($10,298)');
    expect(worry).toContain('Week 2 Progress Payment and Week 3 Progress Payment');
    expect(worry).not.toContain('Quiet Remodel');

    const inspection = replyFor('What will the inspection cost?');
    expect(inspection).toContain("I don't have a cost for Inspection");
    expect(inspection).toContain('Electrical Estimate Draft');
    expect(inspection).not.toContain('change order');

    expect(buildSeparatePayeeReply('How much labor budget do I have left?', [
      { title: 'Electrical Estimate Draft', expenses: [{ vendor: 'Labor', amount: 500, category: 'Other' }] },
    ])).toBeNull();
    const laborLeft = replyFor('How much labor budget do I have left?');
    expect(laborLeft).toContain('**Budget:** $16,060');
    expect(laborLeft).toContain('**Remaining:** $16,060');
    expect(laborLeft).not.toContain('You paid');

    expect(classifyCentralCommandIntent('What happens to my profit if labor goes up 10%?')).toBeNull();
    const whatIf = replyFor('What happens to my profit if labor goes up 10%?');
    expect(whatIf).toContain('**$16,060**');
    expect(whatIf).toContain('**$1,606**');
    expect(whatIf).toContain('**$3,910**');
    expect(whatIf).toContain('**$2,304**');
    expect(whatIf).toContain('14.2%');
    expect(whatIf).toContain('8.4%');
    expect(whatIf).not.toContain('Margin Summary');
    expect(whatIf).not.toContain('change order');
  });

  test('a money question that missed a built-in path is not for the model', () => {
    expect(isUngroundedCentralCommandMoneyQuestion('How much did I pay Bob?')).toBe(true);
    expect(isUngroundedCentralCommandMoneyQuestion("What's my margin?")).toBe(true);
    expect(isUngroundedCentralCommandMoneyQuestion('Give me a health check')).toBe(false);
    expect(isUngroundedCentralCommandMoneyQuestion("What's on my calendar?")).toBe(false);
    expect(isUngroundedCentralCommandMoneyQuestion('What if costs go up 10%?')).toBe(false);
  });

  test('an active job keeps a live profit forecast', () => {
    const reply = buildFinishedJobForecastReply(
      {
        id: 'live-1',
        title: 'Kitchen Remodel',
        status: 'active',
        progress: 40,
        contractValue: 80000,
        estimatedCost: 60000,
        actualCost: 20000,
      },
      { parsedContext: { projectId: 'live-1' }, isCurrent: true }
    );
    expect(reply).toBeNull();
  });

  test('a finished job margin question reports the actual margin, not a projection', () => {
    const result = buildMarginReplyForProject(
      {
        id: 'done-1',
        title: 'Electrical Estimate Draft',
        status: 'completed',
        progress: 100,
        contractValue: 37550,
        actualCost: 18400,
        expenses: [{ amount: 18400 }],
      },
      { parsedContext: { projectId: 'done-1', projectedProfit: 17350 }, isCurrent: true }
    );

    expect(result.reply).toContain('**Margin — Electrical Estimate Draft** · Completed');
    expect(result.reply).toContain('• Net profit: $17,350.00');
    expect(result.reply).toContain('• Margin: 46.2%');
    expect(result.reply).toContain('• Spent: $20,200.00');
    expect(result.reply).not.toContain('Spend-to-date');
    expect(result.reply).not.toContain('Projected at completion');
  });

  test('an open job with no spend does not report a 100% spend-to-date margin', () => {
    const result = buildMarginReplyForProject(
      {
        id: 'live-1',
        title: 'Electrical Estimate Draft',
        status: 'active',
        progress: 25,
        contractValue: 27460,
        estimatedCost: 23550,
        actualCost: 0,
        margin: 16.1,
      },
      { parsedContext: { projectId: 'live-1', spendToDateMarginPct: 100 }, isCurrent: true }
    );

    expect(result.reply).toContain('No costs have been logged yet.');
    expect(result.reply).not.toContain('100.0%');
    expect(result.reply).toContain('**Original estimate:** 14.2%');
    expect(result.reply).toContain('**Projected at completion:** 14.2%');
    expect(result.reply).not.toContain('16.1%');
  });

  test('budget risks reply says there are no active jobs when every job is finished', () => {
    const budgetReply = buildPortfolioBudgetRisksReplyForProjects(
      [{ id: 'done-1', title: 'Electrical Job', status: 'completed', progress: 100, revenue: 37550, expenses: [] }],
      {}
    );

    expect(budgetReply).toContain('No active jobs to check.');
    expect(budgetReply).toContain('Your finished job has no estimate lines over budget.');
    expect(budgetReply).not.toContain('in-progress projects are within budget');
  });

  test('isPortfolioBudgetRisksQuery matches alert prompts but not compare-all', () => {
    const { isPortfolioBudgetRisksQuery } = require('../aiAssistantCore');
    expect(isPortfolioBudgetRisksQuery('Which projects have budget risks? Show me specifics.')).toBe(true);
    expect(isPortfolioBudgetRisksQuery('What are the current risks of my active projects?')).toBe(true);
    expect(isPortfolioBudgetRisksQuery('Order the current risk of my current projects')).toBe(true);
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
