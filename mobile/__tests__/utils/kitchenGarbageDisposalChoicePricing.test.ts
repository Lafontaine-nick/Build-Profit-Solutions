import {
  isKitchenGarbageDisposalChoiceScope,
  resolveKitchenGarbageDisposalChoiceSuggestedPricing,
} from '@/utils/kitchenGarbageDisposalChoicePricing';

describe('kitchenGarbageDisposalChoicePricing', () => {
  it('only applies on kitchen garbage_disposal', () => {
    expect(isKitchenGarbageDisposalChoiceScope('garbage_disposal', 'kitchen')).toBe(true);
    expect(isKitchenGarbageDisposalChoiceScope('garbage_disposal', 'bathroom')).toBe(false);
    expect(isKitchenGarbageDisposalChoiceScope('sink_faucet', 'kitchen')).toBe(false);
  });

  it('returns reuse/install pricing for reuse_install choice', () => {
    const result = resolveKitchenGarbageDisposalChoiceSuggestedPricing({
      itemId: 'garbage_disposal',
      templateKey: 'kitchen',
      choiceId: 'reuse_install',
      quantity: 2,
      unit: 'each',
    });
    expect(result?.fill?.total).toBe(280);
    expect(result?.fill?.material).toBe(40);
    expect(result?.fill?.labor).toBe(240);
    expect(result?.fill?.basis).toEqual({ quantity: 2, unit: 'each' });
  });

  it('falls through for replace_install so national average can apply', () => {
    expect(
      resolveKitchenGarbageDisposalChoiceSuggestedPricing({
        itemId: 'garbage_disposal',
        templateKey: 'kitchen',
        choiceId: 'replace_install',
        quantity: 1,
        unit: 'each',
      })
    ).toBeUndefined();
  });

  it('returns nothing when choice is not in scope', () => {
    expect(
      resolveKitchenGarbageDisposalChoiceSuggestedPricing({
        itemId: 'garbage_disposal',
        templateKey: 'kitchen',
        choiceId: 'not_in_scope',
      })
    ).toBeUndefined();
  });
});
