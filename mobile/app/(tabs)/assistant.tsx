import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import AIAssistantModal from '@/components/AIAssistantModal';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProjectsCompareData } from '@/hooks/useProjectsCompareData';
import WebPageShell from '@/components/layout/WebPageShell';
import TabScreenBottomScrollFade from '@/components/layout/TabScreenBottomScrollFade';
import {
  loadDeletedProjectRecords,
  filterProjectsForPortfolioAi,
  resolvePortfolioProjectStatus,
  type DeletedProjectRecord,
} from '@/utils/aiDashboardPortfolioFilter';
import { computeProjectFinancials, sumPlannedCostFromBuckets } from '@/src/lib/projectFinancials';
import {
  computeProfitForecast,
  contractCollectedPctFromMilestones,
  computeElapsedCalendarPct,
} from '@/src/lib/profitForecast';

/** Last wins per id (or title if id missing) — avoids duplicate rows inflating Command Center / compare counts. */
function dedupeProjectsForAssistantAi(list: any[]): any[] {
  const m = new Map<string, any>();
  for (const p of list || []) {
    const id = String(p?.id ?? '').trim();
    const titleKey = String(p?.title ?? p?.name ?? '').trim().toLowerCase();
    const key = id || (titleKey ? `t:${titleKey}` : `_:${m.size}`);
    m.set(key, p);
  }
  return [...m.values()];
}

const getStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});

export default function AssistantScreen() {
  useRequireAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors), [Colors]);
  const { activeProjects, estimates, projects } = useProjectList();
  const allProjectsForTimeline = projects?.length > 0 ? projects : [...activeProjects, ...estimates];
  const { compareData: compareProjectsData, progressByProjectId, timelineMilestonesByProjectId, isLoaded: isTimelineLoaded } = useProjectsCompareData(activeProjects, estimates, allProjectsForTimeline);
  const [showAIAssistant, setShowAIAssistant] = useState(false); // Start false to prevent flash
  const [assistantResetSignal, setAssistantResetSignal] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [dailyLogsByProjectId, setDailyLogsByProjectId] = useState<Record<string, any[]>>({});
  const [calendarEventsByProjectId, setCalendarEventsByProjectId] = useState<Record<string, any[]>>({});
  const [projectSnapshotsById, setProjectSnapshotsById] = useState<Record<string, any>>({});
  const [deletedProjectRecords, setDeletedProjectRecords] = useState<DeletedProjectRecord[]>([]);

  useEffect(() => {
    void loadDeletedProjectRecords().then(setDeletedProjectRecords);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadDeletedProjectRecords().then(setDeletedProjectRecords);
    }, [])
  );

  // Load daily logs and calendar events from AsyncStorage for all projects
  useEffect(() => {
    const loadExtraProjectData = async () => {
      const allList = projects?.length > 0 ? projects : [...activeProjects, ...estimates];
      const logsMap: Record<string, any[]> = {};
      const eventsMap: Record<string, any[]> = {};
      const snapshotsMap: Record<string, any> = {};
      for (const p of allList) {
        const pid = String(p?.id ?? '');
        if (!pid) continue;
        try {
          const [logsRaw, eventsRaw, snapshotRaw] = await Promise.all([
            AsyncStorage.getItem(`daily_logs_${pid}`),
            AsyncStorage.getItem(`calendar_events_${pid}`),
            AsyncStorage.getItem(`bps.project.${pid}`),
          ]);
          if (logsRaw) {
            const parsed = JSON.parse(logsRaw);
            const arr = Array.isArray(parsed) ? parsed : [];
            logsMap[pid] = arr.slice(-20);
          }
          if (eventsRaw) {
            const parsed = JSON.parse(eventsRaw);
            eventsMap[pid] = Array.isArray(parsed) ? parsed : [];
          }
          if (snapshotRaw) {
            snapshotsMap[pid] = JSON.parse(snapshotRaw);
          }
        } catch {}
      }
      setDailyLogsByProjectId(logsMap);
      setCalendarEventsByProjectId(eventsMap);
      setProjectSnapshotsById(snapshotsMap);
    };
    loadExtraProjectData();
  }, [projects, activeProjects, estimates]);

  // Auto-open modal when this tab is focused — MUST close on blur: RN `Modal` portals above the
  // whole app (all tabs). Leaving `visible` true after switching to Dashboard freezes web + native.
  useFocusEffect(
    React.useCallback(() => {
      setIsReady(true);
      setAssistantResetSignal((signal) => signal + 1);
      const timer = setTimeout(() => {
        setShowAIAssistant(true);
      }, 50);
      return () => {
        clearTimeout(timer);
        setShowAIAssistant(false);
      };
    }, [])
  );

  // Build context and project options for AI Assistant — use full projects list for chips (includes all statuses)
  const { context, projectOptions } = React.useMemo(() => {
    const rawProjectsList =
      projects?.length > 0 ? projects : [...activeProjects, ...estimates];
    const allProjectsList = filterProjectsForPortfolioAi(
      dedupeProjectsForAssistantAi(rawProjectsList),
      deletedProjectRecords
    );
    const safeNum = (value: unknown) => {
      const n = Number(value || 0);
      return Number.isFinite(n) ? n : 0;
    };
    const mappedProjects = allProjectsList.map((p: any) => {
      const pid = String(p?.id ?? '');
      const snapshot = projectSnapshotsById[pid] || null;
      const mergedProjectData = {
        ...(snapshot?.projectData || {}),
        ...(p.projectData || {}),
      };
      const mergedProject = {
        ...(snapshot || {}),
        ...(p || {}),
        projectData: mergedProjectData,
      };
      const projectStatus = resolvePortfolioProjectStatus(mergedProject) || 'unknown';
      const title =
        mergedProject.title ||
        mergedProject.name ||
        p.title ||
        p.name ||
        'Untitled Project';
      const bidPrice =
        mergedProject.bidPrice ||
        mergedProject.projectData?.bidPrice ||
        mergedProject.estimateData?.bidPrice ||
        0;
      const changeOrders = mergedProject.projectData?.changeOrders || mergedProject.changeOrders || [];
      const approvedCOs = changeOrders.reduce((s: number, co: any) => {
        const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status?.toLowerCase() === 'approved');
        return ok ? s + (Number(co?.amount) || 0) : s;
      }, 0);
      const contractValue = bidPrice + approvedCOs;
      const estimateData = mergedProject.estimateData || mergedProject.projectData?.estimateData || {};
      const buckets = mergedProject.projectData?.buckets || mergedProject.buckets || [];
      const expenses = mergedProject.expenses || mergedProject.projectData?.expenses || [];
      const purchaseOrders = mergedProject.projectData?.purchaseOrders || mergedProject.purchaseOrders || [];
      // Use timeline progress (progressByProjectId or compareProjectsData) so backend and fallback match Projects page.
      // progressByProjectId is set as soon as timeline loads; compareProjectsData may still be [] on first paint.
      const titleKey = String(title).trim().toLowerCase();
      const titleSlug = titleKey.replace(/\s+/g, '-');
      const compareItem = compareProjectsData.find(
        (c: any) => (c.title || '').toLowerCase() === titleKey
      );
      const progress = progressByProjectId[pid] ??
        progressByProjectId[titleKey] ??
        progressByProjectId[titleSlug] ??
        compareItem?.progress ??
        (mergedProject.progress ?? mergedProject.overallProgressPct ?? mergedProject.projectData?.progress ?? 0);
      const milestones =
        timelineMilestonesByProjectId[pid] ||
        timelineMilestonesByProjectId[titleKey] ||
        timelineMilestonesByProjectId[titleSlug] ||
        mergedProject.milestones ||
        mergedProject.projectData?.milestones ||
        mergedProject.projectData?.weeklyPayments ||
        mergedProject.estimateData?.milestones ||
        mergedProject.estimateData?.paymentMilestones ||
        mergedProject.estimateData?.weeklyPayments ||
        [];
      const expenseLineTotal = expenses.reduce((sum: number, e: any) => sum + safeNum(e?.amount), 0);
      const bucketSpentTotal = Array.isArray(buckets)
        ? buckets.reduce((sum: number, b: any) => sum + safeNum(b?.spent), 0)
        : 0;
      // Do not use projectData.spent as a primary source here. Some saved project snapshots
      // store the planned cost budget in that field, which makes Command Center read budget as spend.
      const actualCost =
        expenseLineTotal ||
        mergedProject.actualCost ||
        mergedProject.totalSpent ||
        mergedProject.projectData?.actualCost ||
        bucketSpentTotal;
      const committedPOs =
        safeNum(mergedProject.committedPOs) ||
        purchaseOrders
          .filter((po: any) => String(po?.status || '').toLowerCase() === 'pending')
          .reduce((sum: number, po: any) => sum + safeNum(po?.amount), 0);
      const plannedCostBucketSum = sumPlannedCostFromBuckets(buckets);
      const financials = computeProjectFinancials(
        {
          ...mergedProject,
          title,
          estimateData,
          buckets,
          changeOrders,
          purchaseOrders,
        },
        {
          plannedFromBuckets: plannedCostBucketSum,
          plannedCostBucketSum,
        }
      );
      const contractCollectedPct = contractCollectedPctFromMilestones(
        milestones,
        financials.adjustedContractValue
      );
      const elapsedTimePct = computeElapsedCalendarPct(
        mergedProject.startISO || mergedProject.projectData?.startISO || mergedProject.startDate || mergedProject.projectData?.startDate,
        mergedProject.endISO || mergedProject.projectData?.endISO || mergedProject.endDate || mergedProject.projectData?.endDate
      );
      const profitForecast = computeProfitForecast({
        contractValue: financials.adjustedContractValue,
        adjustedBudget: financials.adjustedCostBudget || financials.adjustedContractValue,
        estimatedCostBaseline:
          financials.plannedCostBudget || financials.adjustedCostBudget,
        actualExpenses: actualCost,
        committedPOs,
        progressPct: safeNum(progress),
        contractCollectedPct,
        elapsedTimePct,
        isCompleted: String(projectStatus).toLowerCase() === 'completed',
      });
      const st = String(projectStatus).toLowerCase();
      const isActive = ['won', 'active', 'in_progress', 'in-progress'].includes(st);
      const isCompleted = st === 'completed';
      return {
      id: mergedProject.id,
      title,
      customerName: mergedProject.client || title,
      status: projectStatus,
      isActive,
      isCompleted,
      bidPrice,
      contractValue:
        financials.adjustedContractValue > 0
          ? financials.adjustedContractValue
          : (contractValue > 0 ? contractValue : bidPrice),
      adjustedContractValue: financials.adjustedContractValue,
      estimatedCost: financials.adjustedCostBudget || mergedProject.estimatedCost || 0,
      adjustedCostBudget: financials.adjustedCostBudget,
      plannedCostBudget: financials.plannedCostBudget,
      actualCost,
      totalSpent: actualCost,
      expenses,
      expensesCount: expenses.length,
      totalBudget: financials.adjustedCostBudget || mergedProject.estimatedCost || mergedProject.bidPrice || 0,
      margin: mergedProject.margin || estimateData?.marginPct || estimateData?.margin || 0,
      markup: mergedProject.markup || mergedProject.markupPct || estimateData?.markupPct || estimateData?.markup || 0,
      buckets,
      changeOrders,
      milestones,
      estimateData,
      purchaseOrders,
      committedPOs,
      dailyLogs: dailyLogsByProjectId[pid] || [],
      updatedAt: mergedProject.projectData?.lastUpdated || mergedProject.updatedAt || mergedProject.lastUpdated,
      progress,
      forecastFinalCost: profitForecast.forecastFinalCost,
      projectedProfit: profitForecast.projectedProfit,
      projectedMarginPct: profitForecast.projectedMarginPct,
      spendToDateMarginPct: profitForecast.spendToDateMarginPct,
      estimatedMarginPct:
        financials.adjustedContractValue > 0 && financials.plannedCostBudget > 0
        ? ((financials.adjustedContractValue - financials.plannedCostBudget) / financials.adjustedContractValue) * 100
        : undefined,
      calendarEvents: calendarEventsByProjectId[pid] || mergedProject.projectData?.calendarEvents || mergedProject.calendarEvents || [],
    };
    });
    
    // If there's only one project, or exactly one active project, use it as current.
    // When 2+ active projects exist, do NOT pre-fill projectId — let the AI ask "which project?"
    let currentProject: any = null;
    const activeOnly = allProjectsList.filter((p: any) =>
      ['won', 'active', 'in_progress', 'in-progress'].includes(
        (p.status || p.projectData?.status || '').toLowerCase()
      )
    );
    if (allProjectsList.length === 1) {
      currentProject = allProjectsList[0];
    } else if (activeOnly.length === 1) {
      currentProject = activeOnly[0];
    } else if (activeOnly.length >= 2) {
      // Multiple active projects — do NOT pre-fill; user must pick
      currentProject = null;
    } else {
      // No active projects: prefer estimates
      currentProject = allProjectsList.find((p: any) =>
        ['estimate', 'draft', 'bid_submitted', 'submitted'].includes((p.status || '').toLowerCase())
      ) || allProjectsList[0];
    }
    const currentProjectSnapshot = currentProject
      ? mappedProjects.find((p: any) => String(p.id) === String(currentProject.id)) || currentProject
      : null;
    
    const contextObj: any = {
      screen: "AI Assistant Tab",
      assistantMode: "central_command",
      readOnly: true,
      aiScope: "portfolio",
      allProjects: mappedProjects,
      deletedProjectIds: deletedProjectRecords.map((r) => r.id).filter(Boolean),
      deletedProjectTitles: [
        ...new Set(
          deletedProjectRecords
            .map((r) => String(r.title || '').trim())
            .filter((t) => t.length >= 3)
        ),
      ],
    };
    if (compareProjectsData.length > 0) {
      const allowedIds = new Set(mappedProjects.map((p: any) => String(p.id ?? '')));
      const allowedTitles = new Set(
        mappedProjects.map((p: any) => String(p.title || p.name || '').toLowerCase().trim())
      );
      // Ensure compare data progress always uses timeline progress when available.
      contextObj.compareProjectsData = compareProjectsData
        .filter((item: any) => {
          const title = String(item?.title || '').toLowerCase().trim();
          const id = String(item?.id ?? '');
          return (id && allowedIds.has(id)) || (title && allowedTitles.has(title));
        })
        .map((item: any) => {
        const key = String(item?.title || '').trim().toLowerCase();
        const slug = key.replace(/\s+/g, '-');
        const resolvedProgress = progressByProjectId[key] ?? progressByProjectId[slug] ?? progressByProjectId[String(item?.id ?? '')] ?? item?.progress;
        return resolvedProgress == null ? item : { ...item, progress: resolvedProgress };
      });
    }
    // Backend can use this to override progress when building compare from allProjects fallback
    if (Object.keys(progressByProjectId).length > 0) {
      contextObj.progressByProjectId = progressByProjectId;
    }
    
    // Include current project info if available
    if (currentProjectSnapshot) {
      contextObj.projectName = currentProjectSnapshot.title;
      contextObj.projectId = currentProjectSnapshot.id;
      contextObj.currentProject = currentProjectSnapshot.title;
      contextObj.bidTitle = currentProjectSnapshot.title;
      contextObj.status = currentProjectSnapshot.status;
      contextObj.bidTotal = currentProjectSnapshot.bidPrice || currentProjectSnapshot.estimatedCost || 0;
      contextObj.total = currentProjectSnapshot.bidPrice || currentProjectSnapshot.estimatedCost || 0;
      contextObj.estimatedCost = currentProjectSnapshot.estimatedCost || 0;
      contextObj.actualCost = currentProjectSnapshot.actualCost || currentProjectSnapshot.totalSpent || 0;
      contextObj.contractValue = currentProjectSnapshot.contractValue || currentProjectSnapshot.bidPrice || 0;
      contextObj.adjustedCostBudget = currentProjectSnapshot.adjustedCostBudget;
      contextObj.forecastFinalCost = currentProjectSnapshot.forecastFinalCost;
      contextObj.projectedProfit = currentProjectSnapshot.projectedProfit;
      contextObj.projectedMarginPct = currentProjectSnapshot.projectedMarginPct;
      contextObj.margin = currentProjectSnapshot.margin || 0;
      contextObj.markup = currentProjectSnapshot.markup || 0;
      contextObj.overheadPct = 12; // Default
    }
    
    const projectOptions = mappedProjects.map((p: any) => ({
      id: String(p.id || ''),
      title: String(p.title || p.name || 'Untitled Project'),
      status: String(p.status || ''),
    })).filter((p: any) => p.id);

    return {
      context: JSON.stringify(contextObj),
      projectOptions,
    };
  }, [projects, activeProjects, estimates, compareProjectsData, progressByProjectId, timelineMilestonesByProjectId, dailyLogsByProjectId, calendarEventsByProjectId, projectSnapshotsById, deletedProjectRecords]);

  // Do not allow compare actions until we have loaded for the CURRENT project set.
  // This prevents stale ProjectListContext progress (e.g. old 60%) from being used.
  const totalProjectCount = (projects?.length ?? 0) || ([...activeProjects, ...estimates].length ?? 0);
  const hasComparePayload =
    compareProjectsData.length > 0 || Object.keys(progressByProjectId || {}).length > 0;
  const isCompareContextReady =
    isTimelineLoaded && (totalProjectCount === 0 || hasComparePayload);

  const handleReturnHome = () => {
    // The back arrow is the Central Command home action. Clear the chat
    // in-place so the full-screen modal never flashes black.
    setAssistantResetSignal((signal) => signal + 1);
    setShowAIAssistant(true);
  };

  const handleExitToDashboard = () => {
    setShowAIAssistant(false);
    router.replace('/(tabs)/dashboard');
  };

  return (
    <WebPageShell
      size="assistant"
      scroll={false}
      style={{ backgroundColor: Colors.bg }}
      contentStyle={{ paddingTop: insets.top, paddingBottom: 24 }}
    >
    <View style={[styles.container, { paddingTop: 0, flex: 1, backgroundColor: Colors.bg }]}>
      {!isReady && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      )}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={handleReturnHome}
        onExit={handleExitToDashboard}
        context={context}
        resetSignal={assistantResetSignal}
        projectOptionsOverride={projectOptions}
        isContextReady={isCompareContextReady}
      />
    </View>
    <TabScreenBottomScrollFade />
    </WebPageShell>
  );
}
