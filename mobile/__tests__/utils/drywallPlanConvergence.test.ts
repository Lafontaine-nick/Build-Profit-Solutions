import {
  buildDrywallStructuredMeasurements,
  copyDrywallQuantityFields,
  drywallSurfaceFromComponents,
  drywallSurfacePlanningQuantity,
  hydrateDrywallComponentMeasurementsFromPlanContext,
  isProtectedDrywallQuantity,
  isUndercountedDrywallSurface,
  normalizeDrywallPlanMeasurements,
  parseDrywallMeasurementsFromNotes,
  reconcileIncompleteDrywallGeometryTakeoff,
  resolveDrywallConditionedSurfaceQuantity,
  resolveDrywallPackageSurfaceQuantity,
  resolveDrywallProductionAssemblyBaseline,
  resolveDrywallBoardMix,
  resolveDrywallBoardMaterialMultiplier,
  resolveDrywallBoardLaborMultiplier,
  resolveDrywallBoardBucketPackageTotal,
  syncDrywallPackageTotalFromBoardBuckets,
  hydrateDrywallSpecialtyBoardMeasurements,
  drywallSheetLengthLaborMultiplier,
  drywallSheetLengthMaterialMultiplier,
  drywallAccessLaborMultiplier,
  resolveDrywallPackageMaterialMultiplier,
  resolveDrywallPackageLaborMultiplier,
  resolveDrywallSheetLengthChoiceId,
  hasDifficultDrywallAccess,
  hasDifficultDrywallSheetHandlingAccess,
  drywallFinishLaborBucketLabel,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import {
  resolveScopeItemSuggestedPricing,
  resolveChecklistItemQuantity,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

describe('drywall plan convergence', () => {
  test('does not turn living area into a plan takeoff', () => {
    expect(
      normalizeDrywallPlanMeasurements({
        floorAreaSqft: 3660,
        drywallSqft: undefined,
      })
    ).toEqual({ floorAreaSqft: 3660 });
  });

  test('normalizes wall and ceiling components into total drywall surface', () => {
    expect(
      drywallSurfaceFromComponents({
        drywallWallSqft: 8200,
        drywallCeilingSqft: 3660,
        drywallOpeningDeductionSqft: 1017,
      })
    ).toBe(11860);

    expect(
      normalizeDrywallPlanMeasurements({
        drywallSqft: 4056,
        drywallWallsSqft: 8200,
        drywallCeilingsSqft: 3660,
        drywallOpeningsSqft: 1017,
        floorAreaSqft: 3098,
      }).drywallSqft
    ).toBe(11860);

    expect(
      normalizeDrywallPlanMeasurements({
        drywallSqft: 4056,
        drywallWallSqft: 8200,
        drywallCeilingSqft: 3660,
        drywallOpeningDeductionSqft: 1017,
        quickMeasurementSources: { drywallSqft: 'user_entered' },
      }).drywallSqft
    ).toBe(4056);
  });

  test('keeps the existing Plan 39 undercount guard and fallback quantity', () => {
    expect(isUndercountedDrywallSurface(4056, 3098)).toBe(true);
    expect(isUndercountedDrywallSurface(10843, 3098)).toBe(false);
    expect(drywallSurfacePlanningQuantity(3098)).toBe(10843);
    expect(drywallSurfacePlanningQuantity(3660)).toBe(12810);
  });

  test('parses explicit notes quantities but ignores unrelated living area', () => {
    expect(
      parseDrywallMeasurementsFromNotes(
        'Two-story home, 3,098 sqft living area. Install 5,469 sqft of drywall.'
      )
    ).toEqual({ drywallSqft: 5469 });

    expect(
      parseDrywallMeasurementsFromNotes(
        'Walls are 8,200 SF and ceilings are 3,660 SF; deduct 1,017 SF openings.'
      )
    ).toEqual({
      drywallWallSqft: 8200,
      drywallCeilingSqft: 3660,
      drywallOpeningDeductionSqft: 1017,
      drywallSqft: 11860,
    });
  });

  test('uses the same normalized keys for plan and notes inputs', () => {
    const plan = normalizeTradeMeasurements(
      'drywall',
      { drywallSqft: 10843 },
      'plan'
    );
    const notes = normalizeTradeMeasurements(
      'drywall',
      { notes: 'Install 10,843 sqft of drywall.' },
      'notes'
    );

    expect(plan.measurements.drywallSqft).toBe(10843);
    expect(notes.measurements.drywallSqft).toBe(10843);
    expect(plan.quickMeasurementSources?.drywallSqft).toBe('plan_detected');
    expect(notes.quickMeasurementSources?.drywallSqft).toBe('user_entered');
    expect(plan.structuredMeasurements?.itemQuantities).toEqual({
      drywall: {
        quantity: 10843,
        unit: 'sqft',
        quantitySource: 'plan_detected',
      },
    });
  });

  test('hydrates wall and ceiling components from dimensioned rooms', () => {
    expect(
      hydrateDrywallComponentMeasurementsFromPlanContext(
        { drywallSqft: 6263 },
        [
          { name: 'Great Room', lengthFt: 20, widthFt: 15 },
          { name: 'Bed 1', lengthFt: 12, widthFt: 10 },
        ],
        { wallHeightFt: 10 }
      )
    ).toMatchObject({
      drywallWallSqft: 1140,
      drywallCeilingSqft: 420,
      drywallSqft: 1560,
    });
  });

  test('hydrates garage drywall from labeled garage schedule when rooms lack dimensions', () => {
    const hydrated = hydrateDrywallComponentMeasurementsFromPlanContext(
      {
        drywallWallSqft: 4918.2,
        drywallCeilingSqft: 1345.2,
        drywallSqft: 6263.4,
        floorAreaSqft: 3660,
      },
      [{ name: 'Great Room', lengthFt: 20, widthFt: 15 }],
      {
        wallHeightFt: 10.17,
        buildingAreas: {
          totalLivingSqft: 3660,
          mainFloorLivingSqft: 2047,
          upstairsLivingSqft: 1613,
          garageSqft: 781,
        },
      }
    );
    expect(hydrated.garageCeilingDrywallSqft).toBe(781);
    expect(Number(hydrated.garageWallDrywallSqft)).toBeCloseTo(1136.9, 1);
    expect(hydrated.drywallCeilingSqft).toBe(3660);
    expect(Number(hydrated.drywallWallSqft)).toBeCloseTo(9150, 0);
    expect(hydrated.drywallSqft).toBe(14728);
    expect(Number(hydrated.fireRatedDrywallSqft)).toBeCloseTo(1917.9, 0);
  });

  test('reconciles Plan 58 partial geometry to schedule ceiling and planning wall split', () => {
    const reconciled = reconcileIncompleteDrywallGeometryTakeoff(
      {
        floorAreaSqft: 3660,
        drywallWallSqft: 4918.2,
        drywallCeilingSqft: 1345.2,
        drywallSqft: 6263.4,
      },
      {
        planFacts: {
          buildingAreas: {
            totalLivingSqft: 3660,
            mainFloorLivingSqft: 2047,
            upstairsLivingSqft: 1613,
            garageSqft: 781,
          },
        },
      }
    );
    expect(reconciled.reconciled).toBe(true);
    expect(reconciled.measurements.drywallCeilingSqft).toBe(3660);
    expect(reconciled.measurements.drywallWallSqft).toBe(9150);
    expect(reconciled.measurements.drywallSqft).toBeGreaterThan(14700);
    expect(
      resolveDrywallConditionedSurfaceQuantity(reconciled.measurements, {
        planFacts: {
          buildingAreas: {
            totalLivingSqft: 3660,
            mainFloorLivingSqft: 2047,
            upstairsLivingSqft: 1613,
          },
        },
      })
    ).toBe(12810);
    expect(
      resolveDrywallPackageSurfaceQuantity(
        {
          ...reconciled.measurements,
          garageCeilingDrywallSqft: 781,
          garageWallDrywallSqft: 1136.9,
        },
        {
          planFacts: {
            buildingAreas: {
              totalLivingSqft: 3660,
              mainFloorLivingSqft: 2047,
              upstairsLivingSqft: 1613,
              garageSqft: 781,
            },
          },
        }
      )
    ).toBe(14728);
    const structured = buildDrywallStructuredMeasurements(
      {
        ...reconciled.measurements,
        garageCeilingDrywallSqft: 781,
        garageWallDrywallSqft: 1136.9,
        planFacts: {
          buildingAreas: {
            totalLivingSqft: 3660,
            mainFloorLivingSqft: 2047,
            upstairsLivingSqft: 1613,
            garageSqft: 781,
          },
        },
      },
      'plan_detected'
    );
    expect(structured.itemQuantities?.drywall).toMatchObject({
      quantity: 14728,
      quantitySource: 'needs_confirmation',
    });
  });

  test('derives SHV-calibrated production rate from gypsum board lump ÷ package SF', () => {
    const baseline = resolveDrywallProductionAssemblyBaseline({
      livingSf: 3660,
      packageSurfaceSqft: 14731,
    });
    expect(baseline.barometerTotal).toBe(24500);
    expect(baseline.impliedUnitRate).toBeCloseTo(1.66, 2);
    expect(baseline.material + baseline.labor).toBeCloseTo(1.66, 2);
  });

  test('persists drywall component fields through scope payload round-trips', () => {
    const copied = copyDrywallQuantityFields({
      drywallWallSqft: 4918,
      drywallCeilingSqft: 1345,
      drywallSqft: 6263,
    });
    expect(copied).toMatchObject({
      drywallWallSqft: 4918,
      drywallCeilingSqft: 1345,
      drywallSqft: 6263,
    });

    const payload = scopeMeasurementsPayloadForPersist(
      {
        ...emptyQuickMeasurementInput(),
        drywallWallSqft: '4918',
        drywallCeilingSqft: '1345',
        drywallSqft: '6263',
        itemQuantities: {},
      },
      { templateKey: 'drywall' }
    );
    const restored = scopeMeasurementsInputFromPayload(payload);
    expect(restored.drywallWallSqft).toBe('4918');
    expect(restored.drywallCeilingSqft).toBe('1345');
    expect(restored.drywallSqft).toBe('6263');
  });

  test('preserves explicit contractor quantities as protected inputs', () => {
    expect(
      isProtectedDrywallQuantity({
        drywallSqft: 4056,
        quickMeasurementSources: { drywallSqft: 'user_entered' },
      })
    ).toBe(true);
    expect(
      isProtectedDrywallQuantity({
        drywallSqft: 10843,
        quickMeasurementSources: { drywallSqft: 'plan_detected' },
      })
    ).toBe(true);
    expect(
      buildDrywallStructuredMeasurements(
        {
          drywallSqft: 4056,
          quickMeasurementSources: { drywallSqft: 'user_entered' },
        },
        'user_entered'
      ).itemQuantities?.drywall
    ).toEqual({
      quantity: 4056,
      unit: 'sqft',
      quantitySource: 'user_entered',
    });
  });

  test('sums location board buckets to the full package without double-subtracting garage', () => {
    const measurements = {
      floorAreaSqft: 3660,
      drywallWallSqft: 9150,
      drywallCeilingSqft: 3660,
      garageWallDrywallSqft: 1136.9,
      garageCeilingDrywallSqft: 781,
      fireRatedDrywallSqft: 1917.9,
      drywallSqft: 14728,
    };
    expect(
      resolveDrywallBoardBucketPackageTotal(measurements, {
        planFacts: {
          buildingAreas: { totalLivingSqft: 3660, garageSqft: 781 },
        },
      })
    ).toBeCloseTo(14728, 0);
    const synced = syncDrywallPackageTotalFromBoardBuckets(measurements);
    expect(Number(synced.drywallSqft)).toBeCloseTo(14728, 0);
  });

  test('splits Plan 58 package into standard and fire-rated board zones', () => {
    const measurements = {
      floorAreaSqft: 3660,
      drywallWallSqft: 9150,
      drywallCeilingSqft: 3660,
      garageWallDrywallSqft: 1136.9,
      garageCeilingDrywallSqft: 781,
      fireRatedDrywallSqft: 1917.9,
      drywallSqft: 14728,
      planFacts: {
        buildingAreas: {
          totalLivingSqft: 3660,
          garageSqft: 781,
        },
      },
    };
    const zones = resolveDrywallBoardMix(measurements, { packageSqft: 14728 });
    expect(zones.map(zone => zone.id)).toEqual([
      'house_walls_half_inch',
      'house_ceilings_five_eighth',
      'garage_rated_type_x',
    ]);
    expect(zones[0]?.sqft).toBe(9150);
    expect(zones[1]?.sqft).toBe(3660);
    expect(zones[2]?.sqft).toBeCloseTo(1918, 0);
    expect(zones[0]?.boardLabel).toBe('1/2" standard gypsum');
    expect(zones[1]?.boardLabel).toBe('5/8" standard gypsum');
    expect(zones[2]?.boardLabel).toBe('5/8" Type X');
  });

  test('infers fire-rated board SF from garage takeoff when missing', () => {
    const hydrated = hydrateDrywallSpecialtyBoardMeasurements({
      garageWallDrywallSqft: 900,
      garageCeilingDrywallSqft: 780,
    });
    expect(hydrated.fireRatedDrywallSqft).toBe(1680);
    expect(
      (hydrated.quickMeasurementSources as Record<string, string>)
        ?.fireRatedDrywallSqft
    ).toBe('inferred_from_garage_takeoff');
  });

  test('applies board-type material premium to complete package pricing', () => {
    const measurements = {
      drywallSqft: 14728,
      floorAreaSqft: 3660,
      drywallWallSqft: 9150,
      drywallCeilingSqft: 3660,
      garageWallDrywallSqft: 1136.9,
      garageCeilingDrywallSqft: 781,
      fireRatedDrywallSqft: 1917.9,
      drywallFinishLevel: 'orange_peel',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'drywall',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
    });
    const mixed = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'drywall',
      resolved,
      { checklistItems: [{ id: 'drywall', state: 'included' }] }
    );
    const standardOnly = resolveScopeItemSuggestedPricing(
      'drywall',
      { ...measurements, fireRatedDrywallSqft: 0, garageWallDrywallSqft: 0, garageCeilingDrywallSqft: 0 },
      'drywall',
      { ...resolved, quantity: 12810 },
      { checklistItems: [{ id: 'drywall', state: 'included' }] }
    );
    expect(mixed.fill?.total).toBeGreaterThan(standardOnly.fill!.total);
    expect(resolveDrywallBoardMaterialMultiplier(measurements, 14728)).toBeGreaterThan(1);
    expect(resolveDrywallBoardLaborMultiplier(measurements, 14728)).toBe(1);
  });

  test('Plan 58 orange-peel package stays near SHV gypsum-board benchmark after board mix', () => {
    const measurements = {
      drywallSqft: 14728,
      floorAreaSqft: 3660,
      drywallWallSqft: 9150,
      drywallCeilingSqft: 3660,
      garageWallDrywallSqft: 1136.9,
      garageCeilingDrywallSqft: 781,
      fireRatedDrywallSqft: 1917.9,
      drywallFinishLevel: 'orange_peel',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'drywall',
      planFacts: {
        buildingAreas: {
          totalLivingSqft: 3660,
          garageSqft: 781,
        },
      },
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'drywall',
      resolved,
      { checklistItems: [{ id: 'drywall', state: 'included' }] }
    );
    expect(pricing.fill?.total).toBeGreaterThanOrEqual(24450);
    expect(pricing.fill?.total).toBeLessThanOrEqual(25000);
    expect(pricing.fill?.labor).toBe(14455);
    expect(
      resolveDrywallPackageMaterialMultiplier(measurements, 14728, {
        completePackage: true,
      })
    ).toBeLessThan(resolveDrywallBoardMaterialMultiplier(measurements, 14728));
  });

  test('applies modest sheet-length material savings without labor changes', () => {
    expect(
      drywallSheetLengthMaterialMultiplier(
        { drywallSheetLength: '12ft' },
        { completePackage: true }
      )
    ).toBe(0.96);
    expect(
      drywallSheetLengthMaterialMultiplier(
        { drywallSheetLength: '10ft' },
        { completePackage: true }
      )
    ).toBe(0.98);
    expect(
      drywallSheetLengthMaterialMultiplier(
        { drywallSheetLength: '8ft' },
        { completePackage: true }
      )
    ).toBe(1);
    expect(
      drywallSheetLengthLaborMultiplier(
        { drywallSheetLength: '12ft', storyCount: 1 },
        { completePackage: true, packageSqft: 14728 }
      )
    ).toBe(1);
  });

  test('applies difficult-access labor on two-story or complex-ceiling work', () => {
    expect(
      drywallAccessLaborMultiplier(
        { storyCount: 2 },
        14728
      )
    ).toBe(1.03);
    expect(
      resolveDrywallPackageLaborMultiplier(
        { storyCount: 2, drywallFinishLevel: 'orange_peel' },
        14728,
        { completePackage: true }
      )
    ).toBeCloseTo(1.03, 2);
    expect(
      hasDifficultDrywallAccess(
        { storyCount: 2, vaultedCeilingDrywallSqft: 0 },
        14728
      )
    ).toBe(true);
  });

  test('labels knockdown finish on complete package labor bucket', () => {
    expect(
      drywallFinishLaborBucketLabel('knockdown', { scope: 'complete' })
    ).toBe('Hang, tape, finish, and knockdown texture labor');
    expect(
      drywallFinishLaborBucketLabel('knockdown', { scope: 'finish_tape' })
    ).toBe('Tape, mud, finish, and knockdown texture labor');
    expect(drywallFinishLaborBucketLabel('orange_peel')).toBe(
      'Hang, tape, finish, and orange-peel texture labor'
    );
  });

  test('applies knockdown finish label to complete package suggested pricing', () => {
    const measurements = {
      drywallSqft: 14728,
      floorAreaSqft: 3660,
      drywallFinishLevel: 'knockdown',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'drywall',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('drywall', measurements, {
      templateKey: 'drywall',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'drywall',
      measurements,
      'drywall',
      resolved,
      { checklistItems: [{ id: 'drywall', state: 'included' }] }
    );
    expect(pricing.fill?.costBuckets?.[1]?.label).toBe(
      'Hang, tape, finish, and knockdown texture labor'
    );
  });

  test('Plan 58 finish options step up material-fixed complete package totals', () => {
    const baseMeasurements = {
      drywallSqft: 14728,
      floorAreaSqft: 3660,
      drywallWallSqft: 9150,
      drywallCeilingSqft: 3660,
      garageWallDrywallSqft: 1136.9,
      garageCeilingDrywallSqft: 781,
      fireRatedDrywallSqft: 1917.9,
      planImportMode: 'selected_trade',
      planImportTradeKey: 'drywall',
      planFacts: {
        buildingAreas: {
          totalLivingSqft: 3660,
          garageSqft: 781,
        },
      },
      itemQuantities: {},
    } as const;
    const checklistItems = [{ id: 'drywall', state: 'included' }];
    const pricingForFinish = (finishLevel: string) => {
      const measurements = {
        ...baseMeasurements,
        drywallFinishLevel: finishLevel,
      } as any;
      const resolved = resolveChecklistItemQuantity('drywall', measurements, {
        templateKey: 'drywall',
      });
      const pricing = resolveScopeItemSuggestedPricing(
        'drywall',
        measurements,
        'drywall',
        resolved,
        { checklistItems }
      );
      return {
        total: pricing.fill?.total ?? 0,
        material: pricing.fill?.material ?? 0,
        labor: pricing.fill?.labor ?? 0,
      };
    };
    const orangePeel = pricingForFinish('orange_peel');
    const knockdown = pricingForFinish('knockdown');
    const level4 = pricingForFinish('smooth_level_4');
    const skipTrowel = pricingForFinish('skip_trowel');
    const level5 = pricingForFinish('smooth_level_5');

    expect(orangePeel.material).toBeGreaterThan(0);
    expect(knockdown.material).toBeCloseTo(orangePeel.material, 0);
    expect(level4.material).toBeCloseTo(orangePeel.material, 0);
    expect(skipTrowel.material).toBeCloseTo(orangePeel.material, 0);
    expect(level5.material).toBeCloseTo(orangePeel.material, 0);

    expect(knockdown.labor / orangePeel.labor).toBeCloseTo(1.1, 2);
    expect(level4.labor / orangePeel.labor).toBeCloseTo(1.17, 2);
    expect(skipTrowel.labor / orangePeel.labor).toBeCloseTo(1.23, 2);
    expect(level5.labor / orangePeel.labor).toBeCloseTo(1.52, 2);
    expect(skipTrowel.labor).toBeGreaterThan(level4.labor);
    expect(level5.total - orangePeel.total).toBeGreaterThan(
      knockdown.total - orangePeel.total
    );
    expect(level5.total).toBeGreaterThan(skipTrowel.total);
  });
});
