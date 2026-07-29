import {
  resolveBathroomFixtureChoiceSuggestedPricing,
  BATHROOM_FIXTURE_CHOICE_PRICING,
  TOILET_RELOCATE_UNSURE_STATUS,
  TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR,
  resolveToiletRelocateQuantitySourceLabel,
  buildToiletRelocatePricingDetails,
} from '@/utils/bathroomFixtureChoicePricing';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import { buildSuggestedPricingCardDisplay } from '@/utils/suggestedPricingCardUi';

describe('bathroomFixtureChoicePricing', () => {
  it('returns no suggested price for legacy toilet staying choice id', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'staying',
      quantity: 1,
      unit: 'each',
    });
    expect(result).toEqual({ fill: null, comparison: null });
  });

  it('returns open wood-framed relocate pricing with updated labels', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'relocating',
      quantity: 1,
      unit: 'each',
      toiletRelocateFloorType: 'open_wood_framed',
    });
    expect(result?.fill?.total).toBe(2100);
    expect(result?.fill?.material).toBe(500);
    expect(result?.fill?.labor).toBe(1600);
    expect(result?.fill?.costBuckets?.[0]?.label).toBe('Toilet and plumbing relocation materials');
    expect(result?.fill?.costBuckets?.[1]?.label).toBe('Plumbing relocation and installation labor');
    expect(result?.fill?.splitConfidence).toBe('medium');
  });

  it('returns finished wood-framed relocate pricing', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'relocating',
      quantity: 1,
      unit: 'each',
      toiletRelocateFloorType: 'finished_wood_framed',
    });
    expect(result?.fill?.total).toBe(2750);
    expect(result?.fill?.comparisonRange).toEqual({ low: 2200, high: 3500 });
  });

  it('returns concrete slab relocate pricing', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'relocating',
      quantity: 1,
      unit: 'each',
      toiletRelocateFloorType: 'concrete_slab',
    });
    expect(result?.fill?.total).toBe(3500);
    expect(result?.fill?.comparisonRange).toEqual({ low: 2500, high: 5000 });
  });

  it('defaults to unsure planning assumption when floor type is unknown', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'relocating',
      quantity: 1,
      unit: 'each',
    });
    expect(result?.fill?.total).toBe(2100);
    expect(result?.fill?.splitConfidence).toBe('low');
    expect(result?.fill?.pricingRecordId).toBe('bps_national:toilet:relocate:unsure');
  });

  it('uses Based on selected floor type when user picked a known floor', () => {
    expect(
      resolveToiletRelocateQuantitySourceLabel({
        itemId: 'toilet',
        choiceId: 'relocating',
        floorType: 'concrete_slab',
        floorTypeSource: 'user_selected',
        defaultSourceLabel: 'AI assumption',
      })
    ).toBe(TOILET_RELOCATE_QUANTITY_SOURCE_USER_FLOOR);
  });

  it('keeps AI assumption when user picked not sure yet', () => {
    expect(
      resolveToiletRelocateQuantitySourceLabel({
        itemId: 'toilet',
        choiceId: 'relocating',
        floorType: 'unsure',
        floorTypeSource: 'user_selected',
        defaultSourceLabel: 'AI assumption',
      })
    ).toBe('AI assumption');
  });

  it('returns reset pricing with labor-heavy split', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'reset',
      quantity: 1,
      unit: 'each',
    });
    expect(result?.fill?.total).toBe(250);
    expect(result?.fill?.material).toBe(25);
    expect(result?.fill?.labor).toBe(225);
    expect(result?.fill?.rateSourceLabel).toMatch(/toilet reset/i);
    expect(result?.fill?.pricingRecordId).toBe('bps_national:toilet:reset:1ea');
    expect(result?.fill?.comparisonRange).toEqual({ low: 175, high: 325 });
  });

  it('scales reset pricing by toilet count', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'reset',
      quantity: 2,
      unit: 'each',
    });
    expect(result?.fill?.total).toBe(500);
    expect(result?.fill?.labor).toBe(450);
  });

  it('falls through for toilet replace so default national average applies', () => {
    const choiceOnly = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'replacing',
      quantity: 1,
      unit: 'each',
    });
    expect(choiceOnly).toBeUndefined();

    const resolved = resolveScopeItemSuggestedPricing(
      'toilet',
      { itemQuantities: {} },
      'bathroom',
      { quantity: 1, unit: 'each', quantitySource: 'default_assumption' },
      null,
      'replacing'
    );
    expect(resolved.fill?.total).toBe(BATHROOM_FIXTURE_CHOICE_PRICING.toiletReplaceEach.total);
  });

  it('includes general exclusions in pricing details', () => {
    const details = buildToiletRelocatePricingDetails('open_wood_framed');
    expect(details.excludes).toEqual(
      expect.arrayContaining(['Long-distance toilet relocation', 'Post-tension slab work'])
    );
    expect(details.disclaimer).toMatch(/Final cost may vary substantially/);
  });

  it('shows unsure status and split line on card display', () => {
    const pricing = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'toilet',
      templateKey: 'bathroom',
      choiceId: 'relocating',
      quantity: 1,
      unit: 'each',
      toiletRelocateFloorType: 'unsure',
    });
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'toilet',
      block: pricing!.fill!,
    });
    expect(display.splitLine).toBe(
      'Toilet and plumbing relocation materials $500 · Plumbing relocation and installation labor $1,600'
    );
    expect(display.statusLine).toBe(TOILET_RELOCATE_UNSURE_STATUS);
    expect(display.allowanceExtraNote).toBe('Planning range: $1,600–$2,500 each');
  });

  it('suppresses vanity pricing when staying', () => {
    const result = resolveBathroomFixtureChoiceSuggestedPricing({
      itemId: 'vanity',
      templateKey: 'bathroom',
      choiceId: 'staying',
      quantity: 1,
      unit: 'each',
    });
    expect(result).toEqual({ fill: null, comparison: null });
  });
});
