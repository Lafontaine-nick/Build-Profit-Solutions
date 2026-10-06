import {
  buildPortfolioOperationalInsights,
  countPortfolioOperationalFlags,
  getDashboardProjectOperationalSignal,
} from '@/utils/portfolioOperationalInsights';

describe('portfolioOperationalInsights', () => {
  it('flags margin watch on active jobs with thin projected margin', () => {
    const result = buildPortfolioOperationalInsights([
      {
        id: 'p1',
        title: 'Hall Bathroom Remodel',
        displayStatus: 'Active',
        slugForUi: 'active',
        portfolioStatus: 'in_progress',
        isWorkingEstimate: false,
        margin: 12.5,
        progress: 0,
        amount: 19897,
        rawProject: { id: 'p1' },
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'margin_watch')).toBe(true);
    expect(result.nextSteps.some((s) => /margin/i.test(s.label))).toBe(true);
    expect(countPortfolioOperationalFlags(result)).toBeGreaterThan(0);
  });

  it('flags estimate pricing cards that still need review', () => {
    const result = buildPortfolioOperationalInsights([
      {
        id: 'p2',
        title: 'Kitchen Remodel',
        displayStatus: 'Draft',
        slugForUi: 'estimate',
        portfolioStatus: 'estimate',
        isWorkingEstimate: true,
        margin: 22,
        progress: 0,
        amount: 0,
        rawProject: {
          aiEstimateDraftSnapshot: {
            draft: {
              scopePackages: [
                { name: 'Cabinets', status: 'missing_price' },
                { name: 'Tile', status: 'user_provided', price: 1200 },
              ],
            },
          },
        },
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'estimate_needs_review')).toBe(true);
    expect(result.nextSteps.some((s) => /finish/i.test(s.label))).toBe(true);
  });

  it('skips estimate review when the job is already active', () => {
    const result = buildPortfolioOperationalInsights([
      {
        id: 'p3',
        title: 'Bathroom Remodel',
        displayStatus: 'Active',
        slugForUi: 'won',
        portfolioStatus: 'won',
        isWorkingEstimate: false,
        margin: 18,
        progress: 0.1,
        amount: 24000,
        rawProject: {
          status: 'estimate',
          projectData: { status: 'won' },
          aiEstimateDraftSnapshot: {
            draft: {
              scopePackages: [{ name: 'Tile', status: 'missing_price' }],
              stillNeededReview: ['fixture count'],
            },
          },
        },
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'estimate_needs_review')).toBe(false);
    expect(result.nextSteps.some((s) => s.leakType === 'estimate_needs_review')).toBe(false);
  });

  it('skips estimate review for saved-bid archive copies', () => {
    const result = buildPortfolioOperationalInsights([
      {
        id: 'saved-1',
        title: 'Flooring Remodel Bid',
        displayStatus: 'Draft',
        slugForUi: 'estimate',
        portfolioStatus: 'estimate',
        isWorkingEstimate: false,
        margin: 22,
        progress: 0,
        amount: 0,
        rawProject: {
          aiEstimateDraftSnapshot: {
            draft: {
              scopePackages: [{ name: 'Flooring', status: 'missing_price' }],
            },
          },
        },
      },
    ]);

    expect(result.insights.some((i) => i.leakType === 'estimate_needs_review')).toBe(false);
  });

  it('briefs an active job that is still on its estimate', () => {
    const result = buildPortfolioOperationalInsights([
      {
        id: 'elec',
        title: 'Electrical Estimate Draft',
        displayStatus: 'Active',
        slugForUi: 'active',
        portfolioStatus: 'in_progress',
        isWorkingEstimate: false,
        margin: 20,
        progress: 0,
        amount: 10000,
        rawProject: {
          estimateData: {
            grandTotal: 10000,
            materialLineItems: [{ total: 8000 }],
          },
          expenses: [{ amount: 2000 }],
        },
        timelineItems: [
          {
            type: 'weekly',
            title: 'Week 1 payment',
            amount: 2000,
            status: 'completed',
            plannedDate: '2026-10-04',
          },
          {
            type: 'weekly',
            title: 'Week 2 Progress Payment',
            amount: 2000,
            status: 'pending',
            plannedDate: '2026-11-17',
          },
        ],
      },
    ]);

    const brief = result.insights.find((insight) => insight.leakType === 'project_status');
    expect(brief?.title).toBe('Electrical Estimate Draft is on the estimate');
    expect(brief?.body).toContain('$2,000 of the $8,000 cost cap is spent');
    expect(brief?.body).toContain('1 of 2 weekly payments is in');
    expect(brief?.body).toContain('Next payment is Week 2,');
    expect(brief?.body).not.toContain('Progress');
    expect(brief?.body).toContain('Nov 17');
    expect(result.insights.some((insight) => insight.leakType === 'margin_watch')).toBe(false);
    expect(countPortfolioOperationalFlags(result)).toBe(0);
  });

  it('flags an active job when logged costs pass the cost cap', () => {
    const result = buildPortfolioOperationalInsights([
      {
        id: 'over',
        title: 'Kitchen Remodel',
        displayStatus: 'Active',
        slugForUi: 'in_progress',
        portfolioStatus: 'in_progress',
        isWorkingEstimate: false,
        margin: 20,
        progress: 0.4,
        amount: 10000,
        rawProject: {
          estimateData: {
            grandTotal: 10000,
            materialLineItems: [{ total: 8000 }],
          },
          expenses: [{ amount: 9000 }],
        },
      },
    ]);

    expect(result.insights.some((insight) => insight.leakType === 'cost_overrun_risk')).toBe(true);
    expect(result.insights.some((insight) => insight.leakType === 'project_status')).toBe(false);
    expect(countPortfolioOperationalFlags(result)).toBe(1);
  });

  it('matches dashboard project card margin watch signal', () => {
    const signal = getDashboardProjectOperationalSignal({
      rawProject: {},
      margin: 12,
      progress: 0.1,
      status: 'Active',
      amount: 10000,
    });
    expect(signal.text).toBe('Margin watch');
    expect(signal.variant).toBe('watch');
  });
});
