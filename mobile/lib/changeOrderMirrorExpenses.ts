/**
 * Legacy: approved change orders used to inject synthetic “mirror” expense rows into
 * Materials/Equipment and Labor so category totals looked like cash was spent. That
 * conflated **client approval** with **actual vendor payments**.
 *
 * Today we **do not** add mirror rows or move bucket `spent` for COs. Category “Total spent”
 * and bucket totals come only from real expenses (`addExpense`). Approved COs still affect
 * contract `budgeted`, timeline payment milestones, and tax/financial summaries via
 * `changeOrders` — not via fake expense lines.
 *
 * This helper only **removes** any legacy mirror rows and backs their amounts out of
 * `buckets` / project `spent` when present.
 */

export const CO_MIRROR_EXPENSE_ID_PREFIX = 'bps-co-mirror:';

export function isChangeOrderMirrorExpenseId(id: unknown): boolean {
  return String(id ?? '').startsWith(CO_MIRROR_EXPENSE_ID_PREFIX);
}

/** Recover change order id from mirror expense id (`bps-co-mirror:<coId>:labor` / `:materials` / `:amount`). */
export function parseChangeOrderIdFromMirrorExpenseId(id: unknown): string | null {
  const s = String(id ?? '');
  if (!isChangeOrderMirrorExpenseId(s)) return null;
  const rest = s.slice(CO_MIRROR_EXPENSE_ID_PREFIX.length);
  const last = rest.lastIndexOf(':');
  if (last <= 0) return null;
  const coId = rest.slice(0, last).trim();
  return coId || null;
}

function sumMirrorMatLab(expenses: any[] | undefined): { mat: number; lab: number; total: number } {
  let mat = 0;
  let lab = 0;
  for (const e of expenses || []) {
    if (!isChangeOrderMirrorExpenseId(e?.id)) continue;
    const c = String(e.category ?? '').toLowerCase();
    const a = Number(e.amount) || 0;
    if (c.includes('materials') || c.includes('equipment')) mat += a;
    else if (c.includes('labor') || c.includes('labour')) lab += a;
  }
  return { mat, lab, total: mat + lab };
}

/**
 * Strip legacy mirror expense rows and reverse their effect on bucket `spent` / project `spent`.
 * Does **not** create new mirror lines — real material/labor hits the budget when users add expenses.
 */
export function reconcileChangeOrderMirrorExpenses<T extends {
  expenses?: any[];
  buckets?: any[];
  spent?: number;
  changeOrders?: any[];
}>(state: T): T {
  const prev = state;
  const baseExpenses = (prev.expenses || []).filter(
    (e: any) => !isChangeOrderMirrorExpenseId(e?.id)
  );

  const oldS = sumMirrorMatLab(prev.expenses);
  const newS = { mat: 0, lab: 0, total: 0 };
  const dMat = newS.mat - oldS.mat;
  const dLab = newS.lab - oldS.lab;
  const dTotal = newS.total - oldS.total;

  const updatedBuckets = (prev.buckets || []).map((bucket: any) => {
    let add = 0;
    const bucketName = String(bucket.name || '').toLowerCase();

    if (dMat !== 0) {
      const isMaterialsBucket =
        bucketName.includes('materials') || bucketName.includes('equipment');
      const expenseCategory = 'materials/equipment';
      const isMaterialCategory =
        expenseCategory.includes('materials') ||
        expenseCategory.includes('equipment') ||
        [
          'tile',
          'drywall',
          'lumber',
          'concrete',
          'paint',
          'electrical',
          'plumbing',
          'hardware',
          'roofing',
          'insulation',
          'flooring',
          'cabinets',
          'appliances',
          'windows',
          'doors',
          'siding',
          'decking',
          'fencing',
          'landscaping',
        ].includes(expenseCategory);
      if (isMaterialsBucket && isMaterialCategory) add += dMat;
    }

    if (dLab !== 0) {
      const isLaborBucket = bucketName.includes('labor');
      const expenseCategory = 'labor';
      const isLaborCategory =
        expenseCategory.includes('labor') ||
        expenseCategory.includes('labour') ||
        expenseCategory === 'subs' ||
        expenseCategory.includes('subcontract') ||
        expenseCategory.includes('crew');
      if (isLaborBucket && isLaborCategory) add += dLab;
    }

    if (add === 0) return bucket;
    return {
      ...bucket,
      spent: Math.max(0, (Number(bucket.spent) || 0) + add),
    };
  });

  return {
    ...prev,
    expenses: baseExpenses,
    buckets: updatedBuckets,
    spent: Math.max(0, (Number(prev.spent) || 0) + dTotal),
  };
}
