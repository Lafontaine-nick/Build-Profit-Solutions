import { getProjectRevenue } from "@/lib/projectRevenue";
import {
  ESTIMATE_PROJECT_TYPE_ORDER,
  type EstimateProjectTypeKey,
  normalizeEstimateProjectType,
} from "@/lib/projectTypes";

export type ProjectTypeProfitStat = {
  label: string;
  amount: string;
  percent: number;
};

function amount(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Bills plus received purchase orders. A stored actualCost can be bills only. */
export function completedJobActualCost(project: any): number {
  const projectData =
    project?.projectData && typeof project.projectData === "object" ? project.projectData : {};
  const expenses =
    Array.isArray(projectData.expenses) && projectData.expenses.length > 0
      ? projectData.expenses
      : Array.isArray(project?.expenses) && project.expenses.length > 0
        ? project.expenses
        : [];
  const expenseSum = expenses.reduce((sum: number, row: any) => sum + amount(row?.amount), 0);
  const purchaseOrders =
    Array.isArray(projectData.purchaseOrders) && projectData.purchaseOrders.length > 0
      ? projectData.purchaseOrders
      : Array.isArray(project?.purchaseOrders)
        ? project.purchaseOrders
        : [];
  const receivedOrders = purchaseOrders
    .filter((row: any) => String(row?.status || "").toLowerCase() === "received")
    .reduce((sum: number, row: any) => sum + amount(row?.amount), 0);
  if (expenseSum > 0 || receivedOrders > 0) return expenseSum + receivedOrders;

  const stored = [
    project?.actualCost,
    projectData.actualCost,
    projectData.spent,
    projectData.totalSpent,
    project?.totalSpent,
    project?.spent,
  ];
  for (const candidate of stored) {
    const value = amount(candidate);
    if (value > 0) return value;
  }
  return 0;
}

/** Contract minus bills and received purchase orders. */
export function getCompletedProjectProfit(project: any): number {
  const revenue = getProjectRevenue(project);
  if (revenue <= 0) return 0;

  const actualCost = completedJobActualCost(project);

  if (actualCost > 0) {
    return revenue - actualCost;
  }

  const margin = project.margin || 0;
  const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;
  return revenue * marginRatio;
}

export function getCompletedProjectMarginPercent(project: any): number | null {
  const revenue = getProjectRevenue(project);
  if (revenue <= 0) return null;
  const profit = getCompletedProjectProfit(project);
  return (profit / revenue) * 100;
}

function resolveProjectTypeKey(project: any): EstimateProjectTypeKey {
  const candidates = [
    project?.projectType,
    project?.estimateData?.projectType,
    project?.template,
    project?.category,
    project?.projectCategory,
    project?.rawProject?.projectType,
    project?.rawProject?.estimateData?.projectType,
  ];

  for (const c of candidates) {
    if (c == null || String(c).trim() === "") continue;
    const key = normalizeEstimateProjectType(c);
    if (key !== "other") return key;
  }
  for (const c of candidates) {
    if (c == null || String(c).trim() === "") continue;
    return normalizeEstimateProjectType(c);
  }
  return "other";
}

/**
 * For completed projects only: group by estimate project type, then
 * average margin % within each type. Dollar column = total profit in that bucket.
 */
export function computeProfitabilityByProjectType(
  projects: any[]
): ProjectTypeProfitStat[] {
  const buckets: Record<
    string,
    { margins: number[]; profitSum: number }
  > = {};

  for (const p of projects) {
    const status = (p?.status || "").toString().toLowerCase();
    if (status !== "completed") continue;

    const marginPct = getCompletedProjectMarginPercent(p);
    if (marginPct === null) continue;

    const key = resolveProjectTypeKey(p);
    if (!buckets[key]) {
      buckets[key] = { margins: [], profitSum: 0 };
    }
    buckets[key].margins.push(marginPct);
    buckets[key].profitSum += getCompletedProjectProfit(p);
  }

  const out: ProjectTypeProfitStat[] = [];
  for (const { value, label } of ESTIMATE_PROJECT_TYPE_ORDER) {
    const b = buckets[value];
    if (!b || b.margins.length === 0) continue;

    const avgMargin =
      b.margins.reduce((sum, m) => sum + m, 0) / b.margins.length;

    out.push({
      label,
      amount: `$${Math.round(b.profitSum).toLocaleString("en-US")}`,
      percent: avgMargin,
    });
  }

  return out;
}
