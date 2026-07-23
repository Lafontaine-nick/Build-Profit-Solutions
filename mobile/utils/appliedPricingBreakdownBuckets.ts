/**
 * Confirm Scope "Applied pricing" summary buckets (Material · Labor · Allowances).
 * Explicit per scope — not inferred from lumpSumOnly alone.
 */

import { getNationalAverageBudgetSplit } from '@/utils/scopeItemQuantities';
import {
  ELECTRICAL_TRIM_NATIONAL_MATERIAL_SHARE,
  HAUL_OFF_NATIONAL_MATERIAL_SHARE,
  PLUMBING_TRIM_NATIONAL_MATERIAL_SHARE,
  splitInstalledPackageByMaterialShare,
} from '@/utils/groundUpFinishPackages';

export type AppliedPricingBucket = 'allowance' | 'material_labor' | 'labor_only';

/** Job-level fees & reserves — Allowances column. */
export const APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS = new Set([
  'contingency',
  'appliances',
  'plans_engineering',
  'permits',
  'mobilization',
  'emergency_fee',
  'final_inspections',
  'survey',
  'general_conditions',
  'supervision',
  'overhead_profit',
]);

/** Final clean / disposal with mat/lab split (dumpsters in Material). */
export const APPLIED_PRICING_MATERIAL_LABOR_SCOPE_KEYS = new Set([
  'plumbing_trim',
  'electrical_trim',
  'haul_off',
  'cleanup',
]);

/** Trades & disposal with mat/lab (or equipment/labor) split. */
export const APPLIED_PRICING_LABOR_ONLY_SCOPE_KEYS = new Set<string>([]);

/**
 * lumpSumOnly checklist rules that still price as Material + Labor (or labor-only)
 * on Step 3 — not soft-cost Allowances.
 */
export const LUMP_SUM_RULE_TRADE_NOT_ALLOWANCE_KEYS = new Set([
  ...APPLIED_PRICING_LABOR_ONLY_SCOPE_KEYS,
  ...APPLIED_PRICING_MATERIAL_LABOR_SCOPE_KEYS,
  'interior_trim',
  'finish_carpentry',
  'landscaping',
]);

export function appliedPricingBucketForScope(itemId: string): AppliedPricingBucket {
  const id = String(itemId || '').trim();
  if (APPLIED_PRICING_LABOR_ONLY_SCOPE_KEYS.has(id)) return 'labor_only';
  if (APPLIED_PRICING_ALLOWANCE_SCOPE_KEYS.has(id)) return 'allowance';
  if (APPLIED_PRICING_MATERIAL_LABOR_SCOPE_KEYS.has(id)) return 'material_labor';
  return 'material_labor';
}

/** Infer mat/lab from national planning shares when only a flat total is stored. */
export function inferNationalMaterialLaborSplit(
  itemId: string,
  total: number
): { material: number; labor: number } {
  if (!(total > 0)) return { material: 0, labor: 0 };

  const fixedShare: Record<string, number> = {
    plumbing_trim: PLUMBING_TRIM_NATIONAL_MATERIAL_SHARE,
    electrical_trim: ELECTRICAL_TRIM_NATIONAL_MATERIAL_SHARE,
    haul_off: HAUL_OFF_NATIONAL_MATERIAL_SHARE,
    cleanup: HAUL_OFF_NATIONAL_MATERIAL_SHARE,
  };
  const share = fixedShare[itemId];
  if (share != null) {
    const split = splitInstalledPackageByMaterialShare(total, share);
    return { material: split.material, labor: split.labor };
  }

  const avg = getNationalAverageBudgetSplit(itemId);
  const base = (avg?.material || 0) + (avg?.labor || 0);
  if (avg && base > 0) {
    const split = splitInstalledPackageByMaterialShare(total, avg.material / base);
    return { material: split.material, labor: split.labor };
  }

  return { material: 0, labor: total };
}
