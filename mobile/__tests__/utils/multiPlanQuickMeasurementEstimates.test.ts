import { PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';
import { getQuickMeasurementEstimate } from '@/utils/quickMeasurementEstimates';
import {
  acceptQuickMeasurementSuggestion,
  acceptReviewedQuickMeasurementSuggestions,
} from '@/utils/quickMeasurementProvenance';

const KEYS = [
  'roofSquares',
  'concreteCy',
  'excavationCy',
  'drywallSqft',
  'wallPaintSqft',
  'exteriorPaintSqft',
] as const;

describe('multi-plan measurement suggestions', () => {
  test.each(Object.values(PLAN_MEASUREMENT_LOTS))(
    'Lot $lot returns versioned, explainable suggestions with correct units',
    ({ measurements, facts, rooms }) => {
      const expectedUnits = {
        roofSquares: 'sq',
        concreteCy: 'CY',
        excavationCy: 'CY',
        drywallSqft: 'sqft',
        wallPaintSqft: 'sqft',
        exteriorPaintSqft: 'sqft',
      };
      for (const key of KEYS) {
        const estimate = getQuickMeasurementEstimate(
          key,
          { ...measurements, planRooms: rooms },
          facts
        );
        expect(estimate).not.toBeNull();
        expect(estimate!.unit).toBe(expectedUnits[key]);
        expect(estimate!.formulaVersion).toBe('2.3.0');
        expect(estimate!.calculationBreakdown.length).toBeGreaterThan(0);
        expect(estimate!.includedComponents.length).toBeGreaterThan(0);
        expect(estimate!.excludedComponents.length).toBeGreaterThan(0);
        expect(estimate!.requiresConfirmation).toBe(true);
      }
    }
  );

  test('multi-story roof and foundation use first-floor area, not total living area', () => {
    for (const lot of ['39', '58'] as const) {
      const fixture = PLAN_MEASUREMENT_LOTS[lot];
      const roof = getQuickMeasurementEstimate('roofSquares', fixture.measurements, fixture.facts)!;
      const foundation = getQuickMeasurementEstimate('concreteCy', fixture.measurements, fixture.facts)!;
      expect(roof.inputsUsed.projectedRoofAreaSqft).toBe(
        fixture.facts.buildingAreas!.mainFloorLivingSqft! +
          fixture.facts.buildingAreas!.garageSqft! +
          fixture.facts.buildingAreas!.coveredPatioSqft!
      );
      expect(foundation.inputsUsed.firstFloorLivingFootprintSqft).toBe(
        fixture.facts.buildingAreas!.mainFloorLivingSqft
      );
      expect(foundation.inputsUsed.firstFloorLivingFootprintSqft).not.toBe(
        fixture.facts.buildingAreas!.totalLivingSqft
      );
    }
  });

  test('covered patio roof and slab inclusion are explicit toggles', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['41'];
    const withRoof = getQuickMeasurementEstimate('roofSquares', fixture.measurements, fixture.facts)!;
    const withoutRoof = getQuickMeasurementEstimate('roofSquares', fixture.measurements, {
      ...fixture.facts,
      coveredPatioRoofed: false,
    })!;
    expect(withRoof.value).toBeGreaterThan(withoutRoof.value);
    expect(withRoof.includedComponents).toContain('Roofed covered patio');

    const withoutSlab = getQuickMeasurementEstimate('concreteCy', fixture.measurements, fixture.facts)!;
    const withSlab = getQuickMeasurementEstimate('concreteCy', fixture.measurements, {
      ...fixture.facts,
      includeCoveredPatioSlab: true,
    })!;
    expect(withSlab.value).toBeGreaterThan(withoutSlab.value);
    expect(withSlab.includedComponents).toContain('Covered patio slab');
    expect(withoutSlab.excludedComponents).toContain('Covered patio slab');
  });

  test('garage inclusion is stated and changes structural quantities', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['41'];
    const withGarage = getQuickMeasurementEstimate('concreteCy', fixture.measurements, fixture.facts)!;
    const withoutGarage = getQuickMeasurementEstimate(
      'concreteCy',
      { ...fixture.measurements, garageSqft: '' },
      {
        ...fixture.facts,
        buildingAreas: { ...fixture.facts.buildingAreas, garageSqft: null },
      }
    )!;
    expect(withGarage.value).toBeGreaterThan(withoutGarage.value);
    expect(withGarage.includedComponents).toContain('Garage slab');
  });

  test('excavation is shallow component logic and excludes site-risk costs', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['41'];
    const excavation = getQuickMeasurementEstimate('excavationCy', fixture.measurements, fixture.facts)!;
    expect(excavation.formulaId).toBe('excavation_cy_from_footing_trench');
    expect(excavation.inputsUsed.shallowPadCutDepthFt).toBe(0.5);
    expect(excavation.excludedComponents).toEqual(
      expect.arrayContaining(['Haul-off/export', 'Dump fees', 'Imported fill', 'Rock excavation'])
    );
    expect(excavation.value).toBeLessThan(200);
  });

  test('drywall and paint multiplier fallbacks remain low confidence', () => {
    const measurements = { floorAreaSqft: '1879', garageSqft: '994' };
    for (const key of ['drywallSqft', 'wallPaintSqft'] as const) {
      const estimate = getQuickMeasurementEstimate(key, measurements)!;
      expect(estimate.sourceType).toBe('fallback_multiplier');
      expect(estimate.confidence).toBe('low');
      expect(estimate.requiresConfirmation).toBe(true);
    }
  });

  test('floor-area drywall path stays a planning estimate without rooms', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['49'];
    const estimate = getQuickMeasurementEstimate('drywallSqft', fixture.measurements, fixture.facts)!;
    expect(estimate.sourceType).toBe('estimated_from_formula');
    expect(estimate.confidence).toBe('low');
    expect(estimate.formulaId).toBe('drywall_components_from_floor_areas');
  });

  test('Lot 41 room model keeps drywall as Planning; exterior needs perimeter for Calculated', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['41'];
    const drywall = getQuickMeasurementEstimate(
      'drywallSqft',
      { ...fixture.measurements, planRooms: fixture.rooms },
      fixture.facts
    )!;
    const exterior = getQuickMeasurementEstimate(
      'exteriorPaintSqft',
      fixture.measurements,
      fixture.facts
    )!;
    expect(drywall.sourceType).toBe('estimated_from_formula');
    expect(drywall.formulaId).toBe('drywall_from_room_perimeters');
    expect(drywall.inputsUsed.wallHeightFt).toBe(10.2);
    expect(drywall.summary).toBe(`${drywall.value.toLocaleString()} sqft`);
    expect(exterior.sourceType).toBe('estimated_from_formula');
    expect(exterior.inputsUsed.perimeterMeasured).toBe(false);

    const exteriorMeasured = getQuickMeasurementEstimate('exteriorPaintSqft', fixture.measurements, {
      ...fixture.facts,
      exteriorPerimeterLf: 232,
    })!;
    expect(exteriorMeasured.sourceType).toBe('calculated_from_components');
    expect(exteriorMeasured.inputsUsed.perimeterMeasured).toBe(true);
  });

  test('exterior paint deducts detected non-painted finishes', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['58'];
    const allPainted = getQuickMeasurementEstimate('exteriorPaintSqft', fixture.measurements, {
      ...fixture.facts,
      exteriorPerimeterLf: 240,
      wallHeightFt: 9,
      nonPaintedExteriorPercent: 0,
    })!;
    const withStone = getQuickMeasurementEstimate('exteriorPaintSqft', fixture.measurements, {
      ...fixture.facts,
      exteriorPerimeterLf: 240,
      wallHeightFt: 9,
      nonPaintedExteriorPercent: 25,
    })!;
    expect(withStone.value).toBeLessThan(allPainted.value);
    expect(withStone.calculationBreakdown.find((step) => step.label.includes('Non-painted'))!.value).toBeGreaterThan(0);
    expect(allPainted.sourceType).toBe('calculated_from_components');
  });

  test('supplied irregular polygon perimeter is used without rectangular collapse', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['49'];
    const facts = {
      ...fixture.facts,
      geometry: [
        {
          id: 'angled-foundation',
          kind: 'foundation' as const,
          areaSqft: 3954,
          perimeterLf: 390,
          points: [
            { x: 0, y: 0 },
            { x: 80, y: 0 },
            { x: 110, y: 30 },
            { x: 60, y: 70 },
            { x: 0, y: 40 },
          ],
        },
      ],
    };
    const foundation = getQuickMeasurementEstimate('concreteCy', fixture.measurements, facts)!;
    expect(foundation.inputsUsed.foundationPerimeterLf).toBe(390);
    expect(foundation.inputsUsed.foundationPerimeterLf).not.toBeCloseTo(
      4 * Math.sqrt(3954),
      1
    );
  });
});

describe('suggestion acceptance safety', () => {
  test('individual acceptance preserves the original suggestion metadata after editing', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['41'];
    const roof = getQuickMeasurementEstimate('roofSquares', fixture.measurements, fixture.facts)!;
    const accepted = acceptQuickMeasurementSuggestion({ roofSquares: '' }, roof);
    expect(accepted.quickMeasurementSources?.roofSquares).toBe('user_confirmed_suggestion');
    expect(accepted.quickMeasurementSuggestionMetadata?.roofSquares?.sourceType).toBe(
      roof.sourceType
    );
    const edited = { ...accepted, roofSquares: '40' };
    expect(edited.quickMeasurementSuggestionMetadata?.roofSquares?.value).toBe(roof.value);
  });

  test('bulk acceptance skips high-risk suggestions until review is confirmed', () => {
    const fixture = PLAN_MEASUREMENT_LOTS['41'];
    const roof = getQuickMeasurementEstimate('roofSquares', fixture.measurements, fixture.facts)!;
    const paint = getQuickMeasurementEstimate(
      'wallPaintSqft',
      { ...fixture.measurements, planRooms: fixture.rooms },
      fixture.facts
    )!;
    const beforeReview = acceptReviewedQuickMeasurementSuggestions(
      { roofSquares: '', wallPaintSqft: '' },
      [roof, paint],
      false
    );
    expect(beforeReview.roofSquares).toBe('');
    expect(beforeReview.wallPaintSqft).toBe(String(paint.value));
    const reviewed = acceptReviewedQuickMeasurementSuggestions(beforeReview, [roof, paint], true);
    expect(reviewed.roofSquares).toBe(String(roof.value));
    expect(reviewed.wallPaintSqft).toBe(String(paint.value));
  });
});

