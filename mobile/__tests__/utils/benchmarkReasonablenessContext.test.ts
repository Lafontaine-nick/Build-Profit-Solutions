import {
  clearSupersededStageHostPricing,
  computeAppliedBuildCostPerLivingSf,
  foldAskAiMeasurementsIntoScopeSnapshot,
  formatBuildCostPerLivingSf,
  listConfirmScopeAppliedPricingLines,
  mergeScopeMeasurementsPreservingFields,
  sumStep3ReviewBudgetTotals,
  resolveAppliedScopeMoneyTotal,
  resolveAppliedBuildCostArea,
  resolveBenchmarkLivingSf,
  shouldShowAppliedBuildCostPerSf,
  scopeShowsConfirmScopeAppliedPricing,
  sumConfirmScopeAppliedPricingBreakdown,
  sumConfirmScopeAppliedPricingTotal,
} from '@/utils/benchmarkReasonablenessContext';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';

describe('benchmarkReasonablenessContext', () => {
  it('mergeScopeMeasurementsPreservingFields keeps living SF when patch clears it', () => {
    const merged = mergeScopeMeasurementsPreservingFields(
      { floorAreaSqft: 3098, roofSquares: 46, itemQuantities: { drywall: { quantity: 10843, unit: 'sqft' } } },
      { floorAreaSqft: null, roofSquares: 26, itemQuantities: {} }
    );
    expect(merged.floorAreaSqft).toBe(3098);
    expect(merged.roofSquares).toBe(26);
    expect(merged.itemQuantities?.drywall?.quantity).toBe(10843);
  });

  it('foldAskAiMeasurementsIntoScopeSnapshot keeps Ask AI disposal price over Step 2 snapshot', () => {
    const step2Snapshot = {
      itemQuantities: {
        cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
      },
    };
    const refineMeasurements = {
      itemQuantities: {
        cleanup: { quantity: 8000, unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: 8000, unit: 'allowance', quantitySource: 'user_entered' },
      },
    };
    const updatedSnapshot = foldAskAiMeasurementsIntoScopeSnapshot(step2Snapshot, refineMeasurements);
    expect(updatedSnapshot.itemQuantities?.cleanup?.quantity).toBe(8000);
    const synced = mergeScopeMeasurementsPreservingFields(refineMeasurements, updatedSnapshot);
    expect(synced.itemQuantities?.cleanup?.quantity).toBe(8000);
  });

  it('resolveBenchmarkLivingSf rejects roof-square confusion', () => {
    expect(
      resolveBenchmarkLivingSf({
        measurementsInput: {
          floorAreaSqft: '26',
          roofSquares: '26',
          itemQuantities: {},
        } as never,
        draftMeasurements: { floorAreaSqft: 3098 },
      })
    ).toBe(3098);
  });

  it('resolveBenchmarkLivingSf prefers explicit living over draft fallback', () => {
    expect(
      resolveBenchmarkLivingSf({
        measurementsInput: { floorAreaSqft: '3098', itemQuantities: {} } as never,
        draftMeasurements: { floorAreaSqft: 2800 },
      })
    ).toBe(3098);
  });

  it('sumConfirmScopeAppliedPricingTotal skips stage host when trade children are priced', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'interior_finishes', label: 'Interior Finishes', inputType: 'yes_no', state: 'included' },
      { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'included' },
      { id: 'cleanup', label: 'Cleanup', inputType: 'yes_no', state: 'included' },
    ];
    const measurements = {
      itemQuantities: {
        interior_finishes__allowance: { quantity: '90000', unit: 'allowance', quantitySource: 'user_entered' },
        drywall__material: { quantity: '12000', unit: 'allowance', quantitySource: 'user_entered' },
        drywall__labor: { quantity: '8000', unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        interior_finishes: buildAcceptanceFromSuggestedBlock({
          total: 90000,
          material: 90000,
          labor: 0,
          lumpSumOnly: true,
          rateSourceLabel: 'Local benchmark',
          materialSource: 'local_benchmark',
          laborSource: 'local_benchmark',
        }),
        drywall: buildAcceptanceFromSuggestedBlock({
          total: 20000,
          material: 12000,
          labor: 8000,
          lumpSumOnly: false,
          rateSourceLabel: 'National Average',
          materialSource: 'national_average',
          laborSource: 'national_average',
        }),
        cleanup: buildAcceptanceFromSuggestedBlock({
          total: 1000,
          material: 0,
          labor: 0,
          lumpSumOnly: true,
          rateSourceLabel: 'National Average',
          materialSource: 'national_average',
          laborSource: 'national_average',
        }),
      },
    } as never;

    expect(
      sumConfirmScopeAppliedPricingTotal({
        items,
        measurements,
        templateKey: 'ground_up',
      })
    ).toBe(21000);

    expect(
      sumConfirmScopeAppliedPricingBreakdown({
        items,
        measurements,
        templateKey: 'ground_up',
      })
    ).toEqual({
      total: 21000,
      material: 12450,
      labor: 8550,
      allowance: 0,
    });
  });

  it('classifies soft costs and fixture/cleanup mat/lab per scope rules', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'contingency', label: 'Contingency', inputType: 'yes_no', state: 'included' },
      { id: 'permits', label: 'Permits', inputType: 'yes_no', state: 'included' },
      { id: 'plans_engineering', label: 'Plans', inputType: 'yes_no', state: 'included' },
      { id: 'cleanup', label: 'Cleanup', inputType: 'yes_no', state: 'included' },
      { id: 'plumbing_trim', label: 'Plumbing trim', inputType: 'yes_no', state: 'included' },
      { id: 'electrical_trim', label: 'Electrical trim', inputType: 'yes_no', state: 'included' },
    ];
    const measurements = {
      itemQuantities: {
        contingency__allowance: { quantity: '5000', unit: 'allowance', quantitySource: 'user_entered' },
        permits__allowance: { quantity: '32000', unit: 'allowance', quantitySource: 'user_entered' },
        plans_engineering__allowance: { quantity: '3000', unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        plumbing_trim__material: { quantity: '6200', unit: 'allowance', quantitySource: 'user_entered' },
        plumbing_trim__labor: { quantity: '12300', unit: 'allowance', quantitySource: 'user_entered' },
        electrical_trim__material: { quantity: '4800', unit: 'allowance', quantitySource: 'user_entered' },
        electrical_trim__labor: { quantity: '9600', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {},
    } as never;

    expect(
      sumConfirmScopeAppliedPricingBreakdown({
        items,
        measurements,
        templateKey: 'ground_up',
      })
    ).toEqual({
      total: 73900,
      material: 11450,
      labor: 22450,
      allowance: 40000,
    });
  });

  it('uses acceptance mat/lab metadata for fixture packages stored as flat allowance', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'plumbing_trim', label: 'Plumbing trim', inputType: 'yes_no', state: 'included' },
      { id: 'cleanup', label: 'Cleanup', inputType: 'yes_no', state: 'included' },
    ];
    const measurements = {
      itemQuantities: {
        plumbing_trim__allowance: { quantity: '18500', unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__allowance: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        plumbing_trim: buildAcceptanceFromSuggestedBlock({
          total: 18500,
          material: 0,
          labor: 18500,
          lumpSumOnly: true,
          rateSourceLabel: 'Blended national + barometer',
          materialSource: 'local_benchmark',
          laborSource: 'local_benchmark',
        }),
        cleanup: buildAcceptanceFromSuggestedBlock({
          total: 1000,
          material: 0,
          labor: 0,
          lumpSumOnly: true,
          rateSourceLabel: 'National Average',
          materialSource: 'national_average',
          laborSource: 'national_average',
        }),
      },
    } as never;

    expect(
      sumConfirmScopeAppliedPricingBreakdown({
        items,
        measurements,
        templateKey: 'ground_up',
      })
    ).toEqual({
      total: 19500,
      material: 12475,
      labor: 7025,
      allowance: 0,
    });
  });

  it('clearSupersededStageHostPricing drops stage-host Applied when trade children are priced', () => {
    const measurements = {
      itemQuantities: {
        interior_finishes__allowance: {
          quantity: '67075',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        drywall__material: { quantity: '12000', unit: 'allowance', quantitySource: 'user_entered' },
        drywall__labor: { quantity: '8000', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        interior_finishes: buildAcceptanceFromSuggestedBlock({
          total: 67075,
          material: 67075,
          labor: 0,
          lumpSumOnly: true,
          rateSourceLabel: 'Local benchmark',
          materialSource: 'local_benchmark',
          laborSource: 'local_benchmark',
        }),
        drywall: buildAcceptanceFromSuggestedBlock({
          total: 20000,
          material: 12000,
          labor: 8000,
          lumpSumOnly: false,
          rateSourceLabel: 'National Average',
          materialSource: 'national_average',
          laborSource: 'national_average',
        }),
      },
      appliedBenchmarkKeys: ['shv::stage::interior-finishes'],
    } as never;

    const cleared = clearSupersededStageHostPricing(measurements, 'ground_up');
    expect(cleared.pricingAcceptance?.interior_finishes).toBeUndefined();
    expect(cleared.itemQuantities?.interior_finishes__allowance).toBeUndefined();
    expect(cleared.pricingAcceptance?.drywall).toBeTruthy();
    expect(
      sumConfirmScopeAppliedPricingTotal({
        items: [
          { id: 'interior_finishes', label: 'Interior Finishes', inputType: 'yes_no', state: 'included' },
          { id: 'drywall', label: 'Drywall', inputType: 'yes_no', state: 'included' },
        ],
        measurements: cleared,
        templateKey: 'ground_up',
      })
    ).toBe(20000);

    // Even before clear, stage host must not show Applied on the card when trades are priced.
    expect(
      scopeShowsConfirmScopeAppliedPricing('interior_finishes', measurements, 'ground_up')
    ).toBe(false);
    expect(scopeShowsConfirmScopeAppliedPricing('drywall', measurements, 'ground_up')).toBe(true);
  });

  it('keeps Framing Apply — stage owner is the trade, not a superseded host', () => {
    const framingBlock = {
      total: 67050,
      material: 39440,
      labor: 27640,
      lumpSumOnly: false,
      rateSourceLabel: 'Local pricing not verified',
      materialSource: 'national_average' as const,
      laborSource: 'national_average' as const,
      basis: { quantity: 4070, unit: 'sqft' },
    };
    const measurements = {
      itemQuantities: {
        framing__material: { quantity: '39440', unit: 'allowance', quantitySource: 'user_entered' },
        framing__labor: { quantity: '27640', unit: 'allowance', quantitySource: 'user_entered' },
        framing__allowance: { quantity: '67050', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        framing: buildAcceptanceFromSuggestedBlock(framingBlock),
      },
    } as never;

    const cleared = clearSupersededStageHostPricing(measurements, 'ground_up');
    expect(cleared.pricingAcceptance?.framing).toBeTruthy();
    expect(cleared.itemQuantities?.framing__allowance?.quantity).toBe('67050');
    expect(scopeShowsConfirmScopeAppliedPricing('framing', cleared, 'ground_up')).toBe(true);
    expect(
      sumConfirmScopeAppliedPricingTotal({
        items: [{ id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'included' }],
        measurements: cleared,
        templateKey: 'ground_up',
      })
    ).toBe(67080); // material + labor legs
  });

  it('itemized Applied lines sum to the Applied pricing breakdown total', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'permits', label: 'Permits / fees', inputType: 'yes_no', state: 'included' },
      { id: 'plans_engineering', label: 'Plans / engineering', inputType: 'yes_no', state: 'included' },
      { id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' },
    ];
    const measurements = {
      itemQuantities: {
        permits__allowance: { quantity: '32000', unit: 'allowance', quantitySource: 'user_entered' },
        plans_engineering__allowance: { quantity: '3000', unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__material: { quantity: '450', unit: 'allowance', quantitySource: 'user_entered' },
        cleanup__labor: { quantity: '550', unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        permits: { selectionStatus: 'accepted', totalAmount: 32000, pricingSourceKind: 'national_average' },
        plans_engineering: {
          selectionStatus: 'accepted',
          totalAmount: 3000,
          pricingSourceKind: 'national_average',
        },
        cleanup: {
          selectionStatus: 'accepted',
          totalAmount: 1000,
          materialAmount: 450,
          laborAmount: 550,
          pricingSourceKind: 'national_average',
        },
      },
    } as never;

    const breakdown = sumConfirmScopeAppliedPricingBreakdown({
      items,
      measurements,
      templateKey: 'ground_up',
    });
    const lines = listConfirmScopeAppliedPricingLines({
      items,
      measurements,
      templateKey: 'ground_up',
    });
    const lineSum = Math.round(lines.reduce((sum, line) => sum + line.total, 0) * 100) / 100;
    expect(lineSum).toBe(breakdown.total);
    expect(breakdown.total).toBe(36000);
    expect(resolveAppliedScopeMoneyTotal('cleanup', measurements.itemQuantities, measurements.pricingAcceptance.cleanup)).toBe(
      1000
    );
  });

  it('sumStep3ReviewBudgetTotals includes Ask AI packages not on Confirm Scope checklist', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' },
      { id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'included' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'ground_up', items },
      scopePackages: [
        {
          name: 'Framing',
          scope: 'Framing',
          checklistItemId: 'framing',
          price: 500000,
          knownSubtotal: 500000,
          status: 'user_provided',
        },
        {
          name: 'Cleanup & disposal',
          scope: 'Final clean',
          checklistItemId: 'cleanup',
          price: 1000,
          knownSubtotal: 1000,
          status: 'user_provided',
        },
        {
          name: 'Disposal Bid',
          scope: 'Disposal Bid',
          price: 8000,
          knownSubtotal: 8000,
          status: 'user_provided',
          priceProvidedByUser: true,
          scopeQuantities: [{ quantity: 1, unit: 'lump_sum', quantitySource: 'user_entered' }],
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          framing: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
          framing__allowance: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          framing: { status: 'accepted' },
          cleanup: { status: 'accepted' },
        },
      },
    } as never;

    const totals = sumStep3ReviewBudgetTotals(draft);
    expect(totals?.total).toBe(509000);
    expect(totals!.total - 500000 - 1000).toBe(8000);
  });

  it('sumStep3ReviewBudgetTotals adds delta when Ask AI raises an applied checklist row', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' },
      { id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'included' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'ground_up', items },
      scopePackages: [
        {
          name: 'Framing',
          scope: 'Framing',
          checklistItemId: 'framing',
          price: 500000,
          knownSubtotal: 500000,
          status: 'user_provided',
        },
        {
          name: 'Cleanup & disposal',
          scope: 'Final clean',
          checklistItemId: 'cleanup',
          price: 8000,
          knownSubtotal: 8000,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          framing: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
          framing__allowance: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          framing: { status: 'accepted', totalAmount: 500000 },
          cleanup: { status: 'accepted', totalAmount: 1000 },
        },
      },
    } as never;

    const totals = sumStep3ReviewBudgetTotals(draft);
    expect(totals?.total).toBe(508000);
  });

  it('sumStep3ReviewBudgetTotals does not double-count painting Walls after Ask AI qty+rate', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'prep', label: 'Prep & Masking', state: 'included', inputType: 'yes_no' },
      { id: 'interior_paint', label: 'Walls', state: 'included', inputType: 'yes_no' },
      { id: 'trim_paint', label: 'Trim', state: 'included', inputType: 'yes_no' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'painting', items },
      scopePackages: [
        {
          name: 'Prep & Masking',
          scope: 'Prep',
          price: 1485,
          knownSubtotal: 1485,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
        {
          name: 'Walls',
          scope: 'Interior walls',
          price: 6700,
          knownSubtotal: 6700,
          status: 'user_provided',
          priceProvidedByUser: true,
          scopeQuantities: [{ quantity: 2000, unit: 'sqft' }],
        },
        {
          name: 'Trim',
          scope: 'Baseboards',
          price: 1400,
          knownSubtotal: 1400,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      scopeMeasurements: {
        wallPaintSqft: 1500,
        itemQuantities: {
          prep: { quantity: 1485, unit: 'allowance', quantitySource: 'user_entered' },
          interior_paint: { quantity: 6700, unit: 'allowance', quantitySource: 'user_entered' },
          interior_paint__allowance: { quantity: 6700, unit: 'allowance', quantitySource: 'user_entered' },
          trim_paint: { quantity: 1400, unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          prep: { status: 'accepted', totalAmount: 1485 },
          interior_paint: { status: 'accepted', totalAmount: 6700 },
          trim_paint: { status: 'accepted', totalAmount: 1400 },
        },
      },
    } as never;

    const totals = sumStep3ReviewBudgetTotals(draft);
    expect(totals?.total).toBe(9585);
  });

  it('sumStep3ReviewBudgetTotals does not double-count stale AI packages without Applied pricing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'included',
        choiceId: 'relocating',
      },
      {
        id: 'plumbing_trim',
        label: 'Plumbing fixtures (faucets, toilet, hookups)',
        inputType: 'yes_no',
        state: 'included',
      },
      { id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom', items },
      confirmedAssumptions: items,
      scopePackages: [
        {
          name: 'Plumbing fixtures (faucets, toilet, hookups)',
          scope: 'Trim-out',
          checklistItemId: 'plumbing_trim',
          price: 900,
          knownSubtotal: 900,
          status: 'ai_suggested',
          priceSource: 'national_trade_average',
        },
        {
          name: 'Cleanup, haul-off & disposal',
          scope: 'Final clean',
          checklistItemId: 'cleanup',
          price: 1000,
          knownSubtotal: 1000,
          status: 'user_provided',
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          toilet: { quantity: '1', unit: 'each', quantitySource: 'user_entered' },
          toilet__material: { quantity: '500', unit: 'allowance', quantitySource: 'user_entered' },
          toilet__labor: { quantity: '1600', unit: 'allowance', quantitySource: 'user_entered' },
          cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          toilet: { status: 'accepted', totalAmount: 2100, materialAmount: 500, laborAmount: 1600 },
          cleanup: { status: 'accepted', totalAmount: 1000 },
        },
      },
    } as never;

    const applied = sumConfirmScopeAppliedPricingBreakdown({
      items,
      measurements: draft.scopeMeasurements,
      templateKey: 'bathroom',
    });
    expect(applied.total).toBe(3100);

    const totals = sumStep3ReviewBudgetTotals(draft);
    expect(totals?.total).toBe(3100);
  });

  it('sumStep3ReviewBudgetTotals does not add unapplied national-average checklist rows', () => {
    const items: ScopeChecklistItem[] = [
      { id: 'plumbing_rough', label: 'Plumbing rough-in', inputType: 'yes_no', state: 'included' },
      { id: 'cleanup', label: 'Cleanup & disposal', inputType: 'yes_no', state: 'included' },
    ];
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'bathroom', items },
      confirmedAssumptions: items,
      scopePackages: [
        {
          name: 'Plumbing rough-in (shower / tub)',
          scope: 'Rough-in',
          checklistItemId: 'plumbing_rough',
          price: 1750,
          knownSubtotal: 1750,
          status: 'ai_suggested',
          priceSource: 'national_trade_average',
        },
        {
          name: 'Cleanup, haul-off & disposal',
          scope: 'Final clean',
          checklistItemId: 'cleanup',
          price: 1000,
          knownSubtotal: 1000,
          status: 'user_provided',
        },
      ],
      scopeMeasurements: {
        showerWallTileSqft: 80,
        itemQuantities: {
          cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          cleanup: { status: 'accepted', totalAmount: 1000 },
        },
      },
    } as never;

    const applied = sumConfirmScopeAppliedPricingBreakdown({
      items,
      measurements: draft.scopeMeasurements,
      templateKey: 'bathroom',
    });
    expect(applied.total).toBe(1000);

    const totals = sumStep3ReviewBudgetTotals(draft);
    expect(totals?.total).toBe(1000);
  });

  it('computeAppliedBuildCostPerLivingSf rounds whole dollars like benchmark engine', () => {
    expect(computeAppliedBuildCostPerLivingSf(546626.47, 3098)).toBe(176);
    expect(computeAppliedBuildCostPerLivingSf(0, 3098)).toBeNull();
    expect(computeAppliedBuildCostPerLivingSf(100000, 0)).toBeNull();
    expect(formatBuildCostPerLivingSf(176)).toBe('$176');
    expect(formatBuildCostPerLivingSf(null)).toBe('—');
  });

  it('shouldShowAppliedBuildCostPerSf is true for whole-home builds only', () => {
    expect(shouldShowAppliedBuildCostPerSf('ground_up')).toBe(true);
    expect(shouldShowAppliedBuildCostPerSf('addition')).toBe(true);
    expect(shouldShowAppliedBuildCostPerSf('bathroom')).toBe(false);
    expect(shouldShowAppliedBuildCostPerSf('kitchen')).toBe(false);
    expect(shouldShowAppliedBuildCostPerSf('room_remodel')).toBe(false);
  });

  it('resolveAppliedBuildCostArea uses bath floor for bathroom when living SF missing', () => {
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { bathroomFloorSqft: '90', itemQuantities: {} } as never,
        templateKey: 'bathroom',
      })
    ).toEqual({ sqft: 90, unitSuffix: 'SF' });
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { floorAreaSqft: '3098', itemQuantities: {} } as never,
        templateKey: 'bathroom',
      })
    ).toEqual({ sqft: 3098, unitSuffix: 'living SF' });
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: {
          showerWallTileSqft: '80',
          showerFloorTileSqft: '95',
          itemQuantities: {},
        } as never,
        templateKey: 'bathroom',
      })
    ).toEqual({ sqft: 80, unitSuffix: 'SF' });
  });

  it('resolveAppliedBuildCostArea supports kitchen, painting, roofing, and generic fallbacks', () => {
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { kitchenFloorSqft: '180', itemQuantities: {} } as never,
        templateKey: 'kitchen',
      })
    ).toEqual({ sqft: 180, unitSuffix: 'SF' });
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { wallPaintSqft: '1500', itemQuantities: {} } as never,
        templateKey: 'painting',
      })
    ).toEqual({ sqft: 1500, unitSuffix: 'SF' });
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { roofSquares: '28', itemQuantities: {} } as never,
        templateKey: 'roofing',
      })
    ).toEqual({ sqft: 2800, unitSuffix: 'SF' });
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { deckSqft: '320', itemQuantities: {} } as never,
        templateKey: 'deck_patio',
      })
    ).toEqual({ sqft: 320, unitSuffix: 'SF' });
    expect(
      resolveAppliedBuildCostArea({
        measurementsInput: { drywallSqft: '800', itemQuantities: {} } as never,
        templateKey: 'unknown_trade',
      })
    ).toEqual({ sqft: 800, unitSuffix: 'SF' });
  });
});
