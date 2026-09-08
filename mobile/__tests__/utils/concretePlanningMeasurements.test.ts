import {
  applyConcretePlanningMeasurements,
  computeThickenedEdgeCy,
  filterConcreteRevealAttentionItems,
  inferConcreteScopeIds,
  notesMentionConcretePump,
  parseThickenedEdgeLf,
  resolveFlatworkExcavationDepthInches,
  resolveMixedConcreteChecklistQuantity,
  summarizeConcreteNoteBullets,
} from '@/utils/concretePlanningMeasurements';
import { splitConcreteNoteSections } from '@/utils/foundationPlanningMeasurements';
import { resolveChecklistItemQuantity } from '@/utils/scopeItemQuantities';

const DRIVEWAY_NOTE =
  'Pour new driveway 900 sqft, 4 inch thick with 80 ft of thickened edge. Dig out, gravel base, forms, rebar, finish broom. Might need a pump truck depending on access.';

const MIXED_HOUSE_DRIVEWAY_NOTE = `House / garage concrete:
- Pour monolithic house slab 2400 sqft, 6 inch thick with footings and stem walls
- Garage slab 480 sqft, 4 inch thick (same pour)
- Excavation, gravel base, rebar throughout

Exterior flatwork (separate):
- New driveway 900 sqft, 4 inch thick, 80 LF thickened edge
- Dig out, gravel base, forms, rebar, broom finish
- Pump truck may be needed for driveway depending on access`;

describe('concretePlanningMeasurements', () => {
  it('parses driveway flatwork measurements from notes', () => {
    const parsed = applyConcretePlanningMeasurements({ concreteSqft: 900 }, DRIVEWAY_NOTE);
    expect(parsed).toMatchObject({
      concreteSqft: 900,
      concreteThicknessInches: 4,
      complexFormingLf: 80,
      thickenedEdgeLf: 80,
      concreteSubgradePrepSqft: 900,
      concreteReinforcementSqft: 900,
      concreteDrivewaySqft: 900,
      gravelBaseDepthInches: 4,
      concretePumpReviewNeeded: true,
      concretePumpCount: 1,
    });
    expect(parsed.concreteAreaByType).toEqual({ driveways: 900 });
    expect(parsed.concreteThicknessByType).toEqual({ driveways: 4 });
    expect(parsed.excavationAreaSqft).toBe(900);
    expect(parsed.excavationDepthInches).toBe(8);
    expect(parsed.excavationCy).toBeCloseTo(22.22, 1);
    expect(parsed.gravelBaseCy).toBeCloseTo(11.11, 1);
    expect(parsed.thickenedEdgeCy).toBeCloseTo(1.98, 1);
    expect(parsed.concreteScope).toEqual(
      expect.arrayContaining([
        'driveways',
        'pour_flatwork',
        'excavation',
        'site_prep',
        'gravel_base',
        'reinforcement',
        'complex_forming',
        'concrete_pumping',
      ])
    );
  });

  it('uses slab-only excavation depth when gravel base is not mentioned', () => {
    const parsed = applyConcretePlanningMeasurements(
      {},
      'Pour 600 sqft patio 4 inch thick. Dig out and forms.'
    );
    expect(parsed.excavationDepthInches).toBe(4);
    expect(parsed.excavationCy).toBeCloseTo(7.41, 1);
    expect(parsed.gravelBaseCy).toBeUndefined();
  });

  it('parses thickened edge LF without explicit lf suffix', () => {
    expect(parseThickenedEdgeLf('80 ft of thickened edge along the driveway')).toBe(80);
    expect(parseThickenedEdgeLf('80 LF thickened edge')).toBe(80);
  });

  it('computes thickened edge CY with planning defaults', () => {
    expect(computeThickenedEdgeCy(80)).toBeCloseTo(1.98, 1);
  });

  it('resolves excavation depth as slab plus gravel when both are implied', () => {
    expect(resolveFlatworkExcavationDepthInches(4, true, 4)).toBe(8);
    expect(resolveFlatworkExcavationDepthInches(4, false)).toBe(4);
  });

  it('detects conditional pump truck language', () => {
    expect(notesMentionConcretePump(DRIVEWAY_NOTE)).toBe(true);
    expect(notesMentionConcretePump('Pump if needed for backyard access')).toBe(true);
    expect(notesMentionConcretePump('Standard chute placement')).toBe(false);
  });

  it('infers concrete scope ids from notes and measurements', () => {
    expect(
      inferConcreteScopeIds(DRIVEWAY_NOTE, {
        concreteSqft: 900,
        complexFormingLf: 80,
        concreteSubgradePrepSqft: 900,
        gravelBaseCy: 11.11,
        concretePumpReviewNeeded: true,
      })
    ).toEqual(
      expect.arrayContaining([
        'driveways',
        'pour_flatwork',
        'excavation',
        'site_prep',
        'gravel_base',
        'reinforcement',
        'complex_forming',
        'concrete_pumping',
      ])
    );
  });

  it('filters pre-confirm pricing noise for note-backed concrete scope', () => {
    const draft = {
      projectType: 'concrete',
      originalNotes: DRIVEWAY_NOTE,
      scopeChecklist: {
        templateKey: 'concrete',
        items: [
          { id: 'pour_flatwork', state: 'included', noteBacked: true },
          { id: 'gravel_base', state: 'included', noteBacked: true },
          { id: 'excavation', state: 'included', noteBacked: true },
          { id: 'site_prep', state: 'included', noteBacked: true },
          { id: 'reinforcement', state: 'included', noteBacked: true },
          { id: 'complex_forming', state: 'included', noteBacked: true },
          { id: 'concrete_pumping', state: 'included', noteBacked: true },
        ],
      },
      scopeMeasurements: { concreteSqft: 900, excavationCy: 22.22, gravelBaseCy: 11.11 },
    };
    expect(
      filterConcreteRevealAttentionItems(draft, [
        'Pricing for Pour flatwork',
        'Pricing for Imported gravel base material',
        'Pricing for Concrete pump truck',
        'Customer name',
      ])
    ).toEqual(['Customer name']);
  });

  it('splits mixed house slab and driveway notes onto foundation CY and flatwork sqft', () => {
    const parsed = applyConcretePlanningMeasurements({}, MIXED_HOUSE_DRIVEWAY_NOTE);
    expect(parsed.concreteSqft).toBe(900);
    expect(parsed.concreteCy).toBeGreaterThan(50);
    expect(parsed.foundationFootprintSqft).toBe(2400);
    expect(parsed.floorAreaSqft).toBeUndefined();
    expect(parsed.concreteDrivewaySqft).toBe(900);
    expect(parsed.concreteThicknessByType).toEqual({ driveways: 4 });
    expect(parsed.concreteThicknessInches).toBeUndefined();
    expect(parsed.thickenedEdgeLf).toBe(80);
    expect(parsed.concreteStructuralSubgradePrepSqft).toBe(2880);
    expect(parsed.concreteFlatworkSubgradePrepSqft).toBe(900);
    expect(parsed.concreteSubgradePrepSqft).toBe(3780);
    expect(parsed.concreteStructuralReinforcementSqft).toBe(2880);
    expect(parsed.concreteFlatworkReinforcementSqft).toBe(900);
    expect(parsed.concreteReinforcementSqft).toBe(3780);
    expect(parsed.concreteStructuralGravelBaseCy).toBeCloseTo(35.56, 1);
    expect(parsed.concreteFlatworkGravelBaseCy).toBeCloseTo(11.11, 1);
    expect(parsed.gravelBaseCy).toBeCloseTo(46.67, 1);
    expect(parsed.excavationCy).toBeGreaterThan(22.22);
    expect(parsed.concretePumpCount).toBe(1);
    expect(parsed.concreteScope).toEqual(
      expect.arrayContaining([
        'pour_foundation',
        'pour_flatwork',
        'driveways',
        'gravel_base',
        'concrete_pumping',
      ])
    );
    expect(parsed.concreteScope).not.toContain(undefined);
  });

  it('summarizes concrete note bullets for Scope found', () => {
    const bullets = summarizeConcreteNoteBullets(DRIVEWAY_NOTE, 8);
    expect(bullets.some((line) => /900 sqft/i.test(line))).toBe(true);
    expect(bullets.some((line) => /excavation/i.test(line))).toBe(true);
    expect(bullets.some((line) => /gravel base/i.test(line))).toBe(true);
    expect(bullets.some((line) => /thickened edge/i.test(line))).toBe(true);
    expect(bullets.some((line) => /pump truck/i.test(line))).toBe(true);
  });

  it('attributes mixed-job pricing quantities to structural pad and flatwork zones', () => {
    const parsed = applyConcretePlanningMeasurements({}, MIXED_HOUSE_DRIVEWAY_NOTE);
    const sitePrep = resolveMixedConcreteChecklistQuantity('site_prep', parsed);
    expect(sitePrep).toMatchObject({
      quantity: 3780,
      unit: 'sqft',
    });
    expect(sitePrep?.sourceLabel).toMatch(/structural pad.*2,880.*exterior flatwork.*900/i);

    const resolved = resolveChecklistItemQuantity('site_prep', parsed, {
      templateKey: 'concrete',
      notes: MIXED_HOUSE_DRIVEWAY_NOTE,
    });
    expect(resolved.quantity).toBe(3780);
    expect(resolved.sourceLabel).toMatch(/structural pad/i);
  });

  it('splits mixed notes without an exterior flatwork header', () => {
    const note = `House / garage concrete:
- Pour monolithic house slab 2400 sqft, 6 inch thick with footings and stem walls
- Garage slab 480 sqft, 4 inch thick (same pour)
- Excavation, gravel base, rebar throughout
- New driveway 900 sqft, 4 inch thick, 80 LF thickened edge
- Dig out, gravel base, forms, rebar, broom finish`;
    const { structural, exterior } = splitConcreteNoteSections(note);
    expect(structural).toMatch(/garage slab 480/i);
    expect(structural).not.toMatch(/driveway/i);
    expect(exterior).toMatch(/driveway 900/i);
    const parsed = applyConcretePlanningMeasurements({}, note);
    expect(parsed.concreteSqft).toBe(900);
    expect(parsed.concreteFlatworkSubgradePrepSqft).toBe(900);
  });
});
