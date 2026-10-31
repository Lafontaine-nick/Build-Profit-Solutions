import { readNoteWork } from '@/utils/noteClauseReader';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import {
  quickMeasurementRowsForInput,
} from '@/utils/scopeQuickMeasurements';
import { hydrateScopeChecklistFromNotes } from '@/utils/estimateScopeChecklistUi';
import { getInitialRevealChecklistScopePreview } from '@/utils/estimateInitialRevealUi';
import {
  notesNameBathroomRemodelPanel,
  notesNameKitchenRemodelPanel,
  wholeHomeRemodelNamedItemIds,
} from '@/utils/wholeHomeRemodelNote';

describe('canonical contractor note matrix', () => {
  const cases = [
    {
      name: 'whole-house remodel',
      notes: 'Whole house remodel. Kitchen, two bathrooms, flooring, paint, doors, and baseboard.',
      assert: () => {
        const ids = wholeHomeRemodelNamedItemIds(cases[0].notes)!;
        expect([...ids]).toEqual(
          expect.arrayContaining([
            'kitchen_updates',
            'bathroom_updates',
            'flooring',
            'interior_paint',
            'interior_door_install',
            'baseboard_install',
          ])
        );
        expect(notesNameKitchenRemodelPanel(cases[0].notes)).toBe(true);
        expect(notesNameBathroomRemodelPanel(cases[0].notes)).toBe(true);
      },
    },
    {
      name: 'mixed trade repair',
      notes:
        'Replace carpet with 900 sqft LVP. Reroof 26 squares of architectural shingles. Paint walls, 2,000 sqft. Replace the stucco, 1,800 sqft. HVAC service call to diagnose the furnace. Patch and texture 300 sqft of drywall. No new hang.',
      assert: () => {
        const parsed = parseScopeMeasurementsFromNotes(cases[1].notes);
        expect(parsed).toMatchObject({
          flooringSqft: 900,
          roofSquares: 26,
          wallPaintSqft: 2000,
          patchRepairSqft: 300,
        });
        const repaired = repairDraftRatePricingFromNotes(
          {
            originalNotes: cases[1].notes,
            projectType: 'other',
            estimateTier: 'room_remodel',
            scopeChecklist: { templateKey: 'room_remodel', items: [] },
            scopeMeasurements: {},
            scopePackages: [],
          } as never,
          cases[1].notes
        );
        expect(repaired.scopeMeasurements).toMatchObject({
          flooringSqft: 900,
          floorDemoSqft: 900,
          roofSquares: 26,
          wallPaintSqft: 2000,
          stuccoGrossWallSqft: 1800,
          hvacServiceCallCount: 1,
          patchRepairSqft: 300,
        });
        const keys = quickMeasurementRowsForInput(
          'room_remodel',
          'other',
          repaired.scopeMeasurements || {},
          [],
          { scopeNotes: cases[1].notes, crossScopeMode: true }
        )
          .flat()
          .map(field => field.key);
        expect(keys).toEqual(
          expect.arrayContaining([
            'flooringSqft',
            'floorDemoSqft',
            'drywallSqft',
            'wallPaintSqft',
            'roofSquares',
            'stuccoGrossWallSqft',
            'hvacServiceCallCount',
          ])
        );
        const hydratedScope = hydrateScopeChecklistFromNotes(
          repaired.scopeChecklist?.items || [],
          'room_remodel',
          cases[1].notes,
          repaired.scopeMeasurements as never,
          'other'
        );
        expect(hydratedScope.map(item => item.id)).toEqual(
          expect.arrayContaining([
            'flooring_lvp',
            'roofing',
            'interior_paint',
            'stucco',
            'service_call',
            'patch_repair',
          ])
        );
        expect(hydratedScope.map(item => item.id)).not.toContain(
          'drywall_hang'
        );
        expect(
          getInitialRevealChecklistScopePreview(repaired)
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'LVP', quantity: '900 sqft' }),
            expect.objectContaining({
              name: 'Roofing replacement',
              quantity: '26 squares',
            }),
            expect.objectContaining({
              name: 'Interior wall painting',
              quantity: '2000 sqft',
            }),
            expect.objectContaining({
              name: 'Stucco / exterior wall finish',
              quantity: '1800 sqft',
            }),
            expect.objectContaining({
              name: 'HVAC service call',
              quantity: '1 each',
            }),
            expect.objectContaining({
              name: 'Drywall repair',
              quantity: '300 sqft',
            }),
          ])
        );
        expect(readNoteWork(cases[1].notes).lines.length).toBeGreaterThan(0);
      },
    },
    {
      name: 'explicit exclusion',
      notes: 'Patch and texture 300 sqft of drywall. No new hang.',
      assert: () => {
        const read = readNoteWork(cases[2].notes);
        expect(read.lines.map(line => line.id)).toContain('patch_repair');
        expect(read.lines.map(line => line.id)).not.toContain('drywall_hang');
      },
    },
    {
      name: 'owner flooring demo exclusion',
      notes:
        'Remove 1,200 sqft of carpet and install 1,200 sqft of LVP. Homeowner is removing the carpet.',
      assert: () => {
        const repaired = repairDraftRatePricingFromNotes(
          {
            originalNotes: cases[3].notes,
            projectType: 'other',
            estimateTier: 'room_remodel',
            scopeChecklist: { templateKey: 'flooring', items: [] },
            scopeMeasurements: {},
            scopePackages: [],
          } as never,
          cases[3].notes
        );
        expect(
          repaired.scopeChecklist?.items?.map(item => item.id)
        ).toEqual(['flooring_lvp']);
        expect(repaired.scopeMeasurements?.floorDemoSqft).toBeUndefined();
        expect(repaired.scopeMeasurements?.flooringLvpSqft).toBe(1200);
        expect(
          getInitialRevealChecklistScopePreview(repaired).map(row => row.name)
        ).toEqual(['LVP']);
        expect(
          quickMeasurementRowsForInput('flooring', 'flooring', {}, [], {
            scopeNotes: cases[3].notes,
          })
            .flat()
            .map(field => field.key)
        ).toEqual(['flooringLvpSqft']);
      },
    },
    {
      name: 'replacement language',
      notes: 'Replace carpet with 900 sqft LVP.',
      assert: () => {
        const repaired = repairDraftRatePricingFromNotes(
          {
            originalNotes: cases[4].notes,
            projectType: 'other',
            estimateTier: 'room_remodel',
            scopeChecklist: { templateKey: 'room_remodel', items: [] },
            scopeMeasurements: {},
            scopePackages: [],
          } as never,
          cases[4].notes
        );
        expect(repaired.scopeMeasurements).toMatchObject({
          flooringSqft: 900,
        });
      },
    },
  ];

  it.each(cases)('$name preserves the canonical scope signals', ({ assert }) => {
    assert();
  });
});
