import {
  filterProposalExportToSnapshot,
  proposalAllowanceLineName,
  proposalMaterialSource,
  proposalScopeLists,
  proposalUsesWholeHomeWetArea,
} from '@/utils/proposalExportScope';

describe('proposalExportScope', () => {
  test('keeps excluded checklist rows and does not reuse another job cart', () => {
    expect(
      proposalScopeLists({
        inclusions: ['Labor and materials'],
        exclusions: ['Keep the windows and doors'],
        scopeChecklist: {
          items: [
            { id: 'paint', label: 'Interior paint', state: 'included' },
            {
              id: 'interior_door_install',
              label: 'Interior door installation',
              state: 'excluded',
            },
          ],
        },
      })
    ).toEqual({
      inclusions: ['Labor and materials'],
      exclusions: ['Keep the windows and doors', 'Interior door installation'],
    });

    expect(
      proposalScopeLists({
        inclusions: ['Labor and materials', 'Interior door installation'],
        scopeChecklist: {
          items: [
            {
              id: 'interior_door_install',
              label: 'Interior door installation',
              state: 'excluded',
            },
          ],
        },
      }).inclusions
    ).toEqual(['Labor and materials']);

    expect(proposalMaterialSource([], [{ name: 'Old job tile' }], true)).toEqual([]);
    expect(proposalMaterialSource([], [{ name: 'Manual lumber' }], false)).toEqual([
      { name: 'Manual lumber' },
    ]);
    expect(
      proposalMaterialSource([{ name: 'Saved paint' }], [{ name: 'Old job tile' }], true)
    ).toEqual([{ name: 'Saved paint' }]);
  });

  test('labels a planning rate as an allowance and leaves a note price alone', () => {
    expect(
      proposalAllowanceLineName('Electrical rough', {
        pricingSourceKind: 'allowance',
        rateSourceLabel: 'National-average planning allowance',
      })
    ).toBe('Electrical rough — allowance');
    expect(
      proposalAllowanceLineName('Wall paint', {
        pricingSourceKind: 'parsed_from_notes',
        rateSourceLabel: 'From notes',
      })
    ).toBe('Wall paint');
  });

  test('drops measurements and allowances the confirmed scope no longer shows', () => {
    const filtered = filterProposalExportToSnapshot({
      confirmed: true,
      items: [
        { id: 'shower_tile', label: 'Shower wall tile', state: 'included' },
        { id: 'interior_paint', label: 'Interior painting', state: 'excluded' },
        { id: 'toilet', label: 'Toilet', state: 'included' },
      ],
      paintingLines: [
        { label: 'Wall paint', quantity: '2,400 sqft' },
        { label: 'Baseboard / trim', quantity: '80 LF' },
      ],
      wetAreaCard: { title: 'Wet area install' },
      electricalCard: { title: 'Electrical' },
      allowances: [
        { name: 'Exterior trim paint', checklistItemId: 'exterior_trim_paint', amount: 180 },
        { name: 'Toilet', checklistItemId: 'toilet', amount: 900 },
      ],
    });

    expect(filtered.paintingLines).toEqual([]);
    expect(filtered.wetAreaCard).toEqual({ title: 'Wet area install' });
    expect(filtered.electricalCard).toBeNull();
    expect(filtered.allowances.map(line => line.name)).toEqual(['Toilet']);
  });

  test('a single-trade electrical plan does not keep a wet-area card', () => {
    const filtered = filterProposalExportToSnapshot({
      confirmed: true,
      planImportTradeKey: 'electrical',
      items: [
        { id: 'electrical_rough', label: 'Electrical rough', state: 'included' },
        { id: 'shower_tile', label: 'Shower wall tile', state: 'included' },
      ],
      paintingLines: [{ label: 'Wall paint', quantity: '100 sqft' }],
      wetAreaCard: { title: 'Wet area install' },
      electricalCard: { title: 'Electrical' },
      allowances: [],
    });

    expect(filtered.wetAreaCard).toBeNull();
    expect(filtered.paintingLines).toEqual([]);
    expect(filtered.electricalCard).toEqual({ title: 'Electrical' });
  });

  test('uses the whole-home wet area layout for a ground-up plan, not a single trade', () => {
    expect(
      proposalUsesWholeHomeWetArea({
        templateKey: 'ground_up',
        planImportMode: 'whole_project',
      })
    ).toBe(true);
    expect(
      proposalUsesWholeHomeWetArea({
        templateKey: 'electrical',
        planImportMode: 'whole_project',
        planImportTradeKey: 'electrical',
      })
    ).toBe(false);
  });
});
