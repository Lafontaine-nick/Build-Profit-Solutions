jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import { blendBarometerLump } from '@/utils/builderBudgetLumpBlend';
import {
  EXTERIOR_DOORS_INSTALLED_BY_PROJECT,
  EXTERIOR_DOORS_NATIONAL_PACKAGE_TOTAL,
  GARAGE_DOOR_TYPE_RATES,
  SLIDING_DOORS_DETACHED_MEDIAN_TOTAL,
  SLIDING_DOORS_INSTALLED_BY_PROJECT,
  SLIDING_DOORS_NATIONAL_PACKAGE_TOTAL,
  inferDefaultGarageDoorCounts,
  resolveExteriorDoorsLumpSuggestedFill,
  resolveGarageDoorSuggestedPricing,
  resolveOpeningSizeTierSuggestedPricing,
  resolveSlidingDoorsLumpSuggestedFill,
} from '@/utils/exteriorOpeningsPricing';
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
    garageSqft: '994',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('exterior openings split + garage door types', () => {
  it('ensures garage_doors card exists even when checklist never had openings', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'included' },
        { id: 'plumbing_rough', label: 'Plumbing rough-in', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const ids = items.map((i) => i.id);
    expect(ids).toContain('garage_doors');
    expect(ids).toContain('windows');
    expect(ids).toContain('exterior_doors');
    expect(ids).toContain('sliding_doors');
    expect(items.find((i) => i.id === 'garage_doors')?.label).toBe('Garage doors');
  });

  it('migrates legacy windows_doors into four opening trades', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'windows_doors', label: 'Windows & doors', inputType: 'yes_no', state: 'included' },
        { id: 'exterior', label: 'Exterior Envelope', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const ids = items.map((i) => i.id);
    expect(ids).toContain('windows');
    expect(ids).toContain('exterior_doors');
    expect(ids).toContain('sliding_doors');
    expect(ids).toContain('garage_doors');
    expect(ids).not.toContain('windows_doors');
    expect(items.find((i) => i.id === 'exterior')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'windows')?.state).toBe('included');
    expect(items.find((i) => i.id === 'garage_doors')?.state).toBe('included');
  });

  it('prices Silver Leaf-style double garage door at $2,400', () => {
    expect(GARAGE_DOOR_TYPE_RATES.double.total).toBe(2400);
    const pkg = resolveGarageDoorSuggestedPricing({ single: 0, double: 1, rv: 0 });
    expect(pkg).toMatchObject({ material: 1700, labor: 700, total: 2400, quantity: 1 });
  });

  it('scales garage door package by CA regional multiplier', () => {
    const ut = resolveGarageDoorSuggestedPricing({ single: 0, double: 1, rv: 0 }, { state: 'UT' });
    const ca = resolveGarageDoorSuggestedPricing({ single: 0, double: 1, rv: 0 }, { state: 'CA' });
    expect(ut?.total).toBe(2400);
    expect(ca?.total).toBeCloseTo(2400 * 1.38, 1);
    expect(ca?.sourceLabel).toMatch(/· CA$/);
  });

  it('prices SHV-style double + RV near $10,700', () => {
    const pkg = resolveGarageDoorSuggestedPricing({ single: 0, double: 1, rv: 1 });
    expect(pkg?.total).toBe(2400 + 8300);
    expect(pkg?.total).toBe(10700);
  });

  it('infers a double-door type from garage SF but does not auto-count garage doors', () => {
    expect(inferDefaultGarageDoorCounts(994)).toEqual({ single: 0, double: 1, rv: 0 });
    const input = inputWith({});
    const resolved = resolveChecklistItemQuantity('garage_doors', input, { templateKey: 'ground_up' });
    expect(resolved.unit).toBe('each');
    expect(resolved.quantity).toBeNull();
    const { fill } = resolveScopeItemSuggestedPricing('garage_doors', input, 'ground_up', resolved);
    expect(fill).toBeFalsy();
  });

  it('prices explicit double + RV from type counts', () => {
    const input = inputWith({
      garageDoorDoubleCount: 1,
      garageDoorRvCount: 1,
    } as any);
    const resolved = resolveChecklistItemQuantity('garage_doors', input, { templateKey: 'ground_up' });
    expect(resolved.quantity).toBe(2);
    const { fill } = resolveScopeItemSuggestedPricing('garage_doors', input, 'ground_up', resolved);
    expect(fill?.total).toBe(10700);
    expect(fill?.helper).toMatch(/Double/i);
    expect(fill?.helper).toMatch(/RV/i);
  });

  it('plans exterior / sliding doors from blended lumps when counts are missing', () => {
    expect(EXTERIOR_DOORS_INSTALLED_BY_PROJECT.lot41).toBe(4000);
    expect(SLIDING_DOORS_INSTALLED_BY_PROJECT.lot41).toBe(9800);
    const exteriorExpected = blendBarometerLump(4000, EXTERIOR_DOORS_NATIONAL_PACKAGE_TOTAL);
    const slidingExpected = blendBarometerLump(9800, SLIDING_DOORS_NATIONAL_PACKAGE_TOTAL);
    const slidingMid = blendBarometerLump(
      SLIDING_DOORS_DETACHED_MEDIAN_TOTAL,
      SLIDING_DOORS_NATIONAL_PACKAGE_TOTAL
    );
    expect(resolveExteriorDoorsLumpSuggestedFill({ livingSf: 1879 }).total).toBe(exteriorExpected);
    expect(resolveSlidingDoorsLumpSuggestedFill({ livingSf: 1879 }).total).toBe(slidingExpected);
    expect(resolveSlidingDoorsLumpSuggestedFill({ livingSf: 2200 }).total).toBe(slidingMid);

    const input = inputWith({});
    const doorResolved = resolveChecklistItemQuantity('exterior_doors', input, {
      templateKey: 'ground_up',
    });
    const doorPriced = resolveScopeItemSuggestedPricing(
      'exterior_doors',
      input,
      'ground_up',
      doorResolved
    );
    expect(doorPriced.fill?.total).toBe(exteriorExpected);
    expect(doorPriced.fill?.lumpSumOnly).toBe(true);
    expect(doorPriced.fill?.rateSourceLabel).toMatch(/Blended national.*Plan 41/);
    expect(doorPriced.fill?.helper).toMatch(/iron/i);

    const slidingResolved = resolveChecklistItemQuantity('sliding_doors', input, {
      templateKey: 'ground_up',
    });
    const slidingPriced = resolveScopeItemSuggestedPricing(
      'sliding_doors',
      input,
      'ground_up',
      slidingResolved
    );
    expect(slidingPriced.fill?.total).toBe(slidingExpected);
    expect(slidingPriced.fill?.lumpSumOnly).toBe(true);
    expect(slidingPriced.fill?.rateSourceLabel).toMatch(/Blended national.*Plan 41/);
  });

  it('prices windows from opening count and exterior/sliding from each rates', () => {
    const windowsInput = inputWith({
      itemQuantities: {
        windows: { quantity: 16, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const windowsResolved = resolveChecklistItemQuantity('windows', windowsInput, {
      templateKey: 'ground_up',
    });
    const windowsPriced = resolveScopeItemSuggestedPricing(
      'windows',
      windowsInput,
      'ground_up',
      windowsResolved
    );
    expect(windowsPriced.fill?.basis).toEqual({ quantity: 16, unit: 'each' });
    expect(windowsPriced.fill!.total).toBeGreaterThan(10000);
    expect(windowsPriced.fill!.total).toBeLessThan(14000);

    const doorInput = inputWith({
      itemQuantities: {
        exterior_doors: { quantity: 2, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const doorResolved = resolveChecklistItemQuantity('exterior_doors', doorInput, {
      templateKey: 'ground_up',
    });
    const doorPriced = resolveScopeItemSuggestedPricing(
      'exterior_doors',
      doorInput,
      'ground_up',
      doorResolved
    );
    // National ~$2,300 × 2, barometer nudges toward ~$2,500/ea
    expect(doorPriced.fill!.total).toBeGreaterThan(4000);
    expect(doorPriced.fill!.total).toBeLessThan(6000);

    const slidingInput = inputWith({
      itemQuantities: {
        sliding_doors: { quantity: 2, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const slidingResolved = resolveChecklistItemQuantity('sliding_doors', slidingInput, {
      templateKey: 'ground_up',
    });
    const slidingPriced = resolveScopeItemSuggestedPricing(
      'sliding_doors',
      slidingInput,
      'ground_up',
      slidingResolved
    );
    // National ~$2,500 × 2 blended with local ~$4,000/ea
    expect(slidingPriced.fill!.total).toBeGreaterThan(5000);
    expect(slidingPriced.fill!.total).toBeLessThan(10000);
  });

  it('prices extracted window size codes above a flat standard each', () => {
    const pkg = resolveOpeningSizeTierSuggestedPricing({
      itemId: 'windows',
      quantity: 10,
      mix: { standard: 6, medium: 0, large: 0, oversized: 4 },
    });
    const standard = resolveOpeningSizeTierSuggestedPricing({
      itemId: 'windows',
      quantity: 10,
      mix: { standard: 10, medium: 0, large: 0, oversized: 0 },
    });
    expect(standard?.total).toBe(7250);
    expect(pkg!.total).toBeGreaterThan(standard!.total);
    expect(pkg!.helper).toMatch(/6 standard/i);
    expect(pkg!.helper).toMatch(/4 oversized/i);
  });
});
