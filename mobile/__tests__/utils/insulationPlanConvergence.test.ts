import {
  buildInsulationAssembliesFromPlanMeasurements,
  hydrateInsulationPlanMeasurementsFromTakeoff,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';

describe('insulationPlanConvergence', () => {
  it('maps stucco opening takeoff into insulation opening deduction', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff({
      stuccoWindowDoorOpeningSqft: '289.6',
    });
    expect(hydrated.openingDeductionSqft).toBe('289.6');
  });

  it('does not overwrite an existing opening deduction', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff({
      openingDeductionSqft: '300',
      stuccoWindowDoorOpeningSqft: '289.6',
    });
    expect(hydrated.openingDeductionSqft).toBe('300');
  });

  it('seeds confirmed wall and unconfirmed calculated ceiling assemblies', () => {
    const assemblies = buildInsulationAssembliesFromPlanMeasurements({
      exteriorWallInsulationSqft: '1950.4',
      atticInsulationSqft: '3660',
      quickMeasurementSources: {
        atticInsulationSqft: 'calculated_from_components',
      },
    });

    expect(assemblies).toMatchObject([
      {
        location: 'exterior_wall',
        sqft: 1950.4,
        confirmed: true,
        source: 'detected_from_plan',
      },
      {
        location: 'attic_ceiling',
        sqft: 3660,
        confirmed: false,
        source: 'calculated_from_plan',
      },
    ]);
  });

  it('does not replace an existing assembly model during plan hydration', () => {
    expect(
      buildInsulationAssembliesFromPlanMeasurements({
        insulationAssemblies: [
          {
            id: 'edited-wall',
            materialType: 'Batt',
            rValue: 'R-21',
            sqft: 1200,
            location: 'exterior_wall',
          },
        ],
        exteriorWallInsulationSqft: '1950.4',
      })
    ).toBeNull();
  });
});
