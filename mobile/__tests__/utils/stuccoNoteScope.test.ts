import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  dedicatedStuccoRevealLines,
  filterDedicatedStuccoConfirmItems,
  notesDescribeDedicatedStuccoJob,
} from '@/utils/stuccoNoteScope';

const NOTE =
  'Patch and install new stucco on 800 sqft of exterior wall, including mesh and base coat.';

describe('dedicated stucco note', () => {
  it('keeps one stucco line at the stated wall area', () => {
    expect(notesDescribeDedicatedStuccoJob(NOTE)).toBe(true);
    expect(
      notesDescribeDedicatedStuccoJob(
        'New 2,450 sqft two-story home with an attached 520 sqft 2-car garage. Stucco exterior. Owner is taking care of landscaping separate from us.'
      )
    ).toBe(false);
    expect(
      notesDescribeDedicatedStuccoJob(
        'Patch stucco on 800 sqft of exterior wall and paint the trim.'
      )
    ).toBe(false);
    expect(dedicatedStuccoRevealLines(NOTE)).toEqual([
      'Stucco / exterior wall finish · 800 sqft',
    ]);

    const filtered = filterDedicatedStuccoConfirmItems(
      [
        { id: 'stucco', state: 'unsure', inputType: 'choice', choiceId: 'unsure' },
        { id: 'stucco_lath', state: 'unsure', label: 'Metal lath' },
        { id: 'stucco_base_coat', state: 'unsure', label: 'Base coat' },
        { id: 'stucco_repairs', state: 'unsure', label: 'Stucco repair' },
        { id: 'custom_extra', state: 'included', label: 'Custom' },
      ],
      NOTE
    );
    expect(filtered.map(item => item.id)).toEqual(['stucco', 'custom_extra']);
    expect(filtered[0]).toMatchObject({
      state: 'included',
      inputType: 'yes_no',
      choiceId: 'unsure',
    });
    expect(
      filterDedicatedStuccoConfirmItems(
        [{ id: 'stucco_lath', state: 'unsure' }],
        NOTE,
        { planBacked: true }
      ).map(item => item.id)
    ).toEqual(['stucco_lath']);

    const grouped = groupScopeChecklistItems(
      [
        {
          id: 'stucco',
          label: 'Stucco / exterior wall finish',
          state: 'unsure',
          inputType: 'choice',
          choiceId: 'unsure',
        },
        { id: 'stucco_lath', label: 'Metal lath', state: 'unsure' },
        { id: 'stucco_base_coat', label: 'Base coat', state: 'unsure' },
      ] as ScopeChecklistItem[],
      'stucco',
      { notes: NOTE }
    );
    expect(grouped).toEqual([
      {
        title: 'Stucco',
        items: [
          expect.objectContaining({
            id: 'stucco',
            state: 'included',
            inputType: 'yes_no',
          }),
        ],
      },
    ]);

    const draft = {
      originalNotes: NOTE,
      projectType: 'stucco',
      projectTitle: 'Exterior Stucco Patch and Installation',
      whatAiDid: ['Detected stucco.'],
      scopeChecklist: { templateKey: 'stucco', items: [] },
      stillNeededReview: ['Price needed for Stucco / exterior wall finish'],
    } as EstimateAiDraft;

    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual(
      dedicatedStuccoRevealLines(NOTE)
    );
    expect(
      getInitialRevealChecklistScopePreview(draft).map(
        row => `${row.name} · ${row.quantity}`
      )
    ).toEqual(dedicatedStuccoRevealLines(NOTE));
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(1);
  });
});
