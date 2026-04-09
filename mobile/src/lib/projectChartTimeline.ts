/**
 * Project spending trend timeline — aligns chart X-axis with Estimates (bid) dates,
 * then runs through the current calendar day. Used by Budget + Overview spending charts.
 */

export function normalizeDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseFlexibleDate(value: unknown): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : `${s}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Schedule start: Estimates / `estimateData` (bid) fields first, then project-level dates.
 */
export function resolveProjectScheduleStart(project: Record<string, unknown> | null | undefined): Date {
  const p = project ?? {};
  const ed = (p.estimateData as Record<string, unknown>) || {};
  const candidates: unknown[] = [
    ed.projectStartDate,
    ed.startDate,
    p.projectStartDate,
    p.startDate,
    p.startISO,
  ];
  for (const c of candidates) {
    const parsed = parseFlexibleDate(c);
    if (parsed) return normalizeDay(parsed);
  }
  return normalizeDay(new Date());
}

/**
 * Schedule end for planned burn (linear to cost cap). Falls back to start + 1y if missing.
 */
export function resolveProjectScheduleEnd(project: Record<string, unknown> | null | undefined): Date {
  const p = project ?? {};
  const ed = (p.estimateData as Record<string, unknown>) || {};
  const candidates: unknown[] = [
    ed.projectEndDate,
    ed.endDate,
    p.projectEndDate,
    p.endDate,
    p.endISO,
  ];
  for (const c of candidates) {
    const parsed = parseFlexibleDate(c);
    if (parsed) return normalizeDay(parsed);
  }
  const start = resolveProjectScheduleStart(project);
  const fallback = new Date(start.getTime());
  fallback.setFullYear(fallback.getFullYear() + 1);
  return normalizeDay(fallback);
}

/**
 * Cumulative spend samples from schedule start through **today** (current date).
 * `totalSpent` is total actual spend to date (same as Budget/Overview actuals).
 */
export function buildSpendingTrendSamplePoints(
  project: Record<string, unknown> | null | undefined,
  totalSpent: number
): { date: string; spent: number }[] {
  const start = resolveProjectScheduleStart(project);
  const today = normalizeDay(new Date());
  const chartEndMs = today.getTime();

  const spanMs = chartEndMs - start.getTime();
  if (!Number.isFinite(spanMs) || spanMs <= 0) {
    return [{ date: today.toISOString().split("T")[0], spent: totalSpent }];
  }

  const elapsedDays = Math.max(1, Math.ceil(spanMs / (1000 * 60 * 60 * 24)));
  const daysBetweenPoints = 5;
  const numPoints = Math.min(24, Math.max(8, Math.ceil(elapsedDays / daysBetweenPoints)));

  const points: { date: string; spent: number }[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const date = new Date(start.getTime() + spanMs * t);
    if (date.getTime() > chartEndMs) break;
    points.push({
      date: date.toISOString().split("T")[0],
      spent: Math.round(totalSpent * t),
    });
  }
  if (points.length === 0) {
    return [{ date: today.toISOString().split("T")[0], spent: totalSpent }];
  }
  const last = points[points.length - 1];
  if (last.spent !== totalSpent) {
    last.date = today.toISOString().split("T")[0];
    last.spent = totalSpent;
  }
  return points;
}
