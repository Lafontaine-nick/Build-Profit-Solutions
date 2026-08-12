import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  scopeCardAccentForItem,
  scopeCardOpacityForItem,
  scopeItemHasMeasuredSelection,
  SCOPE_ITEM_TIER_OPACITY,
  SCOPE_ITEM_UNSURE_OPACITY,
} from '@/utils/scopeItemVisualTier';

describe('scopeCardAccentForItem', () => {
  const unsureYesNo: Pick<ScopeChecklistItem, 'state' | 'choiceId' | 'inputType' | 'choiceIds'> = {
    state: 'unsure',
    inputType: 'yes_no',
  };

  test('Not sure uses shared subdued opacity for primary and secondary tiers', () => {
    expect(scopeCardAccentForItem('primary', unsureYesNo, true).opacity).toBe(
      SCOPE_ITEM_UNSURE_OPACITY
    );
    expect(scopeCardAccentForItem('secondary', unsureYesNo, true).opacity).toBe(
      SCOPE_ITEM_UNSURE_OPACITY
    );
    expect(scopeCardAccentForItem('primary', { state: 'included', inputType: 'yes_no' }, true).opacity).toBe(
      SCOPE_ITEM_TIER_OPACITY.primary
    );
  });

  test('Not sure adds softer card surface in dark mode', () => {
    const accent = scopeCardAccentForItem('secondary', unsureYesNo, true);
    expect(accent.backgroundColor).toBeTruthy();
    expect(accent.borderColor).toBeTruthy();
  });

  test('excluded cards stay muted', () => {
    expect(scopeCardOpacityForItem('muted', unsureYesNo)).toBe(SCOPE_ITEM_TIER_OPACITY.muted);
  });

  test('Roofing cards highlight when QM selection has a measured quantity', () => {
    const item = {
      id: 'tear_off',
      state: 'unsure',
      inputType: 'choice',
      choiceId: 'unsure',
    } as ScopeChecklistItem;
    const context = {
      templateKey: 'roofing',
      measurements: {
        roofSquares: 30,
        itemQuantities: {},
        tradeScopeSelections: { roofing: ['tear_off'] },
      },
    } as any;

    expect(scopeItemHasMeasuredSelection(item, context)).toBe(true);
    expect(
      scopeCardAccentForItem('primary', item, true, true)
    ).toMatchObject({
      opacity: 1,
      borderColor: '#fbbf24',
    });
  });

  test('Roofing system card highlights when shingles are measured in QM', () => {
    const item = {
      id: 'roofing_system',
      state: 'unsure',
      inputType: 'choice',
      choiceId: 'unsure',
    } as ScopeChecklistItem;
    const context = {
      templateKey: 'roofing',
      measurements: {
        roofSquares: 30,
        itemQuantities: {},
        tradeScopeSelections: { roofing: ['shingles'] },
      },
    } as any;

    expect(scopeItemHasMeasuredSelection(item, context)).toBe(true);
  });

  test('Roof repairs card highlights when repair area is measured in QM', () => {
    const item = {
      id: 'roof_repairs',
      state: 'excluded',
      inputType: 'choice',
      choiceId: 'not_in_scope',
    } as ScopeChecklistItem;
    const context = {
      templateKey: 'roofing',
      measurements: {
        roofRepairAffectedSqft: 50,
        itemQuantities: {},
        tradeScopeSelections: { roofing: ['roof_repairs'] },
      },
    } as any;

    expect(scopeItemHasMeasuredSelection(item, context)).toBe(true);
  });
});
