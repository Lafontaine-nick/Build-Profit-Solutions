/**
 * Cost vs revenue for project budgeting.
 * Contract / sell price (grandTotal, bid) is revenue; spend tracking uses planned cost + allocated CO cost.
 */

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
    (project as any)?.rawProject?.projectData?.changeOrders,
    (project as any)?.rawProject?.changeOrders,
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

function isApprovedChangeOrder(co: any): boolean {
  return (
    (typeof co.approved === 'boolean' && co.approved) ||
    (typeof co.status === 'string' && co.status.toLowerCase() === 'approved')
  );
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
      title: formatChangeOrderPaymentRowTitle(String(co.title ?? co.name ?? "").trim() || "Change order"),
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
};

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
    const materials = (bid?.materialLineItems || []).reduce(
      (s: number, i: any) => s + Number(i?.total || 0),
      0
    );
    const labor = (bid?.laborLineItems || []).reduce(
      (s: number, i: any) => s + Number(i?.total || 0),
      0
    );
    const overhead =
      Number(bid?.equipment || 0) +
      Number(bid?.facilities || 0) +
      Number(bid?.insuranceOverhead || 0) +
      Number(bid?.otherOverhead || 0) +
      Number(bid?.planCost || 0) +
      Number(bid?.permitCost || 0) +
      Number(bid?.otherDirectCost || 0);
    if (materials + labor + overhead > 0) return materials + labor + overhead;
    const buckets = project?.buckets || [];
    const costBuckets = buckets.filter(
      (b: any) =>
        (b?.name || '').toLowerCase().includes('labor') ||
        (b?.name || '').toLowerCase().includes('material') ||
        (b?.name || '').toLowerCase().includes('overhead')
    );
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

  const estimateCostFromParts =
    Number((ed?.materials ?? project?.materials) || 0) +
    Number((ed?.labor ?? project?.labor) || 0) +
    Number((ed?.equipment ?? project?.equipment) || 0) +
    Number((ed?.facilities ?? project?.facilities) || 0) +
    Number((ed?.insuranceOverhead ?? project?.insuranceOverhead) || 0) +
    Number((ed?.otherOverhead ?? project?.otherOverhead) || 0) +
    Number((ed?.planCost ?? project?.planCost) || 0) +
    Number((ed?.permitCost ?? project?.permitCost) || 0) +
    Number((ed?.otherDirectCost ?? project?.otherDirectCost) || 0);

  /**
   * Planned cost budget = direct cost only (materials, labor, burden, permits, etc.).
   * Never use: contract sell price, grandTotal, subtotal (often sell), or "revenue − profit" imputation
   * as a primary source — those mix revenue/markup into the cost cap.
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
  };
}
