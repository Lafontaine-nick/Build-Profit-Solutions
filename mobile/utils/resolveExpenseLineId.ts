import { normalizeExpenseGroupLabel } from '@/utils/groupCategoryExpenses';

type ExpenseLike = {
  linkedLineId?: string;
  material?: string;
  vendor?: string;
  description?: string;
};

/** Resolve an estimate line id from a grouped expense key or expense fields. */
export function resolveExpenseLineId(
  prefs: {
    groupKey?: string;
    expense?: ExpenseLike;
    lineIdToLabel: Record<string, string>;
  }
): string | null {
  const { groupKey, expense, lineIdToLabel } = prefs;
  if (groupKey?.startsWith('line:')) return groupKey.slice(5);
  if (expense?.linkedLineId) return expense.linkedLineId;

  const labelSource =
    groupKey?.startsWith('grp:')
      ? groupKey.slice(4)
      : [expense?.material, expense?.vendor, expense?.description]
          .map((value) => normalizeExpenseGroupLabel(value))
          .find(Boolean);
  if (!labelSource) return null;

  for (const [id, name] of Object.entries(lineIdToLabel)) {
    if (normalizeExpenseGroupLabel(name) === labelSource) return id;
  }
  return null;
}
