jest.mock('@/utils/resolveAiBackendUrl', () => ({
  postAiAssistantJson: jest.fn(),
  resolveAiBackendUrl: jest.fn(() => 'http://localhost'),
}));

import { applyPhotoDetectionsToDraft } from '../../utils/estimateAiDraft';
import type { EstimateAiDraft, PhotoScopeDetection } from '../../utils/estimateAiDraft';

function draftWithItems(items: any[]): EstimateAiDraft {
  return {
    scopeChecklist: {
      estimateTier: 'standard',
      templateKey: 'bathroom',
      title: 'Confirm scope',
      intro: '',
      items,
    },
  } as unknown as EstimateAiDraft;
}

describe('applyPhotoDetectionsToDraft', () => {
  test('fills unsure items from confident detections and marks them noteBacked', () => {
    const draft = draftWithItems([
      { id: 'tub_demo', label: 'Remove existing tub', state: 'unsure' },
      { id: 'shower_floor_demo', label: 'Remove existing shower pan', state: 'unsure' },
      { id: 'floor_demo', label: 'Flooring demo', state: 'unsure' },
    ]);
    const detections: PhotoScopeDetection[] = [
      { itemId: 'tub_demo', state: 'included', confidence: 0.9 },
      // Photo shows a tub, no shower pan → vision excludes pan demo.
      { itemId: 'shower_floor_demo', state: 'excluded', confidence: 0.8 },
      // Low confidence must be ignored (below photo-list / apply threshold of 0.45).
      { itemId: 'floor_demo', state: 'included', confidence: 0.3 },
    ];

    const next = applyPhotoDetectionsToDraft(draft, detections);
    const byId = Object.fromEntries(next.scopeChecklist!.items.map((i) => [i.id, i]));

    expect(byId.tub_demo.state).toBe('included');
    expect(byId.tub_demo.noteBacked).toBe(true);
    expect(byId.shower_floor_demo.state).toBe('excluded');
    expect(byId.floor_demo.state).toBe('unsure');
  });

  test('applies detections at the same confidence floor as the photo notes list (0.45)', () => {
    const draft = draftWithItems([{ id: 'appliances', label: 'Appliance reinstall', state: 'unsure' }]);
    const next = applyPhotoDetectionsToDraft(draft, [
      { itemId: 'appliances', state: 'included', confidence: 0.45 },
    ]);
    expect(next.scopeChecklist!.items[0].state).toBe('included');
    expect(next.scopeChecklist!.items[0].noteBacked).toBe(true);
  });

  test('never overrides explicit states from notes', () => {
    const draft = draftWithItems([
      { id: 'floor_demo', label: 'Flooring demo', state: 'excluded' },
      { id: 'tub_demo', label: 'Remove existing tub', state: 'included' },
    ]);
    const detections: PhotoScopeDetection[] = [
      { itemId: 'floor_demo', state: 'included', confidence: 0.95 },
      { itemId: 'tub_demo', state: 'excluded', confidence: 0.95 },
    ];

    const next = applyPhotoDetectionsToDraft(draft, detections);
    const byId = Object.fromEntries(next.scopeChecklist!.items.map((i) => [i.id, i]));

    expect(byId.floor_demo.state).toBe('excluded');
    expect(byId.tub_demo.state).toBe('included');
  });

  test('fills choice items only with a valid option id', () => {
    const draft = draftWithItems([
      {
        id: 'wet_area_install',
        label: 'Wet area',
        inputType: 'choice',
        state: 'unsure',
        choiceId: null,
        options: [
          { id: 'tile_shower', label: 'Tile shower' },
          { id: 'tub_surround', label: 'Tub + surround' },
        ],
      },
    ]);

    const applied = applyPhotoDetectionsToDraft(draft, [
      { itemId: 'wet_area_install', state: 'included', choiceId: 'tile_shower', confidence: 0.8 },
    ]);
    expect(applied.scopeChecklist!.items[0].choiceId).toBe('tile_shower');
    expect(applied.scopeChecklist!.items[0].state).toBe('included');

    const invalid = applyPhotoDetectionsToDraft(draft, [
      { itemId: 'wet_area_install', state: 'included', choiceId: 'not_an_option', confidence: 0.8 },
    ]);
    expect(invalid.scopeChecklist!.items[0].choiceId).toBeNull();
  });

  test('returns draft unchanged when there are no detections or no checklist', () => {
    const draft = draftWithItems([{ id: 'tub_demo', label: 'Tub', state: 'unsure' }]);
    expect(applyPhotoDetectionsToDraft(draft, [])).toBe(draft);
    expect(applyPhotoDetectionsToDraft(draft, null)).toBe(draft);

    const noChecklist = {} as EstimateAiDraft;
    expect(applyPhotoDetectionsToDraft(noChecklist, [{ itemId: 'x', state: 'included', confidence: 1 }])).toBe(
      noChecklist
    );
  });
});
