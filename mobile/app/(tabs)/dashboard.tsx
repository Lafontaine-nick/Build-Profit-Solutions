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
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

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
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { dashboardMetrics, activeProjects, estimates } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiPmMode, setAiPmMode] = useState<boolean>(true);
  const [aiData, setAiData] = useState<AiDashboardResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Debounce refs for project changes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProjectsHashRef = useRef<string>('');

  const user = {
    name: "Nick Lafontaine",
    initials: "NL",
  };


  // Compute projects hash for change detection
  const computeProjectsHash = useCallback(() => {
    const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
    const allProjects = [...activeProjects, ...estimates]
      .filter(p => {
        if (!p || !p.id) return false;
        const status = (p.status || '').toString().toLowerCase();
        return validStatuses.includes(status);
      })
      .map(p => ({
        id: String(p.id),
        status: p.status,
        bidPrice: p.bidPrice || 0,
        estimatedCost: p.estimatedCost || 0,
        actualCost: p.actualCost || 0,
        margin: p.margin || 0,
        updatedAt: p.updatedAt,
      }));
    
    // Simple hash: sort by id and stringify
    const sorted = allProjects.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(sorted);
  }, [activeProjects, estimates]);

  // Fetch AI insights function (reusable for manual refresh)
  const fetchAiData = useCallback(async (forceRefresh = false) => {
    if (!aiPmMode && !forceRefresh) {
      setAiData(null);
      setAiError(null);
      return;
    }

    try {
      setAiLoading(true);
      setAiError(null);

      // Get userId from Clerk auth
      const authState = clerkAuthService.getAuthState();
      const userId = authState.user?.id || authState.user?.email || 'unknown';

      // Get all projects from context to send to AI
      const validStatuses = ['bid_submitted', 'submitted', 'won', 'in_progress', 'active', 'completed'];
      const allProjects = [...activeProjects, ...estimates]
        .filter(p => {
          if (!p || !p.id) return false;
          const status = (p.status || '').toString().toLowerCase();
          return validStatuses.includes(status);
        })
        .map((p) => ({
          id: String(p.id),
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
        { userId, projects: allProjects, forceRefresh }
      );

      // Convert project IDs to strings for consistent comparison
      // Reuse validStatuses from above (line 226)
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
          if (insight.projectId) {
            const insightProjectId = String(insight.projectId);
            if (!currentProjectIds.has(insightProjectId)) {
              return false;
            }
          }
          
          const insightText = `${insight.title || ''} ${insight.body || ''}`.toLowerCase();
          
          if (insightText.includes('josh')) {
            return false;
          }
          
          for (const proj of currentProjects) {
            const projName = String(proj.title || proj.name || '').toLowerCase().trim();
            if (projName && insightText.includes(projName)) {
              return true;
            }
          }
          
          if (insight.projectId && currentProjectIds.has(String(insight.projectId))) {
            return true;
          }
          
          if (!insight.projectId && !insightText.match(/\b(josh|remodel|project|estimate)\b/i)) {
            return true;
          }
          
          return false;
        }),
        nextSteps: (response.data.nextSteps || []).filter((step: any) => {
          if (step.projectId) {
            const stepProjectId = String(step.projectId);
            if (!currentProjectIds.has(stepProjectId)) {
              return false;
            }
          }
          
          const stepText = String(step.label || '').toLowerCase();
          
          if (stepText.includes('josh')) {
            return false;
          }
          
          if (step.projectId && currentProjectIds.has(String(step.projectId))) {
            return true;
          }
          
          if (!step.projectId && !stepText.includes('josh')) {
            return true;
          }
          
          return false;
        }),
      };
      setAiData(filteredData);
    } catch (err: any) {
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
        setAiData(null);
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
        setAiData(null);
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
        } else if (err.message.includes("status: 401") || err.message.includes("status: 403")) {
          errorMessage = "Authentication error. Please sign in again.";
        } else {
          setAiError(null);
          return;
        }
      }
      setAiError(errorMessage);
    } finally {
      setAiLoading(false);
    }
  }, [aiPmMode, activeProjects, estimates]);

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

    // Compute current projects hash
    const currentHash = computeProjectsHash();
    
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
  }, [aiPmMode, activeProjects, estimates, computeProjectsHash, fetchAiData, aiData]);

  // Initial fetch when AI PM mode is toggled ON (no debounce)
  useEffect(() => {
    if (aiPmMode && !aiData && !aiLoading) {
      const currentHash = computeProjectsHash();
      lastProjectsHashRef.current = currentHash;
      fetchAiData(false);
    }
  }, [aiPmMode]); // Only depend on aiPmMode for initial fetch

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
                ? "AI PM Active"
                : "AI monitoring paused · Manual mode";
              const isDark = Colors.bg === '#000000';
              const aiStatusColor = aiPmMode 
                ? (isDark ? "#6ee7b7" : "#16a34a") 
                : (isDark ? "#6b7280" : "#94A3B8");
              const dotColor = aiPmMode 
                ? "#22c55e" 
                : (isDark ? "#4b5563" : "#94A3B8");
              // Format timestamps
              const ruleBasedTime = aiData?.ruleBasedUpdatedAt 
                ? new Date(aiData.ruleBasedUpdatedAt).toLocaleTimeString()
                : null;
              const aiTime = aiData?.aiUpdatedAt 
                ? new Date(aiData.aiUpdatedAt).toLocaleTimeString()
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
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
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
        <Ionicons name={icon} size={18} color={Colors.bg === '#000000' ? "#E5F7FF" : "#000000"} />
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
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
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

const NextStepItem = ({ label, chip }: { label: string; chip: string }) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  return (
    <View style={styles.nextStepRow}>
      <View style={styles.nextStepBullet} />
      <Text style={styles.nextStepLabel}>{label}</Text>
      <View style={styles.nextStepChip}>
        <Text style={styles.nextStepChipText}>{chip}</Text>
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
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
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
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
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
              <View style={styles.aiEmptyState}>
                <Ionicons name="sparkles-outline" size={32} color={Colors.sub} style={{ marginBottom: 12 }} />
                <Text style={styles.aiEmptyStateTitle}>
                  Turn on AI PM Mode
                </Text>
                <Text style={styles.aiPanelPausedText}>
                  Get your daily brief with smart insights and next steps
                </Text>
              </View>
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

        const ProjectSummaryCard = ({
          project,
        }: {
          project: any;
        }) => (
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Text style={styles.projectSummaryAmount}>
                        {formatCurrencyFull(project.amount)}
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

/* ----------------- ANALYTICS ----------------- */

interface AnalyticsSectionProps {
  metrics: {
    totalBids: string;
    activeProjects: string;
    avgMargin: string;
    completedProfit: number;
  };
  dashboardMetrics: any;
  activeWonCount: number;
  activeProjects: any[];
  estimates: any[];
}

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  metrics,
  dashboardMetrics,
  activeWonCount,
  activeProjects,
  estimates,
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  // Simple avg project value for the snapshot card
  const avgProjectValue = useMemo(() => {
    const rawTotal = metrics.totalBids; // e.g. "$44K"

    const numeric = parseFloat(rawTotal.replace(/[^\d.]/g, "")); // 44
    if (!numeric || !activeWonCount) return "$0";

    // If the string contains "K", treat it as thousands
    const isThousands = /K/i.test(rawTotal);
    const totalValue = isThousands ? numeric * 1000 : numeric; // 44,000

    return formatCurrencyShort(totalValue / activeWonCount);
  }, [metrics.totalBids, activeWonCount]);

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
            marginBottom: 16,
          }}
        >
          <View style={{
            backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.bg,
            borderRadius: 18,
            padding: 16,
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
                value={activeWonCount.toString()}
              />
              <AnalyticsMetric
                label="Avg Project Value"
                value={avgProjectValue}
              />
              <AnalyticsMetric
                label="Avg Margin"
                value={metrics.avgMargin}
                extra="+0.0%"
              />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Deeper charts / profit analytics */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <ProfileAnalytics
          activeWonCount={activeWonCount}
          projectTypeStats={dashboardMetrics?.projectTypeStats}
          overviewProfit={metrics.completedProfit}
          completedProjects={[...activeProjects, ...estimates].filter(
            (p) => (p.status || "").toString().toLowerCase() === "completed"
          )}
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
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  // Get icon and color for each metric type
  const isDark = Colors.bg === '#000000';
  const getMetricConfig = (label: string) => {
    const baseConfigs: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; darkBg: string; lightBg: string }> = {
      "Total Bids": { icon: "cash-outline", color: "#3b82f6", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Active Projects": { icon: "folder-outline", color: "#22c55e", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Avg Project Value": { icon: "trending-up-outline", color: "#22d3ee", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
      "Avg Margin": { icon: "pie-chart-outline", color: "#a78bfa", darkBg: Colors.surface2, lightBg: "#E2E8F0" },
    };
    const config = baseConfigs[label] || { icon: "stats-chart-outline", color: "#8DA0B8", darkBg: Colors.surface2, lightBg: "#E2E8F0" };
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
  filteredNextSteps: any[];
  aiPmMode: boolean;
  aiLoading: boolean;
  aiError: string | null;
  aiData: AiDashboardResponse | null;
}

const InsightsSection: React.FC<InsightsSectionProps> = ({
  projects,
  filteredNextSteps,
  aiPmMode,
  aiLoading,
  aiError,
  aiData,
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  
  const urgentProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        (p.status === "Active" || p.status === "In Progress") &&
        p.progress < 0.3 &&
        p.dateLabel.includes("Due")
    );
  }, [projects]);

  const avgMargin =
    projects.length > 0
      ? projects.reduce((sum, p) => sum + (p.margin || 0), 0) / projects.length
      : 0;

  return (
    <>
      <View style={styles.wideContainer}>
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.nextStepsBorder}
        >
          <View style={styles.nextStepsInner}>
            <Text style={styles.cardTitle}>AI Insights</Text>
            <Text style={[styles.cardSubtitle, { marginTop: 8 }]}>
              {avgMargin > 80 && (
                <>
                  Your average margin is trending above {avgMargin.toFixed(1)}%. Consider raising
                  your minimum markup on new bids.
                  {"\n\n"}
                </>
              )}
              {urgentProjects.length > 0 && (
                <>
                  {urgentProjects.length} project{urgentProjects.length > 1 ? "s are" : " is"} under-utilizing your labor team. Shift crew from completed jobs to in-progress
                  work to finish sooner.
                </>
              )}
              {urgentProjects.length === 0 && avgMargin <= 80 && (
                <>
                  Smart suggestions about your bids, margins, and project risks will appear here
                  as you add more projects.
                </>
              )}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* NEXT STEPS */}
      <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
        <View>
          <Text style={styles.sectionTitle}>Next Steps for You</Text>
          <Text style={styles.sectionSubtitle}>Quick actions to stay ahead</Text>
        </View>
      </View>

      <View style={styles.wideContainer}>
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.nextStepsBorder}
        >
          <View style={styles.nextStepsInner}>
            {aiPmMode && aiLoading && (
              <Text style={styles.aiPanelPausedText}>Building your next steps…</Text>
            )}

            {aiPmMode &&
              !aiLoading &&
              !aiError &&
              filteredNextSteps.map((step) => (
                <NextStepItem
                  key={step.id}
                  label={step.label}
                  chip={step.chip}
                />
              ))}

            {!aiPmMode && (
              <View style={styles.aiEmptyState}>
                <Ionicons name="checkmark-circle-outline" size={32} color={Colors.sub} style={{ marginBottom: 12 }} />
                <Text style={styles.aiEmptyStateTitle}>
                  Turn on AI PM Mode
                </Text>
                <Text style={styles.aiPanelPausedText}>
                  Get personalized next steps based on your projects
                </Text>
              </View>
            )}

            {aiPmMode && !aiLoading && (aiData?.nextSteps ?? []).length === 0 && (
              <Text style={styles.aiPanelPausedText}>
                No immediate actions needed. Keep up the great work!
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </>
  );
};

/* ----------------- STYLES ----------------- */

const getStyles = (Colors: any) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  glossOverlay: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: "rgba(15,23,42,0.6)",
  },

  // HEADER
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    marginBottom: 18,
    marginHorizontal: -20,
    paddingHorizontal: 8,
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
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: Colors.bg === '#000000' ? Colors.sub : "#475569",
    marginTop: 4,
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
    color: Colors.sub,
    opacity: 0.7,
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
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    color: Colors.text,
    fontWeight: "700",
    fontSize: 16,
  },

  // SEGMENTED CONTROL
  segmentContainer: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 2, // Thicker green border
    borderColor: "#19E180", // Green border for both dark and light mode
    marginBottom: 18,
  },
  segmentInner: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: Colors.bg === '#000000' ? "transparent" : Colors.surface2,
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
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
    paddingVertical: 10,
    gap: 8,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#E5F7FF" : "#000000",
    opacity: Colors.bg === '#000000' ? 1 : 1, // Keep full opacity, color already muted
  },
  segmentLabelActive: {
    color: Colors.bg === '#000000' ? "#050B13" : "#071018",
  },

  // GENERIC CARD
  card: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: Colors.card,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
    marginBottom: 16,
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
  },
  allProjectsContainer: {
    marginBottom: 16,
    marginHorizontal: -20,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  analyticsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderWidth: 0,
  },
  analyticsSection: {
    marginBottom: 16,
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
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22, // Slightly larger
    fontWeight: Colors.bg === '#000000' ? "700" : "800", // Heavier in light mode
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#8DA0B8" : "#475569", // slate-600 for better contrast
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15E08A",
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
    borderRadius: 26,
    padding: 16,
    backgroundColor: "#0A2641",
    justifyContent: "space-between",
    minHeight: 140,
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
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricValueSecondary: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 14,
    color: "#E6F5FF",
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
    color: Colors.bg === '#000000' ? "#7C8BA0" : "#475569",
  },
  statusPillBase: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillTextBase: {
    fontSize: 13,
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
    color: Colors.bg === '#000000' ? "#9BB2C8" : "#475569",
  },
  projectMetaLabel: {
    fontSize: 12,
    color: Colors.bg === '#000000' ? "#7C8BA0" : "#475569",
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
    color: Colors.bg === '#000000' ? "#7C8BA0" : "#475569",
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
    marginTop: 8,
  },
  projectSummaryBorder: {
    borderRadius: 20,
    padding: 1,
  },
  projectSummaryCard: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.bg === '#000000' ? Colors.surface2 : Colors.surface2,
    borderWidth: Colors.bg === '#000000' ? 1 : 0,
    borderColor: Colors.line,
  },
  projectSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  projectSummaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    flexShrink: 1,
  },
  projectSummaryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#9BB2C8" : "#475569",
    marginTop: 4,
  },
  projectSummaryProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ANALYTICS
  analyticsGrid: {
    flexDirection: "column",
    marginTop: 16,
    gap: 10,
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
    padding: 14,
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
  analyticsLabel: {
    fontSize: 11, // Slightly larger
    color: Colors.bg === '#000000' ? "#8DA0B8" : "#334155",
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
    lineHeight: 12,
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: 2,
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
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.bg === '#000000' ? "#FFFFFF" : Colors.text,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#8DA0B8" : Colors.sub,
    marginTop: 4,
    textAlign: "center",
  },

  // ENHANCED METRIC CARDS
  metricOuter: {
    width: width * 0.72,
    marginRight: 14,
  },
  metricGradientCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    minHeight: 140,
    justifyContent: "space-between",
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  metricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  metricBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  chipText: {
    fontSize: 11,
    color: "#e5e7eb",
    fontWeight: "600",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metricContext: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 10,
  },

  // WIDE CONTAINER (matches allProjectsContainer)
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 4,
  },

  // SECTION HEADERS
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: -20,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Colors.bg === '#000000' ? "700" : "800", // Heavier in light mode
    color: Colors.bg === '#000000' ? "#e5e7eb" : "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#6b7280" : "#475569", // slate-600 for better contrast
    marginTop: 2,
  },

  // AI INSIGHTS PANEL
  aiPanelBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  aiPanelInner: {
    backgroundColor: Colors.bg === '#000000' ? Colors.card : Colors.surface, // Use surfaceSoft in light mode
    borderRadius: 18,
    padding: 16,
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
    fontSize: 12,
    color: Colors.bg === '#000000' ? Colors.sub : "#475569",
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
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
    color: Colors.bg === '#000000' ? "#e5e7eb" : Colors.text,
  },
  insightBody: {
    fontSize: 12,
    color: Colors.bg === '#000000' ? "#9ca3af" : "#475569",
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
    padding: 16,
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
    alignItems: "center",
    marginBottom: 8,
  },
  nextStepBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 8,
  },
  nextStepLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.bg === '#000000' ? "#e5e7eb" : Colors.text,
  },
  nextStepChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
    marginLeft: 8,
  },
  nextStepChipText: {
    fontSize: 10,
    color: "#4ade80",
    fontWeight: "600",
  },

  // FLOATING AI BADGE
  aiFloatingWrapper: {
    position: "absolute",
    right: 20,
    bottom: 100, // Raised above tab bar with more spacing
    zIndex: 10,
  },
  aiFloating: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#22c55e",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8, // Android shadow
  },
  aiFloatingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#020617",
  },
});
export default DashboardScreen;

