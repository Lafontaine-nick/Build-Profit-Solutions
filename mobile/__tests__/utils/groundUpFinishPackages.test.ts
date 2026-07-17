jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import { blendBarometerLump } from '@/utils/builderBudgetLumpBlend';
import {
  ELECTRICAL_TRIM_INSTALLED_BY_PROJECT,
  ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL,
  ELECTRICAL_TRIM_NATIONAL_PACKAGE_RAW,
  electricalTrimBarometerLocal,
  LANDSCAPING_INSTALLED_BY_PROJECT,
  LANDSCAPING_NATIONAL_AVERAGE_TOTAL,
  PLUMBING_TRIM_INSTALLED_BY_PROJECT,
  PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL,
  PLUMBING_TRIM_NATIONAL_PACKAGE_RAW,
  plumbingTrimBarometerLocal,
  resolveElectricalTrimLumpSuggestedFill,
  resolveLandscapingLumpSuggestedFill,
  resolvePlumbingTrimLumpSuggestedFill,
  scaleFixtureNationalPackage,
} from '@/utils/groundUpFinishPackages';
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

describe('groundUpFinishPackages', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
  });

  it('uses size-adjusted NAHB fixture anchors (~$5.6k / ~$3.4k at Plan 41 SF)', () => {
    expect(PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL).toBe(5600);
    expect(ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL).toBe(3400);
    expect(scaleFixtureNationalPackage(PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL, 1879)).toBe(5600);
    expect(scaleFixtureNationalPackage(ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL, 1879)).toBe(3400);
    expect(
      scaleFixtureNationalPackage(
        PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL,
        2171.5,
        PLUMBING_TRIM_NATIONAL_PACKAGE_RAW
      )
    ).toBeGreaterThan(5600);
  });

  it('damps Plan 39 fixture scale so it stays under raw NAHB (not ~$9.2k)', () => {
    const plumbing = scaleFixtureNationalPackage(
      PLUMBING_TRIM_NATIONAL_AVERAGE_TOTAL,
      3098,
      PLUMBING_TRIM_NATIONAL_PACKAGE_RAW
    );
    const electrical = scaleFixtureNationalPackage(
      ELECTRICAL_TRIM_NATIONAL_AVERAGE_TOTAL,
      3098,
      ELECTRICAL_TRIM_NATIONAL_PACKAGE_RAW
    );
    expect(plumbing).toBeLessThan(7500);
    expect(plumbing).toBeGreaterThan(5600);
    expect(plumbing).toBeLessThanOrEqual(PLUMBING_TRIM_NATIONAL_PACKAGE_RAW);
    expect(electrical).toBeLessThan(4500);
    expect(electrical).toBeGreaterThan(3400);

    const fill = resolvePlumbingTrimLumpSuggestedFill({ livingSf: 3098, state: 'UT' });
    expect(fill.total).toBe(plumbing);
    expect(fill.total).toBeLessThan(8000);
  });

  it('floors thin SHV fixture barometer legs to the size-adjusted NAHB package', () => {
    expect(plumbingTrimBarometerLocal(2000, 5600)).toBe(5600);
    expect(electricalTrimBarometerLocal(2300, 3400)).toBe(3400);
    expect(electricalTrimBarometerLocal(4000, 3400)).toBe(4000);
  });

  it('floors thin Plan 41 fixture lines to size-adjusted NAHB before blend (UT = no state scale)', () => {
    expect(PLUMBING_TRIM_INSTALLED_BY_PROJECT.lot41).toBe(2000);
    expect(ELECTRICAL_TRIM_INSTALLED_BY_PROJECT.lot41).toBe(2300);
    expect(LANDSCAPING_INSTALLED_BY_PROJECT.lot41).toBe(9800);

    const plumbing = resolvePlumbingTrimLumpSuggestedFill({ livingSf: 1879, state: 'UT' });
    expect(plumbing.total).toBe(5600);
    expect(plumbing.rateSourceLabel).toBe('Blended national + barometer · Plan 41 (national floor)');
    expect(plumbing.helper).toMatch(/size-adjusted NAHB plumbing fixtures/i);

    const electrical = resolveElectricalTrimLumpSuggestedFill({ livingSf: 1879 });
    expect(electrical.total).toBe(3400);
    expect(electrical.rateSourceLabel).toMatch(/Plan 41 \(national floor\)/);

    const landscaping = resolveLandscapingLumpSuggestedFill({ livingSf: 1879 });
    expect(landscaping.total).toBe(blendBarometerLump(9800, LANDSCAPING_NATIONAL_AVERAGE_TOTAL));
    expect(landscaping.rateSourceLabel).toMatch(/Blended national \+ barometer · Plan 41/);
    expect(landscaping.material).toBeCloseTo(landscaping.total * 0.55, 1);
    expect(landscaping.labor).toBeCloseTo(landscaping.total * 0.45, 1);
    expect(landscaping.material + landscaping.labor).toBeCloseTo(landscaping.total, 1);
  });

  it('blends Plan 39 landscaping with national (not exact H16 $15,500)', () => {
    const fill = resolveLandscapingLumpSuggestedFill({ livingSf: 3098, state: 'UT' });
    expect(fill.projectId).toBe('lot39');
    expect(fill.total).toBe(blendBarometerLump(15500, LANDSCAPING_NATIONAL_AVERAGE_TOTAL));
    expect(fill.total).toBeCloseTo(13007.6, 1);
    expect(fill.total).not.toBe(15500);
    expect(fill.rateSourceLabel).toBe('Blended national + barometer · Plan 39');
    expect(fill.material).toBeGreaterThan(0);
    expect(fill.labor).toBeGreaterThan(0);
    expect(fill.material + fill.labor).toBeCloseTo(fill.total, 1);
  });

  it('scales Plan 39 landscaping by CA regional multiplier', () => {
    const ut = resolveLandscapingLumpSuggestedFill({ livingSf: 3098, state: 'UT' });
    const ca = resolveLandscapingLumpSuggestedFill({ livingSf: 3098, state: 'CA' });
    expect(ca.total).toBeCloseTo(ut.total * 1.38, 1);
    expect(ca.rateSourceLabel).toBe('Blended national + barometer · Plan 39 · CA');
  });

  it('uses detached mid local leg when living SF does not match a plan', () => {
    const fill = resolveLandscapingLumpSuggestedFill({ livingSf: 2200, state: 'TX' });
    expect(fill.projectId).toBeNull();
    expect(fill.rateSourceLabel).toMatch(/detached mid · TX/);
    expect(fill.total).toBeGreaterThan(0);
  });

  it('adds plumbing_trim, electrical_trim, and landscaping cards on ground_up normalize', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'plumbing_rough', label: 'Plumbing rough-in', inputType: 'yes_no', state: 'included' },
        { id: 'excavation', label: 'Excavation', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId.plumbing_trim?.label).toMatch(/plumbing fixtures/i);
    expect(byId.electrical_trim?.label).toMatch(/electrical fixtures/i);
    expect(byId.landscaping?.label).toMatch(/landscap/i);
  });

  it('suggests blended lumps through resolveScopeItemSuggestedPricing', () => {
    const input = inputWith({});
    const landscapingTotal = blendBarometerLump(9800, LANDSCAPING_NATIONAL_AVERAGE_TOTAL);
    for (const [id, total, sourcePattern, lumpOnly] of [
      ['plumbing_trim', 5600, /Blended national.*Plan 41 \(national floor\)/, true],
      ['electrical_trim', 3400, /Blended national.*Plan 41 \(national floor\)/, true],
      ['landscaping', landscapingTotal, /Blended national.*Plan 41/, false],
    ] as const) {
      const resolved = resolveChecklistItemQuantity(id, input, { templateKey: 'ground_up' });
      const { fill } = resolveScopeItemSuggestedPricing(id, input, 'ground_up', resolved, {
        state: 'UT',
      });
      expect(fill?.total).toBe(total);
      expect(fill?.lumpSumOnly).toBe(lumpOnly);
      expect(fill?.rateSourceLabel).toMatch(sourcePattern);
    }

    const landscaping = resolveScopeItemSuggestedPricing(
      'landscaping',
      input,
      'ground_up',
      resolveChecklistItemQuantity('landscaping', input, { templateKey: 'ground_up' }),
      { state: 'UT' }
    );
    expect(landscaping.fill?.material).toBeGreaterThan(0);
    expect(landscaping.fill?.labor).toBeGreaterThan(0);

    const ca = resolveScopeItemSuggestedPricing(
      'landscaping',
      input,
      'ground_up',
      resolveChecklistItemQuantity('landscaping', input, { templateKey: 'ground_up' }),
      { state: 'CA' }
    );
    expect(ca.fill?.total).toBeCloseTo(landscapingTotal * 1.38, 1);
    expect(ca.fill?.rateSourceLabel).toMatch(/· CA$/);
  });
});
