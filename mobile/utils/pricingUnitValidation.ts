/**
 * Client mirror of backend pricingUnitValidation + scopePricingMatrix.
 */

import {
  isAutoSelectEligibleScope as matrixAutoSelect,
  isManualPricingScope as matrixManual,
  isNeedsApprovalScope as matrixNeedsApproval,
  type MatrixItem,
} from '@/utils/scopePricingMatrix';

export type PricingUnitValidationItem = MatrixItem & {
  proposedRates?: Array<{
    unit?: string | null;
    total?: number | null;
    rate?: number | null;
    lumpTotal?: number;
  }>;
  pricingBlocked?: boolean;
  reviewStatus?: string;
  warnings?: string[];
  unitMismatchSubtext?: string | null;
  approvalSubtext?: string | null;
  autoSelectEligible?: boolean;
};

export const BLOCKED_PRICING_MESSAGE = 'Blocked — pricing unit does not match scope.';

export const MANUAL_PRICING_NO_SOURCE_MESSAGE =
  'Needs manual pricing — no reliable source found.';

export const MANUAL_PRICING_UNIT_MESSAGE =
  'Needs manual pricing — available pricing source does not match this item\u2019s unit.';

export const APPROVAL_SUBTEXT = 'Confirm what is included before applying.';

export function normalizePricingUnit(raw: unknown): string {
  const u = String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (!u) return 'lump_sum';
  if (u === 'sq_ft' || u === 'square_feet' || u === 'sf') return 'sqft';
  if (u === 'linear_foot' || u === 'linear_ft' || u === 'ln_ft' || u === 'linearfoot') return 'lf';
  if (u === 'lump' || u === 'lot' || u === 'flat' || u === 'allowance') return 'lump_sum';
  if (u === 'hr' || u === 'hrs' || u === 'hours') return 'hour';
  if (u === 'fixture_count' || u === 'count') return 'each';
  if (u === 'assembly_sqft') return 'sqft';
  if (u === 'square' || u === 'squares') return 'square';
  return u;
}

export function isManualPricingScope(item: PricingUnitValidationItem): boolean {
  return matrixManual(item);
}

export function isNeedsApprovalScope(item: PricingUnitValidationItem): boolean {
  return matrixNeedsApproval(item);
}

export function isAutoSelectEligibleScope(item: PricingUnitValidationItem): boolean {
  return matrixAutoSelect(item);
}

function isLumpSumRate(rate: { unit?: string; lumpTotal?: number; total?: number; rate?: number }): boolean {
  if (rate.lumpTotal != null && rate.lumpTotal > 0) return true;
  const u = normalizePricingUnit(rate.unit);
  return u === 'lump_sum' && ((rate.total ?? 0) > 0 || (rate.rate ?? 0) > 0);
}

export function isRateUnitCompatibleWithQuantity(
  quantityUnit: string | undefined,
  rate: { unit?: string; lumpTotal?: number; total?: number; rate?: number }
): boolean {
  const q = normalizePricingUnit(quantityUnit);
  const allowed = new Set<string>();
  if (q === 'each') ['each', 'lump_sum', 'allowance', 'fixture_count'].forEach((u) => allowed.add(u));
  else if (q === 'sqft') ['sqft', 'assembly_sqft'].forEach((u) => allowed.add(u));
  else if (q === 'lf') ['lf', 'linear_foot', 'linear_ft'].forEach((u) => allowed.add(u));
  else if (q === 'lump_sum') ['lump_sum', 'allowance'].forEach((u) => allowed.add(u));
  else if (q === 'hour') allowed.add('hour');
  else if (q === 'square') ['square', 'sqft'].forEach((u) => allowed.add(u));
  else allowed.add(q);

  if (isLumpSumRate(rate)) return q === 'lump_sum' || allowed.has('lump_sum');
  const rateUnit = normalizePricingUnit(rate.unit);
  if (!rateUnit || rateUnit === 'lump_sum') return q === 'lump_sum';
  return allowed.has(rateUnit);
}

export function validateClientPricingUnits(item: PricingUnitValidationItem): {
  blocked: boolean;
  warnings: string[];
  unitMismatchSubtext: string | null;
} {
  if (item.pricingBlocked) {
    return {
      blocked: true,
      warnings: item.warnings || [BLOCKED_PRICING_MESSAGE],
      unitMismatchSubtext: item.unitMismatchSubtext ?? null,
    };
  }
  const rates = item.proposedRates || [];
  if (!rates.length) {
    return { blocked: false, warnings: item.warnings || [], unitMismatchSubtext: null };
  }
  for (const rate of rates) {
    if ((rate.total || 0) > 0 && !isRateUnitCompatibleWithQuantity(item.unit, rate)) {
      const rateUnit = normalizePricingUnit(rate.unit);
      const qLabel = normalizePricingUnit(item.unit) === 'each' ? 'each' : item.unit || 'unit';
      return {
        blocked: true,
        warnings: [BLOCKED_PRICING_MESSAGE],
        unitMismatchSubtext: `Available rate is ${rateUnit}, but this item is priced by ${qLabel}.`,
      };
    }
  }
  return { blocked: false, warnings: [], unitMismatchSubtext: null };
}

export function suggestItemPricingBlocked(item: PricingUnitValidationItem): boolean {
  if (item.pricingBlocked) return true;
  if (item.reviewStatus === 'unit_mismatch') return true;
  return validateClientPricingUnits(item).blocked;
}

export function suggestItemNeedsManualPricing(item: PricingUnitValidationItem): boolean {
  if (suggestItemPricingBlocked(item)) return true;
  if (item.reviewStatus === 'needs_price') return true;
  if (isManualPricingScope(item) && !(item.proposedRates || []).some((r) => (r.total || 0) > 0)) return true;
  if ((item.warnings || []).some((w) => /needs manual pricing — no reliable source/i.test(w))) return true;
  return false;
}

export function suggestItemSelectable(item: PricingUnitValidationItem): boolean {
  if (suggestItemPricingBlocked(item)) return false;
  if (suggestItemNeedsManualPricing(item)) return false;
  if (!(item.proposedRates || []).some((r) => (r.total || 0) > 0)) return false;
  return true;
}
