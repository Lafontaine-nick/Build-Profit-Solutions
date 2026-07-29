import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  syncWetAreaDemoScopeItems,
  syncWetAreaScopeFromSteppers,
  syncWetAreaTileScopeItems,
  syncWaterproofingFromTileScopeItems,
  syncBathroomFloorTileScopeItems,
  syncInteriorPaintScopeItems,
} from '@/utils/estimateScopeChecklistUi';
import { finalizeWetAreaInstallScopeFromMeasurements } from '@/utils/wetAreaInstallScopeGate';

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

  test('syncWetAreaScopeFromSteppers keeps wall tile and excludes floor when keeping existing tub', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'wet_area_install',
        label: 'Wet area install',
        inputType: 'choice',
        choiceId: 'tile_pan',
        state: 'included',
      },
      ...baseItems.map((row) =>
        row.id === 'shower_floor_tile' ? { ...row, state: 'included' as const } : row
      ),
    ];
    const next = syncWetAreaScopeFromSteppers(items, {
      counts: {
        bathCount: 1,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        showerDoorCount: null,
      },
      keepingExisting: true,
      showerFloorTileSqft: '15',
    });
    expect(next.find((r) => r.id === 'wet_area_install')?.choiceId).toBe('staying');
    expect(next.find((r) => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find((r) => r.id === 'shower_floor_tile')?.state).toBe('excluded');
  });

  test('syncWetAreaScopeFromSteppers excludes wet area when all install steppers are cleared', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'wet_area_install',
        label: 'Wet area install',
        inputType: 'choice',
        choiceId: 'tile_pan',
        state: 'included',
      },
      ...baseItems,
    ];
    const next = syncWetAreaScopeFromSteppers(items, {
      counts: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        showerDoorCount: null,
      },
    });
    expect(next.find((r) => r.id === 'wet_area_install')?.choiceId).toBe('not_in_scope');
    expect(next.find((r) => r.id === 'shower_pan')).toBeUndefined();
  });

  test('syncWetAreaScopeFromSteppers clears stale pan choice when only wall-tile steppers are set', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'wet_area_install',
        label: 'Wet area install',
        inputType: 'choice',
        choiceId: 'tile_pan',
        state: 'included',
      },
      ...baseItems,
    ];
    const next = syncWetAreaScopeFromSteppers(items, {
      counts: {
        bathCount: 1,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        showerDoorCount: null,
      },
    });
    expect(next.find((r) => r.id === 'wet_area_install')?.choiceId).toBe('not_in_scope');
    expect(next.find((r) => r.id === 'shower_pan')).toBeUndefined();
    expect(next.find((r) => r.id === 'shower_tile')?.state).toBe('included');
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

  test('syncInteriorPaintScopeItems targets paint_repair on bathroom checklists', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'paint_repair', label: 'Paint repair', inputType: 'yes_no', state: 'unsure' },
      { id: 'interior_paint', label: 'Interior paint', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncInteriorPaintScopeItems(items, { wallPaintSqft: '384' });
    expect(next.find((r) => r.id === 'paint_repair')?.state).toBe('included');
    expect(next.find((r) => r.id === 'interior_paint')?.state).toBe('unsure');
  });

  test('finalizeWetAreaInstallScopeFromMeasurements drops install lines when steppers are zero', () => {
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
        derivedFrom: 'wet_area_install',
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
