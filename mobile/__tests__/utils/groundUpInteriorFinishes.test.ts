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
  ensureWholeProjectGroundUpScopeItems,
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

  it('materializes an unquantified exterior door from brief cross-trade notes', () => {
    const notes =
      'Update the kitchen with cabinet, counter, backsplash, and flooring demolition; new cabinets, counters, backsplash, flooring, drywall, plumbing, electrical, windows, insulation, an exterior door, and paint.';
    const hydrated = hydrateScopeChecklistFromNotes(
      [],
      'kitchen',
      notes,
      { itemQuantities: {} } as any,
      'kitchen'
    );

    expect(hydrated.find(item => item.id === 'exterior_doors')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
    for (const id of [
      'flooring',
      'floor_demo',
      'windows',
      'insulation',
      'drywall',
      'plumbing',
      'electrical',
    ]) {
      expect(hydrated.find(item => item.id === id)).toMatchObject({
        state: 'included',
        noteBacked: true,
      });
    }
  });

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

    // The offered thermal-envelope sqft is the priced quantity.
    expect(insulation.fill?.installedBudgetBenchmark).not.toBe(true);
    expect(insulation.fill?.basis?.unit).toBe('sqft');
    expect(insulation.fill?.basis?.quantity).toBeGreaterThan(1879);
    expect(insulation.fill?.helper).toMatch(/thermal envelope/i);
    expect(insulation.fill!.total).toBeGreaterThan(2000);
  });

  it('prices drywall, interior paint, and stucco from the quantities on the form', () => {
    const measurements = inputWith({
      floorAreaSqft: '2800',
      garageSqft: '500',
      drywallSqft: '9800',
      wallPaintSqft: '7000',
      exteriorPaintSqft: '2668',
      exteriorFinish: 'stucco',
      exteriorFinishes: ['stucco'],
      exteriorStuccoSystem: 'eifs',
    });

    const drywall = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('drywall', measurements, { templateKey: 'ground_up' })
    );
    expect(drywall.fill?.basis?.quantity).toBe(9800);

    const paint = resolveScopeItemSuggestedPricing(
      'interior_paint',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('interior_paint', measurements, {
        templateKey: 'ground_up',
      })
    );
    expect(paint.fill?.basis?.quantity).toBe(7000);
    expect(paint.fill?.installedBudgetBenchmark).not.toBe(true);
    expect(paint.fill?.total).toBeCloseTo(7000 * 3.35, 0);

    const stucco = resolveScopeItemSuggestedPricing(
      'stucco',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('stucco', measurements, { templateKey: 'ground_up' }),
      null,
      'eifs'
    );
    expect(stucco.fill?.basis?.quantity).toBe(2668);
    expect(stucco.fill?.total).toBeCloseTo(2668 * 10.5, 0);
    expect(stucco.fill?.helper).toMatch(/Synthetic stucco/i);
  });

  it('prices the planning quantities the form shows for a single-story house', () => {
    const notes =
      'New 1,960 sqft single-story home with an attached 720 sqft 3-car garage and a 240 sqft covered patio. Brick exterior. Standard builder-grade finishes.';
    const measurements = inputWith({
      floorAreaSqft: '1960',
      garageSqft: '720',
      deckSqft: '240',
      scopeNotes: notes,
      exteriorFinish: 'brick',
      exteriorFinishes: ['brick'],
    });
    const ctx = { templateKey: 'ground_up', notes };

    const drywall = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('drywall', measurements, ctx),
      null,
      null,
      notes
    );
    expect(drywall.fill?.basis?.quantity).toBe(6860);

    const excavation = resolveScopeItemSuggestedPricing(
      'excavation',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('excavation', measurements, ctx),
      null,
      null,
      notes
    );
    expect(excavation.fill?.basis?.quantity).toBeGreaterThan(110);
    expect(excavation.fill?.basis?.quantity).not.toBe(101);

    const wall = resolveScopeItemSuggestedPricing(
      'stucco',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('stucco', measurements, ctx),
      null,
      null,
      notes
    );
    expect(wall.fill?.basis?.quantity).toBeGreaterThan(1000);
    expect(wall.fill?.helper).toMatch(/brick/i);
    expect(wall.fill?.total).toBeCloseTo(
      Number(wall.fill?.basis?.quantity) * 18,
      0
    );

    const deck = resolveScopeItemSuggestedPricing(
      'decking',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('decking', measurements, ctx),
      null,
      null,
      notes
    );
    expect(deck.fill?.basis?.quantity).toBe(240);

    const items = ensureWholeProjectGroundUpScopeItems([], notes);
    expect(items.find(item => item.id === 'decking')?.state).toBe('included');
  });

  it('keeps one whole-house flooring card when tile and flooring would both price the same area', () => {
    const items = ensureWholeProjectGroundUpScopeItems(
      [
        {
          id: 'tile_flooring',
          label: 'Tile & flooring',
          inputType: 'yes_no',
          state: 'included',
        },
      ] as any,
      'New 2,800 sqft two story home with attached 2-car garage.'
    );
    expect(items.some(item => item.id === 'tile_flooring')).toBe(true);
    expect(items.some(item => item.id === 'flooring')).toBe(false);
  });
});
