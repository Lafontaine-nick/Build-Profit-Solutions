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
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';
import LeadDetails from './LeadDetails';

interface LeadTableItem {
  id: string;
  score: {
    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    aiScore: number;
  };
  job: {
    title: string;
    location: string;
    type: string;
  };
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  timeline: {
    urgency: 'asap' | 'within_week' | 'within_month' | 'planning_ahead';
    description: string;
  };
  status: 'new' | 'contacted' | 'qualified' | 'proposal-sent' | 'won' | 'lost';
  preview: {
    isUnlocked: boolean;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  lead: Lead;
}

const LeadsTable: React.FC = () => {
  const { darkMode } = useTheme();
  const [leads, setLeads] = useState<LeadTableItem[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadTableItem[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadTableItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    grade: 'all',
    budget: 'all',
    timeline: 'all',
    search: '',
  });

  // Define colors based on theme
  const backgroundColor = 'transparent';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [leads, filters]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      // Mock data for demonstration
      const mockLeads: LeadTableItem[] = [
        {
          id: '1',
          score: { grade: 'A', aiScore: 92 },
          job: {
            title: 'Kitchen Remodel',
            location: 'Henderson, NV',
            type: 'residential',
          },
          budget: { min: 15000, max: 25000, currency: 'USD' },
          timeline: { urgency: 'asap', description: 'Within 2 weeks' },
          status: 'new',
          preview: {
            isUnlocked: false,
            name: 'John Smith',
            email: 'john.smith@email.com',
            phone: '(555) 123-4567',
            address: '123 Main St, Henderson, NV 89002',
          },
          lead: {
            id: 'lead-1',
            name: 'John Smith',
            email: 'john.smith@email.com',
            phone: '(555) 123-4567',
            projectType: 'residential',
            budget: { min: 15000, max: 25000, currency: 'USD' },
            requirements:
              'Complete kitchen renovation with new cabinets and countertops',

            aiScore: 92,
            status: 'new',
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: '2',
          score: { grade: 'B', aiScore: 78 },
          job: {
            title: 'Bathroom Addition',
            location: 'Las Vegas, NV',
            type: 'residential',
          },
          budget: { min: 35000, max: 55000, currency: 'USD' },
          timeline: { urgency: 'within_month', description: 'Within 30 days' },
          status: 'contacted',
          preview: {
            isUnlocked: true,
            name: 'Sarah Johnson',
            email: 'sarah.j@email.com',
            phone: '(555) 987-6543',
            address: '456 Oak Ave, Las Vegas, NV 89101',
          },
          lead: {
            id: 'lead-2',
            name: 'Sarah Johnson',
            email: 'sarah.j@email.com',
            phone: '(555) 987-6543',
            projectType: 'residential',
            budget: { min: 35000, max: 55000, currency: 'USD' },
            requirements: 'Add master bathroom to existing home',

            aiScore: 78,
            status: 'contacted',
            createdAt: new Date().toISOString(),
          },
        },
        {
          id: '3',
          score: { grade: 'C', aiScore: 65 },
          job: {
            title: 'Office Renovation',
            location: 'Reno, NV',
            type: 'commercial',
          },
          budget: { min: 75000, max: 120000, currency: 'USD' },
          timeline: {
            urgency: 'planning_ahead',
            description: 'Planning phase',
          },
          status: 'qualified',
          preview: {
            isUnlocked: false,
            name: 'Mike Wilson',
            email: 'mike.w@business.com',
            phone: '(555) 456-7890',
            address: '789 Business Blvd, Reno, NV 89501',
          },
          lead: {
            id: 'lead-3',
            name: 'Mike Wilson',
            email: 'mike.w@business.com',
            phone: '(555) 456-7890',
            projectType: 'commercial',
            budget: { min: 75000, max: 120000, currency: 'USD' },
            requirements: 'Complete office space renovation',
            leadGrade: 'C',
            aiScore: 65,
            status: 'qualified',
            createdAt: new Date().toISOString(),
          },
        },
      ];
      setLeads(mockLeads);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leads];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(lead => lead.status === filters.status);
    }

    // Grade filter
    if (filters.grade !== 'all') {
      filtered = filtered.filter(lead => lead.score.grade === filters.grade);
    }

    // Budget filter
    if (filters.budget !== 'all') {
      const budgetRanges = {
        low: { min: 0, max: 25000 },
        medium: { min: 25000, max: 75000 },
        high: { min: 75000, max: Infinity },
      };
      const range = budgetRanges[filters.budget as keyof typeof budgetRanges];
      filtered = filtered.filter(
        lead => lead.budget.max >= range.min && lead.budget.min <= range.max
      );
    }

    // Timeline filter
    if (filters.timeline !== 'all') {
      filtered = filtered.filter(
        lead => lead.timeline.urgency === filters.timeline
      );
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        lead =>
          lead.job.title.toLowerCase().includes(searchLower) ||
          lead.job.location.toLowerCase().includes(searchLower) ||
          lead.preview.name.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLeads(filtered);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return '#4CAF50';
      case 'B':
        return '#8BC34A';
      case 'C':
        return '#FFC107';
      case 'D':
        return '#FF9800';
      case 'E':
        return '#F44336';
      case 'F':
        return '#D32F2F';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return '#2196F3';
      case 'contacted':
        return '#FF9800';
      case 'qualified':
        return '#9C27B0';
      case 'proposal-sent':
        return '#673AB7';
      case 'won':
        return '#4CAF50';
      case 'lost':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getTimelineColor = (urgency: string) => {
    switch (urgency) {
      case 'asap':
        return '#F44336';
      case 'within_week':
        return '#FF9800';
      case 'within_month':
        return '#FFC107';
      case 'planning_ahead':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const handleAcceptLead = async (lead: LeadTableItem) => {
    setLoading(true);
    try {
      // Mock API call to accept lead
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update lead status
      const updatedLeads = leads.map(l =>
        l.id === lead.id
          ? {
              ...l,
              status: 'contacted' as const,
              preview: { ...l.preview, isUnlocked: true },
            }
          : l
      );
      setLeads(updatedLeads);

      Alert.alert(
        'Lead Accepted',
        'Lead has been unlocked and moved to your CRM'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to accept lead');
    } finally {
      setLoading(false);
    }
  };

  const formatBudget = (budget: {
    min: number;
    max: number;
    currency: string;
  }) => {
    const formatAmount = (amount: number) => {
      if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}K`;
      }
      return `$${amount.toLocaleString()}`;
    };
    return `${formatAmount(budget.min)}–${formatAmount(budget.max)}`;
  };

  const LeadRow: React.FC<{ lead: LeadTableItem }> = ({ lead }) => (
    <View style={[styles.leadRow, { backgroundColor: cardColor, borderColor }]}>
      {/* Score Column */}
      <View style={styles.scoreColumn}>
        <View
          style={[
            styles.gradeBadge,
            { backgroundColor: getGradeColor(lead.score.grade) },
          ]}
        >
          <Text style={styles.gradeText}>{lead.score.grade}</Text>
        </View>
        <Text style={[styles.aiScoreText, { color: textSecondaryColor }]}>
          {lead.score.aiScore}
        </Text>
      </View>

      {/* Job Column */}
      <View style={styles.jobColumn}>
        <Text style={[styles.jobTitle, { color: textColor }]} numberOfLines={1}>
          {lead.job.title}
        </Text>
        <Text
          style={[styles.jobLocation, { color: textSecondaryColor }]}
          numberOfLines={1}
        >
          {lead.job.location}
        </Text>
      </View>

      {/* Budget Column */}
      <View style={styles.budgetColumn}>
        <Text style={[styles.budgetText, { color: textColor }]}>
          {formatBudget(lead.budget)}
        </Text>
      </View>

      {/* Timeline Column */}
      <View style={styles.timelineColumn}>
        <View
          style={[
            styles.timelineBadge,
            { backgroundColor: getTimelineColor(lead.timeline.urgency) + '20' },
          ]}
        >
          <Text
            style={[
              styles.timelineText,
              { color: getTimelineColor(lead.timeline.urgency) },
            ]}
          >
            {lead.timeline.description}
          </Text>
        </View>
      </View>

      {/* Status Column */}
      <View style={styles.statusColumn}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(lead.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Preview Column */}
      <View style={styles.previewColumn}>
        <TouchableOpacity
          style={[
            styles.previewButton,
            {
              backgroundColor: lead.preview.isUnlocked
                ? accentColor
                : borderColor,
            },
          ]}
          onPress={() => setSelectedLead(lead)}
        >
          <MaterialIcons
            name={lead.preview.isUnlocked ? 'visibility' : 'visibility-off'}
            size={16}
            color={lead.preview.isUnlocked ? 'white' : textColor}
          />
        </TouchableOpacity>
      </View>

      {/* Accept Column */}
      <View style={styles.acceptColumn}>
        <TouchableOpacity
          style={[
            styles.acceptButton,
            {
              backgroundColor:
                lead.status === 'new' ? accentColor : borderColor,
            },
          ]}
          onPress={() => handleAcceptLead(lead)}
          disabled={lead.status !== 'new' || loading}
        >
          <Text
            style={[
              styles.acceptButtonText,
              { color: lead.status === 'new' ? 'white' : textSecondaryColor },
            ]}
          >
            {lead.status === 'new' ? 'Accept' : 'Accepted'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const FilterBar: React.FC = () => (
    <View
      style={[styles.filterBar, { backgroundColor: cardColor, borderColor }]}
    >
      <TextInput
        style={[
          styles.searchInput,
          { backgroundColor: backgroundColor, color: textColor, borderColor },
        ]}
        placeholder='Search leads...'
        placeholderTextColor={textSecondaryColor}
        value={filters.search}
        onChangeText={text => setFilters({ ...filters, search: text })}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor:
                filters.status === 'all' ? accentColor : backgroundColor,
              borderColor,
            },
          ]}
          onPress={() => setFilters({ ...filters, status: 'all' })}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: filters.status === 'all' ? 'white' : textColor },
            ]}
          >
            All Status
          </Text>
        </TouchableOpacity>

        {['new', 'contacted', 'qualified', 'proposal-sent', 'won', 'lost'].map(
          status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filters.status === status ? accentColor : backgroundColor,
                  borderColor,
                },
              ]}
              onPress={() => setFilters({ ...filters, status })}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filters.status === status ? 'white' : textColor },
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Leads Table</Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          Professional lead management with filtering
        </Text>
      </View>

      <FilterBar />

      {/* Table Header */}
      <View
        style={[
          styles.tableHeader,
          { backgroundColor: cardColor, borderColor },
        ]}
      >
        <View style={styles.scoreColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>
            🔥 Score
          </Text>
        </View>
        <View style={styles.jobColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>🛠️ Job</Text>
        </View>
        <View style={styles.budgetColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>
            💰 Budget
          </Text>
        </View>
        <View style={styles.timelineColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>
            🕒 Timeline
          </Text>
        </View>
        <View style={styles.statusColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>
            📅 Status
          </Text>
        </View>
        <View style={styles.previewColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>
            👁 Preview
          </Text>
        </View>
        <View style={styles.acceptColumn}>
          <Text style={[styles.headerText, { color: textColor }]}>
            ✅ Accept
          </Text>
        </View>
      </View>

      {/* Table Body */}
      <ScrollView style={styles.tableBody}>
        {filteredLeads.map(lead => (
          <LeadRow key={lead.id} lead={lead} />
        ))}
      </ScrollView>

      {/* Lead Detail Modal */}
      <Modal
        visible={showModal}
        animationType='slide'
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            {selectedLead && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: textColor }]}>
                    Lead Details
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <MaterialIcons name='close' size={24} color={textColor} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Project
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      {selectedLead.job.title} - {selectedLead.job.location}
                    </Text>
                    <Text
                      style={[styles.detailText, { color: textSecondaryColor }]}
                    >
                      Type: {selectedLead.job.type}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Contact Info
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Name:{' '}
                      {selectedLead.preview.isUnlocked
                        ? selectedLead.preview.name
                        : '🔒 Locked'}
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Email:{' '}
                      {selectedLead.preview.isUnlocked
                        ? selectedLead.preview.email
                        : '🔒 Locked'}
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Phone:{' '}
                      {selectedLead.preview.isUnlocked
                        ? selectedLead.preview.phone
                        : '🔒 Locked'}
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Address:{' '}
                      {selectedLead.preview.isUnlocked
                        ? selectedLead.preview.address
                        : '🔒 Locked'}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={[styles.sectionTitle, { color: textColor }]}>
                      Project Details
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Budget: {formatBudget(selectedLead.budget)}
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Timeline: {selectedLead.timeline.description}
                    </Text>
                    <Text style={[styles.detailText, { color: textColor }]}>
                      Lead Grade: {selectedLead.score.grade} (
                      {selectedLead.score.aiScore} AI Score)
                    </Text>
                  </View>

                  {!selectedLead.preview.isUnlocked && (
                    <TouchableOpacity
                      style={[
                        styles.unlockButton,
                        { backgroundColor: accentColor },
                      ]}
                      onPress={() => handleAcceptLead(selectedLead)}
                      disabled={loading}
                    >
                      <Text style={styles.unlockButtonText}>
                        {loading ? 'Unlocking...' : 'Unlock Lead ($25)'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </>
            )}
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
  filterBar: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  headerText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableBody: {
    flex: 1,
  },
  leadRow: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  scoreColumn: {
    flex: 1,
    alignItems: 'center',
  },
  gradeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  aiScoreText: {
    fontSize: 10,
  },
  jobColumn: {
    flex: 2,
    paddingHorizontal: 4,
  },
  jobTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  jobLocation: {
    fontSize: 10,
  },
  budgetColumn: {
    flex: 1,
    alignItems: 'center',
  },
  budgetText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timelineColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timelineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timelineText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  previewColumn: {
    flex: 1,
    alignItems: 'center',
  },
  previewButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptColumn: {
    flex: 1,
    alignItems: 'center',
  },
  acceptButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  acceptButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  unlockButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  unlockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LeadsTable;
