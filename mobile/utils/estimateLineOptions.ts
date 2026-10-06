import { normalizeExpenseGroupLabel } from '@/utils/groupCategoryExpenses';
import { isCompanyOverheadCategory } from '@/utils/estimateAllowances';
import {
  collectEstimateLineItems,
  equipmentRentalEstimateLine,
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
  costCode?: string | null;
  /** Client price of the change order this materials or labor line belongs to. */
  clientPrice?: number | null;
};

export type EstimateLinePickerKind = 'materials' | 'labor' | 'soft' | 'contingency' | 'overhead';

export const SOFT_COST_LINE_IDS = {
  engineering: 'bps-soft-engineering',
  plans: 'bps-soft-plans',
  permits: 'bps-soft-permits',
  lender: 'bps-soft-lender',
  interest: 'bps-soft-interest',
} as const;

export const CONTINGENCY_LINE_ID = 'bps-contingency';

export const OVERHEAD_LINE_IDS = {
  insurance: 'bps-overhead-insurance',
  maintenance: 'bps-overhead-maintenance',
  facilities: 'bps-overhead-facilities',
  admin: 'bps-overhead-admin',
  other: 'bps-overhead-other',
} as const;

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

function positiveAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function includeBorrowingSoftCosts(estimateData: Record<string, unknown> | null | undefined): boolean {
  const raw = estimateData?.contractorType;
  const contractorType = raw != null && String(raw).trim() !== '' ? parseInt(String(raw), 10) : null;
  return contractorType === 4 || contractorType === 5 || contractorType == null;
}

function namedLine(id: string, name: string, budget: number): EstimateLineOption | null {
  if (!(budget > 0)) return null;
  return { id, name, budget, quantity: null, unit: null, costCode: null };
}

/** Plans, permits, engineering, lender fees, interest, then any added soft-cost lines. */
export function softCostEstimateLines(
  estimateData: Record<string, unknown> | null | undefined
): EstimateLineOption[] {
  const lines = [
    namedLine(SOFT_COST_LINE_IDS.engineering, 'Engineering', positiveAmount(estimateData?.engineeringCost)),
    namedLine(SOFT_COST_LINE_IDS.plans, 'Plans', positiveAmount(estimateData?.planCost)),
    namedLine(SOFT_COST_LINE_IDS.permits, 'Permits', positiveAmount(estimateData?.permitCost)),
    includeBorrowingSoftCosts(estimateData)
      ? namedLine(SOFT_COST_LINE_IDS.lender, 'Lender fees', positiveAmount(estimateData?.financingFees))
      : null,
    includeBorrowingSoftCosts(estimateData)
      ? namedLine(SOFT_COST_LINE_IDS.interest, 'Interest', positiveAmount(estimateData?.interestCost))
      : null,
  ].filter((line): line is EstimateLineOption => line != null);

  const custom = Array.isArray(estimateData?.allowanceLineItems) ? estimateData.allowanceLineItems : [];
  custom.forEach((item, index) => {
    const row = item as Record<string, unknown>;
    const budget = positiveAmount(row?.amount ?? row?.total ?? row?.totalCost);
    const name = String(row?.name || '').trim();
    const line = namedLine(String(row?.id || `bps-soft-custom-${index}`), name || 'Soft cost', budget);
    if (line) lines.push(line);
  });
  return lines;
}

/** Insurance, facilities, admin, and named overhead lines. Zero amounts stay off the list. */
export function overheadEstimateLines(
  estimateData: Record<string, unknown> | null | undefined
): EstimateLineOption[] {
  const lines = [
    namedLine(OVERHEAD_LINE_IDS.insurance, 'Insurance overhead', positiveAmount(estimateData?.insuranceOverhead)),
    namedLine(
      OVERHEAD_LINE_IDS.maintenance,
      'Equipment maintenance',
      positiveAmount(estimateData?.equipmentMaintenance)
    ),
    namedLine(OVERHEAD_LINE_IDS.facilities, 'Facilities', positiveAmount(estimateData?.facilities)),
    namedLine(OVERHEAD_LINE_IDS.admin, 'Admin', positiveAmount(estimateData?.adminOverhead)),
    namedLine(OVERHEAD_LINE_IDS.other, 'Other overhead', positiveAmount(estimateData?.otherOverhead)),
  ].filter((line): line is EstimateLineOption => line != null);

  const custom = Array.isArray(estimateData?.overheadLineItems) ? estimateData.overheadLineItems : [];
  custom.forEach((item, index) => {
    const row = item as Record<string, unknown>;
    const budget = positiveAmount(row?.amount ?? row?.total ?? row?.totalCost);
    const name = String(row?.name || '').trim();
    const line = namedLine(String(row?.id || `bps-overhead-custom-${index}`), name || 'Overhead', budget);
    if (line) lines.push(line);
  });
  return lines;
}

export function contingencyEstimateLines(
  estimateData: Record<string, unknown> | null | undefined
): EstimateLineOption[] {
  const line = namedLine(
    CONTINGENCY_LINE_ID,
    'Contingency',
    positiveAmount(estimateData?.contingencyAllowance)
  );
  return line ? [line] : [];
}

type BudgetSpendExpense = {
  id?: string;
  amount?: number;
  linkedLineId?: string | null;
  category?: string | null;
  vendor?: string | null;
  description?: string | null;
  material?: string | null;
  notes?: string | null;
};

export type BudgetLineSpendSummary = {
  loggedTotal: number;
  budget: number;
  remaining: number;
  variancePct: number | null;
  badge: 'over' | null;
};

function expenseBlob(expense: BudgetSpendExpense): string {
  return [expense.description, expense.notes, expense.material, expense.vendor]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function softLineNameMatches(name: string, text: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized || !text) return false;
  if (normalized === 'permits') return /\bpermits?\b|\binspections?\b/.test(text);
  if (normalized === 'plans') return /\bplans?\b/.test(text);
  if (normalized === 'engineering') return /\bengineering\b|\bengineer\b/.test(text);
  if (normalized === 'lender fees') return /lender fee|origination|loan points|financing fee/.test(text);
  if (normalized === 'interest') return /\binterest\b/.test(text);
  if (normalized === 'insurance overhead') return /\binsurance\b/.test(text);
  if (normalized === 'equipment maintenance') return /equipment maintenance|\bmaintenance\b/.test(text);
  if (normalized === 'facilities') return /\bfacilit/.test(text);
  if (normalized === 'admin') return /\badmin\b/.test(text);
  return normalized.length >= 3 && text.includes(normalized);
}

function summaryFor(loggedTotal: number, budget: number): BudgetLineSpendSummary {
  const remaining = budget > 0 ? Math.round((budget - loggedTotal) * 100) / 100 : 0;
  const variancePct =
    budget > 0 && loggedTotal > 0 ? Math.round(((loggedTotal - budget) / budget) * 100) : null;
  return {
    loggedTotal,
    budget,
    remaining,
    variancePct,
    badge: budget > 0 && loggedTotal > budget ? 'over' : null,
  };
}

/** Spend against soft-cost or contingency estimate lines. Contingency has one line, so every contingency bill counts there. */
export function budgetLineSpendForKind(input: {
  options: EstimateLineOption[];
  expenses?: BudgetSpendExpense[] | null;
  kind: 'soft' | 'contingency' | 'overhead';
  excludeExpenseId?: string | null;
}): { summaries: Record<string, BudgetLineSpendSummary>; unlinked: { id: string; label: string; amount: number }[] } {
  const summaries: Record<string, BudgetLineSpendSummary> = {};
  const logged: Record<string, number> = {};
  for (const option of input.options) {
    logged[option.id] = 0;
  }
  const optionIds = new Set(input.options.map((option) => option.id));
  const unlinked: { id: string; label: string; amount: number }[] = [];
  const categoryMatches = (category: string) => {
    if (input.kind === 'contingency') return category.includes('contingenc');
    if (input.kind === 'overhead') return isCompanyOverheadCategory(category);
    return category.includes('soft') || category.includes('allowance');
  };

  for (const expense of input.expenses || []) {
    if (input.excludeExpenseId && expense.id === input.excludeExpenseId) continue;
    const category = String(expense.category || '').toLowerCase();
    const linked = expense.linkedLineId ? String(expense.linkedLineId) : '';
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const linkedHere = linked && optionIds.has(linked);
    if (!linkedHere && !categoryMatches(category)) continue;

    if (linkedHere) {
      logged[linked] = (logged[linked] || 0) + amount;
      continue;
    }
    if (input.kind === 'contingency') {
      const only = input.options[0];
      if (only) logged[only.id] = (logged[only.id] || 0) + amount;
      continue;
    }
    const text = expenseBlob(expense);
    const matches = input.options
      .filter((option) => softLineNameMatches(option.name, text))
      .sort((a, b) => b.name.length - a.name.length);
    if (matches.length === 0) {
      unlinked.push({
        id: String(expense.id || `unlinked-${unlinked.length}`),
        label: String(expense.vendor || expense.description || 'Expense').trim() || 'Expense',
        amount,
      });
      continue;
    }
    logged[matches[0].id] = (logged[matches[0].id] || 0) + amount;
  }

  for (const option of input.options) {
    summaries[option.id] = summaryFor(logged[option.id] || 0, option.budget);
  }
  return { summaries, unlinked };
}

export function estimateLineOptionsFor(
  estimateData: Record<string, unknown> | null | undefined,
  kind: EstimateLinePickerKind
): EstimateLineOption[] {
  if (kind === 'soft') return softCostEstimateLines(estimateData);
  if (kind === 'contingency') return contingencyEstimateLines(estimateData);
  if (kind === 'overhead') return overheadEstimateLines(estimateData);
  const { materialLines, laborLines } = collectEstimateLineItems(estimateData);
  const rental = kind === 'materials' ? equipmentRentalEstimateLine(estimateData) : null;
  const sourceLines = kind === 'materials' ? materialLines : laborLines;
  const lines =
    rental &&
    !sourceLines.some((item) =>
      /equipment/i.test(String(item.name || item.description || item.scopeName || ''))
    )
      ? [...sourceLines, rental]
      : sourceLines;
  return lines
    .map((item, index) => ({
      id: String(item.id || `${kind}-${index}`),
      name: lineName(item),
      budget: lineBudget(item),
      quantity: Number(item.qty ?? item.quantity) > 0 ? Number(item.qty ?? item.quantity) : null,
      unit: item.unit != null ? String(item.unit) : null,
      costCode:
        String(item.costCode || item.checklistItemId || item.sourceItemId || '').trim() ||
        null,
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
  if (kind === 'soft' || kind === 'contingency' || kind === 'overhead') {
    if (prefs.linkedLineId) {
      const byId = options.find((item) => item.id === prefs.linkedLineId);
      if (byId) return byId;
    }
    if (kind === 'contingency') return options[0] ?? null;
    const text = [prefs.description, prefs.material, prefs.vendor]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matches = options
      .filter((option) => softLineNameMatches(option.name, text))
      .sort((a, b) => b.name.length - a.name.length);
    return matches[0] ?? null;
  }
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
