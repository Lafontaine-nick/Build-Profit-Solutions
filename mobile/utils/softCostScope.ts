import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import {
  getChecklistItemQuantityRuleOrDefault,
  ruleKeysToTryForPackage,
} from '@/utils/scopeItemQuantities';
import { LUMP_SUM_RULE_TRADE_NOT_ALLOWANCE_KEYS } from '@/utils/appliedPricingBreakdownBuckets';

/** True soft-cost / fee allowances — never Materials/Labor on Step 3. */
const SOFT_COST_RULE_KEYS = new Set([
  'permits',
  'contingency',
  'plans_engineering',
  'mobilization',
  'emergency_fee',
  'final_inspections',
  'survey',
  'general_conditions',
  'supervision',
  'overhead_profit',
]);

/** Soft-cost scopes (permits, cleanup, contingency, etc.) — flat allowance, not Materials/Labor. */
export function isSoftCostScopePackage(
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope' | 'materialPrice' | 'laborPrice' | 'checklistItemId'>,
  draft?: Pick<EstimateAiDraft, 'scopeChecklist' | 'estimateTier'> | null
): boolean {
  // Applied trade splits (e.g. finish carpentry mat+lab) must stay expandable on Step 3
  // even if the checklist rule historically used an allowance unit.
  const mat = Number(pkg.materialPrice || 0);
  const lab = Number(pkg.laborPrice || 0);
  if (mat > 0 && lab > 0) return false;

  const templateKey = draft?.scopeChecklist?.templateKey || draft?.estimateTier || null;
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
    // Legacy: lumpSumOnly rules that are not trade packages (cleanup & fixture packages use mat/lab).
    if (
      getChecklistItemQuantityRuleOrDefault(ruleKey, templateKey).lumpSumOnly &&
      !LUMP_SUM_RULE_TRADE_NOT_ALLOWANCE_KEYS.has(ruleKey)
    ) {
      return true;
    }
  }
  return false;
}
