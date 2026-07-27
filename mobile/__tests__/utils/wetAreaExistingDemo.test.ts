import {
  applyExistingFeaturesToMeasurements,
  emptyWetAreaExistingCounts,
  mergeDemoCountsWithOverrides,
  reconcileExistingWetAreaCounts,
  resolveAutoDemoWetAreaCounts,
  resolveDemoWetAreaFromIntent,
  resolveEffectiveExistingWetArea,
} from '../../utils/wetAreaExistingDemo';

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
      install: { bathCount: null, tilePanBathCount: null, prefabBathCount: null, prefabEnclosureBathCount: null, tubBathCount: null, showerDoorCount: null },
    });
    expect(demo.demoTubCount).toBe(1);
    expect(demo.demoTileWallCount).toBe(1);
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
      install: { bathCount: 1, tilePanBathCount: 1, prefabBathCount: null, prefabEnclosureBathCount: null, tubBathCount: null, showerDoorCount: null },
    });
    expect(demo.demoTubCount).toBeNull();
    expect(demo.demoTileWallCount).toBeNull();
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
        showerDoorCount: null,
      },
      floorTileIncluded: true,
      bathroomFloorSqft: '45',
    });
    expect(demo.demoBathFloorTileCount).toBe(1);
  });

  test('bath floor tile demo when bathroom floor SF set without explicit existing', () => {
    const demo = resolveDemoWetAreaFromIntent({
      notes: '',
      existing: emptyWetAreaExistingCounts(),
      install: {
        bathCount: null,
        tilePanBathCount: null,
        prefabBathCount: null,
        prefabEnclosureBathCount: null,
        tubBathCount: null,
        showerDoorCount: null,
      },
      bathroomFloorSqft: '45',
    });
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
});
