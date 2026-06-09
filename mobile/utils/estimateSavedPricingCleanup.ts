import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { clearPricingMemory, deletePricingMemoryForProject, fetchPricingLibrary } from '@/utils/contractorPricingMemory';
import {
  clearAllSavedBidTemplates,
  deleteSavedBidTemplatesForEstimate,
  loadSavedBidTemplates,
} from '@/utils/estimateSavedBidTemplates';

export type SavedPricingSourceCounts = {
  templates: number;
  libraryTotal: number;
};

/** Count templates on device + rates in the pricing library (backend). */
export async function countSavedPricingSources(): Promise<SavedPricingSourceCounts> {
  const templates = await loadSavedBidTemplates();
  let libraryTotal = 0;
  try {
    const lib = await fetchPricingLibrary();
    libraryTotal = lib.total || 0;
  } catch {
    libraryTotal = 0;
  }
  return { templates: templates.length, libraryTotal };
}

export async function hasAnySavedPricingSources(): Promise<boolean> {
  const { templates, libraryTotal } = await countSavedPricingSources();
  return templates > 0 || libraryTotal > 0;
}

/** Remove saved bid templates + pricing-library entries linked to a bid/project id. */
export async function purgeSavedPricingForBid(bidId: string): Promise<{
  templatesRemoved: number;
  libraryRatesRemoved: number;
}> {
  const id = String(bidId || '').trim();
  if (!id) return { templatesRemoved: 0, libraryRatesRemoved: 0 };

  const before = await loadSavedBidTemplates();
  const after = await deleteSavedBidTemplatesForEstimate(id);
  const templatesRemoved = before.length - after.length;

  const { deleted: libraryRatesRemoved } = await deletePricingMemoryForProject(id);
  return { templatesRemoved, libraryRatesRemoved };
}

/** Remove all saved bid templates on-device and all pricing-library rates on the backend. */
export async function clearAllSavedPricingData(): Promise<void> {
  await clearAllSavedBidTemplates();
  await clearPricingMemory();
}

/** Drop cached saved-pricing proposal on a draft (e.g. after sources were deleted). */
export function draftWithoutPendingPricing<T extends EstimateAiDraft | null | undefined>(
  draft: T
): T {
  if (!draft) return draft;
  const next = { ...draft };
  delete next.pendingPricingProposal;
  return next as T;
}
