import {
  isDrywallSurfaceProxyQuantity,
  resolveInsulationEnvelopePlanningQuantity,
  insulationEnvelopeInputsFromPlanFacts,
} from '@/utils/insulationEnvelopeQuantity';
import { getFormulaDefinitionsForScope, executeFormula } from '@/utils/scopeFormulaRegistry';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import { PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';

describe('insulationEnvelopeQuantity', () => {
  it('does not use livingSqft × 3.5 (drywall surface)', () => {
    const living = 1879;
    const result = resolveInsulationEnvelopePlanningQuantity({ floorAreaSqft: living });
    expect(result).not.toBeNull();
    expect(result!.totalInsulationEnvelopeSqft).not.toBe(Math.round(living * 3.5));
    expect(result!.totalInsulationEnvelopeSqft).toBeLessThan(5000);
    expect(result!.usesThermalEnvelopeModel).toBe(true);
    expect(result!.label).toBe('Planning estimate');
  });

  it('Plan 41 SHV facts yield ~3,300–3,700 envelope SF, not 6,577', () => {
    const facts = PLAN_MEASUREMENT_LOTS['41'].facts;
    const result = resolveInsulationEnvelopePlanningQuantity(
      insulationEnvelopeInputsFromPlanFacts(facts, 1879)
    );
    expect(result).not.toBeNull();
    // 214 LF × 9 ft = 1,926 gross walls − 15% openings = 1,637 + 1,879 attic = 3,516
    expect(result!.totalInsulationEnvelopeSqft).toBe(3516);
    expect(result!.totalInsulationEnvelopeSqft).toBeGreaterThanOrEqual(3300);
    expect(result!.totalInsulationEnvelopeSqft).toBeLessThanOrEqual(3700);
    expect(result!.totalInsulationEnvelopeSqft).not.toBe(6577);

    const walls = result!.components.find((c) => c.key === 'exteriorWallInsulationSqft');
    const attic = result!.components.find((c) => c.key === 'atticInsulationSqft');
    const openings = result!.components.find((c) => c.key === 'openingDeductionSqft');
    expect(walls?.quantity).toBe(1926);
    expect(attic?.quantity).toBe(1879);
    expect(openings?.quantity).toBe(289);
    expect(attic?.included).toBe(true);
  });

  it('excludes interior partitions and garage by default', () => {
    const result = resolveInsulationEnvelopePlanningQuantity({
      floorAreaSqft: 1879,
      foundationPerimeterLf: 214,
      wallHeightFt: 9,
      insulatedGarageWallSqft: 800,
      includeGarageInsulation: false,
    });
    const garage = result!.components.find((c) => c.key === 'insulatedGarageWallSqft');
    expect(garage?.included).toBe(false);
    expect(result!.totalInsulationEnvelopeSqft).toBe(3516);
  });

  it('does not double-count attic and roof deck', () => {
    const withAttic = resolveInsulationEnvelopePlanningQuantity({
      floorAreaSqft: 1879,
      foundationPerimeterLf: 214,
      wallHeightFt: 9,
      insulatedRoofDeckSqft: 1879,
      preferRoofDeckOverAttic: false,
    });
    expect(withAttic!.components.find((c) => c.key === 'atticInsulationSqft')?.included).toBe(true);
    expect(withAttic!.components.find((c) => c.key === 'insulatedRoofDeckSqft')?.included).toBe(false);

    const withDeck = resolveInsulationEnvelopePlanningQuantity({
      floorAreaSqft: 1879,
      foundationPerimeterLf: 214,
      wallHeightFt: 9,
      insulatedRoofDeckSqft: 1879,
      preferRoofDeckOverAttic: true,
    });
    expect(withDeck!.components.find((c) => c.key === 'atticInsulationSqft')).toBeUndefined();
    expect(withDeck!.components.find((c) => c.key === 'insulatedRoofDeckSqft')?.included).toBe(true);
    expect(withDeck!.totalInsulationEnvelopeSqft).toBe(3516);
  });

  it('opening deductions reduce exterior walls only', () => {
    const result = resolveInsulationEnvelopePlanningQuantity({
      exteriorWallInsulationSqft: 2000,
      atticInsulationSqft: 1000,
      openingDeductionSqft: 300,
    });
    expect(result!.totalInsulationEnvelopeSqft).toBe(2700);
  });

  it('detects drywall surface proxy quantities', () => {
    expect(isDrywallSurfaceProxyQuantity(6577, 1879)).toBe(true);
    expect(isDrywallSurfaceProxyQuantity(1879, 1879)).toBe(true);
    expect(isDrywallSurfaceProxyQuantity(3516, 1879)).toBe(false);
  });
});

describe('insulation formula registry', () => {
  it('does not register insulation on the drywall living×3.5 formula', () => {
    const drywallKeys = getFormulaDefinitionsForScope('drywall').map((f) => f.key);
    expect(drywallKeys).toContain('surface_area_from_floor_area_benchmark');

    const insulationKeys = getFormulaDefinitionsForScope('insulation').map((f) => f.key);
    expect(insulationKeys).toContain('insulation_envelope_from_exterior_and_attic');
    expect(insulationKeys).not.toContain('surface_area_from_floor_area_benchmark');
  });

  it('insulation envelope formula stays below drywall 3.5× surface', () => {
    const formula = executeFormula('insulation_envelope_from_exterior_and_attic', {
      floorAreaSqft: 1879,
    });
    expect(formula).not.toBeNull();
    expect(formula!.roundedValue).toBeLessThan(Math.round(1879 * 3.5));
    expect(formula!.formulaExplanation).toMatch(/thermal envelope|Planning estimate/i);
  });
});

describe('insulation suggested pricing', () => {
  it('Plan 41 pricing uses envelope SF, not 6,577 drywall surface', () => {
    const lot = PLAN_MEASUREMENT_LOTS['41'];
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: lot.measurements.floorAreaSqft,
      garageSqft: lot.measurements.garageSqft,
      itemQuantities: {},
      planFacts: lot.facts,
    } as any;
    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      input,
      'ground_up',
      { quantity: 1879, unit: 'sqft', quantitySource: 'inferred' }
    );
    expect(fill?.basis?.quantity).toBe(3516);
    expect(fill?.basis?.quantity).not.toBe(6577);
    expect(fill?.basis?.quantity).not.toBe(1879);
  });

  it('does not inherit a drywall quantity into insulation pricing', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      drywallSqft: '6577',
      itemQuantities: {},
      planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
    } as any;
    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      input,
      'ground_up',
      { quantity: 6577, unit: 'sqft', quantitySource: 'inferred' }
    );
    expect(fill?.basis?.quantity).toBe(3516);
  });
});
