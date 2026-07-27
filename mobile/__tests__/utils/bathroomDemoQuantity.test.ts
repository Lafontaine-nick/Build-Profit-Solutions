import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  buildNormalizedScopeMeasurementsFromInput,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';

describe('bathroom demo quantity split', () => {
  const measurements = normalizeScopeMeasurements({
    bathroomFloorSqft: '45',
    showerWallTileSqft: '120',
    showerFloorTileSqft: '30',
    itemQuantities: {},
  });

  test('generic demo sums shower walls + shower floor only', () => {
    const resolved = resolveChecklistItemQuantity('demo', measurements, { templateKey: 'bathroom' });
    expect(resolved?.quantity).toBe(150);
    expect(resolved?.sourceLabel).toBe('Shower walls + shower floor');
  });

  test('floor_demo uses bathroom floor sqft only', () => {
    const resolved = resolveChecklistItemQuantity('floor_demo', measurements, {
      templateKey: 'bathroom',
    });
    expect(resolved).toMatchObject({ quantity: 45, unit: 'sqft', pricingReady: true });
  });

  test('legacy default demo rule still sums all tear-out areas for non-bathroom templates', () => {
    const resolved = resolveChecklistItemQuantity('demo', measurements, { templateKey: null });
    expect(resolved?.quantity).toBe(195);
    expect(resolved?.sourceLabel).toBe('Floor + shower walls + shower floor');
  });

  test('floor_demo suggested pricing uses bath floor sqft at national demo rates', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '195',
      bathroomFloorSqft: '45',
      itemQuantities: {},
    } as ScopeMeasurementsInputExtended;
    const normalized = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('floor_demo', normalized, {
      templateKey: 'bathroom',
    });
    const { fill } = resolveScopeItemSuggestedPricing('floor_demo', input, 'bathroom', resolved);
    // National floor_demo: $0.50 mat + $5 labor = $5.50/sqft × 45 sqft
    expect(fill).toMatchObject({
      material: 22.5,
      labor: 225,
      total: 247.5,
      basis: { quantity: 45, unit: 'sqft' },
    });
  });
});