import { wholeProjectGroupDisplayTotal } from '@/utils/benchmarkReasonablenessContext';
import { computeStep3ReviewTotals } from '@/utils/estimateDraftReviewStep3Ui';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import {
  formatScopeQuantity,
  getCompactProjectSummary,
  reviewScopePackages,
} from '@/utils/estimateDraftReviewUi';
import {
  getScopePackagesForReview,
  withReconciledScopePackages,
} from '@/utils/scopePackagesForReview';
import { countVisiblePricingCards } from '@/utils/measurementSemantics';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  checklistDisplayHelper,
  groupScopeChecklistItems,
} from '@/utils/estimateScopeChecklistUi';
import { scopeFoundRevealLines } from '@/utils/scopeFoundClarification';
import {
  confirmedAppliedRevealLines,
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import {
  confirmScopeDrywallSqftLabel,
  dedicatedDrywallConfirmScopeItems,
  notesDescribeDedicatedDrywallJob,
} from '@/utils/drywallNoteScope';
import {
  notesRequireInteriorPaintMeasurements,
  quickMeasurementRowsForInput,
} from '@/utils/scopeQuickMeasurements';
import { getScopeUnitDefinition } from '@/utils/scopeIntelligence';
import {
  groupQuickMeasurementFields,
  placeDrywallCeilingUnderWallRemoval,
  quickMeasurementPlanningEstimateNote,
  resolveQuickMeasurementFields,
  type QuickMeasurementFieldResult,
} from '@/utils/quickMeasurementProvenance';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

const NOTES =
  'Remove the damaged drywall. Hang and finish 2,400 sqft with tape, mud, sanding, and texture, including 300 sqft of patch repair.';

describe('drywall in the addition', () => {
  it('keeps hang and finish, leaves the area blank, and drops unnamed remodel cards', () => {
    const notes = 'Drywall in the addition';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Addition Drywall',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            {
              id: 'drywall',
              label: 'Drywall hang / finish',
              state: 'included',
              inputType: 'yes_no',
            },
            { id: 'framing', label: 'Framing', state: 'unsure', inputType: 'yes_no' },
            { id: 'insulation', label: 'Insulation', state: 'unsure', inputType: 'yes_no' },
            { id: 'paint', label: 'Interior paint', state: 'unsure', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'unsure', inputType: 'yes_no' },
            { id: 'electrical', label: 'Electrical', state: 'unsure', inputType: 'yes_no' },
            { id: 'plumbing', label: 'Plumbing', state: 'unsure', inputType: 'yes_no' },
            { id: 'hvac', label: 'HVAC', state: 'unsure', inputType: 'yes_no' },
            { id: 'trim', label: 'Trim', state: 'unsure', inputType: 'yes_no' },
            { id: 'doors', label: 'Doors', state: 'unsure', inputType: 'yes_no' },
            { id: 'windows', label: 'Windows', state: 'unsure', inputType: 'yes_no' },
          ],
        },
        scopePackages: [{ name: 'Interior remodel' }],
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );

    expect(repaired.projectType).toBe('drywall');
    expect(repaired.scopeChecklist?.templateKey).toBe('drywall');
    expect(repaired.scopeChecklist?.items?.map(item => item.label)).toEqual([
      'Drywall hang / finish',
    ]);
    expect(repaired.scopeChecklist?.items?.every(item => item.state === 'included')).toBe(
      true
    );
    expect(repaired.scopeMeasurements?.drywallSqft).toBeUndefined();
    expect(getInitialRevealTagline(repaired)).toBe('Detected drywall job.');
    expect(
      confirmScopeDrywallSqftLabel(notes, {
        installNamed: false,
        repairNamed: false,
      })
    ).toBe('Drywall hang / finish');

    const fields = quickMeasurementRowsForInput(
      'drywall',
      'drywall',
      normalizeScopeMeasurements(repaired.scopeMeasurements || {}),
      undefined,
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.label);
    expect(fields).toEqual(['Drywall hang / finish']);
    expect(
      confirmScopeDrywallSqftLabel('Drywall and paint in the addition', {
        installNamed: false,
        repairNamed: false,
      })
    ).toBe('Drywall repair area');
  });
});

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
    expect(
      confirmScopeDrywallSqftLabel(
        'Whole house remodel. The house is 2,000 sqft. Drywall.',
        { installNamed: false, repairNamed: false }
      )
    ).toBe('Drywall');

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

  it('prices a patch-only note as one drywall card', () => {
    const notes = 'Patch and texture 300 sqft of drywall. No new hang.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Drywall Patch and Texture',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            { id: 'framing', label: 'Framing', state: 'unsure', inputType: 'yes_no' },
            { id: 'electrical', label: 'Electrical', state: 'unsure', inputType: 'yes_no' },
            { id: 'hvac', label: 'HVAC', state: 'unsure', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'unsure', inputType: 'yes_no' },
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
          ],
        },
        scopePackages: [{ id: 'flooring' }],
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const items = repaired.scopeChecklist?.items || [];
    const measurements = normalizeScopeMeasurements(repaired.scopeMeasurements);
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
    const rows = quickMeasurementRowsForInput(
      'drywall',
      'drywall',
      measurements,
      undefined,
      { scopeNotes: notes }
    );

    expect(notesDescribeDedicatedDrywallJob(notes)).toBe(false);
    expect(repaired.scopeChecklist?.templateKey).toBe('drywall');
    expect(repaired.whatAiDid).toEqual(['Detected drywall job.']);
    expect(getInitialRevealTagline(repaired)).toBe('Detected drywall job.');
    expect(items.map(item => item.id)).toEqual(['patch_repair']);
    expect(items[0]?.helperText).toBe('Patch and texture. No new hang.');
    expect(measurements.patchRepairSqft).toBe(300);
    expect(measurements.drywallSqft || null).toBeNull();
    expect(patchQuantity.quantity).toBe(300);
    expect(patchPrice.fill).toMatchObject({
      material: 255,
      labor: 375,
      total: 630,
    });
    expect(patchPrice.fill?.costBuckets?.map(bucket => bucket.label)).toEqual([
      'Material',
      'Labor',
    ]);
    expect(rows.flat().map(row => row.label)).toEqual(['Drywall patch / repair']);
    expect(
      wholeProjectGroupDisplayTotal({
        items,
        measurements,
        templateKey: 'drywall',
        notes,
      })
    ).toBe(630);
    expect(
      notesDescribeDedicatedDrywallJob(
        'Hang drywall 1,200 sqft material $1.50 per sqft labor $3 per sqft. Tape and finish 1,200 sqft labor $2.25 per sqft.'
      )
    ).toBe(false);
  });

  it('prices hang and tape from the rates written in the note', () => {
    const notes =
      'Hang drywall 1,200 sqft material $1.50 per sqft labor $3 per sqft. Tape and finish 1,200 sqft labor $2.25 per sqft.';
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
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'unsure', inputType: 'yes_no' },
          ],
        },
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const items = repaired.scopeChecklist?.items || [];
    const measurements = normalizeScopeMeasurements(repaired.scopeMeasurements);
    const hangQuantity = resolveChecklistItemQuantity('hang', measurements, {
      templateKey: 'drywall',
      notes,
    });
    const hangPrice = resolveScopeItemSuggestedPricing(
      'hang',
      measurements,
      'drywall',
      hangQuantity,
      null,
      null,
      notes
    );
    const finishQuantity = resolveChecklistItemQuantity('finish_tape', measurements, {
      templateKey: 'drywall',
      notes,
    });
    const finishPrice = resolveScopeItemSuggestedPricing(
      'finish_tape',
      measurements,
      'drywall',
      finishQuantity,
      null,
      null,
      notes
    );

    expect(notesDescribeDedicatedDrywallJob(notes)).toBe(false);
    expect(repaired.scopeChecklist?.templateKey).toBe('drywall');
    expect(getInitialRevealTagline(repaired)).toBe('Detected drywall job.');
    expect(items.map(item => item.id)).toEqual(['hang', 'finish_tape']);
    expect(measurements.drywallSqft).toBe(1200);
    expect(hangQuantity).toMatchObject({ quantity: 5400, unit: 'allowance' });
    expect(hangPrice.fill).toMatchObject({
      material: 1800,
      labor: 3600,
      total: 5400,
      rateSourceLabel: 'From notes',
    });
    expect(hangPrice.fill?.displayQuantityLine).toBe('1,200 sqft × $4.50/sqft');
    expect(finishQuantity).toMatchObject({ quantity: 2700, unit: 'allowance' });
    expect(finishPrice.fill).toMatchObject({
      material: 0,
      labor: 2700,
      total: 2700,
      rateSourceLabel: 'From notes',
    });
    expect(finishPrice.fill?.displayQuantityLine).toBe('1,200 sqft × $2.25/sqft');
    expect(
      wholeProjectGroupDisplayTotal({
        items,
        measurements,
        templateKey: 'drywall',
        notes,
      })
    ).toBe(8100);
    expect(repaired.stillNeededReview).toEqual([]);
    expect(repaired.needsReviewItems).toEqual([]);
    expect(repaired.missingInfo).toEqual([]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
  });

  it('reads sheetrock finish as one hang card and ignores no demo', () => {
    const notes = 'Sheetrock 900 sqft with tape, mud, and texture. No demo.';
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
            { id: 'framing', label: 'Framing', state: 'unsure', inputType: 'yes_no' },
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
          ],
        },
        stillNeededReview: ['Whether texture is included'],
        needsReviewItems: ['Whether texture is included'],
        missingInfo: ['Whether texture is included'],
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const items = repaired.scopeChecklist?.items || [];
    const measurements = normalizeScopeMeasurements(repaired.scopeMeasurements);
    const quantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
      notes,
    });
    const price = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'drywall',
      quantity,
      null,
      null,
      notes
    );

    expect(notesDescribeDedicatedDrywallJob(notes)).toBe(false);
    expect(repaired.scopeChecklist?.templateKey).toBe('drywall');
    expect(getInitialRevealTagline(repaired)).toBe('Detected drywall job.');
    expect(items.map(item => item.id)).toEqual(['drywall']);
    expect(measurements.drywallSqft).toBe(900);
    expect(quantity.quantity).toBe(900);
    expect(price.fill).toMatchObject({
      material: 765,
      labor: 1125,
      total: 1890,
    });
    expect(price.fill?.costBuckets?.map(bucket => bucket.label)).toEqual([
      'Material',
      'Labor',
    ]);
    expect(repaired.stillNeededReview).toEqual([]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    expect(
      wholeProjectGroupDisplayTotal({
        items,
        measurements,
        templateKey: 'drywall',
        notes,
      })
    ).toBe(1890);
  });

  it('keeps a mixed drywall and flooring note to the named lines', () => {
    const notes =
      'Hang and finish 1,200 sqft of drywall. Install 200 sqft of LVP flooring, material $4 per sqft labor $3 per sqft.';
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
            { id: 'framing', label: 'Framing', state: 'unsure', inputType: 'yes_no' },
            { id: 'electrical', label: 'Electrical', state: 'unsure', inputType: 'yes_no' },
            { id: 'hvac', label: 'HVAC', state: 'unsure', inputType: 'yes_no' },
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'included', inputType: 'yes_no' },
          ],
        },
        stillNeededReview: [
          'Whether drywall tape and finishing materials are included',
          'Whether the 1,200 square feet applies to both',
        ],
        whatAiDid: ['Detected existing home interior remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const items = repaired.scopeChecklist?.items || [];
    const measurements = normalizeScopeMeasurements(repaired.scopeMeasurements);
    const drywallQuantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'room_remodel',
      notes,
    });
    const drywallPrice = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'room_remodel',
      drywallQuantity,
      null,
      null,
      notes
    );
    const flooringQuantity = resolveChecklistItemQuantity('flooring', measurements, {
      templateKey: 'room_remodel',
      notes,
    });
    const flooringPrice = resolveScopeItemSuggestedPricing(
      'flooring',
      measurements,
      'room_remodel',
      flooringQuantity,
      null,
      null,
      notes
    );

    expect(notesDescribeDedicatedDrywallJob(notes)).toBe(false);
    expect(items.map(item => item.id)).toEqual(['drywall', 'flooring']);
    expect(measurements.drywallSqft).toBe(1200);
    expect(measurements.flooringSqft).toBe(200);
    expect(drywallQuantity.quantity).toBe(1200);
    expect(drywallPrice.fill).toMatchObject({
      material: 1020,
      labor: 1500,
      total: 2520,
    });
    expect(flooringPrice.fill).toMatchObject({
      material: 800,
      labor: 600,
      total: 1400,
      rateSourceLabel: 'From notes',
    });
    expect(repaired.stillNeededReview).toEqual([]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    expect(
      wholeProjectGroupDisplayTotal({
        items,
        measurements,
        templateKey: 'room_remodel',
        notes,
      })
    ).toBe(3920);
  });

  it('prices generic drywall and flooring as the named lines', () => {
    const notes = 'Drywall and flooring.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Mixed-scope remodel',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            { id: 'framing', label: 'Framing', state: 'unsure', inputType: 'yes_no' },
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'included', inputType: 'yes_no' },
          ],
        },
        stillNeededReview: ['Price needed for Drywall hang / finish'],
        whatAiDid: ['Detected mixed-scope remodel.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const items = repaired.scopeChecklist?.items || [];
    const measurements = normalizeScopeMeasurements({
      ...(repaired.scopeMeasurements || {}),
      drywallSqft: 300,
      flooringSqft: 200,
    });
    const drywallQuantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'room_remodel',
      notes,
    });
    const drywallPrice = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'room_remodel',
      drywallQuantity,
      null,
      null,
      notes
    );
    const rows = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      measurements,
      undefined,
      { scopeNotes: notes }
    );

    expect(repaired.scopeMode).toBe('dedicated');
    expect(items.map(item => item.id)).toEqual(['drywall', 'flooring']);
    expect(items.map(item => item.helperText)).toEqual([
      'Hang and finish.',
      'Install the flooring area named in the notes.',
    ]);
    expect(
      confirmScopeDrywallSqftLabel(notes, {
        installNamed: false,
        repairNamed: false,
      })
    ).toBe('Drywall hang / finish');
    expect(rows.flat().map(row => row.label)).toEqual([
      'Drywall hang / finish',
      'Flooring',
    ]);
    expect(rows.flat().find(row => row.key === 'flooringSqft')?.helperText).toBe(
      'Flooring area from the notes.'
    );
    expect(drywallPrice.fill).toMatchObject({
      material: 255,
      labor: 375,
      total: 630,
    });
    expect(drywallPrice.fill?.costBuckets?.map(bucket => bucket.label)).toEqual([
      'Material',
      'Labor',
    ]);
    expect(
      groupScopeChecklistItems(items, 'room_remodel', { notes }).map(
        group => group.title
      )
    ).toEqual(['Drywall hang / finish', 'Flooring']);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
  });

  it('drops questions the priced drywall note already answered', () => {
    const notes =
      'Hang drywall 1,200 sqft material $1.50 per sqft labor $3 per sqft. Tape and finish 1,200 sqft labor $2.25 per sqft.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: notes,
        scopeChecklist: { templateKey: 'room_remodel', items: [] },
        stillNeededReview: [
          'Whether drywall tape and finishing materials are included',
          'Whether the 1,200 square feet applies to both',
          'Drywall hang / finish',
          'One more question',
        ],
        needsReviewItems: ['Whether drywall tape and finishing materials are included'],
        missingInfo: ['Whether the 1,200 square feet applies to both'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(repaired.stillNeededReview).toEqual([]);
    expect(repaired.needsReviewItems).toEqual([]);
    expect(repaired.missingInfo).toEqual([]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
  });

  it('keeps hang and LVP on their own areas', () => {
    const notes = 'Hang 800 sqft of drywall and install 400 sqft of LVP.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Drywall and Flooring',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'included', inputType: 'yes_no' },
          ],
        },
        scopeMeasurements: {
          drywallSqft: 800,
          flooringSqft: 800,
        },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const items = repaired.scopeChecklist?.items || [];
    const measurements = normalizeScopeMeasurements(repaired.scopeMeasurements);
    const flooringQuantity = resolveChecklistItemQuantity('flooring', measurements, {
      templateKey: 'room_remodel',
      notes,
    });
    const flooringPrice = resolveScopeItemSuggestedPricing(
      'flooring',
      measurements,
      'room_remodel',
      flooringQuantity,
      null,
      null,
      notes
    );
    const rows = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      measurements,
      undefined,
      { scopeNotes: notes }
    );

    expect(measurements.drywallSqft).toBe(800);
    expect(measurements.flooringSqft).toBe(400);
    expect(measurements.flooringLvpSqft).toBe(400);
    expect(items.map(item => item.label)).toEqual([
      'Drywall hang / finish',
      'LVP',
    ]);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(row =>
        row.quantity ? `${row.name} · ${row.quantity}` : row.name
      )
    ).toEqual(['Drywall hang / finish · 800 sqft', 'LVP · 400 sqft']);
    expect(getInitialRevealChecklistScopePreview(repaired).every(row => row.amount === 0)).toBe(
      true
    );
    expect(
      groupScopeChecklistItems(items, 'room_remodel', { notes }).map(
        group => group.title
      )
    ).toEqual(['Drywall hang / finish', 'LVP']);
    expect(rows.flat().map(row => row.label)).toEqual([
      'Drywall hang / finish',
      'LVP',
    ]);
    expect(flooringPrice.fill).toMatchObject({
      material: 1400,
      labor: 1400,
      total: 2800,
    });
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
  });

  it('shows selected drywall wall and ceiling removal in measurements', () => {
    const notes = 'Hang and finish 1,200 sqft of drywall';
    const measurements = {
      scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
      drywallSqft: 1200,
      wallDemoSqft: 1200,
      drywallCeilingSqft: 1200,
    };
    expect(
      dedicatedDrywallConfirmScopeItems(notes, measurements).map(item => item.label)
    ).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
    expect(
      quickMeasurementRowsForInput('drywall', 'drywall', measurements, undefined, {
        scopeNotes: notes,
      })
        .flat()
        .map(field => field.label)
    ).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
    const normalized = normalizeScopeMeasurements(measurements);
    expect(
      resolveChecklistItemQuantity('drywall_wall_demo', normalized, {
        templateKey: 'drywall',
        notes,
      }).quantity
    ).toBe(1200);
    expect(
      resolveChecklistItemQuantity('drywall_ceiling_demo', normalized, {
        templateKey: 'drywall',
        notes,
      }).quantity
    ).toBe(1200);
    expect(getScopeUnitDefinition('drywall_wall_demo', 'drywall').preferredUnits).toContain(
      'sqft'
    );
    expect(
      getScopeUnitDefinition('drywall_ceiling_demo', 'drywall').preferredUnits
    ).toContain('sqft');
    const items = dedicatedDrywallConfirmScopeItems(notes, measurements);
    expect(
      groupScopeChecklistItems(items, 'drywall', { notes }).map(group => group.title)
    ).toEqual(['Drywall']);
    const rows = quickMeasurementRowsForInput(
      'drywall',
      'drywall',
      measurements,
      undefined,
      { scopeNotes: notes }
    );
    const fields = resolveQuickMeasurementFields({
      rows,
      measurements,
      noteValues: { drywallSqft: '1200' },
      noteBackedKeys: ['drywallSqft'],
      includedScopeKeys: items.map(item => item.id),
      templateKey: 'drywall',
      notes,
    });
    const grouped = groupQuickMeasurementFields(fields);
    expect(grouped.confirmed.map(field => field.key)).toEqual([
      'wallDemoSqft',
      'drywallCeilingSqft',
      'drywallSqft',
    ]);
    expect(grouped.more).toEqual([]);
    for (const field of grouped.confirmed) {
      expect(quickMeasurementPlanningEstimateNote(field)).toBeNull();
    }
  });

  it('hangs and finishes living-room drywall and leaves denied insulation and paint off', () => {
    const notes =
      "Hang and finish the drywall in the living room, about 600 sqft of walls. No new insulation. Don't paint.";
    expect(notesDescribeDedicatedDrywallJob(notes)).toBe(true);
    expect(notesRequireInteriorPaintMeasurements(notes)).toBe(false);
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: notes,
        scopeChecklist: { templateKey: 'room_remodel', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'drywall',
    ]);
    expect(repaired.scopeMeasurements?.drywallSqft).toBe(600);
    expect(repaired.scopeMeasurements?.wallPaintSqft).toBeUndefined();
    expect(repaired.scopeMeasurements?.exteriorWallInsulationSqft).toBeUndefined();
    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    const quantity = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
      notes,
    });
    const price = resolveScopeItemSuggestedPricing(
      'drywall',
      repaired.scopeMeasurements || {},
      'drywall',
      quantity,
      null,
      null,
      notes
    );
    expect(quantity.quantity).toBe(600);
    expect(price.fill).toMatchObject({
      material: 510,
      labor: 750,
      total: 1260,
    });
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(row =>
        row.quantity ? `${row.name} · ${row.quantity}` : row.name
      )
    ).toEqual(['Drywall hang / finish · 600 sqft']);
    expect(
      quickMeasurementRowsForInput('drywall', 'drywall', measurements, undefined, {
        scopeNotes: notes,
      })
        .flat()
        .map(field => field.label)
    ).toEqual(['Drywall hang / finish']);
    const mixedTitle = {
      ...repaired,
      projectTitle: 'Mixed-scope remodel',
      scopeSummary: 'Mixed-scope remodel',
      whatAiDid: [
        'Mixed-scope remodel: Drywall, Painting. Flagged customer phone, customer name, project address, start date, payment terms, permit responsibility as missing.',
      ],
      classification: {
        scopeMode: 'mixed' as const,
        scopeSummary: 'Mixed-scope remodel',
        detectedTrades: ['drywall', 'painting', 'insulation'],
      },
      scopeTradeLabels: ['Drywall', 'Painting', 'Insulation'],
    };
    expect(repaired.projectTitle).toBe('Drywall');
    expect(getInitialRevealDisplayTitle(mixedTitle)).toBe('Drywall');
    expect(getInitialRevealUnderstoodBullets(mixedTitle).join(' ')).not.toMatch(
      /Mixed-scope|Painting/
    );
    expect(
      quickMeasurementRowsForInput(
        'drywall',
        'drywall',
        {
          ...measurements,
          scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
          wallDemoSqft: 600,
        },
        undefined,
        { scopeNotes: notes }
      )
        .flat()
        .map(field => field.label)
    ).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
  });

  it('keeps ceiling removal under walls and off the extra demo line', () => {
    const notes =
      "Hang and finish the drywall in the living room, about 600 sqft of walls. No new insulation. Don't paint.";
    const field = (
      key: QuickMeasurementFieldResult['key'],
      state: QuickMeasurementFieldResult['state'],
      filled: boolean
    ): QuickMeasurementFieldResult => ({
      key,
      state,
      filled,
      showConfirmedBadge: false,
      fromNotes: filled,
      relevant: true,
      blockingPrice: true,
      estimate: null,
      sourceLabel: null,
    });
    const ordered = placeDrywallCeilingUnderWallRemoval({
      fromPlan: [],
      suggestions: [],
      needsConfirmation: [
        field('drywallCeilingSqft', 'needs_confirmation', true),
      ],
      confirmed: [
        field('wallDemoSqft', 'confirmed', true),
        field('drywallSqft', 'confirmed', true),
      ],
      more: [],
    });
    expect(ordered.needsConfirmation).toEqual([]);
    expect(ordered.confirmed.map(result => result.key)).toEqual([
      'wallDemoSqft',
      'drywallCeilingSqft',
      'drywallSqft',
    ]);
    expect(
      countVisiblePricingCards(
        [
          {
            items: [
              { id: 'drywall_wall_demo' },
              { id: 'drywall_ceiling_demo' },
              { id: 'drywall' },
            ],
          },
        ],
        ['drywall_wall_demo', 'drywall']
      )
    ).toBe(1);

    const surfaceItems = dedicatedDrywallConfirmScopeItems(notes, {
      scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
    });
    const confirmed = [
      ...surfaceItems,
      {
        id: 'demo',
        inputType: 'yes_no' as const,
        label: 'Drywall demo / removal',
        state: 'included' as const,
        noteBacked: true,
      },
    ];
    const draft = {
      originalNotes: notes,
      projectType: 'drywall',
      projectTitle: 'Living Room Drywall Hang and Finish',
      scopeAssumptionsConfirmed: true,
      whatAiDid: [
        'Mixed-scope remodel: Drywall, Painting. Flagged customer phone, customer name, project address, start date, payment terms, permit responsibility as missing.',
      ],
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: confirmed,
      },
      confirmedAssumptions: confirmed,
      scopeMeasurements: {
        drywallSqft: 600,
        wallDemoSqft: 600,
        drywallCeilingSqft: 800,
        scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
        quickMeasurementUserOverrides: { drywallCeilingSqft: true },
        confirmedScopePricingSnapshot: {
          total: 3360,
          material: 860,
          labor: 2500,
          allowance: 0,
          lines: [
            {
              itemId: 'drywall_wall_demo',
              label: 'Remove drywall walls',
              total: 900,
              material: 150,
              labor: 750,
              allowance: 0,
            },
            {
              itemId: 'drywall_ceiling_demo',
              label: 'Remove drywall ceilings',
              total: 1200,
              material: 200,
              labor: 1000,
              allowance: 0,
            },
            {
              itemId: 'drywall',
              label: 'Drywall hang / finish',
              total: 1260,
              material: 510,
              labor: 750,
              allowance: 0,
            },
          ],
        },
      },
      scopePackages: [
        {
          name: 'Drywall demo / removal',
          checklistItemId: 'demo',
          price: 1260,
          status: 'user_provided' as const,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
        {
          name: 'Drywall hang / finish',
          checklistItemId: 'drywall',
          price: 1260,
          status: 'user_provided' as const,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
        {
          name: 'Remove drywall walls',
          checklistItemId: 'drywall_wall_demo',
          price: 900,
          status: 'user_provided' as const,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
        {
          name: 'Remove drywall ceilings',
          checklistItemId: 'drywall_ceiling_demo',
          price: 1200,
          status: 'user_provided' as const,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
      ],
    };
    const applied = withReconciledScopePackages(
      draft as Parameters<typeof withReconciledScopePackages>[0],
      confirmed
    );
    const packages = reviewScopePackages(
      applied as Parameters<typeof reviewScopePackages>[0]
    );
    expect(packages.map(pkg => pkg.name)).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
    expect(
      getScopePackagesForReview(
        applied as Parameters<typeof getScopePackagesForReview>[0]
      ).map(pkg => pkg.name)
    ).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
    const ceiling = packages.find(pkg => pkg.checklistItemId === 'drywall_ceiling_demo');
    expect(
      formatScopeQuantity(
        ceiling as Parameters<typeof formatScopeQuantity>[0],
        applied as Parameters<typeof formatScopeQuantity>[1]
      )
    ).toBe('800 sqft');
    expect(packages.reduce((sum, pkg) => sum + (Number(pkg.price) || 0), 0)).toBe(3360);
    expect(getCompactProjectSummary(applied)).toBe('Drywall · 3 scope items');
    expect(getInitialRevealDisplayTitle(applied)).toBe('Drywall');
    expect(
      getInitialRevealChecklistScopePreview(applied).map(row => row.name)
    ).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
    expect(getInitialRevealUnderstoodBullets(applied, 2).join(' ')).not.toMatch(
      /Mixed-scope|Painting|Flagged/
    );
    expect(
      confirmedAppliedRevealLines(applied)?.map(row =>
        row.quantity ? `${row.name} · ${row.quantity}` : `${row.name} · ${row.amount}`
      )
    ).toEqual([
      'Remove drywall walls · 600 sqft',
      'Remove drywall ceilings · 800 sqft',
      'Drywall hang / finish · 600 sqft',
    ]);
  });

  it('keeps hang on the scope found list after wall and ceiling removal are selected', () => {
    const notes =
      "Hang and finish the drywall in the living room, about 600 sqft of walls. No new insulation. Don't paint.";
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: notes,
        scopeChecklist: { templateKey: 'room_remodel', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const draft = {
      ...repaired,
      scopeMeasurements: {
        ...(repaired.scopeMeasurements || {}),
        scopeFoundClarificationId: 'drywall_demo' as const,
        scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
        wallDemoSqft: 600,
      },
    };
    const preview = getInitialRevealChecklistScopePreview(draft);
    const added = scopeFoundRevealLines(
      notes,
      'drywall_demo',
      null,
      draft.scopeMeasurements?.scopeFoundPieces,
      draft.scopeMeasurements
    );
    const addedNames = new Set(added.map(row => row.name.trim().toLowerCase()));
    const merged = [
      ...added,
      ...preview.filter(row => !addedNames.has(row.name.trim().toLowerCase())),
    ].map(row => (row.quantity ? `${row.name} · ${row.quantity}` : row.name));
    expect(merged).toEqual([
      'Remove drywall walls · 600 sqft',
      'Remove drywall ceilings',
      'Drywall hang / finish · 600 sqft',
    ]);
  });

  it('keeps a 500 sqft ceiling on the estimate and step 3', () => {
    const notes =
      "Hang and finish the drywall in the living room, about 600 sqft of walls. No new insulation. Don't paint.";
    const accepted = (
      total: number,
      material: number,
      labor: number
    ) => ({
      selectionStatus: 'accepted' as const,
      totalAmount: total,
      materialAmount: material,
      laborAmount: labor,
    });
    const split = (material: number, labor: number) => ({
      material: {
        quantity: material,
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
      labor: {
        quantity: labor,
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
    });
    const wallSplit = split(150, 750);
    const ceilingSplit = split(125, 625);
    const hangSplit = split(510, 750);
    const surfaceItems = dedicatedDrywallConfirmScopeItems(notes, {
      scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
    });
    const confirmed = [
      ...surfaceItems,
      {
        id: 'demo',
        inputType: 'yes_no' as const,
        label: 'Drywall demo / removal',
        state: 'included' as const,
        noteBacked: true,
      },
    ];
    const draft = {
      originalNotes: notes,
      projectType: 'drywall',
      projectTitle: 'Living Room Drywall Hang and Finish',
      scopeAssumptionsConfirmed: true,
      whatAiDid: [
        'Mixed-scope remodel: Drywall, Painting. Flagged customer phone, customer name, project address, start date, payment terms, permit responsibility as missing.',
      ],
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: confirmed,
      },
      confirmedAssumptions: confirmed,
      scopeMeasurements: {
        drywallSqft: 600,
        wallDemoSqft: 600,
        drywallCeilingSqft: 500,
        scopeFoundPieces: ['drywall_walls', 'drywall_ceilings'],
        quickMeasurementUserOverrides: { drywallCeilingSqft: true },
        itemQuantities: {
          drywall_wall_demo__material: wallSplit.material,
          drywall_wall_demo__labor: wallSplit.labor,
          drywall_ceiling_demo__material: ceilingSplit.material,
          drywall_ceiling_demo__labor: ceilingSplit.labor,
          drywall__material: hangSplit.material,
          drywall__labor: hangSplit.labor,
        },
        pricingAcceptance: {
          drywall_wall_demo: accepted(900, 150, 750),
          drywall_ceiling_demo: accepted(750, 125, 625),
          drywall: accepted(1260, 510, 750),
        },
        confirmedScopePricingSnapshot: {
          total: 2910,
          material: 785,
          labor: 2125,
          allowance: 0,
          lines: [
            {
              itemId: 'drywall_wall_demo',
              label: 'Remove drywall walls',
              total: 900,
              material: 150,
              labor: 750,
              allowance: 0,
            },
            {
              itemId: 'drywall_ceiling_demo',
              label: 'Remove drywall ceilings',
              total: 750,
              material: 125,
              labor: 625,
              allowance: 0,
            },
            {
              itemId: 'drywall',
              label: 'Drywall hang / finish',
              total: 1260,
              material: 510,
              labor: 750,
              allowance: 0,
            },
          ],
        },
      },
      scopePackages: [
        {
          name: 'Drywall demo / removal',
          checklistItemId: 'demo',
          price: 1260,
          materialPrice: 510,
          laborPrice: 750,
          status: 'user_provided' as const,
          priceProvidedByUser: true,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
        {
          name: 'Drywall hang / finish',
          checklistItemId: 'drywall',
          price: 1260,
          materialPrice: 510,
          laborPrice: 750,
          status: 'user_provided' as const,
          priceProvidedByUser: true,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
        {
          name: 'Remove drywall ceilings',
          checklistItemId: 'drywall_ceiling_demo',
          price: 750,
          materialPrice: 125,
          laborPrice: 625,
          status: 'user_provided' as const,
          priceProvidedByUser: true,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
        {
          name: 'Remove drywall walls',
          checklistItemId: 'drywall_wall_demo',
          price: 900,
          materialPrice: 150,
          laborPrice: 750,
          status: 'user_provided' as const,
          priceProvidedByUser: true,
          scopeQuantities: [{ quantity: 600, unit: 'sqft' }],
        },
      ],
    };
    const applied = withReconciledScopePackages(
      draft as Parameters<typeof withReconciledScopePackages>[0],
      confirmed
    );
    const packages = reviewScopePackages(
      applied as Parameters<typeof reviewScopePackages>[0]
    );
    expect(packages.map(pkg => pkg.name)).toEqual([
      'Remove drywall walls',
      'Remove drywall ceilings',
      'Drywall hang / finish',
    ]);
    const ceiling = packages.find(pkg => pkg.checklistItemId === 'drywall_ceiling_demo');
    expect(
      formatScopeQuantity(
        ceiling as Parameters<typeof formatScopeQuantity>[0],
        applied as Parameters<typeof formatScopeQuantity>[1]
      )
    ).toBe('500 sqft');
    expect(packages.map(pkg => Number(pkg.price) || 0)).toEqual([900, 750, 1260]);
    expect(getCompactProjectSummary(applied)).toBe('Drywall · 3 scope items');
    expect(getInitialRevealDisplayTitle(applied)).toBe('Drywall');
    expect(getInitialRevealTagline(applied)).toBe('Detected drywall job.');
    expect(getInitialRevealUnderstoodBullets(applied, 2).join(' ')).not.toMatch(
      /Mixed-scope|Painting|Flagged/
    );
    expect(
      confirmedAppliedRevealLines(applied)?.map(row =>
        row.quantity
          ? `${row.name} · ${row.quantity} · ${row.amount}`
          : `${row.name} · ${row.amount}`
      )
    ).toEqual([
      'Remove drywall walls · 600 sqft · 900',
      'Remove drywall ceilings · 500 sqft · 750',
      'Drywall hang / finish · 600 sqft · 1260',
    ]);
    const step3 = computeStep3ReviewTotals(applied, 15);
    expect(step3.calculatedTotal).toBe(2910);
    expect(step3.material).toBe(785);
    expect(step3.labor).toBe(2125);
    expect(step3.estimatedBidWithMarkup).toBe(3346.5);
    expect(step3.scopeItemCount).toBe(3);
    expect(getInitialRevealTotals(applied, 15)).toMatchObject({
      material: 785,
      labor: 2125,
      heroTotal: 3346.5,
      scopeItemCount: 3,
    });
  });

  it('keeps hang / finish on the attic insulation measurement', () => {
    const notes =
      'Install R-38 insulation in 1,000 sqft of attic and hang 800 sqft of drywall.';
    expect(
      confirmScopeDrywallSqftLabel(notes, {
        installNamed: true,
        repairNamed: false,
      })
    ).toBe('Drywall hang / finish');
  });
});
