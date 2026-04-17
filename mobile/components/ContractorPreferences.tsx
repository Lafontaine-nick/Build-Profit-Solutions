import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrefsStore } from '../store/prefs';
import { useScoredLeads } from '../store/leads';
import * as Haptics from 'expo-haptics';
import { geocodeCity } from '../lib/geo';

/** Same green→cyan frame as Estimates Bid Summary / leads sections (`#2DFFC4` → `#00A6FF`). */
const SECTION_GRADIENT_BORDER_COLORS = ['#2DFFC4', '#00A6FF'] as const;

interface ContractorPreferences {
  // Trade Types
  tradeTypes: {
    residential: boolean;
    commercial: boolean;
    industrial: boolean;
    multiFamily: boolean;
    newBuild: boolean;
    renovation: boolean;
    repair: boolean;
    maintenance: boolean;
    remodeling: boolean;
    additions: boolean;
  };
  
  // Specific Trades
  specificTrades: string[];

  // Location Preferences
  zipCodes: string[];
  serviceAreas: {
    city: string;
    state: string;
    radius: number; // miles
  }[];

  // Price Range
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };

  // Lead Matching Preferences
  leadMatching: {
    autoAccept: boolean;
    minAIScore: number;
    maxResponseTime: number; // hours
    preferredContactMethod: 'phone' | 'email' | 'text' | 'any';
    preferredTimelines: ('Urgent' | 'Soon' | 'Normal' | 'Flexible')[]; // Preferred urgency levels (multiple)
    timelineMultiplier?: number; // How much weight to give timeline matching (0-1)
    filterByTrade: boolean; // Only show leads matching selected trade types
  };

  // Notification Settings
  notifications: {
    newLeads: boolean;
    leadUpdates: boolean;
    paymentAlerts: boolean;
    weeklyReports: boolean;
    pushNotifications: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
  };

  // Availability
  availability: {
    isAvailable: boolean;
    responseTime: number; // hours
    workingHours: {
      monday: { start: string; end: string; available: boolean };
      tuesday: { start: string; end: string; available: boolean };
      wednesday: { start: string; end: string; available: boolean };
      thursday: { start: string; end: string; available: boolean };
      friday: { start: string; end: string; available: boolean };
      saturday: { start: string; end: string; available: boolean };
      sunday: { start: string; end: string; available: boolean };
    };
  };
}

interface ContractorPreferencesProps {
  onClose?: () => void;
}

const ContractorPreferences: React.FC<ContractorPreferencesProps> = ({ onClose }) => {
  const { darkMode, theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { leads: allLeads, hydrated: leadsHydrated } = useScoredLeads();
  const [activeTab, setActiveTab] = useState<
    | 'trades'
    | 'specificTrades'
    | 'location'
    | 'pricing'
    | 'timeline'
    | 'matching'
    | 'notifications'
    | 'availability'
  >('trades'); // Default to trades tab
  const [preferences, setPreferences] = useState<ContractorPreferences>({
    tradeTypes: {
      residential: false,
      commercial: false,
      industrial: false,
      multiFamily: false,
      newBuild: false,
      renovation: false,
      repair: false,
      maintenance: false,
      remodeling: false,
      additions: false,
    },
    specificTrades: [],
    zipCodes: [],
    serviceAreas: [],
    priceRange: { min: 0, max: 0, currency: 'USD' },
    leadMatching: {
      autoAccept: false,
      minAIScore: 70,
      maxResponseTime: 24,
      preferredContactMethod: 'phone',
      preferredTimelines: [],
      timelineMultiplier: 0.5,
      filterByTrade: false,
    },
    notifications: {
      newLeads: false,
      leadUpdates: false,
      paymentAlerts: false,
      weeklyReports: false,
      pushNotifications: false,
      emailNotifications: false,
      smsNotifications: false,
    },
    availability: {
      isAvailable: true,
      responseTime: 4,
      workingHours: {
        monday: { start: '08:00', end: '17:00', available: true },
        tuesday: { start: '08:00', end: '17:00', available: true },
        wednesday: { start: '08:00', end: '17:00', available: true },
        thursday: { start: '08:00', end: '17:00', available: true },
        friday: { start: '08:00', end: '17:00', available: true },
        saturday: { start: '09:00', end: '15:00', available: false },
        sunday: { start: '09:00', end: '15:00', available: false },
      },
    },
  });
  const [loading, setLoading] = useState(false);
  const [hasSeenAutoAcceptWarning, setHasSeenAutoAcceptWarning] = useState(false);
  const [hasSeenFilterByTradeWarning, setHasSeenFilterByTradeWarning] = useState(false);
  const [isAIMatchingRulesCollapsed, setIsAIMatchingRulesCollapsed] = useState(false);
  const [isAvailabilityResponseCollapsed, setIsAvailabilityResponseCollapsed] = useState(false);
  
  // Ref for the max budget input
  const maxBudgetInputRef = useRef<TextInput>(null);

  // Define colors to match leads/analytics pages
  // Reduced visual weight: borders ~15% less opacity, secondary text lower contrast
  const backgroundColor = darkMode ? '#000000' : Colors.bg;
  const textColor = darkMode ? '#FFFFFF' : Colors.text;
  const textSecondaryColor = darkMode ? 'rgba(203, 213, 225, 0.82)' : '#475569';
  /** Card subtitles were hardcoded for dark UI; light mode needs a darker slate for contrast on pale cards */
  const sectionSubtitleColor = darkMode ? 'rgba(203, 213, 225, 0.82)' : '#334155';
  const borderColor = darkMode ? 'rgba(255, 255, 255, 0.17)' : Colors.line; // Reduced from 0.2 to 0.17 (~15% less)
  const cardColor = darkMode ? 'rgba(255, 255, 255, 0.08)' : Colors.surface2; // Reduced from 0.1 to 0.08 (~20% less)
  const accentColor = '#43cea2';

  // Load preferences from Zustand store (source of truth)
  const { prefs: zustandPrefs, hydrated: prefsHydrated, setPrefs: setZustandPrefs } = usePrefsStore();

  // Load saved preferences on mount - prioritize usePrefsStore, fallback to AsyncStorage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // First, try to load from Zustand store (source of truth)
        if (prefsHydrated && zustandPrefs) {
          console.log('📋 Loading preferences from usePrefsStore:', zustandPrefs);
          
          // Also load priceRange from AsyncStorage (backward compatibility)
          let savedPriceRange = zustandPrefs.priceRange || { min: 5000, max: 500000, currency: 'USD' };
          try {
            const saved = await AsyncStorage.getItem('@contractor-preferences');
            if (saved) {
              const savedPrefs = JSON.parse(saved);
              if (savedPrefs.priceRange) {
                savedPriceRange = savedPrefs.priceRange;
              }
            }
          } catch (e) {
            console.warn('Failed to load priceRange from AsyncStorage:', e);
          }
          
          // Convert Zustand preferences format to ContractorPreferences format
          const convertedPrefs: ContractorPreferences = {
            tradeTypes: {
              residential: zustandPrefs.trades.includes('residential'),
              commercial: zustandPrefs.trades.includes('commercial'),
              industrial: zustandPrefs.trades.includes('industrial'),
              multiFamily: zustandPrefs.trades.includes('multiFamily'),
              newBuild: zustandPrefs.trades.includes('newBuild'),
              renovation: zustandPrefs.trades.includes('renovation'),
              repair: zustandPrefs.trades.includes('repair'),
              maintenance: zustandPrefs.trades.includes('maintenance'),
              remodeling: zustandPrefs.trades.includes('remodeling'),
              additions: zustandPrefs.trades.includes('additions'),
            },
            specificTrades: zustandPrefs.specificTrades || [],
            zipCodes: [], // Not stored in Zustand
            serviceAreas: zustandPrefs.locations?.map((loc: any) => ({
              city: loc.city,
              state: loc.state,
              radius: loc.radiusMi,
            })) || [],
            priceRange: savedPriceRange,
            leadMatching: {
              autoAccept: false,
              minAIScore: zustandPrefs.minAIScore || 70,
              maxResponseTime: 24,
              preferredContactMethod: 'phone',
              preferredTimelines: zustandPrefs.timelineAllowed || [],
              timelineMultiplier: 0.5,
              filterByTrade: zustandPrefs.filterByTrade || false,
            },
            notifications: {
              newLeads: false,
              leadUpdates: false,
              paymentAlerts: false,
              weeklyReports: false,
              pushNotifications: false,
              emailNotifications: false,
              smsNotifications: false,
            },
            availability: {
              isAvailable: true,
              responseTime: 4,
              workingHours: {
                monday: { start: '08:00', end: '17:00', available: true },
                tuesday: { start: '08:00', end: '17:00', available: true },
                wednesday: { start: '08:00', end: '17:00', available: true },
                thursday: { start: '08:00', end: '17:00', available: true },
                friday: { start: '08:00', end: '17:00', available: true },
                saturday: { start: '09:00', end: '15:00', available: false },
                sunday: { start: '09:00', end: '15:00', available: false },
              },
            },
          };
          
          setPreferences(convertedPrefs);
          console.log('✅ Loaded preferences from usePrefsStore:', convertedPrefs);
          return; // Don't fall back to AsyncStorage if Zustand has data
        }
        
        // Fallback to AsyncStorage if Zustand not hydrated or empty
        const saved = await AsyncStorage.getItem('@contractor-preferences');
        if (saved) {
          const savedPrefs = JSON.parse(saved);
          
          // Migrate old data: convert preferredTimeline (string) to preferredTimelines (array)
          if (savedPrefs.leadMatching?.preferredTimeline && !savedPrefs.leadMatching.preferredTimelines) {
            savedPrefs.leadMatching.preferredTimelines = [savedPrefs.leadMatching.preferredTimeline];
            delete savedPrefs.leadMatching.preferredTimeline;
            console.log('🔄 Migrated old timeline preference to new format');
          }
          
          // Ensure preferredTimelines is initialized as an array
          if (!savedPrefs.leadMatching?.preferredTimelines) {
            savedPrefs.leadMatching = savedPrefs.leadMatching || {};
            savedPrefs.leadMatching.preferredTimelines = [];
          }
          
          setPreferences(savedPrefs);
          console.log('✅ Loaded saved preferences from AsyncStorage:', savedPrefs);
        } else {
          console.log('ℹ️ No saved preferences found, using defaults');
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };
    loadPreferences();
  }, [prefsHydrated, zustandPrefs.trades, zustandPrefs.specificTrades, zustandPrefs.locations, zustandPrefs.filterByTrade, zustandPrefs.minAIScore, zustandPrefs.timelineAllowed]);

  // Auto-save preferences when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Save preferences when component is about to unmount
      const savePreferencesOnUnmount = async () => {
        try {
          await AsyncStorage.setItem('@contractor-preferences', JSON.stringify(preferences));
          console.log('✅ Auto-saved preferences on close');
        } catch (error) {
          console.error('Failed to auto-save preferences:', error);
        }
      };
      savePreferencesOnUnmount();
    };
  }, [preferences]);

  const updatePreferences = (
    field: keyof ContractorPreferences,
    value: any
  ) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  // Get Zustand store
  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      // Save to AsyncStorage (for backward compatibility) - do this first
      await AsyncStorage.setItem('@contractor-preferences', JSON.stringify(preferences));
      console.log('✅ Saved to AsyncStorage');
      
      // Convert preferences to Zustand format
      // Geocode service areas to store coordinates for accurate distance calculations
      const locationsWithCoords = (preferences.serviceAreas || []).map((area) => {
        const coords = geocodeCity(area.city, area.state);
        return {
          city: area.city,
          state: area.state,
          radiusMi: area.radius,
          lat: coords?.lat,
          lng: coords?.lng,
        };
      });
      
      const zustandPrefs = {
        trades: Object.keys(preferences.tradeTypes).filter(key => preferences.tradeTypes[key as keyof typeof preferences.tradeTypes]),
        specificTrades: preferences.specificTrades || [],
        locations: locationsWithCoords,
        minAIScore: preferences.leadMatching.minAIScore,
        timelineAllowed: preferences.leadMatching.preferredTimelines || [],
        filterByTrade: preferences.leadMatching.filterByTrade || false,
        serviceHours: preferences.availability?.workingHours ? {
          start: preferences.availability.workingHours.monday.start,
          end: preferences.availability.workingHours.monday.end,
        } : undefined,
        priceRange: preferences.priceRange || { min: 5000, max: 500000, currency: 'USD' },
      };
      
      // Save to Zustand store (for new filtering system)
      // Use replacePrefs instead of setPrefs to ensure full state replacement and trigger re-renders
      const { replacePrefs } = usePrefsStore.getState();
      replacePrefs(zustandPrefs);
      console.log('✅ Saved to Zustand store using replacePrefs:', zustandPrefs);
      
      // Force immediate state update by calling setState directly
      // This ensures all subscribers are notified immediately
      usePrefsStore.setState({ prefs: zustandPrefs });
      
      // Brief delay to allow Zustand subscribers to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify the save was successful
      const verifyPrefs = usePrefsStore.getState().prefs;
      console.log('✅ Verified saved preferences:', {
        specificTrades: verifyPrefs.specificTrades?.length || 0,
        locations: verifyPrefs.locations?.length || 0,
        filterByTrade: verifyPrefs.filterByTrade,
        priceRange: verifyPrefs.priceRange,
      });
      
      // Verify AsyncStorage save as well
      const verifyAsync = await AsyncStorage.getItem('@contractor-preferences');
      if (!verifyAsync) {
        throw new Error('AsyncStorage verification failed');
      }
      console.log('✅ Verified AsyncStorage save');
      
      console.log('✅ Preferences saved successfully to both stores');
      
      // Show success message with haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Success', 
        'Preferences saved successfully! Your lead scores will now be personalized.',
        [
          {
            text: 'OK',
            onPress: () => {
      // Close modal if onClose is provided
      if (onClose) {
                setTimeout(() => onClose(), 100);
      }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ Failed to save preferences:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to save preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all preferences to their default values. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@contractor-preferences');
              console.log('✅ Cleared all saved preferences');
              
              // Reset to clean state
              setPreferences({
                tradeTypes: {
                  residential: false,
                  commercial: false,
                  industrial: false,
                  multiFamily: false,
                  newBuild: false,
                  renovation: false,
                  repair: false,
                  maintenance: false,
                  remodeling: false,
                  additions: false,
                },
                specificTrades: [],
                zipCodes: [],
                serviceAreas: [],
                priceRange: { min: 0, max: 0, currency: 'USD' },
                leadMatching: {
                  autoAccept: false,
                  minAIScore: 70,
                  maxResponseTime: 24,
                  preferredContactMethod: 'phone',
                  preferredTimelines: [],
                  timelineMultiplier: 0.5,
                  filterByTrade: false,
                },
                notifications: {
                  newLeads: false,
                  leadUpdates: false,
                  paymentAlerts: false,
                  weeklyReports: false,
                  pushNotifications: false,
                  emailNotifications: false,
                  smsNotifications: false,
                },
                availability: {
                  isAvailable: true,
                  responseTime: 4,
                  workingHours: {
                    monday: { start: '08:00', end: '17:00', available: true },
                    tuesday: { start: '08:00', end: '17:00', available: true },
                    wednesday: { start: '08:00', end: '17:00', available: true },
                    thursday: { start: '08:00', end: '17:00', available: true },
                    friday: { start: '08:00', end: '17:00', available: true },
                    saturday: { start: '09:00', end: '15:00', available: false },
                    sunday: { start: '09:00', end: '15:00', available: false },
                  },
                },
              });
              
              Alert.alert('Success', 'All preferences cleared!');
            } catch (error) {
              console.error('Failed to clear preferences:', error);
              Alert.alert('Error', 'Failed to clear preferences');
            }
          },
        },
      ]
    );
  };


  // Helper function to calculate impact data for trade types
  // Helper functions to get filter summary text
  const getTradesFilterSummary = (): string => {
    const selectedTypes = Object.keys(preferences.tradeTypes).filter(
      key => preferences.tradeTypes[key as keyof typeof preferences.tradeTypes]
    );
    if (selectedTypes.length === 0) return '';
    if (selectedTypes.length <= 2) {
      return selectedTypes.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(', ');
    }
    return `${selectedTypes.length} selected`;
  };

  const getLocationFilterSummary = (): string => {
    const primaryArea = preferences.serviceAreas[0];
    if (!primaryArea || !primaryArea.city) return '';
    const radius = primaryArea.radius || 25;
    return `${radius} mi`;
  };

  const getBudgetFilterSummary = (): string => {
    const { min, max } = preferences.priceRange;
    if (min === 0 && max === 0) return '';
    const formatCurrency = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
      return `$${val}`;
    };
    return `${formatCurrency(min)}–${formatCurrency(max)}`;
  };

  const getTimelineFilterSummary = (): string => {
    const timelines = preferences.leadMatching.preferredTimelines || [];
    if (timelines.length === 0) return '';
    if (timelines.length <= 2) return timelines.join(' + ');
    return `${timelines.length} selected`;
  };

  // Calculate real statistics from actual lead data
  const calculateRealStatistics = useMemo(() => {
    if (!allLeads || allLeads.length === 0) {
      // Fallback to default values if no leads available
      return { leadsPerMonth: 20, avgJobSize: 10000 };
    }

    // Calculate average job size from actual budget data
    const budgets: number[] = [];
    allLeads.forEach(lead => {
      // Handle both LeadRaw (budgetMin/budgetMax) and Lead (project.budgetMin/project.budgetMax) formats
      const budgetMin = (lead as any).budgetMin || (lead as any).project?.budgetMin || 0;
      const budgetMax = (lead as any).budgetMax || (lead as any).project?.budgetMax || budgetMin;
      const avgBudget = (budgetMin + budgetMax) / 2;
      if (avgBudget > 0) {
        budgets.push(avgBudget);
      }
    });
    
    const avgJobSize = budgets.length > 0
      ? budgets.reduce((sum, budget) => sum + budget, 0) / budgets.length
      : 10000;

    // Calculate leads per month based on creation dates
    const now = Date.now();
    const creationDates = allLeads
      .map(lead => {
        const createdAt = (lead as any).createdAt;
        return createdAt ? new Date(createdAt).getTime() : null;
      })
      .filter((date): date is number => date !== null && date <= now)
      .sort((a, b) => a - b);

    let leadsPerMonth = 20; // Default fallback
    if (creationDates.length > 0) {
      const oldestDate = creationDates[0];
      const newestDate = creationDates[creationDates.length - 1];
      const daysDiff = Math.max(1, (now - oldestDate) / (1000 * 60 * 60 * 24)); // Days
      const monthsDiff = daysDiff / 30; // Months
      leadsPerMonth = Math.round((creationDates.length / Math.max(0.5, monthsDiff)));
    }

    return { leadsPerMonth, avgJobSize };
  }, [allLeads]);

  const getTradeTypeImpact = (tradeKey: keyof ContractorPreferences['tradeTypes']): { leadsPerMonth: number; avgJobSize: number } => {
    if (!allLeads || allLeads.length === 0) {
      return { leadsPerMonth: 20, avgJobSize: 10000 };
    }

    // Keyword mappings for each job type to filter leads
    const keywordMap: Record<string, string[]> = {
      residential: ['residential', 'single-family', 'home', 'house', 'apartment', 'condo', 'residence'],
      commercial: ['commercial', 'office', 'retail', 'store', 'shop', 'business', 'restaurant', 'retail space'],
      industrial: ['industrial', 'warehouse', 'factory', 'manufacturing', 'plant', 'facility', 'industrial'],
      multiFamily: ['multi-family', 'multi family', 'apartment complex', 'townhome', 'townhouse', 'condo complex', 'duplex', 'triplex'],
      newBuild: ['new build', 'new construction', 'new build', 'ground up', 'new project', 'construction project'],
      renovation: ['renovation', 'renovate', 'upgrade', 'modernize', 'refresh', 'update'],
      repair: ['repair', 'fix', 'broken', 'damage', 'broken', 'malfunction'],
      maintenance: ['maintenance', 'maintain', 'service', 'upkeep', 'routine', 'regular'],
      remodeling: ['remodel', 'remodeling', 'remodel', 'overhaul', 'complete remodel', 'full remodel'],
      additions: ['addition', 'add-on', 'expansion', 'extend', 'build out', 'add space'],
    };

    const keywords = keywordMap[tradeKey] || [];
    
    // Filter leads that match this job type
    const matchingLeads = allLeads.filter(lead => {
      const title = ((lead as any).title || '').toLowerCase();
      const description = ((lead as any).description || '').toLowerCase();
      const projectType = ((lead as any).project?.type || '').toLowerCase();
      const text = `${title} ${description} ${projectType}`;
      
      return keywords.some(keyword => text.includes(keyword.toLowerCase()));
    });

    // If we have matching leads, calculate stats from them
    if (matchingLeads.length > 0) {
      // Calculate average job size from matching leads
      const budgets: number[] = [];
      matchingLeads.forEach(lead => {
        const budgetMin = (lead as any).budgetMin || (lead as any).project?.budgetMin || 0;
        const budgetMax = (lead as any).budgetMax || (lead as any).project?.budgetMax || budgetMin;
        const avgBudget = (budgetMin + budgetMax) / 2;
        if (avgBudget > 0) {
          budgets.push(avgBudget);
        }
      });
      
      const avgJobSize = budgets.length > 0
        ? budgets.reduce((sum, budget) => sum + budget, 0) / budgets.length
        : calculateRealStatistics.avgJobSize;

      // Calculate leads per month from matching leads
      const now = Date.now();
      const creationDates = matchingLeads
        .map(lead => {
          const createdAt = (lead as any).createdAt;
          return createdAt ? new Date(createdAt).getTime() : null;
        })
        .filter((date): date is number => date !== null && date <= now)
        .sort((a, b) => a - b);

      let leadsPerMonth = 20;
      if (creationDates.length > 0) {
        const oldestDate = creationDates[0];
        const daysDiff = Math.max(1, (now - oldestDate) / (1000 * 60 * 60 * 24));
        const monthsDiff = daysDiff / 30;
        leadsPerMonth = Math.round((creationDates.length / Math.max(0.5, monthsDiff)));
      }

      return { leadsPerMonth, avgJobSize };
    }

    // If no matching leads, use overall stats with slight variation based on job type
    // This provides realistic variation even when we don't have matching data
    const variationMultipliers: Record<string, number> = {
      industrial: 1.5,      // Industrial jobs tend to be larger
      newBuild: 1.3,        // New builds are typically larger projects
      commercial: 1.2,      // Commercial jobs are often larger
      multiFamily: 1.1,     // Multi-family can be larger
      additions: 1.15,      // Additions are substantial
      remodeling: 1.0,      // Remodeling is average
      renovation: 0.9,      // Renovations can be smaller
      residential: 0.85,    // Residential is typically smaller
      repair: 0.6,          // Repairs are typically smaller
      maintenance: 0.5,     // Maintenance is typically smaller
    };

    const multiplier = variationMultipliers[tradeKey] || 1.0;
    return {
      leadsPerMonth: Math.round(calculateRealStatistics.leadsPerMonth * (0.8 + Math.random() * 0.4)), // Add some variation
      avgJobSize: Math.round(calculateRealStatistics.avgJobSize * multiplier),
    };
  };

  const TradeTypeCard: React.FC<{
    title: string;
    tradeKey: keyof ContractorPreferences['tradeTypes'];
    description: string;
    icon: string;
  }> = ({ title, tradeKey, description, icon }) => (
    <TouchableOpacity
      style={[
        styles.tradeCard,
        {
          backgroundColor: cardColor,
          borderColor,
        },
        !darkMode && !preferences.tradeTypes[tradeKey] && {
          backgroundColor: Colors.surface2,
          borderColor: Colors.line,
        },
        preferences.tradeTypes[tradeKey] && {
          borderColor: accentColor,
          borderWidth: 1.5,
          backgroundColor: darkMode ? 'rgba(45, 212, 191, 0.06)' : 'rgba(45, 212, 191, 0.08)',
        },
      ]}
      onPress={() =>
        updatePreferences('tradeTypes', {
          ...preferences.tradeTypes,
          [tradeKey]: !preferences.tradeTypes[tradeKey],
        })
      }
    >
      <View style={styles.tradeHeader}>
        <MaterialIcons
          name={icon as any}
          size={22}
          color={
            preferences.tradeTypes[tradeKey]
              ? darkMode
                ? '#5EEAD4'
                : '#047857'
              : textSecondaryColor
          }
        />
        <View style={styles.tradeInfo}>
          <Text style={[styles.tradeTitle, { color: textColor }]}>{title}</Text>
          <Text
            style={[styles.tradeDescription, { color: textSecondaryColor }]}
          >
            {description}
          </Text>
          {preferences.tradeTypes[tradeKey] && (() => {
            const impact = getTradeTypeImpact(tradeKey);
            return (
              <View style={styles.tradeImpactRow}>
                <Text
                  style={[
                    styles.tradeImpactText,
                    { color: darkMode ? '#5EEAD4' : '#047857' },
                  ]}
                >
                  🟢 +{impact.leadsPerMonth} leads/month
                </Text>
                <Text style={[styles.tradeImpactText, { color: textSecondaryColor }]}>
                  · Avg job ${impact.avgJobSize.toLocaleString()}
                </Text>
              </View>
            );
          })()}
        </View>
        <View style={styles.tradeSwitchWrap}>
          <Switch
            value={preferences.tradeTypes[tradeKey]}
            onValueChange={value =>
              updatePreferences('tradeTypes', {
                ...preferences.tradeTypes,
                [tradeKey]: value,
              })
            }
            trackColor={{ false: darkMode ? borderColor : Colors.line, true: accentColor }}
            ios_backgroundColor={darkMode ? borderColor : Colors.line}
            thumbColor={preferences.tradeTypes[tradeKey] ? 'white' : '#f4f3f4'}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSpecificTradesTab = () => {
    const availableTrades = [
      'Electrician', 'Plumber', 'HVAC Technician', 'Carpenter', 'Painter',
      'Tile Setter', 'Flooring Installer', 'Roofer', 'Drywall Installer',
      'Concrete Worker', 'Landscaper', 'Fence Installer', 'Window Installer',
      'Insulation Installer', 'Siding Installer', 'Gutter Installer',
      'Cabinet Installer', 'Countertop Installer', 'Appliance Installer',
      'Security System Installer', 'Solar Installer', 'Pool Installer',
      'Deck Builder', 'Patio Installer', 'Driveway Installer',
      'Foundation Specialist', 'Structural Engineer', 'Architect',
      'Interior Designer', 'General Contractor', 'Project Manager'
    ];

    const toggleTrade = (trade: string) => {
      const currentTrades = preferences.specificTrades || [];
      const newTrades = currentTrades.includes(trade)
        ? currentTrades.filter(t => t !== trade)
        : [...currentTrades, trade];
      
      updatePreferences('specificTrades', newTrades);
    };

    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>        
        Trades
      </Text>
        <Text style={[styles.sectionDescription, { color: textSecondaryColor, marginBottom: 16 }]}>
          Select the specific trades you work in. This helps match you with relevant leads.
        </Text>

        <View style={styles.tradesGrid}>
          {availableTrades.map(trade => {
            const isSelected = (preferences.specificTrades || []).includes(trade);
            return (
              <TouchableOpacity
                key={trade}
                style={[
                  styles.tradeChip,
                  { backgroundColor: cardColor, borderColor },
                  isSelected && {
                    backgroundColor: '#43cea2',
                    borderColor: '#43cea2',
                  },
                ]}
                onPress={() => toggleTrade(trade)}
              >
                <Text
                  style={[
                    styles.tradeChipText,
                    { color: isSelected ? 'white' : textColor },
                  ]}
                >
                  {trade}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {(preferences.specificTrades || []).length > 0 && (
          <View style={[styles.selectedTrades, { backgroundColor: cardColor, borderColor }]}>
            <Text style={[styles.selectedTradesTitle, { color: textColor }]}>
              Selected Trades ({(preferences.specificTrades || []).length})
            </Text>
            <Text style={[styles.selectedTradesList, { color: textSecondaryColor }]}>
              {(preferences.specificTrades || []).join(', ')}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderTradesTab = () => (
    <LinearGradient
      colors={[...SECTION_GRADIENT_BORDER_COLORS]}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={styles.tradesGradientBorder}
    >
      <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg }]}>
        <View style={styles.sectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              !darkMode && { color: Colors.text },
            ]}
          >
            Job Type
          </Text>
          <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
            Select the types of projects you work on
          </Text>
        </View>
        <View style={styles.sectionContent}>
          <ScrollView style={styles.tradesList}>
            <TradeTypeCard
              title='Residential'
              tradeKey='residential'
              description='Single-family homes, apartments, condos'
              icon='home'
            />
            <TradeTypeCard
              title='Commercial'
              tradeKey='commercial'
              description='Office buildings, retail spaces, restaurants'
              icon='business'
            />
            <TradeTypeCard
              title='Industrial'
              tradeKey='industrial'
              description='Warehouses, factories, manufacturing'
              icon='factory'
            />
            <TradeTypeCard
              title='Multi-Family'
              tradeKey='multiFamily'
              description='Apartment complexes, townhomes'
              icon='apartment'
            />
            <TradeTypeCard
              title='New Build'
              tradeKey='newBuild'
              description='New construction projects'
              icon='add-circle'
            />
            <TradeTypeCard
              title='Renovation'
              tradeKey='renovation'
              description='Existing structure improvements'
              icon='build'
            />
            <TradeTypeCard
              title='Repair'
              tradeKey='repair'
              description='Maintenance and repair work'
              icon='handyman'
            />
            <TradeTypeCard
              title='Maintenance'
              tradeKey='maintenance'
              description='Ongoing maintenance services'
              icon='cleaning-services'
            />
            <TradeTypeCard
              title='Remodeling'
              tradeKey='remodeling'
              description='Complete room/house remodels'
              icon='home-repair-service'
            />
            <TradeTypeCard
              title='Additions'
              tradeKey='additions'
              description='Room additions, expansions'
              icon='add-home'
            />
          </ScrollView>
        </View>
      </View>
    </LinearGradient>
  );

  const renderLocationTab = () => {
    const primaryServiceArea = preferences.serviceAreas[0] || { city: '', state: '', radius: 25 };
    const estimatedHouseholds = primaryServiceArea.city 
      ? Math.round((primaryServiceArea.radius || 25) * 142 * 1000) // Rough estimate: ~142k households per 25mi radius
      : 0;
    
    return (
      <ScrollView 
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Service Area
        </Text>
        <Text style={[styles.sectionDescription, { color: textSecondaryColor, marginBottom: 16 }]}>
          Where do you want work from?
        </Text>

        <View style={styles.locationSection}>
          <Text style={[styles.subsectionTitle, { color: textColor }]}>
            Primary Service Hub
          </Text>
          <View style={styles.serviceAreaInput}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: cardColor, color: textColor, borderColor, flex: 1 },
              ]}
              placeholder='City'
              placeholderTextColor={textSecondaryColor}
              value={primaryServiceArea.city}
              onChangeText={text => {
                const updatedAreas = [...preferences.serviceAreas];
                if (updatedAreas.length === 0) {
                  updatedAreas.push({ city: text, state: primaryServiceArea.state, radius: primaryServiceArea.radius });
                } else {
                  updatedAreas[0] = { ...updatedAreas[0], city: text };
                }
                updatePreferences('serviceAreas', updatedAreas);
              }}
            />
            <TextInput
              style={[
                styles.input,
                { backgroundColor: cardColor, color: textColor, borderColor, width: 100 },
              ]}
              placeholder='State'
              placeholderTextColor={textSecondaryColor}
              value={primaryServiceArea.state}
              onChangeText={text => {
                const updatedAreas = [...preferences.serviceAreas];
                if (updatedAreas.length === 0) {
                  updatedAreas.push({ city: primaryServiceArea.city, state: text.toUpperCase(), radius: primaryServiceArea.radius });
                } else {
                  updatedAreas[0] = { ...updatedAreas[0], state: text.toUpperCase() };
                }
                updatePreferences('serviceAreas', updatedAreas);
              }}
              maxLength={2}
            />
          </View>
          
          <Text style={[styles.subsectionTitle, { color: textColor, marginTop: 16, marginBottom: 8 }]}>
            Service Radius
          </Text>
          <View style={styles.radiusSliderContainer}>
            <Text style={[styles.radiusValue, { color: '#43cea2' }]}>
              {primaryServiceArea.radius} miles
            </Text>
            <Slider
              style={styles.radiusSlider}
              minimumValue={5}
              maximumValue={100}
              value={primaryServiceArea.radius}
              onValueChange={(value) => {
                const updatedAreas = [...preferences.serviceAreas];
                const newRadius = Math.round(value);
                if (updatedAreas.length === 0) {
                  updatedAreas.push({ city: primaryServiceArea.city, state: primaryServiceArea.state, radius: newRadius });
                } else {
                  updatedAreas[0] = { ...updatedAreas[0], radius: newRadius };
                }
                updatePreferences('serviceAreas', updatedAreas);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              minimumTrackTintColor="#43cea2"
              maximumTrackTintColor={borderColor}
              thumbTintColor="#43cea2"
              step={5}
            />
          </View>

          {primaryServiceArea.city && primaryServiceArea.state && (
            <View style={[styles.locationPreviewCard, { backgroundColor: cardColor, borderColor }]}>
              <MaterialIcons name="location-on" size={20} color="#43cea2" />
              <Text style={[styles.locationPreviewText, { color: textColor }]}>
                You'll receive leads from ~{estimatedHouseholds.toLocaleString()} households
              </Text>
            </View>
          )}

          {preferences.serviceAreas.length > 0 && preferences.serviceAreas[0].city && (
            <View style={[styles.serviceAreaItem, { backgroundColor: cardColor, borderColor, marginTop: 16 }]}>
              <View style={styles.serviceAreaInfo}>
                <MaterialIcons name='location-on' size={20} color={accentColor} />
                <View>
                  <Text style={[styles.serviceAreaCity, { color: textColor }]}>
                    {preferences.serviceAreas[0].city}, {preferences.serviceAreas[0].state}
                  </Text>
                  <Text style={[styles.serviceAreaRadius, { color: textSecondaryColor }]}>
                    {preferences.serviceAreas[0].radius} miles radius
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => updatePreferences('serviceAreas', [])}
                style={{ padding: 4 }}
              >
                <MaterialIcons name='close' size={18} color='#F44336' />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderPricingTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Budget
      </Text>
      <Text style={[styles.sectionDescription, { color: textSecondaryColor }]}>
        Set your preferred project budget range for lead matching.
      </Text>

      <View style={styles.pricingSection}>
        <Text style={[styles.subsectionTitle, { color: textColor }]}>
          Budget Range
        </Text>
        <View style={styles.priceInputs}>
          <TextInput
            style={[
              styles.priceInput,
              { backgroundColor: cardColor, color: textColor, borderColor },
            ]}
            placeholder='Min Budget'
            placeholderTextColor={textSecondaryColor}
            value={preferences.priceRange.min === 0 ? '' : preferences.priceRange.min.toString()}
            onChangeText={text =>
              updatePreferences('priceRange', {
                ...preferences.priceRange,
                min: parseInt(text) || 0,
              })
            }
            keyboardType='numeric'
            returnKeyType='next'
            onSubmitEditing={() => maxBudgetInputRef.current?.focus()}
          />
          <Text style={[styles.priceSeparator, { color: textColor }]}>to</Text>
          <TextInput
            ref={maxBudgetInputRef}
            style={[
              styles.priceInput,
              { backgroundColor: cardColor, color: textColor, borderColor },
            ]}
            placeholder='Max Budget'
            placeholderTextColor={textSecondaryColor}
            value={preferences.priceRange.max === 0 ? '' : preferences.priceRange.max.toString()}
            onChangeText={text =>
              updatePreferences('priceRange', {
                ...preferences.priceRange,
                max: parseInt(text) || 0,
              })
            }
            keyboardType='numeric'
            returnKeyType='done'
          />
        </View>
      </View>
    </View>
  );

  const renderTimelineTab = () => (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Timeline Preferences
      </Text>
      <Text style={[styles.sectionDescription, { color: textSecondaryColor, marginBottom: 16 }]}>
        Select all timelines you prefer. Leads matching your selections will score higher.
      </Text>

      <View style={styles.timelineSelector}>
        {['Urgent', 'Soon', 'Normal', 'Flexible'].map(timeline => {
          const isSelected = (preferences.leadMatching.preferredTimelines || []).includes(timeline as any);
          return (
            <TouchableOpacity
              key={timeline}
              style={[
                styles.timelineButton,
                { backgroundColor: cardColor, borderColor },
                isSelected && {
                  backgroundColor: '#43cea2',
                },
              ]}
              onPress={() => {
                const currentTimelines = preferences.leadMatching.preferredTimelines;
                const newTimelines = isSelected
                  ? currentTimelines.filter(t => t !== timeline)
                  : [...currentTimelines, timeline as any];
                
                updatePreferences('leadMatching', {
                  ...preferences.leadMatching,
                  preferredTimelines: newTimelines,
                });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text
                style={[
                  styles.timelineButtonText,
                  {
                    color: isSelected ? 'white' : textColor,
                  },
                ]}
              >
                {timeline}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderMatchingTab = () => {
    const minScore = preferences.leadMatching.minAIScore;
    const selectedTradeTypes = Object.keys(preferences.tradeTypes).filter(
      key => preferences.tradeTypes[key as keyof typeof preferences.tradeTypes]
    );
    const totalLeadsPerMonth = selectedTradeTypes.reduce((sum, key) => {
      const impact = getTradeTypeImpact(key as keyof ContractorPreferences['tradeTypes']);
      return sum + impact.leadsPerMonth;
    }, 0);
    
    return (
      <View>
        {/* Section A: Priority Boosts (Soft Influence) */}
        <View style={styles.priorityBoostsSection}>
          <Text style={[styles.priorityBoostsTitle, { color: textColor }]}>
            Priority Boosts
          </Text>
          <Text style={[styles.priorityBoostsSubtitle, { color: textSecondaryColor }]}>
            Improves ranking but won't hide leads
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={[styles.switchLabel, { color: textColor }]}>
                Only show leads matching my preferences
              </Text>
              <Text style={[styles.switchDescription, { color: textSecondaryColor }]}>
                Improves ranking for better-matched leads
              </Text>
            </View>
            <Switch
              value={preferences.leadMatching.filterByTrade}
              onValueChange={value => {
                if (value && !hasSeenFilterByTradeWarning) {
                  Alert.alert(
                    'Strict Filtering Enabled',
                    'This may reduce lead volume significantly, but will improve match quality.',
                    [
                      { text: 'Cancel', style: 'cancel', onPress: () => {} },
                      { 
                        text: 'Enable', 
                        onPress: () => {
                          setHasSeenFilterByTradeWarning(true);
                          updatePreferences('leadMatching', {
                            ...preferences.leadMatching,
                            filterByTrade: true,
                          });
                        }
                      },
                    ]
                  );
                } else {
                  updatePreferences('leadMatching', {
                    ...preferences.leadMatching,
                    filterByTrade: value,
                  });
                }
              }}
              trackColor={{ false: darkMode ? borderColor : Colors.line, true: accentColor }}
              ios_backgroundColor={darkMode ? borderColor : Colors.line}
              thumbColor={
                preferences.leadMatching.filterByTrade ? 'white' : '#f4f3f4'
              }
            />
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.sectionDivider, { marginVertical: 24 }]} />

        {/* Section B: Hard Filters (Visibility Control) */}
        <View style={styles.hardFiltersSection}>
          <Text style={[styles.hardFiltersTitle, { color: textColor }]}>
            Visibility Filters
          </Text>
          <Text style={[styles.hardFiltersSubtitle, { color: textSecondaryColor }]}>
            Leads below these settings won't be shown
          </Text>

          {/* Minimum AI Score */}
          <View style={styles.hardFilterRow}>
            <View style={styles.hardFilterLabel}>
              <Text style={[styles.hardFilterLabelText, { color: textColor }]}>
                Minimum AI Score
              </Text>
              <Text style={[styles.hardFilterDescription, { color: textSecondaryColor }]}>
                Only show leads above this match quality threshold
              </Text>
            </View>
            <View style={styles.hardFilterControl}>
              <View style={styles.hardFilterValueContainer}>
                <Text style={[styles.hardFilterValue, { color: '#43cea2' }]}>
                  {minScore}%
                </Text>
              </View>
              <Slider
                style={styles.hardFilterSlider}
                minimumValue={0}
                maximumValue={100}
                value={minScore}
                onValueChange={(value) => {
                  updatePreferences('leadMatching', {
                    ...preferences.leadMatching,
                    minAIScore: Math.round(value),
                  });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                minimumTrackTintColor="#43cea2"
                maximumTrackTintColor={borderColor}
                thumbTintColor="#43cea2"
                step={1}
              />
              <View style={styles.hardFilterSliderLabels}>
                <Text style={[styles.hardFilterSliderLabel, { color: textSecondaryColor }]}>Low</Text>
                <Text style={[styles.hardFilterSliderLabel, { color: textSecondaryColor }]}>Balanced</Text>
                <Text style={[styles.hardFilterSliderLabel, { color: textSecondaryColor }]}>Strict</Text>
              </View>
            </View>
          </View>

          {/* Auto-accept */}
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <View style={styles.switchLabelRow}>
                <View style={[styles.warningDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.switchLabel, { color: textColor }]}>
                  Auto-accept leads
                </Text>
              </View>
              <Text style={[styles.switchDescription, { color: textSecondaryColor }]}>
                Automatically reserves qualifying leads — may increase spend
              </Text>
            </View>
            <Switch
              value={preferences.leadMatching.autoAccept}
              onValueChange={value => {
                if (value && !hasSeenAutoAcceptWarning) {
                  Alert.alert(
                    'Auto-accept Enabled',
                    'Auto-accept will immediately reserve leads matching your criteria. This may reduce flexibility on pricing & scope.',
                    [
                      { text: 'Cancel', style: 'cancel', onPress: () => {} },
                      { 
                        text: 'Enable', 
                        onPress: () => {
                          setHasSeenAutoAcceptWarning(true);
                          updatePreferences('leadMatching', {
                            ...preferences.leadMatching,
                            autoAccept: true,
                          });
                        }
                      },
                    ]
                  );
                } else {
                  updatePreferences('leadMatching', {
                    ...preferences.leadMatching,
                    autoAccept: value,
                  });
                }
              }}
              trackColor={{ false: darkMode ? borderColor : Colors.line, true: accentColor }}
              ios_backgroundColor={darkMode ? borderColor : Colors.line}
              thumbColor={
                preferences.leadMatching.autoAccept ? 'white' : '#f4f3f4'
              }
            />
          </View>

          <Text style={[styles.hardFiltersHelper, { color: textSecondaryColor }]}>
            Stricter filters reduce volume but improve close rate
          </Text>
        </View>

        {/* Preview Line */}
        <View style={[styles.rulesPreviewLine, { backgroundColor: cardColor, borderColor }]}>
          <Text style={[styles.rulesPreviewText, { color: textSecondaryColor }]}>
            With current rules: ~{totalLeadsPerMonth} leads/month · Higher fit
          </Text>
        </View>
      </View>
    );
  };

  const renderNotificationsTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Notifications
      </Text>

      <View style={styles.notificationSection}>
        {Object.entries(preferences.notifications).map(([key, value]) => (
          <View key={key} style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: textColor }]}>
              {key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())}
            </Text>
            <Switch
              value={value}
              onValueChange={newValue =>
                updatePreferences('notifications', {
                  ...preferences.notifications,
                  [key]: newValue,
                })
              }
              trackColor={{ false: darkMode ? borderColor : Colors.line, true: accentColor }}
              ios_backgroundColor={darkMode ? borderColor : Colors.line}
              thumbColor={value ? 'white' : '#f4f3f4'}
            />
          </View>
        ))}
      </View>
    </View>
  );

  const renderAvailabilityTab = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Availability
      </Text>

      <View style={styles.availabilitySection}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: textColor }]}>
            Available for new leads
          </Text>
          <Switch
            value={preferences.availability.isAvailable}
            onValueChange={value =>
              updatePreferences('availability', {
                ...preferences.availability,
                isAvailable: value,
              })
            }
            trackColor={{ false: darkMode ? borderColor : Colors.line, true: accentColor }}
            ios_backgroundColor={darkMode ? borderColor : Colors.line}
            thumbColor={
              preferences.availability.isAvailable ? 'white' : '#f4f3f4'
            }
          />
        </View>

        <Text style={[styles.subsectionTitle, { color: textColor }]}>
          Response Time
        </Text>
        <View style={styles.responseTimeSelector}>
          {[1, 2, 4, 8, 24].map(hours => (
            <TouchableOpacity
              key={hours}
              style={[
                styles.responseTimeButton,
                { backgroundColor: cardColor, borderColor },
                preferences.availability.responseTime === hours && {
                  backgroundColor: '#43cea2',
                },
              ]}
              onPress={() =>
                updatePreferences('availability', {
                  ...preferences.availability,
                  responseTime: hours,
                })
              }
            >
              <Text
                style={[
                  styles.responseTimeButtonText,
                  {
                    color:
                      preferences.availability.responseTime === hours
                        ? 'white'
                        : textColor,
                  },
                ]}
              >
                {hours}h
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header with Back Arrow */}
      <View style={styles.headerContainer}>
        <View style={styles.backBtnWrapper}>
          <LinearGradient
            colors={[...SECTION_GRADIENT_BORDER_COLORS]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.backBtnBorder}
          >
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (onClose) onClose();
              }}
              style={[
                styles.backBtn,
                !darkMode && { backgroundColor: Colors.bg },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={darkMode ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <View style={styles.headerContent}>
          <Text
            style={[
              styles.headerTitle,
              !darkMode && { color: Colors.text },
            ]}
          >
            Lead Quality Controls
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              !darkMode && { color: Colors.sub },
            ]}
          >
            Control which jobs you see and how they're prioritized
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.wideContainer}>
          {/* Match Quality Confidence Bar */}
          {useMemo(() => {
          // Start with base score of 0 - quality improves as preferences are configured
          let score = 0;
          
          // Job Types selected (0-25 points)
          const selectedJobTypes = Object.values(preferences.tradeTypes).filter(Boolean).length;
          const totalJobTypes = Object.keys(preferences.tradeTypes).length;
          score += (selectedJobTypes / totalJobTypes) * 25;
          
          // Location configured (0-20 points)
          if (preferences.serviceAreas && preferences.serviceAreas.length > 0) {
            const hasLocation = preferences.serviceAreas.some(area => area.city && area.city.trim() !== '');
            if (hasLocation) {
              score += 20;
            }
          }
          
          // Budget range set (0-15 points)
          if (preferences.priceRange && (preferences.priceRange.min > 0 || preferences.priceRange.max > 0)) {
            score += 15;
          }
          
          // Timeline preferences set (0-10 points)
          if (preferences.leadMatching.preferredTimelines && preferences.leadMatching.preferredTimelines.length > 0) {
            score += 10;
          }
          
          // AI Score threshold (0-15 points) - higher threshold = better quality
          const aiScoreWeight = preferences.leadMatching.minAIScore / 100;
          score += aiScoreWeight * 15;
          
          // Response time commitment (0-10 points) - faster = better
          if (preferences.availability.responseTime <= 1) {
            score += 10;
          } else if (preferences.availability.responseTime <= 8) {
            score += 7;
          } else if (preferences.availability.responseTime <= 24) {
            score += 4;
          } else {
            score += 1;
          }
          
          // Filter by trade enabled (0-5 points) - shows intentionality
          if (preferences.leadMatching.filterByTrade) {
            score += 5;
          }
          
          // Clamp to 0-100
          const matchQualityPercent = Math.min(100, Math.max(0, Math.round(score)));
          
          // Determine label and color
          let qualityLabel = 'Weak';
          let qualityColor = '#F59E0B';
          
          if (matchQualityPercent >= 75) {
            qualityLabel = 'Strong';
            qualityColor = '#43cea2';
          } else if (matchQualityPercent >= 50) {
            qualityLabel = 'Good';
            qualityColor = '#60A5FA';
          } else if (matchQualityPercent >= 25) {
            qualityLabel = 'Fair';
            qualityColor = '#F59E0B';
          } else {
            qualityLabel = 'Weak';
            qualityColor = '#F59E0B';
          }
          
          return (
            <LinearGradient
              colors={[...SECTION_GRADIENT_BORDER_COLORS]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.matchQualityGradientBorder}
            >
              <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg }]}>
                <View style={styles.sectionHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      !darkMode && { color: Colors.text },
                    ]}
                  >
                    Match Quality
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
                    Your preference configuration score
                  </Text>
                </View>
                <View style={styles.sectionContent}>
                  <View style={styles.matchQualityHeader}>
                    <Text style={[styles.matchQualityLabel, { color: textColor }]}>Match Quality:</Text>
                    <Text style={[styles.matchQualityValue, { color: qualityColor }]}>{qualityLabel}</Text>
                  </View>
                  <View
                    style={[
                      styles.matchQualityProgressContainer,
                      !darkMode && { backgroundColor: Colors.line },
                    ]}
                  >
                    <View style={[styles.matchQualityProgressBar, { width: `${matchQualityPercent}%`, backgroundColor: qualityColor }]} />
                  </View>
                </View>
              </View>
            </LinearGradient>
          );
        }, [preferences.tradeTypes, preferences.serviceAreas, preferences.priceRange, preferences.leadMatching.minAIScore, preferences.leadMatching.filterByTrade, preferences.leadMatching.preferredTimelines, preferences.availability.responseTime, cardColor, borderColor, textColor, sectionSubtitleColor, darkMode, Colors.line])}

        {/* Estimated Impact Based on Your Filters */}
        {useMemo(() => {
          // Calculate stats based on current preferences
          const selectedTradeTypes = Object.keys(preferences.tradeTypes).filter(
            key => preferences.tradeTypes[key as keyof typeof preferences.tradeTypes]
          );
          const totalLeadsPerMonth = selectedTradeTypes.reduce((sum, key) => {
            const impact = getTradeTypeImpact(key as keyof ContractorPreferences['tradeTypes']);
            return sum + impact.leadsPerMonth;
          }, 0);
          const avgJobSize = selectedTradeTypes.length > 0
            ? selectedTradeTypes.reduce((sum, key) => {
                const impact = getTradeTypeImpact(key as keyof ContractorPreferences['tradeTypes']);
                return sum + impact.avgJobSize;
              }, 0) / selectedTradeTypes.length
            : 0;
          // Mock close rate based on AI score threshold (higher threshold = higher close rate)
          const closeRate = Math.round(25 + (preferences.leadMatching.minAIScore / 100) * 25); // 25-50% range
          // Win probability (same as close rate for now)
          const winProbability = closeRate;
          // Estimated monthly value
          const estimatedMonthlyValue = totalLeadsPerMonth * avgJobSize * (closeRate / 100);
          
          return (
            <LinearGradient
              colors={[...SECTION_GRADIENT_BORDER_COLORS]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.impactGradientBorder}
            >
              <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg }]}>
                <View style={styles.sectionHeader}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      !darkMode && { color: Colors.text },
                    ]}
                  >
                    Estimated Impact
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
                    Projected results based on your preferences
                  </Text>
                </View>
                <View style={styles.sectionContent}>
                  <View style={styles.previewStrip}>
                    <View style={styles.impactListItem}>
                      <Text style={[styles.impactBullet, { color: '#43cea2' }]}>•</Text>
                      <Text style={[styles.impactText, { color: textColor }]}>
                        +{totalLeadsPerMonth} leads / month
                      </Text>
                    </View>
                    <View style={styles.impactListItem}>
                      <Text style={[styles.impactBullet, { color: '#43cea2' }]}>•</Text>
                      <Text style={[styles.impactText, { color: textColor }]}>
                        Avg job: ${Math.round(avgJobSize).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.impactListItem}>
                      <Text style={[styles.impactBullet, { color: '#43cea2' }]}>•</Text>
                      <Text style={[styles.impactText, { color: textColor }]}>
                        Win probability: {winProbability}%
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.impactHelperText,
                      { color: textSecondaryColor },
                      !darkMode && { opacity: 1 },
                    ]}
                  >
                    Updates as you adjust preferences below
                  </Text>
                </View>
              </View>
            </LinearGradient>
          );
        }, [preferences.tradeTypes, preferences.leadMatching.minAIScore, cardColor, borderColor, textColor, textSecondaryColor, sectionSubtitleColor, darkMode])}
        </View>

        {/* Filter Rail */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterRail}
          contentContainerStyle={styles.filterRailContent}
        >
          {[
            { key: 'trades', label: 'Trades', icon: 'build', getSummary: getTradesFilterSummary },
            { key: 'location', label: 'Location', icon: 'location-on', getSummary: getLocationFilterSummary },
            { key: 'pricing', label: 'Budget', icon: 'attach-money', getSummary: getBudgetFilterSummary },
            { key: 'timeline', label: 'Timeline', icon: 'schedule', getSummary: getTimelineFilterSummary },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            const summary = tab.getSummary();
            const hasFilter = summary.length > 0;
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterPill,
                  { 
                    backgroundColor: cardColor,
                    borderColor: isActive ? '#43cea2' : borderColor,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  // If clicking the active tab, go back to trades
                  // Otherwise, switch to the selected tab
                  if (isActive) {
                    setActiveTab('trades');
                  } else {
                    setActiveTab(tab.key as any);
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <MaterialIcons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? '#43cea2' : textSecondaryColor}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isActive ? '#43cea2' : textColor },
                  ]}
                  numberOfLines={1}
                >
                  {hasFilter ? `${tab.label}: ${summary}` : tab.label}
                </Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={16}
                  color={isActive ? '#43cea2' : textSecondaryColor}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tier 1 Content */}
        <View style={styles.tier1Content}>
          {activeTab === 'trades' && (
            <View style={styles.wideContainer}>
              {renderTradesTab()}
            </View>
          )}
          {activeTab === 'location' && renderLocationTab()}
          {activeTab === 'pricing' && renderPricingTab()}
          {activeTab === 'timeline' && renderTimelineTab()}

          {/* Availability & Response Section */}
          <View style={styles.deliverySection}>
            <View style={styles.wideContainer}>
              <LinearGradient
                colors={[...SECTION_GRADIENT_BORDER_COLORS]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.availabilityGradientBorder}
              >
                <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg }]}>
                  <TouchableOpacity
                    style={styles.deliveryCardHeader}
                    onPress={() => {
                      setIsAvailabilityResponseCollapsed(!isAvailabilityResponseCollapsed);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="schedule" size={18} color={textColor} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.sectionTitle,
                          !darkMode && { color: Colors.text },
                        ]}
                      >
                        Availability & Response
                      </Text>
                      {isAvailabilityResponseCollapsed ? (
                        <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
                          Response: {preferences.availability.responseTime <= 0.25 ? '< 15 min' :
                                     preferences.availability.responseTime <= 1 ? '< 1 hour' :
                                     preferences.availability.responseTime <= 8 ? 'Same day' : '2+ days'} · {preferences.availability.isAvailable ? 'Available' : 'OOF'}
                        </Text>
                      ) : (
                        <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
                          Set your response time and availability preferences
                        </Text>
                      )}
                    </View>
                    <MaterialIcons
                      name={isAvailabilityResponseCollapsed ? "expand-more" : "expand-less"}
                      size={24}
                      color={textSecondaryColor}
                    />
                  </TouchableOpacity>

                  {!isAvailabilityResponseCollapsed && (
                    <View style={styles.sectionContent}>
                {/* Response Speed Commitment */}
            <View style={styles.responseSLASection}>
              <Text style={[styles.responseSLATitle, { color: textColor }]}>Response Speed Commitment</Text>
              {[
                { label: '< 15 minutes', value: 0.25, boost: 'Highest boost' },
                { label: '< 1 hour', value: 1, boost: 'Recommended' },
                { label: 'Same day', value: 8, boost: '' },
                { label: '2+ days', value: 48, boost: '' },
              ].map((option) => {
                const isSelected = preferences.availability.responseTime === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.responseSLAOption,
                      { backgroundColor: cardColor, borderColor },
                      isSelected && {
                        borderColor: '#43cea2',
                        borderWidth: 1.5,
                        backgroundColor: darkMode ? 'rgba(45, 212, 191, 0.08)' : 'rgba(45, 212, 191, 0.1)',
                      },
                    ]}
                    onPress={() => {
                      updatePreferences('availability', {
                        ...preferences.availability,
                        responseTime: option.value,
                      });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={styles.responseSLAOptionContent}>
                      <View style={styles.responseSLAOptionLeft}>
                        <View style={[
                          styles.responseSLAOptionRadio,
                          { borderColor: isSelected ? '#43cea2' : borderColor },
                          isSelected && { backgroundColor: '#43cea2' },
                        ]}>
                          {isSelected && <View style={styles.responseSLAOptionRadioInner} />}
                        </View>
                        <Text style={[styles.responseSLAOptionLabel, { color: textColor }]}>
                          {option.label}
                        </Text>
                      </View>
                      {option.boost && !isSelected && (
                        <Text style={[styles.responseSLAOptionBoost, { color: textSecondaryColor }]}>
                          ({option.boost})
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Ranking Indicator */}
            <View style={styles.rankingIndicator}>
              {preferences.availability.responseTime <= 1 ? (
                <View style={styles.rankingIndicatorRow}>
                  <Text style={[styles.rankingIndicatorEmoji, { color: '#43cea2' }]}>🟢</Text>
                  <Text style={[styles.rankingIndicatorText, { color: textColor }]}>
                    Response impact: Boosted
                  </Text>
                </View>
              ) : preferences.availability.responseTime <= 8 ? (
                <View style={styles.rankingIndicatorRow}>
                  <Text style={[styles.rankingIndicatorEmoji, { color: '#F59E0B' }]}>🟡</Text>
                  <Text style={[styles.rankingIndicatorText, { color: textColor }]}>
                    Response impact: Neutral
                  </Text>
                </View>
              ) : (
                <View style={styles.rankingIndicatorRow}>
                  <Text style={[styles.rankingIndicatorEmoji, { color: textSecondaryColor }]}>⚪</Text>
                  <Text style={[styles.rankingIndicatorText, { color: textColor }]}>
                    Response impact: Lower
                  </Text>
                </View>
              )}
            </View>

            {/* Divider before Out-of-Office Mode */}
            <View style={[styles.sectionDivider, { marginVertical: 16 }]} />

            {/* Out-of-Office Mode */}
            <View style={[
              styles.switchRow,
              !preferences.availability.isAvailable && styles.dimmedRow
            ]}>
              <View style={styles.switchInfo}>
                <Text style={[styles.switchLabel, { color: textColor }]}>Out-of-Office Mode</Text>
                <Text style={[styles.switchDescription, { color: textSecondaryColor }]}>
                  {!preferences.availability.isAvailable ? 'Lead delivery paused — ranking temporarily unaffected' : 'Temporarily pause lead notifications'}
                </Text>
              </View>
                  <Switch
                    value={!preferences.availability.isAvailable}
                    onValueChange={value =>
                      updatePreferences('availability', {
                        ...preferences.availability,
                        isAvailable: !value,
                      })
                    }
                  trackColor={{ false: darkMode ? borderColor : Colors.line, true: accentColor }}
                  ios_backgroundColor={darkMode ? borderColor : Colors.line}
                    thumbColor={!preferences.availability.isAvailable ? 'white' : '#f4f3f4'}
                  />
                </View>
              </View>
              )}
            </View>
          </LinearGradient>
        </View>
      </View>

          {/* AI Matching Rules - Collapsible */}
          <View style={styles.wideContainer}>
            <LinearGradient
              colors={[...SECTION_GRADIENT_BORDER_COLORS]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.aiMatchingGradientBorder}
            >
              <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.bg }]}>
                <TouchableOpacity
                  style={styles.aiMatchingRulesHeader}
                  onPress={() => {
                    setIsAIMatchingRulesCollapsed(!isAIMatchingRulesCollapsed);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="psychology" size={18} color={textColor} />
                  <View style={styles.aiMatchingRulesHeaderText}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        !darkMode && { color: Colors.text },
                      ]}
                    >
                      AI Matching Rules
                    </Text>
                    {isAIMatchingRulesCollapsed ? (
                      <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
                        Min score: {preferences.leadMatching.minAIScore}% · Auto-accept {preferences.leadMatching.autoAccept ? 'ON' : 'OFF'} · Boosts {preferences.leadMatching.filterByTrade ? 'ON' : 'OFF'}
                      </Text>
                    ) : (
                      <Text style={[styles.sectionSubtitle, { color: sectionSubtitleColor }]}>
                        Control how leads are scored and prioritized
                      </Text>
                    )}
                  </View>
                  <MaterialIcons
                    name={isAIMatchingRulesCollapsed ? "expand-more" : "expand-less"}
                    size={24}
                    color={textSecondaryColor}
                  />
                </TouchableOpacity>

                {!isAIMatchingRulesCollapsed && (
                  <View style={styles.sectionContent}>
                    {renderMatchingTab()}
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>

        </View>

        {/* Tier 3 Content (Notifications & Availability) - Show when selected */}
        {(activeTab === 'notifications' || activeTab === 'availability') && (
          <View style={styles.tier3ContentContainer}>
            {activeTab === 'notifications' && renderNotificationsTab()}
            {activeTab === 'availability' && renderAvailabilityTab()}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: '#43cea2' }]}
          onPress={handleSavePreferences}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save & Update Matching'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleResetToDefaults}
        >
          <Text style={[styles.clearButtonText, { color: textColor }]}>
            Reset to Defaults
          </Text>
        </TouchableOpacity>
        
        <Text style={[styles.saveHelperText, { color: textSecondaryColor }]}>
          Changes apply immediately to new leads
        </Text>

        {/* Disclaimer at bottom */}
        <View style={[styles.impactDisclaimerCard, { backgroundColor: cardColor, borderColor, marginTop: 24, marginBottom: 20 }]}>
          <MaterialIcons name="info" size={14} color={textSecondaryColor} style={styles.impactDisclaimerIcon} />
          <Text style={[styles.impactDisclaimerText, { color: textSecondaryColor }]}>
            Numbers are averages based on real data. Individual project values can vary significantly
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E2E8F0',
    marginTop: 2,
  },
  backBtnWrapper: {
    marginRight: 12,
  },
  backBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flex: 1,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  statusLine: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  tradesList: {
    flex: 1,
  },
  tradeCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  tradeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tradeInfo: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 4,
  },
  tradeSwitchWrap: {
    alignSelf: 'center',
    marginLeft: 4,
  },
  tradeTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tradeDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    opacity: 0.88,
  },
  tradeImpactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  tradeImpactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationSection: {
    marginBottom: 30,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  zipCodeInput: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  addButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  zipCodeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zipCodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
  },
  emptyState: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  zipCodeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  serviceAreaInput: {
    gap: 10,
    marginBottom: 15,
  },
  serviceAreaList: {
    marginTop: 15,
  },
  serviceAreaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  serviceAreaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serviceAreaCity: {
    fontSize: 14,
    fontWeight: '600',
  },
  serviceAreaRadius: {
    fontSize: 12,
    marginTop: 2,
  },
  radiusSliderContainer: {
    marginBottom: 16,
  },
  radiusSlider: {
    width: '100%',
    height: 40,
  },
  radiusValue: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  locationPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 16,
  },
  locationPreviewText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sliderContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 14,
    marginBottom: 10,
  },
  pricingSection: {
    marginBottom: 20,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  priceSeparator: {
    fontSize: 16,
  },
  matchingSection: {
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  switchLabel: {
    fontSize: 16,
    flex: 1,
    marginRight: 15,
  },
  switchDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  timelineSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  timelineButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationSection: {
    marginBottom: 20,
  },
  availabilitySection: {
    marginBottom: 20,
  },
  responseTimeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  responseTimeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  responseTimeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiScoreHeroCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  aiScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  aiScoreTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  aiScoreSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  aiScoreSliderContainer: {
    marginBottom: 16,
  },
  aiScoreValue: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  aiScoreSlider: {
    width: '100%',
    height: 40,
  },
  aiScoreMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  aiScoreMessage: {
    fontSize: 12,
    fontWeight: '500',
  },
  warningCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  warningCardContent: {
    flex: 1,
  },
  warningCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningCardText: {
    fontSize: 12,
    lineHeight: 16,
  },
  saveButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveHelperText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },
  matchQualityGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 16,
  },
  impactGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 20,
  },
  tradesGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 20,
  },
  availabilityGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 20,
  },
  aiMatchingGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: '#000000',
    borderRadius: 22,
    padding: 18,
    borderWidth: 0,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.78)',
    lineHeight: 18,
  },
  sectionContent: {
    padding: 0,
    paddingTop: 8,
  },
  matchQualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchQualityLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  matchQualityValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  matchQualityProgressContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  matchQualityProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  impactSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  impactHelperText: {
    fontSize: 11,
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  previewStrip: {
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderRadius: 8,
    marginBottom: 8,
  },
  impactListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  impactBullet: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '700',
  },
  impactText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewMetric: {
    alignItems: 'center',
    flex: 1,
  },
  previewMetricValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewMetricDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  tradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  tradeChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectedTrades: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  selectedTradesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedTradesList: {
    fontSize: 14,
    lineHeight: 20,
  },
  advancedMatchingTitleContainer: {
    flex: 1,
  },
  advancedMatchingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  aiMatchingRulesCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
  },
  aiMatchingRulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    gap: 12,
    paddingVertical: 4,
    paddingTop: 8,
  },
  aiMatchingRulesHeaderText: {
    flex: 1,
  },
  aiMatchingRulesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiMatchingRulesSubtitle: {
    fontSize: 14,
  },
  aiMatchingRulesContent: {
    marginTop: 16,
    paddingTop: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 24,
  },
  deliverySection: {
    marginTop: 20,
  },
  deliveryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  deliveryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
    paddingVertical: 4,
    paddingTop: 8,
  },
  deliveryCardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  deliveryCardSubtitle: {
    fontSize: 13,
  },
  deliveryCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  deliveryCardRowText: {
    fontSize: 15,
    fontWeight: '500',
  },
  deliveryHelperText: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  responseSLASection: {
    marginTop: 16,
    marginBottom: 16,
  },
  responseSLATitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as const,
  },
  responseSLAOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  responseSLAOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  responseSLAOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  responseSLAOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  responseSLAOptionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  responseSLAOptionLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  responseSLAOptionBoost: {
    fontSize: 12,
  },
  rankingIndicator: {
    marginTop: 14,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  rankingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankingIndicatorEmoji: {
    fontSize: 16,
  },
  rankingIndicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterRail: {
    marginTop: 12,
    marginBottom: 18,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  filterRailContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 120,
  },
  tier1Content: {
    marginTop: 16,
  },
  priorityBoostsSection: {
    marginBottom: 24,
  },
  priorityBoostsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.25,
    textTransform: 'uppercase' as const,
  },
  priorityBoostsSubtitle: {
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },
  hardFiltersSection: {
    marginBottom: 22,
  },
  hardFiltersTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.25,
    textTransform: 'uppercase' as const,
  },
  hardFiltersSubtitle: {
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 18,
  },
  hardFilterRow: {
    marginBottom: 24,
  },
  hardFilterLabel: {
    marginBottom: 12,
  },
  hardFilterLabelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  hardFilterDescription: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  hardFilterControl: {
    marginTop: 8,
  },
  hardFilterValueContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  hardFilterValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  hardFilterSlider: {
    width: '100%',
    height: 32,
    marginBottom: 8,
  },
  hardFilterSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  hardFilterSliderLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  hardFiltersHelper: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  rulesPreviewLine: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
  },
  rulesPreviewText: {
    fontSize: 13,
    textAlign: 'center',
  },
  impactDisclaimerCard: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  impactDisclaimerIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  impactDisclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});

export default ContractorPreferences;
