import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

const emptyMeasurements = { itemQuantities: {} };

describe('bathroom shower pan pricing', () => {
  it('prices mud pan build at ~$99/SF from shower floor sqft', () => {
    const measurements = {
      itemQuantities: {},
      showerFloorTileSqft: '15',
    };
    const resolved = resolveChecklistItemQuantity('shower_pan', measurements, {
      templateKey: 'bathroom',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'shower_pan',
      measurements,
      'bathroom',
      resolved
    );

    expect(resolved.quantity).toBe(15);
    expect(resolved.unit).toBe('sqft');
    expect(fill?.material).toBe(405);
    expect(fill?.labor).toBe(1080);
    expect(fill?.total).toBe(1485);
  });

  it('scales mud pan build with larger shower floor area', () => {
    const measurements = {
      itemQuantities: {},
      showerFloorTileSqft: '30',
    };
    const resolved = resolveChecklistItemQuantity('shower_pan', measurements, {
      templateKey: 'bathroom',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'shower_pan',
      measurements,
      'bathroom',
      resolved
    );

    expect(resolved.quantity).toBe(30);
    expect(fill?.material).toBe(810);
    expect(fill?.labor).toBe(2160);
    expect(fill?.total).toBe(2970);
  });

  it('needs shower floor sqft before mud pan pricing is ready', () => {
    const resolved = resolveChecklistItemQuantity('shower_pan', emptyMeasurements, {
      templateKey: 'bathroom',
    });
    expect(resolved.quantity).toBeNull();
    expect(resolved.pricingReady).toBe(false);
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
