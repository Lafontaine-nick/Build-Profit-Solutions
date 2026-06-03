import { resolveAiBaseUrl } from '@/utils/resolveAiBackendUrl';
import { withProjectLeadsAuth } from '@/utils/projectLeadsAuthFetch';

export type PricingMemorySettings = {
  pricingMemoryEnabled: boolean;
  excludeTestBids: boolean;
  learnOnApply: boolean;
  learnOnSubmit: boolean;
  learnOnWon: boolean;
  learnOnCompleted: boolean;
  learnOnSavedTemplate: boolean;
  learnOnApprovedAiSuggested: boolean;
  defaultSaveToLibrary?: boolean;
};

export type PricingLibrarySection = {
  trade: string;
  label: string;
  items: Array<{
    id: string;
    scopeItemName: string;
    category: string;
    unitType: string;
    unitRate: number | null;
    usageCount: number;
    lastUsedAt: string;
    pricingSource: string;
  }>;
};

export type MissingPriceSuggestion = {
  missingItem: string;
  scopeItemName: string;
  suggestedUnitRate?: number;
  suggestedAmount?: number;
  quantity?: number | null;
  estimatedTotal?: number | null;
  unitType?: string;
  source: string;
  sourceLabel: string;
  sourcePriority: number;
  label: string;
  confidence: string;
  requiresApproval: boolean;
  status: string;
};

export type PricingMemorySuggestion = {
  scopeItemName: string;
  category: string;
  unitType: string;
  suggestedUnitRate: number;
  quantity?: number | null;
  estimatedTotal?: number | null;
  source: string;
  sourceLabel: string;
  sourcePriority: number;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  sampleCount: number;
  requiresApproval: boolean;
  status: string;
};

export type CapturePricingMemoryMeta = {
  bidStatus: 'applied' | 'submitted' | 'won' | 'completed' | 'lost' | 'saved_template';
  isTestBid?: boolean;
  isDemo?: boolean;
  saveToLibrary?: boolean;
  projectId?: string | null;
  estimateId?: string | null;
  projectTitle?: string | null;
  bidTitle?: string | null;
  markupPct?: number | null;
  marginPct?: number | null;
  region?: string | null;
};

export async function pricingMemoryFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: { apiPath?: string }
): Promise<T> {
  const base = resolveAiBaseUrl();
  const apiPath = options?.apiPath || '/api/contractor-pricing-memory';
  const authedInit = await withProjectLeadsAuth({
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
  });

  const response = await fetch(`${base}${apiPath}${path}`, authedInit);

  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('ROUTE_NOT_FOUND');
    }
    const raw = body?.message || body?.error || '';
    const friendly =
      typeof raw === 'string' && /not found/i.test(raw)
        ? 'Service temporarily unavailable.'
        : raw || `Request failed (${response.status})`;
    throw new Error(friendly);
  }
  return body;
}

export async function fetchPricingMemorySettings(): Promise<PricingMemorySettings> {
  const res = await pricingMemoryFetch<{ settings: PricingMemorySettings }>('/settings');
  return res.settings;
}

export async function updatePricingMemorySettings(
  patch: Partial<PricingMemorySettings>
): Promise<PricingMemorySettings> {
  const res = await pricingMemoryFetch<{ settings: PricingMemorySettings }>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.settings;
}

export async function fetchPricingMemoryRates(): Promise<
  Array<{
    id: string;
    scopeItemName: string;
    unitRate: number | null;
    unitType: string;
    trade: string;
    useCount: number;
    lastUsedAt: string;
  }>
> {
  const res = await pricingMemoryFetch<{ rates: Array<Record<string, unknown>> }>('/rates');
  return (res.rates || []) as Array<{
    id: string;
    scopeItemName: string;
    unitRate: number | null;
    unitType: string;
    trade: string;
    useCount: number;
    lastUsedAt: string;
  }>;
}

export async function clearPricingMemory(): Promise<void> {
  await pricingMemoryFetch('/clear', { method: 'DELETE' });
}

export async function capturePricingMemory(payload: {
  draft?: Record<string, unknown>;
  bid?: Record<string, unknown>;
  meta: CapturePricingMemoryMeta;
}): Promise<{ captured: number; skipped?: string }> {
  try {
    const res = await pricingMemoryFetch<{ captured: number; skipped?: string }>('/capture', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (e) {
    if (__DEV__) {
      console.warn('capturePricingMemory failed (non-blocking)', e);
    }
    return { captured: 0, skipped: 'network_error' };
  }
}

export function isTestOrDemoBid(bid: Record<string, unknown>): boolean {
  const title = `${bid.title || ''} ${bid.projectTitle || ''}`.toLowerCase();
  return /\b(test|demo|sample|example)\b/.test(title);
}

export async function fetchPricingLibrary(): Promise<{
  sections: PricingLibrarySection[];
  total: number;
}> {
  const res = await pricingMemoryFetch<{ sections: PricingLibrarySection[]; total: number }>(
    '/library'
  );
  return { sections: res.sections || [], total: res.total || 0 };
}

export async function deletePricingRate(id: string): Promise<void> {
  await pricingMemoryFetch(`/rates/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updatePricingRate(
  id: string,
  patch: { unitRate?: number; scopeItemName?: string }
): Promise<void> {
  await pricingMemoryFetch(`/rates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchSuggestMissingPrices(
  draft: Record<string, unknown>,
  savedTemplates: unknown[] = []
): Promise<{ suggestions: MissingPriceSuggestion[]; message?: string | null }> {
  const res = await pricingMemoryFetch<{
    suggestions: MissingPriceSuggestion[];
    message?: string | null;
  }>('/suggest-missing', {
    method: 'POST',
    body: JSON.stringify({ draft, savedTemplates }),
  });
  return { suggestions: res.suggestions || [], message: res.message };
}
