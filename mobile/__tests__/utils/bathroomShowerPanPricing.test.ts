import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

const emptyMeasurements = { itemQuantities: {} };

describe('bathroom shower pan pricing', () => {
  it('prices mud pan build with simple entry curb at ~$1,475 each', () => {
    const resolved = resolveChecklistItemQuantity('shower_pan', emptyMeasurements, {
      templateKey: 'bathroom',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'shower_pan',
      emptyMeasurements,
      'bathroom',
      resolved
    );

    expect(resolved.quantity).toBe(1);
    expect(fill?.material).toBe(400);
    expect(fill?.labor).toBe(1075);
    expect(fill?.total).toBe(1475);
  });

  it('keeps shower bench separate from entry curb pricing', () => {
    const resolved = resolveChecklistItemQuantity('shower_bench', emptyMeasurements, {
      templateKey: 'bathroom',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'shower_bench',
      emptyMeasurements,
      'bathroom',
      resolved
    );

    expect(fill?.total).toBe(1000);
  });
});
