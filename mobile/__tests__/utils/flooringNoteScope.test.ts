import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import {
  groupScopeChecklistItems,
  hydrateScopeChecklistFromNotes,
} from '@/utils/estimateScopeChecklistUi';
import {
  inferExistingFlooringFromNotes,
  syncFlooringQmScopeItems,
} from '@/utils/qmScopePanels/flooringRemodel';
import { buildConfirmScopeDisplayItems } from '@/utils/scopePackagesForReview';
import { flooringQmPanel } from '@/utils/qmScopePanels/flooringRemodel';
import {
  initialScopeMeasurementInputExtended,
  prepareScopeMeasurementsInputForUi,
} from '@/utils/scopeItemQuantities';
import { getInitialRevealChecklistScopePreview, getInitialRevealConfirmItems, getInitialRevealTagline } from '@/utils/estimateInitialRevealUi';
import {
  dedicatedFlooringProducts,
  dedicatedFlooringRemovedTypes,
  filterDedicatedFlooringConfirmItems,
  notesDescribeDedicatedFlooringJob,
  notesRequestFloorPrep,
} from '@/utils/flooringNoteScope';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

const NOTES =
  'Remove the existing floor and install 700 sqft of LVP, including floor prep.';

describe('dedicated flooring note', () => {
  it('keeps demo, LVP, and floor prep, and prices each at 700 sqft', () => {
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'LVP Flooring Replacement',
        estimateTier: 'room_remodel',
        originalNotes: NOTES,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'flooring',
          items: [
            { id: 'floor_demo', label: 'Flooring demo / removal', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'New flooring', state: 'included', inputType: 'yes_no' },
            { id: 'tile_flooring', label: 'Tile', state: 'included', inputType: 'yes_no' },
            { id: 'floor_prep', label: 'Subfloor / floor prep', state: 'included', inputType: 'yes_no' },
            { id: 'flooring_lvp', label: 'LVP', state: 'included', inputType: 'yes_no' },
            { id: 'prep', label: 'Prep & Masking', state: 'included', inputType: 'yes_no' },
          ],
        },
        stillNeededReview: [
          'Price needed for Flooring removal / demolition',
          'Price needed for LVP',
          'Price needed for Subfloor / floor prep',
        ],
        scopePackages: [],
        whatAiDid: ['Detected the flooring job.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      NOTES
    );

    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'floor_demo',
      'flooring_lvp',
      'floor_prep',
    ]);
    expect(repaired.stillNeededReview).toEqual([]);
    expect(getInitialRevealTagline(repaired)).toBe('Detected flooring job.');
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(
        row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`
      )
    ).toEqual([
      'Flooring demo / removal · 700 sqft',
      'LVP · 700 sqft',
      'Subfloor / floor prep · 700 sqft',
    ]);

    const measurements = normalizeScopeMeasurements(repaired.scopeMeasurements || {});
    const price = (
      itemId: string
    ) => {
      const quantity = resolveChecklistItemQuantity(itemId, measurements, {
        templateKey: 'flooring',
        notes: NOTES,
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        repaired.scopeMeasurements || {},
        'flooring',
        quantity,
        null,
        null,
        NOTES
      ).fill;
    };

    expect(price('floor_demo')).toMatchObject({
      material: 350,
      labor: 3500,
      total: 3850,
    });
    expect(price('flooring_lvp')).toMatchObject({
      material: 2450,
      labor: 2450,
      total: 4900,
    });
    expect(price('floor_prep')).toMatchObject({
      material: 525,
      labor: 1225,
      total: 1750,
    });
  });

  it('keeps a stated LVP material and labor rate and leaves demo off', () => {
    const rated =
      'Install 400 sqft of LVP, material $4 per sqft labor $3 per sqft. No demo.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: rated,
        scopeChecklist: { templateKey: 'flooring', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      rated
    );
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'flooring_lvp',
    ]);
    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    const quantity = resolveChecklistItemQuantity('flooring_lvp', measurements, {
      templateKey: 'flooring',
      notes: rated,
    });
    expect(
      resolveScopeItemSuggestedPricing(
        'flooring_lvp',
        repaired.scopeMeasurements || {},
        'flooring',
        quantity,
        null,
        null,
        rated
      ).fill
    ).toMatchObject({
      material: 1600,
      labor: 1200,
      total: 2800,
      rateSourceLabel: 'From notes',
    });

    const input = initialScopeMeasurementInputExtended(repaired, rated);
    const prepared = prepareScopeMeasurementsInputForUi(input, {
      notes: rated,
      templateKey: 'flooring',
      projectType: repaired.projectType,
    });
    const hydrated = flooringQmPanel.hydrateMeasurements({
      templateKey: 'flooring',
      wholeHomeLayout: false,
      notes: rated,
      measurements: prepared as Record<string, unknown>,
      checklistItems: repaired.scopeChecklist?.items || [],
    });
    const checklist = hydrateScopeChecklistFromNotes(
      repaired.scopeChecklist?.items || [],
      'flooring',
      rated,
      {
        itemQuantities: repaired.scopeMeasurements?.itemQuantities,
      } as Parameters<typeof hydrateScopeChecklistFromNotes>[3],
      'flooring'
    );
    expect(checklist.map(item => `${item.id}:${item.state}`)).toEqual([
      'flooring_lvp:included',
    ]);
    const synced = syncFlooringQmScopeItems(
      checklist,
      hydrated as Record<string, unknown>
    );
    const display = buildConfirmScopeDisplayItems(
      synced,
      hydrated as Record<string, unknown>,
      'flooring',
      rated
    );
    expect(
      display
        .filter(item => item.state !== 'excluded')
        .map(item => `${item.id}:${item.state}:${item.label}`)
    ).toEqual(['flooring_lvp:included:LVP']);
    const grouped = groupScopeChecklistItems(
      [
        ...display,
        {
          id: 'flooring',
          inputType: 'yes_no',
          label: 'New flooring',
          helperText: '',
          category: 'flooring',
          state: 'included',
        },
        {
          id: 'demo',
          inputType: 'yes_no',
          label: 'Demo',
          helperText: '',
          category: 'demo',
          state: 'included',
        },
      ],
      'flooring',
      { notes: rated, projectType: 'flooring' }
    );
    expect(grouped.flatMap(group => group.items).map(item => item.id)).toEqual([
      'flooring_lvp',
    ]);
  });

  it('selects LVP at 700 sqft on the confirm-scope install card', () => {
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: NOTES,
        scopeChecklist: { templateKey: 'flooring', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      NOTES
    );
    const input = initialScopeMeasurementInputExtended(repaired, NOTES);
    const prepared = prepareScopeMeasurementsInputForUi(input, {
      notes: NOTES,
      templateKey: 'flooring',
      projectType: repaired.projectType,
    });
    const hydrated = flooringQmPanel.hydrateMeasurements({
      templateKey: 'flooring',
      wholeHomeLayout: false,
      notes: NOTES,
      measurements: prepared as Record<string, unknown>,
      checklistItems: repaired.scopeChecklist?.items || [],
    });
    expect(input.flooringProductScope).toEqual(['lvp']);
    expect(prepared.flooringProductScope).toEqual(['lvp']);
    expect(String(prepared.flooringLvpSqft)).toBe('700');
    expect(hydrated.flooringProductScope).toEqual(['lvp']);
    expect(String(hydrated.flooringLvpSqft)).toBe('700');
    expect(hydrated.floorPrepByProduct).toMatchObject({
      lvp: { sqft: 700 },
    });

    const checklist = hydrateScopeChecklistFromNotes(
      repaired.scopeChecklist?.items || [],
      'flooring',
      NOTES,
      undefined,
      'flooring'
    );
    const synced = syncFlooringQmScopeItems(
      checklist,
      hydrated as Record<string, unknown>
    );
    const display = buildConfirmScopeDisplayItems(
      synced,
      hydrated as Record<string, unknown>,
      'flooring',
      NOTES
    );
    const grouped = groupScopeChecklistItems(display, 'flooring', {
      notes: NOTES,
      projectType: 'flooring',
    });
    expect(
      display
        .filter(item => item.state !== 'excluded')
        .map(item => `${item.id}:${item.state}`)
    ).toEqual([
      'floor_demo:included',
      'flooring_lvp:included',
      'floor_prep:included',
    ]);
    expect(grouped.flatMap(group => group.items).map(item => item.id)).toEqual([
      'floor_demo',
      'flooring_lvp',
      'floor_prep',
    ]);
  });

  it('tears out carpet and installs laminate without floor prep', () => {
    const note = 'Tear out 500 sqft of carpet and install laminate.';
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: note,
        scopeChecklist: { templateKey: 'flooring', items: [] },
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      note
    );
    const input = initialScopeMeasurementInputExtended(repaired, note);
    const prepared = prepareScopeMeasurementsInputForUi(input, {
      notes: note,
      templateKey: 'flooring',
      projectType: repaired.projectType,
    });
    const hydrated = flooringQmPanel.hydrateMeasurements({
      templateKey: 'flooring',
      wholeHomeLayout: false,
      notes: note,
      measurements: prepared as Record<string, unknown>,
      checklistItems: repaired.scopeChecklist?.items || [],
    });
    const checklist = hydrateScopeChecklistFromNotes(
      repaired.scopeChecklist?.items || [],
      'flooring',
      note,
      {
        itemQuantities: repaired.scopeMeasurements?.itemQuantities,
      } as Parameters<typeof hydrateScopeChecklistFromNotes>[3],
      'flooring'
    );
    const display = buildConfirmScopeDisplayItems(
      syncFlooringQmScopeItems(checklist, hydrated as Record<string, unknown>),
      hydrated as Record<string, unknown>,
      'flooring',
      note
    );
    const grouped = groupScopeChecklistItems(display, 'flooring', {
      notes: note,
      projectType: 'flooring',
    });
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'floor_demo',
      'flooring_laminate',
    ]);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(
        row => `${row.name}${row.quantity ? ` · ${row.quantity}` : ''}`
      )
    ).toEqual([
      'Flooring demo / removal · 500 sqft',
      'Laminate · 500 sqft',
    ]);
    expect(grouped.flatMap(group => group.items).map(item => item.id)).toEqual([
      'floor_demo',
      'flooring_laminate',
    ]);
    expect(dedicatedFlooringRemovedTypes(note)).toEqual(['carpet']);
    const instructed = `${note}\u00a0Carpet should be the existing floor, laminate the new one, and floor prep should stay off.`;
    expect(dedicatedFlooringRemovedTypes(instructed)).toEqual(['carpet']);
    expect(dedicatedFlooringProducts(instructed).map(product => product.id)).toEqual([
      'flooring_laminate',
    ]);
    expect(
      notesRequestFloorPrep(
        `${note} Carpet should be the existing floor, laminate the new one, and floor prep should stay off.`
      )
    ).toBe(false);
    expect(
      dedicatedFlooringRemovedTypes(
        `Install 500 sqft of laminate.\n${note}`
      )
    ).toEqual(['carpet']);
    expect(inferExistingFlooringFromNotes(note).flooringExistingTypes).toEqual([
      'carpet',
    ]);
    expect(
      filterDedicatedFlooringConfirmItems(
        [
          { id: 'floor_demo' },
          { id: 'flooring_laminate' },
          { id: 'flooring_carpet' },
          { id: 'floor_prep' },
        ],
        `${note}\nSubfloor / floor prep`
      ).map(item => item.id)
    ).toEqual(['floor_demo', 'flooring_laminate']);
    expect(hydrated.flooringExistingTypes).toEqual(['carpet']);
    expect(hydrated.flooringProductScope).toEqual(['laminate']);
    expect(String(hydrated.flooringLaminateSqft)).toBe('500');
    expect(String(hydrated.floorDemoSqft)).toBe('500');
    expect(hydrated.floorPrepByProduct ?? null).toBeNull();
    const demoQuantity = resolveChecklistItemQuantity(
      'floor_demo',
      normalizeScopeMeasurements(repaired.scopeMeasurements || {}),
      { templateKey: 'flooring', notes: note }
    );
    expect(
      resolveScopeItemSuggestedPricing(
        'floor_demo',
        repaired.scopeMeasurements || {},
        'flooring',
        demoQuantity,
        null,
        null,
        note
      ).fill
    ).toMatchObject({
      material: 175,
      labor: 700,
      total: 875,
    });
  });

  it('prices an LVP install when the note only excludes framing', () => {
    const notes = 'No structural framing. Install 600 sqft of LVP.';
    expect(notesDescribeDedicatedFlooringJob(notes)).toBe(true);
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'LVP Flooring Installation',
        originalNotes: notes,
        scopeChecklist: {
          templateKey: 'flooring',
          items: [
            { id: 'framing', label: 'Framing', state: 'included', inputType: 'yes_no' },
            { id: 'flooring', label: 'Flooring', state: 'included', inputType: 'yes_no' },
          ],
        },
        scopeMeasurements: { wallFramingSqft: 800, flooringSqft: 800 },
        stillNeededReview: ['Price needed for LVP material and installation labor'],
        scopePackages: [],
        whatAiDid: ['Detected flooring job.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(repaired.requiresScopeConfirmation).toBe(true);
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'flooring_lvp',
    ]);
    expect(repaired.scopeMeasurements?.wallFramingSqft).toBeUndefined();
    expect(repaired.scopeMeasurements?.flooringLvpSqft).toBe(600);
    expect(repaired.scopeMeasurements?.floorAreaSqft).toBeUndefined();
    expect(parseScopeMeasurementsFromNotes(notes).floorAreaSqft).toBeUndefined();
    expect(repaired.stillNeededReview).toEqual([]);
    expect(
      groupScopeChecklistItems(repaired.scopeChecklist?.items || [], 'flooring', {
        notes,
      }).map(group => group.title)
    ).toEqual(['LVP']);
    expect(
      quickMeasurementRowsForInput('room_remodel', 'flooring', {}, null, {
        scopeNotes: notes,
      })
        .flat()
        .map(field => field.label)
    ).toEqual(['LVP']);
    const measurements = normalizeScopeMeasurements(
      repaired.scopeMeasurements || {}
    );
    const quantity = resolveChecklistItemQuantity('flooring_lvp', measurements, {
      templateKey: 'flooring',
      notes,
    });
    expect(
      resolveScopeItemSuggestedPricing(
        'flooring_lvp',
        repaired.scopeMeasurements || {},
        'flooring',
        quantity,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 2100,
      labor: 2100,
      total: 4200,
    });
  });

  it('keeps contractor-selected flooring products when the note does not name them', () => {
    const notes = 'Detected flooring job.';
    const items = [
      { id: 'flooring', state: 'included' as const },
      { id: 'flooring_carpet', state: 'included' as const },
      { id: 'tile_flooring', state: 'included' as const },
      { id: 'flooring_laminate', state: 'included' as const },
    ];
    expect(
      filterDedicatedFlooringConfirmItems(items, notes).map(item => item.id)
    ).toEqual(['flooring']);
    expect(
      filterDedicatedFlooringConfirmItems(items, notes, [
        'flooring_carpet',
        'tile_flooring',
      ]).map(item => item.id)
    ).toEqual(['flooring', 'flooring_carpet', 'tile_flooring']);
    const grouped = groupScopeChecklistItems(
      items.map(item => ({
        ...item,
        inputType: 'yes_no' as const,
        label: item.id,
        helperText: '',
        category: 'flooring',
      })),
      'flooring',
      {
        notes,
        retainFlooringItemIds: ['flooring_carpet', 'tile_flooring'],
      }
    );
    expect(grouped.flatMap(group => group.items).map(item => item.id)).toEqual([
      'flooring',
      'flooring_carpet',
      'tile_flooring',
    ]);
  });

  it('stays off a mixed wall-framing and LVP note', () => {
    expect(
      notesDescribeDedicatedFlooringJob(
        'Frame 400 sqft of walls and install 180 sqft of LVP.'
      )
    ).toBe(false);
  });

  it('stays off kitchen and drywall notes', () => {
    expect(
      notesDescribeDedicatedFlooringJob(
        'Hang and finish 1,200 sqft of drywall. Install 200 sqft of LVP flooring.'
      )
    ).toBe(false);
    expect(
      notesDescribeDedicatedFlooringJob(
        'Kitchen reno. Cabs 20 LF, tops 48 sqft, splash 35 sqft, LVP 160 sqft.'
      )
    ).toBe(false);
  });
});
