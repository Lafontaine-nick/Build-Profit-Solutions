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
  test('syncWetAreaTileScopeItems includes wall and floor from confirmed SF', () => {
    const next = syncWetAreaTileScopeItems(baseItems, {
      showerFloorTileSqft: '15',
      showerWallTileSqft: '80',
    });
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe(
      'included'
    );
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
  });

  test('syncWetAreaTileScopeItems includes shower floor from SF on whole-home QM (ground_up)', () => {
    const next = syncWetAreaTileScopeItems(baseItems, {
      showerFloorTileSqft: '30',
      showerWallTileSqft: '160',
      splitTileWetArea: false,
    });
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe(
      'included'
    );
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
  });

  test('split bathroom mode does not include shower floor from wall stepper alone', () => {
    const next = syncWetAreaTileScopeItems(baseItems, {
      bathCount: 2,
      splitTileWetArea: true,
    });
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe('unsure');
  });

  test('syncWetAreaTileScopeItems includes wall and floor from steppers', () => {
    const next = syncWetAreaTileScopeItems(baseItems, {
      bathCount: 1,
      tilePanBathCount: 1,
    });
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe(
      'included'
    );
  });

  test('syncWetAreaTileScopeItems clears wall/floor Yes when steppers and SF are off', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'shower_tile',
        label: 'Shower wall tile',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'shower_floor_tile',
        label: 'Shower floor tile',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncWetAreaTileScopeItems(items, {
      bathCount: null,
      tilePanBathCount: null,
      showerWallTileSqft: null,
      showerFloorTileSqft: null,
    });
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('unsure');
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe('unsure');
  });

  test('preserves note-backed tile scope when measurement is still missing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'shower_tile',
        label: 'Shower wall tile',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
      {
        id: 'floor_tile',
        label: 'Bathroom floor tile',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
    ];
    const next = syncWetAreaTileScopeItems(items, {});
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find(r => r.id === 'shower_tile')?.noteBacked).toBe(true);
  });

  test('syncWaterproofingFromTileScopeItems includes waterproofing when shower wall tile is Yes', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'waterproofing',
        label: 'Waterproofing',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'shower_tile',
        label: 'Shower wall tile',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncWaterproofingFromTileScopeItems(items);
    expect(next.find(r => r.id === 'waterproofing')?.state).toBe('included');
  });

  test('syncWaterproofingFromTileScopeItems does not override explicit No', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'waterproofing',
        label: 'Waterproofing',
        inputType: 'yes_no',
        state: 'excluded',
      },
      {
        id: 'shower_tile',
        label: 'Shower wall tile',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncWaterproofingFromTileScopeItems(items);
    expect(next.find(r => r.id === 'waterproofing')?.state).toBe('excluded');
  });

  test('syncWetAreaTileScopeItems includes waterproofing when wall stepper is set', () => {
    const items: ScopeChecklistItem[] = [
      ...baseItems,
      {
        id: 'waterproofing',
        label: 'Waterproofing',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncWetAreaTileScopeItems(items, {
      bathCount: 1,
      showerWallTileSqft: '80',
    });
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find(r => r.id === 'waterproofing')?.state).toBe('included');
  });

  test('syncWetAreaScopeFromSteppers includes shower floor tile when tile pan stepper set', () => {
    const next = syncWetAreaScopeFromSteppers(baseItems, {
      counts: {
        bathCount: 1,
        tilePanBathCount: 1,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
      showerFloorTileSqft: '15',
    });
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe(
      'included'
    );
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
      ...baseItems.map(row =>
        row.id === 'shower_floor_tile'
          ? { ...row, state: 'included' as const }
          : row
      ),
    ];
    const next = syncWetAreaScopeFromSteppers(items, {
      counts: {
        bathCount: 1,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
      keepingExisting: true,
      showerFloorTileSqft: '15',
    });
    expect(next.find(r => r.id === 'wet_area_install')?.choiceId).toBe(
      'staying'
    );
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
    expect(next.find(r => r.id === 'shower_floor_tile')?.state).toBe(
      'excluded'
    );
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
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(next.find(r => r.id === 'wet_area_install')?.choiceId).toBe(
      'not_in_scope'
    );
    expect(next.find(r => r.id === 'shower_pan')).toBeUndefined();
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
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(next.find(r => r.id === 'wet_area_install')?.choiceId).toBe(
      'not_in_scope'
    );
    expect(next.find(r => r.id === 'shower_pan')).toBeUndefined();
    expect(next.find(r => r.id === 'shower_tile')?.state).toBe('included');
  });

  test('syncWetAreaDemoScopeItems includes tub_demo and generic demo', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'tub_demo',
        label: 'Remove tub',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'shower_floor_demo',
        label: 'Remove shower floor',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'floor_demo',
        label: 'Remove floor',
        inputType: 'yes_no',
        state: 'unsure',
      },
      { id: 'demo', label: 'Demo', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoTubCount: 1, demoTileWallCount: 1, demoTilePanCount: 1 },
    });
    expect(next.find(r => r.id === 'tub_demo')?.state).toBe('included');
    expect(next.find(r => r.id === 'shower_floor_demo')?.state).toBe(
      'included'
    );
    expect(next.find(r => r.id === 'demo')?.state).toBe('included');
  });

  test('syncWetAreaDemoScopeItems includes floor_demo from bath floor demo stepper', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'floor_demo',
        label: 'Remove floor',
        inputType: 'yes_no',
        state: 'unsure',
      },
      { id: 'demo', label: 'Demo', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoBathFloorTileCount: 1 },
    });
    expect(next.find(r => r.id === 'floor_demo')?.state).toBe('included');
    expect(next.find(r => r.id === 'demo')?.state).toBe('unsure');
  });

  test('syncBathroomFloorTileScopeItems includes floor_tile when bath floor SF set', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'floor_tile',
        label: 'Bath floor tile',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncBathroomFloorTileScopeItems(items, {
      bathroomFloorSqft: '45',
    });
    expect(next.find(r => r.id === 'floor_tile')?.state).toBe('included');
  });

  test('syncBathroomFloorTileScopeItems includes floor_tile when Tile bath floor stepper set', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'floor_tile',
        label: 'Bath floor tile',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncBathroomFloorTileScopeItems(items, {
      bathFloorTileCount: 1,
    });
    expect(next.find(r => r.id === 'floor_tile')?.state).toBe('included');
  });

  test('syncBathroomFloorTileScopeItems preserves note-backed floor tile when SF is missing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'floor_tile',
        label: 'Bath floor tile',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
    ];
    const next = syncBathroomFloorTileScopeItems(items, {
      bathroomFloorSqft: null,
    });
    expect(next.find(r => r.id === 'floor_tile')?.state).toBe('included');
  });

  test('syncBathroomFloorTileScopeItems keeps floor_tile when stepper on even if SF empty', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'floor_tile',
        label: 'Bath floor tile',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncBathroomFloorTileScopeItems(items, {
      bathroomFloorSqft: null,
      bathFloorTileCount: 1,
    });
    expect(next.find(r => r.id === 'floor_tile')?.state).toBe('included');
  });

  test('syncWetAreaDemoScopeItems excludes tub_demo when QM override clears tub', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'tub_demo',
        label: 'Remove tub',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoTubCount: null },
      demoOverrides: { demoTubCount: true },
    });
    expect(next.find(r => r.id === 'tub_demo')?.state).toBe('excluded');
  });

  test('syncWetAreaDemoScopeItems uses enclosure demo instead of shower pan card', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'shower_floor_demo',
        label: 'Remove shower floor',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'shower_enclosure_demo',
        label: 'Remove enclosure',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoPrefabEnclosureCount: 1 },
      demoOverrides: { demoPrefabEnclosureCount: true },
    });
    expect(next.find(r => r.id === 'shower_floor_demo')?.state).toBe(
      'excluded'
    );
    expect(next.find(r => r.id === 'shower_enclosure_demo')?.state).toBe(
      'included'
    );
  });

  test('syncWetAreaDemoScopeItems includes glass_door_demo from shower door tear-out', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'glass_door_demo',
        label: 'Remove shower door',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'glass_door',
        label: 'Shower door install',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoShowerDoorCount: 1 },
      demoShowerDoorCount: 1,
      installShowerDoorCount: null,
      demoOverrides: { demoShowerDoorCount: true },
    });
    expect(next.find(r => r.id === 'glass_door_demo')?.state).toBe('included');
    expect(next.find(r => r.id === 'glass_door')?.state).toBe('excluded');
  });

  test('syncWetAreaDemoScopeItems clears floor_demo Yes when bath floor demo stepper off', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'floor_demo',
        label: 'Remove floor',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
    ];
    const next = syncWetAreaDemoScopeItems(items, {
      demo: { demoBathFloorTileCount: null },
    });
    expect(next.find(r => r.id === 'floor_demo')?.state).toBe('unsure');
  });

  test('syncInteriorPaintScopeItems includes paint when wallPaintSqft is set', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'paint',
        label: 'Interior painting',
        inputType: 'yes_no',
        state: 'unsure',
      },
      { id: 'trim', label: 'Trim', inputType: 'yes_no', state: 'unsure' },
    ];
    const next = syncInteriorPaintScopeItems(items, { wallPaintSqft: '100' });
    expect(next.find(r => r.id === 'paint')?.state).toBe('included');
    expect(next.find(r => r.id === 'trim')?.state).toBe('unsure');
  });

  test('syncInteriorPaintScopeItems includes each measured painting scope row', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'trim_paint', label: 'Trim', inputType: 'yes_no', state: 'unsure' },
      {
        id: 'door_paint',
        label: 'Doors',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'cabinet_paint',
        label: 'Cabinets',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      baseboardLf: '200',
      interiorDoorCount: '6',
      cabinetPaintSqft: '200',
    });
    expect(next.every(row => row.state === 'included')).toBe(true);
  });

  test('opening counts include exterior prep without inferring exterior painting', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'exterior_prep', label: 'Exterior Prep & Masking', inputType: 'yes_no', state: 'unsure' },
      { id: 'exterior_paint', label: 'Exterior Paint', inputType: 'yes_no', state: 'included' },
      { id: 'exterior_trim_paint', label: 'Window trim & finish', inputType: 'yes_no', state: 'included' },
    ];

    const next = syncInteriorPaintScopeItems(items, {
      windowCount: 8,
      exteriorDoorCount: 2,
      notes: 'Replace 8 windows and 2 exterior swing doors.',
    });

    expect(next.find(row => row.id === 'exterior_prep')?.state).toBe('included');
    expect(next.find(row => row.id === 'exterior_paint')?.state).toBe('unsure');
    expect(next.find(row => row.id === 'exterior_trim_paint')?.state).toBe('unsure');
  });

  test('explicit exterior painting still includes prep and trim finish', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'exterior_prep', label: 'Exterior Prep & Masking', inputType: 'yes_no', state: 'unsure' },
      { id: 'exterior_paint', label: 'Exterior Paint', inputType: 'yes_no', state: 'unsure' },
      { id: 'exterior_trim_paint', label: 'Window trim & finish', inputType: 'yes_no', state: 'unsure' },
    ];

    const next = syncInteriorPaintScopeItems(items, {
      windowCount: 8,
      exteriorDoorCount: 2,
      paintScope: ['exterior'],
      notes: 'Paint the exterior siding and window trim.',
    });

    expect(next.every(row => row.state === 'included')).toBe(true);
  });

  test('splits walls and ceilings without retaining a generic paint card', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'paint',
        label: 'Interior painting',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'interior_paint',
        label: 'Interior paint — walls & ceilings',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'ceiling_paint',
        label: 'Interior paint — ceilings',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      wallPaintSqft: 4180,
      ceilingPaintSqft: 1900,
      paintPricingMethod: 'separate',
    });

    expect(next.some(row => row.id === 'paint')).toBe(false);
    expect(next.find(row => row.id === 'interior_paint')).toEqual(
      expect.objectContaining({
        state: 'included',
        label: 'Interior paint — walls',
      })
    );
    expect(next.find(row => row.id === 'ceiling_paint')?.state).toBe(
      'included'
    );
  });

  test('syncInteriorPaintScopeItems splits bathroom paint and patch cards', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'paint_repair',
        label: 'Paint repair',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'interior_paint',
        label: 'Interior paint',
        inputType: 'yes_no',
        state: 'included',
      },
      { id: 'paint', label: 'Paint', inputType: 'yes_no', state: 'included' },
    ];
    const next = syncInteriorPaintScopeItems(items, { wallPaintSqft: '384' });
    expect(next.find(r => r.id === 'paint_repair')).toBeUndefined();
    expect(next.find(r => r.id === 'interior_paint')?.state).toBe('included');
    expect(next.find(r => r.id === 'patch_repair')?.state).toBe('excluded');
    expect(next.find(r => r.id === 'paint')?.state).toBe('excluded');
  });

  test('shows the patch card only when patch sqft is measured', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'paint_repair',
        label: 'Paint repair',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      wallPaintSqft: '384',
      patchRepairSqft: '25',
    });
    expect(next.find(r => r.id === 'patch_repair')?.state).toBe('included');
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
    expect(next.find(r => r.id === 'wet_area_install')?.choiceId).toBe(
      'not_in_scope'
    );
    expect(next.find(r => r.id === 'shower_pan')).toBeUndefined();
  });
});
