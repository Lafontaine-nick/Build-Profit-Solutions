jest.mock('@/utils/resolveAiBackendUrl', () => ({
  postAiAssistantJson: jest.fn(),
  resolveAiBackendUrl: jest.fn(() => 'http://localhost'),
}));

import { applyScopeDetectionsToChecklistItems, applyPlanImportToDraft } from '../../utils/estimateAiDraft';
import type { PhotoScopeDetection, ScopeChecklistItem } from '../../utils/estimateAiDraft';

const item = (overrides: Partial<ScopeChecklistItem> & { id: string }): ScopeChecklistItem =>
  ({ label: overrides.id, state: 'unsure', ...overrides }) as ScopeChecklistItem;

describe('applyScopeDetectionsToChecklistItems (plan → scope)', () => {
  test('fills unsure items, skips low confidence, and reports applied labels', () => {
    const items = [
      item({ id: 'flooring', label: 'New flooring' }),
      item({ id: 'paint', label: 'Interior paint' }),
      item({ id: 'deck', label: 'Deck build' }),
    ];
    const detections: PhotoScopeDetection[] = [
      { itemId: 'flooring', state: 'included', confidence: 0.9 },
      { itemId: 'paint', state: 'excluded', confidence: 0.6 },
      { itemId: 'deck', state: 'included', confidence: 0.3 },
    ];

    const result = applyScopeDetectionsToChecklistItems(items, detections);
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));

    expect(byId.flooring.state).toBe('included');
    expect(byId.flooring.noteBacked).toBe(true);
    expect(byId.paint.state).toBe('excluded');
    expect(byId.deck.state).toBe('unsure');
    expect(result.appliedCount).toBe(2);
    expect(result.appliedLabels).toEqual(['New flooring', 'Interior paint']);
  });

  test('never overrides explicit user answers', () => {
    const items = [
      item({ id: 'flooring', label: 'New flooring', state: 'excluded' }),
      item({ id: 'paint', label: 'Interior paint', state: 'included' }),
    ];
    const result = applyScopeDetectionsToChecklistItems(items, [
      { itemId: 'flooring', state: 'included', confidence: 0.95 },
      { itemId: 'paint', state: 'excluded', confidence: 0.95 },
    ]);
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));

    expect(byId.flooring.state).toBe('excluded');
    expect(byId.paint.state).toBe('included');
    expect(result.appliedCount).toBe(0);
  });

  test('remaps addition-style plan ids onto a ground_up checklist', () => {
    const items = [
      item({ id: 'foundation', label: 'Foundation' }),
      item({ id: 'framing', label: 'Framing' }),
      item({ id: 'roofing', label: 'Roofing' }),
      item({ id: 'exterior', label: 'Exterior finishes' }),
      item({ id: 'mep_rough', label: 'MEP rough-in' }),
      item({ id: 'paint_trim', label: 'Paint & trim' }),
      item({ id: 'tile_flooring', label: 'Tile & flooring' }),
      item({ id: 'sitework', label: 'Sitework & excavation' }),
    ];
    const result = applyScopeDetectionsToChecklistItems(items, [
      { itemId: 'foundation', state: 'included', confidence: 0.9 },
      { itemId: 'framing_structure', state: 'included', confidence: 0.9 },
      { itemId: 'roofing', state: 'included', confidence: 0.9 },
      { itemId: 'exterior_finishes', state: 'included', confidence: 0.9 },
      { itemId: 'electrical_rough', state: 'included', confidence: 0.85 },
      { itemId: 'paint', state: 'included', confidence: 0.8 },
      { itemId: 'flooring', state: 'included', confidence: 0.8 },
      { itemId: 'site_prep', state: 'included', confidence: 0.8 },
    ]);
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));

    expect(byId.foundation.state).toBe('included');
    expect(byId.framing.state).toBe('included');
    expect(byId.roofing.state).toBe('included');
    expect(byId.exterior.state).toBe('included');
    expect(byId.mep_rough.state).toBe('included');
    expect(byId.paint_trim.state).toBe('included');
    expect(byId.tile_flooring.state).toBe('included');
    expect(byId.sitework.state).toBe('included');
    expect(result.appliedCount).toBe(8);
  });

  test('choice items require a valid option id', () => {
    const items = [
      item({
        id: 'wet_area_install',
        label: 'Wet area',
        inputType: 'choice',
        choiceId: null,
        options: [
          { id: 'tile_shower', label: 'Tile shower' },
          { id: 'tub_surround', label: 'Tub + surround' },
        ],
      }),
    ];

    const valid = applyScopeDetectionsToChecklistItems(items, [
      { itemId: 'wet_area_install', state: 'included', choiceId: 'tile_shower', confidence: 0.8 },
    ]);
    expect(valid.items[0].choiceId).toBe('tile_shower');
    expect(valid.items[0].state).toBe('included');

    const invalid = applyScopeDetectionsToChecklistItems(items, [
      { itemId: 'wet_area_install', state: 'included', choiceId: 'nope', confidence: 0.8 },
    ]);
    expect(invalid.items[0].choiceId).toBeNull();
    expect(invalid.appliedCount).toBe(0);
  });

  test('returns items unchanged with empty inputs', () => {
    const items = [item({ id: 'flooring', label: 'New flooring' })];
    expect(applyScopeDetectionsToChecklistItems(items, []).items).toBe(items);
    expect(applyScopeDetectionsToChecklistItems(items, null).items).toBe(items);
    expect(applyScopeDetectionsToChecklistItems([], [{ itemId: 'x', state: 'included', confidence: 1 }]).items).toEqual([]);
  });
});

describe('applyPlanImportToDraft', () => {
  test('seeds measurements and applies remapped scope detections', () => {
    const draft = {
      scopeChecklist: {
        estimateTier: 'standard',
        templateKey: 'ground_up',
        title: 'Confirm scope',
        intro: '',
        items: [
          { id: 'foundation', label: 'Foundation', state: 'unsure' },
          { id: 'exterior', label: 'Exterior finishes', state: 'unsure' },
          { id: 'mep_rough', label: 'MEP rough-in', state: 'unsure' },
          { id: 'framing', label: 'Framing', state: 'unsure' },
          { id: 'tile_flooring', label: 'Tile & flooring', state: 'unsure' },
        ],
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      measurements: { floorAreaSqft: '1879', garageSqft: 994 },
      scopeDetections: [
        { itemId: 'foundation', state: 'included', confidence: 0.9 },
        { itemId: 'exterior_finishes', state: 'included', confidence: 0.9 },
        { itemId: 'electrical_rough', state: 'included', confidence: 0.85 },
        { itemId: 'framing', state: 'included', confidence: 0.9 },
        { itemId: 'tile_flooring', state: 'included', confidence: 0.85 },
      ],
      rooms: [
        { name: 'Kitchen', lengthFt: 13.08, widthFt: 14.83, areaSqft: 194 },
        { name: 'Primary Suite', areaSqft: 285 },
        { name: 'Garage', areaSqft: 994 },
      ],
    });
    expect(next.scopeMeasurements?.floorAreaSqft).toBe(1879);
    expect(next.scopeMeasurements?.garageSqft).toBe(994);
    expect(next.scopeMeasurements?.flooringSqft).toBe(1879);
    expect(next.scopeMeasurements?.kitchenFloorSqft).toBe(194);
    expect(next.scopeMeasurements?.planRooms?.map((r) => r.name)).toEqual([
      'Kitchen',
      'Primary Suite',
      'Garage',
    ]);
    expect(next.scopeMeasurements?.itemQuantities?.foundation).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
      quantitySource: 'plan_vision',
    });
    expect(next.scopeMeasurements?.itemQuantities?.framing).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
    });
    expect(next.scopeMeasurements?.itemQuantities?.mep_rough).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
    });
    expect(next.scopeMeasurements?.itemQuantities?.tile_flooring).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
    });
    expect(next.scopeMeasurements?.itemQuantities?.paint_trim).toBeUndefined();
    const byId = Object.fromEntries(next.scopeChecklist!.items.map((i) => [i.id, i]));
    expect(byId.foundation.state).toBe('included');
    expect(byId.exterior.state).toBe('included');
    expect(byId.mep_rough.state).toBe('included');
  });
});
