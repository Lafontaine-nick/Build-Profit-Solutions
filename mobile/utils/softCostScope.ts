import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import {
  getChecklistItemQuantityRuleOrDefault,
  ruleKeysToTryForPackage,
} from '@/utils/scopeItemQuantities';

/** Soft-cost scopes (permits, cleanup, contingency, etc.) — flat allowance, not Materials/Labor. */
export function isSoftCostScopePackage(
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope'>,
  draft?: Pick<EstimateAiDraft, 'scopeChecklist' | 'estimateTier'> | null
): boolean {
  const templateKey = draft?.scopeChecklist?.templateKey || draft?.estimateTier || null;
  const candidates = [
    ...ruleKeysToTryForPackage(pkg.name, pkg.scope || ''),
    // Scope field often stores the checklist id directly (e.g. "contingency").
    String(pkg.scope || '').trim(),
  ].filter(Boolean);
  const seen = new Set<string>();
  for (const ruleKey of candidates) {
    if (seen.has(ruleKey)) continue;
    seen.add(ruleKey);
    if (getChecklistItemQuantityRuleOrDefault(ruleKey, templateKey).lumpSumOnly) {
      return true;
    }
  }
  return false;
}
