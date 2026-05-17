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
import { computeProjectFinancials, sumPlannedCostFromBuckets } from '@/src/lib/projectFinancials';
import {
  computeProfitForecast,
  contractCollectedPctFromMilestones,
  computeElapsedCalendarPct,
} from '@/src/lib/profitForecast';
import {
  applyMarkPaymentCollectedFromAction,
  computeOverallProgressExcludingDeposit,
} from '@/lib/markPaymentCollected';

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
  const { activeProjects, estimates, projects, updateProject } = useProjectList();
  const allProjectsForTimeline = projects?.length > 0 ? projects : [...activeProjects, ...estimates];
  const { compareData: compareProjectsData, progressByProjectId, timelineMilestonesByProjectId, isLoaded: isTimelineLoaded } = useProjectsCompareData(activeProjects, estimates, allProjectsForTimeline);
  const [showAIAssistant, setShowAIAssistant] = useState(false); // Start false to prevent flash
  const [isReady, setIsReady] = useState(false);
  const [dailyLogsByProjectId, setDailyLogsByProjectId] = useState<Record<string, any[]>>({});
  const [calendarEventsByProjectId, setCalendarEventsByProjectId] = useState<Record<string, any[]>>({});
  const [projectSnapshotsById, setProjectSnapshotsById] = useState<Record<string, any>>({});

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

  // Auto-open modal when this tab is focused
  useFocusEffect(
    React.useCallback(() => {
      // Small delay to ensure smooth transition
      setIsReady(true);
      setTimeout(() => {
        setShowAIAssistant(true);
      }, 50);
    }, [])
  );

  // Build context and project options for AI Assistant — use full projects list for chips (includes all statuses)
  const { context, projectOptions } = React.useMemo(() => {
    const allProjectsList = dedupeProjectsForAssistantAi(
      projects?.length > 0 ? projects : [...activeProjects, ...estimates]
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
        isCompleted: String(mergedProject.status || '').toLowerCase() === 'completed',
      });
      const st = String(mergedProject.status || '').toLowerCase();
      const isActive = ['won', 'active', 'in_progress', 'in-progress'].includes(st);
      const isCompleted = st === 'completed';
      return {
      id: mergedProject.id,
      title,
      customerName: mergedProject.client || title,
      status: mergedProject.status,
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
      ['won', 'active', 'in_progress', 'in-progress'].includes((p.status || '').toLowerCase())
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
      aiScope: "portfolio",
      allProjects: mappedProjects,
    };
    if (compareProjectsData.length > 0) {
      // Ensure compare data progress always uses timeline progress when available.
      contextObj.compareProjectsData = compareProjectsData.map((item: any) => {
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
  }, [projects, activeProjects, estimates, compareProjectsData, progressByProjectId, timelineMilestonesByProjectId, dailyLogsByProjectId, calendarEventsByProjectId, projectSnapshotsById]);

  // Do not allow compare actions until we have loaded for the CURRENT project set.
  // This prevents stale ProjectListContext progress (e.g. old 60%) from being used.
  const totalProjectCount = (projects?.length ?? 0) || ([...activeProjects, ...estimates].length ?? 0);
  const hasComparePayload =
    compareProjectsData.length > 0 || Object.keys(progressByProjectId || {}).length > 0;
  const isCompareContextReady =
    isTimelineLoaded && (totalProjectCount === 0 || hasComparePayload);

  const handleClose = () => {
    // Close the modal first, then navigate to dashboard
    console.log('✅ Back button pressed in Assistant tab, navigating to dashboard');
    setShowAIAssistant(false);
    // Use replace to avoid going back to this tab when back is pressed
    setTimeout(() => {
      router.replace('/(tabs)/dashboard');
    }, 150);
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
        onClose={handleClose}
        context={context}
        projectOptionsOverride={projectOptions}
        isContextReady={isCompareContextReady}
        onAction={async (action) => {
          console.log('AI Action from Assistant page:', action);
          
          // Handle project expense actions (when user is in general AI Assistant page)
          if ((action.type === 'add_material' || action.type === 'add_material_purchase') && 
              action.projectId && 
              action.projectName) {
            // Find the project in activeProjects or estimates
            const allProjects = [...activeProjects, ...estimates];
            const project = allProjects.find(p => p.id === action.projectId);
            
            if (project) {
              const existingExpenses = (project.projectData?.expenses || []);
              // Normalize category: if it's a specific material name (Tile, Drywall, etc.), 
              // keep it as-is so it matches Materials/Equipment in CategoryDetailModal
              // The CategoryDetailModal will match specific material names to Materials/Equipment
              const expenseCategory = action.category || 'Materials/Equipment';
              
              const newExpense = {
                id: `exp-${Date.now()}`,
                category: expenseCategory, // Keep specific material names like "Tile", "Drywall", etc.
                vendor: action.vendor || '',
                amount: action.amount || 0,
                date: new Date().toISOString(),
                notes: action.notes || `${action.category || 'Material'} from ${action.vendor || 'vendor'}`,
                receiptUri: null,
              };
              
              const updatedExpenses = [...existingExpenses, newExpense];
              const newSpent = (project.projectData?.spent || 0) + (action.amount || 0);
              
              // CRITICAL: Update budget buckets to match the expense category
              // This ensures the expense shows up in the Materials & Equipment transactions
              const expenseCategoryLower = expenseCategory.toLowerCase();
              const updatedBuckets = (project.projectData?.buckets || []).map((bucket: any) => {
                const bucketName = (bucket.name || '').toLowerCase();
                
                // Exact match
                if (bucketName === expenseCategoryLower) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                // Flexible match for Materials/Equipment
                const isMaterialsBucket = bucketName.includes('materials') || bucketName.includes('equipment');
                const isMaterialCategory = expenseCategoryLower.includes('materials') || 
                                         expenseCategoryLower.includes('equipment') ||
                                         ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                          'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                          'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                          'decking', 'fencing', 'landscaping'].includes(expenseCategoryLower);
                
                if (isMaterialsBucket && isMaterialCategory) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                // Flexible match for Labor
                if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                return bucket;
              });
              
              // Update project using ProjectListContext
              updateProject(action.projectId, {
                projectData: {
                  ...project.projectData,
                  expenses: updatedExpenses,
                  spent: newSpent,
                  buckets: updatedBuckets,
                  lastUpdated: new Date().toISOString(), // Ensure timestamp is updated
                },
              });
              
              // Also save to AsyncStorage directly for immediate sync with ProjectDataContext
              // CRITICAL: Load existing projectData from AsyncStorage first to preserve all fields
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                let existingProjectData = existingDataStr ? JSON.parse(existingDataStr) : {};
                
                // CRITICAL: Use expenses from AsyncStorage (existingProjectData) as the source of truth
                // This ensures deleted expenses don't come back
                const currentExpensesFromStorage = existingProjectData.expenses || [];
                const updatedExpensesFromStorage = [...currentExpensesFromStorage, newExpense];
                const newSpentFromStorage = (existingProjectData.spent || 0) + (action.amount || 0);
                
                // Update buckets based on storage expenses
                const expenseCategoryLower = expenseCategory.toLowerCase();
                const updatedBucketsFromStorage = (existingProjectData.buckets || []).map((bucket: any) => {
                  const bucketName = (bucket.name || '').toLowerCase();
                  
                  // Exact match
                  if (bucketName === expenseCategoryLower) {
                    return {
                      ...bucket,
                      spent: (bucket.spent || 0) + (action.amount || 0),
                    };
                  }
                  
                  // Flexible match for Materials/Equipment
                  const isMaterialsBucket = bucketName.includes('materials') || bucketName.includes('equipment');
                  const isMaterialCategory = expenseCategoryLower.includes('materials') || 
                                           expenseCategoryLower.includes('equipment') ||
                                           ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                            'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                            'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                            'decking', 'fencing', 'landscaping'].includes(expenseCategoryLower);
                  
                  if (isMaterialsBucket && isMaterialCategory) {
                    return {
                      ...bucket,
                      spent: (bucket.spent || 0) + (action.amount || 0),
                    };
                  }
                  
                  // Flexible match for Labor
                  if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                    return {
                      ...bucket,
                      spent: (bucket.spent || 0) + (action.amount || 0),
                    };
                  }
                  
                  return bucket;
                });
                
                // Merge with updated data, ensuring we preserve all existing fields
                // CRITICAL: Use expenses from AsyncStorage (not project.projectData) to avoid restoring deleted items
                const projectDataToSave = {
                  ...existingProjectData, // Preserve all existing fields (buckets, milestones, etc.)
                  expenses: updatedExpensesFromStorage, // Use expenses from storage + new expense
                  spent: newSpentFromStorage, // Use spent from storage + new amount
                  buckets: updatedBucketsFromStorage, // Use updated buckets from storage
                  lastUpdated: new Date().toISOString(),
                };
                
                await AsyncStorage.setItem(storageKey, JSON.stringify(projectDataToSave));
                console.log('✅ Saved expense to AsyncStorage with updated buckets');
                console.log('📊 Expense saved:', {
                  id: newExpense.id,
                  category: newExpense.category,
                  vendor: newExpense.vendor,
                  amount: newExpense.amount,
                });
                console.log('📊 Materials/Equipment bucket spent:', 
                  updatedBuckets.find((b: any) => 
                    (b.name || '').toLowerCase().includes('materials') || 
                    (b.name || '').toLowerCase().includes('equipment')
                  )?.spent || 0
                );
                console.log('📊 Total expenses count:', updatedExpensesFromStorage.length);
                console.log('📊 Total spent:', newSpentFromStorage);
                console.log('📊 All expenses:', updatedExpensesFromStorage.map((e: any) => ({ 
                  id: e.id, 
                  category: e.category, 
                  vendor: e.vendor, 
                  amount: e.amount 
                })));
              } catch (error) {
                console.error('Error saving to AsyncStorage:', error);
              }
              
              console.log('✅ Added expense to project:', action.projectName, action.amount, action.category);
            } else {
              console.warn('⚠️ Project not found:', action.projectId);
            }
          } else if (action.type === 'add_labor_expense' && action.projectId && action.projectName) {
            // Handle labor expenses (align with add_material: buckets + AsyncStorage; backend sends trade/description)
            const allProjects = [...activeProjects, ...estimates];
            const project = allProjects.find(p => p.id === action.projectId);
            
            if (project) {
              const existingExpenses = (project.projectData?.expenses || []);
              const tradeLabel =
                String(action.vendor || action.trade || action.laborType || '').trim() || 'Labor';
              const newExpense = {
                id: `exp-${Date.now()}`,
                category: 'Labor',
                vendor: tradeLabel,
                amount: action.amount || 0,
                date: new Date().toISOString(),
                notes:
                  String(action.notes || action.description || '').trim() ||
                  `${tradeLabel} expense`,
                receiptUri: null,
              };
              
              const updatedExpenses = [...existingExpenses, newExpense];
              const newSpent = (project.projectData?.spent || 0) + (action.amount || 0);
              
              const expenseCategoryLower = 'labor';
              const updatedBuckets = (project.projectData?.buckets || []).map((bucket: any) => {
                const bucketName = (bucket.name || '').toLowerCase();
                if (bucketName === expenseCategoryLower) {
                  return { ...bucket, spent: (bucket.spent || 0) + (action.amount || 0) };
                }
                if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                  return { ...bucket, spent: (bucket.spent || 0) + (action.amount || 0) };
                }
                return bucket;
              });
              
              updateProject(action.projectId, {
                projectData: {
                  ...project.projectData,
                  expenses: updatedExpenses,
                  spent: newSpent,
                  buckets: updatedBuckets,
                  lastUpdated: new Date().toISOString(),
                },
              });
              
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                let existingProjectData = existingDataStr ? JSON.parse(existingDataStr) : {};
                const currentExpensesFromStorage = existingProjectData.expenses || [];
                const updatedExpensesFromStorage = [...currentExpensesFromStorage, newExpense];
                const newSpentFromStorage = (existingProjectData.spent || 0) + (action.amount || 0);
                const updatedBucketsFromStorage = (existingProjectData.buckets || []).map((bucket: any) => {
                  const bucketName = (bucket.name || '').toLowerCase();
                  if (bucketName === expenseCategoryLower) {
                    return { ...bucket, spent: (bucket.spent || 0) + (action.amount || 0) };
                  }
                  if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                    return { ...bucket, spent: (bucket.spent || 0) + (action.amount || 0) };
                  }
                  return bucket;
                });
                await AsyncStorage.setItem(
                  storageKey,
                  JSON.stringify({
                    ...existingProjectData,
                    expenses: updatedExpensesFromStorage,
                    spent: newSpentFromStorage,
                    buckets: updatedBucketsFromStorage,
                    lastUpdated: new Date().toISOString(),
                  })
                );
              } catch (error) {
                console.error('Error saving labor expense to AsyncStorage:', error);
              }
              
              console.log('✅ Added labor expense to project:', action.projectName, action.amount);
            }
          } else if (action.type === 'mark_payment_collected' && action.projectId) {
            try {
              const project = [...activeProjects, ...estimates].find(
                (p) => String(p.id) === String(action.projectId)
              );
              const merged = project
                ? {
                    ...project,
                    ...(project.projectData || {}),
                    estimateData:
                      project.estimateData || project.projectData?.estimateData,
                  }
                : null;

              const { matched, updatedMilestones } =
                await applyMarkPaymentCollectedFromAction(
                  String(action.projectId),
                  {
                    milestoneId: action.milestoneId,
                    milestoneName: action.milestoneName,
                    amount: action.amount,
                    collectedAt: action.collectedAt,
                  },
                  () => merged
                );

              if (matched && updatedMilestones.length > 0) {
                const overallProgress =
                  computeOverallProgressExcludingDeposit(updatedMilestones);
                updateProject(String(action.projectId), {
                  progress: overallProgress,
                  overallProgressPct: overallProgress,
                });
              }

              console.log(
                matched
                  ? '✅ Payment marked as collected (timeline v2 + progress)'
                  : '⚠️ mark_payment_collected: no matching milestone — check name/id'
              );
            } catch (e) {
              console.error('❌ Error marking payment collected:', e);
            }
          } else if (action.type === 'add_daily_log' && action.projectId) {
            // Save daily log to AsyncStorage
            try {
              const logKey = `daily_logs_${action.projectId}`;
              const raw = await AsyncStorage.getItem(logKey);
              const logs = raw ? JSON.parse(raw) : [];
              logs.push({
                id: action.id || `log-${Date.now()}`,
                date: action.date || new Date().toISOString().split('T')[0],
                noteText: action.noteText,
                weather: action.weather || null,
                crewCount: action.crewCount || null,
                hoursWorked: action.hoursWorked || null,
                createdAt: new Date().toISOString(),
              });
              await AsyncStorage.setItem(logKey, JSON.stringify(logs));
              console.log('✅ Daily log saved from assistant page');
            } catch (e) {
              console.error('❌ Error saving daily log:', e);
            }
          } else if (action.type === 'create_change_order' && action.projectId) {
            // Create change order - map backend fields to expected format
            try {
              const co = action.changeOrder || {};
              const project = [...activeProjects, ...estimates].find(p => p.id === action.projectId);
              if (project) {
                // Map backend CO fields to the format expected by the change orders page
                const mat = Number(co.materialsAmount);
                const lab = Number(co.laborAmount);
                const total =
                  Number(co.clientPrice || co.cost || co.amount || 0) ||
                  ((Number.isFinite(mat) ? mat : 0) + (Number.isFinite(lab) ? lab : 0));
                const mappedCO = {
                  id: co.id || `co-${Date.now()}`,
                  title: co.description || co.title || 'Change Order',
                  amount: total,
                  approved: true,
                  notes: co.vendor ? `Vendor: ${co.vendor}` : '',
                  status: 'Approved',
                  materialsAmount: Number.isFinite(mat) ? mat : 0,
                  laborAmount: Number.isFinite(lab) ? lab : 0,
                  date: co.createdAt || new Date().toISOString(),
                };
                const existingCOs = project.projectData?.changeOrders || [];
                const updatedCOs = [...existingCOs, mappedCO];
                const currentBudget = Number(project.projectData?.budgeted || 0);
                updateProject(action.projectId, {
                  projectData: {
                    ...project.projectData,
                    changeOrders: updatedCOs,
                    changeOrderTotal: updatedCOs.reduce((s: number, c: any) => s + Number(c.amount || c.cost || 0), 0),
                    budgeted: currentBudget + mappedCO.amount,
                  },
                });
                console.log('✅ Change order created from assistant page:', mappedCO.title, '$' + mappedCO.amount);
              }
            } catch (e) {
              console.error('❌ Error creating change order:', e);
            }
          } else if (action.type === 'populate_estimate' && action.projectId) {
            // Populate estimate with AI-generated data
            try {
              const est = action.estimate;
              const project = [...activeProjects, ...estimates].find(p => p.id === action.projectId);
              if (project) {
                updateProject(action.projectId, {
                  projectData: {
                    ...project.projectData,
                    estimateData: {
                      ...(project.projectData?.estimateData || {}),
                      materialLineItems: est.materialLineItems || [],
                      laborLineItems: est.laborLineItems || [],
                      overheadItems: est.overheadItems || [],
                      materialTotal: est.materialTotal,
                      laborTotal: est.laborTotal,
                      overheadTotal: est.overheadTotal,
                      totalCost: est.baseCost,
                      markupPct: est.markupPct,
                      markup: est.markup,
                      totalBid: est.totalBid,
                      generatedByAI: true,
                      generatedAt: new Date().toISOString(),
                    },
                  },
                });
                console.log('✅ Estimate populated from assistant page');
              }
            } catch (e) {
              console.error('❌ Error populating estimate:', e);
            }
          }
        }}
      />
    </View>
    </WebPageShell>
  );
}
