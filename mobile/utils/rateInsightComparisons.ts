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
  /** True when this row is a category cost-budget total, not a named estimate line. */
  budgetOnly?: boolean;
};

export type RateInsightSpendStatus = 'none' | 'on_track' | 'over';

export type RateInsightSection = {
  key: string;
  title: string;
  lineItems: RateInsightLineItem[];
  unlinkedExpenses: RateInsightExpense[];
  estimatedTotal: number;
  loggedTotal: number;
  /** Section only has a category allowance — no itemized estimate lines on this project. */
  budgetOnly?: boolean;
};

type ExpenseInput = {
  id: string;
  category?: string;
  description?: string;
  material?: string;
  vendor?: string;
  amount?: number;
  linkedLineId?: string;
};

/** Normalize a stored project expense for line matching / rate insights. */
export function normalizeExpenseForMatching(expense: Record<string, unknown>): ExpenseInput {
  const material = expense.material != null ? String(expense.material) : undefined;
  const notes = expense.notes != null ? String(expense.notes) : undefined;
  const description =
    expense.description != null
      ? String(expense.description)
      : notes ?? material;

  return {
    id: String(expense.id),
    category: expense.category != null ? String(expense.category) : undefined,
    description,
    material,
    vendor: expense.vendor != null ? String(expense.vendor) : undefined,
    amount: expense.amount != null ? Number(expense.amount) : undefined,
    linkedLineId: expense.linkedLineId != null ? String(expense.linkedLineId) : undefined,
  };
}

/** Minimum confidence score to auto-attach an expense to an estimate line. */
export const RATE_INSIGHT_AUTO_MATCH_MIN_SCORE = 35;

/** Two top candidates must differ by at least this much or we leave the expense unlinked. */
const AUTO_MATCH_AMBIGUITY_GAP = 10;

const MATCH_STOP_WORDS = new Set([
  'materials',
  'material',
  'labor',
  'labour',
  'equipment',
  'installation',
  'install',
  'the',
  'and',
  'for',
  'other',
  'cost',
  'costs',
  'expense',
  'job',
  'work',
]);

/** Line-name tokens that are too generic for synonym-only matching. */
const AMBIGUOUS_LINE_TOKENS = new Set([
  'walls',
  'wall',
  'floor',
  'ceiling',
  'prep',
  'interior',
  'exterior',
  'room',
  'area',
]);

/**
 * Narrow aliases — never cross unrelated trades (e.g. drywall ≠ paint walls).
 * Synonyms only apply when the line token is not ambiguous.
 */
const TOKEN_ALIASES: Record<string, string[]> = {
  drywall: ['sheetrock', 'gypsum'],
  sheetrock: ['drywall', 'gypsum'],
  gypsum: ['drywall', 'sheetrock'],
  paint: ['painting', 'painter', 'coating'],
  painting: ['paint', 'painter'],
  cabinets: ['cabinet', 'cabinetry', 'vanity'],
  cabinet: ['cabinets', 'cabinetry'],
  baseboards: ['trim', 'molding', 'moulding', 'casing'],
  trim: ['baseboards', 'molding', 'moulding', 'casing'],
  molding: ['baseboards', 'trim', 'moulding'],
  doors: ['door', 'frame', 'frames'],
  door: ['doors', 'frames'],
  exterior: ['ext', 'outside', 'outdoor'],
  interior: ['int', 'inside'],
  tile: ['tiling', 'flooring'],
  flooring: ['floor', 'tile'],
  cleanup: ['disposal', 'haul', 'debris'],
  disposal: ['cleanup', 'haul', 'debris'],
  prep: ['preparation', 'masking'],
  masking: ['prep', 'tape'],
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
  return String(
    expense.vendor || expense.material || expense.description || expense.category || 'Expense'
  ).trim();
}

function lineDisplayName(name: string): string {
  const parts = String(name || '').split(/\s*[—–-]\s*/);
  return (parts[0] || name).trim();
}

function significantTokens(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of normalizeText(text).split(' ')) {
    if (token.length < 3 || MATCH_STOP_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function tokensEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true;
  const aliasesA = TOKEN_ALIASES[a] || [];
  const aliasesB = TOKEN_ALIASES[b] || [];
  return aliasesA.includes(b) || aliasesB.includes(a);
}

function haystackTokenSet(haystack: string): Set<string> {
  return new Set(normalizeText(haystack).split(' ').filter((token) => token.length >= 2));
}

function haystackContainsLineToken(haystack: string, lineToken: string): boolean {
  const tokens = haystackTokenSet(haystack);
  if (tokens.has(lineToken)) return true;
  if (lineToken === 'walls' && tokens.has('wall')) return true;
  if (lineToken === 'wall' && tokens.has('walls')) return true;
  return false;
}

function expenseHaystack(expense: ExpenseInput): string {
  return normalizeText(
    `${expense.vendor || ''} ${expense.material || ''} ${expense.description || ''} ${expense.category || ''}`
  );
}

/** Score how well an expense text matches an estimate line name (higher = more confident). */
export function scoreExpenseLineMatch(expense: ExpenseInput, line: RateInsightLineItem): number {
  const haystack = expenseHaystack(expense);
  if (!haystack) return 0;

  const displayName = lineDisplayName(line.name);
  const lineNorm = normalizeText(displayName);
  const lineTokens = significantTokens(displayName);
  const expenseTokens = significantTokens(haystack);

  let score = 0;

  if (lineNorm.length >= 4 && haystack.includes(lineNorm)) {
    score += 100;
  }

  for (const lineToken of lineTokens) {
    if (haystackContainsLineToken(haystack, lineToken)) {
      score += 40;
    }

    for (const expenseToken of expenseTokens) {
      if (lineToken === expenseToken) {
        score += 45;
        continue;
      }

      if (AMBIGUOUS_LINE_TOKENS.has(lineToken)) {
        continue;
      }

      if (tokensEquivalent(lineToken, expenseToken)) {
        score += 35;
      }
    }
  }

  return score;
}

function attachExpensesToLines(
  lines: RateInsightLineItem[],
  expenses: ExpenseInput[],
  sectionKey: 'materials' | 'labor' | 'other'
): RateInsightExpense[] {
  const unlinked: RateInsightExpense[] = [];
  const matchableLines = lines.filter((line) => !line.budgetOnly);

  for (const expense of expenses) {
    const amount = positive(expense.amount);
    if (amount == null) continue;

    const bucket = categoryKeyForExpense(expense);
    if (bucket !== sectionKey) continue;

    const row: RateInsightExpense = {
      id: String(expense.id),
      label: expenseLabel(expense),
      amount: roundMoney(amount),
    };

    const linkedId = expense.linkedLineId ? String(expense.linkedLineId) : null;
    if (linkedId) {
      const explicit = matchableLines.find((line) => line.id === linkedId);
      if (explicit) {
        explicit.expenses.push(row);
        continue;
      }
    }

    const candidates = matchableLines.filter((line) => line.categoryKey === bucket);
    if (!candidates.length) {
      unlinked.push(row);
      continue;
    }

    const ranked = candidates
      .map((line) => ({ line, score: scoreExpenseLineMatch(expense, line) }))
      .filter((entry) => entry.score >= RATE_INSIGHT_AUTO_MATCH_MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) {
      unlinked.push(row);
      continue;
    }

    if (ranked.length > 1 && ranked[0].score - ranked[1].score < AUTO_MATCH_AMBIGUITY_GAP) {
      unlinked.push(row);
      continue;
    }

    ranked[0].line.expenses.push(row);
  }

  return unlinked;
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
  const c = normalizeText(expense.category);
  if (isMaterialsCategory(c)) return 'materials';
  if (isLaborCategory(c)) return 'labor';
  if (c) return 'other';
  return null;
}

function roundRate(n: number): number {
  if (n >= 100) return Math.round(n * 10) / 10;
  if (n >= 10) return Math.round(n * 100) / 100;
  return Math.round(n * 1000) / 1000;
}

function resolveLinePricing(
  item: EstimateLineInput,
  estimatedTotal: number,
  quantity: number | null
): { unitRate: number | null; unit: string | null } {
  const unit = item.unit != null ? String(item.unit) : null;
  let unitRate = positive(item.unitPrice) ?? positive(item.unitCost) ?? positive(item.rate);

  if (estimatedTotal > 0 && quantity != null && quantity > 0) {
    const derived = roundRate(estimatedTotal / quantity);
    if (unitRate == null) {
      unitRate = derived;
    } else {
      const fromStored = roundMoney(unitRate * quantity);
      const tolerance = Math.max(0.5, estimatedTotal * 0.02);
      const storedLooksLikeLumpTotal = Math.abs(unitRate - estimatedTotal) <= tolerance;
      const storedDoesNotReconcile = Math.abs(fromStored - estimatedTotal) > tolerance;
      if (storedLooksLikeLumpTotal || storedDoesNotReconcile) {
        unitRate = derived;
      }
    }
  }

  return { unitRate, unit };
}

function parseEstimateLine(
  item: EstimateLineInput,
  categoryKey: 'materials' | 'labor',
  index: number
): RateInsightLineItem | null {
  const id = String(item.id || `${categoryKey}-${index}`);
  const name = String(item.name || item.description || item.scopeName || 'Line item').trim();
  const quantity = positive(item.qty) ?? positive(item.quantity);
  const estimatedTotal =
    positive(item.total) ??
    (() => {
      const rate = positive(item.unitPrice) ?? positive(item.unitCost) ?? positive(item.rate);
      return quantity != null && rate != null ? roundMoney(quantity * rate) : rate;
    })() ??
    0;
  if (estimatedTotal <= 0 && !name) return null;

  const { unitRate, unit } = resolveLinePricing(item, estimatedTotal, quantity);

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
  const budgetOnly =
    finalized.length === 1 && finalized.every((line) => line.budgetOnly);
  return {
    key,
    title: sectionTitle(key),
    lineItems: budgetOnly ? [] : finalized,
    unlinkedExpenses,
    estimatedTotal,
    loggedTotal,
    budgetOnly,
  };
}

/** Estimate snapshot lives on the project root — not only under projectData. */
export function resolveProjectEstimateData(
  projectLike: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!projectLike) return {};
  const projectData = (projectLike.projectData as Record<string, unknown> | undefined) || {};
  const fromBid = (projectLike.bid as Record<string, unknown> | undefined) || {};
  const fromNested = (projectData.estimateData as Record<string, unknown> | undefined) || {};
  const fromRoot = (projectLike.estimateData as Record<string, unknown> | undefined) || {};
  return { ...fromBid, ...fromNested, ...fromRoot };
}

function proposalLinesToEstimateLines(estimateData: Record<string, unknown>): {
  materials: EstimateLineInput[];
  labor: EstimateLineInput[];
} {
  const lines = (estimateData.lines as EstimateLineInput[] | undefined) || [];
  const materials: EstimateLineInput[] = [];
  const labor: EstimateLineInput[] = [];
  for (const line of lines) {
    const lineType = normalizeText(line.lineType);
    const target =
      lineType === 'labor' ? labor : lineType === 'material' ? materials : null;
    if (!target) continue;
    target.push({
      id: line.id || `${lineType}-${target.length}`,
      name: line.label || line.packageName || line.scopeName,
      description: line.label,
      qty: line.quantity,
      unit: line.unitType || line.unit,
      unitPrice: line.unitRate,
      total: line.total,
    });
  }
  return { materials, labor };
}

export function collectEstimateLineItems(estimateData: Record<string, unknown> | null | undefined): {
  materialLines: EstimateLineInput[];
  laborLines: EstimateLineInput[];
} {
  const data = estimateData || {};
  let materialLines = (data.materialLineItems as EstimateLineInput[] | undefined) || [];
  let laborLines = (data.laborLineItems as EstimateLineInput[] | undefined) || [];

  if (!materialLines.length && !laborLines.length) {
    const fromProposal = proposalLinesToEstimateLines(data);
    materialLines = fromProposal.materials;
    laborLines = fromProposal.labor;
  }

  return { materialLines, laborLines };
}

function comparisonsToSections(
  comparisons: ScopeActualComparison[],
  expenses: ExpenseInput[] = []
): RateInsightSection[] {
  const byCategory = new Map<'materials' | 'labor' | 'other', RateInsightLineItem[]>();

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
      budgetOnly: unit === 'lump_sum' || unit === 'lump sum',
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

  for (const key of ['materials', 'labor', 'other'] as const) {
    const lines = byCategory.get(key) || [];
    unlinked[key] = attachExpensesToLines(lines, expenses, key);
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
  const { materialLines, laborLines } = collectEstimateLineItems(estimateData);

  const hasEstimateLines = materialLines.length > 0 || laborLines.length > 0;
  if (!hasEstimateLines) {
    return comparisonsToSections(input.scopeComparisons || [], expenses);
  }

  const sections: Record<'materials' | 'labor' | 'other', RateInsightLineItem[]> = {
    materials: [],
    labor: [],
    other: [],
  };

  materialLines.forEach((item, index) => {
    const line = parseEstimateLine(item, 'materials', index);
    if (!line) return;
    sections.materials.push(line);
  });
  laborLines.forEach((item, index) => {
    const line = parseEstimateLine(item, 'labor', index);
    if (!line) return;
    sections.labor.push(line);
  });

  const unlinked: Record<'materials' | 'labor' | 'other', RateInsightExpense[]> = {
    materials: attachExpensesToLines(sections.materials, expenses, 'materials'),
    labor: attachExpensesToLines(sections.labor, expenses, 'labor'),
    other: attachExpensesToLines(sections.other, expenses, 'other'),
  };

  return (['materials', 'labor', 'other'] as const)
    .map((key) => buildSection(key, sections[key], unlinked[key]))
    .filter((section): section is RateInsightSection => section != null);
}

/** Logged spend per estimate line id (linked + auto-matched expenses). */
export function getEstimateLineLoggedSpendMap(input: {
  estimateData?: Record<string, unknown> | null;
  expenses?: ExpenseInput[];
  kind: 'materials' | 'labor';
  excludeExpenseId?: string | null;
}): Record<string, number> {
  const summaries = getEstimateLineSpendSummaries(input);
  const map: Record<string, number> = {};
  for (const [id, summary] of Object.entries(summaries)) {
    if (summary.loggedTotal > 0) {
      map[id] = summary.loggedTotal;
    }
  }
  return map;
}

export type EstimateLineBudgetBadge = 'over';

export type EstimateLineSpendSummary = {
  loggedTotal: number;
  budget: number;
  /** Budget minus logged; negative when over. */
  remaining: number;
  variancePct: number | null;
  badge: EstimateLineBudgetBadge | null;
};

/** Badge when spend exceeds the estimate line budget. */
export function getEstimateLineBudgetBadge(
  logged: number,
  budget: number
): EstimateLineBudgetBadge | null {
  if (budget <= 0 || logged <= budget) return null;
  return 'over';
}

function filterExpensesForSpend(
  expenses: ExpenseInput[] | undefined,
  excludeExpenseId?: string | null
): ExpenseInput[] {
  return (expenses || []).filter((e) => !excludeExpenseId || e.id !== excludeExpenseId);
}

function summarizeLine(line: RateInsightLineItem): EstimateLineSpendSummary {
  const budget = line.estimatedTotal;
  const loggedTotal = line.loggedTotal;
  const remaining = budget > 0 ? roundMoney(budget - loggedTotal) : 0;
  return {
    loggedTotal,
    budget,
    remaining,
    variancePct: line.variancePct ?? null,
    badge: getEstimateLineBudgetBadge(loggedTotal, budget),
  };
}

/** Per-line spend, remaining budget, and overrun badges for estimate pickers. */
export function getEstimateLineSpendSummaries(input: {
  estimateData?: Record<string, unknown> | null;
  expenses?: ExpenseInput[];
  kind: 'materials' | 'labor';
  excludeExpenseId?: string | null;
}): Record<string, EstimateLineSpendSummary> {
  const expenses = filterExpensesForSpend(input.expenses, input.excludeExpenseId);
  const sections = buildRateInsightSections({
    estimateData: input.estimateData,
    expenses,
  });
  const section = sections.find((s) => s.key === input.kind);
  const map: Record<string, EstimateLineSpendSummary> = {};
  for (const line of section?.lineItems ?? []) {
    map[line.id] = summarizeLine(line);
  }
  return map;
}

/** Expenses in this category that are not linked or auto-matched to a line. */
export function getUnlinkedExpensesForKind(input: {
  estimateData?: Record<string, unknown> | null;
  expenses?: ExpenseInput[];
  kind: 'materials' | 'labor';
  excludeExpenseId?: string | null;
}): RateInsightExpense[] {
  const expenses = filterExpensesForSpend(input.expenses, input.excludeExpenseId);
  const sections = buildRateInsightSections({
    estimateData: input.estimateData,
    expenses,
  });
  return sections.find((s) => s.key === input.kind)?.unlinkedExpenses ?? [];
}

export function sortEstimateLineOptions<T extends { id: string; name: string }>(
  lines: T[],
  spendSummaries: Record<string, EstimateLineSpendSummary>
): T[] {
  const score = (id: string) => {
    const s = spendSummaries[id];
    if (!s) return 0;
    if (s.loggedTotal > 0 && s.remaining < 0) return 3;
    if (s.loggedTotal > 0) return 2;
    return 1;
  };
  return [...lines].sort((a, b) => {
    const diff = score(b.id) - score(a.id);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

/** Expenses on a project root or nested `projectData`. */
export function resolveProjectExpenses(
  projectLike: Record<string, unknown> | null | undefined
): ExpenseInput[] {
  if (!projectLike) return [];
  const nested = (projectLike.projectData as Record<string, unknown> | undefined)?.expenses;
  const raw = Array.isArray(projectLike.expenses)
    ? projectLike.expenses
    : Array.isArray(nested)
      ? nested
      : [];
  return (raw as Record<string, unknown>[]).map(normalizeExpenseForMatching);
}

export function getRateInsightSpendStatus(line: RateInsightLineItem): RateInsightSpendStatus {
  if (line.loggedTotal <= 0) return 'none';
  if (line.estimatedTotal <= 0) return 'on_track';
  if (line.loggedTotal <= line.estimatedTotal) return 'on_track';
  return 'over';
}

export function formatRateInsightLoggedLabel(line: RateInsightLineItem): string | null {
  if (line.loggedTotal <= 0) return null;
  const status = getRateInsightSpendStatus(line);
  const variance = formatRateInsightVariancePct(line);
  if (status === 'on_track') {
    return variance ? `On budget (${variance})` : 'On budget';
  }
  return variance ? `${variance} over estimate` : 'Over estimate';
}

function formatRateInsightVariancePct(line: RateInsightLineItem): string | null {
  if (line.variancePct == null || !Number.isFinite(line.variancePct)) return null;
  const pct = line.variancePct;
  return `${pct > 0 ? '+' : ''}${pct}%`;
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
  const display =
    unitRate >= 100 ? unitRate.toFixed(1) : unitRate >= 10 ? unitRate.toFixed(2) : unitRate.toFixed(2);
  return `$${display}/${u}`;
}

export function formatRateInsightLineEstimate(line: RateInsightLineItem): string | null {
  if (line.budgetOnly) return null;
  if (line.quantity != null && line.unitRate != null && line.unit && line.unit !== 'lump_sum') {
    return `${line.quantity} ${line.unit} @ ${formatRateInsightUnitRate(line.unitRate, line.unit)}`;
  }
  if (line.unitRate != null && line.unit && line.unit !== 'lump_sum') {
    return formatRateInsightUnitRate(line.unitRate, line.unit);
  }
  return null;
}

export function formatCategoryBudgetExplanation(sectionKey: 'materials' | 'labor' | 'other'): string {
  if (sectionKey === 'materials') {
    return 'Cost budget your bid set aside for materials & equipment (before markup). Log expenses below to compare.';
  }
  if (sectionKey === 'labor') {
    return 'Cost budget your bid set aside for labor (before markup). Log expenses below to compare.';
  }
  return 'Cost budget allowance from your bid. Log expenses below to compare.';
}
