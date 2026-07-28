import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { resolveBathroomPlumbingTrimSuggestedPricing } from '@/utils/bathroomPlumbingTrimPricing';

function item(
  id: string,
  state: ScopeChecklistItem['state'] = 'included',
  choiceId?: string
): Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'> {
  return { id, state, choiceId };
}

describe('resolveBathroomPlumbingTrimSuggestedPricing', () => {
  it('sums lav + shower trim when vanity and wet area are separate lines (toilet separate)', () => {
    const result = resolveBathroomPlumbingTrimSuggestedPricing({
      checklistItems: [
        item('toilet', 'included', 'replacing'),
        item('vanity', 'included', 'replacing'),
        item('shower_tile', 'included'),
      ],
    });
    expect(result?.fill?.total).toBe(550);
    expect(result?.fill?.material).toBe(150);
    expect(result?.fill?.labor).toBe(400);
  });

  it('includes toilet hookup when toilet is not a separate Fixtures line', () => {
    const result = resolveBathroomPlumbingTrimSuggestedPricing({
      checklistItems: [item('vanity', 'included', 'replacing')],
    });
    expect(result?.fill?.total).toBe(500);
  });

  it('returns empty when no hookup components apply', () => {
    const result = resolveBathroomPlumbingTrimSuggestedPricing({
      checklistItems: [item('toilet', 'included', 'replacing'), item('cleanup', 'included')],
    });
    expect(result?.fill).toBeNull();
  });

  it('returns undefined when checklist is missing', () => {
    expect(resolveBathroomPlumbingTrimSuggestedPricing({ checklistItems: null })).toBeUndefined();
  });
});
