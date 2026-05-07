/**
 * Detailed Lead Card Component
 * Full-featured card with all analytics and insights
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Lead } from '../types';

interface DetailedLeadCardProps {
  lead: Lead;
  onPress: () => void;
  onAddNote: (lead: Lead) => void;
  onSetReminder: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onStageChange?: (lead: Lead, newStage: string) => void;
}

export default function DetailedLeadCard({
  lead,
  onPress,
  onAddNote,
  onSetReminder,
  onDelete,
  onStageChange,
}: DetailedLeadCardProps) {
  const [showPhotos, setShowPhotos] = useState(false);

  const leadValue = Math.round((lead.project.budgetMin + lead.project.budgetMax) / 2);
  const score = lead.aiScore || 0;
  const timeAgo = getTimeAgo(lead.createdAt);
  
  // Temperature calculation
  const temperature = getTemperature(lead);
  
  // Quality indicators
  const qualityIndicators = getQualityIndicators(lead);
  const hideSalesPipeline = lead.isOwnRequest === true;

  const handleCall = () => {
    if (lead.contact.phone) {
      Linking.openURL(`tel:${lead.contact.phone}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Alert.alert('No Phone', 'This lead does not have a phone number');
    }
  };

  const handleEmail = () => {
    if (lead.contact.email) {
      Linking.openURL(`mailto:${lead.contact.email}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Alert.alert('No Email', 'This lead does not have an email address');
    }
  };

  const handleExpand = () => {
    onPress();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStageAdvance = () => {
    if (onStageChange) {
      // Determine next stage based on current stage
      const stages = ['new', 'contacted', 'qualified', 'proposal', 'won'];
      // Normalize "quoted" to "qualified" for stage progression
      const normalizedStage = lead.stage === 'quoted' ? 'qualified' : lead.stage;
      const currentIndex = stages.indexOf(normalizedStage);
      const nextStage = stages[currentIndex + 1];
      
      if (nextStage) {
        Alert.alert(
          'Change Stage?',
          `Move this lead from "${lead.stage}" to "${nextStage}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Change',
              onPress: () => {
                onStageChange(lead, nextStage);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            }
          ]
        );
      } else {
        Alert.alert('Final Stage', 'This lead is already at the final stage.');
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {/* Main Card Content */}
      <TouchableOpacity onPress={handleExpand} style={styles.mainContent}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.leadInfo}>
            <Text style={styles.contactName} numberOfLines={1}>
              {lead.contact.name || 'New Lead'}
            </Text>
            {lead.contact.company && (
              <Text style={styles.companyName} numberOfLines={1}>
                {lead.contact.company}
              </Text>
            )}
          </View>
          
          <View style={styles.badges}>
            <View style={[styles.temperatureBadge, { backgroundColor: temperature.color }]}>
              <Text style={styles.temperatureText}>
                {temperature.icon} {temperature.label}
              </Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(score) }]}>
              <Text style={styles.scoreText}>{score}</Text>
            </View>
          </View>
        </View>

        {/* Project Details Row */}
        <View style={styles.projectRow}>
          <View style={styles.projectInfo}>
            <Text style={styles.trade}>{lead.trade}</Text>
            <Text style={styles.budget}>
              ${lead.project.budgetMin.toLocaleString()} - ${lead.project.budgetMax.toLocaleString()}
            </Text>
          </View>
          <View style={styles.metaInfo}>
            <Text style={styles.location}>{lead.location.city}, {lead.location.state}</Text>
            <Text style={styles.timeline}>{lead.project.timeline}</Text>
          </View>
        </View>

        {/* Quality Indicators */}
        <View style={styles.qualityRow}>
          <View style={styles.qualityIndicators}>
            {qualityIndicators.map((indicator, index) => (
              <View key={index} style={styles.qualityIndicator}>
                <MaterialIcons 
                  name={indicator.icon as any} 
                  size={14} 
                  color={indicator.verified ? '#34C759' : '#9CA3AF'} 
                />
              </View>
            ))}
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
      </TouchableOpacity>

      {/* Action Buttons — contact row omitted for your own subcontractor requests */}
      {!lead.isOwnRequest && (
      <View style={styles.actionsRow}>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionButton, !lead.contact.phone && styles.disabledButton]}
            onPress={handleCall}
            disabled={!lead.contact.phone}
          >
            <MaterialIcons name="phone" size={16} color={lead.contact.phone ? '#34C759' : '#9CA3AF'} />
            <Text style={[styles.actionText, !lead.contact.phone && styles.disabledText]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, !lead.contact.email && styles.disabledButton]}
            onPress={handleEmail}
            disabled={!lead.contact.email}
          >
            <MaterialIcons name="email" size={16} color={lead.contact.email ? '#3B82F6' : '#9CA3AF'} />
            <Text style={[styles.actionText, !lead.contact.email && styles.disabledText]}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onSetReminder(lead)}
          >
            <MaterialIcons name="schedule" size={16} color="#8B5CF6" />
            <Text style={styles.actionText}>Remind</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          {!hideSalesPipeline && onStageChange && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleStageAdvance}
            >
              <MaterialIcons name="arrow-forward" size={16} color="#43cea2" />
              <Text style={styles.actionText}>Advance</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      )}
    </TouchableOpacity>
  );
}

// Helper functions
function getTimeAgo(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function getTemperature(lead: Lead) {
  const urgency = lead.project.timeline;
  const score = lead.aiScore || 0;
  
  if (urgency === 'Urgent' && score >= 80) {
    return { icon: '🔥', label: 'Hot', color: '#EF4444' };
  } else if (urgency === 'Soon' || score >= 70) {
    return { icon: '☀️', label: 'Warm', color: '#F59E0B' };
  } else {
    return { icon: '❄️', label: 'Cold', color: '#6B7280' };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

function getQualityIndicators(lead: Lead) {
  return [
    { icon: 'phone', verified: !!lead.contact.phone },
    { icon: 'email', verified: !!lead.contact.email },
    { icon: 'attach-money', verified: lead.project.budgetMin > 0 },
    { icon: 'location-on', verified: !!lead.location.city },
  ];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  mainContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leadInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  companyName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  temperatureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  temperatureText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectInfo: {
    flex: 1,
  },
  trade: {
    fontSize: 14,
    fontWeight: '500',
    color: '#43cea2',
    marginBottom: 2,
  },
  budget: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metaInfo: {
    alignItems: 'flex-end',
  },
  location: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  timeline: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualityIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityIndicator: {
    padding: 4,
  },
  timeAgo: {
    fontSize: 11,
    color: '#6B7280',
  },
  actionsRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
    },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 3,
    minHeight: 32,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  disabledText: {
    color: '#6B7280',
  },
});
