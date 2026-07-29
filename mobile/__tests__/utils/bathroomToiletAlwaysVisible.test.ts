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
