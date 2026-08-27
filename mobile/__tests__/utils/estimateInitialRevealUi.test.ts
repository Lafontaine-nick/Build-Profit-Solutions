import {
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealPrimaryCtaLabel,
  getInitialRevealPriorityItems,
  getInitialRevealStatusLabel,
  plainLanguageReviewItem,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('estimateInitialRevealUi', () => {
  it('maps technical review copy to plain language', () => {
    expect(plainLanguageReviewItem('Low-confidence quantity for wall tile')).toContain('Please check quantity');
    expect(plainLanguageReviewItem('Pricing gap on plumbing')).toBe('Price needed on plumbing');
  });

  it('labels status from attention count and confidence', () => {
    const draft = {
      estimateConfidence: { level: 'high' },
    } as EstimateAiDraft;
    expect(getInitialRevealStatusLabel(draft, 0).label).toBe('Ready to send');
    expect(getInitialRevealStatusLabel(draft, 2).label).toBe('2 items to check');
  });

  it('builds primary CTA from attention count', () => {
    expect(getInitialRevealPrimaryCtaLabel(0)).toBe('Review & apply estimate');
    expect(getInitialRevealPrimaryCtaLabel(3)).toBe('Review 3 items');
    expect(getInitialRevealPrimaryCtaLabel(0, true)).toBe('Confirm scope');
  });

  it('prefers scope items over admin fields on reveal', () => {
    const draft = {
      stillNeededReview: ['Customer name', 'Pricing for tile demo', 'Project address'],
      needsReviewItems: [],
      scopePackages: [{ name: 'Tile demo', status: 'missing_price' }],
    } as EstimateAiDraft;
    const { items } = getInitialRevealPriorityItems(draft, 2);
    expect(items[0]).toContain('tile demo');
  });

  it('shows placeholder hero when no total yet', () => {
    const display = getInitialRevealHeroDisplay(
      {
        heroTotal: null,
        heroTotalLabel: 'Initial estimate',
        material: null,
        labor: null,
        allowance: null,
        estimatedWithMarkup: null,
        scopeItemCount: 6,
      },
      true
    );
    expect(display.amountText).toBe('—');
    expect(display.hint).toContain('Confirm scope');
  });

  it('uses project title for display heading', () => {
    const draft = { projectTitle: 'Master bath remodel' } as EstimateAiDraft;
    expect(getInitialRevealDisplayTitle(draft)).toBe('Master bath remodel');
  });
});
