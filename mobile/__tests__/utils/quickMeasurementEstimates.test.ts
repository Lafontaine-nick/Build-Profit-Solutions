import {
  formatSuggestedDisplayValue,
  getQuickMeasurementEstimate,
  syncMeasurementsWithSouthernUtahPlanFacts,
} from '@/utils/quickMeasurementEstimates';
import {
  LOT_41_PLAN_ROOMS,
  PLAN_MEASUREMENT_LOTS,
} from '@/testFixtures/planMeasurementLots';
import {
  quickMeasurementEstimateBadgeLabel,
  quickMeasurementSourceLabel,
} from '@/utils/quickMeasurementProvenance';

const FOOTPRINT_MEASUREMENTS = { floorAreaSqft: '1879', garageSqft: '994' };
const LOT_41 = PLAN_MEASUREMENT_LOTS['41'];

describe('getQuickMeasurementEstimate', () => {
  test('returns null when living area is unavailable', () => {
    expect(getQuickMeasurementEstimate('roofSquares', {})).toBeNull();
    expect(getQuickMeasurementEstimate('concreteCy', {})).toBeNull();
    expect(getQuickMeasurementEstimate('excavationCy', {})).toBeNull();
    expect(getQuickMeasurementEstimate('exteriorPaintSqft', {})).toBeNull();
    expect(getQuickMeasurementEstimate('drywallSqft', {})).toBeNull();
    expect(getQuickMeasurementEstimate('wallPaintSqft', {})).toBeNull();
  });

  test('roof squares uses footprint + pitch + waste, not living sqft directly', () => {
    const estimate = getQuickMeasurementEstimate(
      'roofSquares',
      FOOTPRINT_MEASUREMENTS
    );
    expect(estimate).not.toBeNull();
    expect(estimate!.unit).toBe('sq');
    expect(estimate!.value).toBeGreaterThan(30);
    expect(estimate!.value).toBeLessThan(38);
    expect(estimate!.value).not.toBe(18.79);
    expect(estimate!.summary).toMatch(/\d/);
    expect(estimate!.summary).not.toMatch(/suggested/i);
    expect(estimate!.basis).toMatch(/pitch/i);
    expect(estimate!.assumptions.length).toBeGreaterThan(0);
  });

  test('foundation CY includes footings, stem, and building slabs — and labels them as such', () => {
    const estimate = getQuickMeasurementEstimate(
      'concreteCy',
      FOOTPRINT_MEASUREMENTS
    );
    expect(estimate).not.toBeNull();
    expect(estimate!.unit).toBe('CY');
    expect(estimate!.value).toBeGreaterThan(0);
    expect(estimate!.value).toBeLessThan(100);
    expect(estimate!.quantityLabel).toMatch(/building slabs/i);
    expect(estimate!.assumptions.some(a => /footing/i.test(a))).toBe(true);
    expect(estimate!.assumptions.some(a => /stem wall/i.test(a))).toBe(true);
    expect(estimate!.assumptions.some(a => /slab/i.test(a))).toBe(true);
    expect(estimate!.assumptions.some(a => /flatwork|driveway/i.test(a))).toBe(
      true
    );
    expect(estimate!.basis).toMatch(/structural plans/i);
  });

  test('excavation CY uses footing-trench dig, not full-footprint × 4 ft', () => {
    const estimate = getQuickMeasurementEstimate(
      'excavationCy',
      FOOTPRINT_MEASUREMENTS
    );
    expect(estimate).not.toBeNull();
    expect(estimate!.unit).toBe('CY');
    expect(estimate!.value).toBeLessThan(200);
    expect(estimate!.value).toBeGreaterThan(50);
    expect(estimate!.formulaId).toBe('excavation_cy_from_footing_trench');
    expect(estimate!.basis).toMatch(/trench|footing/i);
    expect(estimate!.basis).toMatch(/not a full building dig/i);
    const allAssumptions = estimate!.assumptions.join(' ');
    expect(allAssumptions).toMatch(/trench/i);
    expect(allAssumptions).toMatch(/does not excavate the full building/i);
    expect(allAssumptions).toMatch(/rock excavation/i);
    expect(allAssumptions).toMatch(/haul-off|export/i);
  });

  test('exterior paint is derived from an estimated perimeter, not living sqft', () => {
    const estimate = getQuickMeasurementEstimate(
      'exteriorPaintSqft',
      FOOTPRINT_MEASUREMENTS
    );
    expect(estimate).not.toBeNull();
    expect(estimate!.unit).toBe('sqft');
    expect(estimate!.value).not.toBe(1879);
    expect(
      estimate!.assumptions.some(a => /wall-height|wall height/i.test(a))
    ).toBe(true);
  });

  test('drywall and interior paint estimates never equal living-area sqft directly', () => {
    const drywall = getQuickMeasurementEstimate('drywallSqft', {
      floorAreaSqft: '1879',
    });
    const paint = getQuickMeasurementEstimate('wallPaintSqft', {
      floorAreaSqft: '1879',
    });
    expect(drywall).not.toBeNull();
    expect(paint).not.toBeNull();
    expect(drywall!.value).not.toBe(1879);
    expect(paint!.value).not.toBe(1879);
    expect(drywall!.value).toBeGreaterThan(1879);
    expect(paint!.value).toBeGreaterThan(1879);
    expect(drywall!.summary).toMatch(/\d/);
    expect(drywall!.summary).not.toMatch(/suggested/i);
    expect(drywall!.basis).not.toMatch(/1,879 sqft living area ×/);
  });

  test('sync keeps a wall/ceiling drywall takeoff ahead of the living-area fallback', () => {
    const synced = syncMeasurementsWithSouthernUtahPlanFacts(
      {
        floorAreaSqft: 3098,
        drywallSqft: 4056,
        drywallWallSqft: 8200,
        drywallCeilingSqft: 3660,
        drywallOpeningDeductionSqft: 1017,
      },
      { templateKey: 'ground_up' }
    );

    expect(synced.drywallSqft).toBe(10843);
  });

  test('Lot 41 room perimeters + labeled wall height keep drywall/paint as Planning estimate', () => {
    const drywall = getQuickMeasurementEstimate(
      'drywallSqft',
      { ...LOT_41.measurements, planRooms: LOT_41_PLAN_ROOMS },
      LOT_41.facts
    )!;
    const paint = getQuickMeasurementEstimate(
      'wallPaintSqft',
      { ...LOT_41.measurements, planRooms: LOT_41_PLAN_ROOMS },
      LOT_41.facts
    )!;
    expect(drywall.formulaId).toBe('drywall_from_room_perimeters');
    expect(drywall.sourceType).toBe('estimated_from_formula');
    expect(drywall.confidence).toBe('medium');
    expect(quickMeasurementSourceLabel(drywall.sourceType)).toBe(
      'Planning estimate'
    );
    expect(drywall.summary).toMatch(/^\d{1,3}(,\d{3})* sqft$/);
    expect(drywall.summary).not.toMatch(/\.\d/);
    expect(
      drywall.calculationBreakdown.some(step => /ceiling/i.test(step.label))
    ).toBe(true);
    expect(
      drywall.calculationBreakdown.some(step => /wall/i.test(step.label))
    ).toBe(true);
    expect(paint.formulaId).toBe(
      'interior_paint_from_drywall_surface_estimate'
    );
    expect(paint.sourceType).toBe('estimated_from_formula');
    expect(paint.value).toBe(drywall.value);
    expect(paint.inputsUsed.basedOnDrywallSurfaceEstimate).toBe(drywall.value);
  });

  test('interior paint deducts tile, backsplash, and cabinet coverage', () => {
    const drywall = getQuickMeasurementEstimate(
      'drywallSqft',
      { ...LOT_41.measurements, planRooms: LOT_41_PLAN_ROOMS },
      LOT_41.facts
    )!;
    const paint = getQuickMeasurementEstimate(
      'wallPaintSqft',
      {
        ...LOT_41.measurements,
        planRooms: LOT_41_PLAN_ROOMS,
        showerWallTileSqft: '200',
        backsplashSqft: '40',
        cabinetLf: '24',
      },
      LOT_41.facts
    )!;
    expect(paint.value).toBe(drywall.value - 200 - 40 - 24 * 7);
    expect(paint.value).toBeLessThan(drywall.value);
    expect(
      paint.calculationBreakdown.some(step => /shower/i.test(step.label))
    ).toBe(true);
    expect(
      paint.calculationBreakdown.some(step => /backsplash/i.test(step.label))
    ).toBe(true);
    expect(
      paint.calculationBreakdown.some(step => /cabinet/i.test(step.label))
    ).toBe(true);
  });

  test('surface areas display as whole numbers; roof keeps one decimal', () => {
    expect(formatSuggestedDisplayValue(5468.7, 'sqft')).toBe('5,469 sqft');
    expect(formatSuggestedDisplayValue(1858.9, 'sqft')).toBe('1,859 sqft');
    expect(formatSuggestedDisplayValue(37.24, 'sq')).toBe('37.2 sq');
    expect(formatSuggestedDisplayValue(68.6, 'CY')).toBe('69 CY');
  });

  test('interior paint badge discloses drywall derivation', () => {
    const paint = getQuickMeasurementEstimate(
      'wallPaintSqft',
      { ...LOT_41.measurements, planRooms: LOT_41_PLAN_ROOMS },
      LOT_41.facts
    )!;
    expect(quickMeasurementEstimateBadgeLabel(paint)).toBe(
      'Planning estimate · derived from drywall surfaces'
    );
  });

  test('Lot 41 exterior paint upgrades only when perimeter and plate/wall height are labeled', () => {
    const estimate = getQuickMeasurementEstimate(
      'exteriorPaintSqft',
      LOT_41.measurements,
      {
        ...LOT_41.facts,
        exteriorPerimeterLf: 232,
      }
    )!;
    expect(estimate.sourceType).toBe('calculated_from_components');
    expect(estimate.confidence).toBe('medium');
    expect(estimate.inputsUsed.exteriorPerimeterLf).toBe(232);
    expect(estimate.inputsUsed.wallHeightFt).toBe(10.2);
    expect(quickMeasurementSourceLabel(estimate.sourceType)).toBe(
      'Footprint-based estimate'
    );
  });

  test('cabinets and countertops have no formula — always Needs confirmation upstream', () => {
    expect(
      getQuickMeasurementEstimate('cabinetLf', FOOTPRINT_MEASUREMENTS)
    ).toBeNull();
    expect(
      getQuickMeasurementEstimate('countertopSqft', FOOTPRINT_MEASUREMENTS)
    ).toBeNull();
  });

  test('shower tile stays null until wet-area finish is tile', () => {
    expect(
      getQuickMeasurementEstimate('showerWallTileSqft', FOOTPRINT_MEASUREMENTS)
    ).toBeNull();
    expect(
      getQuickMeasurementEstimate('showerFloorTileSqft', FOOTPRINT_MEASUREMENTS)
    ).toBeNull();
    expect(
      getQuickMeasurementEstimate('showerWallTileSqft', {
        ...FOOTPRINT_MEASUREMENTS,
        wetAreaFinish: 'tub',
        bathroomFloorSqft: '95',
      })
    ).toBeNull();

    const wall = getQuickMeasurementEstimate('showerWallTileSqft', {
      ...FOOTPRINT_MEASUREMENTS,
      wetAreaFinish: 'tile',
      bathCount: 1,
    });
    const floor = getQuickMeasurementEstimate('showerFloorTileSqft', {
      ...FOOTPRINT_MEASUREMENTS,
      wetAreaFinish: 'tile',
      bathCount: 2,
    });
    expect(wall).not.toBeNull();
    expect(wall!.value).toBe(80);
    expect(wall!.confidence).toBe('low');
    expect(wall!.formulaVersion).toBe('2.3.0');
    expect(floor!.value).toBe(30);
  });

  test('prefab pan keeps shower wall estimate but not shower floor tile SF', () => {
    expect(
      getQuickMeasurementEstimate('showerFloorTileSqft', {
        ...FOOTPRINT_MEASUREMENTS,
        wetAreaFinish: 'prefab',
        bathroomFloorSqft: '90',
      })
    ).toBeNull();
    const wall = getQuickMeasurementEstimate('showerWallTileSqft', {
      ...FOOTPRINT_MEASUREMENTS,
      wetAreaFinish: 'prefab',
      bathroomFloorSqft: '90',
    });
    expect(wall).not.toBeNull();
    expect(wall!.value).toBe(80);

    const wallFromWetAreaOnly = getQuickMeasurementEstimate(
      'showerWallTileSqft',
      { ...FOOTPRINT_MEASUREMENTS, wetAreaFinish: 'prefab' },
      undefined,
      'bathroom'
    );
    expect(wallFromWetAreaOnly).not.toBeNull();
    expect(wallFromWetAreaOnly!.value).toBe(80);
  });
});
