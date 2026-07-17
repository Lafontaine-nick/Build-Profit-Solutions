jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import { blendBarometerLump } from '@/utils/builderBudgetLumpBlend';
import {
  EXTERIOR_FLATWORK_DETACHED_MEDIAN_TOTAL,
  EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT,
  EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL,
  EXTERIOR_FLATWORK_NATIONAL_RATE,
  exteriorFlatworkBarometerLocal,
  resolveExteriorFlatworkComparable,
  resolveExteriorFlatworkLumpSuggestedFill,
} from '@/utils/exteriorFlatworkPricing';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
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

describe('exteriorFlatworkPricing', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
  });

  it('keeps Silver Leaf flatwork per-home (already ÷2)', () => {
    expect(EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT.silverLeaf).toBe(12500);
    expect(EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT.lot41).toBe(7500);
    expect(EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT.lot49).toBe(13500);
  });

  it('floors Plan 41 H17 to package mid so lump is not porch-only low', () => {
    expect(exteriorFlatworkBarometerLocal(7500)).toBe(EXTERIOR_FLATWORK_DETACHED_MEDIAN_TOTAL);
    expect(exteriorFlatworkBarometerLocal(12500)).toBe(12500);

    const local = exteriorFlatworkBarometerLocal(EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT.lot41);
    const expected = blendBarometerLump(local, EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL);
    // ~$11.5k mid × 0.6 + NAHB $9.6k × 0.4 ≈ $10.8k — above Plan 41 raw $7.5k and national.
    expect(expected).toBeGreaterThan(EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL);
    expect(expected).toBeGreaterThan(10000);
    expect(expected).toBeLessThan(12500);

    const comparable = resolveExteriorFlatworkComparable({ livingSf: 1879 });
    expect(comparable).toMatchObject({
      total: expected,
      matchKind: 'exact_project',
      projectId: 'lot41',
      sourceSplitTreatment: 'installed_lump_sum',
    });
    expect(comparable.rateSourceLabel).toMatch(/Plan 41 \(package mid\)/);
    expect(comparable.helper).toMatch(/floored to package mid/i);

    const fill = resolveExteriorFlatworkLumpSuggestedFill({ livingSf: 1879 });
    expect(fill.total).toBe(expected);

    const ca = resolveExteriorFlatworkLumpSuggestedFill({ livingSf: 1879, state: 'CA' });
    expect(ca.total).toBeCloseTo(expected * 1.38, 1);
  });

  it('keeps Silver Leaf-sized homes above the package mid', () => {
    const fill = resolveExteriorFlatworkLumpSuggestedFill({ livingSf: 2171.5 });
    const expected = blendBarometerLump(12500, EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL);
    expect(fill.total).toBe(expected);
    expect(fill.total).toBeGreaterThan(11000);
  });

  it('adds Exterior concrete flatwork card on ground_up normalize', () => {
    const items = normalizeScopeChecklistItems(
      [{ id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'included' }] as any,
      'ground_up'
    );
    const flatwork = items.find((i) => i.id === 'pour_flatwork');
    expect(flatwork).toBeTruthy();
    expect(flatwork?.label).toMatch(/flatwork/i);
    expect(flatwork?.helperText).toMatch(/not the house or garage slab/i);
  });

  it('prices pour_flatwork from exterior SF at national $10/SF', () => {
    const input = inputWith({ concreteSqft: '800' });
    const resolved = resolveChecklistItemQuantity('pour_flatwork', input, {
      templateKey: 'ground_up',
    });
    expect(resolved).toMatchObject({ quantity: 800, unit: 'sqft' });

    const { fill } = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      input,
      'ground_up',
      resolved
    );
    expect(fill?.material).toBe(EXTERIOR_FLATWORK_NATIONAL_RATE.material * 800);
    expect(fill?.labor).toBe(EXTERIOR_FLATWORK_NATIONAL_RATE.labor * 800);
    expect(fill!.total).toBe(8000);
    expect(fill?.rateSourceLabel).toMatch(/National Average/i);
  });

  it('falls back to floored package-mid blend when flatwork SF is missing', () => {
    const input = inputWith({});
    const resolved = resolveChecklistItemQuantity('pour_flatwork', input, {
      templateKey: 'ground_up',
    });
    expect(resolved.quantity).toBeNull();

    const local = exteriorFlatworkBarometerLocal(EXTERIOR_FLATWORK_INSTALLED_BY_PROJECT.lot41);
    const expected = blendBarometerLump(local, EXTERIOR_FLATWORK_NATIONAL_PACKAGE_TOTAL);
    const { fill } = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      input,
      'ground_up',
      resolved
    );
    expect(fill?.total).toBe(expected);
    expect(fill?.lumpSumOnly).toBe(true);
    expect(fill?.rateSourceLabel).toMatch(/package mid/);
    expect(fill?.helper).toMatch(/flatwork/i);
  });
});
