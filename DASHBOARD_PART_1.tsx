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
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useProjectList } from "@/contexts/ProjectListContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAIManagerMode } from "@/hooks/useAIManagerMode";
import AIAssistantModal from "@/components/AIAssistantModal";
import ProfileAnalytics from "@/components/ProfileAnalytics";
import * as Haptics from "expo-haptics";
import { apiService } from "@/services/api";
import type { AiDashboardResponse } from "@/types/aiDashboard";
import { clerkAuthService } from "@/services/clerkAuth";
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");

type TabKey = "overview" | "analytics" | "insights";

const formatCurrencyShort = (value: number) => {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
};

// Format currency as full value with 2 decimal places (e.g., $27,928.64)
const formatCurrencyFull = (value: number) => {
  return value.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
};

const sanitizePositiveNumber = (value: any): number => {
  if (value == null) return 0;
  const num =
    typeof value === "string"
      ? Number(value.replace(/[$,\s]/g, ""))
      : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const getProjectRevenue = (project: any): number => {
  if (!project) return 0;
  const candidates: any[] = [
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.projectData?.totalBidPrice,
    project?.estimateData?.bidPrice,
    project?.estimateData?.grandTotal,
    project?.total,
    project?.totalRevenue,
    project?.contractValue,
    project?.estimatedCost,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizePositiveNumber(candidate);
    if (sanitized > 0) {
      return sanitized;
    }
  }
  return 0;
};

// Status theme matching projects page
const statusTheme: Record<string, { bg: string; border: string; color: string }> = {
  Active: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Completed: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Submitted: { bg: 'rgba(148, 163, 184, 0.24)', border: 'rgba(148, 163, 184, 0.4)', color: '#e2e8f0' },
  Won: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Draft: { bg: 'rgba(148, 163, 184, 0.2)', border: 'rgba(148, 163, 184, 0.35)', color: '#cbd5e1' },
};

const computePipelineTotals = (projects: any[]) => {
  let totalBidValue = 0;
  let activeProjectsValue = 0;
  let completedProfit = 0;

  projects.forEach((project: any) => {
    const status = (project?.status || "").toString().toLowerCase();
    const revenue = getProjectRevenue(project);

    // Total Bids includes: active projects (won, in_progress, active) AND submitted bids (bid_submitted, submitted)
    if (
      [
        "won",
        "in_progress",
        "in-progress",
        "active",
        "bid_submitted",
        "submitted",
      ].includes(status)
    ) {
      totalBidValue += revenue;
    }

    if (["active", "completed", "won", "in_progress", "in-progress"].includes(status)) {
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

  // Round up the totals
  return { 
    totalBidValue: Math.ceil(totalBidValue), 
    activeProjectsValue: Math.ceil(activeProjectsValue), 
    completedProfit: Math.ceil(completedProfit) 
  };
};

const DashboardScreen: React.FC = () => {
  useRequireAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { dashboardMetrics, activeProjects, estimates } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiPmMode, setAiPmMode] = useState<boolean>(true);
  const [aiData, setAiData] = useState<AiDashboardResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const user = {
    name: "Nick Lafontaine",
    initials: "NL",
  };


  // Fetch AI insights when AI PM Mode is enabled
  // Also refresh when projects change (e.g., when a project is deleted)
  useEffect(() => {
    if (!aiPmMode) {
      setAiData(null);
      setAiError(null);
      return;
    }

    // Clear old AI data when projects change to force fresh fetch
    // This ensures deleted projects don't linger in insights
    setAiData(null);
    setAiError(null);

    let cancelled = false;

    const fetchAiData = async () => {
      try {
        setAiLoading(true);
        setAiError(null);

        // Get userId from Clerk auth
        const authState = clerkAuthService.getAuthState();
        const userId = authState.user?.id || authState.user?.email || 'unknown';

        // Get all projects from context to send to AI
        // Only include projects that are active, submitted, or in-progress (exclude drafts, deleted, lost)
        const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
        const allProjects = [...activeProjects, ...estimates]
          .filter(p => {
            if (!p || !p.id) return false;
            const status = (p.status || '').toString().toLowerCase();
            // Only include projects with valid statuses (active, submitted, in-progress)
            // Exclude: 'draft', 'estimate', 'lost'
            return validStatuses.includes(status);
          })
          .map((p) => ({
          id: String(p.id), // Ensure ID is always a string for consistency
          userId: userId,
          name: p.title,
          title: p.title,
          status: p.status,
          bidPrice: p.bidPrice || 0,
          estimatedCost: p.estimatedCost || 0,
          actualCost: p.actualCost || 0,
          margin: p.margin || 0,
          markup: p.markup || 0,
          location: p.location || '',
          city: p.city,
          state: p.state,
          projectType: p.projectType,
          startDate: p.startDate,
          endDate: p.endDate,
          progress: p.progress || 0,
          overallProgressPct: p.overallProgressPct || p.progress || 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          lineItems: p.estimateData?.materialLineItems || p.projectData?.buckets || [],
          receipts: p.projectData?.receipts || [],
          hasReceiptsAttached: Boolean(p.projectData?.receipts?.length),
          hasPermitFees: Boolean(p.estimateData?.hasPermitFees || p.projectData?.hasPermitFees),
          permitFeesIncluded: Boolean(p.estimateData?.permitFeesIncluded || p.projectData?.permitFeesIncluded),
        }));

        const response = await apiService.post<AiDashboardResponse>(
          "/api/ai/dashboard-insights",
          { userId, projects: allProjects }
        );

        if (!cancelled) {
          // Convert project IDs to strings for consistent comparison
          // Only include projects with valid statuses (active, submitted, in-progress)
          const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
          const currentProjects = [...activeProjects, ...estimates].filter(p => {
            const status = (p.status || '').toString().toLowerCase();
            return validStatuses.includes(status);
          });
          const currentProjectIds = new Set(
            currentProjects.map(p => String(p.id))
          );
          const currentProjectNames = new Set(
            currentProjects.map(p => String(p.title || p.name || '').toLowerCase().trim())
          );
          
          // Aggressively filter out insights for deleted projects before storing
          const filteredData = {
            ...response.data,
            insights: (response.data.insights || []).filter((insight: any) => {
              // First check: Filter by projectId if it exists
              if (insight.projectId) {
                const insightProjectId = String(insight.projectId);
                if (!currentProjectIds.has(insightProjectId)) {
                  // Project ID doesn't exist - filter it out
                  return false;
                }
              }
              
              // Second check: Filter by name in title/body (catches cases where projectId is missing or wrong)
              const insightText = `${insight.title || ''} ${insight.body || ''}`.toLowerCase();
              
              // Specifically filter out "josh" mentions
              if (insightText.includes('josh')) {
                return false;
              }
              
              // Check if insight mentions any project name - if it mentions a name not in current projects, filter it out
              // This is a safety check for any deleted project names
              for (const proj of currentProjects) {
                const projName = String(proj.title || proj.name || '').toLowerCase().trim();
                if (projName && insightText.includes(projName)) {
                  // Mentions a current project - keep it
                  return true;
                }
              }
              
              // If insight has projectId that matches, keep it
              if (insight.projectId && currentProjectIds.has(String(insight.projectId))) {
                return true;
              }
              
              // If no projectId and doesn't mention any projects, keep general insights
              if (!insight.projectId && !insightText.match(/\b(josh|remodel|project|estimate)\b/i)) {
                return true;
              }
              
              // Default: filter out if we're unsure
              return false;
            }),
            nextSteps: (response.data.nextSteps || []).filter((step: any) => {
              // First check: Filter by projectId if it exists
              if (step.projectId) {
                const stepProjectId = String(step.projectId);
                if (!currentProjectIds.has(stepProjectId)) {
                  // Project ID doesn't exist - filter it out
                  return false;
                }
              }
              
              // Second check: Filter by name in label (catches cases where projectId is missing or wrong)
              const stepText = String(step.label || '').toLowerCase();
              
              // Specifically filter out "josh" mentions
              if (stepText.includes('josh')) {
                return false;
              }
              
              // If step has projectId that matches, keep it
              if (step.projectId && currentProjectIds.has(String(step.projectId))) {
                return true;
              }
              
              // If no projectId and doesn't mention josh, keep general next steps
              if (!step.projectId && !stepText.includes('josh')) {
                return true;
              }
              
              // Default: filter out if we're unsure
              return false;
            }),
          };
          setAiData(filteredData);
        }
      } catch (err: any) {
        if (!cancelled) {
          // Check for route not found first - this is expected if endpoint doesn't exist
          const isRouteNotFound = 
            err.message?.includes("Route") && err.message?.includes("not found") ||
            err.message?.includes("Endpoint not found") ||
            err.status === 404 ||
            err.isNotFound;

          if (isRouteNotFound) {
            // Endpoint doesn't exist - silently fail without showing error
            if (__DEV__) {
              console.log("ℹ️  AI dashboard endpoint not available, skipping AI insights");
            }
            setAiData(null);
            setAiError(null);
            return;
          }

          // Check for network errors - don't show as critical errors
          const isNetworkError = 
            err.message?.includes("Network request failed") || 
            err.message?.includes("Failed to fetch") ||
            err.message?.includes("NetworkError") ||
            err.message?.includes("Cannot connect to backend") ||
            err.isNetworkError ||
            (err.name === "TypeError" && err.message?.includes("Network"));

          if (isNetworkError) {
            // Network error - log but don't show to user
            if (__DEV__) {
              console.warn("⚠️  Cannot connect to backend for AI insights:", err.message);
            }
            setAiData(null);
            setAiError(null);
            return;
          }

          // For other errors, log appropriately
          if (__DEV__) {
            console.warn("⚠️  AI dashboard fetch error:", err.message || err);
          }

          // Only set error for unexpected errors
          let errorMessage = "Could not load AI insights";
          if (err.message) {
            if (err.message.includes("OpenAI API key") || err.message.includes("AI service unavailable")) {
              errorMessage = "AI service not configured. Please set up OpenAI API key.";
            } else if (err.message.includes("status: 500")) {
              errorMessage = "Server error. Please try again later.";
            } else if (err.message.includes("status: 401") || err.message.includes("status: 403")) {
              errorMessage = "Authentication error. Please sign in again.";
            } else {
              // For other errors, don't show to user - just log
              setAiError(null);
              return;
            }
          }
          setAiError(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setAiLoading(false);
        }
      }
    };

    fetchAiData();

    // Refresh every 5 minutes when AI PM Mode is on
    const interval = setInterval(() => {
      if (aiPmMode && !cancelled) {
        fetchAiData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [aiPmMode, activeProjects, estimates]); // Re-fetch when projects change

  // Filter AI insights and next steps to exclude deleted projects and invalid statuses
  const filteredInsights = useMemo(() => {
    if (!aiData?.insights) return [];
    // Only include projects with valid statuses (active, submitted, in-progress)
    const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
    const currentProjects = [...activeProjects, ...estimates].filter(p => {
      const status = (p.status || '').toString().toLowerCase();
      return validStatuses.includes(status);
    });
    const currentProjectIds = new Set(
      currentProjects.map(p => String(p.id))
    );
    const currentProjectNames = new Set(
      currentProjects.map(p => String(p.title || p.name || '').toLowerCase().trim())
    );
    
    return aiData.insights.filter((insight) => {
      if (!insight.projectId) {
        // For insights without projectId, check if title/body mentions a deleted project
        const insightText = `${insight.title || ''} ${insight.body || ''}`.toLowerCase();
        // Only keep if it doesn't mention any deleted project names (crude check)
        // If it mentions a project name that's not in current projects, filter it out
        for (const proj of currentProjects) {
          const projName = String(proj.title || proj.name || '').toLowerCase().trim();
          if (projName && insightText.includes(projName)) {
            return true; // Mentions a current project, keep it
          }
        }
        // Check if it mentions "josh" (the deleted project) - filter it out
        if (insightText.includes('josh')) {
          return false; // Filter out insights mentioning "josh"
        }
        return true; // Keep general insights that don't mention projects
      }
      // Convert insight.projectId to string for comparison
      const insightProjectId = String(insight.projectId);
      if (currentProjectIds.has(insightProjectId)) {
        return true; // Project ID matches, keep it
      }
      
      // Fallback: Check if insight mentions a deleted project by name
      const insightText = `${insight.title || ''} ${insight.body || ''}`.toLowerCase();
      if (insightText.includes('josh')) {
        return false; // Filter out insights mentioning "josh remodel"
      }
      
      return false; // Project doesn't exist, filter it out
    });
  }, [aiData?.insights, activeProjects, estimates]);

  const filteredNextSteps = useMemo(() => {
    if (!aiData?.nextSteps) return [];
    // Only include projects with valid statuses (active, submitted, in-progress)
    const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
    const currentProjects = [...activeProjects, ...estimates].filter(p => {
      const status = (p.status || '').toString().toLowerCase();
      return validStatuses.includes(status);
    });
    const currentProjectIds = new Set(
      currentProjects.map(p => String(p.id))
    );
    
    return aiData.nextSteps.filter((step) => {
      if (!step.projectId) {
        // For next steps without projectId, check if label mentions a deleted project
        const stepText = String(step.label || '').toLowerCase();
        if (stepText.includes('josh')) {
          return false; // Filter out next steps mentioning "josh remodel"
        }
        return true; // Keep general next steps
      }
      // Convert step.projectId to string for comparison
      const stepProjectId = String(step.projectId);
      if (currentProjectIds.has(stepProjectId)) {
        return true; // Project ID matches, keep it
      }
      
      // Fallback: Check if step mentions a deleted project by name
      const stepText = String(step.label || '').toLowerCase();
      if (stepText.includes('josh')) {
        return false; // Filter out next steps mentioning "josh remodel"
      }
      
      return false; // Project doesn't exist, filter it out
    });
  }, [aiData?.nextSteps, activeProjects, estimates]);

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
        const status = p.status || "draft";
        let displayStatus = "Draft";
        if (status === "estimate") displayStatus = "Draft";
        else if (status === "bid_submitted") displayStatus = "Submitted";
        else if (status === "won") displayStatus = "Active";
        else if (status === "in_progress") displayStatus = "Active";
        else if (status === "completed") displayStatus = "Completed";
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

        const revenue = getProjectRevenue(p);
        const margin = p.margin || 0;
        const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;

        return {
          id: p.id,
          name: p.title || "Untitled Project",
          status: displayStatus,
          location: p.location || "Unknown, Unknown",
          progress: (p.progress || p.overallProgressPct || 0) / 100, // Convert to 0-1
          amount: revenue,
          margin: marginRatio * 100,
          marginDisplay: `${(marginRatio * 100).toFixed(1)}% margin`,
          dateLabel: p.endDate
            ? status === "completed"
              ? `Completed ${new Date(p.endDate).toISOString().split("T")[0]}`
              : `Due ${new Date(p.endDate).toISOString().split("T")[0]}`
            : "No due date",
          rawProject: p,
        };
      });
  }, [activeProjects, estimates]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const pipelineTotals = computePipelineTotals([...activeProjects, ...estimates]);
    const totalBids = pipelineTotals.totalBidValue || dashboardMetrics?.totalRevenue || 0;
    const activeProjectsValue = pipelineTotals.activeProjectsValue || totalBids;
    const avgMargin =
      projects.length > 0
        ? projects.reduce((sum, p) => sum + (p.margin || 0), 0) / projects.length
        : 0;

    return {
      totalBids: formatCurrencyShort(totalBids),
      activeProjects: formatCurrencyShort(activeProjectsValue),
      avgMargin: `${avgMargin.toFixed(1)}%`,
      completedProfit: pipelineTotals.completedProfit,
    };
  }, [activeProjects, estimates, dashboardMetrics, projects]);

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

  // Get active/won projects count
  const activeWonCount = useMemo(() => {
    return projects.filter(
      (p) => p.status === "Active" || p.status === "Completed"
    ).length;
  }, [projects]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <View style={StyleSheet.absoluteFill} />

        <ScrollView
        contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* HEADER */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
            <Text style={styles.screenTitle}>{t('dashboard.title')}</Text>
            <Text style={styles.screenSubtitle}>{t('dashboard.welcome')}, {user.name}</Text>

            {/* AI status badge */}
            {(() => {
              const aiStatusText = aiPmMode
                ? "AI monitoring active · No issues detected"
                : "AI monitoring paused · Manual mode";
              const aiStatusColor = aiPmMode ? "#6ee7b7" : "#6b7280";
              const lastUpdatedText =
                aiPmMode && aiData?.lastUpdated
                  ? ` · Updated ${new Date(aiData.lastUpdated).toLocaleTimeString()}`
                  : "";
              return (
                <View style={styles.aiStatusRow}>
                  <View
                    style={[
                      styles.aiDot,
                      { backgroundColor: aiPmMode ? "#22c55e" : "#4b5563" },
                    ]}
                  />
                  <Text style={[styles.aiStatusText, { color: aiStatusColor }]}>
                    {aiStatusText}{lastUpdatedText}
                  </Text>
                </View>
              );
            })()}
            </View>
            
          {/* Profile with glow */}
            <LinearGradient
            colors={["#22c55e", "#22d3ee"]}
            style={styles.profileOuter}
          >
            <Pressable
              style={styles.profileInner}
              onPress={() => router.push("/profile")}
            >
              <Text style={styles.profileInitials}>{user.initials}</Text>
            </Pressable>
            </LinearGradient>
          </View>

        {/* SEGMENTED CONTROL */}
        <View style={styles.wideContainer}>
          <BlurView intensity={35} tint="dark" style={styles.segmentContainer}>
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
            aiPmMode={aiPmMode}
            aiData={aiData}
            aiLoading={aiLoading}
            aiError={aiError}
            filteredInsights={filteredInsights}
            filteredNextSteps={filteredNextSteps}
          />
        )}
        {activeTab === "analytics" && (
          <AnalyticsSection
            metrics={metrics}
            dashboardMetrics={dashboardMetrics}
            activeWonCount={activeWonCount}
            activeProjects={activeProjects}
            estimates={estimates}
          />
        )}
        {activeTab === "insights" && (
          <InsightsSection
            projects={projects}
            filteredNextSteps={filteredNextSteps}
            aiPmMode={aiPmMode}
            aiLoading={aiLoading}
            aiError={aiError}
            aiData={aiData}
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* FLOATING AI PROJECT MANAGER MODE BADGE */}
      <Pressable
        style={styles.aiFloatingWrapper}
        onPress={() => setAiPmMode((prev) => !prev)}
      >
        <LinearGradient
          colors={aiPmMode ? ["#22c55e", "#22d3ee"] : ["#4b5563", "#020617"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiFloating}
        >
          <Ionicons
            name="sparkles"
            size={18}
            color={aiPmMode ? "#020617" : "#e5e7eb"}
          />
          <Text style={styles.aiFloatingText}>
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
          allProjects: [...activeProjects, ...estimates].map((p) => ({
            id: p.id,
            title: p.title,
            customerName: (p as any).client || p.title,
            status: p.status,
            bidPrice: p.bidPrice || 0,
            estimatedCost: p.estimatedCost || 0,
            totalBudget: p.estimatedCost || p.bidPrice || 0,
          })),
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
            <Ionicons name={icon} size={18} color="#050B13" />
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
        <Ionicons name={icon} size={18} color="#E5F7FF" />
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
}: {
  gradient?: boolean;
  label: string;
  value: string;
  timeframe: string;
  trend: string;
  trendDirection: "up" | "down";
  context: string;
}) => {
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
        styles.metricOuter,
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
                size={16}
                color={gradient || label === "Avg Margin" ? "#020617" : "#22d3ee"}
                  />
                </View>
          </View>
          <Text style={[styles.metricValue, (gradient || label === "Avg Margin") && { color: "#020617" }]}>
            {value}
          </Text>
          <Text style={[styles.metricLabel, (gradient || label === "Avg Margin") && { color: "#020617aa" }]}>
            {label}
          </Text>

          <View style={styles.metricBottomRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{timeframe}</Text>
                  </View>
            <View style={styles.trendRow}>
              <MaterialIcons
                name={trendDirection === "up" ? "north-east" : "south-east"}
                size={14}
                color={trendDirection === "up" ? "#16a34a" : "#f97316"}
              />
              <Text
                style={[
                  styles.trendText,
                  trendDirection === "up"
                    ? { color: "#16a34a" }
                    : { color: "#f97316" },
                ]}
              >
                {trend}
              </Text>
                </View>
              </View>

          <Text
            style={[
              styles.metricContext,
              (gradient || label === "Avg Margin") && { color: "#020617bb" },
            ]}
          >
            {context}
                  </Text>
        </CardWrapper>
      </Pressable>
    </Animated.View>
  );
};

/* ----------------- NEXT STEP ITEM ----------------- */

const NextStepItem = ({ label, chip }: { label: string; chip: string }) => (
  <View style={styles.nextStepRow}>
    <View style={styles.nextStepBullet} />
    <Text style={styles.nextStepLabel}>{label}</Text>
    <View style={styles.nextStepChip}>
      <Text style={styles.nextStepChipText}>{chip}</Text>
                    </View>
                  </View>
);

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

  return (
    <View style={styles.insightRow}>
      <View style={[styles.insightIconCircle, { borderColor: colorMap[type] }]}>
        <Ionicons name={iconMap[type]} size={16} color={colorMap[type]} />
                    </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightBody}>{body}</Text>
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
    completedProfit: number;
  };
  projects: any[];
  onProjectPress: (project: any) => void;
  onViewAllPress: () => void;
  aiPmMode: boolean;
  aiData: AiDashboardResponse | null;
  aiLoading: boolean;
  aiError: string | null;
  filteredInsights: any[];
  filteredNextSteps: any[];
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
  metrics,
  projects,
  onProjectPress,
  onViewAllPress,
  aiPmMode,
  aiData,
  aiLoading,
  aiError,
  filteredInsights,
  filteredNextSteps,
}) => {
  const { t } = useTranslation();
  return (
    <>
      {/* KEY METRICS */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <Text style={styles.sectionSubtitle}>This month at a glance</Text>
                    </View>
        <Text style={styles.linkText}>Swipe ➜</Text>
                  </View>

        <View style={[styles.metricsRow, styles.wideContainer]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 24 }}
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
            label="Avg Margin"
            value={metrics.avgMargin}
            timeframe="This Month"
            trend="-1.2%"
            trendDirection="down"
            context="Slightly below your 35% target"
          />
        </ScrollView>
                  </View>

      {/* AI INSIGHTS PANEL */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>AI Insights for Today</Text>
          <Text style={styles.sectionSubtitle}>What your AI project manager sees</Text>
        </View>
      </View>

      <View style={[styles.wideContainer, !aiPmMode && { opacity: 0.4 }]}>
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
              <Text style={styles.aiPanelPausedText}>
                AI PM Mode is off. Turn it back on to resume live monitoring.
              </Text>
            )}

            {!aiError && aiPmMode && aiLoading && (
              <Text style={styles.aiPanelPausedText}>Analyzing your projects…</Text>
            )}

            {!aiError && aiPmMode && !aiLoading && (aiData?.insights ?? []).length === 0 && (
              <Text style={styles.aiPanelPausedText}>
                No major issues detected. All projects look on track.
              </Text>
            )}

            {aiPmMode &&
              !aiLoading &&
              !aiError &&
              filteredInsights.map((insight) => (
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

      {/* ALL PROJECTS */}
      {(() => {
        const totalProjects = projects.length;
        const activeProjectsCount = projects.filter(
          (p: any) => p.status === "Active"
        ).length;

        const ProjectSummaryCard = ({ project }: { project: any }) => (
          <Pressable
            style={styles.projectSummaryWrapper}
            onPress={() => onProjectPress(project)}
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Text style={styles.projectSummaryAmount}>
                        {formatCurrencyFull(project.amount)}
                      </Text>
                      {aiPmMode && (
                        <View style={styles.aiTagChip}>
                          <Ionicons name="sparkles-outline" size={10} color="#BBF7D0" />
                          <Text style={styles.aiTagText}>AI</Text>
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
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>
                    {Math.round(project.progress * 100)}%
                  </Text>
                </View>
              </View>
          </Pressable>
        );

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
                backgroundColor: '#000000',
                borderRadius: 18,
                padding: 16,
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
                    <Ionicons name="folder-outline" size={48} color="#7C8BA0" />
                    <Text style={styles.emptyStateText}>{t('dashboard.noProjects')}</Text>
                    <Text style={styles.emptyStateSubtext}>
                      {t('dashboard.createFirstProject')}
                    </Text>
                  </View>
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
