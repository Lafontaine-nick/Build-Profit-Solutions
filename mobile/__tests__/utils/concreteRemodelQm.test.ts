import { sumConfirmScopeAppliedPricingBreakdown } from '@/utils/benchmarkReasonablenessContext';
import { filterUnmentionedMixedExteriorConcreteItems } from '@/utils/estimateScopeChecklistUi';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import {
  concreteFoundationPackageDollars,
  shouldOfferConcreteConfirmScopePrice,
} from '@/utils/subcontractorTrade/concretePlanConvergence';
import {
  CONCRETE_SCOPE_OPTIONS,
  CONCRETE_QM_EMBEDDED_IDS,
  CONCRETE_QM_SYNC_SCOPE_IDS,
  concreteQmPanel,
  isConcreteQmScopeItemActive,
  readConcreteScope,
  syncConcreteQmScopeItems,
} from '@/utils/qmScopePanels/concreteRemodel';

const DRIVEWAY_NOTE =
  'Pour new driveway 900 sqft, 4 inch thick with 80 ft of thickened edge. Dig out, gravel base, forms, rebar, finish broom. Might need a pump truck depending on access.';

function item(id: string) {
  return {
    id,
    label: id,
    inputType: 'yes_no' as const,
    state: 'excluded' as const,
    category: 'concrete',
  };
}

describe('concrete QM remodel', () => {
  it('keeps scope cards visible in Confirm Scope', () => {
    expect(CONCRETE_QM_EMBEDDED_IDS.size).toBe(0);
    expect(CONCRETE_QM_SYNC_SCOPE_IDS.has('pour_flatwork')).toBe(true);
    expect(CONCRETE_QM_SYNC_SCOPE_IDS.has('complex_forming')).toBe(true);
  });

  it('provides confirmation measurements for mixed exterior additions', () => {
    expect(CONCRETE_SCOPE_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'landscaping',
          measurementKey: 'landscapeSqft',
          unit: 'sqft',
        }),
        expect.objectContaining({
          id: 'siding_repairs',
          measurementKey: 'sidingRepairSqft',
          unit: 'sqft',
        }),
        expect.objectContaining({
          id: 'retaining_wall',
          measurementKey: 'retainingWallLf',
          unit: 'LF',
        }),
      ])
    );
  });

  it('syncs flatwork and foundation selections into included checklist items', () => {
    const next = syncConcreteQmScopeItems(
      [item('pour_flatwork'), item('pour_foundation'), item('reinforcement')],
      {
        concreteScope: ['patios', 'reinforcement', 'pour_foundation'],
        concreteSqft: '400',
        concreteCy: '8',
      }
    );
    expect(next.find(row => row.id === 'pour_flatwork')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
    expect(next.find(row => row.id === 'reinforcement')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
    expect(next.find(row => row.id === 'pour_foundation')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
  });

  it('activates scope cards from QM selection or measurements', () => {
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', {
        concreteScope: ['driveways'],
      })
    ).toBe(true);
    expect(
      isConcreteQmScopeItemActive('demo_removal', {
        concreteScope: ['demo_removal'],
        concreteDemoSqft: '120',
      })
    ).toBe(true);
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', {
        concreteScope: [],
        concreteAreaByType: { driveways: 900 },
      })
    ).toBe(true);
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', {
        concreteScope: [],
        concreteSqft: '250',
      })
    ).toBe(true);
    expect(
      isConcreteQmScopeItemActive('demo_removal', {
        concreteScope: [],
        concreteDemoSqft: '120',
      })
    ).toBe(true);
  });

  it('syncs driveway note measurements into included scope cards', () => {
    const next = syncConcreteQmScopeItems(
      [
        item('pour_flatwork'),
        item('site_prep'),
        item('excavation'),
        item('reinforcement'),
        item('complex_forming'),
      ],
      {
        concreteScope: [
          'driveways',
          'pour_flatwork',
          'site_prep',
          'excavation',
          'reinforcement',
          'complex_forming',
        ],
        concreteSqft: '900',
        concreteAreaByType: { driveways: 900 },
        concreteSubgradePrepSqft: '900',
        concreteReinforcementSqft: '900',
        excavationCy: '11.11',
        complexFormingLf: '80',
      }
    );
    for (const id of [
      'pour_flatwork',
      'site_prep',
      'excavation',
      'reinforcement',
      'complex_forming',
    ]) {
      expect(next.find(row => row.id === id)).toMatchObject({
        state: 'included',
        noteBacked: true,
      });
    }
  });

  it('does not resurrect a deselected item from stale measurements', () => {
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', {
        concreteScope: [],
        concreteSqft: '250',
      })
    ).toBe(true);
    expect(readConcreteScope({ concreteScope: ['patios', 'forms'] })).toEqual([
      'patios',
      'forms',
    ]);
  });

  it('hydrates gravel and pump quantities from driveway notes into QM measurements', () => {
    const hydrated = concreteQmPanel.hydrateMeasurements({
      templateKey: 'concrete',
      wholeHomeLayout: false,
      notes: DRIVEWAY_NOTE,
      hasSitePhotos: false,
      measurements: {
        concreteScope: ['driveways', 'gravel_base', 'concrete_pumping'],
        concreteSqft: '900',
        concreteAreaByType: { driveways: 900 },
      },
      checklistItems: [],
    });
    expect(Number(hydrated.gravelBaseCy)).toBeCloseTo(11.11, 1);
    expect(hydrated.concretePumpCount).toBe('1');
    expect(hydrated.concretePumpReviewNeeded).toBe(true);
  });

  it('hydrates a note-backed patio demo into a persisted concrete scope', () => {
    const notes =
      'Demolish and remove the existing patio, then excavate and pour a 750 sqft patio with gravel base, rebar, thickened edge, retaining wall, 400 sqft pavers, landscaping, two exterior doors, siding repairs, and exterior trim paint.';
    const hydrated = concreteQmPanel.hydrateMeasurements({
      templateKey: 'concrete',
      wholeHomeLayout: false,
      notes,
      hasSitePhotos: false,
      measurements: {
        concreteScope: [
          'patios',
          'pour_flatwork',
          'site_prep',
          'gravel_base',
          'excavation',
          'reinforcement',
          'complex_forming',
        ],
        concreteSqft: '750',
      },
      checklistItems: [
        {
          ...item('demo_removal'),
          state: 'included',
          noteBacked: true,
        },
        {
          ...item('exterior_trim_paint'),
          state: 'included',
          noteBacked: true,
        },
      ],
    });

    expect(hydrated.concreteScope).toEqual(
      expect.arrayContaining(['demo_removal', 'exterior_trim_paint'])
    );
  });

  it('leaves house and garage slab pour blank for a plan cover', () => {
    const hydrated = concreteQmPanel.hydrateMeasurements({
      templateKey: 'concrete',
      notes:
        'Main Living Area 2,571 SqFt. Garages 1,427 SqFt. Covered Patio 322 SqFt.',
      measurements: {
        floorAreaSqft: 2571,
        garageSqft: 1427,
        concretePatioSqft: 322,
        concreteScope: ['patios', 'pour_flatwork'],
      },
      checklistItems: [],
    });
    expect(hydrated.houseSlabSqft).toBeUndefined();
    expect(hydrated.garageSlabSqft).toBeUndefined();
    expect(hydrated.concreteScope).not.toEqual(
      expect.arrayContaining(['house_slab', 'garage_slab'])
    );
  });

  it('turns a typed house or garage slab into its own priced card', () => {
    const next = syncConcreteQmScopeItems([], {
      concreteScope: ['house_slab', 'garage_slab', 'pour_foundation', 'site_prep'],
      houseSlabSqft: '2571',
      garageSlabSqft: '1427',
      concreteCy: '35',
      concreteSubgradePrepSqft: '2000',
    });
    expect(next.map(row => row.id)).toEqual(
      expect.arrayContaining([
        'house_slab',
        'garage_slab',
        'pour_foundation',
        'site_prep',
      ])
    );
    const measurements = {
      houseSlabSqft: '2571',
      garageSlabSqft: '1427',
      houseSlabThicknessInches: '4',
      garageSlabThicknessInches: '4',
      concreteSqft: '922',
      itemQuantities: {},
    };
    const houseQty = resolveChecklistItemQuantity('house_slab', measurements, {
      templateKey: 'concrete',
    });
    expect(houseQty?.quantity).toBe(2571);
    expect(houseQty?.unit).toBe('sqft');
    const priced = resolveScopeItemSuggestedPricing(
      'house_slab',
      measurements,
      'concrete',
      houseQty!
    );
    expect(priced.fill?.material).toBe(10284);
    expect(priced.fill?.labor).toBe(10284);
    expect(priced.fill?.rateSourceLabel).toMatch(/Foundation package/);
    const thicker = resolveScopeItemSuggestedPricing(
      'house_slab',
      { ...measurements, houseSlabThicknessInches: '6' },
      'concrete',
      houseQty!
    );
    expect(thicker.fill?.total).toBe(priced.fill?.total);
    const footingOnly = resolveScopeItemSuggestedPricing(
      'pour_foundation',
      { concreteCy: '35', itemQuantities: {} },
      'concrete',
      resolveChecklistItemQuantity(
        'pour_foundation',
        { concreteCy: '35', itemQuantities: {} },
        { templateKey: 'concrete' }
      )!
    );
    expect(footingOnly.fill?.total).toBe(35 * 350);
    expect(
      concreteFoundationPackageDollars(
        'pour_foundation',
        { houseSlabSqft: '2571' },
        'concrete'
      )
    ).toBe('included');
    expect(
      concreteFoundationPackageDollars(
        'pour_foundation',
        { concreteCy: '35' },
        'concrete'
      )
    ).toBeNull();
  });

  it('prices the foundation package once and keeps an already applied flatwork card', () => {
    const items = [
      item('house_slab'),
      item('garage_slab'),
      item('pour_foundation'),
      item('reinforcement'),
      item('pour_flatwork'),
    ].map(row => ({ ...row, state: 'included' as const }));
    const breakdown = sumConfirmScopeAppliedPricingBreakdown({
      items,
      templateKey: 'concrete',
      measurements: {
        houseSlabSqft: '2571',
        garageSlabSqft: '1427',
        concreteCy: '35',
        concreteReinforcementSqft: '3998',
        itemQuantities: {
          house_slab__material: { quantity: '10284', unit: 'allowance' },
          house_slab__labor: { quantity: '15426', unit: 'allowance' },
          garage_slab__material: { quantity: '5708', unit: 'allowance' },
          garage_slab__labor: { quantity: '8562', unit: 'allowance' },
          pour_foundation__material: { quantity: '5775', unit: 'allowance' },
          pour_foundation__labor: { quantity: '6475', unit: 'allowance' },
          reinforcement__material: { quantity: '3998', unit: 'allowance' },
          reinforcement__labor: { quantity: '2998.5', unit: 'allowance' },
          pour_flatwork__material: { quantity: '4688', unit: 'allowance' },
          pour_flatwork__labor: { quantity: '7032', unit: 'allowance' },
        },
        pricingAcceptance: {
          house_slab: { selectionStatus: 'accepted', totalAmount: 25710 },
          garage_slab: { selectionStatus: 'accepted', totalAmount: 14270 },
          pour_foundation: { selectionStatus: 'accepted', totalAmount: 12250 },
          reinforcement: { selectionStatus: 'accepted', totalAmount: 6997 },
          pour_flatwork: { selectionStatus: 'accepted', totalAmount: 11720 },
        },
      } as never,
    });
    expect(breakdown.total).toBe(2571 * 8 + 1427 * 8 + 11720);
  });

  it('does not offer a separate price for footing or rebar inside the foundation package', () => {
    const measurements = {
      houseSlabSqft: '2571',
      garageSlabSqft: '1427',
      concreteCy: '35',
      concreteReinforcementSqft: '3998',
      concreteScope: ['pour_foundation', 'reinforcement', 'house_slab'],
    };
    expect(
      shouldOfferConcreteConfirmScopePrice({
        itemId: 'pour_foundation',
        templateKey: 'concrete',
        state: 'included',
        noteBacked: true,
        measurements,
      })
    ).toBe(false);
    expect(
      shouldOfferConcreteConfirmScopePrice({
        itemId: 'reinforcement',
        templateKey: 'concrete',
        state: 'included',
        noteBacked: true,
        measurements,
      })
    ).toBe(false);
    expect(
      shouldOfferConcreteConfirmScopePrice({
        itemId: 'site_prep',
        templateKey: 'concrete',
        state: 'included',
        noteBacked: false,
        measurements: { ...measurements, concreteSubgradePrepSqft: '2000' },
      })
    ).toBe(false);
    expect(
      shouldOfferConcreteConfirmScopePrice({
        itemId: 'pour_flatwork',
        templateKey: 'concrete',
        state: 'included',
        noteBacked: true,
        measurements,
      })
    ).toBe(true);
  });

  it('keeps typed footing and subgrade on a concrete checklist', () => {
    const notes = 'Covered patio and landscape drainage.';
    const rows = [
      {
        ...item('pour_foundation'),
        state: 'included' as const,
        noteBacked: true,
      },
      { ...item('site_prep'), state: 'included' as const, noteBacked: true },
    ];
    expect(
      filterUnmentionedMixedExteriorConcreteItems(rows, notes, 'concrete').map(
        row => row.id
      )
    ).toEqual(['pour_foundation', 'site_prep']);
    expect(
      filterUnmentionedMixedExteriorConcreteItems(rows, notes, 'room_remodel').map(
        row => row.id
      )
    ).not.toContain('pour_foundation');
  });
});
