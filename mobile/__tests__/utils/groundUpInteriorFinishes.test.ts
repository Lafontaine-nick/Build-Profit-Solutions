/**
 * Ground-up interior finishes: demote Interior Finishes host; promote child trades
 * after note inferences; planning qty for cabinets / counters / flooring.
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
import {
  applyGroundUpStageHostDemotions,
  hydrateScopeChecklistFromNotes,
  normalizeScopeChecklistItems,
} from '@/utils/estimateScopeChecklistUi';

function inputWith(overrides: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    flooringSqft: '1879',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('ground-up interior finish trades', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
  });

  it('excludes Interior Finishes and promotes finish trades when drywall is Yes', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'interior_finishes', label: 'Interior Finishes', inputType: 'yes_no', state: 'included' },
        { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'included' },
        { id: 'paint_trim', label: 'Paint & trim', inputType: 'yes_no', state: 'unsure' },
        { id: 'cabinets', label: 'Cabinets / vanity', inputType: 'yes_no', state: 'unsure' },
        { id: 'countertops', label: 'Counters', inputType: 'yes_no', state: 'unsure' },
        { id: 'tile_flooring', label: 'Tile & flooring', inputType: 'yes_no', state: 'unsure' },
        { id: 'floor_tile', label: 'Bath floor tile', inputType: 'yes_no', state: 'unsure' },
      ] as any,
      'ground_up'
    );
    expect(items.find((i) => i.id === 'interior_finishes')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'interior_paint')?.state).toBe('included');
    expect(items.find((i) => i.id === 'interior_trim')?.state).toBe('included');
    expect(items.find((i) => i.id === 'cabinets')?.state).toBe('included');
    expect(items.find((i) => i.id === 'countertops')?.state).toBe('included');
    expect(items.find((i) => i.id === 'tile_flooring')?.state).toBe('included');
    expect(items.find((i) => i.id === 'floor_tile')?.state).toBe('included');
  });

  it('re-promotes cabinets after notes flip drywall to Yes', () => {
    const hydrated = hydrateScopeChecklistFromNotes(
      [
        { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'unsure' },
        { id: 'paint_trim', label: 'Paint & trim', inputType: 'yes_no', state: 'unsure' },
        { id: 'cabinets', label: 'Cabinets / vanity', inputType: 'yes_no', state: 'unsure' },
        { id: 'countertops', label: 'Counters', inputType: 'yes_no', state: 'unsure' },
        { id: 'tile_flooring', label: 'Tile & flooring', inputType: 'yes_no', state: 'unsure' },
        {
          id: 'interior_finishes',
          label: 'Interior Finishes',
          inputType: 'yes_no',
          state: 'excluded',
        },
      ] as any,
      'ground_up',
      'Include drywall hang and finish, interior paint, LVP flooring throughout.'
    );
    expect(hydrated.find((i) => i.id === 'interior_finishes')?.state).toBe('excluded');
    expect(hydrated.find((i) => i.id === 'drywall')?.state).toBe('included');
    expect(hydrated.find((i) => i.id === 'interior_paint')?.state).toBe('included');
    expect(hydrated.find((i) => i.id === 'cabinets')?.state).toBe('included');
    expect(hydrated.find((i) => i.id === 'countertops')?.state).toBe('included');
    expect(hydrated.find((i) => i.id === 'tile_flooring')?.state).toBe('included');
  });

  it('applyGroundUpStageHostDemotions is idempotent on already-promoted children', () => {
    const once = applyGroundUpStageHostDemotions(
      [
        { id: 'interior_finishes', label: 'Interior Finishes', inputType: 'yes_no', state: 'included' },
        { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'included' },
        { id: 'cabinets', label: 'Cabinets', inputType: 'yes_no', state: 'unsure' },
      ] as any,
      'ground_up'
    );
    const twice = applyGroundUpStageHostDemotions(once, 'ground_up');
    expect(twice.find((i) => i.id === 'interior_finishes')?.state).toBe('excluded');
    expect(twice.find((i) => i.id === 'cabinets')?.state).toBe('included');
  });

  it('prices cabinets, counters, tile/flooring, and insulation from planning qty when takeoffs are missing', () => {
    const measurements = inputWith({});
    const cabinets = resolveScopeItemSuggestedPricing(
      'cabinets',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('cabinets', measurements, { templateKey: 'ground_up' })
    );
    const counters = resolveScopeItemSuggestedPricing(
      'countertops',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('countertops', measurements, { templateKey: 'ground_up' })
    );
    const flooring = resolveScopeItemSuggestedPricing(
      'tile_flooring',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('tile_flooring', measurements, { templateKey: 'ground_up' })
    );
    const insulation = resolveScopeItemSuggestedPricing(
      'insulation',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('insulation', measurements, { templateKey: 'ground_up' })
    );

    expect(cabinets.fill?.total).toBeGreaterThan(1000);
    expect(cabinets.fill?.basis?.unit).toBe('lf');
    expect(cabinets.fill?.basis?.quantity).toBe(Math.round(1879 / 25));

    expect(counters.fill?.total).toBeGreaterThan(1000);
    expect(counters.fill?.basis?.unit).toBe('sqft');
    expect(counters.fill?.basis?.quantity).toBe(80);

    expect(flooring.fill?.total).toBeGreaterThan(1000);
    expect(flooring.fill?.installedBudgetBenchmark).toBe(true);
    expect(flooring.fill?.rateSourceLabel).toMatch(/Blended national/i);
    // H51 mixed-finish lump — not living SF × tile $/SF.
    expect(flooring.fill?.basis?.quantity).toBe(1879);
    expect(flooring.fill!.total).toBeLessThan(1879 * 8.57);

    // Thermal envelope lump when takeoff missing — not living SF or drywall ×3.5.
    expect(insulation.fill?.installedBudgetBenchmark).toBe(true);
    expect(insulation.fill?.basis).toBeNull();
    expect(insulation.fill!.total).toBeGreaterThan(2000);
    expect(insulation.comparison?.benchmarkAction).not.toBe('included_in_stage');
  });
});
