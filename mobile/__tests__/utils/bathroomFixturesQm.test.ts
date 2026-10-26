import { inferBathroomVanityCountertopMaterialFromNotes } from '@/utils/bathroomVanityCountertopPricing';
import { checklistItemInScope, resolveChecklistItemQuantity } from '@/utils/scopeItemQuantities';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  inferBathroomFixtureInstallFromIntent,
  fillBlankToiletFaucetCounts,
  inferBathroomToiletFaucetCounts,
  inferExistingBathroomFixturesFromNotes,
  resolveBathroomFixtureDemoFromIntent,
  resolveBathroomInstallCounterCount,
  suggestBathroomFixtureDemoFromExistingInstall,
  syncBathroomFixtureQmScopeItems,
  syncPairedBathroomDemoFromInstall,
  bathroomFixtureScopeCardVisible,
  shouldHideBathroomFixtureScopeCardInQmEmbed,
  expandBathroomFixtureScopeDisplayItems,
  inferBathroomCountertopSqftFromNotes,
} from '@/utils/qmScopePanels/bathroomFixtures';

const item = (id: string, state: ScopeChecklistItem['state'] = 'unsure'): ScopeChecklistItem => ({
  id,
  label: id,
  inputType: 'yes_no',
  state,
});

describe('bathroomFixturesQm', () => {
  test('notes infer existing vanity and counter separately', () => {
    const existing = inferExistingBathroomFixturesFromNotes(
      'Existing vanity and old countertop in primary bath.'
    );
    expect(existing.bathroomExistingVanityCount).toBe(1);
    expect(existing.bathroomExistingCounterCount).toBe(1);
  });

  test('install infers counter only from countertop notes', () => {
    const install = inferBathroomFixtureInstallFromIntent({
      notes: 'Keep vanity, install new quartz countertop.',
      checklistItems: [item('countertops', 'included')],
    });
    expect(install.bathroomInstallVanityCount).toBeNull();
    expect(install.bathroomInstallCounterCount).toBe(1);
  });

  test('infers one vanity from mixed bathroom installation notes', () => {
    const install = inferBathroomFixtureInstallFromIntent({
      notes:
        'Reroute bathroom plumbing and install a toilet, vanity, faucet, shower valve, flooring, drywall repair, cabinets, windows, insulation, and paint.',
      checklistItems: [],
    });
    expect(install.bathroomInstallVanityCount).toBe(1);
  });

  test('demo counter not inferred from install alone', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
      install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
    });
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('demo counter when existing and installing together', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('a named vanity or countertop removal is its own demo', () => {
    expect(
      resolveBathroomFixtureDemoFromIntent({
        notes: 'Remove the vanity',
        existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
        install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: null },
      })
    ).toEqual({
      bathroomDemoVanityCount: 1,
      bathroomDemoCounterCount: null,
    });
    expect(
      resolveBathroomFixtureDemoFromIntent({
        notes: 'Remove the countertop',
        existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
        install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: null },
      })
    ).toEqual({
      bathroomDemoVanityCount: null,
      bathroomDemoCounterCount: 1,
    });
    expect(
      inferBathroomFixtureInstallFromIntent({ notes: 'New countertop' })
        .bathroomInstallCounterCount
    ).toBe(1);
    expect(
      inferBathroomFixtureInstallFromIntent({ notes: 'Remove the vanity' })
        .bathroomInstallVanityCount
    ).toBeNull();
    const mixed =
      'Demo the shower tile, Tile the shower walls, Remove the countertop, New countertop, New vanity, Tile the bathroom floor, New shower door, Paint the walls';
    expect(
      resolveBathroomFixtureDemoFromIntent({
        notes: mixed,
        existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
        install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: 1 },
      })
    ).toEqual({
      bathroomDemoVanityCount: null,
      bathroomDemoCounterCount: 1,
    });
  });

  test('demo vanity not inferred from install alone', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: null },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('demo vanity when existing and installing together', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: null },
    });
    expect(demo.bathroomDemoVanityCount).toBe(1);
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('paired demo from install only touches matching row', () => {
    const demo = syncPairedBathroomDemoFromInstall(
      { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
      { bathroomDemoVanityCount: null, bathroomDemoCounterCount: null },
      {}
    );
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('sync includes countertops and countertop_demo independently', () => {
    const items = [
      item('vanity'),
      item('countertops'),
      item('vanity_demo'),
      item('countertop_demo'),
    ];
    const next = syncBathroomFixtureQmScopeItems(items, {
      bathroomInstallCounterCount: 1,
      bathroomDemoCounterCount: 1,
    });
    expect(next.find((r) => r.id === 'countertops')?.state).toBe('included');
    expect(next.find((r) => r.id === 'countertop_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'vanity')?.state).toBe('unsure');
    expect(next.find((r) => r.id === 'vanity_demo')?.state).toBe('unsure');
  });

  test('inferBathroomCountertopSqftFromNotes reads sqft near counter keywords', () => {
    expect(inferBathroomCountertopSqftFromNotes('Install 12 sqft quartz vanity top.')).toBe('12');
    expect(inferBathroomCountertopSqftFromNotes('No measurements here')).toBeNull();
  });

  test('resolveBathroomInstallCounterCount uses sqft or material type', () => {
    expect(
      resolveBathroomInstallCounterCount({
        countertopSqft: '12',
        materialType: null,
      })
    ).toBe(1);
    expect(
      resolveBathroomInstallCounterCount({
        countertopSqft: '',
        materialType: 'prefab_quartz_stone',
      })
    ).toBe(1);
    expect(
      resolveBathroomInstallCounterCount({
        countertopSqft: '',
        materialType: null,
      })
    ).toBeNull();
  });

  test('suggest demo rows when existing and new align', () => {
    const demo = suggestBathroomFixtureDemoFromExistingInstall({
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: null },
      demo: { bathroomDemoVanityCount: null, bathroomDemoCounterCount: null },
      countertopSqft: '10',
      materialType: 'custom_quartz_granite',
    });
    expect(demo.bathroomDemoVanityCount).toBe(1);
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('suggest demo respects manual overrides', () => {
    const demo = suggestBathroomFixtureDemoFromExistingInstall({
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: 1 },
      demo: { bathroomDemoVanityCount: null, bathroomDemoCounterCount: null },
      countertopSqft: '10',
      overrides: { bathroomDemoVanityCount: true },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('clearing existing clears remove even with manual demo override', () => {
    const demo = suggestBathroomFixtureDemoFromExistingInstall({
      existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: 1 },
      demo: { bathroomDemoVanityCount: 1, bathroomDemoCounterCount: 1 },
      countertopSqft: '10',
      materialType: 'custom_quartz_granite',
      overrides: { bathroomDemoVanityCount: true, bathroomDemoCounterCount: true },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('scope cards show when QM steppers are set', () => {
    const m = {
      bathroomInstallVanityCount: 1,
      bathroomInstallCounterCount: 1,
      bathroomDemoVanityCount: 1,
      bathroomDemoCounterCount: 1,
    };
    expect(bathroomFixtureScopeCardVisible('vanity', m)).toBe(true);
    expect(bathroomFixtureScopeCardVisible('countertops', m)).toBe(true);
    expect(bathroomFixtureScopeCardVisible('vanity_demo', m)).toBe(true);
    expect(bathroomFixtureScopeCardVisible('countertop_demo', m)).toBe(true);
    expect(shouldHideBathroomFixtureScopeCardInQmEmbed('vanity_demo', m)).toBe(false);
    expect(shouldHideBathroomFixtureScopeCardInQmEmbed('vanity_demo', {})).toBe(true);
  });

  test('expandBathroomFixtureScopeDisplayItems splits QM lines into separate cards', () => {
    const expanded = expandBathroomFixtureScopeDisplayItems(
      [
        item('vanity'),
        item('paint', 'included'),
      ],
      {
        bathroomInstallVanityCount: 1,
        bathroomInstallCounterCount: 1,
        bathroomDemoVanityCount: 1,
        bathroomDemoCounterCount: 1,
      },
      'bathroom'
    );
    expect(expanded.find((r) => r.id === 'vanity')).toMatchObject({
      label: 'New vanity',
      inputType: 'yes_no',
      state: 'included',
    });
    expect(expanded.find((r) => r.id === 'countertops')).toMatchObject({
      label: 'Vanity countertop',
      state: 'included',
    });
    expect(expanded.find((r) => r.id === 'vanity_demo')).toMatchObject({
      label: 'Remove vanity',
      state: 'included',
    });
    expect(expanded.find((r) => r.id === 'countertop_demo')).toMatchObject({
      label: 'Remove countertop',
      state: 'included',
    });
  });

  test('a removed vanity top stays off the bid when the counter count is set', () => {
    const removed = {
      ...item('countertops', 'excluded'),
      contractorRemoved: true,
      choiceId: 'prefab_quartz_stone',
      inputType: 'choice' as const,
    };
    const measurements = {
      bathroomInstallCounterCount: 1,
      bathroomVanityCountertopMaterialType: 'prefab_quartz_stone',
    };
    const synced = syncBathroomFixtureQmScopeItems([removed], measurements);
    expect(synced.find((r) => r.id === 'countertops')).toMatchObject({
      state: 'excluded',
      contractorRemoved: true,
    });
    const expanded = expandBathroomFixtureScopeDisplayItems(
      [removed, item('vanity', 'included')],
      measurements,
      'bathroom'
    );
    const countertops = expanded.find((r) => r.id === 'countertops');
    expect(countertops).toMatchObject({
      state: 'excluded',
      contractorRemoved: true,
    });
    expect(checklistItemInScope(countertops!)).toBe(false);
    expect(
      bathroomFixtureScopeCardVisible('countertops', measurements, expanded)
    ).toBe(false);
    expect(expanded.find((r) => r.id === 'vanity')?.state).toBe('included');
  });

  test('vanity, quartz top, toilet, and faucet note fills the counts the note names', () => {
    const notes =
      'Remodel the bathroom. Demo and haul off the existing vanity cabinet and the vanity top. Remove the existing toilet. Install a new 60-inch vanity with a quartz top, a new faucet, and a new toilet. Set the vanity and connect it to the existing supply and drain. Do not change the shower, the bathroom floor, or the paint.';
    expect(inferExistingBathroomFixturesFromNotes(notes)).toEqual({
      bathroomExistingVanityCount: 1,
      bathroomExistingCounterCount: 1,
    });
    expect(inferBathroomFixtureInstallFromIntent({ notes })).toEqual({
      bathroomInstallVanityCount: 1,
      bathroomInstallCounterCount: 1,
    });
    expect(
      resolveBathroomFixtureDemoFromIntent({
        notes,
        existing: inferExistingBathroomFixturesFromNotes(notes),
        install: inferBathroomFixtureInstallFromIntent({ notes }),
      })
    ).toEqual({
      bathroomDemoVanityCount: 1,
      bathroomDemoCounterCount: 1,
    });
    expect(inferBathroomToiletFaucetCounts(notes)).toEqual({
      bathroomDemoToiletCount: 1,
      bathroomInstallToiletCount: 1,
      bathroomInstallFaucetCount: 1,
    });
    expect(inferBathroomCountertopSqftFromNotes(notes)).toBeNull();
    expect(inferBathroomVanityCountertopMaterialFromNotes(notes)).toBe(
      'prefab_quartz_stone'
    );
    expect(
      fillBlankToiletFaucetCounts(
        {
          bathroomDemoToiletCount: null,
          bathroomInstallToiletCount: null,
          bathroomInstallFaucetCount: null,
        },
        inferBathroomToiletFaucetCounts('New toilet')
      ).bathroomInstallToiletCount
    ).toBe(1);
    expect(
      fillBlankToiletFaucetCounts(
        {
          bathroomDemoToiletCount: null,
          bathroomInstallToiletCount: 2,
          bathroomInstallFaucetCount: null,
        },
        inferBathroomToiletFaucetCounts('New toilet')
      ).bathroomInstallToiletCount
    ).toBe(2);
    expect(
      inferBathroomToiletFaucetCounts('Do not replace the toilet.')
    ).toEqual({
      bathroomDemoToiletCount: null,
      bathroomInstallToiletCount: null,
      bathroomInstallFaucetCount: null,
    });
    const priced = resolveChecklistItemQuantity(
      'sink_faucet',
      { itemQuantities: {} } as never,
      { notes, templateKey: 'bathroom' }
    );
    expect(priced.quantity).toBe(1);
    expect(priced.pricingReady).toBe(true);
    expect(
      resolveChecklistItemQuantity(
        'sink_faucet',
        { itemQuantities: {} } as never,
        { notes: 'Do not replace the faucet.', templateKey: 'bathroom' }
      ).quantity
    ).toBeNull();
  });
});
