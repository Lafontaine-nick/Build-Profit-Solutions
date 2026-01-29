import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Lead } from '../services/leadService';

interface LeadDetailViewProps {
  lead: Lead;
  contractorId?: string;
  onLeadAction: (
    leadId: string,
    action: 'accept' | 'reject' | 'contact'
  ) => void;
  onClose: () => void;
}

const LeadDetailView: React.FC<LeadDetailViewProps> = ({
  lead,
  contractorId,
  onLeadAction,
  onClose,
}) => {
  const { darkMode } = useTheme();
  const [showActionModal, setShowActionModal] = useState(false);

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return '#4CAF50';
      case 'qualified':
        return '#2196F3';
      case 'contacted':
        return '#FF9800';
      case 'lost':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const handleAction = (action: 'accept' | 'reject' | 'contact') => {
    setShowActionModal(false);
    onLeadAction(lead.id, action);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <MaterialIcons name='close' size={24} color={textColor} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: textColor }]}>
        Lead Details
      </Text>
      <TouchableOpacity
        onPress={() => setShowActionModal(true)}
        style={[styles.actionButton, { backgroundColor: accentColor }]}
      >
        <MaterialIcons name='more-vert' size={20} color='white' />
      </TouchableOpacity>
    </View>
  );

  const renderLeadInfo = () => (
    <View style={[styles.section, { backgroundColor: cardColor }]}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Lead Information
      </Text>

      <View style={styles.infoRow}>
        <MaterialIcons name='person' size={20} color={textSecondaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Name
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.name}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons name='email' size={20} color={textSecondaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Email
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.email}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons name='phone' size={20} color={textSecondaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Phone
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.phone}
          </Text>
        </View>
      </View>

      {lead.company && (
        <View style={styles.infoRow}>
          <MaterialIcons name='business' size={20} color={textSecondaryColor} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
              Company
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {lead.company}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderProjectInfo = () => (
    <View style={[styles.section, { backgroundColor: cardColor }]}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Project Details
      </Text>

      <View style={styles.infoRow}>
        <MaterialIcons name='work' size={20} color={textSecondaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Project Type
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.projectType}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons name='straighten' size={20} color={textSecondaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Project Size
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.projectSize}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons
          name='attach-money'
          size={20}
          color={textSecondaryColor}
        />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Budget
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            ${lead.budget.min.toLocaleString()} - $
            {lead.budget.max.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons
          name='location-on'
          size={20}
          color={textSecondaryColor}
        />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Location
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.location.city}, {lead.location.state} {lead.location.zipCode}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <MaterialIcons name='schedule' size={20} color={textSecondaryColor} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
            Timeline
          </Text>
          <Text style={[styles.infoValue, { color: textColor }]}>
            {lead.timeline.duration} weeks • {lead.timeline.urgency} urgency
          </Text>
        </View>
      </View>
    </View>
  );

  const renderScores = () => (
    <View style={[styles.section, { backgroundColor: cardColor }]}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        Lead Scores
      </Text>

      <View style={styles.scoresGrid}>
        <View
          style={[
            styles.scoreCard,
            { backgroundColor: getScoreColor(lead.aiScore || 0) + '20' },
          ]}
        >
          <MaterialIcons
            name='psychology'
            size={24}
            color={getScoreColor(lead.aiScore || 0)}
          />
          <Text
            style={[
              styles.scoreValue,
              { color: getScoreColor(lead.aiScore || 0) },
            ]}
          >
            {lead.aiScore || 0}
          </Text>
          <Text style={[styles.scoreLabel, { color: textSecondaryColor }]}>
            AI Score
          </Text>
        </View>

        <View
          style={[
            styles.scoreCard,
            {
              backgroundColor: getScoreColor(lead.freshnessScore || 100) + '20',
            },
          ]}
        >
          <MaterialIcons
            name='schedule'
            size={24}
            color={getScoreColor(lead.freshnessScore || 100)}
          />
          <Text
            style={[
              styles.scoreValue,
              { color: getScoreColor(lead.freshnessScore || 100) },
            ]}
          >
            {lead.freshnessScore || 100}%
          </Text>
          <Text style={[styles.scoreLabel, { color: textSecondaryColor }]}>
            Freshness
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(lead.status) },
          ]}
        >
          <Text style={styles.statusText}>{lead.status}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getPriorityColor(lead.priority) },
          ]}
        >
          <Text style={styles.statusText}>{lead.priority}</Text>
        </View>
      </View>
    </View>
  );

  const renderContractorMatch = () => {
    if (!lead.contractorMatch?.isMatched) {
      return (
        <View style={[styles.section, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Contractor Match
          </Text>
          <Text style={[styles.noMatchText, { color: textSecondaryColor }]}>
            No contractor matched yet
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.section, { backgroundColor: cardColor }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Matched Contractor
        </Text>

        <View style={styles.infoRow}>
          <MaterialIcons name='person' size={20} color='#4CAF50' />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
              Contractor
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {lead.contractorMatch.contractorName || 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name='star' size={20} color='#FF9800' />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: textSecondaryColor }]}>
              Match Score
            </Text>
            <Text style={[styles.infoValue, { color: textColor }]}>
              {lead.contractorMatch.matchScore || 0}%
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderActionModal = () => (
    <Modal
      visible={showActionModal}
      transparent={true}
      animationType='fade'
      onRequestClose={() => setShowActionModal(false)}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      >
        <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
          <Text style={[styles.modalTitle, { color: textColor }]}>
            Lead Actions
          </Text>

          <TouchableOpacity
            style={[styles.actionOption, { backgroundColor: '#4CAF50' }]}
            onPress={() => handleAction('accept')}
          >
            <MaterialIcons name='check' size={20} color='white' />
            <Text style={styles.actionText}>Accept Lead</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionOption, { backgroundColor: '#2196F3' }]}
            onPress={() => handleAction('contact')}
          >
            <MaterialIcons name='phone' size={20} color='white' />
            <Text style={styles.actionText}>Contact Lead</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionOption, { backgroundColor: '#F44336' }]}
            onPress={() => handleAction('reject')}
          >
            <MaterialIcons name='close' size={20} color='white' />
            <Text style={styles.actionText}>Reject Lead</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { borderColor }]}
            onPress={() => setShowActionModal(false)}
          >
            <Text style={[styles.cancelText, { color: textColor }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {renderHeader()}

      <ScrollView style={styles.scrollView}>
        {renderLeadInfo()}
        {renderProjectInfo()}
        {renderScores()}
        {renderContractorMatch()}
      </ScrollView>

      {renderActionModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3F5F',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  scoresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  scoreLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  noMatchText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 300,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 12,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LeadDetailView;
