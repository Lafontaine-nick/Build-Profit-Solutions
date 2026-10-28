import { parseElectricalMeasurementsFromNotes } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  applyDedicatedElectricalNoteCounts,
  dedicatedElectricalNamedCards,
  dedicatedElectricalRevealLines,
  filterDedicatedElectricalConfirmItems,
  notesDescribeDedicatedElectricalDeviceJob,
  notesNameElectricalJobCondition,
  notesNameElectricalServiceAmperage,
  notesNameReceptaclesWithToilet,
  receptaclesWithToiletRevealRows,
} from '@/utils/electricalNoteScope';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealHeroDisplay,
  getInitialRevealTagline,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { quickMeasurementRowsForTemplate } from '@/utils/scopeQuickMeasurements';
import { affirmativeNoteText } from '@/utils/scopeItemNoteHints';

const NOTE =
  'Install 8 receptacles, 4 GFCI outlets, 6 recessed lights, and one new circuit.';

describe('dedicated electrical device note', () => {
  it('keeps a new-construction rough-in on the electrical devices when the note excludes trim', () => {
    const notes =
      'Electrical rough-in for a 2,400 sqft new construction home: 18 recessed lights, 12 standard receptacles, 4 GFCI receptacles, 10 switches, two dedicated 20A circuits, one 200A main panel, and 150 LF conduit. Excludes light fixtures, fans, low-voltage, EV charging, utility work, and final trim.';
    expect(affirmativeNoteText(notes)).not.toMatch(/\btrim\b/i);
    expect(notesDescribeDedicatedElectricalDeviceJob(notes)).toBe(true);
    expect(dedicatedElectricalNamedCards(notes).map(card => card.itemId)).not.toContain(
      'electrical_standard_fixture'
    );
    expect(dedicatedElectricalNamedCards(notes).map(card => card.count)).toEqual(
      expect.arrayContaining([1, 2, 12, 4, 10, 18, 150])
    );
  });

  it('keeps the four counted lines and leaves the rest off', () => {
    expect(notesDescribeDedicatedElectricalDeviceJob(NOTE)).toBe(true);
    expect(
      notesDescribeDedicatedElectricalDeviceJob(
        'Install 8 receptacles and paint the walls.'
      )
    ).toBe(false);
    expect(dedicatedElectricalNamedCards(NOTE).map(card => card.itemId)).toEqual([
      'electrical_standard_circuit',
      'electrical_standard_receptacle',
      'electrical_gfci_receptacle',
      'electrical_recessed_light',
    ]);
    expect(dedicatedElectricalNamedCards(NOTE).map(card => card.count)).toEqual([
      1, 8, 4, 6,
    ]);
    expect(notesNameElectricalJobCondition(NOTE)).toBe(false);
    expect(notesNameElectricalServiceAmperage(NOTE)).toBe(false);
    expect(notesNameElectricalJobCondition('Finished-wall service call. Install 4 receptacles.')).toBe(
      true
    );
    expect(notesNameElectricalServiceAmperage('Install a 200A main panel.')).toBe(
      true
    );
    expect(dedicatedElectricalRevealLines(NOTE)).toEqual([
      'Standard 15/20A circuits · 1 each',
      'Standard receptacles · 8 each',
      'GFCI receptacles · 4 each',
      'Recessed / canless / wafer light · 6 each',
    ]);

    const filtered = filterDedicatedElectricalConfirmItems(
      [
        {
          id: 'electrical_standard_circuit',
          state: 'unsure',
          label: 'Standard 15/20A circuits',
        },
        {
          id: 'electrical_standard_receptacle',
          state: 'included',
          label: 'Standard receptacles',
        },
        {
          id: 'electrical_gfci_receptacle',
          state: 'included',
          label: 'GFCI receptacles',
        },
        {
          id: 'electrical_recessed_light',
          state: 'included',
          label: 'Recessed / canless / wafer light',
        },
        { id: 'electrical_trim', state: 'included', label: 'Electrical trim-out' },
        { id: 'electrical', state: 'included', label: 'Electrical outlets, GFCI & circuits' },
        { id: 'custom_extra', state: 'included', label: 'Custom' },
      ],
      NOTE
    );
    expect(filtered.map(item => item.id)).toEqual([
      'electrical_standard_circuit',
      'electrical_standard_receptacle',
      'electrical_gfci_receptacle',
      'electrical_recessed_light',
      'custom_extra',
    ]);
    expect(filtered.find(item => item.id === 'electrical_standard_circuit')?.state).toBe(
      'included'
    );
    expect(
      filterDedicatedElectricalConfirmItems(
        [{ id: 'electrical_trim', state: 'included' }],
        NOTE,
        { planBacked: true }
      ).map(item => item.id)
    ).toEqual(['electrical_trim']);

    const draft = {
      originalNotes: NOTE,
      projectType: 'electrical',
      projectTitle: 'Electrical Installation Estimate',
      whatAiDid: ['Detected electrical.'],
      scopeChecklist: { templateKey: 'electrical', items: [] },
      stillNeededReview: [
        'Price needed for Standard 15/20A circuits',
        'Price needed for Standard receptacles',
        'Price needed for GFCI receptacles',
        'Price needed for Recessed / canless / wafer light',
        'Price needed for Electrical trim-out',
      ],
    } as EstimateAiDraft;
    expect(getInitialRevealUnderstoodBullets(draft, 2)).toEqual(
      dedicatedElectricalRevealLines(NOTE)
    );
    expect(
      getInitialRevealChecklistScopePreview(draft).map(
        row => `${row.name} · ${row.quantity}`
      )
    ).toEqual(dedicatedElectricalRevealLines(NOTE));
    expect(
      getInitialRevealConfirmItems(draft).pricingScope.filter(item =>
        /price needed|pricing for/i.test(item)
      )
    ).toEqual([]);
  });

  it('reads kitchen GFCI outlets and a panel upgrade as electrical', () => {
    const notes = '8 kitchen GFCI outlets and a 200 amp panel upgrade.';
    expect(notesDescribeDedicatedElectricalDeviceJob(notes)).toBe(true);
    expect(
      getInitialRevealTagline({
        originalNotes: notes,
        projectTitle: 'Kitchen GFCI Outlets and 200 Amp Panel Upgrade',
        projectType: 'kitchen',
        whatAiDid: ['Detected kitchen remodel job.'],
        scopeChecklist: { templateKey: 'kitchen', items: [] },
      } as EstimateAiDraft)
    ).toBe('Detected electrical.');
  });
});

const RECEPTACLES_AND_TOILET =
  'Install 10 receptacles and replace one toilet.';

describe('receptacles and a toilet', () => {
  it('keeps both trades and does not turn the note into a bathroom remodel', () => {
    expect(notesNameReceptaclesWithToilet(RECEPTACLES_AND_TOILET)).toBe(true);
    expect(notesDescribeDedicatedElectricalDeviceJob(RECEPTACLES_AND_TOILET)).toBe(
      false
    );
    expect(
      notesNameReceptaclesWithToilet('Install 10 receptacles.')
    ).toBe(false);
    expect(notesDescribeDedicatedElectricalDeviceJob('Install 10 receptacles.')).toBe(
      true
    );
    expect(receptaclesWithToiletRevealRows(RECEPTACLES_AND_TOILET)).toEqual([
      {
        id: 'electrical_standard_receptacle',
        name: 'Standard receptacles',
        quantity: '10 each',
      },
      { id: 'toilet', name: 'Toilet', quantity: '1 each' },
    ]);

    const repaired = repairDraftRatePricingFromNotes(
      {
        originalNotes: RECEPTACLES_AND_TOILET,
        projectType: 'bathroom',
        projectTitle: 'Electrical and Plumbing Service',
        estimateTier: 'room_remodel',
        scopeMode: 'dedicated',
        whatAiDid: ['Detected bathroom remodel.'],
        scopeMeasurements: {
          plumbingWorkflowMode: 'bathroom_remodel',
          plumbingRoomContext: 'bathroom',
        },
        scopeChecklist: {
          templateKey: 'bathroom',
          canonicalMixedScope: {
            items: [{ trade: 'bathroom', checklistState: 'included' }],
          },
          items: [
            { id: 'toilet', label: 'Toilet', state: 'included', inputType: 'yes_no' },
            { id: 'vanity', label: 'Vanity', state: 'unsure', inputType: 'yes_no' },
          ],
        },
      } as EstimateAiDraft,
      RECEPTACLES_AND_TOILET
    );
    expect(repaired.projectTitle).toBe('Receptacles and toilet');
    expect(repaired.scopeChecklist?.templateKey).toBe('room_remodel');
    expect(repaired.scopeChecklist?.items.map(item => item.id)).toEqual([
      'electrical_standard_receptacle',
      'toilet',
    ]);
    expect(
      repaired.scopeChecklist?.items.find(item => item.id === 'toilet')?.choiceId
    ).toBe('replacing');
    expect(repaired.scopeChecklist?.canonicalMixedScope).toBeNull();
    expect(repaired.scopeMeasurements?.plumbingWorkflowMode).toBeUndefined();
    expect(
      groupScopeChecklistItems(
        repaired.scopeChecklist?.items || [],
        repaired.scopeChecklist?.templateKey,
        { notes: RECEPTACLES_AND_TOILET }
      ).map(group => group.title)
    ).toEqual(['Receptacles', 'Toilet']);
    expect(repaired.scopeMeasurements?.standardReceptacleCount).toBe(10);
    expect(repaired.scopeMeasurements?.bathroomInstallToiletCount).toBe(1);
    const preview = getInitialRevealChecklistScopePreview(repaired);
    expect(preview.every(row => row.amount === 0)).toBe(true);
    expect(
      preview.map(row =>
        row.quantity ? `${row.name} · ${row.quantity}` : row.name
      )
    ).toEqual(['Standard receptacles · 10 each', 'Toilet · 1 each']);
    expect(getInitialRevealTotals(repaired).scopeItemCount).toBe(2);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([]);
    expect(
      getInitialRevealHeroDisplay(getInitialRevealTotals(repaired), true).hasAmount
    ).toBe(false);
    expect(
      quickMeasurementRowsForTemplate('bathroom', 'bathroom', RECEPTACLES_AND_TOILET)
        .flat()
        .map(field => field.key)
    ).toEqual(['standardReceptacleCount']);
  });

  it('keeps the note count when a stored receptacle count is lower', () => {
    const notes =
      'Install 24 standard receptacles, 12 recessed lights, and 4 ceiling fans.';
    const corrected = applyDedicatedElectricalNoteCounts(
      {
        standardReceptacleCount: 12,
        recessedLightCount: 12,
        ceilingFanCount: 4,
        itemQuantities: {
          electrical_standard_receptacle: {
            quantity: 12,
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      },
      notes
    );
    expect(corrected.standardReceptacleCount).toBe(24);
    expect(corrected.recessedLightCount).toBe(12);
    expect(corrected.ceilingFanCount).toBe(4);
    expect(
      corrected.itemQuantities?.electrical_standard_receptacle?.quantity
    ).toBe(24);

    const typed = applyDedicatedElectricalNoteCounts(
      {
        standardReceptacleCount: 12,
        quickMeasurementUserOverrides: { standardReceptacleCount: true },
        quickMeasurementSources: { standardReceptacleCount: 'user_entered' },
      },
      notes
    );
    expect(typed.standardReceptacleCount).toBe(12);

    const planSheet = applyDedicatedElectricalNoteCounts(
      {
        planImportTradeKey: 'electrical',
        standardReceptacleCount: 12,
      },
      notes
    );
    expect(planSheet.standardReceptacleCount).toBe(12);
  });

  it('counts a restated device once and still adds a different room', () => {
    const restated = parseElectricalMeasurementsFromNotes(
      '12 outlets, 6 recessed lights, 2 ceiling fans. 12 outlets. 6 recessed lights. 2 ceiling fans.'
    );
    expect(restated.standardReceptacleCount).toBe(12);
    expect(restated.recessedLightCount).toBe(6);
    expect(restated.ceilingFanCount).toBe(2);
    expect(dedicatedElectricalRevealLines(
      '12 outlets, 6 recessed lights, 2 ceiling fans. 12 outlets. 6 recessed lights. 2 ceiling fans.'
    )).toEqual([
      'Standard receptacles · 12 each',
      'Recessed / canless / wafer light · 6 each',
      'Ceiling fan · 2 each',
    ]);

    const separateRooms = parseElectricalMeasurementsFromNotes(
      '12 outlets in the kitchen. 8 outlets in the garage. 6 recessed lights in the kitchen. 6 recessed lights in the bedrooms.'
    );
    expect(separateRooms.standardReceptacleCount).toBe(20);
    expect(separateRooms.recessedLightCount).toBe(12);
  });
});
