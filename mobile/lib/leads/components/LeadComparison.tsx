/**
 * Lead Comparison Component
 * Allows users to compare multiple leads side by side
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Lead } from '../types';
import * as Haptics from 'expo-haptics';

interface LeadComparisonProps {
  leads: Lead[];
  selectedLeads: Set<string>;
  onClose: () => void;
  onSelectLead: (leadId: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 60) / 2; // 2 cards with margins

export default function LeadComparison({
  leads,
  selectedLeads,
  onClose,
  onSelectLead,
}: LeadComparisonProps) {
  const [selectedComparisonLeads, setSelectedComparisonLeads] = useState<Set<string>>(selectedLeads);

  const comparisonLeads = leads.filter(lead => selectedComparisonLeads.has(lead.id));

  const toggleLeadSelection = (leadId: string) => {
    const newSelection = new Set(selectedComparisonLeads);
    if (newSelection.has(leadId)) {
      newSelection.delete(leadId);
    } else {
      if (newSelection.size < 4) { // Limit to 4 leads for comparison
        newSelection.add(leadId);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
    }
    setSelectedComparisonLeads(newSelection);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getComparisonValue = (lead: Lead, field: string) => {
    switch (field) {
      case 'value':
        return `$${Math.round((lead.project.budgetMin + lead.project.budgetMax) / 2000)}K`;
      case 'score':
        return `${lead.aiScore}`;
      case 'timeline':
        return lead.project.timeline;
      case 'stage':
        return lead.stage;
      case 'trade':
        return lead.trade;
      case 'location':
        return lead.location.city;
      default:
        return '-';
    }
  };

  const getComparisonColor = (lead: Lead, field: string) => {
    switch (field) {
      case 'score':
        if (lead.aiScore >= 80) return '#4CAF50';
        if (lead.aiScore >= 60) return '#FF9800';
        return '#F44336';
      case 'timeline':
        if (lead.project.timeline === 'Urgent') return '#F44336';
        if (lead.project.timeline === 'Soon') return '#FF9800';
        return '#4CAF50';
      case 'stage':
        const stageColors = {
          new: '#2196F3',
          verified: '#9C27B0',
          qualified: '#FF9800',
          proposal: '#4CAF50',
          won: '#8BC34A',
          lost: '#F44336',
        };
        return stageColors[lead.stage as keyof typeof stageColors] || '#999';
      default:
        return '#fff';
    }
  };

  const renderComparisonCard = (lead: Lead) => (
    <View key={lead.id} style={styles.comparisonCard}>
      <View style={styles.cardHeader}>
        <View style={styles.leadInfo}>
          <Text style={styles.leadName} numberOfLines={1}>
            {lead.contact.name}
          </Text>
          <Text style={styles.leadCompany} numberOfLines={1}>
            {lead.contact.company || 'No Company'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => toggleLeadSelection(lead.id)}
        >
          <MaterialIcons name="close" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>

      <View style={styles.comparisonFields}>
        {['value', 'score', 'timeline', 'stage', 'trade', 'location'].map((field) => (
          <View key={field} style={styles.comparisonField}>
            <Text style={styles.fieldLabel}>
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </Text>
            <Text
              style={[
                styles.fieldValue,
                { color: getComparisonColor(lead, field) }
              ]}
            >
              {getComparisonValue(lead, field)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.createdDate}>
          {new Date(lead.createdAt).toLocaleDateString()}
        </Text>
        <View style={styles.leadActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onSelectLead(lead.id)}
          >
            <MaterialIcons name="visibility" size={16} color="#43cea2" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderLeadSelector = () => (
    <View style={styles.leadSelector}>
      <Text style={styles.selectorTitle}>Select Leads to Compare</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {leads.map((lead) => (
          <TouchableOpacity
            key={lead.id}
            style={[
              styles.leadOption,
              selectedComparisonLeads.has(lead.id) && styles.selectedLeadOption
            ]}
            onPress={() => toggleLeadSelection(lead.id)}
          >
            <Text style={styles.leadOptionName} numberOfLines={1}>
              {lead.contact.name}
            </Text>
            <Text style={styles.leadOptionScore}>
              {lead.aiScore}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Compare Leads ({comparisonLeads.length}/4)
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {comparisonLeads.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="compare" size={64} color="#666" />
            <Text style={styles.emptyTitle}>Select Leads to Compare</Text>
            <Text style={styles.emptySubtitle}>
              Choose up to 4 leads to compare their details side by side
            </Text>
            {renderLeadSelector()}
          </View>
        ) : (
          <ScrollView style={styles.comparisonContainer}>
            <View style={styles.comparisonGrid}>
              {comparisonLeads.map(renderComparisonCard)}
            </View>
            
            {comparisonLeads.length < 4 && (
              <View style={styles.addMoreContainer}>
                <Text style={styles.addMoreText}>Add more leads to compare</Text>
                {renderLeadSelector()}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  comparisonContainer: {
    flex: 1,
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    justifyContent: 'space-between',
  },
  comparisonCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  leadCompany: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  comparisonFields: {
    marginBottom: 16,
  },
  comparisonField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  fieldLabel: {
    color: '#999',
    fontSize: 12,
    fontWeight: '500',
  },
  fieldValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createdDate: {
    color: '#666',
    fontSize: 11,
  },
  leadActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
  },
  addMoreContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  addMoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  leadSelector: {
    marginBottom: 20,
  },
  selectorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  leadOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 80,
    alignItems: 'center',
  },
  selectedLeadOption: {
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderColor: '#43cea2',
  },
  leadOptionName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  leadOptionScore: {
    color: '#43cea2',
    fontSize: 14,
    fontWeight: '600',
  },
});


