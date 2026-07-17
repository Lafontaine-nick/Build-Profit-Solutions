import { resolveLandscapingLumpSuggestedFill } from '@/utils/groundUpFinishPackages';
import {
  getChecklistItemQuantityRule,
  initialScopeMeasurementInputExtended,
  resolveScopeItemSuggestedPricing,
  resolveChecklistItemQuantity,
} from '@/utils/scopeItemQuantities';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('landscaping Material/Labor national split', () => {
  it('is not lumpSumOnly on ground-up', () => {
    expect(getChecklistItemQuantityRule('landscaping', 'ground_up')?.lumpSumOnly).toBe(false);
  });

  it('suggests Material and Labor from blended package + national share', () => {
    const draft = {
      scopeChecklist: { templateKey: 'ground_up' },
      scopeMeasurements: { floorAreaSqft: 3098, itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    input.floorAreaSqft = '3098';
    const resolved = resolveChecklistItemQuantity('landscaping', input as any, {
      templateKey: 'ground_up',
    });
    const suggested = resolveScopeItemSuggestedPricing(
      'landscaping',
      input,
      'ground_up',
      resolved,
      { state: 'UT' }
    );
    const fill = suggested.fill!;
    const packageFill = resolveLandscapingLumpSuggestedFill({ livingSf: 3098, state: 'UT' });
    expect(fill.lumpSumOnly).toBe(false);
    expect(fill.material).toBe(packageFill.material);
    expect(fill.labor).toBe(packageFill.labor);
    expect(fill.total).toBe(packageFill.total);
    expect(fill.material).toBeGreaterThan(0);
    expect(fill.labor).toBeGreaterThan(0);
    expect(fill.costBuckets?.map((b) => b.key)).toEqual(['material', 'labor']);
  });

  it('does not treat applied landscaping mat/lab as a soft-cost allowance', () => {
    expect(
      isSoftCostScopePackage(
        {
          name: 'Landscaping / site walls & gates',
          scope: 'landscaping',
          checklistItemId: 'landscaping',
          materialPrice: 7154,
          laborPrice: 5854,
        },
        { scopeChecklist: { templateKey: 'ground_up' } as any }
      )
    ).toBe(false);
  });
});
