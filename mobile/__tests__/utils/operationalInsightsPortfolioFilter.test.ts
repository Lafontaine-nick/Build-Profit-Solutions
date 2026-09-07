import {
  filterProjectsForOperationalInsights,
  isCurrentlyWorkingEstimate,
  isEligibleEstimateInsightProject,
  isPreActivePortfolioStatus,
  resolvePortfolioProjectStatus,
} from '@/utils/aiDashboardPortfolioFilter';

describe('operational insights portfolio filter', () => {
  it('drops deleted jobs by id and title', () => {
    const activeProjects = [
      { id: 'active-1', title: 'Hall Bathroom Remodel', status: 'in_progress' },
    ];
    const estimates = [
      { id: 'est-1', title: 'Flooring Remodel Bid', status: 'estimate' },
      { id: 'est-2', title: 'Concrete Flat Work Bid', status: 'estimate' },
    ];

    const filtered = filterProjectsForOperationalInsights(activeProjects, estimates, [
      { id: 'est-1', title: 'Flooring Remodel Bid', deletedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'gone', title: 'Concrete Flat Work Bid', deletedAt: '2026-01-01T00:00:00.000Z' },
    ]);

    expect(filtered.map((p) => p.id)).toEqual(['active-1']);
  });

  it('prefers active status over a stale estimate copy', () => {
    const activeProjects = [
      {
        id: 'job-1',
        title: 'Bathroom Remodel',
        status: 'won',
        projectData: { status: 'won' },
      },
    ];
    const estimates = [
      {
        id: 'job-1',
        title: 'Bathroom Remodel',
        status: 'estimate',
        aiEstimateDraftSnapshot: {
          draft: { scopePackages: [{ name: 'Tile', status: 'missing_price' }] },
        },
      },
    ];

    const filtered = filterProjectsForOperationalInsights(activeProjects, estimates, []);
    expect(filtered).toHaveLength(1);
    expect(resolvePortfolioProjectStatus(filtered[0])).toBe('won');
    expect(isPreActivePortfolioStatus(resolvePortfolioProjectStatus(filtered[0]))).toBe(false);
  });

  it('only treats the open Estimate bid as eligible for draft insights', () => {
    const archived = {
      id: 'saved-1',
      title: 'Flooring Remodel Bid',
      status: 'estimate',
    };
    const current = {
      id: 'current-1',
      title: 'Your bid',
      status: 'estimate',
    };
    const submitted = {
      id: 'submitted-1',
      title: 'Kitchen Remodel',
      status: 'bid_submitted',
    };

    const ctx = {
      currentBidId: 'current-1',
      savedBidArchiveIds: new Set(['saved-1', 'current-1']),
    };

    expect(isEligibleEstimateInsightProject(archived, ctx)).toBe(false);
    expect(isEligibleEstimateInsightProject(current, ctx)).toBe(true);
    expect(isEligibleEstimateInsightProject(submitted, ctx)).toBe(true);
    expect(isCurrentlyWorkingEstimate(archived, ctx)).toBe(false);
  });

  it('excludes stale draft rows that never hit saved bids storage', () => {
    const staleDraft = {
      id: 'autosaved-1',
      title: 'Bathroom Remodel',
      status: 'estimate',
    };

    expect(
      isEligibleEstimateInsightProject(staleDraft, {
        currentBidId: 'current-1',
        savedBidArchiveIds: new Set(),
      })
    ).toBe(false);
  });
});
