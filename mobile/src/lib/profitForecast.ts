export type ProfitStatus = 'Strong' | 'Healthy' | 'Tight' | 'At Risk' | 'Losing Money';

export interface ProfitForecastInput {
  contractValue: number;
  /** Budget for forecast fallback when no progress; can differ from estimated cost */
  adjustedBudget: number;
  /** Estimated cost baseline = materials + labor + overhead from estimate. Used for profit variance vs estimate. */
  estimatedCostBaseline?: number;
  actualExpenses: number;
  committedPOs: number;
  progressPct?: number;
  /** When true, forecast final cost = actual expenses (job done, no more spending) */
  isCompleted?: boolean;
}

export type ForecastMethod = 'run-rate' | 'completed' | 'budget-fallback' | 'hybrid';

export interface ProfitForecastOutput {
  contractValue: number;
  adjustedBudget: number;
  actualExpenses: number;
  committedPOs: number;
  forecastFinalCost: number;
  projectedProfit: number;
  projectedMarginPct: number;
  /** Estimated profit = contractValue - estimatedCostBaseline */
  estimatedProfit: number;
  /** Profit variance = projectedProfit - estimatedProfit (positive = profit improved) */
  profitVarianceVsEstimate: number;
  status: ProfitStatus;
  /** How the forecast was derived — for UI labeling and future hybrid model */
  forecastMethod: ForecastMethod;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const safeNum = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

export function getProfitStatus(marginPct: number): ProfitStatus {
  if (marginPct >= 20) return 'Strong';
  if (marginPct >= 15) return 'Healthy';
  if (marginPct >= 10) return 'Tight';
  if (marginPct >= 0) return 'At Risk';
  return 'Losing Money';
}

/**
 * Forecast logic — baseline is trend-based (run-rate) extrapolation.
 *
 * Current: CPI-based EAC — forecastFinalCost = actualExpenses / progressRatio
 * Does NOT account for: front/back-loaded cost curves, labor vs material mix,
 * committed POs timing, subcontract phasing, schedule phase weighting.
 *
 * Next phase: Hybrid construction-aware model using:
 * - actual spend + committed POs
 * - remaining budget by category
 * - project phase / milestone weighting
 * - optional PM adjustment
 */
export function computeProfitForecast(input: ProfitForecastInput): ProfitForecastOutput {
  const contractValue = safeNum(input.contractValue);
  const adjustedBudget = safeNum(input.adjustedBudget);
  const actualExpenses = safeNum(input.actualExpenses);
  const committedPOs = safeNum(input.committedPOs);
  const progressPct = clamp(safeNum(input.progressPct), 0, 100);
  const progressRatio = progressPct > 0 ? progressPct / 100 : 0;

  const isCompleted = input.isCompleted === true || progressRatio >= 1;
  let forecastFinalCost = adjustedBudget;
  let forecastMethod: ForecastMethod = 'budget-fallback';

  if (actualExpenses > 0 || committedPOs > 0) {
    const actualPlusCommitted = actualExpenses + committedPOs;
    if (isCompleted) {
      forecastFinalCost = actualExpenses;
      forecastMethod = 'completed';
    } else if (progressRatio > 0.01 && actualExpenses > 0) {
      // Run-rate: actual / progress = projected total at completion
      const cpiForecast = actualExpenses / progressRatio;
      forecastFinalCost = Math.max(actualPlusCommitted, cpiForecast);
      forecastMethod = 'run-rate';
    } else {
      forecastFinalCost = Math.max(adjustedBudget, actualPlusCommitted);
      forecastMethod = 'budget-fallback';
    }
  }

  const projectedProfit = contractValue - forecastFinalCost;
  const projectedMarginPct =
    contractValue > 0 ? (projectedProfit / contractValue) * 100 : 0;
  // Use estimatedCostBaseline when provided; otherwise fall back to adjustedBudget for backward compat
  const costForVariance = (input.estimatedCostBaseline != null && input.estimatedCostBaseline > 0)
    ? input.estimatedCostBaseline
    : adjustedBudget;
  const estimatedProfit = contractValue - costForVariance;
  const profitVarianceVsEstimate = projectedProfit - estimatedProfit;
  const status = getProfitStatus(projectedMarginPct);

  return {
    contractValue,
    adjustedBudget,
    actualExpenses,
    committedPOs,
    forecastFinalCost,
    projectedProfit,
    projectedMarginPct,
    estimatedProfit,
    profitVarianceVsEstimate,
    status,
    forecastMethod,
  };
}

