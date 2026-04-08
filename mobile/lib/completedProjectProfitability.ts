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

/** Same profit rules as dashboard computePipelineTotals for completed projects. */
export function getCompletedProjectProfit(project: any): number {
  const revenue = getProjectRevenue(project);
  if (revenue <= 0) return 0;

  const actualCost =
    project.actualCost ||
    project.projectData?.actualCost ||
    project.projectData?.spent ||
    project.projectData?.totalSpent ||
    project.totalSpent ||
    0;

  if (actualCost > 0) {
    return revenue - Number(actualCost);
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
