import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { inferDefaultGarageDoorCounts } from '@/utils/exteriorOpeningsPricing';
import {
  drywallPackageSurfacePlanningQuantity,
  resolveDrywallProductionAssemblyBaseline,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';

const GROUND_UP_HOME_NOTES = `New 2,800 sqft two story home with attached 2-car garage. Standard builder grade finishes. Owner is taking care of sitework, utilities, and landscaping separate from us.`;

describe('ground-up notes refinement', () => {
  it('infers garage door counts from 2-car garage language', () => {
    expect(inferDefaultGarageDoorCounts(500)).toEqual({
      single: 0,
      double: 1,
      rv: 0,
    });
    const parsed = parseScopeMeasurementsFromNotes(GROUND_UP_HOME_NOTES, {
      templateKey: 'ground_up',
    });
    expect(parsed.garageDoorDoubleCount).toBe(1);
  });

  it('prices complete drywall at production baseline when living SF has no barometer match', () => {
    const parsed = parseScopeMeasurementsFromNotes(GROUND_UP_HOME_NOTES, {
      templateKey: 'ground_up',
    });
    const packageSf = drywallPackageSurfacePlanningQuantity(
      parsed.floorAreaSqft,
      parsed.garageSqft
    );
    expect(packageSf).toBeGreaterThan(9000);
    const baseline = resolveDrywallProductionAssemblyBaseline({
      livingSf: parsed.floorAreaSqft,
      packageSurfaceSqft: packageSf,
    });
    expect(baseline.material + baseline.labor).toBeGreaterThanOrEqual(1.5);
    expect(baseline.barometerTotal).toBeUndefined();
    expect(packageSf! * (baseline.material + baseline.labor)).toBeGreaterThan(
      15000
    );
  });
});
