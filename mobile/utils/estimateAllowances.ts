/** Shared helpers for bid/project soft-cost allowances. */

export type AllowanceLineLike = {
  amount?: number | null;
  total?: number | null;
  totalCost?: number | null;
  name?: string | null;
};

export function getAllowanceLineItemsTotal(
  lines: AllowanceLineLike[] | null | undefined
): number {
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  return lines.reduce((sum, line) => {
    const amount = Number(line?.amount ?? line?.total ?? line?.totalCost ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export function getBidAllowanceLineItemsTotal(bid: {
  allowanceLineItems?: AllowanceLineLike[] | null;
} | null | undefined): number {
  return getAllowanceLineItemsTotal(bid?.allowanceLineItems);
}

/**
 * Project overhead card: insurance, facilities, admin, and added overhead. Job cost.
 * Older projects and bills still use the name "Company overhead".
 */
export function isCompanyOverheadCategory(name: string | null | undefined): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  return (
    normalized.includes('project overhead') ||
    normalized.includes('company overhead') ||
    normalized === 'overhead'
  );
}

/** Named overhead lines added beside insurance, facilities, and admin. */
export function getBidOverheadLineItemsTotal(bid: {
  overheadLineItems?: AllowanceLineLike[] | null;
} | null | undefined): number {
  return getAllowanceLineItemsTotal(bid?.overheadLineItems);
}

/** Named soft-cost lines, plus plans, permits, engineering, lender fees, and interest. */
export function getBidSoftCostTotal(bid: {
  allowanceLineItems?: AllowanceLineLike[] | null;
  planCost?: number | null;
  permitCost?: number | null;
  engineeringCost?: number | null;
  financingFees?: number | null;
  interestCost?: number | null;
  contractorType?: number | string | null;
} | null | undefined): number {
  const contractorType = bid?.contractorType != null ? parseInt(String(bid.contractorType), 10) : null;
  const includeBorrowingCosts = contractorType === 4 || contractorType === 5 || contractorType == null;
  const borrowing = includeBorrowingCosts
    ? (Number(bid?.financingFees) || 0) + (Number(bid?.interestCost) || 0)
    : 0;
  return (
    getBidAllowanceLineItemsTotal(bid) +
    (Number(bid?.planCost) || 0) +
    (Number(bid?.permitCost) || 0) +
    (Number(bid?.engineeringCost) || 0) +
    borrowing
  );
}

export function isAllowancesCategoryName(name: string | null | undefined): boolean {
  const n = String(name || '').trim().toLowerCase();
  return n.includes('allowance') || n.includes('soft cost') || n.includes('soft-cost');
}
