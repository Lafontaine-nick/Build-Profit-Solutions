import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ProjectDataProvider,
  useProjectData,
} from '../../contexts/ProjectDataContext';
import { useProjectList, UnifiedProject } from '../../contexts/ProjectListContext';
import { View, ScrollView, StyleSheet, Text, Pressable, StatusBar, SafeAreaView, Dimensions, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager, Modal } from 'react-native';
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
  const { id } = useLocalSearchParams();
  const { projectData: contextProjectData, reloadFromStorage } = useProjectData();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  
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
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [materialsCart, setMaterialsCart] = useState<any[]>([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showKickoffCard, setShowKickoffCard] = useState(false);
  const [activationChecklist, setActivationChecklist] = useState({
    timelineConfirmed: false,
    paymentScheduleReviewed: false,
    teamAssigned: false,
  });
  const [expandedChecklistItem, setExpandedChecklistItem] = useState<string | null>(null);
  const [showActivationCelebration, setShowActivationCelebration] = useState(false);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const [showCommandCenter, setShowCommandCenter] = useState(false);

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

  // Check if all checklist items are complete and trigger celebration
  useEffect(() => {
    const allComplete = activationChecklist.timelineConfirmed && 
                        activationChecklist.paymentScheduleReviewed && 
                        activationChecklist.teamAssigned;
    
    if (allComplete && !showActivationCelebration && showKickoffCard) {
      setShowActivationCelebration(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Animate celebration
      celebrationAnim.setValue(0);
      Animated.spring(celebrationAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start(() => {
        // Auto-dismiss celebration after 2 seconds
        setTimeout(() => {
          Animated.spring(celebrationAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }).start(() => {
            setShowActivationCelebration(false);
          });
        }, 2000);
      });
    }
  }, [activationChecklist, showActivationCelebration, showKickoffCard, celebrationAnim]);

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

  const budgetedValue = React.useMemo(() => {
    if (resolvedBidPrice !== null) return resolvedBidPrice;
    if (recalculatedBudget !== null) return recalculatedBudget;
    const estimatedCost = toPositiveNumber(realProjectData?.estimatedCost);
    return estimatedCost ?? 0;
  }, [resolvedBidPrice, recalculatedBudget, realProjectData?.estimatedCost]);

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
    milestones: realProjectData.estimateData?.paymentMilestones ? 
      realProjectData.estimateData.paymentMilestones.map((milestone: any, index: number) => ({
        id: milestone.id || `milestone-${index}`,
        title: milestone.name || `Payment ${index + 1}`,
        description: milestone.description || milestone.workDescription || '',
        dueDate: milestone.scheduledDate || new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending' as const,
        amount: Number(milestone.paymentAmount) || 0,
        percentage: Number(milestone.percentage) || 0,
      })) : [],
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

    // Add one Materials/Equipment card with total derived from estimate sources
    // CRITICAL: Use materialsCart first (current state), then fall back to estimate.materialLineItems
    // This ensures we use the same source as the Overview tab
    if (shouldIncludeMaterials) {
      // PREFER materialsCart (same as Overview tab), then estimate.materialLineItems, then calculated budget
      const finalMaterialsBudget = materialsFromCart > 0 
        ? materialsFromCart 
        : (materialsFromLineItems > 0 
          ? materialsFromLineItems 
          : materialsBudget);
      
      lines.push({
        id: 'materials',
        category: 'Materials/Equipment',
        description: 'Materials & Equipment',
        qty: 1,
        unit: 'lump sum',
        unitCost: finalMaterialsBudget, // Use materialsCart total (matches Overview tab)
        markupPct: 0, // No markup for spending tracking
        spent: materialsSpent,
        aiSuggested: false,
      });
      
      console.log(`📊 Materials budget: materialsCart=$${materialsFromCart}, materialLineItems=$${materialsFromLineItems}, final=$${finalMaterialsBudget}`);
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
    const totalSpent =
      expensesTotal > 0
        ? expensesTotal
        : Number(safeProjectData?.spent ?? 0) > 0
        ? Number(safeProjectData?.spent ?? 0)
        : bucketSpentTotal;

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
      if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
      if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
      return `$${amount.toLocaleString()}`;
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
                      {activationChecklist.timelineConfirmed && activationChecklist.paymentScheduleReviewed 
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

          {/* Activation Celebration Overlay */}
          {showActivationCelebration && (
            <Animated.View
              style={[
                styles.celebrationOverlay,
                {
                  opacity: celebrationAnim,
                  transform: [
                    {
                      scale: celebrationAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.celebrationCard}>
                <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
                <Text style={styles.celebrationTitle}>Project is ready!</Text>
                <Text style={styles.celebrationSubtitle}>
                  All setup steps complete. Your project is ready to run smoothly.
                </Text>
              </View>
            </Animated.View>
          )}

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

        {/* FLOATING ASK PM BADGE - Dashboard Style */}
        <Pressable
          style={styles.askPMFloatingWrapper}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAIAssistant(true);
          }}
        >
          <LinearGradient
            colors={showAiSuggestions 
              ? ["#2DFFC4", "#00A6FF"] // Highlighted gradient for newly activated
              : ["#22c55e", "#22d3ee"]} // Normal gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.askPMFloating,
              showAiSuggestions && styles.askPMFloatingHighlighted
            ]}
          >
            <Ionicons
              name="sparkles"
              size={18}
              color="#020617"
            />
            <Text style={styles.askPMFloatingText}>Ask PM</Text>
            {showAiSuggestions && (
              <View style={styles.askPMPulseIndicator} />
            )}
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
            setShowActivationFlow(false);
            setActiveTab('Overview');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Update activation checklist based on completed steps
            if (completedSteps) {
              setActivationChecklist({
                timelineConfirmed: completedSteps.timeline || false,
                paymentScheduleReviewed: completedSteps.paymentSchedule || false,
                teamAssigned: completedSteps.team || false,
              });
            }
            
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
          context={JSON.stringify({
            screen: 'Project Detail',
            // Current project context - AI should assume all questions are about this project
            currentProject: safeProjectData?.title || safeProjectData?.name || 'Current Project',
            projectName: safeProjectData?.title || safeProjectData?.name || 'Current Project',
            projectId: safeProjectData?.id,
            bidTitle: safeProjectData?.title || safeProjectData?.name,
            bidTotal: safeProjectData?.bidPrice || safeProjectData?.budgeted || 0,
            total: safeProjectData?.bidPrice || safeProjectData?.budgeted || 0,
            status: safeProjectData?.status,
            location: safeProjectData?.location || '',
            projectType: safeProjectData?.projectType || '',
            estimatedCost: safeProjectData?.estimatedCost || 0,
            actualCost: safeProjectData?.actualCost || safeProjectData?.spent || 0,
            margin: safeProjectData?.margin || 0,
            markup: safeProjectData?.markup || 0,
            overheadPct: 12, // Default overhead
            progress: safeProjectData?.overallProgressPct || safeProjectData?.progress || 0,
            activeTab: activeTab,
            // Send summary data only (not full objects) to reduce payload size
            bucketCount: (safeProjectData?.buckets || []).length,
            milestoneCount: (safeProjectData?.milestones || []).length,
            expenseCount: (safeProjectData?.expenses || []).length,
            changeOrderCount: (safeProjectData?.changeOrders || []).length,
            startDate: safeProjectData?.startDate,
            endDate: safeProjectData?.endDate,
          })}
          onAction={async (action) => {
            // Handle AI actions if needed
            console.log('AI Action:', action);
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
    alignItems: "center",
    marginBottom: 16,
  },
  chartBox: {
    marginTop: 8,
  },
  // FLOATING ASK PM BADGE - Dashboard style
  askPMFloatingWrapper: {
    position: "absolute",
    right: 20,
    bottom: 70, // Lower on the page, closer to tab bar
    zIndex: 10,
  },
  askPMFloating: {
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
  askPMFloatingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#020617",
  },
  askPMFloatingHighlighted: {
    shadowColor: "#2DFFC4",
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  askPMPulseIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2DFFC4',
    borderWidth: 2,
    borderColor: '#020617',
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
