import { collectEstimateLineItems } from '@/utils/rateInsightComparisons';

export type CategoryExpenseLike = {
  id: string;
  material?: string;
  vendor?: string;
  description?: string;
  linkedLineId?: string;
  date?: string;
};

export type CategoryExpenseListEntry<T extends CategoryExpenseLike> =
  | { kind: 'single'; item: T }
  | { kind: 'group'; groupKey: string; lineName: string; items: T[] };

export function normalizeExpenseGroupLabel(value?: string | null): string {
  if (!value?.trim()) return '';
  return value
    .replace(/\s*[—–-]\s*(materials?|labor)\s*$/i, '')
    .trim()
    .toLowerCase();
}

export function displayExpenseLineName(name?: string | null): string {
  if (!name?.trim()) return 'Estimate line';
  return name.replace(/\s*[—–-]\s*(materials?|labor)\s*$/i, '').trim() || name.trim();
}

export function resolveExpenseGroupKey(
  expense: CategoryExpenseLike,
  lineIdToLabel: Record<string, string>
): string {
  if (expense.linkedLineId) {
    const fromLine = normalizeExpenseGroupLabel(lineIdToLabel[expense.linkedLineId]);
    if (fromLine) return `grp:${fromLine}`;
    return `line:${expense.linkedLineId}`;
  }
  const fromMaterial = normalizeExpenseGroupLabel(expense.material);
  if (fromMaterial) return `grp:${fromMaterial}`;
  const fromVendor = normalizeExpenseGroupLabel(expense.vendor);
  if (fromVendor) return `grp:${fromVendor}`;
  const fromDescription = normalizeExpenseGroupLabel(expense.description);
  if (fromDescription) return `grp:${fromDescription}`;
  return `exp:${expense.id}`;
}

function displayLineNameForGroup<T extends CategoryExpenseLike>(
  items: T[],
  lineIdToLabel: Record<string, string>
): string {
  const first = items[0];
  if (first.material?.trim()) return displayExpenseLineName(first.material);
  if (first.vendor?.trim()) return displayExpenseLineName(first.vendor);
  if (first.description?.trim()) return displayExpenseLineName(first.description);
  if (first.linkedLineId && lineIdToLabel[first.linkedLineId]) {
    return displayExpenseLineName(lineIdToLabel[first.linkedLineId]);
  }
  return displayExpenseLineName(first.material);
}

/** Group expenses that share an estimate line (or material label) into one card. */
export function buildGroupedCategoryExpenseList<T extends CategoryExpenseLike>(
  items: T[],
  lineIdToLabel: Record<string, string>
): CategoryExpenseListEntry<T>[] {
  const buckets = new Map<string, T[]>();
  const keyOrder: string[] = [];

  for (const item of items) {
    const key = resolveExpenseGroupKey(item, lineIdToLabel);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      keyOrder.push(key);
    }
    buckets.get(key)!.push(item);
  }

  const out: CategoryExpenseListEntry<T>[] = [];
  for (const key of keyOrder) {
    const bucket = buckets.get(key)!;
    const canGroup = bucket.length >= 2 && !key.startsWith('exp:');
    if (canGroup) {
      out.push({
        kind: 'group',
        groupKey: key,
        lineName: displayLineNameForGroup(bucket, lineIdToLabel),
        items: [...bucket].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        }),
      });
    } else {
      for (const item of bucket) {
        out.push({ kind: 'single', item });
      }
    }
  }
  return out;
}

export function buildEstimateLineIdToLabel(
  estimateData: Record<string, unknown> | null | undefined,
  kind: 'materials' | 'labor'
): Record<string, string> {
  const { materialLines, laborLines } = collectEstimateLineItems(estimateData);
  const lines = kind === 'materials' ? materialLines : laborLines;
  const map: Record<string, string> = {};
  lines.forEach((line, index) => {
    const id = String(line.id || `${kind}-${index}`);
    const name = String(line.name || line.description || line.scopeName || '').trim();
    if (name) map[id] = name;
  });
  return map;
}
