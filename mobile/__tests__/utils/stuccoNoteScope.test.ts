import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import {
  groupScopeChecklistItems,
  shouldSeedWholeProjectShellChecklist,
} from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealHeroDisplay,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  quickMeasurementRowsForInput,
  quickMeasurementRowsForTemplate,
} from '@/utils/scopeQuickMeasurements';
import {
  quickMeasurementPlanningEstimateNote,
  quickMeasurementSummaryLine,
  resolveQuickMeasurementFields,
  summarizeQuickMeasurementFieldStates,
} from '@/utils/quickMeasurementProvenance';
import {
  dedicatedStuccoRevealLines,
  filterDedicatedStuccoConfirmItems,
  filterStuccoWithWindowsConfirmItems,
  notesDescribeDedicatedStuccoJob,
  notesNameStuccoWithWindows,
  stuccoInstallSystemIds,
} from '@/utils/stuccoNoteScope';

const NOTE =
  'Patch and install new stucco on 800 sqft of exterior wall, including mesh and base coat.';

describe('dedicated stucco note', () => {
  it('offers 3-coat and 1-coat until the note names another system', () => {
    expect(stuccoInstallSystemIds('Rear house stucco, 800 sqft.')).toEqual([
      'three_coat',
      'one_coat',
    ]);
    expect(stuccoInstallSystemIds('Install EIFS on the rear wall.')).toEqual([
      'three_coat',
      'one_coat',
      'eifs',
    ]);
    expect(
      stuccoInstallSystemIds('Color coat the existing stucco, 800 sqft.')
    ).toEqual(['three_coat', 'one_coat', 'finish_only']);
  });

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
    expect(
      groupScopeChecklistItems(
        [
          {
            id: 'stucco',
            label: 'Stucco system',
            state: 'included',
            inputType: 'yes_no',
          },
          {
            id: 'cladding_demo__old_stucco',
            label: 'Stucco removal',
            state: 'included',
            inputType: 'yes_no',
          },
          {
            id: 'cladding_demo__wood_siding',
            label: 'Wood siding removal',
            state: 'included',
            inputType: 'yes_no',
          },
        ] as ScopeChecklistItem[],
        'stucco',
        { notes: NOTE }
      ).map(group => ({
        title: group.title,
        ids: group.items.map(item => item.id),
      }))
    ).toEqual([
      {
        title: 'Demo',
        ids: ['cladding_demo__old_stucco', 'cladding_demo__wood_siding'],
      },
      { title: 'Stucco', ids: ['stucco'] },
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

const STUCCO_AND_WINDOWS =
  'Stucco 1,200 sqft of exterior walls and replace 8 windows.';

describe('stucco and windows', () => {
  it('keeps the note on stucco and the window count', () => {
    expect(notesNameStuccoWithWindows(STUCCO_AND_WINDOWS)).toBe(true);
    expect(notesDescribeDedicatedStuccoJob(STUCCO_AND_WINDOWS)).toBe(false);
    expect(
      notesNameStuccoWithWindows(
        'Stucco 1,200 sqft of exterior walls, replace 8 windows, and hang drywall.'
      )
    ).toBe(false);
    expect(
      shouldSeedWholeProjectShellChecklist({
        notes: STUCCO_AND_WINDOWS,
        floorAreaSqft: 1200,
        windowCount: 8,
        templateKey: 'ground_up',
      })
    ).toBe(false);

    const filtered = filterStuccoWithWindowsConfirmItems(
      [
        { id: 'framing', label: 'Framing', state: 'included' },
        { id: 'drywall', label: 'Drywall', state: 'included' },
        { id: 'flooring', label: 'Flooring', state: 'included' },
        { id: 'stucco', label: 'Stucco', state: 'unsure' },
        { id: 'permits', label: 'Permits', state: 'included' },
      ],
      STUCCO_AND_WINDOWS
    );
    expect(filtered.map(item => item.id)).toEqual(['stucco', 'windows']);
    expect(
      groupScopeChecklistItems(filtered as ScopeChecklistItem[], 'ground_up', {
        notes: STUCCO_AND_WINDOWS,
      }).map(group => group.title)
    ).toEqual(['Stucco', 'Windows']);

    const repaired = repairDraftRatePricingFromNotes(
      {
        originalNotes: STUCCO_AND_WINDOWS,
        projectType: 'ground_up',
        projectTitle: 'New build',
        estimateTier: 'ground_up',
        scopeMode: 'dedicated',
        scopeChecklist: {
          templateKey: 'ground_up',
          items: [
            { id: 'framing', label: 'Framing', state: 'included', inputType: 'yes_no' },
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'included', inputType: 'yes_no' },
            { id: 'windows', label: 'Windows', state: 'included', inputType: 'yes_no' },
            {
              id: 'window_install',
              label: 'Window install',
              state: 'included',
              inputType: 'yes_no',
            },
            { id: 'permits', label: 'Permits', state: 'included', inputType: 'yes_no' },
          ],
          scopeFacts: [
            {
              scopeId: 'window_install',
              status: 'included',
              catalogEntry: { displayName: 'Window install' },
            },
          ],
        },
        scopeMeasurements: { floorAreaSqft: 1200, windowCount: 8 },
        scopePackages: [{ name: 'Framing' }],
      } as EstimateAiDraft,
      STUCCO_AND_WINDOWS
    );
    expect(repaired.scopeChecklist?.items.map(item => item.id)).toEqual([
      'stucco',
      'windows',
    ]);
    expect(repaired.scopeMeasurements?.floorAreaSqft).toBeUndefined();
    expect(repaired.scopeMeasurements?.stuccoNetWallSqft).toBe(1200);
    expect(repaired.scopeMeasurements?.windowCount).toBe(8);
    const preview = getInitialRevealChecklistScopePreview(repaired);
    expect(preview.every(row => row.amount === 0)).toBe(true);
    expect(repaired.scopeChecklist?.scopeFacts).toEqual([]);
    expect(
      preview.map(row =>
        row.quantity ? `${row.name} · ${row.quantity}` : row.name
      )
    ).toEqual([
      'Stucco / exterior wall finish · 1200 sqft',
      'Windows · 8 each',
    ]);
    expect(getInitialRevealTotals(repaired).scopeItemCount).toBe(2);
    expect(getInitialRevealDisplayTitle(repaired)).toBe('Stucco and windows');
    expect(getInitialRevealTagline(repaired)).toBe('Stucco · Windows');

    const rows = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: STUCCO_AND_WINDOWS }
    );
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: {
        stuccoGrossWallSqft: '1200',
        stuccoNetWallSqft: '1200',
        windowCount: '8',
      },
      includedScopeKeys: ['stucco', 'windows'],
      templateKey: 'room_remodel',
      notes: STUCCO_AND_WINDOWS,
    });
    expect(results.map(result => result.key)).toEqual([
      'stuccoGrossWallSqft',
      'windowCount',
    ]);
    expect(results.every(result => result.state === 'confirmed')).toBe(true);
    expect(
      results.every(
        result => quickMeasurementPlanningEstimateNote(result) == null
      )
    ).toBe(true);
    expect(
      quickMeasurementSummaryLine(summarizeQuickMeasurementFieldStates(results))
    ).toBe('2 measurements confirmed');
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    expect(
      getInitialRevealHeroDisplay(getInitialRevealTotals(repaired), true).hasAmount
    ).toBe(false);
    expect(
      quickMeasurementRowsForTemplate('ground_up', 'ground_up', STUCCO_AND_WINDOWS)
        .flat()
        .map(field => field.key)
    ).toEqual(['stuccoGrossWallSqft', 'windowCount']);
    expect(
      quickMeasurementRowsForTemplate('ground_up', 'ground_up', STUCCO_AND_WINDOWS)
        .flat()
        .map(field => field.label)
    ).toEqual(['Stucco wall area', 'Windows']);
  });
});
