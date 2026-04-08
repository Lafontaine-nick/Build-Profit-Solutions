import AsyncStorage from "@react-native-async-storage/async-storage";

const TIMELINE_V2_PREFIX = "bps.timeline.v2.";
const LEGACY_TIMELINE_PREFIX = "timeline_";

export type MarkPaymentCollectedAction = {
  milestoneId?: string;
  milestoneName?: string;
  amount?: number;
  collectedAt?: string;
};

function isDepositMilestone(m: any): boolean {
  const t = (m?.title || m?.name || m?.description || "").toLowerCase();
  return t.includes("deposit") || String(m?.type || "").toLowerCase() === "deposit";
}

/** Same rollup as project-detail / TimelineTabV2 (deposit excluded from %). */
export function computeOverallProgressExcludingDeposit(milestones: any[]): number {
  const work = milestones.filter((m) => !isDepositMilestone(m));
  if (!work.length) return 0;
  const total = work.reduce((sum, m) => {
    const pct = Math.min(100, Math.max(0, Number(m.progressPct) || 0));
    return sum + pct;
  }, 0);
  return Math.round(total / work.length);
}

function milestoneMatchesAction(
  item: any,
  action: MarkPaymentCollectedAction
): boolean {
  if (action.milestoneId && item.id === action.milestoneId) return true;
  if (!action.milestoneName) return false;
  const needle = action.milestoneName.toLowerCase().trim();
  const title = (item.title || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  if (title.includes(needle) || name.includes(needle)) return true;
  if (needle.includes("deposit")) {
    return (
      title.includes("deposit") ||
      name.includes("deposit") ||
      String(item.type || "").toLowerCase() === "deposit"
    );
  }
  return false;
}

/**
 * Build timeline-shaped milestones from project/estimate when AsyncStorage is empty.
 * Mirrors project-detail mark_payment_collected bootstrap.
 */
export function buildTimelineMilestonesFromProjectData(projectData: any): any[] {
  if (!projectData) return [];

  let paymentMilestones: any[] = [];
  if (projectData?.milestones?.length) {
    paymentMilestones = projectData.milestones;
  } else if (projectData?.weeklyPayments?.length) {
    paymentMilestones = projectData.weeklyPayments.map((w: any, i: number) => ({
      id: w.id || `week-${i}`,
      title: w.description || w.name || `Week ${w.weekNumber || i + 1} Payment`,
      name: w.description || w.name || `Week ${w.weekNumber || i + 1} Payment`,
      amount: w.amount || w.paymentAmount || 0,
      paymentAmount: w.paymentAmount ?? w.amount,
      plannedDate: w.scheduledDate || w.dueDate || w.plannedDate,
      scheduledDate: w.scheduledDate || w.dueDate,
      dueDate: w.dueDate,
      status: w.status || "pending",
      progressPct: w.progressPct || (w.status === "completed" ? 100 : 0),
      type: w.type,
    }));
  } else if (projectData?.estimateData?.paymentMilestones?.length) {
    paymentMilestones = projectData.estimateData.paymentMilestones;
  } else if (projectData?.estimateData?.weeklyPayments?.length) {
    paymentMilestones = projectData.estimateData.weeklyPayments.map(
      (w: any, i: number) => ({
        id: w.id || `week-${i}`,
        title: w.description || w.name || `Week ${w.weekNumber || i + 1} Payment`,
        name: w.description || w.name || `Week ${w.weekNumber || i + 1} Payment`,
        amount: w.amount || w.paymentAmount || 0,
        paymentAmount: w.paymentAmount ?? w.amount,
        plannedDate: w.scheduledDate || w.dueDate || w.plannedDate,
        scheduledDate: w.scheduledDate || w.dueDate,
        dueDate: w.dueDate,
        status: w.status || "pending",
        progressPct: w.progressPct || (w.status === "completed" ? 100 : 0),
        type: w.type,
      })
    );
  }

  return paymentMilestones.map((pm: any, index: number) => ({
    id: pm.id || `milestone-${index}`,
    title: pm.title || pm.name || pm.description || `Payment ${index + 1}`,
    name: pm.name || pm.title,
    type: pm.type,
    plannedDate:
      pm.plannedDate ||
      pm.scheduledDate ||
      pm.dueDate ||
      new Date().toISOString().split("T")[0],
    status: pm.status || "pending",
    progressPct: pm.progressPct || (pm.status === "completed" ? 100 : 0),
    amount: pm.amount || pm.paymentAmount || 0,
    assignee: pm.assignee || "Client",
  }));
}

export type ApplyMarkPaymentResult = {
  /** True if at least one milestone was updated */
  matched: boolean;
  updatedMilestones: any[];
};

/**
 * Persist payment collection to `bps.timeline.v2.{projectId}` (and legacy `timeline_{id}`).
 * Bootstraps milestones from the project when storage is empty so AI works before the user opens Timeline.
 */
export async function applyMarkPaymentCollectedFromAction(
  projectId: string,
  action: MarkPaymentCollectedAction,
  getProjectData: () => any | null | undefined
): Promise<ApplyMarkPaymentResult> {
  const timelineV2Key = `${TIMELINE_V2_PREFIX}${projectId}`;
  const legacyKey = `${LEGACY_TIMELINE_PREFIX}${projectId}`;

  let existing: any[] = [];
  const rawV2 = await AsyncStorage.getItem(timelineV2Key);
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed)) existing = parsed;
    } catch {
      existing = [];
    }
  }

  if (existing.length === 0) {
    const merged = getProjectData();
    if (merged) {
      existing = buildTimelineMilestonesFromProjectData(merged);
    }
  }

  let matched = false;
  const updatedMilestones = existing.map((item: any) => {
    if (milestoneMatchesAction(item, action)) {
      matched = true;
      return {
        ...item,
        status: "completed",
        progressPct: 100,
        collectedAt: action.collectedAt || new Date().toISOString(),
        collectedAmount: action.amount,
      };
    }
    return item;
  });

  await AsyncStorage.setItem(timelineV2Key, JSON.stringify(updatedMilestones));
  await AsyncStorage.setItem(legacyKey, JSON.stringify(updatedMilestones));

  return { matched, updatedMilestones };
}
