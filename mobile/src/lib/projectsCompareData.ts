/**
 * Shared logic for computing project compare data — matches Projects page exactly.
 * Used by AI Assistant compare response and by useProjectsCompareData hook.
 */
import { computeProfitForecast } from './profitForecast';

const ALLOWED_NAMES = ['chris', 'nick', 'jason'];
const PROJECT_ORDER = ['chris', 'jason', 'nick'];

const toFinite = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[%$,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sanitizePositive = (v: any): number => {
  const n = toFinite(v);
  return n > 0 ? n : 0;
};

const isDepositMilestone = (m: any): boolean => {
  const t = (m?.title || m?.name || '').toLowerCase();
  return t.includes('deposit') || m?.type === 'deposit';
};

const progressFromItems = (items: any[]): number => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const total = workItems.reduce((sum, item) => {
    const pct = toFinite(item?.progressPct);
    if (pct > 0) return sum + Math.min(100, Math.max(0, pct));
    const status = String(item?.status || '').toLowerCase();
    if (status === 'completed' || status === 'complete' || status === 'paid') return sum + 100;
    if (status === 'in_progress' || status === 'in-progress') return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / workItems.length);
};

function getProjectRevenue(project: any): number {
  if (!project) return 0;
  const ed = project?.estimateData || project?.projectData?.estimateData || {};
  const candidates = [
    ed?.grandTotal,
    ed?.bidPrice,
    ed?.total,
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.projectData?.totalBidPrice,
    project?.estimatedCost,
    project?.projectData?.estimatedCost,
    project?.total,
    project?.totalRevenue,
    project?.contractValue,
  ];
  let original = 0;
  for (const c of candidates) {
    const s = sanitizePositive(c);
    if (s > 0) { original = s; break; }
  }
  if (original <= 0) return 0;

  const coSources = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
    project?.rawProject?.projectData?.changeOrders,
    project?.rawProject?.changeOrders,
  ];
  const collected: any[] = [];
  for (const src of coSources) {
    if (Array.isArray(src) && src.length) collected.push(...src);
  }
  const seen = new Set<string>();
  const unique = collected.filter((co) => {
    const key = co?.id != null ? `id:${co.id}` : `sig:${String(co?.title || '')}:${Number(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  let approved = unique.reduce((sum, co) => {
    const amt = Number(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0);
    const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status?.toLowerCase() === 'approved');
    return ok ? sum + amt : sum;
  }, 0);
  if (approved <= 0) {
    approved = sanitizePositive(
      project?.projectData?.changeOrderTotal ?? project?.changeOrderTotal ?? project?.rawProject?.projectData?.changeOrderTotal
    );
  }
  return original + approved;
}

function deriveProgress(project: any, projectId: string, timelineMap: Record<string, number>, titleSlug?: string): number {
  if (timelineMap[projectId] !== undefined) return timelineMap[projectId];
  if (titleSlug && timelineMap[titleSlug] !== undefined) return timelineMap[titleSlug];
  const direct = Math.max(
    toFinite(project?.overallProgressPct),
    toFinite(project?.progress),
    toFinite(project?.projectData?.overallProgressPct),
    toFinite(project?.projectData?.progress)
  );
  const milestones = [
    project?.milestones,
    project?.projectData?.milestones,
    project?.estimateData?.milestones,
    project?.estimateData?.paymentMilestones,
  ];
  const weekly = [
    project?.weeklyPayments,
    project?.projectData?.weeklyPayments,
    project?.estimateData?.weeklyPayments,
  ];
  const fromMilestones = Math.max(...milestones.map((items) => progressFromItems(items || [])));
  const fromWeekly = Math.max(...weekly.map((items) => progressFromItems(items || [])));
  return Math.max(direct, fromMilestones, fromWeekly, 0);
}

export interface CompareProjectItem {
  title: string;
  margin: number;
  spent: number;
  projectedProfit: number;
  revenue: number;
  progress: number;
  status: string;
  missingReceipts: number;
  riskFlags: string[];
  committedPOs?: number;
  budgetUsedPct?: number;
}

export function computeProjectsCompareData(
  activeProjects: any[],
  estimates: any[],
  projectDataOverrides: Record<string, any>,
  timelineProgress: Record<string, number>
): CompareProjectItem[] {
  const all = [...activeProjects, ...estimates].filter((p) => {
    const status = (p?.status || 'draft').toString().toLowerCase();
    return status !== 'draft' && status !== 'estimate' &&
      ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'].includes(status);
  });

  const items: CompareProjectItem[] = [];
  const seen = new Set<string>();

  for (const p of all) {
    const pid = String(p?.id ?? '');
    const title = String(p?.title || p?.name || '').trim();
    const t = title.toLowerCase();
    if (!ALLOWED_NAMES.some((n) => t === n || t.startsWith(n + ' ') || t.startsWith(n + '-') || t.startsWith(n + "'"))) continue;
    const key = PROJECT_ORDER.find((n) => t === n || t.startsWith(n)) ?? t;
    if (seen.has(key)) continue;
    seen.add(key);

    const override = projectDataOverrides[pid];
    const merged = override ? { ...p, projectData: { ...(p?.projectData || {}), ...override } } : p;
    const status = String(merged?.status || merged?.projectData?.status || '').toLowerCase();

    const revenue = getProjectRevenue(merged);
    const titleSlug = t.replace(/\s+/g, '-');
    const progressPct = deriveProgress(merged, pid, timelineProgress, titleSlug);
    const finalProgress = status === 'completed' ? 100 : progressPct;
    const rawProgress = finalProgress / 100;

    const pd = merged?.projectData ?? merged;
    const expensesTotal = sanitizePositive(pd?.spent) ||
      (Array.isArray(pd?.expenses) && pd.expenses.length
        ? pd.expenses.reduce((s: number, e: any) => s + toFinite(e?.amount ?? 0), 0)
        : Array.isArray(pd?.buckets)
          ? pd.buckets.reduce((s: number, b: any) => s + toFinite(b?.spent ?? 0), 0)
          : 0);
    const rawPOs = pd?.purchaseOrders ?? merged?.purchaseOrders ?? [];
    const receivedPOs = Array.isArray(rawPOs)
      ? rawPOs.filter((po: any) => String(po?.status || '').toLowerCase() === 'received').reduce((s: number, po: any) => s + toFinite(po?.amount ?? 0), 0)
      : 0;
    const actualCost = expensesTotal + receivedPOs || toFinite(merged?.actualCost ?? merged?.totalSpent ?? pd?.actualCost ?? 0);
    const estimatedCost = toFinite(merged?.estimatedCost ?? merged?.projectData?.estimatedCost ?? merged?.estimateData?.totalCost ?? merged?.estimateData?.estimatedCost ?? 0);
    const committedPOs = Array.isArray(rawPOs)
      ? rawPOs.filter((po: any) => String(po?.status || '').toLowerCase() !== 'received').reduce((s: number, po: any) => s + toFinite(po?.amount ?? 0), 0)
      : 0;

    const forecast = revenue > 0
      ? computeProfitForecast({
          contractValue: revenue,
          adjustedBudget: estimatedCost > 0 ? estimatedCost : revenue,
          estimatedCostBaseline: estimatedCost > 0 ? estimatedCost : undefined,
          actualExpenses: actualCost,
          committedPOs,
          progressPct: rawProgress * 100,
          isCompleted: status === 'completed',
        })
      : null;

    const margin = forecast?.projectedMarginPct ?? 0;
    const projectedProfit = forecast?.projectedProfit ?? 0;
    const expenses = merged?.expenses || pd?.expenses || [];
    const missingReceipts = expenses.filter((e: any) => !e?.receiptUri || !String(e.receiptUri).trim()).length;

    const budget = estimatedCost > 0 ? estimatedCost : revenue;
    const overBudgetPct = budget > 0 ? ((actualCost - budget) / budget) * 100 : 0;
    // Budget used %: match project-detail/Overview — spent / (contract value + approved COs)
    // Project-detail uses adjustedBudget = budgeted + approved COs where budgeted = grandTotal/bidPrice
    const budgetForUsedPct = revenue;
    const milestones = merged?.milestones || pd?.milestones || merged?.weeklyPayments || pd?.weeklyPayments || [];
    const overdue = Array.isArray(milestones) ? milestones.filter((m: any) => {
      const st = String(m?.status || '').toLowerCase();
      if (st.includes('complete') || st.includes('paid') || st.includes('collected')) return false;
      const dt = new Date(m?.plannedDate || m?.scheduledDate || m?.dueDate || 0);
      return Number.isFinite(dt.getTime()) && dt.getTime() < Date.now();
    }) : [];

    const riskFlags: string[] = [];
    if (overBudgetPct > 10) riskFlags.push('over_budget');
    if (margin > 0 && margin < 10) riskFlags.push('low_margin');
    if (overdue.length > 0) riskFlags.push('overdue_milestones');
    if (progressPct > 0 && budget > 0 && (actualCost / budget * 100) > progressPct + 20) riskFlags.push('spend_ahead_of_progress');
    if (missingReceipts >= 3) riskFlags.push('missing_receipts');
    if (actualCost === 0 && revenue > 0) riskFlags.push('margin_erosion');

    const displayStatus = status === 'completed' ? 'Completed' : status === 'won' || status === 'in_progress' || status === 'active' ? 'Active' : 'Submitted';
    const budgetUsedPct = budgetForUsedPct > 0 ? Math.round((actualCost / budgetForUsedPct) * 100) : 0;

    items.push({
      title,
      margin: Math.round(margin * 10) / 10,
      spent: Math.round(actualCost),
      projectedProfit: Math.round(projectedProfit),
      revenue,
      progress: finalProgress,
      status: displayStatus,
      missingReceipts,
      riskFlags,
      committedPOs: Math.round(committedPOs),
      budgetUsedPct,
    });
  }

  return items.sort((a, b) => {
    const aIdx = PROJECT_ORDER.findIndex((n) => (a.title || '').toLowerCase().startsWith(n));
    const bIdx = PROJECT_ORDER.findIndex((n) => (b.title || '').toLowerCase().startsWith(n));
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });
}
