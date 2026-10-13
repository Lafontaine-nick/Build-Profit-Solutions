import {
  applyExistingFeaturesToMeasurements,
  emptyWetAreaExistingCounts,
  inferExistingWetAreaFromNotes,
  mergeDemoCountsWithOverrides,
  reconcileExistingWetAreaCounts,
  resolveAutoDemoWetAreaCounts,
  resolveDemoWetAreaFromIntent,
  resolveEffectiveExistingWetArea,
  showerDoorReuseOffered,
  wetAreaFloorDoorHeading,
} from '../../utils/wetAreaExistingDemo';
import { inferWetAreaInstallSteppersFromIntent } from '../../utils/wetAreaInstallInference';

describe('wetAreaExistingDemo', () => {
  test('resolveAutoDemoWetAreaCounts clears demo when keeping existing', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingTubCount: 1, existingTileWallCount: 1 },
      install: { bathCount: 1, tilePanBathCount: 1 },
      keepingExisting: true,
    });
    expect(demo.demoTubCount).toBeNull();
    expect(demo.demoTileWallCount).toBeNull();
  });

  test('tub demo when existing tub and any new wet install', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingTubCount: 1 },
      install: { tilePanBathCount: 1 },
    });
    expect(demo.demoTubCount).toBe(1);
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('tub alcove suppresses false tile pan existing and demo', () => {
    const existing = reconcileExistingWetAreaCounts({
      existingTubCount: 1,
      existingTileWallCount: 1,
      existingTilePanCount: 1,
    });
    expect(existing.existingTilePanCount).toBeNull();

    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Tub to tile shower — demo tub and tile surround, install tile pan.',
      existing,
      install: {
        bathCount: 1,
        tilePanBathCount: 1,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTubCount).toBe(1);
    expect(demo.demoTileWallCount).toBe(1);
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('photo features drop tile pan when tub is detected', () => {
    const next = applyExistingFeaturesToMeasurements({}, [
      { feature: 'tub', confidence: 0.9 },
      { feature: 'tile_shower_walls', confidence: 0.85 },
      { feature: 'tile_shower_pan', confidence: 0.7 },
    ]);
    expect(next.existingTubCount).toBe(1);
    expect(next.existingTileWallCount).toBe(1);
    expect(next.existingTilePanCount).toBeNull();
  });

  test('tile wall demo only when replacing tile walls', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingTileWallCount: 1 },
      install: { bathCount: 1 },
    });
    expect(demo.demoTileWallCount).toBe(1);
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('shower door demo skipped when reusing existing door', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingShowerDoorCount: 1 },
      install: { showerDoorCount: 1 },
      reuseExistingShowerDoor: true,
    });
    expect(demo.demoShowerDoorCount).toBeNull();
  });

  test('manual demo overrides win over auto', () => {
    const auto = resolveAutoDemoWetAreaCounts({
      existing: { existingTubCount: 1 },
      install: { bathCount: 1 },
    });
    const merged = mergeDemoCountsWithOverrides({
      auto,
      stored: { demoTubCount: null },
      overrides: { demoTubCount: true },
    });
    expect(merged.demoTubCount).toBeNull();
  });

  test('demo tub when photo existing tub and notes say demo existing shower', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Demo existing shower and tile the walls.',
      existing: { existingTubCount: 1, existingTileWallCount: 1 },
      install: { bathCount: null, tilePanBathCount: null, prefabBathCount: null, prefabEnclosureBathCount: null, tubBathCount: null, bathFloorTileCount: null, showerDoorCount: null },
    });
    expect(demo.demoTubCount).toBe(1);
    expect(demo.demoTileWallCount).toBe(1);
  });

  test('demo shower door when tear-out lists the old door with the tile and pan', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile, the tile shower pan, and the old shower door. Haul off the debris. Install new shower wall tile and a new tile shower pan. Frame, waterproof, and tile a shower niche in the side wall, and build a tiled shower bench on the back wall. Waterproof the shower walls with backer board and a membrane before the tile goes on. Install a new shower door after the tile is done. Leave the bathroom floor, vanity, and toilet. No paint.';
    const existing = inferExistingWetAreaFromNotes(notes);
    expect(existing.existingShowerDoorCount).toBe(1);
    const demo = resolveDemoWetAreaFromIntent({
      notes,
      existing,
      install: {
        bathCount: null,
        tilePanBathCount: 1,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: 1,
      },
    });
    expect(demo.demoShowerDoorCount).toBe(1);
    expect(demo.demoBathFloorTileCount).toBeNull();
    expect(
      showerDoorReuseOffered({
        notes,
        existingShowerDoorCount: existing.existingShowerDoorCount,
      })
    ).toBe(false);
  });

  test('names the wet-area section for the fields on the card', () => {
    expect(
      wetAreaFloorDoorHeading({ showFloor: false, showDoors: true })
    ).toBe('SHOWER DOORS');
    expect(
      wetAreaFloorDoorHeading({ showFloor: true, showDoors: true })
    ).toBe('BATH FLOOR & DOORS');
    expect(
      wetAreaFloorDoorHeading({ showFloor: true, showDoors: false })
    ).toBe('BATH FLOOR');
  });

  test('a kept shower door still tears out the pan and offers reuse', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile and the tile shower pan. Install new shower wall tile and a new tile shower pan. Keep the existing shower door. Leave the bathroom floor, vanity, and toilet. No paint.';
    const existing = inferExistingWetAreaFromNotes(notes);
    const demo = resolveDemoWetAreaFromIntent({
      notes,
      existing,
      install: {
        bathCount: 1,
        tilePanBathCount: 1,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTilePanCount).toBe(1);
    expect(demo.demoShowerDoorCount).toBeNull();
    expect(
      showerDoorReuseOffered({
        notes,
        existingShowerDoorCount: existing.existingShowerDoorCount,
      })
    ).toBe(true);
  });

  test('offers reuse when an existing door is not coming out', () => {
    expect(
      showerDoorReuseOffered({
        notes: 'Existing shower door stays. Paint the bathroom walls.',
        existingShowerDoorCount: 1,
      })
    ).toBe(true);
  });

  test('a new shower door in the same sentence as other tear-out is not a door pull', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Tear out the shower walls and install a new shower door.',
      existing: emptyWetAreaExistingCounts(),
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: 1,
      },
    });
    expect(demo.demoShowerDoorCount).toBeNull();
  });

  test('demo shower door only when notes mention removing existing door', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Remove existing shower door and install new glass door.',
      existing: { existingShowerDoorCount: 1 },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: 1,
      },
    });
    expect(demo.demoShowerDoorCount).toBe(1);
  });

  test('no demo shower door when installing first door without remove language', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Install new shower door.',
      existing: { existingShowerDoorCount: 1 },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: 1,
      },
    });
    expect(demo.demoShowerDoorCount).toBeNull();
  });

  test('glass_door scope does not infer existing shower door for demo', () => {
    const existing = resolveEffectiveExistingWetArea({
      measurements: {},
      notes: '',
      hasSitePhotos: true,
      glassDoorIncluded: true,
    });
    expect(existing.existingShowerDoorCount).toBeNull();
  });

  test('no demo when existing unknown and notes vague', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Bathroom remodel.',
      existing: emptyWetAreaExistingCounts(),
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTubCount).toBeNull();
    expect(demo.demoTileWallCount).toBeNull();
  });

  test('install steppers select matching demo without existing', () => {
    const emptyInstall = {
      bathCount: null,
      tilePanBathCount: null,
      prefabBathCount: null,
      prefabEnclosureBathCount: null,
      tubBathCount: null,
      bathFloorTileCount: null,
      showerDoorCount: null,
    };
    expect(
      resolveAutoDemoWetAreaCounts({
        existing: emptyWetAreaExistingCounts(),
        install: { ...emptyInstall, bathCount: 1 },
      }).demoTileWallCount
    ).toBe(1);
    expect(
      resolveAutoDemoWetAreaCounts({
        existing: emptyWetAreaExistingCounts(),
        install: { ...emptyInstall, tilePanBathCount: 1 },
      }).demoTilePanCount
    ).toBe(1);
    expect(
      resolveAutoDemoWetAreaCounts({
        existing: emptyWetAreaExistingCounts(),
        install: { ...emptyInstall, prefabBathCount: 1 },
      }).demoPrefabPanCount
    ).toBe(1);
    expect(
      resolveAutoDemoWetAreaCounts({
        existing: emptyWetAreaExistingCounts(),
        install: { ...emptyInstall, prefabEnclosureBathCount: 1 },
      }).demoPrefabEnclosureCount
    ).toBe(1);
    expect(
      resolveAutoDemoWetAreaCounts({
        existing: emptyWetAreaExistingCounts(),
        install: { ...emptyInstall, tubBathCount: 1 },
      }).demoTubCount
    ).toBe(1);
    expect(
      resolveAutoDemoWetAreaCounts({
        existing: emptyWetAreaExistingCounts(),
        install: { ...emptyInstall, showerDoorCount: 1 },
      }).demoShowerDoorCount
    ).toBeNull();
  });

  test('haul-off prefab pan and surround selects both removals and both installs', () => {
    const notes =
      'Remodel the bathroom. The existing shower is a prefab shower pan with a prefab surround, and both are coming out. Demo and haul off the prefab shower pan and the prefab surround, cap the drain, and leave the alcove ready. Install a new prefab shower pan, set it in mortar, and connect it to the existing drain. Install a new prefab shower surround on the walls.';
    const existing = inferExistingWetAreaFromNotes(notes);
    const install = inferWetAreaInstallSteppersFromIntent({ notes });
    const demo = resolveDemoWetAreaFromIntent({ notes, existing, install });
    expect(existing.existingPrefabPanCount).toBe(1);
    expect(existing.existingPrefabEnclosureCount).toBe(1);
    expect(install.prefabBathCount).toBe(1);
    expect(install.prefabEnclosureBathCount).toBe(1);
    expect(install.tilePanBathCount).toBeNull();
    expect(demo.demoPrefabPanCount).toBe(1);
    expect(demo.demoPrefabEnclosureCount).toBe(1);
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('bath floor stepper selects remove bathroom floor without existing', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: emptyWetAreaExistingCounts(),
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: 1,
        showerDoorCount: null,
      },
    });
    expect(demo.demoBathFloorTileCount).toBe(1);
  });

  test('resolveEffectiveExistingWetArea merges photo measurements and notes', () => {
    const existing = resolveEffectiveExistingWetArea({
      measurements: { existingTubCount: 1 },
      notes: 'Existing tile surround and shower door.',
      hasSitePhotos: true,
    });
    expect(existing.existingTubCount).toBe(1);
    expect(existing.existingTileWallCount).toBe(1);
    expect(existing.existingShowerDoorCount).toBe(1);
  });

  test('emptyWetAreaExistingCounts returns all null', () => {
    expect(emptyWetAreaExistingCounts()).toEqual({
      existingTubCount: null,
      existingTileWallCount: null,
      existingTilePanCount: null,
      existingPrefabPanCount: null,
      existingPrefabEnclosureCount: null,
      existingShowerDoorCount: null,
      existingBathFloorTileCount: null,
    });
  });

  test('bath floor tile demo when installing new floor tile with existing floor', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Retile bathroom floor.',
      existing: { existingBathFloorTileCount: 1 },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
      floorTileIncluded: true,
      bathroomFloorSqft: '45',
    });
    expect(demo.demoBathFloorTileCount).toBe(1);
  });

  test('mud pan install demos existing prefab pan (conversion)', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingPrefabPanCount: 1, existingTileWallCount: 1 },
      install: {
        bathCount: 1,
        tilePanBathCount: 1,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTileWallCount).toBe(1);
    expect(demo.demoPrefabPanCount).toBe(1);
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('prefab pan install demos existing tile pan (conversion)', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingTilePanCount: 1 },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: 1,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTilePanCount).toBe(1);
    expect(demo.demoPrefabPanCount).toBeNull();
  });

  test('bath floor stepper demos existing bath floor', () => {
    const demo = resolveAutoDemoWetAreaCounts({
      existing: { existingBathFloorTileCount: 1 },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: 1,
        showerDoorCount: null,
      },
    });
    expect(demo.demoBathFloorTileCount).toBe(1);
  });

  test('bathroom floor SF alone does not imply bath floor demo', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: '',
      existing: emptyWetAreaExistingCounts(),
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
      bathroomFloorSqft: '45',
      floorDemoIncluded: true,
      floorTileIncluded: true,
    });
    expect(demo.demoBathFloorTileCount).toBeNull();
  });

  test('shower-only notes do not auto-demo bathroom floor', () => {
    const notes =
      'Demo shower walls, demo prefab shower pan, and tile shower walls, and tile shower pan. Install soap niche.';
    const existing = inferExistingWetAreaFromNotes(notes);
    const install = inferWetAreaInstallSteppersFromIntent({ notes });
    const demo = resolveDemoWetAreaFromIntent({
      notes,
      existing,
      install,
      floorDemoIncluded: true,
      floorTileIncluded: true,
      bathroomFloorSqft: '40',
    });
    expect(demo.demoPrefabPanCount).toBe(1);
    expect(demo.demoTileWallCount).toBe(1);
    expect(demo.demoBathFloorTileCount).toBeNull();
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('demo shower walls notes select wall demo without install steppers', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: 'Demo shower walls and demo prefab shower pan.',
      existing: { existingPrefabPanCount: 1 },
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTileWallCount).toBe(1);
    expect(demo.demoPrefabPanCount).toBe(1);
  });

  test('maps common bathroom remodel tear-out wording from notes', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes:
        'Remove the vanity, toilet, flooring, shower surround, and plumbing fixtures. Install a new tile shower and bathroom floor tile.',
      existing: {},
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        bathFloorTileCount: null,
        showerDoorCount: null,
      },
    });
    expect(demo.demoTileWallCount).toBe(1);
    expect(demo.demoBathFloorTileCount).toBe(1);
  });

  test('photo bath_floor_tile feature seeds existing count', () => {
    const next = applyExistingFeaturesToMeasurements({}, [
      { feature: 'bath_floor_tile', confidence: 0.9 },
    ]);
    expect(next.existingBathFloorTileCount).toBe(1);
  });

  test('applyExistingFeaturesToMeasurements seeds counts from photo features', () => {
    const next = applyExistingFeaturesToMeasurements({}, [
      { feature: 'tub', confidence: 0.9 },
      { feature: 'tile_shower_walls', confidence: 0.2 },
    ]);
    expect(next.existingTubCount).toBe(1);
    expect(next.existingTileWallCount).toBeNull();
  });

  test('demo prefab pan + install tile pan notes do not mark existing tile pan', () => {
    const notes =
      'Demo shower walls, demo prefab shower pan, and tile shower walls, and tile shower pan. Install soap niche.';
    const existing = inferExistingWetAreaFromNotes(notes);
    expect(existing.existingPrefabPanCount).toBe(1);
    expect(existing.existingTilePanCount).toBeNull();
    expect(existing.existingTileWallCount).toBeNull();

    const install = inferWetAreaInstallSteppersFromIntent({ notes });
    expect(install.bathCount).toBe(1);
    expect(install.tilePanBathCount).toBe(1);
    expect(install.prefabBathCount).toBeNull();

    const demo = resolveDemoWetAreaFromIntent({
      notes,
      existing,
      install,
    });
    expect(demo.demoPrefabPanCount).toBe(1);
    expect(demo.demoTilePanCount).toBeNull();
  });

  test('notes demo prefab pan wins over photo tile_shower_pan mis-tag', () => {
    const notes = 'Demo prefab shower pan and tile shower pan.';
    const existing = resolveEffectiveExistingWetArea({
      measurements: { existingTilePanCount: 1 },
      notes,
      hasSitePhotos: true,
    });
    expect(existing.existingPrefabPanCount).toBe(1);
    expect(existing.existingTilePanCount).toBeNull();
  });
});
