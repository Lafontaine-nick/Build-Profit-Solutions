import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { Colors, COLORS } from "../src/theme/colors";
import ProgressBar from "./timeline/ProgressBar";
import EditMilestoneModal from "./EditMilestoneModal";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useProjectList } from "../contexts/ProjectListContext";
import type { Milestone } from "../src/types/timeline";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

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

function computeOverallPct(items: Milestone[]) {
  const workItems = items.filter((m) => !isDepositMilestone(m));
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

function statusPillStyle(status?: string) {
  if (status === "completed") return { bg: "rgba(34, 197, 94, 0.25)", text: "#22c55e", border: "#22c55e" };
  if (status === "in_progress") return { bg: "rgba(34, 211, 238, 0.15)", text: "#22d3ee", border: "#22c55e" };
  return { bg: "rgba(180,195,215,0.18)", text: "rgba(234,241,247,0.75)", border: "rgba(148, 163, 184, 0.4)" };
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
  const pill = statusPillStyle(item.status);
  const isPending = item.status !== "completed" && item.status !== "in_progress";
  const pendingPill = !darkMode && item.status !== "completed" && item.status !== "in_progress";
  const pillBg = pendingPill ? "#CBD5E1" : pill.bg;
  const pillText = pendingPill ? "#111827" : pill.text;
  const pct = clampPct(item.progressPct);

  return (
    <View style={styles.milestoneCardContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress(item)}
          style={[
            styles.mCard,
            { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 },
          ]}
        >
          {/* Header Row - Title and Amount */}
          <View style={styles.mHeaderRow}>
            <View style={styles.mTitleContainer}>
              <Text style={[styles.mTitle, !darkMode && { color: Colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <View style={styles.mHeaderRight}>
              {typeof item.amount === "number" && item.amount > 0 ? (
                <View style={styles.amountPill}>
                  <Text style={styles.amountText}>${item.amount.toLocaleString()}</Text>
                </View>
              ) : null}
              <Text style={[styles.mPct, !darkMode && { color: Colors.sub }]}>{Math.round(pct)}%</Text>
            </View>
          </View>

          {/* Meta Row - Status and Date */}
          <View style={[styles.mMetaRow, !darkMode && { borderBottomColor: Colors.line }]}>
            <View style={[styles.statusPill, { backgroundColor: pillBg, borderWidth: 1, borderColor: pill.border || "transparent" }]}>
              <Text style={[styles.statusText, { color: pillText }]}>{statusLabel(item.status)}</Text>
            </View>
            <Text style={[styles.mMetaText, !darkMode && { color: Colors.sub }]}>{formatDate(item.plannedDate)}</Text>
          </View>

          {/* Additional Info */}
          {item.assignee ? (
            <Text style={[styles.mMetaText, { marginTop: 8 }, !darkMode && { color: Colors.sub }]}>
              Assigned: {item.assignee}
            </Text>
          ) : null}

          {dependencyTitle ? (
            <Text style={[styles.mMetaText, { marginTop: 8 }, !darkMode && { color: Colors.sub }]}>
              Depends on: {dependencyTitle}
            </Text>
          ) : null}

          {typeof item.costDelta === "number" && item.costDelta !== 0 && item.costCategory ? (
            <Text style={styles.costImpact}>
              Cost Impact: {item.costDelta >= 0 ? "+" : "-"}${Math.abs(item.costDelta).toLocaleString()} →{" "}
              {String(item.costCategory).charAt(0).toUpperCase() + String(item.costCategory).slice(1)}
            </Text>
          ) : null}

          {/* Progress Bar */}
          <View
            style={[
              styles.mProgressContainer,
            ]}
          >
            <ProgressBar value={pct} />
          </View>
        </TouchableOpacity>
    </View>
  );
}

/* -------------------- main -------------------- */

interface TimelineTabProps {
  project: any;
  theme?: "dark" | "light";
  embedded?: boolean;
}

export default function TimelineTabV2({ project, embedded = false }: TimelineTabProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const { addExpense, updateExpense, deleteExpense, projectData, updateTimeline } = useProjectData();
  const { updateProject, getProjectById } = useProjectList();

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
    }));
  };

  const convertPaymentMilestonesToTimeline = (paymentMilestones: any[]): Milestone[] => {
    if (!paymentMilestones || !Array.isArray(paymentMilestones)) return [];
    return paymentMilestones.map((milestone, index) => ({
      id: milestone.id || `payment-${index}`,
      title: milestone.name || milestone.title || `Payment ${index + 1}`,
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
    }));
  };

  const collectPaymentMilestones = useCallback(() => {
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
        return fromWeeklyOnly;
      }
      // Fall back only when weeklyPayments are missing.
      if (paymentMs.length) return paymentMs;
      if (milestones.length) return milestones;
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
      return combined;
    }

    // Non-hybrid: use milestones if available
    if (milestones.length) return milestones;

    if (paymentMs.length) return paymentMs;
    if (weekly.length) return convertWeeklyPaymentsToMilestones(weekly);

    if (estimateData?.weeklyPayments?.length) {
      return estimateData.weeklyPayments.map((w: any, i: number) => ({
        id: w.id || `week-${i}`,
        name: w.description || `Week ${w.weekNumber || i + 1} Payment`,
        paymentAmount: w.amount || 0,
        amount: w.amount || 0,
        percentage: w.percentage || 0,
        scheduledDate: w.scheduledDate,
        dueDate: w.scheduledDate,
        description: w.description,
        status: "pending",
      }));
    }

    return [];
  }, [liveBidPaymentData, project?.milestones, project?.weeklyPayments, projectFromList?.milestones, projectFromList?.weeklyPayments, (project as any)?.estimateData, (project as any)?.paymentSchedule]);

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
      };
    });
  };

  /* ---------- load/save ---------- */

  // Force reload trigger for payment collection updates
  const [reloadTrigger, setReloadTrigger] = useState(0);
  
  // Daily logs state
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  
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
      if (raw) {
        const logs = JSON.parse(raw);
        console.log('📝 Found logs:', logs.length);
        // Sort by date (newest first)
        const sorted = Array.isArray(logs) ? logs.sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0).getTime();
          const dateB = new Date(b.date || b.createdAt || 0).getTime();
          return dateB - dateA;
        }) : [];
        console.log('📝 Sorted logs:', sorted.length);
        setDailyLogs(sorted);
      } else {
        console.log('📝 No logs found in AsyncStorage');
        setDailyLogs([]);
      }
    } catch (error) {
      console.error('❌ Error loading daily logs:', error);
      setDailyLogs([]);
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
        const filtered = Array.isArray(logs) ? logs.filter((log: any) => log.id !== logId) : [];
        await AsyncStorage.setItem(logKey, JSON.stringify(filtered));
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
  }, [project?.id]);
  
  // Load daily logs on mount and when reloadTrigger changes
  useEffect(() => {
    loadDailyLogs();
  }, [loadDailyLogs, reloadTrigger]);

  // Reload daily logs when screen comes into focus (e.g., after adding a log via AI)
  useFocusEffect(
    useCallback(() => {
      loadDailyLogs();
    }, [loadDailyLogs])
  );
  
  useEffect(() => {
    if (!project?.id) return;
    if (isLoadingRef.current) return;
    if (isUpdatingRef.current) return;

    const paymentMilestones = collectPaymentMilestones();
    const estimateData = (project as any)?.estimateData || projectFromList?.estimateData || {};
    const estimateDataHash = JSON.stringify(estimateData);
    
    // Check if estimate data has changed or if this is a new project
    const estimateDataChanged = lastEstimateDataRef.current !== estimateDataHash;
    const isNewProject = hasLoadedForProjectRef.current !== project.id;

    // Allow reload if trigger changed (for payment collection updates)
    if (!isNewProject && !estimateDataChanged && reloadTrigger === 0) return;

    const loadMilestones = async () => {
      isLoadingRef.current = true;
      hasLoadedForProjectRef.current = project.id;
      lastEstimateDataRef.current = estimateDataHash;

      try {
        const key = getStorageKey(project.id);
        const saved = await AsyncStorage.getItem(key);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length) {
            // Start with estimate data as source of truth, merge saved status/progress
            if (paymentMilestones?.length) {
              const converted = convertPaymentMilestonesToTimeline(paymentMilestones);
              const norm = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
              // Merge saved data (status, progress, etc.) into converted milestones
              const merged = converted.map((newM: Milestone) => {
                let savedM = parsed.find((m: Milestone) => m.id === newM.id);
                if (!savedM) {
                  savedM = parsed.find(
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
                    // Always use current schedule dates (from estimate/project) so timeline matches Estimate page; only keep status/progress from saved.
                    plannedDate: newM.plannedDate,
                  };
                }
                return newM;
              });
              setMilestones(merged);
            } else {
              setMilestones(parsed);
            }
          } else {
            setMilestones(paymentMilestones?.length ? convertPaymentMilestonesToTimeline(paymentMilestones) : []);
          }
        } else {
          setMilestones(paymentMilestones?.length ? convertPaymentMilestonesToTimeline(paymentMilestones) : []);
        }
      } catch {
        setMilestones([]);
      } finally {
        setIsLoaded(true);
        isLoadingRef.current = false;
      }
    };

    loadMilestones();
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
  useEffect(() => {
    if (!project?.id || !isLoaded) return;
    const interval = setInterval(() => {
      // Only reload if we're on the timeline tab (to avoid unnecessary reloads)
      // Check if milestones might have been updated externally
      AsyncStorage.getItem(getStorageKey(project.id)).then(saved => {
        if (saved) {
          const parsed = JSON.parse(saved);
          const savedCount = Array.isArray(parsed) ? parsed.length : 0;
          const currentCount = milestones.length;
          // If counts differ or any milestone status might have changed, reload
          if (savedCount !== currentCount) {
            console.log('🔄 Milestone count changed - reloading timeline');
            setReloadTrigger(prev => prev + 1);
          }
        }
      }).catch(() => {});
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, [project?.id, isLoaded, milestones.length]);

  useEffect(() => {
    if (!isLoaded || !project?.id) return;
    AsyncStorage.setItem(getStorageKey(project.id), JSON.stringify(milestones)).catch(() => {});
  }, [milestones, isLoaded, project?.id]);

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

  /* ---------- sync overall progress ---------- */

  const overall = computeOverallPct(milestones);

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

  /* ---------- computed ---------- */

  const byId = useMemo(() => Object.fromEntries(milestones.map((m) => [m.id, m])), [milestones]);

  const upcoming = useMemo(() => {
    return [...milestones]
      .filter((m) => m.status !== "completed")
      .sort((a, b) => new Date(safeISODate(a.plannedDate)).getTime() - new Date(safeISODate(b.plannedDate)).getTime())
      .slice(0, 3);
  }, [milestones]);

  /* ---------- actions ---------- */

  const onOpenMilestone = (m: Milestone) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    console.log('📝 Opening milestone for edit:', m.id, m.title);
    setEditingMilestone(m);
  };

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
    setTimeout(() => setRefreshing(false), 500);
  }, [project?.id, collectPaymentMilestones, loadDailyLogs]);

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

  if (!isLoaded) {
    return (
      <View
        style={[
          styles.container,
          embedded && styles.containerEmbedded,
          styles.center,
          !darkMode && { backgroundColor: Colors.bg },
        ]}
      >
        <Text style={[styles.loadingText, !darkMode && { color: Colors.text }]}>Loading timeline...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        embedded && styles.containerEmbedded,
        !darkMode && { backgroundColor: Colors.bg },
      ]}
    >
      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 }}
        nestedScrollEnabled={true}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.green}
            colors={[COLORS.green]}
          />
        }
      >
        {/* Wide Container - matches Budget and Overview pages */}
        <View
          style={[
            styles.outerCard,
            styles.timelineContainerWide,
            embedded && styles.timelineContainerEmbedded,
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          {/* Outer green-to-blue border wrapping Timeline Details header, Overall Progress, and Upcoming cards */}
          <LinearGradient
            colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.overviewBorder}
          >
            <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
              {/* Timeline Details Header */}
              <View style={styles.timelineHeaderRow}>
                <View>
                  <Text style={[styles.timelineHeaderTitle, { color: darkMode ? COLORS.text : Colors.text }]}>
                    Timeline Details
                  </Text>
                  <Text style={[styles.timelineHeaderSubtitle, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                    Track milestones and project progress
                  </Text>
                </View>
              </View>

              {/* Overall Progress Section */}
              <View style={[styles.sectionCardContainer, { marginTop: 12 }]}>
                <View style={[styles.sectionCard, { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 }]}>
                <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name="schedule" size={22} color="#22c55e" />
                  <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                    Overall Progress
                  </Text>
                  <Text style={[styles.sectionTitle, { color: "#22d3ee", marginLeft: "auto" }]}>
                    {Math.round(overall)}%
                  </Text>
                </View>
                <View style={styles.progressContent}>
                  <ProgressBar value={overall} />
                </View>
              </View>
            </View>
            </View>
          </LinearGradient>

          {/* Daily Logs Section - At the top for recent activity */}
          <View style={{ marginTop: 12 }}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.overviewBorder}
            >
              <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name="description" size={22} color="#22c55e" />
                  <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                    Daily Logs
                  </Text>
                  {dailyLogs.length > 0 && (
                    <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.subtext : Colors.sub, marginLeft: "auto", fontSize: 14, fontWeight: "600" }]}>
                      {dailyLogs.length} {dailyLogs.length === 1 ? 'entry' : 'entries'}
                    </Text>
                  )}
                </View>
                {dailyLogs.length > 0 ? (
                  <ScrollView 
                    style={styles.logsList}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={dailyLogs.length > 3 ? { paddingBottom: 8 } : {}}
                  >
                    {dailyLogs.map((log) => (
                      <View
                        key={log.id}
                        style={[
                          styles.logCard,
                          styles.logCardIOS,
                          {
                            backgroundColor: darkMode ? Colors.surface2 : "#FFFFFF",
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
                                color={darkMode ? "rgba(226, 232, 240, 0.6)" : "#94a3b8"} 
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
                                <MaterialIcons name="people" size={16} color={darkMode ? COLORS.subtext : Colors.sub} />
                                <Text style={[styles.logMetaText, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                                  {log.crewCount} {log.crewCount === 1 ? 'person' : 'people'}
                                </Text>
                              </View>
                            )}
                            {log.hoursWorked && (
                              <View style={[styles.logMetaItem, { backgroundColor: darkMode ? "rgba(148, 163, 184, 0.12)" : "rgba(15, 23, 42, 0.06)" }]}>
                                <MaterialIcons name="schedule" size={16} color={darkMode ? COLORS.subtext : Colors.sub} />
                                <Text style={[styles.logMetaText, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                                  {log.hoursWorked} {log.hoursWorked === 1 ? 'hour' : 'hours'}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyLogsContainer}>
                    <Text style={[styles.emptyText, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                      No daily logs yet. Use the AI assistant to add a daily log entry.
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>

          {/* Upcoming Milestones Section */}
          <View style={{ marginTop: 12 }}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.overviewBorder}
            >
              <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                <View style={styles.sectionCardContainer}>
                  <View style={[styles.sectionCard, { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 }]}>
                    <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                      <MaterialIcons name="event" size={22} color="#22c55e" />
                      <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                        Upcoming (next 3)
                      </Text>
                    </View>
                    <View style={styles.upcomingContent}>
                      {upcoming.length > 0 ? (
                        upcoming.map((u) => (
                          <View key={u.id} style={styles.upcomingItem}>
                            <Text style={[styles.upcomingBullet, { color: darkMode ? COLORS.subtext : Colors.sub }]}>•</Text>
                            <Text style={[styles.upcomingText, { color: darkMode ? COLORS.text : Colors.text }]}>
                              {u.title}{" "}
                              <Text style={[styles.upcomingDate, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                                — {formatDate(u.plannedDate)}
                              </Text>
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={[styles.emptyText, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                          No upcoming milestones
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* All Payments Section */}
          <View style={{ marginTop: 12 }}>
            {/* Outer green-to-blue border wrapping All Payments header and all milestone cards */}
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.overviewBorder}
            >
              <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                  <MaterialIcons name="list" size={22} color="#22c55e" />
                  <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                    All Payments
                  </Text>
                </View>
                <View style={styles.milestonesList}>
                  {milestones.length > 0 ? (
                    milestones.map((item) => (
                      <MilestoneCardV2
                        key={item.id}
                        item={item}
                        dependencyTitle={item.dependsOnId ? byId[item.dependsOnId]?.title ?? "—" : undefined}
                        onPress={onOpenMilestone}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyTimelineContainer}>
                      <Text style={[styles.emptyTimelineTitle, { color: darkMode ? COLORS.text : Colors.text }]}>
                        Project hasn't started yet
                      </Text>
                      <Text style={[styles.emptyTimelineSubtitle, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
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
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

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
          
          // Check if this is a payment milestone being marked as completed
          const titleLower = (updated.title || '').toLowerCase();
          const isPayment = (updated.amount && updated.amount > 0) || 
                           titleLower.includes('payment') || 
                           titleLower.includes('week') ||
                           titleLower.includes('deposit');
          const isBeingCompleted = updated.status === 'completed';
          
          console.log('🔍 Payment check:', { isPayment, isBeingCompleted, amount: updated.amount, title: updated.title });
          
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
              // Show confirmation dialog - return false to indicate we're handling the save
              Alert.alert(
                "Final Payment",
                "Is this the final payment?\n\nIs job complete?",
                [
                    {
                      text: "No",
                      style: "cancel",
                      onPress: () => {
                        console.log('❌ User said no - just saving milestone');
                        // Just save the milestone without changing project status
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
                        setEditingMilestone(null);
                      },
                    },
                    {
                      text: "Yes",
                      onPress: () => {
                        console.log('✅ User confirmed - marking project as completed');
                        // Save the milestone FIRST with completed status
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
                        
                        // Close the modal
                        setEditingMilestone(null);
                        
                        // Update project status to completed AFTER a brief delay to ensure milestone is saved
                        setTimeout(() => {
                          if (project?.id && updateProject) {
                            console.log('🔄 Updating project status to completed');
                            updateProject(project.id, { status: 'completed', progress: 100, overallProgressPct: 100 });
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
    backgroundColor: "#000000",
    borderRadius: 28,
    marginBottom: 0,
  },
  timelineContainerWide: {
    marginHorizontal: 0, // Container already extends with -20, so 0 here extends to edges
    paddingHorizontal: 4, // Match dashboard wideContainer pattern
    paddingVertical: 18,
  },
  timelineContainerEmbedded: {
    paddingHorizontal: 0,
  },
  overviewBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  overviewInner: {
    borderRadius: 18,
    padding: 12,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  timelineHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F9FAFB",
  },
  timelineHeaderSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 197, 94, 0.2)',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
  },
  progressContent: { 
    padding: 0,
    marginTop: 8,
  },
  upcomingContent: { 
    padding: 0,
    marginTop: 8,
  },
  upcomingItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  upcomingBullet: {
    marginTop: 2,
    fontSize: 16,
  },
  upcomingText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  upcomingDate: {
    fontSize: 15,
    fontWeight: "700",
  },
  milestonesSection: {
    marginTop: 12,
    marginBottom: 0,
  },
  milestonesList: {
    marginTop: 16,
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    lineHeight: 22,
    opacity: 0.7,
  },

  milestoneCardContainer: {
    marginBottom: 16,
  },
  milestoneCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  mCard: {
    padding: 16,
  },
  mHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  mTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  mTitle: { 
    color: COLORS.text, 
    fontWeight: "700", 
    fontSize: 17, 
    letterSpacing: Platform.OS === 'ios' ? -0.3 : -0.2,
    lineHeight: 22,
  },
  mHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  amountPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  amountText: { 
    color: "#22c55e", 
    fontWeight: "700", 
    fontSize: 14 
  },
  mPct: { 
    color: "rgba(234,241,247,0.75)", 
    fontWeight: "700", 
    fontSize: 16 
  },
  mMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(34, 197, 94, 0.15)",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: { 
    fontWeight: "700", 
    fontSize: 13 
  },
  mMetaText: { 
    color: "rgba(234,241,247,0.65)", 
    fontWeight: "600", 
    fontSize: 14 
  },
  costImpact: { 
    color: "#22d3ee", 
    fontWeight: "700", 
    fontSize: 14, 
    marginTop: 8 
  },
  mProgressContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  mProgressPendingBorder: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
  },
  emptyText: {
    color: COLORS.subtext,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
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
    gap: 20, // Increased spacing between log cards
    maxHeight: 340, // Adjusted for larger spacing
  },
  emptyLogsContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
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
    color: COLORS.subtext,
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


