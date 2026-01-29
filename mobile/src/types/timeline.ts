export type MilestoneStatus = "completed" | "in_progress" | "pending";
export type MilestoneCostCategory = "materials" | "labor" | "equipment" | "other";

export interface Milestone {
  id: string;
  title: string;
  plannedDate: string;     // ISO string "2025-03-01"
  progressPct: number;     // 0–100
  status: MilestoneStatus;
  assignee?: string;       // e.g., "BrightSpark Electrical LLC"
  costDelta?: number;      // +2500 means $2,500 over, -800 under
  costCategory?: MilestoneCostCategory; // Which budget category this impacts
  dependsOnId?: string;    // milestone.id this depends on
  attachmentsCount?: number;
  notesCount?: number;
  amount?: number;         // Payment amount for payment milestones
} 