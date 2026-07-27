import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  syncWetAreaDemoScopeItems,
  syncWetAreaScopeFromSteppers,
  syncWetAreaTileScopeItems,
  syncWaterproofingFromTileScopeItems,
  syncBathroomFloorTileScopeItems,
  syncInteriorPaintScopeItems,
} from '@/utils/estimateScopeChecklistUi';

const baseItems: ScopeChecklistItem[] = [
  {
    id: 'shower_tile',
    label: 'Shower wall tile',
    inputType: 'yes_no',
    state: 'unsure',
  },
  {
    id: 'shower_floor_tile',
    label: 'Shower floor tile',
    inputType: 'yes_no',
    state: 'unsure',
  },
];

describe('wetAreaScopeSync', () => {
  test('syncWetAreaTileScopeItems includes floor tile when shower floor SF is set', () => {
    const next = syncWetAreaTileScopeItems(baseItems, {
      showerFloorTileSqft: '15',
    });
    expect(next.find((r) => r.id === 'shower_floor_tile')?.state).toBe('included');
    expect(next.find((r) => r.id === 'shower_tile')?.state).toBe('unsure');
  });

  test('syncWetAreaTileScopeItems includes wall and floor from steppers', () => {
    const next = syncWetAreaTileScopeItems(baseItems, {
      bathCount: 1,
      tilePanBathCount: 1,
    });
    expect(next.find((r) => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find((r) => r.id === 'shower_floor_tile')?.state).toBe('included');
  });

  test('syncWaterproofingFromTileScopeItems includes waterproofing when shower wall tile is Yes', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'waterproofing', label: 'Waterproofing', inputType: 'yes_no', state: 'unsure' },
      { id: 'shower_tile', label: 'Shower wall tile', inputType: 'yes_no', state: 'included' },
    ];
    const next = syncWaterproofingFromTileScopeItems(items);
    expect(next.find((r) => r.id === 'waterproofing')?.state).toBe('included');
  });

  test('syncWaterproofingFromTileScopeItems does not override explicit No', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'waterproofing', label: 'Waterproofing', inputType: 'yes_no', state: 'excluded' },
      { id: 'shower_tile', label: 'Shower wall tile', inputType: 'yes_no', state: 'included' },
    ];
    const next = syncWaterproofingFromTileScopeItems(items);
    expect(next.find((r) => r.id === 'waterproofing')?.state).toBe('excluded');
  });

  test('syncWetAreaTileScopeItems includes waterproofing when shower wall SF is set', () => {
    const items: ScopeChecklistItem[] = [
      ...baseItems,
      { id: 'waterproofing', label: 'Waterproofing', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncWetAreaTileScopeItems(items, { showerWallTileSqft: '80' });
    expect(next.find((r) => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find((r) => r.id === 'waterproofing')?.state).toBe('included');
  });

  test('syncWetAreaScopeFromSteppers includes shower floor tile when tile pan stepper set', () => {
    const next = syncWetAreaScopeFromSteppers(baseItems, {
      counts: {
        bathCount: 1,
        tilePanBathCount: 1,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        showerDoorCount: null,
      },
      showerFloorTileSqft: '15',
    });
    expect(next.find((r) => r.id === 'shower_floor_tile')?.state).toBe('included');
  });

  test('syncWetAreaDemoScopeItems includes tub_demo and generic demo', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'tub_demo', label: 'Remove tub', inputType: 'yes_no', state: 'unsure' },
      { id: 'shower_floor_demo', label: 'Remove shower floor', inputType: 'yes_no', state: 'unsure' },
      { id: 'floor_demo', label: 'Remove floor', inputType: 'yes_no', state: 'unsure' },
      { id: 'demo', label: 'Demo', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoTubCount: 1, demoTileWallCount: 1, demoTilePanCount: 1 },
    });
    expect(next.find((r) => r.id === 'tub_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'shower_floor_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'demo')?.state).toBe('included');
  });

  test('syncWetAreaDemoScopeItems includes floor_demo from bath floor demo stepper', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'floor_demo', label: 'Remove floor', inputType: 'yes_no', state: 'unsure' },
      { id: 'demo', label: 'Demo', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoBathFloorTileCount: 1 },
    });
    expect(next.find((r) => r.id === 'floor_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'demo')?.state).toBe('unsure');
  });

  test('syncBathroomFloorTileScopeItems includes floor_tile when bath floor SF set', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'floor_tile', label: 'Bath floor tile', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncBathroomFloorTileScopeItems(items, { bathroomFloorSqft: '45' });
    expect(next.find((r) => r.id === 'floor_tile')?.state).toBe('included');
  });

  test('syncInteriorPaintScopeItems includes paint when wallPaintSqft is set', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'paint', label: 'Interior painting', inputType: 'yes_no', state: 'unsure' },
      { id: 'trim', label: 'Trim', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncInteriorPaintScopeItems(items, { wallPaintSqft: '100' });
    expect(next.find((r) => r.id === 'paint')?.state).toBe('included');
    expect(next.find((r) => r.id === 'trim')?.state).toBe('unsure');
  });

  test('syncInteriorPaintScopeItems promotes interior_paint alias id', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'interior_paint', label: 'Interior paint', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncInteriorPaintScopeItems(items, { wallPaintSqft: 320 });
    expect(next.find((r) => r.id === 'interior_paint')?.state).toBe('included');
  });
});
