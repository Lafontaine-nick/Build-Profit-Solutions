import { computeProfitForecast } from '../../src/lib/profitForecast';
import {
  computeProjectFinancials,
  foldEquipmentRentalIntoMaterialsBucket,
  getAllocatedCompanyOverhead,
  sumPlannedCostFromBuckets,
} from '../../src/lib/projectFinancials';

describe('project profit and equipment buckets', () => {
  const buckets = [
    { name: 'Materials/Equipment', budget: 5405, bidBudget: 5405 },
    { name: 'Labor', budget: 16950, bidBudget: 16950 },
    { name: 'Soft costs', budget: 300, bidBudget: 300 },
    { name: 'Contingency', budget: 2000, bidBudget: 2000 },
  ];

  it('keeps the estimate when a little is spent before the job has progress', () => {
    const result = computeProfitForecast({
      contractValue: 35880,
      adjustedBudget: 30400,
      estimatedCostBaseline: 30400,
      actualExpenses: 625,
      committedPOs: 0,
      progressPct: 0,
      allocatedCompanyOverhead: 400,
    });

    expect(result.forecastMethod).toBe('budget-fallback');
    expect(result.forecastFinalCost).toBe(30400);
    expect(result.projectedProfit).toBe(5080);
    expect(result.profitVarianceVsEstimate).toBe(0);
    expect(result.projectedMarginPct).toBeCloseTo(14.158, 2);
  });

  it('raises the forecast when spend is far ahead of schedule progress', () => {
    const result = computeProfitForecast({
      contractValue: 35880,
      adjustedBudget: 30400,
      estimatedCostBaseline: 30400,
      actualExpenses: 12160,
      committedPOs: 0,
      progressPct: 0,
      allocatedCompanyOverhead: 400,
    });

    expect(result.forecastMethod).toBe('run-rate');
    expect(result.forecastFinalCost).toBeGreaterThan(30400);
    expect(result.projectedProfit).toBeLessThan(5080);
  });

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

  it('still adds equipment when a project overhead bucket sits beside the job buckets', () => {
    const withOverhead = [
      { name: 'Materials/Equipment', budget: 5830, bidBudget: 5830 },
      { name: 'Labor', budget: 19895, bidBudget: 19895 },
      { name: 'Soft costs', budget: 2300, bidBudget: 2300 },
      { name: 'Contingency', budget: 2000, bidBudget: 2000 },
      { name: 'Project overhead', budget: 300, bidBudget: 300 },
    ];
    const folded = foldEquipmentRentalIntoMaterialsBucket(
      withOverhead,
      { estimateData: { equipment: 600, insuranceOverhead: 200, facilities: 100 } },
      30925
    );

    expect(folded[0].budget).toBe(6430);
    expect(folded[0].bidBudget).toBe(6430);
    expect(folded[4].budget).toBe(300);
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
    expect(
      getAllocatedCompanyOverhead({
        estimateData: {
          insuranceOverhead: 200,
          facilities: 100,
          overheadLineItems: [{ name: 'Software', amount: 50 }],
        },
      })
    ).toBe(350);
  });

  it('leaves the overhead bucket out of the bucket sum, since overhead is added from the bid', () => {
    expect(
      sumPlannedCostFromBuckets([
        { name: 'Materials/Equipment', budget: 6930 },
        { name: 'Labor', budget: 20395 },
        { name: 'Soft costs', budget: 2300 },
        { name: 'Contingency', budget: 2000 },
        { name: 'Company overhead', budget: 300 },
      ])
    ).toBe(31625);
  });

  it('puts project overhead in the cost cap without changing profit', () => {
    const financials = computeProjectFinancials({
      estimateData: {
        grandTotal: 36350,
        materials: 5830,
        labor: 19895,
        equipment: 600,
        engineeringCost: 300,
        planCost: 500,
        permitCost: 1000,
        financingFees: 300,
        interestCost: 200,
        contingencyAllowance: 2000,
        insuranceOverhead: 200,
        facilities: 100,
      },
    });

    expect(financials.projectOverhead).toBe(300);
    expect(financials.plannedCostBudget).toBe(30925);
    expect(financials.allocatedCompanyOverhead).toBe(0);
    expect(financials.adjustedContractValue - financials.adjustedCostBudget).toBe(5425);
  });
});
