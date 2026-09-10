import {
  inferExistingKitchenFromNotes,
  inferKitchenInstallFromIntent,
  KITCHEN_QM_EMBEDDED_IDS,
  kitchenQmScopeCardVisible,
  migrateKitchenDemoSplit,
  resolveKitchenDemoFromIntent,
  resolveKitchenInstallScopeCounts,
  shouldHideKitchenScopeCardInQmEmbed,
  suggestKitchenDemoFromExistingInstall,
  syncKitchenQmScopeItems,
} from '@/utils/qmScopePanels/kitchenRemodel';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

function item(id: string, state: ScopeChecklistItem['state'] = 'unsure'): ScopeChecklistItem {
  return { id, label: id, inputType: 'yes_no', state, category: 'general' };
}

describe('kitchenRemodel QM', () => {
  it('keeps the cabinet install scope card visible in Confirm Scope', () => {
    expect(KITCHEN_QM_EMBEDDED_IDS.has('cabinets')).toBe(false);
  });

  it('infers existing cabinets from notes', () => {
    const out = inferExistingKitchenFromNotes('demo existing cabinets and install new quartz counters');
    expect(out.kitchenExistingCabinetCount).toBe(1);
  });

  it('infers install from notes', () => {
    const out = inferKitchenInstallFromIntent({
      notes: 'new cabinets, backsplash, and appliance hookup',
    });
    expect(out.kitchenInstallCabinetCount).toBe(1);
    expect(out.kitchenInstallBacksplashCount).toBe(1);
    expect(out.kitchenInstallApplianceCount).toBe(1);
  });

  it('does not treat an island countertop mention as a new island base install', () => {
    const out = inferKitchenInstallFromIntent({
      notes: 'Demo island countertop and install new quartz countertops.',
    });
    expect(out.kitchenInstallIslandCount).toBeNull();
    expect(out.kitchenInstallCounterCount).toBe(1);
  });

  it('derives demo when replacing existing cabinets', () => {
    const existing = inferExistingKitchenFromNotes('existing cabinets');
    const install = inferKitchenInstallFromIntent({ notes: 'new cabinets' });
    const demo = resolveKitchenDemoFromIntent({
      notes: 'kitchen remodel — new cabinets',
      existing,
      install,
    });
    expect(demo.kitchenDemoCabinetCount).toBe(1);
  });

  it('recognizes explicit cabinet/counter demo without requiring existing-count inference', () => {
    const install = inferKitchenInstallFromIntent({
      notes: 'Demo all cabinets and counter tops and install new cabinets.',
    });
    const demo = resolveKitchenDemoFromIntent({
      notes: 'Demo all cabinets and counter tops and install new cabinets.',
      existing: inferExistingKitchenFromNotes('Demo all cabinets and counter tops.'),
      install,
    });
    expect(demo.kitchenDemoCabinetCount).toBe(1);
    expect(demo.kitchenDemoCounterCount).toBe(1);
    expect(demo.kitchenDemoIslandCount).toBeNull();
  });

  it('syncs scope checklist from QM counts', () => {
    const items = [
      item('cabinets'),
      item('countertops'),
      item('cabinet_demo'),
      item('countertop_demo'),
      item('floor_demo'),
    ];
    const next = syncKitchenQmScopeItems(items, {
      cabinetLf: '18',
      countertopSqft: '55',
      kitchenExistingCabinetCount: 1,
      kitchenExistingCounterCount: 1,
      kitchenExistingFloorCount: 1,
      kitchenFloorSqft: '120',
      kitchenDemoCabinetCount: 1,
      kitchenDemoCounterCount: 1,
    });
    expect(next.find((r) => r.id === 'cabinets')?.state).toBe('included');
    expect(next.find((r) => r.id === 'countertops')?.state).toBe('included');
    expect(next.find((r) => r.id === 'cabinet_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'countertop_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'floor_demo')?.state).toBe('included');
  });

  it('removes a previously synced flooring scope when kitchen floor sqft is cleared', () => {
    const items = [item('flooring', 'included')];
    const next = syncKitchenQmScopeItems(items, {
      kitchenFloorSqft: null,
    });
    expect(next.find((r) => r.id === 'flooring')?.state).toBe('excluded');
  });

  it('syncs kitchen install scopes from sqft and LF measurements', () => {
    const items = [item('cabinets'), item('countertops'), item('backsplash')];
    const next = syncKitchenQmScopeItems(items, {
      cabinetLf: '24',
      countertopSqft: '55',
      backsplashSqft: '28',
    });
    expect(next.every((row) => row.state === 'included')).toBe(true);
  });

  it('falls back to saved install steppers when measurement fields are omitted from sync payload', () => {
    const items = [item('cabinets'), item('backsplash')];
    const next = syncKitchenQmScopeItems(items, {
      kitchenInstallCabinetCount: 1,
      kitchenInstallBacksplashCount: 1,
    });
    expect(next.find((r) => r.id === 'cabinets')?.state).toBe('included');
    expect(next.find((r) => r.id === 'backsplash')?.state).toBe('included');
  });

  it('derives install scope counts from measurement fields', () => {
    const counts = resolveKitchenInstallScopeCounts({
      cabinetLf: '18',
      countertopSqft: '55',
      backsplashSqft: '28',
      kitchenFloorSqft: '120',
      kitchenInstallApplianceCount: 1,
    });
    expect(counts.kitchenInstallCabinetCount).toBe(1);
    expect(counts.kitchenInstallCounterCount).toBe(1);
    expect(counts.kitchenInstallBacksplashCount).toBe(1);
    expect(counts.kitchenInstallFlooringCount).toBe(1);
    expect(counts.kitchenInstallApplianceCount).toBe(1);
  });

  it('suggests backsplash and floor demo from existing plus sqft takeoffs', () => {
    const demo = suggestKitchenDemoFromExistingInstall({
      existing: {
        kitchenExistingBacksplashCount: 1,
        kitchenExistingFloorCount: 1,
        kitchenExistingCabinetCount: null,
        kitchenExistingCounterCount: null,
        kitchenExistingApplianceCount: null,
      },
      install: resolveKitchenInstallScopeCounts({
        backsplashSqft: '28',
        kitchenFloorSqft: '120',
      }),
      demo: {
        kitchenDemoCabinetCount: null,
        kitchenDemoCounterCount: null,
        kitchenDemoBacksplashCount: null,
        kitchenDemoIslandCount: null,
        kitchenDemoApplianceCount: null,
        kitchenDemoFloorCount: null,
        kitchenDemoWallCount: null,
      },
      measurements: {
        backsplashSqft: '28',
        kitchenFloorSqft: '120',
      },
    });
    expect(demo.kitchenDemoBacksplashCount).toBe(1);
    expect(demo.kitchenDemoFloorCount).toBe(1);
  });

  it('shows embedded kitchen scope cards when measurement takeoffs are active', () => {
    const measurements = {
      backsplashSqft: '28',
      countertopSqft: '55',
      cabinetLf: '18',
      kitchenDemoCabinetCount: 1,
      kitchenDemoCounterCount: 1,
    };
    expect(kitchenQmScopeCardVisible('backsplash', measurements)).toBe(true);
    expect(kitchenQmScopeCardVisible('backsplash_demo', measurements)).toBe(true);
    expect(kitchenQmScopeCardVisible('countertops', measurements)).toBe(true);
    expect(kitchenQmScopeCardVisible('cabinet_demo', measurements)).toBe(true);
    expect(kitchenQmScopeCardVisible('countertop_demo', measurements)).toBe(true);
    expect(shouldHideKitchenScopeCardInQmEmbed('cabinet_demo', measurements)).toBe(false);
    expect(shouldHideKitchenScopeCardInQmEmbed('backsplash_demo', measurements)).toBe(false);
    expect(KITCHEN_QM_EMBEDDED_IDS.has('backsplash_demo')).toBe(true);
  });

  it('syncs demo scope cards from measurement takeoffs without demo steppers', () => {
    const items = [
      item('cabinet_demo', 'unsure'),
      item('countertop_demo', 'unsure'),
      item('backsplash_demo', 'unsure'),
    ];
    const next = syncKitchenQmScopeItems(items, {
      cabinetLf: '18',
      countertopSqft: '55',
      backsplashSqft: '28',
    });
    expect(next.find((r) => r.id === 'cabinet_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'countertop_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'backsplash_demo')?.state).toBe('included');
  });

  it('suggests island demo when island install is in scope', () => {
    const demo = suggestKitchenDemoFromExistingInstall({
      existing: {
        kitchenExistingCabinetCount: null,
        kitchenExistingCounterCount: null,
        kitchenExistingApplianceCount: null,
        kitchenExistingBacksplashCount: null,
        kitchenExistingFloorCount: null,
      },
      install: {
        kitchenInstallCabinetCount: null,
        kitchenInstallCounterCount: null,
        kitchenInstallApplianceCount: null,
        kitchenInstallBacksplashCount: null,
        kitchenInstallFlooringCount: null,
        kitchenInstallIslandCount: 1,
      },
      demo: {
        kitchenDemoCabinetCount: null,
        kitchenDemoCounterCount: null,
        kitchenDemoBacksplashCount: null,
        kitchenDemoIslandCount: null,
        kitchenDemoApplianceCount: null,
        kitchenDemoFloorCount: null,
        kitchenDemoWallCount: null,
      },
      measurements: {},
    });
    expect(demo.kitchenDemoIslandCount).toBe(1);
  });

  it('hides embedded kitchen scope cards until measurements or demo steppers are set', () => {
    const measurements = {};
    expect(kitchenQmScopeCardVisible('cabinet_demo', measurements)).toBe(false);
    expect(shouldHideKitchenScopeCardInQmEmbed('cabinet_demo', measurements)).toBe(true);
    expect(shouldHideKitchenScopeCardInQmEmbed('backsplash', measurements)).toBe(true);
    expect(KITCHEN_QM_EMBEDDED_IDS.has('cabinets')).toBe(false);
  });

  it('migrates legacy combined kitchen demo into separate cards', () => {
    const migrated = migrateKitchenDemoSplit(
      [item('demo', 'included'), item('cabinets')],
      'kitchen',
      { kitchenDemoCabinetCount: 1, kitchenDemoCounterCount: null }
    );
    expect(migrated.find((r) => r.id === 'demo')).toBeUndefined();
    expect(migrated.find((r) => r.id === 'cabinet_demo')?.state).toBe('included');
    expect(migrated.find((r) => r.id === 'countertop_demo')?.state).toBe('excluded');
  });

  it('prices cabinet and countertop demo from kitchen takeoffs', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const input = {
      ...initialScopeMeasurementInputExtended(),
      cabinetLf: '18',
      countertopSqft: '55',
      itemQuantities: {},
    };
    const cabinetResolved = resolveChecklistItemQuantity('cabinet_demo', input, {
      templateKey: 'kitchen',
    });
    const counterResolved = resolveChecklistItemQuantity('countertop_demo', input, {
      templateKey: 'kitchen',
    });
    const cabinetPricing = resolveScopeItemSuggestedPricing(
      'cabinet_demo',
      input,
      'kitchen',
      cabinetResolved
    );
    const counterPricing = resolveScopeItemSuggestedPricing(
      'countertop_demo',
      input,
      'kitchen',
      counterResolved
    );
    expect(cabinetPricing.fill).toMatchObject({
      total: 450,
      material: 36,
      labor: 414,
      basis: { quantity: 18, unit: 'lf' },
    });
    expect(counterPricing.fill).toMatchObject({
      total: 302.5,
      basis: { quantity: 55, unit: 'sqft' },
    });
  });

  test('prices appliance removal and hookup from kitchen QM steppers', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const input = {
      ...initialScopeMeasurementInputExtended(),
      kitchenDemoApplianceCount: 1,
      kitchenInstallApplianceCount: 1,
      itemQuantities: {},
    };
    const removalResolved = resolveChecklistItemQuantity('appliance_removal', input, {
      templateKey: 'kitchen',
    });
    const installResolved = resolveChecklistItemQuantity('appliances', input, {
      templateKey: 'kitchen',
    });
    expect(removalResolved).toMatchObject({
      quantity: 1,
      unit: 'each',
      pricingReady: true,
    });
    expect(installResolved).toMatchObject({
      quantity: 1,
      unit: 'each',
      pricingReady: true,
    });
    const removalPricing = resolveScopeItemSuggestedPricing(
      'appliance_removal',
      input,
      'kitchen',
      removalResolved
    );
    const installPricing = resolveScopeItemSuggestedPricing(
      'appliances',
      input,
      'kitchen',
      installResolved
    );
    expect(removalPricing.fill).toMatchObject({
      total: 175,
      material: 25,
      labor: 150,
      basis: { quantity: 1, unit: 'each' },
    });
    expect(installPricing.fill).toMatchObject({
      total: 225,
      material: 0,
      labor: 225,
      basis: { quantity: 1, unit: 'each' },
    });
  });

  test('prices island demo and install from kitchen QM steppers', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const input = {
      ...initialScopeMeasurementInputExtended(),
      kitchenDemoIslandCount: 1,
      kitchenInstallIslandCount: 1,
      cabinetLf: '18',
      itemQuantities: {},
    };
    const demoResolved = resolveChecklistItemQuantity('island_demo', input, {
      templateKey: 'kitchen',
    });
    const installResolved = resolveChecklistItemQuantity('island', input, {
      templateKey: 'kitchen',
    });
    expect(demoResolved).toMatchObject({
      quantity: 1,
      unit: 'each',
      pricingReady: true,
    });
    expect(installResolved).toMatchObject({
      quantity: 1,
      unit: 'each',
      pricingReady: true,
    });
    const demoPricing = resolveScopeItemSuggestedPricing(
      'island_demo',
      input,
      'kitchen',
      demoResolved
    );
    const installPricing = resolveScopeItemSuggestedPricing(
      'island',
      input,
      'kitchen',
      installResolved
    );
    expect(demoPricing.fill).toMatchObject({
      total: 325,
      material: 50,
      labor: 275,
      basis: { quantity: 1, unit: 'each' },
    });
    expect(installPricing.fill).toMatchObject({
      total: 950,
      material: 150,
      labor: 800,
      basis: { quantity: 1, unit: 'each' },
    });
  });

  test('keeps appliance and island quantities above one priceable', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const input = {
      ...initialScopeMeasurementInputExtended(),
      kitchenDemoApplianceCount: 4,
      kitchenInstallApplianceCount: 4,
      kitchenDemoIslandCount: 2,
      kitchenInstallIslandCount: 2,
      itemQuantities: {},
    };

    const cases = [
      ['appliance_removal', 700, 100, 600],
      ['appliances', 900, 0, 900],
      ['island_demo', 650, 100, 550],
      ['island', 1900, 300, 1600],
    ] as const;

    for (const [id, total, material, labor] of cases) {
      const resolved = resolveChecklistItemQuantity(id, input, {
        templateKey: 'kitchen',
      });
      const pricing = resolveScopeItemSuggestedPricing(id, input, 'kitchen', resolved);
      expect(resolved).toMatchObject({
        quantity: id === 'appliance_removal' || id === 'appliances' ? 4 : 2,
        unit: 'each',
        pricingReady: true,
      });
      expect(pricing.fill).toMatchObject({
        total,
        material,
        labor,
        basis: { quantity: resolved.quantity, unit: 'each' },
      });
    }
  });

  it('rolls island counter SF into countertops pricing', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const input = {
      ...initialScopeMeasurementInputExtended(),
      kitchenInstallIslandCount: 1,
      countertopSqft: '40',
      kitchenIslandCounterSqft: '15',
      itemQuantities: {},
    };
    const resolved = resolveChecklistItemQuantity('countertops', input, {
      templateKey: 'kitchen',
    });
    expect(resolved).toMatchObject({
      quantity: 55,
      unit: 'sqft',
      pricingReady: true,
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'countertops',
      input,
      'kitchen',
      resolved
    );
    expect(pricing.fill).toMatchObject({
      total: 3300,
      material: 1925,
      labor: 1375,
      basis: { quantity: 55, unit: 'sqft' },
    });
  });

  it('syncs island demo and install scope cards from QM steppers', () => {
    const items = [
      item('island_demo', 'unsure'),
      item('island', 'unsure'),
      item('cabinet_demo', 'unsure'),
    ];
    const next = syncKitchenQmScopeItems(items, {
      kitchenDemoIslandCount: 1,
      kitchenInstallIslandCount: 1,
      cabinetLf: '18',
      kitchenDemoCabinetCount: 1,
    });
    expect(next.find((r) => r.id === 'island_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'island')?.state).toBe('included');
    expect(next.find((r) => r.id === 'cabinet_demo')?.state).toBe('included');
  });

  it('keeps floor_demo applied pricing visible after card sqft edit', () => {
    const {
      initialScopeMeasurementInputExtended,
      buildNormalizedScopeMeasurementsFromInput,
      resolveChecklistItemQuantity,
    } = require('@/utils/scopeItemQuantities');
    const { liveScopeMoneyFromQuantities } = require('@/utils/acceptedPricingSummaryUi');
    const input = {
      ...initialScopeMeasurementInputExtended(),
      kitchenFloorSqft: '55',
      itemQuantities: {
        floor_demo: {
          quantity: '60',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        floor_demo__material: {
          quantity: '18',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        floor_demo__labor: {
          quantity: '162',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        floor_demo__allowance: {
          quantity: '180',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    };
    const norm = buildNormalizedScopeMeasurementsFromInput(input, {
      templateKey: 'kitchen',
    });
    const resolved = resolveChecklistItemQuantity('floor_demo', norm, {
      templateKey: 'kitchen',
    });
    expect(resolved).toMatchObject({
      quantity: 60,
      unit: 'sqft',
      dualMaterial: { quantity: 18 },
      dualLabor: { quantity: 162 },
    });
    expect(liveScopeMoneyFromQuantities('floor_demo', input.itemQuantities)).toBe(180);
  });

  it('injects island_demo into migrated kitchen checklists', () => {
    const migrated = migrateKitchenDemoSplit(
      [item('demo', 'included'), item('cabinets')],
      'kitchen'
    );
    expect(migrated.some((row) => row.id === 'island_demo')).toBe(true);
  });
});
