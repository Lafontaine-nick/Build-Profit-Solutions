import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { leadService, Lead } from '../services/leadService';
import { contractorService, Contractor } from '../services/contractorService';

interface ContractorLeadsFeedProps {
  contractorId: string;
  contractor?: Contractor;
}

const ContractorLeadsFeed: React.FC<ContractorLeadsFeedProps> = ({
  contractorId,
  contractor,
}) => {
  const { darkMode } = useTheme();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contractorData, setContractorData] = useState<Contractor | null>(
    contractor || null
  );

  // Define colors based on theme
  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const textSecondaryColor = darkMode ? '#B0B0B0' : '#666666';
  const borderColor = darkMode ? '#2A3F5F' : '#CCCCCC';
  const cardColor = darkMode ? '#1B2A4A' : '#F5F5F5';
  const accentColor = '#1B365D';

  useEffect(() => {
    loadContractorData();
    loadMatchedLeads();
  }, [contractorId]);

  const loadContractorData = async () => {
    if (!contractor) {
      try {
        const contractorData =
          await contractorService.getContractor(contractorId);
        setContractorData(contractorData);
      } catch (error) {
        console.error('Error loading contractor data:', error);
      }
    }
  };

  const loadMatchedLeads = async () => {
    setLoading(true);
    try {
      // Get leads filtered by contractor ID
      const matchedLeads = await leadService.getLeads({ contractorId });
      setLeads(matchedLeads);
    } catch (error) {
      console.error('Error loading matched leads:', error);
      Alert.alert('Error', 'Failed to load matched leads');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatchedLeads();
    setRefreshing(false);
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const formatBudget = (budget: {
    min: number;
    max: number;
    currency: string;
  }) => {
    return `${budget.currency}${budget.min.toLocaleString()}-${budget.max.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleLeadPress = (lead: Lead) => {
    Alert.alert(
      'Lead Details',
      `Name: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nProject: ${lead.projectType}\nBudget: ${formatBudget(lead.budget)}\nAI Score: ${lead.aiScore}\nStatus: ${lead.status}`,
      [{ text: 'OK' }]
    );
  };

  const renderLeadItem = ({ item: lead }: { item: Lead }) => (
    <TouchableOpacity
      style={[styles.leadCard, { backgroundColor: cardColor, borderColor }]}
      onPress={() => handleLeadPress(lead)}
    >
      <View style={styles.leadHeader}>
        <View style={styles.leadInfo}>
          <Text style={[styles.leadName, { color: textColor }]}>
            {lead.name}
          </Text>
          <Text style={[styles.leadProject, { color: textSecondaryColor }]}>
            {lead.projectType} • {lead.location.city}, {lead.location.state}
          </Text>
        </View>
        <View style={styles.leadScores}>
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
              styles.scoreBadge,
              { backgroundColor: getScoreColor(lead.aiScore) + '20' },
            ]}
          >
            <Text
              style={[styles.scoreText, { color: getScoreColor(lead.aiScore) }]}
            >
              {lead.aiScore}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.leadDetails}>
        <View style={styles.detailRow}>
          <MaterialIcons
            name='attach-money'
            size={16}
            color={textSecondaryColor}
          />
          <Text style={[styles.detailText, { color: textSecondaryColor }]}>
            {formatBudget(lead.budget)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name='schedule' size={16} color={textSecondaryColor} />
          <Text style={[styles.detailText, { color: textSecondaryColor }]}>
            {lead.timeline.urgency} • {lead.timeline.duration} weeks
          </Text>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons
            name='location-on'
            size={16}
            color={textSecondaryColor}
          />
          <Text style={[styles.detailText, { color: textSecondaryColor }]}>
            {lead.location.zipCode}
          </Text>
        </View>
      </View>

      <View style={styles.leadFooter}>
        <View style={styles.matchInfo}>
          <MaterialIcons name='star' size={16} color={accentColor} />
          <Text style={[styles.matchText, { color: textSecondaryColor }]}>
            Match Score: {lead.contractorMatch?.matchScore || 0}
          </Text>
        </View>
        <Text style={[styles.dateText, { color: textSecondaryColor }]}>
          {formatDate(lead.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name='assignment' size={64} color={textSecondaryColor} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>
        No Matched Leads
      </Text>
      <Text style={[styles.emptySubtitle, { color: textSecondaryColor }]}>
        {contractorData?.name || 'This contractor'} hasn't been matched to any
        leads yet.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>
          {contractorData?.name || 'Contractor'} Leads
        </Text>
        <Text style={[styles.subtitle, { color: textSecondaryColor }]}>
          {leads.length} matched leads •{' '}
          {contractorData?.company || 'Loading...'}
        </Text>
      </View>

      <FlatList
        data={leads}
        renderItem={renderLeadItem}
        keyExtractor={item => item.id}
        style={styles.leadsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[accentColor]}
            tintColor={accentColor}
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          leads.length === 0 ? styles.emptyContainer : undefined
        }
      />
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
  leadsList: {
    flex: 1,
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
  leadProject: {
    fontSize: 14,
  },
  leadScores: {
    flexDirection: 'row',
    gap: 8,
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 8,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchText: {
    fontSize: 14,
    marginLeft: 4,
  },
  dateText: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ContractorLeadsFeed;
