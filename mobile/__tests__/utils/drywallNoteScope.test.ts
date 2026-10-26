import { wholeProjectGroupDisplayTotal } from '@/utils/benchmarkReasonablenessContext';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  checklistDisplayHelper,
  groupScopeChecklistItems,
} from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
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
