/**
 * Ground-up MEP / exterior trades: counts for MEP and window/door openings.
 */
jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import {
  getNationalAverageBudgetSplit,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { normalizeScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import {
  acceptedTradeScopeKeysForStage,
  stageHasAcceptedTradePricing,
} from '@/utils/measurementSemantics/scopePriceUi';

function inputWith(overrides: Partial<ScopeMeasurementsInputExtended>): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    flooringSqft: '1879',
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('ground-up MEP / exterior count gates', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
  });

  it('injects plumbing, electrical, HVAC, windows/doors, and stucco into ground-up checklists', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'roofing', label: 'Roofing', inputType: 'yes_no', state: 'included' },
        { id: 'mep_rough', label: 'MEP rough-in', inputType: 'yes_no', state: 'included' },
        { id: 'exterior', label: 'Exterior Envelope', inputType: 'yes_no', state: 'included' },
      ] as any,
      'ground_up'
    );
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'plumbing_rough',
        'electrical_rough',
        'hvac',
        'windows',
        'stucco',
        'mep_rough',
      ])
    );
    expect(items.find((i) => i.id === 'exterior')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'mep_rough')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'plumbing_rough')?.state).toBe('included');
    expect(items.find((i) => i.id === 'electrical_rough')?.state).toBe('included');
    expect(items.find((i) => i.id === 'hvac')?.state).toBe('included');
  });

  it('excludes MEP rough-in and promotes plumbing / electrical / HVAC when MEP was Yes', () => {
    const items = normalizeScopeChecklistItems(
      [{ id: 'mep_rough', label: 'MEP rough-in', inputType: 'yes_no', state: 'included' }] as any,
      'ground_up'
    );
    expect(items.find((i) => i.id === 'mep_rough')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'plumbing_rough')?.state).toBe('included');
    expect(items.find((i) => i.id === 'electrical_rough')?.state).toBe('included');
    expect(items.find((i) => i.id === 'hvac')?.state).toBe('included');
  });

  it('does not treat MEP living-SF planning as a primary takeoff quantity', () => {
    const measurements = inputWith({});
    for (const itemId of ['plumbing_rough', 'electrical_rough', 'hvac'] as const) {
      const resolved = resolveChecklistItemQuantity(itemId, measurements, { templateKey: 'ground_up' });
      expect(resolved.quantity == null || Number(resolved.quantity) <= 0).toBe(true);
    }
  });

  it('prices plumbing / electrical / HVAC from planning qty when counts are missing', () => {
    const measurements = inputWith({});
    const plumbing = resolveScopeItemSuggestedPricing(
      'plumbing_rough',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('plumbing_rough', measurements, { templateKey: 'ground_up' })
    );
    const electrical = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('electrical_rough', measurements, { templateKey: 'ground_up' })
    );
    const hvac = resolveScopeItemSuggestedPricing(
      'hvac',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('hvac', measurements, { templateKey: 'ground_up' })
    );
    expect(plumbing.fill?.basis).toBeNull();
    expect(electrical.fill?.basis).toBeNull();
    expect(hvac.fill?.basis).toEqual({ quantity: 1, unit: 'each' });
    expect(plumbing.fill!.total).toBeGreaterThan(16000);
    expect(plumbing.fill!.total).toBeLessThan(22000);
    expect(electrical.fill!.total).toBeGreaterThan(16000);
    expect(electrical.fill!.total).toBeLessThan(22000);
    expect(hvac.fill!.total).toBeGreaterThan(10000);
  });

  it('prices plumbing / electrical / HVAC / openings from entered counts', () => {
    const measurements = inputWith({
      itemQuantities: {
        plumbing_rough: { quantity: 12, unit: 'each', quantitySource: 'user_entered' },
        electrical_rough: { quantity: 40, unit: 'each', quantitySource: 'user_entered' },
        hvac: { quantity: 1, unit: 'each', quantitySource: 'user_entered' },
        windows_doors: { quantity: 18, unit: 'each', quantitySource: 'user_entered' },
      },
    });

    const plumbingResolved = resolveChecklistItemQuantity('plumbing_rough', measurements, {
      templateKey: 'ground_up',
    });
    const electricalResolved = resolveChecklistItemQuantity('electrical_rough', measurements, {
      templateKey: 'ground_up',
    });
    const hvacResolved = resolveChecklistItemQuantity('hvac', measurements, { templateKey: 'ground_up' });
    const openingsResolved = resolveChecklistItemQuantity('windows_doors', measurements, {
      templateKey: 'ground_up',
    });

    const plumbing = resolveScopeItemSuggestedPricing(
      'plumbing_rough',
      measurements,
      'ground_up',
      plumbingResolved
    );
    const electrical = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      measurements,
      'ground_up',
      electricalResolved
    );
    const hvac = resolveScopeItemSuggestedPricing('hvac', measurements, 'ground_up', hvacResolved);
    const openings = resolveScopeItemSuggestedPricing(
      'windows_doors',
      measurements,
      'ground_up',
      openingsResolved
    );

    expect(plumbing.fill).toMatchObject({ material: 12 * 150, labor: 12 * 350, total: 6000 });
    expect(electrical.fill).toMatchObject({ material: 40 * 50, labor: 40 * 125, total: 7000 });
    // 60% local ~$18.5k + 40% national ~$16k/system ≈ $17.5k.
    expect(hvac.fill!.total).toBeGreaterThan(16000);
    expect(hvac.fill!.total).toBeLessThan(20000);
    // Windows openings use bid-calibrated $/each (~$750 local vs $725 national).
    expect(openings.fill!.total).toBeGreaterThan(13000);
    expect(openings.fill!.total).toBeLessThan(14000);
  });

  it('uses per-system HVAC rates when unit is each (not living SF)', () => {
    const each = getNationalAverageBudgetSplit('hvac', 'each');
    const sqft = getNationalAverageBudgetSplit('hvac', 'sqft');
    expect(each?.unit).toBe('each');
    expect(each?.material).toBe(8500);
    expect(each?.labor).toBe(7500);
    expect(sqft?.unit).toBe('sqft');
  });

  it('does not price windows/doors from living SF when opening count is missing', () => {
    const measurements = inputWith({});
    const windows = resolveScopeItemSuggestedPricing(
      'windows_doors',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('windows_doors', measurements, { templateKey: 'ground_up' })
    );
    expect(windows.fill).toBeFalsy();
  });

  it('prices excavation from planning CY when excavationCy is missing', () => {
    const measurements = inputWith({});
    const excavation = resolveScopeItemSuggestedPricing(
      'excavation',
      measurements,
      'ground_up',
      resolveChecklistItemQuantity('excavation', measurements, { templateKey: 'ground_up' })
    );
    expect(excavation.fill?.basis?.unit).toBe('cy');
    expect(excavation.fill!.basis!.quantity).toBeGreaterThan(50);
    expect(excavation.fill!.basis!.quantity).toBeLessThan(200);
    expect(excavation.fill!.material).toBeGreaterThan(0);
    expect(excavation.fill!.labor).toBeGreaterThan(0);
    expect(excavation.fill!.total).toBeGreaterThan(1000);
  });

  it('excludes Sitework and promotes excavation when Sitework was Yes', () => {
    const items = normalizeScopeChecklistItems(
      [
        { id: 'sitework', label: 'Sitework', inputType: 'yes_no', state: 'included' },
        { id: 'excavation', label: 'Excavation', inputType: 'yes_no', state: 'unsure' },
      ] as any,
      'ground_up'
    );
    expect(items.find((i) => i.id === 'sitework')?.state).toBe('excluded');
    expect(items.find((i) => i.id === 'excavation')?.state).toBe('included');
  });

  it('makes MEP stage comparison-only when a trade price is accepted', () => {
    const acceptance = {
      plumbing_rough: {
        selectionStatus: 'accepted',
        totalAmount: 6000,
      },
    };
    expect(acceptedTradeScopeKeysForStage('major-systems-rough-ins', acceptance)).toEqual([
      'plumbing_rough',
    ]);
    expect(stageHasAcceptedTradePricing('major-systems-rough-ins', acceptance)).toBe(true);
  });
});
