import {
  dedicatedInsulationRevealLines,
  filterDedicatedInsulationConfirmItems,
  insulationNoteNamesAtticArea,
  insulationNoteNamesWallArea,
  notesDescribeDedicatedInsulationJob,
  notesNameAirSealing,
} from '@/utils/insulationNoteScope';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

const NOTE =
  'Install R-21 insulation in 1,600 sqft of walls and R-30 insulation in 1,200 sqft of attic.';

describe('dedicated insulation note', () => {
  it('keeps the two assemblies and leaves paint and air sealing off', () => {
    expect(notesDescribeDedicatedInsulationJob(NOTE)).toBe(true);
    expect(
      notesDescribeDedicatedInsulationJob(
        'Install R-21 insulation in 1,600 sqft of walls and paint the ceilings.'
      )
    ).toBe(false);
    expect(notesNameAirSealing(NOTE)).toBe(false);
    expect(notesNameAirSealing('Install R-21 wall insulation and air sealing.')).toBe(
      true
    );
    expect(dedicatedInsulationRevealLines(NOTE)).toEqual([
      'Wall insulation · R-21 · 1,600 sqft',
      'Attic insulation · R-30 · 1,200 sqft',
    ]);

    const filtered = filterDedicatedInsulationConfirmItems(
      [
        { id: 'insulation', state: 'included', label: 'Insulation' },
        { id: 'air_sealing', state: 'unsure', label: 'Standard air sealing' },
        { id: 'interior_paint', state: 'included', label: 'Interior paint' },
        { id: 'custom_extra', state: 'included', label: 'Custom' },
      ],
      NOTE
    );
    expect(filtered.map(item => item.id)).toEqual(['insulation', 'custom_extra']);
    expect(
      filterDedicatedInsulationConfirmItems(
        [{ id: 'air_sealing', state: 'unsure' }],
        NOTE,
        { planBacked: true }
      ).map(item => item.id)
    ).toEqual(['air_sealing']);

    const draft = {
      originalNotes: NOTE,
      projectType: 'insulation',
      projectTitle: 'Insulation Installation',
      whatAiDid: ['Detected insulation.'],
      scopeChecklist: { templateKey: 'insulation', items: [] },
      stillNeededReview: [
        'Price needed for Insulation',
        'Price needed for Walls',
      ],
    } as EstimateAiDraft;

    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual(
      dedicatedInsulationRevealLines(NOTE)
    );
    expect(
      getInitialRevealChecklistScopePreview(draft).map(
        row => `${row.name} · ${row.quantity}`
      )
    ).toEqual(dedicatedInsulationRevealLines(NOTE));
    expect(getInitialRevealTotals(draft).scopeItemCount).toBe(2);
    expect(
      getInitialRevealConfirmItems(draft).pricingScope.filter(item =>
        /price needed|pricing for/i.test(item)
      )
    ).toEqual([]);
  });

  it('asks for a location only when the note names it', () => {
    const atticOnly = 'Install R-38 blown-in insulation in 1,400 sqft of attic.';
    const keysFor = (
      notes: string,
      measurements: Record<string, string> = {}
    ) =>
      quickMeasurementRowsForInput(
        'insulation',
        'insulation',
        measurements,
        undefined,
        { scopeNotes: notes }
      )
        .flat()
        .map(field => field.key);

    expect(insulationNoteNamesWallArea(atticOnly)).toBe(false);
    expect(insulationNoteNamesAtticArea(atticOnly)).toBe(true);
    expect(keysFor(atticOnly)).not.toContain('exteriorWallInsulationSqft');
    expect(keysFor(atticOnly)).toContain('atticInsulationSqft');
    expect(keysFor(NOTE)).toEqual(
      expect.arrayContaining([
        'exteriorWallInsulationSqft',
        'atticInsulationSqft',
      ])
    );
    expect(
      keysFor(atticOnly, { exteriorWallInsulationSqft: '200' })
    ).toContain('exteriorWallInsulationSqft');
  });
});
