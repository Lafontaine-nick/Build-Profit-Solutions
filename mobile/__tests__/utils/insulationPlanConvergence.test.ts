import {
  buildInsulationAssembliesFromPlanMeasurements,
  detectBattFacingFromPlanText,
  assumedInsulationOpeningDeductionSqft,
  applyHydratedInsulationScopeMeasurements,
  canonicalizeInsulationRepeatImportMeasurements,
  hasCompleteInsulationRepeatImportSnapshot,
  hydrateInsulationPlanMeasurementsFromTakeoff,
  hasConfirmedInsulationPlanTakeoff,
  hasFullInsulationCeilingBoundary,
  hydrateInsulationCeilingBoundaryFromFieldEvidence,
  INSULATION_BATT_FACING_DEFAULT,
  insulationAssemblyCeilingRoofDeckConflict,
  insulationAssemblyCodeUpgradeTargets,
  insulationAssemblyCodeWarnings,
  insulationAssemblyRowsWithoutPricedLocation,
  insulationAssemblyDuplicateRowIds,
  insulationBattFacingLabel,
  insulationBattFacingMaterialAddPerSqft,
  insulationBattFacingNeedsReview,
  INSULATION_BATT_FACED_MATERIAL_ADD_PER_SQFT,
  isIncompleteInsulationAssembly,
  isPricedInsulationAssembly,
  isCredibleInsulationOpeningDeduction,
  mergeInsulationAssemblyRowsWithDrafts,
  mergeInsulationPlanFactsFromTakeoff,
  mergeRestoredInsulationAssemblyRows,
  normalizeInsulationBattFacing,
  resolveInsulationOpeningDeductionForReview,
  stashInsulationAssemblyRowsForType,
  syncInsulationAssembliesWithPlanMeasurements,
  takeStashedInsulationAssemblyRowsForType,
} from '@/utils/subcontractorTrade/insulationPlanConvergence';

describe('insulationPlanConvergence', () => {
  it('rejects partial opening reads below 8% of gross wall area', () => {
    expect(isCredibleInsulationOpeningDeduction(50, 3508.8)).toBe(false);
    expect(isCredibleInsulationOpeningDeduction(550, 3508.8)).toBe(true);
    expect(assumedInsulationOpeningDeductionSqft(3508.8)).toBe(526.3);
  });

  it('falls back to 15% openings when a partial low-confidence deduction is present', () => {
    const planFacts = {
      foundationPerimeterLf: 172,
      wallHeightFt: 10.2,
      storyCount: 2,
    };
    const opening = resolveInsulationOpeningDeductionForReview(
      { openingDeductionSqft: '50' },
      planFacts
    );
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      {
        exteriorWallInsulationSqft: '3508.8',
        openingDeductionSqft: '50',
      },
      planFacts
    );

    expect(opening).toBe(526.3);
    expect(hydrated.openingDeductionSqft).toBe('526.3');
    expect(hydrated.exteriorWallInsulationSqft).toBe('2982.5');
  });

  it('reconciles attic to full ceiling boundary when main-floor exposure is present', () => {
    const planFacts = {
      storyCount: 2,
      buildingAreas: {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
      },
      ceilingBoundary: {
        upperFloorAtticSqft: 1613,
        mainFloorAtticExposureSqft: 647,
        complete: false,
      },
    };
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      { atticInsulationSqft: '1613' },
      planFacts
    );
    expect(hydrated.atticInsulationSqft).toBe('2260');
    expect(hasFullInsulationCeilingBoundary(planFacts.ceilingBoundary)).toBe(
      true
    );
  });

  it('canonicalizes repeat-import snapshots to net wall and full attic boundary', () => {
    const planFacts = {
      foundationPerimeterLf: 172,
      wallHeightFt: 10.2,
      storyCount: 2,
      buildingAreas: {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
      },
      ceilingBoundary: {
        upperFloorAtticSqft: 1613,
        mainFloorAtticExposureSqft: 647,
        complete: false,
      },
    };
    const canonical = canonicalizeInsulationRepeatImportMeasurements(
      {
        exteriorWallInsulationSqft: '3508.8',
        openingDeductionSqft: '50',
        atticInsulationSqft: '1613',
      },
      { planFacts }
    );
    expect(canonical.exteriorWallInsulationSqft).toBe('2982.5');
    expect(canonical.openingDeductionSqft).toBe('526.3');
    expect(canonical.atticInsulationSqft).toBe('2260');
  });

  it('rejects incomplete repeat-import snapshots when attic boundary is unresolved', () => {
    const planFacts = {
      storyCount: 2,
      buildingAreas: {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
      },
      ceilingBoundary: {
        upperFloorAtticSqft: 1613,
        mainFloorAtticExposureSqft: 647,
        complete: false,
      },
    };
    expect(
      hasCompleteInsulationRepeatImportSnapshot(
        {
          exteriorWallInsulationSqft: '2982.5',
          openingDeductionSqft: '526.3',
          atticInsulationSqft: '1613',
        },
        { planFacts }
      )
    ).toBe(false);
    expect(
      hasCompleteInsulationRepeatImportSnapshot(
        {
          exteriorWallInsulationSqft: '2982.5',
          openingDeductionSqft: '526.3',
          atticInsulationSqft: '2260',
        },
        { planFacts }
      )
    ).toBe(true);
  });

  it('hydrates scope measurements without clobbering plan-review locks', () => {
    const hydrated = applyHydratedInsulationScopeMeasurements(
      {
        exteriorWallInsulationSqft: '3508.8',
        atticInsulationSqft: '1613',
        openingDeductionSqft: '50',
        quickMeasurementSources: {
          exteriorWallInsulationSqft: 'contractor_confirmed_from_plan_review',
        },
        planFacts: {
          foundationPerimeterLf: 172,
          wallHeightFt: 10.2,
          storyCount: 2,
          buildingAreas: {
            totalLivingSqft: 3660,
            mainFloorLivingSqft: 2047,
            upstairsLivingSqft: 1613,
          },
          ceilingBoundary: {
            upperFloorAtticSqft: 1613,
            mainFloorAtticExposureSqft: 647,
            complete: false,
          },
        },
      },
      {
        planFacts: {
          foundationPerimeterLf: 172,
          wallHeightFt: 10.2,
          storyCount: 2,
        },
      }
    );
    expect(hydrated.exteriorWallInsulationSqft).toBe('3508.8');
    expect(hydrated.atticInsulationSqft).toBe('2260');
    expect(hydrated.openingDeductionSqft).toBe('526.3');
  });

  it('detects confirmed plan takeoff from priced wall and attic assemblies', () => {
    expect(
      hasConfirmedInsulationPlanTakeoff({
        exteriorWallInsulationSqft: '2958.8',
        atticInsulationSqft: '2260',
        insulationAssemblies: [
          {
            id: 'wall',
            materialType: 'Batt',
            rValue: 'R-21',
            sqft: 2958.8,
            location: 'exterior_wall',
            confirmed: true,
          },
          {
            id: 'attic',
            materialType: 'Batt',
            rValue: 'R-30',
            sqft: 2260,
            location: 'attic_ceiling',
            confirmed: true,
          },
        ],
      })
    ).toBe(true);
    expect(
      hasConfirmedInsulationPlanTakeoff({
        floorAreaSqft: '3660',
      })
    ).toBe(false);
  });

  it('hydrates ceiling-boundary components from field evidence', () => {
    const boundary = hydrateInsulationCeilingBoundaryFromFieldEvidence({
      upperFloorAtticSqft: 1613,
      fieldEvidence: {
        mainFloorAtticExposureSqft: {
          value: 647,
          sourceType: 'measured_from_geometry',
          confidence: 'medium',
          evidence: [{ page: 12, sheet: 'A-12' }],
        },
      },
    });
    expect(boundary?.mainFloorAtticExposureSqft).toBe(647);
  });

  it('withholds upper-floor-only attic proxy on multi-story plans', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      { atticInsulationSqft: '1613' },
      {
        storyCount: 2,
        buildingAreas: {
          totalLivingSqft: 3660,
          mainFloorLivingSqft: 2047,
          upstairsLivingSqft: 1613,
        },
        ceilingBoundary: {
          upperFloorAtticSqft: 1613,
          complete: false,
        },
      }
    );
    expect(hydrated.atticInsulationSqft).toBeUndefined();
  });

  it('enriches Plan 58 ceiling boundary from barometer when main-floor exposure is missing', () => {
    const planFacts = mergeInsulationPlanFactsFromTakeoff(
      {},
      {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
      },
      { floorAreaSqft: '3660' }
    );
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      { atticInsulationSqft: '1613' },
      planFacts
    );
    expect(planFacts?.ceilingBoundary?.mainFloorAtticExposureSqft).toBe(647);
    expect(hydrated.atticInsulationSqft).toBe('2260');
  });

  it('replaces AI-detected attic SF when it conflicts with Plan 58 ceiling boundary', () => {
    const planFacts = mergeInsulationPlanFactsFromTakeoff(
      {
        ceilingBoundary: {
          upperFloorAtticSqft: 1613,
          mainFloorAtticExposureSqft: 387,
          complete: true,
        },
      },
      {
        totalLivingSqft: 3660,
        mainFloorLivingSqft: 2047,
        upstairsLivingSqft: 1613,
      },
      { floorAreaSqft: '3660', atticInsulationSqft: '2000' }
    );
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
      { atticInsulationSqft: '2000' },
      planFacts
    );
    expect(hydrated.atticInsulationSqft).toBe('2260');
  });

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

  it('defaults batt facing to not sure and applies a flat faced material premium', () => {
    expect(normalizeInsulationBattFacing(undefined)).toBeNull();
    expect(INSULATION_BATT_FACING_DEFAULT).toBe('not_sure');
    expect(INSULATION_BATT_FACED_MATERIAL_ADD_PER_SQFT).toBe(0.2);
    expect(insulationBattFacingMaterialAddPerSqft('faced')).toBe(0.2);
    expect(insulationBattFacingMaterialAddPerSqft('unfaced')).toBe(0);
    expect(insulationBattFacingMaterialAddPerSqft('not_sure')).toBe(0);
    expect(insulationBattFacingLabel('faced')).toBe('Faced');
    expect(insulationBattFacingLabel('not_sure')).toBeNull();
    expect(
      insulationBattFacingNeedsReview('Batt', 'not_sure')
    ).toBe(true);
    expect(
      insulationBattFacingNeedsReview('Batt', 'faced')
    ).toBe(false);
    expect(
      insulationBattFacingNeedsReview('Spray foam', 'not_sure')
    ).toBe(false);
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

  it('flags ceiling and roof-deck assemblies priced together', () => {
    const conflict = insulationAssemblyCeilingRoofDeckConflict([
      {
        id: 'attic',
        materialType: 'Batt',
        rValue: 'R-30',
        sqft: 2260,
        location: 'attic_ceiling',
        confirmed: true,
      },
      {
        id: 'roof',
        materialType: 'Rigid foam board',
        rValue: 'R-30',
        sqft: 1000,
        location: 'roof_deck',
        confirmed: true,
      },
    ]);
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.message).toMatch(/not both/i);
  });

  it('flags Utah attic and roof assemblies below R-38', () => {
    const warnings = insulationAssemblyCodeWarnings(
      [
        {
          id: 'attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 2260,
          location: 'attic_ceiling',
          confirmed: true,
        },
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 2982.5,
          location: 'exterior_wall',
          confirmed: true,
        },
      ],
      'UT'
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/R-38/i);
    expect(warnings[0]).not.toMatch(/Exterior wall/i);
  });

  it('returns structured code upgrade targets for Utah attic below R-38', () => {
    const targets = insulationAssemblyCodeUpgradeTargets(
      [
        {
          id: 'attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 2260,
          location: 'attic_ceiling',
          confirmed: true,
        },
      ],
      'UT'
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]?.rowId).toBe('attic');
    expect(targets[0]?.targetRValue).toBe('R-38');
  });

  it('removes priced assemblies at a location without touching other rows', () => {
    const rows = [
      {
        id: 'attic',
        materialType: 'Batt',
        rValue: 'R-30',
        sqft: 2260,
        location: 'attic_ceiling' as const,
        confirmed: true,
      },
      {
        id: 'roof',
        materialType: 'Rigid foam board',
        rValue: 'R-30',
        sqft: 1000,
        location: 'roof_deck' as const,
        confirmed: true,
      },
      {
        id: 'wall',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 2982.5,
        location: 'exterior_wall' as const,
        confirmed: true,
      },
    ];
    const next = insulationAssemblyRowsWithoutPricedLocation(rows, 'roof_deck');
    expect(next.map(row => row.id)).toEqual(['attic', 'wall']);
  });
});
