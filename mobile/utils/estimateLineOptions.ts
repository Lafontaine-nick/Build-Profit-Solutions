import { normalizeExpenseGroupLabel } from '@/utils/groupCategoryExpenses';
import {
  collectEstimateLineItems,
  scoreExpenseLineMatch,
  RATE_INSIGHT_AUTO_MATCH_MIN_SCORE,
  type ExpenseInput,
} from '@/utils/rateInsightComparisons';

export type EstimateLineOption = {
  id: string;
  name: string;
  budget: number;
  quantity?: number | null;
  unit?: string | null;
};

export type EstimateLinePickerKind = 'materials' | 'labor';

function lineName(item: Record<string, unknown>): string {
  return String(item.name || item.description || item.scopeName || 'Estimate line').trim();
}

export function displayEstimateLineName(name: string): string {
  return name.replace(/\s*[—–-]\s*(materials?|labor)\s*$/i, '').trim() || name;
}

function lineBudget(item: Record<string, unknown>): number {
  const total = Number(item.total ?? item.estimatedTotal ?? item.amount ?? 0);
  if (Number.isFinite(total) && total > 0) return total;
  const qty = Number(item.qty ?? item.quantity ?? 0);
  const rate = Number(item.unitPrice ?? item.unitCost ?? item.unitRate ?? item.rate ?? 0);
  return qty > 0 && rate > 0 ? qty * rate : Math.max(rate, 0);
}

export function estimateLineOptionsFor(
  estimateData: Record<string, unknown> | null | undefined,
  kind: EstimateLinePickerKind
): EstimateLineOption[] {
  const { materialLines, laborLines } = collectEstimateLineItems(estimateData);
  return (kind === 'materials' ? materialLines : laborLines)
    .map((item, index) => ({
      id: String(item.id || `${kind}-${index}`),
      name: lineName(item),
      budget: lineBudget(item),
      quantity: Number(item.qty ?? item.quantity) > 0 ? Number(item.qty ?? item.quantity) : null,
      unit: item.unit != null ? String(item.unit) : null,
    }))
    .filter((item) => item.budget > 0);
}

/** Resolve an estimate line from explicit link id or expense labels (material, vendor, notes). */
export function resolveEstimateLineOption(
  estimateData: Record<string, unknown> | null | undefined,
  kind: EstimateLinePickerKind,
  prefs: {
    linkedLineId?: string | null;
    material?: string | null;
    vendor?: string | null;
    description?: string | null;
  }
): EstimateLineOption | null {
  const options = estimateLineOptionsFor(estimateData, kind);
  if (prefs.linkedLineId) {
    const byId = options.find((item) => item.id === prefs.linkedLineId);
    if (byId) return byId;
  }

  const labelCandidates = [prefs.material, prefs.vendor, prefs.description]
    .map((value) => normalizeExpenseGroupLabel(value))
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);

  for (const labelNorm of labelCandidates) {
    const byLabel = options.find(
      (item) => normalizeExpenseGroupLabel(displayEstimateLineName(item.name)) === labelNorm
    );
    if (byLabel) return byLabel;
  }

  if (!labelCandidates.length) return null;

  const expense: ExpenseInput = {
    id: 'resolve',
    amount: 1,
    category: kind === 'materials' ? 'Materials/Equipment' : 'Labor',
    material: prefs.material ?? undefined,
    vendor: prefs.vendor ?? undefined,
    description: prefs.description ?? undefined,
  };

  const ranked = options
    .map((option) => ({
      option,
      score: scoreExpenseLineMatch(expense, {
        id: option.id,
        name: option.name,
        categoryKey: kind,
        estimatedTotal: option.budget,
        loggedTotal: 0,
        expenses: [],
        budgetOnly: false,
      }),
    }))
    .filter((entry) => entry.score >= RATE_INSIGHT_AUTO_MATCH_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0].score - ranked[1].score < 10) return null;
  return ranked[0].option;
}
