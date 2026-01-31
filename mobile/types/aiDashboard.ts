export type AiInsightType = "alert" | "opportunity" | "info";

export interface AiInsight {
  id: string;
  type: AiInsightType;
  title: string;
  body: string;
  projectId?: string | null;
  impactScore: number; // 1–10
}

export interface AiNextStep {
  id: string;
  label: string;
  chip: string;              // "5 min", "Save 3–7%", etc.
  projectId?: string | null;
  priority: "low" | "medium" | "high";
}

export interface AiDashboardResponse {
  insights: AiInsight[];
  nextSteps: AiNextStep[];
  ruleBasedUpdatedAt: string;  // ISO timestamp - rule-based checks (always fresh)
  aiUpdatedAt: string | null;  // ISO timestamp - AI insights (cached, may be null)
  lastUpdated: string;          // ISO timestamp - overall (most recent)
}

export interface DashboardMetrics {
  totalBids: number;
  activeWonCount: number;
  overviewProfit: number;
}



