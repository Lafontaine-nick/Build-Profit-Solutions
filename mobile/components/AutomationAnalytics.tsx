import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface AnalyticsMetric {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
  color: string;
  icon: string;
}

interface WorkflowPerformance {
  id: string;
  name: string;
  totalLeads: number;
  engagedLeads: number;
  conversionRate: number;
  avgResponseTime: string;
  revenue: number;
  cost: number;
  roi: number;
  status: 'active' | 'paused' | 'draft';
  lastActivity: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

interface ConversionFunnel {
  stage: string;
  count: number;
  percentage: number;
  color: string;
  dropoff: number;
}

interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  potentialGain: string;
  effort: 'easy' | 'medium' | 'hard';
  category: string;
}

const MOCK_WORKFLOWS: WorkflowPerformance[] = [
  {
    id: 'wf-1',
    name: 'Welcome Sequence',
    totalLeads: 156,
    engagedLeads: 89,
    conversionRate: 23.5,
    avgResponseTime: '2.3 hours',
    revenue: 12500,
    cost: 1200,
    roi: 941.7,
    status: 'active',
    lastActivity: '2 hours ago',
    category: 'Onboarding',
    priority: 'high',
  },
  {
    id: 'wf-2',
    name: 'Follow-up Campaign',
    totalLeads: 203,
    engagedLeads: 142,
    conversionRate: 31.2,
    avgResponseTime: '1.8 hours',
    revenue: 18900,
    cost: 1800,
    roi: 950.0,
    status: 'active',
    lastActivity: '45 minutes ago',
    category: 'Nurturing',
    priority: 'high',
  },
  {
    id: 'wf-3',
    name: 'Re-engagement',
    totalLeads: 89,
    engagedLeads: 34,
    conversionRate: 28.7,
    avgResponseTime: '4.1 hours',
    revenue: 5600,
    cost: 800,
    roi: 600.0,
    status: 'active',
    lastActivity: '1 day ago',
    category: 'Recovery',
    priority: 'medium',
  },
  {
    id: 'wf-4',
    name: 'High-Value Lead Nurture',
    totalLeads: 67,
    engagedLeads: 45,
    conversionRate: 38.9,
    avgResponseTime: '1.2 hours',
    revenue: 8900,
    cost: 600,
    roi: 1383.3,
    status: 'active',
    lastActivity: '30 minutes ago',
    category: 'Premium',
    priority: 'high',
  },
];

const CONVERSION_FUNNEL: ConversionFunnel[] = [
  {
    stage: 'Leads Generated',
    count: 448,
    percentage: 100,
    color: '#4CAF50',
    dropoff: 0,
  },
  {
    stage: 'Workflow Triggered',
    count: 312,
    percentage: 69.6,
    color: '#2196F3',
    dropoff: 30.4,
  },
  {
    stage: 'Engaged',
    count: 265,
    percentage: 59.2,
    color: '#FF9800',
    dropoff: 10.4,
  },
  {
    stage: 'Converted',
    count: 89,
    percentage: 19.9,
    color: '#9C27B0',
    dropoff: 39.3,
  },
];

const OPTIMIZATION_SUGGESTIONS: OptimizationSuggestion[] = [
  {
    id: 'opt-1',
    title: 'Optimize Welcome Sequence',
    description: 'Add personalization to increase engagement by 15%',
    impact: 'high',
    potentialGain: '+$2,400/month',
    effort: 'easy',
    category: 'Personalization',
  },
  {
    id: 'opt-2',
    title: 'Reduce Response Time',
    description: 'Automate initial responses to improve conversion by 8%',
    impact: 'medium',
    potentialGain: '+$1,200/month',
    effort: 'medium',
    category: 'Automation',
  },
  {
    id: 'opt-3',
    title: 'Segment High-Value Leads',
    description: 'Create premium nurturing path for better ROI',
    impact: 'high',
    potentialGain: '+$3,600/month',
    effort: 'hard',
    category: 'Segmentation',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AutomationAnalytics({ visible, onClose }: Props) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'workflows' | 'funnel' | 'optimization'
  >('overview');
  const [selectedWorkflow, setSelectedWorkflow] =
    useState<WorkflowPerformance | null>(null);
  const [pulseAnim] = useState(() => new Animated.Value(1));
  const [showMetricDetails, setShowMetricDetails] = useState(false);
  const [showWorkflowReport, setShowWorkflowReport] = useState(false);
  const [showFunnelAnalysis, setShowFunnelAnalysis] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<AnalyticsMetric | null>(
    null
  );
  const [selectedFunnelStage, setSelectedFunnelStage] =
    useState<ConversionFunnel | null>(null);

  const backgroundColor = darkMode ? '#14213D' : '#F5F5F5';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';

  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible]);

  const getOverallMetrics = (): AnalyticsMetric[] => [
    {
      label: 'Total Workflows',
      value: MOCK_WORKFLOWS.length,
      change: 12.5,
      trend: 'up',
      color: '#4CAF50',
      icon: 'auto-awesome',
    },
    {
      label: 'Active Leads',
      value: 448,
      change: 8.3,
      trend: 'up',
      color: '#2196F3',
      icon: 'people',
    },
    {
      label: 'Avg Conversion',
      value: '27.8%',
      change: -2.1,
      trend: 'down',
      color: '#FF9800',
      icon: 'trending-up',
    },
    {
      label: 'Total Revenue',
      value: '$37,000',
      change: 15.7,
      trend: 'up',
      color: '#9C27B0',
      icon: 'attach-money',
    },
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'easy':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'hard':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionTitle,
          { color: textColor, marginBottom: 20, textAlign: 'center' },
        ]}
      >
        📊 Analytics Dashboard
      </Text>

      <View style={styles.overviewHeader}>
        <Text style={[styles.overviewTitle, { color: textColor }]}>
          Real-Time Performance
        </Text>
        <View style={styles.liveIndicator}>
          <Animated.View
            style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]}
          />
          <Text style={[styles.liveText, { color: '#4CAF50' }]}>LIVE</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        {getOverallMetrics().map((metric, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.metricCard,
              { backgroundColor: cardColor, borderColor },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelectedMetric(metric);
              setShowMetricDetails(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.metricHeader}>
              <View style={styles.metricIconContainer}>
                <MaterialIcons
                  name={metric.icon as any}
                  size={16}
                  color={metric.color}
                />
              </View>
              <View
                style={[
                  styles.trendIndicator,
                  {
                    backgroundColor:
                      metric.trend === 'up' ? '#4CAF50' : '#FF5252',
                  },
                ]}
              >
                <MaterialIcons
                  name={metric.trend === 'up' ? 'trending-up' : 'trending-down'}
                  size={12}
                  color='white'
                />
                <Text style={styles.trendText}>{Math.abs(metric.change)}%</Text>
              </View>
            </View>
            <Text style={[styles.metricValue, { color: metric.color }]}>
              {metric.value}
            </Text>
            <Text style={[styles.metricLabel, { color: textSecondaryColor }]}>
              {metric.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.performanceChart}>
        <Text style={[styles.chartTitle, { color: textColor }]}>
          Performance Trend
        </Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBar}>
            <LinearGradient
              colors={['#4CAF50', '#8BC34A']}
              style={styles.chartGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <View style={styles.chartLabels}>
            <Text style={[styles.chartLabel, { color: textSecondaryColor }]}>
              Last 7 days
            </Text>
            <Text style={[styles.chartValue, { color: textColor }]}>
              +23.4%
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.topPerformers}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Top Performing Workflows
        </Text>
        {MOCK_WORKFLOWS.slice(0, 3).map((workflow, index) => (
          <TouchableOpacity
            key={workflow.id}
            style={[
              styles.performerCard,
              { backgroundColor: cardColor, borderColor },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelectedWorkflow(workflow);
              setShowWorkflowReport(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.performerHeader}>
              <View style={styles.performerRank}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <View style={styles.performerInfo}>
                <Text style={[styles.performerName, { color: textColor }]}>
                  {workflow.name}
                </Text>
                <Text
                  style={[
                    styles.performerCategory,
                    { color: textSecondaryColor },
                  ]}
                >
                  {workflow.category}
                </Text>
              </View>
              <View
                style={[
                  styles.performerMetric,
                  {
                    backgroundColor:
                      workflow.conversionRate > 30 ? '#4CAF50' : '#FF9800',
                  },
                ]}
              >
                <Text style={styles.performerMetricText}>
                  {workflow.conversionRate}%
                </Text>
              </View>
            </View>
            <View style={styles.performerDetails}>
              <View style={styles.performerDetail}>
                <MaterialIcons
                  name='people'
                  size={14}
                  color={textSecondaryColor}
                />
                <Text
                  style={[
                    styles.performerDetailText,
                    { color: textSecondaryColor },
                  ]}
                >
                  {workflow.totalLeads} leads
                </Text>
              </View>
              <View style={styles.performerDetail}>
                <MaterialIcons
                  name='attach-money'
                  size={14}
                  color={textSecondaryColor}
                />
                <Text
                  style={[
                    styles.performerDetailText,
                    { color: textSecondaryColor },
                  ]}
                >
                  ${workflow.revenue.toLocaleString()}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderWorkflowsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionTitle,
          { color: textColor, marginBottom: 20, textAlign: 'center' },
        ]}
      >
        🔄 Workflow Performance
      </Text>

      <View style={styles.workflowsHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Workflow Performance
        </Text>
        <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
          Detailed analysis of your automation workflows
        </Text>
      </View>

      {MOCK_WORKFLOWS.map(workflow => (
        <TouchableOpacity
          key={workflow.id}
          style={[
            styles.workflowCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            setSelectedWorkflow(workflow);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.workflowHeader}>
            <View style={styles.workflowInfo}>
              <Text style={[styles.workflowName, { color: textColor }]}>
                {workflow.name}
              </Text>
              <Text
                style={[styles.workflowCategory, { color: textSecondaryColor }]}
              >
                {workflow.category}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    workflow.status === 'active' ? '#4CAF50' : '#FF9800',
                },
              ]}
            >
              <Text style={styles.statusText}>
                {workflow.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.workflowMetrics}>
            <View style={styles.workflowMetric}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text style={[styles.workflowMetricValue, { color: textColor }]}>
                {workflow.totalLeads}
              </Text>
              <Text
                style={[
                  styles.workflowMetricLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Total Leads
              </Text>
            </View>
            <View style={styles.workflowMetric}>
              <MaterialIcons
                name='trending-up'
                size={16}
                color={textSecondaryColor}
              />
              <Text style={[styles.workflowMetricValue, { color: textColor }]}>
                {workflow.conversionRate}%
              </Text>
              <Text
                style={[
                  styles.workflowMetricLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Conversion
              </Text>
            </View>
            <View style={styles.workflowMetric}>
              <MaterialIcons
                name='attach-money'
                size={16}
                color={textSecondaryColor}
              />
              <Text style={[styles.workflowMetricValue, { color: textColor }]}>
                ${workflow.revenue.toLocaleString()}
              </Text>
              <Text
                style={[
                  styles.workflowMetricLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Revenue
              </Text>
            </View>
            <View style={styles.workflowMetric}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text style={[styles.workflowMetricValue, { color: textColor }]}>
                {workflow.avgResponseTime}
              </Text>
              <Text
                style={[
                  styles.workflowMetricLabel,
                  { color: textSecondaryColor },
                ]}
              >
                Response Time
              </Text>
            </View>
          </View>

          <View style={styles.workflowFooter}>
            <View style={styles.workflowDetail}>
              <MaterialIcons
                name='account-balance-wallet'
                size={14}
                color={textSecondaryColor}
              />
              <Text
                style={[
                  styles.workflowDetailText,
                  { color: textSecondaryColor },
                ]}
              >
                ROI: {workflow.roi.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.workflowDetail}>
              <MaterialIcons
                name='access-time'
                size={14}
                color={textSecondaryColor}
              />
              <Text
                style={[
                  styles.workflowDetailText,
                  { color: textSecondaryColor },
                ]}
              >
                {workflow.lastActivity}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderFunnelTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionTitle,
          { color: textColor, marginBottom: 20, textAlign: 'center' },
        ]}
      >
        📈 Conversion Funnel
      </Text>

      <View style={styles.funnelHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Conversion Funnel
        </Text>
        <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
          Track lead progression through your automation workflows
        </Text>
      </View>

      <View style={styles.funnelContainer}>
        {CONVERSION_FUNNEL.map((stage, index) => (
          <TouchableOpacity
            key={index}
            style={styles.funnelStage}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSelectedFunnelStage(stage);
              setShowFunnelAnalysis(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.funnelHeader}>
              <View
                style={[styles.funnelDot, { backgroundColor: stage.color }]}
              />
              <Text style={[styles.funnelStageName, { color: textColor }]}>
                {stage.stage}
              </Text>
              <Text style={[styles.funnelPercentage, { color: stage.color }]}>
                {stage.percentage}%
              </Text>
            </View>
            <View style={styles.funnelBar}>
              <View
                style={[
                  styles.funnelFill,
                  {
                    backgroundColor: stage.color,
                    width: `${stage.percentage}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.funnelDetails}>
              <Text style={[styles.funnelCount, { color: textSecondaryColor }]}>
                {stage.count.toLocaleString()} leads
              </Text>
              {stage.dropoff > 0 && (
                <Text style={[styles.funnelDropoff, { color: '#FF5252' }]}>
                  -{stage.dropoff}% dropoff
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.funnelInsights}>
        <Text style={[styles.insightsTitle, { color: textColor }]}>
          Key Insights
        </Text>
        <TouchableOpacity
          style={styles.insightItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              'Performance Insight',
              'Welcome sequence performs 23% better than average. Consider replicating this success in other workflows.'
            );
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
          <Text style={[styles.insightText, { color: textSecondaryColor }]}>
            Welcome sequence performs 23% better than average
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.insightItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              'Optimization Opportunity',
              'High dropoff at engagement stage. Consider adding personalization to improve conversion rates.'
            );
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name='warning' size={16} color='#FF9800' />
          <Text style={[styles.insightText, { color: textSecondaryColor }]}>
            High dropoff at engagement stage - consider personalization
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.insightItem}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert(
              'Premium Lead Insight',
              'Premium leads convert 3x better than standard leads. Focus on high-value lead nurturing strategies.'
            );
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name='lightbulb' size={16} color='#2196F3' />
          <Text style={[styles.insightText, { color: textSecondaryColor }]}>
            Premium leads convert 3x better than standard leads
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderOptimizationTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text
        style={[
          styles.sectionTitle,
          { color: textColor, marginBottom: 20, textAlign: 'center' },
        ]}
      >
        🤖 AI Optimization
      </Text>

      <View style={styles.optimizationHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          AI Optimization
        </Text>
        <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
          Intelligent recommendations to improve your automation performance
        </Text>
      </View>

      <View style={styles.optimizationList}>
        {OPTIMIZATION_SUGGESTIONS.map(suggestion => (
          <View
            key={suggestion.id}
            style={[
              styles.optimizationCard,
              { backgroundColor: cardColor, borderColor },
            ]}
          >
            <View style={styles.optimizationHeader}>
              <MaterialIcons
                name='lightbulb'
                size={20}
                color={getImpactColor(suggestion.impact)}
              />
              <Text style={[styles.optimizationTitle, { color: textColor }]}>
                {suggestion.title}
              </Text>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getImpactColor(suggestion.impact) },
                ]}
              >
                <Text style={styles.priorityText}>
                  {suggestion.impact.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.optimizationDescription,
                { color: textSecondaryColor },
              ]}
            >
              {suggestion.description}
            </Text>
            <View style={styles.optimizationDetails}>
              <View style={styles.optimizationDetail}>
                <MaterialIcons
                  name='trending-up'
                  size={14}
                  color={getImpactColor(suggestion.impact)}
                />
                <Text
                  style={[
                    styles.optimizationDetailText,
                    { color: getImpactColor(suggestion.impact) },
                  ]}
                >
                  {suggestion.potentialGain}
                </Text>
              </View>
              <View style={styles.optimizationDetail}>
                <MaterialIcons
                  name='build'
                  size={14}
                  color={getEffortColor(suggestion.effort)}
                />
                <Text
                  style={[
                    styles.optimizationDetailText,
                    { color: getEffortColor(suggestion.effort) },
                  ]}
                >
                  {suggestion.effort.toUpperCase()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.optimizeButton,
                { backgroundColor: getImpactColor(suggestion.impact) },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert(
                  'Optimization Applied',
                  `${suggestion.title} has been applied to your workflow!`
                );
              }}
            >
              <MaterialIcons name='check' size={16} color='white' />
              <Text style={styles.optimizeButtonText}>Apply Optimization</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: darkMode ? '#0A1428' : '#F0F0F0' },
        ]}
      >
        <View style={[styles.modalContent, { backgroundColor }]}>
          <View style={[styles.modalHeader, { paddingTop: 40 }]}>
            <View style={styles.modalTitleRow}>
              <MaterialIcons name='analytics' size={24} color='#4CAF50' />
              <Text style={[styles.modalTitle, { color: textColor }]}>
                Automation Analytics
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name='close' size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'overview' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('overview')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'overview' ? '#4CAF50' : textSecondaryColor,
                  },
                ]}
              >
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'workflows' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('workflows')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'workflows'
                        ? '#4CAF50'
                        : textSecondaryColor,
                  },
                ]}
              >
                Workflows
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'funnel' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('funnel')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'funnel' ? '#4CAF50' : textSecondaryColor,
                  },
                ]}
              >
                Funnel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'optimization' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('optimization')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'optimization'
                        ? '#4CAF50'
                        : textSecondaryColor,
                  },
                ]}
              >
                Optimize
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'workflows' && renderWorkflowsTab()}
          {activeTab === 'funnel' && renderFunnelTab()}
          {activeTab === 'optimization' && renderOptimizationTab()}
        </View>
      </View>

      {/* Metric Details Modal */}
      <Modal
        visible={showMetricDetails}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowMetricDetails(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: darkMode ? '#0A1428' : '#F0F0F0' },
          ]}
        >
          <View style={[styles.modalContent, { backgroundColor }]}>
            <View style={[styles.modalHeader, { paddingTop: 40 }]}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name='analytics' size={24} color='#4CAF50' />
                <Text style={[styles.modalTitle, { color: textColor }]}>
                  {selectedMetric?.label} Details
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowMetricDetails(false)}>
                <MaterialIcons name='close' size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.tabContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedMetric && (
                <>
                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: cardColor,
                        borderColor,
                        marginBottom: 20,
                      },
                    ]}
                  >
                    <View style={styles.metricHeader}>
                      <View style={styles.metricIconContainer}>
                        <MaterialIcons
                          name={selectedMetric.icon as any}
                          size={24}
                          color={selectedMetric.color}
                        />
                      </View>
                      <View
                        style={[
                          styles.trendIndicator,
                          {
                            backgroundColor:
                              selectedMetric.trend === 'up'
                                ? '#4CAF50'
                                : '#FF5252',
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={
                            selectedMetric.trend === 'up'
                              ? 'trending-up'
                              : 'trending-down'
                          }
                          size={16}
                          color='white'
                        />
                        <Text style={styles.trendText}>
                          {Math.abs(selectedMetric.change)}%
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: selectedMetric.color, fontSize: 32 },
                      ]}
                    >
                      {selectedMetric.value}
                    </Text>
                    <Text
                      style={[
                        styles.metricLabel,
                        { color: textSecondaryColor, fontSize: 16 },
                      ]}
                    >
                      {selectedMetric.label}
                    </Text>
                  </View>

                  <View style={styles.detailsSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Performance Breakdown
                    </Text>
                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Current Period
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: selectedMetric.color },
                        ]}
                      >
                        {selectedMetric.value}
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {selectedMetric.trend === 'up' ? '📈' : '📉'}{' '}
                        {Math.abs(selectedMetric.change)}% from previous period
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Historical Trend
                      </Text>
                      <View style={styles.trendChart}>
                        <View
                          style={[
                            styles.trendBar,
                            {
                              backgroundColor: selectedMetric.color,
                              width: '75%',
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.trendBar,
                            {
                              backgroundColor: selectedMetric.color,
                              width: '60%',
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.trendBar,
                            {
                              backgroundColor: selectedMetric.color,
                              width: '85%',
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.trendBar,
                            {
                              backgroundColor: selectedMetric.color,
                              width: '90%',
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        Last 4 periods performance
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Recommendations
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {selectedMetric.trend === 'up'
                          ? '✅ Continue current strategies - performance is improving'
                          : '⚠️ Review and optimize current strategies to improve performance'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Workflow Report Modal */}
      <Modal
        visible={showWorkflowReport}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowWorkflowReport(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: darkMode ? '#0A1428' : '#F0F0F0' },
          ]}
        >
          <View style={[styles.modalContent, { backgroundColor }]}>
            <View style={[styles.modalHeader, { paddingTop: 40 }]}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name='assessment' size={24} color='#4CAF50' />
                <Text style={[styles.modalTitle, { color: textColor }]}>
                  {selectedWorkflow?.name} Report
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWorkflowReport(false)}>
                <MaterialIcons name='close' size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.tabContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedWorkflow && (
                <>
                  <View
                    style={[
                      styles.workflowCard,
                      {
                        backgroundColor: cardColor,
                        borderColor,
                        marginBottom: 20,
                      },
                    ]}
                  >
                    <View style={styles.workflowHeader}>
                      <View style={styles.workflowInfo}>
                        <Text
                          style={[
                            styles.workflowName,
                            { color: textColor, fontSize: 24 },
                          ]}
                        >
                          {selectedWorkflow.name}
                        </Text>
                        <Text
                          style={[
                            styles.workflowCategory,
                            { color: textSecondaryColor, fontSize: 16 },
                          ]}
                        >
                          {selectedWorkflow.category}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              selectedWorkflow.status === 'active'
                                ? '#4CAF50'
                                : '#FF9800',
                          },
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {selectedWorkflow.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailsSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Performance Metrics
                    </Text>

                    <View style={styles.metricsGrid}>
                      <View
                        style={[
                          styles.detailCard,
                          { backgroundColor: cardColor, borderColor },
                        ]}
                      >
                        <MaterialIcons
                          name='people'
                          size={20}
                          color={textSecondaryColor}
                        />
                        <Text
                          style={[styles.detailValue, { color: textColor }]}
                        >
                          {selectedWorkflow.totalLeads}
                        </Text>
                        <Text
                          style={[
                            styles.detailTitle,
                            { color: textSecondaryColor },
                          ]}
                        >
                          Total Leads
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.detailCard,
                          { backgroundColor: cardColor, borderColor },
                        ]}
                      >
                        <MaterialIcons
                          name='trending-up'
                          size={20}
                          color={textSecondaryColor}
                        />
                        <Text
                          style={[styles.detailValue, { color: textColor }]}
                        >
                          {selectedWorkflow.conversionRate}%
                        </Text>
                        <Text
                          style={[
                            styles.detailTitle,
                            { color: textSecondaryColor },
                          ]}
                        >
                          Conversion Rate
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.detailCard,
                          { backgroundColor: cardColor, borderColor },
                        ]}
                      >
                        <MaterialIcons
                          name='attach-money'
                          size={20}
                          color={textSecondaryColor}
                        />
                        <Text
                          style={[styles.detailValue, { color: textColor }]}
                        >
                          ${selectedWorkflow.revenue.toLocaleString()}
                        </Text>
                        <Text
                          style={[
                            styles.detailTitle,
                            { color: textSecondaryColor },
                          ]}
                        >
                          Revenue
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.detailCard,
                          { backgroundColor: cardColor, borderColor },
                        ]}
                      >
                        <MaterialIcons
                          name='schedule'
                          size={20}
                          color={textSecondaryColor}
                        />
                        <Text
                          style={[styles.detailValue, { color: textColor }]}
                        >
                          {selectedWorkflow.avgResponseTime}
                        </Text>
                        <Text
                          style={[
                            styles.detailTitle,
                            { color: textSecondaryColor },
                          ]}
                        >
                          Response Time
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        ROI Analysis
                      </Text>
                      <Text style={[styles.detailValue, { color: '#4CAF50' }]}>
                        ROI: {selectedWorkflow.roi.toFixed(1)}%
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        Cost: ${selectedWorkflow.cost.toLocaleString()} |
                        Revenue: ${selectedWorkflow.revenue.toLocaleString()}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Last Activity
                      </Text>
                      <Text style={[styles.detailValue, { color: textColor }]}>
                        {selectedWorkflow.lastActivity}
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        Workflow is actively processing leads
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Funnel Analysis Modal */}
      <Modal
        visible={showFunnelAnalysis}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowFunnelAnalysis(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: darkMode ? '#0A1428' : '#F0F0F0' },
          ]}
        >
          <View style={[styles.modalContent, { backgroundColor }]}>
            <View style={[styles.modalHeader, { paddingTop: 40 }]}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name='timeline' size={24} color='#4CAF50' />
                <Text style={[styles.modalTitle, { color: textColor }]}>
                  {selectedFunnelStage?.stage} Analysis
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowFunnelAnalysis(false)}>
                <MaterialIcons name='close' size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.tabContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedFunnelStage && (
                <>
                  <View
                    style={[
                      styles.funnelStage,
                      {
                        backgroundColor: cardColor,
                        borderColor,
                        marginBottom: 20,
                      },
                    ]}
                  >
                    <View style={styles.funnelHeader}>
                      <View
                        style={[
                          styles.funnelDot,
                          {
                            backgroundColor: selectedFunnelStage.color,
                            width: 20,
                            height: 20,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.funnelStageName,
                          { color: textColor, fontSize: 20 },
                        ]}
                      >
                        {selectedFunnelStage.stage}
                      </Text>
                      <Text
                        style={[
                          styles.funnelPercentage,
                          { color: selectedFunnelStage.color, fontSize: 24 },
                        ]}
                      >
                        {selectedFunnelStage.percentage}%
                      </Text>
                    </View>
                    <View style={styles.funnelBar}>
                      <View
                        style={[
                          styles.funnelFill,
                          {
                            backgroundColor: selectedFunnelStage.color,
                            width: `${selectedFunnelStage.percentage}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.funnelDetails}>
                      <Text
                        style={[
                          styles.funnelCount,
                          { color: textSecondaryColor, fontSize: 16 },
                        ]}
                      >
                        {selectedFunnelStage.count.toLocaleString()} leads
                      </Text>
                      {selectedFunnelStage.dropoff > 0 && (
                        <Text
                          style={[
                            styles.funnelDropoff,
                            { color: '#FF5252', fontSize: 16 },
                          ]}
                        >
                          -{selectedFunnelStage.dropoff}% dropoff
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.detailsSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Stage Analysis
                    </Text>

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Conversion Rate
                      </Text>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: selectedFunnelStage.color },
                        ]}
                      >
                        {selectedFunnelStage.percentage}%
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {selectedFunnelStage.percentage > 70
                          ? 'Excellent'
                          : selectedFunnelStage.percentage > 50
                            ? 'Good'
                            : 'Needs Improvement'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Lead Volume
                      </Text>
                      <Text style={[styles.detailValue, { color: textColor }]}>
                        {selectedFunnelStage.count.toLocaleString()}
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        Total leads at this stage
                      </Text>
                    </View>

                    {selectedFunnelStage.dropoff > 0 && (
                      <View
                        style={[
                          styles.detailCard,
                          { backgroundColor: cardColor, borderColor },
                        ]}
                      >
                        <Text
                          style={[styles.detailTitle, { color: textColor }]}
                        >
                          Dropoff Analysis
                        </Text>
                        <Text
                          style={[styles.detailValue, { color: '#FF5252' }]}
                        >
                          {selectedFunnelStage.dropoff}%
                        </Text>
                        <Text
                          style={[
                            styles.detailDescription,
                            { color: textSecondaryColor },
                          ]}
                        >
                          {selectedFunnelStage.dropoff > 30
                            ? 'High dropoff - needs optimization'
                            : 'Moderate dropoff - consider improvements'}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.detailCard,
                        { backgroundColor: cardColor, borderColor },
                      ]}
                    >
                      <Text style={[styles.detailTitle, { color: textColor }]}>
                        Recommendations
                      </Text>
                      <Text
                        style={[
                          styles.detailDescription,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {selectedFunnelStage.percentage > 70
                          ? '✅ This stage is performing well. Consider replicating strategies.'
                          : selectedFunnelStage.dropoff > 30
                            ? '⚠️ High dropoff detected. Review and optimize this stage.'
                            : '📈 Moderate performance. Small optimizations could improve results.'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 0,
  },
  modalContent: {
    width: width,
    height: '100%',
    borderRadius: 0,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingBottom: 20,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trendText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  performanceChart: {
    marginTop: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 8,
  },
  chartBar: {
    width: 30,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  chartLabel: {
    fontSize: 12,
  },
  chartValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  topPerformers: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  workflowCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  workflowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  workflowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workflowName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  workflowCategory: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  workflowMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  workflowMetric: {
    alignItems: 'center',
  },
  workflowMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  workflowMetricLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  workflowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  workflowDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workflowDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  funnelContainer: {
    marginBottom: 20,
  },
  funnelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  funnelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  funnelStageName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  funnelPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  funnelBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  funnelFill: {
    height: '100%',
    borderRadius: 4,
  },
  funnelCount: {
    fontSize: 12,
  },
  funnelDropoff: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  funnelInsights: {
    marginTop: 20,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  optimizationList: {
    gap: 12,
  },
  optimizationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optimizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optimizationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  optimizationDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  optimizationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  optimizationDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optimizationDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
  optimizeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Performer card styles
  performerCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  performerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  performerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  performerCategory: {
    fontSize: 12,
  },
  performerMetric: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  performerMetricText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  performerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performerDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  workflowsHeader: {
    marginBottom: 10,
  },
  // Detailed modal styles
  detailsSection: {
    marginTop: 20,
  },
  detailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
    marginVertical: 12,
  },
  trendBar: {
    width: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
});
