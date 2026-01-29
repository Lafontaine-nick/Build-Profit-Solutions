import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  projectType: string;
  budget: { min: number; max: number };
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  priority: 'high' | 'medium' | 'low';
  lastContact: string;
  nextFollowUp: string;
  interactions: Interaction[];
  notes: string;
}

interface Interaction {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'proposal' | 'follow-up';
  date: string;
  notes: string;
  outcome: 'positive' | 'neutral' | 'negative';
}

const LeadCRM: React.FC = () => {
  const { darkMode } = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  >('all');
  const [newInteraction, setNewInteraction] = useState({
    type: 'call' as const,
    notes: '',
    outcome: 'neutral' as const,
  });

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
        email: 'john@smithconstruction.com',
        phone: '(555) 123-4567',
        projectType: 'Residential Renovation',
        budget: { min: 50000, max: 75000 },
        status: 'qualified',
        priority: 'high',
        lastContact: '2024-01-15',
        nextFollowUp: '2024-01-22',
        notes: 'Interested in kitchen renovation. Budget confirmed.',
        interactions: [
          {
            id: '1',
            type: 'call',
            date: '2024-01-15',
            notes: 'Initial contact. Discussed project requirements.',
            outcome: 'positive',
          },
          {
            id: '2',
            type: 'meeting',
            date: '2024-01-12',
            notes: 'Site visit completed. Project scope defined.',
            outcome: 'positive',
          },
        ],
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        company: 'Johnson Development',
        email: 'sarah@johnsondev.com',
        phone: '(555) 234-5678',
        projectType: 'Commercial New Build',
        budget: { min: 200000, max: 300000 },
        status: 'proposal',
        priority: 'high',
        lastContact: '2024-01-14',
        nextFollowUp: '2024-01-21',
        notes: 'Proposal submitted. Awaiting decision.',
        interactions: [
          {
            id: '3',
            type: 'proposal',
            date: '2024-01-14',
            notes: 'Detailed proposal sent with timeline and pricing.',
            outcome: 'neutral',
          },
        ],
      },
      {
        id: '3',
        name: 'Mike Chen',
        company: 'Chen Properties',
        email: 'mike@chenproperties.com',
        phone: '(555) 345-6789',
        projectType: 'Multi-Family Renovation',
        status: 'contacted',
        priority: 'medium',
        budget: { min: 150000, max: 200000 },
        lastContact: '2024-01-13',
        nextFollowUp: '2024-01-20',
        notes: 'Initial interest shown. Need to schedule follow-up.',
        interactions: [
          {
            id: '4',
            type: 'email',
            date: '2024-01-13',
            notes: 'Sent project information and portfolio.',
            outcome: 'positive',
          },
        ],
      },
    ];
    setLeads(mockLeads);
  };

  const handleAddInteraction = () => {
    if (!selectedLead || !newInteraction.notes.trim()) {
      Alert.alert('Error', 'Please enter interaction notes.');
      return;
    }

    const interaction: Interaction = {
      id: Date.now().toString(),
      type: newInteraction.type,
      date: new Date().toISOString().split('T')[0],
      notes: newInteraction.notes,
      outcome: newInteraction.outcome,
    };

    setLeads(prev =>
      prev.map(lead =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              interactions: [...lead.interactions, interaction],
              lastContact: interaction.date,
            }
          : lead
      )
    );

    setNewInteraction({ type: 'call', notes: '', outcome: 'neutral' });
    setShowInteractionModal(false);
    Alert.alert('Success', 'Interaction added successfully.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return '#4CAF50';
      case 'lost':
        return '#F44336';
      case 'proposal':
        return '#FF9800';
      case 'qualified':
        return '#2196F3';
      case 'contacted':
        return '#9C27B0';
      default:
        return '#607D8B';
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

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'call':
        return 'phone';
      case 'email':
        return 'email';
      case 'meeting':
        return 'event';
      case 'proposal':
        return 'description';
      default:
        return 'chat';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'positive':
        return '#4CAF50';
      case 'negative':
        return '#F44336';
      default:
        return '#FF9800';
    }
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
        <View style={styles.leadStatus}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(lead.status) },
            ]}
          >
            <Text style={styles.statusText}>{lead.status}</Text>
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
        <Text style={[styles.contact, { color: textSecondaryColor }]}>
          {lead.email} • {lead.phone}
        </Text>
      </View>

      <View style={styles.leadFooter}>
        <View style={styles.badgeContainer}>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: getPriorityColor(lead.priority) },
            ]}
          >
            <Text style={styles.priorityText}>{lead.priority}</Text>
          </View>
          <Text
            style={[styles.interactionCount, { color: textSecondaryColor }]}
          >
            {lead.interactions.length} interactions
          </Text>
        </View>
        <Text style={[styles.dateText, { color: textSecondaryColor }]}>
          Next: {new Date(lead.nextFollowUp).toLocaleDateString()}
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
        <Text style={[styles.title, { color: textColor }]}>Lead CRM</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Customer Relationship Management
        </Text>
      </View>

      <View style={styles.filters}>
        <FilterButton title='All' value='all' active={filter === 'all'} />
        <FilterButton title='New' value='new' active={filter === 'new'} />
        <FilterButton
          title='Contacted'
          value='contacted'
          active={filter === 'contacted'}
        />
        <FilterButton
          title='Qualified'
          value='qualified'
          active={filter === 'qualified'}
        />
        <FilterButton
          title='Proposal'
          value='proposal'
          active={filter === 'proposal'}
        />
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {leads.filter(l => l.status === 'new').length}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              New
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {leads.filter(l => l.status === 'qualified').length}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Qualified
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardColor }]}>
            <Text style={[styles.statValue, { color: textColor }]}>
              {leads.filter(l => l.status === 'proposal').length}
            </Text>
            <Text style={[styles.statLabel, { color: textSecondaryColor }]}>
              Proposals
            </Text>
          </View>
        </View>

        <View style={styles.leadsContainer}>
          {filteredLeads.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name='people'
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
                  Email
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {selectedLead.email}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Phone
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {selectedLead.phone}
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
                  Status
                </Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: getStatusColor(selectedLead.status) },
                  ]}
                >
                  {selectedLead.status}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Priority
                </Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: getPriorityColor(selectedLead.priority) },
                  ]}
                >
                  {selectedLead.priority}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Last Contact
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {new Date(selectedLead.lastContact).toLocaleDateString()}
                </Text>

                <Text
                  style={[styles.detailLabel, { color: textSecondaryColor }]}
                >
                  Next Follow-up
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {new Date(selectedLead.nextFollowUp).toLocaleDateString()}
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
                style={[
                  styles.interactionsSection,
                  { backgroundColor: cardColor },
                ]}
              >
                <View style={styles.interactionsHeader}>
                  <Text style={[styles.sectionTitle, { color: textColor }]}>
                    Interactions
                  </Text>
                  <TouchableOpacity
                    style={styles.addInteractionButton}
                    onPress={() => setShowInteractionModal(true)}
                  >
                    <MaterialIcons name='add' size={20} color='#fff' />
                    <Text style={styles.addInteractionText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {selectedLead.interactions.map(interaction => (
                  <View key={interaction.id} style={styles.interactionItem}>
                    <View style={styles.interactionHeader}>
                      <MaterialIcons
                        name={getInteractionIcon(interaction.type) as any}
                        size={16}
                        color={getOutcomeColor(interaction.outcome)}
                      />
                      <Text
                        style={[styles.interactionType, { color: textColor }]}
                      >
                        {interaction.type}
                      </Text>
                      <Text
                        style={[
                          styles.interactionDate,
                          { color: textSecondaryColor },
                        ]}
                      >
                        {new Date(interaction.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.interactionNotes,
                        { color: textSecondaryColor },
                      ]}
                    >
                      {interaction.notes}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Add Interaction Modal */}
      <Modal
        visible={showInteractionModal}
        transparent
        animationType='slide'
        onRequestClose={() => setShowInteractionModal(false)}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        >
          <View
            style={[styles.interactionModal, { backgroundColor: cardColor }]}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>
              Add Interaction
            </Text>

            <View style={styles.interactionForm}>
              <Text style={[styles.formLabel, { color: textSecondaryColor }]}>
                Type
              </Text>
              <View style={styles.typeButtons}>
                {['call', 'email', 'meeting', 'proposal', 'follow-up'].map(
                  type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        {
                          backgroundColor:
                            newInteraction.type === type
                              ? '#1B365D'
                              : 'transparent',
                          borderColor:
                            newInteraction.type === type
                              ? '#1B365D'
                              : borderColor,
                        },
                      ]}
                      onPress={() =>
                        setNewInteraction(prev => ({
                          ...prev,
                          type: type as any,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          {
                            color:
                              newInteraction.type === type ? '#fff' : textColor,
                          },
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              <Text style={[styles.formLabel, { color: textSecondaryColor }]}>
                Notes
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
                placeholder='Enter interaction notes...'
                placeholderTextColor={textSecondaryColor}
                value={newInteraction.notes}
                onChangeText={text =>
                  setNewInteraction(prev => ({ ...prev, notes: text }))
                }
                multiline
                numberOfLines={4}
              />

              <Text style={[styles.formLabel, { color: textSecondaryColor }]}>
                Outcome
              </Text>
              <View style={styles.outcomeButtons}>
                {['positive', 'neutral', 'negative'].map(outcome => (
                  <TouchableOpacity
                    key={outcome}
                    style={[
                      styles.outcomeButton,
                      {
                        backgroundColor:
                          newInteraction.outcome === outcome
                            ? getOutcomeColor(outcome)
                            : 'transparent',
                        borderColor:
                          newInteraction.outcome === outcome
                            ? getOutcomeColor(outcome)
                            : borderColor,
                      },
                    ]}
                    onPress={() =>
                      setNewInteraction(prev => ({
                        ...prev,
                        outcome: outcome as any,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.outcomeButtonText,
                        {
                          color:
                            newInteraction.outcome === outcome
                              ? '#fff'
                              : getOutcomeColor(outcome),
                        },
                      ]}
                    >
                      {outcome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#666' }]}
                onPress={() => setShowInteractionModal(false)}
              >
                <Text style={styles.actionButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#1B365D' }]}
                onPress={handleAddInteraction}
              >
                <Text style={styles.actionButtonText}>Add Interaction</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
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
  leadStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
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
  contact: {
    fontSize: 14,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  interactionCount: {
    fontSize: 12,
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
  interactionsSection: {
    padding: 16,
    borderRadius: 12,
  },
  interactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addInteractionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B365D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addInteractionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  interactionItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3F5F',
  },
  interactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  interactionType: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  interactionDate: {
    fontSize: 12,
  },
  interactionNotes: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  interactionModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  interactionForm: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  outcomeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  outcomeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  outcomeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LeadCRM;
