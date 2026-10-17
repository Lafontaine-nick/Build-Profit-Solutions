import {
  dedicatedElectricalNamedCards,
  dedicatedElectricalRevealLines,
  filterDedicatedElectricalConfirmItems,
  notesDescribeDedicatedElectricalDeviceJob,
  notesNameElectricalJobCondition,
  notesNameElectricalServiceAmperage,
} from '@/utils/electricalNoteScope';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

const NOTE =
  'Install 8 receptacles, 4 GFCI outlets, 6 recessed lights, and one new circuit.';

describe('dedicated electrical device note', () => {
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
});
