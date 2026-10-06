/**
 * Cost vs revenue for project budgeting.
 * Contract / sell price (grandTotal, bid) is revenue; spend tracking uses planned cost + allocated CO cost.
 * Planned cost matches the estimate: hard costs + soft costs + contingency + project overhead.
 */

import { formatMoneyFull } from '@/src/lib/budgetUtils';
import {
  getBidOverheadLineItemsTotal,
  getBidSoftCostTotal,
  isCompanyOverheadCategory,
} from '@/utils/estimateAllowances';

const safeNum = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const toPositiveNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const numeric =
    typeof value === 'string'
      ? Number(String(value).replace(/[$,\s]/g, ''))
      : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const firstPositiveNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const resolved = toPositiveNumber(value);
    if (resolved !== null) return resolved;
  }
  return null;
};

/**
 * Merge change orders from every persisted shape (same sources as Projects / Dashboard),
 * then dedupe by id or title+amount signature.
 */
export function collectUniqueChangeOrders(project: any): any[] {
  const sources = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
    project?.estimateData?.changeOrders,
    (project as any)?.rawProject?.projectData?.changeOrders,
    (project as any)?.rawProject?.changeOrders,
    (project as any)?.rawProject?.estimateData?.changeOrders,
  ];
  const collected: any[] = [];
  for (const s of sources) {
    if (Array.isArray(s) && s.length > 0) collected.push(...s);
  }
  if (collected.length === 0) return [];
  const seen = new Set<string>();
  return collected.filter((co: any) => {
    const key =
      co?.id != null
        ? `id:${String(co.id)}`
        : `sig:${String(co?.title || '')}:${String(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coalesceChangeOrders(project: any): any[] {
  return collectUniqueChangeOrders(project);
}

export function isApprovedChangeOrder(co: any): boolean {
  const a = co?.approved;
  if (a === true || a === 1 || String(a).toLowerCase() === 'true') return true;
  const st = String(co?.status || '').toLowerCase();
  return st === 'approved';
}

function roundChangeOrderMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Bid markup percent (20 means 20%). Company overhead is separate and is not added here. */
export function bidMarkupPercent(project: any): number {
  const ed = project?.estimateData || project?.projectData?.estimateData || {};
  const raw = Number(ed?.markupPct ?? project?.markupPct);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 10) / 10;
}

export function changeOrderDirectCost(materialsAmount: unknown, laborAmount: unknown): number {
  const mat = Number(materialsAmount);
  const lab = Number(laborAmount);
  return roundChangeOrderMoney((Number.isFinite(mat) ? Math.max(0, mat) : 0) + (Number.isFinite(lab) ? Math.max(0, lab) : 0));
}

/** Blank or 0 means the entered material and labor price already includes markup. */
export function changeOrderMarkupPercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 10) / 10;
}

/** Client price. Markup is profit on top of material and labor cost. */
export function changeOrderClientPrice(cost: number, markupPct: unknown): number {
  const base = Math.max(0, Number(cost) || 0);
  if (!(base > 0)) return 0;
  const pct = changeOrderMarkupPercent(markupPct);
  return roundChangeOrderMoney(base * (1 + pct / 100));
}

function resolveApprovedChangeOrderRevenue(co: any, fallbackMarkupPct = 0): number {
  const clientPrice = safeNum(co?.clientPrice ?? 0);
  if (clientPrice > 0) return clientPrice;

  const amount = safeNum(co?.amount ?? 0);
  const mat = co?.materialsAmount != null ? Number(co.materialsAmount) : NaN;
  const lab = co?.laborAmount != null ? Number(co.laborAmount) : NaN;
  const explicitCost =
    (Number.isFinite(mat) ? mat : 0) + (Number.isFinite(lab) ? lab : 0);
  const markupPct = safeNum(co?.markupPct ?? fallbackMarkupPct);

  if (explicitCost > 0) {
    // When the stored total already covers the M+L breakdown, it is the client-facing add (same as
    // Projects list: sum of `amount`). Do not apply bid markup again — that produced e.g. $4k → $4.8k
    // when amount equaled materials+labor for a flat-priced CO.
    if (amount + 0.01 >= explicitCost) {
      return Math.max(amount, explicitCost);
    }
    if (markupPct > 0) return explicitCost * (1 + (markupPct / 100));
    return Math.max(amount, explicitCost);
  }

  return amount;
}

/** Client-facing change order total (sell dollars). */
export function sumApprovedChangeOrderRevenue(changeOrders: any[], fallbackMarkupPct = 0): number {
  return changeOrders.reduce((sum, co) => {
    if (!isApprovedChangeOrder(co)) return sum;
    const amount = resolveApprovedChangeOrderRevenue(co, fallbackMarkupPct);
    return sum + amount;
  }, 0);
}

export type ChangeOrderPaymentRow = {
  id: string;
  title: string;
  amount: number;
  dateRaw?: string;
};

export function changeOrderBudgetLineId(
  kind: 'materials' | 'labor',
  changeOrderId: string
): string {
  const prefix = kind === 'materials' ? 'bps-co-material-' : 'bps-co-labor-';
  return `${prefix}${changeOrderId}`;
}

export function isChangeOrderBudgetLineId(
  lineId: string | null | undefined,
  kind: 'materials' | 'labor'
): boolean {
  if (!lineId) return false;
  const prefix = kind === 'materials' ? 'bps-co-material-' : 'bps-co-labor-';
  return String(lineId).startsWith(prefix);
}

/** Change order id stored on a materials or labor budget line (`bps-co-material-…` / `bps-co-labor-…`). */
export function changeOrderIdFromBudgetLineId(lineId: string | null | undefined): string | null {
  const id = String(lineId || '');
  const materialPrefix = 'bps-co-material-';
  const laborPrefix = 'bps-co-labor-';
  if (id.startsWith(materialPrefix)) return id.slice(materialPrefix.length) || null;
  if (id.startsWith(laborPrefix)) return id.slice(laborPrefix.length) || null;
  return null;
}

export function isChangeOrderPaymentMilestoneReceived(milestone: {
  status?: unknown;
  collectedAt?: unknown;
} | null | undefined): boolean {
  const status = String(milestone?.status || '').toLowerCase();
  if (status === 'completed' || status === 'complete' || status === 'paid' || status === 'received') {
    return true;
  }
  return Boolean(milestone?.collectedAt);
}

/** Timeline payment row `bps-co-{changeOrderId}` has been marked Received. */
export function isChangeOrderPaymentReceivedInMilestones(
  milestones: Array<{ id?: unknown; status?: unknown; collectedAt?: unknown }> | null | undefined,
  changeOrderId: string
): boolean {
  const paymentId = `bps-co-${changeOrderId}`;
  return (milestones || []).some(
    (milestone) =>
      String(milestone?.id || '') === paymentId && isChangeOrderPaymentMilestoneReceived(milestone)
  );
}

const changeOrderNameKey = (raw: unknown) =>
  String(raw ?? "").toLowerCase().trim().replace(/\s+/g, " ");

/** True when another change order uses this title. The client price then belongs in the name. */
export function changeOrderTitleIsShared(orders: any[] | null | undefined, title: unknown): boolean {
  const key = changeOrderNameKey(title);
  if (!key) return false;
  let count = 0;
  for (const order of orders || []) {
    if (changeOrderNameKey(order?.title ?? order?.name) !== key) continue;
    count += 1;
    if (count > 1) return true;
  }
  return false;
}

/**
 * Title used on the change order, its materials line, its labor line, and its Timeline payment.
 * A repeated title keeps the client price so two Concrete orders stay the $1,700 order and the $1,200 order.
 */
export function changeOrderIdentityName(
  title: unknown,
  clientPrice: number,
  options?: { duplicate?: boolean }
): string {
  const name = String(title ?? "").trim() || "Change order";
  if (!options?.duplicate || !(clientPrice > 0)) return name;
  return `${name} · ${formatMoneyFull(clientPrice)}`;
}

export function changeOrderCardTitle(order: any, orders: any[] | null | undefined): string {
  const title = String(order?.title ?? order?.name ?? "").trim() || "Change order";
  const price = resolveApprovedChangeOrderRevenue(order, 0);
  return changeOrderIdentityName(title, price, {
    duplicate: changeOrderTitleIsShared(orders, title),
  });
}

/** Approved change-order cost, split so materials and labor can be spent against their own lines. */
export function approvedChangeOrderBudgetLines(
  project: any,
  kind: 'materials' | 'labor'
): Array<{ id: string; name: string; budget: number; clientPrice: number }> {
  const orders = collectUniqueChangeOrders(project);
  const lines: Array<{ id: string; name: string; budget: number; clientPrice: number }> = [];
  for (const co of orders) {
    if (!isApprovedChangeOrder(co)) continue;
    const raw = kind === 'materials' ? co?.materialsAmount : co?.laborAmount;
    const budget = Number(raw);
    if (!(budget > 0)) continue;
    const id = String(co?.id || '').trim();
    if (!id) continue;
    const clientPrice = resolveApprovedChangeOrderRevenue(co, 0);
    lines.push({
      id: changeOrderBudgetLineId(kind, id),
      name: changeOrderCardTitle(co, orders),
      budget,
      clientPrice,
    });
  }
  return lines;
}

function changeOrderSpendSummary(loggedTotal: number, budget: number) {
  const logged = Math.round(loggedTotal * 100) / 100;
  const remaining = Math.round((budget - logged) * 100) / 100;
  const over = (budget > 0 && logged > budget) || (budget <= 0 && logged > 0);
  return {
    loggedTotal: logged,
    budget,
    remaining,
    variancePct:
      budget > 0 && logged > 0
        ? Math.round(((logged - budget) / budget) * 10000) / 100
        : null,
    badge: over ? ('over' as const) : null,
  };
}

/** Spent and remaining for each approved change-order materials or labor line. */
export function changeOrderLineSpendSummaries(
  project: any,
  kind: 'materials' | 'labor',
  expenses: Array<{ linkedLineId?: string | null; amount?: number | null }> | undefined
): Record<string, { loggedTotal: number; budget: number; remaining: number; variancePct: number | null; badge: 'over' | null }> {
  const summaries: Record<string, { loggedTotal: number; budget: number; remaining: number; variancePct: number | null; badge: 'over' | null }> = {};
  const approvedIds = new Set<string>();
  for (const line of approvedChangeOrderBudgetLines(project, kind)) {
    approvedIds.add(line.id);
    let loggedTotal = 0;
    for (const expense of expenses || []) {
      if (String(expense?.linkedLineId || '') !== line.id) continue;
      const amount = Number(expense?.amount);
      if (Number.isFinite(amount)) loggedTotal += amount;
    }
    summaries[line.id] = changeOrderSpendSummary(loggedTotal, line.budget);
  }
  const orphanTotals = new Map<string, number>();
  for (const expense of expenses || []) {
    const lineId = String(expense?.linkedLineId || '');
    if (!isChangeOrderBudgetLineId(lineId, kind) || approvedIds.has(lineId)) continue;
    const amount = Number(expense?.amount);
    if (!Number.isFinite(amount) || !(amount > 0)) continue;
    orphanTotals.set(lineId, (orphanTotals.get(lineId) || 0) + amount);
  }
  for (const [lineId, loggedTotal] of orphanTotals) {
    summaries[lineId] = changeOrderSpendSummary(loggedTotal, 0);
  }
  return summaries;
}

/** Unspent materials and labor still left to bill on one approved change order. */
export function changeOrderUnspentBillAmounts(
  project: any,
  expenses: Array<{ linkedLineId?: string | null; amount?: number | null }> | undefined,
  changeOrderId: string
): { name: string; materialsRemaining: number; laborRemaining: number } | null {
  const id = String(changeOrderId || '').trim();
  if (!id) return null;
  const materialsLine = approvedChangeOrderBudgetLines(project, 'materials').find(
    (line) => changeOrderIdFromBudgetLineId(line.id) === id
  );
  const laborLine = approvedChangeOrderBudgetLines(project, 'labor').find(
    (line) => changeOrderIdFromBudgetLineId(line.id) === id
  );
  const materialsSpend = changeOrderLineSpendSummaries(project, 'materials', expenses);
  const laborSpend = changeOrderLineSpendSummaries(project, 'labor', expenses);
  const materialsRemaining = materialsLine
    ? Math.max(0, materialsSpend[materialsLine.id]?.remaining ?? materialsLine.budget)
    : 0;
  const laborRemaining = laborLine
    ? Math.max(0, laborSpend[laborLine.id]?.remaining ?? laborLine.budget)
    : 0;
  if (!(materialsRemaining > 0) && !(laborRemaining > 0)) return null;
  return {
    name: materialsLine?.name || laborLine?.name || 'Change order',
    materialsRemaining,
    laborRemaining,
  };
}

/** Label for timeline / payment schedule: readable as a change order (avoids bare scope names like "Concrete"). */
export function formatChangeOrderPaymentRowTitle(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "Change order";
  if (/^change\s*order(\s*[:\-|–—]|\s*\(|$)/i.test(t)) return t;
  return `Change order: ${t}`;
}

/**
 * One payment row per approved change order (same client dollars as Budget / `computeProjectFinancials`).
 * If only an aggregate `changeOrderTotal` exists, returns a single synthetic row so schedules can still sum.
 */
export function getApprovedChangeOrderPaymentRows(project: any): ChangeOrderPaymentRow[] {
  const changeOrders = coalesceChangeOrders(project);
  const ed = project?.estimateData || project?.projectData?.estimateData || {};
  const fallbackMarkupPct = safeNum(
    ed?.markupPct ?? ed?.markup ?? project?.markupPct ?? project?.markup
  );
  const rows: ChangeOrderPaymentRow[] = [];
  for (const co of changeOrders) {
    if (!isApprovedChangeOrder(co)) continue;
    const amount = resolveApprovedChangeOrderRevenue(co, fallbackMarkupPct);
    if (!(amount > 0)) continue;
    const cid = co?.id != null ? String(co.id) : "";
    rows.push({
      id: cid ? `bps-co-${cid}` : `bps-co-idx-${rows.length}`,
      title: formatChangeOrderPaymentRowTitle(changeOrderCardTitle(co, changeOrders)),
      amount,
      dateRaw: co.date ?? co.createdAt ?? co.updatedAt,
    });
  }
  const financials = computeProjectFinancials(project, {});
  const target = financials.approvedChangeOrderRevenue;
  const sumRows = rows.reduce((s, r) => s + r.amount, 0);
  const gap = target - sumRows;
  if (gap > 0.01) {
    rows.push({
      id: "bps-co-unallocated",
      title: "Change order (balance)",
      amount: gap,
      dateRaw: undefined,
    });
  }
  return rows;
}

/**
 * Synthetic timeline rows for approved change orders use `bps-co-…` ids (see {@link getApprovedChangeOrderPaymentRows}).
 * Overall timeline % should reflect the original payment schedule only, not these add-on rows.
 */
export function isChangeOrderTimelineMilestone(m: { id?: unknown; type?: unknown } | null | undefined): boolean {
  if (!m) return false;
  if (String((m as { type?: unknown }).type || "").toLowerCase() === "change_order") return true;
  return String(m.id ?? "").startsWith("bps-co-");
}

/**
 * Saved Timeline status applies to the row with the same id.
 * Change orders also match by title only when that title belongs to one order.
 * Two approved orders can share a name, and title matching would copy the first order's amount and Received status onto the second.
 */
export function findSavedTimelineMilestone<T extends { id?: unknown; title?: unknown }>(
  saved: T[] | null | undefined,
  next: { id?: unknown; title?: unknown }
): T | undefined {
  const nextId = String(next?.id ?? "").trim();
  const list = saved || [];
  if (nextId) {
    const byId = list.find((milestone) => String(milestone?.id ?? "").trim() === nextId);
    if (byId) return byId;
  }
  if (nextId.startsWith("bps-co-")) {
    const norm = (value: unknown) => String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
    const title = norm(next?.title);
    if (!title) return undefined;
    const legacy = list.filter((milestone) => {
      const savedId = String(milestone?.id ?? "").trim();
      return !savedId.startsWith("bps-co-") && norm(milestone?.title) === title;
    });
    return legacy.length === 1 ? legacy[0] : undefined;
  }
  const norm = (value: unknown) => String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  const title = norm(next?.title);
  if (!title) return undefined;
  return list.find((milestone) => norm(milestone?.title) === title);
}

type TimelineStatusRow = {
  id?: unknown;
  amount?: unknown;
  status?: unknown;
  progressPct?: unknown;
  assignee?: unknown;
  costDelta?: unknown;
  costCategory?: unknown;
  collectedAt?: unknown;
  actualDate?: unknown;
  collectedAmount?: unknown;
  plannedDate?: unknown;
};

function timelineMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Saved status belongs to this row. A change-order receipt is kept only when the saved
 * amount is still this order's client price. A same-titled order used to copy the first
 * order's Received amount into the second, and that copy is stored until it is rejected here.
 */
export function mergeTimelineMilestoneWithSaved<T extends TimelineStatusRow>(
  next: T,
  saved: T | null | undefined
): T {
  if (!saved) return next;
  const changeOrder = String(next.id ?? "").startsWith("bps-co-");
  const savedAmount = timelineMoney(
    timelineMoney(saved.collectedAmount) > 0 ? saved.collectedAmount : saved.amount
  );
  const nextAmount = timelineMoney(next.amount);
  if (changeOrder && savedAmount > 0 && Math.abs(savedAmount - nextAmount) >= 0.02) {
    return next;
  }

  const status = String(saved.status || "").toLowerCase();
  const savedReceived =
    status === "completed" ||
    status === "complete" ||
    status === "paid" ||
    status === "received" ||
    Boolean(saved.collectedAt);
  const receivedAmount =
    !changeOrder && savedReceived
      ? timelineMoney(saved.collectedAmount) > 0
        ? timelineMoney(saved.collectedAmount)
        : timelineMoney(saved.amount) > 0
          ? timelineMoney(saved.amount)
          : undefined
      : undefined;

  return {
    ...next,
    ...(receivedAmount != null ? { amount: receivedAmount } : {}),
    status: (saved.status as T["status"]) || next.status,
    progressPct: (saved.progressPct as T["progressPct"]) ?? next.progressPct,
    assignee: saved.assignee || next.assignee,
    costDelta: saved.costDelta,
    costCategory: saved.costCategory,
    collectedAt: savedReceived ? saved.collectedAt ?? next.collectedAt : undefined,
    actualDate: savedReceived ? saved.actualDate ?? next.actualDate : undefined,
    plannedDate: next.plannedDate,
  };
}

/**
 * Billing rows (deposit, progress payments, holdback). Collected cash is not work finished,
 * so these rows must not move schedule progress or the cost forecast.
 */
export function isBillingTimelineMilestone(m: {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  weekNumber?: unknown;
} | null | undefined): boolean {
  if (!m) return false;
  if (isChangeOrderTimelineMilestone(m)) return true;
  const type = String(m.type || "").toLowerCase();
  if (type === "payment" || type === "holdback" || type === "deposit" || type === "weekly") return true;
  if (Number(m.weekNumber) === 0) return true;
  const title = String(m.title || m.name || m.description || "").toLowerCase();
  if (
    title.includes("payment") ||
    title.includes("deposit") ||
    title.includes("holdback") ||
    title.includes("retainage") ||
    title.includes("invoice") ||
    title.includes("billing") ||
    /\bprogress\s+pay/i.test(title)
  ) {
    return true;
  }
  if (/week\s*\d/i.test(title) && (title.includes("pay") || title.includes("progress"))) return true;
  return false;
}

/**
 * Outstanding receivables: synthetic CO payment rows count only when they match an **approved**
 * change order (same ids as {@link getApprovedChangeOrderPaymentRows}). Submitted-only or stale
 * timeline rows must not inflate receivables.
 *
 * Also matches by normalized title when `id` is missing or differs between Timeline and `bps-co-*`
 * rows so approved COs are not dropped from AR.
 */
export function shouldExcludeChangeOrderPaymentFromOutstandingReceivables(
  project: any,
  payment: { id?: unknown; type?: unknown; title?: unknown; name?: unknown } | null | undefined
): boolean {
  if (!isChangeOrderTimelineMilestone(payment)) return false;
  const approvedRows = getApprovedChangeOrderPaymentRows(project);
  const pid = String((payment as { id?: unknown }).id ?? "").trim();
  if (pid && approvedRows.some((r) => r.id === pid)) return false;
  const rawTitle = String((payment as { title?: unknown; name?: unknown }).title ?? (payment as any).name ?? "").trim();
  const payTitleKey = formatChangeOrderPaymentRowTitle(rawTitle);
  if (payTitleKey && approvedRows.some((r) => formatChangeOrderPaymentRowTitle(String(r.title ?? "").trim()) === payTitleKey)) {
    return false;
  }
  // No id we can match to `bps-co-*` and no title match — do not exclude (avoid hiding legitimate CO lines).
  if (!pid) return false;
  return true;
}

/**
 * Estimated cost added by approved COs: explicit materials+labor when present,
 * else prorate sell amount by plannedCost / contractValueBase.
 */
export function sumApprovedChangeOrderEstimatedCost(
  changeOrders: any[],
  contractValueBase: number,
  plannedCostBase: number,
  fallbackMarkupPct = 0
): number {
  let total = 0;
  for (const co of changeOrders) {
    if (!isApprovedChangeOrder(co)) continue;
    const rev = resolveApprovedChangeOrderRevenue(co, fallbackMarkupPct);
    const mat = co.materialsAmount != null ? Number(co.materialsAmount) : NaN;
    const lab = co.laborAmount != null ? Number(co.laborAmount) : NaN;
    const explicit =
      (Number.isFinite(mat) ? mat : 0) + (Number.isFinite(lab) ? lab : 0);
    if (explicit > 0) {
      total += explicit;
      continue;
    }
    if (rev > 0 && contractValueBase > 0 && plannedCostBase > 0) {
      total += rev * (plannedCostBase / contractValueBase);
    }
  }
  return total;
}

/**
 * Original contract sell price (excludes approved change orders).
 * Must NOT use project.budgeted / projectData.budgeted — those may already include COs (double-count).
 * Candidate order matches Projects list / dashboard revenue (`getProjectRevenue`).
 */
export function getContractValueBase(project: any, plannedFromBucketsFallback = 0): number {
  const ed = project?.estimateData || project?.projectData?.estimateData || {};
  const candidates = [
    ed?.grandTotal,
    ed?.bidPrice,
    ed?.total,
    ed?.calculatedTotal,
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.projectData?.totalBidPrice,
    project?.estimatedCost,
    project?.projectData?.estimatedCost,
    project?.total,
    project?.totalRevenue,
    project?.contractValue,
  ];
  const explicit = firstPositiveNumber(...candidates);
  if (explicit !== null) return explicit;
  return Math.max(0, plannedFromBucketsFallback);
}

function readPositiveAmount(source: any, ...keys: string[]): number {
  if (!source) return 0;
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

/** Project overhead on the bid (insurance, facilities, admin, added lines). Part of the job-cost cap; not marked up. */
export function getAllocatedCompanyOverhead(project: any): number {
  const sources = [project?.estimateData, project?.projectData?.estimateData, project];
  const pick = (...keys: string[]) => {
    for (const source of sources) {
      const amount = readPositiveAmount(source, ...keys);
      if (amount > 0) return amount;
    }
    return 0;
  };
  const overheadLines = sources.reduce((sum, source) => {
    const total = getBidOverheadLineItemsTotal(source);
    return total > sum ? total : sum;
  }, 0);
  const fromLines =
    pick('insuranceOverhead') +
    pick('equipmentMaintenance', 'equipmentMaintenanceOverhead') +
    pick('facilities', 'facilitiesOverhead') +
    pick('adminOverhead') +
    pick('otherOverhead') +
    overheadLines;
  if (fromLines > 0) return fromLines;
  const saved = Number(project?.companyOverhead ?? project?.estimateData?.companyOverhead ?? 0);
  return Number.isFinite(saved) && saved > 0 ? saved : 0;
}

export type ProjectFinancialSnapshot = {
  contractValueBase: number;
  approvedChangeOrderRevenue: number;
  adjustedContractValue: number;
  /** Planned direct job cost from estimate (before change-order cost allocation). */
  plannedCostBudget: number;
  /** Estimated cost from approved change orders. */
  approvedChangeOrderCost: number;
  /** Spend cap: planned cost + allocated CO cost. */
  adjustedCostBudget: number;
  /** Project overhead from the estimate. Included in the planned cost; not marked up. */
  projectOverhead: number;
  /** Overhead taken from profit outside the cost cap. Project overhead sits inside the cap, so this is 0. */
  allocatedCompanyOverhead: number;
};

/** Equipment rental from the estimate. It is a hard cost, stored apart from the materials list. */
export function equipmentRentalAmount(project: any): number {
  return Math.max(
    0,
    Number(project?.estimateData?.equipment ?? project?.equipment ?? 0) || 0
  );
}

/**
 * Equipment rental is a hard cost inside the planned-cost cap. Older sends stored it
 * only in the cap, not on the Materials/Equipment bucket. Add it once when that gap
 * is exactly the equipment amount.
 */
export function foldEquipmentRentalIntoMaterialsBucket<
  T extends { name?: string; budget?: number; bidBudget?: number },
>(buckets: T[] | undefined, project: any, plannedCostBudget: number): T[] {
  const list = Array.isArray(buckets) ? buckets : [];
  const equipment = equipmentRentalAmount(project);
  if (!(equipment > 0) || !(plannedCostBudget > 0) || list.length === 0) return list;
  const bucketSum = list.reduce((sum, bucket) => {
    if (isCompanyOverheadCategory(bucket?.name)) return sum;
    return sum + (Number(bucket?.budget) || 0);
  }, 0);
  const jobPlanned = plannedCostBudget - getAllocatedCompanyOverhead(project);
  if (Math.abs(jobPlanned - bucketSum - equipment) >= 1) return list;
  const materialsIndex = list.findIndex((bucket) =>
    String(bucket?.name || '').toLowerCase().includes('material')
  );
  if (materialsIndex < 0) return list;
  return list.map((bucket, index) => {
    if (index !== materialsIndex) return bucket;
    const budget = (Number(bucket.budget) || 0) + equipment;
    const bidBase = Number(bucket.bidBudget ?? bucket.budget) || 0;
    return { ...bucket, budget, bidBudget: bidBase + equipment };
  });
}

/**
 * Sum bucket `budget` values that represent planned job cost.
 * Excludes buckets that are clearly markup / sell-side / revenue (not cost to build).
 */
export function sumPlannedCostFromBuckets(buckets: unknown[] | undefined): number {
  if (!Array.isArray(buckets)) return 0;
  return buckets.reduce((sum: number, b: any) => {
    const name = String(b?.name || "").toLowerCase();
    if (
      name.includes("markup") ||
      name.includes("company overhead") ||
      name === "overhead" ||
      name.includes("revenue") ||
      name.includes("contract value") ||
      name.includes("sell price") ||
      (name.includes("profit") && !name.includes("cost"))
    ) {
      return sum;
    }
    return sum + safeNum(b?.budget);
  }, 0);
}

/**
 * Spending Trend badge: use real cost position vs cap + forecast — not cumulative-curve variance
 * (which falsely shows "over" when spend is front-loaded but still under budget).
 */
export function computeSpendingTrendCostStatus(params: {
  /** Operational spend cap (planned cost + approved CO cost allocation). */
  spendCap: number;
  actualCosts: number;
  committedPOs: number;
  forecastFinalCost: number;
}): { text: "On track" | "At risk" | "Over budget"; color: string } {
  const cap = safeNum(params.spendCap);
  const actualPlus = safeNum(params.actualCosts) + safeNum(params.committedPOs);
  const forecast = safeNum(params.forecastFinalCost);
  if (cap <= 0) {
    return { text: "On track", color: "#22c55e" };
  }
  if (actualPlus > cap || forecast > cap) {
    return { text: "Over budget", color: "#ef4444" };
  }
  // No spend / committed POs yet — forecast is often a full-budget fallback; avoid "At risk" false positives.
  if (actualPlus <= 0) {
    return { text: "On track", color: "#22c55e" };
  }
  if (forecast >= cap * 0.95) {
    return { text: "At risk", color: "#f59e0b" };
  }
  return { text: "On track", color: "#22c55e" };
}

/**
 * Single source of truth for revenue vs cost caps (matches prior BudgetTab / Overview heuristics).
 */
export function computeProjectFinancials(
  project: any,
  options?: {
    plannedFromBuckets?: number;
    contractValueOverride?: number;
    /** Preferred when line-item costs are missing: sum of cost buckets (see sumPlannedCostFromBuckets). */
    plannedCostBucketSum?: number;
  }
): ProjectFinancialSnapshot {
  const plannedFromBuckets = options?.plannedFromBuckets ?? 0;
  const ed = project?.estimateData || {};
  const changeOrders = coalesceChangeOrders(project);

  let contractValueBase = getContractValueBase(project, plannedFromBuckets);
  if (!(contractValueBase > 0) && options?.contractValueOverride != null) {
    const o = toPositiveNumber(options.contractValueOverride);
    if (o != null) contractValueBase = o;
  }
  const fallbackMarkupPct = safeNum(
    ed?.markupPct ??
    ed?.markup ??
    project?.markupPct ??
    project?.markup
  );
  let approvedChangeOrderRevenue = sumApprovedChangeOrderRevenue(changeOrders, fallbackMarkupPct);
  if (approvedChangeOrderRevenue <= 0) {
    const agg = firstPositiveNumber(
      project?.projectData?.changeOrderTotal,
      project?.changeOrderTotal,
      (project as any)?.rawProject?.projectData?.changeOrderTotal
    );
    if (agg != null) approvedChangeOrderRevenue = agg;
  }
  const adjustedContractValue = contractValueBase + approvedChangeOrderRevenue;

  let baseBid = firstPositiveNumber(
    ed?.grandTotal,
    ed?.bidPrice,
    ed?.total,
    ed?.calculatedTotal,
    project?.bidPrice,
    project?.projectData?.bidPrice,
    ed?.estimateData?.grandTotal,
    ed?.estimateData?.total
  );
  if (baseBid == null && contractValueBase > 0) {
    const marginPct = Number(project?.margin ?? ed?.marginPct ?? ed?.margin ?? 0);
    const effectiveMargin = marginPct > 0 && marginPct < 100 ? marginPct : 10;
    baseBid = contractValueBase / (1 - effectiveMargin / 100);
  }

  const bidForMarkup = baseBid ?? contractValueBase;

  const costFromLineItems = (() => {
    const bid = ed || project;
    const materialLineTotal = (bid?.materialLineItems || []).reduce(
      (s: number, i: any) => s + Number(i?.total || 0),
      0
    );
    const laborLineTotal = (bid?.laborLineItems || []).reduce(
      (s: number, i: any) => s + Number(i?.total || 0),
      0
    );
    const materials = materialLineTotal > 0 ? materialLineTotal : Number(bid?.materials ?? project?.materials) || 0;
    const labor = laborLineTotal > 0 ? laborLineTotal : Number(bid?.labor ?? project?.labor) || 0;
    const equipment = Number(bid?.equipment ?? project?.equipment) || 0;
    const otherDirect = Number(bid?.otherDirectCost ?? project?.otherDirectCost) || 0;
    const softCosts = getBidSoftCostTotal({ ...project, ...bid });
    const contingency = Number(bid?.contingencyAllowance ?? project?.contingencyAllowance) || 0;
    const jobCost = materials + labor + equipment + otherDirect + softCosts + contingency;
    if (jobCost > 0) return jobCost;
    const buckets = project?.buckets || [];
    const costBuckets = buckets.filter((b: any) => {
      const name = String(b?.name || '').toLowerCase();
      const isCompanyOverhead = name.includes('overhead') || name.includes('insurance') || name.includes('facilities');
      if (isCompanyOverhead) return false;
      return (
        name.includes('labor') ||
        name.includes('material') ||
        name.includes('allowance') ||
        name.includes('soft cost') ||
        name.includes('soft-cost') ||
        name.includes('contingency') ||
        name.includes('permit')
      );
    });
    const fromBuckets = costBuckets.reduce(
      (s: number, b: any) => s + Number(b?.budget || 0),
      0
    );
    if (fromBuckets > 0) return fromBuckets;
    const markupBucket = buckets.find((b: any) =>
      (b?.name || '').toLowerCase().includes('markup')
    );
    const markupAmt = Number(markupBucket?.budget || 0);
    if (bidForMarkup > 0 && markupAmt > 0 && markupAmt < bidForMarkup) {
      return bidForMarkup - markupAmt;
    }
    return 0;
  })();

  const estimateCostFromParts = (() => {
    const bid = { ...project, ...ed };
    const materials = Number(bid?.materials) || 0;
    const labor = Number(bid?.labor) || 0;
    const equipment = Number(bid?.equipment) || 0;
    const otherDirect = Number(bid?.otherDirectCost) || 0;
    const softCosts = getBidSoftCostTotal(bid);
    const contingency = Number(bid?.contingencyAllowance) || 0;
    return materials + labor + equipment + otherDirect + softCosts + contingency;
  })();

  /**
   * Planned cost = hard costs + soft costs + contingency (the estimate total before markup).
   * Company overhead is not included. Contract price and markup are not a cost cap.
   */
  let plannedCostBudget = 0;
  if (costFromLineItems > 0) {
    plannedCostBudget = costFromLineItems;
  } else if (estimateCostFromParts > 0) {
    plannedCostBudget = estimateCostFromParts;
  } else {
    plannedCostBudget = safeNum(
      project?.estimatedCost ??
        ed?.estimatedCost ??
        ed?.totalCost ??
        ed?.baseCost
    );
  }
  const bucketSumOpt = options?.plannedCostBucketSum;
  if (plannedCostBudget <= 0 && bucketSumOpt != null && bucketSumOpt > 0) {
    plannedCostBudget = bucketSumOpt;
  }
  const projectOverhead = getAllocatedCompanyOverhead(project);
  if (plannedCostBudget > 0) {
    plannedCostBudget += projectOverhead;
  }

  const approvedCostBudget = safeNum(project?.approvedCostBudget);
  if (plannedCostBudget <= 0 && approvedCostBudget > 0) {
    plannedCostBudget = approvedCostBudget;
  }

  if (plannedCostBudget <= 0 && bidForMarkup > 0) {
    const marginPct = Number(project?.margin ?? ed?.marginPct ?? ed?.margin ?? 0);
    if (marginPct > 0 && marginPct < 100) {
      plannedCostBudget = bidForMarkup * (1 - marginPct / 100);
    } else {
      plannedCostBudget = bidForMarkup / 1.18;
    }
  }
  // Do not fall back to contractValueBase — it is typically bid/sell/revenue, not job cost.

  const approvedChangeOrderCost = sumApprovedChangeOrderEstimatedCost(
    changeOrders,
    contractValueBase,
    plannedCostBudget,
    fallbackMarkupPct
  );
  const adjustedCostBudget = plannedCostBudget + approvedChangeOrderCost;

  return {
    contractValueBase,
    approvedChangeOrderRevenue,
    adjustedContractValue,
    plannedCostBudget,
    approvedChangeOrderCost,
    adjustedCostBudget,
    projectOverhead,
    allocatedCompanyOverhead: 0,
  };
}
