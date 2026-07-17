/**
 * Ground-up exterior: demote Exterior Envelope when child trades exist;
 * stucco + windows/doors show mat+labor from bid-calibrated rates.
 */
jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { normalizeScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';

function inputWith(overrides: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    flooringSqft: '1879',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('ground-up exterior trades', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
  });

  it('adds stucco and excludes Exterior Envelope when roofing/windows are included', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'roofing', label: 'Roofing', inputType: 'yes_no', state: 'included' },
        { id: 'exterior', label: 'Exterior Envelope', inputType: 'yes_no', state: 'included' },
        { id: 'windows', label: 'Windows', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.stucco).toBeTruthy();
    expect(byId.stucco.state).toBe('included');
    expect(byId.exterior.state).toBe('excluded');
    expect(byId.roofing.state).toBe('included');
    expect(byId.windows.state).toBe('included');
    expect(byId.garage_doors).toBeTruthy();
  });

  it('promotes opening trades and stucco when Exterior Envelope was Yes', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'exterior', label: 'Exterior Envelope', inputType: 'yes_no', state: 'included' },
        { id: 'windows', label: 'Windows', inputType: 'yes_no', state: 'unsure' },
        { id: 'stucco', label: 'Stucco', inputType: 'yes_no', state: 'unsure' },
      ] as any,
      'ground_up'
    );
    expect(items.find((i) => i.id === 'exterior')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'windows')?.state).toBe('included');
    expect(items.find((i) => i.id === 'garage_doors')?.state).toBe('included');
    expect(items.find((i) => i.id === 'stucco')?.state).toBe('included');
  });

  it('prices stucco from exterior wall SF with material + labor', () => {
    const input = inputWith({ exteriorPaintSqft: '1968' });
    const resolved = resolveChecklistItemQuantity('stucco', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 1968, unit: 'sqft' });

    const { fill } = resolveScopeItemSuggestedPricing('stucco', input, 'ground_up', resolved);
    expect(fill?.material).toBeGreaterThan(0);
    expect(fill?.labor).toBeGreaterThan(0);
    // Local stucco ~$7.76/SF blended with national $9 → near Lot 41 ~$17.5k band for ~2k SF.
    expect(fill!.total).toBeGreaterThan(14000);
    expect(fill!.total).toBeLessThan(22000);
    expect(fill?.rateSourceLabel).toMatch(/National Average/i);
  });

  it('prices windows from living SF when window count is missing', () => {
    const input = inputWith({});
    const resolved = resolveChecklistItemQuantity('windows', input, { templateKey: 'ground_up' });
    expect(resolved.quantity).toBeNull();

    const { fill } = resolveScopeItemSuggestedPricing('windows', input, 'ground_up', resolved);
    expect(fill?.basis).toEqual({ quantity: 1879, unit: 'sqft' });
    expect(fill?.material).toBeGreaterThan(0);
    expect(fill?.labor).toBeGreaterThan(0);
    // Windows bid median ~$12k / living SF for Lot 41-sized homes.
    expect(fill!.total).toBeGreaterThan(6000);
    expect(fill!.total).toBeLessThan(12000);
  });

  it('prices windows from opening count when provided', () => {
    const input = inputWith({
      itemQuantities: {
        windows: { quantity: 16, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const resolved = resolveChecklistItemQuantity('windows', input, { templateKey: 'ground_up' });
    expect(resolved).toMatchObject({ quantity: 16, unit: 'each' });
    const { fill } = resolveScopeItemSuggestedPricing('windows', input, 'ground_up', resolved);
    expect(fill?.basis).toEqual({ quantity: 16, unit: 'each' });
    expect(fill!.total).toBeGreaterThan(10000);
    expect(fill!.total).toBeLessThan(14000);
  });
});
