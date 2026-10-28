import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { confirmScopeDrywallSqftLabel } from '@/utils/drywallNoteScope';
import {
  bucketWholeProjectScopeGroups,
  checklistDisplayLabel,
  groupScopeChecklistItems,
  hydrateScopeChecklistFromNotes,
  readerConfirmScopeItems,
} from '@/utils/estimateScopeChecklistUi';
import { getMeasurementRelevance } from '@/utils/getMeasurementRelevance';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealTagline,
} from '@/utils/estimateInitialRevealUi';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { resolveEffectiveQuickMeasurementTemplateKey } from '@/utils/scopeQuickMeasurements';
import {
  applyNoteClauseReads,
  notesDescribeMixedProjectScope,
  noteUsesSeparateJobReader,
  readNoteWork,
} from '@/utils/noteClauseReader';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';

const ATTIC =
  'Install R-38 insulation in 1,000 sqft of attic and hang 800 sqft of drywall.';
const PATIO = 'Pour a 400 sqft concrete patio and install 600 sqft of sod.';
const NEGATION = 'No structural framing. Install 600 sqft of LVP.';
const TAUGHT =
  'Drywall and flooring Hang 800 sqft of drywall and install 400 sqft of LVP.';

function draftFor(notes: string) {
  return repairDraftRatePricingFromNotes(
    {
      projectType: 'other',
      projectTitle: 'Scope',
      estimateTier: 'room_remodel',
      originalNotes: notes,
      scopeMode: 'mixed',
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          {
            id: 'framing',
            label: 'Framing',
            state: 'included',
            inputType: 'yes_no',
          },
          {
            id: 'flooring',
            label: 'Flooring',
            state: 'included',
            inputType: 'yes_no',
          },
        ],
      },
      scopeMeasurements: {
        flooringSqft: 800,
        wallFramingSqft: 800,
      },
      scopePackages: [],
      whatAiDid: ['Detected a project.'],
    } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
    notes
  );
}

describe('note clause reader', () => {
  it('keeps a service call note with build and repair work in mixed scope', () => {
    const notes =
      'Replace carpet with 900 sqft LVP. Reroof 26 squares of architectural shingles. Paint walls, 2,000 sqft. Replace the stucco, 1,800 sqft. HVAC service call to diagnose the furnace. Patch and texture 300 sqft of drywall. No new hang. Build a 2,600 sqft single-family home. 500 sqft bedroom addition with a tie-in roof.';
    expect(notesDescribeMixedProjectScope(notes)).toBe(true);
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: 'hvac',
        projectType: 'hvac',
        notes,
      })
    ).toBe('room_remodel');

    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'hvac',
        projectTitle: 'HVAC service call',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'dedicated',
        classification: {
          scopeMode: 'dedicated',
          primaryTrade: 'hvac',
          detectedTrades: ['hvac'],
        },
        scopeChecklist: {
          templateKey: 'hvac',
          items: [
            { id: 'stucco', label: 'Stucco', state: 'included' },
            { id: 'flooring', label: 'LVP', state: 'included' },
            { id: 'interior_paint', label: 'Interior painting', state: 'included' },
            { id: 'patch_repair', label: 'Drywall repair', state: 'included' },
          ],
        },
        scopeMeasurements: {},
        scopePackages: [],
        whatAiDid: [],
      } as never,
      notes
    );

    expect(repaired.scopeMode).toBe('mixed');
    expect(repaired.scopeChecklist?.templateKey).toBe('room_remodel');
    expect(getInitialRevealDisplayTitle(repaired)).toBe('Mixed-scope estimate');
    expect(
      resolveEffectiveQuickMeasurementTemplateKey({
        templateKey: repaired.scopeChecklist?.templateKey,
        projectType: repaired.projectType,
        notes,
      })
    ).toBe('room_remodel');
    expect(repaired.scopeMeasurements?.stuccoGrossWallSqft).toBe(1800);
    expect(repaired.scopeMeasurements?.hvacServiceCallCount).toBe(1);
    expect(repaired.scopeMeasurements?.flooringLvpSqft).toBe(900);
    expect(repaired.scopeMeasurements?.flooringSqft).toBe(900);
    expect(repaired.scopeMeasurements?.floorDemoSqft).toBe(900);
    expect(repaired.scopeMeasurements?.roofSquares).toBe(26);
    expect(repaired.scopeMeasurements?.wallPaintSqft).toBe(2000);
    expect(repaired.scopeMeasurements?.patchRepairSqft).toBe(300);
    expect(repaired.scopeMeasurements?.drywallSqft).toBeUndefined();
    const ids = repaired.scopeChecklist?.items?.map(item => item.id) || [];
    expect(ids).toEqual(expect.arrayContaining(['service_call', 'roofing', 'stucco']));
    expect(ids.filter(id => id === 'flooring_lvp')).toHaveLength(0);
  });

  it('keeps a taught drywall and LVP pair on its own checklist', () => {
    const read = readNoteWork(TAUGHT);
    expect(read.lines.map(line => [line.label, line.quantity])).toEqual([
      ['Drywall hang / finish', 800],
      ['LVP', 400],
    ]);
    expect(noteUsesSeparateJobReader(TAUGHT)).toBe(false);
    const parsed = parseScopeMeasurementsFromNotes(TAUGHT);
    expect(parsed.drywallSqft).toBe(800);
    expect(parsed.flooringSqft).toBe(400);
    expect(parsed.flooringLvpSqft).toBe(400);
  });

  it('reads attic insulation and drywall as two jobs', () => {
    expect(noteUsesSeparateJobReader(ATTIC)).toBe(true);
    const repaired = draftFor(ATTIC);
    expect(repaired.scopeChecklist?.items?.map(item => item.label)).toEqual([
      'Attic insulation',
      'Drywall hang / finish',
    ]);
    expect(repaired.scopeMeasurements?.atticInsulationSqft).toBe(1000);
    expect(repaired.scopeMeasurements?.drywallSqft).toBe(800);
    expect(repaired.scopeMeasurements?.flooringSqft).toBeUndefined();
    expect(
      groupScopeChecklistItems(repaired.scopeChecklist?.items || [], 'room_remodel', {
        notes: ATTIC,
      }).map(group => group.title)
    ).toEqual(['Attic insulation', 'Drywall hang / finish']);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(
        row => `${row.name} · ${row.quantity}`
      )
    ).toEqual([
      'Attic insulation · 1000 sqft',
      'Drywall hang / finish · 800 sqft',
    ]);
  });

  it('reads a concrete patio and sod as two jobs', () => {
    const repaired = draftFor(PATIO);
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'pour_flatwork',
      'sod_turf',
    ]);
    expect(repaired.scopeMeasurements?.concreteSqft).toBe(400);
    expect(repaired.scopeMeasurements?.sodSqft).toBe(600);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(row => row.quantity)
    ).toEqual(['400 sqft', '600 sqft']);
  });

  it('drops framing when the note says not to frame', () => {
    const read = readNoteWork(NEGATION);
    expect(read.lines.map(line => line.label)).toEqual(['LVP']);
    expect(read.excludedIds).toEqual(expect.arrayContaining(['framing']));
    const repaired = draftFor(NEGATION);
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'flooring_lvp',
    ]);
    expect(repaired.scopeMeasurements?.wallFramingSqft).toBeUndefined();
    expect(repaired.scopeMeasurements?.flooringSqft).toBe(600);
    expect(repaired.scopeMeasurements?.flooringLvpSqft).toBe(600);
  });

  it('replaces a leaked flooring quantity with the LVP quantity', () => {
    const next = applyNoteClauseReads(
      { flooringSqft: 800, drywallSqft: 100 },
      'Hang 800 sqft of drywall and install 400 sqft of LVP.'
    );
    expect(next.drywallSqft).toBe(800);
    expect(next.flooringSqft).toBe(400);
    expect(next.flooringLvpSqft).toBe(400);
  });

  it('keeps each named job on the long wall note', () => {
    const notes =
      'Demolish existing nonstructural walls, frame 400 sqft of new walls, hang 400 sqft of drywall, install R-21 insulation in those walls, install 180 sqft of LVP, and paint the new walls. Leave the existing flooring everywhere else.';
    const read = readNoteWork(notes);
    expect(read.lines.map(line => [line.label, line.quantity])).toEqual([
      ['Wall framing', 400],
      ['Drywall hang / finish', 400],
      ['Wall insulation (R-21)', 400],
      ['LVP', 180],
      ['Wall paint', 400],
    ]);
    expect(read.lines.map(line => line.id)).not.toContain('demo');
    expect(read.excludedIds).not.toContain('flooring_lvp');
    expect(noteUsesSeparateJobReader(notes)).toBe(true);

    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        projectTitle: 'Scope',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        scopeMode: 'mixed',
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [],
        },
        scopeMeasurements: {
          floorAreaSqft: 180,
          flooringSqft: 180,
          wallFramingSqft: 600,
          wallDemoSqft: 800,
          wallPaintSqft: 180,
          framedAreaSqft: 600,
        },
        scopePackages: [{ name: 'Drywall hang / finish' }],
        whatAiDid: ['Detected a project.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    const measurements = repaired.scopeMeasurements;
    expect(measurements?.wallFramingSqft).toBe(400);
    expect(measurements?.drywallSqft).toBe(400);
    expect(measurements?.exteriorWallInsulationSqft).toBe(400);
    expect(measurements?.flooringLvpSqft).toBe(180);
    expect(measurements?.wallPaintSqft).toBe(400);
    expect(measurements?.wallDemoSqft).toBeUndefined();
    expect(measurements?.floorAreaSqft).toBeUndefined();
    expect(measurements?.framedAreaSqft).toBeUndefined();
    expect(repaired.scopeChecklist?.items?.map(item => item.id)).toEqual([
      'wall_framing',
      'drywall',
      'insulation',
      'flooring_lvp',
      'interior_paint',
    ]);
    const hydrated = hydrateScopeChecklistFromNotes(
      repaired.scopeChecklist?.items || [],
      'room_remodel',
      notes
    );
    expect(hydrated.map(item => item.id)).toEqual([
      'wall_framing',
      'drywall',
      'insulation',
      'flooring_lvp',
      'interior_paint',
    ]);
    expect(hydrated.find(item => item.id === 'insulation')?.label).toBe(
      'Wall insulation (R-21)'
    );
    expect(
      confirmScopeDrywallSqftLabel(notes, {
        installNamed: true,
        repairNamed: false,
      })
    ).toBe('Drywall hang / finish');
    const shown = readerConfirmScopeItems(
      [
        ...(repaired.scopeChecklist?.items || []),
        {
          id: 'demo',
          label: 'Wall demolition / removal',
          helperText: 'Demolish and remove the existing walls.',
          state: 'included',
          noteBacked: true,
          inputType: 'yes_no',
        },
        {
          id: 'framing',
          label: 'Wall framing',
          helperText: 'Frame the walls identified in the job notes.',
          state: 'included',
          noteBacked: true,
          inputType: 'yes_no',
        },
        {
          id: 'insulation',
          label: 'Insulation',
          helperText:
            'Insulation surface area from notes; enter the missing sqft.',
          state: 'included',
          noteBacked: true,
          inputType: 'yes_no',
        },
        {
          id: 'interior_paint',
          label: 'Interior paint — walls',
          helperText: 'Wall and ceiling paint area from your notes.',
          state: 'included',
          noteBacked: true,
          inputType: 'yes_no',
        },
      ],
      notes
    );
    expect(shown?.map(item => item.id)).toEqual([
      'wall_framing',
      'drywall',
      'insulation',
      'flooring_lvp',
      'interior_paint',
    ]);
    expect(shown?.find(item => item.id === 'insulation')?.label).toBe(
      'Wall insulation (R-21)'
    );
    expect(shown?.find(item => item.id === 'interior_paint')?.label).toBe(
      'Wall paint'
    );
    expect(
      checklistDisplayLabel(
        {
          id: 'interior_paint',
          label: 'Wall paint',
          state: 'included',
          noteBacked: true,
        },
        'room_remodel'
      )
    ).toBe('Wall paint');
    expect(
      getMeasurementRelevance({
        measurementKey: 'wallFramingSqft',
        includedScopeKeys: ['framing'],
        notes,
      }).relevant
    ).toBe(true);
    expect(
      getInitialRevealChecklistScopePreview(repaired).map(
        row => `${row.name} · ${row.quantity}`
      )
    ).toEqual([
      'Wall framing · 400 sqft',
      'Drywall hang / finish · 400 sqft',
      'Wall insulation (R-21) · 400 sqft',
      'LVP · 180 sqft',
      'Wall paint · 400 sqft',
    ]);
    expect(getInitialRevealDisplayTitle(repaired)).toBe(
      'Framing, drywall, insulation, LVP, and paint'
    );
    expect(getInitialRevealTagline(repaired)).toBeNull();
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    const groups = groupScopeChecklistItems(
      repaired.scopeChecklist?.items || [],
      'room_remodel',
      { notes }
    );
    expect(
      bucketWholeProjectScopeGroups(groups, { notes }).map(group => group.title)
    ).toEqual([
      'Wall framing',
      'Drywall hang / finish',
      'Wall insulation (R-21)',
      'LVP',
      'Wall paint',
    ]);
    expect(
      quickMeasurementRowsForInput('room_remodel', 'other', {}, undefined, {
        scopeNotes: notes,
      })
        .flat()
        .map(field => field.label)
    ).toEqual([
      'Wall framing',
      'Drywall hang / finish',
      'Wall insulation (R-21)',
      'LVP',
      'Wall paint',
    ]);

    const normalized = normalizeScopeMeasurements(measurements || {});
    const price = (itemId: string) => {
      const quantity = resolveChecklistItemQuantity(itemId, normalized, {
        templateKey: 'room_remodel',
        notes,
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        measurements || {},
        'room_remodel',
        quantity,
        null,
        null,
        notes
      ).fill;
    };
    expect(price('wall_framing')).toMatchObject({
      material: 200,
      labor: 400,
      total: 600,
    });
    expect(price('drywall')).toMatchObject({
      material: 340,
      labor: 500,
      total: 840,
    });
    expect(price('insulation')).toMatchObject({
      material: 500,
      labor: 700,
      total: 1200,
    });
    expect(price('flooring_lvp')).toMatchObject({
      material: 630,
      labor: 630,
      total: 1260,
    });
    expect(price('interior_paint')).toMatchObject({
      material: 340,
      labor: 1000,
      total: 1340,
    });
  });
});
