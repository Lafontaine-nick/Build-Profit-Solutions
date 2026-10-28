import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { formatScopeQuantity } from '@/utils/estimateDraftReviewUi';

describe('formatScopeQuantity', () => {
  test('separate wall and ceiling paint keep their own areas', () => {
    const draft = {
      scopeChecklist: { templateKey: 'painting' },
      scopeMeasurements: {
        paintPricingMethod: 'separate',
        wallPaintSqft: 400,
        ceilingPaintSqft: 1200,
      },
    } as EstimateAiDraft;
    const storedWall = [{ quantity: 400, unit: 'sqft' }];
    expect(
      formatScopeQuantity(
        {
          name: 'Paint prep & masking',
          checklistItemId: 'prep',
          scopeQuantities: storedWall,
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('1,600 sqft');
    expect(
      formatScopeQuantity(
        {
          name: 'Interior paint',
          checklistItemId: 'interior_paint',
          scopeQuantities: storedWall,
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('400 sqft');
    expect(
      formatScopeQuantity(
        {
          name: 'Ceiling Paint',
          checklistItemId: 'interior_paint',
          scopeQuantities: storedWall,
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('1,200 sqft');
  });

  const draft = {
    scopeChecklist: { templateKey: 'kitchen' },
  } as EstimateAiDraft;

  test('trade dollar lumps show as lump sum, not allowance', () => {
    const pkg = {
      name: 'Appliance reinstall & hookup',
      scope: 'Reconnect and install appliances after cabinets.',
      scopeQuantities: [{ quantity: 300, unit: 'allowance' }],
    } as EstimateDraftScopePackage;

    expect(formatScopeQuantity(pkg, draft)).toBe('300 lump sum');
  });

  test('soft-cost packages keep the allowance label', () => {
    const pkg = {
      name: 'Permits / fees',
      scope: 'permits',
      scopeQuantities: [{ quantity: 500, unit: 'allowance' }],
    } as EstimateDraftScopePackage;

    expect(formatScopeQuantity(pkg, draft)).toBe('500 allowance');
  });

  test('a leftover sqft does not replace the window count Confirm Scope priced', () => {
    const pkg = {
      name: 'Window install',
      checklistItemId: 'window_install',
      scopeQuantities: [{ quantity: 1800, unit: 'sqft' }],
    } as EstimateDraftScopePackage;
    const priced = {
      scopeMeasurements: { windowCount: 6 },
    } as EstimateAiDraft;

    expect(formatScopeQuantity(pkg, priced)).toBe('6 each');
  });

  test('wall-area framing keeps the note sqft when the price basis is linear feet', () => {
    const notes = 'Frame 400 sqft of walls and install 180 sqft of LVP.';
    const pkg = {
      name: 'Wall framing',
      checklistItemId: 'wall_framing',
      scopeQuantities: [{ quantity: 50, unit: 'lf' }],
    } as EstimateDraftScopePackage;
    const mixed = {
      originalNotes: notes,
      scopeMeasurements: { wallFramingSqft: 400 },
    } as EstimateAiDraft;

    expect(formatScopeQuantity(pkg, mixed)).toBe('400 sqft');
  });

  test('sliding doors show the door count, not the living area', () => {
    const pkg = {
      name: 'Sliding doors',
      checklistItemId: 'sliding_doors',
      scopeQuantities: [{ quantity: 2571, unit: 'sqft' }],
    } as EstimateDraftScopePackage;
    const plan = {
      scopeChecklist: { templateKey: 'ground_up' },
      scopeMeasurements: { slidingDoorCount: 1, floorAreaSqft: 2571 },
    } as EstimateAiDraft;

    expect(formatScopeQuantity(pkg, plan)).toBe('1 each');
  });

  test('a ground-up paint allowance is not labeled 1 sqft', () => {
    const pkg = {
      name: 'Interior paint',
      checklistItemId: 'interior_paint',
      scopeQuantities: [{ quantity: 1, unit: 'sqft' }],
    } as EstimateDraftScopePackage;
    const plan = {
      scopeChecklist: { templateKey: 'ground_up' },
      scopeMeasurements: { floorAreaSqft: 2571 },
    } as EstimateAiDraft;

    expect(formatScopeQuantity(pkg, plan)).toBe('Allowance');
  });

  test('ground-up lump trades are not labeled with a placeholder quantity', () => {
    const plan = {
      scopeChecklist: { templateKey: 'ground_up' },
      scopeMeasurements: { floorAreaSqft: 2571, interiorDoorCount: 18 },
    } as EstimateAiDraft;
    const row = (id: string, quantity: number, unit: string) =>
      ({
        name: id,
        checklistItemId: id,
        scopeQuantities: [{ quantity, unit }],
      }) as EstimateDraftScopePackage;

    expect(formatScopeQuantity(row('stucco', 1, 'sqft'), plan)).toBe('Allowance');
    expect(formatScopeQuantity(row('drywall', 1, 'sqft'), plan)).toBe('Allowance');
    expect(formatScopeQuantity(row('plumbing_rough', 1, 'each'), plan)).toBe('Allowance');
    expect(formatScopeQuantity(row('hvac', 1, 'each'), plan)).toBe('Allowance');
    expect(formatScopeQuantity(row('pour_flatwork', 2571, 'sqft'), plan)).toBe(
      'Allowance'
    );
    expect(formatScopeQuantity(row('interior_trim', 18, 'each'), plan)).toBe(
      'Allowance'
    );
    expect(
      formatScopeQuantity(
        row('drywall', 1, 'sqft'),
        {
          ...plan,
          scopeMeasurements: { drywallSqft: 6860 },
        } as EstimateAiDraft
      )
    ).toBe('6,860 sqft');
  });

  test('a flooring style demo shows its own removal area', () => {
    const draft = {
      scopeMeasurements: {
        itemQuantities: {
          floor_demo: { quantity: 3200, unit: 'sqft' },
          floor_demo__carpet: { quantity: 2000, unit: 'sqft' },
          floor_demo__tile: { quantity: 1200, unit: 'sqft' },
        },
      },
    } as EstimateAiDraft;
    expect(
      formatScopeQuantity(
        {
          name: 'Remove carpet',
          checklistItemId: 'floor_demo_style_carpet',
          scopeQuantities: [{ quantity: 3200, unit: 'sqft' }],
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('2,000 sqft');
  });

  test('a ceiling fan review row keeps the counted fans', () => {
    const draft = {
      scopeChecklist: { templateKey: 'electrical' },
      scopeMeasurements: {
        standardReceptacleCount: 12,
        recessedLightCount: 6,
        ceilingFanCount: 2,
      },
    } as EstimateAiDraft;
    expect(
      formatScopeQuantity(
        {
          name: 'Ceiling fan',
          checklistItemId: 'electrical_ceiling_fan',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('2 each');
    expect(
      formatScopeQuantity(
        {
          name: 'Standard receptacles',
          checklistItemId: 'electrical_standard_receptacle',
          scopeQuantities: [{ quantity: 12, unit: 'each' }],
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('12 each');
    expect(
      formatScopeQuantity(
        {
          name: 'Ceiling fan',
          checklistItemId: 'electrical_ceiling_fan',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
        } as EstimateDraftScopePackage,
        { scopeMeasurements: {} } as EstimateAiDraft
      )
    ).toBe('1 each');
  });

  test('deck removal quantities use the measured length and flights', () => {
    const draft = {
      scopeMeasurements: {
        deckRailingDemoLf: 10,
        deckStairDemoCount: 15,
        deckDemoSqft: 200,
        deckSqft: 200,
      },
    } as EstimateAiDraft;
    expect(
      formatScopeQuantity(
        {
          name: 'Remove railing',
          checklistItemId: 'deck_railing_demo',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('10 LF');
    expect(
      formatScopeQuantity(
        {
          name: 'Remove stairs',
          checklistItemId: 'deck_stairs_demo',
          scopeQuantities: [{ quantity: 15, unit: 'each' }],
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('15 flights');
    expect(
      formatScopeQuantity(
        {
          name: 'Remove decking',
          checklistItemId: 'deck_surface_demo',
          scopeQuantities: [{ quantity: 1, unit: 'sqft' }],
        } as EstimateDraftScopePackage,
        draft
      )
    ).toBe('200 sqft');
  });
});
