import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { ruleKeysToTryForPackage } from '@/utils/scopeItemQuantities';
import { APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS } from '@/utils/appliedPricingBreakdownBuckets';

/**
 * Fee allowances that belong on the bid Soft costs card.
 * Same list as Confirm Scope. Cleanup, haul-off, and other trades stay
 * material and labor even when their unit is stored as "allowance".
 * Project overhead (insurance, facilities, admin) is a separate bid section
 * and is never filled from these lines.
 */
const SOFT_COST_RULE_KEYS = APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS;

/** Contingency is a bid buffer, not a soft-cost line. */
export function isContingencyScopePackage(
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope' | 'checklistItemId'>
): boolean {
  const candidates = [
    pkg.checklistItemId,
    ...ruleKeysToTryForPackage(pkg.name, pkg.scope || ''),
    String(pkg.scope || '').trim(),
  ].filter(Boolean) as string[];
  for (const ruleKey of candidates) {
    const key = String(ruleKey).trim().toLowerCase();
    if (key === 'contingency' || key === 'contingency_allowance') return true;
  }
  return /^contingency\b/i.test(String(pkg.name || '').trim());
}

/** Fee allowances — flat soft-cost lines, not Materials/Labor and not project overhead. */
export function isSoftCostScopePackage(
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope' | 'materialPrice' | 'laborPrice' | 'checklistItemId'>,
  _draft?: Pick<EstimateAiDraft, 'scopeChecklist' | 'estimateTier'> | null
): boolean {
  // Applied trade splits (e.g. finish carpentry mat+lab) must stay expandable on Step 3
  // even if the checklist rule historically used an allowance unit.
  const mat = Number(pkg.materialPrice || 0);
  const lab = Number(pkg.laborPrice || 0);
  if (mat > 0 && lab > 0) return false;

  const candidates = [
    pkg.checklistItemId,
    ...ruleKeysToTryForPackage(pkg.name, pkg.scope || ''),
    // Scope field often stores the checklist id directly (e.g. "contingency").
    String(pkg.scope || '').trim(),
  ].filter(Boolean) as string[];
  const seen = new Set<string>();
  for (const ruleKey of candidates) {
    if (seen.has(ruleKey)) continue;
    seen.add(ruleKey);
    if (SOFT_COST_RULE_KEYS.has(ruleKey)) return true;
  }
  return false;
}
