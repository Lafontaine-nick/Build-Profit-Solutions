/**
 * In-app copy: how contractor-facing leads enter the app (campaigns, requests, directory).
 * Used by Leads empty state and FAQ — keep in sync when product behavior changes.
 */
export const LEAD_SOURCES_WAYS: readonly { title: string; detail: string }[] = [
  {
    title: 'My Campaign',
    detail:
      'Under Leads → Campaigns, create or activate a campaign. When published, your company can appear in Find Subcontractors so other contractors discover your trade and service areas. Your campaign also appears as a “My campaign” lead on the Leads tab alongside other opportunities.',
  },
  {
    title: 'Request Subcontractor',
    detail:
      'From Find Subcontractors, use Request Subcontractor to post a job need (green Sub Request card on your Leads tab). Matched contractors see it as an incoming lead on their Leads tab. When new matches arrive, your card shows a yellow “new matches” notice until you open it.',
  },
  {
    title: 'Directory pick',
    detail:
      'Verified BPS contractors appear in Find Subcontractors. When someone selects you from that directory (general network) and adds you to an estimate (Add to bid), a Directory pick lead is created — it shows as a neutral grey card on your Leads tab (no green Sub Request or teal Campaign banner).',
  },
] as const;

export function leadSourcesFaqAnswer(): string {
  return LEAD_SOURCES_WAYS.map((w, i) => `${i + 1}. ${w.title}: ${w.detail}`).join('\n\n');
}
