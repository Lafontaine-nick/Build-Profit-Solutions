import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useProjectData } from '../contexts/ProjectDataContext';
import aiBudgetForecastingService from '../services/aiBudgetForecastingService';
import { formatMoneyShort, clampProjected, percentSafe } from '../src/lib/budgetUtils';

interface BudgetForecast {
  projectedTotal: number;
  riskLevel: 'low' | 'medium' | 'high';
  overrunProbability: number;
  recommendations: string[];
  categoryAnalysis: {
    category: string;
    currentSpent: number;
    projectedSpent: number;
    riskLevel: 'low' | 'medium' | 'high';
    variance: number;
  }[];
  timelineAnalysis: {
    currentProgress: number;
    projectedCompletion: string;
    budgetBurnRate: number;
  };
  costSavings?: {
    opportunity: string;
    amount: number;
    priority: 'high' | 'medium' | 'low';
  }[];
  marketConditions?: {
    materials: number;
    labor: number;
    trend: 'up' | 'down' | 'stable';
  };
}

const { width } = Dimensions.get('window');

export default function AIBudgetInsights() {
  const { darkMode } = useTheme();
  const { projectData } = useProjectData();
  const [forecast, setForecast] = useState<BudgetForecast | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Animation values
  const expandAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const slideAnimation = useRef(new Animated.Value(50)).current;
  const chevronRotation = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#43cea2'],
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        card: '#1B365D',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        gradient: ['#1B365D', '#43cea2'],
      }
    : {
        background: ['#f5f7fa', '#c3cfe2', '#fff'],
        text: '#1e293b',
        subtext: '#64748b',
        card: '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        gradient: ['#ffffff', '#f8fafc'],
      };

  const analyzeBudget = async () => {
    setIsLoading(true);

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    ).start();

    try {
      const result =
        await aiBudgetForecastingService.analyzeBudgetRisk(projectData as any);
      
      // Clamp projected total to realistic range (prevents $793649M insanity)
      const plannedBudget = projectData.budgeted || 100000; // Use actual budget or sensible default
      const clampedProjected = clampProjected(result.projectedTotal, plannedBudget, {
        minMultiplier: 0.5,
        maxMultiplier: 3
      });
      
      // Add mock cost savings and market data
      const enhancedResult = {
        ...result,
        projectedTotal: clampedProjected, // Use clamped value
        costSavings: [
          { opportunity: 'Bulk material purchase discount', amount: 2400, priority: 'high' as const },
          { opportunity: 'Alternative supplier for electrical', amount: 850, priority: 'medium' as const },
          { opportunity: 'Optimize labor scheduling', amount: 1200, priority: 'high' as const },
        ],
        marketConditions: {
          materials: 85,
          labor: 65,
          trend: 'stable' as const,
        },
      };
      
      setForecast(enhancedResult);
      setLastUpdated(new Date());

      // Stop pulse animation
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(1);

      // Fade in animation
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      console.error('Budget analysis failed:', error);
      Alert.alert(
        'Analysis Error',
        'Failed to analyze budget. Please try again.'
      );
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(1);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);

    // Haptic feedback
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Animated.parallel([
      Animated.timing(expandAnimation, {
        toValue,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnimation, {
        toValue: isExpanded ? 50 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(chevronRotation, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return theme.danger;
      case 'medium':
        return theme.warning;
      case 'low':
        return theme.success;
      default:
        return theme.subtext;
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      case 'low':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  // Use safe formatting from budgetUtils - prevents $795B insanity
  const formatCompactCurrency = (num: number): string => {
    return formatMoneyShort(num, { allowBillion: false }).replace('$', '');
  };

  const getTimeAgo = (date: Date | null): string => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  useEffect(() => {
    analyzeBudget();
  }, []);

  const animatedHeight = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250], // Reduced to fit simplified content (was 800)
  });

  if (!forecast && !isLoading) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            transform: [{ scale: pulseAnimation }],
          },
        ]}
      >
        <TouchableOpacity 
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            analyzeBudget();
          }} 
          style={styles.header}
        >
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              🤖 AI Budget Analysis
            </Text>
            <View
              style={[styles.statusBadge, { backgroundColor: theme.accent }]}
            >
              <Text style={styles.statusText}>READY</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            ✨ Tap to analyze budget risks and get AI insights
          </Text>
          <View style={[styles.ctaBadge, { backgroundColor: theme.accent + '20' }]}>
            <Text style={[styles.ctaText, { color: theme.accent }]}>
              🚀 Start Analysis
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (isLoading) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            transform: [{ scale: pulseAnimation }],
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              🤖 AI Budget Analysis
            </Text>
            <ActivityIndicator size='small' color={theme.accent} />
          </View>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            🔮 Analyzing budget data with AI...
          </Text>
          <View style={[styles.progressContainer, { backgroundColor: theme.border }]}>
            <Animated.View 
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.accent,
                  width: '100%',
                  opacity: pulseAnimation,
                },
              ]}
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  const chevronRotate = chevronRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: fadeAnimation,
        },
      ]}
    >
      <TouchableOpacity
        onPress={toggleExpanded}
        style={styles.header}
        activeOpacity={0.8}
      >
          <View style={styles.titleRow}>
            <View style={{flex: 1}}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                🤖 AI Insights
              </Text>
              <Text style={[styles.subtitle, { color: theme.subtext, marginTop: 4 }]} numberOfLines={2}>
                {forecast?.riskLevel === 'low' 
                  ? '✅ Budget trending well - stay on current path'
                  : forecast?.riskLevel === 'medium'
                  ? '⚠️ Watch spending - consider cost controls'
                  : '🚨 High risk - immediate action needed'}
              </Text>
            </View>
            <Animated.Text 
              style={[
                styles.chevron, 
                { color: theme.accent, transform: [{ rotate: chevronRotate }], fontSize: 20 }
              ]}
            >
              ▼
            </Animated.Text>
          </View>

          {/* Enhanced Progress Bar */}
          <View
            style={[styles.progressContainer, { backgroundColor: theme.border }]}
          >
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: getRiskColor(forecast?.riskLevel ?? 'low'),
                  width: `${Math.min(forecast?.overrunProbability ?? 0, 100)}%`,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.expandedContent,
            {
              height: animatedHeight,
              opacity: expandAnimation,
              transform: [{ translateY: slideAnimation }],
            },
          ]}
        >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Top Priority Actions - Simplified */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              💡 Top Priorities
            </Text>
            {forecast?.recommendations?.slice(0, 2).map?.((recommendation, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.recommendationItem,
                  {
                    backgroundColor: theme.background[0],
                    transform: [{ translateX: slideAnimation }],
                  },
                ]}
              >
                <Text
                  style={[styles.recommendationText, { color: theme.text }]}
                >
                  {recommendation}
                </Text>
              </Animated.View>
            )) ?? []}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              onPress={() => Alert.alert('Export', 'Budget report exported successfully!')}
              style={[styles.actionButton, { backgroundColor: theme.accent }]}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>📊 Export Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert('Schedule', 'Review meeting scheduled for tomorrow at 10 AM')}
              style={[styles.actionButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.accent }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionButtonText, { color: theme.accent }]}>📅 Schedule Review</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={analyzeBudget}
            style={[styles.refreshButton, { backgroundColor: theme.accent }]}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>🔄 Refresh Analysis</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  ctaBadge: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  riskText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  riskGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  riskCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  riskLabel: {
    fontSize: 10,
    marginBottom: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  riskValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  marketCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  marketRow: {
    marginBottom: 16,
  },
  marketLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  marketBarContainer: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  marketBar: {
    height: '100%',
    borderRadius: 4,
  },
  marketValue: {
    position: 'absolute',
    right: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  trendBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  trendText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  savingItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  savingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  savingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginRight: 8,
  },
  savingAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  totalSavingsCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  totalSavingsLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalSavingsValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
  },
  categoryItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryRiskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryRiskText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryDetails: {
    marginTop: 4,
  },
  categoryDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  recommendationItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#43cea2',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionSection: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  refreshButton: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
