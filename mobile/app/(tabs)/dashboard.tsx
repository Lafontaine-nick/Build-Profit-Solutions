import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  SafeAreaView,
  Animated,
  Modal,
  Platform,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Alert,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useProjectList } from "@/contexts/ProjectListContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAIManagerMode } from "@/hooks/useAIManagerMode";
import AIAssistantModal from "@/components/AIAssistantModal";
import ProfileAnalytics from "@/components/ProfileAnalytics";
import GreyCalendar from "@/components/GreyCalendar";
import * as Haptics from "expo-haptics";
import { apiService } from "@/services/api";
import type { AiDashboardResponse, AiInsight, AiNextStep } from "@/types/aiDashboard";
import { clerkAuthService } from "@/services/clerkAuth";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CalendarEvent } from "@/components/ProjectCalendar";
import {
  ScreenLayout,
  isDesktopWebLayoutWidth,
  DASHBOARD_WEB_MAX_CONTENT_WIDTH,
  WEB_DESKTOP_EDGE_HORIZONTAL,
} from "@/constants/ScreenLayout";
import { useTabScrollBottomInset } from "@/hooks/useTabScrollBottomInset";
import { KEYBOARD_SCROLL_DEFAULTS } from "@/constants/keyboardScrollProps";
import { TabScreenHeader } from "@/components/ui/TabScreenHeader";
import {
  formatMoneyUSD,
  formatMoneyCompact,
  formatDateShort,
  formatTimeShort,
} from "@/utils/formatters";
import { splitEventNotesForDisplay } from "@/utils/calendarEventDisplay";
import { dashboardGreetingFromProfile, type DashboardGreeting } from "@/utils/dashboardGreeting";
import Constants from "expo-constants";
import { useUser } from "@clerk/clerk-react";
import {
  bucketForNextStep,
  firstSupportingSentence,
  groupNextStepsByBucket,
  heroKickerForInsight,
  humanizeNextStepLabel,
  inferCtaFromStep,
  portfolioPatternBullets,
  sortNextStepsForControlCenter,
  type ActionBucket,
} from "@/utils/aiInsightsUi";
import { getProjectRevenue } from "@/lib/projectRevenue";
import { computeProfitForecast } from "@/src/lib/profitForecast";
import {
  computeProfitabilityByProjectType,
  getCompletedProjectMarginPercent,
  getCompletedProjectProfit,
} from "@/lib/completedProjectProfitability";

const AI_DASHBOARD_FETCH_TIMEOUT_MS = 60_000;

function createEmptyAiDashboardResponse(): AiDashboardResponse {
  const now = new Date().toISOString();
  return {
    insights: [],
    nextSteps: [],
    ruleBasedUpdatedAt: now,
    aiUpdatedAt: null,
    lastUpdated: now,
  };
}

// Exclude deposit from progress — paid before work starts; Week 1+ represents actual work
const isDepositMilestone = (m: any): boolean => {
  const t = (m?.title || m?.name || m?.description || "").toLowerCase();
  return t.includes("deposit") || m?.type === "deposit" || m?.weekNumber === 0;
};

// Helper to calculate progress from milestone items (same logic as TimelineTabV2 and projects.tsx)
const computeOverallPctFromItems = (items: any[]): number => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => {
    const pct = Math.min(100, Math.max(0, m.progressPct || (m.status === 'completed' ? 100 : m.status === 'in_progress' ? 50 : 0)));
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
};

const toFiniteNumber = (value: any): number => {
  if (value == null) return 0;
  const num = typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
};

const progressFromItems = (items: any[]): number => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const total = workItems.reduce((sum, item) => {
    if (item.status === 'completed') return sum + 100;
    if (item.status === 'in_progress') return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / workItems.length);
};

const deriveUnifiedProgressPct = (project: any, projectId: string, timelineProgressMap: Record<string, number>): number => {
  // Timeline is source of truth (deposit excluded) — try pid, then title
  if (timelineProgressMap[projectId] !== undefined) {
    return timelineProgressMap[projectId];
  }
  const titleLower = String(project?.title || project?.name || '').trim().toLowerCase();
  const titleSlug = titleLower.replace(/\s+/g, '-');
  if (titleLower && timelineProgressMap[titleLower] !== undefined) return timelineProgressMap[titleLower];
  if (titleSlug && timelineProgressMap[titleSlug] !== undefined) return timelineProgressMap[titleSlug];

  // Fallback to direct progress fields
  const directProgress = Math.max(
    toFiniteNumber(project?.overallProgressPct),
    toFiniteNumber(project?.progress)
  );

  // Fallback to calculating from project's milestone/weeklyPayment arrays
  const milestonesCandidates = [
    project?.milestones,
    project?.projectData?.milestones,
    project?.estimateData?.milestones,
    project?.estimateData?.paymentMilestones,
  ];
  const weeklyCandidates = [
    project?.weeklyPayments,
    project?.projectData?.weeklyPayments,
    project?.estimateData?.weeklyPayments,
  ];

  const derivedFromMilestones = Math.max(...milestonesCandidates.map((items) => progressFromItems(items)));
  const derivedFromWeekly = Math.max(...weeklyCandidates.map((items) => progressFromItems(items)));

  // Use the strongest available signal so weekly and milestone schedules are treated equally.
  return Math.max(directProgress, derivedFromMilestones, derivedFromWeekly, 0);
};

type TabKey = "overview" | "analytics" | "calendar" | "insights";

// Status theme matching projects page
const statusTheme: Record<string, { bg: string; border: string; color: string }> = {
  Active: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Completed: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Submitted: { bg: 'rgba(148, 163, 184, 0.24)', border: 'rgba(148, 163, 184, 0.4)', color: '#f1f5f9' },
  Won: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Draft: { bg: 'rgba(148, 163, 184, 0.2)', border: 'rgba(148, 163, 184, 0.35)', color: '#e2e8f0' },
};

/** Completed-job retrospective rows (realized profit) — not generic "info" noise. */
const isRetrospectiveCompletedInsight = (i: any) =>
  i?.retrospective === true || String(i?.id || "").startsWith("completed-retrospective-");

/** Overview AI insights: urgency first, then impact; deprioritize low-material receipt chatter. */
const sortInsightsForOverview = (insights: any[]): any[] => {
  const typeRank: Record<string, number> = { alert: 0, opportunity: 1, info: 2 };
  /** Retrospective is typed as `info` but must surface in the 2-card preview above generic info. */
  const sortTier = (i: any) => {
    if (isRetrospectiveCompletedInsight(i)) return 0.5;
    return typeRank[String(i?.type)] ?? 3;
  };
  const combined = (i: any) => `${String(i?.title || "")} ${String(i?.body || "")}`.toLowerCase();
  const keywordBoost = (i: any) => {
    const s = combined(i);
    let b = 0;
    if (/\bmargin\b|underpriced|profit/.test(s)) b += 4;
    if (/\bpermit\b|fee/.test(s)) b += 3;
    if (/over\s*run|overrun|budget|forecast/.test(s)) b += 4;
    if (/receipt|invoice|upload/.test(s) && !/missing|required|block/.test(s)) b -= 2;
    return b;
  };
  const receiptOnlyNoise = (i: any) => {
    const s = combined(i);
    return /\breceipt/.test(s) && !/\b(margin|budget|permit|overrun|risk|missing|fee)\b/.test(s);
  };
  return [...(insights || [])].sort((a, b) => {
    const ta = sortTier(a);
    const tb = sortTier(b);
    if (ta !== tb) return ta - tb;
    const impactDiff =
      (Number(b?.impactScore) || 0) - (Number(a?.impactScore) || 0);
    if (impactDiff !== 0) return impactDiff;
    const kw = keywordBoost(b) - keywordBoost(a);
    if (kw !== 0) return kw;
    const noise = Number(receiptOnlyNoise(a)) - Number(receiptOnlyNoise(b));
    if (noise !== 0) return noise;
    return 0;
  });
};

function formatAiDashboardUsdCompact(n: number): string {
  if (!Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

/**
 * Production API (e.g. Render) may not deploy `completedSummaries` / rule-based retrospective rows yet.
 * When the app already computed closed-job profit locally, append any missing cards so the UI matches
 * a fully updated backend.
 */
function appendMissingClientRetrospectiveInsights(
  insights: AiInsight[],
  completedSummaries: Array<{
    id: string;
    title: string;
    netProfit: number;
    netProfitPct?: number | null;
  }>
): AiInsight[] {
  if (!Array.isArray(completedSummaries) || completedSummaries.length === 0) {
    return insights;
  }
  const seen = new Set((insights ?? []).map((i) => String(i.id)));
  const extra: AiInsight[] = [];
  for (const c of completedSummaries) {
    if (c?.id == null || String(c.id).trim() === "") continue;
    const rid = `completed-retrospective-${c.id}`;
    if (seen.has(rid)) continue;
    const title = String(c.title || "Job").trim() || "Job";
    const net = Number(c.netProfit ?? 0);
    const pctRaw = c.netProfitPct;
    const pctStr =
      pctRaw != null && Number.isFinite(Number(pctRaw))
        ? `${Number(pctRaw).toFixed(1)}%`
        : "—";
    extra.push({
      id: rid,
      type: "info",
      title: `${title}: realized net profit`,
      body: `This job is closed. Realized net profit was about ${formatAiDashboardUsdCompact(net)} (${pctStr} of contract). Use this for historical margin review — not as an open pipeline action item.`,
      projectId: String(c.id),
      impactScore: 5,
      retrospective: true,
    });
    seen.add(rid);
  }
  return [...(insights ?? []), ...extra];
}

/**
 * Same title often appears twice when rule-based + GPT both emit a card, or when
 * one row has projectId and the other does not. Keeps first (prefer server order).
 */
function dedupeAiInsightsByNormalizedTitle(insights: AiInsight[]): AiInsight[] {
  if (!insights?.length) return insights ?? [];
  const seen = new Set<string>();
  const out: AiInsight[] = [];
  for (const ins of insights) {
    const t = ins.title != null ? String(ins.title).trim().toLowerCase() : "";
    if (t) {
      if (seen.has(t)) continue;
      seen.add(t);
    }
    out.push(ins);
  }
  return out;
}

function dedupeAiNextStepsByNormalizedLabel(steps: AiNextStep[]): AiNextStep[] {
  if (!steps?.length) return steps ?? [];
  const seen = new Set<string>();
  const out: AiNextStep[] = [];
  for (const st of steps) {
    const lb = st.label != null ? String(st.label).trim().toLowerCase() : "";
    if (lb) {
      if (seen.has(lb)) continue;
      seen.add(lb);
    }
    out.push(st);
  }
  return out;
}

function buildFallbackDailyBrief(
  insights: AiInsight[],
  nextSteps: AiNextStep[],
  projects: any[]
): NonNullable<AiDashboardResponse["dailyBrief"]> {
  const projectNameById = new Map<string, string>();
  for (const project of projects || []) {
    projectNameById.set(String(project.id), project.name || "Project");
  }

  const topProfitRisks = (insights || [])
    .slice(0, 5)
    .map((insight) => ({
      id: String(insight.id),
      type: insight.leakType || insight.type,
      severity:
        insight.type === "alert"
          ? "high"
          : insight.type === "opportunity"
            ? "medium"
            : "low",
      impactEstimate: Number(insight.impactScore || 0) * 1000,
      headline: insight.title,
      body: insight.body,
      evidence: insight.evidence || [],
      projectId: insight.projectId ?? null,
      projectTitle: insight.projectId ? projectNameById.get(String(insight.projectId)) || "Project" : "Portfolio",
    }));

  return {
    topProfitRisks,
    topActions: (nextSteps || []).slice(0, 5),
    upcomingPayments: [],
    upcomingScheduleItems: [],
    portfolioSummary: {
      activeProjectCount: Array.isArray(projects) ? projects.filter((p) => p.status === "Active").length : 0,
      totalProjectCount: Array.isArray(projects) ? projects.length : 0,
      totalProjectedProfit: 0,
      averageMargin: 0,
      highestRiskProject: topProfitRisks[0]?.projectTitle || null,
    },
  };
}

function collectTruthyDateStrings(...vals: unknown[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) out.push(s);
  }
  return out;
}

/**
 * Latest **job completion** instant among estimate + project fields.
 * Picks the maximum valid date so a stale `estimateData.endDate` does not override a current `endDate`.
 * Does not use top-level `dueDate` (often bid / milestone noise).
 */
function getLatestJobEndPick(projectRecord: any): { raw: string; date: Date } | null {
  if (!projectRecord) return null;
  const est = projectRecord.estimateData || {};
  const pd = projectRecord.projectData || {};
  const ped = pd.estimateData || {};
  const raws = collectTruthyDateStrings(
    projectRecord.projectEndDate,
    est.projectEndDate,
    est.endDate,
    est.endISO,
    ped.projectEndDate,
    ped.endDate,
    ped.endISO,
    projectRecord.endDate,
    projectRecord.endISO,
    pd.endDate,
    pd.endISO
  );
  let best: { raw: string; date: Date } | null = null;
  for (const raw of raws) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    if (!best || date.getTime() > best.date.getTime()) best = { raw, date };
  }
  return best;
}

function milestoneRowLooksComplete(m: any): boolean {
  const p = Number(m?.progressPct ?? m?.progress ?? 0);
  if (Number.isFinite(p) && p >= 100) return true;

  const s = String(m?.status || '').toLowerCase().trim();
  if (!s) return false;

  // Never use naive `includes('complete')` / `includes('paid')`: "incomplete" contains
  // "complete" and "unpaid" contains "paid", which would drop real pending dates from schedule.
  if (
    /\b(incomplete|unpaid|not[_\s-]?paid|pending|scheduled|open|draft|upcoming)\b/.test(s)
  ) {
    return false;
  }
  if (/\b(completed|complete|collected|closed|done)\b/.test(s)) return true;
  if (/\bpaid\b/.test(s)) return true;

  return false;
}

/** Latest planned instant among non-complete rows (AsyncStorage timeline + embedded milestones). */
function maxPlannedMsFromMilestoneList(milestones: any[]): number | null {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;
  let maxMs: number | null = null;
  for (const m of milestones) {
    if (milestoneRowLooksComplete(m)) continue;
    const raw = m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.dateISO || m?.date;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (maxMs == null || t > maxMs) maxMs = t;
  }
  return maxMs;
}

function resolveTimelineLatestPlannedMsFromMap(
  projectRecord: any,
  latestMap: Record<string, number>
): number | null {
  if (!projectRecord || !latestMap || typeof latestMap !== 'object') return null;
  const normalizeTimelineKey = (v: string) =>
    String(v || '').trim().toLowerCase().replace(/\s+/g, '-');
  const pid = String(projectRecord?.id ?? '').trim();
  const titleRaw = String(projectRecord?.title ?? projectRecord?.name ?? '').trim().toLowerCase();
  const titleSlug = normalizeTimelineKey(titleRaw);
  const titleCompact = titleRaw.replace(/\s+/g, '');
  const candidates = [pid, titleRaw, titleSlug, titleCompact, pid.toLowerCase()].filter(Boolean);
  let best: number | null = null;
  for (const c of candidates) {
    const ms = latestMap[c] ?? latestMap[normalizeTimelineKey(c)];
    if (ms != null && Number.isFinite(ms) && (!best || ms > best)) best = ms;
  }
  return best;
}

/** Latest planned date among pending timeline / payment rows (extends schedule past stale job end). */
function getLatestPendingSchedulePick(projectRecord: any): { raw: string; date: Date } | null {
  if (!projectRecord) return null;
  const est = projectRecord.estimateData || {};
  const pd = projectRecord.projectData || {};
  const ped = pd.estimateData || {};
  const arrays = [
    projectRecord.milestones,
    projectRecord.weeklyPayments,
    projectRecord.paymentMilestones,
    est.milestones,
    est.paymentMilestones,
    est.weeklyPayments,
    ped.paymentMilestones,
    ped.weeklyPayments,
    pd.milestones,
    pd.weeklyPayments,
    pd.paymentMilestones,
  ];
  let best: { raw: string; date: Date } | null = null;
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const m of arr) {
      if (milestoneRowLooksComplete(m)) continue;
      const raw = m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.dateISO || m?.date;
      if (!raw) continue;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) continue;
      if (!best || date.getTime() > best.date.getTime()) best = { raw: String(raw), date };
    }
  }
  return best;
}

/**
 * Schedule “through” date: latest of (job target end, embedded pending milestones, optional live timeline from storage).
 * `timelineLatestPlannedMs` comes from `bps.timeline.v2.*` — same source as progress %.
 */
function getEffectiveScheduleEndPick(
  projectRecord: any,
  timelineLatestPlannedMs?: number | null
): { raw: string; date: Date } | null {
  const job = getLatestJobEndPick(projectRecord);
  const sched = getLatestPendingSchedulePick(projectRecord);
  let chosen: { raw: string; date: Date } | null = null;
  if (!job && !sched) chosen = null;
  else if (!sched) chosen = job;
  else if (!job) chosen = sched;
  else chosen = job.date.getTime() >= sched.date.getTime() ? job : sched;

  if (timelineLatestPlannedMs != null && Number.isFinite(timelineLatestPlannedMs)) {
    const t = timelineLatestPlannedMs;
    if (!chosen || t > chosen.date.getTime()) {
      return { raw: new Date(t).toISOString(), date: new Date(t) };
    }
  }
  return chosen;
}

/** Earliest valid job start (for rejecting end < start bad pairs). */
function getEarliestJobStartDate(projectRecord: any): Date | null {
  if (!projectRecord) return null;
  const est = projectRecord.estimateData || {};
  const pd = projectRecord.projectData || {};
  const ped = pd.estimateData || {};
  const raws = collectTruthyDateStrings(
    est.projectStartDate,
    est.startDate,
    ped.projectStartDate,
    ped.startDate,
    projectRecord.startDate,
    pd.startDate
  );
  let best: Date | null = null;
  for (const raw of raws) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    if (!best || d.getTime() < best.getTime()) best = d;
  }
  return best;
}

/** One subtle operational line per dashboard project card */
const getDashboardProjectOperationalSignal = (
  project: {
    rawProject: any;
    margin: number;
    progress: number;
    status: string;
    amount: number;
    marginDisplay: string;
  },
  timelineLatestPlannedMs?: number | null
): { text: string; variant: "risk" | "watch" | "muted" } => {
  const raw = project.rawProject || {};
  const isCompleted = project.status === "Completed";

  const spent = Number(
    raw.actualCost ||
      raw.projectData?.spent ||
      raw.projectData?.totalSpent ||
      raw.totalSpent ||
      0
  );
  const contract = Number(project.amount || 0);
  if (contract > 0 && spent > 0 && !isCompleted) {
    const ratio = spent / contract;
    if (ratio > 0.98) return { text: "Cost overrun risk", variant: "risk" };
    if (ratio > 0.88) return { text: "Spend nearing budget", variant: "watch" };
  }

  const m = Number(project.margin || 0);
  if (!isCompleted && m > 0 && m < 10) {
    return { text: "Low margin risk", variant: "risk" };
  }
  if (!isCompleted && m >= 10 && m < 16) {
    return { text: "Margin watch", variant: "watch" };
  }

  if (isCompleted) {
    return { text: project.marginDisplay || "Closed out", variant: "muted" };
  }
  if (project.progress >= 0.92) {
    return { text: "Nearing completion", variant: "muted" };
  }
  return { text: "On track", variant: "muted" };
};

const computePipelineTotals = (projects: any[]) => {
  let totalBidValue = 0;
  let activeProjectsValue = 0;
  let completedProfit = 0;

  projects.forEach((project: any) => {
    const status = (project?.status || "").toString().toLowerCase();
    const revenue = getProjectRevenue(project);

    // Total Bids includes: active projects (won, in_progress, active) AND submitted bids (bid_submitted, submitted) AND completed projects
    const validStatuses = [
      "won",
      "in_progress",
      "in-progress",
      "active",
      "bid_submitted",
      "submitted",
      "completed",
    ];
    
    // Total Bids includes: active projects (won, in_progress, active) AND submitted bids (bid_submitted, submitted) AND completed projects
    if (validStatuses.includes(status)) {
      totalBidValue += revenue;
    }

    // Active Projects includes: only active projects (won, in_progress, active) - NOT submitted, NOT completed
    const activeStatuses = ["active", "won", "in_progress", "in-progress"];
    if (activeStatuses.includes(status)) {
      activeProjectsValue += revenue;
    }

    if (status === "completed" && revenue > 0) {
      // Try to get actual cost first (most accurate)
      const actualCost = 
        project.actualCost ||
        project.projectData?.actualCost ||
        project.projectData?.spent ||
        project.projectData?.totalSpent ||
        project.totalSpent ||
        0;
      
      if (actualCost > 0) {
        // Use actual cost if available (revenue - actual cost = profit)
        completedProfit += revenue - actualCost;
      } else {
        // Fall back to margin-based calculation if no actual cost
        const margin = project.margin || 0;
        const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;
        completedProfit += revenue * marginRatio;
      }
    }
  });

  return { 
    totalBidValue: totalBidValue, 
    activeProjectsValue: activeProjectsValue, 
    completedProfit: completedProfit 
  };
};

const toFiniteDashboard = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
};

/** In-flight jobs (same basis as Projects “Active” tab) */
const isActiveProjectStatus = (status: string) => {
  const s = status.toLowerCase();
  return (
    s === "won" ||
    s === "in_progress" ||
    s === "in-progress" ||
    s === "active"
  );
};

/** Bids awaiting decision (same basis as Projects “Submitted” tab) */
const isSubmittedProjectStatus = (status: string) => {
  const s = status.toLowerCase();
  return s === "bid_submitted" || s === "submitted";
};

const isOpenPipelineProjectStatus = (status: string) =>
  isActiveProjectStatus(status) || isSubmittedProjectStatus(status);

function estimatedCostBaselineForDashboardForecast(project: any, revenue: number): number {
  const ed = project?.estimateData || {};
  const pd = project?.projectData || {};
  const candidates = [
    ed.estimatedCost,
    ed.totalCost,
    ed.subtotal,
    project?.estimatedCost,
    pd.estimatedCost,
    pd.totalCost,
  ];
  for (const c of candidates) {
    const v = toFiniteDashboard(c);
    if (v > 0 && v < revenue) return v;
  }
  const mRaw = toFiniteDashboard(project?.margin ?? ed.margin);
  const marginPct = Math.abs(mRaw) > 1 ? mRaw : mRaw * 100;
  if (revenue > 0 && marginPct > 0 && marginPct < 100) {
    return revenue * (1 - marginPct / 100);
  }
  return revenue > 0 ? revenue * 0.75 : 0;
}

function actualSpentForDashboardForecast(project: any): number {
  return toFiniteDashboard(
    project?.actualCost ??
      project?.projectData?.actualCost ??
      project?.projectData?.spent ??
      project?.projectData?.totalSpent ??
      project?.totalSpent
  );
}

function committedPoTotalForDashboardForecast(project: any): number {
  const raw = project?.purchaseOrders || project?.projectData?.purchaseOrders || [];
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((sum: number, po: any) => {
    if (String(po?.status || "").toLowerCase() === "cancelled") return sum;
    return sum + toFiniteDashboard(po?.amount);
  }, 0);
}

/**
 * Submitted bids: net profit from estimate (estimateData.profit) or margin % × revenue — aligns with Projects list for submitted jobs.
 */
function submittedBidNetProfit(project: any): number {
  const revenue = getProjectRevenue(project);
  if (!(revenue > 0)) return 0;

  const ed = project?.estimateData || {};
  const profitDirect = toFiniteDashboard(ed.profit ?? project?.profit);
  if (profitDirect > 0 && profitDirect < revenue) {
    return Math.round(profitDirect);
  }

  const rawM = ed.marginPercent ?? ed.margin ?? project?.margin;
  const parsedM = rawM != null ? Number(rawM) : NaN;
  if (Number.isFinite(parsedM)) {
    const marginPct = Math.abs(parsedM) > 1 ? parsedM : parsedM * 100;
    if (marginPct > 0 && marginPct < 100) {
      return Math.round(revenue * (marginPct / 100));
    }
  }

  const baseline = estimatedCostBaselineForDashboardForecast(project, revenue);
  if (baseline > 0 && baseline < revenue) {
    return Math.round(revenue - baseline);
  }
  return 0;
}

/**
 * Left card: realized net profit from completed work (same basis as Performance Snapshot / pipeline).
 * Right card: active jobs → projected net profit at completion (computeProfitForecast); submitted bids → estimate/margin net profit (same idea as Projects “Submitted”).
 */
const computeDashboardProfitOutlook = (
  projects: any[],
  rawCompletedProfit: number,
  completedJobCount: number,
  timelineProgress: Record<string, number>
) => {
  let pipelineProjectedNetProfit = 0;
  let activePipelineProjectCount = 0;
  let submittedPipelineProjectCount = 0;

  for (const p of projects) {
    const st = (p?.status || "").toString().toLowerCase();
    if (!isOpenPipelineProjectStatus(st)) continue;

    const revenue = getProjectRevenue(p);
    if (!(revenue > 0)) continue;

    if (isSubmittedProjectStatus(st)) {
      pipelineProjectedNetProfit += submittedBidNetProfit(p);
      submittedPipelineProjectCount += 1;
      continue;
    }

    if (isActiveProjectStatus(st)) {
      const pid = String(p.id ?? "");
      const progressPct = deriveUnifiedProgressPct(p, pid, timelineProgress);
      const baseline = estimatedCostBaselineForDashboardForecast(p, revenue);
      const adjustedBudget = baseline > 0 ? baseline : revenue;

      const pf = computeProfitForecast({
        contractValue: revenue,
        adjustedBudget,
        estimatedCostBaseline: baseline > 0 ? baseline : undefined,
        actualExpenses: actualSpentForDashboardForecast(p),
        committedPOs: committedPoTotalForDashboardForecast(p),
        progressPct,
        isCompleted: false,
      });
      pipelineProjectedNetProfit += pf.projectedProfit;
      activePipelineProjectCount += 1;
    }
  }

  const completedNetProfit = Number.isFinite(rawCompletedProfit) ? rawCompletedProfit : 0;
  const openPipelineProjectCount =
    activePipelineProjectCount + submittedPipelineProjectCount;

  return {
    completedNetProfit,
    pipelineProjectedNetProfit: Number.isFinite(pipelineProjectedNetProfit)
      ? pipelineProjectedNetProfit
      : 0,
    completedJobCount,
    activePipelineProjectCount,
    submittedPipelineProjectCount,
    openPipelineProjectCount,
    hasCompletedData:
      completedJobCount > 0 || completedNetProfit !== 0,
    hasOpenPipeline: openPipelineProjectCount > 0,
  };
};

// Master Calendar View - aggregates events from all projects
const PAYMENT_KEYWORDS = ['payment', 'deposit', 'milestone', 'weekly pay', 'draw'];
const INSPECTION_KEYWORDS = ['inspection', 'inspect'];
const PHASE_KEYWORDS = ['concrete', 'framing', 'drywall', 'electrical', 'plumbing', 'roof', 'foundation', 'demo', 'paint', 'phase', 'install', 'installation', 'start'];
const PO_KEYWORDS = ['purchase order', 'po ', 'p.o.', 'p.o ', ' po ', 'po#', 'po #', 'p.o#'];
const DELIVERY_KEYWORDS = ['delivery', 'deliver', 'pickup', 'pick up', 'lumber', 'cabinet', 'tile', 'material'];
const DEADLINE_KEYWORDS = ['deadline', 'due', 'permit', 'completion', 'complete by', 'final', 'project completion', 'framing completion'];
const NOISE_KEYWORDS = ['daily log', 'receipt', 'checklist', 'internal reminder', 'small task', 'note only', 'todo'];

const CALENDAR_CATEGORY_COLORS = {
  payment: '#22c55e', // green
  inspection: '#f59e0b', // yellow
  phase: '#3b82f6', // blue
  delivery: '#8b5cf6', // purple
  purchase_order: '#2dd4bf',
  deadline: '#ef4444', // red
  other: '#f97316',
} as const;

function formatCalendarCategoryLabel(
  cat: NonNullable<CalendarEvent["calendarCategory"]> | undefined
): string | null {
  if (!cat) return null;
  if (cat === "purchase_order") return "Purchase order";
  if (cat === "phase") return "Crew";
  if (cat === "other") return "Other";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function inferUserCalendarCategory(event: CalendarEvent): CalendarEvent["calendarCategory"] {
  const text = `${event.title || ""} ${event.notes || ""}`.toLowerCase();
  const has = (keywords: readonly string[]) => keywords.some((k) => text.includes(k));
  if (has(PAYMENT_KEYWORDS) || event.type === "payment") return "payment";
  if (has(INSPECTION_KEYWORDS) || event.type === "inspection") return "inspection";
  if (has(PO_KEYWORDS)) return "purchase_order";
  if (event.type === "delivery" || has(DELIVERY_KEYWORDS)) return "delivery";
  if (has(DEADLINE_KEYWORDS) || event.type === "deadline") return "deadline";
  if (has(PHASE_KEYWORDS) || event.type === "work") return "phase";
  return "other";
}

const EVENT_TYPE_COLORS: Record<CalendarEvent["type"], string> = {
  inspection: "#f59e0b",
  delivery: "#8b5cf6",
  work: "#3b82f6",
  payment: "#22c55e",
  deadline: "#ef4444",
  other: "#f97316",
};
const ACCENT_GREEN = "#19E180";
/** Emerald + cyan — Dashboard segment tabs, metrics, Profile, bpsThemeV2 */
const BPS_BRAND_GREEN = "#22c55e";
const BPS_BRAND_TEAL = "#22d3ee";

const DISMISSED_NEXT_STEPS_STORAGE_KEY = "bps.dashboard.dismissedNextSteps.v1";

/**
 * Projects included in AI dashboard insights + next steps.
 * Active / submitted / in-estimate only — never completed.
 */
const AI_DASHBOARD_PROJECT_STATUSES = new Set([
  "draft",
  "estimate",
  "bid_submitted",
  "submitted",
  "won",
  "in_progress",
  "active",
]);

function normalizePortfolioStatus(status: unknown): string {
  return (status ?? "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function isProjectEligibleForAiDashboardInsights(
  p: { id?: unknown; status?: unknown } | null | undefined
): boolean {
  if (!p || p.id == null || String(p.id).trim() === "") return false;
  const status = normalizePortfolioStatus(p.status);
  return AI_DASHBOARD_PROJECT_STATUSES.has(status);
}

/** Prefer the most advanced row when the same id appears in activeProjects + estimates (stale estimate copy). */
const STATUS_RANK_FOR_AI_DEDUPE: Record<string, number> = {
  draft: 1,
  estimate: 2,
  bid_submitted: 3,
  submitted: 3,
  won: 4,
  in_progress: 5,
  active: 5,
  completed: 6,
  complete: 6,
  closed: 6,
  done: 6,
  finished: 6,
  lost: 6,
  cancelled: 6,
  canceled: 6,
};

function dedupeProjectsByBestStatus(projects: any[]): any[] {
  const m = new Map<string, any>();
  for (const p of projects) {
    if (p?.id == null || String(p.id).trim() === "") continue;
    const id = String(p.id);
    const prev = m.get(id);
    if (!prev) {
      m.set(id, p);
      continue;
    }
    const ra = STATUS_RANK_FOR_AI_DEDUPE[normalizePortfolioStatus(p.status)] ?? 0;
    const rb = STATUS_RANK_FOR_AI_DEDUPE[normalizePortfolioStatus(prev.status)] ?? 0;
    if (ra > rb) m.set(id, p);
  }
  return [...m.values()];
}

/**
 * Jobs that should not get "active pipeline" AI (align with ProjectListContext terminal statuses).
 * Includes unified timeline progress (same signal as Projects list "Completed" when won + 100%).
 */
function isProjectClosedForDashboardAi(
  p: any,
  timelineProgressMap?: Record<string, number>
): boolean {
  const s = normalizePortfolioStatus(p?.status);
  if (
    s === "completed" ||
    s === "complete" ||
    s === "closed" ||
    s === "done" ||
    s === "finished" ||
    s === "lost" ||
    s === "cancelled" ||
    s === "canceled"
  ) {
    return true;
  }
  const prog = Math.max(
    Number(p?.overallProgressPct ?? 0),
    Number(p?.progress ?? 0),
    Number(p?.projectData?.overallProgressPct ?? 0)
  );
  if (Number.isFinite(prog) && prog >= 99) return true;

  if (timelineProgressMap != null) {
    const pid = String(p?.id ?? "");
    const unified = deriveUnifiedProgressPct(p, pid, timelineProgressMap);
    if (Number.isFinite(unified) && unified >= 99) return true;
    // Mirror projects.tsx slugForUi: active-like jobs become "Completed" in UI at 99.5%+ schedule
    const statusSlug = String(p?.status || "draft")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const activeLike =
      statusSlug === "won" ||
      statusSlug === "in_progress" ||
      statusSlug === "in-progress" ||
      statusSlug === "active";
    if (activeLike && Number.isFinite(unified) && unified >= 99.5) return true;
  }
  return false;
}

/** Ids that are closed in *any* row — blocks AI rows when a duplicate estimate copy is still open. */
function completedProjectIdsSet(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): Set<string> {
  const ids = new Set<string>();
  for (const p of [...activeProjects, ...estimates]) {
    if (
      isProjectClosedForDashboardAi(p, timelineProgress) &&
      p?.id != null &&
      String(p.id).trim() !== ""
    ) {
      ids.add(String(p.id));
    }
  }
  return ids;
}

/**
 * Closed job ids for AI filtering: stored terminal status OR timeline shows job essentially done
 * (fixes status stuck on in_progress while milestones are 100%).
 */
function buildDashboardClosedProjectIdSet(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): Set<string> {
  const ids = completedProjectIdsSet(activeProjects, estimates, timelineProgress);
  const merged = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
  for (const p of merged) {
    const pid = String(p.id ?? "");
    if (!pid) continue;
    const pct = deriveUnifiedProgressPct(p, pid, timelineProgress);
    if (Number.isFinite(pct) && pct >= 99) ids.add(pid);
  }
  return ids;
}

/** Titles for jobs considered closed (same ids as buildDashboardClosedProjectIdSet). */
function completedProjectTitlesForAiFilter(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): string[] {
  const closedIds = buildDashboardClosedProjectIdSet(activeProjects, estimates, timelineProgress);
  const titles: string[] = [];
  for (const p of [...activeProjects, ...estimates]) {
    if (!closedIds.has(String(p.id ?? ""))) continue;
    const t = String(p?.title || p?.name || "").toLowerCase().trim();
    if (t.length >= 4) titles.push(t);
  }
  return [...new Set(titles)];
}

function normalizeInsightProjectId(insight: {
  projectId?: unknown;
  project_id?: unknown;
}): string {
  const raw = insight.projectId ?? (insight as { project_id?: unknown }).project_id;
  if (raw == null) return "";
  return String(raw).trim();
}

/**
 * True if insight text likely refers to a completed job — matches full title, title without "project",
 * or first two significant words (e.g. "silver leaf" vs "silver leaf project").
 */
function aiTextReferencesCompletedJob(text: string, completedTitles: string[]): boolean {
  const hay = text.toLowerCase();
  const hayCompact = hay.replace(/\s+/g, "");
  return completedTitles.some((rawTitle) => {
    const t = rawTitle.trim();
    if (t.length < 3) return false;
    if (hay.includes(t)) return true;
    const noProject = t.replace(/\s+project\s*$/i, "").trim();
    if (noProject.length >= 3 && hay.includes(noProject)) return true;
    const words = t
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/gi, ""))
      .filter((w) => w.length > 2);
    if (words.length >= 2) {
      const pair = `${words[0]} ${words[1]}`;
      if (hay.includes(pair)) return true;
      const pairCompact = pair.replace(/\s+/g, "");
      if (pairCompact.length >= 6 && hayCompact.includes(pairCompact)) return true;
    }
    const titleCompact = t.replace(/\s+/g, "");
    if (titleCompact.length >= 6 && hayCompact.includes(titleCompact)) return true;
    return false;
  });
}

/** Stable id for persisting dismissals (API id, or project + label fallback). */
const stableNextStepId = (step: AiNextStep): string => {
  const raw = step.id != null ? String(step.id).trim() : "";
  if (raw) return raw;
  const label = String(step.label || "").slice(0, 200);
  const pid = step.projectId != null ? String(step.projectId) : "";
  return `fb:${pid}:${label}`;
};

const EVENT_TYPE_FORM_ICONS: Record<CalendarEvent["type"], string> = {
  inspection: "check-circle",
  delivery: "package",
  work: "tool",
  payment: "credit-card",
  deadline: "clock",
  other: "file-text",
};

/** Fade a hex color for completed project events (opacity 0.45) */
const fadeHexColor = (hex: string, opacity = 0.45): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

type MasterCalendarViewProps = {
  activeProjects: any[];
  estimates: any[];
};

type MasterCalendarEvent = CalendarEvent & {
  projectId: string;
  projectName: string;
  isCompletedProject?: boolean;
  isUserCreated?: boolean;
};

const toLocalISODate = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** YYYY-MM-DD at local midnight — `new Date("2026-04-02")` is UTC and shifts the calendar day in US timezones. */
function parseISODateAsLocalDay(iso: string): Date {
  const dayPart = (iso || "").split("T")[0];
  const parts = dayPart.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return new Date(NaN);
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

type UpcomingFilterKey =
  | "all"
  | "payment"
  | "inspection"
  | "delivery"
  | "purchase_order"
  | "deadline"
  | "phase"
  | "other"
  | "ai";

const matchesUpcomingFilter = (e: MasterCalendarEvent, f: UpcomingFilterKey): boolean => {
  if (f === "all") return true;
  if (f === "inspection") {
    return e.calendarCategory === "inspection" || e.type === "inspection";
  }
  if (f === "payment") {
    return e.calendarCategory === "payment" || e.type === "payment";
  }
  if (f === "delivery") {
    return e.calendarCategory === "delivery";
  }
  if (f === "purchase_order") {
    return e.calendarCategory === "purchase_order" || e.id.startsWith("po-");
  }
  if (f === "deadline") {
    return e.calendarCategory === "deadline" || e.type === "deadline";
  }
  if (f === "phase") {
    return e.calendarCategory === "phase" || e.type === "work";
  }
  if (f === "other") {
    return e.calendarCategory === "other" || e.type === "other";
  }
  if (f === "ai") return Boolean(e.isUserCreated);
  return true;
};

const MasterCalendarView: React.FC<MasterCalendarViewProps> = ({ activeProjects, estimates }) => {
  const { theme, darkMode } = useTheme();
  const Colors = React.useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [allEvents, setAllEvents] = React.useState<MasterCalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(() => toLocalISODate());
  const [upcomingFilter, setUpcomingFilter] = React.useState<UpcomingFilterKey>("all");
  const [showDateEventsModal, setShowDateEventsModal] = React.useState(false);
  const [showEventModal, setShowEventModal] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<MasterCalendarEvent | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [eventTime, setEventTime] = React.useState("");
  const [eventType, setEventType] = React.useState<CalendarEvent["type"]>("work");
  const [eventNotes, setEventNotes] = React.useState("");
  const [eventSubcontractor, setEventSubcontractor] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const includesAny = (value: string, keywords: readonly string[]) =>
    keywords.some((k) => value.includes(k));

  const toISODate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value.split('T')[0];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  };

  const categoryToType = (category: NonNullable<CalendarEvent["calendarCategory"]>): CalendarEvent["type"] => {
    switch (category) {
      case "payment":
        return "payment";
      case "inspection":
        return "inspection";
      case "phase":
        return "work";
      case "delivery":
      case "purchase_order":
        return "delivery";
      case "deadline":
        return "deadline";
      case "other":
        return "other";
    }
  };

  // Load and aggregate events from active projects only
  React.useEffect(() => {
    const loadAllEvents = async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const result: Array<CalendarEvent & { projectId: string; projectName: string; isCompletedProject?: boolean }> = [];
      const seen = new Set<string>();

      const pushUnique = (event: CalendarEvent & { projectId: string; projectName: string; isCompletedProject?: boolean }) => {
        // Validate event has required fields
        if (!event.projectId || !event.date) {
          return;
        }
        
        const key = `${event.projectId}|${event.calendarCategory || 'other'}|${event.date}|${event.title}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(event);
      };

      // Master calendar should only reflect ACTIVE projects
      const allProjects = [...activeProjects];
      
      // Create a Set of valid project IDs and names for quick lookup (normalize to strings)
      const validProjectIds = new Set<string>();
      const validProjectNames = new Set<string>();
      allProjects.forEach(p => {
        if (p?.id) {
          const id = String(p.id);
          const name = (p.title || p.name || '').toLowerCase().trim();
          validProjectIds.add(id);
          if (name) {
            validProjectNames.add(name);
          }
        }
      });
      
      // Only process projects that are in the valid list
      const projectsToProcess = allProjects.filter(p => {
        if (!p?.id) return false;
        const id = String(p.id);
        return validProjectIds.has(id);
      });

      for (const project of projectsToProcess) {
        const projectId = String(project.id);
        const projectName = project.title || project.name || 'Untitled Project';
        const projectData = project.projectData || project;
        const statusNorm = normalizePortfolioStatus(project.status);
        const isCompletedProject =
          statusNorm === "completed" || statusNorm === "complete" || statusNorm === "closed";

        // Double-check project is still valid before loading any data
        if (!validProjectIds.has(projectId)) {
          continue;
        }

        try {
          const key = `calendar_events_${projectId}`;
          const saved = await AsyncStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              parsed.forEach((event: CalendarEvent) => {
                // CRITICAL: Only process events that belong to this project
                // If event has a projectId, it must match the current projectId
                const eventProjectId = String(event.projectId || '').trim();
                if (eventProjectId && eventProjectId !== projectId) {
                  return;
                }
                
                const text = `${event.title || ''} ${event.notes || ''}`.toLowerCase();
                if (includesAny(text, NOISE_KEYWORDS)) return;

                const category = inferUserCalendarCategory(event);
                // Ensure projectId and projectName are set correctly (always use current project)
                pushUnique({ 
                  ...event, 
                  calendarCategory: category, 
                  projectId: projectId, // ALWAYS use current project ID
                  projectName: projectName, // ALWAYS use current project name
                  isCompletedProject,
                  isUserCreated: true, // From calendar_events - editable
                });
              });
            }
          }
        } catch (error) {
          console.error(`Error loading calendar events for project ${projectId}:`, error);
        }

        // 2. Payments from milestones (only if project still exists)
        if (!validProjectIds.has(projectId)) {
          continue; // Skip payments for deleted projects
        }

        const paymentMilestones: any[] = [];
        if (projectData?.milestones?.length) paymentMilestones.push(...projectData.milestones);
        if (projectData?.weeklyPayments?.length) {
          projectData.weeklyPayments.forEach((w: any, i: number) => {
            paymentMilestones.push({
              id: w.id || `week-${i}`,
              name: w.description || `Week ${w.weekNumber || i + 1} Payment`,
              amount: w.amount || 0,
              scheduledDate: w.scheduledDate,
              dueDate: w.scheduledDate,
              status: w.status || 'pending',
            });
          });
        }
        if (projectData?.estimateData?.paymentMilestones?.length) {
          paymentMilestones.push(...projectData.estimateData.paymentMilestones);
        }
        if (projectData?.estimateData?.weeklyPayments?.length) {
          projectData.estimateData.weeklyPayments.forEach((w: any, i: number) => {
            paymentMilestones.push({
              id: w.id || `week-${i}`,
              name: w.description || `Week ${w.weekNumber || i + 1} Payment`,
              amount: w.amount || 0,
              scheduledDate: w.scheduledDate,
              dueDate: w.scheduledDate,
              status: w.status || 'pending',
            });
          });
        }

        paymentMilestones.forEach((m: any) => {
          const date = toISODate(m.scheduledDate || m.dueDate || m.dateISO || m.date || m.plannedDate);
          if (!date) return;
          const amount = Number(m.paymentAmount || m.amount || 0);
          const isCollected = m.status === 'completed' || m.status === 'paid' || m.collected || m.isPaid;
          pushUnique({
            id: `payment-${projectId}-${m.id || `${date}-${amount}`}`,
            title: `${m.name || m.title || 'Payment'}${amount > 0 ? `: ${formatMoneyUSD(amount)}` : ''}`,
            date,
            type: 'payment',
            calendarCategory: 'payment',
            notes: isCollected ? 'Payment collected' : 'Payment due',
            completed: Boolean(isCollected),
            createdAt: nowIso,
            updatedAt: nowIso,
            projectId,
            projectName,
            isCompletedProject,
          });
        });

        // 3. Timeline milestones
        try {
          const timelineKey = `bps.timeline.v2.${projectId}`;
          const saved = await AsyncStorage.getItem(timelineKey);
          if (saved) {
            const timelineItems = JSON.parse(saved);
            if (Array.isArray(timelineItems)) {
              timelineItems.forEach((item: any) => {
                const date = toISODate(item.scheduledDate || item.dueDate || item.date || item.plannedDate);
                if (!date) return;
                const text = `${item.title || item.name || ''} ${item.description || ''}`.toLowerCase();
                if (includesAny(text, NOISE_KEYWORDS)) return;

                let category: CalendarEvent["calendarCategory"];
                const amount = Number(item.amount || item.paymentAmount || 0);
                if (amount > 0 || includesAny(text, PAYMENT_KEYWORDS)) category = "payment";
                else if (includesAny(text, INSPECTION_KEYWORDS)) category = "inspection";
                else if (includesAny(text, PO_KEYWORDS)) category = "purchase_order";
                else if (includesAny(text, DELIVERY_KEYWORDS)) category = "delivery";
                else if (includesAny(text, DEADLINE_KEYWORDS)) category = "deadline";
                else if (includesAny(text, PHASE_KEYWORDS)) category = "phase";
                else category = "other";

                pushUnique({
                  id: `timeline-${projectId}-${item.id || `${date}-${item.title || item.name || 'milestone'}`}`,
                  title: category === 'payment'
                    ? `${item.title || item.name || 'Payment'}${amount > 0 ? `: ${formatMoneyUSD(amount)}` : ''}`
                    : (item.title || item.name || 'Milestone'),
                  date,
                  type: categoryToType(category),
                  calendarCategory: category,
                  notes: item.description,
                  completed: item.status === 'completed' || Number(item.progressPct || 0) >= 100,
                  createdAt: item.createdAt || nowIso,
                  updatedAt: item.updatedAt || nowIso,
                  projectId,
                  projectName,
                  isCompletedProject,
                });
              });
            }
          }
        } catch (error) {
          console.error(`Error loading timeline for project ${projectId}:`, error);
        }

        // 4. Deliveries from POs
        if (projectData?.purchaseOrders?.length) {
          projectData.purchaseOrders.forEach((po: any) => {
            const date = toISODate(po.expectedDelivery);
            if (!date) return;
            pushUnique({
              id: `po-${projectId}-${po.id || `${po.poNumber || 'po'}-${date}`}`,
              title: `PO: ${po.vendor || 'Vendor'}${po.category ? ` - ${po.category}` : ''}`,
              date,
              type: "delivery",
              calendarCategory: "purchase_order",
              notes: po.description || po.notes || (po.poNumber ? `PO ${po.poNumber}` : undefined),
              completed: po.status === 'Received',
              createdAt: po.orderDate || nowIso,
              updatedAt: nowIso,
              projectId,
              projectName,
              isCompletedProject,
            });
          });
        }

        // 5. Project end date deadline
        const projectEndDate = toISODate(projectData?.endISO || projectData?.endDate || project.endDate);
        if (projectEndDate) {
          pushUnique({
            id: `project-deadline-${projectId}`,
            title: 'Project completion deadline',
            date: projectEndDate,
            type: 'deadline',
            calendarCategory: 'deadline',
            notes: `${projectName} target completion`,
            completed: false,
            createdAt: nowIso,
            updatedAt: nowIso,
            projectId,
            projectName,
            isCompletedProject,
          });
        }
      }

      // Aggressively filter out events from deleted projects
      // Only keep events where the projectId matches a valid project
      const validEvents = result.filter(event => {
        const eventProjectId = String(event.projectId || '').trim();
        const eventProjectName = (event.projectName || '').trim();
        
        // Check by ID (most reliable)
        const isValidById = eventProjectId && validProjectIds.has(eventProjectId);
        
        if (!isValidById) {
          return false;
        }
        
        return true;
      });
      
      const sortedEvents = validEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAllEvents(sortedEvents);
      setLoading(false);
    };

    loadAllEvents();
  }, [activeProjects, estimates, refreshTrigger]);

  // Format events for GreyCalendar — use faded colors for completed project events
  const calendarEvents = React.useMemo(() => {
    const baseColor = (cat: string) => CALENDAR_CATEGORY_COLORS[cat as keyof typeof CALENDAR_CATEGORY_COLORS] || '#8b5cf6';
    return allEvents.map(event => {
      const hex = event.calendarCategory ? baseColor(event.calendarCategory) : '#8b5cf6';
      const color = event.isCompletedProject ? fadeHexColor(hex) : hex;
      return { date: event.date, type: color, color };
    });
  }, [allEvents]);

  // Get events for a specific date
  const getEventsForDate = React.useCallback((dateStr: string): MasterCalendarEvent[] => {
    return allEvents.filter(event => event.date === dateStr);
  }, [allEvents]);

  // Upcoming events (next 7 days) — exclude completed jobs; local date match so payments/POs aren’t dropped by UTC shift
  const upcomingEvents = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return allEvents
      .filter((e) => {
        const me = e as MasterCalendarEvent;
        if (me.isCompletedProject) return false;
        if (e.completed) return false;
        const eventDate = parseISODateAsLocalDay(e.date);
        if (Number.isNaN(eventDate.getTime())) return false;
        return eventDate >= today && eventDate <= nextWeek;
      })
      .filter((e) => matchesUpcomingFilter(e, upcomingFilter))
      .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return a.time ? -1 : b.time ? 1 : 0;
      })
      .slice(0, 30);
  }, [allEvents, upcomingFilter]);

  const hasAnyUpcomingInWindow = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return allEvents.some((e) => {
      const me = e as MasterCalendarEvent;
      if (me.isCompletedProject) return false;
      if (e.completed) return false;
      const eventDate = parseISODateAsLocalDay(e.date);
      if (Number.isNaN(eventDate.getTime())) return false;
      return eventDate >= today && eventDate <= nextWeek;
    });
  }, [allEvents]);

  const getProjectSiteHint = React.useCallback(
    (projectId: string): string | null => {
      const p = [...activeProjects, ...estimates].find((x) => String(x?.id) === String(projectId));
      if (!p) return null;
      const pd = (p as any).projectData || p;
      const city = (p as any).customerCity || pd.customerCity;
      const st = (p as any).customerState || pd.customerState;
      const zip = (p as any).customerZip || pd.customerZip;
      if (city && st) {
        return [city, st, zip].filter(Boolean).join(", ");
      }
      const site = (p as any).siteAddress || pd.siteAddress;
      return site ? String(site).trim().slice(0, 48) || null : null;
    },
    [activeProjects, estimates],
  );

  const selectedDayContext = React.useMemo(() => {
    if (!selectedDate) {
      return { title: "Select a date", sub: "Tap the calendar to focus a day" };
    }
    const parts = selectedDate.split("-").map(Number);
    if (parts.length !== 3) return { title: "Select a date", sub: "" };
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    const count = allEvents.filter((ev) => ev.date === selectedDate).length;
    const title = `Events for ${dt.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })}`;
    const sub = count === 0 ? "No events on this day" : `${count} on this day`;
    return { title, sub };
  }, [selectedDate, allEvents]);

  const resetForm = React.useCallback(() => {
    setEventTitle("");
    setEventTime("");
    setEventType("work");
    setEventNotes("");
    setEventSubcontractor("");
    setEditingEvent(null);
    setSelectedProjectId(null);
  }, []);

  const toISODateForForm = (value: string): string => {
    const parts = value.split("-");
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 2) {
      const [month, day, yy] = parts;
      const year = `20${yy}`;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return value;
  };

  const handleSaveEvent = React.useCallback(async () => {
    const projectId = editingEvent?.projectId || selectedProjectId;
    if (!eventTitle.trim() || !eventDate || !projectId) {
      Alert.alert("Required Fields", editingEvent ? "Please enter a title and date" : "Please select a project and enter a title and date");
      return;
    }
    let dateToSave = eventDate;
    if (eventDate.includes("-") && eventDate.split("-")[0].length === 2) {
      dateToSave = toISODateForForm(eventDate);
    }
    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      id: editingEvent?.id || `event-${Date.now()}`,
      title: eventTitle.trim(),
      date: dateToSave,
      time: eventTime || undefined,
      type: eventType,
      notes: eventNotes || undefined,
      subcontractor: eventSubcontractor || undefined,
      completed: editingEvent?.completed || false,
      completedAt: editingEvent?.completedAt,
      inspectionResult: editingEvent?.inspectionResult,
      createdAt: editingEvent?.createdAt || now,
      updatedAt: now,
    };
    try {
      const key = `calendar_events_${projectId}`;
      const saved = await AsyncStorage.getItem(key);
      const existing: CalendarEvent[] = saved ? JSON.parse(saved) : [];
      const updated = editingEvent
        ? existing.map((e) => (e.id === editingEvent.id ? newEvent : e))
        : [...existing, newEvent];
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      setShowEventModal(false);
      setSelectedDate(dateToSave);
      resetForm();
      setEditingEvent(null);
      if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRefreshTrigger((t) => t + 1);
    } catch (e) {
      Alert.alert("Error", "Failed to save event");
    }
  }, [editingEvent, selectedProjectId, eventTitle, eventDate, eventTime, eventType, eventNotes, eventSubcontractor, activeProjects, resetForm]);

  const handleDeleteEvent = React.useCallback(async () => {
    const projectId = editingEvent?.projectId;
    if (!editingEvent || !projectId) return;
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const key = `calendar_events_${projectId}`;
            const saved = await AsyncStorage.getItem(key);
            const existing: CalendarEvent[] = saved ? JSON.parse(saved) : [];
            const updated = existing.filter((e) => e.id !== editingEvent.id);
            await AsyncStorage.setItem(key, JSON.stringify(updated));
            setShowEventModal(false);
            if (editingEvent?.date) setSelectedDate(editingEvent.date);
            resetForm();
            setEditingEvent(null);
            setRefreshTrigger((t) => t + 1);
          } catch (e) {
            Alert.alert("Error", "Failed to delete event");
          }
        },
      },
    ]);
  }, [editingEvent, activeProjects, resetForm]);

  // Get event color and icon helpers
  const getEventColor = React.useCallback((event: CalendarEvent & { projectId: string; projectName: string }) => {
    if (event.calendarCategory) {
      return CALENDAR_CATEGORY_COLORS[event.calendarCategory];
    }
    // Fallback to type-based colors
    const typeColors: Record<string, string> = {
      inspection: '#f59e0b', // yellow
      work: '#3b82f6', // blue
      delivery: '#8b5cf6', // purple
      payment: '#22c55e', // green
      deadline: '#ef4444', // red
      other: '#f97316', // orange
    };
    return typeColors[event.type] || '#8b5cf6';
  }, []);

  const getEventIcon = React.useCallback((event: CalendarEvent & { projectId: string; projectName: string }) => {
    if (event.calendarCategory) {
      const categoryIcons: Record<string, string> = {
        payment: "attach-money",
        inspection: "fact-check",
        phase: "construction",
        delivery: "local-shipping",
        purchase_order: "receipt",
        deadline: "event-busy",
        other: "description",
      };
      return categoryIcons[event.calendarCategory] || "calendar";
    }
    const typeIcons: Record<string, string> = {
      inspection: 'clipboard-check',
      delivery: 'truck',
      work: 'hammer',
      payment: 'attach-money',
      deadline: 'event-busy',
      other: 'alert-circle',
    };
    return typeIcons[event.type] || 'calendar';
  }, []);

  // Removed markedDates - only current date should be highlighted, not selected dates

  const COLORS = darkMode
    ? {
        bg: '#000000',
        surface: '#0f172a',
        surface2: '#1e293b',
        text: '#FFFFFF',
        subtext: 'rgba(255,255,255,0.92)',
        border: '#334155',
        green: '#22c55e',
      }
    : {
        bg: Colors.bg,
        surface: Colors.surface,
        surface2: Colors.surface2,
        text: Colors.text,
        subtext: Colors.sub,
        border: Colors.line,
        green: '#22c55e',
      };

  const calendarLegend = [
    { key: "payment", label: "Payments", color: CALENDAR_CATEGORY_COLORS.payment },
    { key: "inspection", label: "Inspections", color: CALENDAR_CATEGORY_COLORS.inspection },
    { key: "phase", label: "Crew", color: CALENDAR_CATEGORY_COLORS.phase },
    { key: "delivery", label: "Deliveries", color: CALENDAR_CATEGORY_COLORS.delivery },
    { key: "purchase_order", label: "PO", color: CALENDAR_CATEGORY_COLORS.purchase_order },
    { key: "deadline", label: "Deadlines", color: CALENDAR_CATEGORY_COLORS.deadline },
    { key: "other", label: "Other", color: CALENDAR_CATEGORY_COLORS.other },
  ] as const;

  const upcomingFilterChips: { key: UpcomingFilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "payment", label: "Payments" },
    { key: "inspection", label: "Inspections" },
    { key: "delivery", label: "Deliveries" },
    { key: "purchase_order", label: "POs" },
    { key: "deadline", label: "Deadlines" },
    { key: "phase", label: "Crew" },
    { key: "other", label: "Other" },
    { key: "ai", label: "AI" },
  ];

  return (
    <>
      <View style={{ marginTop: 4, marginBottom: 14 }}>
        <GreyCalendar
          selectedDateString={selectedDate}
          onDayPress={({ dateString }) => {
            setSelectedDate(dateString);
            setEventDate(dateString);
            const eventsOnDate = getEventsForDate(dateString);
            if (eventsOnDate.length > 0) {
              setShowDateEventsModal(true);
            } else {
              resetForm();
              const first = activeProjects.find(
                (p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed"
              );
              if (first) setSelectedProjectId(String(first.id));
              setShowEventModal(true);
            }
            if (Platform.OS === "ios") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
          events={calendarEvents}
        />
        <View style={{ marginTop: 10, paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }}>
            {selectedDayContext.title}
          </Text>
          <Text
            style={{
              fontSize: 12,
              marginTop: 3,
              color: darkMode ? "rgba(255,255,255,0.86)" : COLORS.subtext,
              fontWeight: "500",
            }}
          >
            {selectedDayContext.sub}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ marginTop: 10, gap: 10, paddingRight: 8 }}
        >
          {calendarLegend.map((item) => (
            <View
              key={item.key}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: item.color,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: darkMode ? "rgba(255,255,255,0.86)" : COLORS.subtext,
                }}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Upcoming (Next 7 Days) */}
      {allEvents.length > 0 && (
        <View style={{ paddingHorizontal: 0, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="time-outline" size={19} color={COLORS.green} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text }}>
                Upcoming · next 7 days
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  marginTop: 2,
                  color: darkMode ? "rgba(255,255,255,0.74)" : COLORS.subtext,
                  fontWeight: "500",
                }}
              >
                Actionable schedule
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 12, paddingRight: 12 }}
          >
            {upcomingFilterChips.map((chip) => {
              const active = upcomingFilter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => {
                    setUpcomingFilter(chip.key);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1,
                    backgroundColor: active
                      ? "rgba(45, 255, 196, 0.18)"
                      : darkMode
                        ? "rgba(255,255,255,0.06)"
                        : Colors.surface2,
                    borderColor: active ? "#2DFFC4" : darkMode ? "rgba(255,255,255,0.12)" : Colors.line,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: active ? "#2DFFC4" : COLORS.text,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {upcomingEvents.length === 0 ? (
            <Text
              style={{
                fontSize: 13,
                color: darkMode ? "rgba(255,255,255,0.8)" : COLORS.subtext,
                marginBottom: 8,
              }}
            >
              {!hasAnyUpcomingInWindow
                ? "Nothing scheduled in the next 7 days."
                : "No events match this filter · try All."}
            </Text>
          ) : (
            upcomingEvents.map((event) => {
              const siteHint = getProjectSiteHint(event.projectId);
              const statusLine = event.completed
                ? "Done"
                : event.notes?.toLowerCase().includes("collected")
                  ? "Payment collected"
                  : event.notes?.toLowerCase().includes("due")
                    ? "Payment due"
                    : null;
              const typeLabel =
                formatCalendarCategoryLabel(event.calendarCategory) ||
                (event.type ? String(event.type).replace(/-/g, " ") : null);
              return (
            <View
              key={event.id}
              style={{
                flexDirection: 'column',
                borderRadius: 12,
                marginBottom: 10,
                borderWidth: 1,
                overflow: 'hidden',
                backgroundColor: darkMode ? '#3d3d3d' : Colors.surface2,
                borderColor: darkMode ? '#4f4f4f' : Colors.line,
              }}
            >
              <Pressable
                style={{ flexDirection: 'row', flex: 1, paddingVertical: 10, paddingHorizontal: 11 }}
                onPress={() => {
                  if ((event as MasterCalendarEvent).isUserCreated) {
                    setEditingEvent(event as MasterCalendarEvent);
                    setEventTitle(event.title);
                    setEventDate(event.date);
                    setEventTime(event.time || "");
                    setEventType(event.type);
                    setEventNotes(event.notes || "");
                    setEventSubcontractor(event.subcontractor || "");
                    setSelectedProjectId(event.projectId);
                    setShowEventModal(true);
                  } else {
                    setSelectedDate(event.date);
                    setShowDateEventsModal(true);
                  }
                  if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={{
                  width: 4,
                  borderRadius: 2,
                  marginRight: 10,
                  alignSelf: 'stretch',
                  backgroundColor: getEventColor(event),
                }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: COLORS.text }} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <Ionicons name="calendar-outline" size={15} color={COLORS.green} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>
                      {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {event.time ? ` · ${event.time}` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                    <Ionicons name="folder-outline" size={14} color={COLORS.subtext} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: darkMode ? 'rgba(255,255,255,0.92)' : COLORS.text, flexShrink: 1 }} numberOfLines={1}>
                      {event.projectName || 'Project'}
                    </Text>
                    {(event as MasterCalendarEvent).isCompletedProject ? (
                      <View style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.15)',
                      }}>
                        <Text style={{
                          fontSize: 9,
                          fontWeight: '700',
                          color: darkMode ? 'rgba(255,255,255,0.86)' : '#334155',
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}>Completed</Text>
                      </View>
                    ) : null}
                  </View>
                  {(siteHint || event.subcontractor) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Ionicons
                        name={event.subcontractor ? 'person-outline' : 'location-outline'}
                        size={13}
                        color={COLORS.subtext}
                      />
                      <Text style={{ fontSize: 12, color: COLORS.subtext, flex: 1 }} numberOfLines={1}>
                        {event.subcontractor ? event.subcontractor : siteHint}
                        {event.subcontractor && siteHint ? ` · ${siteHint}` : ''}
                      </Text>
                    </View>
                  ) : null}
                  {(statusLine || typeLabel) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {typeLabel ? (
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                          backgroundColor: `${getEventColor(event)}18`,
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                            color: darkMode ? 'rgba(255,255,255,0.92)' : getEventColor(event),
                          }}>
                            {typeLabel}
                          </Text>
                        </View>
                      ) : null}
                      {statusLine ? (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.subtext }}>{statusLine}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {event.notes && !statusLine ? (
                    <Text style={{ fontSize: 11, marginTop: 5, color: darkMode ? 'rgba(255,255,255,0.8)' : COLORS.subtext }} numberOfLines={2}>
                      {event.notes}
                    </Text>
                  ) : null}
                  {(event as MasterCalendarEvent).isUserCreated ? (
                    <Text style={{ fontSize: 10, marginTop: 6, color: darkMode ? 'rgba(255,255,255,0.74)' : Colors.sub, fontWeight: '500' }}>
                      Editable task
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 10, marginTop: 6, color: darkMode ? 'rgba(255,255,255,0.74)' : Colors.sub, fontWeight: '500' }}>
                      From schedule
                    </Text>
                  )}
                </View>
                <MaterialIcons name={getEventIcon(event) as any} size={18} color={darkMode ? 'rgba(255,255,255,0.74)' : getEventColor(event)} style={{ marginLeft: 4 }} />
              </Pressable>
            </View>
              );
            })
          )}
        </View>
      )}

      {/* Date Events Modal */}
      <Modal
        visible={showDateEventsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDateEventsModal(false);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        }}>
          <View style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '90%',
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            /* Match ProjectCalendar date modal (project detail calendar) */
            backgroundColor: darkMode ? '#1a1a1a' : COLORS.surface,
            overflow: 'hidden',
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: COLORS.text,
              }}>
                {selectedDate ? (() => {
                  const [year, month, day] = selectedDate.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  return date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  });
                })() : 'Events'}
              </Text>
              <Pressable
                onPress={() => {
                  setShowDateEventsModal(false);
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {selectedDate && (() => {
                const eventsOnDate = getEventsForDate(selectedDate);
                if (eventsOnDate.length === 0) {
                  return (
                    <View style={{ alignItems: "center", paddingVertical: 48 }}>
                      <Ionicons name="calendar-outline" size={48} color={COLORS.subtext} />
                      <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 16, color: COLORS.text }}>
                        No events on this date
                      </Text>
                      <Pressable
                        style={{
                          marginTop: 20,
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 12,
                          backgroundColor: ACCENT_GREEN,
                        }}
                        onPress={() => {
                          setShowDateEventsModal(false);
                          resetForm();
                          setEventDate(selectedDate || "");
                          const first = activeProjects.find(
                            (p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed"
                          );
                          if (first) setSelectedProjectId(String(first.id));
                          setShowEventModal(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>New Event</Text>
                      </Pressable>
                    </View>
                  );
                }
                return (
                  <>
                    {eventsOnDate.map((event) => {
                      const me = event as MasterCalendarEvent;
                      const pay =
                        event.calendarCategory === "payment" || event.type === "payment";
                      const payDone =
                        pay &&
                        (event.completed ||
                          /collected/i.test(event.notes || ""));
                      const hasInspectionResult = !!event.inspectionResult;
                      const { primary: notePrimary, showAiAttribution } =
                        splitEventNotesForDisplay(event.notes);
                      const hidePayMeta =
                        pay &&
                        /^(payment collected|payment due)\.?$/i.test(
                          (notePrimary || "").trim()
                        );
                      const notesPrimary = hidePayMeta ? "" : notePrimary;
                      const categoryTint = pay
                        ? darkMode
                          ? "rgba(34, 197, 94, 0.12)"
                          : "rgba(34, 197, 94, 0.1)"
                        : `${getEventColor(event)}20`;
                      const typeLabel =
                        formatCalendarCategoryLabel(event.calendarCategory) ||
                        (event.type ? String(event.type).replace(/-/g, " ") : null);
                      return (
                      <Pressable
                        key={event.id}
                        onPress={() => {
                          if (me.isUserCreated) {
                            setShowDateEventsModal(false);
                            setEditingEvent(me);
                            setEventTitle(event.title);
                            setEventDate(event.date);
                            setEventTime(event.time || "");
                            setEventType(event.type);
                            setEventNotes(event.notes || "");
                            setEventSubcontractor(event.subcontractor || "");
                            setSelectedProjectId(event.projectId);
                            setShowEventModal(true);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                        }}
                        style={{
                          flexDirection: 'row',
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          backgroundColor: darkMode ? '#1e293b' : COLORS.surface2,
                          borderColor: COLORS.border,
                        }}
                      >
                        <View style={{
                          width: 4,
                          borderRadius: 2,
                          marginRight: 12,
                          alignSelf: 'stretch',
                          backgroundColor: getEventColor(event),
                        }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}>
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '600',
                              flex: 1,
                              color: COLORS.text,
                            }} numberOfLines={2}>{event.title}</Text>
                            <MaterialIcons
                              name={getEventIcon(event) as any}
                              size={18}
                              color={getEventColor(event)}
                            />
                          </View>
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 6,
                          }}>
                            <Ionicons name="folder-outline" size={14} color={COLORS.subtext} />
                            <Text style={{ fontSize: 13, color: COLORS.subtext, flexShrink: 1 }} numberOfLines={1}>
                              {event.projectName || 'Project'}
                            </Text>
                            {me.isCompletedProject ? (
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                                backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.15)',
                              }}>
                                <Text style={{
                                  fontSize: 9,
                                  fontWeight: '700',
                                  color: darkMode ? 'rgba(255,255,255,0.86)' : '#334155',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.3,
                                }}>Completed</Text>
                              </View>
                            ) : null}
                          </View>
                          {event.subcontractor ? (
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 4,
                            }}>
                              <Ionicons name="person-outline" size={14} color={COLORS.subtext} />
                              <Text style={{ fontSize: 13, color: COLORS.subtext }} numberOfLines={1}>
                                {event.subcontractor}
                              </Text>
                            </View>
                          ) : null}
                          {event.time ? (
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 4,
                            }}>
                              <Ionicons name="time-outline" size={14} color={COLORS.subtext} />
                              <Text style={{ fontSize: 13, color: COLORS.subtext }}>
                                {event.time}
                              </Text>
                            </View>
                          ) : null}
                          <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 8,
                          }}>
                            {typeLabel ? (
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                alignSelf: 'flex-start',
                                backgroundColor: categoryTint,
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  color: getEventColor(event),
                                }}>
                                  {typeLabel}
                                </Text>
                              </View>
                            ) : null}
                            {pay ? (
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                alignSelf: 'flex-start',
                                backgroundColor: payDone
                                  ? 'rgba(34, 197, 94, 0.14)'
                                  : 'rgba(245, 158, 11, 0.14)',
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  color: payDone ? COLORS.green : '#f59e0b',
                                }}>
                                  {payDone ? 'Paid' : 'Due'}
                                </Text>
                              </View>
                            ) : null}
                            {hasInspectionResult ? (
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                alignSelf: 'flex-start',
                                backgroundColor:
                                  event.inspectionResult === 'passed'
                                    ? 'rgba(34, 197, 94, 0.14)'
                                    : 'rgba(239, 68, 68, 0.14)',
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  color: event.inspectionResult === 'passed' ? COLORS.green : '#ef4444',
                                }}>
                                  {event.inspectionResult === 'passed' ? 'Passed' : 'Failed'}
                                </Text>
                              </View>
                            ) : null}
                            {event.completed &&
                            !pay &&
                            !hasInspectionResult &&
                            event.type !== 'delivery' &&
                            event.calendarCategory !== 'delivery' ? (
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                alignSelf: 'flex-start',
                                backgroundColor: 'rgba(34, 197, 94, 0.14)',
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  color: COLORS.green,
                                }}>Completed</Text>
                              </View>
                            ) : null}
                            {event.calendarCategory === 'delivery' &&
                            event.completed &&
                            !pay ? (
                              <View style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                alignSelf: 'flex-start',
                                backgroundColor: 'rgba(34, 197, 94, 0.14)',
                              }}>
                                <Text style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  color: COLORS.green,
                                }}>Received</Text>
                              </View>
                            ) : null}
                          </View>
                          {notesPrimary ? (
                            <Text style={{
                              fontSize: 12,
                              marginTop: 6,
                              color: COLORS.subtext,
                            }} numberOfLines={3}>
                              {notesPrimary}
                            </Text>
                          ) : null}
                          {showAiAttribution ? (
                            <Text style={{
                              fontSize: 10,
                              marginTop: 6,
                              fontWeight: '500',
                              color: darkMode ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)',
                            }}>From AI Assistant</Text>
                          ) : null}
                        </View>
                        {pay && payDone ? (
                          <View style={{ padding: 8, marginLeft: 8, justifyContent: 'center' }}>
                            <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                          </View>
                        ) : event.completed && !pay ? (
                          <View style={{ padding: 8, marginLeft: 8, justifyContent: 'center' }}>
                            <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                          </View>
                        ) : null}
                      </Pressable>
                      );
                    })}
                  </>
                );
              })()}
            </ScrollView>

            <View style={{
              flexDirection: "row",
              gap: 12,
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: "rgba(255, 255, 255, 0.1)",
            }}>
              <Pressable
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: COLORS.border,
                }}
                onPress={() => {
                  setShowDateEventsModal(false);
                }}
              >
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "700" }}>Close</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: ACCENT_GREEN,
                }}
                onPress={() => {
                  setShowDateEventsModal(false);
                  resetForm();
                  setEventDate(selectedDate || "");
                  const first = activeProjects.find(
                    (p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed"
                  );
                  if (first) setSelectedProjectId(String(first.id));
                  setShowEventModal(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>New Event</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Event Modal - Full page (New/Edit) - same as ProjectCalendar */}
      <Modal
        visible={showEventModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowEventModal(false);
          resetForm();
          setEditingEvent(null);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: darkMode ? "#0A0A0A" : "#F2F2F7" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? -80 : 0}
        >
          <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
            }}>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowEventModal(false);
                  resetForm();
                  setEditingEvent(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                }}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 17, fontWeight: "600", color: COLORS.text }}>
                {editingEvent ? "Edit Event" : "New Event"}
              </Text>
              <View style={{ width: 32, height: 32 }} />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Project picker - only for new events */}
              {!editingEvent && (
                <View style={{ marginBottom: 32 }}>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: "600",
                    letterSpacing: 0.3,
                    marginBottom: 8,
                    marginLeft: 4,
                    opacity: 0.9,
                    color: COLORS.subtext,
                  }}>PROJECT</Text>
                  <View style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                  }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 12 }}>
                      {activeProjects
                        .filter((p) => p?.id && (p.status || "").toString().toLowerCase() !== "completed")
                        .map((p) => {
                        const pid = String(p.id);
                        const name = p.title || p.name || "Untitled Project";
                        const isSelected = selectedProjectId === pid;
                        return (
                          <TouchableOpacity
                            key={pid}
                            activeOpacity={0.7}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setSelectedProjectId(pid);
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1.5,
                              marginRight: 8,
                              backgroundColor: isSelected ? ACCENT_GREEN : "transparent",
                              borderColor: isSelected ? ACCENT_GREEN : (darkMode ? "rgba(255,255,255,0.2)" : "rgba(60,60,67,0.2)"),
                            }}
                          >
                            <Ionicons name="folder-outline" size={18} color={isSelected ? "#fff" : COLORS.text} />
                            <Text style={{
                              fontSize: 15,
                              fontWeight: "600",
                              color: isSelected ? "#fff" : COLORS.text,
                            }} numberOfLines={1}>{name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              )}

              {/* Event Details */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  marginLeft: 4,
                  opacity: 0.9,
                  color: COLORS.subtext,
                }}>EVENT DETAILS</Text>
                <View style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                }}>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    minHeight: 44,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.12)",
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Title</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventTitle}
                      onChangeText={setEventTitle}
                      placeholder="e.g., Framing Inspection"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    minHeight: 44,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.12)",
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Date</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventDate ? (() => {
                        const [year, month, day] = eventDate.split("-");
                        if (year && month && day && year.length === 4) {
                          return `${month}-${day}-${year.slice(-2)}`;
                        }
                        return eventDate;
                      })() : ""}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^\d-]/g, "");
                        let formatted = cleaned;
                        if (cleaned.length > 2 && !cleaned.includes("-")) formatted = cleaned.slice(0, 2) + "-" + cleaned.slice(2);
                        if (formatted.length > 5 && formatted.split("-").length === 2) formatted = formatted.slice(0, 5) + "-" + formatted.slice(5, 7);
                        if (formatted.length > 8) formatted = formatted.slice(0, 8);
                        setEventDate(formatted);
                      }}
                      placeholder="MM-DD-YY"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, minHeight: 44 }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Time</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventTime}
                      onChangeText={setEventTime}
                      placeholder="09:00"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                </View>
              </View>

              {/* Type */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  marginLeft: 4,
                  opacity: 0.9,
                  color: COLORS.subtext,
                }}>TYPE</Text>
                <View style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                  padding: 12,
                }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {(["inspection", "work", "delivery", "payment", "deadline", "other"] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        activeOpacity={0.7}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setEventType(type);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 10,
                          borderWidth: 1.5,
                          backgroundColor: eventType === type ? EVENT_TYPE_COLORS[type] : "transparent",
                          borderColor: eventType === type ? EVENT_TYPE_COLORS[type] : (darkMode ? "rgba(255,255,255,0.2)" : "rgba(60,60,67,0.2)"),
                        }}
                      >
                        <Feather
                          name={EVENT_TYPE_FORM_ICONS[type] as any}
                          size={18}
                          color={eventType === type ? "#fff" : COLORS.text}
                          strokeWidth={2}
                        />
                        <Text style={{ fontSize: 15, fontWeight: "600", color: eventType === type ? "#fff" : COLORS.text }}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Additional Info */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "600",
                  letterSpacing: 0.3,
                  marginBottom: 8,
                  marginLeft: 4,
                  opacity: 0.9,
                  color: COLORS.subtext,
                }}>ADDITIONAL INFO</Text>
                <View style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: darkMode ? "#1C1C1E" : "#FFFFFF",
                }}>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    minHeight: 44,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.12)",
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, color: COLORS.text }}>Subcontractor</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, color: COLORS.text }}
                      value={eventSubcontractor}
                      onChangeText={setEventSubcontractor}
                      placeholder="e.g., ABC Electric"
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, minHeight: 100 }}>
                    <Text style={{ fontSize: 17, fontWeight: "400", width: 110, paddingTop: 12, color: COLORS.text }}>Notes</Text>
                    <TextInput
                      style={{ flex: 1, fontSize: 17, paddingVertical: 12, paddingHorizontal: 0, minHeight: 80, color: COLORS.text }}
                      value={eventNotes}
                      onChangeText={setEventNotes}
                      placeholder="Additional details..."
                      placeholderTextColor={darkMode ? "#E5E7EB" : "#C7C7CC"}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={{ marginTop: 16, gap: 12 }}>
                {editingEvent && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleDeleteEvent}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: darkMode ? "rgba(255,59,48,0.5)" : "rgba(255,59,48,0.3)",
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <Text style={{ fontSize: 17, fontWeight: "600", color: "#ef4444" }}>Delete Event</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSaveEvent}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: "center",
                    backgroundColor: darkMode ? ACCENT_GREEN : COLORS.green,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

function isClerkAuthEnabledForDashboard(): boolean {
  const publishableKey =
    Constants.expoConfig?.extra?.clerkPublishableKey ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(
    publishableKey &&
      (publishableKey.startsWith("pk_live_") ||
        (publishableKey.startsWith("pk_test_") &&
          publishableKey !== "pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk"))
  );
}

/** Syncs greeting from Clerk user (inside ClerkProvider only). */
function ClerkDashboardGreetingSync({
  setGreeting,
}: {
  setGreeting: React.Dispatch<React.SetStateAction<DashboardGreeting>>;
}) {
  const { user } = useUser();
  useEffect(() => {
    setGreeting(dashboardGreetingFromProfile(user));
  }, [user, setGreeting]);
  return null;
}

/** Fallback when the app runs without ClerkProvider. */
function LegacyDashboardGreetingSync({
  setGreeting,
}: {
  setGreeting: React.Dispatch<React.SetStateAction<DashboardGreeting>>;
}) {
  useEffect(() => {
    const sync = () => {
      setGreeting(dashboardGreetingFromProfile(clerkAuthService.getAuthState().user));
    };
    sync();
    return clerkAuthService.addListener(sync);
  }, [setGreeting]);
  return null;
}

const DashboardScreen: React.FC = () => {
  useRequireAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const tabScrollBottomInset = useTabScrollBottomInset();
  const { width: layoutWidth } = useWindowDimensions();
  const desktopWeb =
    Platform.OS === "web" && isDesktopWebLayoutWidth(layoutWidth);
  const styles = useDashboardStyles(Colors, tabScrollBottomInset);
  /** Desktop browser only (`isDesktopWebLayoutWidth` is false on iOS/Android). Narrows main column on wide monitors. */
  const webScrollContentCap = isDesktopWebLayoutWidth(layoutWidth)
    ? {
        maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
        width: "100%" as const,
        alignSelf: "center" as const,
      }
    : undefined;
  const { activeProjects, estimates } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiPmMode, setAiPmMode] = useState<boolean>(true);
  const [aiData, setAiData] = useState<AiDashboardResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [timelineProgress, setTimelineProgress] = useState<Record<string, number>>({});
  /** Max planned date (ms) from live timeline storage — extends schedule anchor past stale project endDate. */
  const [timelineLatestPlannedMs, setTimelineLatestPlannedMs] = useState<Record<string, number>>({});
  const [projectDataOverrides, setProjectDataOverrides] = useState<Record<string, any>>({});

  // Debounce refs for project changes
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProjectsHashRef = useRef<string>('');
  /** Latest dashboard-insights request wins; stale responses must not toggle loading or overwrite data */
  const aiDashboardReqSeqRef = useRef(0);
  const aiDashboardAbortRef = useRef<AbortController | null>(null);
  const clerkAuthEnabled = useMemo(() => isClerkAuthEnabledForDashboard(), []);
  const [dashboardGreeting, setDashboardGreeting] = useState<DashboardGreeting>({
    name: "there",
    initials: "?",
  });

  // Load timeline progress from AsyncStorage (same as projects page — pre-scan, title fallback)
  const loadTimelineProgress = useCallback(async () => {
    const all = [...activeProjects, ...estimates];
    const progressMap: Record<string, number> = {};
    const latestPlannedMap: Record<string, number> = {};
    const nextOverrides: Record<string, any> = {};
    const normalizeKey = (v: string) =>
      String(v || '').trim().toLowerCase().replace(/\s+/g, '-');

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const projectKeys = allKeys.filter((k) => k.startsWith('bps.project.'));
      const timelineKeys = allKeys.filter(
        (k) => k.startsWith('bps.timeline.v2.') || k.startsWith('timeline_')
      );
      const projectEntries = await AsyncStorage.multiGet(projectKeys);
      const byId: Record<string, any> = {};
      const byTitle: Record<string, any> = {};

      for (const [key, value] of projectEntries) {
        if (!value) continue;
        try {
          const parsed = JSON.parse(value);
          const idFromKey = key.replace('bps.project.', '');
          const idFromData = String(parsed?.id ?? '');
          const title = String(parsed?.title ?? '').trim().toLowerCase();
          if (idFromKey) byId[idFromKey] = parsed;
          if (idFromData) byId[idFromData] = parsed;
          if (title) byTitle[title] = parsed;
        } catch {
          /* ignore */
        }
      }

      // Pre-scan ALL timeline keys → suffix→progress (deposit excluded) and suffix→latest planned date
      const suffixToProgress: Record<string, number> = {};
      const suffixToLatestPlanned: Record<string, number> = {};
      const bumpLatest = (key: string, ms: number) => {
        const prev = suffixToLatestPlanned[key];
        suffixToLatestPlanned[key] = prev == null ? ms : Math.max(prev, ms);
      };
      for (const k of timelineKeys) {
        const suffix = k.startsWith('bps.timeline.v2.')
          ? k.replace('bps.timeline.v2.', '')
          : k.startsWith('timeline_')
            ? k.replace('timeline_', '')
            : '';
        if (!suffix) continue;
        try {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            const milestones = JSON.parse(raw);
            if (Array.isArray(milestones) && milestones.length > 0) {
              const pct = computeOverallPctFromItems(milestones);
              const suffixLower = suffix.toLowerCase();
              const suffixNorm = normalizeKey(suffix);
              suffixToProgress[suffixLower] = pct;
              suffixToProgress[suffixNorm] = pct;
              suffixToProgress[suffix] = pct;

              const latestMs = maxPlannedMsFromMilestoneList(milestones);
              if (latestMs != null) {
                bumpLatest(suffixLower, latestMs);
                bumpLatest(suffixNorm, latestMs);
                bumpLatest(suffix, latestMs);
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Resolve progress and latest planned instant for each project (pid, title, slug)
      for (const project of all) {
        const pid = String(project?.id ?? '');
        if (!pid) continue;
        const titleRaw = String(project?.title ?? project?.name ?? '').trim().toLowerCase();
        const titleSlug = normalizeKey(titleRaw);
        const titleCompact = titleRaw.replace(/\s+/g, '');
        const candidates = [pid, titleRaw, titleSlug, titleCompact, pid.toLowerCase()].filter(Boolean);
        let foundProgress: number | undefined;
        for (const c of candidates) {
          foundProgress = suffixToProgress[c] ?? suffixToProgress[normalizeKey(c)];
          if (foundProgress !== undefined) break;
        }
        if (foundProgress !== undefined) {
          progressMap[pid] = foundProgress;
          if (titleRaw) progressMap[titleRaw] = foundProgress;
          if (titleSlug) progressMap[titleSlug] = foundProgress;
        }

        let foundLatestMs: number | undefined;
        for (const c of candidates) {
          const ms = suffixToLatestPlanned[c] ?? suffixToLatestPlanned[normalizeKey(c)];
          if (ms != null && Number.isFinite(ms)) {
            foundLatestMs = foundLatestMs == null ? ms : Math.max(foundLatestMs, ms);
          }
        }
        if (foundLatestMs !== undefined) {
          latestPlannedMap[pid] = foundLatestMs;
          if (titleRaw) latestPlannedMap[titleRaw] = foundLatestMs;
          if (titleSlug) latestPlannedMap[titleSlug] = foundLatestMs;
        }

        const override = byId[pid] || (titleRaw ? byTitle[titleRaw] : undefined);
        if (override) nextOverrides[pid] = override;
      }
    } catch {
      // Keep UI responsive if storage read fails
    }

    setProjectDataOverrides(nextOverrides);
    setTimelineProgress(progressMap);
    setTimelineLatestPlannedMs(latestPlannedMap);
  }, [activeProjects, estimates]);

  useEffect(() => {
    loadTimelineProgress();
  }, [loadTimelineProgress]);

  // Reload timeline progress when dashboard is focused (to catch updates from other screens)
  useFocusEffect(
    useCallback(() => {
      loadTimelineProgress();
    }, [loadTimelineProgress])
  );

  // Compute projects hash for change detection (dedupe + timeline progress so insights refresh when schedule moves)
  const computeProjectsHash = useCallback(() => {
    const deduped = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
    const allProjects = deduped
      .filter(isProjectEligibleForAiDashboardInsights)
      .map((p) => {
        const pid = String(p.id ?? "");
        const progressPct = deriveUnifiedProgressPct(p, pid, timelineProgress);
        const expensesList: any[] = p.projectData?.expenses || p.expenses || [];
        const expensesTotal = expensesList.reduce(
          (sum: number, e: any) => sum + Number(e.amount || 0),
          0
        );
        const actualCost = Number(
          p.actualCost || p.projectData?.totalSpent || p.totalSpent || expensesTotal || 0
        );
        return {
          id: pid,
          status: p.status,
          bidPrice: p.bidPrice || 0,
          estimatedCost: p.estimatedCost || 0,
          actualCost,
          progressPct,
          margin: p.margin || 0,
          updatedAt: p.updatedAt,
        };
      });

    const sorted = [...allProjects].sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(sorted);
  }, [activeProjects, estimates, timelineProgress]);

  /**
   * Pipeline hash excludes completed-only rows, so retrospective payload changes were invisible to the
   * debouncer — add closed-job fingerprint so completedSummaries / Silver Leaf updates trigger refresh.
   */
  const computeClosedJobsAiHash = useCallback(() => {
    const merged = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
    const closedIds = buildDashboardClosedProjectIdSet(
      activeProjects,
      estimates,
      timelineProgress
    );
    const rows = merged
      .filter((p) => closedIds.has(String(p.id ?? "")))
      .map((p) => {
        const id = String(p.id ?? "");
        return {
          id,
          pct: Math.round(deriveUnifiedProgressPct(p, id, timelineProgress) * 10) / 10,
          net: Math.round((getCompletedProjectProfit(p) || 0) * 100) / 100,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(rows);
  }, [activeProjects, estimates, timelineProgress]);

  const computeAiRefreshHash = useCallback(() => {
    return `${computeProjectsHash()}|closed:${computeClosedJobsAiHash()}`;
  }, [computeProjectsHash, computeClosedJobsAiHash]);

  // Fetch AI insights function (reusable for manual refresh)
  const fetchAiData = useCallback(async (forceRefresh = false) => {
    if (!aiPmMode && !forceRefresh) {
      setAiData(null);
      setAiError(null);
      return;
    }

    const seq = ++aiDashboardReqSeqRef.current;
    aiDashboardAbortRef.current?.abort();
    const abortController = new AbortController();
    aiDashboardAbortRef.current = abortController;

    let fetchTimeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      setAiLoading(true);
      setAiError(null);
      fetchTimeoutId = setTimeout(
        () => abortController.abort(),
        AI_DASHBOARD_FETCH_TIMEOUT_MS
      );

      // Get userId from Clerk auth
      const authState = clerkAuthService.getAuthState();
      const userId = authState.user?.id || authState.user?.email || 'unknown';

      // Dedupe ids (prefer won/active over stale estimate row), then active/submitted/estimates only — completed excluded
      const allProjects = dedupeProjectsByBestStatus([...activeProjects, ...estimates])
        .filter(isProjectEligibleForAiDashboardInsights)
        .map((p) => {
          const bidPrice = Number(p.bidPrice || 0);
          const estimatedCost = Number(p.estimatedCost || 0);
          const pid = String(p.id ?? "");

          // Compute actualCost from expenses if not directly available
          const expensesList: any[] = p.projectData?.expenses || p.expenses || [];
          const expensesTotal = expensesList.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
          const actualCost = Number(p.actualCost || p.projectData?.totalSpent || p.totalSpent || expensesTotal || 0);

          // Same progress signal as project overview / timeline (not raw p.progress alone)
          const progressUnified = deriveUnifiedProgressPct(p, pid, timelineProgress);

          // Compute margin % from financials (don't trust a stored 0 when we can calculate it)
          const computedMarginPct = bidPrice > 0 && estimatedCost > 0
            ? ((bidPrice - estimatedCost) / bidPrice) * 100
            : Number(p.margin || 0);

          return {
            id: pid,
            userId: userId,
            name: p.title,
            title: p.title,
            status: p.status,
            bidPrice,
            estimatedCost,
            actualCost,
            margin: computedMarginPct,
            markup: p.markup || 0,
            location: p.location || '',
            city: p.city,
            state: p.state,
            projectType: p.projectType,
            startDate: p.startDate,
            endDate: p.endDate,
            progress: progressUnified,
            overallProgressPct: progressUnified,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            lineItems: p.estimateData?.materialLineItems || p.projectData?.buckets || [],
            receipts: p.projectData?.receipts || [],
            hasReceiptsAttached: Boolean(p.projectData?.receipts?.length),
            hasPermitFees: Boolean(p.estimateData?.hasPermitFees || p.projectData?.hasPermitFees),
            permitFeesIncluded: Boolean(p.estimateData?.permitFeesIncluded || p.projectData?.permitFeesIncluded),
            // Extra fields for PM intelligence engine
            expenses: expensesList,
            expensesCount: expensesList.length,
            committedPOs: Number(p.projectData?.committedPOs || 0),
          };
        });

      const mergedForClosed = dedupeProjectsByBestStatus([
        ...activeProjects,
        ...estimates,
      ]);
      const closedIdsForPayload = buildDashboardClosedProjectIdSet(
        activeProjects,
        estimates,
        timelineProgress
      );
      const completedSummaries = mergedForClosed
        .filter((p) => closedIdsForPayload.has(String(p.id ?? "")))
        .map((p) => ({
          id: String(p.id),
          title: String(p.title || p.name || "Job"),
          contractValue: getProjectRevenue(p),
          netProfit: getCompletedProjectProfit(p),
          netProfitPct: getCompletedProjectMarginPercent(p),
        }));

      const response = await apiService.post<AiDashboardResponse>(
        "/api/ai/dashboard-insights",
        { userId, projects: allProjects, completedSummaries, forceRefresh },
        {
          // This endpoint supports optional auth and can use userId from body.
          // Force-empty Authorization to avoid stale/expired token failures.
          headers: { Authorization: '' },
          signal: abortController.signal,
        }
      );

      const mergedResponse: AiDashboardResponse = {
        ...createEmptyAiDashboardResponse(),
        ...(response.data ?? {}),
        insights: response.data?.insights ?? [],
        nextSteps: response.data?.nextSteps ?? [],
      };

      if (__DEV__) {
        console.log('📊 AI Dashboard Response:', {
          insightsCount: mergedResponse.insights?.length || 0,
          nextStepsCount: mergedResponse.nextSteps?.length || 0,
          projectsSent: allProjects.length,
          firstInsight: mergedResponse.insights?.[0],
        });
      }

      const currentProjects = dedupeProjectsByBestStatus([
        ...activeProjects,
        ...estimates,
      ]).filter(isProjectEligibleForAiDashboardInsights);
      const currentProjectIds = new Set(currentProjects.map((p) => String(p.id)));
      const closedIds = buildDashboardClosedProjectIdSet(
        activeProjects,
        estimates,
        timelineProgress
      );
      const closedTitles = completedProjectTitlesForAiFilter(
        activeProjects,
        estimates,
        timelineProgress
      );

      // Pipeline-only ids for operational insights; closed jobs only keep retrospective rows
      const filteredData = {
        ...mergedResponse,
        insights: (mergedResponse.insights || []).filter((insight: any) => {
          const pid = normalizeInsightProjectId(insight);
          const blob = `${insight.title || ""} ${insight.body || ""}`;
          const retrospective =
            insight.retrospective === true ||
            String(insight.id || "").startsWith("completed-retrospective-");
          if (pid && closedIds.has(pid)) {
            return retrospective;
          }
          if (aiTextReferencesCompletedJob(blob, closedTitles) && !retrospective) {
            return false;
          }
          if (pid) {
            return currentProjectIds.has(pid);
          }
          return true;
        }),
        nextSteps: (mergedResponse.nextSteps || []).filter((step: any) => {
          const pid = normalizeInsightProjectId(step);
          const stepBlob = `${step.label || ""} ${step.chip || ""}`;
          if (stepBlob.toLowerCase().includes("josh")) return false;
          if (pid && closedIds.has(pid)) return false;
          if (aiTextReferencesCompletedJob(stepBlob, closedTitles)) return false;
          if (pid) {
            return currentProjectIds.has(pid);
          }
          return true;
        }),
      };
      
      const mergedInsights = dedupeAiInsightsByNormalizedTitle(
        appendMissingClientRetrospectiveInsights(
          filteredData.insights,
          completedSummaries
        )
      );
      const dedupedNextSteps = dedupeAiNextStepsByNormalizedLabel(
        filteredData.nextSteps
      );
      const filteredDataWithRetrospectives = {
        ...filteredData,
        insights: mergedInsights,
        nextSteps: dedupedNextSteps,
      };

      if (__DEV__) {
        console.log("📊 After filtering:", {
          originalInsights: mergedResponse.insights?.length || 0,
          filteredInsights: filteredData.insights.length,
          afterClientRetrospectives: mergedInsights.length,
          completedSummariesSent: completedSummaries.length,
          originalNextSteps: mergedResponse.nextSteps?.length || 0,
          filteredNextSteps: filteredData.nextSteps.length,
        });
      }

      if (seq !== aiDashboardReqSeqRef.current) return;
      setAiData(filteredDataWithRetrospectives);
    } catch (err: any) {
      if (seq !== aiDashboardReqSeqRef.current) return;

      const isAbort =
        err?.name === "AbortError" ||
        (typeof err?.message === "string" &&
          (err.message.includes("aborted") || err.message.includes("Abort")));

      if (isAbort) {
        if (__DEV__) {
          console.warn("⚠️  AI dashboard request timed out or was aborted");
        }
        setAiData(createEmptyAiDashboardResponse());
        setAiError(null);
        return;
      }

      // Check for route not found first
      const isRouteNotFound = 
        err.message?.includes("Route") && err.message?.includes("not found") ||
        err.message?.includes("Endpoint not found") ||
        err.status === 404 ||
        err.isNotFound;

      if (isRouteNotFound) {
        if (__DEV__) {
          console.log("ℹ️  AI dashboard endpoint not available, skipping AI insights");
        }
        setAiData(createEmptyAiDashboardResponse());
        setAiError(null);
        return;
      }

      // Check for network errors
      const isNetworkError = 
        err.message?.includes("Network request failed") || 
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("NetworkError") ||
        err.message?.includes("Cannot connect to backend") ||
        err.isNetworkError ||
        (err.name === "TypeError" && err.message?.includes("Network"));

      if (isNetworkError) {
        if (__DEV__) {
          console.warn("⚠️  Cannot connect to backend for AI insights:", err.message);
        }
        setAiData(createEmptyAiDashboardResponse());
        setAiError(null);
        return;
      }

      // For other errors, log appropriately
      if (__DEV__) {
        console.warn("⚠️  AI dashboard fetch error:", err.message || err);
      }

      let errorMessage = "Could not load AI insights";
      if (err.message) {
        if (err.message.includes("OpenAI API key") || err.message.includes("AI service unavailable")) {
          errorMessage = "AI service not configured. Please set up OpenAI API key.";
        } else if (err.message.includes("status: 500")) {
          errorMessage = "Server error. Please try again later.";
        } else if (
          err.message.includes("status: 401") ||
          err.message.includes("status: 403") ||
          err.message.toLowerCase().includes("invalid or expired token")
        ) {
          errorMessage = "Authentication error. Please sign in again.";
        } else {
          setAiData(createEmptyAiDashboardResponse());
          setAiError(null);
          return;
        }
      }
      setAiError(errorMessage);
      setAiData(createEmptyAiDashboardResponse());
    } finally {
      if (fetchTimeoutId) clearTimeout(fetchTimeoutId);
      if (seq === aiDashboardReqSeqRef.current) {
        setAiLoading(false);
      }
    }
  }, [aiPmMode, activeProjects, estimates, timelineProgress]);

  // Debounced effect: only fetch when projects actually change (after 10 second debounce)
  useEffect(() => {
    if (!aiPmMode) {
      setAiData(null);
      setAiError(null);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    // Pipeline + closed-job fingerprint (completed jobs were missing from pipeline-only hash)
    const currentHash = computeAiRefreshHash();

    // If hash hasn't changed, don't refetch
    if (currentHash === lastProjectsHashRef.current && aiData !== null) {
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce: wait 10 seconds after last project change before fetching
    debounceTimerRef.current = setTimeout(() => {
      lastProjectsHashRef.current = currentHash;
      fetchAiData(false);
    }, 10000); // 10 seconds debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [aiPmMode, activeProjects, estimates, computeAiRefreshHash, fetchAiData, aiData]);

  // Initial fetch when AI PM mode is toggled ON (no debounce)
  useEffect(() => {
    if (aiPmMode && !aiData && !aiLoading) {
      lastProjectsHashRef.current = computeAiRefreshHash();
      fetchAiData(false);
    }
  }, [aiPmMode, aiData, aiLoading, computeAiRefreshHash, fetchAiData]);

  // Periodic refresh: every 5 minutes, but only refresh rule-based checks
  // (AI layer is cached, so we don't need to call OpenAI every 5 min)
  useEffect(() => {
    if (!aiPmMode) return;

    const interval = setInterval(() => {
      // Only refresh if we have data (don't spam on initial load)
      if (aiData) {
        fetchAiData(false); // This will use cache if hash hasn't changed
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [aiPmMode, aiData, fetchAiData]);

  // Manual refresh function (bypasses cache)
  const handleManualRefresh = useCallback(() => {
    fetchAiData(true); // Force refresh
  }, [fetchAiData]);

  // AI insights: eligible projects only (no completed); orphan text must not name a completed job
  const filteredInsights = useMemo(() => {
    if (!aiData?.insights) return [];

    const currentProjects = dedupeProjectsByBestStatus([
      ...activeProjects,
      ...estimates,
    ]).filter(isProjectEligibleForAiDashboardInsights);
    const currentProjectIds = new Set(currentProjects.map((p) => String(p.id)));
    const closedIds = buildDashboardClosedProjectIdSet(
      activeProjects,
      estimates,
      timelineProgress
    );
    const closedTitles = completedProjectTitlesForAiFilter(
      activeProjects,
      estimates,
      timelineProgress
    );

    return dedupeAiInsightsByNormalizedTitle(
      aiData.insights.filter((insight) => {
        const pid = normalizeInsightProjectId(insight);
        const blob = `${insight.title || ""} ${insight.body || ""}`;
        const retrospective =
          insight.retrospective === true ||
          String(insight.id || "").startsWith("completed-retrospective-");
        if (pid && closedIds.has(pid)) {
          return retrospective;
        }
        if (aiTextReferencesCompletedJob(blob, closedTitles) && !retrospective) {
          return false;
        }
        if (pid) {
          return currentProjectIds.has(pid);
        }
        return true;
      })
    );
  }, [aiData?.insights, activeProjects, estimates, timelineProgress]);

  const filteredNextSteps = useMemo(() => {
    if (!aiData?.nextSteps) return [];

    const currentProjects = dedupeProjectsByBestStatus([
      ...activeProjects,
      ...estimates,
    ]).filter(isProjectEligibleForAiDashboardInsights);
    const currentProjectIds = new Set(currentProjects.map((p) => String(p.id)));
    const closedIds = buildDashboardClosedProjectIdSet(
      activeProjects,
      estimates,
      timelineProgress
    );
    const closedTitles = completedProjectTitlesForAiFilter(
      activeProjects,
      estimates,
      timelineProgress
    );

    return dedupeAiNextStepsByNormalizedLabel(
      aiData.nextSteps.filter((step) => {
        const stepText = String(step.label || "").toLowerCase();
        if (stepText.includes("josh")) return false;

        const pid = normalizeInsightProjectId(step);
        const stepBlob = `${step.label || ""} ${step.chip || ""}`;
        if (pid && closedIds.has(pid)) return false;
        if (aiTextReferencesCompletedJob(stepBlob, closedTitles)) return false;
        if (pid) {
          return currentProjectIds.has(pid);
        }
        return true;
      })
    );
  }, [aiData?.nextSteps, activeProjects, estimates, timelineProgress]);

  // Transform projects data - only show submitted and above (hide draft/estimate)
  const projects = useMemo(() => {
    return [...activeProjects, ...estimates]
      .filter((p) => {
        const status = (p.status || 'draft').toString().toLowerCase();
        // Only show projects that are submitted or beyond (hide draft/estimate)
        return status !== 'draft' && 
               status !== 'estimate' && 
               (status === 'bid_submitted' || 
                status === 'submitted' || 
                status === 'won' || 
                status === 'in_progress' || 
                status === 'active' || 
                status === 'completed');
      })
      .map((p) => {
        const pid = String(p?.id ?? '');
        const override = projectDataOverrides[pid];
        const mergedProject = override
          ? {
              ...p,
              milestones: Array.isArray(override?.milestones)
                ? override.milestones
                : (Array.isArray(p?.milestones) ? p.milestones : []),
              weeklyPayments: Array.isArray(override?.weeklyPayments)
                ? override.weeklyPayments
                : (Array.isArray(p?.weeklyPayments) ? p.weeklyPayments : []),
              paymentMilestones: Array.isArray(override?.paymentMilestones)
                ? override.paymentMilestones
                : (Array.isArray((p as any)?.paymentMilestones) ? (p as any).paymentMilestones : []),
              estimateData: override?.estimateData
                ? { ...(p?.estimateData || {}), ...override.estimateData }
                : p?.estimateData,
              projectData: {
                ...(p?.projectData || {}),
                ...override,
              },
            }
          : p;

        const status = mergedProject.status || "draft";
        let displayStatus = "Draft";
        if (status === "estimate") displayStatus = "Draft";
        else if (status === "bid_submitted") displayStatus = "Submitted";
        else if (status === "won") displayStatus = "Active";
        else if (status === "in_progress") displayStatus = "Active";
        else if (status === "completed") displayStatus = "Completed";
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

        const revenue = getProjectRevenue(mergedProject);
        const margin = mergedProject.margin || 0;
        const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;

        const progressPct = deriveUnifiedProgressPct(mergedProject, pid, timelineProgress);
        const rawProgress = progressPct / 100; // Convert to 0-1
        const finalProgress = status === 'completed' ? 1.0 : rawProgress;
        const timelineMs = resolveTimelineLatestPlannedMsFromMap(mergedProject, timelineLatestPlannedMs);
        const scheduleEndPick = getEffectiveScheduleEndPick(mergedProject, timelineMs);
        const scheduleEnd = scheduleEndPick?.raw;

        return {
          id: mergedProject.id,
          name: mergedProject.title || "Untitled Project",
          status: displayStatus,
          location: mergedProject.location || "Unknown, Unknown",
          progress: finalProgress,
          amount: revenue,
          margin: marginRatio * 100,
          marginDisplay: `${(marginRatio * 100).toFixed(1)}% margin`,
          dateLabel: scheduleEnd
            ? status === "completed"
              ? `Completed ${formatDateShort(scheduleEnd)}`
              : `Schedule ${formatDateShort(scheduleEnd)}`
            : "No schedule",
          rawProject: mergedProject,
        };
      });
  }, [activeProjects, estimates, projectDataOverrides, timelineProgress, timelineLatestPlannedMs]);

  // Calculate metrics
  // NOTE: This recalculates whenever activeProjects or estimates change
  const metrics = useMemo(() => {
    // Deduplicate projects by ID to avoid double-counting
    const allProjectsMap = new Map<string, any>();
    [...activeProjects, ...estimates].forEach((p) => {
      if (p?.id) {
        const id = String(p.id);
        // If project exists in both arrays, prefer the one from activeProjects (more up-to-date)
        if (!allProjectsMap.has(id) || activeProjects.some(ap => String(ap.id) === id)) {
          allProjectsMap.set(id, p);
        }
      }
    });
    const deduplicatedProjects = Array.from(allProjectsMap.values());
    
    const pipelineTotals = computePipelineTotals(deduplicatedProjects);
    // Always use computed value - don't fallback to dashboardMetrics which may be stale
    // If totalBidValue is 0, it means there are no valid projects, so 0 is correct
    const totalBids = pipelineTotals.totalBidValue;
    // activeProjectsValue should only include active projects (not submitted), so don't fallback to totalBids
    const activeProjectsValue = pipelineTotals.activeProjectsValue;

    const projectTypeStats =
      computeProfitabilityByProjectType(deduplicatedProjects);

    /** Simple mean of realized net profit % (net ÷ contract) per completed job — same $ basis as pipeline completed profit. */
    const completedNetProfitMargins: number[] = [];
    for (const p of deduplicatedProjects) {
      const status = (p?.status || "").toString().toLowerCase();
      if (status !== "completed") continue;
      const m = getCompletedProjectMarginPercent(p);
      if (m !== null && Number.isFinite(m)) completedNetProfitMargins.push(m);
    }
    const avgCompletedNetProfitPct =
      completedNetProfitMargins.length > 0
        ? completedNetProfitMargins.reduce((s, x) => s + x, 0) /
          completedNetProfitMargins.length
        : null;

    const result = {
      totalBids: formatMoneyCompact(totalBids),
      activeProjects: formatMoneyCompact(activeProjectsValue),
      avgMargin:
        avgCompletedNetProfitPct !== null
          ? `${avgCompletedNetProfitPct.toFixed(1)}%`
          : "—",
      completedProfit: formatMoneyUSD(pipelineTotals.completedProfit),
      rawCompletedProfit: pipelineTotals.completedProfit,
      projectTypeStats,
      // Include raw values for debugging
      _rawTotalBids: totalBids,
      _rawActiveProjects: activeProjectsValue,
    };
    
    return result;
  }, [activeProjects, estimates]);

  const handleProjectPress = useCallback(
    (project: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push("/(tabs)/projects");
    },
    [router]
  );

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
    },
    []
  );

  // Active projects = currently in progress (won, in_progress) — excludes completed
  const activeCount = useMemo(() => {
    return projects.filter((p) => p.status === "Active").length;
  }, [projects]);

  // Completed projects count
  const completedCount = useMemo(() => {
    return projects.filter((p) => p.status === "Completed").length;
  }, [projects]);

  // Total projects (active + completed) for avg value when mixing
  const activeWonCount = activeCount + completedCount;

  return (
    <SafeAreaView
      style={[
        styles.root,
        Platform.OS === "web" && desktopWeb && styles.rootDesktopWeb,
      ]}
    >
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      {clerkAuthEnabled ? (
        <ClerkDashboardGreetingSync setGreeting={setDashboardGreeting} />
      ) : (
        <LegacyDashboardGreetingSync setGreeting={setDashboardGreeting} />
      )}

      {/* Background */}
      <View style={StyleSheet.absoluteFill} />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, webScrollContentCap]}
          showsVerticalScrollIndicator={false}
        >
        {/* HEADER */}
          <TabScreenHeader
            style={styles.headerRow}
            title={t('dashboard.title')}
            subtitle={`${t('dashboard.welcome')}, ${dashboardGreeting.name}`}
            titleColor={Colors.text}
            subtitleColor={darkMode ? "rgba(255,255,255,0.92)" : "#334155"}
            titleStyle={desktopWeb ? styles.headerTitleDesktop : undefined}
            subtitleStyle={desktopWeb ? styles.headerSubtitleDesktop : undefined}
            belowTitle={(() => {
              const aiStatusText = aiPmMode
                ? "AI PM Active"
                : "AI monitoring paused · Manual mode";
              const isDark = darkMode;
              const aiStatusColor = aiPmMode
                ? (isDark ? "#6ee7b7" : "#16a34a")
                : (isDark ? "#FFFFFF" : "#475569");
              const dotColor = aiPmMode
                ? "#22c55e"
                : (isDark ? "#FFFFFF" : "#475569");
              const ruleBasedTime = aiData?.ruleBasedUpdatedAt
                ? formatTimeShort(aiData.ruleBasedUpdatedAt)
                : null;
              const aiTime = aiData?.aiUpdatedAt
                ? formatTimeShort(aiData.aiUpdatedAt)
                : null;

              return (
                <View style={styles.aiStatusRow}>
                  <View
                    style={[
                      styles.aiDot,
                      { backgroundColor: dotColor },
                    ]}
                  />
                  <Text style={[styles.aiStatusText, { color: aiStatusColor }]}>
                    {aiStatusText}
                  </Text>
                  {aiPmMode && aiData && (
                    <View style={styles.aiTimestampContainer}>
                      {ruleBasedTime && (
                        <Text style={styles.aiTimestampText}>
                          Data: {ruleBasedTime}
                        </Text>
                      )}
                      {aiTime && (
                        <Text style={styles.aiTimestampText}>
                          AI: {aiTime}
                        </Text>
                      )}
                      {!aiLoading && (
                        <Pressable
                          onPress={handleManualRefresh}
                          style={styles.refreshButton}
                        >
                          <Ionicons name="refresh" size={14} color={aiStatusColor} />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })()}
            right={
              <LinearGradient
                colors={["#22c55e", "#22d3ee"]}
                style={styles.profileOuter}
              >
                <Pressable
                  style={styles.profileInner}
                  onPress={() => router.push("/profile")}
                >
                  <Text style={styles.profileInitials}>{dashboardGreeting.initials}</Text>
                </Pressable>
              </LinearGradient>
            }
          />

        {/* SEGMENTED CONTROL */}
        <View style={styles.wideContainer}>
          <BlurView intensity={35} tint={darkMode ? "dark" : "light"} style={styles.segmentContainer}>
            <View style={styles.segmentInner}>
            <SegmentTab
              label={t('dashboard.overview')}
              icon="grid-outline"
              isActive={activeTab === "overview"}
              onPress={() => handleTabPress("overview")}
            />
            <SegmentTab
              label={t('dashboard.analytics')}
              icon="bar-chart-outline"
              isActive={activeTab === "analytics"}
              onPress={() => handleTabPress("analytics")}
            />
            <SegmentTab
              label="Calendar"
              icon="calendar"
              isActive={activeTab === "calendar"}
              onPress={() => handleTabPress("calendar")}
            />
            <SegmentTab
              label={t('dashboard.insights')}
              icon="bulb-outline"
              isActive={activeTab === "insights"}
              onPress={() => handleTabPress("insights")}
            />
          </View>
        </BlurView>
        </View>

        {/* CONTENT */}
        {activeTab === "overview" && (
          <OverviewSection
            metrics={metrics}
            projects={projects}
            onProjectPress={handleProjectPress}
            onViewAllPress={() => router.push("/(tabs)/projects")}
            onCreateEstimate={() => router.push("/(tabs)/estimate-generator")}
            aiPmMode={aiPmMode}
            aiData={aiData}
            aiLoading={aiLoading}
            aiError={aiError}
            filteredInsights={filteredInsights}
            filteredNextSteps={filteredNextSteps}
            timelineLatestPlannedMs={timelineLatestPlannedMs}
          />
        )}
        {activeTab === "analytics" && (
          <AnalyticsSection
            metrics={metrics}
            activeCount={activeCount}
            activeWonCount={activeWonCount}
            completedCount={completedCount}
            activeProjects={activeProjects}
            estimates={estimates}
            timelineProgress={timelineProgress}
          />
        )}
        {activeTab === "calendar" && (
          <MasterCalendarView
            activeProjects={activeProjects}
            estimates={estimates}
          />
        )}
        {activeTab === "insights" && (
          <InsightsSection
            projects={projects}
            filteredNextSteps={filteredNextSteps}
            filteredInsights={filteredInsights}
            aiPmMode={aiPmMode}
            aiLoading={aiLoading}
            aiError={aiError}
            aiData={aiData}
          />
        )}

        <View style={{ height: desktopWeb ? 20 : 32 }} />
      </ScrollView>

      {/* FLOATING AI PROJECT MANAGER MODE BADGE */}
      <Pressable
        style={[
          styles.aiFloatingWrapper,
          activeTab === "calendar" && styles.aiFloatingWrapperCalendarTab,
        ]}
        onPress={() => setAiPmMode((prev) => !prev)}
      >
        <LinearGradient
          colors={
            aiPmMode
              ? activeTab === "calendar"
                ? ["#134e2a", "#115e59"]
                : ["#15803d", "#0e7490"]
              : ["#3f3f46", "#18181b"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.aiFloating,
            activeTab === "calendar" && styles.aiFloatingCalendarTab,
          ]}
        >
          <Ionicons
            name="sparkles"
            size={activeTab === "calendar" ? 14 : 15}
            color={aiPmMode ? "#ecfdf5" : "#d4d4d8"}
          />
          <Text
            style={[
              styles.aiFloatingText,
              aiPmMode && styles.aiFloatingTextOn,
              activeTab === "calendar" && styles.aiFloatingTextCalendarTab,
            ]}
          >
            {aiPmMode ? t('dashboard.aiPmModeOn') : t('dashboard.aiPmModeOff')}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* AI Assistant Modal */}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        context={JSON.stringify({
          screen: "Dashboard",
          aiScope: "portfolio",
          allProjects: [...activeProjects, ...estimates].map((p) => {
            const st = ((p as any).status || '').toLowerCase();
            const isActive = ['won', 'active', 'in_progress', 'in-progress'].includes(st);
            const isCompleted = st === 'completed';
            return {
              id: p.id,
              title: p.title,
              customerName: (p as any).client || p.title,
              status: (p as any).status,
              isActive,
              isCompleted,
              bidPrice: p.bidPrice || 0,
              estimatedCost: p.estimatedCost || 0,
              totalBudget: p.estimatedCost || p.bidPrice || 0,
            };
          }),
        })}
      />
    </SafeAreaView>
  );
};

type SegmentProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
};

const SegmentTab: React.FC<SegmentProps> = ({ label, icon, isActive, onPress }) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  
  if (isActive) {
    return (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.segmentTab, styles.segmentTabActive]}
      >
        <Pressable onPress={onPress}>
          <View style={styles.segmentTabInner}>
            <Ionicons name={icon} size={16} color="#050B13" />
            <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>
              {label}
            </Text>
          </View>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={styles.segmentTab}
    >
      <View style={styles.segmentTabInner}>
        <Ionicons name={icon} size={16} color={darkMode ? "#FFFFFF" : "#334155"} />
        <Text style={styles.segmentLabel}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
};

/* ----------------- ENHANCED METRIC CARD ----------------- */

const EnhancedMetricCard = ({
  gradient,
  label,
  value,
  timeframe,
  trend,
  trendDirection,
  context,
  desktopEqualColumns,
}: {
  gradient?: boolean;
  label: string;
  value: string;
  timeframe: string;
  trend: string;
  trendDirection: "up" | "down";
  context: string;
  /** Desktop web: equal-width columns to match segment nav width */
  desktopEqualColumns?: boolean;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const CardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    gradient ? (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradientCard}
      >
        {children}
      </LinearGradient>
    ) : label === "Active Projects" ? (
      <View style={styles.metricCardSecondary}>{children}</View>
    ) : (
      <LinearGradient
        colors={["#1AD0B2", "#0088FF", "#003E66"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricGradientCard}
      >
        {children}
      </LinearGradient>
    );

  return (
    <Animated.View
      style={[
        desktopEqualColumns ? styles.metricOuterDesktopEqual : styles.metricOuter,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        <CardWrapper>
          <View style={styles.metricTopRow}>
            <View style={styles.metricIconCircle}>
              <Ionicons
                name={trendDirection === "up" ? "trending-up" : "trending-down"}
                size={14}
                color={gradient || label === "Avg Net Profit" ? "#020617" : "#22d3ee"}
                  />
                </View>
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={[
              styles.metricValue,
              (gradient || label === "Avg Net Profit") && { color: "#020617" },
              { width: "100%" },
            ]}
          >
            {value}
          </Text>
          <Text style={[styles.metricLabel, (gradient || label === "Avg Net Profit") && { color: "rgba(2,6,23,0.75)" }]}>
            {label}
          </Text>

          <View style={styles.metricBottomRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{timeframe}</Text>
                  </View>
            <View style={styles.trendRow}>
              <MaterialIcons
                name={trendDirection === "up" ? "north-east" : "south-east"}
                size={12}
                color={trendDirection === "up" ? "#15803d" : "#ea580c"}
              />
              <Text
                style={[
                  styles.trendText,
                  trendDirection === "up"
                    ? { color: "#15803d" }
                    : { color: "#ea580c" },
                ]}
              >
                {trend}
              </Text>
                </View>
              </View>

          <Text
            style={[
              styles.metricContext,
              (gradient || label === "Avg Net Profit") && styles.metricContextOnLight,
            ]}
          >
            {context}
                  </Text>
        </CardWrapper>
      </Pressable>
    </Animated.View>
  );
};

/* ----------------- AI INSIGHTS CONTROL CENTER ROW ----------------- */

const bucketChipVisual = (
  bucket: ActionBucket,
  dark: boolean
): { bg: string; text: string; label: string } => {
  if (bucket === "critical") {
    return {
      label: "Critical",
      bg: dark ? "rgba(248, 113, 113, 0.18)" : "rgba(220, 38, 38, 0.12)",
      text: dark ? "#fca5a5" : "#b91c1c",
    };
  }
  if (bucket === "today") {
    return {
      label: "Today",
      bg: dark ? "rgba(34, 211, 238, 0.14)" : "rgba(34, 211, 238, 0.12)",
      text: dark ? "#67e8f9" : "#0e7490",
    };
  }
  return {
    label: "Quick win",
    bg: dark ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)",
    text: dark ? "#86efac" : BPS_BRAND_GREEN,
  };
};

const InsightsActionRow = ({
  step,
  projectLine,
  darkMode,
  onRowPress,
  onDismiss,
}: {
  step: AiNextStep;
  projectLine?: string;
  darkMode: boolean;
  onRowPress: () => void;
  onDismiss: () => void;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  const bucket = bucketForNextStep(step);
  const chipVis = bucketChipVisual(bucket, darkMode);
  const title = humanizeNextStepLabel(step.label);
  const { cta } = inferCtaFromStep(step.label);

  return (
    <View style={styles.insightsActionCard}>
      <Pressable
        onPress={onRowPress}
        style={({ pressed }) => [
          styles.insightsActionMainPress,
          pressed && styles.insightsActionCardPressed,
        ]}
      >
        <View style={styles.insightsActionTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.insightsActionTitleRow}>
              <Text style={styles.insightsActionTitle} numberOfLines={2}>
                {title}
              </Text>
              <View style={[styles.insightsBucketChip, { backgroundColor: chipVis.bg }]}>
                <Text style={[styles.insightsBucketChipText, { color: chipVis.text }]}>
                  {chipVis.label}
                </Text>
              </View>
            </View>
            {projectLine ? (
              <Text style={styles.insightsActionContext} numberOfLines={1}>
                {projectLine}
              </Text>
            ) : null}
            {step.chip ? (
              <Text style={styles.insightsActionMeta}>{step.chip}</Text>
            ) : null}
          </View>
          <View style={styles.insightsActionCtaCol}>
            <Text style={styles.insightsActionCta}>{cta}</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={darkMode ? BPS_BRAND_TEAL : "rgba(14, 116, 144, 0.85)"}
            />
          </View>
        </View>
      </Pressable>
      <View style={styles.insightsActionFooter}>
        <Pressable
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          style={styles.insightsActionFooterHit}
        >
          <Text style={styles.insightsActionFooterText}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
};

/* ----------------- AI INSIGHT ITEM ----------------- */

const InsightItem = ({
  type,
  title,
  body,
}: {
  type: "alert" | "opportunity" | "info";
  title: string;
  body: string;
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const iconMap: Record<typeof type, keyof typeof Ionicons.glyphMap> = {
    alert: "warning",
    opportunity: "star",
    info: "information-circle",
  };
  const colorMap: Record<typeof type, string> = {
    alert: "#f97316",
    opportunity: "#22c55e",
    info: "#22d3ee",
  };

  // Transform body text to use less certain language
  const transformedBody = useMemo(() => {
    // Replace "This could indicate potential issues..." with less certain language
    if (body.toLowerCase().includes("could indicate") && body.toLowerCase().includes("potential issues")) {
      return body.replace(
        /This could indicate potential issues[^.]*/gi,
        "Once the project begins, this may indicate potential issues if costs aren't tracked."
      );
    }
    // Also catch variations like "This could indicate..." or "could indicate potential..."
    if (body.toLowerCase().includes("could indicate")) {
      return body.replace(
        /(This\s+)?could indicate[^.]*potential issues[^.]*/gi,
        "Once the project begins, this may indicate potential issues if costs aren't tracked."
      );
    }
    return body;
  }, [body]);

  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightIconCircle, { borderColor: colorMap[type] }]}>
        <Ionicons name={iconMap[type]} size={16} color={colorMap[type]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Text
            style={[styles.insightTitle, { flex: 1, minWidth: 0 }]}
            numberOfLines={4}
          >
            {title}
          </Text>
          <Pressable
            onPress={() => setShowTooltip(!showTooltip)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ flexShrink: 0, padding: 4, marginTop: -2 }}
          >
            <Ionicons 
              name="information-circle-outline" 
              size={14} 
              color={darkMode ? "rgba(255,255,255,0.9)" : "#475569"} 
            />
          </Pressable>
        </View>
        {showTooltip && (
          <View style={{
            backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: 8,
            padding: 8,
            marginTop: 4,
            marginBottom: 4,
          }}>
            <Text style={{
              color: darkMode ? '#FFFFFF' : '#374151',
              fontSize: 11,
              lineHeight: 16,
            }}>
              Insights improve as real costs are added.
            </Text>
          </View>
        )}
        <Text style={styles.insightBody}>{transformedBody}</Text>
      </View>
    </View>
  );
};

/* ----------------- OVERVIEW ----------------- */

interface OverviewSectionProps {
  metrics: {
    totalBids: string;
    activeProjects: string;
    avgMargin: string;
    completedProfit: string;
    rawCompletedProfit: number;
    _rawTotalBids?: number;
  };
  projects: any[];
  onProjectPress: (project: any) => void;
  onViewAllPress: () => void;
  onCreateEstimate: () => void;
  aiPmMode: boolean;
  aiData: AiDashboardResponse | null;
  aiLoading: boolean;
  aiError: string | null;
  filteredInsights: any[];
  filteredNextSteps: any[];
  timelineLatestPlannedMs: Record<string, number>;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  metrics,
  projects,
  onProjectPress,
  onViewAllPress,
  onCreateEstimate,
  aiPmMode,
  aiData,
  aiLoading,
  aiError,
  filteredInsights,
  filteredNextSteps,
  timelineLatestPlannedMs,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const desktopWideWeb = isDesktopWebLayoutWidth(windowWidth);
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  /** Collapsed by default — long lists expand on demand; preview still shows first N */
  const [aiInsightsExpanded, setAiInsightsExpanded] = useState(false);
  const overviewInsightsSorted = useMemo(
    () => sortInsightsForOverview(filteredInsights),
    [filteredInsights],
  );
  const insightCount = overviewInsightsSorted.length;
  const INSIGHT_PREVIEW_COUNT = 2;
  const showPreviewPanel =
    aiPmMode &&
    !aiError &&
    insightCount > 0 &&
    !aiInsightsExpanded &&
    (!aiLoading || aiData != null);
  const insightsHiddenCount = Math.max(0, insightCount - INSIGHT_PREVIEW_COUNT);

  const aiInsightsCollapsedHint = useMemo(() => {
    const expandVerb = desktopWideWeb ? "Click" : "Tap";
    if (aiError) return aiError;
    if (!aiPmMode) return "Turn on AI PM Mode to see insights.";
    if (aiLoading && !aiData) return "Analyzing your projects…";
    if (insightCount === 0) return `No major issues detected. ${expandVerb} to expand.`;
    return `${insightCount} insight${insightCount === 1 ? "" : "s"} · ${expandVerb} to expand`;
  }, [aiLoading, aiData, aiError, aiPmMode, insightCount, desktopWideWeb]);

  const toggleAiInsights = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAiInsightsExpanded((prev) => !prev);
  }, []);

  return (
    <>
      {/* KEY METRICS */}
      <View
        style={desktopWideWeb ? styles.keyMetricsClusterDesktop : undefined}
      >
      <View
        style={[
          styles.sectionHeaderRow,
          styles.overviewKeyMetricsAiInsights,
          desktopWideWeb && styles.keyMetricsHeaderDesktop,
        ]}
      >
        <View style={desktopWideWeb ? { alignItems: "center" } : undefined}>
          <Text
            style={[
              styles.sectionTitle,
              desktopWideWeb && { textAlign: "center" },
            ]}
          >
            Key Metrics
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              desktopWideWeb && { textAlign: "center" },
            ]}
          >
            This month at a glance
          </Text>
        </View>
        {!desktopWideWeb ? (
          <Text style={styles.metricsSwipeHint}>Swipe</Text>
        ) : null}
      </View>

        <View
          style={[
            styles.metricsRow,
            styles.wideContainer,
            styles.overviewKeyMetricsAiInsights,
            styles.overviewKeyMetricsBottomSpacing,
          ]}
        >
          {desktopWideWeb ? (
            <View style={styles.metricsRowEqualDesktop}>
              <EnhancedMetricCard
                desktopEqualColumns
                gradient
                label="Total Bids"
                value={metrics.totalBids}
                timeframe="This Month"
                trend="+12.5%"
                trendDirection="up"
                context="12% under expected at this phase"
              />
              <EnhancedMetricCard
                desktopEqualColumns
                label="Projects"
                value={metrics.activeProjects}
                timeframe="In Progress"
                trend="+4.1%"
                trendDirection="up"
                context="3 jobs flagged for review"
              />
              <EnhancedMetricCard
                desktopEqualColumns
                label="Avg Net Profit"
                value={metrics.avgMargin}
                timeframe="Completed jobs"
                trend="—"
                trendDirection="down"
                context="Net profit ÷ contract on closed work (realized)"
              />
            </View>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 28, paddingLeft: 2 }}
          >
          <EnhancedMetricCard
            gradient
            label="Total Bids"
            value={metrics.totalBids}
            timeframe="This Month"
            trend="+12.5%"
            trendDirection="up"
            context="12% under expected at this phase"
          />
          <EnhancedMetricCard
            label="Projects"
            value={metrics.activeProjects}
            timeframe="In Progress"
            trend="+4.1%"
            trendDirection="up"
            context="3 jobs flagged for review"
          />
          <EnhancedMetricCard
            label="Avg Net Profit"
            value={metrics.avgMargin}
            timeframe="Completed jobs"
            trend="—"
            trendDirection="down"
            context="Net profit ÷ contract on closed work (realized)"
          />
        </ScrollView>
          )}
                  </View>
      </View>

      {/* AI INSIGHTS PANEL */}
      <Pressable
        onPress={toggleAiInsights}
        style={({ pressed }) => [
          styles.sectionHeaderRow,
          styles.aiInsightsHeaderTopSpacing,
          { alignItems: "center" },
          pressed && { opacity: 0.88 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          aiInsightsExpanded
            ? "Collapse AI insights section"
            : "Expand AI insights section"
        }
        accessibilityState={{ expanded: aiInsightsExpanded }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.sectionTitle}>AI Insights for Today</Text>
          <Text style={[styles.sectionSubtitle, styles.overviewAiInsightsSubtitle]}>
            Top issues first · expand for the full list
          </Text>
        </View>
        <Ionicons
          name={aiInsightsExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={darkMode ? "rgba(255,255,255,0.88)" : "#475569"}
        />
      </Pressable>

      {!aiInsightsExpanded && !showPreviewPanel && (
        <View
          style={[
            styles.wideContainer,
            styles.aiInsightsSectionBottomSpacing,
          ]}
        >
          <Text style={styles.aiInsightsCollapsedHint}>{aiInsightsCollapsedHint}</Text>
        </View>
      )}

      {showPreviewPanel && (
        <View
          style={[
            styles.wideContainer,
            styles.aiInsightsSectionBottomSpacing,
          ]}
        >
          <LinearGradient
            colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.aiPanelBorder}
          >
            <View style={styles.aiPanelInner}>
              {overviewInsightsSorted.slice(0, INSIGHT_PREVIEW_COUNT).map((insight) => (
                <InsightItem
                  key={insight.id}
                  type={insight.type}
                  title={insight.title}
                  body={insight.body}
                />
              ))}
              {insightsHiddenCount > 0 && (
                <Pressable
                  onPress={toggleAiInsights}
                  style={({ pressed }) => [
                    styles.aiInsightsShowMoreRow,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`View all insights, ${insightsHiddenCount} more`}
                >
                  <View style={styles.aiInsightsShowMoreInner}>
                    <Text style={styles.aiInsightsShowMorePrimary}>View all insights</Text>
                    <Text style={styles.aiInsightsShowMoreSecondary}>
                      +{insightsHiddenCount} more
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={darkMode ? "rgba(255,255,255,0.88)" : "#475569"} />
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </View>
      )}

      {aiInsightsExpanded && (
      <View
        style={[
          styles.wideContainer,
          styles.aiInsightsSectionBottomSpacing,
          !aiPmMode && { opacity: 0.4 },
        ]}
      >
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.aiPanelBorder}
        >
          <View style={styles.aiPanelInner}>
            {aiError && (
              <Text style={styles.aiPanelPausedText}>{aiError}</Text>
            )}

            {!aiError && !aiPmMode && (
              <View style={styles.aiEmptyState}>
                <Ionicons name="sparkles-outline" size={32} color={darkMode ? "rgba(255,255,255,0.8)" : "#475569"} style={{ marginBottom: 12 }} />
                <Text style={styles.aiEmptyStateTitle}>
                  Turn on AI PM Mode
                </Text>
                <Text style={styles.aiPanelPausedText}>
                  Get your daily brief with smart insights and next steps
                </Text>
              </View>
            )}

            {!aiError && aiPmMode && aiLoading && !aiData && (
              <Text style={styles.aiPanelPausedText}>Analyzing your projects…</Text>
            )}

            {!aiError && aiPmMode && !aiLoading && (aiData?.insights ?? []).length === 0 && (
              <Text style={styles.aiPanelPausedText}>
                No major issues detected. All projects look on track.
              </Text>
            )}

            {aiPmMode &&
              !aiError &&
              overviewInsightsSorted.map((insight) => (
                <InsightItem
                  key={insight.id}
                  type={insight.type}
                  title={insight.title}
                  body={insight.body}
                />
              ))}
          </View>
        </LinearGradient>
      </View>
      )}

      {/* ALL PROJECTS */}
      {(() => {
        const totalProjects = projects.length;
        const activeProjectsCount = projects.filter(
          (p: any) => p.status === "Active"
        ).length;

        const ProjectSummaryCard = ({
          project,
        }: {
          project: any;
        }) => {
          const timelineMs = resolveTimelineLatestPlannedMsFromMap(project.rawProject, timelineLatestPlannedMs);
          const op = getDashboardProjectOperationalSignal(project, timelineMs);
          const signalStyle =
            op.variant === "risk"
              ? styles.projectSummarySignalRisk
              : op.variant === "watch"
                ? styles.projectSummarySignalWatch
                : styles.projectSummarySignalMuted;
          return (
          <Pressable
            style={styles.projectSummaryWrapper}
            onPress={() => onProjectPress(project)}
          >
              <View
                style={[
                  styles.projectSummaryBorder,
                  Colors.bg !== '#000000' && { borderWidth: 1, borderColor: Colors.line },
                ]}
              >
                <View style={styles.projectSummaryCard}>
                <View style={styles.projectSummaryRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text 
                      style={styles.projectSummaryName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {project.name}
                    </Text>
                    <View style={styles.projectSummaryValueRow}>
                      <Text style={styles.projectSummaryAmount}>
                        {formatMoneyUSD(project.amount)}
                      </Text>
                      {aiPmMode && (
                        <View style={styles.aiTagChip}>
                          <Ionicons
                            name="sparkles-outline"
                            size={10}
                            color="#22C55E"
                          />
                          <Text
                            style={[
                              styles.aiTagText,
                              { color: "#22C55E" },
                            ]}
                          >
                            AI
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusPillBase,
                      {
                        backgroundColor: (statusTheme[project.status] ?? statusTheme.Draft).bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillTextBase,
                        { color: (statusTheme[project.status] ?? statusTheme.Draft).color },
                      ]}
                    >
                      {project.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.projectSummaryProgress}>
                  <View style={styles.progressBarTrack}>
                    <LinearGradient
                      colors={['#22c55e', '#14b8a6', '#0ea5e9']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(Math.max(project.progress * 100, 0), 100)}%`,
                          opacity: Colors.bg === '#000000' ? 1 : 0.9, // Slightly reduced opacity in light mode
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>
                    {Math.round(project.progress * 100)}%
                  </Text>
                </View>
                <Text style={[styles.projectSummarySignal, signalStyle]} numberOfLines={1}>
                  {op.text}
                </Text>
                </View>
              </View>
          </Pressable>
          );
        };

  return (
          <View style={styles.allProjectsContainer}>
            <LinearGradient
              colors={["#2DFFC4", "#00A6FF"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{
                borderRadius: 20,
                padding: 1,
                marginBottom: 16,
              }}
            >
              <View style={{
                /* Light: match page bg (#E8EDF5); dark: unchanged black card */
                backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.bg,
                borderRadius: 18,
                padding: 12,
              }}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardTitle}>{t('dashboard.allProjects')}</Text>
                    <Text style={styles.cardSubtitle}>
                      {totalProjects} {t('dashboard.total')} · {activeProjectsCount} {t('dashboard.active')}
                    </Text>
                  </View>
                  <Pressable onPress={onViewAllPress}>
                    <Text style={styles.linkText}>{t('dashboard.viewAll')}</Text>
                  </Pressable>
                </View>

                {projects.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={styles.emptyStateIconCircle}>
                      <Ionicons name="document-text-outline" size={32} color="#22c55e" />
                    </View>
                    <Text style={styles.emptyStateText}>No projects yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Create your first estimate to get started
                    </Text>
                    <Pressable
                      onPress={onCreateEstimate}
                      style={styles.emptyStateCTA}
                    >
                      <LinearGradient
                        colors={["#22c55e", "#22d3ee"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.emptyStateCTAGradient}
                      >
                        <Ionicons name="add" size={18} color="#020617" />
                        <Text style={styles.emptyStateCTAText}>Create First Estimate</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : projects.length >= 4 ? (
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                    style={styles.allProjectsListScroll}
                    contentContainerStyle={styles.allProjectsListScrollContent}
                    {...KEYBOARD_SCROLL_DEFAULTS}
                  >
                    {projects.map((project) => (
                      <ProjectSummaryCard key={project.id} project={project} />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    {projects.map((project) => (
                      <ProjectSummaryCard key={project.id} project={project} />
                    ))}
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        );
      })()}

    </>
  );
};

/* ----------------- ANALYTICS ----------------- */

interface AnalyticsSectionProps {
  metrics: {
    totalBids: string;
    activeProjects: string;
    avgMargin: string;
    completedProfit: string;
    rawCompletedProfit: number;
    projectTypeStats?: { label: string; amount: string; percent: number }[];
    _rawTotalBids?: number;
  };
  activeCount: number;
  activeWonCount: number;
  completedCount: number;
  activeProjects: any[];
  estimates: any[];
  timelineProgress: Record<string, number>;
}

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  metrics,
  activeCount,
  activeWonCount,
  completedCount,
  activeProjects,
  estimates,
  timelineProgress,
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  // Simple avg project value for the snapshot card (use raw total — display string may be $12.8M / $123.5M)
  const avgProjectValue = useMemo(() => {
    const rawTotal = (metrics as { _rawTotalBids?: number })._rawTotalBids;
    if (
      typeof rawTotal !== "number" ||
      !Number.isFinite(rawTotal) ||
      rawTotal <= 0 ||
      !activeWonCount
    ) {
      return "$0";
    }
    return formatMoneyCompact(rawTotal / activeWonCount);
  }, [metrics, activeWonCount]);

  const deduplicatedPipelineProjects = useMemo(() => {
    const m = new Map<string, any>();
    [...activeProjects, ...estimates].forEach((p) => {
      if (p?.id) {
        const id = String(p.id);
        if (!m.has(id) || activeProjects.some((ap) => String(ap.id) === id)) {
          m.set(id, p);
        }
      }
    });
    return Array.from(m.values());
  }, [activeProjects, estimates]);

  const profitOutlook = useMemo(
    () =>
      computeDashboardProfitOutlook(
        deduplicatedPipelineProjects,
        metrics.rawCompletedProfit ?? 0,
        completedCount,
        timelineProgress
      ),
    [deduplicatedPipelineProjects, metrics.rawCompletedProfit, completedCount, timelineProgress]
  );

  return (
    <>
      {/* Top snapshot card (4 mini metrics) */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <LinearGradient
          colors={["#2DFFC4", "#00A6FF"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{
            borderRadius: 20,
            padding: 1,
            marginBottom: 12,
          }}
        >
          <View style={{
            /* Light: match page bg; dark: unchanged */
            backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.bg,
            borderRadius: 18,
            padding: 14,
          }}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Performance Snapshot</Text>
                <Text style={styles.cardSubtitle}>Key metrics at a glance</Text>
              </View>
            </View>

            <View style={styles.analyticsGrid}>
              <AnalyticsMetric label="Total Bids" value={metrics.totalBids} />
              <AnalyticsMetric
                label="Active Projects"
                value={activeCount.toString()}
              />
              <AnalyticsMetric
                label="Avg Project Value"
                value={avgProjectValue}
              />
              <AnalyticsMetric
                label="Avg Net Profit"
                value={metrics.avgMargin}
              />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Deeper charts / profit analytics */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <ProfileAnalytics
          activeWonCount={activeCount}
          completedCount={completedCount}
          projectTypeStats={metrics.projectTypeStats}
          overviewProfit={metrics.rawCompletedProfit ?? 0}
          completedProjects={[...activeProjects, ...estimates].filter(
            (p) => (p.status || "").toString().toLowerCase() === "completed"
          )}
          profitOutlook={profitOutlook}
        />
      </View>
    </>
  );
};

const AnalyticsMetric = ({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  
  // Get icon and color for each metric type
  const isDark = Colors.bg === '#000000';
  const getMetricConfig = (label: string) => {
    const baseConfigs: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; darkBg: string; lightBg: string }> = {
      "Total Bids": { icon: "cash-outline", color: "#3b82f6", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Active Projects": { icon: "folder-outline", color: "#22c55e", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Avg Project Value": { icon: "trending-up-outline", color: "#22d3ee", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Avg Net Profit": { icon: "pie-chart-outline", color: "#a78bfa", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
    };
    const config = baseConfigs[label] || { icon: "stats-chart-outline", color: "#FFFFFF", darkBg: Colors.surface2, lightBg: "#E2E8F0" };
    return {
      icon: config.icon,
      color: config.color,
      bgColor: isDark ? config.darkBg : config.lightBg,
    };
  };

  const config = getMetricConfig(label);

  return (
    <View
      style={[
        styles.analyticsMetricInner,
        !isDark && { borderWidth: 1, borderColor: Colors.line },
      ]}
    >
      <View style={[styles.analyticsMetricIconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={19} color={config.color} />
      </View>
      <View style={styles.analyticsMetricContent}>
        <Text style={styles.analyticsLabel}>{label}</Text>
        <Text style={styles.analyticsValue}>{value}</Text>
        {extra ? (
          <View style={styles.analyticsExtraContainer}>
            <Text style={styles.analyticsExtra}>{extra}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/* ----------------- INSIGHTS ----------------- */

interface InsightsSectionProps {
  projects: any[];
  filteredNextSteps: AiNextStep[];
  filteredInsights: AiInsight[];
  aiPmMode: boolean;
  aiLoading: boolean;
  aiError: string | null;
  aiData: AiDashboardResponse | null;
}

const InsightsSection: React.FC<InsightsSectionProps> = ({
  projects,
  filteredNextSteps,
  filteredInsights,
  aiPmMode,
  aiLoading,
  aiError,
  aiData,
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useDashboardStyles(Colors);
  const router = useRouter();
  const [showAllActions, setShowAllActions] = useState(false);
  const [dismissedNextStepIds, setDismissedNextStepIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISSED_NEXT_STEPS_STORAGE_KEY);
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDismissedNextStepIds(new Set(parsed.map(String)));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Drop dismissals that no longer match the current feed (e.g. after API refresh). */
  useEffect(() => {
    if (filteredNextSteps.length === 0) return;
    const currentIds = new Set(filteredNextSteps.map(stableNextStepId));
    setDismissedNextStepIds((prev) => {
      let removed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
        else removed = true;
      });
      if (!removed && next.size === prev.size) return prev;
      return next;
    });
  }, [filteredNextSteps]);

  const dismissNextStep = useCallback(async (step: AiNextStep) => {
    const id = stableNextStepId(step);
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissedNextStepIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_NEXT_STEPS_STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(id)) {
        list.push(id);
        await AsyncStorage.setItem(DISMISSED_NEXT_STEPS_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const urgentProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        (p.status === "Active" || p.status === "In Progress") &&
        p.progress < 0.3 &&
        p.dateLabel.includes("Schedule")
    );
  }, [projects]);

  const avgMargin = useMemo(() => {
    const pcts: number[] = [];
    for (const row of projects) {
      if (row.status !== "Completed") continue;
      const raw = row.rawProject;
      if (!raw) continue;
      const m = getCompletedProjectMarginPercent(raw);
      if (m !== null && Number.isFinite(m)) pcts.push(m);
    }
    return pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  }, [projects]);

  const projectNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(String(p.id), p.name || "Project");
    return m;
  }, [projects]);

  const sortedInsights = useMemo(
    () => sortInsightsForOverview(filteredInsights),
    [filteredInsights]
  );
  const primaryInsight = sortedInsights[0];

  const stepsAfterDismiss = useMemo(
    () => filteredNextSteps.filter((s) => !dismissedNextStepIds.has(stableNextStepId(s))),
    [filteredNextSteps, dismissedNextStepIds]
  );

  const sortedSteps = useMemo(
    () => sortNextStepsForControlCenter(stepsAfterDismiss),
    [stepsAfterDismiss]
  );
  const grouped = useMemo(() => groupNextStepsByBucket(stepsAfterDismiss), [stepsAfterDismiss]);
  const dailyBrief = useMemo(
    () => aiData?.dailyBrief || buildFallbackDailyBrief(filteredInsights, filteredNextSteps, projects),
    [aiData?.dailyBrief, filteredInsights, filteredNextSteps, projects]
  );
  const dailyRisk = dailyBrief?.topProfitRisks?.[0];
  const dailyAction = dailyBrief?.topActions?.[0];
  const nextPayment = dailyBrief?.upcomingPayments?.[0];

  const visibleSteps = useMemo(() => {
    if (showAllActions) return sortedSteps;
    return sortedSteps.slice(0, 3);
  }, [sortedSteps, showAllActions]);

  const patterns = useMemo(
    () => portfolioPatternBullets(filteredInsights, filteredNextSteps),
    [filteredInsights, filteredNextSteps]
  );

  const heroAccent = dailyRisk
    ? dailyRisk.severity === "high"
      ? "#f97316"
      : dailyRisk.severity === "medium"
        ? "#f59e0b"
        : BPS_BRAND_TEAL
    : primaryInsight
    ? primaryInsight.type === "alert"
      ? "#f97316"
      : primaryInsight.type === "opportunity"
        ? BPS_BRAND_GREEN
        : BPS_BRAND_TEAL
    : urgentProjects.length > 0
      ? "#f97316"
      : avgMargin > 80
        ? BPS_BRAND_GREEN
        : BPS_BRAND_TEAL;

  const openProject = (projectId?: string | null) => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (projectId) router.push(`/project-detail/${projectId}`);
    else router.push("/(tabs)/projects");
  };

  const renderActionGroup = (label: string, steps: AiNextStep[]) => {
    if (steps.length === 0) return null;
    return (
      <View key={label} style={{ marginBottom: 14 }}>
        <Text style={styles.insightsGroupLabel}>{label}</Text>
        {steps.map((step, index) => (
          <InsightsActionRow
            key={`${stableNextStepId(step)}-${label}-${index}`}
            step={step}
            darkMode={darkMode}
            projectLine={
              step.projectId
                ? projectNameById.get(String(step.projectId))
                : undefined
            }
            onRowPress={() => openProject(step.projectId)}
            onDismiss={() => dismissNextStep(step)}
          />
        ))}
      </View>
    );
  };

  return (
    <>
      {/* Hero: Today's AI brief / biggest risk */}
      <View style={styles.wideContainer}>
        <View style={styles.insightsHeroCard}>
          <View style={[styles.insightsHeroAccent, { backgroundColor: heroAccent }]} />
          <View style={styles.insightsHeroBody}>
            <View style={styles.insightsHeroEyebrowRow}>
              <Ionicons name="sparkles" size={14} color={heroAccent} />
              <Text style={[styles.insightsHeroEyebrow, { color: heroAccent }]}>
                {aiPmMode
                  ? dailyRisk
                    ? "Daily command center"
                    : primaryInsight
                    ? heroKickerForInsight(primaryInsight.type)
                    : urgentProjects.length > 0
                      ? "Schedule pressure"
                      : avgMargin > 80
                        ? "Margin strength"
                        : "AI control center"
                  : "AI PM off"}
              </Text>
            </View>

            {aiPmMode && aiLoading && (
              <Text style={styles.insightsHeroHeadline}>Syncing your brief…</Text>
            )}

            {aiPmMode && !aiLoading && aiError && (
              <>
                <Text style={styles.insightsHeroHeadline}>Insights unavailable</Text>
                <Text style={styles.insightsHeroSupport}>
                  Pull to refresh or check your connection. Underlying data is unchanged.
                </Text>
              </>
            )}

            {aiPmMode && !aiLoading && !aiError && dailyRisk && (
              <>
                <Text style={styles.insightsHeroHeadline} numberOfLines={3}>
                  {dailyRisk.headline}
                </Text>
                <Text style={styles.insightsHeroSupport} numberOfLines={4}>
                  {dailyRisk.projectTitle
                    ? `${dailyRisk.projectTitle}${dailyRisk.impactEstimate ? ` · impact ~${formatAiDashboardUsdCompact(dailyRisk.impactEstimate)}` : ""}. ${dailyAction?.label ? `Next move: ${dailyAction.label}.` : ""}${nextPayment?.projectTitle ? ` Next payment: ${nextPayment.projectTitle}${nextPayment.date ? ` due ${formatDateShort(nextPayment.date)}` : ""}.` : ""}`
                    : "The command center is tracking your highest-value risks and actions."}
                </Text>
                <LinearGradient
                  colors={[BPS_BRAND_GREEN, BPS_BRAND_TEAL]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.insightsHeroCtaGradient}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.insightsHeroCtaInner,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => openProject(dailyRisk.projectId)}
                  >
                    <Text style={styles.insightsHeroCtaText}>
                      {dailyRisk.projectId ? "Review top risk" : "Open portfolio"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#050B13" />
                  </Pressable>
                </LinearGradient>
              </>
            )}

            {aiPmMode && !aiLoading && !aiError && !dailyRisk && primaryInsight && (
              <>
                <Text style={styles.insightsHeroHeadline} numberOfLines={3}>
                  {primaryInsight.title}
                </Text>
                <Text style={styles.insightsHeroSupport} numberOfLines={3}>
                  {firstSupportingSentence(primaryInsight.body)}
                </Text>
                <LinearGradient
                  colors={[BPS_BRAND_GREEN, BPS_BRAND_TEAL]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.insightsHeroCtaGradient}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.insightsHeroCtaInner,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => openProject(primaryInsight.projectId)}
                  >
                    <Text style={styles.insightsHeroCtaText}>
                      {primaryInsight.projectId ? "Review project" : "View portfolio"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#050B13" />
                  </Pressable>
                </LinearGradient>
              </>
            )}

            {aiPmMode && !aiLoading && !aiError && !primaryInsight && (
              <>
                <Text style={styles.insightsHeroHeadline} numberOfLines={2}>
                  {urgentProjects.length > 0
                    ? `${urgentProjects.length} active job${urgentProjects.length > 1 ? "s" : ""} need timeline attention`
                    : avgMargin > 80
                      ? `Completed jobs averaging ${avgMargin.toFixed(1)}% net profit`
                      : "No major portfolio flags"}
                </Text>
                <Text style={styles.insightsHeroSupport} numberOfLines={3}>
                  {urgentProjects.length > 0
                    ? "Pull crew forward on in-progress work to protect dates."
                    : avgMargin > 80
                      ? "Strong spreads—tighten markup discipline on new bids."
                      : "Add live costs to sharpen risk and next actions."}
                </Text>
                <LinearGradient
                  colors={[BPS_BRAND_GREEN, BPS_BRAND_TEAL]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.insightsHeroCtaGradient}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.insightsHeroCtaInner,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => openProject(null)}
                  >
                    <Text style={styles.insightsHeroCtaText}>View projects</Text>
                    <Ionicons name="arrow-forward" size={18} color="#050B13" />
                  </Pressable>
                </LinearGradient>
              </>
            )}

            {!aiPmMode && (
              <Text style={styles.insightsHeroSupport}>
                Turn on AI PM Mode for a daily brief, ranked actions, and portfolio patterns.
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Prioritized actions */}
      <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Prioritized actions</Text>
          <Text style={styles.sectionSubtitle}>Critical first · then today · quick wins</Text>
        </View>
      </View>

      <View style={styles.wideContainer}>
        <View style={styles.insightsActionsPanel}>
          {aiPmMode && aiLoading && (
            <Text style={styles.insightsAuxText}>Loading actions…</Text>
          )}

          {aiPmMode && !aiLoading && !aiError && sortedSteps.length > 0 && (
            <>
              {showAllActions ? (
                <>
                  {renderActionGroup("Critical", grouped.critical)}
                  {renderActionGroup("Today", grouped.today)}
                  {renderActionGroup("Quick wins", grouped.quick)}
                </>
              ) : (
                visibleSteps.map((step, index) => (
                  <InsightsActionRow
                    key={`${stableNextStepId(step)}-c-${index}`}
                    step={step}
                    darkMode={darkMode}
                    projectLine={
                      step.projectId
                        ? projectNameById.get(String(step.projectId))
                        : undefined
                    }
                    onRowPress={() => openProject(step.projectId)}
                    onDismiss={() => dismissNextStep(step)}
                  />
                ))
              )}

              {sortedSteps.length > 3 ? (
                <Pressable
                  onPress={() => {
                    setShowAllActions((v) => !v);
                    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.insightsViewAllRow}
                >
                  <Text style={styles.insightsViewAllText}>
                    {showAllActions ? "Show fewer" : "View all actions"}
                  </Text>
                  <Ionicons
                    name={showAllActions ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={BPS_BRAND_GREEN}
                  />
                </Pressable>
              ) : null}
            </>
          )}

          {!aiPmMode && (
            <View style={styles.aiEmptyState}>
              <Ionicons name="sparkles-outline" size={32} color={darkMode ? "rgba(255,255,255,0.8)" : "#475569"} style={{ marginBottom: 12 }} />
              <Text style={styles.aiEmptyStateTitle}>AI PM Mode is off</Text>
                <Text style={styles.insightsAuxText}>
                  Toggle the floating badge to enable ranked actions.
                </Text>
            </View>
          )}

          {aiPmMode && !aiLoading && !aiError && sortedSteps.length === 0 && (
            <Text style={styles.insightsAuxText}>
              {filteredNextSteps.length > 0
                ? "All current actions are dismissed. New ones will show when your dashboard refreshes."
                : "No queued actions. Nice work."}
            </Text>
          )}
        </View>
      </View>

      {/* Portfolio patterns */}
      {aiPmMode && !aiLoading && !aiError && (
        <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
          <View>
            <Text style={styles.sectionTitle}>What we&apos;re seeing</Text>
            <Text style={styles.sectionSubtitle}>Across your portfolio</Text>
          </View>
        </View>
      )}

      {aiPmMode && !aiLoading && !aiError && (
        <View style={styles.wideContainer}>
          <View style={styles.insightsPatternsCard}>
            {patterns.map((line, i) => (
              <View
                key={i}
                style={[
                  styles.insightsPatternRow,
                  i === patterns.length - 1 && { marginBottom: 0 },
                ]}
              >
                <View style={styles.insightsPatternDot} />
                <Text style={styles.insightsPatternText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {aiPmMode && !aiLoading && !aiError && dailyBrief?.upcomingPayments?.length ? (
        <>
          <View style={[styles.sectionHeaderRow, { marginTop: 22 }]}>
            <View>
              <Text style={styles.sectionTitle}>Upcoming money</Text>
              <Text style={styles.sectionSubtitle}>Soonest payment milestones first</Text>
            </View>
          </View>
          <View style={styles.wideContainer}>
            <View style={styles.insightsPatternsCard}>
              {dailyBrief.upcomingPayments.slice(0, 3).map((payment, index) => (
                <View
                  key={`${payment.projectId || "portfolio"}-${payment.name}-${index}`}
                  style={[
                    styles.insightsPatternRow,
                    index === dailyBrief.upcomingPayments.slice(0, 3).length - 1 && { marginBottom: 0 },
                  ]}
                >
                  <View style={styles.insightsPatternDot} />
                  <Text style={styles.insightsPatternText}>
                    {`${payment.projectTitle || "Project"} · ${payment.name || "Payment"} · ${formatAiDashboardUsdCompact(payment.amount || 0)}${payment.date ? ` · due ${formatDateShort(payment.date)}` : ""}`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </>
  );
};

/* ----------------- STYLES ----------------- */

const getStyles = (
  Colors: any,
  scrollBottomInset: number = 120,
  desktopWeb = false,
  layoutWidth: number = 390
) => {
  const edge = desktopWeb ? WEB_DESKTOP_EDGE_HORIZONTAL : ScreenLayout.edge.horizontal;
  /** Key metric carousel: avoid 60%+ viewport-wide cards on desktop; tight horizontal strip on phone */
  const metricsCardOuterWidth = desktopWeb
    ? Math.min(
        308,
        Math.max(
          248,
          Math.floor(
            (Math.min(layoutWidth, DASHBOARD_WEB_MAX_CONTENT_WIDTH) - edge * 2 - 28) / 3 - 8
          )
        )
      )
    : Math.min(Math.round(layoutWidth * 0.72), 360);
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  /** Web + ≥1024px only (merged in JSX). Match card/page black in dark mode — avoid slate tint on #000000. */
  rootDesktopWeb: {
    backgroundColor: Colors.bg === "#000000" ? Colors.bg : "#f1f5f9",
  },
  scrollContent: {
    paddingTop: desktopWeb ? 24 : ScreenLayout.screen.paddingTop,
    paddingHorizontal: edge,
    paddingBottom: scrollBottomInset,
  },
  glossOverlay: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: "rgba(15,23,42,0.6)",
  },

  // HEADER (TabScreenHeader handles vertical spacing; wide bleed for segments)
  headerRow: {
    marginHorizontal: -edge,
    paddingHorizontal: desktopWeb ? 12 : 8,
  },
  headerTitleDesktop: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  headerSubtitleDesktop: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 6,
  },
  titleGlow: {
    position: "absolute",
    left: -16,
    top: -8,
    width: 180,
    height: 56,
    opacity: 0.22,
    borderRadius: 999,
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  aiStatusText: {
    fontSize: 12,
    color: "#6ee7b7", // Will be overridden inline, but keep as fallback
  },
  aiTimestampContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 8,
  },
  aiTimestampText: {
    fontSize: 10,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.92)" : "#475569",
    opacity: 1,
  },
  refreshButton: {
    padding: 4,
    marginLeft: 4,
  },
  aiEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  aiEmptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
  },
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.bg === "#000000" ? Colors.card : Colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: 16,
  },

  // SEGMENTED CONTROL
  slideHintContainer: {
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  slideHintText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#22c55e",
    textAlign: "center",
    textTransform: "lowercase",
  },
  segmentContainer: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1, // Match projects page border width
    borderColor: "#19E180", // Green border for both dark and light mode
    marginBottom: desktopWeb ? 22 : 18,
  },
  segmentScrollView: {
    flexGrow: 0,
  },
  segmentInner: {
    flexDirection: "row",
    padding: desktopWeb ? 5 : 4,
    backgroundColor: Colors.bg === '#000000' ? "transparent" : Colors.surface2,
    minWidth: "100%",
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
    marginHorizontal: 1,
  },
  segmentTabActive: {
    backgroundColor: Colors.bg === '#000000' ? "transparent" : "#FFFFFF",
    shadowColor: Colors.bg === '#000000' ? "#22c55e" : "#000",
    shadowOpacity: Colors.bg === '#000000' ? 0.4 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: desktopWeb ? 10 : 8,
    paddingHorizontal: desktopWeb ? 6 : 4,
    gap: 6,
  },
  segmentLabel: {
    fontSize: desktopWeb ? 14 : 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  segmentLabelActive: {
    color: Colors.bg === '#000000' ? "#050B13" : "#071018",
  },

  // GENERIC CARD
  card: {
    borderRadius: ScreenLayout.card.radius,
    padding: desktopWeb ? 22 : ScreenLayout.card.padding,
    backgroundColor: Colors.card,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    marginBottom: ScreenLayout.card.marginBottom,
    shadowColor: Colors.bg === '#000000' ? "#000" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0.4 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 18 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 10 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  allProjectsCard: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderWidth: desktopWeb && Colors.bg === "#000000" ? 1 : 0,
    borderColor: "rgba(34, 197, 94, 0.18)",
    borderRadius: desktopWeb ? 26 : undefined,
  },
  allProjectsContainer: {
    marginBottom: 16,
    marginHorizontal: -edge,
    paddingHorizontal: 4,
    paddingTop: 16,
  },
  /** Cap height when 4+ projects so the list scrolls inside the card */
  allProjectsListScroll: {
    marginTop: 12,
    maxHeight: 340,
  },
  allProjectsListScrollContent: {
    paddingBottom: 8,
  },
  /** Insights tab: Next Steps list when 4+ items */
  nextStepsListScroll: {
    maxHeight: 340,
  },
  nextStepsListScrollContent: {
    paddingBottom: 8,
  },
  analyticsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderWidth: 0,
  },
  analyticsSection: {
    marginBottom: 10,
  },
  performanceSnapshotCard: {
    backgroundColor: "transparent", // gradient handles the fill
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.bg === '#000000' ? "#102131" : Colors.line,
    marginBottom: 16,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  analyticsGradient: {
    width: "100%",
    borderRadius: 22,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  /** Budget / All Projects page title scale */
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: Colors.bg === '#000000' ? "#F5F7FA" : Colors.text,
  },
  cardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.62)" : "#475569",
  },
  /** Insights tab — AI Insights card title + body (larger, easier to read) */
  insightsCardTitle: {
    fontSize: 24,
    fontWeight: Colors.bg === '#000000' ? "700" : "800",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    letterSpacing: -0.3,
  },
  insightsBodyText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.bg === '#000000' ? "#F8FAFC" : "#334155",
  },
  insightsHeroCard: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.bg === '#000000' ? "#1C1C1E" : Colors.surface,
    borderWidth: 1,
    borderColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.08)" : Colors.line,
    marginBottom: 4,
  },
  insightsHeroAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  insightsHeroBody: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    paddingRight: 18,
  },
  insightsHeroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  insightsHeroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  insightsHeroHeadline: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    lineHeight: 28,
  },
  insightsHeroSupport: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.94)" : Colors.sub,
  },
  insightsHeroCtaGradient: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderRadius: 14,
    overflow: "hidden",
  },
  insightsHeroCtaInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  insightsHeroCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#050B13",
  },
  insightsActionsPanel: {
    borderRadius: 20,
    padding: 16,
    paddingBottom: 12,
    backgroundColor: Colors.bg === '#000000' ? "#1C1C1E" : Colors.surface,
    borderWidth: 1,
    borderColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.08)" : Colors.line,
    marginBottom: 4,
  },
  insightsGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.88)" : Colors.sub,
    marginBottom: 10,
    marginTop: 4,
  },
  insightsActionCard: {
    borderRadius: 14,
    marginBottom: 10,
    /* Light: gray tile inside the tinted panel — avoid stark white (dark unchanged) */
    backgroundColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.05)" : Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.07)" : Colors.line,
    overflow: "hidden",
  },
  insightsActionMainPress: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  insightsActionCardPressed: {
    opacity: 0.92,
    backgroundColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.06)" : Colors.iconBg,
  },
  insightsActionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  insightsActionTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  insightsActionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#F8FAFC" : Colors.text,
    lineHeight: 21,
  },
  insightsActionContext: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.9)" : Colors.sub,
  },
  insightsActionMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.84)" : Colors.sub,
  },
  insightsActionCtaCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
  },
  insightsActionCta: {
    fontSize: 13,
    fontWeight: "700",
    color: BPS_BRAND_GREEN,
  },
  insightsBucketChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  insightsBucketChipText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  insightsActionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
  },
  insightsActionFooterHit: {
    paddingVertical: 2,
  },
  insightsActionFooterText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.86)" : Colors.sub,
  },
  insightsViewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  insightsViewAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: BPS_BRAND_GREEN,
  },
  insightsPatternsCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.bg === '#000000' ? "#1C1C1E" : Colors.surface,
    borderWidth: 1,
    borderColor: Colors.bg === '#000000' ? "rgba(255,255,255,0.08)" : Colors.line,
    marginBottom: 8,
  },
  insightsPatternRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  insightsPatternDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: BPS_BRAND_GREEN,
    opacity: 0.9,
  },
  insightsPatternText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.94)" : "#334155",
  },
  /** Loading / empty copy on Insights tab — brighter than generic panel text */
  insightsAuxText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.bg === '#000000' ? "#e2e8f0" : "#334155",
    marginBottom: 10,
  },
  insightsSectionTitle: {
    fontSize: 20,
    fontWeight: Colors.bg === '#000000' ? "700" : "800",
    color: Colors.bg === '#000000' ? "#e5e7eb" : "#0F172A",
    letterSpacing: -0.2,
  },
  insightsSectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.92)" : "#475569",
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15E08A",
  },
  metricsSwipeHint: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.65)",
    letterSpacing: 0.2,
  },

  // METRICS
  metricRow: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  metricCard: {
    width: 200,
    borderRadius: 26,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 140,
  },
  metricCardSecondary: {
    width: 200,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "#0A2641",
    justifyContent: "space-between",
    minHeight: 118,
  },
  metricIconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricIconPillSecondary: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  metricValueSecondary: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricLabel: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(230,245,255,0.78)",
  },
  metricLabelSecondary: {
    marginTop: 2,
    fontSize: 14,
    color: "#E6F5FF",
  },
  metricFooterRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(4, 16, 30, 0.75)",
  },
  metricChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  metricDeltaText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5FFF3",
  },
  metricChipSecondary: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#062033",
  },
  metricChipTextSecondary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5F7FF",
  },

  // PROJECTS
  projectCard: {
    marginTop: 8,
    borderRadius: 20, // Slightly smaller
    backgroundColor: Colors.bg === '#000000' ? "transparent" : Colors.surface2, // Match Projects page card grey in light mode
    overflow: "hidden",
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.bg === '#000000' ? "#102131" : Colors.line,
    shadowColor: Colors.bg === '#000000' ? "#000" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0.4 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 18 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 10 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  projectCardGradient: {
    width: "100%",
    borderRadius: 24,
    padding: 16,
  },
  projectTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  projectLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  projectLocationText: {
    fontSize: 13,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.9)" : "#475569",
  },
  statusPillBase: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillTextBase: {
    fontSize: 11,
    fontWeight: '700',
  },
  projectMiddleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
  },
  projectAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  projectMetaText: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.9)" : "#334155",
  },
  projectMetaLabel: {
    fontSize: 12,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.92)" : "#475569",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.bg === '#000000' ? "#1B2938" : "#CBD5E1", // Darker track in light mode
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 999,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#E5F7FF" : Colors.text,
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.92)" : "#334155",
  },
  aiTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.3)",
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#BBF7D0",
    letterSpacing: 0.3,
  },

  // PROJECT SUMMARY CARDS
  projectSummaryWrapper: {
    marginTop: 6,
  },
  projectSummaryBorder: {
    borderRadius: 20,
    padding: 1,
  },
  projectSummaryCard: {
    paddingVertical: 11,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: Colors.bg === '#000000' ? Colors.surface2 : Colors.surface2,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
  },
  projectSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  projectSummaryName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  projectSummaryValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  projectSummaryAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#F8FAFC" : Colors.text,
  },
  projectSummaryProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  projectSummarySignal: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 5,
    letterSpacing: 0.15,
  },
  projectSummarySignalRisk: {
    color: "#d97706",
  },
  projectSummarySignalWatch: {
    color: Colors.bg === '#000000' ? "rgba(203,213,225,0.98)" : "#475569",
  },
  projectSummarySignalMuted: {
    color: Colors.bg === '#000000' ? "rgba(226,232,240,0.92)" : "rgba(51,65,85,0.92)",
  },

  // ANALYTICS
  analyticsGrid: {
    flexDirection: "column",
    marginTop: 12,
    gap: 8,
  },
  analyticsMetricBorder: {
    width: "48%",
    borderRadius: 16,
    padding: 1,
    marginBottom: 2,
  },
  analyticsMetricInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface2, // Match All Projects cards in both modes
    borderRadius: 12,
    padding: 12,
    borderWidth: 1, // Match project card border in light mode without resizing
    borderColor: Colors.line,
  },
  analyticsMetricCard: {
    width: "48%",
    backgroundColor: "transparent",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  analyticsMetricGradient: {
    width: "100%",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  analyticsMetricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  analyticsMetricContent: {
    flex: 1,
    minWidth: 0,
  },
  /** Budget rowLabelMetric */
  analyticsLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.64)" : "rgba(15,23,42,0.72)",
    marginBottom: 6,
  },
  /** Budget rowValueIntelHero */
  analyticsValue: {
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: Colors.bg === '#000000' ? "#F5F7FA" : Colors.text,
    lineHeight: 26,
    marginBottom: 2,
    fontVariant: ["tabular-nums"],
  },
  analyticsExtraContainer: {
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignSelf: "flex-start",
  },
  analyticsExtra: {
    fontSize: 10,
    color: "#4ade80",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    marginTop: 16,
  },
  emptyStateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.9)" : "#475569",
    marginTop: 6,
    textAlign: "center",
    maxWidth: 240,
  },
  emptyStateCTA: {
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  emptyStateCTAGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyStateCTAText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "700",
  },

  /** Desktop Overview: three equal columns inside same width as segment nav (`wideContainer`) */
  metricsRowEqualDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    gap: 10,
  },
  metricOuterDesktopEqual: {
    flex: 1,
    minWidth: 0,
    marginRight: 0,
  },
  // ENHANCED METRIC CARDS
  metricOuter: {
    width: metricsCardOuterWidth,
    marginRight: 10,
  },
  metricGradientCard: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    minHeight: 118,
    justifyContent: "space-between",
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  metricIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  metricBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  chipText: {
    fontSize: 10,
    color: "rgba(229,231,235,0.94)",
    fontWeight: "500",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "500",
  },
  metricContext: {
    fontSize: 11,
    lineHeight: 15,
    color: "rgba(243,244,246,0.88)",
    marginTop: 6,
    fontWeight: "400",
  },
  metricContextOnLight: {
    color: "rgba(2,6,23,0.68)",
  },

  // WIDE CONTAINER (matches allProjectsContainer)
  wideContainer: {
    marginHorizontal: -edge,
    paddingHorizontal: desktopWeb ? 8 : 4,
  },
  /** Extra left/right inset + vertical gap between Key Metrics strip and AI Insights (Overview tab) */
  overviewKeyMetricsAiInsights: {
    paddingHorizontal: 12,
  },
  overviewKeyMetricsBottomSpacing: {
    marginBottom: desktopWeb ? 14 : 18,
  },
  /** Desktop web: Key Metrics title row — full bleed like segment; titles centered */
  keyMetricsClusterDesktop: {
    width: "100%",
  },
  keyMetricsHeaderDesktop: {
    justifyContent: "center",
  },
  aiInsightsHeaderTopSpacing: {
    marginTop: 4,
  },

  // SECTION HEADERS
  sectionHeaderRow: {
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: -edge,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: desktopWeb ? 19 : 18,
    fontWeight: Colors.bg === '#000000' ? "700" : "800", // Heavier in light mode
    color: Colors.bg === '#000000' ? "#e5e7eb" : "#0F172A",
  },
  sectionSubtitle: {
    fontSize: desktopWeb ? 14 : 13,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.9)" : "#334155",
    marginTop: 2,
  },
  overviewAiInsightsSubtitle: {
    fontSize: 12,
    opacity:
      desktopWeb && Colors.bg === "#000000"
        ? 0.98
        : Colors.bg === "#000000"
          ? 0.94
          : 0.96,
    marginTop: 1,
  },
  aiInsightsCollapsedHint: {
    fontSize: desktopWeb ? 14 : 13,
    lineHeight: desktopWeb ? 20 : 18,
    color:
      desktopWeb && Colors.bg === "#000000"
        ? "rgba(255,255,255,0.84)"
        : Colors.bg === "#000000"
          ? "rgba(255,255,255,0.9)"
          : "#475569",
    paddingHorizontal: 4,
  },
  aiInsightsShowMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  aiInsightsShowMoreInner: {
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  aiInsightsShowMorePrimary: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#e5e7eb" : Colors.text,
  },
  aiInsightsShowMoreSecondary: {
    fontSize: 11,
    fontWeight: "500",
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.82)" : "#475569",
  },
  aiInsightsShowMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#22c55e" : Colors.primary,
  },
  /** Space below AI Insights (hint, preview, or expanded card) before All Projects */
  aiInsightsSectionBottomSpacing: {
    marginBottom: 16,
  },

  // AI INSIGHTS PANEL
  aiPanelBorder: {
    borderRadius: 20,
    padding: 1,
  },
  aiPanelInner: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 18,
    padding: 14,
  },
  aiPanel: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 20,
    padding: 16,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    marginBottom: 16,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  aiPanelWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  aiPanelPausedText: {
    fontSize: desktopWeb ? 13 : 12,
    color:
      desktopWeb && Colors.bg === "#000000"
        ? "rgba(255,255,255,0.88)"
        : Colors.bg === "#000000"
          ? "rgba(255,255,255,0.88)"
          : "#334155",
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  insightIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  insightBody: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.bg === '#000000' ? "rgba(255,255,255,0.9)" : "#475569",
    marginTop: 2,
  },

  // NEXT STEPS
  nextStepsBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  nextStepsInner: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 18,
    padding: 18,
  },
  nextStepsCard: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    padding: 14,
    marginBottom: 16,
    shadowColor: Colors.bg === '#000000' ? "transparent" : "#0F172A",
    shadowOpacity: Colors.bg === '#000000' ? 0 : 0.05,
    shadowRadius: Colors.bg === '#000000' ? 0 : 10,
    shadowOffset: { width: 0, height: Colors.bg === '#000000' ? 0 : 4 },
    elevation: Colors.bg === '#000000' ? 0 : 2,
  },
  nextStepsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingVertical: 2,
  },
  nextStepBullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 10,
    marginTop: 6,
  },
  nextStepLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.bg === '#000000' ? "#f1f5f9" : Colors.text,
  },
  nextStepChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.22)",
    marginLeft: 8,
    marginTop: 2,
    flexShrink: 0,
  },
  nextStepChipText: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.bg === '#000000' ? "#86efac" : "#166534",
    fontWeight: "600",
  },

  // FLOATING AI BADGE
  aiFloatingWrapper: {
    position: "absolute",
    right: desktopWeb ? 28 : 18,
    bottom: 96,
    zIndex: 10,
  },
  aiFloating: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  aiFloatingText: {
    marginLeft: 6,
    fontSize: desktopWeb ? 12 : 11,
    fontWeight: "600",
    color: "#d4d4d8",
  },
  aiFloatingTextOn: {
    color: "#ecfdf5",
  },
  aiFloatingWrapperCalendarTab: {
    opacity: 0.9,
    bottom: 102,
  },
  aiFloatingCalendarTab: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  aiFloatingTextCalendarTab: {
    fontSize: 10,
  },
});
};

/**
 * Single source of `getStyles` for dashboard + all subcomponents: applies **desktop web** layout
 * (wider padding, type scale) only when `Platform.OS === "web"` and width ≥ `DESKTOP_WEB_MIN_WIDTH`.
 * Native iOS/Android always get `desktopWeb === false`.
 */
function useDashboardStyles(Colors: any, scrollBottomInset: number = 120) {
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === "web" && isDesktopWebLayoutWidth(width);
  return useMemo(
    () => getStyles(Colors, scrollBottomInset, desktopWeb, width),
    [Colors, scrollBottomInset, desktopWeb, width]
  );
}

export default DashboardScreen;

