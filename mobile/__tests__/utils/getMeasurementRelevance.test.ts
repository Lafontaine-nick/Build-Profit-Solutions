import { getMeasurementRelevance } from '@/utils/getMeasurementRelevance';

describe('getMeasurementRelevance', () => {
  test('core structural measurements are always relevant, regardless of included scopes', () => {
    for (const key of [
      'floorAreaSqft',
      'garageSqft',
      'deckSqft',
      'flooringSqft',
    ]) {
      const result = getMeasurementRelevance({
        measurementKey: key,
        includedScopeKeys: [],
      });
      expect(result.relevant).toBe(true);
    }
  });

  test('living area is hidden on trade-specific templates like concrete', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'floorAreaSqft',
        includedScopeKeys: [],
        templateKey: 'concrete',
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'floorAreaSqft',
        includedScopeKeys: [],
        templateKey: 'excavation',
      }).relevant
    ).toBe(false);
  });

  test('kitchen floor hides when kitchen flooring work is deselected', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'kitchenFloorSqft',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'kitchenFloorSqft',
        includedScopeKeys: ['flooring'],
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'kitchenFloorSqft',
        includedScopeKeys: [],
        noteBackedKeys: ['kitchenFloorSqft'],
      }).relevant
    ).toBe(false);
  });

  test('kitchen notes do not request generic whole-home measurements', () => {
    const notes =
      'Remodel an existing kitchen without changing the footprint. Install 42 linear feet of new cabinets, 55 sqft of quartz countertops, and 35 sqft of backsplash tile. Include flooring protection, demolition, disposal, and cleanup. No wall removal or structural framing.';
    for (const measurementKey of [
      'floorAreaSqft',
      'flooringSqft',
      'kitchenFloorSqft',
      'drywallSqft',
      'baseboardLf',
      'wallPaintSqft',
      'ceilingPaintSqft',
    ] as const) {
      expect(
        getMeasurementRelevance({
          measurementKey,
          includedScopeKeys: ['flooring', 'drywall', 'trim', 'paint'],
          templateKey: 'kitchen',
          projectType: 'kitchen',
          notes,
        }).relevant
      ).toBe(false);
    }
    expect(
      getMeasurementRelevance({
        measurementKey: 'backsplashSqft',
        includedScopeKeys: ['backsplash'],
        templateKey: 'kitchen',
        projectType: 'kitchen',
        notes,
      }).relevant
    ).toBe(true);
  });

  test('backsplash is relevant for needs confirmation when selected', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'backsplashSqft',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'backsplashSqft',
        includedScopeKeys: ['backsplash'],
      }).relevant
    ).toBe(true);
  });

  test('kitchen cross-trade notes expose drywall and wall insulation measurements', () => {
    const notes =
      'Update the kitchen with drywall, insulation, windows, an exterior door, and paint.';
    for (const measurementKey of [
      'drywallSqft',
      'exteriorWallInsulationSqft',
    ] as const) {
      expect(
        getMeasurementRelevance({
          measurementKey,
          includedScopeKeys: [],
          templateKey: 'kitchen',
          projectType: 'kitchen',
          notes,
        }).relevant
      ).toBe(true);
    }
  });

  test('bath floor is scope-gated — not always relevant', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'bathroomFloorSqft',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'bathroomFloorSqft',
        includedScopeKeys: ['floor_tile'],
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'bathroomFloorSqft',
        includedScopeKeys: ['demo', 'shower_tile', 'waterproofing', 'drywall'],
        templateKey: 'bathroom',
        wetAreaFinish: 'prefab',
      }).relevant
    ).toBe(false);
  });

  test('shower measurements are only relevant when shower/waterproofing scope is included', () => {
    const excluded = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['drywall'],
    });
    expect(excluded.relevant).toBe(false);

    const included = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['shower_tile'],
    });
    expect(included.relevant).toBe(true);
    expect(included.blockingPrice).toBe(true);
  });

  test('cabinets are only relevant when cabinets scope is included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'cabinetLf',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'cabinetLf',
        includedScopeKeys: ['cabinets'],
      }).relevant
    ).toBe(true);
  });

  test('countertops are only relevant when countertops or combined cabinets_counters scope is included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'countertopSqft',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'countertopSqft',
        includedScopeKeys: ['countertops'],
      }).relevant
    ).toBe(true);
  });

  test('exterior paint is only relevant when exterior_paint scope is included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'exteriorPaintSqft',
        includedScopeKeys: ['paint'],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'exteriorPaintSqft',
        includedScopeKeys: ['exterior_paint'],
      }).relevant
    ).toBe(true);
  });

  test('roof squares are only relevant when a roofing scope is included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'roofSquares',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'roofSquares',
        includedScopeKeys: ['shingles_roofing'],
      }).relevant
    ).toBe(true);
  });

  test('foundation and excavation are only relevant when those scopes are included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'concreteCy',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'excavationCy',
        includedScopeKeys: [],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'concreteCy',
        includedScopeKeys: ['foundation'],
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'excavationCy',
        includedScopeKeys: ['excavation'],
      }).relevant
    ).toBe(true);
  });

  test('a note-backed measurement is relevant even when its scope item is not included', () => {
    const result = getMeasurementRelevance({
      measurementKey: 'cabinetLf',
      includedScopeKeys: [],
      noteBackedKeys: ['cabinetLf'],
    });
    expect(result.relevant).toBe(true);
  });

  test('reason explains why an irrelevant measurement is hidden', () => {
    const result = getMeasurementRelevance({
      measurementKey: 'cabinetLf',
      includedScopeKeys: [],
    });
    expect(result.reason).toMatch(/cabinets/i);
  });

  test('ground-up stage ids surface paint, tile, and cabinets measurements', () => {
    const paint = getMeasurementRelevance({
      measurementKey: 'wallPaintSqft',
      includedScopeKeys: ['paint_trim'],
    });
    expect(paint.relevant).toBe(true);

    const exteriorPaint = getMeasurementRelevance({
      measurementKey: 'exteriorPaintSqft',
      includedScopeKeys: ['paint_trim'],
    });
    expect(exteriorPaint.relevant).toBe(true);

    const shower = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['tile_flooring'],
    });
    expect(shower.relevant).toBe(true);

    const showerTub = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['tile_flooring'],
      wetAreaFinish: 'tub',
    });
    expect(showerTub.relevant).toBe(false);

    const showerWallPrefab = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['shower_tile'],
      wetAreaFinish: 'prefab',
    });
    expect(showerWallPrefab.relevant).toBe(true);

    const showerPrefab = getMeasurementRelevance({
      measurementKey: 'showerFloorTileSqft',
      includedScopeKeys: ['tile_flooring'],
      wetAreaFinish: 'prefab',
    });
    expect(showerPrefab.relevant).toBe(false);

    const showerTile = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['tile_flooring'],
      wetAreaFinish: 'tile',
    });
    expect(showerTile.relevant).toBe(true);

    const cabinets = getMeasurementRelevance({
      measurementKey: 'cabinetLf',
      includedScopeKeys: ['cabinets_counters'],
    });
    expect(cabinets.relevant).toBe(true);
  });

  test('baseboard LF is only relevant when trim/baseboard scope is included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'baseboardLf',
        includedScopeKeys: ['plumbing_trim'],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'baseboardLf',
        includedScopeKeys: ['trim'],
      }).relevant
    ).toBe(true);
  });

  test('plumbing quick measurements gate on included scope cards', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'waterLineLf',
        includedScopeKeys: ['plumbing_rough'],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'waterLineLf',
        includedScopeKeys: ['water_line'],
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'sewerLineLf',
        includedScopeKeys: ['plumbing_trim', 'water_line'],
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'plumbingRoughPointCount',
        includedScopeKeys: ['plumbing_rough'],
        noteBackedKeys: ['plumbingRoughPointCount'],
      }).relevant
    ).toBe(true);
  });

  test('shower floor SF is hidden when keeping existing tub/shower', () => {
    const staying = getMeasurementRelevance({
      measurementKey: 'showerFloorTileSqft',
      includedScopeKeys: ['shower_tile'],
      templateKey: 'bathroom',
      wetAreaInstallChoiceId: 'staying',
    });
    expect(staying.relevant).toBe(false);
    expect(staying.reason).toMatch(/keeping the existing tub/i);

    const wallsOnly = getMeasurementRelevance({
      measurementKey: 'showerWallTileSqft',
      includedScopeKeys: ['shower_tile'],
      templateKey: 'bathroom',
      bathCount: 1,
      keepingExistingWetArea: true,
    });
    expect(wallsOnly.relevant).toBe(true);
  });

  test('bathroom photo/notes hide shower SF when wall/pan steppers are off', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'showerWallTileSqft',
        includedScopeKeys: ['shower_tile'],
        templateKey: 'bathroom',
        bathCount: null,
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'showerWallTileSqft',
        includedScopeKeys: ['shower_tile'],
        templateKey: 'bathroom',
        bathCount: 1,
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'showerFloorTileSqft',
        includedScopeKeys: ['shower_floor_tile'],
        templateKey: 'bathroom',
        tilePanBathCount: null,
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'showerFloorTileSqft',
        includedScopeKeys: ['shower_floor_tile'],
        templateKey: 'bathroom',
        tilePanBathCount: 1,
      }).relevant
    ).toBe(true);
  });

  test('roofing accessory measurements are irrelevant until that scope chip is included', () => {
    expect(
      getMeasurementRelevance({
        measurementKey: 'roofDripEdgeLf',
        includedScopeKeys: [],
        templateKey: 'roofing',
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'roofDripEdgeLf',
        includedScopeKeys: ['drip_edge'],
        templateKey: 'roofing',
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'roofValleyFlashingLf',
        includedScopeKeys: ['tear_off', 'shingles_roofing'],
        templateKey: 'roofing',
      }).relevant
    ).toBe(false);
  });

  test('garage conversion hides new-build structure measurements', () => {
    const notes =
      'Convert 2-car garage to office/studio, about 400 sqft. Insulate walls and ceiling, drywall hang and finish, paint.';
    expect(
      getMeasurementRelevance({
        measurementKey: 'garageSqft',
        includedScopeKeys: [],
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes,
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'excavationCy',
        includedScopeKeys: ['framing', 'drywall', 'insulation'],
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes,
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'floorAreaSqft',
        includedScopeKeys: ['framing', 'drywall'],
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes,
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'exteriorPaintSqft',
        includedScopeKeys: ['exterior_finishes', 'paint'],
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes,
      }).relevant
    ).toBe(false);
  });
});
