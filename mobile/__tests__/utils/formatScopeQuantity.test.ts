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

  test('a leftover sqft does not replace the window count Confirm Scope priced', () => {
    const pkg = {
      name: 'Window install',
      checklistItemId: 'window_install',
      scopeQuantities: [{ quantity: 1800, unit: 'sqft' }],
    } as EstimateDraftScopePackage;
    const priced = {
      scopeMeasurements: { windowCount: 6 },
    } as EstimateAiDraft;

    expect(formatScopeQuantity(pkg, priced)).toBe('6 each');
  });

  test('wall-area framing keeps the note sqft when the price basis is linear feet', () => {
    const notes = 'Frame 400 sqft of walls and install 180 sqft of LVP.';
    const pkg = {
      name: 'Wall framing',
      checklistItemId: 'wall_framing',
      scopeQuantities: [{ quantity: 50, unit: 'lf' }],
    } as EstimateDraftScopePackage;
    const mixed = {
      originalNotes: notes,
      scopeMeasurements: { wallFramingSqft: 400 },
    } as EstimateAiDraft;

    expect(formatScopeQuantity(pkg, mixed)).toBe('400 sqft');
  });
});
