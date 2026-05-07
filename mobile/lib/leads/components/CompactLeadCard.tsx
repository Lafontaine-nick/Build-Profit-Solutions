/**
 * Compact Lead Card Component
 * Clean, data-rich but focused design for better readability
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lead } from '../types';
import { buildBidPayloadFromLead } from '../leadToEstimateBid';
import { trackLeadResponse, trackLeadView } from '../../../services/engagementTracking';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

interface CompactLeadCardProps {
  lead: Lead;
  onPress: () => void;
  onAddNote: (lead: Lead) => void;
  onSetReminder: (lead: Lead) => void;
  onStageChange?: (lead: Lead, newStage: string) => void;
}

export default function CompactLeadCard({
  lead,
  onPress,
  onAddNote,
  onSetReminder,
  onStageChange,
}: CompactLeadCardProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const lightText = !darkMode ? Colors.text : undefined;
  const lightSub = !darkMode ? Colors.sub : undefined;
  
  // Check if this is a campaign lead (CAMPAIGN- prefix) vs sub request (PRJ- prefix or other PROJECT_BASED)
  const hasCampaignProjectId = !!lead.projectId?.startsWith?.('CAMPAIGN-');
  const isOwnProjectBased = lead.source === 'PROJECT_BASED' && (lead.isOwnRequest === true || lead.createdBy === 'contractor-demo');
  const isCampaignLead = hasCampaignProjectId; // Only campaign leads have CAMPAIGN- prefix
  const isSubRequest = isOwnProjectBased && !hasCampaignProjectId; // Sub requests are PROJECT_BASED but NOT campaigns
  /** Own posted requests are not a sales pipeline — hide stage UI. */
  const hideSalesPipeline = lead.isOwnRequest === true;
  
  // Essential calculations
  const leadValue = Math.round((lead.project.budgetMin + lead.project.budgetMax) / 2);
  const timeAgo = getTimeAgo(lead.createdAt);
  
  // Temperature calculation - different for campaign vs sub request
  let temperature;
  if (isCampaignLead) {
    temperature = { icon: '🎯', label: 'Campaign', color: '#19E180' };
  } else if (isSubRequest) {
    temperature = { icon: '🔧', label: 'Sub Request', color: '#22c55e' };
  } else {
    temperature = getTemperature(lead);
  }
  
  // Quality indicators (simplified)
  const qualityIndicators = getQualityIndicators(lead);

  const handleCall = async () => {
    if (lead.contact.phone) {
      Linking.openURL(`tel:${lead.contact.phone}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track engagement
      await trackLeadResponse(lead.id, 'call', lead.createdAt);
    } else {
      Alert.alert('No Phone', 'This lead does not have a phone number');
    }
  };

  const handleEmail = async () => {
    if (lead.contact.email) {
      Linking.openURL(`mailto:${lead.contact.email}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track engagement
      await trackLeadResponse(lead.id, 'email', lead.createdAt);
    } else {
      Alert.alert('No Email', 'This lead does not have an email address');
    }
  };
  
  // Track view when lead card is pressed
  React.useEffect(() => {
    trackLeadView(lead.id);
  }, [lead.id]);

  const handleExpand = () => {
    onPress();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleOpenBidBuilder = async () => {
    if (!lead) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Track that bid builder has been started for this lead
      const { trackBidStarted } = await import('../../../services/engagementTracking');
      await trackBidStarted(lead.id);
      
      const bidData = buildBidPayloadFromLead(lead);
      
      // Clear materials and rentals from AsyncStorage before saving new bid
      await AsyncStorage.setItem('bps.materialsCart', JSON.stringify([]));
      await AsyncStorage.setItem('bps.rentalCart', JSON.stringify([]));
      
      // Save bid data to AsyncStorage (estimate generator will load this)
      await AsyncStorage.setItem('bps.currentBid.v2', JSON.stringify(bidData));
      
      console.log('🚀 Navigating to bid builder for lead:', lead.id);
      console.log('🚀 Router object:', router);
      console.log('🚀 Router.push available:', typeof router.push);
      console.log('🚀 Router.replace available:', typeof router.replace);
      
      // Navigate immediately - don't wait for anything
      // Use a small timeout to ensure it happens after the current event loop
      setTimeout(() => {
        console.log('🚀 Attempting navigation NOW...');
        try {
          if (router.replace) {
            console.log('🚀 Using router.replace...');
            router.replace('/(tabs)/estimate-generator');
          } else if (router.push) {
            console.log('🚀 Using router.push...');
            router.push('/(tabs)/estimate-generator');
          } else {
            console.error('❌ Router methods not available!');
            Alert.alert('Navigation Error', 'Router not available. Please try navigating manually.');
          }
          console.log('✅ Navigation command executed');
        } catch (error) {
          console.error('❌ Navigation error:', error);
          Alert.alert('Navigation Error', 'Could not open bid builder. Please try navigating manually.');
        }
      }, 0);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error opening bid builder:', error);
      Alert.alert('Error', 'Failed to open bid builder. Please try again.');
    }
  };

  const cardSurfaceStyle = {
    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
    borderColor: darkMode ? Colors.line : Colors.line,
    borderWidth: darkMode ? 1 : 1,
    borderRadius: 16,
    padding: 0,
  };

  return (
    <TouchableOpacity 
      style={[
        styles.card,
        cardSurfaceStyle,
        isCampaignLead && styles.campaignCard,
        isSubRequest && styles.subRequestCard
      ]} 
      onPress={onPress}
    >
      {/* Campaign Badge */}
      {isCampaignLead && (
        <View style={styles.campaignBadge}>
          <MaterialIcons name="campaign" size={12} color="#19E180" />
          <Text style={styles.campaignBadgeText}>MY CAMPAIGN</Text>
        </View>
      )}
      
      {/* Sub Request Badge */}
      {isSubRequest && (
        <View style={styles.subRequestBadge}>
          <MaterialIcons name="construction" size={12} color="#4ade80" />
          <Text style={styles.subRequestBadgeText}>SUB REQUEST</Text>
        </View>
      )}
      
      {/* Main Card Content */}
      <TouchableOpacity
        onPress={handleExpand}
        style={[styles.mainContent, !darkMode && { backgroundColor: Colors.surface2 }]}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.leadInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isCampaignLead && (
                <MaterialIcons name="campaign" size={14} color="#19E180" />
              )}
              {isSubRequest && (
                <MaterialIcons name="construction" size={14} color="#4ade80" />
              )}
              <Text
                style={[
                  styles.contactName,
                  isCampaignLead && styles.campaignContactName,
                  isSubRequest && styles.subRequestContactName,
                  lightText && { color: lightText },
                ]}
                numberOfLines={1}
              >
                {lead.contact.name || 'New Lead'}
              </Text>
            </View>
            {lead.contact.company && !isCampaignLead && !isSubRequest && (
              <Text
                style={[styles.companyName, lightSub && { color: lightSub }]}
                numberOfLines={1}
              >
                {lead.contact.company}
              </Text>
            )}
            {isCampaignLead && (
              <Text style={styles.campaignSubtext} numberOfLines={1}>
                Active Campaign Lead
              </Text>
            )}
            {isSubRequest && (
              <Text style={styles.subRequestSubtext} numberOfLines={1}>
                Looking for Subcontractors
              </Text>
            )}
          </View>
          
          <View style={styles.badges}>
            {/* Only show urgency badge for Urgent and Soon, not Normal */}
            {lead.project.timeline === 'Urgent' && (
              <View style={[styles.urgencyBadge, styles.urgencyBadgeUrgent]}>
                <Text style={styles.urgencyBadgeText}>🔥 Urgent</Text>
              </View>
            )}
            {lead.project.timeline === 'Soon' && (
              <View style={[styles.urgencyBadge, styles.urgencyBadgeSoon]}>
                <Text style={styles.urgencyBadgeText}>Soon</Text>
              </View>
            )}
            {/* Campaign and Sub Request badges still show */}
            {isCampaignLead && (
              <View style={[styles.temperatureBadge, { backgroundColor: temperature.color }]}>
                <Text style={styles.temperatureText}>
                  {temperature.icon} {temperature.label}
                </Text>
              </View>
            )}
            {isSubRequest && (
              <View style={[styles.temperatureBadge, { backgroundColor: temperature.color }]}>
                <Text style={styles.temperatureText}>
                  {temperature.icon} {temperature.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Project Details Row */}
        <View style={styles.projectRow}>
          <View style={styles.projectInfo}>
            <Text
              style={[
                styles.trade,
                isCampaignLead && styles.campaignTrade,
                isSubRequest && styles.subRequestTrade,
                lightText && { color: lightText },
              ]}
            >
              {lead.trade}
            </Text>
            <Text
              style={[
                styles.budget,
                isCampaignLead && styles.campaignBudget,
                isSubRequest && styles.subRequestBudget,
                lightText && { color: lightText },
              ]}
            >
              ${lead.project.budgetMin.toLocaleString()} - ${lead.project.budgetMax.toLocaleString()}
            </Text>
          </View>
          <View style={styles.metaInfo}>
            <Text style={[styles.location, lightSub && { color: lightSub }]}>
              {lead.location.city}, {lead.location.state}
            </Text>
            <Text style={[styles.timeline, lightSub && { color: lightSub }]}>
              {lead.project.timeline}
            </Text>
            <Text style={[styles.timeAgo, lightSub && { color: lightSub }]}>
              {timeAgo}
            </Text>
          </View>
        </View>

        <View style={styles.rowHairline} />

        {/* Quality Indicators */}
        <View style={styles.qualityRow}>
          <View style={styles.qualityIndicators}>
            {qualityIndicators.map((indicator, index) => (
              <View key={index} style={styles.qualityIndicator}>
                <MaterialIcons 
                  name={indicator.icon as any} 
                  size={12} 
                  color={indicator.verified ? '#5EEAD4' : '#9CA3AF'} 
                />
              </View>
            ))}
          </View>
        </View>

        {/* Stage selector & read-only — hidden for your own posted requests */}
        {!hideSalesPipeline && onStageChange && lead.stage !== 'won' && lead.stage !== 'lost' && (() => {
          const stages = ['new', 'contacted', 'qualified', 'proposal', 'won'];
          // Normalize "quoted" to "qualified" for stage progression
          const normalizedStage = lead.stage === 'quoted' ? 'qualified' : lead.stage;
          const currentIndex = stages.indexOf(normalizedStage);
          const nextStage = stages[currentIndex + 1];
          
          return (
            <View style={styles.stageRow}>
              <Text style={[styles.stageLabel, lightSub && { color: lightSub }]}>
                Stage:
              </Text>
              <TouchableOpacity
                style={[styles.stageBadge, { 
                  backgroundColor: getStageColor(lead.stage) + '22',
                  borderColor: getStageColor(lead.stage)
                }]}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent event bubbling
                  e.preventDefault?.(); // Prevent default if available
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (nextStage) {
                    // If advancing to "proposal", open bid builder instead of just changing stage
                    if (nextStage === 'proposal') {
                      console.log('🎯 Stage badge clicked - opening bid builder (NOT updating stage)');
                      console.log('🎯 Current lead stage:', lead.stage);
                      console.log('🎯 Next stage would be:', nextStage);
                      // Call handleOpenBidBuilder but prevent any stage update
                      handleOpenBidBuilder();
                      // CRITICAL: Don't call onStageChange - navigation should happen instead
                      return; // Exit early to prevent any stage update
                    } else {
                      // For other stages, show confirmation and change stage
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
                    }
                  }
                }}
              >
                <Text style={[styles.stageBadgeText, { color: getStageColor(lead.stage) }]}>
                  {lead.stage === 'quoted' ? 'Qualified' : lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                </Text>
                {nextStage && <MaterialIcons name="arrow-forward" size={14} color={getStageColor(lead.stage)} />}
              </TouchableOpacity>
            </View>
          );
        })()}
        
        {!hideSalesPipeline && (!onStageChange || lead.stage === 'won' || lead.stage === 'lost') && (
          <View style={styles.stageRow}>
            <Text style={[styles.stageLabel, lightSub && { color: lightSub }]}>
              Stage:
            </Text>
            <View style={[styles.stageBadge, { 
              backgroundColor: getStageColor(lead.stage) + '22',
              borderColor: getStageColor(lead.stage)
            }]}>
              <Text style={[styles.stageBadgeText, { color: getStageColor(lead.stage) }]}>
                {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Quick Actions — not shown for your own subcontractor requests */}
      {!lead.isOwnRequest && (
      <View
        style={[
          styles.actionsRow,
          !darkMode && { backgroundColor: Colors.surface2, borderTopColor: Colors.line },
        ]}
      >
        <View style={styles.actionRow}>
          {/* Primary: Call */}
          <TouchableOpacity 
            style={[styles.actionButtonPrimary, !lead.contact.phone && styles.disabledButton]}
            onPress={handleCall}
            disabled={!lead.contact.phone}
          >
            <MaterialIcons name="phone" size={16} color={lead.contact.phone ? '#FFFFFF' : '#9CA3AF'} />
            <Text style={[styles.actionTextPrimary, !lead.contact.phone && styles.disabledText]}>Call</Text>
          </TouchableOpacity>

          {/* Secondary: Email */}
          <TouchableOpacity 
            style={[styles.actionButtonSecondary, !lead.contact.email && styles.disabledButton]}
            onPress={handleEmail}
            disabled={!lead.contact.email}
          >
            <MaterialIcons name="email" size={16} color={lead.contact.email ? '#3B82F6' : '#9CA3AF'} />
            <Text style={[styles.actionTextSecondary, !lead.contact.email && styles.disabledText]}>Email</Text>
          </TouchableOpacity>

          {/* Tertiary: Remind (outline/ghost) */}
          <TouchableOpacity 
            style={[
              styles.actionButtonTertiary,
              !darkMode && { backgroundColor: '#CBD5E1', borderColor: '#94A3B8' },
            ]}
            onPress={() => onSetReminder(lead)}
          >
            <MaterialIcons name="schedule" size={16} color={darkMode ? '#9CA3AF' : Colors.text} />
            <Text
              style={[
                styles.actionTextTertiary,
                !darkMode && { color: Colors.text },
              ]}
            >
              Remind
            </Text>
          </TouchableOpacity>
        </View>

        {/* Advance stage — hidden for your own posted requests */}
        {!hideSalesPipeline && onStageChange && lead.stage !== 'won' && lead.stage !== 'lost' && (() => {
          const stages = ['new', 'contacted', 'qualified', 'proposal', 'won'];
          // Normalize "quoted" to "qualified" for stage progression
          const normalizedStage = lead.stage === 'quoted' ? 'qualified' : lead.stage;
          const currentIndex = stages.indexOf(normalizedStage);
          const nextStage = stages[currentIndex + 1];
          
          // Only show button if there's a next stage
          if (!nextStage) return null;
          
          return (
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.actionButtonAdvance, { 
                  backgroundColor: getStageColor(lead.stage) + '14',
                  borderColor: getStageColor(lead.stage) + 'AA',
                }]}
                onPress={(e) => {
                  e.stopPropagation(); // Prevent event bubbling
                  e.preventDefault?.(); // Prevent default if available
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  
                  // If advancing to "proposal", open bid builder instead of just changing stage
                  if (nextStage === 'proposal') {
                    console.log('🎯 Advance button clicked - opening bid builder (NOT updating stage)');
                    console.log('🎯 Current lead stage:', lead.stage);
                    console.log('🎯 Next stage would be:', nextStage);
                    // Call handleOpenBidBuilder but prevent any stage update
                    handleOpenBidBuilder();
                    // CRITICAL: Don't call onStageChange - navigation should happen instead
                    return; // Exit early to prevent any stage update
                  } else {
                    // For other stages, show confirmation and change stage
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
                  }
                }}
              >
                <MaterialIcons name="arrow-forward" size={16} color={getStageColor(lead.stage)} />
                <Text style={[styles.actionTextAdvance, { color: getStageColor(lead.stage) }]}>
                  Advance to {nextStage ? nextStage.charAt(0).toUpperCase() + nextStage.slice(1) : 'Final'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}
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
  
  // Return the actual timeline label instead of temperature labels
  if (urgency === 'Urgent') {
    return { icon: '🔥', label: 'Urgent', color: '#EF4444' };
  } else if (urgency === 'Soon') {
    return { icon: '☀️', label: 'Soon', color: '#F59E0B' };
  } else if (urgency === 'Normal') {
    return { icon: '❄️', label: 'Normal', color: '#6B7280' };
  } else {
    return { icon: '❄️', label: 'Flexible', color: '#6B7280' };
  }
}

function getQualityIndicators(lead: Lead) {
  return [
    { icon: 'phone', verified: !!lead.contact.phone },
    { icon: 'email', verified: !!lead.contact.email },
    { icon: 'attach-money', verified: lead.project.budgetMin > 0 },
    { icon: 'location-on', verified: !!lead.location.city },
  ];
}

function getStageColor(stage: string): string {
  const colors: { [key: string]: string } = {
    'new': '#6B7280',        // Gray
    'contacted': '#3B82F6',  // Blue
    'qualified': '#8B5CF6',  // Purple
    'quoted': '#8B5CF6',     // Purple (same as qualified)
    'proposal': '#F59E0B',   // Amber
    'won': '#10B981',        // Green
  };
  return colors[stage] || '#6B7280';
}

const styles = StyleSheet.create({
  card: {
    // Base styles - backgroundColor, borderColor, borderWidth, borderRadius, padding are set dynamically
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  campaignCard: {
    borderColor: '#19E180',
    borderWidth: 2,
    // Keep surface2 background from dynamic style
  },
  subRequestCard: {
    borderColor: '#22c55e',
    borderWidth: 2,
    // Keep surface2 background from dynamic style
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#19E18020',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#19E18040',
    gap: 6,
  },
  campaignBadgeText: {
    color: '#19E180',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 197, 94, 0.35)',
    gap: 6,
  },
  subRequestBadgeText: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subRequestContactName: {
    color: '#86efac',
    fontWeight: '600',
  },
  subRequestSubtext: {
    fontSize: 11,
    color: '#a7f3d0',
    marginTop: 2,
  },
  subRequestTrade: {
    color: '#bbf7d0',
    fontWeight: '600',
  },
  subRequestBudget: {
    color: '#86efac',
    fontWeight: '500',
  },
  campaignContactName: {
    color: '#19E180',
    fontWeight: '700',
  },
  campaignSubtext: {
    fontSize: 11,
    color: '#19E180',
    marginTop: 2,
    fontWeight: '500',
  },
  campaignTrade: {
    color: '#19E180',
  },
  campaignBudget: {
    color: '#19E180',
  },
  mainContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
    color: '#A8B4C8',
    marginTop: 2,
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
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  urgencyBadgeUrgent: {
    backgroundColor: '#EF4444',
  },
  urgencyBadgeSoon: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)', // Muted amber
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  urgencyBadgeText: {
    fontSize: 9, // Slightly smaller
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  rowHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
    marginBottom: 10,
  },
  projectInfo: {
    flex: 1,
  },
  trade: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5EEAD4',
    marginBottom: 4,
  },
  budget: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  metaInfo: {
    alignItems: 'flex-end',
    maxWidth: '48%',
  },
  location: {
    fontSize: 12,
    color: '#A8B4C8',
    marginBottom: 3,
    textAlign: 'right',
  },
  timeline: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(168, 180, 200, 0.88)',
    textAlign: 'right',
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
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
    color: 'rgba(148, 163, 184, 0.95)',
    marginTop: 4,
    textAlign: 'right',
  },
  actionsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.09)',
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
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
  // Primary: Call - Solid, prominent
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0D9488',
    gap: 4,
    minHeight: 38,
  },
  // Secondary: Email - Less prominent
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    gap: 4,
    minHeight: 38,
  },
  // Tertiary: Remind - Outline/ghost style
  actionButtonTertiary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    gap: 4,
    minHeight: 38,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  actionTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionTextSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  actionTextTertiary: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  disabledText: {
    color: '#6B7280',
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
    gap: 8,
  },
  stageLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#A8B4C8',
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  stageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonAdvance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  actionTextAdvance: {
    fontSize: 12,
    fontWeight: '600',
  },
});
