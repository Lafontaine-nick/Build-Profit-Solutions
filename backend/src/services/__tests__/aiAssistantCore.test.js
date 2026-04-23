const {
  analyzePortfolioProject,
  buildDailyCommandCenter,
  parseCalendarEventCreate,
  runCompareProjectsPipeline,
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
      })
    );

    const dailyBrief = buildDailyCommandCenter(analyzed);

    expect(dailyBrief.topProfitRisks[0].headline).toContain('Copper Valley Rehab');
    expect(dailyBrief.topActions[0].label).toContain('Copper Valley Rehab');
    expect(dailyBrief.upcomingPayments[0].name).toBe('Final Draw');
    expect(dailyBrief.portfolioSummary.activeProjectCount).toBe(3);
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
});
