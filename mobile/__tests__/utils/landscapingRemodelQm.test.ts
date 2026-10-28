import {
  LANDSCAPING_QM_EMBEDDED_IDS,
  LANDSCAPING_QM_SYNC_SCOPE_IDS,
  isLandscapingQmScopeItemActive,
  landscapingConfirmItemVisible,
  landscapingDemoChipActive,
  landscapingQmPanel,
  landscapingScopeChipNamedInNotes,
  syncLandscapingQmScopeItems,
} from '@/utils/qmScopePanels/landscapingRemodel';
import { wholeProjectGroupDisplayTotal } from '@/utils/benchmarkReasonablenessContext';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
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

  it('lets a contractor turn on demo clearing when mixed-exterior notes do not describe it', () => {
    expect(
      landscapingDemoChipActive({
        selected: true,
        condensed: true,
        notes: 'Covered patio 322 sqft and landscape drainage.',
      })
    ).toBe(false);
    expect(
      landscapingDemoChipActive({
        selected: true,
        condensed: true,
        notes: 'Covered patio 322 sqft and landscape drainage.',
        chosen: true,
      })
    ).toBe(true);
    expect(
      landscapingDemoChipActive({
        selected: true,
        condensed: true,
        notes: 'Clear vegetation and landscape debris from the lot.',
      })
    ).toBe(true);
    expect(
      landscapingDemoChipActive({
        selected: true,
        condensed: true,
        notes:
          'Clear and grade 1,200 sqft. Install irrigation, 800 sqft of sod, mulch, plants, and a paver walkway.',
      })
    ).toBe(true);
  });

  it('selects demo clearing from a clear-and-grade note', () => {
    const hydrated = landscapingQmPanel.hydrateMeasurements({
      measurements: {
        landscapeScope: ['sod', 'mulch', 'plants', 'irrigation', 'pavers'],
      },
      notes:
        'Clear and grade 1,200 sqft. Install irrigation, 800 sqft of sod, mulch, plants, and a paver walkway.',
      checklistItems: [],
      templateKey: 'landscaping',
    });
    expect(hydrated.landscapeScope).toEqual(
      expect.arrayContaining(['demo_clearing'])
    );
  });

  it('drops generic demo clearing when scope found names the materials', () => {
    const hydrated = landscapingQmPanel.hydrateMeasurements({
      measurements: {
        landscapeScope: ['sod', 'demo_clearing'],
        scopeFoundPieces: ['sod', 'landscape_rock', 'mulch', 'plants', 'landscape_pavers'],
      },
      notes: 'Install 2,000 sqft of sod.',
      checklistItems: [],
      templateKey: 'landscaping',
    });
    expect(hydrated.landscapeScope).not.toContain('demo_clearing');
    expect(hydrated.landscapeScope).toEqual(expect.arrayContaining(['sod']));
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

  it('keeps edging and retaining walls on their own priced cards', () => {
    const next = syncLandscapingQmScopeItems(
      [item('concrete_edging'), item('retaining_wall'), item('concrete')],
      {
        landscapeScope: ['concrete_edging', 'retaining_wall', 'concrete'],
        concreteEdgingLf: '180',
        retainingWallLf: '60',
        concreteSqft: '500',
      }
    );

    expect(next.filter(row => row.state === 'included').map(row => row.id)).toEqual([
      'concrete_edging',
      'retaining_wall',
      'concrete',
    ]);
  });

  const YARD_NOTE =
    'Clear and grade 1,200 sqft. Install irrigation, 800 sqft of sod, mulch, plants, and a paver walkway.';

  it('keeps a yard note on the named lines', () => {
    const hydrated = landscapingQmPanel.hydrateMeasurements({
      measurements: {},
      notes: YARD_NOTE,
      checklistItems: [
        { ...item('soil_prep'), state: 'included' },
        { ...item('artificial_turf'), state: 'included' },
        { ...item('concrete'), state: 'included' },
        { ...item('landscape_lighting'), state: 'included' },
        { ...item('cleanup'), state: 'included' },
      ],
      templateKey: 'landscaping',
    });
    expect(hydrated.landscapeScope).toEqual([
      'demo_clearing',
      'grading',
      'irrigation',
      'sod_turf',
      'mulch',
      'plants',
      'pavers',
    ]);
    expect(landscapingScopeChipNamedInNotes('grading', YARD_NOTE)).toBe(true);
    expect(landscapingScopeChipNamedInNotes('soil_prep', YARD_NOTE)).toBe(false);
    expect(landscapingScopeChipNamedInNotes('rock', YARD_NOTE)).toBe(false);
    expect(landscapingScopeChipNamedInNotes('landscape_lighting', YARD_NOTE)).toBe(false);

    const synced = syncLandscapingQmScopeItems(
      [
        item('demo_clearing'),
        item('grading'),
        item('soil_prep'),
        item('drainage'),
        item('irrigation'),
        item('sod_turf'),
        item('artificial_turf'),
        item('rock'),
        item('mulch'),
        item('plants'),
        item('trees'),
        item('landscape_boulders'),
        item('pavers'),
        item('concrete_edging'),
        item('retaining_wall'),
        item('concrete'),
        item('landscape_lighting'),
        item('mobilization'),
        item('cleanup'),
      ],
      { landscapeScope: hydrated.landscapeScope as string[] }
    );
    expect(synced.filter(row => row.state === 'included').map(row => row.id)).toEqual([
      'demo_clearing',
      'grading',
      'irrigation',
      'sod_turf',
      'mulch',
      'plants',
      'pavers',
    ]);
    expect(
      landscapingConfirmItemVisible({
        templateKey: 'landscaping',
        notes: YARD_NOTE,
        item: synced.find(row => row.id === 'soil_prep')!,
      })
    ).toBe(false);
    expect(
      landscapingConfirmItemVisible({
        templateKey: 'landscaping',
        notes: YARD_NOTE,
        item: synced.find(row => row.id === 'pavers')!,
      })
    ).toBe(true);
  });

  it('holds the irrigation price until a type is chosen, then adds it to the group', () => {
    const resolved = {
      quantity: 10,
      unit: 'zone',
      quantitySource: 'user_entered' as const,
    };
    const waiting = resolveScopeItemSuggestedPricing(
      'irrigation',
      { irrigationZoneCount: '10' },
      'landscaping',
      resolved,
      {},
      null,
      YARD_NOTE
    );
    expect(waiting.fill).toBeNull();

    const sprinkler = resolveScopeItemSuggestedPricing(
      'irrigation',
      { irrigationZoneCount: '10' },
      'landscaping',
      resolved,
      {},
      'sprinkler',
      YARD_NOTE
    );
    expect(sprinkler.fill?.total).toBe(12500);

    const group = wholeProjectGroupDisplayTotal({
      items: [
        {
          id: 'irrigation',
          label: 'Irrigation',
          inputType: 'choice',
          state: 'included',
          choiceId: 'sprinkler',
        },
      ],
      measurements: { irrigationZoneCount: '10', itemQuantities: {} },
      templateKey: 'landscaping',
      notes: YARD_NOTE,
    });
    expect(group).toBe(12500);
  });
});
