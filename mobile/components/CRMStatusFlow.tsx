import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';

interface CRMStatusFlowProps {
  lead?: Lead;
  onStatusChange?: (leadId: string, newStatus: string) => void;
}

interface StatusStage {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  actions: string[];
  requirements: string[];
  estimatedDuration: string;
  completionRate: number;
  avgTimeInStage: string;
}

const CRMStatusFlow: React.FC<CRMStatusFlowProps> = ({
  lead,
  onStatusChange,
}) => {
  const { darkMode } = useTheme();
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [pipelineStats, setPipelineStats] = useState({
    totalLeads: 0,
    conversionRate: 0,
    avgTimeToClose: 0,
    activeLeads: 0,
  });

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#F5F5F5';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const accentColor = '#4CAF50';

  const statusStages: StatusStage[] = [
    {
      id: 'new',
      name: 'New Lead',
      description: 'Fresh lead that needs initial contact',
      icon: 'fiber-new',
      color: '#2196F3',
      actions: [
        'Send welcome email',
        'Schedule initial call',
        'Send project questionnaire',
        'Request additional details',
      ],
      requirements: [
        'Contact information verified',
        'Project requirements documented',
        'Budget range confirmed',
        'Timeline discussed',
      ],
      estimatedDuration: '1-2 days',
      completionRate: 85,
      avgTimeInStage: '1.5 days',
    },
    {
      id: 'contacted',
      name: 'Contacted',
      description: 'Initial contact made, awaiting response',
      icon: 'phone',
      color: '#FF9800',
      actions: [
        'Follow up call/email',
        'Send project proposal',
        'Schedule site visit',
        'Request project photos',
      ],
      requirements: [
        'Response received',
        'Interest confirmed',
        'Project scope clarified',
        'Budget alignment verified',
      ],
      estimatedDuration: '3-5 days',
      completionRate: 72,
      avgTimeInStage: '3.2 days',
    },
    {
      id: 'qualified',
      name: 'Qualified',
      description: 'Lead meets criteria, ready for proposal',
      icon: 'verified',
      color: '#9C27B0',
      actions: [
        'Prepare detailed proposal',
        'Schedule consultation',
        'Create project timeline',
        'Discuss payment terms',
      ],
      requirements: [
        'Project scope finalized',
        'Budget approved',
        'Timeline agreed',
        'Contract terms discussed',
      ],
      estimatedDuration: '5-7 days',
      completionRate: 68,
      avgTimeInStage: '5.8 days',
    },
    {
      id: 'proposal',
      name: 'Proposal Sent',
      description: 'Proposal delivered, awaiting decision',
      icon: 'description',
      color: '#FF5722',
      actions: [
        'Follow up on proposal',
        'Address questions/concerns',
        'Schedule presentation',
        'Negotiate terms',
      ],
      requirements: [
        'Proposal reviewed',
        'Questions answered',
        'Terms negotiated',
        'Decision timeline set',
      ],
      estimatedDuration: '7-10 days',
      completionRate: 55,
      avgTimeInStage: '8.5 days',
    },
    {
      id: 'negotiation',
      name: 'Negotiation',
      description: 'Active negotiation phase',
      icon: 'gavel',
      color: '#795548',
      actions: [
        'Address objections',
        'Provide alternatives',
        'Schedule final meeting',
        'Prepare contract',
      ],
      requirements: [
        'All objections addressed',
        'Final terms agreed',
        'Contract prepared',
        'Signing scheduled',
      ],
      estimatedDuration: '3-7 days',
      completionRate: 78,
      avgTimeInStage: '4.2 days',
    },
    {
      id: 'won',
      name: 'Won',
      description: 'Deal closed successfully',
      icon: 'check-circle',
      color: '#4CAF50',
      actions: [
        'Send congratulations',
        'Schedule kickoff',
        'Assign project team',
        'Begin project execution',
      ],
      requirements: [
        'Contract signed',
        'Payment received',
        'Project team assigned',
        'Kickoff scheduled',
      ],
      estimatedDuration: '1-2 days',
      completionRate: 100,
      avgTimeInStage: '1.0 days',
    },
  ];

  useEffect(() => {
    loadPipelineStats();
  }, []);

  const loadPipelineStats = async () => {
    try {
      const leads = await leadService.getLeads();
      const totalLeads = leads.length;
      const wonLeads = leads.filter(l => l.status === 'won').length;
      const activeLeads = leads.filter(
        l => l.status !== 'won' && l.status !== 'lost'
      ).length;

      setPipelineStats({
        totalLeads,
        conversionRate:
          totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
        avgTimeToClose: 28, // Mock data
        activeLeads,
      });
    } catch (error) {
      console.error('Error loading pipeline stats:', error);
    }
  };

  const getCurrentStage = () => {
    return statusStages.find(stage => stage.id === lead?.status);
  };

  const getNextStages = () => {
    const currentIndex = statusStages.findIndex(
      stage => stage.id === lead?.status
    );
    return statusStages.slice(currentIndex + 1);
  };

  const getPreviousStages = () => {
    const currentIndex = statusStages.findIndex(
      stage => stage.id === lead?.status
    );
    return statusStages.slice(0, currentIndex);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    setLoading(true);
    try {
      // Mock API call to update status
      await new Promise(resolve => setTimeout(resolve, 1000));

      onStatusChange?.(lead?.id || '', newStatus);
      Alert.alert('Status Updated', `Lead moved to ${newStatus} stage`);

      // Update pipeline stats
      await loadPipelineStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Action Logged', `${action} has been recorded`);
      setShowActionModal(false);
      setActionNotes('');
    } catch (error) {
      Alert.alert('Error', 'Failed to log action');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    Alert.alert('Quick Action', `Executing: ${action}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Execute',
        onPress: () => {
          Alert.alert('Success', `${action} completed successfully!`);
        },
      },
    ]);
  };

  const StageCard: React.FC<{
    stage: StatusStage;
    isCurrent?: boolean;
    isCompleted?: boolean;
  }> = ({ stage, isCurrent = false, isCompleted = false }) => (
    <View
      style={[
        styles.stageCard,
        {
          backgroundColor: cardColor,
          borderWidth: isCurrent ? 2 : 1,
          borderColor: isCurrent ? stage.color : borderColor,
        },
      ]}
    >
      <View style={styles.stageHeader}>
        <View style={[styles.stageIcon, { backgroundColor: stage.color }]}>
          <MaterialIcons name={stage.icon as any} size={20} color='white' />
        </View>
        <View style={styles.stageInfo}>
          <Text style={[styles.stageName, { color: textColor }]}>
            {stage.name}
          </Text>
          <Text
            style={[styles.stageDescription, { color: textSecondaryColor }]}
          >
            {stage.description}
          </Text>
        </View>
        {isCurrent && (
          <View style={[styles.currentBadge, { backgroundColor: stage.color }]}>
            <Text style={styles.currentBadgeText}>CURRENT</Text>
          </View>
        )}
        {isCompleted && (
          <View style={[styles.completedBadge, { backgroundColor: '#4CAF50' }]}>
            <Text style={styles.completedBadgeText}>✓</Text>
          </View>
        )}
      </View>

      <View style={styles.stageStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
            Completion Rate
          </Text>
          <Text style={[styles.statValue, { color: textColor }]}>
            {stage.completionRate}%
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
            Avg Time
          </Text>
          <Text style={[styles.statValue, { color: textColor }]}>
            {stage.avgTimeInStage}
          </Text>
        </View>
      </View>

      {lead && lead.status !== stage.id && !isCompleted && (
        <TouchableOpacity
          style={[styles.moveButton, { backgroundColor: stage.color }]}
          onPress={() => handleStatusChange(stage.id)}
          disabled={loading}
          activeOpacity={0.7}
        >
          <MaterialIcons name='arrow-forward' size={16} color='white' />
          <Text style={styles.moveButtonText}>
            {loading ? 'Moving...' : `Move to ${stage.name}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPipeline = () => (
    <View style={styles.pipeline}>
      <View style={styles.pipelineHeader}>
        <Text style={[styles.pipelineTitle, { color: textColor }]}>
          Pipeline Overview
        </Text>
        <TouchableOpacity
          style={[styles.quickActionsButton, { backgroundColor: accentColor }]}
          onPress={() => setShowQuickActions(!showQuickActions)}
          activeOpacity={0.7}
        >
          <MaterialIcons name='flash-on' size={16} color='white' />
          <Text style={styles.quickActionsText}>Quick Actions</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.pipelineStats,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: textColor }]}>
            {pipelineStats.totalLeads}
          </Text>
          <Text
            style={[styles.pipelineStatLabel, { color: textSecondaryColor }]}
          >
            Total Leads
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: textColor }]}>
            {pipelineStats.activeLeads}
          </Text>
          <Text
            style={[styles.pipelineStatLabel, { color: textSecondaryColor }]}
          >
            Active
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: textColor }]}>
            {pipelineStats.conversionRate}%
          </Text>
          <Text
            style={[styles.pipelineStatLabel, { color: textSecondaryColor }]}
          >
            Conversion
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: textColor }]}>
            {pipelineStats.avgTimeToClose}
          </Text>
          <Text
            style={[styles.pipelineStatLabel, { color: textSecondaryColor }]}
          >
            Avg Days
          </Text>
        </View>
      </View>

      {showQuickActions && (
        <View
          style={[
            styles.quickActionsPanel,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <Text style={[styles.quickActionsTitle, { color: textColor }]}>
            Quick Actions
          </Text>
          <View style={styles.quickActionsGrid}>
            {[
              { name: 'Send Follow-up', icon: 'email', color: '#2196F3' },
              { name: 'Schedule Call', icon: 'phone', color: '#4CAF50' },
              { name: 'Send Proposal', icon: 'description', color: '#FF9800' },
              { name: 'Log Activity', icon: 'note-add', color: '#9C27B0' },
            ].map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickActionButton,
                  { backgroundColor: action.color },
                ]}
                onPress={() => handleQuickAction(action.name)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={action.icon as any}
                  size={20}
                  color='white'
                />
                <Text style={styles.quickActionText}>{action.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pipelineStages}
      >
        {statusStages.map((stage, index) => {
          const isCurrent = lead?.status === stage.id;
          const isCompleted =
            lead && statusStages.findIndex(s => s.id === lead.status) > index;

          return (
            <View key={stage.id} style={styles.pipelineStage}>
              <StageCard
                stage={stage}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
              />
              {index < statusStages.length - 1 && (
                <View style={styles.pipelineArrow}>
                  <MaterialIcons
                    name='arrow-forward'
                    size={24}
                    color={textSecondaryColor}
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderStageDetails = () => {
    if (!selectedStage) return null;

    const stage = statusStages.find(s => s.id === selectedStage);
    if (!stage) return null;

    return (
      <View
        style={[
          styles.stageDetails,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <View style={styles.detailsHeader}>
          <Text style={[styles.detailsTitle, { color: textColor }]}>
            {stage.name}
          </Text>
          <TouchableOpacity onPress={() => setSelectedStage(null)}>
            <MaterialIcons name='close' size={24} color={textColor} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.detailsDescription, { color: textColor }]}>
          {stage.description}
        </Text>

        <View style={styles.detailsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Recommended Actions
          </Text>
          {stage.actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionItem, { backgroundColor: backgroundColor }]}
              onPress={() => handleAction(action)}
              disabled={loading}
            >
              <MaterialIcons name='play-arrow' size={16} color={accentColor} />
              <Text style={[styles.actionText, { color: textColor }]}>
                {action}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.detailsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Requirements
          </Text>
          {stage.requirements.map((requirement, index) => (
            <View key={index} style={styles.requirementItem}>
              <MaterialIcons name='check-circle' size={16} color='#4CAF50' />
              <Text style={[styles.requirementText, { color: textColor }]}>
                {requirement}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.detailsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Estimated Duration
          </Text>
          <Text style={[styles.durationText, { color: textSecondaryColor }]}>
            {stage.estimatedDuration}
          </Text>
        </View>

        {lead && lead.status !== stage.id && (
          <TouchableOpacity
            style={[styles.moveButton, { backgroundColor: stage.color }]}
            onPress={() => handleStatusChange(stage.id)}
            disabled={loading}
          >
            <Text style={styles.moveButtonText}>
              {loading ? 'Moving...' : `Move to ${stage.name}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          CRM Status Flow
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Manage lead progression through the sales pipeline
        </Text>
      </View>

      {renderPipeline()}

      {renderStageDetails()}

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                Log Action
              </Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <MaterialIcons name='close' size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: backgroundColor,
                  color: textColor,
                  borderColor,
                },
              ]}
              placeholder='Add notes about this action...'
              placeholderTextColor={textSecondaryColor}
              value={actionNotes}
              onChangeText={setActionNotes}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={[styles.logButton, { backgroundColor: accentColor }]}
              onPress={() => handleAction('Action logged')}
              disabled={loading}
            >
              <Text style={styles.logButtonText}>
                {loading ? 'Logging...' : 'Log Action'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
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
  pipeline: {
    marginBottom: 20,
  },
  pipelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  pipelineTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickActionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickActionsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  pipelineStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pipelineStatLabel: {
    fontSize: 12,
  },
  pipelineStages: {
    marginBottom: 20,
  },
  pipelineStage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipelineArrow: {
    marginHorizontal: 5,
  },
  quickActionsPanel: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    width: '45%', // Adjust as needed for grid layout
    aspectRatio: 1.2, // Make buttons slightly taller than wide
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    gap: 8,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  stageCard: {
    width: 200,
    padding: 16,
    borderRadius: 12,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stageInfo: {
    flex: 1,
  },
  stageName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stageDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  stageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  moveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  stageDetails: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  detailsDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    flex: 1,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    fontSize: 14,
    flex: 1,
  },
  durationText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  logActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  logActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  logButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CRMStatusFlow;
