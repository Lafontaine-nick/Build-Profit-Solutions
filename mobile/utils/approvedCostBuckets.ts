/** Map server-side approved cost buckets → BudgetTab line rows (managers / restricted financials). */

export type ApprovedCostBucket = {
  id?: string;
  name?: string;
  budget?: number;
  spent?: number;
};

export function mapApprovedCostBucketsToBudgetLines(
  buckets: ApprovedCostBucket[] | undefined | null
): Array<{
  id: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  markupPct: number;
  spent: number;
  aiSuggested: boolean;
}> {
  if (!Array.isArray(buckets) || buckets.length === 0) return [];

  return buckets
    .map((bucket, index) => {
      const budget = Number(bucket?.budget ?? 0) || 0;
      const spent = Number(bucket?.spent ?? 0) || 0;
      if (budget <= 0 && spent <= 0) return null;

      const name = String(bucket?.name || 'Category');
      const lower = name.toLowerCase();
      const category = lower.includes('labor')
        ? 'Labor'
        : lower.includes('allowance')
          ? 'Allowances'
          : lower.includes('overhead') || lower.includes('permit')
            ? 'Overhead'
            : 'Materials/Equipment';

      return {
        id: String(bucket?.id ?? `${category.toLowerCase()}-${index}`),
        category,
        description: name,
        qty: 1,
        unit: 'lump sum',
        unitCost: Math.max(budget, spent),
        markupPct: 0,
        spent,
        aiSuggested: false,
      };
    })
    .filter(Boolean) as ReturnType<typeof mapApprovedCostBucketsToBudgetLines>;
}

export function mapApprovedCostBucketsToProjectBuckets(
  buckets: ApprovedCostBucket[] | undefined | null
): Array<{
  id: string;
  name: string;
  budget: number;
  bidBudget: number;
  spent: number;
}> {
  if (!Array.isArray(buckets) || buckets.length === 0) return [];

  return buckets.map((b, index) => ({
    id: String(b?.id ?? index + 1),
    name: String(b?.name || 'Category'),
    budget: Number(b?.budget ?? 0) || 0,
    bidBudget: Number(b?.budget ?? 0) || 0,
    spent: Number(b?.spent ?? 0) || 0,
  }));
}
