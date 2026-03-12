/**
 * Next-phase: Construction-aware hybrid forecast model
 *
 * The current baseline (profitForecast.ts) uses run-rate extrapolation:
 *   forecastFinalCost = actualExpenses / progressRatio
 *
 * This does NOT account for:
 * - Front-loaded or back-loaded cost curves
 * - Labor vs material mix
 * - Committed future POs timing
 * - Subcontract phasing
 * - Schedule phase weighting
 * - Change order timing
 *
 * FUTURE IMPLEMENTATION:
 * Build a smarter hybrid forecast using:
 * - actual spend so far
 * - committed POs / committed costs
 * - remaining budget by category (materials, labor, equipment)
 * - project phase / milestone weighting (early phases often cost-heavy)
 * - optional manual PM adjustment
 *
 * Goal: Make forecast final cost more construction-aware.
 * Early phases are often more cost-heavy; later phases may be lighter.
 * This varies by job type.
 *
 * When implemented, computeProfitForecast can call this and return
 * the hybrid result when sufficient data is available.
 */
export type HybridForecastInput = {
  actualExpenses: number;
  committedPOs: number;
  remainingBudgetByCategory: { materials: number; labor: number; equipment: number };
  phaseWeights?: number[]; // e.g. [0.4, 0.35, 0.25] for front-loaded
  pmAdjustment?: number;
};

export function computeHybridForecast(_input: HybridForecastInput): number {
  // Stub: return 0 until implemented
  return 0;
}
