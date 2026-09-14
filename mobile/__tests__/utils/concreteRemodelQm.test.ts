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
});
