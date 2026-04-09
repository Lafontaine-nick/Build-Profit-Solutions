export type ProfitStatus = 'Strong' | 'Healthy' | 'Tight' | 'At Risk' | 'Losing Money';

export interface ProfitForecastInput {
  contractValue: number;
  /** Budget for forecast fallback when no progress; can differ from estimated cost */
  adjustedBudget: number;
  /** Estimated cost baseline = materials + labor + overhead from estimate. Used for profit variance vs estimate. */
  estimatedCostBaseline?: number;
  actualExpenses: number;
  committedPOs: number;
  /** Timeline / milestone completion % (0–100), same source as Timeline “Overall progress”. */
  progressPct?: number;
  /**
   * Optional: share of **contract value** collected or marked received on milestones (0–100).
   * Used for reporting and light cash-vs-cost alignment; does not override accrual cost logic.
   */
  contractCollectedPct?: number;
  /**
   * Optional: calendar elapsed through the job (0–100), from project start → end vs **today**.
   * When cost burn is far ahead of calendar (e.g. 66% budget in month 1 of 14), extrapolated EAC can exceed the budget.
   */
  elapsedTimePct?: number;
  /** When true, forecast final cost = actual expenses (job done, no more spending) */
  isCompleted?: boolean;
}

export type ForecastMethod =
  | 'run-rate'
  | 'completed'
  | 'budget-fallback'
  | 'hybrid'
  | 'calendar-run-rate';

export interface ProfitForecastOutput {
  contractValue: number;
  adjustedBudget: number;
  actualExpenses: number;
  committedPOs: number;
  forecastFinalCost: number;
  projectedProfit: number;
  /** Spend-to-date margin: (contract - actualExpenses) / contract */
  spendToDateMarginPct: number;
  /** Expected margin at completion: (contract - forecastFinalCost) / contract. Uses run-rate (actualExpenses/progress) for forecast. */
  projectedMarginPct: number;
  /** Estimated profit = contractValue - estimatedCostBaseline */
  estimatedProfit: number;
  /** Profit variance = projectedProfit - estimatedProfit (positive = profit improved) */
  profitVarianceVsEstimate: number;
  status: ProfitStatus;
  /** How the forecast was derived — for UI labeling and future hybrid model */
  forecastMethod: ForecastMethod;
  /** Schedule % passed in (timeline). */
  scheduleProgressPct: number;
  /** (Actual + committed POs) / planned cost budget × 100 */
  costBudgetUsedPct: number;
  /** max(schedule, costBudgetUsed) — used for run-rate completion so cost pace vs timeline both matter */
  blendedProgressPct: number;
  /** Echo of optional input when provided */
  contractCollectedPct?: number;
  /** Calendar elapsed % (start→end vs today) when provided */
  elapsedTimePct?: number;
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
 * Sum milestone payment amounts that look **collected / completed** as % of contract (0–100).
 */
export function contractCollectedPctFromMilestones(
  milestones: unknown[] | undefined,
  adjustedContractValue: number
): number | undefined {
  if (!Array.isArray(milestones) || !(adjustedContractValue > 0)) return undefined;
  let collected = 0;
  for (const raw of milestones) {
    const m = raw as Record<string, unknown>;
    const amt = safeNum(m.amount ?? m.paymentAmount);
    if (!(amt > 0)) continue;
    const st = String(m.status ?? '').toLowerCase();
    const done =
      m.collected === true ||
      st.includes('collected') ||
      st.includes('received') ||
      st === 'completed' ||
      (Number(m.progressPct) || 0) >= 99.5;
    if (done) collected += amt;
  }
  return Math.min(100, (collected / adjustedContractValue) * 100);
}

/** Share of calendar from startISO → endISO that has elapsed as of now (0–100). */
export function computeElapsedCalendarPct(
  startISO: string | undefined,
  endISO: string | undefined,
  nowMs: number = Date.now()
): number | undefined {
  if (!startISO || !endISO) return undefined;
  const t0 = new Date(startISO).getTime();
  const t1 = new Date(endISO).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || !(t1 > t0)) return undefined;
  const raw = (nowMs - t0) / (t1 - t0);
  return Math.min(100, Math.max(0, raw * 100));
}

/**
 * Forecast logic — trend-based run-rate with **blended completion** + optional **calendar** stress.
 *
 * - **Blended** uses max(schedule %, cost-budget-used %) for pace vs schedule and cost.
 * - **Calendar** extrapolation: `actual / (elapsedTimePct/100)` — if you’ve spent most of the
 *   budget early in the project window, this can exceed the planned cap and **pull margin down**
 *   (we do **not** cap at budget when calendar EAC is higher — that was hiding real overrun risk).
 * - **Cap at planned budget** still applies when nothing suggests overrun (preserves Contract & Cost alignment).
 *
 * **Collections:** passed through for UI only; accrual margin is cost vs contract.
 */
export function computeProfitForecast(input: ProfitForecastInput): ProfitForecastOutput {
  const contractValue = safeNum(input.contractValue);
  const adjustedBudget = safeNum(input.adjustedBudget);
  const actualExpenses = safeNum(input.actualExpenses);
  const committedPOs = safeNum(input.committedPOs);
  const scheduleProgressPct = clamp(safeNum(input.progressPct), 0, 100);
  const actualPlusCommitted = actualExpenses + committedPOs;
  const costBudgetUsedPct =
    adjustedBudget > 0 ? Math.min(100, (actualPlusCommitted / adjustedBudget) * 100) : 0;
  /** Completion % for run-rate: both timeline and cost burn vs cap matter */
  const blendedProgressPct = Math.max(scheduleProgressPct, costBudgetUsedPct);
  const progressRatio = blendedProgressPct > 0 ? blendedProgressPct / 100 : 0;

  const collectedInput = input.contractCollectedPct;
  const contractCollectedPct =
    collectedInput != null && Number.isFinite(collectedInput)
      ? clamp(safeNum(collectedInput), 0, 100)
      : undefined;

  const elapsedInput = input.elapsedTimePct;
  const elapsedTimePct =
    elapsedInput != null && Number.isFinite(elapsedInput)
      ? clamp(safeNum(elapsedInput), 0, 100)
      : undefined;

  /** Implied EAC if spend continued at average $/calendar-elapsed through the full duration. */
  let eacCalendar: number | null = null;
  if (elapsedTimePct != null && elapsedTimePct >= 2 && actualExpenses > 0) {
    const elapsedRatio = Math.max(elapsedTimePct / 100, 0.02);
    eacCalendar = actualExpenses / elapsedRatio;
  }

  /** Job “done” follows timeline / explicit flag only — not cost-budget % (avoid treating schedule 100% + low cost as finished). */
  const isCompleted = input.isCompleted === true || scheduleProgressPct >= 99.5;
  let forecastFinalCost = adjustedBudget;
  let forecastMethod: ForecastMethod = 'budget-fallback';

  if (actualExpenses > 0 || committedPOs > 0) {
    if (isCompleted) {
      forecastFinalCost = actualExpenses;
      forecastMethod = 'completed';
    } else if (progressRatio > 0.01 && actualExpenses > 0) {
      // Run-rate: actual / blended completion → implied total at completion
      const cpiForecast = actualExpenses / progressRatio;
      forecastFinalCost = Math.max(actualPlusCommitted, cpiForecast);
      forecastMethod = 'run-rate';

      const withinCostBudget = actualPlusCommitted <= adjustedBudget;
      if (withinCostBudget && adjustedBudget > 0 && forecastFinalCost > adjustedBudget) {
        forecastFinalCost = adjustedBudget;
        forecastMethod = 'hybrid';
      }

      if (eacCalendar != null && eacCalendar > forecastFinalCost) {
        forecastFinalCost = eacCalendar;
        forecastMethod = 'calendar-run-rate';
      }
    } else {
      forecastFinalCost = Math.max(adjustedBudget, actualPlusCommitted);
      forecastMethod = 'budget-fallback';
      if (eacCalendar != null && eacCalendar > forecastFinalCost) {
        forecastFinalCost = eacCalendar;
        forecastMethod = 'calendar-run-rate';
      }
    }
  }

  const projectedProfit = contractValue - forecastFinalCost;
  const spendToDateMarginPct =
    contractValue > 0 ? ((contractValue - actualExpenses) / contractValue) * 100 : 0;
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
    spendToDateMarginPct,
    projectedMarginPct,
    estimatedProfit,
    profitVarianceVsEstimate,
    status,
    forecastMethod,
    scheduleProgressPct,
    costBudgetUsedPct,
    blendedProgressPct,
    contractCollectedPct,
    elapsedTimePct,
  };
}

