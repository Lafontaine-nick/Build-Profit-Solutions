import type { ScopeActualComparison } from '@/utils/estimateFeedback';

export type RateInsightExpense = {
  id: string;
  label: string;
  amount: number;
};

export type RateInsightLineItem = {
  id: string;
  name: string;
  categoryKey: 'materials' | 'labor' | 'other';
  quantity?: number | null;
  unit?: string | null;
  unitRate?: number | null;
  estimatedTotal: number;
  loggedTotal: number;
  expenses: RateInsightExpense[];
  variancePct?: number | null;
};

export type RateInsightSection = {
  key: string;
  title: string;
  lineItems: RateInsightLineItem[];
  unlinkedExpenses: RateInsightExpense[];
  estimatedTotal: number;
  loggedTotal: number;
};

type ExpenseInput = {
  id: string;
  category?: string;
  description?: string;
  vendor?: string;
  amount?: number;
  linkedLineId?: string;
};

type EstimateLineInput = Record<string, unknown>;

function positive(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function expenseLabel(expense: ExpenseInput): string {
  return String(expense.vendor || expense.description || expense.category || 'Expense').trim();
}

export function isMaterialsCategory(category?: string): boolean {
  const c = normalizeText(category);
  return c.includes('material') || c.includes('equipment');
}

export function isLaborCategory(category?: string): boolean {
  const c = normalizeText(category);
  return (
    c.includes('labor') ||
    c.includes('labour') ||
    c.includes('subcontract') ||
    c.includes('crew') ||
    c === 'subs'
  );
}

function categoryKeyForLine(category?: string): 'materials' | 'labor' | 'other' {
  if (isMaterialsCategory(category)) return 'materials';
  if (isLaborCategory(category)) return 'labor';
  return 'other';
}

function categoryKeyForExpense(expense: ExpenseInput): 'materials' | 'labor' | 'other' | null {
  if (expense.linkedLineId) return null;
  const c = normalizeText(expense.category);
  if (isMaterialsCategory(c)) return 'materials';
  if (isLaborCategory(c)) return 'labor';
  return 'other';
}

function parseEstimateLine(
  item: EstimateLineInput,
  categoryKey: 'materials' | 'labor',
  index: number
): RateInsightLineItem | null {
  const id = String(item.id || `${categoryKey}-${index}`);
  const name = String(item.name || item.description || item.scopeName || 'Line item').trim();
  const quantity = positive(item.qty) ?? positive(item.quantity);
  const unit = item.unit != null ? String(item.unit) : null;
  const unitRate = positive(item.unitPrice) ?? positive(item.unitCost) ?? positive(item.rate);
  const estimatedTotal =
    positive(item.total) ??
    (quantity != null && unitRate != null ? roundMoney(quantity * unitRate) : unitRate) ??
    0;
  if (estimatedTotal <= 0 && !name) return null;

  return {
    id,
    name,
    categoryKey,
    quantity,
    unit,
    unitRate,
    estimatedTotal: roundMoney(estimatedTotal),
    loggedTotal: 0,
    expenses: [],
    variancePct: null,
  };
}

function finalizeLineItem(line: RateInsightLineItem): RateInsightLineItem {
  const loggedTotal = roundMoney(line.expenses.reduce((sum, e) => sum + e.amount, 0));
  let variancePct: number | null = null;
  if (line.estimatedTotal > 0 && loggedTotal > 0) {
    variancePct = roundMoney(((loggedTotal - line.estimatedTotal) / line.estimatedTotal) * 100);
  }
  return { ...line, loggedTotal, variancePct };
}

function sectionTitle(key: 'materials' | 'labor' | 'other'): string {
  if (key === 'materials') return 'Materials & equipment';
  if (key === 'labor') return 'Labor';
  return 'Other costs';
}

function buildSection(
  key: 'materials' | 'labor' | 'other',
  lineItems: RateInsightLineItem[],
  unlinkedExpenses: RateInsightExpense[]
): RateInsightSection | null {
  const finalized = lineItems.map(finalizeLineItem);
  const unlinkedTotal = roundMoney(unlinkedExpenses.reduce((sum, e) => sum + e.amount, 0));
  const estimatedTotal = roundMoney(finalized.reduce((sum, line) => sum + line.estimatedTotal, 0));
  const loggedTotal = roundMoney(
    finalized.reduce((sum, line) => sum + line.loggedTotal, 0) + unlinkedTotal
  );
  if (!finalized.length && !unlinkedExpenses.length) return null;
  return {
    key,
    title: sectionTitle(key),
    lineItems: finalized,
    unlinkedExpenses,
    estimatedTotal,
    loggedTotal,
  };
}

function comparisonsToSections(
  comparisons: ScopeActualComparison[],
  expenses: ExpenseInput[] = []
): RateInsightSection[] {
  const byCategory = new Map<'materials' | 'labor' | 'other', RateInsightLineItem[]>();
  const linkedExpenseIds = new Set<string>();

  for (const comparison of comparisons) {
    const category = String(
      comparison.estimateItem.trade || comparison.estimateItem.name || 'other'
    );
    const categoryKey = categoryKeyForLine(category);
    const estimatedTotal = comparison.estimatedDirectCost ?? 0;
    const actualTotal = comparison.actualDirectCost ?? 0;
    if (estimatedTotal <= 0 && actualTotal <= 0) continue;

    const unit = comparison.estimateItem.unit != null ? String(comparison.estimateItem.unit) : null;
    const line: RateInsightLineItem = {
      id: comparison.scopeItemKey,
      name: String(comparison.estimateItem.description || comparison.estimateItem.name || category),
      categoryKey,
      quantity: comparison.estimatedQuantity,
      unit,
      unitRate: unit === 'lump_sum' ? null : comparison.estimatedEffectiveRate,
      estimatedTotal: roundMoney(estimatedTotal),
      loggedTotal: roundMoney(actualTotal),
      expenses: [],
      variancePct: comparison.costVariancePercent,
    };
    const list = byCategory.get(categoryKey) || [];
    list.push(line);
    byCategory.set(categoryKey, list);
  }

  const unlinked: Record<'materials' | 'labor' | 'other', RateInsightExpense[]> = {
    materials: [],
    labor: [],
    other: [],
  };

  for (const expense of expenses) {
    const amount = positive(expense.amount);
    if (amount == null) continue;
    const row: RateInsightExpense = {
      id: String(expense.id),
      label: expenseLabel(expense),
      amount: roundMoney(amount),
    };
    if (expense.linkedLineId) {
      linkedExpenseIds.add(row.id);
      let attached = false;
      for (const lines of byCategory.values()) {
        const line = lines.find((item) => item.id === String(expense.linkedLineId));
        if (line) {
          line.expenses.push(row);
          attached = true;
          break;
        }
      }
      if (attached) continue;
    }
    const bucket = categoryKeyForExpense(expense);
    if (bucket) unlinked[bucket].push(row);
  }

  return (['materials', 'labor', 'other'] as const)
    .map((key) => buildSection(key, byCategory.get(key) || [], unlinked[key]))
    .filter((section): section is RateInsightSection => section != null);
}

export function buildRateInsightSections(input: {
  estimateData?: Record<string, unknown> | null;
  expenses?: ExpenseInput[];
  scopeComparisons?: ScopeActualComparison[];
}): RateInsightSection[] {
  const estimateData = input.estimateData || {};
  const expenses = input.expenses || [];
  const materialLines = (estimateData.materialLineItems as EstimateLineInput[] | undefined) || [];
  const laborLines = (estimateData.laborLineItems as EstimateLineInput[] | undefined) || [];

  const hasEstimateLines = materialLines.length > 0 || laborLines.length > 0;
  if (!hasEstimateLines) {
    return comparisonsToSections(input.scopeComparisons || [], expenses);
  }

  const lineById = new Map<string, RateInsightLineItem>();
  const sections: Record<'materials' | 'labor' | 'other', RateInsightLineItem[]> = {
    materials: [],
    labor: [],
    other: [],
  };

  materialLines.forEach((item, index) => {
    const line = parseEstimateLine(item, 'materials', index);
    if (!line) return;
    sections.materials.push(line);
    lineById.set(line.id, line);
  });
  laborLines.forEach((item, index) => {
    const line = parseEstimateLine(item, 'labor', index);
    if (!line) return;
    sections.labor.push(line);
    lineById.set(line.id, line);
  });

  const unlinked: Record<'materials' | 'labor' | 'other', RateInsightExpense[]> = {
    materials: [],
    labor: [],
    other: [],
  };

  for (const expense of expenses) {
    const amount = positive(expense.amount);
    if (amount == null) continue;
    const row: RateInsightExpense = {
      id: String(expense.id),
      label: expenseLabel(expense),
      amount: roundMoney(amount),
    };
    const linkedId = expense.linkedLineId ? String(expense.linkedLineId) : null;
    if (linkedId && lineById.has(linkedId)) {
      lineById.get(linkedId)!.expenses.push(row);
      continue;
    }
    const bucket = categoryKeyForExpense(expense);
    if (bucket) unlinked[bucket].push(row);
  }

  return (['materials', 'labor', 'other'] as const)
    .map((key) => buildSection(key, sections[key], unlinked[key]))
    .filter((section): section is RateInsightSection => section != null);
}

export function countRateInsightRows(sections: RateInsightSection[]): number {
  return sections.reduce(
    (sum, section) => sum + section.lineItems.length + section.unlinkedExpenses.length,
    0
  );
}

export function formatRateInsightUnitRate(
  unitRate: number | null | undefined,
  unit: string | null | undefined
): string {
  if (unitRate == null || !Number.isFinite(unitRate)) return '—';
  const u = unit && unit !== 'lump_sum' ? unit : 'unit';
  return `$${unitRate}/${u}`;
}

export function formatRateInsightLineEstimate(line: RateInsightLineItem): string {
  if (line.quantity != null && line.unitRate != null && line.unit && line.unit !== 'lump_sum') {
    return `${line.quantity} ${line.unit} @ ${formatRateInsightUnitRate(line.unitRate, line.unit)}`;
  }
  return formatRateInsightUnitRate(line.unitRate, line.unit);
}
