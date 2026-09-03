export type AiInsightType = "alert" | "opportunity" | "info";

export type AiInsightActionTarget =
  | { kind: "project_overview" }
  | { kind: "budget_tab" }
  | { kind: "budget_category"; category: string }
  | { kind: "rate_insights"; lineId?: string; section?: "materials" | "labor" | "other" };

export interface AiInsight {
  id: string;
  type: AiInsightType;
  title: string;
  body: string;
  projectId?: string | null;
  impactScore: number; // 1–10
  /** Actual dollar overrun when the insight is budget-related. */
  impactDollars?: number | null;
  evidence?: string[];
  leakType?: string;
  actionTarget?: AiInsightActionTarget;
  /** When true, insight is a closed-job summary (net profit) — not operational pipeline advice */
  retrospective?: boolean;
}

export interface AiNextStep {
  id: string;
  label: string;
  chip: string;              // "5 min", "Save 3–7%", etc.
  projectId?: string | null;
  priority: "low" | "medium" | "high";
  leakType?: string;
  actionTarget?: AiInsightActionTarget;
}

export interface DailyBriefRisk {
  id: string;
  type: string;
  severity: string;
  impactEstimate: number;
  headline: string;
  body: string;
  evidence?: string[];
  projectId?: string | null;
  projectTitle?: string;
}

export interface DailyBriefUpcomingPayment {
  name: string;
  amount: number;
  date?: string | null;
  projectId?: string | null;
  projectTitle?: string;
}

export interface AiDailyBrief {
  topProfitRisks: DailyBriefRisk[];
  topActions: AiNextStep[];
  upcomingPayments: DailyBriefUpcomingPayment[];
  upcomingScheduleItems: Array<Record<string, any>>;
  portfolioSummary: {
    activeProjectCount: number;
    totalProjectCount: number;
    totalProjectedProfit: number;
    averageMargin: number;
    highestRiskProject: string | null;
  };
}

export interface AiDashboardResponse {
  insights: AiInsight[];
  nextSteps: AiNextStep[];
  dailyBrief?: AiDailyBrief;
  ruleBasedUpdatedAt: string;  // ISO timestamp - rule-based checks (always fresh)
  aiUpdatedAt: string | null;  // ISO timestamp - AI insights (cached, may be null)
  lastUpdated: string;          // ISO timestamp - overall (most recent)
}

export interface DashboardMetrics {
  totalBids: number;
  activeWonCount: number;
  overviewProfit: number;
}



