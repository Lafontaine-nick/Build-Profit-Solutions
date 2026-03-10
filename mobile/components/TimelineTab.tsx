import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../src/theme/colors";
import MilestoneCard from "./timeline/MilestoneCard";
import ProgressBar from "./timeline/ProgressBar";
import EditMilestoneModal from "./EditMilestoneModal";
import AITimelineInsights from "./AITimelineInsights";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useProjectList } from "../contexts/ProjectListContext";
import type { Milestone } from "../src/types/timeline";

interface TimelineTabProps {
  project: any;
  theme?: "dark" | "light";
}

const getStorageKey = (projectId: string) => `bps.timeline.${projectId}`;

// Exclude deposit from progress — paid before work starts; Week 1+ represents actual work
function isDepositMilestone(m: Milestone): boolean {
  const t = ((m as any).title || (m as any).name || "").toLowerCase();
  return t.includes("deposit") || (m as any).type === "deposit";
}

function computeOverallPct(items: Milestone[]): number {
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => acc + Math.min(Math.max(m.progressPct || 0, 0), 100), 0);
  return sum / workItems.length;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function convertPaymentMilestonesToTimeline(paymentMilestones: any[]): Milestone[] {
  if (!Array.isArray(paymentMilestones)) return [];
  
  return paymentMilestones.map((milestone, index) => ({
    id: milestone.id || `payment-${index}`,
    title: milestone.name || milestone.title || `Payment ${index + 1}`,
    plannedDate: milestone.scheduledDate || milestone.dueDate || new Date().toISOString().split("T")[0],
    progressPct: milestone.status === "completed" ? 100 : milestone.status === "in_progress" ? 50 : 0,
    status: milestone.status === "completed" ? "completed" : milestone.status === "in_progress" ? "in_progress" : "pending",
    assignee: milestone.assignee || "Client",
    costDelta: milestone.costDelta || 0,
    costCategory: milestone.costCategory || "materials",
    dependsOnId: index > 0 ? paymentMilestones[index - 1]?.id || `payment-${index - 1}` : undefined,
    amount: milestone.paymentAmount || milestone.amount || 0,
  }));
}

export default function TimelineTab({ project, theme = "dark" }: TimelineTabProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const { projectData, updateTimeline } = useProjectData();
  const { updateProject, getProjectById } = useProjectList();

  // Load milestones on mount
  useEffect(() => {
    if (!project?.id) {
      setMilestones([]);
      setIsLoaded(true);
      return;
    }

    const loadMilestones = async () => {
      try {
        const key = getStorageKey(project.id);
        const saved = await AsyncStorage.getItem(key);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`✅ Loaded ${parsed.length} milestones from storage`);
            setMilestones(parsed);
            setIsLoaded(true);
            return;
          }
        }

        // If no saved data, try to get from project
        const projectFromList = getProjectById?.(project.id);
        const paymentMilestones = 
          project.milestones || 
          projectFromList?.milestones || 
          project.weeklyPayments || 
          projectFromList?.weeklyPayments || 
          [];

        if (paymentMilestones.length > 0) {
          const converted = convertPaymentMilestonesToTimeline(paymentMilestones);
          console.log(`✅ Converted ${converted.length} payment milestones to timeline`);
          setMilestones(converted);
          // Save the converted milestones
          await AsyncStorage.setItem(key, JSON.stringify(converted));
        } else {
          setMilestones([]);
        }

        setIsLoaded(true);
      } catch (error) {
        console.error("❌ Failed to load milestones:", error);
        setMilestones([]);
        setIsLoaded(true);
      }
    };

    loadMilestones();
  }, [project?.id, getProjectById]);

  // Save milestones whenever they change
  useEffect(() => {
    if (!isLoaded || !project?.id) return;

    const saveMilestones = async () => {
      try {
        const key = getStorageKey(project.id);
        await AsyncStorage.setItem(key, JSON.stringify(milestones));
        console.log(`💾 Saved ${milestones.length} milestones`);
      } catch (error) {
        console.error("❌ Failed to save milestones:", error);
      }
    };

    const timeoutId = setTimeout(saveMilestones, 500);
    return () => clearTimeout(timeoutId);
  }, [milestones, isLoaded, project?.id]);

  // Update overall progress
  const overall = useMemo(() => computeOverallPct(milestones), [milestones]);

  useEffect(() => {
    if (!isLoaded || !project?.id) return;

    const rounded = Math.round(overall);
    if (updateProject) {
      updateProject(project.id, { progress: rounded, overallProgressPct: rounded });
    }

    if (projectData && updateTimeline) {
      updateTimeline(
        projectData.startISO || project.startDate || new Date().toISOString(),
        projectData.endISO || project.endDate || new Date().toISOString(),
        rounded
      );
    }
  }, [overall, isLoaded, project?.id, updateProject, projectData, updateTimeline]);

  // Get upcoming milestones
  const upcoming = useMemo(() => {
    return [...milestones]
      .filter((m) => m.status !== "completed")
      .sort((a, b) => new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime())
      .slice(0, 3);
  }, [milestones]);

  // Milestone lookup
  const byId = useMemo(() => {
    return Object.fromEntries(milestones.map((m) => [m.id, m]));
  }, [milestones]);

  // Handlers
  const handleOpenMilestone = (milestone: Milestone) => {
    console.log("📝 Opening milestone:", milestone.id, milestone.title);
    setEditingMilestone(milestone);
  };

  const handleSaveMilestone = (updated: Milestone) => {
    console.log("💾 handleSaveMilestone called with:", {
      id: updated.id,
      title: updated.title,
      progress: updated.progressPct,
      status: updated.status
    });
    
    // Use functional update to ensure we have the latest state
    setMilestones((prev) => {
      if (!Array.isArray(prev)) {
        console.error("❌ prev is not an array:", prev);
        return [updated];
      }
      
      const newMilestones = prev.map((m) => {
        if (m.id === updated.id) {
          console.log("🔄 Replacing milestone:", m.id, "old progress:", m.progressPct, "new progress:", updated.progressPct);
          return { ...updated }; // Create new object
        }
        return m;
      });
      
      // Verify the update
      const found = newMilestones.find(m => m.id === updated.id);
      if (!found) {
        console.error("❌ Milestone not found after update!");
        return [...prev, updated]; // Add if not found
      }
      
      if (found.progressPct !== updated.progressPct || found.status !== updated.status) {
        console.error("❌ Milestone update failed! Expected:", updated, "Got:", found);
      } else {
        console.log("✅ Milestone update verified:", found.id, "progress:", found.progressPct, "status:", found.status);
      }
      
      console.log("📊 All milestones after update:", newMilestones.map(m => ({ 
        id: m.id, 
        title: m.title, 
        progress: m.progressPct, 
        status: m.status 
      })));
      
      return newMilestones;
    });
    
    // Don't set editingMilestone to null here - modal handles that
  };

  const handleAddMilestone = () => {
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: "New Milestone",
      plannedDate: new Date().toISOString().split("T")[0],
      progressPct: 0,
      status: "pending",
      assignee: "Client",
    };
    setMilestones((prev) => [...prev, newMilestone]);
    setEditingMilestone(newMilestone);
  };

  const handleDeleteMilestone = (id: string) => {
    Alert.alert("Delete Milestone", "Are you sure you want to delete this milestone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setMilestones((prev) => prev.filter((m) => m.id !== id));
          if (editingMilestone?.id === id) {
            setEditingMilestone(null);
          }
        },
      },
    ]);
  };

  const handleSyncWithEstimate = () => {
    if (!project?.id) {
      Alert.alert("⚠️ Missing Project", "Please open a project to sync milestones.");
      return;
    }
    const projectFromList = getProjectById?.(project.id);
    const paymentMilestones = 
      project.milestones || 
      projectFromList?.milestones || 
      project.weeklyPayments || 
      projectFromList?.weeklyPayments || 
      [];

    if (paymentMilestones.length === 0) {
      Alert.alert("⚠️ No Data", "No payment milestones found in estimate data.");
      return;
    }

    const converted = convertPaymentMilestonesToTimeline(paymentMilestones);
    
    // Merge: preserve existing status and progress
    const merged = converted.map((newM) => {
      const existing = milestones.find((m) => m.id === newM.id);
      if (existing) {
        return {
          ...newM,
          status: existing.status,
          progressPct: existing.progressPct,
          assignee: existing.assignee || newM.assignee,
          costDelta: existing.costDelta,
          costCategory: existing.costCategory,
        };
      }
      return newM;
    });

    setMilestones(merged);
    Alert.alert("✅ Synced!", `Timeline updated with ${merged.length} milestones from estimate.`);
  };

  if (!isLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>Loading timeline...</Text>
      </View>
    );
  }

  // Check if project hasn't started (no milestones with progress > 0)
  const projectStarted = milestones.some(m => m.progressPct > 0);
  const hasNoMilestones = milestones.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 120 }}
      >
        {/* Wide Container - matches Budget and Overview pages */}
        <View style={[styles.outerCard, styles.timelineContainerWide]}>
          {/* Baseline Locked Indicator */}
          <View style={[styles.baselineIndicator, { 
            backgroundColor: COLORS.card, 
            borderColor: COLORS.border 
          }]}>
            <Ionicons name="lock-closed" size={14} color={COLORS.subtext} />
            <Text style={[styles.baselineIndicatorText, { color: COLORS.subtext }]}>
              Baseline from estimate
            </Text>
          </View>

          {/* Zero-State Timeline Callout */}
          {(!projectStarted || hasNoMilestones) && (
            <View style={[styles.zeroStateCallout, { 
              backgroundColor: COLORS.card, 
              borderColor: COLORS.border 
            }]}>
              <Ionicons name="time-outline" size={24} color={COLORS.green} />
              <Text style={[styles.zeroStateTitle, { color: COLORS.text }]}>
                Project hasn't started yet
              </Text>
              <Text style={[styles.zeroStateSubtitle, { color: COLORS.subtext }]}>
                Once work begins, progress and payments will update automatically.
              </Text>
              <TouchableOpacity
                style={[styles.zeroStateButton, { 
                  backgroundColor: COLORS.green + '20',
                  borderColor: COLORS.green + '40'
                }]}
                onPress={handleAddMilestone}
              >
                <Text style={[styles.zeroStateButtonText, { color: COLORS.green }]}>
                  Mark project started
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Timeline Details Header */}
          <View style={styles.timelineHeaderRow}>
            <View>
              <Text style={[styles.timelineHeaderTitle, { color: COLORS.text }]}>Timeline Details</Text>
              <Text style={[styles.timelineHeaderSubtitle, { color: COLORS.subtext }]}>
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
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="schedule" size={22} color={COLORS.green} />
                <Text style={[styles.sectionTitle, { color: COLORS.text, marginLeft: 12 }]}>
                  Overall Progress
                </Text>
                <Text style={[styles.sectionTitle, { color: COLORS.text, marginLeft: "auto" }]}>
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
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="event" size={22} color={COLORS.green} />
                <Text style={[styles.sectionTitle, { color: COLORS.text, marginLeft: 12 }]}>
                  Upcoming (next 3)
                </Text>
              </View>
              <View style={styles.upcomingContent}>
                {upcoming.length > 0 ? (
                  upcoming.map((u) => (
                    <View key={u.id} style={styles.upcomingItem}>
                      <Text style={[styles.upcomingBullet, { color: COLORS.subtext }]}>•</Text>
                      <Text style={[styles.upcomingText, { color: COLORS.text }]}>
                        {u.title} <Text style={[styles.upcomingDate, { color: COLORS.subtext }]}>— {formatDate(u.plannedDate)}</Text>
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: COLORS.subtext }]}>
                    No upcoming milestones
                  </Text>
                )}
              </View>
            </View>
            </LinearGradient>
          </View>

          {/* All Payments Section */}
          <View style={styles.sectionCardContainer}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.sectionCardBorder}
            >
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="list" size={22} color={COLORS.green} />
                <Text style={[styles.sectionTitle, { color: COLORS.text, marginLeft: 12 }]}>
                  All Payments
                </Text>
              </View>
              <View style={styles.milestonesList}>
                {milestones.length > 0 ? (
                  milestones.map((item) => (
                    <MilestoneCard
                      key={`${item.id}-${item.progressPct}-${item.status}`}
                      item={item}
                      cardColors={["rgba(16, 242, 151, 0.07)", "rgba(16, 242, 151, 0)"]}
                      borderColor="#102131"
                      dependencyTitle={
                        item.dependsOnId ? byId[item.dependsOnId]?.title ?? "—" : undefined
                      }
                      onPress={handleOpenMilestone}
                    />
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: COLORS.subtext }]}>
                    No milestones yet. Add one to get started!
                  </Text>
                )}
                <AITimelineInsights milestones={milestones} />
              </View>
            </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <EditMilestoneModal
        visible={editingMilestone !== null}
        milestone={editingMilestone}
        projectBudget={project?.budgeted || project?.estimatedCost || 0}
        paymentMilestones={project.milestones || []}
        onClose={() => setEditingMilestone(null)}
        onSave={handleSaveMilestone}
        onDelete={handleDeleteMilestone}
      />

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={handleAddMilestone}>
          <Text style={styles.btnText}>+ Add Milestone</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={handleSyncWithEstimate}>
          <Text style={styles.btnText}>Sync Estimate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    marginHorizontal: -20,
  },
  scrollContent: { 
    padding: 0 
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  outerCard: {
    backgroundColor: "#020617",
    borderRadius: 28,
    marginBottom: 16,
  },
  timelineContainerWide: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
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
    backgroundColor: "#000000",
    borderRadius: 18,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
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
  milestonesList: {
    marginTop: 8,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 20,
  },
  loadingText: { 
    color: COLORS.text, 
    fontSize: 18, 
    fontWeight: "600" 
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGreen: { 
    backgroundColor: COLORS.green,
  },
  btnBlue: { 
    backgroundColor: "#4A90E2" 
  },
  btnText: { 
    color: COLORS.text, 
    fontWeight: "700", 
    textAlign: "center" 
  },
  zeroStateCallout: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  zeroStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  zeroStateSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  zeroStateButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  zeroStateButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  baselineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  baselineIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
