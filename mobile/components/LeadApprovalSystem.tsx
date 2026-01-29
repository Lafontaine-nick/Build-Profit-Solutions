import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface Lead {
  id: string;
  name: string;
  company: string;
  projectType: string;
  budget: { min: number; max: number };
  location: { city: string; state: string };
  aiScore: number;
  status: 'pending' | 'approved' | 'rejected' | 'needs-review';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  notes?: string;
}

const LeadApprovalSystem: React.FC = () => {
  const { darkMode } = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected'
  >('all');

  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = () => {
    // Mock data
    const mockLeads: Lead[] = [
      {
        id: '1',
        name: 'John Smith',
        company: 'Smith Construction',
        projectType: 'Residential Renovation',
        budget: { min: 50000, max: 75000 },
        location: { city: 'Austin', state: 'TX' },
        aiScore: 85,
        status: 'pending',
        priority: 'high',
        createdAt: '2024-01-15',
        notes: 'High-value residential project with good budget range.',
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        company: 'Johnson Development',
        projectType: 'Commercial New Build',
        budget: { min: 200000, max: 300000 },
        location: { city: 'Phoenix', state: 'AZ' },
        aiScore: 92,
        status: 'approved',
        priority: 'high',
        createdAt: '2024-01-14',
        notes:
          'Excellent commercial opportunity with strong financial backing.',
      },
      {
        id: '3',
        name: 'Mike Chen',
        company: 'Chen Properties',
        projectType: 'Multi-Family Renovation',
        budget: { min: 150000, max: 200000 },
        location: { city: 'Denver', state: 'CO' },
        aiScore: 78,
        status: 'needs-review',
        priority: 'medium',
        createdAt: '2024-01-13',
        notes: 'Good project but needs additional verification.',
      },
      {
        id: '4',
        name: 'Lisa Rodriguez',
        company: 'Rodriguez Homes',
        projectType: 'Single Family New Build',
        budget: { min: 300000, max: 400000 },
        location: { city: 'San Diego', state: 'CA' },
        aiScore: 65,
        status: 'rejected',
        priority: 'low',
        createdAt: '2024-01-12',
        notes: 'Budget too high for current market conditions.',
      },
    ];
    setLeads(mockLeads);
  };

  const handleApproval = (leadId: string, action: 'approve' | 'reject') => {
    setLeads(prev =>
      prev.map(lead =>
        lead.id === leadId
          ? { ...lead, status: action === 'approve' ? 'approved' : 'rejected' }
          : lead
      )
    );
    setShowDetailModal(false);
    setApprovalNotes('');
    Alert.alert(
      'Success',
      `Lead ${action === 'approve' ? 'approved' : 'rejected'} successfully.`
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'needs-review':
        return '#FF9800';
      default:
        return '#2196F3';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const filteredLeads = leads.filter(lead =>
    filter === 'all' ? true : lead.status === filter
  );

  const LeadCard: React.FC<{ lead: Lead }> = ({ lead }) => (
    <TouchableOpacity
      style={[styles.leadCard, { backgroundColor: cardColor, borderColor }]}
      onPress={() => {
        setSelectedLead(lead);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.leadHeader}>
        <View style={styles.leadInfo}>
          <Text style={[styles.leadName, { color: textColor }]}>
            {lead.name}
          </Text>
          <Text style={[styles.leadCompany, { color: textSecondaryColor }]}>
            {lead.company}
          </Text>
        </View>
        <View style={styles.leadScores}>
          <View
            style={[
              styles.scoreBadge,
              { backgroundColor: getScoreColor(lead.aiScore) + '20' },
            ]}
          >
            <Text
              style={[styles.scoreText, { color: getScoreColor(lead.aiScore) }]}
            >
              AI: {lead.aiScore}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.leadDetails}>
        <Text style={[styles.projectType, { color: textColor }]}>
          {lead.projectType}
        </Text>
        <Text style={[styles.budget, { color: textSecondaryColor }]}>
          ${lead.budget.min.toLocaleString()} - $
          {lead.budget.max.toLocaleString()}
        </Text>
        <Text style={[styles.location, { color: textSecondaryColor }]}>
          {lead.location.city}, {lead.location.state}
        </Text>
      </View>

      <View style={styles.leadFooter}>
        <View style={styles.badgeContainer}>
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
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(lead.priority) },
            ]}
          >
            <Text style={styles.priorityText}>{lead.priority}</Text>
          </View>
        </View>
        <Text style={[styles.dateText, { color: textSecondaryColor }]}>
          {new Date(lead.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const FilterButton: React.FC<{
    title: string;
    value: string;
    active: boolean;
  }> = ({ title, value, active }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        {
          backgroundColor: active ? '#1B365D' : 'transparent',
          borderColor: active ? '#1B365D' : borderColor,
        },
      ]}
      onPress={() => setFilter(value as any)}
    >
      <Text style={[styles.filterText, { color: active ? '#fff' : textColor }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          Lead Approval System
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          AI-powered lead approval and qualification
        </Text>
      </View>

      <View style={styles.filters}>
        <FilterButton title='All' value='all' active={filter === 'all'} />
        <FilterButton
          title='Pending'
          value='pending'
          active={filter === 'pending'}
        />
        <FilterButton
          title='Approved'
          value='approved'
          active={filter === 'approved'}
        />
        <FilterButton
          title='Rejected'
          value='rejected'
          active={filter === 'rejected'}
        />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {leads.filter(l => l.status === 'pending').length}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Pending
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {leads.filter(l => l.status === 'approved').length}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Approved
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {leads.filter(l => l.status === 'rejected').length}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Rejected
            </Text>
          </View>
        </View>

        <View style={styles.leadsContainer}>
          {filteredLeads.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name='assignment'
                size={64}
                color={textSecondaryColor}
              />
              <Text style={[styles.emptyText, { color: textColor }]}>
                No {filter === 'all' ? '' : filter} leads found.
              </Text>
            </View>
          ) : (
            filteredLeads.map(lead => <LeadCard key={lead.id} lead={lead} />)
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedLead && (
          <View style={[styles.modalContainer, { backgroundColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                Lead Details
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialIcons name='close' size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={[styles.detailCard, { backgroundColor: cardColor }]}>
                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Name
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {selectedLead.name}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Company
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {selectedLead.company}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Project Type
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {selectedLead.projectType}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Budget
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  ${selectedLead.budget.min.toLocaleString()} - $
                  {selectedLead.budget.max.toLocaleString()}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Location
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {selectedLead.location.city}, {selectedLead.location.state}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  AI Score
                </Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: getScoreColor(selectedLead.aiScore) },
                  ]}
                >
                  {selectedLead.aiScore}/100
                </Text>

                {selectedLead.notes && (
                  <>
                    <Text
                      style={[
                        styles.detailLabel,
                        { color: textSecondaryColor },
                      ]}
                    >
                      Notes
                    </Text>
                    <Text style={[styles.detailValue, { color: textColor }]}>
                      {selectedLead.notes}
                    </Text>
                  </>
                )}
              </View>

              <View
                style={[styles.approvalSection, { backgroundColor: cardColor }]}
              >
                <Text style={[styles.sectionTitle, { color: textColor }]}>
                  Approval Notes
                </Text>
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: darkMode ? '#2A3F5F' : '#fff',
                      color: textColor,
                      borderColor,
                    },
                  ]}
                  placeholder='Add approval notes...'
                  placeholderTextColor={textSecondaryColor}
                  value={approvalNotes}
                  onChangeText={setApprovalNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                onPress={() => handleApproval(selectedLead.id, 'reject')}
              >
                <MaterialIcons name='close' size={20} color='#fff' />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                onPress={() => handleApproval(selectedLead.id, 'approve')}
              >
                <MaterialIcons name='check' size={20} color='#fff' />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  leadsContainer: {
    padding: 20,
  },
  leadCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  leadCompany: {
    fontSize: 14,
  },
  leadScores: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  leadDetails: {
    marginBottom: 12,
  },
  projectType: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  budget: {
    fontSize: 14,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  dateText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3F5F',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    marginBottom: 16,
    fontWeight: '500',
  },
  approvalSection: {
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LeadApprovalSystem;
