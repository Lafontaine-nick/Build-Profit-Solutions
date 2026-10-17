import {
  dedicatedWindowsDoorsNamedLines,
  dedicatedWindowsDoorsRevealLines,
  filterDedicatedWindowsDoorsConfirmItems,
  notesDescribeDedicatedWindowsDoorsJob,
} from '@/utils/windowsDoorsNoteScope';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

const NOTE = 'Replace 6 windows, 2 exterior doors, and 4 interior doors.';

describe('dedicated windows and doors note', () => {
  it('keeps the three counted replacements and leaves trim, paint, and masking off', () => {
    expect(notesDescribeDedicatedWindowsDoorsJob(NOTE)).toBe(true);
    expect(
      notesDescribeDedicatedWindowsDoorsJob(
        'Replace 6 windows and paint the walls.'
      )
    ).toBe(false);
    expect(dedicatedWindowsDoorsNamedLines(NOTE).map(line => line.key)).toEqual([
      'windows',
      'exterior_doors',
      'interior_doors',
    ]);
    expect(dedicatedWindowsDoorsNamedLines(NOTE).map(line => line.count)).toEqual([
      6, 2, 4,
    ]);
    expect(dedicatedWindowsDoorsRevealLines(NOTE)).toEqual([
      'Window install · 6 each',
      'Exterior doors · 2 each',
      'Interior door installation · 4 each',
    ]);

    const filtered = filterDedicatedWindowsDoorsConfirmItems(
      [
        { id: 'windows', state: 'included', label: 'Window install' },
        { id: 'exterior_doors', state: 'included', label: 'Exterior doors' },
        {
          id: 'interior_door_install',
          state: 'unsure',
          label: 'Interior door installation',
        },
        { id: 'interior_trim', state: 'included', label: 'Interior door trim & finish' },
        { id: 'exterior_trim_paint', state: 'unsure', label: 'Exterior trim paint' },
        { id: 'exterior_prep', state: 'included', label: 'Exterior masking' },
        { id: 'exterior_paint', state: 'unsure', label: 'Exterior paint' },
        { id: 'custom_extra', state: 'included', label: 'Custom' },
      ],
      NOTE
    );
    expect(filtered.map(item => item.id)).toEqual([
      'windows',
      'exterior_doors',
      'interior_door_install',
      'custom_extra',
    ]);
    expect(
      filtered.find(item => item.id === 'interior_door_install')?.state
    ).toBe('included');
    expect(
      filterDedicatedWindowsDoorsConfirmItems(
        [{ id: 'exterior_prep', state: 'included' }],
        NOTE,
        { planBacked: true }
      ).map(item => item.id)
    ).toEqual(['exterior_prep']);

    const draft = {
      originalNotes: NOTE,
      projectType: 'windows_doors',
      projectTitle: 'Window and Door Replacement',
      whatAiDid: ['Detected windows doors.'],
      scopeChecklist: { templateKey: 'windows_doors', items: [] },
      stillNeededReview: [
        'Price needed for Interior door installation',
        'Price needed for Exterior trim paint',
      ],
    } as EstimateAiDraft;

    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual(
      dedicatedWindowsDoorsRevealLines(NOTE)
    );
    expect(
      getInitialRevealChecklistScopePreview(draft).map(
        row => `${row.name} · ${row.quantity}`
      )
    ).toEqual(dedicatedWindowsDoorsRevealLines(NOTE));
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(3);
    expect(
      getInitialRevealConfirmItems(draft).pricingScope.filter(item =>
        /price needed|pricing for/i.test(item)
      )
    ).toEqual([]);
  });
});
