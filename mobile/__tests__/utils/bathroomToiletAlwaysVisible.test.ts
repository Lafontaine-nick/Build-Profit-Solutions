import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  ensureBathroomChecklistItems,
  hydrateScopeChecklistFromNotes,
  initialScopeGroupCollapse,
  groupScopeChecklistItems,
  normalizeScopeChecklistItems,
} from '@/utils/estimateScopeChecklistUi';
import { scopeItemVisualTier } from '@/utils/scopeItemVisualTier';

describe('bathroom toilet always visible on Confirm Scope', () => {
  test('ensureBathroomChecklistItems injects toilet when missing from AI checklist', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'demo', label: 'Demo', inputType: 'yes_no', state: 'included' },
      { id: 'lighting', label: 'Lighting', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = ensureBathroomChecklistItems(items, 'bathroom');
    const toilet = next.find((row) => row.id === 'toilet');
    expect(toilet).toBeTruthy();
    expect(toilet?.inputType).toBe('choice');
    expect(toilet?.state).toBe('unsure');
    expect(next.findIndex((row) => row.id === 'toilet')).toBeLessThan(
      next.findIndex((row) => row.id === 'lighting')
    );
  });

  test('hydrateScopeChecklistFromNotes keeps toilet on photo/notes jobs without toilet language', () => {
    const hydrated = hydrateScopeChecklistFromNotes(
      [{ id: 'shower_tile', label: 'Shower tile', inputType: 'yes_no', state: 'included' }],
      'bathroom',
      'Tile shower walls and new glass door.',
      { itemQuantities: {} }
    );
    expect(hydrated.some((row) => row.id === 'toilet')).toBe(true);
  });

  test('rehydrates explicit tile and fixture rows from notes', () => {
    const hydrated = hydrateScopeChecklistFromNotes(
      [],
      'bathroom',
      'Install shower wall tile, shower pan, bathroom floor tile, sink, faucet, and vanity lighting.',
      { itemQuantities: {} }
    );
    for (const id of ['shower_tile', 'shower_pan', 'floor_tile', 'sink_faucet', 'lighting']) {
      const row = hydrated.find(candidate => candidate.id === id);
      expect(row).toEqual(expect.objectContaining({ state: 'included', noteBacked: true }));
    }
  });

  test('keeps all note-backed opening trades, including interior doors', () => {
    const notes =
      'Remodel bathroom with demolition of the existing shower, vanity, toilet, flooring, and drywall; install shower tile, shower pan, vanity, toilet, exhaust fan, 85 sqft floor tile, 65 LF trim, two interior doors, 2 exterior doors, 2 windows, 120 sqft drywall repair, R-21 exterior wall insulation, and paint.';
    const hydrated = hydrateScopeChecklistFromNotes(
      [],
      'bathroom',
      notes,
      { itemQuantities: {}, interiorDoorCount: 2, exteriorDoorCount: 2, windowCount: 2 } as any
    );

    for (const id of ['interior_door_install', 'exterior_doors', 'windows']) {
      expect(hydrated.find(row => row.id === id)).toEqual(
        expect.objectContaining({ state: 'included', noteBacked: true })
      );
    }
  });

  test('uses a generic blank Doors row when notes do not classify the doors', () => {
    const hydrated = hydrateScopeChecklistFromNotes(
      [],
      'bathroom',
      'Update the bathroom with new doors, flooring, drywall, and paint.',
      { itemQuantities: {} }
    );
    expect(hydrated.find(row => row.id === 'doors')).toEqual(
      expect.objectContaining({
        label: 'Doors',
        state: 'included',
        noteBacked: true,
      })
    );
    expect(hydrated.find(row => row.id === 'interior_door_install')).toBeUndefined();
    expect(hydrated.find(row => row.id === 'exterior_doors')).toBeUndefined();
  });

  test('collapses quiet secondary groups while keeping review groups expanded', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'unsure',
        choiceId: null,
        options: [],
      },
      {
        id: 'lighting',
        label: 'Lighting',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exhaust_fan',
        label: 'Exhaust fan',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const grouped = groupScopeChecklistItems(items, 'bathroom');
    const collapsed = initialScopeGroupCollapse(grouped, { itemQuantities: {} }, 'bathroom', '');
    expect(collapsed.Fixtures).toBe(false);
    const electricalGroup = grouped.find(group => group.title === 'Electrical');
    if (electricalGroup?.title) {
      expect(collapsed[electricalGroup.title]).toBe(true);
    }
  });

  test('all scope groups stay expanded when every item needs review', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'unsure',
        choiceId: null,
        options: [],
      },
      { id: 'floor_tile', label: 'Bath floor tile', inputType: 'yes_no', state: 'unsure' },
      { id: 'plumbing_rough', label: 'Plumbing rough-in', inputType: 'yes_no', state: 'unsure' },
      { id: 'plumbing_trim', label: 'Plumbing trim', inputType: 'yes_no', state: 'unsure' },
    ];
    const grouped = groupScopeChecklistItems(items, 'bathroom');
    const collapsed = initialScopeGroupCollapse(grouped, { itemQuantities: {} }, 'bathroom', '');
    for (const group of grouped) {
      if (!group.title) continue;
      expect(collapsed[group.title]).toBe(false);
    }
  });

  test('Fixtures group stays expanded and toilet renders at full emphasis without notes', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'unsure',
        choiceId: null,
        options: [],
      },
      { id: 'lighting', label: 'Lighting', inputType: 'yes_no', state: 'unsure' },
    ];
    const grouped = groupScopeChecklistItems(items, 'bathroom');
    const collapsed = initialScopeGroupCollapse(grouped, { itemQuantities: {} }, 'bathroom', '');
    expect(collapsed.Fixtures).toBe(false);

    const tier = scopeItemVisualTier(items[0], {
      notes: '',
      templateKey: 'bathroom',
      measurements: { itemQuantities: {} },
    });
    expect(tier).toBe('primary');
  });

  test('normalizeScopeChecklistItems upgrades stale toilet options to include Reset', () => {
    const staleOptions = [
      { id: 'staying', label: 'Staying' },
      { id: 'replacing', label: 'Replacing' },
      { id: 'relocating', label: 'Relocating' },
      { id: 'not_in_scope', label: 'Not in this bid' },
      { id: 'unsure', label: 'Not sure yet' },
    ];
    const [toilet] = normalizeScopeChecklistItems(
      [
        {
          id: 'toilet',
          label: 'Toilet',
          inputType: 'choice',
          state: 'unsure',
          choiceId: 'staying',
          options: staleOptions,
        },
      ],
      'bathroom'
    );
    expect(toilet.options?.map((opt) => opt.id)).toEqual([
      'reset',
      'replacing',
      'relocating',
      'not_in_scope',
      'unsure',
    ]);
    expect(toilet.helperText).toMatch(/reset/i);
    expect(toilet.helperText).not.toMatch(/staying/i);
  });

  test('clears legacy toilet staying choice on normalize', () => {
    const [toilet] = normalizeScopeChecklistItems(
      [
        {
          id: 'toilet',
          label: 'Toilet',
          inputType: 'choice',
          state: 'included',
          choiceId: 'staying',
        },
      ],
      'bathroom'
    );
    expect(toilet.choiceId).toBeNull();
    expect(toilet.state).toBe('unsure');
  });
});
