import type { Lead } from './types';

function norm(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase();
}

/** In-app seed catalog (`mockLeads`, e.g. L1001–L1027); merged in some dev builds. */
export function isEmbeddedSeedCatalogLeadId(id: string): boolean {
  return /^L10\d+$/.test(id);
}

function identityKeySet(identityPrimary: string, identityAlt?: string | null): Set<string> {
  const keys = new Set<string>();
  const a = norm(identityPrimary);
  const b = norm(identityAlt ?? '');
  if (a) keys.add(a);
  if (b) keys.add(b);
  if (keys.size === 0) {
    keys.add('contractor-demo');
  }
  return keys;
}

/**
 * Leads tab shows product-backed rows the unified API already scoped to you, plus BPS directory picks.
 * We still drop MARKETPLACE and legacy sources (BID_INVITATION, SHARED, …) from this tab.
 *
 * Pass **both** Clerk `user.id` and `user.email` when available: `createdBy` / `assignedTo` on the server
 * may use either form.
 *
 * **Important:** Do not re-derive campaign / `isOwnRequest` / “matched copy only” rules here — they drifted
 * from real API rows (e.g. legacy JSON missing `isOwnRequest`, or GC rows with no `assignedTo`). The backend
 * `GET /unified-leads/contractor/:id` only returns rows where `createdBy` or `assignedTo` equals that scope.
 */
export function isAllowedProductLead(
  lead: Lead,
  identityPrimary: string,
  identityAlt?: string | null
): boolean {
  if (lead.source === 'MARKETPLACE') {
    return false;
  }

  if (lead.source !== 'PROJECT_BASED' && lead.source !== 'BPS_SELECTION') {
    return false;
  }

  const keys = identityKeySet(identityPrimary, identityAlt);
  const createdBy = norm(lead.createdBy);
  const assignedTo = norm(lead.assignedTo);

  if (assignedTo && keys.has(assignedTo)) {
    return true;
  }
  if (createdBy && keys.has(createdBy)) {
    return true;
  }
  return false;
}

/** Same ingest rules as the Leads tab, including embedded L10xx catalog when merged in dev. */
export function isVisibleInProductLeadsTab(
  lead: Lead,
  identityPrimary: string,
  identityAlt?: string | null
): boolean {
  if (isEmbeddedSeedCatalogLeadId(lead.id)) {
    // Own-request seed rows (e.g. L1024 "Build Profit Demo") must not show for every account —
    // they duplicate real "Request Subcontractor" cards for signed-in users.
    if (lead.isOwnRequest === true) {
      return isAllowedProductLead(lead, identityPrimary, identityAlt);
    }
    return true;
  }
  return isAllowedProductLead(lead, identityPrimary, identityAlt);
}
