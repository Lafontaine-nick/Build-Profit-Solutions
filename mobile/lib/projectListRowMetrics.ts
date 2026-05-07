/**
 * Shared margin / profit for project list rows (Projects tab, Dashboard “All projects”).
 * Matches project Overview: spend from expenses + received POs (else buckets), pending POs only,
 * and `computeProfitForecast` for completed jobs (net margin at closeout).
 */

import { getProjectRevenue } from '@/lib/projectRevenue';
import { computeProfitForecast } from '@/src/lib/profitForecast';

function toFiniteNumber(value: any): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type ProjectListRowFinancials = {
  slugForUi: string;
  displayStatus: string;
  finalProgress: number;
  revenue: number;
  displayAmount: number;
  margin: number;
  marginDisplay: string;
  projectedProfit: number | null;
  rawStatus: string;
};

/**
 * @param progressPct — 0–100 unified timeline / milestone progress (caller supplies `deriveUnifiedProgressPct`).
 */
export function computeProjectListRowFinancials(params: {
  mergedProject: any;
  originalRow: any;
  progressPct: number;
}): ProjectListRowFinancials {
  const p = params.originalRow;
  const mergedProject = params.mergedProject;
  const progressPct = params.progressPct;

  const statusSlug = (p.status || 'draft').toString().toLowerCase().replace(/\s+/g, '_');
  const revenue = getProjectRevenue(mergedProject);
  const rawProgress = progressPct / 100;
  const activeLike =
    statusSlug === 'won' ||
    statusSlug === 'in_progress' ||
    statusSlug === 'in-progress' ||
    statusSlug === 'active';
  const slugForUi =
    statusSlug === 'completed' || statusSlug === 'lost'
      ? statusSlug
      : activeLike && progressPct >= 99.5
        ? 'completed'
        : statusSlug;

  let displayStatus = 'Draft';
  if (slugForUi === 'estimate' || slugForUi === 'draft') displayStatus = 'Draft';
  else if (slugForUi === 'bid_submitted' || slugForUi === 'submitted') displayStatus = 'Submitted';
  else if (slugForUi === 'won') displayStatus = 'Active';
  else if (slugForUi === 'in_progress' || slugForUi === 'in-progress') displayStatus = 'Active';
  else if (slugForUi === 'completed') displayStatus = 'Completed';
  else displayStatus = (p.status || 'draft').toString().charAt(0).toUpperCase() + (p.status || 'draft').toString().slice(1);

  const finalProgress = slugForUi === 'completed' ? 1.0 : rawProgress;

  const pd = mergedProject?.projectData ?? mergedProject;
  const expenseRows =
    (Array.isArray(pd?.expenses) && pd.expenses.length > 0
      ? pd.expenses
      : Array.isArray(mergedProject?.expenses) && mergedProject.expenses.length > 0
        ? mergedProject.expenses
        : Array.isArray(pd?.expenses)
          ? pd.expenses
          : Array.isArray(mergedProject?.expenses)
            ? mergedProject.expenses
            : []) as any[];
  const expensesLineSum = expenseRows.reduce((s: number, e: any) => s + toFiniteNumber(e?.amount ?? 0), 0);
  const bucketList =
    (Array.isArray(pd?.buckets) && pd.buckets.length > 0
      ? pd.buckets
      : Array.isArray(mergedProject?.buckets) && mergedProject.buckets.length > 0
        ? mergedProject.buckets
        : Array.isArray(pd?.buckets)
          ? pd.buckets
          : Array.isArray(mergedProject?.buckets)
            ? mergedProject.buckets
            : []) as any[];
  const bucketSpentTotal = bucketList.reduce((s: number, b: any) => s + toFiniteNumber(b?.spent ?? 0), 0);
  const rawPOs = pd?.purchaseOrders ?? mergedProject?.purchaseOrders ?? [];
  const receivedPOsTotal = Array.isArray(rawPOs)
    ? rawPOs
        .filter((po: any) => String(po?.status || '').toLowerCase() === 'received')
        .reduce((s: number, po: any) => s + toFiniteNumber(po?.amount ?? 0), 0)
    : 0;
  const actualFromLedger = expensesLineSum > 0 ? expensesLineSum + receivedPOsTotal : bucketSpentTotal;
  const actualCost =
    actualFromLedger > 0
      ? actualFromLedger
      : toFiniteNumber(
          mergedProject?.actualCost ?? mergedProject?.totalSpent ?? pd?.spent ?? pd?.actualCost ?? 0
        );

  const ed = mergedProject?.estimateData;
  const costFromLineItems = (() => {
    const bid = ed ?? mergedProject;
    const materials = (bid?.materialLineItems || []).reduce((s: number, i: any) => s + Number(i?.total || 0), 0);
    const labor = (bid?.laborLineItems || []).reduce((s: number, i: any) => s + Number(i?.total || 0), 0);
    const permitCosts = Number(bid?.planCost || 0) + Number(bid?.permitCost || 0);
    const equipmentRental = Number(bid?.equipment || 0);
    const otherDirectCost = Number(bid?.otherDirectCost || 0);
    const directSubtotal = materials + labor + permitCosts + equipmentRental + otherDirectCost;
    if (directSubtotal > 0) return directSubtotal;
    const buckets = mergedProject?.buckets ?? pd?.buckets ?? [];
    const costBuckets = buckets.filter(
      (b: any) =>
        (b?.name || '').toLowerCase().includes('labor') ||
        (b?.name || '').toLowerCase().includes('material') ||
        (b?.name || '').toLowerCase().includes('overhead')
    );
    const fromBuckets = costBuckets.reduce((s: number, b: any) => s + Number(b?.budget || 0), 0);
    if (fromBuckets > 0) return fromBuckets;
    const markupBucket = buckets.find((b: any) => (b?.name || '').toLowerCase().includes('markup'));
    const markupAmt = Number(markupBucket?.budget || 0);
    if (revenue > 0 && markupAmt > 0 && markupAmt < revenue) return revenue - markupAmt;
    return 0;
  })();

  const committedPOs = Array.isArray(rawPOs)
    ? rawPOs
        .filter((po: any) => String(po?.status || '').toLowerCase() === 'pending')
        .reduce((sum: number, po: any) => sum + toFiniteNumber(po?.amount ?? 0), 0)
    : 0;

  const rawMargin = mergedProject?.estimateData?.marginPercent ?? mergedProject?.estimateData?.margin ?? p.margin;
  const estimateMarginNum =
    typeof rawMargin === 'number' && Number.isFinite(rawMargin)
      ? Math.abs(rawMargin) > 1
        ? rawMargin
        : rawMargin * 100
      : null;
  const hasStoredEstimateMargin =
    mergedProject?.estimateData?.marginPercent != null || mergedProject?.estimateData?.margin != null;
  const estimateProfit = toFiniteNumber(mergedProject?.estimateData?.profit ?? p.profit);
  const overheadFromEstimate =
    toFiniteNumber(ed?.equipmentMaintenance) +
    toFiniteNumber(ed?.facilities) +
    toFiniteNumber(ed?.insuranceOverhead) +
    toFiniteNumber(ed?.otherOverhead);
  const derivedNetProfit =
    costFromLineItems > 0 && revenue > costFromLineItems
      ? Math.max(0, revenue - costFromLineItems - overheadFromEstimate)
      : 0;
  const effectiveEstimateProfit =
    estimateProfit > 0 ? estimateProfit : derivedNetProfit > 0 && derivedNetProfit < revenue ? derivedNetProfit : 0;
  const costFromEstimateProfit =
    revenue > 0 && effectiveEstimateProfit > 0 && effectiveEstimateProfit < revenue
      ? revenue - effectiveEstimateProfit
      : 0;
  const costFromStoredMargin =
    hasStoredEstimateMargin && revenue > 0 && estimateMarginNum != null && estimateMarginNum > 0 && estimateMarginNum < 100
      ? revenue * (1 - estimateMarginNum / 100)
      : 0;
  const costFromEstimateData = toFiniteNumber(ed?.estimatedCost ?? ed?.totalCost ?? ed?.subtotal ?? ed?.baseCost);
  const estimateCostFromParts =
    toFiniteNumber(ed?.materials ?? (mergedProject as any)?.materials) +
    toFiniteNumber(ed?.labor ?? (mergedProject as any)?.labor) +
    toFiniteNumber(ed?.equipment ?? (mergedProject as any)?.equipment) +
    toFiniteNumber(ed?.equipmentMaintenance ?? (mergedProject as any)?.equipmentMaintenance) +
    toFiniteNumber(ed?.facilities ?? (mergedProject as any)?.facilities) +
    toFiniteNumber(ed?.insuranceOverhead ?? (mergedProject as any)?.insuranceOverhead) +
    toFiniteNumber(ed?.otherOverhead ?? (mergedProject as any)?.otherOverhead) +
    toFiniteNumber(ed?.planCost ?? (mergedProject as any)?.planCost) +
    toFiniteNumber(ed?.permitCost ?? (mergedProject as any)?.permitCost) +
    toFiniteNumber(ed?.otherDirectCost ?? (mergedProject as any)?.otherDirectCost);
  const estimatedCost =
    costFromEstimateProfit > 0
      ? costFromEstimateProfit
      : costFromStoredMargin > 0
        ? costFromStoredMargin
        : costFromEstimateData > 0 && costFromEstimateData < revenue
          ? costFromEstimateData
          : estimateCostFromParts > 0 && estimateCostFromParts < revenue
            ? estimateCostFromParts
            : costFromLineItems > 0
              ? costFromLineItems
              : toFiniteNumber(
                  mergedProject?.estimatedCost ??
                    mergedProject?.projectData?.estimatedCost ??
                    mergedProject?.estimateData?.totalCost ??
                    mergedProject?.estimateData?.estimatedCost ??
                    mergedProject?.estimateData?.subtotal ??
                    0
                );

  const profitForecast =
    revenue > 0
      ? computeProfitForecast({
          contractValue: revenue,
          adjustedBudget: estimatedCost > 0 ? estimatedCost : revenue,
          estimatedCostBaseline: estimatedCost > 0 ? estimatedCost : undefined,
          actualExpenses: actualCost,
          committedPOs,
          progressPct: finalProgress * 100,
          isCompleted: slugForUi === 'completed',
        })
      : null;

  const hasNoRealSpend = actualCost === 0 || (revenue > 0 && actualCost < 0.01 * revenue);
  const useEstimateValues =
    hasNoRealSpend && finalProgress < 0.05 && (effectiveEstimateProfit > 0 || estimateMarginNum != null);

  const derivedMarginFromProfit =
    revenue > 0 && effectiveEstimateProfit > 0 ? (effectiveEstimateProfit / revenue) * 100 : null;
  const derivedProfitFromMargin =
    revenue > 0 && estimateMarginNum != null ? revenue * (estimateMarginNum / 100) : null;
  const spendToDateMargin =
    revenue > 0 && actualCost >= 0 ? ((revenue - actualCost) / revenue) * 100 : null;
  const currentProfit = revenue > 0 && actualCost >= 0 ? Math.round(revenue - actualCost) : null;

  const displayProfit =
    slugForUi === 'completed' && profitForecast != null
      ? profitForecast.projectedProfit
      : useEstimateValues && (effectiveEstimateProfit > 0 || derivedProfitFromMargin != null)
        ? effectiveEstimateProfit > 0
          ? effectiveEstimateProfit
          : derivedProfitFromMargin!
        : spendToDateMargin != null
          ? currentProfit
          : profitForecast?.projectedProfit ?? null;

  const displayMargin =
    slugForUi === 'completed' && profitForecast != null
      ? profitForecast.projectedMarginPct
      : useEstimateValues && (derivedMarginFromProfit != null || estimateMarginNum != null)
        ? derivedMarginFromProfit ?? estimateMarginNum!
        : spendToDateMargin ??
          profitForecast?.projectedMarginPct ??
          (p.margin != null ? (Math.abs(p.margin) > 1 ? p.margin : p.margin * 100) : 0);

  const displayAmount = displayStatus === 'Draft' || statusSlug === 'estimate' ? 0 : revenue;

  const marginDisplay =
    displayProfit != null && Number.isFinite(displayProfit)
      ? `${displayMargin.toFixed(1)}% margin · $${Math.round(displayProfit).toLocaleString()} profit`
      : `${displayMargin.toFixed(1)}% margin`;

  return {
    slugForUi,
    displayStatus,
    finalProgress,
    revenue,
    displayAmount,
    margin: displayMargin,
    marginDisplay,
    projectedProfit: displayProfit,
    rawStatus: slugForUi,
  };
}
