/**
 * Lead Detail Screen
 * Detailed view of a single lead with actions
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLeadStore } from '../store';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LeadDetail'>;

export default function LeadDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const lead = useLeadStore(s => s.getLead(id));
  const moveStage = useLeadStore(s => s.moveStage);
  const rescore = useLeadStore(s => s.rescore);
  const assignMatches = useLeadStore(s => s.assignMatches);

  const primaryAction = useMemo(() => {
    if (!lead) return { label: 'Close', action: () => navigation.goBack() };
    
    switch (lead.stage) {
      case 'new':
        return { 
          label: 'Verify Lead', 
          action: () => {
            moveStage(lead.id, 'verified');
            navigation.goBack();
          }
        };
      case 'verified':
        return { 
          label: 'Approve & Match', 
          action: () => {
            moveStage(lead.id, 'qualified');
            assignMatches(lead.id);
            navigation.goBack();
          }
        };
      case 'qualified':
        return { 
          label: 'Send Proposal', 
          action: () => {
            moveStage(lead.id, 'proposal');
            navigation.goBack();
          }
        };
      case 'proposal':
        return { 
          label: 'Mark as Won', 
          action: () => {
            moveStage(lead.id, 'won');
            navigation.goBack();
          }
        };
      default:
        return { label: 'Close', action: () => navigation.goBack() };
    }
  }, [lead, moveStage, assignMatches, navigation]);

  const handleRescoreAndMatch = () => {
    if (lead) {
      rescore(lead.id);
      assignMatches(lead.id);
      Alert.alert('Success', 'Lead rescored and matches updated');
    }
  };

  const formatProjectType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatBudget = () => {
    if (!lead) return 'N/A';
    const min = lead.project.budgetMin;
    const max = lead.project.budgetMax;
    if (min && max) {
      return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
    } else if (min) {
      return `$${min.toLocaleString()}+`;
    }
    return 'Budget TBD';
  };

  const formatTimeline = (timeline?: string) => {
    switch (timeline) {
      case 'urgent': return '🚨 Urgent';
      case 'soon': return '⚡ Soon';
      case 'flex': return '📅 Flexible';
      default: return 'Not specified';
    }
  };

  if (!lead) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Lead not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{lead.contact.name}</Text>
        <Text style={styles.subtitle}>
          {formatProjectType(lead.project.type)} • {lead.location?.city}, {lead.location?.state}
        </Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>AI Score</Text>
          <Text style={[styles.score, getScoreStyle(lead.aiScore ?? 0)]}>
            {lead.aiScore ?? '--'}
          </Text>
        </View>
      </View>

      <Section title="Contact Information">
        <Row label="Name" value={lead.contact.name} />
        <Row label="Email" value={lead.contact.email || 'Not provided'} />
        <Row label="Phone" value={lead.contact.phone || 'Not provided'} />
        <Row label="Company" value={lead.contact.company || 'Not provided'} />
      </Section>

      <Section title="Project Details">
        <Row label="Type" value={formatProjectType(lead.project.type)} />
        <Row label="Budget" value={formatBudget()} />
        <Row label="Timeline" value={formatTimeline(lead.project.timeline)} />
        <Row label="Description" value={lead.description || 'No description provided'} />
      </Section>

      <Section title="Location">
        <Row label="City" value={lead.location?.city || 'Not specified'} />
        <Row label="State" value={lead.location?.state || 'Not specified'} />
        <Row label="Source" value={lead.source.charAt(0).toUpperCase() + lead.source.slice(1)} />
      </Section>

      <Section title="Verification Status">
        <Row 
          label="Email Valid" 
          value={lead.verification?.emailValid ? '✅ Valid' : '❌ Invalid/Not checked'} 
        />
        <Row 
          label="Phone Valid" 
          value={lead.verification?.phoneValid ? '✅ Valid' : '❌ Invalid/Not checked'} 
        />
        <Row 
          label="Property Verified" 
          value={lead.verification?.propertyVerified ? '✅ Verified' : '⏳ Pending'} 
        />
        {lead.verification?.duplicateOfId && (
          <Row label="Duplicate Of" value={`Lead ${lead.verification.duplicateOfId}`} />
        )}
      </Section>

      <Section title="Contractor Matches">
        {lead.matches?.length ? (
          lead.matches.map((match, index) => (
            <View key={match.contractorId} style={styles.matchItem}>
              <Text style={styles.matchTitle}>
                #{index + 1} {match.contractorId} — {match.match}% match
              </Text>
              <Text style={styles.matchReasons}>
                {match.reasons.join(' • ')}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noMatches}>No matches assigned yet</Text>
        )}
      </Section>

      <View style={styles.actions}>
        <Pressable onPress={primaryAction.action} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
        </Pressable>
        
        <Pressable onPress={handleRescoreAndMatch} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Rescore & Match</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function getScoreStyle(score: number) {
  if (score >= 85) return { color: '#16A34A' };
  if (score >= 60) return { color: '#CA8A04' };
  return { color: '#DC2626' };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071626',
  },
  content: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#071626',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  closeButton: {
    backgroundColor: '#10233A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 16,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10233A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  scoreLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginRight: 8,
  },
  score: {
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#0F2137',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  sectionContent: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  rowLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    flex: 1,
  },
  rowValue: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  matchItem: {
    backgroundColor: '#10233A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  matchTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  matchReasons: {
    color: '#94A3B8',
    fontSize: 12,
  },
  noMatches: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#00C281',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#042319',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    borderColor: '#94A3B8',
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#D1D5DB',
    fontWeight: '700',
    fontSize: 16,
  },
});



