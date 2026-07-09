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

export function isAllowancesCategoryName(name: string | null | undefined): boolean {
  const n = String(name || '').trim().toLowerCase();
  return n.includes('allowance');
}
