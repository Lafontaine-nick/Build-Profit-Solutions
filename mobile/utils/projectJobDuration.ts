/** Inclusive calendar-day count between project start and end (YYYY-MM-DD). */
export function getProjectJobDurationDays(
  startDate?: string | null,
  endDate?: string | null,
): number | null {
  if (!startDate || !endDate) return null;
  const startTs = new Date(`${startDate}T00:00:00`).getTime();
  const endTs = new Date(`${endDate}T00:00:00`).getTime();
  const spanDays = Math.round((endTs - startTs) / (1000 * 60 * 60 * 24));
  if (spanDays < 0) return null;
  return spanDays + 1;
}

/** Step 7 weekly progress default when Step 2 dates are not set yet. */
export const ESTIMATE_DEFAULT_WEEKLY_PROJECT_WEEKS = 4;

/** Weeks between Step 2 start and end. Elapsed days round to the nearest week, so a month is 4. */
export function getProjectJobDurationWeeks(
  startDate?: string | null,
  endDate?: string | null,
): number | null {
  if (!startDate || !endDate) return null;
  const startTs = new Date(`${startDate}T00:00:00`).getTime();
  const endTs = new Date(`${endDate}T00:00:00`).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs)) return null;
  const spanDays = Math.round((endTs - startTs) / (1000 * 60 * 60 * 24));
  if (spanDays < 0) return null;
  if (spanDays === 0) return 1;
  return Math.max(1, Math.round(spanDays / 7));
}

/**
 * Weekly-schedule default. A saved count is kept when someone typed it.
 * A count produced by the old round-up (inclusive days ÷ 7) is replaced by the job length.
 */
export function defaultWeeklyProjectWeeks(
  startDate?: string | null,
  endDate?: string | null,
  savedWeeks?: string | number | null,
): number {
  const derived = getProjectJobDurationWeeks(startDate, endDate);
  const saved = Math.round(Number(savedWeeks));
  const hasSaved = Number.isFinite(saved) && saved > 0;
  if (derived == null) {
    return hasSaved ? saved : ESTIMATE_DEFAULT_WEEKLY_PROJECT_WEEKS;
  }
  if (!hasSaved) return derived;
  const inclusiveDays = getProjectJobDurationDays(startDate, endDate);
  const legacyRoundedUp =
    inclusiveDays == null ? null : Math.max(1, Math.ceil(inclusiveDays / 7));
  if (saved === legacyRoundedUp && saved !== derived) return derived;
  return saved;
}

export function resolveWeeklyProjectWeeks(
  startDate?: string | null,
  endDate?: string | null,
  overrideWeeks?: string | number | null,
): number {
  const parsedOverride = Math.round(Number(overrideWeeks));
  if (Number.isFinite(parsedOverride) && parsedOverride > 0) {
    return parsedOverride;
  }
  return (
    getProjectJobDurationWeeks(startDate, endDate) ??
    ESTIMATE_DEFAULT_WEEKLY_PROJECT_WEEKS
  );
}
