import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import {
  ProjectDataProvider,
  useProjectData,
} from '@/contexts/ProjectDataContext';
import { useProjectList, UnifiedProject } from '@/contexts/ProjectListContext';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  StatusBar,
  Dimensions,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  BackHandler,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import { SegmentNavBar, type SegmentNavItem } from '@/components/navigation/SegmentNavBar';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import OverviewScreen from '@/components/OverviewScreen';
import BudgetProfitMixCard from '@/components/BudgetProfitMixCard';
import BudgetTab from '@/components/BudgetTab';
import TimelineTabV2 from '@/components/TimelineTabV2';
import TeamTab from '@/components/TeamTab';
import ProjectCalendar from '@/components/ProjectCalendar';
import MessagesTab from '@/components/MessagesTab';
import {
  computeProfitForecast,
  contractCollectedPctFromMilestones,
  computeElapsedCalendarPct,
} from '@/src/lib/profitForecast';
import {
  computeProjectFinancials,
  sumPlannedCostFromBuckets,
  computeSpendingTrendCostStatus,
} from '@/src/lib/projectFinancials';
import { buildSpendingTrendSamplePoints } from '@/src/lib/projectChartTimeline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import ProjectActivationFlow from '@/components/ProjectActivationFlow';
import { isChangeOrderMirrorExpenseId } from '@/lib/changeOrderMirrorExpenses';
import { setLastOpenedProjectId } from '@/lib/ai/userProjectSettings';
import { useWalkthroughState } from '@/contexts/WalkthroughStateContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import {
  isDesktopWebLayoutWidth,
  DASHBOARD_WEB_MAX_CONTENT_WIDTH,
  WEB_DESKTOP_EDGE_HORIZONTAL,
} from '@/constants/ScreenLayout';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import WebPageShell from '@/components/layout/WebPageShell';
import SubscriptionPlansModal from '@/components/SubscriptionPlansModal';
import { useBusinessEntitlement } from '@/hooks/useBusinessEntitlement';
import { useWorkspaceProjectPermissions } from '@/hooks/useWorkspaceProjectPermissions';
import FinancialAccessLocked from '@/components/FinancialAccessLocked';
import {
  ManagerOperationsSnapshot,
  ProjectRiskCheckCard,
  ProjectHealthOperationalCard,
  FieldProjectOverview,
  MemberProjectStatusCard,
  buildOperationalRiskCards,
} from '@/components/project/WorkspaceProjectViews';
import { useClerkProfileGreeting } from '@/hooks/useProfileGreeting';
import {
  FirstEstimateWalkthroughSheetShell,
  FirstEstimateWalkthroughStepSheetContent,
} from '@/components/FirstEstimateWalkthrough';
import {
  loadActiveProjectWalkthroughProgress,
  saveActiveProjectWalkthroughProgress,
  type ActiveProjectWalkthroughProgress,
} from '@/lib/activeProjectWalkthroughStorage';
import {
  mapApprovedCostBucketsToBudgetLines,
  mapApprovedCostBucketsToProjectBuckets,
} from '@/utils/approvedCostBuckets';
import { isWorkspaceRestrictedFinancialsProject } from '@/utils/workspacePermissions';
import {
  getAllowanceLineItemsTotal,
  isAllowancesCategoryName,
} from '@/utils/estimateAllowances';
import { tabFlowCardStyle } from '@/components/layout/TabFlowCard';
import {
  AI_FLOW_CARD_BG_DARK,
  ESTIMATE_FLOW_NESTED_CARD_BG_DARK,
  ESTIMATE_FLOW_PROGRESS_GRADIENT,
  ESTIMATE_FLOW_TEXT_LABEL_DARK,
  ESTIMATE_FLOW_TEXT_MUTED_DARK,
  ESTIMATE_FLOW_TEXT_SECONDARY_DARK,
} from '@/utils/estimateFlowCardStyle';
import { isTeamWorkspaceReleased } from '@/constants/releaseFlags';
import EstimateVsActualCard from '@/components/EstimateVsActualCard';
import CalibrationReviewModal from '@/components/CalibrationReviewModal';
import { parseOpenRateInsightsParam, parseDashboardReturnTab } from '@/utils/insightNavigation';
import { useProjectEstimateFeedback } from '@/hooks/useProjectEstimateFeedback';
import { DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS } from '@/utils/buildWithAiProductionHardening';

type TabKey = "Overview" | "Budget" | "Timeline" | "Calendar" | "Team";

const toPositiveNumber = (value: any): number | null => {
  if (value == null) return null;
  const numeric =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const firstPositiveNumber = (...values: any[]): number | null => {
  for (const value of values) {
    const numeric = toPositiveNumber(value);
    if (numeric !== null) {
      return numeric;
    }
  }
  return null;
};

const AP_WT_STEPS_BASE: { tab: TabKey; title: string; body: string }[] = [
  {
    tab: 'Overview',
    title: 'Overview',
    body: 'See job health, progress, and quick actions. This is your home base while the project is running.',
  },
  {
    tab: 'Budget',
    title: 'Budget',
    body: 'Track what you planned versus what you are spending—materials, labor, and change orders stay visible here.',
  },
  {
    tab: 'Timeline',
    title: 'Timeline',
    body: 'Manage milestones and payments. Mark work complete and keep cash flow aligned with the job.',
  },
  {
    tab: 'Calendar',
    title: 'Calendar',
    body: 'Schedule site visits, deliveries, and deadlines so the crew and client stay on the same page.',
  },
];

const AP_WT_TEAM_STEP: { tab: TabKey; title: string; body: string } = {
  tab: 'Team',
  title: 'Team',
  body: 'Assign subs and crew roles so everyone knows who is responsible for each part of the job.',
};

function getApWtSteps(): { tab: TabKey; title: string; body: string }[] {
  return isTeamWorkspaceReleased()
    ? [...AP_WT_STEPS_BASE, AP_WT_TEAM_STEP]
    : AP_WT_STEPS_BASE;
}

function getProjectScreenTitleTypography(title: string): {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
} {
  const len = title.trim().length;
  if (len <= 22) {
    return { fontSize: 26, lineHeight: 31, letterSpacing: -0.45 };
  }
  if (len <= 40) {
    return { fontSize: 20, lineHeight: 25, letterSpacing: -0.3 };
  }
  return { fontSize: 17, lineHeight: 22, letterSpacing: -0.15 };
}

// Circular Progress Component
const CircularProgress = ({
  progress,
  size = 60,
  strokeWidth = 6,
  color = '#22C55E',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke='rgba(255,255,255,0.18)'
        strokeWidth={strokeWidth}
        fill='transparent'
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill='transparent'
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap='round'
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

function ProjectDetailContent() {
  const apWtSteps = useMemo(() => getApWtSteps(), []);
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const id = useMemo(() => {
    const raw = params.id;
    return String(Array.isArray(raw) ? raw[0] : raw ?? '');
  }, [params.id]);
  const initialTab = (params.activeTab as TabKey) || 'Overview';
  const openRateInsightsOnEntry = useRef(
    parseOpenRateInsightsParam(params.openRateInsights as string | string[] | undefined)
  );
  const returnToDashboardTabOnEntry = useRef(
    parseDashboardReturnTab(params.returnToDashboardTab as string | string[] | undefined)
  );
  const rateInsightLineIdOnEntry = useRef<string | null>(
    (() => {
      const raw = params.rateInsightLineId;
      const value = Array.isArray(raw) ? raw[0] : raw;
      return value ? String(value) : null;
    })()
  );
  const budgetCategoryParam = useMemo(() => {
    const raw = params.budgetCategory;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value ? String(value) : null;
  }, [params.budgetCategory]);
  const backToProjects = params.backToProjects === '1';
  const apWtRaw = params.apWt;
  const apWtRequest =
    apWtRaw === '1' || (Array.isArray(apWtRaw) && apWtRaw[0] === '1');
  const {
    projectData: rawContextProjectData,
    reloadFromStorage,
    isProjectDataLoaded,
  } = useProjectData();
  const { getProjectById, updateProject } = useProjectList();
  const realProjectData = getProjectById(id);
  const isRestrictedWorkspaceProject = isWorkspaceRestrictedFinancialsProject(realProjectData);
  const approvedCostBucketsForMember = isRestrictedWorkspaceProject
    ? mapApprovedCostBucketsToProjectBuckets((realProjectData as any)?.approvedCostBuckets)
    : [];
  const listProjectSnapshot = useMemo(() => {
    if (!realProjectData || String(realProjectData.id) !== id) return undefined;
    const pd = (realProjectData as { projectData?: Record<string, unknown> }).projectData;
    if (!pd || typeof pd !== 'object') return undefined;
    return { ...pd, id } as typeof rawContextProjectData;
  }, [realProjectData, id]);
  // Prefer hydrated context; fall back to list snapshot (already merged from AsyncStorage in ProjectList).
  const contextProjectData = useMemo(() => {
    if (rawContextProjectData?.id === id && isProjectDataLoaded) {
      return rawContextProjectData;
    }
    if (listProjectSnapshot) return listProjectSnapshot;
    if (rawContextProjectData?.id === id) return rawContextProjectData;
    return undefined;
  }, [rawContextProjectData, id, isProjectDataLoaded, listProjectSnapshot]);
  const projectDetailReady =
    Boolean(id) &&
    Boolean(realProjectData) &&
    String(realProjectData?.id) === id &&
    (isProjectDataLoaded || Boolean(listProjectSnapshot));
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { width: layoutWidth } = useWindowDimensions();
  const tabScrollBottomInset = useTabScrollBottomInset();
  const desktopWeb = isDesktopWebLayoutWidth(layoutWidth);
  const webScrollContentCap =
    Platform.OS === 'web'
      ? undefined
      : desktopWeb
        ? {
            maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
            width: '100%' as const,
            alignSelf: 'center' as const,
          }
        : undefined;
  const styles = useMemo(() => getStyles(Colors, darkMode, desktopWeb), [Colors, darkMode, desktopWeb]);
  const businessEntitlement = useBusinessEntitlement();
  const projectPerms = useWorkspaceProjectPermissions();

  useFocusEffect(
    useCallback(() => {
      void businessEntitlement.refresh();
    }, [businessEntitlement.refresh])
  );

  const {
    hydrated: wtHydrated,
    shouldShowFirstProject,
    markCompleted: markFirstProjectWalkthroughCompleted,
  } = useWalkthroughState();
  
  const profileGreeting = useClerkProfileGreeting();
  
  // Track current date to trigger recalculation when date changes
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  });

  useEffect(() => {
    // Update current date daily
    const updateDate = () => {
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      setCurrentDate(dateKey);
    };

    // Update immediately
    updateDate();

    // Set up interval to check daily (check every hour to catch day changes)
    const interval = setInterval(updateDate, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
  
  // Track when project is opened for last_opened_project_id
  useEffect(() => {
    if (id) {
      setLastOpenedProjectId(id);
    }
  }, [id]);

  // Debug: Log when project data changes
  useEffect(() => {
    console.log(`🔄 Project data updated - overallProgressPct: ${contextProjectData?.overallProgressPct}`);
  }, [contextProjectData?.overallProgressPct]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    const allowedTabs: TabKey[] = [
      'Overview',
      ...(projectPerms.visibleTabs.includes('Budget') ? (['Budget'] as const) : []),
      'Timeline',
      'Calendar',
      ...(projectPerms.visibleTabs.includes('Team') ? (['Team'] as const) : []),
    ];
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs.includes('Budget') ? 'Budget' : allowedTabs[0] ?? 'Timeline');
    }
  }, [activeTab, projectPerms.visibleTabs]);

  const [materialsCart, setMaterialsCart] = useState<any[]>([]);
  const [showCalibrationReview, setShowCalibrationReview] = useState(
    () => openRateInsightsOnEntry.current
  );
  const [calibrationFromInsightLink, setCalibrationFromInsightLink] = useState(
    () => openRateInsightsOnEntry.current
  );
  const handleCloseCalibrationReview = useCallback(() => {
    setShowCalibrationReview(false);

    const openedFromInsight = openRateInsightsOnEntry.current;
    const returnTab =
      returnToDashboardTabOnEntry.current ||
      parseDashboardReturnTab(
        params.returnToDashboardTab as string | string[] | undefined
      );

    if (openedFromInsight) {
      router.replace({
        pathname: '/(tabs)/dashboard',
        params: { tab: returnTab ?? 'insights' },
      } as never);
      return;
    }
  }, [router, params.returnToDashboardTab]);
  const [showTeamUpgradePlans, setShowTeamUpgradePlans] = useState(false);
  const [showActivationFlow, setShowActivationFlow] = useState(false);
  const [activationChecklist, setActivationChecklist] = useState({
    timelineConfirmed: false,
    paymentScheduleReviewed: false,
    teamAssigned: false,
  });
  const [expandedChecklistItem, setExpandedChecklistItem] = useState<string | null>(null);
  const [showActivationCelebration, setShowActivationCelebration] = useState(false);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [justActivatedDismissed, setJustActivatedDismissed] = useState(false);
  const justActivatedOpacity = useRef(new Animated.Value(1)).current;
  const [liveTimelineMilestones, setLiveTimelineMilestones] = useState<any[]>([]);

  const [apWtProgressLoaded, setApWtProgressLoaded] = useState(false);
  const [apWtProgress, setApWtProgress] = useState<ActiveProjectWalkthroughProgress | null>(null);
  const [apWtStepIndex, setApWtStepIndex] = useState(0);

  const apWtComplete = wtHydrated && !shouldShowFirstProject;

  const apWtWalkthroughEligible = useMemo(() => {
    if (!wtHydrated || !apWtProgressLoaded || apWtComplete || !id) return false;
    const p = apWtProgress;
    if (p?.skipTips) return false;
    const tourMatch = p?.tourProjectId === id;
    const startedOnTour = Boolean(p?.started && tourMatch);
    const fromDeepLink =
      Boolean(apWtRequest) && (tourMatch || !p?.tourProjectId);
    return startedOnTour || fromDeepLink;
  }, [wtHydrated, apWtProgressLoaded, apWtComplete, apWtProgress, id, apWtRequest]);

  useEffect(() => {
    if (apWtWalkthroughEligible) return;
    if (params.activeTab && params.activeTab !== activeTab) {
      setActiveTab(params.activeTab as TabKey);
    }
  }, [params.activeTab, apWtWalkthroughEligible, activeTab]);

  useLayoutEffect(() => {
    if (!parseOpenRateInsightsParam(params.openRateInsights as string | string[] | undefined)) {
      return;
    }
    openRateInsightsOnEntry.current = true;
    const returnTab = parseDashboardReturnTab(
      params.returnToDashboardTab as string | string[] | undefined
    );
    if (returnTab) {
      returnToDashboardTabOnEntry.current = returnTab;
    }
    const rawLineId = params.rateInsightLineId;
    const lineId = Array.isArray(rawLineId) ? rawLineId[0] : rawLineId;
    if (lineId) {
      rateInsightLineIdOnEntry.current = String(lineId);
    }
    setCalibrationFromInsightLink(true);
    setActiveTab((current) => (current === 'Budget' ? current : 'Budget'));
    setShowCalibrationReview(true);
    const frame = requestAnimationFrame(() => {
      router.setParams({ openRateInsights: '', rateInsightLineId: '' });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    params.openRateInsights,
    params.returnToDashboardTab,
    params.rateInsightLineId,
    router,
  ]);

  const apWtSheetVisible =
    apWtWalkthroughEligible &&
    apWtStepIndex >= 0 &&
    apWtStepIndex < apWtSteps.length &&
    activeTab === apWtSteps[apWtStepIndex].tab;

  const apWtScrollPadBottom = apWtSheetVisible
    ? Math.round(Dimensions.get('window').height * 0.24) + 28
    : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const accountDone = wtHydrated && !shouldShowFirstProject;
      let p = await loadActiveProjectWalkthroughProgress();
      if (cancelled) return;
      if (!accountDone && apWtRequest && !p && id) {
        p = {
          introResolved: true,
          started: true,
          detailStepIndex: 0,
          tourProjectId: String(id),
        };
        await saveActiveProjectWalkthroughProgress(p);
      }
      if (
        !accountDone &&
        (apWtRequest || p?.started) &&
        p &&
        !p.tourProjectId &&
        id
      ) {
        const next = { ...p, tourProjectId: String(id) };
        await saveActiveProjectWalkthroughProgress(next);
        p = next;
      }
      if (cancelled) return;
      setApWtProgress(p);
      setApWtProgressLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, apWtRequest, wtHydrated, shouldShowFirstProject]);

  useEffect(() => {
    if (!apWtProgressLoaded || apWtComplete || !apWtWalkthroughEligible) return;
    const p = apWtProgress;
    const rawIdx = Number(p?.detailStepIndex);
    const idx = Number.isFinite(rawIdx)
      ? Math.min(apWtSteps.length - 1, Math.max(0, rawIdx))
      : 0;
    setApWtStepIndex(idx);
    setActiveTab(apWtSteps[idx].tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync tab once when walkthrough becomes eligible
  }, [apWtProgressLoaded, apWtComplete, apWtWalkthroughEligible]);

  const stripApWtFromRoute = useCallback(() => {
    try {
      const suffix = backToProjects ? '?backToProjects=1' : '';
      router.replace(`/(tabs)/project-detail/${id}${suffix}` as any);
    } catch {
      /* ignore */
    }
  }, [router, id, backToProjects]);

  const persistApWtProgress = useCallback(
    async (patch: Partial<ActiveProjectWalkthroughProgress>) => {
      const cur = (await loadActiveProjectWalkthroughProgress()) || {};
      const next = { ...cur, ...patch };
      await saveActiveProjectWalkthroughProgress(next);
      setApWtProgress(next);
    },
    []
  );

  const skipActiveProjectWalkthrough = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markFirstProjectWalkthroughCompleted('firstProject');
    stripApWtFromRoute();
  }, [markFirstProjectWalkthroughCompleted, stripApWtFromRoute]);

  const handleApWtGotIt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIdx = apWtStepIndex + 1;
    if (nextIdx >= apWtSteps.length) {
      await markFirstProjectWalkthroughCompleted('firstProject');
      stripApWtFromRoute();
      return;
    }
    setApWtStepIndex(nextIdx);
    setActiveTab(apWtSteps[nextIdx].tab);
    await persistApWtProgress({ detailStepIndex: nextIdx });
  }, [apWtStepIndex, persistApWtProgress, stripApWtFromRoute, markFirstProjectWalkthroughCompleted]);

  useEffect(() => {
    if (!apWtSheetVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      skipActiveProjectWalkthrough();
      return true;
    });
    return () => sub.remove();
  }, [apWtSheetVisible, skipActiveProjectWalkthrough]);

  // Load live timeline milestones from AsyncStorage (this is where TimelineTabV2 saves completed statuses)
  useEffect(() => {
    if (!id) return;
    setLiveTimelineMilestones([]);
    const loadTimeline = async () => {
      try {
        const saved = await AsyncStorage.getItem(`bps.timeline.v2.${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLiveTimelineMilestones(parsed);
          }
        }
      } catch (error) {
        console.error('Error loading live timeline:', error);
      }
    };
    loadTimeline();
  }, [id]);

  // Load activation checklist from AsyncStorage on mount
  useEffect(() => {
    if (!id) return;
    const loadChecklist = async () => {
      try {
        const saved = await AsyncStorage.getItem(`bps.activationChecklist.${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setActivationChecklist(parsed);
        }
      } catch (error) {
        console.error('Error loading activation checklist:', error);
      }
    };
    loadChecklist();
  }, [id]);

  // Save activation checklist to AsyncStorage whenever it changes
  useEffect(() => {
    if (!id) return;
    const saveChecklist = async () => {
      try {
        await AsyncStorage.setItem(`bps.activationChecklist.${id}`, JSON.stringify(activationChecklist));
      } catch (error) {
        console.error('Error saving activation checklist:', error);
      }
    };
    saveChecklist();
  }, [activationChecklist, id]);

  // Disabled celebration overlay to prevent glitching - activation card provides sufficient feedback
  // Check if all checklist items are complete (for reference only)
  useEffect(() => {
    const allComplete = activationChecklist.timelineConfirmed && 
                        activationChecklist.paymentScheduleReviewed && 
                        activationChecklist.teamAssigned;
    
    // Celebration overlay disabled to prevent UI conflicts
    // The activation card already provides visual feedback
    if (allComplete && !showActivationFlow) {
      // Just provide haptic feedback, no overlay
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [activationChecklist, showActivationFlow]);

  const totalSpentFromBuckets = React.useMemo(() => {
    if (contextProjectData?.buckets && contextProjectData.buckets.length > 0) {
      return contextProjectData.buckets.reduce(
        (sum, bucket) => sum + (Number(bucket?.spent) || 0),
        0
      );
    }
    return Number(contextProjectData?.spent) || 0;
  }, [contextProjectData?.buckets, contextProjectData?.spent]);

  const contextBudgeted = contextProjectData?.budgeted;
  const contextBidPrice = (contextProjectData as any)?.bidPrice;

  const progressFromContext = React.useMemo(() => {
    const values = [
      contextProjectData?.overallProgressPct,
      (contextProjectData as any)?.progress,
      (contextProjectData as any)?.projectProgress,
    ];
    const numeric = values
      .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : null))
      .filter((value) => value != null) as number[];
    if (numeric.length === 0) return null;
    return Math.max(...numeric);
  }, [
    contextProjectData?.overallProgressPct,
    (contextProjectData as any)?.progress,
    (contextProjectData as any)?.projectProgress,
  ]);
  
  // Load materials from AsyncStorage whenever the screen gains focus
  const loadMaterialsFromStorage = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('bps.materialsCart');
      if (saved) {
        const materials = JSON.parse(saved);
        setMaterialsCart(materials);
        console.log(`📦 Loaded ${materials.length} materials from AsyncStorage`);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadOnFocus = async () => {
        if (!isActive) return;
        await loadMaterialsFromStorage();
        if (reloadFromStorage) {
          await reloadFromStorage();
        }
      };
      loadOnFocus();
      return () => {
        isActive = false;
      };
    }, [loadMaterialsFromStorage, reloadFromStorage])
  );

  // Recalculate budget total and cost (subtotal) from estimate data
  const { recalculatedBudget, recalculatedSubtotal } = realProjectData?.estimateData ? (() => {
    const materials = materialsCart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const labor = (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    const planCost = Number(realProjectData.estimateData.planCost) || 0;
    const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
    const equipmentRental = Number(realProjectData.estimateData.equipment) || 0;
    const otherDirectCost = Number(realProjectData.estimateData.otherDirectCost) || 0;
    const subtotal = materials + labor + planCost + permitCost + equipmentRental + otherDirectCost;
    const markupPct = Number(realProjectData.estimateData.markupPct) || 0;
    const markup = subtotal * (markupPct / 100);
    return {
      recalculatedBudget: Math.round(subtotal + markup),
      recalculatedSubtotal: Math.round(subtotal),
    };
  })() : { recalculatedBudget: null as number | null, recalculatedSubtotal: null as number | null };

  const resolvedBidPrice = React.useMemo(
    () =>
      firstPositiveNumber(
        realProjectData?.bidPrice,
        realProjectData?.estimateData?.bidPrice,
        realProjectData?.estimateData?.grandTotal,
        realProjectData?.estimateData?.total,
        contextBudgeted,
        contextBidPrice,
        realProjectData?.estimatedCost
      ),
    [
      realProjectData?.bidPrice,
      realProjectData?.estimateData?.bidPrice,
      realProjectData?.estimateData?.grandTotal,
      realProjectData?.estimateData?.total,
      contextBudgeted,
      contextBidPrice,
      realProjectData?.estimatedCost,
    ]
  );

  const projectForCoRevenue = React.useMemo(
    () => ({
      ...(contextProjectData as any),
      ...(realProjectData as any),
      estimateData:
        (realProjectData as any)?.estimateData || (contextProjectData as any)?.estimateData,
      changeOrders:
        (realProjectData as any)?.changeOrders ||
        (realProjectData as any)?.projectData?.changeOrders ||
        (contextProjectData as any)?.changeOrders ||
        (contextProjectData as any)?.projectData?.changeOrders,
    }),
    [realProjectData, contextProjectData]
  );

  const approvedChangeOrdersTotal = React.useMemo(
    () => computeProjectFinancials(projectForCoRevenue, {}).approvedChangeOrderRevenue,
    [projectForCoRevenue]
  );

  const budgetedValue = React.useMemo(() => {
    let base = 0;
    if (resolvedBidPrice !== null) base = resolvedBidPrice;
    else if (recalculatedBudget !== null) base = recalculatedBudget;
    else {
      const estimatedCost = toPositiveNumber(realProjectData?.estimatedCost);
      base = estimatedCost ?? 0;
    }
    // Add approved change orders to match Overview screen
    return base + approvedChangeOrdersTotal;
  }, [resolvedBidPrice, recalculatedBudget, realProjectData?.estimatedCost, approvedChangeOrdersTotal]);

  // Sync recalculated budget back to ProjectListContext only when missing
  // CRITICAL: estimatedCost = subtotal (cost before markup), NOT bid price. Otherwise margin = 0.
  useEffect(() => {
    if (recalculatedBudget === null || !realProjectData || !id) {
      return;
    }

    const updates: Partial<UnifiedProject> = {};
    const currentBidPrice = toPositiveNumber(realProjectData.bidPrice);
    const currentEstimatedCost = toPositiveNumber(realProjectData.estimatedCost);

    if (currentBidPrice === null && recalculatedBudget > 0) {
      updates.bidPrice = recalculatedBudget;
    }

    // Use subtotal (cost before markup) for estimatedCost so margin = (bid - cost) / bid works
    const costToUse = recalculatedSubtotal ?? recalculatedBudget;
    const bid = updates.bidPrice ?? currentBidPrice ?? recalculatedBudget;
    // Fix: when estimatedCost equals bidPrice (wrong - was set by old sync), or is missing, use subtotal
    const costEqualsBid = currentEstimatedCost != null && bid != null && Math.abs(currentEstimatedCost - bid) < 1;
    if ((currentEstimatedCost === null || costEqualsBid) && costToUse > 0) {
      updates.estimatedCost = recalculatedSubtotal ?? costToUse;
    }
    const cost = updates.estimatedCost ?? currentEstimatedCost ?? costToUse;
    // Recalculate margin when we have both bid and cost (fixes 0% when estimatedCost was wrongly set to bidPrice)
    if (bid > 0 && cost > 0 && cost < bid) {
      const marginPct = Math.round(((bid - cost) / bid) * 100);
      const currentMargin = Number(realProjectData.margin) || 0;
      if (marginPct > 0 && marginPct !== currentMargin) {
        updates.margin = marginPct;
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log('💰 Syncing missing budget fields with recalculated value:', updates);
      updateProject(id as string, updates);
    }
  }, [
    recalculatedBudget,
    recalculatedSubtotal,
    realProjectData?.bidPrice,
    realProjectData?.estimatedCost,
    realProjectData?.margin,
    id,
    updateProject,
  ]);
  
  // Sync actual spend and progress back to ProjectListContext for accurate margins
  useEffect(() => {
    if (!realProjectData?.id) return;

    const updates: Partial<UnifiedProject> = {};
    const existingActualCost = Number(realProjectData.actualCost) || 0;
    const spentValue = Number(totalSpentFromBuckets) || 0;

    if (Math.abs(spentValue - existingActualCost) > 0.01) {
      updates.actualCost = spentValue;
    }

    const existingProgress = Number(realProjectData.progress) || 0;
    const contextProgress = progressFromContext != null ? Math.round(progressFromContext) : null;
    if (contextProgress != null && contextProgress > existingProgress) {
      updates.progress = contextProgress;
    }

    if (Object.keys(updates).length > 0) {
      console.log('🔁 Syncing project updates from ProjectDetailContent:', updates);
      updateProject(realProjectData.id, updates);
    }
  }, [
    realProjectData?.id,
    realProjectData?.actualCost,
    realProjectData?.progress,
    totalSpentFromBuckets,
    progressFromContext,
    updateProject,
  ]);
  
  // Use real project data if available, otherwise fall back to context data
  const projectData = realProjectData ? {
    ...contextProjectData,
    // Override with real data - ensure all values are properly formatted
    id: String(realProjectData.id || 'unknown'),
    title: String(realProjectData.title || 'Untitled Project'),
    location: String(realProjectData.location || 'Unknown Location'),
    // budgeted set later after recalculation
    estimatedCost: Number(realProjectData.estimatedCost) || budgetedValue,
    actualCost: Number(realProjectData.actualCost) || 0,
    margin: Number(realProjectData.margin) || 0,
    markup: Number(realProjectData.markup) || 0,
    startDate: realProjectData.startDate || new Date().toISOString().split('T')[0],
    endDate: realProjectData.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    progress: Number(realProjectData.progress) || 0,
    client: String(realProjectData.client || 'Unknown Client'),
    clientEmail: String(realProjectData.clientEmail || ''),
    clientPhone: String(realProjectData.clientPhone || ''),
    status: String(realProjectData.status || 'In Progress'),
    // Managers never receive owner estimate payloads — use approved cost buckets only.
    estimateData: isRestrictedWorkspaceProject ? null : realProjectData.estimateData || null,
    budgeted: isRestrictedWorkspaceProject
      ? Number((realProjectData as any)?.approvedCostBudget ?? contextProjectData?.budgeted ?? 0)
      : firstPositiveNumber(
          (realProjectData as any)?.estimateData?.grandTotal,
          (realProjectData as any)?.estimateData?.total,
          (realProjectData as any)?.bidPrice,
          (realProjectData as any)?.estimatedCost,
        ),
    spent: Number(realProjectData.actualCost) || contextProjectData?.spent || 0,
    overallProgressPct: Number(realProjectData.progress) || 0,
    startISO: realProjectData.estimateData?.projectStartDate || realProjectData.startDate || new Date().toISOString().split('T')[0],
    endISO: realProjectData.estimateData?.projectEndDate || realProjectData.estimateData?.endDate || realProjectData.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lastUpdated: realProjectData.updatedAt || new Date().toISOString().split('T')[0],
    crewCount: 1,
    // omit priority/risk not in type
    buckets:
      isRestrictedWorkspaceProject && approvedCostBucketsForMember.length > 0
        ? approvedCostBucketsForMember
        : realProjectData.estimateData
          ? [
      { 
        id: '1', 
        name: 'Labor', 
        spent: contextProjectData?.buckets?.find(b => b.name === 'Labor')?.spent || 0, 
        budget: (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0),
        bidBudget: (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
      },
      { 
        id: '2', 
        name: 'Materials/Equipment', 
        spent: contextProjectData?.buckets?.find(b => b.name === 'Materials')?.spent || 0, 
        budget: materialsCart.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0),
        bidBudget: materialsCart.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
      },
      { 
        id: '3', 
        name: 'Overhead', 
        spent: contextProjectData?.buckets?.find(b => b.name === 'Overhead')?.spent || 0, 
        budget: (Number(realProjectData.estimateData.equipment) || 0) + 
                (Number(realProjectData.estimateData.facilities) || 0) + 
                (Number(realProjectData.estimateData.insuranceOverhead) || 0) + 
                (Number(realProjectData.estimateData.otherOverhead) || 0) + 
                (Number(realProjectData.estimateData.permitCost) || 0), 
        bidBudget: (Number(realProjectData.estimateData.equipment) || 0) + 
                   (Number(realProjectData.estimateData.facilities) || 0) + 
                   (Number(realProjectData.estimateData.insuranceOverhead) || 0) + 
                   (Number(realProjectData.estimateData.otherOverhead) || 0) + 
                   (Number(realProjectData.estimateData.permitCost) || 0)
      },
      { 
        id: '4', 
        name: 'Markup', 
        spent: contextProjectData?.buckets?.find(b => b.name === 'Markup')?.spent || 0, 
        budget: (() => {
          const materials = materialsCart.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
          const labor = (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
          const planCost = Number(realProjectData.estimateData.planCost) || 0;
          const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
          const equipmentRental = Number(realProjectData.estimateData.equipment) || 0;
          const otherDirectCost = Number(realProjectData.estimateData.otherDirectCost) || 0;
          const subtotal = materials + labor + planCost + permitCost + equipmentRental + otherDirectCost;
          const markupPct = Number(realProjectData.estimateData.markupPct) || 0;
          return Math.round(subtotal * (markupPct / 100));
        })(), 
        bidBudget: (() => {
          const materials = materialsCart.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
          const labor = (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
          const planCost = Number(realProjectData.estimateData.planCost) || 0;
          const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
          const equipmentRental = Number(realProjectData.estimateData.equipment) || 0;
          const otherDirectCost = Number(realProjectData.estimateData.otherDirectCost) || 0;
          const subtotal = materials + labor + planCost + permitCost + equipmentRental + otherDirectCost;
          const markupPct = Number(realProjectData.estimateData.markupPct) || 0;
          return Math.round(subtotal * (markupPct / 100));
        })()
      },
    ] : contextProjectData?.buckets || [
      { id: '1', name: 'Labor', spent: 0, budget: 0, bidBudget: 0 },
      { id: '2', name: 'Materials', spent: 0, budget: 0, bidBudget: 0 },
      { id: '3', name: 'Subs', spent: 0, budget: 0, bidBudget: 0 },
      { id: '4', name: 'Misc', spent: 0, budget: 0, bidBudget: 0 },
    ],
    milestones: (() => {
      const ed = realProjectData.estimateData || {};
      const scheduleType = (realProjectData as any)?.paymentSchedule ?? ed?.paymentSchedule ?? 'milestone-based';
      const paymentMs = ed?.paymentMilestones || [];
      const weekly = ed?.weeklyPayments || [];
      const hasBoth = paymentMs.length > 0 && weekly.length > 0;
      const isHybrid = scheduleType === 'hybrid' || hasBoth;

      // For hybrid: combine deposit + week 1, week 2, etc. For non-hybrid: use paymentMilestones only
      const startDateOnly = (ed?.projectStartDate ?? (realProjectData as any)?.startDate ?? '')?.toString().match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
      const addDays = (dateStr: string, days: number): string => {
        if (!dateStr) return '';
        try {
          const d = new Date(dateStr + 'T12:00:00');
          d.setDate(d.getDate() + days);
          return d.toISOString().split('T')[0];
        } catch { return dateStr; }
      };
      const normalizeDateOnly = (raw: any): string => {
        const m = String(raw || '').match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : '';
      };
      const milestoneDeposit = paymentMs.find((m: any) =>
        (m.type || '').toString().toLowerCase() === 'deposit' ||
        /deposit/.test((m.name || m.title || '').toString().toLowerCase())
      );
      const weeklyDeposit = weekly.find((w: any) =>
        Number(w.weekNumber) === 0 || /deposit/.test((w.description || '').toString().toLowerCase())
      );
      const inferredDepositDate =
        normalizeDateOnly(milestoneDeposit?.scheduledDate || milestoneDeposit?.dueDate) ||
        normalizeDateOnly(weeklyDeposit?.scheduledDate || weeklyDeposit?.dueDate) ||
        (startDateOnly ? addDays(startDateOnly, 7) : '');
      const fromPayment = paymentMs.map((m: any, i: number) => {
        let raw = m.scheduledDate || m.dueDate;
        const isDeposit = (m.type || '').toString().toLowerCase() === 'deposit' || /deposit/.test((m.name || m.title || '').toString().toLowerCase());
        if (!raw && isDeposit) raw = inferredDepositDate;
        if (!raw) raw = new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Never use project start date as the deposit date — deposit is due after start (e.g. start 3/21, deposit 3/28)
        if (isDeposit && startDateOnly) {
          const rawNorm = raw ? raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '' : '';
          if (!rawNorm || rawNorm === startDateOnly) raw = inferredDepositDate || addDays(startDateOnly, 7);
        }
        return {
          id: m.id || `payment-${i}`,
          title: m.name || m.title || `Payment ${i + 1}`,
          description: m.description || m.workDescription || '',
          dueDate: raw,
          status: typeof m.status === 'string' ? m.status : 'pending',
          amount: Number(m.paymentAmount ?? m.amount) || 0,
          percentage: Number(m.percentage) || 0,
        };
      });
      const fromWeekly = isHybrid && weekly.length > 0
        ? weekly.map((w: any, i: number) => {
            const weekNo = Number(w.weekNumber ?? i + 1);
            const inferredWeekDate =
              weekNo === 0
                ? inferredDepositDate
                : (inferredDepositDate ? addDays(inferredDepositDate, weekNo * 7) : '');
            return {
              id: w.id || `week-${i}`,
              title: w.description || `Week ${w.weekNumber ?? i + 1} Payment`,
              description: w.description || '',
              dueDate:
                w.scheduledDate ||
                w.dueDate ||
                inferredWeekDate ||
                new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: typeof w.status === 'string' ? w.status : 'pending',
              amount: Number(w.amount) || 0,
              percentage: Number(w.percentage) || 0,
            };
          })
        : [];

      const weeklyScheduleMilestones = weekly.length > 0
        ? (() => {
            const normalizeDateOnly = (raw: any): string => {
              const m = String(raw || '').match(/^\d{4}-\d{2}-\d{2}/);
              return m ? m[0] : '';
            };
            const milestoneDeposit = paymentMs.find((m: any) =>
              (m.type || '').toString().toLowerCase() === 'deposit' ||
              /deposit/.test((m.name || m.title || '').toString().toLowerCase())
            );
            const inferredDepositDate =
              normalizeDateOnly(milestoneDeposit?.scheduledDate || milestoneDeposit?.dueDate) ||
              (startDateOnly ? addDays(startDateOnly, 7) : '');

            return weekly.map((w: any, i: number) => {
              const weekNo = Number(w.weekNumber ?? i + 1);
              const fallbackDate = weekNo === 0
                ? inferredDepositDate
                : (inferredDepositDate ? addDays(inferredDepositDate, weekNo * 7) : '');
              return {
                id: w.id || `week-${i}`,
                title: w.description || `Week ${w.weekNumber ?? i + 1} Payment`,
                description: w.description || '',
                dueDate: w.scheduledDate || w.dueDate || fallbackDate || new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: typeof w.status === 'string' ? w.status : 'pending',
                amount: Number(w.amount) || 0,
                percentage: Number(w.percentage) || 0,
              };
            });
          })()
        : [];

      // Root fix: weekly schedule must use weeklyPayments dates as source of truth.
      // Stale paymentMilestones can carry start-date-based deposit and cause mismatch.
      const baseMilestones = scheduleType === 'weekly'
        ? weeklyScheduleMilestones
        : (isHybrid && fromWeekly.length > 0
          ? [...fromPayment, ...fromWeekly].sort((a, b) =>
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            )
          : fromPayment);

      // CRITICAL: Merge live timeline data (from bps.timeline.v2.<id>) which has completed statuses.
      // Without this, all milestones are hardcoded as 'pending' and the AI never sees completions.
      if (liveTimelineMilestones.length > 0) {
        return baseMilestones.map((base: any) => {
          const liveMatch = liveTimelineMilestones.find((live: any) =>
            live.id === base.id ||
            (live.title || '').toLowerCase() === (base.title || '').toLowerCase()
          );
          if (liveMatch) {
            return {
              ...base,
              status: liveMatch.status || base.status,
              progressPct: liveMatch.progressPct ?? base.progressPct ?? 0,
              completedAt: liveMatch.completedAt,
            };
          }
          return base;
        });
      }
      return baseMilestones;
    })(),
    team: { pmAssigned: false },
    expenses: contextProjectData?.expenses || [],
    changeOrders: contextProjectData?.changeOrders || [],
    purchaseOrders: contextProjectData?.purchaseOrders || [],
    committedPOs: contextProjectData?.committedPOs || 0,
    currency: 'USD',
    health: {
      costEfficiency: String((realProjectData as any)?.health?.costEfficiency || 'Good'),
      scheduleEfficiency: String((realProjectData as any)?.health?.scheduleEfficiency || 'Good'),
      projectStatus: String((realProjectData as any)?.health?.projectStatus || 'On Track'),
    },
  } : contextProjectData;

  // Convert project data to BudgetData format for BudgetTab
  const convertToBudgetData = (project: any) => {
    console.log('🔍 Converting project to budget data:', project);

    const sharedListFields = () => ({
      expenses: contextProjectData?.expenses || [],
      changeOrders: contextProjectData?.changeOrders || [],
      committedPOs: contextProjectData?.committedPOs || 0,
    });

    /** Real receipts/invoices only — CO cost is already reflected in BudgetTab via approved allocations + mirror rows. */
    const ctxExpensesNoCoMirrors = (contextProjectData?.expenses || []).filter(
      (e: any) => !isChangeOrderMirrorExpenseId(e?.id)
    );

    // Prefer live buckets on the merged project, then context (Orders/POs still work when estimate payload is missing)
    const getBucketList = () => {
      const fromProject = Array.isArray(project?.buckets) ? project.buckets : [];
      if (fromProject.length > 0) return fromProject;
      return contextProjectData?.buckets || [];
    };

    const findBucket = (...keywords: string[]) => {
      const buckets = getBucketList();
      const match = buckets.find((b: any) => {
        const name = (b?.name || '').toLowerCase();
        return keywords.some((kw) => name.includes(kw));
      });
      return match || null;
    };

    const getBucketSpend = (...keywords: string[]) => {
      const bucket = findBucket(...keywords);
      return bucket ? Number(bucket?.spent) || 0 : 0;
    };

    const getBucketBudget = (...keywords: string[]) => {
      const bucket = findBucket(...keywords);
      if (!bucket) return 0;
      const candidates = [
        bucket?.budget,
        bucket?.bidBudget,
      ];
      for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value > 0) {
          return value;
        }
      }
      return 0;
    };

    /** When estimateData is missing or produced no lines — keep Materials/Labor/Allowances cards from bucket + spend */
    const appendBucketFallbackLines = (targetLines: any[]) => {
      const hasMat = targetLines.some((l) => String(l?.category || '').toLowerCase().includes('material'));
      const hasLab = targetLines.some((l) => String(l?.category || '').toLowerCase() === 'labor');
      const hasAllow = targetLines.some((l) => isAllowancesCategoryName(l?.category));
      const matB = findBucket('material', 'equip');
      const matBudget = getBucketBudget('material', 'equip');
      const matSpent = getBucketSpend('materials', 'equip');
      if (!hasMat && (matBudget > 0 || matSpent > 0 || Boolean(matB))) {
        const unitCost = Math.max(matBudget, matSpent);
        targetLines.push({
          id: 'materials',
          category: 'Materials/Equipment',
          description: 'Materials & Equipment',
          qty: 1,
          unit: 'lump sum',
          unitCost,
          markupPct: 0,
          spent: matSpent,
          aiSuggested: false,
        });
      }
      const labB = findBucket('labor');
      const labBudget = getBucketBudget('labor');
      const labSpent = getBucketSpend('labor');
      const labExpCtx = ctxExpensesNoCoMirrors.reduce((sum: number, e: any) => {
        const c = String(e?.category || '').trim().toLowerCase();
        if (c.includes('labor') || c.includes('labour')) return sum + (Number(e?.amount) || 0);
        return sum;
      }, 0);
      if (!hasLab && (labBudget > 0 || labSpent > 0 || Boolean(labB) || labExpCtx > 0)) {
        const unitCost = Math.max(labBudget, labSpent, labExpCtx);
        targetLines.push({
          id: 'labor',
          category: 'Labor',
          description: 'Labor & Installation',
          qty: 1,
          unit: 'lump sum',
          unitCost,
          markupPct: 0,
          spent: labSpent,
          aiSuggested: false,
        });
      }
      const allowBudget = getBucketBudget('allowance');
      const allowSpent = getBucketSpend('allowance');
      const allowExpCtx = ctxExpensesNoCoMirrors.reduce((sum: number, e: any) => {
        if (isAllowancesCategoryName(e?.category)) return sum + (Number(e?.amount) || 0);
        return sum;
      }, 0);
      if (!hasAllow && (allowBudget > 0 || allowSpent > 0 || allowExpCtx > 0)) {
        const unitCost = Math.max(allowBudget, allowSpent, allowExpCtx);
        targetLines.push({
          id: 'allowances',
          category: 'Allowances',
          description: 'Soft-cost allowances',
          qty: 1,
          unit: 'lump sum',
          unitCost,
          markupPct: 0,
          spent: allowSpent,
          aiSuggested: false,
        });
      }
    };

    if (!project?.estimateData) {
      console.log('⚠️ No estimate data — building budget category lines from buckets / spend');
      const lines: any[] = mapApprovedCostBucketsToBudgetLines(
        (realProjectData as any)?.approvedCostBuckets
      );
      if (lines.length === 0) {
        appendBucketFallbackLines(lines);
      }
      return {
        projectId: project?.id || id as string,
        currency: 'USD',
        lines,
        ...sharedListFields(),
      };
    }

    const estimate = project.estimateData;
    const lines = [];

    console.log('📊 Estimate data:', estimate);
    console.log('📦 Materials cart:', materialsCart);

    const sumLineItems = (items: any[] = []) =>
      items.reduce((sum, item) => {
        const candidates = [
          item?.total,
          item?.amount,
          item?.cost,
          item?.price,
          item?.budget,
        ];
        const directValue =
          candidates
            .map((candidate) => Number(candidate) || 0)
            .find((candidate) => candidate > 0) || 0;
        if (directValue > 0) {
          return sum + directValue;
        }

        const qty = safeNumber(item?.qty ?? item?.quantity);
        const unit = safeNumber(
          item?.unitCost ?? item?.unitPrice ?? item?.pricePerUnit ?? item?.rate
        );
        const calculated = qty * unit;
        return sum + (calculated > 0 ? calculated : 0);
      }, 0);

    const safeNumber = (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const materialLineItems = Array.isArray(estimate.materialLineItems) && estimate.materialLineItems.length > 0
      ? estimate.materialLineItems
      : Array.isArray(estimate.materials) && estimate.materials.length > 0
        ? estimate.materials
        : Array.isArray((estimate as any)?.materialsCart) && (estimate as any)?.materialsCart.length > 0
          ? (estimate as any).materialsCart
          : [];

    const materialsFromCart = Array.isArray(materialsCart)
      ? materialsCart.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
      : 0;

    const materialsFromLineItems = sumLineItems(materialLineItems);

    const materialFallbackFields = [
      'materialsTotal',
      'materialsCost',
      'materialsBudget',
      'materialsBid',
      'materials',
      'materialsSubtotal',
    ];

    const materialsFromFields = materialFallbackFields.reduce((best, field) => {
      const value = safeNumber((estimate as any)?.[field]);
      return value > 0 ? Math.max(best, value) : best;
    }, 0);

    const bucketMaterialsBudget = getBucketBudget('material', 'equip');
    const rawMaterialsTotal = firstPositiveNumber(
      materialsFromCart,
      materialsFromLineItems,
      materialsFromFields,
      bucketMaterialsBudget
    ) ?? 0;
    const materialsSpentFromInvoices = ctxExpensesNoCoMirrors.reduce((sum: number, e: any) => {
      const c = String(e?.category || '').trim().toLowerCase();
      if (c.includes('materials') || c.includes('equipment')) return sum + (Number(e?.amount) || 0);
      return sum;
    }, 0);
    const materialsBucket = findBucket('material', 'equip');
    const materialsSpent = getBucketSpend('materials', 'equip');
    const shouldIncludeMaterials =
      rawMaterialsTotal > 0 ||
      materialsSpent > 0 ||
      materialLineItems.length > 0 ||
      (materialsCart && materialsCart.length > 0) ||
      Boolean(materialsBucket);
    const materialsBudget = shouldIncludeMaterials
      ? rawMaterialsTotal > 0
        ? rawMaterialsTotal
        : Math.max(materialsSpentFromInvoices, bucketMaterialsBudget, 0)
      : 0;

    // Calculate total budget (base + change orders) for capping materials budget
    const baseBudget = estimate?.totalBid || estimate?.grandTotal || estimate?.total || project?.bidPrice || project?.budgeted || 0;
    const changeOrders = project?.changeOrders || [];
    const approvedCOs = changeOrders.reduce((sum: number, co: any) => {
      const amount = Number(co.amount || 0);
      const isApproved = (typeof co.approved === 'boolean' && co.approved) ||
                         (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    }, 0);
    const totalBudgetCap = baseBudget + approvedCOs;

    // Add one Materials/Equipment card with total derived from estimate sources
    // CRITICAL: Use materialsCart first (current state), then fall back to estimate.materialLineItems
    // This ensures we use the same source as the Overview tab
    if (shouldIncludeMaterials) {
      // PREFER materialsCart (same as Overview tab), then estimate.materialLineItems, then calculated budget
      let finalMaterialsBudget = materialsFromCart > 0 
        ? materialsFromCart 
        : (materialsFromLineItems > 0 
          ? materialsFromLineItems 
          : materialsBudget);
      
      // SAFETY: Cap materials budget at total budget to prevent materials exceeding total
      // This handles cases where materialsCart has stale data from a previous estimate
      if (totalBudgetCap > 0 && finalMaterialsBudget > totalBudgetCap) {
        console.warn(`⚠️ Materials budget ($${finalMaterialsBudget}) exceeds total budget ($${totalBudgetCap}). Capping to total budget.`);
        finalMaterialsBudget = totalBudgetCap;
      }
      
      lines.push({
        id: 'materials',
        category: 'Materials/Equipment',
        description: 'Materials & Equipment',
        qty: 1,
        unit: 'lump sum',
        unitCost: finalMaterialsBudget, // Use materialsCart total (matches Overview tab), capped at total budget
        markupPct: 0, // No markup for spending tracking
        spent: materialsSpent,
        aiSuggested: false,
      });
      
      console.log(`📊 Materials budget: materialsCart=$${materialsFromCart}, materialLineItems=$${materialsFromLineItems}, final=$${finalMaterialsBudget}, totalBudgetCap=$${totalBudgetCap}`);
    }

    // Add one Labor card - PREFER estimate.laborLineItems (same as Overview tab), then bucket budget
    const laborBucket = findBucket('labor');
    const laborBucketBudget = getBucketBudget('labor');
    const laborSpent = getBucketSpend('labor');
    const laborExpensesFromContext = ctxExpensesNoCoMirrors.reduce((sum: number, e: any) => {
      const c = String(e?.category || '').trim().toLowerCase();
      if (c.includes('labor') || c.includes('labour')) return sum + (Number(e?.amount) || 0);
      return sum;
    }, 0);
    
    // Calculate from estimate (same source as Overview tab)
    const laborFromEstimate = estimate.laborLineItems && estimate.laborLineItems.length > 0
      ? estimate.laborLineItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
      : 0;
    
    // PREFER estimate.laborLineItems (matches Overview tab), then bucket budget
    const laborBudget = laborFromEstimate > 0 ? laborFromEstimate : (laborBucketBudget > 0 ? laborBucketBudget : 0);
    
    if (laborBudget > 0 || laborSpent > 0 || Boolean(laborBucket) || laborExpensesFromContext > 0) {
      const laborLineBudget = Math.max(laborBudget, laborExpensesFromContext);
      lines.push({
        id: 'labor',
        category: 'Labor',
        description: 'Labor & Installation',
        qty: 1,
        unit: 'lump sum',
        unitCost: laborLineBudget, // Planned labor from estimate, or at least recorded spend so the row scales
        markupPct: 0, // No markup for spending tracking
        spent: laborSpent,
        aiSuggested: false,
      });
      
      console.log(`📊 Labor budget: estimate=$${laborFromEstimate}, bucket=$${laborBucketBudget}, final=$${laborBudget}`);
    }

    // Allowances card — soft costs from bid.allowanceLineItems (under Labor)
    const allowancesBucketBudget = getBucketBudget('allowance');
    const allowancesSpent = getBucketSpend('allowance');
    const allowancesFromEstimate = getAllowanceLineItemsTotal(estimate.allowanceLineItems);
    const allowancesExpensesFromContext = ctxExpensesNoCoMirrors.reduce((sum: number, e: any) => {
      if (isAllowancesCategoryName(e?.category)) return sum + (Number(e?.amount) || 0);
      return sum;
    }, 0);
    const allowancesBudget =
      allowancesFromEstimate > 0
        ? allowancesFromEstimate
        : allowancesBucketBudget > 0
          ? allowancesBucketBudget
          : 0;

    if (allowancesBudget > 0 || allowancesSpent > 0 || allowancesExpensesFromContext > 0) {
      lines.push({
        id: 'allowances',
        category: 'Allowances',
        description: 'Soft-cost allowances',
        qty: 1,
        unit: 'lump sum',
        unitCost: Math.max(allowancesBudget, allowancesExpensesFromContext),
        markupPct: 0,
        spent: allowancesSpent,
        aiSuggested: false,
      });
    }

    // Note: Overhead and Markup cards removed from BudgetTab as requested
    // These categories are still included in the OverviewScreen for complete budget visibility

    if (lines.length === 0) {
      console.log('⚠️ Estimate path produced no category lines — applying bucket fallback');
      appendBucketFallbackLines(lines);
    }

    const budgetData = {
      projectId: project?.id || id as string,
      currency: 'USD',
      lines,
      expenses: contextProjectData?.expenses || [],
      changeOrders: contextProjectData?.changeOrders || [],
      committedPOs: contextProjectData?.committedPOs || 0,
    };

    console.log('✅ Converted budget data:', budgetData);
    return budgetData;
  };

  // CRITICAL: Calculate original budget WITHOUT change orders for BudgetTab
  // budgetedValue includes change orders, but plannedBudget should be the original estimate amount
  const originalBudget = React.useMemo(() => {
    if (isRestrictedWorkspaceProject) {
      const fromBuckets = approvedCostBucketsForMember.reduce(
        (sum, b) => sum + (Number(b.budget) || 0),
        0
      );
      return (
        fromBuckets ||
        Number((realProjectData as any)?.approvedCostBudget ?? 0) ||
        0
      );
    }
    // Priority: estimate's grandTotal (what user saw in estimate), then bidPrice, then estimatedCost
    return firstPositiveNumber(
      realProjectData?.estimateData?.grandTotal,
      realProjectData?.estimateData?.bidPrice,
      realProjectData?.estimateData?.total,
      realProjectData?.bidPrice,
      realProjectData?.estimatedCost,
      resolvedBidPrice ?? 0,
    ) ?? 0;
  }, [
    isRestrictedWorkspaceProject,
    approvedCostBucketsForMember,
    realProjectData?.approvedCostBudget,
    realProjectData?.estimateData?.grandTotal,
    realProjectData?.estimateData?.bidPrice,
    realProjectData?.estimateData?.total,
    realProjectData?.bidPrice,
    realProjectData?.estimatedCost,
    resolvedBidPrice,
  ]);

  const budgetData = (() => {
    const base = convertToBudgetData(projectData);
    return {
      ...base,
      status: (projectData as any)?.status ?? (realProjectData as any)?.status,
      // CRITICAL: Use originalBudget (without change orders), NOT budgetedValue (includes COs)
      // BudgetTab will add change orders separately to get adjusted budget
      plannedBudget: originalBudget > 0 
        ? originalBudget 
        : (base.lines.reduce((sum: number, line: any) => sum + (Number(line?.unitCost) || 0), 0)),
      expenses: (base.expenses || []).map((e: any) => ({
        ...e,
        date: e?.date ?? new Date().toISOString(),
      })),
      changeOrders: (base.changeOrders || []).map((co: any) => ({
        id: String(co.id ?? Date.now()),
        title: String(co.title ?? 'Change Order'),
        amount: Number(co.amount ?? 0),
        status: co.status ?? (co.approved ? 'Approved' : 'Draft'),
        approved: co.approved === true || co.status === 'Approved',
        materialsAmount:
          co.materialsAmount !== undefined && co.materialsAmount !== null
            ? Number(co.materialsAmount)
            : undefined,
        laborAmount:
          co.laborAmount !== undefined && co.laborAmount !== null
            ? Number(co.laborAmount)
            : undefined,
        date: co.date ?? new Date().toISOString(),
      })),
    };
  })();

  // Debug logging
  console.log('🔍 Project Detail Debug:');
  console.log('📋 Project ID:', id);
  console.log('📋 Real Project Data:', realProjectData);
  console.log('📋 Estimate Start Date:', realProjectData?.estimateData?.projectStartDate);
  console.log('📋 Estimate End Date:', realProjectData?.estimateData?.projectEndDate);
  console.log('📋 Final Start ISO:', projectData?.startISO);
  console.log('📋 Final End ISO:', projectData?.endISO);
  console.log('📋 Final Project Data:', projectData);
  console.log('📋 Budget Data:', budgetData);
  
  const missingProjectData = !projectData;
  const projectDataBase: any = projectData ?? {
    title: 'Untitled Project',
    status: 'In Progress',
    spent: 0,
    health: {},
    team: {},
    buckets: [],
    milestones: [],
    expenses: [],
    changeOrders: [],
    purchaseOrders: [],
  };
  
  // Ensure all critical properties are defined
  // This ensures OverviewScreen and other components see the correct original budget
  const safeProjectData: any = {
    ...projectDataBase,
    title: String(projectDataBase.title || 'Untitled Project'),
    status: String(projectDataBase.status || 'In Progress'),
    budgeted: isRestrictedWorkspaceProject
      ? Number(realProjectData?.approvedCostBudget ?? projectDataBase.budgeted ?? 0)
      : originalBudget,
    bidPrice: isRestrictedWorkspaceProject
      ? undefined
      : (realProjectData as any)?.bidPrice ?? projectDataBase?.bidPrice,
    estimateData: isRestrictedWorkspaceProject
      ? undefined
      : (realProjectData as any)?.estimateData ?? projectDataBase?.estimateData,
    margin: isRestrictedWorkspaceProject
      ? undefined
      : (realProjectData as any)?.margin ?? projectDataBase?.margin,
    spent: Number(projectDataBase.spent || 0),
    // Ensure all nested objects are defined
    health: {
      costEfficiency: String(projectDataBase.health?.costEfficiency || 'Good'),
      scheduleEfficiency: String(projectDataBase.health?.scheduleEfficiency || 'Good'),
      projectStatus: String(projectDataBase.health?.projectStatus || 'On Track'),
    },
    team: {
      pmAssigned: Boolean(projectDataBase.team?.pmAssigned || false),
      pmName: String((projectDataBase as any).team?.pmName || ''),
    },
    // Ensure all arrays are defined
    buckets: isRestrictedWorkspaceProject && Array.isArray((realProjectData as any)?.approvedCostBuckets)
      ? (realProjectData as any).approvedCostBuckets.map((b: any, index: number) => ({
          id: String(b?.id ?? index + 1),
          name: String(b?.name || 'Category'),
          budget: Number(b?.budget ?? 0) || 0,
          bidBudget: Number(b?.budget ?? 0) || 0,
          spent: Number(b?.spent ?? 0) || 0,
        }))
      : projectDataBase.buckets || [],
    milestones: projectDataBase.milestones || [],
    expenses: projectDataBase.expenses || [],
    changeOrders: projectDataBase.changeOrders || [],
    purchaseOrders: projectDataBase.purchaseOrders || [],
  };

  // Calculate project metrics for Overview tab
  const overviewMetrics = useMemo(() => {
    const expensesTotal = (safeProjectData?.expenses || []).reduce(
      (sum: number, expense: any) => sum + Number(expense.amount || 0),
      0
    );
    const bucketSpentTotal = (safeProjectData?.buckets || []).reduce(
      (sum: number, bucket: any) => sum + Number(bucket.spent || 0),
      0
    );
    // Calculate Received Purchase Orders total (to include in Actual Expenses)
    const receivedPOsTotal = (() => {
      const rawPOs = safeProjectData?.purchaseOrders || [];
      const receivedPOs = rawPOs.filter((po: any) => po.status === 'Received');
      
      return receivedPOs.reduce((sum: number, po: any) => {
        let amount = 0;
        if (typeof po.amount === 'string') {
          amount = parseFloat(po.amount) || 0;
        } else if (typeof po.amount === 'number') {
          amount = po.amount;
        } else {
          amount = Number(po.amount) || 0;
        }
        return sum + amount;
      }, 0);
    })();
    
    // Committed POs = Pending only (matches BudgetTab — exclude Received and Cancelled)
    const committedPOsTotal = (() => {
      const rawPOs = safeProjectData?.purchaseOrders || [];
      const pendingPOs = rawPOs.filter((po: any) => po.status === 'Pending');
      return pendingPOs.reduce((sum: number, po: any) => {
        const amount = Number(po.amount) || parseFloat(String(po.amount || '')) || 0;
        return sum + amount;
      }, 0);
    })();
    
    // Total Spent = expenses + received POs. Nick: 6500 + 1500 = 8000. Jason: 1550 + 500 + 550 = 2600.
    // When we have expenses: sum(expenses) + receivedPOsTotal. Else: bucketSpentTotal (includes POs).
    const totalSpent = expensesTotal > 0 ? expensesTotal + receivedPOsTotal : bucketSpentTotal;

    const plannedFromBucketsForFinancials = (safeProjectData?.buckets || []).reduce(
      (sum: number, bucket: any) => {
        const n = String(bucket?.name || '').toLowerCase();
        if (
          n.includes('material') ||
          n.includes('equip') ||
          n.includes('labor') ||
          n.includes('allowance') ||
          n.includes('overhead') ||
          n.includes('permit')
        ) {
          return sum + Number(bucket?.budget || 0);
        }
        return sum;
      },
      0
    );
    const plannedCostBucketSum = sumPlannedCostFromBuckets(safeProjectData?.buckets);
    const financials = computeProjectFinancials(safeProjectData, {
      plannedFromBuckets: plannedFromBucketsForFinancials,
      plannedCostBucketSum,
    });
    const costBudgetCap = financials.adjustedCostBudget;

    const budgetProgress =
      costBudgetCap > 0
        ? ((totalSpent + committedPOsTotal) / costBudgetCap) * 100
        : 0;

    // Compute schedule progress from live timeline (exclude deposit) when available — matches Timeline tab
    const isDeposit = (m: any) => {
      const t = (m?.title || m?.name || "").toLowerCase();
      return t.includes("deposit") || m?.type === "deposit";
    };
    const workMilestones = (liveTimelineMilestones || []).filter((m: any) => !isDeposit(m));
    const scheduleProgress = workMilestones.length > 0
      ? Math.round(
          workMilestones.reduce((sum: number, m: any) => sum + Math.min(100, Math.max(0, m.progressPct || 0)), 0) /
          workMilestones.length
        )
      : (safeProjectData?.overallProgressPct ?? safeProjectData?.progress ?? 0);
    const projectStatus = String((safeProjectData as any)?.status ?? '').toLowerCase();
    const isProjectCompleted = projectStatus === 'completed';
    const progressForForecast = isProjectCompleted ? 100 : scheduleProgress;

    const milestonesForCollection =
      (liveTimelineMilestones?.length ? liveTimelineMilestones : null) ??
      (safeProjectData?.milestones as unknown[] | undefined);
    const contractCollectedPct = contractCollectedPctFromMilestones(
      milestonesForCollection,
      financials.adjustedContractValue
    );

    const elapsedTimePct = computeElapsedCalendarPct(safeProjectData?.startISO, safeProjectData?.endISO);

    const profitForecast = computeProfitForecast({
      contractValue: financials.adjustedContractValue,
      adjustedBudget:
        costBudgetCap > 0 ? costBudgetCap : financials.adjustedContractValue,
      estimatedCostBaseline:
        financials.plannedCostBudget > 0 ? financials.plannedCostBudget : undefined,
      actualExpenses: totalSpent,
      committedPOs: committedPOsTotal,
      progressPct: progressForForecast,
      contractCollectedPct,
      elapsedTimePct,
      isCompleted: isProjectCompleted,
    });

    const getDaysLeft = () => {
      if (!safeProjectData?.endISO) return 0;
      const endDate = new Date(safeProjectData.endISO);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    };

    const getBudgetColor = (budgetUsed: number) => {
      if (budgetUsed < 50) return '#22C55E';
      if (budgetUsed < 80) return '#F97316';
      return '#EF4444';
    };

    const getStatusColor = (status: string) => {
      const normalized = status?.toLowerCase() || '';
      if (normalized.includes('good') || normalized.includes('on track')) return '#22c55e';
      if (normalized.includes('risk') || normalized.includes('at risk')) return '#f59e0b';
      if (normalized.includes('critical') || normalized.includes('behind')) return '#ef4444';
      return '#e5e7eb';
    };

    const getDaysLeftColor = (days: number | null | undefined) => {
      if (days == null) return getStatusColor(safeProjectData?.health?.projectStatus || 'On Track');
      if (days <= 0) return '#ef4444'; // red: overdue
      if (days < 30) return '#f59e0b'; // yellow: getting close
      return '#22c55e'; // green: plenty of time
    };

    /** Cumulative spend from estimate/project start through today (same as Budget / Overview). */
    const generateSpendingData = () =>
      buildSpendingTrendSamplePoints(safeProjectData as Record<string, unknown>, totalSpent);

    const formatCurrency = (amount: number) => {
      // Show accurate bid values with 2 decimal places, no rounding
      return `$${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    const costRemaining = costBudgetCap - totalSpent - committedPOsTotal;
    const spentPercentUsed =
      costBudgetCap > 0
        ? ((totalSpent + committedPOsTotal) / costBudgetCap) * 100
        : 0;

    const getScheduleStatusLabel = () => {
      const progress = scheduleProgress;
      if (progress < 30) return 'Early';
      if (progress < 70) return 'On Track';
      if (progress < 90) return 'At Risk';
      return 'Behind';
    };

    const getTimelineProgressPercent = () => {
      if (!safeProjectData?.startISO || !safeProjectData?.endISO) return 0;
      const start = new Date(safeProjectData.startISO);
      const end = new Date(safeProjectData.endISO);
      const today = new Date();
      const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (totalDays <= 0) return 0;
      return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
    };

    const formatDate = (dateISO: string | undefined) => {
      if (!dateISO) return '—';
      try {
        const date = new Date(dateISO);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '—';
      }
    };

    const spendingTrendCostStatus = computeSpendingTrendCostStatus({
      spendCap: costBudgetCap,
      actualCosts: totalSpent,
      committedPOs: committedPOsTotal,
      forecastFinalCost: profitForecast.forecastFinalCost,
    });

    return {
      isProjectCompleted,
      adjustedBudget: costBudgetCap,
      costBudgetCap,
      financials,
      totalSpent,
      committedPOsTotal,
      spendingTrendCostStatus,
      remaining: costRemaining,
      budgetProgress: Math.min(100, Math.max(0, budgetProgress)),
      scheduleProgress: Math.min(100, Math.max(0, scheduleProgress)),
      daysLeft: getDaysLeft(),
      budgetColor: getBudgetColor(budgetProgress),
      statusColor: getStatusColor(safeProjectData?.health?.projectStatus || 'On Track'),
      daysLeftColor: getDaysLeftColor(getDaysLeft()),
      spendingData: generateSpendingData(),
      profitForecast,
      budgetDisplay: formatCurrency(costBudgetCap),
      spentDisplay: formatCurrency(totalSpent),
      remainingDisplay: formatCurrency(costRemaining),
      baseBudgetDisplay: formatCurrency(financials.contractValueBase),
      changeOrdersDisplay: formatCurrency(financials.approvedChangeOrderRevenue),
      totalBudgetDisplay: formatCurrency(costBudgetCap),
      adjustedContractValueDisplay: formatCurrency(financials.adjustedContractValue),
      spentPercentUsed: Math.min(100, Math.max(0, spentPercentUsed)),
      startDateDisplay: formatDate(safeProjectData?.startISO),
      endDateDisplay: formatDate(safeProjectData?.endISO),
      scheduleStatusLabel: getScheduleStatusLabel(),
      timelineProgressPercent: getTimelineProgressPercent(),
    };
  }, [safeProjectData, currentDate, liveTimelineMilestones]); // Include liveTimelineMilestones so Schedule matches Timeline tab

  const overviewBucketNames = useMemo(
    () => (safeProjectData?.buckets || []).map((b: { name?: string }) => String(b.name || '')).filter(Boolean),
    [safeProjectData?.buckets]
  );

  const overviewCalibrationProjectLike = useMemo(
    () => ({
      ...(realProjectData || {}),
      id,
      projectData: contextProjectData || safeProjectData,
      contractValue: overviewMetrics.financials.adjustedContractValue,
      budget:
        overviewMetrics.financials.plannedCostBudget ||
        overviewMetrics.financials.adjustedCostBudget,
    }),
    [realProjectData, id, contextProjectData, safeProjectData, overviewMetrics.financials]
  );

  const {
    estimateFeedback: overviewEstimateFeedback,
    closeoutTipCount: overviewCloseoutTipCount,
    linkCostsTarget: overviewLinkCostsTarget,
  } = useProjectEstimateFeedback({
    projectId: id,
    status: String(safeProjectData?.status ?? realProjectData?.status ?? ''),
    buckets: safeProjectData?.buckets || [],
    expenses: safeProjectData?.expenses || [],
    changeOrders: safeProjectData?.changeOrders || [],
    plannedBudget:
      overviewMetrics.financials.plannedCostBudget ||
      overviewMetrics.financials.adjustedCostBudget,
    finalCustomerPrice: overviewMetrics.financials.adjustedContractValue,
    calibrationProjectLike: overviewCalibrationProjectLike,
    categoryNames: overviewBucketNames,
    enabled: projectDetailReady,
  });

  const overviewEstimateCardTheme = useMemo(
    () => ({
      text: darkMode ? '#F5F7FA' : Colors.text,
      metricLabelColor: darkMode ? ESTIMATE_FLOW_TEXT_LABEL_DARK : '#64748b',
    }),
    [darkMode, Colors.text]
  );

  const operationalRiskCards = useMemo(
    () =>
      buildOperationalRiskCards({
        project: safeProjectData,
        metrics: overviewMetrics,
        liveTimelineMilestones,
      }),
    [safeProjectData, overviewMetrics, liveTimelineMilestones]
  );

  const renderTabContent = () => {
    try {
      console.log('🔍 Rendering tab:', activeTab);
      console.log('🔍 Safe project data:', safeProjectData);
      
      switch (activeTab) {
        case 'Overview': {
          if (!projectDetailReady) {
            return (
              <View style={[styles.wideContainer, styles.tabFlowWide, styles.overviewLoadingWrap]}>
                <View style={styles.overviewCard}>
                  <ActivityIndicator size="large" color="#22c55e" />
                  <Text style={styles.overviewLoadingText}>Loading project overview…</Text>
                </View>
              </View>
            );
          }
          const metrics = overviewMetrics;
          const overviewCostStatusHeadline = metrics.spendingTrendCostStatus.text
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          const overviewNestedCardBg = darkMode ? AI_FLOW_CARD_BG_DARK : Colors.surface2;
          const overviewNestedCardBorder = darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line;
          const overviewPageCaption = darkMode ? ESTIMATE_FLOW_TEXT_MUTED_DARK : '#64748b';
          return (
            <View style={[styles.wideContainer, styles.tabFlowWide]}>
              <View style={styles.overviewCard}>
                  <View style={styles.overviewPageHeader}>
                    <Text style={styles.overviewPageTitle}>Project Overview</Text>
                    <Text style={styles.overviewPageSubtitle}>
                      {projectPerms.canViewOwnerFinancials
                        ? 'Executive snapshot of contract, cost, and margin'
                        : projectPerms.isManager
                          ? 'Operations snapshot — cost control without owner profit'
                          : 'Field view — schedule, tasks, and jobsite updates'}
                    </Text>
                  </View>

                  {projectPerms.canViewOwnerFinancials ? (
                    <BudgetProfitMixCard
                      currency={(safeProjectData as { currency?: string }).currency ?? 'USD'}
                      adjustedContractValue={metrics.financials.adjustedContractValue}
                      spentToDate={metrics.totalSpent}
                      committedPOsTotal={metrics.committedPOsTotal}
                      adjustedCostBudget={metrics.financials.adjustedCostBudget}
                      profitForecast={metrics.profitForecast}
                      jobCompleted={metrics.isProjectCompleted}
                      originalEstimateMarginPct={Number(
                        (realProjectData as any)?.estimateData?.marginPercent ??
                        (realProjectData as any)?.estimateData?.margin ??
                        (realProjectData as any)?.estimateData?.marginPct ??
                        (safeProjectData as any)?.estimateData?.marginPercent ??
                        (safeProjectData as any)?.estimateData?.marginPct ??
                        0
                      )}
                      originalEstimateProfit={Number(
                        (realProjectData as any)?.estimateData?.profit ??
                        (safeProjectData as any)?.estimateData?.profit ??
                        0
                      )}
                      onChipsPress={() => {
                        void Haptics.selectionAsync();
                        setActiveTab('Budget');
                      }}
                      marginTop={0}
                    />
                  ) : projectPerms.isManager ? (
                    <ManagerOperationsSnapshot
                      metrics={metrics}
                      colors={Colors}
                      darkMode={darkMode}
                      styles={styles}
                      onOpenBudget={() => {
                        void Haptics.selectionAsync();
                        setActiveTab('Budget');
                      }}
                    />
                  ) : (
                    <FieldProjectOverview
                      project={safeProjectData}
                      metrics={metrics}
                      colors={Colors}
                      darkMode={darkMode}
                      styles={styles}
                      role={projectPerms.isForeman ? 'foreman' : 'field'}
                    />
                  )}
              </View>

                  {projectPerms.canViewOwnerFinancials ? (
                  <>
                  <View style={styles.innerCardContainer}>
                    <View style={[styles.innerCard, styles.overviewSectionCard]}>
                      <View style={styles.overviewCardHeaderRow}>
                        <View style={styles.overviewCardHeaderTitleCluster}>
                          <View style={styles.iconBadge}>
                            <Feather name="bar-chart-2" size={16} color="#22c55e" />
                          </View>
                          <View style={styles.overviewCardHeaderTitleWrap}>
                            <Text
                              style={styles.overviewSectionTitle}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              Project Status
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.overviewHeroStatusChip,
                            styles.overviewHeaderStatusChip,
                            {
                              backgroundColor: `${metrics.spendingTrendCostStatus.color}29`,
                              borderColor: `${metrics.spendingTrendCostStatus.color}38`,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.overviewHeroStatusChipText, { color: metrics.spendingTrendCostStatus.color }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {overviewCostStatusHeadline}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.projectStatusMetrics, { paddingTop: 2 }]}>
                        <View style={styles.projectStatusMetricRow}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={styles.overviewHeroMetricLabel}>Cost Budget Used</Text>
                            <Text style={styles.overviewFhMarginHelper}>
                              Percent of planned cost budget used (incl. committed POs)
                            </Text>
                          </View>
                          <Text
                            style={styles.overviewHeroMetricValueSecondary}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {metrics.spentPercentUsed.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.projectStatusBarTrack}>
                          <LinearGradient
                            colors={[...ESTIMATE_FLOW_PROGRESS_GRADIENT]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.projectStatusBarFill,
                              {
                                width: `${Math.min(100, metrics.budgetProgress)}%`,
                              },
                            ]}
                          />
                        </View>

                        <View style={[styles.projectStatusMetricRow, styles.projectStatusMetricRowSpaced]}>
                          <Text style={styles.overviewHeroMetricLabel}>Schedule</Text>
                          <Text
                            style={styles.overviewHeroMetricValueSecondary}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.75}
                          >
                            {metrics.scheduleProgress.toFixed(0)}%
                          </Text>
                        </View>
                        <View style={styles.projectStatusBarTrack}>
                          <LinearGradient
                            colors={[...ESTIMATE_FLOW_PROGRESS_GRADIENT]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.projectStatusBarFill,
                              {
                                width: `${Math.min(100, metrics.scheduleProgress)}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <View style={styles.projectStatusDivider} />

                      <View style={styles.projectStatusDates}>
                        <View style={styles.projectStatusDateRow}>
                          <Text style={styles.overviewHeroMetricLabel}>Start</Text>
                          <Text
                            style={[styles.overviewHeroMetricValue, { fontSize: 15 }]}
                            numberOfLines={1}
                          >
                            {metrics.startDateDisplay}
                          </Text>
                        </View>
                        <View style={[styles.projectStatusDateRow, styles.projectStatusDateRowLast]}>
                          <Text style={styles.overviewHeroMetricLabel}>End</Text>
                          <Text
                            style={[styles.overviewHeroMetricValue, { fontSize: 15 }]}
                            numberOfLines={1}
                          >
                            {metrics.endDateDisplay}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.innerCardContainer, styles.overviewSectionFill]}>
                      <EstimateVsActualCard
                        estimateFeedback={overviewEstimateFeedback}
                        closeoutTipCount={overviewCloseoutTipCount}
                        darkMode={darkMode}
                        nestedCardBg={overviewNestedCardBg}
                        nestedCardBorder={overviewNestedCardBorder}
                        theme={overviewEstimateCardTheme}
                        pageCaption={overviewPageCaption}
                        bidPrice={metrics.financials.adjustedContractValue}
                        totalCategoryCount={overviewBucketNames.length}
                        linkCostsTarget={overviewLinkCostsTarget}
                        mapCostsOpensBudgetTab
                        onReviewTips={() => setShowCalibrationReview(true)}
                        onMapCosts={() => {
                          void Haptics.selectionAsync();
                          setActiveTab('Budget');
                        }}
                        showInsightsCta={DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS.actualVsEstimatedFeedback}
                      />
                  </View>
                  </>
                  ) : projectPerms.isManager ? (
                  <>
                    <View style={styles.overviewCard}>
                    <MemberProjectStatusCard
                      metrics={metrics}
                      styles={styles}
                      showCostBudget
                    />
                    </View>
                    <View style={styles.overviewCard}>
                    <ProjectRiskCheckCard
                      cards={operationalRiskCards}
                      colors={Colors}
                      darkMode={darkMode}
                      styles={styles}
                    />
                    </View>
                    <View style={[styles.overviewCard, styles.overviewCardFill]}>
                    <ProjectHealthOperationalCard
                      metrics={metrics}
                      colors={Colors}
                      darkMode={darkMode}
                      styles={styles}
                    />
                    </View>
                  </>
                  ) : (
                  <>
                    <View style={[styles.overviewCard, styles.overviewCardFill]}>
                    <MemberProjectStatusCard
                      metrics={metrics}
                      styles={styles}
                      showCostBudget={false}
                    />
                    </View>
                  </>
                  )}
            </View>
          );
        }
        case 'Budget':
          return (
            <View style={[styles.wideContainer, styles.tabFlowWide]}>
              {projectPerms.budgetAccessMode === 'hidden' ? (
                <FinancialAccessLocked
                  colors={Colors}
                  onBackToProject={() => setActiveTab('Overview')}
                />
              ) : (
                <BudgetTab
                  data={budgetData}
                  embedded
                  profitForecastOverride={overviewMetrics.profitForecast}
                  budgetAccessMode={
                    projectPerms.budgetAccessMode === 'cost_control' ? 'cost_control' : 'owner'
                  }
                  onRequestOpenTimeline={() => setActiveTab('Timeline')}
                  initialBudgetCategory={budgetCategoryParam}
                />
              )}
            </View>
          );
        case 'Timeline':
          return (
            <View style={[styles.wideContainer, styles.tabFlowWide]}>
              <TimelineTabV2
                embedded
                project={{ ...safeProjectData, id: id as string }}
              />
            </View>
          );
        case 'Calendar':
          return (
            <View style={styles.tabFlowWide}>
            <ProjectCalendar
              embedded
              projectId={id as string}
              projectName={safeProjectData?.title || 'Project'}
              milestones={safeProjectData?.milestones || []}
              projectData={contextProjectData}
              onEventComplete={async (event) => {
                // When a calendar event is completed, create a daily log entry
                try {
                  const logKey = `daily_logs_${id}`;
                  const raw = await AsyncStorage.getItem(logKey);
                  const logs = raw ? JSON.parse(raw) : [];
                  const newLog = {
                    id: `log-${Date.now()}`,
                    date: event.date,
                    noteText: `Completed: ${event.title}${event.notes ? ` - ${event.notes}` : ''}`,
                    weather: null,
                    crewCount: null,
                    hoursWorked: null,
                    createdAt: new Date().toISOString(),
                  };
                  logs.push(newLog);
                  await AsyncStorage.setItem(logKey, JSON.stringify(logs));
                  console.log('✅ Daily log created from calendar event:', event.title);
                } catch (error) {
                  console.error('❌ Error creating daily log from calendar event:', error);
                }
              }}
            />
            </View>
          );
        case 'Team':
          return (
            <View style={styles.wideContainer}>
              <TeamTab embedded />
            </View>
          );
        default:
          return (
            <OverviewScreen
              project={safeProjectData}
              theme='dark'
              scheduleProgressPct={overviewMetrics.scheduleProgress}
            />
          );
      }
    } catch (error) {
      console.error('Error rendering tab content:', error);
      return (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>
            Error loading tab content. Please try again.
          </Text>
        </View>
      );
    }
  };

  const handleTabPress = useCallback(
    (tab: TabKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(tab);
      if (apWtWalkthroughEligible) {
        const idx = apWtSteps.findIndex((s) => s.tab === tab);
        if (idx >= 0) {
          setApWtStepIndex(idx);
          void persistApWtProgress({ detailStepIndex: idx });
        }
      }
    },
    [apWtWalkthroughEligible, persistApWtProgress]
  );

  // Get project title for header
  const projectTitle = useMemo(() => {
    return safeProjectData?.title || 'Project Details';
  }, [safeProjectData?.title]);

  const projectTitleTypography = useMemo(
    () => getProjectScreenTitleTypography(projectTitle),
    [projectTitle]
  );

  const showJustActivated = useMemo(() => {
    const status = safeProjectData?.status || 'In Progress';
    const updatedAt = safeProjectData?.updatedAt ? new Date(safeProjectData.updatedAt).getTime() : 0;
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const isRecentlyActivated = updatedAt > fiveMinAgo;
    return (status === 'won' || status === 'in_progress') && isRecentlyActivated;
  }, [safeProjectData?.status, safeProjectData?.updatedAt]);

  useEffect(() => {
    setJustActivatedDismissed(false);
    justActivatedOpacity.setValue(1);
  }, [id]);

  useEffect(() => {
    if (showJustActivated && !justActivatedDismissed) {
      const t = setTimeout(() => {
        Animated.timing(justActivatedOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setJustActivatedDismissed(true);
        });
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [showJustActivated, justActivatedDismissed]);

  const projectStatus = useMemo(() => {
    const status = safeProjectData?.status || 'In Progress';
    if (status === 'estimate') return 'Draft';
    if (status === 'bid_submitted') return 'Submitted';
    if (status === 'won' || status === 'in_progress') {
      if (showJustActivated && !justActivatedDismissed) return 'Just activated';
      return 'Active';
    }
    if (status === 'completed') return 'Completed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, [safeProjectData?.status, showJustActivated, justActivatedDismissed]);

  const projectSegmentItems = useMemo((): SegmentNavItem[] => {
    const items: SegmentNavItem[] = [
      { key: 'Overview', label: 'Overview', icon: 'grid-outline' },
    ];
    if (projectPerms.visibleTabs.includes('Budget')) {
      items.push({
        key: 'Budget',
        label: projectPerms.budgetTabLabel,
        icon: 'wallet-outline',
      });
    }
    items.push(
      { key: 'Timeline', label: 'Timeline', icon: 'calendar-outline' },
      { key: 'Calendar', label: 'Calendar', icon: 'calendar' }
    );
    if (projectPerms.visibleTabs.includes('Team')) {
      items.push({ key: 'Team', label: 'Team', icon: 'people-outline' });
    }
    return items;
  }, [projectPerms.visibleTabs, projectPerms.budgetTabLabel]);

  if (missingProjectData) {
    console.error('❌ Project data is undefined!');
    return (
      <View style={{ flex: 1, backgroundColor: '#0b1c38', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18, textAlign: 'center' }}>
          Error: Project data not found
        </Text>
      </View>
    );
  }

  try {
    return (
      <SafeAreaView
        style={[styles.root, Platform.OS === 'web' && desktopWeb && styles.rootDesktopWeb]}
        edges={['top']}
      >
        <StatusBar barStyle="light-content" />

        {/* Background — opaque black so ScrollView never shows default system gray between sections */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
        />

        <ScrollView
          style={[
            { flex: 1 },
            darkMode ? { backgroundColor: '#000000' } : undefined,
            Platform.OS === 'web' && { flex: 1 },
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            { flexGrow: 1 },
            Platform.OS === 'web' && { paddingHorizontal: 0, paddingTop: 0 },
            webScrollContentCap,
            apWtScrollPadBottom > 0
              ? { paddingBottom: 24 + apWtScrollPadBottom }
              : { paddingBottom: tabScrollBottomInset },
          ]}
          showsVerticalScrollIndicator={false}
          {...KEYBOARD_SCROLL_DEFAULTS}
          {...(Platform.OS === 'web' ? { keyboardShouldPersistTaps: 'always' as const } : {})}
          nestedScrollEnabled
        >
        <WebPageShell size="projectDetail" scroll={false} contentStyle={{ paddingBottom: 0 }}>
          {/* HEADER */}
          <View style={[styles.headerRow, styles.wideContainer]}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (backToProjects) {
                      router.replace("/(tabs)/projects");
                      return;
                    }
                    router.back();
                  }}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={20} color={darkMode ? "#FFFFFF" : "#000000"} />
                </GradientRingBackInner>
              </LinearGradient>
            </View>

            <View style={styles.headerTitleBlock}>
              <Text
                style={[styles.screenTitle, projectTitleTypography]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {projectTitle}
              </Text>
              <View style={styles.screenSubtitleRow}>
                {projectStatus === 'Just activated' ? (
                  <Animated.Text style={[styles.screenSubtitle, { opacity: justActivatedOpacity }]}>
                    {projectStatus}
                  </Animated.Text>
                ) : (
                  <Text style={styles.screenSubtitle}>{projectStatus}</Text>
                )}
                <Text style={styles.screenSubtitle}>·</Text>
                <Text style={[styles.screenSubtitle, styles.screenSubtitleLocation]} numberOfLines={1}>
                  {(safeProjectData as any)?.location || 'Unknown Location'}
                </Text>
              </View>
            </View>

            <LinearGradient
              pointerEvents="box-none"
              colors={["#22c55e", "#22d3ee"]}
              style={styles.profileOuter}
            >
              <Pressable
                style={styles.profileInner}
                onPress={() => router.push("/(tabs)/profile")}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                <Text style={styles.profileInitials}>{profileGreeting.initials}</Text>
              </Pressable>
            </LinearGradient>
          </View>

          {/* Post-Activation Command Center - Action-Driven Success Card */}
          {showCommandCenter && activeTab === 'Overview' && (
            <View style={[styles.commandCenterContainer, styles.wideContainer]}>
              <View style={styles.commandCenterCard}>
                <View style={styles.commandCenterHeader}>
                  <View style={styles.commandCenterIconContainer}>
                    <Ionicons name="rocket" size={24} color="#2DFFC4" />
                  </View>
                  <View style={styles.commandCenterHeaderText}>
                    <Text style={styles.commandCenterTitle}>Project is live — here's your first move</Text>
                    <Text style={styles.commandCenterSubtitle}>
                      Your estimate is now the baseline. Stay ahead by logging activity early.
                    </Text>
                  </View>
                </View>
                
                {/* 3 Primary Action Buttons */}
                <View style={styles.commandCenterActions}>
                  <TouchableOpacity
                    style={styles.commandCenterActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab('Budget');
                      // Trigger expense modal - this will be handled by BudgetTab
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="receipt-outline" size={20} color="#2DFFC4" />
                    <View style={styles.commandCenterActionTextContainer}>
                      <Text style={styles.commandCenterActionText}>Log first expense</Text>
                      <Text style={styles.commandCenterActionSubtext}>Materials, equipment, or deposits</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.commandCenterActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab('Timeline');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="time-outline" size={20} color="#2DFFC4" />
                    <View style={styles.commandCenterActionTextContainer}>
                      <Text style={styles.commandCenterActionText}>Assign labor hours</Text>
                      <Text style={styles.commandCenterActionSubtext}>Planned vs actual</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.commandCenterActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab('Timeline');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flag-outline" size={20} color="#2DFFC4" />
                    <View style={styles.commandCenterActionTextContainer}>
                      <Text style={styles.commandCenterActionText}>Mark first milestone</Text>
                      <Text style={styles.commandCenterActionSubtext}>Deposit received or work started</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* SEGMENTED CONTROL — matches Dashboard pill nav */}
          <View style={styles.wideContainer}>
            <SegmentNavBar
              items={projectSegmentItems}
              activeKey={activeTab}
              onPress={(key) => handleTabPress(key as TabKey)}
            />
          </View>

          {/* CONTENT */}
          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>
        </WebPageShell>
        </ScrollView>

        {apWtSheetVisible ? (
          <FirstEstimateWalkthroughSheetShell
            darkMode={darkMode}
            bottomOffset={Math.max(insets.bottom, 12) + 12}
            backdropVariant="blurOnly"
          >
            <FirstEstimateWalkthroughStepSheetContent
              darkMode={darkMode}
              Colors={Colors}
              title={apWtSteps[apWtStepIndex].title}
              body={apWtSteps[apWtStepIndex].body}
              onGotIt={handleApWtGotIt}
              onSkipWalkthrough={skipActiveProjectWalkthrough}
            />
          </FirstEstimateWalkthroughSheetShell>
        ) : null}

        {/* Project Activation Flow */}
        <ProjectActivationFlow
          visible={showActivationFlow}
          onComplete={(completedSteps) => {
              // Close the activation flow modal first - do this immediately
              setShowActivationFlow(false);
              
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

              // Save dismissal state
              if (id) {
                try {
                  AsyncStorage.setItem(`bps.kickoffShown.${id}`, 'true');
                  AsyncStorage.setItem(`bps.activationCompleted.${id}`, 'true');
                } catch (error) {
                  console.error('Error saving activation completion:', error);
                }
              }
              
              // Update activation checklist after a brief delay to avoid conflicts
              setTimeout(() => {
                if (completedSteps) {
                  setActivationChecklist({
                    timelineConfirmed: completedSteps.timeline || false,
                    paymentScheduleReviewed: completedSteps.paymentSchedule || false,
                    teamAssigned: completedSteps.team || false,
                  });
                }
                
                // Switch to Overview tab
                setActiveTab('Overview');
                
                // Haptic feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }, 500);
          }}
          onStepComplete={(completedSteps) => {
            setActivationChecklist((prev) => ({
              ...prev,
              timelineConfirmed: completedSteps.timeline ?? prev.timelineConfirmed,
              paymentScheduleReviewed: completedSteps.paymentSchedule ?? prev.paymentScheduleReviewed,
              teamAssigned: completedSteps.team ?? prev.teamAssigned,
            }));
          }}
          onSkip={() => {
            setShowActivationFlow(false);
            setActiveTab('Overview');
          }}
          initialStep={expandedChecklistItem === 'timeline' ? 1 : expandedChecklistItem === 'payment' ? 2 : expandedChecklistItem === 'team' ? 3 : 1}
          project={{
            id: id as string,
            title: safeProjectData?.title || 'Project',
            startDate: safeProjectData?.startISO,
            endDate: safeProjectData?.endISO,
            estimateData: realProjectData?.estimateData,
          }}
        />

        <CalibrationReviewModal
          visible={showCalibrationReview}
          instantPresent={openRateInsightsOnEntry.current}
          highlightLineId={rateInsightLineIdOnEntry.current}
          closeAccessibilityLabel={
            calibrationFromInsightLink ? "Back to Insights" : undefined
          }
          onClose={handleCloseCalibrationReview}
          projectLike={overviewCalibrationProjectLike}
          projectStatus={String(safeProjectData?.status ?? realProjectData?.status ?? '')}
          scopeComparisons={overviewEstimateFeedback.scopeComparisons}
          clientSuggestions={overviewEstimateFeedback.rateSuggestions}
          budgetAccessMode="owner"
          darkMode={darkMode}
          onApproved={() => {
            handleCloseCalibrationReview();
            void reloadFromStorage?.();
          }}
        />

        <SubscriptionPlansModal
          visible={showTeamUpgradePlans}
          returnToProjectId={id}
          returnTab="Budget"
          onUpgradeComplete={() => {
            setActiveTab('Budget');
          }}
          onClose={() => {
            setShowTeamUpgradePlans(false);
            setActiveTab('Budget');
            void businessEntitlement.refresh();
          }}
        />
      </SafeAreaView>
    );
  } catch (error) {
    console.error('Error rendering project detail:', error);
    return (
      <SafeAreaView
        style={[styles.root, Platform.OS === 'web' && desktopWeb && styles.rootDesktopWeb]}
        edges={['top']}
      >
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: darkMode ? '#FFFFFF' : Colors.text, fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
            Error loading project details
          </Text>
        <Text style={{ color: darkMode ? '#FFFFFF' : '#475569', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            Please try again or contact support if the issue persists.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
}

export default function ProjectDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeProjectId = useMemo(() => {
    const raw = params.id;
    return String(Array.isArray(raw) ? raw[0] : raw ?? '');
  }, [params.id]);

  if (!routeProjectId) return null;

  return (
    <ProjectDataProvider key={routeProjectId} projectId={routeProjectId}>
      <ProjectDetailContent />
    </ProjectDataProvider>
  );
}

const getStyles = (Colors: any, darkMode: boolean, desktopWeb = false) => {
  const edge = desktopWeb ? WEB_DESKTOP_EDGE_HORIZONTAL : 20;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  rootDesktopWeb: {
    backgroundColor: Colors.bg === '#000000' ? Colors.bg : '#f1f5f9',
  },
  scrollContent: {
    paddingTop: desktopWeb ? 24 : 20,
    paddingHorizontal: edge,
    paddingBottom: desktopWeb ? 24 : 0,
    ...(darkMode ? { backgroundColor: '#000000' } : {}),
  },
  wideContainer: {
    marginHorizontal: -edge,
    paddingHorizontal: desktopWeb ? 8 : 4,
  },
  tabFlowWide: {
    flex: 1,
  },
  tabFlowCard: {
    flex: 1,
    marginBottom: 0,
  },
  /** Overview tab — gray flow card (matches Dashboard / Projects). */
  overviewCard: {
    ...tabFlowCardStyle(Colors, darkMode, { marginBottom: 14 }),
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  overviewLoadingWrap: {
    minHeight: 220,
    justifyContent: 'center',
  },
  overviewLoadingText: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub,
  },
  /** Nested section inside an overview flow card — no extra top gap */
  overviewInnerCardFlush: {
    marginTop: 0,
  },
  /** Standalone overview sections — match main flow card, not nested tint */
  overviewSectionCard: {
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : Colors.surface2,
  },
  overviewSectionCardFill: {
    flex: 1,
  },
  /** Last overview section stretches to fill scroll area above tab bar */
  overviewSectionFill: {
    flex: 1,
    marginBottom: 0,
  },
  /** Last overview card stretches to fill scroll area above tab bar */
  overviewCardFill: {
    flex: 1,
    marginBottom: 0,
  },
  overviewPageHeader: {
    marginBottom: 16,
  },
  overviewPageTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: darkMode ? "#F5F7FA" : Colors.text,
  },
  overviewPageSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#475569",
  },
  overviewHeroCard: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  overviewHeroProjectName: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: darkMode ? "#F5F7FA" : Colors.text,
    lineHeight: 22,
  },
  overviewHeroMeta: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#475569",
  },
  overviewHeroMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 18,
    marginHorizontal: -8,
  },
  overviewHeroMetricCell: {
    width: "50%",
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  overviewHeroMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: darkMode ? ESTIMATE_FLOW_TEXT_LABEL_DARK : "#475569",
    textTransform: "uppercase",
  },
  /** Legacy single value style — dates / misc */
  overviewHeroMetricValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.35,
    color: darkMode ? "#F5F7FA" : Colors.text,
  },
  overviewHeroMetricValueSecondary: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.28,
    color: darkMode ? "#F5F7FA" : Colors.text,
  },
  overviewHeroMetricValueHero: {
    marginTop: 6,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: darkMode ? "#F5F7FA" : Colors.text,
  },
  overviewHeroFooter: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: darkMode ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.1)",
  },
  overviewHeroFooterLabelsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
  },
  overviewHeroFooterValuesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 6,
  },
  overviewHeroFooterCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  overviewHeroFooterColLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
    alignItems: "flex-start",
  },
  /** Slightly wider + centered so "Cost Budget Used" aligns cleanly vs side columns */
  overviewHeroFooterColMiddle: {
    flex: 1.2,
    minWidth: 0,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  overviewHeroFooterColEnd: {
    alignItems: "flex-end",
    paddingRight: 0,
    paddingLeft: 6,
  },
  overviewHeroFooterLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.45,
    color: darkMode ? ESTIMATE_FLOW_TEXT_LABEL_DARK : "#64748b",
    textTransform: "uppercase",
  },
  overviewHeroFooterLabelCentered: {
    textAlign: "center",
    width: "100%",
    letterSpacing: 0.4,
  },
  overviewHeroFooterValue: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.28,
    color: darkMode ? "#F5F7FA" : Colors.text,
  },
  overviewHeroFooterValueCentered: {
    textAlign: "center",
    width: "100%",
  },
  overviewHeroStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: "100%",
    borderWidth: 1,
    flexShrink: 0,
  },
  overviewHeaderStatusChip: {
    marginTop: 0,
    flexShrink: 0,
    alignSelf: "center",
  },
  overviewHeroStatusChipText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
  },
  overviewFhMarginHelper: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#64748b",
    fontWeight: "500",
  },
  overviewFhSlimBody: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#475569",
  },
  overviewFhStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  overviewFhStatusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  overviewCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 18,
  },
  overviewCardHeaderTitleCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  overviewCardHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  overviewSectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: darkMode ? "#F5F7FA" : Colors.text,
  },
  overviewProjectTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: Colors.text,
    flex: 1,
  },
  overviewNameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  overviewMetaLine: {
    fontSize: 12,
    lineHeight: 17,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#475569",
    fontWeight: "500",
  },
  overviewMetricsBlock: {
    marginTop: 14,
  },
  overviewBudgetAnchor: {
    marginBottom: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)",
  },
  overviewBudgetAmount: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.65,
    color: Colors.text,
    marginTop: 6,
  },
  overviewSecondaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  overviewSecondaryCell: {
    flex: 1,
  },
  overviewSecondaryCellRight: {
    alignItems: "flex-end",
  },
  overviewBudgetUsedRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  overviewHelperMuted: {
    fontSize: 11,
    lineHeight: 15,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#64748b",
    marginTop: 3,
    fontWeight: "400",
  },
  overviewBudgetUsedPercent: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.35,
  },
  budgetHelperLine: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#8891a0",
    fontWeight: "400",
  },
  budgetSummaryTable: {
    marginTop: 14,
  },
  budgetSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
  },
  budgetSummaryRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  budgetValueRight: {
    textAlign: "right",
    maxWidth: "52%",
  },
  projectStatusMetricRowSpaced: {
    marginTop: 12,
  },
  spendingSummaryBlock: {
    alignItems: "flex-end",
    marginLeft: 10,
    maxWidth: "46%",
  },
  spendingSummaryPrimary: {
    fontSize: 13,
    fontWeight: "700",
    color: "#22d3ee",
  },
  spendingSummarySecondary: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#64748b",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 14,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  backButtonWrapper: {
    flexShrink: 0,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: darkMode ? '#000000' : Colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  screenTitle: {
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
    width: "100%",
  },
  screenSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    gap: 4,
    marginTop: 4,
    width: "100%",
  },
  screenSubtitle: {
    fontSize: 14,
    color: darkMode ? Colors.subtext : "#475569",
  },
  screenSubtitleLocation: {
    flexShrink: 1,
  },
  inviteButtonContainer: {
    marginBottom: 18,
  },
  tabContent: {
    flex: 1,
    marginTop: 0,
  },
  tabInnerContainer: {
    paddingHorizontal: 20,
  },
  // Overview tab styles
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: darkMode ? Colors.subtext : "#475569",
  },
  card: {
    backgroundColor: darkMode ? "#000000" : Colors.cardDark,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: darkMode ? 0 : 1,
    borderColor: darkMode ? "transparent" : Colors.line,
  },
  cardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  overviewContainerWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  innerCardContainer: {
    marginTop: 18,
  },
  innerCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  innerCard: {
    backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : Colors.surface2,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148,163,184,0.12)' : Colors.line,
    ...Platform.select({
      ios: darkMode
        ? {}
        : {
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          },
      android: darkMode ? {} : { elevation: 2 },
    }),
  },
  projectLeakCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : '#F8FAFC',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148,163,184,0.12)' : Colors.line,
  },
  projectLeakAccent: {
    width: 4,
    borderRadius: 999,
    alignSelf: 'stretch',
  },
  projectLeakTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  projectLeakBody: {
    fontSize: 13,
    lineHeight: 18,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : '#475569',
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: darkMode ? Colors.sub : "#475569",
  },
  cardSubtitleRight: {
    fontSize: 13,
    color: "#22d3ee",
    fontWeight: "600",
  },
  mutedLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.15,
    color: darkMode ? ESTIMATE_FLOW_TEXT_LABEL_DARK : "#8891a0",
    marginBottom: 4,
  },
  largeNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
  },
  mediumNumber: {
    fontSize: 19,
    fontWeight: "700",
    color: darkMode ? "#22d3ee" : "#0ea5e9",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metricLabel: {
    fontSize: 12,
    color: darkMode ? '#FFFFFF' : '#475569',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  projectStatusStatusRow: {
    marginTop: 12,
  },
  projectStatusMetrics: {
    marginTop: 12,
  },
  projectStatusMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  projectStatusBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  projectStatusBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  projectStatusDivider: {
    height: 1,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
    marginTop: 18,
    marginBottom: 16,
  },
  projectStatusDates: {
    gap: 12,
    paddingBottom: 8,
  },
  projectStatusDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
  },
  projectStatusDateRowLast: {
    paddingBottom: 20,
  },
  statusContent: {
    flexDirection: "row",
    marginTop: 4,
  },
  statusLeft: {
    flex: 1,
  },
  statusChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusChipCompactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipCompactDot: {
    fontSize: 12,
    color: darkMode ? 'rgba(255,255,255,0.45)' : '#94a3b8',
    fontWeight: '400',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  statusChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.5)",
  },
  statusChipSmallText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22c55e",
  },
  statusSpacer: {
    height: 12,
  },
  daysLeftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  daysLeftText: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "500",
  },
  statusRight: {
    flexDirection: "row",
    gap: 16,
  },
  progressCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    color: darkMode ? "#FFFFFF" : "#475569",
  },
  progressPercent: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    color: darkMode ? "#F9FAFB" : Colors.subtext,
  },
  // Budget Summary styles
  budgetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 6,
    marginBottom: 6,
  },
  budgetLabel: {
    fontSize: 14,
    flex: 1,
    paddingRight: 12,
    color: darkMode ? "rgba(255,255,255,0.93)" : "#475569",
    fontWeight: "500",
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 0,
    maxWidth: "48%",
    color: darkMode ? "#F9FAFB" : Colors.text,
  },
  budgetValuePositive: {
    color: "#22c55e",
  },
  // Timeline styles
  timelineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  timelineLabel: {
    fontSize: 14,
    color: darkMode ? "#FFFFFF" : "#475569",
  },
  timelineValue: {
    fontSize: 14,
    fontWeight: "600",
    color: darkMode ? "#F9FAFB" : Colors.text,
  },
  timelineProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginTop: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  timelineProgressFill: {
    height: 8,
    borderRadius: 999,
  },
  timelineLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timelineEdgeLabel: {
    fontSize: 11,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#64748b",
  },
  // Health styles
  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  healthLabel: {
    fontSize: 14,
    color: darkMode ? "#FFFFFF" : "#475569",
  },
  healthPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.5)",
  },
  healthPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#22c55e",
  },
  // Team styles
  teamRoleLabel: {
    fontSize: 14,
    color: darkMode ? "#FFFFFF" : "#475569",
  },
  teamNotAssignedText: {
    fontSize: 14,
    color: darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : "#64748b",
    fontStyle: "italic",
  },
  // Spending Trend Card styles
  spendingCard: {
    marginTop: 12,
  },
  spendingCardInner: {
    backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : Colors.surface2,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148,163,184,0.12)' : Colors.line,
  },
  spendingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  chartBox: {
    marginTop: 8,
  },
  // Profile styles
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    shadowColor: "#22c55e",
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: darkMode ? "#020617" : Colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    color: darkMode ? "#e5e7eb" : "#000000",
    fontWeight: "700",
    fontSize: 16,
  },
  // Kickoff Card styles
  activationCardContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  activationCard: {
    backgroundColor: darkMode ? Colors.surface2 : '#F8FAFC',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(45, 255, 196, 0.25)' : 'rgba(45, 255, 196, 0.2)',
    shadowColor: '#2DFFC4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  activationCardClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  activationCardHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  activationCardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(45, 255, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
  },
  activationCardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  activationCardSubtitle: {
    fontSize: 15,
    color: Colors.sub,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  activationChecklist: {
    gap: 12,
    marginBottom: 24,
  },
  activationChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  },
  activationChecklistItemDone: {
    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.25)',
  },
  activationChecklistItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  activationChecklistItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  activationChecklistItemTextDone: {
    color: '#22c55e',
  },
  activationChecklistItemOptional: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.sub,
  },
  activationCardPrimaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
  },
  activationCardPrimaryGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activationCardPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  celebrationCard: {
    backgroundColor: darkMode ? Colors.surface2 : '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(45, 255, 196, 0.3)' : 'rgba(45, 255, 196, 0.2)',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  celebrationSubtitle: {
    fontSize: 15,
    color: Colors.sub,
    textAlign: 'center',
    lineHeight: 22,
  },
  smartSuggestionsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  smartSuggestionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.08)' : 'rgba(148, 163, 184, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)',
  },
  smartSuggestionsText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  commandCenterContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  commandCenterCard: {
    backgroundColor: darkMode ? Colors.surface2 : '#F8FAFC',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(45, 255, 196, 0.25)' : 'rgba(45, 255, 196, 0.2)',
    shadowColor: '#2DFFC4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  commandCenterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  commandCenterIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(45, 255, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
  },
  commandCenterHeaderText: {
    flex: 1,
  },
  commandCenterTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  commandCenterSubtitle: {
    fontSize: 14,
    color: Colors.sub,
    lineHeight: 20,
  },
  commandCenterActions: {
    gap: 12,
  },
  commandCenterActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(45, 255, 196, 0.2)' : 'rgba(45, 255, 196, 0.15)',
    gap: 12,
  },
  commandCenterActionTextContainer: {
    flex: 1,
  },
  commandCenterActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  commandCenterActionSubtext: {
    fontSize: 13,
    color: Colors.sub,
    marginTop: 2,
  },
  kickoffCardContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  kickoffCard: {
    backgroundColor: darkMode ? Colors.surface2 : '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(45, 255, 196, 0.2)' : 'rgba(45, 255, 196, 0.15)',
    position: 'relative',
  },
  kickoffCardClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  kickoffCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    marginTop: 8,
  },
  kickoffCardTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 28,
  },
  kickoffCardBody: {
    fontSize: 15,
    color: Colors.sub,
    lineHeight: 22,
    marginBottom: 20,
  },
  kickoffCardChecklist: {
    gap: 14,
    marginBottom: 24,
  },
  kickoffCardChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kickoffCardChecklistText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  kickoffCardButtons: {
    gap: 12,
  },
  kickoffCardPrimaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  kickoffCardPrimaryGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickoffCardPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  kickoffCardSecondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kickoffCardSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.sub,
  },
  });
};
