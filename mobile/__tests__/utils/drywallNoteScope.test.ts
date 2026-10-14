import { wholeProjectGroupDisplayTotal } from '@/utils/benchmarkReasonablenessContext';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { checklistDisplayHelper } from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealTagline,
} from '@/utils/estimateInitialRevealUi';
import {
  confirmScopeDrywallSqftLabel,
  dedicatedDrywallConfirmScopeItems,
  notesDescribeDedicatedDrywallJob,
} from '@/utils/drywallNoteScope';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

const NOTES =
  'Remove the damaged drywall. Hang and finish 2,400 sqft with tape, mud, sanding, and texture, including 300 sqft of patch repair.';

describe('dedicated drywall note', () => {
  it('prices hang at 2,400 sqft and patch at 300 sqft, with demo unquantified', () => {
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Drywall Removal, Replacement, and Repair',
        estimateTier: 'room_remodel',
        originalNotes: NOTES,
        scopeMode: 'dedicated',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            {
              id: 'drywall',
              label: 'Drywall hang / finish',
              state: 'included',
              inputType: 'yes_no',
            },
            {
              id: 'patch_repair',
              label: 'Patch / repair only',
              state: 'included',
              inputType: 'yes_no',
            },
          ],
        },
        scopePackages: [],
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      NOTES
    );

    expect(repaired.projectType).toBe('drywall');
    expect(repaired.scopeChecklist?.templateKey).toBe('drywall');
    expect(getInitialRevealTagline(repaired)).toBe('Detected drywall job.');
    expect(repaired.scopeChecklist?.items?.map(item => item.label)).toEqual([
      'Drywall demo / removal',
      'Drywall hang / finish',
      'Drywall patch / repair',
    ]);
    expect(repaired.scopeMeasurements?.drywallSqft).toBe(2400);
    expect(repaired.scopeMeasurements?.patchRepairSqft).toBe(300);
    expect(repaired.scopeMeasurements?.wallDemoSqft).toBeUndefined();

    const preview = getInitialRevealChecklistScopePreview(repaired);
    expect(preview.map(row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`)).toEqual([
      'Drywall demo / removal',
      'Drywall hang / finish · 2400 sqft',
      'Drywall patch / repair · 300 sqft',
    ]);

    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    expect(
      resolveChecklistItemQuantity('drywall', measurements, {
        templateKey: 'drywall',
        notes: NOTES,
      }).quantity
    ).toBe(2400);
    expect(
      resolveChecklistItemQuantity('patch_repair', measurements, {
        templateKey: 'drywall',
        notes: NOTES,
      }).quantity
    ).toBe(300);
    expect(
      resolveChecklistItemQuantity('demo_removal', measurements, {
        templateKey: 'drywall',
        notes: NOTES,
      }).quantity
    ).toBeNull();

    const fields = quickMeasurementRowsForInput(
      'drywall',
      'drywall',
      measurements,
      undefined,
      { scopeNotes: NOTES }
    )
      .flat()
      .map(field => field.label);
    expect(fields).toEqual([
      'Drywall demo',
      'Drywall hang / finish',
      'Drywall patch / repair',
    ]);
    expect(
      confirmScopeDrywallSqftLabel(NOTES, {
        installNamed: false,
        repairNamed: true,
      })
    ).toBeNull();

    const hangItem = dedicatedDrywallConfirmScopeItems(NOTES).find(
      item => item.id === 'drywall'
    );
    expect(checklistDisplayHelper(hangItem!, 'drywall')).toBe(
      'Hang and finish, including tape, mud, sanding, and texture.'
    );

    const hangQuantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
      notes: NOTES,
    });
    const hangPrice = resolveScopeItemSuggestedPricing(
      'drywall',
      repaired.scopeMeasurements || {},
      'drywall',
      hangQuantity,
      null,
      null,
      NOTES
    );
    expect(hangPrice.fill).toMatchObject({
      material: 2040,
      labor: 3000,
      total: 5040,
    });
    expect(hangPrice.fill?.costBuckets?.map(bucket => bucket.label)).toEqual([
      'Material',
      'Labor',
    ]);

    const withDemo = normalizeScopeMeasurements({
      ...repaired.scopeMeasurements,
      wallDemoSqft: '400',
      quickMeasurementUserOverrides: { wallDemoSqft: true },
    });
    const demoQuantity = resolveChecklistItemQuantity(
      'demo_removal',
      withDemo,
      { templateKey: 'drywall', notes: NOTES }
    );
    expect(demoQuantity.quantity).toBe(400);
    const demoPrice = resolveScopeItemSuggestedPricing(
      'demo_removal',
      { ...(repaired.scopeMeasurements || {}), wallDemoSqft: '400' },
      'drywall',
      demoQuantity,
      null,
      null,
      NOTES
    );
    expect(demoPrice.fill).toMatchObject({
      material: 100,
      labor: 500,
      total: 600,
    });

    const patchQuantity = resolveChecklistItemQuantity(
      'patch_repair',
      measurements,
      { templateKey: 'drywall', notes: NOTES }
    );
    const patchPrice = resolveScopeItemSuggestedPricing(
      'patch_repair',
      repaired.scopeMeasurements || {},
      'drywall',
      patchQuantity,
      null,
      null,
      NOTES
    );
    expect(patchQuantity.quantity).toBe(300);
    expect(patchPrice.fill).toMatchObject({
      total: 0,
      benchmarkAction: 'included_in_stage',
      includedInStageLabel: 'the 2,400 sqft hang / finish',
    });
    expect(patchPrice.fill?.helper).toMatch(/300 sqft of patch repair/);

    const withDemo500 = {
      ...(repaired.scopeMeasurements || {}),
      wallDemoSqft: '500',
    };
    expect(
      wholeProjectGroupDisplayTotal({
        items: dedicatedDrywallConfirmScopeItems(NOTES),
        measurements: withDemo500,
        templateKey: 'drywall',
        notes: NOTES,
      })
    ).toBe(5790);
  });

  it('prices a hang-and-finish note that never says drywall', () => {
    const notes = 'Hang and finish 1,800 sqft. Tape, mud, and texture.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Interior remodel',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            {
              id: 'drywall',
              label: 'Drywall',
              state: 'unsure',
              inputType: 'yes_no',
            },
          ],
        },
        scopePackages: [],
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );

    expect(
      notesDescribeDedicatedDrywallJob(
        'Hang drywall 1,200 sqft material $1.50 per sqft labor $3 per sqft. Tape and finish 1,200 sqft labor $2.25 per sqft.'
      )
    ).toBe(false);

    expect(repaired.projectType).toBe('drywall');
    expect(repaired.scopeChecklist?.templateKey).toBe('drywall');
    expect(getInitialRevealTagline(repaired)).toBe('Detected drywall job.');
    expect(repaired.scopeChecklist?.items?.map(item => item.label)).toEqual([
      'Drywall hang / finish',
    ]);
    expect(repaired.scopeMeasurements?.drywallSqft).toBe(1800);
    expect(repaired.scopeMeasurements?.patchRepairSqft).toBeUndefined();
    expect(repaired.scopeMeasurements?.wallDemoSqft).toBeUndefined();

    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    const fields = quickMeasurementRowsForInput(
      'drywall',
      'drywall',
      measurements,
      undefined,
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.label);
    expect(fields).toEqual(['Drywall hang / finish']);
    expect(
      confirmScopeDrywallSqftLabel(notes, {
        installNamed: false,
        repairNamed: true,
      })
    ).toBeNull();

    const hangItem = dedicatedDrywallConfirmScopeItems(notes).find(
      item => item.id === 'drywall'
    );
    expect(checklistDisplayHelper(hangItem!, 'drywall')).toBe(
      'Hang and finish, including tape, mud, and texture.'
    );

    const hangQuantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
      notes,
    });
    const hangPrice = resolveScopeItemSuggestedPricing(
      'drywall',
      repaired.scopeMeasurements || {},
      'drywall',
      hangQuantity,
      null,
      null,
      notes
    );
    expect(hangQuantity.quantity).toBe(1800);
    expect(hangPrice.fill).toMatchObject({
      material: 1530,
      labor: 2250,
      total: 3780,
    });
    expect(
      wholeProjectGroupDisplayTotal({
        items: dedicatedDrywallConfirmScopeItems(notes),
        measurements: repaired.scopeMeasurements || {},
        templateKey: 'drywall',
        notes,
      })
    ).toBe(3780);
  });

  it('prices stated demo sqft separately from hang and finish', () => {
    const notes =
      'Remove 500 sqft of damaged drywall. Hang and finish 1,200 sqft with tape, mud, and texture.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });
    expect(parsed.wallDemoSqft).toBe(500);
    expect(parsed.drywallSqft).toBe(1200);
    expect(parsed.floorAreaSqft).toBeUndefined();

    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeChecklist: { templateKey: 'room_remodel', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(repaired.scopeMeasurements?.wallDemoSqft).toBe(500);
    expect(repaired.scopeMeasurements?.drywallSqft).toBe(1200);
    expect(repaired.scopeMeasurements?.floorAreaSqft).toBeUndefined();
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'demo_removal',
      'drywall',
    ]);

    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    const demoQuantity = resolveChecklistItemQuantity(
      'demo_removal',
      measurements,
      { templateKey: 'drywall', notes }
    );
    const demoPrice = resolveScopeItemSuggestedPricing(
      'demo_removal',
      repaired.scopeMeasurements || {},
      'drywall',
      demoQuantity,
      null,
      null,
      notes
    );
    expect(demoQuantity.quantity).toBe(500);
    expect(demoPrice.fill?.total).toBe(750);

    const hangQuantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
      notes,
    });
    const hangPrice = resolveScopeItemSuggestedPricing(
      'drywall',
      {
        ...(repaired.scopeMeasurements || {}),
        floorAreaSqft: 500,
      },
      'drywall',
      hangQuantity,
      null,
      null,
      notes
    );
    expect(hangQuantity.quantity).toBe(1200);
    expect(hangPrice.fill).toMatchObject({
      material: 1020,
      labor: 1500,
      total: 2520,
    });
  });

  it('still prices a patch that is not included in the hang area', () => {
    const notes =
      'Hang and finish 2,100 sqft of drywall. Patch 300 sqft of drywall repair.';
    const measurements = normalizeScopeMeasurements({
      drywallSqft: 2100,
      patchRepairSqft: 300,
    });
    const patchQuantity = resolveChecklistItemQuantity(
      'patch_repair',
      measurements,
      { templateKey: 'drywall', notes }
    );
    const patchPrice = resolveScopeItemSuggestedPricing(
      'patch_repair',
      measurements,
      'drywall',
      patchQuantity,
      null,
      null,
      notes
    );
    expect(patchQuantity.quantity).toBe(300);
    expect(patchPrice.fill?.total).toBe(630);
    expect(patchPrice.fill?.benchmarkAction).not.toBe('included_in_stage');
  });
});
