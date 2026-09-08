import {
  applyFoundationPlanningMeasurements,
  computeExcavationCyFromFootingTrench,
  computeFoundationCyFromFootprint,
  notesImplyStructuralFoundation,
  parseFoundationFootprintSqftFromNotes,
} from '@/utils/foundationPlanningMeasurements';
import { applyConcretePlanningMeasurements } from '@/utils/concretePlanningMeasurements';

const HOUSE_SLAB_NOTE =
  'Pour house slab 2400 sqft monolithic slab on grade with footings and stem walls. Excavation and gravel base. Rebar throughout. 6 inch thick.';

const DRIVEWAY_NOTE =
  'Pour new driveway 900 sqft, 4 inch thick with 80 ft of thickened edge. Dig out, gravel base, forms, rebar, finish broom.';

const MIXED_HOUSE_DRIVEWAY_NOTE = `House / garage concrete:
- Pour monolithic house slab 2400 sqft, 6 inch thick with footings and stem walls
- Garage slab 480 sqft, 4 inch thick (same pour)
- Excavation, gravel base, rebar throughout

Exterior flatwork (separate):
- New driveway 900 sqft, 4 inch thick, 80 LF thickened edge
- Dig out, gravel base, forms, rebar, broom finish
- Pump truck may be needed for driveway depending on access`;

describe('foundationPlanningMeasurements', () => {
  it('computes foundation CY from footprint using plan-export assumptions', () => {
    const foundation = computeFoundationCyFromFootprint({
      livingFootprintSqft: 2400,
      garageSqft: 0,
      slabThicknessFt: 6 / 12,
    });
    expect(foundation.totalCy).toBeGreaterThan(50);
    expect(foundation.slabCy).toBeGreaterThan(40);
    expect(foundation.footingCy).toBeGreaterThan(5);
  });

  it('computes excavation CY from footing trench model', () => {
    const excavation = computeExcavationCyFromFootingTrench({
      livingFootprintSqft: 2400,
      garageSqft: 400,
    });
    expect(excavation.totalCy).toBeGreaterThan(20);
    expect(excavation.totalCy).toBeLessThan(200);
  });

  it('hydrates house slab notes onto foundation CY instead of flatwork sqft', () => {
    const parsed = applyFoundationPlanningMeasurements({}, HOUSE_SLAB_NOTE);
    expect(parsed).toMatchObject({
      floorAreaSqft: 2400,
      concreteThicknessInches: 6,
      concreteReinforcementSqft: 2400,
      concreteSubgradePrepSqft: 2400,
    });
    expect(parsed?.concreteCy).toBeGreaterThan(50);
    expect(parsed?.excavationCy).toBeGreaterThan(15);
    expect(parsed?.concreteScope).toEqual(
      expect.arrayContaining([
        'pour_foundation',
        'excavation',
        'site_prep',
        'reinforcement',
      ])
    );
    expect(parsed?.concreteSqft).toBeUndefined();
    expect(parsed?.concreteScope).not.toContain('pour_flatwork');
  });

  it('keeps driveway notes on flatwork path', () => {
    const parsed = applyConcretePlanningMeasurements({}, DRIVEWAY_NOTE);
    expect(parsed.concreteSqft).toBe(900);
    expect(parsed.concreteCy).toBeUndefined();
    expect(parsed.concreteScope).toEqual(
      expect.arrayContaining(['driveways', 'pour_flatwork'])
    );
    expect(parsed.concreteScope).not.toContain('pour_foundation');
  });

  it('parses foundation footprint sqft from notes', () => {
    expect(parseFoundationFootprintSqftFromNotes(HOUSE_SLAB_NOTE)).toBe(2400);
  });

  it('detects structural foundation language', () => {
    expect(notesImplyStructuralFoundation(HOUSE_SLAB_NOTE)).toBe(true);
    expect(notesImplyStructuralFoundation(DRIVEWAY_NOTE)).toBe(false);
  });

  it('keeps mixed notes on both foundation and flatwork paths', () => {
    const parsed = applyConcretePlanningMeasurements({}, MIXED_HOUSE_DRIVEWAY_NOTE);
    expect(parsed.concreteCy).toBeGreaterThan(50);
    expect(parsed.concreteSqft).toBe(900);
    expect(parsed.concreteScope).toEqual(
      expect.arrayContaining(['pour_foundation', 'pour_flatwork', 'driveways'])
    );
  });

  it('uses a thinner garage slab thickness when noted separately from the house slab', () => {
    const uniform = computeFoundationCyFromFootprint({
      livingFootprintSqft: 2400,
      garageSqft: 480,
      slabThicknessFt: 6 / 12,
    });
    const splitThickness = computeFoundationCyFromFootprint({
      livingFootprintSqft: 2400,
      garageSqft: 480,
      slabThicknessFt: 6 / 12,
      garageSlabThicknessFt: 4 / 12,
    });
    expect(splitThickness.totalCy).toBeLessThan(uniform.totalCy);

    const parsed = applyFoundationPlanningMeasurements({}, MIXED_HOUSE_DRIVEWAY_NOTE, {
      preserveFlatwork: true,
    });
    expect(parsed?.concreteCy).toBe(splitThickness.totalCy);
  });
});
