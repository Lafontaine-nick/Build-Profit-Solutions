import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import { isScopeCardHiddenInQmEmbed } from '@/utils/scopePackagesForReview';
import {
  inferExistingKitchenFromNotes,
  inferKitchenInstallFromIntent,
  KITCHEN_QM_EMBEDDED_IDS,
  kitchenQmScopeCardVisible,
  migrateKitchenDemoSplit,
  resolveKitchenCountertopQuantity,
  resolveKitchenDemoFromIntent,
  resolveKitchenInstallScopeCounts,
  shouldHideKitchenScopeCardInQmEmbed,
  kitchenSelectedDemoSurfaces,
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

  it('hides basic cabinet hardware when stock cabinet install is included', () => {
    const items = [item('cabinets', 'included'), item('cabinet_hardware')];
    expect(
      shouldHideKitchenScopeCardInQmEmbed('cabinet_hardware', {}, items)
    ).toBe(true);
  });

  it('keeps explicitly selected cabinet hardware visible', () => {
    const items = [item('cabinets', 'included'), item('cabinet_hardware', 'included')];
    expect(
      shouldHideKitchenScopeCardInQmEmbed('cabinet_hardware', {}, items)
    ).toBe(false);
  });

  it('keeps cabinet hardware when the note asks to replace it', () => {
    const items = [item('cabinets', 'included'), item('cabinet_hardware')];
    expect(
      shouldHideKitchenScopeCardInQmEmbed(
        'cabinet_hardware',
        {},
        items,
        'Keep existing cabinets. Replace cabinet hardware.'
      )
    ).toBe(false);
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

  it('puts selected kitchen demos on the Demo card and installs on the other cards', () => {
    const notes =
      'New cabinets 22 LF, quartz countertops 55 sqft, backsplash 30 sqft, new LVP 300 sqft.';
    const measurements = {
      cabinetLf: 22,
      countertopSqft: 55,
      backsplashSqft: 30,
      kitchenFloorSqft: 300,
      scopeFoundPieces: ['cabinets', 'countertops', 'backsplash'],
    };
    const items = [
      item('cabinet_demo', 'included'),
      item('countertop_demo', 'included'),
      item('backsplash_demo', 'included'),
      item('cabinets', 'included'),
      item('countertops', 'included'),
      item('backsplash', 'included'),
      item('flooring', 'included'),
    ];
    const groups = groupScopeChecklistItems(items, 'kitchen', {
      notes,
      projectType: 'kitchen',
    });
    const shown = (title: string) =>
      groups
        .find(group => group.title === title)
        ?.items.map(row => row.id)
        .filter(
          id =>
            !isScopeCardHiddenInQmEmbed(id, [], measurements, {
              templateKey: 'kitchen',
            })
        );
    expect(shown('Demo')).toEqual([
      'cabinet_demo',
      'countertop_demo',
      'backsplash_demo',
    ]);
    expect(shown('Cabinets & Counters')).toEqual(['cabinets', 'countertops']);
    expect(shown('Tile & Flooring')).toEqual(['backsplash', 'flooring']);
    expect(
      isScopeCardHiddenInQmEmbed('countertop_demo', [], {}, {
        templateKey: 'bathroom',
      })
    ).toBe(true);
  });

  it('shows selected kitchen demos on the condensed measurement card', () => {
    const notes =
      'New cabinets 22 LF, quartz countertops 55 sqft, backsplash 30 sqft, new LVP 300 sqft.';
    const selected = kitchenSelectedDemoSurfaces({
      notes,
      measurements: {
        scopeFoundPieces: ['cabinets', 'countertops', 'backsplash'],
      },
    });
    expect(selected).toEqual({
      cabinet: true,
      counter: true,
      backsplash: true,
      floor: false,
      island: false,
    });
    expect(
      kitchenSelectedDemoSurfaces({
        notes,
        measurements: { scopeFoundPieces: ['kitchen_floor'] },
      }).floor
    ).toBe(true);
    expect(
      kitchenSelectedDemoSurfaces({
        notes,
        measurements: {},
      })
    ).toEqual({
      cabinet: false,
      counter: false,
      backsplash: false,
      floor: false,
      island: false,
    });
  });

  it('keeps chip-selected kitchen demos on an install-only note', () => {
    const notes =
      'New cabinets 22 LF, quartz countertops 55 sqft, backsplash 30 sqft, new LVP 300 sqft.';
    const items = [
      item('cabinet_demo', 'included'),
      item('countertop_demo', 'included'),
      item('backsplash_demo', 'included'),
      item('floor_demo', 'included'),
    ];
    const next = syncKitchenQmScopeItems(
      items,
      {
        cabinetLf: 22,
        countertopSqft: 55,
        backsplashSqft: 30,
        kitchenFloorSqft: 300,
        scopeFoundPieces: ['cabinets', 'countertops', 'backsplash', 'kitchen_floor'],
        kitchenDemoCabinetCount: 1,
        kitchenDemoCounterCount: 1,
        kitchenDemoBacksplashCount: 1,
        kitchenDemoFloorCount: 1,
      },
      notes
    );
    expect(next.map(row => row.state)).toEqual([
      'included',
      'included',
      'included',
      'included',
    ]);
  });

  it('does not turn an install-only cabinet and LVP note into cabinet removal', () => {
    const notes = 'Install 12 LF of base cabinets and 40 sqft of LVP.';
    const items = [
      item('cabinets', 'included'),
      item('cabinet_demo', 'unsure'),
      item('countertop_demo', 'unsure'),
      item('floor_demo', 'unsure'),
      item('flooring', 'included'),
    ];
    const next = syncKitchenQmScopeItems(
      items,
      { cabinetLf: '12', kitchenFloorSqft: '40' },
      notes
    );
    expect(next.find(row => row.id === 'cabinets')?.state).toBe('included');
    expect(next.find(row => row.id === 'flooring')?.state).toBe('included');
    expect(next.find(row => row.id === 'cabinet_demo')?.state).toBe('excluded');
    expect(next.find(row => row.id === 'countertop_demo')?.state).toBe('excluded');
    expect(next.find(row => row.id === 'floor_demo')?.state).toBe('excluded');
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

  it('preserves note-backed kitchen cards when no QM stepper quantity exists', () => {
    const items = [
      { ...item('flooring', 'included'), noteBacked: true },
      { ...item('floor_demo', 'included'), noteBacked: true },
    ];
    const next = syncKitchenQmScopeItems(items, {});
    expect(next.find((r) => r.id === 'flooring')?.state).toBe('included');
    expect(next.find((r) => r.id === 'floor_demo')?.state).toBe('included');
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

  it('selects island demo when the Island chip is on', () => {
    const notes =
      'New cabinets 22 LF, quartz countertops 55 sqft, backsplash 30 sqft, new LVP 300 sqft.';
    const demo = suggestKitchenDemoFromExistingInstall({
      existing: {
        kitchenExistingCabinetCount: null,
        kitchenExistingCounterCount: null,
        kitchenExistingApplianceCount: null,
        kitchenExistingBacksplashCount: null,
        kitchenExistingFloorCount: null,
      },
      install: {
        kitchenInstallCabinetCount: 1,
        kitchenInstallCounterCount: 1,
        kitchenInstallApplianceCount: null,
        kitchenInstallBacksplashCount: 1,
        kitchenInstallFlooringCount: 1,
        kitchenInstallIslandCount: null,
      },
      demo: {
        kitchenDemoCabinetCount: 1,
        kitchenDemoCounterCount: 1,
        kitchenDemoBacksplashCount: 1,
        kitchenDemoIslandCount: null,
        kitchenDemoApplianceCount: null,
        kitchenDemoFloorCount: null,
        kitchenDemoWallCount: null,
      },
      measurements: { scopeFoundPieces: ['island'] },
      notes,
    });
    expect(demo.kitchenDemoIslandCount).toBe(1);
  });

  it('removes the cabinets and counters without installing them or demoing the island', () => {
    const notes =
      'Kitchen remodel. Remove the cabinets and countertops, New island';
    const install = inferKitchenInstallFromIntent({ notes });
    expect(install.kitchenInstallCabinetCount).toBeNull();
    expect(install.kitchenInstallCounterCount).toBeNull();
    expect(install.kitchenInstallIslandCount).toBe(1);
    const demo = resolveKitchenDemoFromIntent({
      notes,
      existing: {
        kitchenExistingCabinetCount: null,
        kitchenExistingCounterCount: null,
        kitchenExistingApplianceCount: null,
        kitchenExistingBacksplashCount: null,
        kitchenExistingFloorCount: null,
      },
      install,
    });
    expect(demo.kitchenDemoCabinetCount).toBe(1);
    expect(demo.kitchenDemoCounterCount).toBe(1);
    expect(demo.kitchenDemoIslandCount).toBeNull();
    expect(demo.kitchenDemoBacksplashCount).toBeNull();
    expect(demo.kitchenDemoFloorCount).toBeNull();
    const withNewCabinets = inferKitchenInstallFromIntent({
      notes:
        'Kitchen remodel. Remove the cabinets and countertops, New cabinets, New countertops, New island',
    });
    expect(withNewCabinets.kitchenInstallCabinetCount).toBe(1);
    expect(withNewCabinets.kitchenInstallCounterCount).toBe(1);
    expect(withNewCabinets.kitchenInstallIslandCount).toBe(1);
  });

  it('does not demo a new island the note is installing', () => {
    const notes =
      'Demo existing cabinets and countertops. Install 18 LF perimeter cabinets and a new island with 22 sqft of quartz.';
    const demo = suggestKitchenDemoFromExistingInstall({
      existing: {
        kitchenExistingCabinetCount: null,
        kitchenExistingCounterCount: null,
        kitchenExistingApplianceCount: null,
        kitchenExistingBacksplashCount: null,
        kitchenExistingFloorCount: null,
      },
      install: {
        kitchenInstallCabinetCount: 1,
        kitchenInstallCounterCount: 1,
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
      measurements: { countertopSqft: '36', kitchenIslandCounterSqft: '22' },
      notes,
    });
    expect(demo.kitchenDemoIslandCount).toBeNull();
    const resolved = resolveKitchenCountertopQuantity(
      'countertop_demo',
      { countertopSqft: '36', kitchenIslandCounterSqft: '22' },
      { templateKey: 'kitchen', notes },
      {}
    );
    expect(resolved?.quantity).toBe(36);
  });

  it('hides embedded kitchen scope cards until measurements or demo steppers are set', () => {
    const measurements = {};
    expect(kitchenQmScopeCardVisible('cabinet_demo', measurements)).toBe(false);
    expect(shouldHideKitchenScopeCardInQmEmbed('cabinet_demo', measurements)).toBe(true);
    expect(shouldHideKitchenScopeCardInQmEmbed('backsplash', measurements)).toBe(true);
    expect(KITCHEN_QM_EMBEDDED_IDS.has('cabinets')).toBe(false);
  });

  it('keeps note-backed install and demo cards visible without quantities', () => {
    const items = [
      item('flooring', 'included'),
      item('floor_demo', 'included'),
    ];
    expect(kitchenQmScopeCardVisible('flooring', {}, items)).toBe(true);
    expect(kitchenQmScopeCardVisible('floor_demo', {}, items)).toBe(true);
    expect(shouldHideKitchenScopeCardInQmEmbed('flooring', {}, items)).toBe(false);
    expect(shouldHideKitchenScopeCardInQmEmbed('floor_demo', {}, items)).toBe(false);
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

  it('prices cabinet hardware from cabinet LF when the note replaces hardware', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const notes =
      'Keep existing cabinets. Paint cabinets, replace cabinet hardware.';
    const input = {
      ...initialScopeMeasurementInputExtended(),
      cabinetLf: '25',
      itemQuantities: {},
    };
    const resolved = resolveChecklistItemQuantity('cabinet_hardware', input, {
      templateKey: 'kitchen',
      notes,
    });
    expect(resolved.quantity).toBe(25);
    expect(resolved.unit).toBe('each');
    const pricing = resolveScopeItemSuggestedPricing(
      'cabinet_hardware',
      input,
      'kitchen',
      resolved,
      null,
      null,
      notes
    );
    expect(pricing.fill).toMatchObject({
      total: 675,
      material: 300,
      labor: 375,
      basis: { quantity: 25, unit: 'each' },
    });
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

  it('prices unstated kitchen flooring as the national rate, matching the group total', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const { wholeProjectGroupDisplayTotal } = require('@/utils/benchmarkReasonablenessContext');
    const { suggestedCardSourceChip, buildSuggestedPricingCardDisplay } = require('@/utils/suggestedPricingCardUi');
    const notes =
      'Kitchen remodel. Demo existing cabinets and countertops. Install 18 LF perimeter cabinets and a new island with 22 sqft of quartz. Perimeter counters 36 sqft. Tile backsplash 30 sqft. Kitchen floor 140 sqft LVP. Haul-off lump sum $650.';
    const input = {
      ...initialScopeMeasurementInputExtended(),
      cabinetLf: '18',
      countertopSqft: '36',
      kitchenIslandCounterSqft: '22',
      backsplashSqft: '30',
      kitchenFloorSqft: '140',
      flooringSqft: '140',
    };
    const flooringResolved = resolveChecklistItemQuantity('flooring', input, {
      templateKey: 'kitchen',
      notes,
    });
    const flooring = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'kitchen',
      flooringResolved,
      null,
      null,
      notes
    );
    const backsplashResolved = resolveChecklistItemQuantity('backsplash', input, {
      templateKey: 'kitchen',
      notes,
    });
    const backsplash = resolveScopeItemSuggestedPricing(
      'backsplash',
      input,
      'kitchen',
      backsplashResolved,
      null,
      null,
      notes
    );
    expect(flooring.fill).toMatchObject({
      total: 980,
      material: 490,
      labor: 490,
      mode: 'suggested_price',
    });
    expect(flooring.fill?.displayUnitRateLabel).toBe('140 sqft × $7/sqft');
    expect(flooring.fill?.rateSourceLabel).toMatch(/national/i);
    expect(flooring.fill?.mode).not.toBe('note_total_split');
    const flooringDisplay = buildSuggestedPricingCardDisplay({
      itemId: 'flooring',
      block: flooring.fill,
      forceStandardCard: true,
    });
    expect(suggestedCardSourceChip(flooring.fill, flooringDisplay)?.label).toBe(
      'National average'
    );
    expect(backsplash.fill).toMatchObject({
      total: 750,
      mode: 'suggested_price',
    });
    const group = wholeProjectGroupDisplayTotal({
      items: [
        { id: 'backsplash', label: 'Backsplash', state: 'included', inputType: 'yes_no' },
        { id: 'flooring', label: 'Kitchen flooring', state: 'included', inputType: 'yes_no' },
      ],
      measurements: input,
      templateKey: 'kitchen',
      notes,
    });
    expect(group).toBe(
      Math.round(((backsplash.fill?.total || 0) + (flooring.fill?.total || 0)) * 100) / 100
    );
  });

  it('prices a stated haul-off lump instead of the national cleanup allowance', () => {
    const {
      initialScopeMeasurementInputExtended,
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities');
    const notes =
      'Kitchen remodel. Demo existing cabinets and countertops. Haul-off lump sum $650.';
    const input = {
      ...initialScopeMeasurementInputExtended(),
      itemQuantities: {
        haul_off: {
          quantity: 650,
          unit: 'lump_sum',
          quantitySource: 'notes',
        },
      },
    };
    const resolved = resolveChecklistItemQuantity('haul_off', input, {
      templateKey: 'kitchen',
      notes,
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'haul_off',
      input,
      'kitchen',
      resolved,
      null,
      null,
      notes
    );
    expect(resolved).toMatchObject({
      quantity: 650,
      unit: 'lump_sum',
      quantitySource: 'notes',
    });
    expect(pricing.fill).toMatchObject({
      total: 650,
      material: 0,
      labor: 650,
      lumpSumOnly: true,
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
