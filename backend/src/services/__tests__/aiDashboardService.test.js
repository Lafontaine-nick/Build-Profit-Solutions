const {
  deepClone,
  dashboardProjects,
  dashboardProjectsNoDatedPayments,
  completedSummaries,
} = require('../../../test-fixtures/aiEvalFixtures');

describe('aiDashboardService', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  let warnSpy;
  let logSpy;

  jest.setTimeout(20000);

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    jest.resetModules();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    if (originalOpenAiKey) process.env.OPENAI_API_KEY = originalOpenAiKey;
    else delete process.env.OPENAI_API_KEY;
  });

  test('returns rule-based dashboard data when no OpenAI key is configured', async () => {
    const { buildAiDashboardForUser } = require('../aiDashboardService');

    const result = await buildAiDashboardForUser(
      'user-1',
      deepClone(dashboardProjects),
      false,
      deepClone(completedSummaries)
    );

    expect(result.aiUpdatedAt).toBeNull();
    expect(result.ruleBasedUpdatedAt).toEqual(expect.any(String));
    expect(result.dailyBrief.topProfitRisks[0].headline).toContain('Copper Valley Rehab');
    expect(result.nextSteps.some((step) => step.label.includes('Copper Valley Rehab'))).toBe(true);
    expect(result.insights.some((insight) => insight.title === 'Silver leaf project: realized net profit')).toBe(true);
  });

  test('keeps upcoming payments empty when no milestones have dates', async () => {
    const { buildAiDashboardForUser } = require('../aiDashboardService');

    const result = await buildAiDashboardForUser(
      'user-1',
      deepClone(dashboardProjectsNoDatedPayments),
      false,
      []
    );

    expect(result.dailyBrief.upcomingPayments).toEqual([]);
    expect(result.dailyBrief.topProfitRisks).toEqual([]);
    expect(result.dailyBrief.portfolioSummary.activeProjectCount).toBe(1);
  });
});
