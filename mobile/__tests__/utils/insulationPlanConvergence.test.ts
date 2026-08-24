import {
  buildInsulationAssembliesFromPlanMeasurements,
  hydrateInsulationPlanMeasurementsFromTakeoff,
  syncInsulationAssembliesWithPlanMeasurements,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';

describe('insulationPlanConvergence', () => {
  it('maps elevation-face openings into insulation opening deduction', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      {},
      {
        elevationFaces: [{ id: 'front', windowDoorOpeningsSqft: 550 }],
      }
    );
    expect(hydrated.openingDeductionSqft).toBe('550');
  });

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

  it('replaces stale legacy rows while preserving contractor-edited rows', () => {
    const synced = syncInsulationAssembliesWithPlanMeasurements({
      exteriorWallInsulationSqft: '1950.4',
      atticInsulationSqft: '3660',
      quickMeasurementSources: {
        atticInsulationSqft: 'calculated_from_components',
      },
      insulationAssemblies: [
        {
          id: 'legacy-wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 2000,
          location: 'exterior_wall',
        },
        {
          id: 'legacy-attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 1500,
          location: 'attic_ceiling',
        },
      ],
    });
    expect(synced).toMatchObject([
      { location: 'exterior_wall', sqft: 1950.4 },
      {
        location: 'attic_ceiling',
        sqft: 3660,
        source: 'calculated_from_plan',
        confirmed: false,
      },
    ]);

    const preserved = syncInsulationAssembliesWithPlanMeasurements({
      exteriorWallInsulationSqft: '1950.4',
      atticInsulationSqft: '3660',
      insulationAssemblies: [
        {
          id: 'edited-wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 2000,
          location: 'exterior_wall',
          source: 'contractor_entered',
          confirmed: true,
        },
      ],
    });
    expect(preserved?.[0]).toMatchObject({
      sqft: 2000,
      source: 'contractor_entered',
    });
  });
});
