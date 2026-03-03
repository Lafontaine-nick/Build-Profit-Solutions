import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ProjectDataProvider,
  useProjectData,
} from '../../contexts/ProjectDataContext';
import { useProjectList, UnifiedProject } from '../../contexts/ProjectListContext';
import { View, ScrollView, StyleSheet, Text, Pressable, StatusBar, SafeAreaView, Dimensions, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { getColors } from '../../theme/getColors';
import OverviewScreen from '../../components/OverviewScreen';
import BudgetTab from '../../components/BudgetTab';
import TimelineTabV2 from '../../components/TimelineTabV2';
import TeamTab from '../../components/TeamTab';
import MessagesTab from '../../components/MessagesTab';
import SpendingTrendChart from '../../components/SpendingTrendChart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import AIAssistantModal from '../../components/AIAssistantModal';
import ProjectActivationFlow from '../../components/ProjectActivationFlow';
import { setLastOpenedProjectId } from '../../lib/ai/userProjectSettings';
import api from '../../services/BackendAPI';
import { useAuth } from '@clerk/clerk-expo';
import { syncClerkTokenToAsyncStorage } from '../../utils/authTokenHelper';

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

type TabKey = "Overview" | "Budget" | "Timeline" | "Team";

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
  const id = params.id as string;
  const initialTab = (params.activeTab as TabKey) || 'Overview';
  const backToProjects = params.backToProjects === '1';
  const { projectData: contextProjectData, reloadFromStorage, addExpense, addPurchaseOrder, markPOReceived } = useProjectData();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const { getToken } = useAuth();
  
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
  const { getProjectById, updateProject, activeProjects } = useProjectList();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  
  // Update activeTab when params change
  useEffect(() => {
    if (params.activeTab && params.activeTab !== activeTab) {
      setActiveTab(params.activeTab as TabKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.activeTab]);
  const [materialsCart, setMaterialsCart] = useState<any[]>([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showKickoffCard, setShowKickoffCard] = useState(false);
  const [activationChecklist, setActivationChecklist] = useState({
    timelineConfirmed: false,
    paymentScheduleReviewed: false,
    teamAssigned: false,
  });
  const allChecklistComplete = activationChecklist.timelineConfirmed && 
    activationChecklist.paymentScheduleReviewed && 
    activationChecklist.teamAssigned;
  const [expandedChecklistItem, setExpandedChecklistItem] = useState<string | null>(null);
  const [showActivationCelebration, setShowActivationCelebration] = useState(false);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [liveTimelineMilestones, setLiveTimelineMilestones] = useState<any[]>([]);

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

  // Auto-dismiss activation card when project becomes active
  useEffect(() => {
    if (!showKickoffCard || !id) return;

    const checkIfProjectActive = async () => {
      // Check if first cost was added
      const hasExpenses = (contextProjectData?.expenses || []).length > 0;
      const hasSpending = (contextProjectData?.spent || 0) > 0;
      
      // Check if first payment was logged
      const hasPayments = (contextProjectData?.milestones || []).some(
        (m: any) => m.status && m.status !== 'pending' && m.status !== 'scheduled'
      );
      
      // Check if project status changed to in_progress
      const status = realProjectData?.status?.toLowerCase();
      const isInProgress = status === 'in_progress' || status === 'active';
      
      // Check if any milestone has progress > 0
      const hasProgress = (contextProjectData?.milestones || []).some(
        (m: any) => (m.progressPct || 0) > 0
      );

      // Auto-dismiss if any of these conditions are met
      if (hasExpenses || hasSpending || hasPayments || isInProgress || hasProgress) {
        console.log('✅ Project is active - auto-dismissing activation card', {
          hasExpenses,
          hasSpending,
          hasPayments,
          isInProgress,
          hasProgress,
        });
        
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowKickoffCard(false);
        
        try {
          await AsyncStorage.setItem(`bps.kickoffShown.${id}`, 'true');
          await AsyncStorage.setItem(`bps.activationAutoDismissed.${id}`, 'true');
        } catch (error) {
          console.error('Error saving activation card dismissal:', error);
        }
      }
    };

    checkIfProjectActive();
  }, [
    showKickoffCard,
    contextProjectData?.expenses,
    contextProjectData?.spent,
    contextProjectData?.milestones,
    realProjectData?.status,
    id,
  ]);
  const [showActivationFlow, setShowActivationFlow] = useState(false);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('🔍 [STATE] showKickoffCard changed:', showKickoffCard, 'activeTab:', activeTab);
  }, [showKickoffCard, activeTab]);

  // Auto-dismiss activation card when project becomes active
  useEffect(() => {
    if (!showKickoffCard || !id) return;

    const checkIfProjectActive = async () => {
      // Check if first cost was added
      const hasExpenses = (contextProjectData?.expenses || []).length > 0;
      const hasSpending = (contextProjectData?.spent || 0) > 0;
      
      // Check if first payment was logged (milestone with non-pending status)
      const milestones = contextProjectData?.milestones || [];
      const hasPayments = milestones.some(
        (m: any) => m.status && m.status !== 'pending' && m.status !== 'scheduled'
      );
      
      // Check if project status changed to in_progress
      const status = realProjectData?.status?.toLowerCase();
      const isInProgress = status === 'in_progress' || status === 'active';
      
      // Check if any milestone has progress > 0
      const hasProgress = milestones.some(
        (m: any) => (m.progressPct || 0) > 0
      );

      // Auto-dismiss if any of these conditions are met
      if (hasExpenses || hasSpending || hasPayments || isInProgress || hasProgress) {
        console.log('✅ Project is active - auto-dismissing activation card', {
          hasExpenses,
          hasSpending,
          hasPayments,
          isInProgress,
          hasProgress,
        });
        
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowKickoffCard(false);
        
        try {
          await AsyncStorage.setItem(`bps.kickoffShown.${id}`, 'true');
          await AsyncStorage.setItem(`bps.activationAutoDismissed.${id}`, 'true');
        } catch (error) {
          console.error('Error saving activation card dismissal:', error);
        }
      }
    };

    checkIfProjectActive();
  }, [
    showKickoffCard,
    contextProjectData?.expenses,
    contextProjectData?.spent,
    contextProjectData?.milestones,
    realProjectData?.status,
    id,
  ]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [initialAIQuestion, setInitialAIQuestion] = useState<string | undefined>(undefined);
  const aiSuggestionAnim = useRef(new Animated.Value(0)).current;

  // Get real project data from ProjectListContext
  const realProjectData = getProjectById(id as string);
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

  // Check if we should show the intro card for newly activated projects
  useEffect(() => {
    const checkIntroCard = async () => {
      if (!id || !realProjectData) {
        console.log('⚠️ checkIntroCard: Missing id or realProjectData', { id, hasData: !!realProjectData });
        return;
      }
      
      const status = realProjectData.status?.toLowerCase();
      const isActiveProject = status === 'won' || status === 'in_progress' || status === 'active';
      
      console.log('🔍 checkIntroCard:', {
        id,
        status,
        isActiveProject,
        hasEstimateData: !!(realProjectData.estimateData || (realProjectData as any)?.estimateData),
        updatedAt: realProjectData.updatedAt,
        createdAt: realProjectData.createdAt,
      });
      
      if (!isActiveProject) {
        console.log('❌ Project is not active, hiding kickoff card');
        setShowKickoffCard(false);
        setShowAiSuggestions(false);
        return;
      }
      
      // Check if kickoff card has been shown for this project
      const kickoffKey = `bps.kickoffShown.${id}`;
      const suggestionsKey = `bps.aiSuggestionsShown.${id}`;
      try {
        const kickoffShown = await AsyncStorage.getItem(kickoffKey);
        const suggestionsShown = await AsyncStorage.getItem(suggestionsKey);
        
        // Check if this project was recently activated (created or updated in last 10 minutes)
        const updatedAt = realProjectData.updatedAt ? new Date(realProjectData.updatedAt).getTime() : 0;
        const createdAt = realProjectData.createdAt ? new Date(realProjectData.createdAt).getTime() : 0;
        const now = Date.now();
        const tenMinutesAgo = now - (10 * 60 * 1000);
        // Consider it recently activated if it was created or updated recently
        const isRecentlyActivated = (updatedAt > tenMinutesAgo) || (createdAt > tenMinutesAgo);
        
        // Check if this is the first project ever activated
        const firstProjectActivated = await AsyncStorage.getItem('bps.firstProjectActivated');
        
        // Count how many active projects exist (excluding current one)
        const otherActiveProjects = (activeProjects || []).filter(p => {
          const pStatus = (p.status || '').toLowerCase();
          const pIsActive = pStatus === 'won' || pStatus === 'in_progress' || pStatus === 'active';
          return pIsActive && p.id !== id;
        });
        
        // Check if this project was just created (has estimateData but no expenses/spending yet)
        // This helps catch projects created from onboarding even if timestamps are slightly off
        const hasEstimateData = !!(realProjectData.estimateData || (realProjectData as any)?.estimateData);
        const hasNoSpending = (!realProjectData.actualCost || realProjectData.actualCost === 0) &&
                               (!contextProjectData?.spent || contextProjectData.spent === 0);
        const looksLikeNewProject = hasEstimateData && hasNoSpending;
        
        // Check if this is the first project (no other active projects exist)
        // OR if the firstProjectActivated flag hasn't been set yet (first time ever)
        // This ensures we show the card even if activeProjects hasn't loaded yet
        const isFirstProject = firstProjectActivated !== 'true' || otherActiveProjects.length === 0;
        
        // Show kickoff card ONLY for the first project:
        // 1. It hasn't been shown for this project yet
        // 2. AND it's the first project (no other active projects exist OR flag hasn't been set)
        // After the first project, this card should never show again
        const shouldShowKickoff = kickoffShown !== 'true' && isFirstProject;
        
        console.log('🔍 [checkIntroCard] Kickoff card check:', {
          id,
          kickoffShown,
          isFirstProject,
          firstProjectActivated,
          otherActiveProjectsCount: otherActiveProjects.length,
          looksLikeNewProject,
          hasEstimateData,
          hasNoSpending,
          actualCost: realProjectData.actualCost,
          contextSpent: contextProjectData?.spent,
          shouldShowKickoff,
        });
        
        if (shouldShowKickoff) {
          // Mark that a project has been activated (set flag before showing card)
          await AsyncStorage.setItem('bps.firstProjectActivated', 'true');
          setShowKickoffCard(true);
          setShowAiSuggestions(false); // Hide AI suggestions when kickoff is showing
          console.log('✅ Showing kickoff card for project:', {
            id,
            isFirstProject,
            otherActiveProjectsCount: otherActiveProjects.length,
            firstProjectActivated,
            kickoffShown,
            isRecentlyActivated,
            looksLikeNewProject,
            hasEstimateData,
            hasNoSpending,
            shouldShowKickoff,
          });
          return;
        } else {
          console.log('❌ NOT showing kickoff card. Reasons:', {
            kickoffAlreadyShown: kickoffShown === 'true',
            notFirstProject: !isFirstProject,
            notNewProject: !looksLikeNewProject,
            hasOtherProjects: otherActiveProjects.length > 0,
            hasSpending: !hasNoSpending,
            noEstimateData: !hasEstimateData,
          });
        }

        // Only hide kickoff card if it was already shown
        if (kickoffShown === 'true') {
          setShowKickoffCard(false);
        }

        // Show AI suggestions only after kickoff has been dismissed (kickoffShown === 'true')
        // AND only if it hasn't been shown yet
        if (kickoffShown === 'true' && suggestionsShown !== 'true' && (isRecentlyActivated || looksLikeNewProject)) {
          const suggestions = generateAISuggestions(realProjectData);
          setAiSuggestions(suggestions);
          setShowAiSuggestions(true);
        } else {
          setShowAiSuggestions(false);
        }
      } catch (error) {
        console.error('Error checking kickoff card:', error);
        setShowKickoffCard(false);
        setShowAiSuggestions(false);
      }
    };
    
    checkIntroCard();
  }, [id, realProjectData?.status, realProjectData?.updatedAt, realProjectData?.createdAt, realProjectData?.estimateData, activeProjects, contextProjectData?.spent]);

  // Generate context-aware AI suggestions for newly activated projects
  const generateAISuggestions = (project: any): string[] => {
    const suggestions: string[] = [];
    const projectName = project?.title || 'this project';
    const budget = project?.bidPrice || project?.budgeted || 0;
    
    // Always include these core suggestions for newly activated projects
    suggestions.push(`What should I track first on ${projectName}?`);
    suggestions.push(`Is my labor budget realistic for ${projectName}?`);
    
    // Add budget-specific suggestion if budget is significant
    if (budget > 50000) {
      suggestions.push(`What's the biggest risk on ${projectName}?`);
    }
    
    // Add timeline suggestion
    if (project?.startDate || project?.endDate) {
      suggestions.push(`How long should ${projectName} take based on the estimate?`);
    } else {
      suggestions.push(`What timeline should I set for ${projectName}?`);
    }
    
    return suggestions;
  };

  useEffect(() => {
    if (showAiSuggestions) {
      aiSuggestionAnim.setValue(0);
      Animated.timing(aiSuggestionAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      aiSuggestionAnim.setValue(0);
    }
  }, [showAiSuggestions, aiSuggestionAnim]);

  const handleAISuggestion = (suggestion: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInitialAIQuestion(suggestion);
    setShowAIAssistant(true);
    // The AIAssistantModal will use initialQuestion prop to auto-send
  };

  const dismissAiSuggestions = async () => {
    if (!id) return;
    // Animate out with iOS-style spring animation
    Animated.spring(aiSuggestionAnim, {
      toValue: 0,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start(() => {
      setShowAiSuggestions(false);
    });
    try {
      await AsyncStorage.setItem(`bps.aiSuggestionsShown.${id}`, 'true');
    } catch (error) {
      console.error('Error saving AI suggestions dismissal:', error);
    }
  };

  const revealAiSuggestions = async () => {
    if (!id || !realProjectData) return;

    const status = realProjectData.status?.toLowerCase();
    const isActiveProject = status === 'won' || status === 'in_progress' || status === 'active';
    if (!isActiveProject) return;

    const updatedAt = realProjectData.updatedAt ? new Date(realProjectData.updatedAt).getTime() : 0;
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const isRecentlyActivated = updatedAt > fiveMinutesAgo;
    if (!isRecentlyActivated) return;

    try {
      const suggestionsShown = await AsyncStorage.getItem(`bps.aiSuggestionsShown.${id}`);
      if (suggestionsShown === 'true') return;

      const suggestions = generateAISuggestions(realProjectData);
      setAiSuggestions(suggestions);
      setShowAiSuggestions(true);
    } catch (error) {
      console.error('Error showing AI suggestions:', error);
    }
  };

  const dismissKickoffCard = async () => {
    if (!id) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowKickoffCard(false);
    try {
      await AsyncStorage.setItem(`bps.kickoffShown.${id}`, 'true');
    } catch (error) {
      console.error('Error saving kickoff card dismissal:', error);
    }

    // After kickoff is dismissed, reveal AI suggestions as a secondary moment
    await revealAiSuggestions();
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadOnFocus = async () => {
        if (!isActive) return;
        await loadMaterialsFromStorage();
        // Reload project data from AsyncStorage to get latest expenses
        if (reloadFromStorage) {
          await reloadFromStorage();
          console.log('🔄 Reloaded project data on focus, expenses:', contextProjectData?.expenses?.length || 0);
          console.log('📊 Materials/Equipment bucket spent:', 
            contextProjectData?.buckets?.find(b => 
              b.name?.toLowerCase().includes('materials') || 
              b.name?.toLowerCase().includes('equipment')
            )?.spent || 0
          );
        }
        
        // Re-check kickoff card when screen comes into focus (in case project data wasn't ready on mount)
        if (id && realProjectData) {
          const status = realProjectData.status?.toLowerCase();
          const isActiveProject = status === 'won' || status === 'in_progress' || status === 'active';
          
          if (isActiveProject && !showKickoffCard) {
            const kickoffKey = `bps.kickoffShown.${id}`;
            const firstProjectActivated = await AsyncStorage.getItem('bps.firstProjectActivated');
            const otherActiveProjects = (activeProjects || []).filter(p => {
              const pStatus = (p.status || '').toLowerCase();
              const pIsActive = pStatus === 'won' || pStatus === 'in_progress' || pStatus === 'active';
              return pIsActive && p.id !== id;
            });
            const isFirstProject = firstProjectActivated !== 'true' || otherActiveProjects.length === 0;
            const kickoffShown = await AsyncStorage.getItem(kickoffKey);
            
            // Check if it looks like a new project from onboarding
            const hasEstimateData = !!(realProjectData.estimateData || (realProjectData as any)?.estimateData);
            const hasNoSpending = (!realProjectData.actualCost || realProjectData.actualCost === 0) &&
                                   (!contextProjectData?.spent || contextProjectData.spent === 0);
            const looksLikeNewProject = hasEstimateData && hasNoSpending;
            
            // Show if it's the first project OR if it has estimateData (came from estimate)
            // Show ONLY if it's the first project (after first project, never show again)
            const shouldShow = kickoffShown !== 'true' && isFirstProject;
            
            console.log('🔍 [useFocusEffect] Kickoff card check:', {
              id,
              kickoffShown,
              isFirstProject,
              firstProjectActivated,
              otherActiveProjectsCount: otherActiveProjects.length,
              shouldShow,
            });
            
            if (shouldShow) {
              await AsyncStorage.setItem('bps.firstProjectActivated', 'true');
              setShowKickoffCard(true);
              setShowAiSuggestions(false);
              console.log('✅ [useFocusEffect] Showing kickoff card for project:', {
                id,
                isFirstProject,
                looksLikeNewProject,
                otherActiveProjectsCount: otherActiveProjects.length,
              });
            }
          }
        }
      };
      loadOnFocus();
      return () => {
        isActive = false;
      };
    }, [loadMaterialsFromStorage, reloadFromStorage, contextProjectData, id, realProjectData, activeProjects, showKickoffCard])
  );

  // Recalculate budget total from estimate data
  const recalculatedBudget = realProjectData?.estimateData ? (() => {
    const materials = materialsCart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const labor = (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
    const equipment = Number(realProjectData.estimateData.equipment) || 0;
    const facilities = Number(realProjectData.estimateData.facilities) || 0;
    const insuranceOverhead = Number(realProjectData.estimateData.insuranceOverhead) || 0;
    const otherOverhead = Number(realProjectData.estimateData.otherOverhead) || 0;
    const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
    const subtotal = materials + labor + equipment + facilities + insuranceOverhead + otherOverhead + permitCost;
    const markupPct = Number(realProjectData.estimateData.markupPct) || 0;
    const markup = subtotal * (markupPct / 100);
    return Math.round(subtotal + markup);
  })() : null;

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

    if (currentEstimatedCost === null && recalculatedBudget > 0) {
      updates.estimatedCost = recalculatedBudget;
    }

    if (Object.keys(updates).length > 0) {
      console.log('💰 Syncing missing budget fields with recalculated value:', updates);
      updateProject(id as string, updates);
    }
  }, [
    recalculatedBudget,
    realProjectData?.bidPrice,
    realProjectData?.estimatedCost,
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
    // Ensure all required fields for OverviewScreen - use recalculated budget or stored value
    budgeted: budgetedValue,
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
          const equipment = Number(realProjectData.estimateData.equipment) || 0;
          const facilities = Number(realProjectData.estimateData.facilities) || 0;
          const insuranceOverhead = Number(realProjectData.estimateData.insuranceOverhead) || 0;
          const otherOverhead = Number(realProjectData.estimateData.otherOverhead) || 0;
          const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
          const subtotal = materials + labor + equipment + facilities + insuranceOverhead + otherOverhead + permitCost;
          const markupPct = Number(realProjectData.estimateData.markupPct) || 0;
          return Math.round(subtotal * (markupPct / 100));
        })(), 
        bidBudget: (() => {
          const materials = materialsCart.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
          const labor = (realProjectData.estimateData.laborLineItems || []).reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
          const equipment = Number(realProjectData.estimateData.equipment) || 0;
          const facilities = Number(realProjectData.estimateData.facilities) || 0;
          const insuranceOverhead = Number(realProjectData.estimateData.insuranceOverhead) || 0;
          const otherOverhead = Number(realProjectData.estimateData.otherOverhead) || 0;
          const permitCost = Number(realProjectData.estimateData.permitCost) || 0;
          const subtotal = materials + labor + equipment + facilities + insuranceOverhead + otherOverhead + permitCost;
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
      // Start with estimate payment milestones as base
      const baseMilestones = (realProjectData.estimateData?.paymentMilestones || []).map((milestone: any, index: number) => ({
        id: milestone.id || `milestone-${index}`,
        title: milestone.name || `Payment ${index + 1}`,
        description: milestone.description || milestone.workDescription || '',
        dueDate: milestone.scheduledDate || new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending' as const,
        amount: Number(milestone.paymentAmount) || 0,
        percentage: Number(milestone.percentage) || 0,
      }));
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
    
    if (!project?.estimateData) {
      console.log('⚠️ No estimate data found, returning empty budget data');
      return {
        projectId: project?.id || id as string,
        currency: 'USD',
        lines: [],
        expenses: [],
        changeOrders: [],
        committedPOs: 0,
      };
    }

    const estimate = project.estimateData;
    const lines = [];

    console.log('📊 Estimate data:', estimate);
    console.log('📦 Materials cart:', materialsCart);

    const findBucket = (...keywords: string[]) => {
      const buckets = contextProjectData?.buckets || [];
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
    
    // Calculate from estimate (same source as Overview tab)
    const laborFromEstimate = estimate.laborLineItems && estimate.laborLineItems.length > 0
      ? estimate.laborLineItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
      : 0;
    
    // PREFER estimate.laborLineItems (matches Overview tab), then bucket budget
    const laborBudget = laborFromEstimate > 0 ? laborFromEstimate : (laborBucketBudget > 0 ? laborBucketBudget : 0);
    
    if (laborBudget > 0 || laborSpent > 0 || Boolean(laborBucket)) {
      lines.push({
        id: 'labor',
        category: 'Labor',
        description: 'Labor & Installation',
        qty: 1,
        unit: 'lump sum',
        unitCost: laborBudget, // Use estimate.laborLineItems (matches Overview tab)
        markupPct: 0, // No markup for spending tracking
        spent: laborSpent,
        aiSuggested: false,
      });
      
      console.log(`📊 Labor budget: estimate=$${laborFromEstimate}, bucket=$${laborBucketBudget}, final=$${laborBudget}`);
    }

    // Note: Overhead and Markup cards removed from BudgetTab as requested
    // These categories are still included in the OverviewScreen for complete budget visibility

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

  const budgetData = (() => {
    const base = convertToBudgetData(projectData);
    return {
      ...base,
      plannedBudget: budgetedValue ?? base.lines.reduce((sum: number, line: any) => sum + (Number(line?.unitCost) || 0), 0),
      expenses: (base.expenses || []).map((e: any) => ({
        ...e,
        date: e?.date ?? new Date().toISOString(),
      })),
      changeOrders: (base.changeOrders || []).map((co: any) => ({
        id: String(co.id ?? Date.now()),
        title: String(co.title ?? 'Change Order'),
        amount: Number(co.amount ?? 0),
        status: co.status ?? (co.approved ? 'Approved' : 'Draft'),
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
  console.log('📋 Final Start ISO:', projectData.startISO);
  console.log('📋 Final End ISO:', projectData.endISO);
  console.log('📋 Final Project Data:', projectData);
  console.log('📋 Budget Data:', budgetData);
  
  // Validate all critical data before rendering
  if (!projectData) {
    console.error('❌ Project data is undefined!');
    return (
      <View style={{ flex: 1, backgroundColor: '#0b1c38', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18, textAlign: 'center' }}>
          Error: Project data not found
        </Text>
      </View>
    );
  }
  
  // Ensure all critical properties are defined
  const safeProjectData = {
    ...projectData,
    title: String(projectData.title || 'Untitled Project'),
    status: String(projectData.status || 'In Progress'),
    budgeted: Number(projectData.budgeted || 0),
    spent: Number(projectData.spent || 0),
    // Ensure all nested objects are defined
    health: {
      costEfficiency: String(projectData.health?.costEfficiency || 'Good'),
      scheduleEfficiency: String(projectData.health?.scheduleEfficiency || 'Good'),
      projectStatus: String(projectData.health?.projectStatus || 'On Track'),
    },
    team: {
      pmAssigned: Boolean(projectData.team?.pmAssigned || false),
      pmName: String(((projectData as any).team?.pmName) || ''),
    },
    // Ensure all arrays are defined
    buckets: projectData.buckets || [],
    milestones: projectData.milestones || [],
    expenses: projectData.expenses || [],
    changeOrders: projectData.changeOrders || [],
    purchaseOrders: projectData.purchaseOrders || [],
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
    const approvedChangeOrdersTotal = (safeProjectData?.changeOrders || []).reduce(
      (sum: number, co: any) => {
        const amount = Number(co.amount || 0);
        const isApproved =
          (typeof co.approved === 'boolean' && co.approved) ||
          (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
        return isApproved ? sum + amount : sum;
      },
      0
    );
    const adjustedBudget = Number(safeProjectData?.budgeted || 0) + approvedChangeOrdersTotal;
    
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
    
    // Total Spent = Regular expenses + Received Purchase Orders
    const baseSpent =
      expensesTotal > 0
        ? expensesTotal
        : Number(safeProjectData?.spent ?? 0) > 0
        ? Number(safeProjectData?.spent ?? 0)
        : bucketSpentTotal;
    
    const totalSpent = baseSpent + receivedPOsTotal;

    const budgetProgress = adjustedBudget > 0 ? (totalSpent / adjustedBudget) * 100 : 0;
    const scheduleProgress = safeProjectData?.overallProgressPct || 0;

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

    const getProgressColor = (progress: number) => {
      if (progress < 50) return '#F97316';
      if (progress < 80) return '#FACC15';
      return '#22C55E';
    };

    const getStatusColor = (status: string) => {
      const normalized = status?.toLowerCase() || '';
      if (normalized.includes('good') || normalized.includes('on track')) return '#22c55e';
      if (normalized.includes('risk') || normalized.includes('at risk')) return '#f59e0b';
      if (normalized.includes('critical') || normalized.includes('behind')) return '#ef4444';
      return '#9ca3af';
    };

    // Generate spending data for chart
    const generateSpendingData = () => {
      const start = new Date(safeProjectData?.startISO || new Date().toISOString());
      const end = new Date(safeProjectData?.endISO || new Date().toISOString());
      const numPoints = 7;
      const timeSpan = end.getTime() - start.getTime();
      const now = Date.now();
      const currentProgress = Math.min((now - start.getTime()) / timeSpan, 1);

      const points: { date: string; spent: number }[] = [];
      for (let i = 0; i <= numPoints; i++) {
        const progress = (i / numPoints) * currentProgress;
        const date = new Date(start.getTime() + timeSpan * progress);
        const spent = Math.round(totalSpent * (progress / Math.max(currentProgress, 0.01)));

        if (spent > 0 && date <= new Date()) {
          points.push({
            date: date.toISOString().split('T')[0],
            spent,
          });
        }
      }

      if (points.length === 0 || points[points.length - 1].spent !== totalSpent) {
        points.push({
          date: new Date().toISOString().split('T')[0],
          spent: totalSpent,
        });
      }

      return points;
    };

    const formatCurrency = (amount: number) => {
      // Show accurate bid values with 2 decimal places, no rounding
      return `$${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    const baseBudget = Number(safeProjectData?.budgeted || 0);
    const remaining = adjustedBudget - totalSpent;
    const spentPercentUsed = adjustedBudget > 0 ? (totalSpent / adjustedBudget) * 100 : 0;

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

    return {
      adjustedBudget,
      totalSpent,
      baseBudget,
      remaining,
      budgetProgress: Math.min(100, Math.max(0, budgetProgress)),
      scheduleProgress: Math.min(100, Math.max(0, scheduleProgress)),
      daysLeft: getDaysLeft(),
      budgetColor: getBudgetColor(budgetProgress),
      progressColor: getProgressColor(scheduleProgress),
      statusColor: getStatusColor(safeProjectData?.health?.projectStatus || 'On Track'),
      spendingData: generateSpendingData(),
      // Display values
      budgetDisplay: formatCurrency(adjustedBudget),
      spentDisplay: formatCurrency(totalSpent),
      remainingDisplay: formatCurrency(remaining),
      baseBudgetDisplay: formatCurrency(baseBudget),
      changeOrdersDisplay: formatCurrency(approvedChangeOrdersTotal),
      totalBudgetDisplay: formatCurrency(adjustedBudget),
      spentPercentUsed: Math.min(100, Math.max(0, spentPercentUsed)),
      startDateDisplay: formatDate(safeProjectData?.startISO),
      endDateDisplay: formatDate(safeProjectData?.endISO),
      scheduleStatusLabel: getScheduleStatusLabel(),
      timelineProgressPercent: getTimelineProgressPercent(),
    };
  }, [safeProjectData, currentDate]); // Include currentDate to recalculate when date changes

  const name = safeProjectData?.title || 'Project';
  const lastUpdated = safeProjectData?.lastUpdated
    ? new Date(safeProjectData.lastUpdated).toLocaleDateString()
    : 'Invalid Date';

  const renderTabContent = () => {
    try {
      console.log('🔍 Rendering tab:', activeTab);
      console.log('🔍 Safe project data:', safeProjectData);
      
      switch (activeTab) {
        case 'Overview':
          const metrics = overviewMetrics;
          const project = safeProjectData;
          return (
            <View style={styles.wideContainer}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.overviewBorder}
              >
                <View style={styles.overviewInner}>
              {/* SECTION TITLE */}
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Project Overview</Text>
                </View>
              </View>
              <Text style={styles.cardSubtitle}>
                Summary of your project status & spending
              </Text>

              {/* 1. OVERVIEW SUMMARY */}
              <View style={styles.innerCardContainer}>
                <View style={styles.innerCard}>

                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={styles.iconBadge}>
                        <Feather name="info" size={16} color="#22c55e" />
                      </View>
                      <Text style={styles.cardTitle}>{name}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardSubtitle}>Updated {lastUpdated}</Text>

                  <View style={{ marginTop: 16 }}>
                    {/* Budget Row */}
                    <View style={styles.summaryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mutedLabel}>Budget</Text>
                        <Text style={styles.largeNumber}>
                          {metrics.budgetDisplay}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.mutedLabel}>Spent So Far</Text>
                        <Text style={styles.mediumNumber}>
                          {metrics.spentDisplay}
                        </Text>
                      </View>
                    </View>

                    {/* Remaining Row - Full Width */}
                    <View style={[styles.summaryRow, { marginTop: 16 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mutedLabel}>Remaining</Text>
                        <Text style={styles.mediumNumber}>
                          {metrics.remainingDisplay}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.mutedLabel}>Budget Used</Text>
                        <Text style={[styles.mediumNumber, { color: metrics.budgetColor }]}>
                          {metrics.budgetProgress.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* 2. PROJECT STATUS */}
              <View style={styles.innerCardContainer}>
                <View style={styles.innerCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={styles.iconBadge}>
                        <Feather name="bar-chart-2" size={16} color="#22c55e" />
                      </View>
                      <Text style={styles.cardTitle}>Project Status</Text>
                    </View>
                  </View>

                  <View style={styles.statusContent}>
                    {/* Left chips */}
                    <View style={styles.statusLeft}>
                      <LinearGradient
                        colors={metrics.statusColor === '#22c55e' 
                          ? ["rgba(34, 197, 94, 0.3)", "rgba(34, 211, 238, 0.2)"]
                          : metrics.statusColor === '#f59e0b'
                          ? ["rgba(245, 158, 11, 0.3)", "rgba(245, 158, 11, 0.2)"]
                          : ["rgba(239, 68, 68, 0.3)", "rgba(239, 68, 68, 0.2)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.statusChip}
                      >
                        <Text
                          style={[styles.statusChipText, { color: metrics.statusColor }]}
                        >
                          {project?.health?.projectStatus || 'On Track'}
                        </Text>
                      </LinearGradient>

                      <View style={styles.statusSpacer} />

                      <LinearGradient
                        colors={metrics.daysLeft && metrics.daysLeft < 30 
                          ? ["rgba(239, 68, 68, 0.3)", "rgba(245, 158, 11, 0.2)"]
                          : ["rgba(34, 211, 238, 0.3)", "rgba(34, 197, 94, 0.2)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.daysLeftBadge}
                      >
                        <Text style={styles.daysLeftText}>
                          {metrics.daysLeft} days left
                        </Text>
                      </LinearGradient>
                    </View>

                    {/* Right circular progress */}
                    <View style={styles.statusRight}>
                      <View style={styles.progressCircle}>
                        <CircularProgress
                          progress={metrics.budgetProgress}
                          color={metrics.budgetColor}
                        />
                        <Text style={styles.progressText}>Budget Used</Text>
                        <Text style={styles.progressPercent}>
                          {metrics.budgetProgress.toFixed(0)}%
                        </Text>
                      </View>

                      <View style={styles.progressCircle}>
                        <CircularProgress
                          progress={metrics.scheduleProgress}
                          color={metrics.progressColor}
                        />
                        <Text style={styles.progressText}>Schedule</Text>
                        <Text style={styles.progressPercent}>
                          {metrics.scheduleProgress.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3. SPENDING TREND */}
              {(() => {
                const labels = metrics.spendingData.map((point: { date: string; spent: number }) => {
                  const date = new Date(point.date);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                });
                const actualCumulative = labels.map((label, idx) => ({
                  label,
                  value: metrics.spendingData[idx]?.spent ?? 0,
                }));
                const plannedCumulative = labels.map((label, idx) => ({
                  label,
                  value: Math.round((metrics.adjustedBudget * (idx + 1)) / Math.max(labels.length, 1)),
                }));

                return (
                  <View style={styles.spendingCard}>
                    <View style={styles.spendingCardInner}>
                      <View style={styles.spendingHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={styles.iconBadge}>
                            <Feather name="trending-up" size={16} color="#22c55e" />
                          </View>
                          <Text style={styles.cardTitle}>Spending Trend</Text>
                        </View>
                        <Text style={styles.cardSubtitleRight}>
                          {metrics.spentPercentUsed.toFixed(1)}% Used
                        </Text>
                      </View>

                      <View style={styles.chartBox}>
                        <SpendingTrendChart
                          actualCumulative={actualCumulative}
                          plannedCumulative={plannedCumulative}
                          totalBudget={metrics.adjustedBudget}
                          showHeader={false}
                          showLegend={true}
                        />
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* 4. BUDGET SUMMARY */}
              <View style={styles.innerCardContainer}>
                <View style={styles.innerCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={styles.iconBadge}>
                        <Feather name="dollar-sign" size={16} color="#22c55e" />
                      </View>
                      <Text style={styles.cardTitle}>Budget Summary</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 16 }}>
                    <View style={styles.budgetRow}>
                      <Text style={styles.budgetLabel}>Base Budget</Text>
                      <Text style={styles.budgetValue}>{metrics.baseBudgetDisplay}</Text>
                    </View>
                    <View style={styles.budgetRow}>
                      <Text style={styles.budgetLabel}>Approved Change Orders</Text>
                      <Text style={styles.budgetValue}>
                        {metrics.changeOrdersDisplay}
                      </Text>
                    </View>
                    <View style={styles.budgetRow}>
                      <Text style={styles.budgetLabel}>Total Budget</Text>
                      <Text style={styles.budgetValue}>{metrics.totalBudgetDisplay}</Text>
                    </View>
                    <View style={styles.budgetRow}>
                      <Text style={styles.budgetLabel}>Spent So Far</Text>
                      <Text style={[styles.budgetValue, styles.budgetValuePositive]}>
                        {metrics.spentDisplay}
                      </Text>
                    </View>
                    <View style={styles.budgetRow}>
                      <Text style={styles.budgetLabel}>Remaining</Text>
                      <Text style={styles.budgetValue}>{metrics.remainingDisplay}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 5. TIMELINE */}
              <View style={styles.innerCardContainer}>
                <View style={styles.innerCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={styles.iconBadge}>
                        <Feather name="calendar" size={16} color="#22c55e" />
                      </View>
                      <Text style={styles.cardTitle}>Timeline</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 16 }}>
                    <View style={styles.timelineRow}>
                      <Text style={styles.timelineLabel}>Start</Text>
                      <Text style={styles.timelineValue}>{metrics.startDateDisplay}</Text>
                    </View>
                    <View style={styles.timelineRow}>
                      <Text style={styles.timelineLabel}>End</Text>
                      <Text style={styles.timelineValue}>{metrics.endDateDisplay}</Text>
                    </View>
                    <View style={styles.timelineRow}>
                      <Text style={styles.timelineLabel}>Days Left</Text>
                      <Text style={styles.timelineValue}>{metrics.daysLeft} days</Text>
                    </View>
                    <View style={styles.timelineRow}>
                      <Text style={styles.timelineLabel}>Schedule Status</Text>
                      <View style={styles.statusChipSmall}>
                        <Text style={styles.statusChipSmallText}>
                          {metrics.scheduleStatusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Timeline progress bar */}
                    <View style={styles.timelineProgressTrack}>
                      <LinearGradient
                        colors={["#22c55e", "#22d3ee"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.timelineProgressFill,
                          { width: `${metrics.timelineProgressPercent}%` },
                        ]}
                      />
                    </View>
                    <View style={styles.timelineLabelsRow}>
                      <Text style={styles.timelineEdgeLabel}>Start</Text>
                      <Text style={styles.timelineEdgeLabel}>Today</Text>
                      <Text style={styles.timelineEdgeLabel}>End</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 6. HEALTH */}
              <View style={styles.innerCardContainer}>
                <View style={styles.innerCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={styles.iconBadge}>
                        <Feather name="activity" size={16} color="#22c55e" />
                      </View>
                      <Text style={styles.cardTitle}>Health</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 16 }}>
                    <View style={styles.healthRow}>
                      <Text style={styles.healthLabel}>Cost Efficiency</Text>
                      <View style={styles.healthPill}>
                        <Text style={styles.healthPillText}>
                          {project?.health?.costEfficiency || 'Good'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.healthRow}>
                      <Text style={styles.healthLabel}>Schedule Efficiency</Text>
                      <View style={styles.healthPill}>
                        <Text style={styles.healthPillText}>
                          {project?.health?.scheduleEfficiency || 'Good'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.healthRow}>
                      <Text style={styles.healthLabel}>Project Status</Text>
                      <View style={styles.healthPill}>
                        <Text style={styles.healthPillText}>
                          {project?.health?.projectStatus || 'On Track'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* 7. TEAM */}
              <View style={styles.innerCardContainer}>
                <View style={styles.innerCard}>
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={styles.iconBadge}>
                        <Feather name="users" size={16} color="#22c55e" />
                      </View>
                      <Text style={styles.cardTitle}>Team</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.teamRoleLabel}>PM</Text>
                    <Text style={styles.teamNotAssignedText}>Not assigned</Text>
                  </View>
                </View>
              </View>
                </View>
              </LinearGradient>
            </View>
          );
        case 'Budget':
          return (
            <View style={styles.wideContainer}>
              <View style={styles.budgetHelperText}>
                <Text style={[styles.budgetHelperTextMain, { color: Colors.sub }]}>
                  Budget locked from estimate
                </Text>
                <Text style={[styles.budgetHelperTextSub, { color: Colors.sub }]}>
                  Changes are tracked automatically
                </Text>
              </View>
              <BudgetTab data={budgetData} embedded />
            </View>
          );
        case 'Timeline':
          return <TimelineTabV2 project={safeProjectData as any} />;
        case 'Team':
          return <TeamTab />;
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
    },
    []
  );

  // Get project title for header
  const projectTitle = useMemo(() => {
    return safeProjectData?.title || 'Project Details';
  }, [safeProjectData?.title]);

  const projectStatus = useMemo(() => {
    const status = safeProjectData?.status || 'In Progress';
    const updatedAt = safeProjectData?.updatedAt ? new Date(safeProjectData.updatedAt).getTime() : 0;
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const isRecentlyActivated = updatedAt > fiveMinutesAgo;
    
    if (status === 'estimate') return 'Draft';
    if (status === 'bid_submitted') return 'Submitted';
    if (status === 'won' || status === 'in_progress') {
      // Show "Just activated" for recently activated projects
      if (isRecentlyActivated && (status === 'won' || status === 'in_progress')) {
        return 'Just activated';
      }
      return 'Active';
    }
    if (status === 'completed') return 'Completed';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, [safeProjectData?.status, safeProjectData?.updatedAt]);

  try {
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
          <View style={[styles.headerRow, styles.wideContainer]}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <Pressable
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
                </Pressable>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>{projectTitle}</Text>
              <Text style={styles.screenSubtitle}>{projectStatus} · {(safeProjectData as any)?.location || 'Unknown Location'}</Text>
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

          {/* Project Kickoff Card - Actionable setup steps */}
          {(() => {
            console.log('🎨 [RENDER] Kickoff card render check:', {
              showKickoffCard,
              activeTab,
              willRender: showKickoffCard && activeTab === 'Overview',
            });
            return null;
          })()}
          {/* Project Activation Card - Emotional anchor for newly activated projects */}
          {showKickoffCard && activeTab === 'Overview' && (
            <View style={[styles.activationCardContainer, styles.wideContainer]}>
              <View style={styles.activationCard}>
                <TouchableOpacity
                  style={styles.activationCardClose}
                  onPress={dismissKickoffCard}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={Colors.sub} />
                </TouchableOpacity>
                
                <View style={styles.activationCardHeader}>
                  <View style={styles.activationCardIconContainer}>
                    <Ionicons name="rocket" size={28} color="#2DFFC4" />
                  </View>
                  <Text style={styles.activationCardTitle}>Project activated</Text>
                  <Text style={styles.activationCardSubtitle}>
                    Your estimate is now locked in. Let's get the job ready to run smoothly.
                  </Text>
                </View>
                
                {/* Tappable Activation Checklist */}
                <View style={styles.activationChecklist}>
                  <TouchableOpacity
                    style={[
                      styles.activationChecklistItem,
                      activationChecklist.timelineConfirmed && styles.activationChecklistItemDone,
                    ]}
                    onPress={() => {
                      if (expandedChecklistItem === 'timeline') {
                        setExpandedChecklistItem(null);
                      } else {
                        setExpandedChecklistItem('timeline');
                        setShowActivationFlow(true);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activationChecklistItemLeft}>
                      {activationChecklist.timelineConfirmed ? (
                        <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                      ) : (
                        <Ionicons name="time-outline" size={22} color={Colors.sub} />
                      )}
                      <Text style={[
                        styles.activationChecklistItemText,
                        activationChecklist.timelineConfirmed && styles.activationChecklistItemTextDone,
                      ]}>
                        Timeline confirmed
                      </Text>
                    </View>
                    {!activationChecklist.timelineConfirmed && (
                      <Ionicons name="chevron-forward" size={18} color={Colors.sub} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.activationChecklistItem,
                      activationChecklist.paymentScheduleReviewed && styles.activationChecklistItemDone,
                    ]}
                    onPress={() => {
                      if (expandedChecklistItem === 'payment') {
                        setExpandedChecklistItem(null);
                      } else {
                        setExpandedChecklistItem('payment');
                        setShowActivationFlow(true);
                        // Navigate to step 2
                        setTimeout(() => {
                          // This will be handled by the modal
                        }, 100);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activationChecklistItemLeft}>
                      {activationChecklist.paymentScheduleReviewed ? (
                        <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                      ) : (
                        <Ionicons name="calendar-outline" size={22} color={Colors.sub} />
                      )}
                      <Text style={[
                        styles.activationChecklistItemText,
                        activationChecklist.paymentScheduleReviewed && styles.activationChecklistItemTextDone,
                      ]}>
                        Payment schedule reviewed
                      </Text>
                    </View>
                    {!activationChecklist.paymentScheduleReviewed && (
                      <Ionicons name="chevron-forward" size={18} color={Colors.sub} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.activationChecklistItem,
                      activationChecklist.teamAssigned && styles.activationChecklistItemDone,
                    ]}
                    onPress={() => {
                      if (expandedChecklistItem === 'team') {
                        setExpandedChecklistItem(null);
                      } else {
                        setExpandedChecklistItem('team');
                        setShowActivationFlow(true);
                        // Navigate to step 3
                        setTimeout(() => {
                          // This will be handled by the modal
                        }, 100);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activationChecklistItemLeft}>
                      {activationChecklist.teamAssigned ? (
                        <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                      ) : (
                        <Ionicons name="people-outline" size={22} color={Colors.sub} />
                      )}
                      <Text style={[
                        styles.activationChecklistItemText,
                        activationChecklist.teamAssigned && styles.activationChecklistItemTextDone,
                      ]}>
                        Team assigned
                        <Text style={styles.activationChecklistItemOptional}> (optional)</Text>
                      </Text>
                    </View>
                    {!activationChecklist.teamAssigned && (
                      <Ionicons name="chevron-forward" size={18} color={Colors.sub} />
                    )}
                  </TouchableOpacity>
                </View>
                
                {/* Quick Action Button */}
                <TouchableOpacity
                  style={styles.activationCardPrimaryButton}
                  onPress={() => {
                    if (allChecklistComplete) {
                      dismissKickoffCard();
                      return;
                    }
                    setShowActivationFlow(true);
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#2DFFC4', '#00A6FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.activationCardPrimaryGradient}
                  >
                    <Text style={styles.activationCardPrimaryText}>
                      {allChecklistComplete
                        ? 'View live project' 
                        : 'Start project setup'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

          {/* Activation Celebration Overlay - Disabled to prevent glitching */}
          {/* The activation card provides sufficient visual feedback */}

          {/* Smart First Action Suggestions */}
          {showKickoffCard && activeTab === 'Overview' && (
            <View style={[styles.smartSuggestionsContainer, styles.wideContainer]}>
              <View style={styles.smartSuggestionsCard}>
                <Ionicons name="bulb-outline" size={18} color={Colors.sub} />
                <Text style={[styles.smartSuggestionsText, { color: Colors.sub }]}>
                  {(() => {
                    const projectType = (realProjectData as any)?.projectType || '';
                    const projectName = realProjectData?.title || 'this project';
                    
                    if (projectType.toLowerCase().includes('kitchen')) {
                      return `💡 Start by logging materials from your first supplier for ${projectName}`;
                    } else if (projectType.toLowerCase().includes('bathroom')) {
                      return `💡 Begin tracking your first expenses for ${projectName}`;
                    } else if (projectType.toLowerCase().includes('new build') || projectType.toLowerCase().includes('custom')) {
                      return `💡 Set your first milestone: Foundation complete for ${projectName}`;
                    } else {
                      return `💡 Most contractors start by logging their first expense for ${projectName}`;
                    }
                  })()}
                </Text>
              </View>
            </View>
          )}

          {/* SEGMENTED CONTROL */}
          <View style={styles.wideContainer}>
            <BlurView intensity={35} tint="dark" style={styles.segmentContainer}>
              <View style={styles.segmentInner}>
              <SegmentTab
                label="Overview"
                icon="grid-outline"
                isActive={activeTab === "Overview"}
                onPress={() => handleTabPress("Overview")}
                styles={styles}
              />
              <SegmentTab
                label="Budget"
                icon="wallet-outline"
                isActive={activeTab === "Budget"}
                onPress={() => handleTabPress("Budget")}
                styles={styles}
              />
              <SegmentTab
                label="Timeline"
                icon="calendar-outline"
                isActive={activeTab === "Timeline"}
                onPress={() => handleTabPress("Timeline")}
                styles={styles}
              />
              <SegmentTab
                label="Team"
                icon="people-outline"
                isActive={activeTab === "Team"}
                onPress={() => handleTabPress("Team")}
                styles={styles}
              />
            </View>
          </BlurView>
          </View>

          {/* CONTENT */}
          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* FLOATING ASK PM BADGE - Dashboard AI PM Mode Style */}
        <Pressable
          style={styles.aiFloatingWrapper}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAIAssistant(true);
          }}
        >
          <LinearGradient
            colors={["#22c55e", "#22d3ee"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiFloating}
          >
            <Ionicons
              name="sparkles"
              size={18}
              color="#020617"
            />
            <Text style={styles.aiFloatingText}>Ask PM</Text>
          </LinearGradient>
        </Pressable>

        {/* AI Suggestions Modal - iOS-style popup */}
        <Modal
          visible={showAiSuggestions && activeTab === 'Overview'}
          transparent={true}
          animationType="none"
          onRequestClose={dismissAiSuggestions}
        >
          <BlurView intensity={20} tint="dark" style={styles.aiSuggestionsModalBackdrop}>
            <TouchableOpacity
              style={styles.aiSuggestionsModalBackdropTouchable}
              activeOpacity={1}
              onPress={dismissAiSuggestions}
            />
            <Animated.View
              style={[
                styles.aiSuggestionsModalContainer,
                {
                  opacity: aiSuggestionAnim,
                  transform: [
                    {
                      scale: aiSuggestionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1],
                      }),
                    },
                    {
                      translateY: aiSuggestionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.aiSuggestionsCard, { backgroundColor: darkMode ? '#1E293B' : '#F1F5F9' }]}>
                <View style={styles.aiSuggestionsHeader}>
                  <View style={styles.aiSuggestionsHeaderLeft}>
                    <Ionicons name="sparkles" size={20} color={darkMode ? '#94A3B8' : '#64748B'} />
                    <Text style={[styles.aiSuggestionsTitle, { color: darkMode ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>AI Project Manager is active</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.aiSuggestionsClose}
                    onPress={dismissAiSuggestions}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color={Colors.sub} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.aiSuggestionsSubtitle, { color: darkMode ? '#94A3B8' : '#64748B' }]}>
                  I'll flag cost, labor, or schedule drift as it happens.
                </Text>
                <View style={styles.aiProactiveInsight}>
                  <Ionicons name="bulb" size={14} color={darkMode ? '#94A3B8' : '#64748B'} />
                  <Text style={[styles.aiProactiveInsightText, { color: darkMode ? '#94A3B8' : '#64748B' }]}>
                    Based on your estimate, labor will be your biggest risk area.
                  </Text>
                </View>
                <Text style={[styles.aiSuggestionsSubtitle, { color: darkMode ? '#94A3B8' : '#64748B', marginTop: 8 }]}>
                  Try asking:
                </Text>
                <View style={styles.aiSuggestionsList}>
                  {aiSuggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.aiSuggestionButton, { backgroundColor: darkMode ? Colors.surface2 : '#F1F5F9', borderColor: darkMode ? Colors.line : '#E2E8F0' }]}
                      onPress={() => {
                        handleAISuggestion(suggestion);
                        dismissAiSuggestions();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={Colors.sub} />
                      <Text style={[styles.aiSuggestionText, { color: Colors.text }]} numberOfLines={2}>
                        {suggestion}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.sub} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Animated.View>
          </BlurView>
        </Modal>

        {/* Project Activation Flow */}
        <ProjectActivationFlow
          visible={showActivationFlow}
          onComplete={(completedSteps) => {
              // Close the activation flow modal first - do this immediately
              setShowActivationFlow(false);
              
              // Dismiss the activation card since setup is complete
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowKickoffCard(false);
              
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
                
                // Show AI suggestions card 5 seconds after project setup completes
                setTimeout(() => {
                  const suggestions = generateAISuggestions(realProjectData);
                  setAiSuggestions(suggestions);
                  // Reset animation to 0 before showing
                  aiSuggestionAnim.setValue(0);
                  setShowAiSuggestions(true);
                  // Animate in with iOS-style spring animation
                  Animated.spring(aiSuggestionAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                  }).start();
                }, 5000);
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
            return {
            screen: 'Project Detail',
            currentProject: safeProjectData?.title || safeProjectData?.name || 'Current Project',
            projectName: safeProjectData?.title || safeProjectData?.name || 'Current Project',
            projectId: safeProjectData?.id,
            status: realProjectData?.status || safeProjectData?.status || 'estimate',
            // Financial data — pull from estimateData when top-level is 0
            bidPrice: realProjectData?.bidPrice || safeProjectData?.bidPrice || ed?.totalBid || 0,
            estimatedCost: realProjectData?.estimatedCost || safeProjectData?.estimatedCost || ed?.totalCost || ed?.baseCost || 0,
            actualCost: realProjectData?.actualCost || contextProjectData?.spent || safeProjectData?.actualCost || computedSpent || 0,
            totalSpent: realProjectData?.totalSpent || contextProjectData?.spent || safeProjectData?.totalSpent || computedSpent || 0,
            expenses: allExpenses,
            expensesCount: allExpenses.length,
            bidTitle: safeProjectData?.title || safeProjectData?.name,
            bidTotal: realProjectData?.bidPrice || safeProjectData?.bidPrice || ed?.totalBid || 0,
            total: realProjectData?.bidPrice || safeProjectData?.bidPrice || ed?.totalBid || 0,
            location: safeProjectData?.location || '',
            projectType: safeProjectData?.projectType || '',
            margin: safeProjectData?.margin || ed?.marginPct || 0,
            markup: safeProjectData?.markup || ed?.markupPct || ed?.markup || 0,
            overheadPct: ed?.overheadPct || 12,
            progress: safeProjectData?.overallProgressPct || safeProjectData?.progress || 0,
            // Include full estimateData so backend can access all fields
            estimateData: ed,
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
            startDate: safeProjectData?.startDate,
            endDate: safeProjectData?.endDate,
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
            
            if (action.type === 'add_material' || action.type === 'add_material_purchase') {
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
                  vendor: action.vendor || action.laborType || '',
                  amount: action.amount || 0,
                  date: new Date().toISOString(),
                  notes: action.notes || `${action.laborType || 'Labor'} expense`,
                  receiptUri: null,
                });
                
                // Then, sync to backend API
                const expenseData = {
                  amount: action.amount || 0,
                  category: 'Labor',
                  vendor: action.vendor || action.laborType || '',
                  notes: action.notes || `${action.laborType || 'Labor'} expense`,
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
              console.log('📦 Action handler: Received add_purchase_order action', {
                projectId: action.projectId,
                currentProjectId: id,
                match: action.projectId === id,
                poNumber: action.poNumber,
                amount: action.amount,
                vendor: action.vendor,
                category: action.category
              });
              
              if (action.projectId !== id) {
                console.warn('⚠️ Action projectId mismatch:', {
                  actionProjectId: action.projectId,
                  currentId: id
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
              console.log('📦 Action handler: Received mark_po_received action', {
                projectId: action.projectId,
                currentProjectId: id,
                match: action.projectId === id,
                poId: action.poId,
                poNumber: action.poNumber
              });
              
              if (action.projectId !== id) {
                console.warn('⚠️ Action projectId mismatch:', {
                  actionProjectId: action.projectId,
                  currentId: id
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

            } else if (action.type === 'create_change_order') {
              try {
                console.log('🔄 Action handler: create_change_order', action);
                const co = action.changeOrder;
                const currentProject = realProjectData as any;
                const existingCOs = currentProject?.changeOrders || [];
                const updatedCOs = [...existingCOs, co];
                // Update budget with CO
                const currentBudget = Number(currentProject?.estimatedCost || currentProject?.estimateData?.totalCost || 0);
                const newBudget = currentBudget + co.cost;
                updateProject(id, {
                  changeOrders: updatedCOs,
                  estimatedCost: newBudget,
                  changeOrderTotal: updatedCOs.reduce((s: number, c: any) => s + Number(c.cost || 0), 0),
                });
                console.log('✅ Change order created:', co.description, '$' + co.clientPrice);
                Alert.alert('✅ Change Order Created', `"${co.description}"\nCost: $${co.cost.toLocaleString()}\nClient Price: $${co.clientPrice.toLocaleString()} (${co.markupPct}% markup)`);
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
                const storageKey = `timeline_${id}`;
                const raw = await AsyncStorage.getItem(storageKey);
                const items = raw ? JSON.parse(raw) : [];
                const updated = items.map((item: any) => {
                  if ((action.milestoneId && item.id === action.milestoneId) ||
                      (action.milestoneName && (item.title || '').toLowerCase().includes(action.milestoneName.toLowerCase()))) {
                    return { ...item, status: 'collected', collectedAt: action.collectedAt || new Date().toISOString(), collectedAmount: action.amount };
                  }
                  return item;
                });
                await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
                console.log('✅ Payment marked as collected');
                Alert.alert('✅ Payment Collected', `"${action.milestoneName}" marked as collected ($${Number(action.amount || 0).toLocaleString()}).`);
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
              // AI assistant updated the project via backend - sync to ProjectDataContext
              console.log('🔄 Project updated by AI assistant, syncing to ProjectDataContext', {
                actionProjectId: action.projectId,
                currentProjectId: id,
                match: action.projectId === id,
                expensesCount: action.expenses?.length || 0,
                purchaseOrdersCount: action.purchaseOrders?.length || 0,
                totalSpent: action.totalSpent || 0,
                committedPOs: action.committedPOs,
                expenseDetails: action.expenses?.map((e: any) => ({ id: e.id, category: e.category, amount: e.amount, vendor: e.vendor })) || [],
                poDetails: action.purchaseOrders?.map((po: any) => ({ id: po.id, poNumber: po.poNumber, amount: po.amount, vendor: po.vendor, status: po.status })) || []
              });
              
              if (action.projectId === id) {
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
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: darkMode ? '#FFFFFF' : Colors.text, fontSize: 18, textAlign: 'center', marginBottom: 20 }}>
            Error loading project details
          </Text>
        <Text style={{ color: darkMode ? '#9ca3af' : '#475569', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
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

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 4,
  },
  overviewBorder: {
    borderRadius: 22,
    padding: 1,
    marginBottom: 16,
  },
  overviewInner: {
    backgroundColor: darkMode ? Colors.card : Colors.bg,
    borderRadius: 20,
    padding: 12,
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
    backgroundColor: darkMode ? '#000000' : Colors.card,
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
  segmentContainer: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#19E180",
    marginBottom: 18,
  },
  segmentInner: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: darkMode ? "transparent" : Colors.surface2,
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
  },
  segmentTabActive: {
    backgroundColor: darkMode ? "transparent" : "#FFFFFF",
    shadowColor: darkMode ? "#22c55e" : "#000",
    shadowOpacity: darkMode ? 0.4 : 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 6,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: darkMode ? "#E5F7FF" : "#475569",
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
    backgroundColor: darkMode ? "#000000" : Colors.bg,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: darkMode ? 0 : 0,
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
    marginTop: 12,
  },
  innerCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  innerCard: {
    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
    borderRadius: 14,
    padding: 12,
    borderWidth: darkMode ? 1 : 1,
    borderColor: Colors.line,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
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
    fontSize: 13,
    color: darkMode ? "#9CA3AF" : "#475569",
    marginBottom: 2,
  },
  largeNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
  },
  mediumNumber: {
    fontSize: 20,
    fontWeight: "600",
    color: darkMode ? "#22d3ee" : "#0ea5e9",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metricLabel: {
    fontSize: 12,
    color: darkMode ? '#9CA3AF' : '#475569',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  statusContent: {
    flexDirection: "row",
    marginTop: 4,
  },
  statusLeft: {
    flex: 1,
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
    color: darkMode ? "#9CA3AF" : "#475569",
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
    alignItems: "center",
    marginBottom: 12,
  },
  budgetLabel: {
    fontSize: 14,
    color: darkMode ? "#9CA3AF" : "#475569",
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: "600",
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
    color: darkMode ? "#9CA3AF" : "#475569",
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
    color: darkMode ? "#7C8BA0" : "#475569",
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
    color: darkMode ? "#9CA3AF" : "#475569",
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
    color: darkMode ? "#9CA3AF" : "#475569",
  },
  teamNotAssignedText: {
    fontSize: 14,
    color: darkMode ? "#7C8BA0" : "#475569",
    fontStyle: "italic",
  },
  // Spending Trend Card styles
  spendingCard: {
    marginTop: 12,
  },
  spendingCardInner: {
    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
    borderRadius: 14,
    padding: 16,
    borderWidth: darkMode ? 1 : 1,
    borderColor: Colors.line,
  },
  spendingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // FLOATING ASK PM BADGE - Dashboard AI PM Mode Style
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
    backgroundColor: darkMode ? "#020617" : "#FFFFFF",
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
  aiProactiveInsight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.08)' : 'rgba(148, 163, 184, 0.1)',
  },
  aiProactiveInsightText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
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
  budgetHelperText: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  budgetHelperTextMain: {
    fontSize: 13,
    fontWeight: '500',
  },
  budgetHelperTextSub: {
    fontSize: 12,
    marginTop: 2,
  },
  // AI Suggestions styles
  aiSuggestionsContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  aiSuggestionsContainerWide: {
    marginHorizontal: 4,
  },
  aiSuggestionsCard: {
    backgroundColor: darkMode ? '#1E293B' : '#F1F5F9',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  aiSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    width: '100%',
  },
  aiSuggestionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  aiSuggestionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    flexShrink: 1,
  },
  aiSuggestionsClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
  },
  aiSuggestionsSubtitle: {
    fontSize: 14,
    color: darkMode ? '#94A3B8' : '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  aiSuggestionsList: {
    gap: 10,
  },
  aiSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  aiSuggestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  // iOS-style Modal styles
  aiSuggestionsModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  aiSuggestionsModalBackdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  aiSuggestionsModalContainer: {
    width: '90%',
    maxWidth: 400,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
});
