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
  /** Current projected profit at completion, explicitly named for AI responses. */
  currentProjectedProfit: number;
  /** Spend-to-date margin: (contract - actualExpenses) / contract */
  spendToDateMarginPct: number;
  /** Expected margin at completion: (contract - forecastFinalCost) / contract. Uses run-rate (actualExpenses/progress) for forecast. */
  projectedMarginPct: number;
  /** Original estimate profit/margin based on the planned cost baseline. */
  originalEstimateProfit: number;
  originalEstimateMarginPct: number;
  /** Planned cost budget remaining after actual expenses and commitments. */
  remainingCostBudget: number;
  /** Estimated profit = contractValue - estimatedCostBaseline */
  estimatedProfit: number;
  /** Profit variance = projectedProfit - estimatedProfit (positive = profit improved) */
  profitVarianceVsEstimate: number;
  status: ProfitStatus;
  /** How the forecast was derived — for UI labeling and future hybrid model */
  forecastMethod: ForecastMethod;
  /** Schedule % passed in (timeline). */
  scheduleProgressPct: number;
  /** (Actual + committed POs) / planned cost budget × 100, clamped 0–100 for UI */
  costBudgetUsedPct: number;
  /** Effective completion % used for run-rate (schedule vs damped burn) */
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
 * Forecast logic — run-rate with damped burn vs schedule, optional **blended calendar stress**.
 *
 * - **rawCostBudgetUsedPct** can exceed 100% when over budget (internal sensitivity).
 * - **costBudgetUsedPct** returned to UI stays clamped 0–100 for pills/labels.
 * - **Blended completion** uses max(schedule, min(rawBurn, schedule+25)) to avoid absurd run-rates.
 * - **Calendar EAC** uses actual+committed; stress is **blended** in only when calendar signal
 *   and strain gates pass (elapsed, behind schedule vs calendar, or overburn vs progress).
 * - Run-rate may exceed planned budget while you are still under budget (margin can move down).
 *
 * **Collections:** passed through for UI only; accrual margin is cost vs contract.
 */
export function computeProfitForecast(input: ProfitForecastInput): ProfitForecastOutput {
  const contractValue = safeNum(input.contractValue);
  const adjustedBudget = safeNum(input.adjustedBudget);
  const actualExpenses = safeNum(input.actualExpenses);
  const committedPOs = safeNum(input.committedPOs);
  const actualPlusCommitted = actualExpenses + committedPOs;

  const scheduleProgressPct = clamp(safeNum(input.progressPct), 0, 100);

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

  /**
   * Keep the raw burn % for forecasting.
   * Do NOT cap at 100 internally or we lose sensitivity once a job is over budget.
   */
  const rawCostBudgetUsedPct =
    adjustedBudget > 0 ? (actualPlusCommitted / adjustedBudget) * 100 : 0;

  /**
   * Keep existing output field name, but return a clamped display-friendly version.
   * Internally we use rawCostBudgetUsedPct.
   */
  const costBudgetUsedPct = clamp(rawCostBudgetUsedPct, 0, 100);

  /**
   * Base completion for run-rate.
   * Use the stronger of schedule progress or budget-burn progress,
   * but do not let burn progress run infinitely ahead and distort forecast.
   */
  const effectiveBurnPct = Math.min(rawCostBudgetUsedPct, scheduleProgressPct + 25);
  const blendedProgressPct = clamp(
    Math.max(scheduleProgressPct, effectiveBurnPct),
    0,
    100
  );
  const progressRatio = blendedProgressPct > 0 ? blendedProgressPct / 100 : 0;

  /**
   * Calendar-based extrapolation:
   * Use actual + committed so the risk model reflects real obligations, not just booked actuals.
   */
  let eacCalendar: number | null = null;
  if (elapsedTimePct != null && elapsedTimePct >= 5 && actualPlusCommitted > 0) {
    const elapsedRatio = Math.max(elapsedTimePct / 100, 0.05);
    eacCalendar = actualPlusCommitted / elapsedRatio;
  }

  /**
   * Completion logic:
   * Only explicit completion flag or schedule progress ~100%.
   * Do not infer "done" from cost burn.
   */
  const isCompleted = input.isCompleted === true || scheduleProgressPct >= 99.5;

  let forecastFinalCost = adjustedBudget > 0 ? adjustedBudget : actualPlusCommitted;
  let forecastMethod: ForecastMethod = 'budget-fallback';

  if (actualPlusCommitted > 0) {
    if (isCompleted) {
      forecastFinalCost = actualPlusCommitted;
      forecastMethod = 'completed';
    } else if (progressRatio > 0.03) {
      const runRateForecast = actualPlusCommitted / progressRatio;
      forecastFinalCost = Math.max(actualPlusCommitted, runRateForecast);
      forecastMethod = 'run-rate';

      // Do not clamp run-rate down to the planned budget while you are still under budget.
      // That behavior froze "projected margin at completion" whenever spend + schedule implied a
      // mild overrun (common after logging material/labor) — the UI looked stale even as costs grew.

      const hasEnoughCalendarSignal = elapsedTimePct != null && elapsedTimePct >= 12;
      const isBehindScheduleVsCalendar =
        elapsedTimePct != null && elapsedTimePct > scheduleProgressPct + 10;
      const isOverburningVsProgress = rawCostBudgetUsedPct > scheduleProgressPct + 10;

      const shouldApplyCalendarStress =
        eacCalendar != null &&
        hasEnoughCalendarSignal &&
        (isBehindScheduleVsCalendar || isOverburningVsProgress);

      if (shouldApplyCalendarStress && eacCalendar != null && eacCalendar > forecastFinalCost) {
        const severeStress = isBehindScheduleVsCalendar && isOverburningVsProgress;
        const calendarWeight = severeStress ? 0.75 : 0.45;

        const stressedForecast =
          forecastFinalCost + (eacCalendar - forecastFinalCost) * calendarWeight;

        if (stressedForecast > forecastFinalCost) {
          forecastFinalCost = stressedForecast;
          forecastMethod = 'calendar-run-rate';
        }
      }
    } else {
      // Blended schedule progress is still very low (<~3%). Without spend, keep the budget fallback.
      // Once real burn exists, derive a minimum completion signal from cost vs cap so new expenses
      // can move the forecast before milestones advance much (timeline edits alone rarely move %).
      if (adjustedBudget > 0 && rawCostBudgetUsedPct >= 2) {
        const impliedProgressRatio = Math.max(0.03, progressRatio, rawCostBudgetUsedPct / 100);
        const runRateEarly = actualPlusCommitted / impliedProgressRatio;
        forecastFinalCost = Math.max(actualPlusCommitted, runRateEarly);
        forecastMethod = 'run-rate';
      } else {
        forecastFinalCost = Math.max(adjustedBudget, actualPlusCommitted);
        forecastMethod = 'budget-fallback';
      }

      const earlyCalendarStress =
        eacCalendar != null &&
        elapsedTimePct != null &&
        elapsedTimePct >= 15 &&
        rawCostBudgetUsedPct > Math.max(20, scheduleProgressPct + 15);

      if (earlyCalendarStress && eacCalendar != null && eacCalendar > forecastFinalCost) {
        forecastFinalCost =
          forecastFinalCost + (eacCalendar - forecastFinalCost) * 0.35;
        forecastMethod = 'calendar-run-rate';
      }
    }
  }

  forecastFinalCost = Math.max(forecastFinalCost, actualPlusCommitted, 0);

  const projectedProfit = contractValue - forecastFinalCost;

  const spendToDateMarginPct =
    contractValue > 0 ? ((contractValue - actualExpenses) / contractValue) * 100 : 0;

  const projectedMarginPct =
    contractValue > 0 ? (projectedProfit / contractValue) * 100 : 0;

  const costForVariance =
    input.estimatedCostBaseline != null && input.estimatedCostBaseline > 0
      ? input.estimatedCostBaseline
      : adjustedBudget;

  const estimatedProfit = contractValue - costForVariance;
  const profitVarianceVsEstimate = projectedProfit - estimatedProfit;
  const originalEstimateMarginPct =
    contractValue > 0 ? (estimatedProfit / contractValue) * 100 : 0;
  const remainingCostBudget = Math.max(0, adjustedBudget - actualPlusCommitted);
  const status = getProfitStatus(projectedMarginPct);

  return {
    contractValue,
    adjustedBudget,
    actualExpenses,
    committedPOs,
    forecastFinalCost,
    projectedProfit,
    currentProjectedProfit: projectedProfit,
    spendToDateMarginPct,
    projectedMarginPct,
    originalEstimateProfit: estimatedProfit,
    originalEstimateMarginPct,
    remainingCostBudget,
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

