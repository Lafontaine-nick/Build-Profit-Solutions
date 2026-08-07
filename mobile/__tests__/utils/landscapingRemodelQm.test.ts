import {
  LANDSCAPING_QM_EMBEDDED_IDS,
  syncLandscapingQmScopeItems,
} from '@/utils/qmScopePanels/landscapingRemodel';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

function item(id: string): ScopeChecklistItem {
  return { id, label: id, inputType: 'yes_no', state: 'unsure', category: 'landscape' };
}

describe('landscaping QM', () => {
  it('embeds the landscape checklist lines in the trade panel', () => {
    expect(LANDSCAPING_QM_EMBEDDED_IDS).toEqual(
      new Set([
        'demo_clearing',
        'grading',
        'soil_prep',
        'drainage',
        'irrigation',
        'sod_turf',
        'rock_mulch',
        'plants_trees',
        'pavers',
        'concrete',
        'landscape_lighting',
        'mobilization',
        'cleanup',
      ])
    );
  });

  it('syncs image-style selections to the canonical priced scope ids', () => {
    const next = syncLandscapingQmScopeItems(
      [item('sod_turf'), item('rock_mulch'), item('pavers'), item('irrigation')],
      {
        landscapeScope: ['artificial_turf', 'decorative_boulders', 'pavers', 'irrigation'],
      }
    );
    expect(next.filter((row) => row.state === 'included').map((row) => row.id)).toEqual([
      'sod_turf',
      'rock_mulch',
      'pavers',
      'irrigation',
    ]);
  });

  it('includes measured landscape products without a separate button tap', () => {
    const next = syncLandscapingQmScopeItems([item('sod_turf'), item('rock_mulch'), item('pavers')], {
      sodSqft: '900',
      rockMulchSqft: '600',
      paverSqft: '180',
    });
    expect(next.every((row) => row.state === 'included')).toBe(true);
  });

  it('removes a canonical item when its panel selection is cleared', () => {
    const next = syncLandscapingQmScopeItems([item('irrigation')], { landscapeScope: [] });
    expect(next[0].state).toBe('excluded');
  });
});

