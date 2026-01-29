import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl, Platform } from "react-native";
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

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n || 0));
}

function computeOverallPct(items: Milestone[]) {
  if (!items.length) return 0;
  return items.reduce((acc, m) => acc + clampPct(m.progressPct), 0) / items.length;
}

function safeISODate(isoLike: string) {
  // we store plannedDate as an ISO string sometimes, or YYYY-MM-DD
  // normalize to YYYY-MM-DD for display/sorts
  try {
    const d = new Date(isoLike);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  // maybe it's already YYYY-MM-DD
  if (typeof isoLike === "string" && isoLike.includes("-")) return isoLike.split("T")[0];
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
  if (status === "completed") return { bg: "rgba(34, 197, 94, 0.25)", text: "#22c55e", border: "rgba(34, 211, 238, 0.3)" };
  if (status === "in_progress") return { bg: "rgba(34, 211, 238, 0.15)", text: "#22d3ee", border: "rgba(34, 197, 94, 0.3)" };
  return { bg: "rgba(180,195,215,0.18)", text: "rgba(234,241,247,0.75)", border: "rgba(34, 197, 94, 0.2)" };
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
      <LinearGradient
        colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={styles.milestoneCardBorder}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPress(item)}
          style={[
            styles.mCard,
            !darkMode && { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.line },
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
              isPending && styles.mProgressPendingBorder,
              isPending && !darkMode && { borderColor: Colors.line },
              isPending && darkMode && { borderColor: "rgba(34, 197, 94, 0.25)" },
            ]}
          >
            <ProgressBar value={pct} />
          </View>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

/* -------------------- main -------------------- */

interface TimelineTabProps {
  project: any;
  theme?: "dark" | "light";
}

export default function TimelineTabV2({ project }: TimelineTabProps) {
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
    const estimateData = (project as any)?.estimateData || projectFromList?.estimateData || {};
    let paymentMilestones: any[] = [];

    if (project?.milestones?.length) paymentMilestones = project.milestones;
    else if (project?.weeklyPayments?.length) paymentMilestones = convertWeeklyPaymentsToMilestones(project.weeklyPayments);
    else if (projectFromList?.milestones?.length) paymentMilestones = projectFromList.milestones;
    else if (projectFromList?.weeklyPayments?.length) paymentMilestones = convertWeeklyPaymentsToMilestones(projectFromList.weeklyPayments);
    else if (estimateData?.milestones?.length) paymentMilestones = estimateData.milestones;
    else if (estimateData?.paymentMilestones?.length) paymentMilestones = estimateData.paymentMilestones;
    else if (estimateData?.weeklyPayments?.length) {
      paymentMilestones = estimateData.weeklyPayments.map((w: any, i: number) => ({
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

    return paymentMilestones;
  }, [project?.milestones, project?.weeklyPayments, projectFromList?.milestones, projectFromList?.weeklyPayments, (project as any)?.estimateData]);

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
    
    if (!isNewProject && !estimateDataChanged) return;

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
              // Merge saved data (status, progress, etc.) into converted milestones
              const merged = converted.map((newM: Milestone) => {
                const savedM = parsed.find((m: Milestone) => m.id === newM.id);
                if (savedM) {
                  // Preserve saved status, progress, assignee, and cost data
                  return {
                    ...newM,
                    status: savedM.status || newM.status,
                    progressPct: savedM.progressPct ?? newM.progressPct,
                    assignee: savedM.assignee || newM.assignee,
                    costDelta: savedM.costDelta,
                    costCategory: savedM.costCategory,
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
  }, [project?.id, projectFromList?.estimateData, (project as any)?.estimateData, collectPaymentMilestones]);

  useEffect(() => {
    if (!isLoaded || !project?.id) return;
    AsyncStorage.setItem(getStorageKey(project.id), JSON.stringify(milestones)).catch(() => {});
  }, [milestones, isLoaded, project?.id]);

  /* ---------- sync milestones to ProjectList ---------- */

  useEffect(() => {
    if (!isLoaded || !project?.id || !updateProject || isUpdatingRef.current) return;
    if (!milestones.length) return;

    const projectMilestones = convertTimelineMilestonesToProject();
    const serialized = JSON.stringify(projectMilestones);
    if (serialized === lastSyncedMilestonesRef.current) return;

    lastSyncedMilestonesRef.current = serialized;
    isUpdatingRef.current = true;

    const t = setTimeout(() => {
      updateProject(project.id, { milestones: projectMilestones });
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
    if (lastProgressUpdateRef.current === rounded) return;

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
    setTimeout(() => setRefreshing(false), 500);
  }, [project?.id, collectPaymentMilestones]);

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
      <View style={[styles.container, styles.center, !darkMode && { backgroundColor: Colors.bg }]}>
        <Text style={[styles.loadingText, !darkMode && { color: Colors.text }]}>Loading timeline...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, !darkMode && { backgroundColor: Colors.bg }]}>
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
        <View style={[styles.outerCard, styles.timelineContainerWide, !darkMode && { backgroundColor: Colors.bg }]}>
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
          <View style={[styles.sectionCardContainer, { marginTop: 0 }]}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.sectionCardBorder}
            >
              <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.line }]}>
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
            </LinearGradient>
          </View>

          {/* Upcoming Milestones Section */}
          <View style={styles.sectionCardContainer}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.sectionCardBorder}
            >
              <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.line }]}>
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
            </LinearGradient>
          </View>

          {/* All Milestones Section */}
          <View style={styles.milestonesSection}>
            <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
              <MaterialIcons name="list" size={22} color="#22c55e" />
              <Text style={[styles.sectionTitle, { color: darkMode ? COLORS.text : Colors.text, marginLeft: 12 }]}>
                All Milestones
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
                <Text style={[styles.emptyText, { color: darkMode ? COLORS.subtext : Colors.sub }]}>
                  No milestones yet. Add one to get started!
                </Text>
              )}
            </View>
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
          console.log('💾 Saving milestone:', updated.id, updated.title);
          setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
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
    paddingHorizontal: 8, // Match dashboard wideContainer pattern
    paddingVertical: 18,
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
    borderRadius: 19,
    padding: 16,
    backgroundColor: "#000000",
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
    borderRadius: 19,
    padding: 20,
    backgroundColor: "#000000",
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
    borderColor: "rgba(34, 211, 238, 0.3)",
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
  },
  mProgressPendingBorder: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
  },

});


