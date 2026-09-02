import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';

export type BpsDirectoryPayload = {
  id: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  trades?: string[];
  zip: string;
  listOnFindSubcontractors: boolean;
};

export type BpsDirectorySyncResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Registers opt-in listing on the backend so Find Subcontractors can merge this account
 * with Google Places (verified BPS section).
 */
export async function syncBpsDirectoryListing(
  payload: BpsDirectoryPayload
): Promise<BpsDirectorySyncResult> {
  const zip = String(payload.zip || '')
    .replace(/\D/g, '')
    .slice(0, 5);
  const base = resolveBackendRestApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/contractors/directory/register`;
  try {
    const body = {
      id: payload.id,
      companyName: payload.companyName || '',
      contactName: payload.contactName || '',
      email: payload.email || '',
      phone: payload.phone || '',
      website: payload.website || '',
      trades: Array.isArray(payload.trades) ? payload.trades : [],
      zip,
      listOnFindSubcontractors: payload.listOnFindSubcontractors,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let detail = `Server error (${response.status})`;
      try {
        const errBody = await response.json();
        if (typeof errBody?.error === 'string' && errBody.error.trim()) {
          detail = errBody.error.trim();
        }
      } catch {
        /* ignore */
      }
      return { ok: false, error: detail };
    }
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error && e.message
        ? e.message
        : 'Could not reach the server to update your listing.';
    if (__DEV__) console.warn('syncBpsDirectoryListing failed', e);
    return { ok: false, error: message };
  }
}
