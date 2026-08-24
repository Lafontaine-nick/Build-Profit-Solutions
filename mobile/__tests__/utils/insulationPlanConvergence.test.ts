import {
  buildInsulationAssembliesFromPlanMeasurements,
  detectBattFacingFromPlanText,
  hydrateInsulationPlanMeasurementsFromTakeoff,
  INSULATION_BATT_FACING_DEFAULT,
  insulationAssemblyDuplicateRowIds,
  insulationBattFacingLabel,
  insulationBattFacingMaterialMultiplier,
  isIncompleteInsulationAssembly,
  isPricedInsulationAssembly,
  mergeInsulationAssemblyRowsWithDrafts,
  mergeInsulationPlanFactsFromTakeoff,
  mergeRestoredInsulationAssemblyRows,
  normalizeInsulationBattFacing,
  stashInsulationAssemblyRowsForType,
  syncInsulationAssembliesWithPlanMeasurements,
  takeStashedInsulationAssemblyRowsForType,
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

  it('converts gross Plan 58 wall SF to net after readable opening deductions', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      {
        exteriorWallInsulationSqft: '3508.8',
        stuccoWindowDoorOpeningSqft: '550',
      },
      {
        foundationPerimeterLf: 172,
        wallHeightFt: 10.2,
        storyCount: 2,
      }
    );
    expect(hydrated.openingDeductionSqft).toBe('550');
    expect(hydrated.exteriorWallInsulationSqft).toBe('2958.8');
  });

  it('leaves an already-net wall takeoff unchanged', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      {
        exteriorWallInsulationSqft: '2958.8',
        openingDeductionSqft: '550',
      },
      {
        foundationPerimeterLf: 172,
        wallHeightFt: 10.2,
        storyCount: 2,
      }
    );
    expect(hydrated.exteriorWallInsulationSqft).toBe('2958.8');
  });

  it('normalizes an unqualified AI wall total when geometry is omitted', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff({
      exteriorWallInsulationSqft: '3508.8',
      openingDeductionSqft: '550',
    });
    expect(hydrated.exteriorWallInsulationSqft).toBe('2958.8');
  });

  it('uses plan facts and elevation openings when only gross wall SF is detected', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      {
        exteriorWallInsulationSqft: '3508.8',
        storyCount: '2',
      },
      mergeInsulationPlanFactsFromTakeoff(
        {
          foundationPerimeterLf: 172,
          wallHeightFt: 10.2,
          storyCount: 2,
          elevationFaces: [{ id: 'front', windowDoorOpeningsSqft: 550 }],
        },
        { totalLivingSqft: 3660 },
        { exteriorWallInsulationSqft: '3508.8', storyCount: '2' }
      )
    );
    expect(hydrated.exteriorWallInsulationSqft).toBe('2958.8');
    expect(hydrated.openingDeductionSqft).toBe('550');
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

  it('preserves in-progress assembly drafts when parent only stores complete rows', () => {
    const merged = mergeInsulationAssemblyRowsWithDrafts(
      [
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 3508.8,
          location: 'exterior_wall',
        },
        {
          id: 'attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 2260,
          location: 'attic_ceiling',
        },
      ],
      [
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 3508.8,
          location: 'exterior_wall',
        },
        {
          id: 'attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 2260,
          location: 'attic_ceiling',
        },
        {
          id: 'draft-blown-in',
          materialType: 'Blown-in',
          rValue: '',
          sqft: '',
          location: 'attic_ceiling',
        },
      ]
    );

    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({
      id: 'draft-blown-in',
      materialType: 'Blown-in',
      rValue: '',
    });
  });

  it('restores batt assemblies with r-values after toggling the type off and on', () => {
    const battRows = [
      {
        id: 'wall',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 3508.8,
        location: 'exterior_wall',
      },
      {
        id: 'attic',
        materialType: 'Batt',
        rValue: 'R-30',
        sqft: 2260,
        location: 'attic_ceiling',
      },
    ];
    let stash: Record<string, typeof battRows> = {};
    stash = stashInsulationAssemblyRowsForType(stash, 'Batt', battRows);
    const { stash: nextStash, rows: restored } =
      takeStashedInsulationAssemblyRowsForType(stash, 'Batt');
    expect(restored).toMatchObject([
      { rValue: 'R-21', sqft: 3508.8 },
      { rValue: 'R-30', sqft: 2260 },
    ]);
    expect(nextStash).toEqual({});

    const merged = mergeRestoredInsulationAssemblyRows(
      [
        {
          id: 'placeholder-wall',
          materialType: '',
          rValue: '',
          sqft: '3508.8',
          location: 'exterior_wall',
        },
        {
          id: 'placeholder-attic',
          materialType: '',
          rValue: '',
          sqft: '2260',
          location: 'attic_ceiling',
        },
      ],
      restored
    );
    expect(merged).toHaveLength(2);
    expect(merged).toMatchObject([
      { rValue: 'R-21', sqft: 3508.8 },
      { rValue: 'R-30', sqft: 2260 },
    ]);
  });

  it('defaults batt facing to not sure and applies a modest faced material uplift', () => {
    expect(normalizeInsulationBattFacing(undefined)).toBeNull();
    expect(INSULATION_BATT_FACING_DEFAULT).toBe('not_sure');
    expect(insulationBattFacingMaterialMultiplier('faced')).toBe(1.06);
    expect(insulationBattFacingMaterialMultiplier('unfaced')).toBe(1);
    expect(insulationBattFacingMaterialMultiplier('not_sure')).toBe(1);
    expect(insulationBattFacingLabel('faced')).toBe('Faced');
    expect(insulationBattFacingLabel('not_sure')).toBeNull();
    expect(
      detectBattFacingFromPlanText('kraft faced batt at exterior walls')
    ).toBe('faced');
    expect(detectBattFacingFromPlanText('unfaced batt in attic')).toBe(
      'unfaced'
    );
    expect(detectBattFacingFromPlanText('R-21 batt insulation')).toBeNull();
  });

  it('classifies priced vs incomplete assemblies for header summaries', () => {
    const priced = {
      id: 'wall',
      materialType: 'Batt',
      rValue: 'R-21',
      sqft: 3508.8,
      location: 'exterior_wall',
      confirmed: true,
      source: 'contractor_entered' as const,
    };
    const needsConfirm = {
      id: 'attic',
      materialType: 'Batt',
      rValue: 'R-30',
      sqft: 2260,
      location: 'attic_ceiling',
      confirmed: false,
      source: 'calculated_from_plan' as const,
    };
    const draft = {
      id: 'draft',
      materialType: 'Blown-in',
      rValue: '',
      sqft: '',
      location: 'attic_ceiling',
    };

    expect(isPricedInsulationAssembly(priced)).toBe(true);
    expect(isPricedInsulationAssembly(needsConfirm)).toBe(false);
    expect(isIncompleteInsulationAssembly(priced)).toBe(false);
    expect(isIncompleteInsulationAssembly(needsConfirm)).toBe(true);
    expect(isIncompleteInsulationAssembly(draft)).toBe(true);
  });

  it('flags duplicate assemblies with the same type, location, and r-value', () => {
    const rows = [
      {
        id: 'wall-a',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 3508.8,
        location: 'exterior_wall',
        battFacing: 'unfaced' as const,
      },
      {
        id: 'wall-b',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 1200,
        location: 'exterior_wall',
        battFacing: 'unfaced' as const,
      },
      {
        id: 'attic',
        materialType: 'Batt',
        rValue: 'R-30',
        sqft: 2260,
        location: 'attic_ceiling',
      },
    ];

    expect(Array.from(insulationAssemblyDuplicateRowIds(rows)).sort()).toEqual([
      'wall-a',
      'wall-b',
    ]);
  });

  it('treats different batt facing as distinct assemblies', () => {
    const rows = [
      {
        id: 'faced',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 3508.8,
        location: 'exterior_wall',
        battFacing: 'faced' as const,
      },
      {
        id: 'unfaced',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 3508.8,
        location: 'exterior_wall',
        battFacing: 'unfaced' as const,
      },
    ];

    expect(insulationAssemblyDuplicateRowIds(rows).size).toBe(0);
  });
});
