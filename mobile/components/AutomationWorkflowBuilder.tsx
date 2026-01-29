import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Dimensions,
  PanResponder,
  Animated,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface WorkflowStep {
  id: string;
  type: 'trigger' | 'condition' | 'action';
  title: string;
  description: string;
  icon: string;
  color: string;
  config?: any;
  position?: { x: number; y: number };
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  usageCount: number;
  estimatedTime: string;
  steps: WorkflowStep[];
  tags: string[];
  industry?: string;
}

interface AIRecommendation {
  id: string;
  type: 'template' | 'step' | 'optimization';
  title: string;
  description: string;
  confidence: number;
  reason: string;
}

const ENHANCED_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'welcome-sequence',
    name: 'Welcome Sequence',
    description: 'Automatically welcome new leads with personalized content',
    category: 'Lead Nurturing',
    difficulty: 'beginner',
    rating: 4.8,
    usageCount: 1247,
    estimatedTime: '5 minutes',
    tags: ['welcome', 'onboarding', 'personalization'],
    industry: 'construction',
    steps: [
      {
        id: 'trigger-1',
        type: 'trigger',
        title: 'New Lead Signup',
        description: 'Trigger when a new lead signs up',
        icon: 'person-add',
        color: '#4CAF50',
        position: { x: 50, y: 100 },
      },
      {
        id: 'condition-1',
        type: 'condition',
        title: 'Has Email Address',
        description: 'Check if lead has valid email',
        icon: 'email',
        color: '#2196F3',
        position: { x: 200, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        title: 'Send Welcome Email',
        description: 'Send personalized welcome email',
        icon: 'send',
        color: '#FF9800',
        position: { x: 350, y: 100 },
      },
    ],
  },
  {
    id: 'follow-up-sequence',
    name: 'Follow-up Sequence',
    description: 'Automated follow-up for leads who show interest',
    category: 'Lead Nurturing',
    difficulty: 'intermediate',
    rating: 4.6,
    usageCount: 892,
    estimatedTime: '10 minutes',
    tags: ['follow-up', 'engagement', 'conversion'],
    industry: 'construction',
    steps: [
      {
        id: 'trigger-2',
        type: 'trigger',
        title: 'Lead Views Pricing',
        description: 'Trigger when lead visits pricing page',
        icon: 'visibility',
        color: '#4CAF50',
        position: { x: 50, y: 100 },
      },
      {
        id: 'condition-2',
        type: 'condition',
        title: 'High Engagement Score',
        description: 'Check if lead has high engagement',
        icon: 'trending-up',
        color: '#2196F3',
        position: { x: 200, y: 100 },
      },
      {
        id: 'action-2',
        type: 'action',
        title: 'Schedule Follow-up Call',
        description: 'Schedule personalized follow-up call',
        icon: 'phone',
        color: '#FF9800',
        position: { x: 350, y: 100 },
      },
    ],
  },
  {
    id: 're-engagement',
    name: 'Re-engagement Campaign',
    description: 'Re-engage inactive leads with compelling offers',
    category: 'Lead Recovery',
    difficulty: 'intermediate',
    rating: 4.4,
    usageCount: 567,
    estimatedTime: '8 minutes',
    tags: ['re-engagement', 'inactive', 'offers'],
    industry: 'construction',
    steps: [
      {
        id: 'trigger-3',
        type: 'trigger',
        title: 'Lead Inactive 30 Days',
        description: 'Trigger for leads inactive for 30+ days',
        icon: 'schedule',
        color: '#4CAF50',
        position: { x: 50, y: 100 },
      },
      {
        id: 'condition-3',
        type: 'condition',
        title: 'Previous Engagement',
        description: 'Check if lead had previous engagement',
        icon: 'history',
        color: '#2196F3',
        position: { x: 200, y: 100 },
      },
      {
        id: 'action-3',
        type: 'action',
        title: 'Send Special Offer',
        description: 'Send personalized re-engagement offer',
        icon: 'local-offer',
        color: '#FF9800',
        position: { x: 350, y: 100 },
      },
    ],
  },
  {
    id: 'conversion-optimization',
    name: 'Conversion Optimization',
    description:
      'Optimize your lead conversion with smart triggers and actions',
    category: 'Conversion',
    difficulty: 'advanced',
    rating: 4.9,
    usageCount: 234,
    estimatedTime: '15 minutes',
    tags: ['conversion', 'optimization', 'analytics'],
    industry: 'construction',
    steps: [
      {
        id: 'trigger-4',
        type: 'trigger',
        title: 'Lead Views Estimate',
        description: 'Trigger when lead views estimate page',
        icon: 'visibility',
        color: '#4CAF50',
        position: { x: 50, y: 100 },
      },
      {
        id: 'condition-4',
        type: 'condition',
        title: 'High Intent Score',
        description: 'Check if lead has high conversion intent',
        icon: 'trending-up',
        color: '#2196F3',
        position: { x: 200, y: 100 },
      },
      {
        id: 'action-4',
        type: 'action',
        title: 'Send Personalized Offer',
        description: 'Send targeted conversion offer',
        icon: 'local-offer',
        color: '#FF9800',
        position: { x: 350, y: 100 },
      },
    ],
  },
];

const AI_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: 'rec-1',
    type: 'template',
    title: 'Construction Project Follow-up',
    description:
      'Based on your industry, this template has 23% higher conversion',
    confidence: 94,
    reason: 'Matches your lead behavior patterns',
  },
  {
    id: 'rec-2',
    type: 'step',
    title: 'Add Budget Qualification',
    description: 'Include budget range check to improve lead quality',
    confidence: 87,
    reason: 'Reduces time spent on unqualified leads',
  },
  {
    id: 'rec-3',
    type: 'optimization',
    title: 'Optimize Send Time',
    description: 'Send emails at 9 AM for 15% higher open rates',
    confidence: 82,
    reason: 'Based on your audience engagement patterns',
  },
  {
    id: 'rec-4',
    type: 'template',
    title: 'Seasonal Campaign Template',
    description: 'Perfect for holiday and seasonal promotions',
    confidence: 91,
    reason: 'Matches your business cycle patterns',
  },
];

const STEP_TYPES = {
  trigger: {
    icon: 'flash-on',
    color: '#4CAF50',
    title: 'Triggers',
    description: 'Events that start the workflow',
  },
  condition: {
    icon: 'check-circle',
    color: '#2196F3',
    title: 'Conditions',
    description: 'Rules that must be met',
  },
  action: {
    icon: 'play-arrow',
    color: '#FF9800',
    title: 'Actions',
    description: 'What happens when triggered',
  },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (workflow: any) => void;
  existingWorkflow?: any;
}

export default function AutomationWorkflowBuilder({
  visible,
  onClose,
  onSave,
  existingWorkflow,
}: Props) {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'templates' | 'builder' | 'ai-suggestions'
  >('templates');
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkflowTemplate | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<AIRecommendation | null>(null);

  const backgroundColor = darkMode ? '#14213D' : '#F5F5F5';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';

  const categories = [
    'all',
    'Lead Nurturing',
    'Lead Recovery',
    'Conversion',
    'Onboarding',
  ];

  const handleTemplateSelect = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setWorkflowSteps([...template.steps]);
    setWorkflowName(template.name);
    setWorkflowDescription(template.description);
    setActiveTab('builder');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleAddStep = (stepType: 'trigger' | 'condition' | 'action') => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type: stepType,
      title: `New ${stepType}`,
      description: `Add your ${stepType} description`,
      icon: STEP_TYPES[stepType].icon,
      color: STEP_TYPES[stepType].color,
      position: { x: Math.random() * 300, y: Math.random() * 200 },
    };
    setWorkflowSteps([...workflowSteps, newStep]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEditStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setShowStepModal(true);
  };

  const handleDeleteStep = (stepId: string) => {
    Alert.alert('Delete Step', 'Are you sure you want to delete this step?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setWorkflowSteps(workflowSteps.filter(step => step.id !== stepId));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const handleSaveWorkflow = () => {
    if (!workflowName.trim()) {
      Alert.alert('Error', 'Please enter a workflow name');
      return;
    }

    if (workflowSteps.length === 0) {
      Alert.alert('Error', 'Please add at least one step to your workflow');
      return;
    }

    const workflow = {
      id: existingWorkflow?.id || `workflow-${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      steps: workflowSteps,
      isActive: true,
      createdAt: existingWorkflow?.createdAt || new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    onSave(workflow);
    onClose();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const renderEnhancedTemplatesTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.templateHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Choose a Template
        </Text>
        <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
          Start with a pre-built workflow or create from scratch
        </Text>
      </View>

      <View style={styles.categoryFilter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                { backgroundColor: cardColor, borderColor },
                selectedCategory === category && { backgroundColor: '#4CAF50' },
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  {
                    color: selectedCategory === category ? 'white' : textColor,
                  },
                ]}
              >
                {category === 'all' ? 'All' : category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {ENHANCED_WORKFLOW_TEMPLATES.filter(
        template =>
          selectedCategory === 'all' || template.category === selectedCategory
      ).map(template => (
        <TouchableOpacity
          key={template.id}
          style={[
            styles.enhancedTemplateCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => handleTemplateSelect(template)}
          activeOpacity={0.7}
        >
          <View style={styles.templateHeader}>
            <View style={styles.templateInfo}>
              <Text style={[styles.templateName, { color: textColor }]}>
                {template.name}
              </Text>
              <Text
                style={[
                  styles.templateDescription,
                  { color: textSecondaryColor },
                ]}
              >
                {template.description}
              </Text>
            </View>
            <View style={styles.templateBadges}>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(template.difficulty) },
                ]}
              >
                <Text style={styles.difficultyText}>{template.difficulty}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <MaterialIcons name='star' size={12} color='#FFD700' />
                <Text style={[styles.ratingText, { color: textColor }]}>
                  {template.rating}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.templateDetails}>
            <View style={styles.templateDetail}>
              <MaterialIcons
                name='schedule'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[
                  styles.templateDetailText,
                  { color: textSecondaryColor },
                ]}
              >
                {template.estimatedTime}
              </Text>
            </View>
            <View style={styles.templateDetail}>
              <MaterialIcons
                name='people'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[
                  styles.templateDetailText,
                  { color: textSecondaryColor },
                ]}
              >
                {template.usageCount} uses
              </Text>
            </View>
            <View style={styles.templateDetail}>
              <MaterialIcons
                name='layers'
                size={16}
                color={textSecondaryColor}
              />
              <Text
                style={[
                  styles.templateDetailText,
                  { color: textSecondaryColor },
                ]}
              >
                {template.steps.length} steps
              </Text>
            </View>
          </View>

          <View style={styles.templateTags}>
            {template.tags.map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  { backgroundColor: 'rgba(76, 175, 80, 0.1)' },
                ]}
              >
                <Text style={[styles.tagText, { color: '#4CAF50' }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[
          styles.createFromScratchCard,
          { backgroundColor: cardColor, borderColor },
        ]}
        onPress={() => {
          setWorkflowSteps([]);
          setWorkflowName('');
          setWorkflowDescription('');
          setActiveTab('builder');
        }}
        activeOpacity={0.7}
      >
        <MaterialIcons name='add-circle' size={32} color='#4CAF50' />
        <Text style={[styles.createFromScratchText, { color: textColor }]}>
          Create from Scratch
        </Text>
        <Text
          style={[
            styles.createFromScratchSubtext,
            { color: textSecondaryColor },
          ]}
        >
          Build a custom workflow from the ground up
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderVisualBuilderTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.workflowHeader}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Workflow Builder
        </Text>
        <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
          Create your automation workflow
        </Text>
      </View>

      <View style={styles.workflowInfo}>
        <TextInput
          style={[
            styles.workflowNameInput,
            { backgroundColor: cardColor, borderColor, color: textColor },
          ]}
          value={workflowName}
          onChangeText={setWorkflowName}
          placeholder='Enter workflow name'
          placeholderTextColor={textSecondaryColor}
        />
      </View>

      <View style={styles.visualBuilderContainer}>
        {workflowSteps.length === 0 ? (
          <TouchableOpacity
            style={[
              styles.emptyState,
              { backgroundColor: cardColor, borderColor },
            ]}
            onPress={() => {
              // Add a default trigger step when user clicks "Start Building"
              const defaultStep: WorkflowStep = {
                id: `step-${Date.now()}`,
                type: 'trigger',
                title: 'New Lead Signup',
                description: 'Trigger when a new lead signs up',
                icon: 'person-add',
                color: '#4CAF50',
                position: { x: 0, y: 0 },
              };
              setWorkflowSteps([defaultStep]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name='add-circle-outline'
              size={48}
              color='#4CAF50'
            />
            <Text style={[styles.emptyStateText, { color: textColor }]}>
              Start Building
            </Text>
            <Text
              style={[styles.emptyStateSubtext, { color: textSecondaryColor }]}
            >
              Tap to add your first step
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.stepsContainer}>
            {workflowSteps.map((step, index) => (
              <View
                key={step.id}
                style={[
                  styles.cleanStepCard,
                  { backgroundColor: cardColor, borderColor },
                ]}
              >
                <View style={styles.stepHeader}>
                  <View
                    style={[styles.stepNumber, { backgroundColor: step.color }]}
                  >
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={[styles.stepTitle, { color: textColor }]}>
                      {step.title}
                    </Text>
                    <Text
                      style={[
                        styles.stepDescription,
                        { color: textSecondaryColor },
                      ]}
                    >
                      {step.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepAction}
                    onPress={() => handleDeleteStep(step.id)}
                  >
                    <MaterialIcons name='close' size={20} color='#FF5252' />
                  </TouchableOpacity>
                </View>
                {index < workflowSteps.length - 1 && (
                  <View style={styles.cleanStepConnector}>
                    <MaterialIcons
                      name='keyboard-arrow-down'
                      size={24}
                      color={textSecondaryColor}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.addStepsContainer}>
        <Text style={[styles.addStepsTitle, { color: textColor }]}>
          Add Step
        </Text>
        <View style={styles.addStepsButtons}>
          {Object.entries(STEP_TYPES).map(([type, config]) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.cleanAddStepButton,
                { backgroundColor: config.color },
              ]}
              onPress={() =>
                handleAddStep(type as 'trigger' | 'condition' | 'action')
              }
            >
              <MaterialIcons
                name={config.icon as any}
                size={20}
                color='white'
              />
              <Text style={styles.cleanAddStepButtonText}>{config.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderAISuggestionsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.aiHeader}>
        <MaterialIcons name='psychology' size={24} color='#9C27B0' />
        <Text style={[styles.aiTitle, { color: textColor }]}>
          AI-Powered Suggestions
        </Text>
        <Text style={[styles.aiSubtitle, { color: textSecondaryColor }]}>
          Get intelligent recommendations for your workflow
        </Text>
      </View>

      {AI_RECOMMENDATIONS.map(recommendation => (
        <TouchableOpacity
          key={recommendation.id}
          style={[
            styles.recommendationCard,
            { backgroundColor: cardColor, borderColor },
          ]}
          onPress={() => {
            setSelectedRecommendation(recommendation);
            setShowAISuggestions(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.recommendationHeader}>
            <View style={styles.recommendationInfo}>
              <Text style={[styles.recommendationTitle, { color: textColor }]}>
                {recommendation.title}
              </Text>
              <Text
                style={[
                  styles.recommendationDescription,
                  { color: textSecondaryColor },
                ]}
              >
                {recommendation.description}
              </Text>
            </View>
            <View
              style={[
                styles.confidenceBadge,
                {
                  backgroundColor: getConfidenceColor(
                    recommendation.confidence
                  ),
                },
              ]}
            >
              <Text style={styles.confidenceText}>
                {recommendation.confidence}%
              </Text>
            </View>
          </View>

          <View style={styles.recommendationReason}>
            <MaterialIcons name='lightbulb' size={16} color='#FF9800' />
            <Text style={[styles.reasonText, { color: textSecondaryColor }]}>
              {recommendation.reason}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.applyRecommendationButton,
              { backgroundColor: '#4CAF50' },
            ]}
            onPress={() => {
              // Apply recommendation logic
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(
                'Applied',
                'Recommendation applied to your workflow!'
              );
            }}
          >
            <MaterialIcons name='check' size={16} color='white' />
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '#4CAF50';
      case 'intermediate':
        return '#FF9800';
      case 'advanced':
        return '#F44336';
      default:
        return '#666666';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return '#4CAF50';
    if (confidence >= 80) return '#FF9800';
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
        style={[
          styles.modalOverlay,
          { backgroundColor: darkMode ? '#0A1428' : '#F0F0F0' },
        ]}
      >
        <View style={[styles.modalContent, { backgroundColor }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <MaterialIcons name='auto-awesome' size={24} color='#4CAF50' />
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {existingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
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
                activeTab === 'templates' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('templates')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'templates'
                        ? '#4CAF50'
                        : textSecondaryColor,
                  },
                ]}
              >
                Templates
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'builder' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('builder')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'builder' ? '#4CAF50' : textSecondaryColor,
                  },
                ]}
              >
                Builder
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'ai-suggestions' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('ai-suggestions')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color:
                      activeTab === 'ai-suggestions'
                        ? '#4CAF50'
                        : textSecondaryColor,
                  },
                ]}
              >
                AI Suggestions
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'templates' && renderEnhancedTemplatesTab()}
          {activeTab === 'builder' && renderVisualBuilderTab()}
          {activeTab === 'ai-suggestions' && renderAISuggestionsTab()}

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: textColor }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#4CAF50' }]}
              onPress={handleSaveWorkflow}
            >
              <Text style={styles.saveButtonText}>Save Workflow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
  },
  modalContent: {
    width: width * 0.95,
    maxHeight: '85%',
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
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    minHeight: 400,
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
  categoryFilter: {
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 10,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  enhancedTemplateCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    minHeight: 140,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  templateDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  templateBadges: {
    flexDirection: 'row',
    marginTop: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  difficultyText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 4,
  },
  templateDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  templateDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  templateTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  createFromScratchCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 16,
    minHeight: 120,
  },
  createFromScratchText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  createFromScratchSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  workflowHeader: {
    marginBottom: 20,
  },
  workflowInfo: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  workflowNameInput: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  visualBuilderContainer: {
    marginBottom: 20,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginVertical: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  visualStepsList: {
    // This style is for the horizontal scroll view of steps
  },
  visualStepCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    minHeight: 120,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 12,
  },
  stepActions: {
    flexDirection: 'row',
  },
  stepAction: {
    padding: 8,
    marginLeft: 4,
  },
  stepConnector: {
    position: 'absolute',
    top: 50,
    left: 120,
    width: 100,
    alignItems: 'center',
  },
  addStepsContainer: {
    marginTop: 20,
  },
  addStepsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  addStepsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addStepButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    minHeight: 60,
  },
  addStepButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  aiHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  recommendationCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    minHeight: 140,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  recommendationReason: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reasonText: {
    fontSize: 13,
    marginLeft: 4,
  },
  applyRecommendationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Clean builder styles
  stepsContainer: {
    marginBottom: 20,
  },
  cleanStepCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  cleanStepConnector: {
    alignItems: 'center',
    marginVertical: 8,
  },
  cleanAddStepButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 6,
    minHeight: 50,
  },
  cleanAddStepButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
