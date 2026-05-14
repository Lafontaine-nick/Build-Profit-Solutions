/**
 * For completed jobs, the list shows "Completed {date}".
 * Prefer the earlier of (actual completion timestamp, scheduled end) so marking
 * complete before the planned finish does not still show a future schedule date.
 */
export function pickCompletedDisplayDateRaw(
  mergedProject: any,
  scheduleEndPick: { raw: string; date: Date } | null
): string | null {
  const completedRaw =
    mergedProject?.completedAt || mergedProject?.projectData?.completedAt || null;
  const completedDate = completedRaw ? new Date(completedRaw) : null;
  const hasCompleted =
    completedDate != null && !Number.isNaN(completedDate.getTime());

  const schedDate = scheduleEndPick?.date ?? null;
  const hasSched = schedDate != null && !Number.isNaN(schedDate.getTime());

  if (hasCompleted && hasSched) {
    const c = completedDate!.getTime();
    const s = schedDate!.getTime();
    if (s === c) return String(completedRaw);
    return s < c ? String(scheduleEndPick!.raw) : String(completedRaw);
  }
  if (hasCompleted) return String(completedRaw);

  // Legacy rows without `completedAt`: if the project was last updated before the
  // scheduled end, treat that update time as a reasonable proxy for early close-out.
  if (hasSched) {
    const updatedRaw = mergedProject?.updatedAt;
    const updatedDate = updatedRaw ? new Date(updatedRaw) : null;
    if (
      updatedDate &&
      !Number.isNaN(updatedDate.getTime()) &&
      updatedDate.getTime() < schedDate!.getTime()
    ) {
      return String(updatedRaw);
    }
    return String(scheduleEndPick!.raw);
  }

  return null;
}
