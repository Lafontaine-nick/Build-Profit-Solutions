/**
 * Central Command can send once the portfolio and timeline read have finished.
 * An empty compare set is a finished result (estimates, drafts, or jobs with no
 * saved timeline), not "still syncing". Requiring a non-empty compare payload
 * left the send button disabled for those accounts.
 */
export function isCentralCommandContextReady(input: {
  projectsReady: boolean;
  timelineLoaded: boolean;
  totalProjectCount: number;
  projectOptionCount: number;
}): boolean {
  if (!input.projectsReady || !input.timelineLoaded) return false;
  return input.totalProjectCount === 0 || input.projectOptionCount > 0;
}
