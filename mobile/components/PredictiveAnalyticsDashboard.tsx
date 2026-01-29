import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useProjectData } from '../contexts/ProjectDataContext';
import aiPredictiveAnalyticsService from '../services/aiPredictiveAnalyticsService';
import { formatOverrunPercent } from '../utils/formatters';
import { formatMoneyShort, percentSafe, clampProjected } from '../src/lib/budgetUtils';

interface PredictiveInsight {
  type:
    | 'cost_trend'
    | 'schedule_risk'
    | 'budget_alert'
    | 'efficiency_tip'
    | 'market_insight';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  impact: string;
  recommendation: string;
  confidence: number;
  timeframe: string;
}

interface AnalyticsData {
  insights: PredictiveInsight[];
  trends: {
    spendingTrend: 'increasing' | 'decreasing' | 'stable';
    efficiencyTrend: 'improving' | 'declining' | 'stable';
    riskLevel: 'low' | 'medium' | 'high';
  };
  predictions: {
    completionDate: string;
    finalCost: number;
    costVariance: number;
    scheduleVariance: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

const { width } = Dimensions.get('window');

export default function PredictiveAnalyticsDashboard() {
  const { darkMode } = useTheme();
  const { projectData } = useProjectData();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'insights' | 'predictions' | 'recommendations'
  >('insights');
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null);

  // Animation values
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(30)).current;
  const scaleAnimation = useRef(new Animated.Value(0.95)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const expandAnimation = useRef(new Animated.Value(0)).current;
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
        info: '#3b82f6',
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
        info: '#2563eb',
        gradient: ['#ffffff', '#f8fafc'],
      };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const result =
        await aiPredictiveAnalyticsService.generateAnalytics(projectData);
      
      // Clamp final cost prediction to realistic range
      const plannedBudget = projectData.budgeted || 100000;
      const clampedFinalCost = clampProjected(
        result.predictions?.finalCost ?? 0,
        plannedBudget,
        { minMultiplier: 0.5, maxMultiplier: 3 }
      );
      
      // Use clamped values
      const clampedResult = {
        ...result,
        predictions: {
          ...result.predictions,
          finalCost: clampedFinalCost,
        },
      };
      
      setAnalytics(clampedResult);

      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start();
    } catch (error) {
      console.error('Analytics loading failed:', error);
      Alert.alert(
        'Analytics Error',
        'Failed to load predictive analytics. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return theme.danger;
      case 'warning':
        return theme.warning;
      case 'info':
        return theme.info;
      default:
        return theme.subtext;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📊';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return '📈';
      case 'decreasing':
        return '📉';
      case 'improving':
        return '⬆️';
      case 'declining':
        return '⬇️';
      case 'stable':
        return '➡️';
      default:
        return '📊';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return theme.danger;
      case 'decreasing':
        return theme.success;
      case 'improving':
        return theme.success;
      case 'declining':
        return theme.danger;
      case 'stable':
        return theme.info;
      default:
        return theme.subtext;
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
      Animated.timing(chevronRotation, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderInsightCard = (insight: PredictiveInsight, index: number) => {
    return (
      <Animated.View
        key={index}
        style={[
          styles.insightCard,
          {
            backgroundColor: theme.card,
            borderLeftColor: getSeverityColor(insight.severity),
            transform: [
              { translateY: slideAnimation },
              { scale: scaleAnimation },
            ],
            opacity: fadeAnimation,
          },
        ]}
      >
        <View style={styles.insightHeader}>
          <View style={styles.insightTitleRow}>
            <Text
              style={[
                styles.insightIcon,
                { color: getSeverityColor(insight.severity) },
              ]}
            >
              {getSeverityIcon(insight.severity)}
            </Text>
            <Text style={[styles.insightTitle, { color: theme.text }]}>
              {insight.title}
            </Text>
          </View>
          <Text style={[styles.insightMessage, { color: theme.subtext, marginTop: 6 }]}>
            💡 {insight.recommendation}
          </Text>
          <Text style={[styles.timeframe, { color: theme.subtext, marginTop: 6, fontSize: 12 }]}>
            ⏱️ {insight.timeframe}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const renderPredictionsTab = () => (
    <Animated.View
      style={[
        styles.tabContent,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      {/* Cost Prediction Card */}
      <View
        style={[
          styles.predictionCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.predictionTitle, { color: theme.text }]}>
          💰 Cost Predictions
        </Text>
        <View style={styles.predictionGrid}>
          <View style={styles.predictionItem}>
            <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
              Final Cost
            </Text>
            <Text style={[styles.predictionValue, { color: theme.text }]}>
              {formatMoneyShort(analytics?.predictions?.finalCost ?? 0, { allowBillion: false })}
            </Text>
          </View>
          <View style={styles.predictionItem}>
            <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
              Cost Variance
            </Text>
            <Text
              style={[
                styles.predictionValue,
                {
                  color:
                    (analytics?.predictions?.costVariance ?? 0) > 0
                      ? theme.danger
                      : theme.success,
                },
              ]}
            >
              {(analytics?.predictions?.costVariance ?? 0) > 0 ? '+' : ''}
              {percentSafe(analytics?.predictions?.costVariance ?? 0, 100, { max: 999 }).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Schedule Prediction Card */}
      <View
        style={[
          styles.predictionCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.predictionTitle, { color: theme.text }]}>
          📅 Schedule Predictions
        </Text>
        <View style={styles.predictionGrid}>
          <View style={styles.predictionItem}>
            <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
              Completion Date
            </Text>
            <Text style={[styles.predictionValue, { color: theme.text }]}>
              {analytics?.predictions?.completionDate ?? 'N/A'}
            </Text>
          </View>
          <View style={styles.predictionItem}>
            <Text style={[styles.predictionLabel, { color: theme.subtext }]}>
              Schedule Variance
            </Text>
            <Text
              style={[
                styles.predictionValue,
                {
                  color:
                    (analytics?.predictions?.scheduleVariance ?? 0) > 0
                      ? theme.danger
                      : theme.success,
                },
              ]}
            >
              {(analytics?.predictions?.scheduleVariance ?? 0) > 0 ? '+' : ''}
              {percentSafe(analytics?.predictions?.scheduleVariance ?? 0, 100, { max: 999 }).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Trends Visualization */}
      <View
        style={[
          styles.trendsCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.trendsTitle, { color: theme.text }]}>
          📊 Current Trends
        </Text>
        <View style={styles.trendsGrid}>
          <View style={styles.trendItem}>
            <Text
              style={[
                styles.trendIcon,
                {
                  color: getTrendColor(
                    analytics?.trends?.spendingTrend ?? 'stable'
                  ),
                },
              ]}
            >
              {getTrendIcon(analytics?.trends?.spendingTrend ?? 'stable')}
            </Text>
            <Text style={[styles.trendLabel, { color: theme.subtext }]} numberOfLines={1}>
              Spending
            </Text>
            <Text
              style={[
                styles.trendValue,
                {
                  color: getTrendColor(
                    analytics?.trends?.spendingTrend ?? 'stable'
                  ),
                },
              ]}
              numberOfLines={1}
            >
              {analytics?.trends?.spendingTrend ?? 'stable'}
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text
              style={[
                styles.trendIcon,
                {
                  color: getTrendColor(
                    analytics?.trends?.efficiencyTrend ?? 'stable'
                  ),
                },
              ]}
            >
              {getTrendIcon(analytics?.trends?.efficiencyTrend ?? 'stable')}
            </Text>
            <Text style={[styles.trendLabel, { color: theme.subtext }]} numberOfLines={1}>
              Efficiency
            </Text>
            <Text
              style={[
                styles.trendValue,
                {
                  color: getTrendColor(
                    analytics?.trends?.efficiencyTrend ?? 'stable'
                  ),
                },
              ]}
              numberOfLines={1}
            >
              {analytics?.trends?.efficiencyTrend ?? 'stable'}
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text
              style={[
                styles.trendIcon,
                {
                  color: getSeverityColor(
                    analytics?.trends?.riskLevel ?? 'low'
                  ),
                },
              ]}
            >
              {getSeverityIcon(analytics?.trends?.riskLevel ?? 'low')}
            </Text>
            <Text style={[styles.trendLabel, { color: theme.subtext }]} numberOfLines={1}>
              Risk Level
            </Text>
            <Text
              style={[
                styles.trendValue,
                {
                  color: getSeverityColor(
                    analytics?.trends?.riskLevel ?? 'low'
                  ),
                },
              ]}
              numberOfLines={1}
            >
              {analytics?.trends?.riskLevel ?? 'low'}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderRecommendationsTab = () => (
    <Animated.View
      style={[
        styles.tabContent,
        {
          opacity: fadeAnimation,
          transform: [{ translateY: slideAnimation }],
        },
      ]}
    >
      {/* Immediate Recommendations */}
      <View
        style={[
          styles.recommendationSection,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text
          style={[styles.recommendationSectionTitle, { color: theme.text }]}
        >
          ⚡ Immediate Actions
        </Text>
        {analytics?.recommendations?.immediate?.map?.((rec, index) => (
          <Animated.View
            key={index}
            style={[
              styles.recommendationItem,
              { backgroundColor: theme.background[0] },
              {
                transform: [{ translateX: slideAnimation }],
                opacity: fadeAnimation,
              },
            ]}
          >
            <Text style={[styles.recommendationText, { color: theme.text }]}>
              {rec}
            </Text>
          </Animated.View>
        )) ?? []}
      </View>

      {/* Short Term Recommendations */}
      <View
        style={[
          styles.recommendationSection,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text
          style={[styles.recommendationSectionTitle, { color: theme.text }]}
        >
          📋 Short Term (1-4 weeks)
        </Text>
        {analytics?.recommendations?.shortTerm?.map?.((rec, index) => (
          <Animated.View
            key={index}
            style={[
              styles.recommendationItem,
              { backgroundColor: theme.background[0] },
              {
                transform: [{ translateX: slideAnimation }],
                opacity: fadeAnimation,
              },
            ]}
          >
            <Text style={[styles.recommendationText, { color: theme.text }]}>
              {rec}
            </Text>
          </Animated.View>
        )) ?? []}
      </View>

      {/* Long Term Recommendations */}
      <View
        style={[
          styles.recommendationSection,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text
          style={[styles.recommendationSectionTitle, { color: theme.text }]}
        >
          🎯 Long Term (1-3 months)
        </Text>
        {analytics?.recommendations?.longTerm?.map?.((rec, index) => (
          <Animated.View
            key={index}
            style={[
              styles.recommendationItem,
              { backgroundColor: theme.background[0] },
              {
                transform: [{ translateX: slideAnimation }],
                opacity: fadeAnimation,
              },
            ]}
          >
            <Text style={[styles.recommendationText, { color: theme.text }]}>
              {rec}
            </Text>
          </Animated.View>
        )) ?? []}
      </View>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading predictive analytics...
          </Text>
        </View>
      </View>
    );
  }

  if (!analytics) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={loadAnalytics} style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            🔮 Predictive Analytics
          </Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            Tap to load AI-powered predictions and insights
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const chevronRotate = chevronRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const animatedHeight = expandAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300], // Reduced to fit simplified content (was 500)
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: fadeAnimation,
          transform: [{ scale: scaleAnimation }],
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
              🔮 Predictions
            </Text>
            <Text style={[styles.subtitle, { color: theme.subtext, marginTop: 4 }]} numberOfLines={2}>
              {analytics?.trends?.riskLevel === 'low'
                ? '✅ Project on track - maintain current pace'
                : analytics?.trends?.riskLevel === 'medium'  
                ? '⚠️ Moderate risk - monitor closely'
                : '🚨 High risk - review schedule and costs'}
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
      </TouchableOpacity>

      {/* Collapsible Content */}
      <Animated.View
        style={[
          styles.expandedContent,
          {
            height: animatedHeight,
            opacity: expandAnimation,
          },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Simplified: Show only top 2 critical insights */}
          <View style={styles.tabContent}>
            {analytics?.insights?.slice(0, 2).map?.((insight, index) =>
              renderInsightCard(insight, index)
            ) ?? []}
          </View>

          <TouchableOpacity
            onPress={loadAnalytics}
            style={[styles.refreshButton, { backgroundColor: theme.accent }]}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>🔄 Refresh Analytics</Text>
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  chevron: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  tabNavigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  tabButtonText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  tabButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 400,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  insightCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  insightHeader: {
    marginBottom: 8,
  },
  insightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  insightTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  insightDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  recommendationBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  recommendationLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  predictionCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  predictionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  predictionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  predictionItem: {
    flex: 1,
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  predictionValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendsCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  trendsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  trendsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 4,
  },
  trendItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  trendIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  trendLabel: {
    fontSize: 10,
    marginBottom: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  recommendationSection: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendationSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  recommendationItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#43cea2',
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
  timeframe: {
    fontSize: 12,
    marginTop: 4,
  },
});
