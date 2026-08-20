import {
  buildAcceptanceFromSuggestedBlock,
} from '@/utils/acceptedPricingSummaryUi';
import { resyncAppliedScopePricingAfterMeasurementChanges, scaleSuggestedBlockToTakeoffQuantity } from '@/utils/confirmScopeAppliedPricingResync';
import {
  sumConfirmScopeAppliedPricingBreakdown,
} from '@/utils/benchmarkReasonablenessContext';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

const plumbingItems: ScopeChecklistItem[] = [
  {
    id: 'plumbing_rough',
    label: 'Plumbing rough-in points',
    state: 'included',
    inScope: true,
  },
  {
    id: 'water_line',
    label: 'Underground water service',
    state: 'included',
    inScope: true,
  },
];

describe('confirmScopeAppliedPricingResync', () => {
  it('scales an Apply block onto a larger Quick Measurements LF', () => {
    const scaled = scaleSuggestedBlockToTakeoffQuantity(
      {
        material: 400,
        labor: 1100,
        total: 1500,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: 'National Average',
        helper: 'test',
        mode: 'suggested_price',
        benchmarkAction: 'price_ready',
        basis: { quantity: 50, unit: 'lf' },
      },
      70
    );
    expect(scaled.total).toBe(2100);
    expect(scaled.material).toBe(560);
    expect(scaled.labor).toBe(1540);
    expect(scaled.basis?.quantity).toBe(70);
  });

  it('recomputes applied plumbing rough pricing when quick measurement count increases', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 2000,
      labor: 3000,
      total: 5000,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      plumbingRoughPointCount: '10',
      itemQuantities: {
        plumbing_rough: {
          quantity: '10',
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__material: {
          quantity: '2000',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__labor: {
          quantity: '3000',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__allowance: {
          quantity: '5000',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        plumbing_rough: acceptance,
      },
    };

    const next = {
      ...previous,
      plumbingRoughPointCount: '12',
      itemQuantities: {
        ...previous.itemQuantities,
        plumbing_rough: {
          quantity: '12',
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.plumbing_rough__allowance?.quantity)).toBeGreaterThan(
      5000
    );
    expect(synced.pricingAcceptance?.plumbing_rough?.totalAmount).toBeGreaterThan(5000);
    expect(
      sumConfirmScopeAppliedPricingBreakdown({
        items: plumbingItems,
        measurements: synced,
        templateKey: 'plumbing_service',
      }).total
    ).toBeGreaterThan(5000);
  });

  it('recomputes applied LF pricing when water takeoff changes', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 400,
      labor: 1100,
      total: 1500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      waterLineLf: '50',
      itemQuantities: {
        water_line: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        water_line__material: {
          quantity: '400',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__labor: {
          quantity: '1100',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__allowance: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        water_line: acceptance,
      },
    };

    const next = {
      ...previous,
      waterLineLf: '55',
      itemQuantities: {
        ...previous.itemQuantities,
        water_line: {
          quantity: '55',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.water_line__allowance?.quantity)).toBeGreaterThan(
      1500
    );
    expect(synced.pricingAcceptance?.water_line?.totalAmount).toBeGreaterThan(1500);
  });

  it('recomputes applied LF pricing when only quick-measurement LF changes', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 400,
      labor: 1100,
      total: 1500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      waterLineLf: '50',
      itemQuantities: {
        water_line: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        water_line__material: {
          quantity: '400',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__labor: {
          quantity: '1100',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__allowance: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        water_line: acceptance,
      },
    };

    const next = {
      ...previous,
      waterLineLf: '55',
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.water_line__allowance?.quantity)).toBeGreaterThan(
      1500
    );
    expect(synced.pricingAcceptance?.water_line?.totalAmount).toBeGreaterThan(1500);
  });

  it('recomputes applied LF pricing when LF decreases and itemQuantities lag QM', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 400,
      labor: 1100,
      total: 1500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      waterLineLf: '50',
      itemQuantities: {
        water_line: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        water_line__material: {
          quantity: '400',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__labor: {
          quantity: '1100',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__allowance: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        water_line: acceptance,
      },
    };

    const next = {
      ...previous,
      waterLineLf: '45',
      itemQuantities: {
        ...previous.itemQuantities,
        water_line: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.water_line__allowance?.quantity)).toBeLessThan(
      1500
    );
    expect(synced.pricingAcceptance?.water_line?.totalAmount).toBeLessThan(1500);
    expect(Number(synced.itemQuantities?.water_line?.quantity)).toBe(45);
  });

  it('scales applied water LF from 50 to 70 even when complexity also changes', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 400,
      labor: 1100,
      total: 1500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      waterLineLf: '50',
      storyCount: '2',
      planImportMode: 'selected_trade' as const,
      planImportTradeKey: 'plumbing' as const,
      itemQuantities: {
        water_line: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        water_line__material: {
          quantity: '400',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__labor: {
          quantity: '1100',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__allowance: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        water_line: acceptance,
      },
    };

    const next = {
      ...previous,
      waterLineLf: '70',
      projectComplexity: {
        mode: 'automatic' as const,
        stories: 2 as const,
      },
      itemQuantities: {
        ...previous.itemQuantities,
        water_line: {
          quantity: '70',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing',
    });

    expect(Number(synced.itemQuantities?.water_line__allowance?.quantity)).toBe(
      2100
    );
    expect(Number(synced.itemQuantities?.water_line__material?.quantity)).toBe(
      560
    );
    expect(Number(synced.itemQuantities?.water_line__labor?.quantity)).toBe(
      1540
    );
    expect(synced.pricingAcceptance?.water_line?.totalAmount).toBe(2100);
  });

  it('does not compound LF pricing while a text edit emits intermediate values', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 400,
      labor: 1100,
      total: 1500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });
    const base = {
      waterLineLf: '50',
      itemQuantities: {
        water_line: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        water_line__sqft_basis: {
          quantity: '50',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        water_line__material: {
          quantity: '400',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__labor: {
          quantity: '1100',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        water_line__allowance: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: { water_line: acceptance },
    };
    const cleared = resyncAppliedScopePricingAfterMeasurementChanges({
      previous: base,
      next: {
        ...base,
        waterLineLf: '',
        itemQuantities: {
          water_line__sqft_basis: base.itemQuantities.water_line__sqft_basis,
          water_line__material: base.itemQuantities.water_line__material,
          water_line__labor: base.itemQuantities.water_line__labor,
          water_line__allowance: base.itemQuantities.water_line__allowance,
        },
      },
      templateKey: 'plumbing_service',
    });
    const typedOneDigit = resyncAppliedScopePricingAfterMeasurementChanges({
      previous: cleared,
      next: {
        ...cleared,
        waterLineLf: '5',
        itemQuantities: {
          ...cleared.itemQuantities,
          water_line: {
            quantity: '5',
            unit: 'lf',
            quantitySource: 'user_entered' as const,
          },
        },
      },
      templateKey: 'plumbing_service',
    });
    const typedFinal = resyncAppliedScopePricingAfterMeasurementChanges({
      previous: typedOneDigit,
      next: {
        ...typedOneDigit,
        waterLineLf: '50',
        itemQuantities: {
          ...typedOneDigit.itemQuantities,
          water_line: {
            quantity: '50',
            unit: 'lf',
            quantitySource: 'user_entered' as const,
          },
        },
      },
      templateKey: 'plumbing_service',
    });
    expect(
      Number(typedFinal.itemQuantities?.water_line__allowance?.quantity)
    ).toBe(1500);

    const changedToSeventy = resyncAppliedScopePricingAfterMeasurementChanges({
      previous: typedFinal,
      next: {
        ...typedFinal,
        waterLineLf: '70',
        itemQuantities: {
          ...typedFinal.itemQuantities,
          water_line: {
            quantity: '70',
            unit: 'lf',
            quantitySource: 'user_entered' as const,
          },
        },
      },
      templateKey: 'plumbing_service',
    });
    expect(
      Number(changedToSeventy.itemQuantities?.water_line__allowance?.quantity)
    ).toBe(2100);

    const changedToEighty = resyncAppliedScopePricingAfterMeasurementChanges({
      previous: changedToSeventy,
      next: {
        ...changedToSeventy,
        waterLineLf: '80',
        itemQuantities: {
          ...changedToSeventy.itemQuantities,
          water_line: {
            quantity: '80',
            unit: 'lf',
            quantitySource: 'user_entered' as const,
          },
        },
      },
      templateKey: 'plumbing_service',
    });
    expect(
      Number(changedToEighty.itemQuantities?.water_line__allowance?.quantity)
    ).toBe(2400);
  });

  it('recomputes applied LF pricing when sewer takeoff changes', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 360,
      labor: 1140,
      total: 1500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      sewerLineLf: '30',
      itemQuantities: {
        sewer_line: {
          quantity: '30',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
        sewer_line__material: {
          quantity: '360',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        sewer_line__labor: {
          quantity: '1140',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        sewer_line__allowance: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        sewer_line: acceptance,
      },
    };

    const next = {
      ...previous,
      sewerLineLf: '40',
      itemQuantities: {
        ...previous.itemQuantities,
        sewer_line: {
          quantity: '40',
          unit: 'lf',
          quantitySource: 'user_entered' as const,
        },
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.sewer_line__allowance?.quantity)).toBeGreaterThan(
      1500
    );
    expect(synced.pricingAcceptance?.sewer_line?.totalAmount).toBeGreaterThan(1500);
  });

  it('does not auto-resync manual_adjusted pricing when takeoff changes', () => {
    const previous = {
      gasApplianceConnectionCount: '3',
      itemQuantities: {
        gas_appliance_connections: {
          quantity: '3',
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
        gas_appliance_connections__material: {
          quantity: '225',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        gas_appliance_connections__labor: {
          quantity: '450',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        gas_appliance_connections__allowance: {
          quantity: '675',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        gas_appliance_connections: {
          selectionStatus: 'manual_adjusted' as const,
          pricingSourceLabel: 'User adjusted',
          pricingSourceKind: 'user_entered' as const,
          pricingTypeLabel: 'Material + labor',
          geographicBasis: 'National',
          materialAmount: 225,
          laborAmount: 450,
          totalAmount: 675,
        },
      },
    };

    const next = {
      ...previous,
      gasApplianceConnectionCount: '4',
      itemQuantities: {
        ...previous.itemQuantities,
        gas_appliance_connections: {
          quantity: '4',
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(synced.itemQuantities?.gas_appliance_connections__allowance?.quantity).toBe(
      '675'
    );
    expect(synced.pricingAcceptance?.gas_appliance_connections?.totalAmount).toBe(
      675
    );
  });

  it('recomputes applied plumbing labor when story count increases', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 1500,
      labor: 3500,
      total: 5000,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      plumbingRoughPointCount: '10',
      floorAreaSqft: '3660',
      storyCount: '1',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'plumbing',
      planImportFingerprint: 'plan-58',
      quickMeasurementSources: { plumbingRoughPointCount: 'plan_detected' },
      itemQuantities: {
        plumbing_rough: {
          quantity: '10',
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__material: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__labor: {
          quantity: '3500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__allowance: {
          quantity: '5000',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        plumbing_rough: acceptance,
      },
    };

    const next = {
      ...previous,
      storyCount: '2',
      projectComplexity: {
        mode: 'automatic' as const,
        squareFootage: 3660,
        // Simulate the persisted complexity object lagging the edited QM field.
        stories: 1 as const,
      },
      quickMeasurementUserOverrides: {
        storyCount: true,
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.plumbing_rough__material?.quantity)).toBe(
      1500
    );
    expect(Number(synced.itemQuantities?.plumbing_rough__labor?.quantity)).toBe(
      3850
    );
    expect(Number(synced.itemQuantities?.plumbing_rough__allowance?.quantity)).toBe(
      5350
    );
    expect(synced.pricingAcceptance?.plumbing_rough?.laborAmount).toBe(3850);
    expect(synced.pricingAcceptance?.plumbing_rough?.totalAmount).toBe(5350);
  });

  it('recomputes applied plumbing labor when story count decreases', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock({
      material: 1500,
      labor: 3850,
      total: 5350,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National Average',
      helper: 'test',
      mode: 'suggested_price',
      benchmarkAction: 'price_ready',
    });

    const previous = {
      plumbingRoughPointCount: '10',
      floorAreaSqft: '3660',
      storyCount: '2',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'plumbing',
      planImportFingerprint: 'plan-58',
      projectComplexity: {
        mode: 'automatic' as const,
        squareFootage: 3660,
        stories: 2 as const,
      },
      itemQuantities: {
        plumbing_rough: {
          quantity: '10',
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__material: {
          quantity: '1500',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__labor: {
          quantity: '3850',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
        plumbing_rough__allowance: {
          quantity: '5350',
          unit: 'allowance',
          quantitySource: 'user_entered' as const,
        },
      },
      pricingAcceptance: {
        plumbing_rough: acceptance,
      },
    };

    const next = {
      ...previous,
      storyCount: '1',
      projectComplexity: {
        mode: 'automatic' as const,
        squareFootage: 3660,
        // Simulate the persisted complexity object lagging the edited QM field.
        stories: 2 as const,
      },
      quickMeasurementUserOverrides: {
        storyCount: true,
      },
    };

    const synced = resyncAppliedScopePricingAfterMeasurementChanges({
      previous,
      next,
      templateKey: 'plumbing_service',
    });

    expect(Number(synced.itemQuantities?.plumbing_rough__labor?.quantity)).toBe(
      3500
    );
    expect(Number(synced.itemQuantities?.plumbing_rough__allowance?.quantity)).toBe(
      5000
    );
    expect(synced.pricingAcceptance?.plumbing_rough?.laborAmount).toBe(3500);
    expect(synced.pricingAcceptance?.plumbing_rough?.totalAmount).toBe(5000);
  });
});
