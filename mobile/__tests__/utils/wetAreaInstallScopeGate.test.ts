import { finalizeWetAreaInstallScopeFromMeasurements, tileShowerPanStepperActive } from '@/utils/wetAreaInstallScopeGate';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

describe('wetAreaInstallScopeGate', () => {
  test('tileShowerPanStepperActive is true only for tilePanBathCount', () => {
    expect(tileShowerPanStepperActive({ tilePanBathCount: 1 })).toBe(true);
    expect(tileShowerPanStepperActive({ tubBathCount: 1 })).toBe(false);
    expect(tileShowerPanStepperActive({ tilePanBathCount: null })).toBe(false);
  });

  test('finalizeWetAreaInstallScopeFromMeasurements drops mud pan when tile stepper is zero', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'wet_area_install',
        label: 'Wet area install',
        inputType: 'choice',
        choiceId: 'tile_pan',
        state: 'included',
      },
      {
        id: 'shower_pan',
        label: 'Shower mud pan build',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = finalizeWetAreaInstallScopeFromMeasurements(items, {
      tilePanBathCount: null,
      bathCount: 1,
    });
    expect(next.find((r) => r.id === 'wet_area_install')?.choiceId).toBe('not_in_scope');
    expect(next.find((r) => r.id === 'shower_pan')).toBeUndefined();
  });
});
