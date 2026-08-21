import {
  getQuickMeasurementEstimate,
  isLegacyTotalLivingRoofSquares,
  isUndercountedDrywallSurface,
  syncMeasurementsWithSouthernUtahPlanFacts,
} from '@/utils/quickMeasurementEstimates';
import { enrichPlanFactsWithSouthernUtahBarometer } from '@/utils/southernUtahPlanFacts';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';

describe('southernUtahPlanFacts roof footprint', () => {
  it('enriches Plan 39 cover-only import with main-floor + low-slope', () => {
    const enriched = enrichPlanFactsWithSouthernUtahBarometer(
      {
        buildingAreas: {
          totalLivingSqft: 3098,
          mainFloorLivingSqft: 3098, // false cover-total alias
          garageSqft: 972,
          coveredPatioSqft: 1281,
        },
        storyCount: 1,
      },
      3098
    )!;
    expect(enriched.buildingAreas?.mainFloorLivingSqft).toBe(1892);
    expect(enriched.buildingAreas?.upstairsLivingSqft).toBe(1209);
    expect(enriched.storyCount).toBe(2);
    expect(enriched.roofPitch).toBe('low-slope');
  });

  it('estimates Plan 39 roof at ~46.2 squares (not 63.7 total-living fallback)', () => {
    const estimate = getQuickMeasurementEstimate('roofSquares', {
      floorAreaSqft: '3098',
      garageSqft: '972',
      deckSqft: '1281',
      planFacts: {
        buildingAreas: {
          totalLivingSqft: 3098,
          garageSqft: 972,
          coveredPatioSqft: 1281,
        },
      },
    })!;
    expect(estimate.value).toBeCloseTo(46.2, 1);
    expect(estimate.inputsUsed.projectedRoofAreaSqft).toBe(1892 + 972 + 1281);
    expect(estimate.inputsUsed.roofPitch).toBe('low-slope');
  });

  it('replaces legacy 63.7 roof squares when syncing Plan 39 measurements', () => {
    const legacy = ((3098 + 972 + 1281) * 1.083 * 1.1) / 100;
    expect(legacy).toBeCloseTo(63.7, 1);
    expect(
      isLegacyTotalLivingRoofSquares(legacy, {
        floorAreaSqft: 3098,
        garageSqft: 972,
        deckSqft: 1281,
      })
    ).toBe(true);

    const synced = syncMeasurementsWithSouthernUtahPlanFacts({
      floorAreaSqft: '3098',
      garageSqft: '972',
      deckSqft: '1281',
      roofSquares: '63.7',
      planFacts: {
        buildingAreas: { totalLivingSqft: 3098, garageSqft: 972, coveredPatioSqft: 1281 },
      },
    });
    expect(Number(synced.roofSquares)).toBeCloseTo(46.2, 1);
    expect(synced.planFacts?.buildingAreas?.mainFloorLivingSqft).toBe(1892);
  });

  it('replaces undercounted Plan 39 drywall (4,056) with surface planning qty', () => {
    expect(isUndercountedDrywallSurface(4056, 3098)).toBe(true);
    expect(isUndercountedDrywallSurface(10843, 3098)).toBe(false);

    const synced = syncMeasurementsWithSouthernUtahPlanFacts(
      {
        floorAreaSqft: '3098',
        drywallSqft: '4056',
        wallPaintSqft: '4056',
        itemQuantities: {
          drywall: { quantity: '4056', unit: 'sqft', quantitySource: 'notes' },
        },
        planFacts: {
          buildingAreas: {
            totalLivingSqft: 3098,
            mainFloorLivingSqft: 1892,
            upstairsLivingSqft: 1209,
          },
          storyCount: 2,
        },
      },
      { templateKey: 'ground_up' }
    );
    expect(Number(synced.drywallSqft)).toBe(10843);
    expect(Number(synced.wallPaintSqft)).toBe(10843);
    expect(synced.itemQuantities?.drywall).toBeUndefined();

    // Notes 4,056 must not win — Confirm Scope resolves living×3.5 and ~$23k (not $8.8k).
    const notesInput = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '3098',
      drywallSqft: '4056',
      itemQuantities: {
        drywall: { quantity: '4056', unit: 'sqft', quantitySource: 'notes' },
      },
    };
    const resolved = resolveChecklistItemQuantity('drywall', notesInput as any, {
      templateKey: 'ground_up',
    });
    expect(resolved.quantity).toBe(10843);
    expect(resolved.sourceLabel).toBe('Calculated');

    const priced = resolveScopeItemSuggestedPricing(
      'drywall',
      notesInput as any,
      'ground_up',
      resolved
    );
    expect(priced.fill!.total).toBeGreaterThan(20000);
    expect(priced.fill!.total).toBeLessThan(27000);
    expect(priced.fill!.total).toBeGreaterThan(15000); // not the $8.8k notes path
  });

  it('suggests Plan 58 conditioned ceiling SF without marking it detected', () => {
    const synced = syncMeasurementsWithSouthernUtahPlanFacts(
      {
        floorAreaSqft: '3660',
        exteriorWallInsulationSqft: '1950.4',
        openingDeductionSqft: '289.6',
        planFacts: {
          buildingAreas: {
            totalLivingSqft: 3660,
            mainFloorLivingSqft: 2047,
            upstairsLivingSqft: 1613,
            garageSqft: 781,
            coveredPatioSqft: 297,
          },
          storyCount: 2,
        },
      } as any,
      { templateKey: 'insulation' }
    );
    expect(Number(synced.atticInsulationSqft)).toBe(3660);
    expect(synced.quickMeasurementSources?.atticInsulationSqft).toBe(
      'calculated_from_components'
    );
  });
});
