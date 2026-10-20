import { resolveBidSummaryHeroStatus } from '@/utils/bidSummaryHeroStatus';

describe('resolveBidSummaryHeroStatus', () => {
  test('a priced scope does not count setup steps as items to check', () => {
    const status = resolveBidSummaryHeroStatus({
      missingLabels: [
        'Client and job info added',
        'Markup reviewed',
        'Payment schedule set',
        'Final total reviewed',
      ],
      setupProgressPct: 33,
      healthScore: 80,
      hasMaterials: true,
      hasLabor: true,
      total: 2139,
    });

    expect(status.label).toBe('Mostly ready');
    expect(status.needsReview).toBe(false);
    expect(status.showLineCount).toBe(false);
  });

  test('a missing material price still needs review', () => {
    const status = resolveBidSummaryHeroStatus({
      missingLabels: ['Materials added', 'Client and job info added'],
      setupProgressPct: 50,
      healthScore: 80,
      hasMaterials: false,
      hasLabor: true,
      total: 600,
    });

    expect(status.label).toBe('Needs review — 2 items to check');
    expect(status.showLineCount).toBe(true);
  });
});
