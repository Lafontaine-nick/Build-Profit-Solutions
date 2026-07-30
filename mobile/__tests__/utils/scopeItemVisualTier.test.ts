import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  scopeCardAccentForItem,
  scopeCardOpacityForItem,
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
});
