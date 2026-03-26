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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';

interface LeadStatusCRMProps {
  lead: Lead;
  onStatusChange: (leadId: string, newStatus: string) => void;
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

const LeadStatusCRM: React.FC<LeadStatusCRMProps> = ({
  lead,
  onStatusChange,
}) => {
  const { darkMode } = useTheme();
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
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
  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#FFFFFF' : '#666666';
  const borderColor = darkMode ? '#2A4A7A' : '#E0E0E0';
  const cardColor = darkMode ? '#1B365D' : '#FFFFFF';
  const accentColor = '#4CAF50';

  // Define status stages with actions and requirements
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
        'Request more details',
      ],
      requirements: ['Verify contact info', 'Assess urgency'],
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
      actions: ['Follow up call', 'Send proposal', 'Schedule site visit'],
      requirements: ['Response received', 'Interest confirmed'],
      estimatedDuration: '3-5 days',
      completionRate: 72,
      avgTimeInStage: '3.2 days',
    },
    {
      id: 'qualified',
      name: 'Qualified',
      description: 'Lead is interested and qualified',
      icon: 'verified-user',
      color: '#9C27B0',
      actions: [
        'Send detailed proposal',
        'Schedule meeting',
        'Negotiate terms',
      ],
      requirements: ['Budget confirmed', 'Timeline agreed'],
      estimatedDuration: '1-2 weeks',
      completionRate: 68,
      avgTimeInStage: '5.8 days',
    },
    {
      id: 'proposal-sent',
      name: 'Proposal Sent',
      description: 'Proposal delivered, awaiting decision',
      icon: 'description',
      color: '#673AB7',
      actions: ['Follow up on proposal', 'Address concerns', 'Negotiate price'],
      requirements: ['Proposal reviewed', 'Questions answered'],
      estimatedDuration: '1-3 weeks',
      completionRate: 55,
      avgTimeInStage: '8.5 days',
    },
    {
      id: 'won',
      name: 'Won',
      description: 'Project awarded, contract signed',
      icon: 'check-circle',
      color: '#4CAF50',
      actions: ['Send contract', 'Schedule kickoff', 'Begin project'],
      requirements: ['Contract signed', 'Payment received'],
      estimatedDuration: 'Ongoing',
      completionRate: 100,
      avgTimeInStage: '1.0 days',
    },
    {
      id: 'lost',
      name: 'Lost',
      description: 'Lead did not convert',
      icon: 'cancel',
      color: '#F44336',
      actions: [
        'Document loss reason',
        'Request feedback',
        'Follow up in 3 months',
      ],
      requirements: ['Reason documented', 'Feedback collected'],
      estimatedDuration: 'N/A',
      completionRate: 0,
      avgTimeInStage: 'N/A',
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

  const handleStatusChange = async (newStatus: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await onStatusChange(lead.id, newStatus);
      Alert.alert('Status Updated', `Lead moved to ${newStatus} stage`);
      await loadPipelineStats();
    } catch (error) {
      Alert.alert('Error', 'Failed to update lead status');
    } finally {
      setLoading(false);
    }
  };

  const handleActionPress = (action: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    setSelectedAction(action);
    setShowActionModal(true);
  };

  const handleActionSubmit = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptic feedback not available');
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Action Logged', `${selectedAction} has been recorded`);
      setShowActionModal(false);
      setActionNotes('');
      setSelectedAction('');
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

  const getCurrentStage = () => {
    return statusStages.find(stage => stage.id === lead.status);
  };

  const getNextStages = () => {
    const currentIndex = statusStages.findIndex(
      stage => stage.id === lead.status
    );
    return statusStages.slice(currentIndex + 1);
  };

  const getPreviousStages = () => {
    const currentIndex = statusStages.findIndex(
      stage => stage.id === lead.status
    );
    return statusStages.slice(0, currentIndex);
  };

  const renderStatusStage = (stage: StatusStage, index: number) => {
    const isCurrent = stage.id === lead.status;
    const isCompleted =
      index < statusStages.findIndex(s => s.id === lead.status);
    const isNext =
      index === statusStages.findIndex(s => s.id === lead.status) + 1;
    const isDisabled =
      index > statusStages.findIndex(s => s.id === lead.status) + 1;

    return (
      <View
        key={stage.id}
        style={[
          styles.stageCard,
          { backgroundColor: cardColor, borderColor },
          isCurrent && { borderColor: stage.color, borderWidth: 2 },
          isCompleted && { opacity: 0.7 },
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
            <View
              style={[styles.currentBadge, { backgroundColor: stage.color }]}
            >
              <Text style={styles.currentBadgeText}>CURRENT</Text>
            </View>
          )}
          {isCompleted && (
            <View
              style={[styles.completedBadge, { backgroundColor: '#4CAF50' }]}
            >
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

        {isCurrent && (
          <View style={styles.currentStageActions}>
            <Text style={[styles.actionsTitle, { color: textColor }]}>
              Quick Actions:
            </Text>
            <View style={styles.actionButtons}>
              {stage.actions.slice(0, 2).map((action, actionIndex) => (
                <TouchableOpacity
                  key={actionIndex}
                  style={[
                    styles.actionButton,
                    { backgroundColor: accentColor },
                  ]}
                  onPress={() => handleActionPress(action)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name='flash-on' size={16} color='white' />
                  <Text style={styles.actionButtonText}>{action}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!isCurrent && !isCompleted && !isDisabled && (
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
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Lead Status Pipeline
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          {lead.name} • {lead.projectType} • {lead.status}
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

      <ScrollView style={styles.pipeline} showsVerticalScrollIndicator={false}>
        {statusStages.map((stage, index) => renderStatusStage(stage, index))}
      </ScrollView>

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

            <Text style={[styles.modalAction, { color: textColor }]}>
              {selectedAction}
            </Text>

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
              onPress={handleActionSubmit}
              disabled={loading}
              activeOpacity={0.7}
            >
              <MaterialIcons name='save' size={20} color='white' />
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
  quickActionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
  },
  quickActionsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickActionsPanel: {
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    gap: 10,
  },
  quickActionButton: {
    width: '45%',
    aspectRatio: 1.2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  pipelineStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  pipelineStatLabel: {
    fontSize: 12,
    marginTop: 5,
  },
  pipeline: {
    flex: 1,
  },
  stageCard: {
    marginBottom: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stageInfo: {
    flex: 1,
  },
  stageName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  stageDescription: {
    fontSize: 13,
    marginBottom: 2,
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
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  stageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentStageActions: {
    marginTop: 15,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  moveButtonText: {
    color: 'white',
    fontSize: 14,
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
  modalAction: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 20,
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
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default LeadStatusCRM;
