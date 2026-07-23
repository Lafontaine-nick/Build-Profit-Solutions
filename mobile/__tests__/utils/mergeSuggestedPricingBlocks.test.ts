import { mergeSuggestedPricingBlocksIntoMeasurements } from '@/utils/mergeSuggestedPricingBlocks';
import type { SuggestedPricingBlock } from '@/utils/scopeItemQuantities';
import {
  clearSupersededStageHostPricing,
  scopeShowsConfirmScopeAppliedPricing,
  sumConfirmScopeAppliedPricingTotal,
} from '@/utils/benchmarkReasonablenessContext';

function framingBlock(overrides: Partial<SuggestedPricingBlock> = {}): SuggestedPricingBlock {
  return {
    material: 39440,
    labor: 27640,
    total: 67080,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: 'Planning estimate',
    helper: '',
    mode: 'suggested_price',
    lumpSumOnly: false,
    splitSource: 'estimated',
    splitConfidence: 'medium',
    basis: { quantity: 4070, unit: 'sqft' },
    benchmarkAction: 'price_ready',
    benchmarkLevel: 'scope',
    benchmarkStageKey: 'framing',
    benchmarkScopeKey: 'framing',
    ...overrides,
  };
}

describe('mergeSuggestedPricingBlocksIntoMeasurements', () => {
  it('applies Framing on Use all and keeps it after stage-host reconcile', () => {
    const { measurements } = mergeSuggestedPricingBlocksIntoMeasurements(
      { itemQuantities: {}, pricingAcceptance: {} },
      [{ itemId: 'framing', block: framingBlock() }],
      'ground_up'
    );

    const reconciled = clearSupersededStageHostPricing(measurements, 'ground_up');
    expect(reconciled.pricingAcceptance?.framing).toBeTruthy();
    expect(Number(reconciled.itemQuantities?.framing__material?.quantity)).toBe(39440);
    expect(Number(reconciled.itemQuantities?.framing__labor?.quantity)).toBe(27640);
    expect(scopeShowsConfirmScopeAppliedPricing('framing', reconciled, 'ground_up')).toBe(true);
    expect(
      sumConfirmScopeAppliedPricingTotal({
        items: [{ id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'included' }],
        measurements: reconciled,
        templateKey: 'ground_up',
      })
    ).toBe(67080);
  });

  it('applies multiple ready trades in one batch', () => {
    const { measurements } = mergeSuggestedPricingBlocksIntoMeasurements(
      { itemQuantities: {}, pricingAcceptance: {} },
      [
        { itemId: 'framing', block: framingBlock() },
        {
          itemId: 'cleanup',
          block: {
            material: 450,
            labor: 550,
            total: 1000,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: 'National Average',
            helper: '',
            mode: 'suggested_price',
            lumpSumOnly: false,
            splitSource: 'estimated',
            splitConfidence: 'medium',
            basis: null,
            benchmarkAction: 'price_ready',
          },
        },
      ],
      'ground_up'
    );

    expect(measurements.pricingAcceptance?.framing).toBeTruthy();
    expect(measurements.pricingAcceptance?.cleanup).toBeTruthy();
    expect(
      sumConfirmScopeAppliedPricingTotal({
        items: [
          { id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'included' },
          { id: 'cleanup', label: 'Cleanup', inputType: 'yes_no', state: 'included' },
        ],
        measurements: clearSupersededStageHostPricing(measurements, 'ground_up'),
        templateKey: 'ground_up',
      })
    ).toBe(68080);
  });

  it('keeps Foundation when Exterior flatwork is applied in the same Use-all batch', () => {
    const { measurements } = mergeSuggestedPricingBlocksIntoMeasurements(
      { itemQuantities: {}, pricingAcceptance: {} },
      [
        {
          itemId: 'foundation',
          block: {
            material: 10680,
            labor: 11970,
            total: 22650,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: 'Local pricing not verified',
            helper: '',
            mode: 'suggested_price',
            lumpSumOnly: false,
            splitSource: 'estimated',
            splitConfidence: 'medium',
            basis: { quantity: 68, unit: 'cy' },
            benchmarkAction: 'price_ready',
            benchmarkLevel: 'stage',
            benchmarkStageKey: 'foundations',
            benchmarkApplicationKey: 'shv::stage::foundations',
          },
        },
        {
          itemId: 'pour_flatwork',
          block: {
            material: 2000,
            labor: 1500,
            total: 3500,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: 'National Average',
            helper: '',
            mode: 'suggested_price',
            lumpSumOnly: false,
            splitSource: 'estimated',
            splitConfidence: 'medium',
            basis: { quantity: 500, unit: 'sqft' },
            benchmarkAction: 'price_ready',
            benchmarkStageKey: 'foundations',
          },
        },
      ],
      'ground_up'
    );

    expect(measurements.pricingAcceptance?.foundation).toBeTruthy();
    expect(measurements.pricingAcceptance?.pour_flatwork).toBeTruthy();
    expect(Number(measurements.itemQuantities?.foundation__material?.quantity)).toBe(10680);
  });

  it('applies Foundation even when a foundations stage appKey is already recorded', () => {
    const { measurements } = mergeSuggestedPricingBlocksIntoMeasurements(
      {
        itemQuantities: {},
        pricingAcceptance: {},
        appliedBenchmarkKeys: ['shv::stage::foundations'],
      },
      [
        {
          itemId: 'foundation',
          block: {
            material: 10680,
            labor: 11970,
            total: 22650,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: 'Local pricing not verified',
            helper: '',
            mode: 'suggested_price',
            lumpSumOnly: false,
            splitSource: 'estimated',
            splitConfidence: 'medium',
            basis: { quantity: 68, unit: 'cy' },
            benchmarkAction: 'price_ready',
            benchmarkLevel: 'stage',
            benchmarkStageKey: 'foundations',
            benchmarkApplicationKey: 'shv::stage::foundations',
          },
        },
      ],
      'ground_up'
    );

    expect(measurements.pricingAcceptance?.foundation).toBeTruthy();
    expect(Number(measurements.itemQuantities?.foundation__material?.quantity)).toBe(10680);
    expect(Number(measurements.itemQuantities?.foundation__labor?.quantity)).toBe(11970);
    expect(
      scopeShowsConfirmScopeAppliedPricing(
        'foundation',
        clearSupersededStageHostPricing(measurements, 'ground_up'),
        'ground_up'
      )
    ).toBe(true);
  });

  it('clears a stage-host allowance when a child trade is applied', () => {
    const { measurements, clearedSelectedOwners } = mergeSuggestedPricingBlocksIntoMeasurements(
      {
        itemQuantities: {
          interior_finishes__allowance: {
            quantity: '90000',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          interior_finishes: {
            selectionStatus: 'accepted',
            pricingSourceKind: 'local_benchmark',
            pricingSourceLabel: 'Local benchmark',
            pricingTypeLabel: 'Allowance',
            geographicBasis: 'local',
            totalAmount: 90000,
            lumpSumOnly: true,
          },
        },
        appliedBenchmarkKeys: ['shv::stage::interior-finishes'],
      },
      [
        {
          itemId: 'drywall',
          block: {
            material: 12000,
            labor: 8000,
            total: 20000,
            materialSource: 'national_average',
            laborSource: 'national_average',
            rateSourceLabel: 'National Average',
            helper: '',
            mode: 'suggested_price',
            lumpSumOnly: false,
            splitSource: 'estimated',
            splitConfidence: 'medium',
            basis: { quantity: 10000, unit: 'sqft' },
            benchmarkAction: 'price_ready',
            benchmarkStageKey: 'interior-finishes',
          },
        },
      ],
      'ground_up'
    );

    expect(clearedSelectedOwners).toContain('interior_finishes');
    expect(measurements.pricingAcceptance?.interior_finishes).toBeUndefined();
    expect(measurements.pricingAcceptance?.drywall).toBeTruthy();
  });
});
