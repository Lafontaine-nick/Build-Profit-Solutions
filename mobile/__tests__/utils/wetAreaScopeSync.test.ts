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
import { resolveDemoWetAreaFromIntent } from '@/utils/wetAreaExistingDemo';

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
  test('does not infer bathroom floor demo from fixture-only removal notes', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes:
        'Remove existing bathroom fixtures, then reroute 25 LF bathroom plumbing and install a toilet, vanity, faucet, shower valve, 90 sqft flooring.',
      existing: {
        existingTubCount: null,
        existingTileWallCount: null,
        existingTilePanCount: null,
        existingPrefabPanCount: null,
        existingPrefabEnclosureCount: null,
        existingShowerDoorCount: null,
        existingBathFloorTileCount: 1,
      },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
      bathroomFloorSqft: '90',
    });

    expect(demo.demoBathFloorTileCount).toBeNull();
  });

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

  test('reuse shower door cards follow the reuse chip', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'glass_door_reuse_remove',
        label: 'Remove existing shower door',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
      {
        id: 'glass_door_reuse_install',
        label: 'Reinstall existing shower door',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
    ];
    const hidden = syncWetAreaDemoScopeItems(items, {
      demo: {},
      reuseExistingShowerDoor: false,
    });
    expect(hidden.find(r => r.id === 'glass_door_reuse_remove')?.state).toBe(
      'excluded'
    );
    expect(hidden.find(r => r.id === 'glass_door_reuse_install')?.state).toBe(
      'excluded'
    );
    const shown = syncWetAreaDemoScopeItems(hidden, {
      demo: {},
      reuseExistingShowerDoor: true,
    });
    expect(shown.find(r => r.id === 'glass_door_reuse_remove')?.state).toBe(
      'included'
    );
    expect(shown.find(r => r.id === 'glass_door_reuse_install')?.state).toBe(
      'included'
    );
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
        state: 'included',
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

  test('does not infer door painting from doors that are only being installed', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'door_paint',
        label: 'Doors',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'interior_paint',
        label: 'Interior painting',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      interiorDoorCount: '2',
      notes: 'Install two interior doors and paint the ceiling.',
    });
    expect(next.find(row => row.id === 'door_paint')?.state).toBe('unsure');
  });

  test('opening counts include exterior prep without inferring exterior painting', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'exterior_prep',
        label: 'Exterior Prep & Masking',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'exterior_paint',
        label: 'Exterior Paint',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exterior_trim_paint',
        label: 'Window trim & finish',
        inputType: 'yes_no',
        state: 'included',
      },
    ];

    const next = syncInteriorPaintScopeItems(items, {
      windowCount: 8,
      exteriorDoorCount: 2,
      notes: 'Replace 8 windows and 2 exterior swing doors.',
    });

    expect(next.find(row => row.id === 'exterior_prep')?.state).toBe(
      'included'
    );
    expect(next.find(row => row.id === 'exterior_paint')?.state).toBe('unsure');
    expect(next.find(row => row.id === 'exterior_trim_paint')?.state).toBe(
      'unsure'
    );
  });

  test('a painting bid does not price exterior doors as window trim', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'exterior_paint',
        label: 'Exterior paint',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exterior_door_paint',
        label: 'Exterior door paint',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exterior_trim_paint',
        label: 'Window trim & finish',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      templateKey: 'painting',
      paintScope: ['walls', 'ceilings', 'doors', 'exterior'],
      exteriorDoorCount: '7',
      windowCount: '0',
    });
    expect(next.find(row => row.id === 'exterior_paint')?.state).toBe(
      'included'
    );
    expect(next.find(row => row.id === 'exterior_door_paint')?.state).toBe(
      'included'
    );
    expect(next.find(row => row.id === 'exterior_trim_paint')?.state).toBe(
      'excluded'
    );
  });

  test('an interior paint scope leaves exterior cards off until the chip is selected', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'exterior_prep',
        label: 'Exterior Prep & Masking',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'exterior_paint',
        label: 'Exterior Paint',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exterior_door_paint',
        label: 'Exterior door paint',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'interior_paint',
        label: 'Interior paint',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const notes =
      'Paint 2,000 sqft of walls and ceilings, including prep. Paint six interior doors, 180 LF of baseboard, and the door casings.';
    const off = syncInteriorPaintScopeItems(items, {
      paintScope: ['walls', 'ceilings', 'trim', 'doors'],
      paintAreaSqft: '2000',
      baseboardLf: '180',
      interiorDoorCount: '6',
      notes,
    });
    expect(off.find(row => row.id === 'exterior_paint')?.state).toBe(
      'excluded'
    );
    expect(off.find(row => row.id === 'exterior_prep')?.state).toBe(
      'excluded'
    );
    expect(off.find(row => row.id === 'exterior_door_paint')?.state).toBe(
      'excluded'
    );
    expect(off.find(row => row.id === 'interior_paint')?.state).toBe(
      'included'
    );

    const on = syncInteriorPaintScopeItems(items, {
      paintScope: ['walls', 'ceilings', 'trim', 'doors', 'exterior'],
      paintAreaSqft: '2000',
      notes,
    });
    expect(on.find(row => row.id === 'exterior_paint')?.state).toBe(
      'included'
    );
    expect(on.find(row => row.id === 'exterior_prep')?.state).toBe('included');
  });

  test('a painting bid selects cleanup until the user turns it off', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'cleanup',
        label: 'Cleanup & disposal',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const selected = syncInteriorPaintScopeItems(items, {
      templateKey: 'painting',
      paintScope: ['walls', 'ceilings', 'trim', 'doors'],
    });
    expect(selected.find(row => row.id === 'cleanup')?.state).toBe('included');

    const declined = syncInteriorPaintScopeItems(
      [{ ...items[0], state: 'excluded' }],
      { templateKey: 'painting', paintScope: ['walls'] }
    );
    expect(declined.find(row => row.id === 'cleanup')?.state).toBe('excluded');
  });

  test('combined walls and ceilings keep a single paint card', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'interior_paint',
        label: 'Interior paint — walls & ceilings',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'ceiling_paint',
        label: 'Interior paint — ceilings',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      templateKey: 'painting',
      paintScope: ['walls', 'ceilings'],
      paintPricingMethod: 'combined',
      paintAreaSqft: 1800,
    });

    expect(next.find(row => row.id === 'interior_paint')?.state).toBe(
      'included'
    );
    expect(next.find(row => row.id === 'ceiling_paint')?.state).toBe(
      'excluded'
    );
  });

  test('walls-only paint hides ceilings, doors, trim, and window cards', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'interior_paint',
        label: 'Interior paint — walls & ceilings',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'ceiling_paint',
        label: 'Interior paint — ceilings',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'door_paint',
        label: 'Interior door & frame painting',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'trim_paint',
        label: 'Baseboards, trim & molding',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'exterior_trim_paint',
        label: 'Window trim & finish',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'prep',
        label: 'Interior masking',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exterior_paint',
        label: 'Exterior Paint',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const notes =
      'Paint 1,200 sqft of interior walls and 900 sqft of exterior siding. Include prep. No ceilings, no doors, and no cabinets.';
    const next = syncInteriorPaintScopeItems(items, {
      templateKey: 'painting',
      paintScope: ['walls', 'exterior'],
      wallPaintSqft: 1200,
      exteriorPaintSqft: 900,
      notes,
    });

    expect(next.find(row => row.id === 'interior_paint')).toEqual(
      expect.objectContaining({
        state: 'included',
        label: 'Interior paint — walls',
      })
    );
    expect(next.find(row => row.id === 'prep')?.state).toBe('included');
    expect(next.find(row => row.id === 'exterior_paint')?.state).toBe(
      'included'
    );
    for (const id of [
      'ceiling_paint',
      'door_paint',
      'trim_paint',
      'exterior_trim_paint',
    ]) {
      expect(next.find(row => row.id === id)?.state).toBe('excluded');
    }
  });

  test('cabinet paint stays off until the cabinets chip is selected', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'cabinet_paint',
        label: 'Cabinets',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const off = syncInteriorPaintScopeItems(items, {
      paintScope: ['walls', 'ceilings', 'trim', 'doors'],
    });
    expect(off.find(row => row.id === 'cabinet_paint')?.state).toBe(
      'excluded'
    );
    const on = syncInteriorPaintScopeItems(items, {
      paintScope: ['walls', 'cabinets'],
    });
    expect(on.find(row => row.id === 'cabinet_paint')?.state).toBe('included');
  });

  test('exterior-only paint hides the interior painting cards', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'prep',
        label: 'Paint prep & masking',
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
      {
        id: 'exterior_prep',
        label: 'Exterior Prep & Masking',
        inputType: 'yes_no',
        state: 'included',
      },
      {
        id: 'exterior_paint',
        label: 'Exterior Paint',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const next = syncInteriorPaintScopeItems(items, {
      templateKey: 'painting',
      paintScope: ['exterior'],
      exteriorPaintSqft: 900,
      notes: 'Paint 900 sqft of exterior siding. Include prep.',
    });

    for (const id of ['prep', 'interior_paint', 'ceiling_paint']) {
      expect(next.find(row => row.id === id)?.state).toBe('excluded');
    }
    expect(next.find(row => row.id === 'exterior_prep')?.state).toBe(
      'included'
    );
    expect(next.find(row => row.id === 'exterior_paint')?.state).toBe(
      'included'
    );
  });

  test('explicit exterior painting still includes prep and trim finish', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'exterior_prep',
        label: 'Exterior Prep & Masking',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'exterior_paint',
        label: 'Exterior Paint',
        inputType: 'yes_no',
        state: 'unsure',
      },
      {
        id: 'exterior_trim_paint',
        label: 'Window trim & finish',
        inputType: 'yes_no',
        state: 'unsure',
      },
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
