import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  bathroomWetAreaDemoCardActive,
  expandBathroomWetAreaDemoScopeDisplayItems,
  finalizeWetAreaDemoScopeFromMeasurements,
} from '@/utils/wetAreaDemoScopeGate';

describe('wetAreaDemoScopeGate', () => {
  test('bathroomWetAreaDemoCardActive tracks QM demo steppers', () => {
    expect(
      bathroomWetAreaDemoCardActive('tub_demo', { demoTubCount: 1 })
    ).toBe(true);
    expect(
      bathroomWetAreaDemoCardActive('tub_demo', {
        demoTubCount: null,
        demoWetAreaManualOverrides: { demoTubCount: true },
      })
    ).toBe(false);
    expect(
      bathroomWetAreaDemoCardActive('shower_enclosure_demo', {
        demoPrefabEnclosureCount: 1,
      })
    ).toBe(true);
    expect(
      bathroomWetAreaDemoCardActive('shower_floor_demo', {
        demoPrefabEnclosureCount: 1,
      })
    ).toBe(false);
  });

  test('expandBathroomWetAreaDemoScopeDisplayItems injects enclosure and door demo cards', () => {
    const items: ScopeChecklistItem[] = [];
    const next = expandBathroomWetAreaDemoScopeDisplayItems(
      items,
      {
        demoPrefabEnclosureCount: 1,
        demoShowerDoorCount: 1,
      },
      'bathroom'
    );
    expect(next.map(row => row.id)).toEqual([
      'shower_enclosure_demo',
      'glass_door_demo',
    ]);
  });

  test('finalizeWetAreaDemoScopeFromMeasurements drops inactive QM demo cards', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'tub_demo',
        label: 'Remove tub',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'shower_enclosure_demo',
        label: 'Remove enclosure',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = finalizeWetAreaDemoScopeFromMeasurements(items, {
      demoTubCount: null,
      demoPrefabEnclosureCount: 1,
      demoWetAreaManualOverrides: { demoTubCount: true },
    });
    expect(next.map(row => row.id)).toEqual(['shower_enclosure_demo']);
  });
});
