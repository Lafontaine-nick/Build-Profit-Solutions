import {
  LANDSCAPING_QM_EMBEDDED_IDS,
  LANDSCAPING_QM_SYNC_SCOPE_IDS,
  isLandscapingQmScopeItemActive,
  landscapingQmPanel,
  syncLandscapingQmScopeItems,
} from '@/utils/qmScopePanels/landscapingRemodel';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

function item(id: string): ScopeChecklistItem {
  return { id, label: id, inputType: 'yes_no', state: 'unsure', category: 'landscape' };
}

describe('landscaping QM', () => {
  it('does not embed scope cards in QM (Confirm Scope shows them like flooring)', () => {
    expect(LANDSCAPING_QM_EMBEDDED_IDS).toEqual(new Set());
    expect(LANDSCAPING_QM_SYNC_SCOPE_IDS.has('demo_clearing')).toBe(true);
  });

  it('syncs image-style selections to the canonical priced scope ids', () => {
    const next = syncLandscapingQmScopeItems(
      [item('artificial_turf'), item('sod_turf'), item('rock'), item('pavers'), item('irrigation')],
      {
        landscapeScope: ['artificial_turf', 'decorative_boulders', 'pavers', 'irrigation'],
      }
    );
    expect(next.filter((row) => row.state === 'included').map((row) => row.id)).toEqual([
      'artificial_turf',
      'pavers',
      'irrigation',
      'landscape_boulders',
    ]);
  });

  it('includes measured landscape products without a separate button tap', () => {
    const next = syncLandscapingQmScopeItems([item('sod_turf'), item('rock'), item('pavers')], {
      sodSqft: '900',
      rockMulchSqft: '600',
      paverSqft: '180',
    });
    expect(next.every((row) => row.state === 'included')).toBe(true);
  });

  it('includes sitework lines when their dedicated QM sqft fields are entered', () => {
    const next = syncLandscapingQmScopeItems(
      [item('demo_clearing'), item('grading'), item('soil_prep')],
      {
        landscapeScope: ['demo_clearing', 'grading', 'soil_prep'],
        demoClearingSqft: '1200',
        gradingSqft: '1200',
        soilPrepSqft: '1200',
      }
    );
    expect(next.every((row) => row.state === 'included' && row.noteBacked === true)).toBe(true);
  });

  it('activates scope cards from QM selection or measurements', () => {
    expect(
      isLandscapingQmScopeItemActive('demo_clearing', { landscapeScope: ['demo_clearing'] })
    ).toBe(true);
    expect(isLandscapingQmScopeItemActive('grading', { gradingSqft: '800' })).toBe(true);
    expect(isLandscapingQmScopeItemActive('grading', { landscapeScope: [] })).toBe(false);
  });

  it('does not resurrect a deselected item from its previous measurement', () => {
    expect(
      isLandscapingQmScopeItemActive('demo_clearing', {
        landscapeScope: [],
        demoClearingSqft: '200',
      })
    ).toBe(false);

    const next = syncLandscapingQmScopeItems(
      [{ ...item('demo_clearing'), state: 'included', noteBacked: true }],
      { landscapeScope: [], demoClearingSqft: '200' }
    );
    expect(next[0].state).toBe('excluded');
  });

  it('migrates a selected new scope card into older landscaping drafts', () => {
    const next = syncLandscapingQmScopeItems([], {
      landscapeScope: ['artificial_turf'],
      artificialTurfSqft: '150',
    });
    expect(next).toEqual([
      expect.objectContaining({
        id: 'artificial_turf',
        label: 'Artificial turf',
        state: 'included',
        noteBacked: true,
      }),
    ]);
  });

  it('migrates stale sod selection to artificial turf when notes say fake grass', () => {
    const hydrated = landscapingQmPanel.hydrateMeasurements({
      measurements: { landscapeScope: ['sod'] },
      notes: 'Backyard will have fake grass and rocks.',
      checklistItems: [],
      templateKey: 'landscaping',
    });
    expect(hydrated.landscapeScope).toEqual(['artificial_turf']);
  });

  it('infers artificial turf from artificial grass notes without selecting sod', () => {
    const hydrated = landscapingQmPanel.hydrateMeasurements({
      measurements: {},
      notes: 'Install artificial grass in the backyard.',
      checklistItems: [],
      templateKey: 'landscaping',
    });
    expect(hydrated.landscapeScope).toEqual(['artificial_turf']);
  });

  it('migrates a selected trees scope card into older landscaping drafts', () => {
    const next = syncLandscapingQmScopeItems([], {
      landscapeScope: ['trees'],
      treeCount: '5',
    });
    expect(next).toEqual([
      expect.objectContaining({
        id: 'trees',
        label: 'Trees',
        state: 'included',
        noteBacked: true,
      }),
    ]);
  });

  it('removes a canonical item when its panel selection is cleared', () => {
    const next = syncLandscapingQmScopeItems(
      [{ ...item('irrigation'), state: 'included', noteBacked: true }],
      { landscapeScope: [] }
    );
    expect(next[0].state).toBe('excluded');
  });
});
