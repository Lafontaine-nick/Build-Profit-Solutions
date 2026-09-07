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
