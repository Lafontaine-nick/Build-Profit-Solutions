import { isChangeOrderTimelineMilestone } from "./projectFinancials";

type PaymentRowLike = {
  id?: unknown;
  type?: unknown;
  amount?: unknown;
  paymentAmount?: unknown;
  percentage?: unknown;
  status?: unknown;
  collectedAt?: unknown;
};

const roundCents = (n: number) => Math.round(n * 100) / 100;

function rowAmount(row: PaymentRowLike): number {
  const amount = Number(row?.amount) || Number(row?.paymentAmount) || 0;
  return Number.isFinite(amount) ? amount : 0;
}

export function isPaymentRowReceived(row: PaymentRowLike): boolean {
  const status = String(row?.status || "").toLowerCase();
  if (status === "completed" || status === "complete" || status === "paid" || status === "received") {
    return true;
  }
  return Boolean(row?.collectedAt);
}

function isDepositRow(row: any): boolean {
  if (String(row?.type || "").toLowerCase() === "deposit") return true;
  if (Number(row?.weekNumber) === 0) return true;
  return /deposit/i.test(String(row?.name || row?.title || row?.description || ""));
}

/** True when `schedule` has no deposit row but `other` does — the visible list is not the full schedule. */
export function hasDepositOnlyInOtherList(schedule: any[], other: any[]): boolean {
  const list = Array.isArray(schedule) ? schedule : [];
  const rest = Array.isArray(other) ? other : [];
  return !list.some(isDepositRow) && rest.some(isDepositRow);
}

/** Contract sell price saved on the estimate; null when the estimate has no explicit price. */
export function getEstimateContractValue(estimateData: any): number | null {
  const ed = estimateData || {};
  for (const candidate of [ed.grandTotal, ed.bidPrice, ed.total, ed.calculatedTotal]) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Make the base payment schedule (change-order rows excluded) sum to the contract value.
 * Received rows keep their amounts; the difference is spread across pending rows in
 * proportion to their current amounts, with the last pending row absorbing rounding.
 * Returns the original array when it already matches within `tolerance` or cannot be fixed
 * (no pending rows, or more already received than the contract). Gaps larger than
 * `maxGapRatio` of the contract are left alone: that size points to a structural mismatch
 * (e.g. a deposit stored in another list), not a stale price.
 */
export function reconcilePaymentRowsToContract<T extends PaymentRowLike>(
  rows: T[],
  contractValue: number | null | undefined,
  options?: { tolerance?: number; maxGapRatio?: number }
): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const contract = Number(contractValue);
  if (!Number.isFinite(contract) || contract <= 0) return rows;
  const tolerance = options?.tolerance ?? 1;
  const maxGapRatio = options?.maxGapRatio ?? 0.15;

  const scheduleIdx = rows
    .map((row, idx) => (isChangeOrderTimelineMilestone(row as any) ? -1 : idx))
    .filter((idx) => idx >= 0);
  const scheduleTotal = scheduleIdx.reduce((sum, idx) => sum + rowAmount(rows[idx]), 0);
  const gap = Math.abs(contract - scheduleTotal);
  const hasReceived = scheduleIdx.some((idx) => isPaymentRowReceived(rows[idx]));
  // A large gap on an all-pending list is left alone (the deposit may live on another list).
  // Once any row is collected, pending rows have to fill whatever is still owed.
  if (scheduleTotal <= 0 || gap <= tolerance || (gap > contract * maxGapRatio && !hasReceived)) return rows;

  const receivedTotal = scheduleIdx
    .filter((idx) => isPaymentRowReceived(rows[idx]))
    .reduce((sum, idx) => sum + rowAmount(rows[idx]), 0);
  const pendingIdx = scheduleIdx.filter(
    (idx) => !isPaymentRowReceived(rows[idx]) && rowAmount(rows[idx]) > 0
  );
  const pendingTotal = pendingIdx.reduce((sum, idx) => sum + rowAmount(rows[idx]), 0);
  const pendingTarget = roundCents(contract - receivedTotal);
  if (pendingIdx.length === 0 || pendingTotal <= 0 || pendingTarget <= 0) return rows;

  const scale = pendingTarget / pendingTotal;
  const next = rows.slice();
  let allocated = 0;
  pendingIdx.forEach((idx, k) => {
    const isLast = k === pendingIdx.length - 1;
    const amount = isLast
      ? roundCents(pendingTarget - allocated)
      : roundCents(rowAmount(rows[idx]) * scale);
    allocated = roundCents(allocated + amount);
    const updated: any = { ...rows[idx], amount };
    if ("paymentAmount" in (rows[idx] as object)) updated.paymentAmount = amount;
    next[idx] = updated;
  });

  for (const idx of scheduleIdx) {
    if (typeof next[idx].percentage !== "number") continue;
    next[idx] = {
      ...next[idx],
      percentage: Math.round((rowAmount(next[idx]) / contract) * 10000) / 100,
    };
  }

  return next;
}

const normLabel = (value: unknown) => String(value || "").toLowerCase().trim().replace(/\s+/g, " ");

function lockedReceivedAmount(saved: any): number | null {
  const collected = Number(saved?.collectedAmount);
  if (Number.isFinite(collected) && collected > 0) return roundCents(collected);
  const amount = Number(saved?.amount);
  return Number.isFinite(amount) && amount > 0 ? roundCents(amount) : null;
}

/**
 * When the Estimate rebuilds or rescales a schedule, keep payments already received on the
 * Timeline at the amount collected. Rows match saved Timeline rows by id, then by label
 * (rebuilds issue new ids). The rest of the contract is spread across pending rows in proportion
 * to their amounts. Percentages are stored unrounded so the Estimate's percent-based
 * recalculation reproduces the same amounts.
 */
export function keepReceivedPaymentAmounts<T extends PaymentRowLike>(
  rows: T[],
  savedTimeline: unknown,
  contractValue: number | null | undefined
): T[] {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(savedTimeline)) return rows;
  const contract = Number(contractValue);
  if (!Number.isFinite(contract) || contract <= 0) return rows;
  const received = savedTimeline.filter(
    (saved) =>
      saved &&
      !isChangeOrderTimelineMilestone(saved) &&
      isPaymentRowReceived(saved) &&
      lockedReceivedAmount(saved) != null
  );
  if (received.length === 0) return rows;

  const used = new Set<unknown>();
  const locked = new Map<number, number>();
  const lock = (idx: number, saved: any) => {
    used.add(saved);
    locked.set(idx, lockedReceivedAmount(saved) as number);
  };
  const scheduleIdx = rows
    .map((row, idx) => (isChangeOrderTimelineMilestone(row as any) ? -1 : idx))
    .filter((idx) => idx >= 0);
  for (const idx of scheduleIdx) {
    const id = rows[idx]?.id;
    if (id == null || id === "") continue;
    const match = received.find((saved) => !used.has(saved) && saved.id === id);
    if (match) lock(idx, match);
  }
  for (const idx of scheduleIdx) {
    if (locked.has(idx)) continue;
    const row: any = rows[idx];
    const labels = [row?.description, row?.name, row?.title].map(normLabel).filter(Boolean);
    const match = received.find(
      (saved) => !used.has(saved) && labels.includes(normLabel(saved.title || saved.name))
    );
    if (match) lock(idx, match);
  }
  if (locked.size === 0) return rows;

  const lockedTotal = Array.from(locked.values()).reduce((sum, amount) => sum + amount, 0);
  const pendingIdx = scheduleIdx.filter((idx) => !locked.has(idx) && rowAmount(rows[idx]) > 0);
  const pendingTotal = pendingIdx.reduce((sum, idx) => sum + rowAmount(rows[idx]), 0);
  const pendingTarget = Math.max(roundCents(contract - lockedTotal), 0);
  const amounts = new Map<number, number>(locked);
  if (pendingTotal > 0) {
    let allocated = 0;
    pendingIdx.forEach((idx, k) => {
      const amount =
        k === pendingIdx.length - 1
          ? roundCents(pendingTarget - allocated)
          : roundCents((rowAmount(rows[idx]) * pendingTarget) / pendingTotal);
      allocated = roundCents(allocated + amount);
      amounts.set(idx, amount);
    });
  }

  return rows.map((row, idx) => {
    const amount = amounts.get(idx);
    if (amount == null && (isChangeOrderTimelineMilestone(row as any) || typeof row.percentage !== "number")) {
      return row;
    }
    const updated: any = { ...row };
    if (amount != null) {
      updated.amount = amount;
      if ("paymentAmount" in (row as object)) updated.paymentAmount = amount;
    }
    if (typeof row.percentage === "number") {
      updated.percentage = (rowAmount(updated) / contract) * 100;
    }
    return updated;
  });
}

/**
 * {@link keepReceivedPaymentAmounts} for one list of a bid, only when that list is the full
 * billed schedule (the same list the Timeline reads): `weeklyPayments` for weekly schedules
 * with their own deposit, `paymentMilestones` for other schedules with no weekly rows.
 */
export function keepReceivedInBidList<T extends PaymentRowLike>(
  listKey: "weeklyPayments" | "paymentMilestones",
  bid: { paymentSchedule?: unknown; paymentMilestones?: unknown; weeklyPayments?: unknown },
  rows: T[],
  savedTimeline: unknown,
  contractValue: number | null | undefined
): T[] {
  const otherRaw = listKey === "weeklyPayments" ? bid.paymentMilestones : bid.weeklyPayments;
  const other = Array.isArray(otherRaw) ? otherRaw : [];
  if (listKey === "weeklyPayments") {
    if (bid.paymentSchedule !== "weekly" || hasDepositOnlyInOtherList(rows, other)) return rows;
  } else if (bid.paymentSchedule === "weekly" || other.length > 0) {
    return rows;
  }
  return keepReceivedPaymentAmounts(rows, savedTimeline, contractValue);
}

/**
 * Reconcile the list a bid actually bills from: `weeklyPayments` for weekly schedules,
 * otherwise `paymentMilestones` when it is the only list. Mixed lists are left alone
 * because neither one is the full schedule on its own.
 */
export function reconcileBidPaymentSchedule<T extends PaymentRowLike>(
  schedule: { paymentSchedule?: unknown; paymentMilestones: T[]; weeklyPayments: T[] },
  contractValue: number | null | undefined
): { paymentMilestones: T[]; weeklyPayments: T[] } {
  const { paymentMilestones, weeklyPayments } = schedule;
  if (schedule.paymentSchedule === "weekly" && weeklyPayments.length > 0) {
    if (hasDepositOnlyInOtherList(weeklyPayments, paymentMilestones)) {
      return { paymentMilestones, weeklyPayments };
    }
    return {
      paymentMilestones,
      weeklyPayments: reconcilePaymentRowsToContract(weeklyPayments, contractValue),
    };
  }
  if (schedule.paymentSchedule !== "weekly" && weeklyPayments.length === 0) {
    return {
      paymentMilestones: reconcilePaymentRowsToContract(paymentMilestones, contractValue),
      weeklyPayments,
    };
  }
  return { paymentMilestones, weeklyPayments };
}
