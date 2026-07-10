import {
  buildPricingApiEndpointUrls,
  fetchBackendWithFallback,
} from '@/utils/resolveAiBackendUrl';
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
  packageName?: string;
  scopeItemName: string;
  suggestedUnitRate?: number;
  suggestedAmount?: number;
  quantity?: number | null;
  estimatedTotal?: number | null;
  unitType?: string;
  lineType?: 'material' | 'labor' | 'lump_sum';
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
  options?: { apiPath?: string; timeout?: number; lanTimeout?: number }
): Promise<T> {
  const apiPath = options?.apiPath || '/api/contractor-pricing-memory';
  const urls = buildPricingApiEndpointUrls(path, apiPath);
  const isHeavyProposal = path === '/proposal' || path === '/rough-pricing-proposal';
  const timeout = options?.timeout ?? (isHeavyProposal ? 90000 : 60000);
  const lanTimeout = options?.lanTimeout ?? (isHeavyProposal ? 20000 : 8000);

  if (__DEV__) {
    console.log(
      '💰 Pricing API',
      path,
      '→',
      urls[0],
      urls.length > 1 ? `(+${urls.length - 1} fallbacks)` : ''
    );
  }

  const authedInit = await withProjectLeadsAuth({
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
  });

  const response = await fetchBackendWithFallback(urls, authedInit, timeout, lanTimeout);

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

export async function deletePricingMemoryForProject(projectId: string): Promise<{ deleted: number }> {
  const id = String(projectId || '').trim();
  if (!id) return { deleted: 0 };
  try {
    const res = await pricingMemoryFetch<{ deleted?: number }>(
      `/project/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    return { deleted: res.deleted ?? 0 };
  } catch (e) {
    if (__DEV__) {
      console.warn('deletePricingMemoryForProject failed (non-blocking)', e);
    }
    return { deleted: 0 };
  }
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

export type CloseoutCalibrationResult = {
  success?: boolean;
  status?: string;
  message?: string;
  pendingSuggestionCount?: number;
  rateSuggestions?: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
  memoryWrite?: { updated?: number };
  capture?: { captured?: number; skipped?: string };
};

/** Build budget lines from project buckets for close-out calibration. */
export function buildCloseoutLinesFromProject(projectLike: Record<string, unknown> | null | undefined) {
  const pd = (projectLike?.projectData as Record<string, unknown>) || projectLike || {};
  const buckets = (pd.buckets as Array<Record<string, unknown>>) || [];
  return buckets.map((b, i) => ({
    id: String(b.id || `bucket-${i}`),
    category: String(b.category || b.name || 'other'),
    description: String(b.description || b.category || b.name || 'Budget line'),
    qty: Number(b.qty) > 0 ? Number(b.qty) : 1,
    unit: String(b.unit || 'lump_sum'),
    unitCost: Number(b.budget ?? b.planned ?? b.amount ?? 0) || undefined,
    estimatedTotal: Number(b.budget ?? b.planned ?? b.amount ?? 0) || undefined,
  }));
}

export function buildCloseoutPayloadFromProject(
  projectLike: Record<string, unknown> | null | undefined,
  extras: {
    completionConfirmed?: boolean;
    role?: string;
  } = {}
) {
  const pd = ((projectLike?.projectData as Record<string, unknown>) || projectLike || {}) as Record<
    string,
    unknown
  >;
  const expenses = ((pd.expenses as Array<Record<string, unknown>>) || []).map((expense) => ({
    id: String(expense.id),
    category: expense.category,
    description: expense.description ?? expense.notes,
    vendor: expense.vendor,
    amount: expense.amount,
    date: expense.date,
    receiptUri: expense.receiptUri,
    aiConfidence: expense.aiConfidence,
    linkedLineId: expense.linkedLineId,
  }));
  const changeOrders = ((pd.changeOrders as Array<Record<string, unknown>>) || []).map((co) => ({
    id: String(co.id),
    title: co.title,
    amount: co.amount,
    status: co.status,
    approved: co.approved,
    materialsAmount: co.materialsAmount,
    laborAmount: co.laborAmount,
    excludeFromCalibration: true,
  }));

  const contract =
    Number(projectLike?.contractValue) ||
    Number(projectLike?.adjustedContractValue) ||
    Number(pd.contractValue) ||
    Number((pd.estimateData as Record<string, unknown>)?.total) ||
    null;

  return {
    projectId: String(projectLike?.id || pd.id || ''),
    completionConfirmed: extras.completionConfirmed !== false,
    lines: buildCloseoutLinesFromProject(projectLike),
    expenses,
    changeOrders,
    finalCustomerPrice: contract,
    plannedBudget: Number(pd.budget) || Number(projectLike?.budget) || null,
    estimateId: String((pd.estimateData as Record<string, unknown>)?.id || projectLike?.estimateId || '') || null,
    projectType: String(projectLike?.projectType || pd.projectType || 'other'),
    projectTitle: String(projectLike?.name || projectLike?.title || pd.name || ''),
    bid: (pd.estimateData as Record<string, unknown>) || undefined,
  };
}

/**
 * Fire-and-forget close-out calibration when a job is marked complete.
 * Writes actualJobCost into pricing memory; does not auto-change rates.
 */
export async function submitCloseoutCalibration(
  projectLike: Record<string, unknown> | null | undefined
): Promise<CloseoutCalibrationResult> {
  try {
    const payload = buildCloseoutPayloadFromProject(projectLike, { completionConfirmed: true });
    if (!payload.projectId) {
      return { success: false, message: 'Missing projectId' };
    }
    const res = await pricingMemoryFetch<CloseoutCalibrationResult>('/closeout-calibration', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (e) {
    if (__DEV__) {
      console.warn('submitCloseoutCalibration failed (non-blocking)', e);
    }
    return { success: false, message: e instanceof Error ? e.message : 'network_error' };
  }
}

export async function approveCloseoutCalibration(payload: {
  suggestions: Array<Record<string, unknown>>;
  suggestionIds?: string[];
  role?: string;
}): Promise<{ approved: number; message?: string }> {
  const res = await pricingMemoryFetch<{ approved: number; message?: string }>(
    '/calibration/approve',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return res;
}
