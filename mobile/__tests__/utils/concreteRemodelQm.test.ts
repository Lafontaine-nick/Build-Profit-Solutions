import {
  CONCRETE_QM_EMBEDDED_IDS,
  CONCRETE_QM_SYNC_SCOPE_IDS,
  isConcreteQmScopeItemActive,
  readConcreteScope,
  syncConcreteQmScopeItems,
} from '@/utils/qmScopePanels/concreteRemodel';

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
    expect(CONCRETE_QM_SYNC_SCOPE_IDS.has('forms')).toBe(true);
  });

  it('syncs flatwork and foundation selections into included checklist items', () => {
    const next = syncConcreteQmScopeItems(
      [item('pour_flatwork'), item('pour_foundation'), item('forms')],
      {
        concreteScope: ['patios', 'forms', 'pour_foundation'],
        concreteSqft: '400',
        concreteCy: '8',
      }
    );
    expect(next.find((row) => row.id === 'pour_flatwork')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
    expect(next.find((row) => row.id === 'forms')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
    expect(next.find((row) => row.id === 'pour_foundation')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
  });

  it('activates scope cards from QM selection or measurements', () => {
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', { concreteScope: ['driveways'] })
    ).toBe(true);
    expect(
      isConcreteQmScopeItemActive('demo_removal', { concreteScope: ['demo_removal'], concreteDemoSqft: '120' })
    ).toBe(true);
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', { concreteScope: [], concreteSqft: '250' })
    ).toBe(false);
    expect(
      isConcreteQmScopeItemActive('demo_removal', { concreteScope: [], concreteDemoSqft: '120' })
    ).toBe(false);
  });

  it('does not resurrect a deselected item from stale measurements', () => {
    expect(
      isConcreteQmScopeItemActive('pour_flatwork', {
        concreteScope: [],
        concreteSqft: '250',
      })
    ).toBe(false);
    expect(readConcreteScope({ concreteScope: ['patios', 'forms'] })).toEqual(['patios', 'forms']);
  });
});
