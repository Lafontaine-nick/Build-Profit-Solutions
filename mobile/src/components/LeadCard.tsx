/**
 * LeadCard Component
 * Displays lead information in a card format with AI score
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Lead } from '../types/leads';

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

export default function LeadCard({ lead, onPress }: LeadCardProps) {
  const score = lead.aiScore ?? 0;
  const badge = score >= 85 ? styles.badgeHigh : score >= 60 ? styles.badgeMed : styles.badgeLow;

  const formatBudget = () => {
    const min = lead.project.budgetMin;
    const max = lead.project.budgetMax;
    if (min && max) {
      return `$${min.toLocaleString()}–$${max.toLocaleString()}`;
    } else if (min) {
      return `$${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to $${max.toLocaleString()}`;
    }
    return 'Budget TBD';
  };

  const formatLocation = () => {
    if (lead.location?.city && lead.location?.state) {
      return `${lead.location.city}, ${lead.location.state}`;
    } else if (lead.location?.city) {
      return lead.location.city;
    }
    return 'Location TBD';
  };

  const formatProjectType = () => {
    const type = lead.project.type;
    const typeMap: Record<string, string> = {
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      addition: 'Addition',
      new_build: 'New Build',
      landscaping: 'Landscaping',
      other: 'Other'
    };
    return typeMap[type] || type;
  };

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{lead.contact.name || 'New Lead'}</Text>
          {lead.contact.company && (
            <Text style={styles.company}>{lead.contact.company}</Text>
          )}
        </View>
        <View style={[styles.badge, badge]}>
          <Text style={styles.badgeText}>{score || '--'}</Text>
        </View>
      </View>
      
      <View style={styles.details}>
        <Text style={styles.projectType}>{formatProjectType()}</Text>
        <Text style={styles.budget}>{formatBudget()}</Text>
      </View>
      
      <Text style={styles.location}>{formatLocation()}</Text>
      
      {lead.description && (
        <Text style={styles.description} numberOfLines={2}>
          {lead.description}
        </Text>
      )}
      
      <View style={styles.footer}>
        <Text style={styles.source}>Source: {lead.source}</Text>
        <Text style={styles.timeline}>
          {lead.project.timeline === 'urgent' ? '🔥 Urgent' :
           lead.project.timeline === 'soon' ? '⏰ Soon' :
           lead.project.timeline === 'flex' ? '📅 Flexible' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#10233A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  company: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  badgeHigh: {
    backgroundColor: '#16A34A',
  },
  badgeMed: {
    backgroundColor: '#CA8A04',
  },
  badgeLow: {
    backgroundColor: '#DC2626',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  projectType: {
    color: '#49F2A8',
    fontWeight: '600',
    fontSize: 14,
  },
  budget: {
    color: '#C7D2FE',
    fontSize: 14,
    fontWeight: '500',
  },
  location: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  description: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  source: {
    color: '#64748B',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  timeline: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
});



