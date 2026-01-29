import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Dimensions,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface PersonalizationRule {
  id: string;
  name: string;
  description: string;
  type: 'behavior' | 'demographic' | 'engagement' | 'custom';
  conditions: string[];
  actions: string[];
  isActive: boolean;
  performance: {
    usage: number;
    effectiveness: number;
    lastUsed: string;
  };
}

interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'email' | 'sms' | 'push' | 'social';
  confidence: number;
  predictedEngagement: number;
  tags: string[];
  content: string;
}

interface LeadSegment {
  id: string;
  name: string;
  criteria: string[];
  leadCount: number;
  personalizationScore: number;
}

const MOCK_PERSONALIZATION_RULES: PersonalizationRule[] = [
  {
    id: 'rule-1',
    name: 'High-Value Lead Personalization',
    description: 'Special content for leads with high engagement scores',
    type: 'engagement',
    conditions: [
      'Engagement score > 75',
      'Has viewed pricing page',
      'Budget > $50k',
    ],
    actions: [
      'Send premium content',
      'Schedule VIP call',
      'Assign to senior rep',
    ],
    isActive: true,
    performance: {
      usage: 156,
      effectiveness: 89.2,
      lastUsed: '2 hours ago',
    },
  },
  {
    id: 'rule-2',
    name: 'Industry-Specific Messaging',
    description: 'Tailored content based on lead industry',
    type: 'demographic',
    conditions: [
      'Industry = Construction',
      'Company size > 50 employees',
      'Has decision authority',
    ],
    actions: [
      'Send industry case studies',
      'Use construction terminology',
      'Reference relevant projects',
    ],
    isActive: true,
    performance: {
      usage: 203,
      effectiveness: 76.8,
      lastUsed: '1 hour ago',
    },
  },
  {
    id: 'rule-3',
    name: 'Behavior-Based Timing',
    description: 'Send content when leads are most active',
    type: 'behavior',
    conditions: [
      'Active between 9-11 AM',
      'Opens emails consistently',
      'Engages on mobile',
    ],
    actions: [
      'Send at optimal times',
      'Use mobile-optimized content',
      'Include quick CTAs',
    ],
    isActive: false,
    performance: {
      usage: 89,
      effectiveness: 92.1,
      lastUsed: '1 day ago',
    },
  },
];

const MOCK_CONTENT_RECOMMENDATIONS: ContentRecommendation[] = [
  {
    id: 'rec-1',
    title: 'Construction Project ROI Calculator',
    description:
      'Interactive calculator showing potential savings on construction projects',
    type: 'email',
    confidence: 94,
    predictedEngagement: 87,
    tags: ['construction', 'roi', 'calculator', 'interactive'],
    content:
      'Calculate your potential savings with our construction ROI calculator...',
  },
  {
    id: 'rec-2',
    title: 'Case Study: Downtown Office Renovation',
    description:
      'Detailed case study of a successful office renovation project',
    type: 'email',
    confidence: 89,
    predictedEngagement: 78,
    tags: ['case-study', 'office', 'renovation', 'success-story'],
    content:
      'See how we helped ABC Corp save 23% on their office renovation...',
  },
  {
    id: 'rec-3',
    title: 'Industry Trends Report 2024',
    description: 'Latest construction industry trends and insights',
    type: 'email',
    confidence: 82,
    predictedEngagement: 71,
    tags: ['trends', 'industry', '2024', 'insights'],
    content:
      'Discover the top construction trends that will impact your business...',
  },
];

const MOCK_LEAD_SEGMENTS: LeadSegment[] = [
  {
    id: 'segment-1',
    name: 'High-Value Prospects',
    criteria: ['Budget > $100k', 'Decision maker', 'High engagement'],
    leadCount: 45,
    personalizationScore: 92,
  },
  {
    id: 'segment-2',
    name: 'Construction Companies',
    criteria: [
      'Industry = Construction',
      'Company size > 25',
      'Active in last 30 days',
    ],
    leadCount: 78,
    personalizationScore: 87,
  },
  {
    id: 'segment-3',
    name: 'First-Time Buyers',
    criteria: ['New to market', 'Budget < $50k', 'Research phase'],
    leadCount: 123,
    personalizationScore: 73,
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SmartPersonalization({ visible, onClose }: Props) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'rules' | 'content' | 'segments' | 'ai-insights'
  >('rules');
  const [selectedRule, setSelectedRule] = useState<PersonalizationRule | null>(
    null
  );
  const [selectedContent, setSelectedContent] =
    useState<ContentRecommendation | null>(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [pulseAnim] = useState(() => new Animated.Value(1));

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

  const getPersonalizationStats = () => ({
    totalRules: MOCK_PERSONALIZATION_RULES.length,
    activeRules: MOCK_PERSONALIZATION_RULES.filter(r => r.isActive).length,
    avgEffectiveness: 85.7,
    totalSegments: MOCK_LEAD_SEGMENTS.length,
    avgPersonalizationScore: 84.0,
  });

  const renderRulesTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.statsHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Personalization Rules
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {getPersonalizationStats().totalRules}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Total Rules
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#2196F3' }]}>
              {getPersonalizationStats().activeRules}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Active
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FF9800' }]}>
              {getPersonalizationStats().avgEffectiveness}%
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Avg Effectiveness
            </Text>
          </View>
        </View>
      </View>

      {MOCK_PERSONALIZATION_RULES.map(rule => (
        <TouchableOpacity
          key={rule.id}
          style={[styles.ruleCard, { backgroundColor: cardColor, borderColor }]}
          onPress={() => {
            setSelectedRule(rule);
            setShowRuleModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.ruleHeader}>
            <View style={styles.ruleInfo}>
              <Text style={[styles.ruleName, { color: textColor }]}>
                {rule.name}
              </Text>
              <Text
                style={[styles.ruleDescription, { color: textSecondaryColor }]}
              >
                {rule.description}
              </Text>
            </View>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: rule.isActive ? '#4CAF50' : '#FF9800' },
              ]}
            />
          </View>

          <View style={styles.ruleType}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: getTypeColor(rule.type) },
              ]}
            >
              <Text style={styles.typeText}>{rule.type.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.rulePerformance}>
            <View style={styles.performanceItem}>
              <Text style={[styles.performanceValue, { color: textColor }]}>
                {rule.performance.usage}
              </Text>
              <Text
                style={[styles.performanceLabel, { color: textSecondaryColor }]}
              >
                Uses
              </Text>
            </View>
            <View style={styles.performanceItem}>
              <Text style={[styles.performanceValue, { color: '#4CAF50' }]}>
                {rule.performance.effectiveness}%
              </Text>
              <Text
                style={[styles.performanceLabel, { color: textSecondaryColor }]}
              >
                Effective
              </Text>
            </View>
            <View style={styles.performanceItem}>
              <Text
                style={[styles.performanceValue, { color: textSecondaryColor }]}
              >
                {rule.performance.lastUsed}
              </Text>
              <Text
                style={[styles.performanceLabel, { color: textSecondaryColor }]}
              >
                Last Used
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderContentTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.aiHeader}>
        <Animated.View
          style={[styles.aiIndicator, { transform: [{ scale: pulseAnim }] }]}
        >
          <MaterialIcons name='psychology' size={20} color='#9C27B0' />
        </Animated.View>
        <Text style={[styles.aiTitle, { color: textColor }]}>
          AI Content Recommendations
        </Text>
        <Text style={[styles.aiSubtitle, { color: textSecondaryColor }]}>
          Personalized content suggestions based on lead behavior
        </Text>
      </View>

      {MOCK_CONTENT_RECOMMENDATIONS.map(content => (
        <TouchableOpacity
          key={content.id}
          style={[
            styles.contentCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            setSelectedContent(content);
            setShowContentModal(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.contentHeader}>
            <View style={styles.contentInfo}>
              <Text style={[styles.contentTitle, { color: textColor }]}>
                {content.title}
              </Text>
              <Text
                style={[
                  styles.contentDescription,
                  { color: textSecondaryColor },
                ]}
              >
                {content.description}
              </Text>
            </View>
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: getConfidenceColor(content.confidence) },
              ]}
            >
              <Text style={styles.confidenceText}>{content.confidence}%</Text>
            </View>
          </View>

          <View style={styles.contentMetrics}>
            <View style={styles.metric}>
              <MaterialIcons name='trending-up' size={16} color='#4CAF50' />
              <Text style={[styles.metricText, { color: textColor }]}>
                {content.predictedEngagement}% engagement
              </Text>
            </View>
            <View style={styles.metric}>
              <MaterialIcons name='email' size={16} color='#2196F3' />
              <Text style={[styles.metricText, { color: textColor }]}>
                {content.type.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.contentTags}>
            {content.tags.map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  { backgroundColor: 'rgba(156, 39, 176, 0.1)' },
                ]}
              >
                <Text style={[styles.tagText, { color: '#9C27B0' }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSegmentsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Personalized Segments
      </Text>
      <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
        Lead segments with personalization scores
      </Text>

      {MOCK_LEAD_SEGMENTS.map(segment => (
        <View
          key={segment.id}
          style={[
            styles.segmentCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.segmentHeader}>
            <Text style={[styles.segmentName, { color: textColor }]}>
              {segment.name}
            </Text>
            <View
              style={[
                styles.scoreBadge,
                {
                  backgroundColor: getScoreColor(segment.personalizationScore),
                },
              ]}
            >
              <Text style={styles.scoreText}>
                {segment.personalizationScore}
              </Text>
            </View>
          </View>

          <View style={styles.segmentCriteria}>
            {segment.criteria.map((criterion, index) => (
              <View key={index} style={styles.criterionItem}>
                <MaterialIcons name='check-circle' size={14} color='#4CAF50' />
                <Text
                  style={[styles.criterionText, { color: textSecondaryColor }]}
                >
                  {criterion}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.segmentStats}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: textColor }]}>
                {segment.leadCount}
              </Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
                Leads
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {segment.personalizationScore}%
              </Text>
              <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
                Personalization
              </Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderAIInsightsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        AI Insights
      </Text>
      <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
        Intelligent recommendations for better personalization
      </Text>

      <View style={styles.insightsList}>
        <View
          style={[
            styles.insightCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.insightHeader}>
            <MaterialIcons name='lightbulb' size={20} color='#FF9800' />
            <Text style={[styles.insightTitle, { color: textColor }]}>
              Content Optimization
            </Text>
          </View>
          <Text
            style={[styles.insightDescription, { color: textSecondaryColor }]}
          >
            Construction industry leads respond 23% better to case studies than
            general content
          </Text>
          <TouchableOpacity
            style={[styles.insightAction, { backgroundColor: '#FF9800' }]}
          >
            <Text style={styles.insightActionText}>Apply Suggestion</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.insightCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.insightHeader}>
            <MaterialIcons name='schedule' size={20} color='#2196F3' />
            <Text style={[styles.insightTitle, { color: textColor }]}>
              Timing Optimization
            </Text>
          </View>
          <Text
            style={[styles.insightDescription, { color: textSecondaryColor }]}
          >
            High-value prospects are 3x more likely to engage on Tuesday
            mornings
          </Text>
          <TouchableOpacity
            style={[styles.insightAction, { backgroundColor: '#2196F3' }]}
          >
            <Text style={styles.insightActionText}>Apply Suggestion</Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.insightCard,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.insightHeader}>
            <MaterialIcons name='psychology' size={20} color='#9C27B0' />
            <Text style={[styles.insightTitle, { color: textColor }]}>
              Behavioral Pattern
            </Text>
          </View>
          <Text
            style={[styles.insightDescription, { color: textSecondaryColor }]}
          >
            Leads who view pricing page 3+ times are 67% more likely to convert
          </Text>
          <TouchableOpacity
            style={[styles.insightAction, { backgroundColor: '#9C27B0' }]}
          >
            <Text style={styles.insightActionText}>Apply Suggestion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'behavior':
        return '#4CAF50';
      case 'demographic':
        return '#2196F3';
      case 'engagement':
        return '#FF9800';
      case 'custom':
        return '#9C27B0';
      default:
        return '#666666';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return '#4CAF50';
    if (confidence >= 80) return '#FF9800';
    return '#FF5252';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#FF9800';
    return '#FF5252';
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
      >
        <View style={[styles.modalContent, { backgroundColor }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <MaterialIcons name='psychology' size={24} color='#9C27B0' />
              <Text style={[styles.modalTitle, { color: textColor }]}>
                Smart Personalization
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
                activeTab === 'rules' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('rules')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'rules' ? '#9C27B0' : textSecondaryColor,
                  },
                ]}
              >
                Rules
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'content' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('content')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'content' ? '#9C27B0' : textSecondaryColor,
                  },
                ]}
              >
                Content
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'segments' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('segments')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'segments' ? '#9C27B0' : textSecondaryColor,
                  },
                ]}
              >
                Segments
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'ai-insights' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('ai-insights')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'ai-insights'
                        ? '#9C27B0'
                        : textSecondaryColor,
                  },
                ]}
              >
                AI Insights
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'rules' && renderRulesTab()}
          {activeTab === 'content' && renderContentTab()}
          {activeTab === 'segments' && renderSegmentsTab()}
          {activeTab === 'ai-insights' && renderAIInsightsTab()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.95,
    maxHeight: '90%',
    borderRadius: 16,
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
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  statsHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  ruleCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ruleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ruleType: {
    marginBottom: 12,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  rulePerformance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceItem: {
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  performanceLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  aiHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  aiIndicator: {
    marginBottom: 8,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  contentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contentInfo: {
    flex: 1,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  contentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  contentMetrics: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metricText: {
    fontSize: 12,
    marginLeft: 4,
  },
  contentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  segmentCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  segmentName: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  segmentCriteria: {
    marginBottom: 12,
  },
  criterionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  criterionText: {
    fontSize: 12,
    marginLeft: 6,
  },
  segmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },

  insightsList: {
    gap: 12,
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  insightDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  insightAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  insightActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
