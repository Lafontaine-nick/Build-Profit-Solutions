import { computeProfitForecast } from '../../src/lib/profitForecast';
import {
  foldEquipmentRentalIntoMaterialsBucket,
  getAllocatedCompanyOverhead,
} from '../../src/lib/projectFinancials';

describe('project profit and equipment buckets', () => {
  const buckets = [
    { name: 'Materials/Equipment', budget: 5405, bidBudget: 5405 },
    { name: 'Labor', budget: 16950, bidBudget: 16950 },
    { name: 'Soft costs', budget: 300, bidBudget: 300 },
    { name: 'Contingency', budget: 2000, bidBudget: 2000 },
  ];

  it('keeps the cost cap and shows profit after allocated company overhead', () => {
    const result = computeProfitForecast({
      contractValue: 29786,
      adjustedBudget: 25155,
      estimatedCostBaseline: 25155,
      actualExpenses: 0,
      committedPOs: 0,
      allocatedCompanyOverhead: 200,
    });

    expect(result.forecastFinalCost).toBe(25155);
    expect(result.projectedProfit).toBe(4431);
    expect(result.estimatedProfit).toBe(4431);
    expect(result.allocatedCompanyOverhead).toBe(200);
    expect(result.projectedMarginPct).toBeCloseTo(14.876, 2);
  });

  it('adds equipment rental to Materials/Equipment when the cap includes it and the bucket does not', () => {
    const folded = foldEquipmentRentalIntoMaterialsBucket(
      buckets,
      { estimateData: { equipment: 500 } },
      25155
    );

    expect(folded[0].budget).toBe(5905);
    expect(folded[0].bidBudget).toBe(5905);
    expect(folded.reduce((sum, bucket) => sum + bucket.budget, 0)).toBe(25155);
  });

  it('does not add equipment twice when the materials bucket already includes it', () => {
    const alreadyIncluded = buckets.map((bucket, index) =>
      index === 0 ? { ...bucket, budget: 5905, bidBudget: 5905 } : bucket
    );
    const folded = foldEquipmentRentalIntoMaterialsBucket(
      alreadyIncluded,
      { estimateData: { equipment: 500 } },
      25155
    );

    expect(folded[0].budget).toBe(5905);
  });

  it('reads allocated company overhead from the bid lines', () => {
    expect(
      getAllocatedCompanyOverhead({
        estimateData: { insuranceOverhead: 200 },
      })
    ).toBe(200);
    expect(
      getAllocatedCompanyOverhead({
        estimateData: { insuranceOverhead: 200, equipmentMaintenance: 100 },
      })
    ).toBe(300);
    expect(
      getAllocatedCompanyOverhead({
        estimateData: { facilities: 50, adminOverhead: 25 },
      })
    ).toBe(75);
  });
});
