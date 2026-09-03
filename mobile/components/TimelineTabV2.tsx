import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Alert, ScrollView, RefreshControl, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { Colors, COLORS } from "../src/theme/colors";
import ProgressBar from "./timeline/ProgressBar";
import EditMilestoneModal from "./EditMilestoneModal";
import AddDailyLogModal, { type DailyLogEntry } from "./AddDailyLogModal";
import ProjectPhotosCard from "./ProjectPhotosCard";
import { listProjectPhotos, deleteProjectPhoto, type ProjectPhoto } from "@/services/projectPhotoService";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useProjectList } from "../contexts/ProjectListContext";
import type { Milestone } from "../src/types/timeline";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { KEYBOARD_SCROLL_DEFAULTS } from "@/constants/keyboardScrollProps";
import {
  getApprovedChangeOrderPaymentRows,
  formatChangeOrderPaymentRowTitle,
  isChangeOrderTimelineMilestone,
} from "@/src/lib/projectFinancials";
import { businessWorkspaceService } from "@/services/businessWorkspaceService";
import { mergeArrayResource } from "@/utils/workspaceResourceMerge";
import { invalidateWorkspaceTimelineProgressCache } from "@/utils/workspaceTimelineProgress";
import { useWorkspaceProjectPermissions } from "@/hooks/useWorkspaceProjectPermissions";
import { submitCloseoutCalibration } from "@/utils/contractorPricingMemory";
import { tabFlowCardStyle } from "@/components/layout/TabFlowCard";
import { ESTIMATE_FLOW_NESTED_CARD_BG_DARK } from "@/utils/estimateFlowCardStyle";

/** Merge list + live ProjectData so change orders match Budget tab. */
function mergeProjectRecordForTimelineCo(project: any, projectFromList: any, projectData: any) {
  return {
    ...(projectFromList || {}),
    ...(project || {}),
    estimateData:
      (project as any)?.estimateData ??
      projectFromList?.estimateData ??
      projectData?.estimateData ??
      (project as any)?.projectData?.estimateData ??
      projectFromList?.projectData?.estimateData,
    projectData: {
      ...(projectFromList?.projectData || {}),
      ...(project?.projectData || {}),
      ...(projectData || {}),
    },
    changeOrders:
      projectData?.changeOrders ??
      (project as any)?.changeOrders ??
      (project as any)?.projectData?.changeOrders ??
      projectFromList?.changeOrders ??
      projectFromList?.projectData?.changeOrders,
  };
}

/** Non-blocking: feed actuals into pricing memory when job is marked complete. */
function fireCloseoutCalibration(project: any, projectFromList: any, projectData: any) {
  try {
    const merged = mergeProjectRecordForTimelineCo(project, projectFromList, projectData);
    void submitCloseoutCalibration(merged).then((result) => {
      if (__DEV__) {
        console.log('📊 Close-out calibration', result?.status, result?.message);
      }
      const tips = result?.pendingSuggestionCount || 0;
      if (tips > 0) {
        Alert.alert(
          'Rate tips ready',
          `${tips} rate insight${tips === 1 ? '' : 's'} from this job’s actual costs. Open Budget → Estimate vs actual → View rate insights.`
        );
      }
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('Close-out calibration failed to start', e);
    }
  }
}

/** Append approved CO payment rows so All Payments sums to adjusted contract (same $ as Overview/Budget). */
function appendChangeOrderPaymentMilestones(base: any[], mergedProject: any): any[] {
  const coRows = getApprovedChangeOrderPaymentRows(mergedProject);
  if (!coRows.length) return base;

  const addDays = (dateStr: string, days: number): string => {
    if (!dateStr) return new Date().toISOString().split("T")[0];
    try {
      const d = new Date(dateStr + "T12:00:00");
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    } catch {
      return dateStr;
    }
  };

  let maxMs = 0;
  let maxDate = "";
  for (const m of base) {
    const raw = m.scheduledDate ?? m.dueDate ?? m.date;
    if (!raw) continue;
    const t = new Date(String(raw)).getTime();
    const dm = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    const dateOnly = dm ? dm[1] : "";
    if (Number.isFinite(t) && t >= maxMs) {
      maxMs = t;
      maxDate = dateOnly || new Date(t).toISOString().split("T")[0];
    }
  }
  const anchorDate = maxDate || new Date().toISOString().split("T")[0];

  const seenIds = new Set(base.map((x: any) => String(x?.id ?? "")));
  const extras: any[] = [];
  let i = 0;
  for (const row of coRows) {
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    const raw = row.dateRaw ? String(row.dateRaw) : "";
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    const fromCo = m ? m[1] : "";
    const sched =
      fromCo && !Number.isNaN(new Date(fromCo + "T12:00:00").getTime())
        ? fromCo
        : addDays(anchorDate, 7 + i++ * 3);
    extras.push({
      id: row.id,
      name: row.title,
      title: row.title,
      type: "change_order",
      paymentAmount: row.amount,
      amount: row.amount,
      scheduledDate: sched,
      dueDate: sched,
      status: "pending",
    });
  }
  return [...base, ...extras];
}

/** Supporting text on Timeline — neutral grey / soft white (not full white; keeps hierarchy). */
function timelineMuted(dark: boolean) {
  return dark ? "rgba(255,255,255,0.86)" : "#475569";
}
function timelineCaption(dark: boolean) {
  return dark ? "rgba(255,255,255,0.70)" : "#64748b";
}

/* -------------------- helpers -------------------- */

const getStorageKey = (projectId: string) => `bps.timeline.v2.${projectId}`;
const BID_STORAGE_KEY = "bps.currentBid.v2";

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n || 0));
}

// Exclude deposit from progress — it's paid before work starts; Week 1+ represents actual work
function isDepositMilestone(m: Milestone): boolean {
  const t = (m.title || (m as any).name || "").toLowerCase();
  return t.includes("deposit") || (m as any).type === "deposit";
}

/** Payment / billing rows — hidden from foreman & field on Timeline. */
function isPaymentTimelineMilestone(m: Milestone): boolean {
  if (isDepositMilestone(m)) return true;
  if (isChangeOrderTimelineMilestone(m)) return true;
  const type = String((m as any).type || '').toLowerCase();
  if (type === 'payment' || type === 'holdback' || type === 'deposit' || type === 'weekly') {
    return true;
  }
  const t = (m.title || (m as any).name || '').toLowerCase();
  if (typeof m.amount === 'number' && m.amount > 0) return true;
  if (
    t.includes('payment') ||
    t.includes('deposit') ||
    t.includes('holdback') ||
    t.includes('retainage') ||
    t.includes('invoice') ||
    t.includes('billing') ||
    t.includes('collect') ||
    /\bprogress\s+pay/i.test(t)
  ) {
    return true;
  }
  if (/week\s*\d/i.test(t) && (t.includes('pay') || t.includes('progress'))) return true;
  return false;
}

function computeOverallPct(items: Milestone[]) {
  const workItems = items.filter((m) => !isDepositMilestone(m) && !isChangeOrderTimelineMilestone(m));
  if (!workItems.length) return 0;
  return workItems.reduce((acc, m) => acc + clampPct(m.progressPct), 0) / workItems.length;
}

function safeISODate(isoLike: string) {
  // Normalize to YYYY-MM-DD without timezone shifts (date-only strings are source of truth)
  try {
    if (!isoLike || typeof isoLike !== "string") return new Date().toISOString().split("T")[0];
    const trimmed = String(isoLike).trim();
    // If already YYYY-MM-DD (or ISO with date), extract date part - avoid new Date() for date-only to prevent UTC shift
    const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnlyMatch) return dateOnlyMatch[1];
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateString: string) {
  try {
    const d = new Date(safeISODate(dateString) + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
  } catch {
    return "Invalid Date";
  }
}

function statusLabel(status?: string) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  return "Pending";
}

function statusPillStyle(status?: string, darkMode = true) {
  if (status === "completed") return { bg: "rgba(34, 197, 94, 0.25)", text: "#22c55e", border: "#22c55e" };
  if (status === "in_progress") return { bg: "rgba(34, 211, 238, 0.15)", text: "#22d3ee", border: "#22c55e" };
  return {
    bg: "rgba(180,195,215,0.18)",
    text: darkMode ? "#FFFFFF" : "rgba(234,241,247,0.75)",
    border: "rgba(148, 163, 184, 0.4)",
  };
}

function isMilestoneReceived(m: Milestone): boolean {
  const status = String(m.status || "").toLowerCase();
  if (status === "completed" || status === "complete" || status === "paid") return true;
  return Boolean((m as Milestone & { collectedAt?: string }).collectedAt);
}

function sortMilestonesByPlannedDate(items: Milestone[]): Milestone[] {
  return [...items].sort(
    (a, b) =>
      new Date(safeISODate(a.plannedDate)).getTime() - new Date(safeISODate(b.plannedDate)).getTime()
  );
}

/* -------------------- Milestone Card (matches app design) -------------------- */

function MilestoneCardV2({
  item,
  dependencyTitle,
  onPress,
}: {
  item: Milestone;
  dependencyTitle?: string;
  onPress: (m: Milestone) => void;
}) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const muted = timelineMuted(darkMode);
  const caption = timelineCaption(darkMode);
  const pill = statusPillStyle(item.status, darkMode);
  const pendingPill = !darkMode && item.status !== "completed" && item.status !== "in_progress";
  const pillBg = pendingPill ? "#CBD5E1" : pill.bg;
  const pillText = pendingPill ? "#111827" : pill.text;
  const pct = clampPct(item.progressPct);
  const hasAmount = typeof item.amount === "number" && item.amount > 0;
  const metaLines =
    (item.assignee ? 1 : 0) + (dependencyTitle ? 1 : 0);

  const cardPressStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      styles.mCard,
      {
        backgroundColor: Colors.surface2,
        borderWidth: 1,
        borderColor: darkMode ? "rgba(148, 163, 184, 0.14)" : Colors.line,
        borderRadius: 14,
        opacity: pressed ? 0.92 : 1,
      },
      Platform.OS === "web" && ({ cursor: "pointer" } as const),
    ],
    [Colors.surface2, darkMode]
  );

  return (
    <View style={styles.milestoneCardContainer}>
        <Pressable
          onPress={() => onPress(item)}
          style={cardPressStyle}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.title || "milestone"}`}
        >
          <Text style={[styles.mTitle, !darkMode && { color: Colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>

          <View style={styles.mAmountRow}>
            {hasAmount ? (
              <View style={styles.amountPill}>
                <Text style={styles.amountText}>${Number(item.amount ?? 0).toLocaleString()}</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Text style={[styles.mPctSecondary, { color: caption }]}>{Math.round(pct)}%</Text>
          </View>

          <View style={[styles.mStatusDateRow, !darkMode && { borderBottomColor: "rgba(15,23,42,0.08)" }]}>
            <View style={[styles.statusPill, { backgroundColor: pillBg, borderWidth: 1, borderColor: pill.border || "transparent" }]}>
              <Text style={[styles.statusText, { color: pillText }]}>{statusLabel(item.status)}</Text>
            </View>
            <Text style={[styles.mDateLine, { color: muted }]}>{formatDate(item.plannedDate)}</Text>
          </View>

          {metaLines > 0 ? (
            <View
              style={[
                styles.mMetaGroup,
                {
                  backgroundColor: darkMode ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.04)",
                  borderColor: darkMode ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)",
                },
              ]}
            >
              {item.assignee ? (
                <Text style={styles.mMetaLine}>
                  <Text style={{ fontWeight: "700", color: caption }}>Assigned </Text>
                  <Text style={{ color: muted }}>{item.assignee}</Text>
                </Text>
              ) : null}
              {dependencyTitle ? (
                <Text style={[styles.mMetaLine, { marginTop: item.assignee ? 6 : 0 }]}>
                  <Text style={{ fontWeight: "700", color: caption }}>Depends on </Text>
                  <Text style={{ color: muted }}>{dependencyTitle}</Text>
                </Text>
              ) : null}
            </View>
          ) : null}

          {typeof item.costDelta === "number" && item.costDelta !== 0 && item.costCategory ? (
            <Text style={styles.costImpact}>
              Cost Impact: {item.costDelta >= 0 ? "+" : "-"}${Math.abs(item.costDelta).toLocaleString()} →{" "}
              {String(item.costCategory).charAt(0).toUpperCase() + String(item.costCategory).slice(1)}
            </Text>
          ) : null}

          <View style={styles.mProgressContainer}>
            <ProgressBar value={pct} emphasis />
          </View>
        </Pressable>
    </View>
  );
}

/* -------------------- main -------------------- */

interface TimelineTabProps {
  project: any;
  theme?: "dark" | "light";
  embedded?: boolean;
}

export default function TimelineTabV2({
  project,
  embedded = false,
}: TimelineTabProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const muted = timelineMuted(darkMode);
  const caption = timelineCaption(darkMode);
  const isWeb = Platform.OS === "web";
  const timelineFlowCardStyle = useMemo(
    () => tabFlowCardStyle(Colors, darkMode, { marginBottom: 14 }),
    [Colors, darkMode],
  );
  const nestedCardBg = darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : Colors.surface2;
  const nestedCardBorder = darkMode ? "rgba(148,163,184,0.12)" : Colors.line;

  const { addExpense, updateExpense, deleteExpense, projectData, updateTimeline } = useProjectData();
  const { updateProject, getProjectById } = useProjectList();
  const { canViewPaymentSchedule, canCollectPayments } = useWorkspaceProjectPermissions();

  const projectFromList = useMemo(() => {
    if (!project?.id || !getProjectById) return null;
    try {
      return getProjectById(project.id);
    } catch {
      return null;
    }
  }, [project?.id, getProjectById]);

  const lastSyncedMilestonesRef = useRef<string>("");
  const lastProgressUpdateRef = useRef<number>(-1);
  const isUpdatingRef = useRef<boolean>(false);
  const hasLoadedForProjectRef = useRef<string>("");
  const isLoadingRef = useRef<boolean>(false);
  const lastEstimateDataRef = useRef<string>("");
  const milestonesRef = useRef<Milestone[]>([]);
  milestonesRef.current = milestones;

  // Live bid from Estimate tab (when user edits dates there) - use when bid.id matches project
  const [liveBidPaymentData, setLiveBidPaymentData] = useState<{
    paymentMilestones: any[];
    weeklyPayments: any[];
    paymentSchedule?: string;
  } | null>(null);
  useEffect(() => {
    if (!project?.id) {
      setLiveBidPaymentData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(BID_STORAGE_KEY);
        if (!raw || cancelled) return;
        const bid = JSON.parse(raw);
        if (bid?.id === project.id && (bid.paymentMilestones?.length || bid.weeklyPayments?.length)) {
          if (!cancelled) {
            setLiveBidPaymentData({
              paymentMilestones: bid.paymentMilestones || [],
              weeklyPayments: bid.weeklyPayments || [],
              paymentSchedule: bid.paymentSchedule,
            });
          }
        } else {
          if (!cancelled) setLiveBidPaymentData(null);
        }
      } catch {
        if (!cancelled) setLiveBidPaymentData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [project?.id]);

  /* ---------- conversions ---------- */

  const convertWeeklyPaymentsToMilestones = (weeklyPayments: any[] = []): Milestone[] => {
    if (!Array.isArray(weeklyPayments)) return [];
    return weeklyPayments.map((payment, index) => ({
      id: payment.id || `week-${index}`,
      title:
        payment.description || payment.name || `Week ${payment.weekNumber || index + 1} Payment`,
      plannedDate: safeISODate(payment.scheduledDate || payment.dueDate || payment.date || payment.plannedDate || new Date().toISOString()),
      progressPct: payment.progressPct || 0,
      status: payment.status || "pending",
      assignee: payment.assignee || "Client",
      costDelta: payment.costDelta || 0,
      costCategory: payment.costCategory || "materials",
      dependsOnId: payment.dependsOnId,
      amount: payment.amount || payment.paymentAmount || 0,
      ...(payment.actualDate ? { actualDate: safeISODate(String(payment.actualDate)) } : {}),
      ...(payment.collectedAt ? { collectedAt: String(payment.collectedAt) } : {}),
    }));
  };

  const convertPaymentMilestonesToTimeline = (paymentMilestones: any[]): Milestone[] => {
    if (!paymentMilestones || !Array.isArray(paymentMilestones)) return [];
    return paymentMilestones.map((milestone, index) => {
      const rawTitle = milestone.name || milestone.title || `Payment ${index + 1}`;
      const isCoRow =
        (milestone as any).type === "change_order" || String(milestone.id || "").startsWith("bps-co-");
      const title = isCoRow ? formatChangeOrderPaymentRowTitle(String(rawTitle)) : rawTitle;
      return {
      id: milestone.id || `payment-${index}`,
      title,
      plannedDate: safeISODate(milestone.scheduledDate || milestone.dueDate || new Date(Date.now() + (index + 1) * 7 * 86400000).toISOString()),
      progressPct:
        milestone.status === "completed" ? 100 : milestone.status === "in_progress" ? 50 : 0,
      status:
        milestone.status === "completed"
          ? "completed"
          : milestone.status === "in_progress"
          ? "in_progress"
          : "pending",
      assignee: milestone.assignee || "Client",
      costDelta: milestone.costDelta || 0,
      costCategory: milestone.costCategory || "materials",
      dependsOnId: index > 0 ? paymentMilestones[index - 1]?.id || `payment-${index - 1}` : undefined,
      amount: milestone.paymentAmount || milestone.amount || 0,
      ...(milestone.actualDate ? { actualDate: safeISODate(String(milestone.actualDate)) } : {}),
      ...(milestone.collectedAt ? { collectedAt: String(milestone.collectedAt) } : {}),
    };
    });
  };

  const collectPaymentMilestones = useCallback(() => {
    const mergedForCo = mergeProjectRecordForTimelineCo(project, projectFromList, projectData);
    const withChangeOrders = (arr: any[]) => appendChangeOrderPaymentMilestones(arr || [], mergedForCo);

    const baseEstimate = (project as any)?.estimateData || projectFromList?.estimateData || {};
    // Prefer live bid from Estimate tab (bps.currentBid.v2) when it matches this project — ensures dates match what user sees in Estimate
    const estimateData = liveBidPaymentData
      ? { ...baseEstimate, paymentMilestones: liveBidPaymentData.paymentMilestones, weeklyPayments: liveBidPaymentData.weeklyPayments, paymentSchedule: liveBidPaymentData.paymentSchedule ?? baseEstimate?.paymentSchedule }
      : baseEstimate;
    const scheduleType = (project as any)?.paymentSchedule ?? estimateData?.paymentSchedule ?? "milestone-based";

    // For hybrid schedules, combine paymentMilestones (deposit, etc.) + weeklyPayments (week 1, 2, etc.)
    // Prefer estimateData (or live bid) for payment schedule so timeline dates match Estimate page
    const getMilestones = () => {
      if (estimateData?.milestones?.length) return estimateData.milestones;
      if (project?.milestones?.length) return project.milestones;
      if (projectFromList?.milestones?.length) return projectFromList.milestones;
      return [];
    };
    const getPaymentMilestones = () => {
      if (estimateData?.paymentMilestones?.length) return estimateData.paymentMilestones;
      if (project?.milestones?.length) return project.milestones;
      if (projectFromList?.milestones?.length) return projectFromList.milestones;
      return [];
    };
    const getWeeklyPayments = () => {
      if (estimateData?.weeklyPayments?.length) return estimateData.weeklyPayments;
      if (project?.weeklyPayments?.length) return project.weeklyPayments;
      if (projectFromList?.weeklyPayments?.length) return projectFromList.weeklyPayments;
      return [];
    };

    const milestones = getMilestones();
    const paymentMs = getPaymentMilestones();
    const weekly = getWeeklyPayments();

    // Weekly schedule source of truth: weeklyPayments.
    // Do not let stale paymentMilestones override weekly dates.
    if (scheduleType === "weekly") {
      const srcWeeklyOnly = (estimateData?.weeklyPayments?.length ? estimateData.weeklyPayments : weekly) || [];
      if (srcWeeklyOnly.length) {
        const startDateOnly = (() => {
          const raw = (project as any)?.estimateData?.projectStartDate ?? (project as any)?.startDate ?? projectFromList?.estimateData?.projectStartDate ?? projectFromList?.startDate;
          const match = raw ? String(raw).match(/^\d{4}-\d{2}-\d{2}/) : null;
          return match ? match[0] : "";
        })();
        const addDays = (dateStr: string, days: number): string => {
          if (!dateStr) return "";
          try {
            const d = new Date(dateStr + "T12:00:00");
            d.setDate(d.getDate() + days);
            return d.toISOString().split("T")[0];
          } catch {
            return dateStr;
          }
        };
        const normalizeDateOnly = (raw: any): string => {
          const m = String(raw || "").match(/^\d{4}-\d{2}-\d{2}/);
          return m ? m[0] : "";
        };
        const milestoneDeposit = paymentMs.find((m: any) =>
          (m.type || "").toString().toLowerCase() === "deposit" ||
          /deposit/.test((m.name || m.title || "").toString().toLowerCase())
        );
        const inferredDepositDate =
          normalizeDateOnly(milestoneDeposit?.scheduledDate ?? milestoneDeposit?.dueDate) ||
          (startDateOnly ? addDays(startDateOnly, 7) : "");
        const fromWeeklyOnly = srcWeeklyOnly.map((w: any, i: number) => {
          const weekNo = Number(w.weekNumber ?? i + 1);
          const fallbackDate = weekNo === 0
            ? inferredDepositDate
            : (inferredDepositDate ? addDays(inferredDepositDate, weekNo * 7) : "");
          return {
            ...w,
            id: w.id || `week-${i}`,
            name: w.description || w.name || `Week ${w.weekNumber ?? i + 1} Payment`,
            title: w.description || w.name || `Week ${w.weekNumber ?? i + 1} Payment`,
            scheduledDate: w.scheduledDate ?? w.dueDate ?? fallbackDate,
            dueDate: w.scheduledDate ?? w.dueDate ?? fallbackDate,
            paymentAmount: w.amount ?? w.paymentAmount ?? 0,
            amount: w.amount ?? w.paymentAmount ?? 0,
            status: w.status ?? "pending",
          };
        });
        return withChangeOrders(fromWeeklyOnly);
      }
      // Fall back only when weeklyPayments are missing.
      if (paymentMs.length) return withChangeOrders(paymentMs);
      if (milestones.length) return withChangeOrders(milestones);
    }

    // Hybrid: deposit + week 1, week 2, etc. — combine from estimate to avoid duplicates.
    const edPaymentMs = estimateData?.paymentMilestones || [];
    const edWeekly = estimateData?.weeklyPayments || [];
    const hasBoth = edPaymentMs.length > 0 && edWeekly.length > 0;
    const pmAlreadyMerged = paymentMs.some((m: any) => /week\s*\d/i.test((m.title || m.name || "")));
    const isHybrid = scheduleType === "hybrid" || hasBoth || (paymentMs.length > 0 && weekly.length > 0 && !pmAlreadyMerged);
    const srcPaymentMs = edPaymentMs.length > 0 ? edPaymentMs : paymentMs;
    const srcWeekly = edWeekly.length > 0 ? edWeekly : (pmAlreadyMerged ? [] : weekly);
    if (isHybrid && (srcPaymentMs.length || srcWeekly.length)) {
      const startDateOnly = (() => {
        const raw = (project as any)?.estimateData?.projectStartDate ?? (project as any)?.startDate ?? projectFromList?.estimateData?.projectStartDate ?? projectFromList?.startDate;
        if (!raw) return "";
        const match = String(raw).match(/^\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : "";
      })();
      const normalizeDateOnly = (raw: any): string => {
        const m = String(raw || "").match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : "";
      };
      const addDays = (dateStr: string, days: number): string => {
        if (!dateStr) return "";
        try {
          const d = new Date(dateStr + "T12:00:00");
          d.setDate(d.getDate() + days);
          return d.toISOString().split("T")[0];
        } catch {
          return dateStr;
        }
      };
      const msDeposit = srcPaymentMs.find((m: any) =>
        (m.type || "").toString().toLowerCase() === "deposit" ||
        /deposit/.test((m.name || m.title || "").toString().toLowerCase())
      );
      const weeklyDeposit = srcWeekly.find((w: any) =>
        Number(w.weekNumber) === 0 || /deposit/.test((w.description || "").toString().toLowerCase())
      );
      const inferredDepositDate =
        normalizeDateOnly(msDeposit?.scheduledDate ?? msDeposit?.dueDate) ||
        normalizeDateOnly(weeklyDeposit?.scheduledDate ?? weeklyDeposit?.dueDate) ||
        (startDateOnly ? addDays(startDateOnly, 7) : "");
      const fromMs = srcPaymentMs.map((m: any, i: number) => {
        const raw = m.scheduledDate ?? m.dueDate;
        const isDeposit = (m.type || "").toString().toLowerCase() === "deposit" || /deposit/.test((m.name || m.title || "").toString().toLowerCase());
        // Never use project start date as the deposit date — deposit is due after start (e.g. start 3/21, deposit 3/28)
        let scheduledDate = raw;
        if (isDeposit && startDateOnly) {
          const rawNorm = raw ? safeISODate(raw) : "";
          if (!rawNorm || rawNorm === startDateOnly) scheduledDate = inferredDepositDate || addDays(startDateOnly, 7);
        }
        return {
          id: m.id || `payment-${i}`,
          name: m.name || m.title,
          title: m.title || m.name,
          paymentAmount: m.amount ?? m.paymentAmount ?? 0,
          amount: m.amount ?? m.paymentAmount ?? 0,
          scheduledDate: scheduledDate ?? raw,
          dueDate: scheduledDate ?? raw ?? m.dueDate ?? m.scheduledDate,
          status: m.status ?? "pending",
        };
      });
      const fromWeekly = srcWeekly.map((w: any, i: number) => {
        const weekNo = Number(w.weekNumber ?? i + 1);
        const inferredWeekDate =
          weekNo === 0
            ? inferredDepositDate
            : (inferredDepositDate ? addDays(inferredDepositDate, weekNo * 7) : "");
        const scheduledDate = w.scheduledDate ?? w.dueDate ?? inferredWeekDate;
        return {
          id: w.id || `week-${i}`,
          name: w.description || `Week ${w.weekNumber ?? i + 1} Payment`,
          title: w.description || `Week ${w.weekNumber ?? i + 1} Payment`,
          paymentAmount: w.amount ?? 0,
          amount: w.amount ?? 0,
          scheduledDate,
          dueDate: scheduledDate,
          status: w.status ?? "pending",
        };
      });
      const combined = [...fromMs, ...fromWeekly].sort((a, b) => {
        const dA = new Date(a.scheduledDate || a.dueDate || 0).getTime();
        const dB = new Date(b.scheduledDate || b.dueDate || 0).getTime();
        return dA - dB;
      });
      return withChangeOrders(combined);
    }

    // Non-hybrid: use milestones if available
    if (milestones.length) return withChangeOrders(milestones);

    if (paymentMs.length) return withChangeOrders(paymentMs);
    if (weekly.length) return withChangeOrders(convertWeeklyPaymentsToMilestones(weekly));

    if (estimateData?.weeklyPayments?.length) {
      return withChangeOrders(
        estimateData.weeklyPayments.map((w: any, i: number) => ({
          id: w.id || `week-${i}`,
          name: w.description || `Week ${w.weekNumber || i + 1} Payment`,
          paymentAmount: w.amount || 0,
          amount: w.amount || 0,
          percentage: w.percentage || 0,
          scheduledDate: w.scheduledDate,
          dueDate: w.scheduledDate,
          description: w.description,
          status: "pending",
        }))
      );
    }

    return withChangeOrders([]);
  }, [
    liveBidPaymentData,
    project?.milestones,
    project?.weeklyPayments,
    projectFromList?.milestones,
    projectFromList?.weeklyPayments,
    (project as any)?.estimateData,
    (project as any)?.paymentSchedule,
    (project as any)?.changeOrders,
    (project as any)?.projectData?.changeOrders,
    projectFromList?.changeOrders,
    projectFromList?.projectData?.changeOrders,
    projectData?.changeOrders,
  ]);

  const convertTimelineMilestonesToProject = () => {
    const existingLookup = new Map(
      [
        ...(project?.milestones || []),
        ...convertWeeklyPaymentsToMilestones(project?.weeklyPayments || []),
        ...(projectFromList?.milestones || []),
        ...convertWeeklyPaymentsToMilestones(projectFromList?.weeklyPayments || []),
        ...(((project as any)?.estimateData?.paymentMilestones) || []),
        ...convertWeeklyPaymentsToMilestones(((project as any)?.estimateData?.weeklyPayments) || []),
      ]
        .filter(Boolean)
        .map((m: any, index: number) => [m.id || m.name || m.title || `existing-${index}`, m])
    );

    return milestones.map((milestone, index) => {
      const existing = existingLookup.get(milestone.id);
      const fallbackTitle = `Payment ${index + 1}`;
      return {
        id: milestone.id || existing?.id || `payment-${index}`,
        name: milestone.title || existing?.name || fallbackTitle,
        title: milestone.title || existing?.title || fallbackTitle,
        description: existing?.description || "",
        scheduledDate: safeISODate(milestone.plannedDate || existing?.scheduledDate || new Date().toISOString()),
        dueDate: safeISODate(milestone.plannedDate || existing?.dueDate || milestone.plannedDate),
        status: milestone.status || existing?.status || "pending",
        paymentAmount: milestone.amount ?? existing?.paymentAmount ?? existing?.amount ?? 0,
        amount: milestone.amount ?? existing?.amount ?? milestone.amount ?? 0,
        percentage: existing?.percentage ?? 0,
        assignee: milestone.assignee || existing?.assignee || "Client",
        collectedAt: (milestone as Milestone & { collectedAt?: string }).collectedAt ?? (existing as any)?.collectedAt,
        ...((milestone as Milestone).actualDate
          ? { actualDate: safeISODate(String((milestone as Milestone).actualDate)) }
          : {}),
      };
    });
  };

  // Render the schedule already present on the project while storage/workspace data hydrates.
  const initialMilestones = useMemo(() => {
    const paymentMilestones = collectPaymentMilestones();
    return paymentMilestones.length
      ? convertPaymentMilestonesToTimeline(paymentMilestones)
      : [];
  }, [collectPaymentMilestones]);

  /* ---------- load/save ---------- */

  // Force reload trigger for payment collection updates
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // Daily logs state
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [projectPhotos, setProjectPhotos] = useState<ProjectPhoto[]>([]);
  const [showAddDailyLog, setShowAddDailyLog] = useState(false);
  const [editingDailyLog, setEditingDailyLog] = useState<DailyLogEntry | null>(null);

  const openAddDailyLog = useCallback(() => {
    setEditingDailyLog(null);
    setShowAddDailyLog(true);
  }, []);

  const openEditDailyLog = useCallback((log: DailyLogEntry) => {
    setEditingDailyLog(log);
    setShowAddDailyLog(true);
  }, []);

  const closeDailyLogModal = useCallback(() => {
    setShowAddDailyLog(false);
    setEditingDailyLog(null);
  }, []);

  const pushDailyLogsToBusinessWorkspace = useCallback(
    (logs: any[]) => {
      if (!project?.id) return;
      businessWorkspaceService
        .pushProjectResource(project.id, "dailyLogs", logs)
        .catch((error) => console.warn("Business workspace daily log sync failed:", error));
    },
    [project?.id]
  );

  const pushTimelineToBusinessWorkspace = useCallback(
    (items: any[]) => {
      if (!project?.id) return;
      businessWorkspaceService
        .pushProjectResource(project.id, "timeline", items)
        .then((result) => {
          if (result?.success) {
            invalidateWorkspaceTimelineProgressCache(project.id);
          }
        })
        .catch((error) => console.warn("Business workspace timeline sync failed:", error));
    },
    [project?.id]
  );

  // Load daily logs from AsyncStorage
  const loadDailyLogs = useCallback(async () => {
    if (!project?.id) {
      console.log('⚠️ Cannot load daily logs: no project ID');
      return;
    }
    try {
      const logKey = `daily_logs_${project.id}`;
      console.log('📝 Loading daily logs with key:', logKey);
      const raw = await AsyncStorage.getItem(logKey);
      const parsedLogs = raw ? JSON.parse(raw) : [];
      const localLogs = Array.isArray(parsedLogs) ? parsedLogs : [];
      const sharedResult = await businessWorkspaceService.getProjectResources(project.id).catch(() => null);
      const sharedResource = sharedResult?.success ? sharedResult.data?.resources?.dailyLogs : undefined;
      const sharedLogs = Array.isArray(sharedResource?.payload)
        ? (sharedResource.payload as DailyLogEntry[])
        : [];
      const logs = await mergeArrayResource(
        project.id,
        'dailyLogs',
        localLogs,
        sharedLogs,
        sharedResource?.updatedAt,
        ['id']
      );
      if (sharedLogs.length > 0) {
        await AsyncStorage.setItem(logKey, JSON.stringify(logs));
      }
      console.log('📝 Found logs:', logs.length);
      const sorted = logs.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      console.log('📝 Sorted logs:', sorted.length);
      setDailyLogs(sorted);
    } catch (error) {
      console.error('❌ Error loading daily logs:', error);
      setDailyLogs([]);
    }
  }, [project?.id]);

  const loadProjectPhotos = useCallback(async () => {
    if (!project?.id) {
      setProjectPhotos([]);
      return;
    }
    try {
      const photos = await listProjectPhotos(project.id);
      setProjectPhotos(photos);
    } catch (error) {
      console.error('❌ Error loading project photos:', error);
      setProjectPhotos([]);
    }
  }, [project?.id]);

  // Delete daily log
  const deleteDailyLog = useCallback(async (logId: string) => {
    if (!project?.id) {
      console.log('⚠️ Cannot delete daily log: no project ID');
      return;
    }
    try {
      const logKey = `daily_logs_${project.id}`;
      const raw = await AsyncStorage.getItem(logKey);
      if (raw) {
        const logs = JSON.parse(raw);
        const logToDelete = Array.isArray(logs) ? logs.find((log: any) => log.id === logId) : null;
        const filtered = Array.isArray(logs) ? logs.filter((log: any) => log.id !== logId) : [];
        await AsyncStorage.setItem(logKey, JSON.stringify(filtered));
        pushDailyLogsToBusinessWorkspace(filtered);
        if (logToDelete?.photoIds?.length) {
          for (const photoId of logToDelete.photoIds) {
            await deleteProjectPhoto(project.id, photoId);
          }
          await loadProjectPhotos();
        }
        console.log('🗑️ Deleted daily log:', logId);
        // Reload logs
        setReloadTrigger(prev => prev + 1);
        // Haptic feedback
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.error('❌ Error deleting daily log:', error);
      Alert.alert('Error', 'Failed to delete daily log');
    }
  }, [project?.id, pushDailyLogsToBusinessWorkspace, loadProjectPhotos]);
  
  // Load daily logs on mount and when reloadTrigger changes
  useEffect(() => {
    loadDailyLogs();
    loadProjectPhotos();
  }, [loadDailyLogs, loadProjectPhotos, reloadTrigger]);

  // Reload daily logs when screen comes into focus (e.g., after adding a log via AI)
  useFocusEffect(
    useCallback(() => {
      loadDailyLogs();
      loadProjectPhotos();
    }, [loadDailyLogs, loadProjectPhotos])
  );
  
  useEffect(() => {
    if (!project?.id) return;
    if (isUpdatingRef.current) return;

    const paymentMilestones = collectPaymentMilestones();
    const estimateData = (project as any)?.estimateData || projectFromList?.estimateData || {};
    const estimateDataHash = JSON.stringify(estimateData);
    
    // Check if estimate data has changed or if this is a new project
    const estimateDataChanged = lastEstimateDataRef.current !== estimateDataHash;
    const isNewProject = hasLoadedForProjectRef.current !== project.id;

    // Allow reload if trigger changed (for payment collection updates)
    if (!isNewProject && !estimateDataChanged && reloadTrigger === 0) return;
    if (isLoadingRef.current && !isNewProject && reloadTrigger === 0) return;

    let cancelled = false;

    const loadMilestones = async () => {
      isLoadingRef.current = true;
      hasLoadedForProjectRef.current = project.id;
      lastEstimateDataRef.current = estimateDataHash;

      try {
        const key = getStorageKey(project.id);
        const saved = await AsyncStorage.getItem(key);
        const sharedResult = await Promise.race([
          businessWorkspaceService.getProjectResources(project.id).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (cancelled) return;
        const sharedResource = sharedResult?.success ? sharedResult.data?.resources?.timeline : undefined;
        const sharedTimeline = Array.isArray(sharedResource?.payload)
          ? (sharedResource.payload as Milestone[])
          : [];

        const parsed = saved ? JSON.parse(saved) : [];
        const savedTimeline = Array.isArray(parsed) ? parsed : [];
        const storedTimeline = await mergeArrayResource(
          project.id,
          'timeline',
          savedTimeline,
          sharedTimeline,
          sharedResource?.updatedAt,
          ['id']
        );
        if (sharedTimeline.length > 0) {
          await AsyncStorage.setItem(key, JSON.stringify(storedTimeline));
        }

        if (storedTimeline.length) {
            // Start with estimate data as source of truth, merge saved status/progress
            if (paymentMilestones?.length) {
              const converted = convertPaymentMilestonesToTimeline(paymentMilestones);
              const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
              // Merge saved data (status, progress, etc.) into converted milestones
              const merged = converted.map((newM: Milestone) => {
                let savedM = storedTimeline.find((m: Milestone) => m.id === newM.id);
                if (!savedM) {
                  savedM = storedTimeline.find(
                    (m: Milestone) => norm(m.title || "") === norm(newM.title || "")
                  );
                }
                if (savedM) {
                  return {
                    ...newM,
                    status: savedM.status || newM.status,
                    progressPct: savedM.progressPct ?? newM.progressPct,
                    assignee: savedM.assignee || newM.assignee,
                    costDelta: savedM.costDelta,
                    costCategory: savedM.costCategory,
                    collectedAt: (savedM as Milestone & { collectedAt?: string }).collectedAt ?? (newM as Milestone & { collectedAt?: string }).collectedAt,
                    actualDate: (savedM as Milestone).actualDate ?? (newM as Milestone).actualDate,
                    // Always use current schedule dates (from estimate/project) so timeline matches Estimate page; only keep status/progress from saved.
                    plannedDate: newM.plannedDate,
                  };
                }
                return newM;
              });
              setMilestones(merged);
            } else {
              setMilestones(storedTimeline);
            }
        } else {
          setMilestones(paymentMilestones?.length ? convertPaymentMilestonesToTimeline(paymentMilestones) : []);
        }
      } catch {
        if (!cancelled) setMilestones([]);
      } finally {
        if (!cancelled) setIsLoaded(true);
        isLoadingRef.current = false;
      }
    };

    loadMilestones();
    return () => {
      cancelled = true;
      isLoadingRef.current = false;
    };
  }, [project?.id, projectFromList?.estimateData, (project as any)?.estimateData, collectPaymentMilestones, reloadTrigger]);
  
  // Reload timeline when tab is focused to catch payment collection updates
  // This ensures the timeline refreshes when user navigates back to Timeline tab
  useFocusEffect(
    useCallback(() => {
      if (!project?.id) return;
      console.log('🔄 Timeline tab focused - reloading milestones');
      setReloadTrigger(prev => prev + 1);
    }, [project?.id])
  );
  
  // Also reload when project data changes (e.g., after AI marks payment as collected)
  // This ensures progress updates immediately after external updates
  useEffect(() => {
    if (!project?.id || !isLoaded) return;
    // Reload once when component becomes ready
    const timer = setTimeout(() => {
      setReloadTrigger(prev => prev + 1);
    }, 100);
    return () => clearTimeout(timer);
  }, [project?.id, isLoaded]);
  
  // Reload milestones when project data updates (catches external updates like AI marking payments)
  // Also reload periodically to catch any external updates
  useEffect(() => {
    if (!project?.id || !isLoaded) return;
    // Small delay to ensure AsyncStorage has been updated
    const timer = setTimeout(() => {
      console.log('🔄 Project data changed - reloading milestones to catch external updates');
      setReloadTrigger(prev => prev + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [projectData?.updatedAt, project?.id, isLoaded]);
  
  // Periodic check for external updates (e.g., AI marking payments)
  // This ensures progress updates even if projectData.updatedAt doesn't change
  const timelineStatusSig = (arr: any[]) =>
    JSON.stringify(
      (Array.isArray(arr) ? arr : []).map((m: any) => ({
        id: m.id,
        st: m.status,
        p: m.progressPct,
      }))
    );

  useEffect(() => {
    if (!project?.id || !isLoaded) return;
    const interval = setInterval(() => {
      AsyncStorage.getItem(getStorageKey(project.id))
        .then((saved) => {
          if (!saved) return;
          const parsed = JSON.parse(saved);
          if (!Array.isArray(parsed)) return;
          const savedSig = timelineStatusSig(parsed);
          const currentSig = timelineStatusSig(milestonesRef.current);
          if (savedSig !== currentSig) {
            console.log("🔄 Timeline storage drift (status/count) — reloading");
            setReloadTrigger((prev) => prev + 1);
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [project?.id, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !project?.id) return;
    AsyncStorage.setItem(getStorageKey(project.id), JSON.stringify(milestones)).catch(() => {});
    pushTimelineToBusinessWorkspace(milestones);
  }, [milestones, isLoaded, project?.id, pushTimelineToBusinessWorkspace]);

  /* ---------- sync milestones + progress to ProjectList (deposit excluded) ---------- */

  useEffect(() => {
    if (!isLoaded || !project?.id || !updateProject || isUpdatingRef.current) return;
    if (!milestones.length) return;

    const projectMilestones = convertTimelineMilestonesToProject();
    const serialized = JSON.stringify(projectMilestones);
    if (serialized === lastSyncedMilestonesRef.current) return;

    lastSyncedMilestonesRef.current = serialized;
    isUpdatingRef.current = true;

    // Timeline progress (deposit excluded) is source of truth — copy to Projects/Dashboard
    const overallPct = Math.round(computeOverallPct(milestones));

    const t = setTimeout(() => {
      updateProject(project.id, {
        milestones: projectMilestones,
        progress: overallPct,
        overallProgressPct: overallPct,
        projectData: {
          timelineV2Milestones: milestones,
        },
      });
      // Also write to bps.project.${id}.progress so ProjectListContext hydration gets it
      AsyncStorage.setItem(
        `bps.project.${project.id}.progress`,
        JSON.stringify({ progress: overallPct, overallProgressPct: overallPct, updatedAt: new Date().toISOString() })
      ).catch(() => {});
      setTimeout(() => (isUpdatingRef.current = false), 200);
    }, 250);

    return () => clearTimeout(t);
  }, [isLoaded, project?.id, milestones, updateProject]);

  /* ---------- sync cost deltas to expenses ---------- */

  useEffect(() => {
    if (!isLoaded || !projectData) return;

    milestones.forEach((m) => {
      const expenseId = `timeline-${m.id}`;
      const existingExpense = projectData.expenses?.find((e) => e.id === expenseId);
      const costDelta = typeof m.costDelta === "number" ? m.costDelta : 0;

      const shouldCreate = m.status === "completed" && costDelta !== 0;
      const category = (m.costCategory === "other" ? "materials" : m.costCategory) as any;

      if (shouldCreate) {
        const amount = Math.abs(costDelta);
        if (existingExpense) {
          if (existingExpense.amount !== amount) {
            updateExpense({
              ...existingExpense,
              vendor: `Timeline: ${m.title}`,
              amount,
              category,
              date: safeISODate(m.plannedDate),
              notes: costDelta > 0 ? "Over budget variance" : "Under budget savings",
            });
          }
        } else {
          addExpense({
            id: expenseId,
            vendor: `Timeline: ${m.title}`,
            amount,
            category,
            date: safeISODate(m.plannedDate),
            notes: costDelta > 0 ? "Over budget variance" : "Under budget savings",
          });
        }
      } else {
        if (existingExpense) deleteExpense(expenseId);
      }
    });
  }, [milestones, isLoaded, projectData?.expenses]);

  /* ---------- computed ---------- */

  const renderedMilestones = isLoaded
    ? milestones
    : milestones.length > 0
      ? milestones
      : initialMilestones;

  const byId = useMemo(
    () => Object.fromEntries(renderedMilestones.map((m) => [m.id, m])),
    [renderedMilestones]
  );

  const visibleMilestones = useMemo(() => {
    if (canViewPaymentSchedule) return renderedMilestones;
    return renderedMilestones.filter((m) => !isPaymentTimelineMilestone(m));
  }, [renderedMilestones, canViewPaymentSchedule]);

  const paymentScheduleMilestones = useMemo(
    () => (canViewPaymentSchedule ? renderedMilestones.filter(isPaymentTimelineMilestone) : []),
    [renderedMilestones, canViewPaymentSchedule]
  );
  const paymentScheduleHighlight = useMemo(() => {
    if (!canViewPaymentSchedule || !paymentScheduleMilestones.length) {
      return { lastReceived: null as Milestone | null, nextUpcoming: null as Milestone | null };
    }

    const sorted = sortMilestonesByPlannedDate(paymentScheduleMilestones);
    const received = sorted.filter(isMilestoneReceived);
    const lastReceived = received.length ? received[received.length - 1] : null;
    const nextUpcoming = sorted.find((m) => !isMilestoneReceived(m)) ?? null;

    return { lastReceived, nextUpcoming };
  }, [paymentScheduleMilestones, canViewPaymentSchedule]);

  const nextWorkMilestone = useMemo(() => {
    const pending = sortMilestonesByPlannedDate(visibleMilestones).filter((m) => m.status !== "completed");
    return pending[0] ?? null;
  }, [visibleMilestones]);

  /* ---------- sync overall progress ---------- */

  const overall = useMemo(
    () => computeOverallPct(canViewPaymentSchedule ? milestones : visibleMilestones),
    [milestones, visibleMilestones, canViewPaymentSchedule]
  );

  useEffect(() => {
    if (isUpdatingRef.current || isLoadingRef.current) return;
    if (!isLoaded || !milestones.length) return;

    const rounded = Math.round(overall);
    // Always update if lastProgressUpdateRef is -1 (forced recalculation)
    if (lastProgressUpdateRef.current === rounded && lastProgressUpdateRef.current !== -1) return;

    isUpdatingRef.current = true;
    lastProgressUpdateRef.current = rounded;

    const t = setTimeout(() => {
      if (project?.id && updateProject) {
        updateProject(project.id, { progress: rounded, overallProgressPct: rounded });
      }

      if (projectData && updateTimeline) {
        const cur = projectData.overallProgressPct || 0;
        if (cur !== rounded) {
          updateTimeline(
            projectData.startISO || project.startDate || new Date().toISOString(),
            projectData.endISO || project.endDate || new Date().toISOString(),
            rounded
          );
        }
      }

      setTimeout(() => (isUpdatingRef.current = false), 250);
    }, 350);

    return () => clearTimeout(t);
  }, [overall, isLoaded, milestones.length]);

  /* ---------- actions ---------- */

  const onOpenMilestone = (m: Milestone) => {
    if (isPaymentTimelineMilestone(m) && !canCollectPayments) {
      Alert.alert(
        'Payment updates',
        'Only the project owner can view payment details or mark payments as collected.'
      );
      return;
    }
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('📝 Opening milestone for edit:', m.id, m.title);
    setEditingMilestone(m);
  };

  const renderedPaymentCards = paymentScheduleMilestones.map((item) => (
    <MilestoneCardV2
      key={item.id}
      item={item}
      dependencyTitle={item.dependsOnId ? byId[item.dependsOnId]?.title ?? "—" : undefined}
      onPress={onOpenMilestone}
    />
  ));

  const addNewMilestone = () => {
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: "New Milestone",
      plannedDate: new Date().toISOString(),
      progressPct: 0,
      status: "pending",
      assignee: "Client",
      costDelta: 0,
      costCategory: "materials",
      amount: 0,
    };
    setMilestones((prev) => [newMilestone, ...prev]);
    setEditingMilestone(newMilestone);
  };

  const deleteMilestone = (id: string) => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert("Delete Milestone", "Are you sure you want to delete this milestone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          console.log('🗑️ Deleting milestone:', id);
          setMilestones((prev) => {
            const filtered = prev.filter((m) => m.id !== id);
            console.log(`✅ Milestone deleted. Remaining: ${filtered.length}`);
            return filtered;
          });
          // Close the modal if the deleted milestone was being edited
          setEditingMilestone((current) => {
            if (current?.id === id) {
              console.log('🚪 Closing modal after deletion');
              return null;
            }
            return current;
          });
        },
      },
    ]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Reload milestones
    if (project?.id) {
      const key = getStorageKey(project.id);
      try {
        const saved = await AsyncStorage.getItem(key);
        const paymentMilestones = collectPaymentMilestones();
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) {
            setMilestones(parsed);
          } else if (paymentMilestones?.length) {
            setMilestones(convertPaymentMilestonesToTimeline(paymentMilestones));
          }
        } else if (paymentMilestones?.length) {
          setMilestones(convertPaymentMilestonesToTimeline(paymentMilestones));
        }
      } catch (error) {
        console.error('Error refreshing milestones:', error);
      }
    }
    // Reload daily logs
    await loadDailyLogs();
    await loadProjectPhotos();
    setTimeout(() => setRefreshing(false), 500);
  }, [project?.id, collectPaymentMilestones, loadDailyLogs, loadProjectPhotos]);

  const syncWithEstimate = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const paymentMilestones = collectPaymentMilestones();

    if (paymentMilestones?.length) {
      const timelineMilestones = convertPaymentMilestonesToTimeline(paymentMilestones);

      const merged = timelineMilestones.map((newM) => {
        const existing = milestones.find((m) => m.id === newM.id);
        if (!existing) return newM;
        return {
          ...newM,
          status: existing.status,
          progressPct: existing.progressPct,
          assignee: existing.assignee || newM.assignee,
          costDelta: existing.costDelta,
          costCategory: existing.costCategory,
          collectedAt: (existing as Milestone & { collectedAt?: string }).collectedAt,
          actualDate: (existing as Milestone).actualDate ?? (newM as Milestone).actualDate,
        };
      });

      setMilestones(merged);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("✅ Synced!", `Timeline updated with ${merged.length} milestones from estimate.`);
    } else {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      Alert.alert("⚠️ No Data", "No payment milestones found in estimate data.");
    }
  };

  /* ---------- render ---------- */

  const timelineBodyStyle = {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 16,
    ...(isWeb ? { alignItems: "center" as const } : {}),
  };

  const timelineBody = (
        <View
          style={[
            styles.outerCard,
            styles.timelineContainerWide,
            embedded && styles.timelineContainerEmbedded,
            embedded && { flex: 1 },
            !darkMode && { backgroundColor: Colors.bg },
            isWeb && styles.timelineWebColumn,
          ]}
        >
          {/* Timeline Details + Overall Progress */}
          <View style={timelineFlowCardStyle}>
              <View style={styles.timelinePageHeader}>
                <Text style={[styles.timelinePageTitle, { color: darkMode ? COLORS.text : Colors.text }]}>
                  Timeline Details
                </Text>
                <Text style={[styles.timelinePageSubtitle, { color: muted }]}>
                  Track milestones and project progress
                </Text>
              </View>

              <View style={[styles.sectionCardContainer, { marginTop: 0 }]}>
                <View
                  style={[
                    styles.sectionCard,
                    darkMode && styles.sectionCardElevated,
                    {
                      backgroundColor: nestedCardBg,
                      borderWidth: 1,
                      borderColor: nestedCardBorder,
                      borderRadius: 14,
                    },
                  ]}
                >
                <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? "rgba(148,163,184,0.1)" : Colors.line }]}>
                  <MaterialIcons name="schedule" size={22} color="#22c55e" />
                  <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                    Overall Progress
                  </Text>
                </View>
                <View style={styles.overallPercentBlock}>
                  <Text style={styles.overallPercentNumber}>{Math.round(overall)}%</Text>
                </View>
                <View style={[styles.timelineHairline, { backgroundColor: darkMode ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)" }]} />
                <View style={styles.progressContent}>
                  <ProgressBar value={overall} emphasis />
                </View>
              </View>
            </View>
          </View>

          {/* Daily Logs Section - At the top for recent activity */}
          <View style={timelineFlowCardStyle}>
                <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? "rgba(148,163,184,0.1)" : Colors.line }]}>
                  <MaterialIcons name="description" size={22} color="#22c55e" />
                  <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                    Daily Logs
                  </Text>
                  {dailyLogs.length > 0 && (
                    <Text style={[styles.sectionTitle, { color: muted, marginLeft: "auto", fontSize: 14, fontWeight: "600", marginRight: 10 }]}>
                      {dailyLogs.length} {dailyLogs.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      openAddDailyLog();
                    }}
                    style={[
                      styles.addLogButton,
                      dailyLogs.length === 0 ? { marginLeft: "auto" } : null,
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="add" size={22} color="#22d3ee" />
                  </TouchableOpacity>
                </View>
                {dailyLogs.length > 0 ? (
                  <View style={styles.logsList}>
                    {dailyLogs.map((log) => (
                      <TouchableOpacity
                        key={log.id}
                        activeOpacity={0.85}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          openEditDailyLog(log);
                        }}
                        style={[
                          styles.logCard,
                          styles.logCardIOS,
                          {
                            backgroundColor: darkMode ? nestedCardBg : "#FFFFFF",
                            borderColor: darkMode ? Colors.line : "rgba(15, 23, 42, 0.08)",
                          },
                        ]}
                      >
                        <View style={styles.logHeader}>
                          <Text style={[styles.logDate, { color: darkMode ? "rgba(226, 232, 240, 0.85)" : "#475569" }]}>
                            {formatDate(log.date || log.createdAt)}
                          </Text>
                          <View style={styles.logHeaderRight}>
                            {log.weather && (
                              <View style={[styles.logBadge, { backgroundColor: darkMode ? "rgba(34, 211, 238, 0.15)" : "#E0F2FE", borderColor: "#22d3ee" }]}>
                                <MaterialIcons name="wb-sunny" size={14} color="#22d3ee" />
                                <Text style={[styles.logBadgeText, { color: "#22d3ee" }]}>{log.weather}</Text>
                              </View>
                            )}
                            {Array.isArray(log.photoIds) && log.photoIds.length > 0 && (
                              <View style={[styles.logBadge, { backgroundColor: darkMode ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.08)", borderColor: "#22c55e" }]}>
                                <MaterialIcons name="photo-camera" size={14} color="#22c55e" />
                                <Text style={[styles.logBadgeText, { color: "#22c55e" }]}>
                                  {log.photoIds.length}
                                </Text>
                              </View>
                            )}
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert(
                                  'Delete Daily Log',
                                  'Are you sure you want to delete this log entry?',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Delete',
                                      style: 'destructive',
                                      onPress: () => deleteDailyLog(log.id),
                                    },
                                  ]
                                );
                              }}
                              style={styles.deleteButton}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MaterialIcons 
                                name="delete-outline" 
                                size={20} 
                                color={muted} 
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {log.noteText && (
                          <Text style={[styles.logText, { color: darkMode ? COLORS.text : Colors.text }]}>
                            {log.noteText}
                          </Text>
                        )}
                        {(log.crewCount || log.hoursWorked) && (
                          <View style={styles.logMeta}>
                            {log.crewCount && (
                              <View style={[styles.logMetaItem, { backgroundColor: darkMode ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.06)" }]}>
                                <MaterialIcons name="people" size={16} color={muted} />
                                <Text style={[styles.logMetaText, { color: muted }]}>
                                  {log.crewCount} {log.crewCount === 1 ? 'person' : 'people'}
                                </Text>
                              </View>
                            )}
                            {log.hoursWorked && (
                              <View style={[styles.logMetaItem, { backgroundColor: darkMode ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.06)" }]}>
                                <MaterialIcons name="schedule" size={16} color={muted} />
                                <Text style={[styles.logMetaText, { color: muted }]}>
                                  {log.hoursWorked} {log.hoursWorked === 1 ? 'hour' : 'hours'}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyLogsContainer}>
                    <View style={[styles.emptyLogsIconWrap, { backgroundColor: darkMode ? "rgba(34,211,238,0.1)" : "rgba(14,165,233,0.08)" }]}>
                      <MaterialIcons name="edit-note" size={32} color="#22d3ee" />
                    </View>
                    <Text style={[styles.emptyLogsTitle, { color: darkMode ? COLORS.text : Colors.text }]}>
                      No site logs yet
                    </Text>
                    <Text style={[styles.emptyLogsBody, { color: muted }]}>
                      Record daily notes and weather tied to this job.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.starterButton,
                        {
                          marginTop: 18,
                          flexDirection: "row",
                          backgroundColor: darkMode ? Colors.surface2 : '#F1F5F9',
                          borderColor: darkMode ? Colors.line : '#E2E8F0',
                        },
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        openAddDailyLog();
                      }}
                    >
                      <MaterialIcons name="add" size={20} color="#22d3ee" />
                      <Text style={[styles.starterButtonText, { color: darkMode ? Colors.text : Colors.text, marginLeft: 8 }]}>
                        Add daily log
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
          </View>

          <ProjectPhotosCard
            projectId={project?.id || ""}
            photos={projectPhotos}
            darkMode={darkMode}
            textColor={darkMode ? COLORS.text : Colors.text}
            mutedColor={muted}
            surfaceColor={Colors.bg}
            lineColor={Colors.line}
            onPhotosChanged={async () => {
              await loadProjectPhotos();
              await loadDailyLogs();
            }}
          />

          {/* Payment snapshot (last received + next due) or next work milestone for field roles */}
          {(canViewPaymentSchedule && paymentScheduleMilestones.length > 0) || nextWorkMilestone ? (
          <View style={timelineFlowCardStyle}>
                    <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? "rgba(148,163,184,0.1)" : Colors.line }]}>
                      <MaterialIcons name="event" size={22} color="#22c55e" />
                      <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                        {canViewPaymentSchedule ? "Payments" : "Upcoming"}
                      </Text>
                    </View>
                    <View style={styles.upcomingContent}>
                      {canViewPaymentSchedule ? (
                        paymentScheduleHighlight.lastReceived || paymentScheduleHighlight.nextUpcoming ? (
                          <>
                            {paymentScheduleHighlight.lastReceived ? (
                              <Pressable
                                onPress={() => onOpenMilestone(paymentScheduleHighlight.lastReceived!)}
                                style={[
                                  styles.upcomingShell,
                                  styles.paymentHighlightReceived,
                                  {
                                    backgroundColor: darkMode ? "rgba(34, 197, 94, 0.12)" : "rgba(34, 197, 94, 0.08)",
                                    borderColor: darkMode ? "rgba(34, 197, 94, 0.45)" : "rgba(34, 197, 94, 0.35)",
                                  },
                                ]}
                              >
                                <View style={[styles.upcomingDot, { backgroundColor: "#22c55e" }]} />
                                <View style={styles.upcomingTextCol}>
                                  <View style={[styles.paymentHighlightBadge, styles.paymentHighlightBadgeReceived]}>
                                    <Text style={styles.paymentHighlightBadgeTextReceived}>Received</Text>
                                  </View>
                                  <Text style={[styles.upcomingTitleOnly, { color: darkMode ? COLORS.text : Colors.text }]} numberOfLines={2}>
                                    {paymentScheduleHighlight.lastReceived.title}
                                  </Text>
                                  <Text style={[styles.upcomingDateLine, { color: caption }]}>
                                    {formatDate(paymentScheduleHighlight.lastReceived.plannedDate)}
                                  </Text>
                                </View>
                              </Pressable>
                            ) : null}
                            {paymentScheduleHighlight.nextUpcoming ? (
                              <Pressable
                                onPress={() => onOpenMilestone(paymentScheduleHighlight.nextUpcoming!)}
                                style={[
                                  styles.upcomingShell,
                                  {
                                    backgroundColor: darkMode ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
                                    borderColor: darkMode ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)",
                                  },
                                ]}
                              >
                                <View style={[styles.upcomingDot, { backgroundColor: "#22d3ee" }]} />
                                <View style={styles.upcomingTextCol}>
                                  <View style={[styles.paymentHighlightBadge, styles.paymentHighlightBadgeUpcoming]}>
                                    <Text style={styles.paymentHighlightBadgeTextUpcoming}>Upcoming</Text>
                                  </View>
                                  <Text style={[styles.upcomingTitleOnly, { color: darkMode ? COLORS.text : Colors.text }]} numberOfLines={2}>
                                    {paymentScheduleHighlight.nextUpcoming.title}
                                  </Text>
                                  <Text style={[styles.upcomingDateLine, { color: caption }]}>
                                    {formatDate(paymentScheduleHighlight.nextUpcoming.plannedDate)}
                                  </Text>
                                </View>
                              </Pressable>
                            ) : paymentScheduleHighlight.lastReceived ? (
                              <Text style={[styles.paymentAllCollectedText, { color: muted }]}>
                                All scheduled payments have been received.
                              </Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={[styles.emptyText, { color: muted }]}>No payments scheduled yet.</Text>
                        )
                      ) : nextWorkMilestone ? (
                        <Pressable
                          onPress={() => onOpenMilestone(nextWorkMilestone)}
                          style={[
                            styles.upcomingShell,
                            {
                              backgroundColor: darkMode ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
                              borderColor: darkMode ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.08)",
                            },
                          ]}
                        >
                          <View style={[styles.upcomingDot, { backgroundColor: "#22d3ee" }]} />
                          <View style={styles.upcomingTextCol}>
                            <Text style={[styles.upcomingTitleOnly, { color: darkMode ? COLORS.text : Colors.text }]} numberOfLines={2}>
                              {nextWorkMilestone.title}
                            </Text>
                            <Text style={[styles.upcomingDateLine, { color: caption }]}>{formatDate(nextWorkMilestone.plannedDate)}</Text>
                          </View>
                        </Pressable>
                      ) : (
                        <Text style={[styles.emptyText, { color: muted }]}>
                          No upcoming work milestones — payment schedule is managed by the owner.
                        </Text>
                      )}
                    </View>
          </View>
          ) : null}

          {/* All Payments Section — owner & manager only */}
          {canViewPaymentSchedule ? (
          <View style={[timelineFlowCardStyle, embedded && styles.timelineFlowCardFill]}>
                <View style={[styles.sectionHeader, { borderBottomColor: darkMode ? "rgba(148,163,184,0.1)" : Colors.line }]}>
                  <MaterialIcons name="list" size={22} color="#22c55e" />
                  <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                    All Payments
                  </Text>
                </View>
                {paymentScheduleMilestones.length > 0 ? (
                  <View style={styles.milestonesList}>{renderedPaymentCards}</View>
                ) : (
                    <View style={styles.emptyTimelineContainer}>
                      <Text style={[styles.emptyTimelineTitle, { color: darkMode ? COLORS.text : Colors.text }]}>
                        Project hasn't started yet
                      </Text>
                      <Text style={[styles.emptyTimelineSubtitle, { color: muted }]}>
                        Progress will begin once work starts or a milestone is marked complete.
                      </Text>
                      <View style={styles.starterButtonsContainer}>
                        <TouchableOpacity
                          style={[styles.starterButton, { backgroundColor: darkMode ? Colors.surface2 : '#F1F5F9', borderColor: darkMode ? Colors.line : '#E2E8F0' }]}
                          onPress={() => {
                            // Create a demo phase milestone
                            const newMilestone: Milestone = {
                              id: `demo-${Date.now()}`,
                              title: 'Demo Phase',
                              plannedDate: new Date().toISOString().split('T')[0],
                              progressPct: 0,
                              status: 'pending',
                              amount: 0,
                            };
                            onOpenMilestone(newMilestone);
                          }}
                        >
                          <Text style={[styles.starterButtonText, { color: darkMode ? Colors.text : Colors.text }]}>Add demo phase</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.starterButton, { backgroundColor: darkMode ? Colors.surface2 : '#F1F5F9', borderColor: darkMode ? Colors.line : '#E2E8F0' }]}
                          onPress={() => {
                            const newMilestone: Milestone = {
                              id: `rough-${Date.now()}`,
                              title: 'Rough-in Phase',
                              plannedDate: new Date().toISOString().split('T')[0],
                              progressPct: 0,
                              status: 'pending',
                              amount: 0,
                            };
                            onOpenMilestone(newMilestone);
                          }}
                        >
                          <Text style={[styles.starterButtonText, { color: darkMode ? Colors.text : Colors.text }]}>Add rough-in phase</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.starterButton, { backgroundColor: darkMode ? Colors.surface2 : '#F1F5F9', borderColor: darkMode ? Colors.line : '#E2E8F0' }]}
                          onPress={() => {
                            const newMilestone: Milestone = {
                              id: `finish-${Date.now()}`,
                              title: 'Finish Phase',
                              plannedDate: new Date().toISOString().split('T')[0],
                              progressPct: 0,
                              status: 'pending',
                              amount: 0,
                            };
                            onOpenMilestone(newMilestone);
                          }}
                        >
                          <Text style={[styles.starterButtonText, { color: darkMode ? Colors.text : Colors.text }]}>Add finish phase</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.starterButton, { backgroundColor: darkMode ? Colors.surface2 : '#F1F5F9', borderColor: darkMode ? Colors.line : '#E2E8F0' }]}
                          onPress={() => {
                            const newMilestone: Milestone = {
                              id: `custom-${Date.now()}`,
                              title: 'Custom Milestone',
                              plannedDate: new Date().toISOString().split('T')[0],
                              progressPct: 0,
                              status: 'pending',
                              amount: 0,
                            };
                            onOpenMilestone(newMilestone);
                          }}
                        >
                          <Text style={[styles.starterButtonText, { color: darkMode ? Colors.text : Colors.text }]}>Add custom milestone</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                )}
          </View>
          ) : null}
        </View>
  );

  return (
    <View
      style={[
        styles.container,
        embedded && styles.containerEmbedded,
        !darkMode && { backgroundColor: Colors.bg },
      ]}
    >
      {embedded ? (
        <View style={[timelineBodyStyle, { flex: 1 }]}>{timelineBody}</View>
      ) : (
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={timelineBodyStyle}
          scrollEnabled={true}
          bounces={true}
          alwaysBounceVertical={false}
          {...KEYBOARD_SCROLL_DEFAULTS}
          {...(Platform.OS === 'web' ? { keyboardShouldPersistTaps: 'always' as const } : {})}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.green}
              colors={[COLORS.green]}
            />
          }
        >
          {timelineBody}
        </ScrollView>
      )}

      <AddDailyLogModal
        visible={showAddDailyLog}
        projectId={project?.id || ""}
        existingLog={editingDailyLog}
        onClose={closeDailyLogModal}
        onSaved={async () => {
          if (project?.id) {
            try {
              const raw = await AsyncStorage.getItem(`daily_logs_${project.id}`);
              const logs = raw ? JSON.parse(raw) : [];
              pushDailyLogsToBusinessWorkspace(Array.isArray(logs) ? logs : []);
            } catch {
              pushDailyLogsToBusinessWorkspace([]);
            }
          }
          setReloadTrigger((prev) => prev + 1);
          await loadProjectPhotos();
        }}
      />

      <EditMilestoneModal
        visible={editingMilestone !== null}
        milestone={editingMilestone}
        projectBudget={project?.budgeted || project?.estimatedCost || 0}
        paymentMilestones={project?.milestones || []}
        onClose={() => {
          console.log('🚪 Closing EditMilestoneModal');
          setEditingMilestone(null);
        }}
        onSave={(updated) => {
          console.log('💾 Saving milestone:', updated.id, updated.title, 'status:', updated.status);
          
          const titleLower = (updated.title || '').toLowerCase();
          const isPayment = isPaymentTimelineMilestone(updated);
          const isBeingCompleted = updated.status === 'completed';

          if (isPayment && isBeingCompleted && !canCollectPayments) {
            Alert.alert(
              'Payment updates',
              'Only the project owner can mark payments as collected.'
            );
            return false;
          }
          
          // Check if this is a payment milestone being marked as completed
          if (isPayment && isBeingCompleted) {
            // Get all payment milestones from current state (before update)
            // Include the updated milestone in the list for sorting
            const currentMilestone = milestones.find(m => m.id === updated.id);
            const updatedMilestoneForCheck = currentMilestone ? { ...currentMilestone, ...updated } : updated;
            
            const allMilestonesWithUpdate = milestones.map(m => 
              m.id === updated.id ? updatedMilestoneForCheck : m
            );
            
            const paymentMilestones = allMilestonesWithUpdate
              .filter(m => {
                const t = (m.title || '').toLowerCase();
                return (m.amount && m.amount > 0) || t.includes('payment') || t.includes('week') || t.includes('deposit');
              })
              .sort((a, b) => {
                // Sort by planned date or by title (Week 1, Week 2, etc.)
                const dateA = new Date(a.plannedDate).getTime();
                const dateB = new Date(b.plannedDate).getTime();
                if (dateA !== dateB) return dateA - dateB;
                // If dates are same, sort by title
                return (a.title || '').localeCompare(b.title || '');
              });
            
            console.log('📊 Payment milestones found:', paymentMilestones.length);
            console.log('📊 Payment milestones:', paymentMilestones.map(m => ({ 
              id: m.id, 
              title: m.title, 
              status: m.status, 
              date: m.plannedDate 
            })));
            
            // Check if this is the last payment
            const lastPayment = paymentMilestones[paymentMilestones.length - 1];
            const isLastPayment = lastPayment && lastPayment.id === updated.id;
            
            console.log('🔍 Last payment check:', { 
              isLastPayment, 
              lastPaymentId: lastPayment?.id, 
              updatedId: updated.id,
              totalPayments: paymentMilestones.length 
            });
            
            // Check if all other payments are completed
            const otherPayments = paymentMilestones.filter(m => m.id !== updated.id);
            const allOtherPaymentsCompleted = otherPayments.length === 0 || 
              otherPayments.every(m => m.status === 'completed');
            
            console.log('🔍 Other payments check:', { 
              otherPaymentsCount: otherPayments.length,
              allOtherPaymentsCompleted,
              otherPaymentsStatuses: otherPayments.map(m => ({ id: m.id, title: m.title, status: m.status }))
            });
            
            if (isLastPayment && allOtherPaymentsCompleted) {
              console.log('✅ Final payment detected! Showing confirmation dialog');

              const persistLastPaymentMilestone = () => {
                setMilestones((prev) => {
                  const updatedMilestones = prev.map((m) => (m.id === updated.id ? updated : m));
                  if (project?.id) {
                    AsyncStorage.setItem(getStorageKey(project.id), JSON.stringify(updatedMilestones)).catch(() => {});
                  }
                  const newOverall = computeOverallPct(updatedMilestones);
                  const roundedProgress = Math.round(newOverall);
                  if (project?.id && updateProject) {
                    updateProject(project.id, { progress: roundedProgress, overallProgressPct: roundedProgress });
                  }
                  lastProgressUpdateRef.current = -1;
                  isUpdatingRef.current = false;
                  return updatedMilestones;
                });
              };

              /** RN Web: multi-button Alert is unreliable in Safari; sync confirm + immediate persist. */
              if (
                Platform.OS === 'web' &&
                typeof window !== 'undefined' &&
                typeof window.confirm === 'function'
              ) {
                const jobComplete = window.confirm(
                  'Final payment\n\nIs this the final payment and is the job complete?\n\n' +
                    'OK = Yes — mark the project completed\n' +
                    'Cancel = No — only mark this milestone collected'
                );
                persistLastPaymentMilestone();
                setEditingMilestone(null);
                if (jobComplete && project?.id && updateProject) {
                  setTimeout(() => {
                    console.log('🔄 Updating project status to completed');
                    updateProject(project.id, { status: 'completed', progress: 100, overallProgressPct: 100 });
                    fireCloseoutCalibration(project, projectFromList, projectData);
                    if (typeof window.alert === 'function') {
                      window.alert('Project is now marked as completed.');
                    } else {
                      Alert.alert('✅ Project Completed', 'Project is now marked as completed.', [{ text: 'OK' }]);
                    }
                  }, 100);
                }
                return;
              }

              Alert.alert(
                "Final Payment",
                "Is this the final payment?\n\nIs job complete?",
                [
                    {
                      text: "No",
                      style: "cancel",
                      onPress: () => {
                        console.log('❌ User said no - just saving milestone');
                        persistLastPaymentMilestone();
                        setEditingMilestone(null);
                      },
                    },
                    {
                      text: "Yes",
                      onPress: () => {
                        console.log('✅ User confirmed - marking project as completed');
                        persistLastPaymentMilestone();
                        setEditingMilestone(null);
                        setTimeout(() => {
                          if (project?.id && updateProject) {
                            console.log('🔄 Updating project status to completed');
                            updateProject(project.id, { status: 'completed', progress: 100, overallProgressPct: 100 });
                            fireCloseoutCalibration(project, projectFromList, projectData);
                            if (Platform.OS === 'ios') {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                            Alert.alert(
                              "✅ Project Completed",
                              "Project is now marked as completed.",
                              [{ text: "OK" }]
                            );
                          }
                        }, 100);
                      },
                    },
                ]
              );
              return false; // Return false to indicate we're handling the save, don't close modal yet
            } else {
              console.log('⚠️ Not final payment or other payments not completed:', {
                isLastPayment,
                allOtherPaymentsCompleted
              });
            }
          }
          
          // Normal save (not final payment or user said no)
          console.log('💾 Normal save (not final payment)');
          setMilestones((prev) => {
            const updatedMilestones = prev.map((m) => (m.id === updated.id ? updated : m));
            // CRITICAL: Save to AsyncStorage immediately so reload doesn't overwrite with stale data
            if (project?.id) {
              AsyncStorage.setItem(getStorageKey(project.id), JSON.stringify(updatedMilestones)).catch(() => {});
            }
            lastProgressUpdateRef.current = -1;
            isUpdatingRef.current = false;
            const newOverall = computeOverallPct(updatedMilestones);
            const roundedProgress = Math.round(newOverall);
            console.log(`📊 Immediately updating progress to ${roundedProgress}% after manual save (${updatedMilestones.length} milestones)`);
            if (project?.id && updateProject) {
              updateProject(project.id, { progress: roundedProgress, overallProgressPct: roundedProgress });
            }
            return updatedMilestones;
          });
          setEditingMilestone(null);
        }}
        onDelete={deleteMilestone}
      />

    </View>
  );
}

/* -------------------- styles -------------------- */

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    marginHorizontal: -20, // Extend beyond parent ScrollView padding
  },
  containerEmbedded: {
    marginHorizontal: 0,
  },
  scrollContent: { 
    flex: 1,
  },
  center: { justifyContent: "center", alignItems: "center" },
  loadingText: { color: Colors.text, fontSize: 18, fontWeight: "700" },

  outerCard: {
    marginBottom: 16,
  },
  timelineContainerWide: {
    marginHorizontal: 0, // Container already extends with -20, so 0 here extends to edges
    paddingHorizontal: 4, // Match dashboard wideContainer pattern
    paddingTop: 18,
    paddingBottom: 18,
  },
  /** Project detail: align green/blue frame with Budget tab — no extra inset under AI PM row */
  timelineContainerEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 18,
  },
  /** Web: center timeline column (All Payments, deposit rows, etc.) like project WebPageShell. */
  timelineWebColumn: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  timelineFlowCardFill: {
    flex: 1,
    marginBottom: 0,
  },
  timelinePageHeader: {
    marginBottom: 16,
  },
  timelinePageTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: "#F9FAFB",
  },
  timelinePageSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  sectionCardContainer: {
    marginTop: 12,
  },
  sectionCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  sectionCard: {
    borderRadius: 14,
    padding: 12,
  },
  sectionCardElevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  overallPercentBlock: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  overallPercentNumber: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    color: "#22d3ee",
    fontVariant: ["tabular-nums"],
  },
  timelineHairline: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginTop: 10,
    marginBottom: 4,
  },
  progressContent: { 
    padding: 0,
    marginTop: 12,
    paddingBottom: 2,
  },
  upcomingContent: { 
    padding: 0,
    marginTop: 4,
    gap: 10,
  },
  upcomingShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 64,
  },
  paymentHighlightReceived: {
    borderWidth: 1.5,
  },
  paymentHighlightBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  paymentHighlightBadgeReceived: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  paymentHighlightBadgeUpcoming: {
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.35)",
  },
  paymentHighlightBadgeTextReceived: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#22c55e",
    textTransform: "uppercase",
  },
  paymentHighlightBadgeTextUpcoming: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#22d3ee",
    textTransform: "uppercase",
  },
  paymentAllCollectedText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    lineHeight: 20,
  },
  upcomingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  upcomingTextCol: {
    flex: 1,
    minWidth: 0,
  },
  upcomingTitleOnly: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  upcomingDateLine: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  milestonesSection: {
    marginTop: 12,
    marginBottom: 0,
  },
  milestonesList: {
    marginTop: 12,
    gap: 12,
  },
  milestoneCardContainer: {
    marginBottom: 0,
  },
  milestoneCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  mCard: {
    padding: 12,
  },
  mTitle: { 
    color: COLORS.text, 
    fontWeight: "700", 
    fontSize: 16,
    letterSpacing: Platform.OS === 'ios' ? -0.3 : -0.2,
    lineHeight: 20,
    marginBottom: 7,
  },
  mAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 9,
  },
  amountPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.45)",
  },
  amountText: { 
    color: "#22c55e", 
    fontWeight: "800", 
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  mPctSecondary: {
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  mStatusDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(148, 163, 184, 0.14)",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: { 
    fontWeight: "700", 
    fontSize: 12,
    letterSpacing: 0.2,
  },
  mDateLine: {
    fontWeight: "600",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  mMetaGroup: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  mMetaLine: {
    fontSize: 13,
    lineHeight: 17,
  },
  costImpact: { 
    color: "#22d3ee", 
    fontWeight: "700", 
    fontSize: 14, 
    marginTop: 10,
    marginBottom: 4,
  },
  mProgressContainer: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    padding: 2,
    borderColor: "rgba(148, 163, 184, 0.22)",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    lineHeight: 22,
    fontWeight: "500",
  },
  emptyTimelineContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTimelineTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyTimelineSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  logsList: {
    marginTop: 16,
    gap: 20,
  },
  emptyLogsContainer: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyLogsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyLogsTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  emptyLogsBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "500",
    maxWidth: 300,
  },
  addLogButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 211, 238, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.28)",
  },
  logCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 0,
    borderWidth: 1,
    borderRadius: 16,
    marginVertical: 2, // Small additional margin for extra spacing
  },
  logCardIOS: {
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.16 : 0.12,
    shadowRadius: Platform.OS === "ios" ? 14 : 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: Platform.OS === "android" ? 4 : 0,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 4,
  },
  logDate: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  logBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  logBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logText: {
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0.2,
    color: COLORS.text,
    marginBottom: 10,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
  },
  logMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  logMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  starterButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  starterButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  starterButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

});


