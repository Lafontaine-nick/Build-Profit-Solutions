/**
 * Merge plan-takeoff measurements into Quick Measurement input.
 * Non-destructive by default — only fills empty fields.
 */

export type PlanTakeoffMeasurements = Record<string, number | string | null | undefined>;

function positive(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function mergePlanMeasurementsIntoInput<T extends Record<string, unknown>>(
  current: T,
  extracted: PlanTakeoffMeasurements,
  opts: { overwrite?: boolean } = {}
): { next: T; filled: number; filledKeys: string[] } {
  const overwrite = opts.overwrite === true;
  const next = { ...current } as T;
  const filledKeys: string[] = [];

  for (const [key, value] of Object.entries(extracted || {})) {
    const v = positive(value);
    if (v == null) continue;
    const existing = positive((next as Record<string, unknown>)[key]);
    if (existing != null && !overwrite) continue;
    (next as Record<string, unknown>)[key] = String(v);
    filledKeys.push(key);
  }

  return { next, filled: filledKeys.length, filledKeys };
}
