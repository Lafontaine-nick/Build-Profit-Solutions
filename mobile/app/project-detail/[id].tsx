import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ProjectDataProvider,
  useProjectData,
} from '../../contexts/ProjectDataContext';
import { useProjectList, UnifiedProject } from '../../contexts/ProjectListContext';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  StatusBar,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import { BlurView } from 'expo-blur';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { getColors } from '../../theme/getColors';
import OverviewScreen from '../../components/OverviewScreen';
import BudgetProfitMixCard from '../../components/BudgetProfitMixCard';
import BudgetTab from '../../components/BudgetTab';
import TimelineTabV2 from '../../components/TimelineTabV2';
import TeamTab from '../../components/TeamTab';
import ProjectCalendar from '../../components/ProjectCalendar';
import MessagesTab from '../../components/MessagesTab';
import {
  computeProfitForecast,
  contractCollectedPctFromMilestones,
  computeElapsedCalendarPct,
} from '../../src/lib/profitForecast';
import {
  computeProjectFinancials,
  sumPlannedCostFromBuckets,
  computeSpendingTrendCostStatus,
} from '../../src/lib/projectFinancials';
import { buildSpendingTrendSamplePoints } from '../../src/lib/projectChartTimeline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import AIAssistantModal from '../../components/AIAssistantModal';
import GradientRingBackInner from '../../components/GradientRingBackInner';
import ProjectActivationFlow from '../../components/ProjectActivationFlow';
import { setLastOpenedProjectId } from '../../lib/ai/userProjectSettings';
import api from '../../services/BackendAPI';
import { useAuth } from '@clerk/clerk-react';
import { useWalkthroughState } from '@/contexts/WalkthroughStateContext';
import { syncClerkTokenToAsyncStorage } from '../../utils/authTokenHelper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isDesktopWebLayoutWidth,
  DASHBOARD_WEB_MAX_CONTENT_WIDTH,
  WEB_DESKTOP_EDGE_HORIZONTAL,
} from '@/constants/ScreenLayout';
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
  applyMarkPaymentCollectedFromAction,
  computeOverallProgressExcludingDeposit,
} from '@/lib/markPaymentCollected';

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

type TabKey = "Overview" | "Budget" | "Timeline" | "Calendar" | "Team";

const AP_WT_STEPS: { tab: TabKey; title: string; body: string }[] = [
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
  {
    tab: 'Team',
    title: 'Team',
    body: 'Assign subs and crew roles so everyone knows who is responsible for each part of the job.',
  },
];

type ProjectLeakCard = {
  id: string;
  title: string;
  body: string;
  severity: 'high' | 'medium' | 'low';
};

const buildProjectLeakCards = ({
  project,
  metrics,
  liveTimelineMilestones,
}: {
  project: any;
  metrics: any;
  liveTimelineMilestones: any[];
}): ProjectLeakCard[] => {
  const cards: ProjectLeakCard[] = [];
  const status = String(project?.status || '').toLowerCase();
  const isCompleted = status === 'completed' || status === 'done' || status === 'finished';
  if (!metrics || isCompleted) return cards;

  const budgetCap = Number(metrics?.costBudgetCap || 0);
  const spentAndCommitted = Number(metrics?.totalSpent || 0) + Number(metrics?.committedPOsTotal || 0);
  const progress = Number(metrics?.scheduleProgress || 0);
  const expectedSpend = budgetCap > 0 ? budgetCap * (progress / 100) : 0;
  const spendAheadBy = Math.max(0, spentAndCommitted - expectedSpend);
  const pf = metrics?.profitForecast;
  const projectedMargin = Number(pf?.projectedMarginPct || 0);
  const originalMargin = Number(pf?.estimatedMarginPct || 0);
  const marginDrop = originalMargin > 0 && projectedMargin > 0 ? (originalMargin - projectedMargin) : 0;
  const expenses = Array.isArray(project?.expenses) ? project.expenses : Array.isArray(project?.projectData?.expenses) ? project.projectData.expenses : [];
  const missingReceipts = expenses.filter((expense: any) => !expense?.receiptUri || !String(expense.receiptUri).trim()).length;
  const overduePayments = (Array.isArray(liveTimelineMilestones) ? liveTimelineMilestones : []).filter((m: any) => {
    const due = m?.date ? new Date(m.date) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    const name = String(m?.title || m?.name || '').toLowerCase();
    const isPayment = name.includes('payment') || m?.type === 'payment';
    const isCollected = m?.paid === true || m?.collected === true || m?.status === 'paid';
    return isPayment && !isCollected && due.getTime() < Date.now();
  });

  if (progress > 0 && budgetCap > 0 && spendAheadBy > Math.max(1000, budgetCap * 0.08)) {
    cards.push({
      id: 'spend-ahead',
      severity: spendAheadBy > budgetCap * 0.15 ? 'high' : 'medium',
      title: 'Spend is ahead of progress',
      body: `This job is ${Math.round((spentAndCommitted / budgetCap) * 100)}% spent at ${Math.round(progress)}% progress. Review labor, materials, or scope before margin slips further.`,
    });
  }

  if (budgetCap > 0 && spentAndCommitted > budgetCap) {
    cards.push({
      id: 'over-budget',
      severity: spentAndCommitted > budgetCap * 1.1 ? 'high' : 'medium',
      title: 'Budget is already exceeded',
      body: `Current cost exposure is about $${Math.round(spentAndCommitted - budgetCap).toLocaleString()} over the planned cost budget. Check the biggest overrun categories first.`,
    });
  }

  if (marginDrop >= 5) {
    cards.push({
      id: 'margin-erosion',
      severity: marginDrop >= 10 ? 'high' : 'medium',
      title: 'Projected margin is eroding',
      body: `Projected margin has moved from about ${originalMargin.toFixed(1)}% to ${projectedMargin.toFixed(1)}%. Tighten cost control or recover scope before the job closes out.`,
    });
  }

  if (overduePayments.length > 0) {
    cards.push({
      id: 'collections',
      severity: overduePayments.length > 1 ? 'high' : 'medium',
      title: 'Collections need attention',
      body: `${overduePayments.length} payment milestone${overduePayments.length > 1 ? 's are' : ' is'} overdue. Slow collections can squeeze cash even when the job still looks profitable.`,
    });
  }

  if (missingReceipts >= 3) {
    cards.push({
      id: 'receipts',
      severity: missingReceipts >= 6 ? 'medium' : 'low',
      title: 'Cost backup is incomplete',
      body: `${missingReceipts} expense${missingReceipts > 1 ? 's are' : ' is'} missing receipts. Missing backup makes profit tracking less trustworthy.`,
    });
  }

  return cards.slice(0, 4);
};

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
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const id = params.id as string;
  const initialTab = (params.activeTab as TabKey) || 'Overview';
  const backToProjects = params.backToProjects === '1';
  const apWtRaw = params.apWt;
  const apWtRequest =
    apWtRaw === '1' || (Array.isArray(apWtRaw) && apWtRaw[0] === '1');
  const { projectData: contextProjectData, reloadFromStorage, addExpense, addPurchaseOrder, markPOReceived, addChangeOrder, updateTeam } = useProjectData();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { width: layoutWidth } = useWindowDimensions();
  const desktopWeb = isDesktopWebLayoutWidth(layoutWidth);
  const webScrollContentCap = desktopWeb
    ? {
        maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
        width: '100%' as const,
        alignSelf: 'center' as const,
      }
    : undefined;
  const styles = useMemo(() => getStyles(Colors, darkMode, desktopWeb), [Colors, darkMode, desktopWeb]);
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const {
    hydrated: wtHydrated,
    shouldShowFirstProject,
    markCompleted: markFirstProjectWalkthroughCompleted,
  } = useWalkthroughState();
  
  const user = {
    name: "Nick Lafontaine",
    initials: "NL",
  };
  
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
  const { getProjectById, updateProject, activeProjects, projects: allProjects } = useProjectList();
  const realProjectData = getProjectById(id as string);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [teamRefreshTrigger, setTeamRefreshTrigger] = useState(0);

  const [materialsCart, setMaterialsCart] = useState<any[]>([]);
  /** When there are no leak cards, section starts collapsed; tap header to expand details. */
  const [profitLeakEmptyExpanded, setProfitLeakEmptyExpanded] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
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
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

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

  const apWtSheetVisible =
    apWtWalkthroughEligible &&
    apWtStepIndex >= 0 &&
    apWtStepIndex < AP_WT_STEPS.length &&
    activeTab === AP_WT_STEPS[apWtStepIndex].tab;

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
      ? Math.min(AP_WT_STEPS.length - 1, Math.max(0, rawIdx))
      : 0;
    setApWtStepIndex(idx);
    setActiveTab(AP_WT_STEPS[idx].tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync tab once when walkthrough becomes eligible
  }, [apWtProgressLoaded, apWtComplete, apWtWalkthroughEligible]);

  const stripApWtFromRoute = useCallback(() => {
    try {
      const suffix = backToProjects ? '?backToProjects=1' : '';
      router.replace(`/project-detail/${id}${suffix}` as any);
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
    if (nextIdx >= AP_WT_STEPS.length) {
      await markFirstProjectWalkthroughCompleted('firstProject');
      stripApWtFromRoute();
      return;
    }
    setApWtStepIndex(nextIdx);
    setActiveTab(AP_WT_STEPS[nextIdx].tab);
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

  useEffect(() => {
    setProfitLeakEmptyExpanded(false);
  }, [id]);

  // Re-load live timeline when AI assistant opens or tab changes (to catch recent completions)
  useEffect(() => {
    if (!id) return;
    const refreshTimeline = async () => {
      try {
        const saved = await AsyncStorage.getItem(`bps.timeline.v2.${id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLiveTimelineMilestones(parsed);
          }
        }
      } catch (error) {
        // silent
      }
    };
    refreshTimeline();
  }, [id, showAIAssistant, activeTab]);

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

  const [initialAIQuestion, setInitialAIQuestion] = useState<string | undefined>(undefined);

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

  // Calculate approved change orders total
  const approvedChangeOrdersTotal = React.useMemo(() => {
    const changeOrders = realProjectData?.changeOrders || contextProjectData?.changeOrders || [];
    return changeOrders.reduce((sum: number, co: any) => {
      const amount = Number(co.amount || 0);
      const isApproved =
        (typeof co.approved === 'boolean' && co.approved) ||
        (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    }, 0);
  }, [realProjectData?.changeOrders, contextProjectData?.changeOrders]);

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
    // Add estimate data if available
    estimateData: realProjectData.estimateData || null,
    // CRITICAL: Use originalBudget (without change orders) for OverviewScreen
    // OverviewScreen will add change orders separately to get adjusted budget
    // budgetedValue includes change orders, which would cause double-counting
    budgeted: firstPositiveNumber(
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
    buckets: realProjectData.estimateData ? [
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

    /** When estimateData is missing or produced no lines — keep Materials/Labor cards from bucket + spend */
    const appendBucketFallbackLines = (targetLines: any[]) => {
      const hasMat = targetLines.some((l) => String(l?.category || '').toLowerCase().includes('material'));
      const hasLab = targetLines.some((l) => String(l?.category || '').toLowerCase() === 'labor');
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
      const labExpCtx = (contextProjectData?.expenses || []).reduce((sum: number, e: any) => {
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
    };

    if (!project?.estimateData) {
      console.log('⚠️ No estimate data — building budget category lines from buckets / spend');
      const lines: any[] = [];
      appendBucketFallbackLines(lines);
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
        : Math.max(materialsSpent, bucketMaterialsBudget, 0)
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
    const laborExpensesFromContext = (contextProjectData?.expenses || []).reduce((sum: number, e: any) => {
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
    // Priority: estimate's grandTotal (what user saw in estimate), then bidPrice, then estimatedCost
    return firstPositiveNumber(
      realProjectData?.estimateData?.grandTotal,  // PRIMARY: estimate's grandTotal ($7,200)
      realProjectData?.estimateData?.bidPrice,    // Secondary: estimate's bidPrice
      realProjectData?.estimateData?.total,       // Tertiary: estimate's total
      realProjectData?.bidPrice,                   // Fallback: project bidPrice
      realProjectData?.estimatedCost,              // Fallback: estimatedCost
      resolvedBidPrice ?? 0,                       // Last resort: resolved bid price
    ) ?? 0;
  }, [
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
  // CRITICAL: Use originalBudget (without change orders) for safeProjectData
  // This ensures OverviewScreen and other components see the correct original budget
  const safeProjectData: any = {
    ...projectDataBase,
    title: String(projectDataBase.title || 'Untitled Project'),
    status: String(projectDataBase.status || 'In Progress'),
    budgeted: originalBudget, // Use originalBudget (without COs), not projectData.budgeted (may include COs)
    // Ensure bid/estimate available for profit forecast (contextProjectData may not have these)
    bidPrice: (realProjectData as any)?.bidPrice ?? projectDataBase?.bidPrice,
    estimateData: (realProjectData as any)?.estimateData ?? projectDataBase?.estimateData,
    margin: (realProjectData as any)?.margin ?? projectDataBase?.margin,
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
    buckets: projectDataBase.buckets || [],
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
        const n = String(bucket?.name || '');
        if (n === 'Materials/Equipment' || n === 'Labor') {
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

  const projectLeakCards = useMemo(
    () =>
      buildProjectLeakCards({
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
          const metrics = overviewMetrics;
          const overviewCostStatusHeadline = metrics.spendingTrendCostStatus.text
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          const pf = metrics.profitForecast;
          const pfStatus = pf?.status;
          const marginAccent =
            pfStatus === 'Strong'
              ? '#22C55E'
              : pfStatus === 'Healthy'
                ? '#10B981'
                : pfStatus === 'Tight'
                  ? '#F59E0B'
                  : pfStatus === 'At Risk'
                    ? '#F97316'
                    : '#EF4444';
          const profitLeaksEmpty = projectLeakCards.length === 0;
          return (
            <View style={styles.wideContainer}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={BRAND_FRAME_GRADIENT_START}
                end={BRAND_FRAME_GRADIENT_END}
                style={styles.overviewGradientRing}
              >
                <View style={[styles.overviewInner, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}>
                  <View style={styles.overviewPageHeader}>
                    <Text style={styles.overviewPageTitle}>Project Overview</Text>
                    <Text style={styles.overviewPageSubtitle}>
                      Executive snapshot of contract, cost, and margin
                    </Text>
                  </View>

                  <BudgetProfitMixCard
                    currency={(safeProjectData as { currency?: string }).currency ?? 'USD'}
                    adjustedContractValue={metrics.financials.adjustedContractValue}
                    spentToDate={metrics.totalSpent}
                    committedPOsTotal={metrics.committedPOsTotal}
                    adjustedCostBudget={metrics.financials.adjustedCostBudget}
                    profitForecast={metrics.profitForecast}
                    originalEstimateMarginPct={Number(
                      (realProjectData as any)?.estimateData?.marginPercent ??
                      (realProjectData as any)?.estimateData?.margin ??
                      (realProjectData as any)?.estimateData?.marginPct ??
                      (safeProjectData as any)?.estimateData?.marginPercent ??
                      (safeProjectData as any)?.estimateData?.margin ??
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

                  {/* Project Status — cost/schedule progress */}
                  <View style={styles.innerCardContainer}>
                    <View style={styles.innerCard}>
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
                          <View
                            style={[
                              styles.projectStatusBarFill,
                              {
                                width: `${Math.min(100, metrics.budgetProgress)}%`,
                                backgroundColor: metrics.budgetColor,
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
                          <View
                            style={[
                              styles.projectStatusBarFill,
                              {
                                width: `${Math.min(100, metrics.scheduleProgress)}%`,
                                backgroundColor: metrics.daysLeftColor,
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

                  <View style={styles.innerCardContainer}>
                    <View style={styles.innerCard}>
                      <Pressable
                        onPress={() => {
                          if (!profitLeaksEmpty) return;
                          void Haptics.selectionAsync();
                          setProfitLeakEmptyExpanded((v) => !v);
                        }}
                        disabled={!profitLeaksEmpty}
                        accessibilityRole={profitLeaksEmpty ? 'button' : undefined}
                        accessibilityLabel={
                          profitLeaksEmpty
                            ? profitLeakEmptyExpanded
                              ? 'Profit leaks: none. Collapse section.'
                              : 'Profit leaks: none. Expand for details.'
                            : undefined
                        }
                      >
                        <View
                          style={[
                            styles.overviewCardHeaderRow,
                            profitLeaksEmpty && !profitLeakEmptyExpanded && { marginBottom: 0 },
                          ]}
                        >
                          <View style={styles.overviewCardHeaderTitleCluster}>
                            <View style={styles.iconBadge}>
                              <Feather name="alert-triangle" size={16} color="#22c55e" />
                            </View>
                            <View style={styles.overviewCardHeaderTitleWrap}>
                              <Text style={styles.overviewSectionTitle} numberOfLines={1}>
                                Profit Leak Detector
                              </Text>
                            </View>
                          </View>
                          {profitLeaksEmpty ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                flexShrink: 0,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '600',
                                  color: '#22c55e',
                                }}
                                numberOfLines={1}
                              >
                                No leaks
                              </Text>
                              <Feather
                                name={profitLeakEmptyExpanded ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={Colors.sub}
                              />
                            </View>
                          ) : null}
                        </View>
                      </Pressable>

                      {projectLeakCards.length > 0 ? (
                        projectLeakCards.map((card, index) => {
                          const accent =
                            card.severity === 'high'
                              ? '#f97316'
                              : card.severity === 'medium'
                                ? '#f59e0b'
                                : '#22d3ee';
                          return (
                            <View
                              key={card.id}
                              style={[
                                styles.projectLeakCard,
                                index === projectLeakCards.length - 1 && { marginBottom: 0 },
                              ]}
                            >
                              <View style={[styles.projectLeakAccent, { backgroundColor: accent }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.projectLeakTitle}>{card.title}</Text>
                                <Text style={styles.projectLeakBody}>{card.body}</Text>
                              </View>
                            </View>
                          );
                        })
                      ) : profitLeakEmptyExpanded ? (
                        <View style={[styles.projectLeakCard, { marginBottom: 0 }]}>
                          <View style={[styles.projectLeakAccent, { backgroundColor: '#22c55e' }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.projectLeakTitle}>No major profit leaks detected</Text>
                            <Text style={styles.projectLeakBody}>
                              This project looks stable right now. Keep costs, progress, and payment milestones updated so the app can flag issues early.
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Financial Health — headline + outlook only (figures live in snapshot above) */}
                  <View style={styles.innerCardContainer}>
                    <View style={styles.innerCard}>
                      <View style={styles.overviewCardHeaderRow}>
                        <View style={styles.overviewCardHeaderTitleCluster}>
                          <View style={styles.iconBadge}>
                            <Feather name="pie-chart" size={16} color="#22c55e" />
                          </View>
                          <View style={styles.overviewCardHeaderTitleWrap}>
                            <Text
                              style={styles.overviewSectionTitle}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              Financial Health
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.overviewFhStatusPill,
                            styles.overviewHeaderStatusChip,
                            {
                              backgroundColor: `${marginAccent}29`,
                              borderColor: `${marginAccent}38`,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.overviewFhStatusPillText, { color: marginAccent }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {pf?.status || '—'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.overviewFhSlimBody}>
                        Profit outlook reflects spend pace versus completion progress — distinct from cost status in the snapshot above.
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          );
        }
        case 'Budget':
          return (
            <View style={styles.wideContainer}>
              <BudgetTab data={budgetData} embedded profitForecastOverride={overviewMetrics.profitForecast} />
            </View>
          );
        case 'Timeline':
          return (
            <View style={styles.wideContainer}>
              <TimelineTabV2 embedded project={safeProjectData as any} />
            </View>
          );
        case 'Calendar':
          return (
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
          );
        case 'Team':
          return (
            <View style={styles.wideContainer}>
              <TeamTab embedded refreshTrigger={teamRefreshTrigger} />
            </View>
          );
        default:
          return <OverviewScreen project={safeProjectData} theme='dark' />;
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
        const idx = AP_WT_STEPS.findIndex((s) => s.tab === tab);
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

  const projectSegmentScroll = useMemo(() => {
    const tabs = (
      <>
        <SegmentTab
          label="Overview"
          icon="grid-outline"
          isActive={activeTab === 'Overview'}
          onPress={() => handleTabPress('Overview')}
          styles={styles}
        />
        <SegmentTab
          label="Budget"
          icon="wallet-outline"
          isActive={activeTab === 'Budget'}
          onPress={() => handleTabPress('Budget')}
          styles={styles}
        />
        <SegmentTab
          label="Timeline"
          icon="calendar-outline"
          isActive={activeTab === 'Timeline'}
          onPress={() => handleTabPress('Timeline')}
          styles={styles}
        />
        <SegmentTab
          label="Calendar"
          icon="calendar"
          isActive={activeTab === 'Calendar'}
          onPress={() => handleTabPress('Calendar')}
          styles={styles}
        />
        <SegmentTab
          label="Team"
          icon="people-outline"
          isActive={activeTab === 'Team'}
          onPress={() => handleTabPress('Team')}
          styles={styles}
        />
      </>
    );

    if (Platform.OS === 'web') {
      return (
        <View style={styles.segmentScrollRowWeb}>
          <View style={[styles.segmentInner, styles.segmentInnerWeb]}>{tabs}</View>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentInner}
        style={styles.segmentScrollView}
      >
        {tabs}
      </ScrollView>
    );
  }, [activeTab, styles, handleTabPress]);

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
      >
        <StatusBar barStyle="light-content" />

        {/* Background — opaque black so ScrollView never shows default system gray between sections */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: darkMode ? '#000000' : Colors.bg }]} />

        <ScrollView
          style={darkMode ? { backgroundColor: '#000000' } : undefined}
          contentContainerStyle={[
            styles.scrollContent,
            webScrollContentCap,
            apWtScrollPadBottom > 0 && {
              paddingBottom: 24 + apWtScrollPadBottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
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
            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>{projectTitle}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                {projectStatus === 'Just activated' ? (
                  <Animated.Text style={[styles.screenSubtitle, { opacity: justActivatedOpacity }]}>
                    {projectStatus}
                  </Animated.Text>
                ) : (
                  <Text style={styles.screenSubtitle}>{projectStatus}</Text>
                )}
                <Text style={styles.screenSubtitle}>·</Text>
                <Text style={styles.screenSubtitle}>{(safeProjectData as any)?.location || 'Unknown Location'}</Text>
              </View>
            </View>
            
            {/* Profile with glow */}
            <LinearGradient
              pointerEvents="box-none"
              colors={["#22c55e", "#22d3ee"]}
              style={styles.profileOuter}
            >
              <Pressable
                style={styles.profileInner}
                onPress={() => router.push("/profile")}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                <Text style={styles.profileInitials}>{user.initials}</Text>
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

          {/* SEGMENTED CONTROL — no walkthrough gradient wrapper here: highlight ring used slate/teal tints that read as gray inside the pill */}
          <View style={styles.wideContainer}>
            {darkMode ? (
              <View style={[styles.segmentContainer, styles.segmentTrackDark]}>
                {projectSegmentScroll}
              </View>
            ) : (
              <BlurView
                intensity={28}
                tint="light"
                style={[styles.segmentContainer, { backgroundColor: Colors.surface2 }]}
              >
                {projectSegmentScroll}
              </BlurView>
            )}
          </View>

          {/* AI PM — single stable slot under tabs (not floating over cards) */}
          <View style={[styles.wideContainer, styles.aiPmUnderTabs]}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAIAssistant(true);
              }}
              style={styles.aiFloatingInline}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.aiPmModeOn')}
            >
              <Ionicons name="sparkles" size={15} color="#34D399" />
              <Text style={[styles.aiFloatingText, styles.aiFloatingTextOn]} numberOfLines={1}>
                {t('dashboard.aiPmModeOn')}
              </Text>
            </Pressable>
          </View>

          {/* CONTENT */}
          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>

          <View style={{ height: 32 }} />
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
              title={AP_WT_STEPS[apWtStepIndex].title}
              body={AP_WT_STEPS[apWtStepIndex].body}
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

        {/* AI Assistant Modal with Project Context */}
        <AIAssistantModal
          visible={showAIAssistant}
          onClose={() => {
            setShowAIAssistant(false);
            setInitialAIQuestion(undefined); // Reset when closing
          }}
          initialQuestion={initialAIQuestion}
          context={JSON.stringify((() => {
            // Pull estimate data for fallback financial values
            const ed = (realProjectData as any)?.estimateData || (safeProjectData as any)?.estimateData || {};
            const contextExpenses: any[] = Array.isArray(contextProjectData?.expenses) ? contextProjectData.expenses : [];
            const safeExpenses: any[] = Array.isArray(safeProjectData?.expenses) ? safeProjectData.expenses : [];
            // Merge both sources to avoid stale snapshots while chat is open.
            const allExpenses: any[] = [...contextExpenses, ...safeExpenses].filter((expense: any, index: number, arr: any[]) => {
              const key = expense?.id || `${expense?.date || ''}-${expense?.vendor || ''}-${expense?.amount || 0}-${expense?.category || ''}`;
              return index === arr.findIndex((e: any) => (e?.id || `${e?.date || ''}-${e?.vendor || ''}-${e?.amount || 0}-${e?.category || ''}`) === key);
            });
            const computedSpent = allExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
            // Same bid resolution as Overview/Budget UI — grandTotal, bidPrice, total (revenue)
            let baseBid = firstPositiveNumber(
              (realProjectData as any)?.bidPrice,
              (safeProjectData as any)?.bidPrice,
              ed?.grandTotal,
              ed?.bidPrice,
              ed?.total,
              ed?.totalBid
            );
            // Fallback: derive bid from cost + margin when bid is missing. Default 10% if no margin.
            if (baseBid == null) {
              const costBase = Number(safeProjectData?.budgeted || 0);
              const marginPct = Number((safeProjectData as any)?.margin ?? ed?.marginPct ?? ed?.margin ?? 0);
              const effectiveMargin = marginPct > 0 && marginPct < 100 ? marginPct : 10;
              if (costBase > 0) baseBid = costBase / (1 - effectiveMargin / 100);
            }
            const approvedCOs = (safeProjectData?.changeOrders || []).reduce((sum: number, co: any) => {
              const amt = Number(co.amount || 0);
              const approved = (typeof co.approved === 'boolean' && co.approved) || (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
              return approved ? sum + amt : sum;
            }, 0);
            const contractValue = baseBid != null ? baseBid + approvedCOs : (Number(safeProjectData?.budgeted || 0) + approvedCOs);
            // Pre-computed profit forecast — same as Financial Health / Budget Totals UI. AI should use these.
            const pf = overviewMetrics?.profitForecast;
            return {
            screen: 'Project Detail',
            aiScope: 'project',
            currentProject: safeProjectData?.title || safeProjectData?.name || 'Current Project',
            projectName: safeProjectData?.title || safeProjectData?.name || 'Current Project',
            projectId: safeProjectData?.id,
            status: realProjectData?.status || safeProjectData?.status || 'estimate',
            // Financial data — pull from estimateData when top-level is 0
            bidPrice: baseBid,
            estimatedCost:
              overviewMetrics?.financials?.adjustedCostBudget ||
              pf?.forecastFinalCost ||
              realProjectData?.estimatedCost ||
              safeProjectData?.estimatedCost ||
              ed?.totalCost ||
              ed?.baseCost ||
              0,
            actualCost: realProjectData?.actualCost || contextProjectData?.spent || safeProjectData?.actualCost || computedSpent || 0,
            totalSpent: realProjectData?.totalSpent || contextProjectData?.spent || safeProjectData?.totalSpent || computedSpent || 0,
            expenses: allExpenses,
            expensesCount: allExpenses.length,
            bidTitle: safeProjectData?.title || safeProjectData?.name,
            bidTotal: baseBid,
            total: baseBid,
            // CRITICAL: For projected profit, Revenue = contract value (bid + approved change orders)
            approvedChangeOrdersTotal: approvedCOs,
            contractValue: contractValue > 0 ? contractValue : baseBid,
            adjustedCostBudget: overviewMetrics?.financials?.adjustedCostBudget,
            // Pre-computed profit forecast — matches Financial Health / Budget Totals. AI uses these when answering "what is projected profit"
            forecastFinalCost: pf?.forecastFinalCost,
            projectedProfit: pf?.projectedProfit,
            projectedMarginPct: pf?.projectedMarginPct,
            spendToDateMarginPct: pf?.spendToDateMarginPct,
            profitStatus: pf?.status,
            location: safeProjectData?.location || '',
            projectType: safeProjectData?.projectType || '',
            // Bid margin from estimateData only — top-level margin is overwritten with realized margin by updateProject
            margin: ed?.marginPercent ?? ed?.margin ?? ed?.marginPct ?? safeProjectData?.margin ?? 0,
            markup: safeProjectData?.markup || ed?.markupPct || ed?.markup || 0,
            overheadPct: ed?.overheadPct || 12,
            progress: safeProjectData?.overallProgressPct || safeProjectData?.progress || 0,
            // Include full estimateData so backend can access all fields; ensure marginPercent/margin so AI strip shows correct bid margin (e.g. 75%)
            // BID margin must come from estimateData only — top-level margin gets overwritten by updateProject with realized margin
            estimateData: (() => {
              const bidMargin = ed?.marginPercent ?? ed?.margin ?? ed?.marginPct;
              if (typeof bidMargin !== 'number' || !Number.isFinite(bidMargin)) return ed;
              return { ...ed, marginPercent: bidMargin, margin: bidMargin };
            })(),
            materialTotal: ed?.materialTotal || 0,
            laborTotal: ed?.laborTotal || 0,
            overheadTotal: ed?.overheadTotal || 0,
            profit: ed?.profit || 0,
            activeTab: activeTab,
            // Send computed buckets from budgetData (these are the correct/live values from estimate)
            buckets: budgetData.lines.map((line: any) => ({
              name: line.category,
              budget: Number(line.unitCost) || 0,
              bidBudget: Number(line.unitCost) || 0,
              spent: Number(line.spent) || 0,
            })),
            // Pre-computed budget values — use these directly, no backend guessing needed
            materialBudgetDirect: (() => {
              const matLine = budgetData.lines.find((l: any) =>
                (l.category || '').toLowerCase().includes('material')
              );
              return Number(matLine?.unitCost) || 0;
            })(),
            materialSpentDirect: (() => {
              return allExpenses
                .filter((e: any) => !(e.category || '').toLowerCase().includes('labor'))
                .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
            })(),
            milestoneCount: (safeProjectData?.milestones || []).length,
            expenseCount: allExpenses.length,
            changeOrderCount: (safeProjectData?.changeOrders || []).length,
            startDate: safeProjectData?.startISO || safeProjectData?.startDate,
            endDate: safeProjectData?.endISO || safeProjectData?.endDate,
            startISO: safeProjectData?.startISO || safeProjectData?.startDate,
            endISO: safeProjectData?.endISO || safeProjectData?.endDate,
            calendarEvents: calendarEvents || [],
            upcomingCalendarEvents: (calendarEvents || [])
              .filter((e: any) => {
                if (e.completed) return false;
                const eventDate = new Date(e.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);
                return eventDate >= today && eventDate <= nextWeek;
              })
              .sort((a: any, b: any) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return dateA - dateB;
              })
              .slice(0, 5),
            // Project-specific crew (includes members added via AI, e.g. Jack)
            crewMembers: (contextProjectData?.team as any)?.crewMembers || [],
            crewMemberPhones: (contextProjectData?.team as any)?.crewMemberPhones || {},
            // PM Mode: send live milestone data from AsyncStorage (loaded by TimelineTabV2)
            milestones: (() => {
              try {
                const normalizeStatus = (m: any) => {
                  const status = String(m?.status || '').toLowerCase();
                  const progress = Number(m?.progressPct ?? m?.progress ?? 0);
                  if (
                    status.includes('complete') ||
                    status.includes('paid') ||
                    status.includes('collected') ||
                    status.includes('received') ||
                    m?.isComplete === true ||
                    m?.completed === true ||
                    m?.isPaid === true ||
                    m?.paid === true ||
                    m?.collected === true ||
                    progress >= 100
                  ) return 'completed';
                  if (status.includes('progress') || progress > 0) return 'in_progress';
                  return status || 'pending';
                };
                const milestoneScore = (m: any) => {
                  const status = normalizeStatus(m);
                  const progress = Number(m?.progressPct ?? m?.progress ?? 0);
                  const completionBoost = status === 'completed' ? 1000 : status === 'in_progress' ? 500 : 0;
                  const dateBoost = m?.completedAt ? 10 : 0;
                  return completionBoost + progress + dateBoost;
                };

                // Merge milestone sources so schedule summaries stay live while assistant is open.
                // CRITICAL: liveTimelineMilestones comes from bps.timeline.v2.<id> (AsyncStorage)
                // which is where TimelineTabV2 saves completed/in_progress statuses.
                // This MUST be included first so completed statuses win in dedup.
                const rawMilestones = [
                  ...((liveTimelineMilestones || []) as any[]),
                  ...(((safeProjectData as any)?.milestones || []) as any[]),
                  ...(((realProjectData as any)?.milestones || []) as any[]),
                  ...(((contextProjectData as any)?.milestones || []) as any[]),
                  ...(((safeProjectData as any)?.weeklyPayments || []) as any[]),
                  ...(((realProjectData as any)?.weeklyPayments || []) as any[]),
                  ...(((contextProjectData as any)?.weeklyPayments || []) as any[]),
                  ...((((safeProjectData as any)?.paymentMilestones || []) as any[])),
                  ...((((realProjectData as any)?.paymentMilestones || []) as any[])),
                  ...((((contextProjectData as any)?.paymentMilestones || []) as any[])),
                  ...((((safeProjectData as any)?.estimateData?.paymentMilestones || []) as any[])),
                  ...((((realProjectData as any)?.estimateData?.paymentMilestones || []) as any[])),
                  ...((((contextProjectData as any)?.estimateData?.paymentMilestones || []) as any[])),
                  ...((((safeProjectData as any)?.estimateData?.weeklyPayments || []) as any[])),
                  ...((((realProjectData as any)?.estimateData?.weeklyPayments || []) as any[])),
                  ...((((contextProjectData as any)?.estimateData?.weeklyPayments || []) as any[])),
                ];

                // Deduplicate by id/title-date but keep the most complete/latest variant.
                const dedupedMap = new Map<string, any>();
                rawMilestones.forEach((m: any, index: number) => {
                  const key =
                    m?.id ||
                    `${m?.title || m?.name || ""}-${m?.plannedDate || m?.dueDate || m?.date || ""}-${index}`;
                  const existing = dedupedMap.get(key);
                  if (!existing || milestoneScore(m) >= milestoneScore(existing)) {
                    dedupedMap.set(key, m);
                  }
                });

                return Array.from(dedupedMap.values()).map((m: any) => ({
                  id: m.id,
                  title: m.title || m.name || `Payment ${m.index || ''}`,
                  amount: m.amount || m.paymentAmount || 0,
                  plannedDate: m.plannedDate || m.dueDate || m.date,
                  status: normalizeStatus(m),
                  progressPct:
                    Number(m.progressPct ?? m.progress ?? 0) ||
                    (normalizeStatus(m) === 'completed' ? 100 : 0),
                }));
              } catch { return []; }
            })(),
            // PM Mode: send estimate line items for AI context
            estimateLineItems: (() => {
              try {
                const est = (realProjectData as any)?.estimateData || {};
                const materials = est.materialLineItems || est.lineItems || (realProjectData as any)?.materialLineItems || [];
                const labor = est.laborLineItems || (realProjectData as any)?.laborLineItems || [];
                return [...materials, ...labor].map((li: any) => ({
                  name: li.name,
                  qty: li.qty || li.quantity || 1,
                  unitCost: li.unitCost || li.cost || 0,
                  totalCost: li.totalCost || (li.qty || 1) * (li.unitCost || 0),
                  category: li.category || 'Materials/Equipment',
                }));
              } catch { return []; }
            })(),
          };})())}
          onAction={async (action) => {
            console.log('📥 project-detail: Received action from AIAssistantModal:', {
              type: action.type,
              action: action
            });
            
            // Handle AI actions
            console.log('AI Action:', action);
            
            if (
              action.type === 'add_material' ||
              action.type === 'add_material_purchase' ||
              action.type === 'add_material_expense'
            ) {
              try {
                // First, ensure Clerk token is synced to AsyncStorage
                const clerkToken = await getToken();
                if (clerkToken) {
                  await syncClerkTokenToAsyncStorage(clerkToken);
                  console.log('✅ Synced Clerk token to AsyncStorage');
                } else {
                  console.warn('⚠️ No Clerk token available');
                }
                
                // First, add expense to local state
                addExpense({
                  id: `exp-${Date.now()}`,
                  category: action.category || 'Materials/Equipment',
                  vendor: action.vendor || '',
                  amount: action.amount || 0,
                  date: new Date().toISOString(),
                  notes: action.notes || `${action.category || 'Material'} from ${action.vendor || 'vendor'}`,
                  receiptUri: null,
                });
                
                // Then, sync to backend API
                const expenseData = {
                  amount: action.amount || 0,
                  category: action.category || 'Materials/Equipment',
                  vendor: action.vendor || '',
                  notes: action.notes || `${action.category || 'Material'} from ${action.vendor || 'vendor'}`,
                  date: new Date().toISOString().split('T')[0],
                };
                
                const response = await api.addExpense(id, expenseData);
                if (response.success) {
                  console.log('✅ Added expense to backend:', response.data);
                } else {
                  console.error('❌ Failed to add expense to backend:', response.error);
                  // Show error to user
                  Alert.alert(
                    'Authentication Error',
                    'There was an issue adding the expense due to authentication. Please log in again and try again.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error: any) {
                console.error('❌ Error adding expense:', error);
                // Check if it's an authentication error
                if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('token') || error.message?.includes('Access token required')) {
                  Alert.alert(
                    'Authentication Error',
                    'There was an issue with authentication. Please log in again and we can try adding the expense.',
                    [{ text: 'OK' }]
                  );
                } else {
                  // Show generic error
                  Alert.alert(
                    'Error',
                    `Failed to add expense: ${error.message || 'Unknown error'}`,
                    [{ text: 'OK' }]
                  );
                }
              }
              
              console.log('✅ Added expense:', action.amount, 'for', action.category);
            } else if (action.type === 'add_labor_expense') {
              try {
                // First, ensure Clerk token is synced to AsyncStorage
                const clerkToken = await getToken();
                if (clerkToken) {
                  await syncClerkTokenToAsyncStorage(clerkToken);
                  console.log('✅ Synced Clerk token to AsyncStorage');
                } else {
                  console.warn('⚠️ No Clerk token available');
                }
                
                // First, add expense to local state
                addExpense({
                  id: `exp-${Date.now()}`,
                  category: 'Labor',
                  vendor: action.vendor || action.trade || action.laborType || '',
                  amount: action.amount || 0,
                  date: new Date().toISOString(),
                  notes:
                    action.notes ||
                    (action.description ? String(action.description) : '') ||
                    `${action.trade || action.laborType || 'Labor'} expense`,
                  receiptUri: null,
                });
                
                // Then, sync to backend API
                const expenseData = {
                  amount: action.amount || 0,
                  category: 'Labor',
                  vendor: action.vendor || action.trade || action.laborType || '',
                  notes:
                    action.notes ||
                    (action.description ? String(action.description) : '') ||
                    `${action.trade || action.laborType || 'Labor'} expense`,
                  date: new Date().toISOString().split('T')[0],
                };
                
                const response = await api.addExpense(id, expenseData);
                if (response.success) {
                  console.log('✅ Added labor expense to backend:', response.data);
                } else {
                  console.error('❌ Failed to add labor expense to backend:', response.error);
                  Alert.alert(
                    'Authentication Error',
                    'There was an issue adding the expense due to authentication. Please log in again and try again.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error: any) {
                console.error('❌ Error adding labor expense:', error);
                if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('token') || error.message?.includes('Access token required')) {
                  Alert.alert(
                    'Authentication Error',
                    'There was an issue with authentication. Please log in again and we can try adding the expense.',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert(
                    'Error',
                    `Failed to add expense: ${error.message || 'Unknown error'}`,
                    [{ text: 'OK' }]
                  );
                }
              }
              
              console.log('✅ Added labor expense:', action.amount);
            } else if (action.type === 'add_purchase_order') {
              const actionProjectId = String(action.projectId ?? '').trim();
              const currentProjectId = String(id ?? '').trim();
              console.log('📦 Action handler: Received add_purchase_order action', {
                projectId: actionProjectId,
                currentProjectId,
                match: actionProjectId === currentProjectId,
                poNumber: action.poNumber,
                amount: action.amount,
                vendor: action.vendor,
                category: action.category
              });
              
              if (actionProjectId !== currentProjectId) {
                console.warn('⚠️ Action projectId mismatch:', {
                  actionProjectId,
                  currentId: currentProjectId
                });
                return;
              }
              
              // Create purchase order with "Pending" status
              const poData = {
                vendor: action.vendor || '',
                amount: Number(action.amount) || 0,
                category: action.category || 'Materials/Equipment',
                description: action.description || `${action.category || 'Material'} from ${action.vendor || 'vendor'}`,
                poNumber: action.poNumber || `PO-${Date.now().toString().slice(-6)}`,
                orderDate: new Date().toISOString(),
                expectedDelivery: action.expectedDelivery || null,
                status: 'Pending' as const, // CRITICAL: Always create as "Pending" - shows in Committed POs
              };
              
              console.log('📦 Creating purchase order:', {
                poNumber: poData.poNumber,
                amount: poData.amount,
                vendor: poData.vendor,
                category: poData.category,
                status: poData.status
              });
              
              // Add purchase order - this updates state and saves to AsyncStorage
              console.log('📦 Calling addPurchaseOrder with:', poData);
              addPurchaseOrder(poData);
              
              console.log('✅ Called addPurchaseOrder, waiting for state update...');
              
              // Wait for AsyncStorage write to complete, then reload
              // The addPurchaseOrder function saves to AsyncStorage immediately,
              // but we need to wait a bit for the write to complete before reloading
              setTimeout(async () => {
                console.log('🔄 Reloading from storage after PO creation...');
                
                // First, verify the PO was saved to AsyncStorage
                try {
                  const key = `bps.project.${id}`;
                  const saved = await AsyncStorage.getItem(key);
                  if (saved) {
                    const parsed = JSON.parse(saved);
                    const savedPOs = parsed.purchaseOrders || [];
                    const foundPO = savedPOs.find((po: any) => po.poNumber === poData.poNumber);
                    
                    console.log('📊 Purchase orders in AsyncStorage before reload:', {
                      count: savedPOs.length,
                      pending: savedPOs.filter((po: any) => po.status === 'Pending').length,
                      committedPOs: parsed.committedPOs || 0,
                      foundNewPO: !!foundPO,
                      newPO: foundPO ? { id: foundPO.id, poNumber: foundPO.poNumber, amount: foundPO.amount, status: foundPO.status } : null,
                      allPOs: savedPOs.map((po: any) => ({
                        id: po.id,
                        poNumber: po.poNumber,
                        amount: po.amount,
                        status: po.status,
                        vendor: po.vendor
                      }))
                    });
                    
                    if (!foundPO) {
                      console.error('❌ CRITICAL: Purchase order not found in AsyncStorage after save!');
                      console.error('❌ Expected PO:', poData);
                      console.error('❌ All POs in storage:', savedPOs);
                    } else {
                      console.log('✅ Purchase order found in AsyncStorage, proceeding with reload');
                    }
                  } else {
                    console.error('❌ CRITICAL: No data found in AsyncStorage!');
                  }
                } catch (error) {
                  console.error('❌ Error reading from AsyncStorage:', error);
                }
                
                // Now reload from storage to update all components
                console.log('🔄 Calling reloadFromStorage...');
                await reloadFromStorage();
                console.log('✅ Reloaded from storage');
                
                // Verify the state was updated after reload
                setTimeout(() => {
                  const currentPOs = contextProjectData?.purchaseOrders || [];
                  console.log('📊 Purchase orders in contextProjectData after reload:', {
                    count: currentPOs.length,
                    pending: currentPOs.filter((po: any) => po.status === 'Pending').length,
                    committedPOs: contextProjectData?.committedPOs || 0,
                    allPOs: currentPOs.map((po: any) => ({
                      id: po.id,
                      poNumber: po.poNumber,
                      amount: po.amount,
                      status: po.status,
                      vendor: po.vendor
                    }))
                  });
                }, 200);
              }, 1000); // Increased delay to ensure AsyncStorage write completes
            } else if (action.type === 'mark_po_received') {
              const actionProjectId = String(action.projectId ?? '').trim();
              const currentProjectId = String(id ?? '').trim();
              console.log('📦 Action handler: Received mark_po_received action', {
                projectId: actionProjectId,
                currentProjectId,
                match: actionProjectId === currentProjectId,
                poId: action.poId,
                poNumber: action.poNumber
              });
              
              if (actionProjectId !== currentProjectId) {
                console.warn('⚠️ Action projectId mismatch:', {
                  actionProjectId,
                  currentId: currentProjectId
                });
                return;
              }
              
              // Find the PO by ID or PO number
              const currentPOs = contextProjectData?.purchaseOrders || [];
              let poToMark = null;
              
              if (action.poId) {
                poToMark = currentPOs.find((po: any) => po.id === action.poId);
              }
              
              if (!poToMark && action.poNumber) {
                poToMark = currentPOs.find((po: any) => po.poNumber === action.poNumber);
              }
              
              if (!poToMark) {
                console.error('❌ PO not found to mark as received:', {
                  poId: action.poId,
                  poNumber: action.poNumber,
                  availablePOs: currentPOs.map((po: any) => ({ id: po.id, poNumber: po.poNumber, status: po.status }))
                });
                Alert.alert(
                  'PO Not Found',
                  `Could not find purchase order ${action.poNumber || action.poId} to mark as received.`
                );
                return;
              }
              
              if (poToMark.status === 'Received') {
                console.log('⚠️ PO already marked as received:', poToMark.poNumber);
                Alert.alert('Already Received', `Purchase order ${poToMark.poNumber} is already marked as received.`);
                return;
              }
              
              console.log('✅ Marking PO as received:', {
                poId: poToMark.id,
                poNumber: poToMark.poNumber,
                amount: poToMark.amount,
                currentStatus: poToMark.status
              });
              
              // Mark PO as received - this updates status, creates expense, and updates committedPOs
              markPOReceived(poToMark.id);
              
              console.log('✅ Called markPOReceived, waiting for state update...');
              
              // Wait for AsyncStorage write to complete, then reload
              setTimeout(async () => {
                console.log('🔄 Reloading from storage after marking PO as received...');
                
                // Verify the PO was updated in AsyncStorage
                try {
                  const key = `bps.project.${id}`;
                  const saved = await AsyncStorage.getItem(key);
                  if (saved) {
                    const parsed = JSON.parse(saved);
                    const savedPOs = parsed.purchaseOrders || [];
                    const foundPO = savedPOs.find((po: any) => 
                      po.id === poToMark.id || po.poNumber === poToMark.poNumber
                    );
                    
                    if (foundPO) {
                      console.log('✅ PO status updated in AsyncStorage:', {
                        poNumber: foundPO.poNumber,
                        status: foundPO.status,
                        expectedStatus: 'Received'
                      });
                    } else {
                      console.error('❌ PO not found in AsyncStorage after update!');
                    }
                  }
                } catch (error) {
                  console.error('❌ Error reading from AsyncStorage:', error);
                }
                
                // Reload from storage to update all components
                await reloadFromStorage();
                console.log('✅ Reloaded from storage after marking PO as received');
                
                // Verify the state was updated after reload
                setTimeout(() => {
                  const updatedPOs = contextProjectData?.purchaseOrders || [];
                  const updatedPO = updatedPOs.find((po: any) => 
                    po.id === poToMark.id || po.poNumber === poToMark.poNumber
                  );
                  
                  console.log('📊 PO status after reload:', {
                    found: !!updatedPO,
                    status: updatedPO?.status,
                    committedPOs: contextProjectData?.committedPOs || 0,
                    totalSpent: contextProjectData?.spent || 0
                  });
                }, 200);
              }, 1000);
            // ── PM MODE: TIMELINE ACTIONS ────────────────────────────────────
            } else if (action.type === 'mark_timeline_complete') {
              try {
                const storageKey = `bps.timeline.v2.${id}`;
                const saved = await AsyncStorage.getItem(storageKey);
                const milestones = saved ? JSON.parse(saved) : [];
                const pct = action.progressPct != null ? Number(action.progressPct) : 100;
                const isComplete = pct >= 100;
                const updated = milestones.map((m: any) => {
                  const matchId = action.itemId && m.id === action.itemId;
                  const matchName = action.itemName && (m.title || '').toLowerCase().includes((action.itemName || '').toLowerCase());
                  if (matchId || matchName) {
                    return {
                      ...m,
                      status: isComplete ? 'completed' : (pct > 0 ? 'in_progress' : m.status),
                      progressPct: pct,
                      ...(isComplete ? { completedAt: action.completedAt || new Date().toISOString() } : {}),
                    };
                  }
                  return m;
                });
                await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
                const label = action.itemName || 'Milestone';
                if (isComplete) {
                  console.log('✅ Milestone marked complete in AsyncStorage');
                  Alert.alert('✅ Done', `"${label}" marked as complete.`);
                } else {
                  console.log(`✅ Milestone updated to ${pct}% in AsyncStorage`);
                  Alert.alert('✅ Updated', `"${label}" updated to ${pct}% progress.`);
                }
              } catch (e) {
                console.error('❌ Error updating milestone:', e);
                Alert.alert('Error', 'Could not update timeline. Please update it in the Timeline tab.');
              }

            } else if (action.type === 'add_timeline_payment') {
              try {
                const storageKey = `bps.timeline.v2.${id}`;
                const saved = await AsyncStorage.getItem(storageKey);
                const milestones = saved ? JSON.parse(saved) : [];
                const newMilestone = {
                  id: `pm-${Date.now()}`,
                  title: action.title || 'Payment Milestone',
                  amount: Number(action.amount) || 0,
                  plannedDate: action.dueDate || new Date().toISOString().split('T')[0],
                  progressPct: 0,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                };
                milestones.push(newMilestone);
                await AsyncStorage.setItem(storageKey, JSON.stringify(milestones));
                console.log('✅ Payment milestone added to AsyncStorage');
                Alert.alert('✅ Added', `Payment milestone "${newMilestone.title}" ($${Number(action.amount).toLocaleString()}) added to your timeline.`);
              } catch (e) {
                console.error('❌ Error adding timeline payment:', e);
                Alert.alert('Error', 'Could not add milestone. Please add it in the Timeline tab.');
              }

            // ── PM MODE: ESTIMATE ACTIONS ─────────────────────────────────────
            } else if (action.type === 'add_estimate_line_item') {
              try {
                const newItem = {
                  id: `li-${Date.now()}`,
                  name: action.name || 'New Item',
                  qty: Number(action.qty) || 1,
                  unitCost: Number(action.unitCost) || 0,
                  totalCost: (Number(action.qty) || 1) * (Number(action.unitCost) || 0),
                  category: action.category || 'Materials/Equipment',
                  addedByAI: true,
                  createdAt: new Date().toISOString(),
                };
                // Update the project's materialLineItems via updateProject
                const currentProject = realProjectData as any;
                const existingItems = currentProject?.estimateData?.materialLineItems || currentProject?.materialLineItems || [];
                const updatedItems = [...existingItems, newItem];
                updateProject(id, {
                  estimateData: {
                    ...(currentProject?.estimateData || {}),
                    materialLineItems: updatedItems,
                  },
                });
                console.log('✅ Estimate line item added');
                Alert.alert('✅ Added', `"${newItem.name}" ($${newItem.totalCost.toLocaleString()}) added to your estimate.`);
              } catch (e) {
                console.error('❌ Error adding estimate line item:', e);
                Alert.alert('Error', 'Could not add line item. Please add it in the Estimate tab.');
              }

            } else if (action.type === 'assign_pm') {
              try {
                const targetId = (action.projectId || id) as string;
                if (targetId !== id) {
                  console.warn('⚠️ assign_pm for different project, ignoring');
                  return;
                }
                const pmName = (action.pmName || '').trim();
                if (!pmName) {
                  Alert.alert('Error', 'PM name is required.');
                  return;
                }
                // Remove PM from crew list so they don't appear twice (once as PM, once as crew)
                const currentCrew = (contextProjectData?.team as any)?.crewMembers || [];
                const currentPhones = (contextProjectData?.team as any)?.crewMemberPhones || {};
                const crewWithoutPm = currentCrew.filter(
                  (n: string) => n.trim().toLowerCase() !== pmName.toLowerCase()
                );
                updateTeam?.(true, pmName, crewWithoutPm.length, crewWithoutPm, currentPhones);
                console.log('✅ Assigned PM:', pmName);
                Alert.alert('✅ PM Assigned', `${pmName} is now the project manager for this project.`);
              } catch (e) {
                console.error('❌ Error assigning PM:', e);
                Alert.alert('Error', 'Could not assign project manager.');
              }

            } else if (action.type === 'add_team_member') {
              try {
                const targetId = (action.projectId || id) as string;
                if (targetId !== id) {
                  console.warn('⚠️ add_team_member for different project, ignoring');
                  return;
                }
                const tm = action.teamMember || {};
                const name = (tm.name || '').trim();
                const phone = (tm.phone || '').trim();
                if (!name) {
                  Alert.alert('Error', 'Team member name is required.');
                  return;
                }
                const currentCrew = (contextProjectData?.team as any)?.crewMembers || [];
                const currentPhones = (contextProjectData?.team as any)?.crewMemberPhones || {};
                const newCrew = [...currentCrew, name];
                const newPhones = phone ? { ...currentPhones, [name]: phone } : currentPhones;
                updateTeam?.(
                  Boolean((contextProjectData?.team as any)?.pmAssigned),
                  (contextProjectData?.team as any)?.pmName,
                  newCrew.length,
                  newCrew,
                  newPhones
                );
                console.log('✅ Added team member:', name, phone ? `(${phone})` : '');
                Alert.alert('✅ Team Member Added', `${name} has been added to the project team.`);
              } catch (e) {
                console.error('❌ Error adding team member:', e);
                Alert.alert('Error', 'Could not add team member.');
              }

            } else if (action.type === 'update_team_member_status') {
              try {
                const targetId = (action.projectId || id) as string;
                if (targetId !== id) return;
                const memberName = (action.memberName || '').trim();
                const status = (action.status || 'active').toLowerCase().replace(/\s+/g, '_');
                if (!memberName || (status !== 'active' && status !== 'off_duty')) {
                  Alert.alert('Error', 'Member name and status (active or off duty) are required.');
                  return;
                }
                const TEAM_STORAGE_KEY = 'bps.team.members';
                const saved = await AsyncStorage.getItem(TEAM_STORAGE_KEY);
                const team: Array<{ id: string; name: string; status?: string; [k: string]: any }> = saved ? JSON.parse(saved) : [];
                const nameLower = memberName.toLowerCase();
                const idx = team.findIndex(m => (m.name || '').trim().toLowerCase() === nameLower);
                if (idx >= 0) {
                  const newStatus = status === 'active' ? 'active' : 'off_duty';
                  team[idx] = { ...team[idx], status: newStatus };
                  await AsyncStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team));
                  setTeamRefreshTrigger(t => t + 1);
                  console.log('✅ Updated team member status:', memberName, '→', newStatus);
                  Alert.alert('✅ Status Updated', `${memberName} is now ${newStatus === 'active' ? 'active' : 'off duty'}.`);
                } else {
                  Alert.alert('Not Found', `Could not find a team member named "${memberName}".`);
                }
              } catch (e) {
                console.error('❌ Error updating team member status:', e);
                Alert.alert('Error', 'Could not update team member status.');
              }

            } else if (action.type === 'create_change_order') {
              try {
                console.log('🔄 Action handler: create_change_order', action);
                const co = action.changeOrder || {};
                
                // Map backend CO fields to the format expected by ProjectDataContext
                // Backend sends: description, cost, vendor, clientPrice, markupPct, status
                // Context expects: title, amount, approved, notes, status
                const mat = Number(co.materialsAmount);
                const lab = Number(co.laborAmount);
                const costTotal =
                  Number(co.cost || 0) ||
                  ((Number.isFinite(mat) ? mat : 0) + (Number.isFinite(lab) ? lab : 0));
                const total =
                  Number(co.clientPrice || co.amount || 0) ||
                  (Number(co.markupPct || 0) > 0
                    ? Math.round(costTotal * (1 + (Number(co.markupPct || 0) / 100)) * 100) / 100
                    : costTotal);
                const mappedCO = {
                  id: co.id || `co-${Date.now()}`,
                  title: co.description || co.title || 'Change Order',
                  amount: total,
                  approved: true, // User already approved via the dialog
                  notes: co.vendor ? `Vendor: ${co.vendor}` : '',
                  status: 'Approved',
                  date: co.createdAt || new Date().toISOString(),
                  cost: costTotal,
                  clientPrice: total,
                  markupPct: Number(co.markupPct || 0) || undefined,
                  materialsAmount: Number.isFinite(mat) ? mat : 0,
                  laborAmount: Number.isFinite(lab) ? lab : 0,
                };
                
                console.log('📋 Mapped CO for context:', mappedCO);
                
                // Use the proper addChangeOrder from ProjectDataContext
                // This handles budget adjustment, persistence, and PM events
                addChangeOrder(mappedCO);
                
                console.log('✅ Change order approved and added:', mappedCO.title, '$' + mappedCO.amount);
                Alert.alert(
                  '✅ Change Order Approved',
                  `"${mappedCO.title}"\nAmount: $${mappedCO.amount.toLocaleString()}\n\nThis has been added to your budget and change orders.`
                );
              } catch (e) {
                console.error('❌ Error creating change order:', e);
                Alert.alert('Error', 'Could not create change order. Please add it manually.');
              }

            } else if (action.type === 'populate_estimate') {
              try {
                console.log('📋 Action handler: populate_estimate', action);
                const est = action.estimate;
                const currentProject = realProjectData as any;
                updateProject(id, {
                  estimateData: {
                    ...(currentProject?.estimateData || {}),
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
                    profit: est.profit,
                    marginPct: est.marginPct,
                    perSqft: est.perSqft,
                    generatedByAI: true,
                    generatedAt: new Date().toISOString(),
                  },
                  projectType: est.projectType,
                  squareFootage: est.squareFootage,
                });
                console.log('✅ Estimate populated with AI-generated data');
                Alert.alert(
                  '✅ Estimate Generated',
                  `${est.materialLineItems?.length || 0} materials + ${est.laborLineItems?.length || 0} labor items\n\nTotal Bid: $${est.totalBid?.toLocaleString()}\nProfit: $${est.profit?.toLocaleString()} (${est.marginPct}%)`,
                  [{ text: 'View Estimate', style: 'default' }]
                );
              } catch (e) {
                console.error('❌ Error populating estimate:', e);
                Alert.alert('Error', 'Could not populate estimate. Please try again.');
              }

            } else if (action.type === 'mark_payment_collected') {
              try {
                console.log('💸 Action handler: mark_payment_collected', action);
                const projectFromList = getProjectById?.(id);
                const base = realProjectData || projectFromList;
                const mergedProject = base
                  ? {
                      ...base,
                      ...(base.projectData || {}),
                      estimateData:
                        base.estimateData || base.projectData?.estimateData,
                    }
                  : null;

                const { matched, updatedMilestones } =
                  await applyMarkPaymentCollectedFromAction(
                    String(id),
                    {
                      milestoneId: action.milestoneId,
                      milestoneName: action.milestoneName,
                      amount: action.amount,
                      collectedAt: action.collectedAt,
                    },
                    () => mergedProject
                  );

                if (updatedMilestones.length > 0) {
                  const overallProgress =
                    computeOverallProgressExcludingDeposit(updatedMilestones);
                  console.log(
                    `📊 Calculated progress: ${overallProgress}% (deposit excluded)`
                  );
                  if (updateProject && id) {
                    try {
                      updateProject(id, {
                        progress: overallProgress,
                        overallProgressPct: overallProgress,
                      });
                    } catch (error) {
                      console.error(`❌ Error calling updateProject:`, error);
                    }
                  }
                }

                reloadFromStorage();
                setTimeout(() => {
                  reloadFromStorage();
                }, 1000);

                if (matched) {
                  console.log('✅ Payment marked as collected with progressPct: 100');
                  Alert.alert(
                    '✅ Payment Collected',
                    `"${action.milestoneName || 'Payment'}" marked as collected ($${Number(action.amount || 0).toLocaleString()}).`
                  );
                } else {
                  Alert.alert(
                    'Could not update payment',
                    'No matching payment milestone was found. Open Timeline once so the schedule is saved, or mark the payment from there.'
                  );
                }
              } catch (e) {
                console.error('❌ Error marking payment collected:', e);
              }

            } else if (action.type === 'add_daily_log') {
              try {
                console.log('📝 Action handler: add_daily_log', action);
                const logKey = `daily_logs_${id}`;
                const raw = await AsyncStorage.getItem(logKey);
                const logs = raw ? JSON.parse(raw) : [];
                const newLog = {
                  id: action.id || `log-${Date.now()}`,
                  date: action.date || new Date().toISOString().split('T')[0],
                  noteText: action.noteText,
                  weather: action.weather || null,
                  crewCount: action.crewCount || null,
                  hoursWorked: action.hoursWorked || null,
                  createdAt: new Date().toISOString(),
                };
                logs.push(newLog);
                await AsyncStorage.setItem(logKey, JSON.stringify(logs));
                console.log('✅ Daily log saved');
                Alert.alert('✅ Log Saved', `Daily log for ${newLog.date} recorded.`);
              } catch (e) {
                console.error('❌ Error saving daily log:', e);
              }

            } else if (action.type === 'project_updated') {
              const actionProjectId = String(action.projectId ?? '').trim();
              const currentProjectId = String(id ?? '').trim();
              // AI assistant updated the project via backend - sync to ProjectDataContext
              console.log('🔄 Project updated by AI assistant, syncing to ProjectDataContext', {
                actionProjectId,
                currentProjectId,
                match: actionProjectId === currentProjectId,
                expensesCount: action.expenses?.length || 0,
                purchaseOrdersCount: action.purchaseOrders?.length || 0,
                totalSpent: action.totalSpent || 0,
                committedPOs: action.committedPOs,
                expenseDetails: action.expenses?.map((e: any) => ({ id: e.id, category: e.category, amount: e.amount, vendor: e.vendor })) || [],
                poDetails: action.purchaseOrders?.map((po: any) => ({ id: po.id, poNumber: po.poNumber, amount: po.amount, vendor: po.vendor, status: po.status })) || []
              });
              
              if (actionProjectId === currentProjectId) {
                // Sync expenses to ProjectDataContext
                if (action.expenses && action.expenses.length > 0) {
                  const currentExpenses = contextProjectData?.expenses || [];
                  const expenseIds = new Set(currentExpenses.map((e: any) => e.id));
                  
                  console.log('📊 Current expenses in ProjectDataContext:', {
                    count: currentExpenses.length,
                    ids: Array.from(expenseIds)
                  });
                  
                  // Add any new expenses that aren't already in ProjectDataContext
                  let addedCount = 0;
                  action.expenses.forEach((newExpense: any) => {
                    if (!expenseIds.has(newExpense.id)) {
                      console.log('➕ Adding expense to ProjectDataContext:', {
                        id: newExpense.id,
                        category: newExpense.category,
                        amount: newExpense.amount,
                        vendor: newExpense.vendor
                      });
                      addExpense({
                        id: newExpense.id,
                        category: newExpense.category || 'Materials/Equipment',
                        vendor: newExpense.vendor || '',
                        amount: newExpense.amount || 0,
                        date: newExpense.date || new Date().toISOString(),
                        notes: newExpense.notes || '',
                        receiptUri: newExpense.receiptUri || null,
                      });
                      addedCount++;
                    } else {
                      console.log('⏭️ Skipping expense (already exists):', newExpense.id);
                    }
                  });
                  
                  console.log(`✅ Added ${addedCount} new expenses to ProjectDataContext`);
                }
                
                // Sync purchase orders to ProjectDataContext
                if (action.purchaseOrders && action.purchaseOrders.length > 0) {
                  const currentPOs = contextProjectData?.purchaseOrders || [];
                  const poIds = new Set(currentPOs.map((po: any) => po.id));
                  const poNumbers = new Set(currentPOs.map((po: any) => po.poNumber).filter(Boolean));
                  
                  console.log('📊 Current purchase orders in ProjectDataContext:', {
                    count: currentPOs.length,
                    ids: Array.from(poIds),
                    poNumbers: Array.from(poNumbers)
                  });
                  
                  // Add new purchase orders OR update existing ones (e.g., when status changes to Received)
                  let addedPOCount = 0;
                  let updatedPOCount = 0;
                  action.purchaseOrders.forEach((newPO: any) => {
                    const existsById = newPO.id && poIds.has(newPO.id);
                    const existsByNumber = newPO.poNumber && poNumbers.has(newPO.poNumber);
                    
                    if (!existsById && !existsByNumber) {
                      console.log('➕ Adding purchase order to ProjectDataContext:', {
                        id: newPO.id,
                        poNumber: newPO.poNumber,
                        amount: newPO.amount,
                        vendor: newPO.vendor,
                        status: newPO.status
                      });
                      
                      // Create PO data with the ID from backend to ensure consistency
                      const poData = {
                        poNumber: newPO.poNumber || `PO-${Date.now().toString().slice(-6)}`,
                        vendor: newPO.vendor || '',
                        category: newPO.category || 'Materials/Equipment',
                        amount: newPO.amount || 0,
                        description: newPO.description || '',
                        orderDate: newPO.orderDate || new Date().toISOString(),
                        expectedDelivery: newPO.expectedDelivery || null,
                        status: (newPO.status || 'Pending') as 'Pending' | 'Received' | 'Cancelled' | 'Archived',
                        notes: newPO.notes,
                      };
                      
                      addPurchaseOrder(poData);
                      addedPOCount++;
                      
                      // Wait a bit for AsyncStorage write to complete before checking
                      setTimeout(async () => {
                        const key = `bps.project.${id}`;
                        const saved = await AsyncStorage.getItem(key);
                        if (saved) {
                          const parsed = JSON.parse(saved);
                          const savedPOs = parsed.purchaseOrders || [];
                          const foundPO = savedPOs.find((po: any) => 
                            po.poNumber === poData.poNumber || po.id === newPO.id
                          );
                          console.log('🔍 Verifying PO was saved:', {
                            found: !!foundPO,
                            poNumber: poData.poNumber,
                            savedPOsCount: savedPOs.length
                          });
                        }
                      }, 500);
                    } else {
                      // PO already exists - check if status changed (e.g., marked as received)
                      const existingPO = currentPOs.find((po: any) => 
                        (newPO.id && po.id === newPO.id) || (newPO.poNumber && po.poNumber === newPO.poNumber)
                      );
                      
                      if (existingPO && existingPO.status !== newPO.status) {
                        console.log('🔄 Updating existing purchase order status:', {
                          poNumber: newPO.poNumber,
                          oldStatus: existingPO.status,
                          newStatus: newPO.status
                        });
                        
                        // If status changed to Received, use markPOReceived to properly handle expense creation
                        if (newPO.status === 'Received' && existingPO.status === 'Pending') {
                          markPOReceived(existingPO.id);
                          updatedPOCount++;
                        } else {
                          // For other status changes, use updatePurchaseOrder
                          // Note: updatePurchaseOrder might not exist, so we'll need to handle this differently
                          // For now, just log it
                          console.log('⚠️ Status change not handled:', {
                            from: existingPO.status,
                            to: newPO.status
                          });
                        }
                      } else {
                        console.log('⏭️ Skipping purchase order (already exists with same status):', {
                          id: newPO.id,
                          poNumber: newPO.poNumber,
                          status: newPO.status
                        });
                      }
                    }
                  });
                  
                  console.log(`✅ Added ${addedPOCount} new purchase orders and updated ${updatedPOCount} existing purchase orders in ProjectDataContext`);
                  
                  // Wait for AsyncStorage writes to complete, then reload
                  setTimeout(async () => {
                    console.log('🔄 Reloading from storage after PO addition...');
                    await reloadFromStorage();
                    console.log('✅ ProjectDataContext reloaded after AI update');
                    
                    // Verify the PO is now in context
                    setTimeout(() => {
                      const currentPOs = contextProjectData?.purchaseOrders || [];
                      const foundPO = currentPOs.find((po: any) => 
                        action.purchaseOrders?.some((newPO: any) => 
                          po.poNumber === newPO.poNumber || po.id === newPO.id
                        )
                      );
                      console.log('🔍 Verifying PO in context after reload:', {
                        found: !!foundPO,
                        totalPOs: currentPOs.length,
                        committedPOs: contextProjectData?.committedPOs || 0
                      });
                    }, 200);
                  }, 1000);
                } else {
                  // No purchase orders to add, but still reload to ensure sync
                  reloadFromStorage().then(() => {
                    console.log('✅ ProjectDataContext reloaded after AI update (no POs to add)');
                  }).catch(err => {
                    console.error('❌ Error reloading ProjectDataContext:', err);
                  });
                }
              } else {
                console.warn('⚠️ Project update skipped:', {
                  reason: 'projectId mismatch',
                  actionProjectId: action.projectId,
                  currentId: id
                });
              }
            }
          }}
        />
      </SafeAreaView>
    );
  } catch (error) {
    console.error('Error rendering project detail:', error);
    return (
      <SafeAreaView
        style={[styles.root, Platform.OS === 'web' && desktopWeb && styles.rootDesktopWeb]}
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

type SegmentProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
  onPress: () => void;
};

const SegmentTab: React.FC<SegmentProps & { styles: any }> = React.memo(({ label, icon, isActive, onPress, styles }) => {
  const { darkMode } = useTheme();
  
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
            <Ionicons name={icon} size={16} color={darkMode ? "#050B13" : "#071018"} />
            <Text style={[styles.segmentLabel, styles.segmentLabelActive]} numberOfLines={1}>
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
        <Ionicons name={icon} size={16} color={darkMode ? "#E5F7FF" : "#475569"} />
        <Text style={styles.segmentLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  
  return (
    <ProjectDataProvider projectId={id as string}>
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
    paddingBottom: 24,
    flexGrow: 1,
    ...(darkMode ? { backgroundColor: '#000000' } : {}),
  },
  wideContainer: {
    marginHorizontal: -edge,
    paddingHorizontal: desktopWeb ? 8 : 4,
  },
  /** Green → blue gradient frame (1px ring via padding) */
  overviewGradientRing: {
    borderRadius: 30,
    padding: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  overviewInner: {
    backgroundColor: darkMode ? Colors.card : Colors.cardDark,
    borderRadius: 29,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
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
    color: darkMode ? "rgba(255,255,255,0.62)" : "#475569",
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
    color: darkMode ? "rgba(255,255,255,0.62)" : "#475569",
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
    color: darkMode ? "rgba(255,255,255,0.50)" : "#475569",
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
    color: darkMode ? "rgba(255,255,255,0.50)" : "#64748b",
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
    color: darkMode ? "rgba(255,255,255,0.58)" : "#64748b",
    fontWeight: "500",
  },
  overviewFhSlimBody: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    color: darkMode ? "rgba(255,255,255,0.58)" : "#475569",
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
    color: darkMode ? "rgba(255,255,255,0.85)" : "#475569",
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
    color: darkMode ? "rgba(255,255,255,0.77)" : "#64748b",
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
    color: darkMode ? "rgba(255,255,255,0.77)" : "#8891a0",
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
    color: darkMode ? "rgba(255,255,255,0.87)" : "#64748b",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 18,
  },
  backButtonWrapper: {
    marginRight: 12,
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
    fontSize: 32,
    fontWeight: "800",
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: darkMode ? Colors.subtext : "#475569",
    marginTop: 4,
  },
  inviteButtonContainer: {
    marginBottom: 18,
  },
  /** Match Dashboard tab pill: full capsule, emerald border, blur fill; horizontal scroll for 5 tabs */
  segmentContainer: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#19E180",
    marginBottom: 18,
  },
  /** Opaque black track — avoids gray from blur, gradients, or ScrollView defaults */
  segmentTrackDark: {
    backgroundColor: "#000000",
  },
  segmentScrollView: {
    flexGrow: 0,
    backgroundColor: "transparent",
  },
  /** Web: full-width row so tabs can use flex — replaces horizontal ScrollView in JSX */
  segmentScrollRowWeb: {
    width: "100%",
  },
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    gap: 4,
    backgroundColor: "transparent",
  },
  segmentInnerWeb: {
    width: "100%",
    gap: 0,
  },
  segmentTab: {
    flexShrink: 0,
    minWidth: 88,
    borderRadius: 999,
    marginHorizontal: 1,
    ...(Platform.OS === "web"
      ? { flex: 1, minWidth: 0, marginHorizontal: 0 }
      : {}),
  },
  segmentTabActive: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: darkMode ? 0.35 : 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 6,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: darkMode ? "#FFFFFF" : Colors.text,
  },
  segmentLabelActive: {
    color: darkMode ? "#050B13" : "#071018",
  },
  tabContent: {
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
    backgroundColor: darkMode ? "#0B0D10" : Colors.surface2,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: darkMode ? "rgba(255,255,255,0.06)" : Colors.line,
    shadowColor: "#000",
    shadowOpacity: darkMode ? 0.18 : 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: darkMode ? 4 : 2,
  },
  projectLeakCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.line,
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
    color: darkMode ? 'rgba(255,255,255,0.8)' : '#475569',
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
    color: darkMode ? "rgba(255,255,255,0.85)" : "#8891a0",
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
    color: darkMode ? "rgba(255,255,255,0.82)" : "#64748b",
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
    color: darkMode ? "rgba(255,255,255,0.82)" : "#64748b",
    fontStyle: "italic",
  },
  // Spending Trend Card styles
  spendingCard: {
    marginTop: 12,
  },
  spendingCardInner: {
    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
    borderRadius: 16,
    padding: 15,
    borderWidth: darkMode ? 1 : 1,
    borderColor: darkMode ? "rgba(148,163,184,0.16)" : Colors.line,
  },
  spendingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  aiPmUnderTabs: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 8,
  },
  aiFloatingInline: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.14)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
    maxWidth: "100%",
  },
  aiFloatingText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#34D399",
  },
  aiFloatingTextOn: {
    color: "#34D399",
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
