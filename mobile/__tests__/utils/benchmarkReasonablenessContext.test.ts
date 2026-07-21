import {
  mergeScopeMeasurementsPreservingFields,
  resolveBenchmarkLivingSf,
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
  });
});
