import {
  dedicatedWindowsDoorsNamedLines,
  dedicatedWindowsDoorsRevealLines,
  filterDedicatedWindowsDoorsConfirmItems,
  notesDescribeDedicatedWindowsDoorsJob,
} from '@/utils/windowsDoorsNoteScope';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import {
  countWindowsDoorsPlanOpeningsAsFromPlan,
  windowsDoorsPlanOpeningSettled,
} from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { bucketWindowsDoorsPriceGroups } from '@/utils/estimateScopeChecklistUi';

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
    expect(getInitialRevealTagline(draft)).toBe('Detected windows doors.');
    expect(
      getInitialRevealConfirmItems(draft).pricingScope.filter(item =>
        /price needed|pricing for/i.test(item)
      )
    ).toEqual([]);
  });

  it('keeps every counted opening on a windows plan export', () => {
    const measurements = {
      planImportMode: 'selected_trade',
      planImportTradeKey: 'windows_doors',
      planImportFingerprint: 'lot-49',
      windowCount: 33,
      exteriorDoorCount: 5,
      slidingDoorCount: 2,
      interiorDoorCount: 20,
    };
    const draft = {
      originalNotes: 'Detected windows doors.',
      projectType: 'windows_doors',
      whatAiDid: ['Detected windows doors.'],
      scopeChecklist: { templateKey: 'windows_doors', items: [] },
      scopeMeasurements: measurements,
    } as EstimateAiDraft;

    expect(getInitialRevealTagline(draft)).toBe(
      '33 windows, 5 swing doors, 2 sliders, and 20 interior doors from the plan.'
    );
    expect(
      getInitialRevealChecklistScopePreview(draft).map(row => ({
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
      }))
    ).toEqual([
      { name: 'Windows', quantity: '33 each', amount: 0 },
      { name: 'Exterior swing doors', quantity: '5 each', amount: 0 },
      { name: 'Sliding / patio doors', quantity: '2 each', amount: 0 },
      { name: 'Interior doors', quantity: '20 each', amount: 0 },
    ]);
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(4);
    expect(windowsDoorsPlanOpeningSettled('windows', measurements)).toBe(true);
    expect(windowsDoorsPlanOpeningSettled('exterior_door_install', measurements)).toBe(
      true
    );
    expect(windowsDoorsPlanOpeningSettled('sliding_doors', measurements)).toBe(true);
    expect(windowsDoorsPlanOpeningSettled('interior_door_install', measurements)).toBe(
      true
    );
    expect(windowsDoorsPlanOpeningSettled('prep', measurements)).toBe(false);

    const confirmed = {
      ...draft,
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'windows_doors',
        items: [
          { id: 'windows', label: 'Windows', state: 'included' },
          {
            id: 'exterior_door_install',
            label: 'Exterior door installation',
            state: 'included',
          },
          { id: 'sliding_doors', label: 'Sliding / patio doors', state: 'included' },
          {
            id: 'interior_door_install',
            label: 'Interior door installation',
            state: 'included',
          },
        ],
      },
      scopePackages: [
        {
          checklistItemId: 'windows',
          name: 'Windows',
          price: 24420,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
        {
          checklistItemId: 'exterior_door_install',
          name: 'Exterior door installation',
          price: 8250,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
        {
          checklistItemId: 'sliding_doors',
          name: 'Sliding / patio doors',
          price: 6800,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
        {
          checklistItemId: 'interior_door_install',
          name: 'Interior door installation',
          price: 7000,
          priceProvidedByUser: true,
          status: 'user_provided',
        },
      ],
    } as EstimateAiDraft;
    expect(
      getInitialRevealChecklistScopePreview(confirmed).map(row => ({
        name: row.name,
        quantity: row.quantity,
        amount: row.amount,
      }))
    ).toEqual([
      { name: 'Windows', quantity: '33 each', amount: 24420 },
      { name: 'Exterior swing doors', quantity: '5 each', amount: 8250 },
      { name: 'Sliding / patio doors', quantity: '2 each', amount: 6800 },
      { name: 'Interior doors', quantity: '20 each', amount: 7000 },
    ]);
    expect(getInitialRevealTotals(confirmed).scopeItemCount).toBe(4);

    const summary = countWindowsDoorsPlanOpeningsAsFromPlan(
      {
        detected: 3,
        aiVerified: 0,
        estimateAvailable: 0,
        needsConfirmation: 0,
        confirmed: 1,
        planConfirmed: 0,
        relevantTotal: 4,
      },
      [
        { key: 'windowCount', state: 'detected' },
        { key: 'slidingDoorCount', state: 'detected' },
        { key: 'interiorDoorCount', state: 'detected' },
        { key: 'exteriorDoorCount', state: 'confirmed', sourceTag: 'user_entered' },
      ],
      measurements
    );
    expect(summary.detected).toBe(4);
    expect(summary.confirmed).toBe(0);
    expect(summary.relevantTotal).toBe(4);
  });

  it('puts selected opening removals in Demo above the window install', () => {
    const groups = bucketWindowsDoorsPriceGroups([
      {
        title: 'Windows',
        items: [
          { id: 'windows', label: 'Windows', state: 'included', inputType: 'yes_no' },
        ],
      },
      {
        title: 'Other',
        items: [
          {
            id: 'opening_demo__existing_windows',
            label: 'Window removal',
            state: 'included',
            inputType: 'yes_no',
          },
          {
            id: 'opening_demo__existing_exterior_doors',
            label: 'Exterior door removal',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
    ]);
    expect(groups.map(group => group.title)).toEqual(['Demo', 'Windows']);
    expect(groups[0]?.items.map(item => item.id)).toEqual([
      'opening_demo__existing_windows',
      'opening_demo__existing_exterior_doors',
    ]);
  });
});
