import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatScopeQuantity } from '@/utils/estimateDraftReviewUi';

describe('formatScopeQuantity', () => {
  const draft = {
    scopeChecklist: { templateKey: 'kitchen' },
  } as EstimateAiDraft;

  test('trade dollar lumps show as lump sum, not allowance', () => {
    const pkg = {
      name: 'Appliance reinstall & hookup',
      scope: 'Reconnect and install appliances after cabinets.',
      scopeQuantities: [{ quantity: 300, unit: 'allowance' }],
    } as EstimateDraftScopePackage;

    expect(formatScopeQuantity(pkg, draft)).toBe('300 lump sum');
  });

  test('soft-cost packages keep the allowance label', () => {
    const pkg = {
      name: 'Permits / fees',
      scope: 'permits',
      scopeQuantities: [{ quantity: 500, unit: 'allowance' }],
    } as EstimateDraftScopePackage;

    expect(formatScopeQuantity(pkg, draft)).toBe('500 allowance');
  });
});
