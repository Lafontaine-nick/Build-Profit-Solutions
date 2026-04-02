/**
 * Enhanced Leads Page - Complete CRM System
 * Combines analytics, map view, AI scoring, swipe actions, notes, and reminders
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
// // // import MapView, { Marker } from 'react-native-maps'; // Disabled for Expo Go compatibility // Requires development build
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Lead, LeadStage } from '../types';
import {
  hasReachedPipelineStage,
  matchesProposalSentPipelineBucket,
  matchesWonPipelineBucket,
} from '../pipelineStageUtils';
import LeadNotesModal from './LeadNotesModal';
import CampaignCreationModal, { SubcontractorCampaign } from '@/components/CampaignCreationModal';
import { MessagesInbox } from '@/components/MessagesInbox';
import { useChat } from '@/contexts/ChatContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LeadsHeader from './LeadsHeader';
import LeadCardManager, { CardDisplayMode } from './LeadCardManager';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  getTimeAgo,
  calculateUrgencyScore,
  getUrgencyLevel,
  calculateQualityIndicators,
  generateMockEngagement,
  getCompetitivePressure,
  getQualityScore,
  getQualityBadge,
  QUICK_RESPONSE_TEMPLATES,
} from '../utils/phase1Enhancements';
import {
  calculateCustomerLTV,
  getCustomerTierBadge,
  getRepeatPotentialInfo,
  generateEnhancedEngagement,
  getEngagementStatus,
  generateMockPhotos,
  getPhotoTypeInfo,
  formatEngagementTime,
} from '../utils/phase2Enhancements';
import {
  generateMarketPricingData,
  generatePricingRecommendation,
  generateCustomerReviewData,
  generateLeadAnalytics,
  generateNotificationData,
} from '../utils/phase3Enhancements';
import {
  calculateLeadScore,
  getTemperatureColor,
  getTemperatureEmoji,
  getTemperatureLabel,
  LeadScore,
} from '../utils/leadScoring';
import {
  generateCompetitorData,
  getPositionColor,
  getPositionLabel,
  getRecommendedResponseTime,
  CompetitorData,
} from '../utils/competitorIntelligence';
import { LeadAnalyticsDashboard } from './LeadAnalyticsDashboard';

/** Softer gradient frame in light mode so it doesn’t fight the cool gray page. */
const LEADS_SECTION_GRADIENT = {
  dark: ['rgba(45, 255, 196, 0.5)', 'rgba(0, 166, 255, 0.45)'] as const,
  light: ['rgba(34, 197, 94, 0.26)', 'rgba(14, 165, 233, 0.22)'] as const,
};

interface EnhancedLeadsPageProps {
  leads: Lead[];
  onStageChange: (lead: Lead, newStage: LeadStage) => void;
  onLeadPress: (lead: Lead) => void;
  onDeleteLead?: (leadId: string) => void;
  onArchiveLead?: (leadId: string) => void;
  onUnarchiveLead?: (leadId: string) => void;
  onAddNote?: (leadId: string, note: string) => void;
  onSetReminder?: (leadId: string, reminderDate: Date, reminderNote: string) => void;
  onRefreshLeads?: () => void;
  onPreferencesPress?: () => void;
  /** Fired when filtered list size changes so the parent can show “X of Y” under the title. */
  onLeadsViewMeta?: (meta: {
    eligibleInLeadsTab: number;
    /** Count matching current list filters (search, pipeline, etc.). */
    visibleInView: number;
    filtersNarrowed: boolean;
    /** Cards actually rendered before “Show more”. */
    renderedInList: number;
    hasMoreInList: boolean;
  }) => void;
  contractorProfile?: {
    tradeTypes?: string[];
    specificTrades?: string[];
    zipCodes?: string[];
    location?: { city?: string; state?: string; serviceRadius?: number };
    budget?: { min?: number; max?: number };
    preferredTimelines?: ('Urgent' | 'Soon' | 'Normal' | 'Flexible')[];
    filterByTrade?: boolean;
  } | null;
}

// Helper Functions
const calculateLeadValue = (lead: Lead): number => {
  return lead.project.budgetMax || lead.project.budgetMin || 0;
};

// Debounced search hook
const useDebounced = <T,>(val: T, ms = 250): T => {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return v;
};

// Interactive Score Badge Component
interface ScoreBadgeProps {
  score: number;
}

const ScoreBadge = ({ score }: ScoreBadgeProps) => {
  const [open, setOpen] = useState(false);
  const tier = score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low';
  const tone = score >= 80 ? '#1f8f5a' : score >= 60 ? '#3a65a7' : '#a7752e';

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        style={styles.scoreBadge}
      >
        <Text style={[styles.scoreBadgeText, { color: tone }]}>AI Score {score}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOpen(false)}
        >
          <View style={styles.scoreModalContent}>
            <Text style={styles.scoreModalTitle}>
              AI Score: {score} ({tier})
            </Text>
            <Text style={styles.scoreModalDescription}>
              Based on verification, budget fit, urgency, responsiveness, and proximity.
            </Text>
            <Text style={styles.scoreModalSubtitle}>Boost this score:</Text>
            <Text style={styles.scoreModalTip}>• Confirm license & contact info (verification)</Text>
            <Text style={styles.scoreModalTip}>• Tighten budget range with Estimate Check</Text>
            <Text style={styles.scoreModalTip}>• Respond faster to new messages</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.closeButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const scoreLead = (lead: Lead): number => {
  return lead.aiScore || 75;
};

// Helper function to get source label
const getSourceLabel = (source: string): string => {
  const sourceMap: Record<string, string> = {
    'PROJECT_BASED': 'Sub Needs',
    'BID_INVITATION': 'Invites',
    'MARKETPLACE': 'Marketplace',
    'AI_ESTIMATE': 'Auto-Match',
    'SHARED': 'Shared',
  };
  return sourceMap[source] || source;
};

// Helper function to get source pill style
const getSourceStyle = (source: string) => {
  switch(source) {
    case 'PROJECT_BASED':
      return { backgroundColor: '#1E3A8A', borderColor: '#3B82F6' };
    case 'BID_INVITATION':
      return { backgroundColor: '#7C2D12', borderColor: '#F59E0B' };
    case 'MARKETPLACE':
      return { backgroundColor: '#065F46', borderColor: '#10B981' };
    case 'AI_ESTIMATE':
      return { backgroundColor: '#581C87', borderColor: '#A855F7' };
    case 'SHARED':
      return { backgroundColor: '#4C1D95', borderColor: '#8B5CF6' };
    default:
      return { backgroundColor: '#374151', borderColor: '#FFFFFF' };
  }
};

const getPriorityLevel = (lead: Lead): { level: string; color: string; icon: string } => {
  const score = scoreLead(lead);
  const value = calculateLeadValue(lead);
  
  if (score >= 80 && value >= 100000) return { level: 'Hot', color: '#EF4444', icon: 'local-fire-department' };
  if (score >= 70 && value >= 50000) return { level: 'High', color: '#F59E0B', icon: 'star' };
  if (score >= 50) return { level: 'Medium', color: '#3B82F6', icon: 'trending-up' };
  return { level: 'Low', color: '#FFFFFF', icon: 'ac-unit' };
};

const autoDraftFollowUp = (lead: Lead): string => {
  const opener =
    lead.project.timeline === 'Urgent'
      ? 'I can prioritize an on-site walkthrough within the next 48 hours.'
      : 'I have availability for a walkthrough early next week.';

  const firstName = lead.contact.name.split(' ')[0];
  const projectType = lead.project.type.charAt(0).toUpperCase() + lead.project.type.slice(1);
  const budgetLow = lead.project.budgetMin?.toLocaleString() || '0';
  const budgetHigh = lead.project.budgetMax?.toLocaleString() || '0';

  return `Hi ${firstName}, thanks for reaching out about your ${projectType} project in ${lead.location?.city}. Based on your budget range of $${budgetLow}–$${budgetHigh}, we can prepare a detailed estimate. ${opener} Do you prefer morning or afternoon?`;
};

// Analytics Bar Component
const AnalyticsBar = ({ leads }: { leads: Lead[] }) => {
  const totals = useMemo(() => {
    const total = leads.length;
    const verified = leads.filter((l) => l.verification?.emailValid && l.verification?.phoneValid).length;
    const avg = Math.round(
      leads.reduce((acc, l) => acc + calculateLeadValue(l), 0) / Math.max(total, 1)
    );
    const won = leads.filter((l) => l.stage === 'won').length;
    const contacted = leads.filter((l) => l.stage !== 'new').length;
    const conv = total ? Math.round((won / total) * 100) : 0;
    const funnel = total ? Math.round((won / Math.max(contacted, 1)) * 100) : 0;

    return { total, verified, avg, conv, funnel };
  }, [leads]);

  return (
    <View style={styles.analyticsBar}>
      <Text style={styles.analyticsTitle}>Performance (30d)</Text>
      <View style={styles.pillRow}>
        <View style={[styles.pill, styles.pillDefault]}>
          <Text style={styles.pillText}>Total {totals.total}</Text>
        </View>
        <View style={[styles.pill, styles.pillGood]}>
          <Text style={styles.pillText}>Verified {totals.verified}</Text>
        </View>
        <View style={[styles.pill, styles.pillInfo]}>
          <Text style={styles.pillText}>Avg ${totals.avg.toLocaleString()}</Text>
        </View>
        <View style={[styles.pill, styles.pillGood]}>
          <Text style={styles.pillText}>Win {totals.conv}%</Text>
        </View>
        <View style={[styles.pill, styles.pillInfo]}>
          <Text style={styles.pillText}>Close {totals.funnel}%</Text>
        </View>
      </View>
    </View>
  );
};

// Source Analytics Component
interface SourceAnalyticsProps {
  leads: Lead[];
  selectedSource: string | 'all';
  onSourceSelect: (source: string | 'all') => void;
}

const SourceAnalytics = ({ leads, selectedSource, onSourceSelect }: SourceAnalyticsProps) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';

  const sourceCounts = useMemo(() => {
    // For PROJECT_BASED, only count campaign leads and user's own sub requests
    const projectBasedLeads = leads.filter(l => {
      if (l.source !== 'PROJECT_BASED') return false;
      const isCampaignLead = l.projectId?.startsWith?.('CAMPAIGN-');
      const isOwnSubRequest = (l.isOwnRequest === true || l.createdBy === 'contractor-demo') && !isCampaignLead;
      return isCampaignLead || isOwnSubRequest;
    });
    
    const counts = {
      all: leads.length,
      PROJECT_BASED: projectBasedLeads.length,
      BID_INVITATION: leads.filter(l => l.source === 'BID_INVITATION').length,
      MARKETPLACE: leads.filter(l => l.source === 'MARKETPLACE').length,
      AI_ESTIMATE: leads.filter(l => l.source === 'AI_ESTIMATE').length,
      SHARED: leads.filter(l => l.source === 'SHARED').length,
    };
    return counts;
  }, [leads]);

        const sources = [
          { 
            key: 'all', 
            label: 'All', 
            count: sourceCounts.all, 
            description: 'All leads from every source'
          },
          { 
            key: 'PROJECT_BASED', 
            label: 'Sub Needs', 
            count: sourceCounts.PROJECT_BASED, 
            description: 'Subcontractor requests from your projects'
          },
          { 
            key: 'BID_INVITATION', 
            label: 'Invites', 
            count: sourceCounts.BID_INVITATION, 
            description: 'Direct invitations from GCs for specific projects'
          },
          { 
            key: 'AI_ESTIMATE', 
            label: 'Auto-Match', 
            count: sourceCounts.AI_ESTIMATE, 
            description: 'AI-matched leads based on your trade & location'
          },
          { 
            key: 'MARKETPLACE', 
            label: 'Marketplace', 
            count: sourceCounts.MARKETPLACE, 
            description: 'Public project postings from customers'
          },
        ];

  // Show high-value leads insight
  const highValueLeads = useMemo(() => {
    return leads
      .filter(l => {
        const score = l.aiScore ?? 0;
        return score >= 85 && l.project.budgetMax >= 50000;
      })
      .sort((a, b) => {
        const scoreA = a.aiScore ?? 0;
        const scoreB = b.aiScore ?? 0;
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [leads]);

        return (
          <View style={styles.sourceAnalytics}>
            {/* High-Value Insight Banner */}
            {highValueLeads.length > 0 && (
              <View style={[styles.insightBanner, !darkMode && { backgroundColor: '#FEF3C7', borderLeftColor: '#D97706' }]}>
                <MaterialIcons name="stars" size={20} color="#F59E0B" />
                <Text style={[styles.insightText, !darkMode && { color: '#92400E' }]}>
                  🔮 {highValueLeads.length} high-value leads near you this week
                </Text>
              </View>
            )}

            {/* Source Filter Header with Help */}
            <View style={styles.sourceFilterHeader}>
              <Text
                style={[
                  styles.sourceFilterTitle,
                  !darkMode && { color: Colors.text },
                ]}
              >
                Lead Sources
              </Text>
              <TouchableOpacity 
                style={[styles.helpButton, !darkMode && { backgroundColor: Colors.surface }]}
                onPress={() => {
                  Alert.alert(
                    'Lead Source Types',
                    sources.map(s => `${s.label}: ${s.description}`).join('\n\n'),
                    [{ text: 'Got it', style: 'default' }]
                  );
                }}
              >
                <MaterialIcons name="help-outline" size={16} color={darkMode ? "#FFFFFF" : Colors.sub} />
              </TouchableOpacity>
            </View>

            {/* Source Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceFilters}>
              {sources.map((source) => (
                <TouchableOpacity
                  key={source.key}
                  style={[
                    styles.sourceTab,
                    selectedSource === source.key && styles.sourceTabActive,
                    !darkMode &&
                      (selectedSource === source.key
                        ? { borderBottomColor: Colors.primary }
                        : { borderBottomColor: 'transparent' }),
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSourceSelect(source.key);
                  }}
                  onLongPress={() => {
                    // Show individual description
                    Alert.alert(source.label, source.description, [
                      { text: 'Got it', style: 'default' }
                    ]);
                  }}
                >
                  <Text
                    style={[
                      styles.sourceTabLabel,
                      selectedSource === source.key && styles.sourceTabLabelActive,
                      !darkMode && {
                        color: selectedSource === source.key ? Colors.text : Colors.sub,
                        fontWeight: selectedSource === source.key ? '700' : '600',
                      },
                    ]}
                  >
                    {source.label}
                  </Text>
                  <View
                    style={[
                      styles.sourceBadge,
                      selectedSource === source.key && styles.sourceBadgeActive,
                      !darkMode && {
                        backgroundColor: selectedSource === source.key ? Colors.iconBg : Colors.surface2,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourceBadgeText,
                        selectedSource === source.key && styles.sourceBadgeTextActive,
                        !darkMode && { color: Colors.text },
                      ]}
                    >
                      {source.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

      {/* Source Analytics Summary — dark keeps accent chips; light uses calmer surfaces */}
      <View style={styles.sourceStatsChipsContainer}>
        <View style={styles.sourceStatsChipRow}>
          <View
            style={[
              styles.sourceStatsChip,
              darkMode
                ? { backgroundColor: '#581C8720', borderColor: '#A855F7' }
                : { backgroundColor: Colors.surface2, borderColor: Colors.line },
            ]}
          >
            <Text
              style={[
                styles.sourceStatsChipText,
                { color: darkMode ? '#A855F7' : Colors.text },
              ]}
            >
              Auto-Match {sourceCounts.AI_ESTIMATE}
            </Text>
          </View>
          <View
            style={[
              styles.sourceStatsChip,
              darkMode
                ? { backgroundColor: '#19E18020', borderColor: '#19E180' }
                : { backgroundColor: Colors.surface2, borderColor: Colors.line },
            ]}
          >
            <Text
              style={[
                styles.sourceStatsChipText,
                { color: darkMode ? '#19E180' : Colors.text },
              ]}
            >
              Sub Needs {sourceCounts.PROJECT_BASED}
            </Text>
          </View>
        </View>
        <View style={styles.sourceStatsChipRow}>
          <View
            style={[
              styles.sourceStatsChip,
              darkMode
                ? { backgroundColor: '#7C2D1220', borderColor: '#F59E0B' }
                : { backgroundColor: Colors.surface2, borderColor: Colors.line },
            ]}
          >
            <Text
              style={[
                styles.sourceStatsChipText,
                { color: darkMode ? '#F59E0B' : Colors.text },
              ]}
            >
              Invites {sourceCounts.BID_INVITATION}
            </Text>
          </View>
          <View
            style={[
              styles.sourceStatsChip,
              darkMode
                ? { backgroundColor: '#1E3A8A20', borderColor: '#3B82F6' }
                : { backgroundColor: Colors.surface2, borderColor: Colors.line },
            ]}
          >
            <Text
              style={[
                styles.sourceStatsChipText,
                { color: darkMode ? '#3B82F6' : Colors.text },
              ]}
            >
              Marketplace {sourceCounts.MARKETPLACE}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// Map Insights Component (Collapsible with Quick Actions)
const InsightsMap = ({ leads, isExpanded, onToggle }: { 
  leads: Lead[], 
  isExpanded: boolean, 
  onToggle: () => void 
}) => {
  if (leads.length === 0) return null;

  const locations = leads.filter(l => l.location?.lat && l.location?.lng);
  const urgentLeads = leads.filter(l => l.project.timeline === 'Urgent');

  const openInMaps = (lead: Lead) => {
    if (lead.location?.lat && lead.location?.lng) {
      const url = Platform.OS === 'ios' 
        ? `maps://?q=${lead.location.lat},${lead.location.lng}`
        : `geo:${lead.location.lat},${lead.location.lng}?q=${lead.location.lat},${lead.location.lng}`;
      Linking.openURL(url);
    }
  };

  return (
    <View style={styles.mapContainer}>
      {/* Map Toggle Header */}
      <TouchableOpacity 
        style={styles.mapToggleHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.mapToggleLeft}>
          <MaterialIcons name="map" size={20} color="#3B82F6" />
          <Text style={styles.mapToggleText}>Lead Locations</Text>
          <View style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>{locations.length}</Text>
          </View>
        </View>
        <MaterialIcons 
          name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
          size={24} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>

      {/* Expanded Map Content */}
      {isExpanded && (
        <View style={styles.mapContent}>
      <View style={styles.mapPlaceholder}>
        <MaterialIcons name="map" size={48} color="#3B82F6" />
        <Text style={styles.mapPlaceholderText}>Interactive Map View</Text>
        <Text style={styles.mapPlaceholderSubtext}>
          Available in development build
        </Text>
          </View>
        
          {/* Simplified Stats */}
        <View style={styles.mapStats}>
          <View style={styles.statItem}>
              <MaterialIcons name="location-on" size={16} color="#10B981" />
            <Text style={styles.statText}>{locations.length} locations</Text>
          </View>
            {urgentLeads.length > 0 && (
          <View style={styles.statItem}>
                <MaterialIcons name="priority-high" size={16} color="#F59E0B" />
            <Text style={styles.statText}>{urgentLeads.length} urgent leads</Text>
          </View>
            )}
          </View>

          {/* Quick Actions for Top Leads */}
          {locations.slice(0, 3).map((lead) => (
            <TouchableOpacity
              key={lead.id}
              style={styles.quickActionItem}
              onPress={() => openInMaps(lead)}
            >
              <View style={styles.quickActionLeft}>
                <MaterialIcons name="location-on" size={16} color="#3B82F6" />
                <Text style={styles.quickActionText}>
                  {lead.contact.name} - {lead.location.city}
                </Text>
        </View>
              <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ))}
      </View>
      )}
    </View>
  );
};

// Helper function to get stage color
function getStageColor(stage: string): string {
  const colors: { [key: string]: string } = {
    'new': '#FFFFFF',        // Gray
    'contacted': '#3B82F6',  // Blue
    'qualified': '#8B5CF6',  // Purple
    'quoted': '#8B5CF6',     // Purple (same as qualified)
    'proposal': '#F59E0B',   // Amber
    'won': '#10B981',        // Green
  };
  return colors[stage] || '#FFFFFF';
}

// Enhanced Lead Card with Delete Button
interface EnhancedLeadCardProps {
  lead: Lead;
  onPress: () => void;
  onDelete: () => void;
  onAddNote?: (note: string) => void;
  onSetReminder?: (reminderDate: Date, reminderNote?: string) => void;
  onOpenNotes?: (lead: Lead) => void;
  onStageChange?: (lead: Lead, newStage: LeadStage) => void;
}

const EnhancedLeadCard = ({
  lead,
  onPress,
  onDelete,
  onAddNote,
  onSetReminder,
  onOpenNotes,
  onStageChange,
}: EnhancedLeadCardProps) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showQuickResponses, setShowQuickResponses] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  // Reset states when lead changes
  useEffect(() => {
    setShowQuickResponses(false);
    setShowPhotos(false);
    setIsExpanded(false);
  }, [lead.id]);


  const score = scoreLead(lead);
  const priority = getPriorityLevel(lead);
  const leadValue = calculateLeadValue(lead);
  const scoreTone = score >= 80 ? styles.pillGood : score >= 60 ? styles.pillInfo : styles.pillWarn;
  
  // Phase 1 Enhancements
  const timeAgo = getTimeAgo(lead.createdAt);
  const urgencyScore = calculateUrgencyScore(lead.createdAt);
  const urgencyInfo = getUrgencyLevel(urgencyScore);
  const qualityIndicators = calculateQualityIndicators(lead);
  const qualityScore = getQualityScore(qualityIndicators);
  const qualityBadge = getQualityBadge(qualityScore);
  const engagement = generateMockEngagement(lead);
  const competitivePressure = getCompetitivePressure(engagement);
  
  // Phase 2 Enhancements
  const ltvData = calculateCustomerLTV(lead);
  const tierBadge = getCustomerTierBadge(ltvData.customerTier);
  const repeatPotential = getRepeatPotentialInfo(ltvData.repeatCustomerPotential);
  const enhancedEngagement = generateEnhancedEngagement(lead);
  const engagementStatus = getEngagementStatus(enhancedEngagement);
  const photos = generateMockPhotos(lead);

  // Phase 3 Enhancements - Market Pricing (async)
  const [marketPricing, setMarketPricing] = useState<any>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);
  const [dataSource, setDataSource] = useState<'bls_api' | 'mock'>('mock');
  
  useEffect(() => {
    let isMounted = true;
    
    const loadMarketPricing = async () => {
      try {
        setIsLoadingPricing(true);
        console.log(`📊 Loading market pricing for lead ${lead.id}...`);
        const pricing = await generateMarketPricingData(lead);
        if (isMounted) {
          setMarketPricing(pricing);
          // Detect if we're using real BLS data or fallback
          setDataSource(pricing.laborCosts.hourly > 20 && pricing.laborCosts.hourly < 50 ? 'bls_api' : 'mock');
          console.log(`✅ Market pricing loaded for lead ${lead.id}`);
        }
      } catch (error) {
        console.error(`❌ Error loading market pricing for lead ${lead.id}:`, error);
      } finally {
        if (isMounted) {
          setIsLoadingPricing(false);
        }
      }
    };
    
    loadMarketPricing();
    
    return () => {
      isMounted = false;
    };
  }, [lead.id]);
  
  const pricingRecommendation = marketPricing ? generatePricingRecommendation(lead, marketPricing) : null;
  const customerReviews = generateCustomerReviewData(lead);
  const notifications = generateNotificationData(lead);
  
  // NEW: Lead Scoring & Competitor Intelligence
  const competitorData = generateCompetitorData(lead);
  const leadScore = calculateLeadScore(lead, marketPricing, competitorData);
  
  // Check if this is a campaign lead (CAMPAIGN- prefix) vs sub request (PRJ- prefix or other PROJECT_BASED)
  const hasCampaignProjectId = !!lead.projectId?.startsWith?.('CAMPAIGN-');
  const isOwnProjectBased = lead.source === 'PROJECT_BASED' && (lead.isOwnRequest === true || lead.createdBy === 'contractor-demo');
  // Also check title for campaign indicator as fallback
  const titleHasCampaign = lead.title?.toLowerCase().includes('campaign') || false;
  const isCampaignLead = hasCampaignProjectId; // Only campaign leads have CAMPAIGN- prefix
  const isSubRequest = isOwnProjectBased && !hasCampaignProjectId; // Sub requests are PROJECT_BASED but NOT campaigns
  const isAIMatched = lead.source === 'AI_ESTIMATE'; // AI Matched leads
  
  // Base style for lead card background/border - match project cards exactly
  const leadCardBaseStyle = {
    /* Light: white tiles on the tinted list panel for clearer hierarchy */
    backgroundColor: darkMode ? Colors.surface2 : Colors.card,
    borderColor: Colors.line,
    borderWidth: darkMode ? 1 : 1,
    borderRadius: 14,
    padding: 12,
  };
  
  // Debug logging for campaign leads - ALWAYS log PROJECT_BASED leads
  if (lead.source === 'PROJECT_BASED') {
    console.log(`🎯 Campaign Lead Detection:`, {
      id: lead.id,
      title: lead.title?.substring(0, 30),
      projectId: lead.projectId,
      source: lead.source,
      isOwnRequest: lead.isOwnRequest,
      createdBy: lead.createdBy,
      hasCampaignProjectId,
      isOwnProjectBased,
      isCampaignLead,
      contactName: lead.contact?.name,
    });
  }

  return (
    <>
      <View style={[
        styles.leadCard,
        leadCardBaseStyle,
        isCampaignLead && styles.campaignLeadCard, // Add purple border for campaign leads
        isSubRequest && styles.subRequestLeadCard, // Add orange border for sub requests
        isAIMatched && styles.aiMatchedLeadCard // Add blue border for AI Matched leads
      ]}>
        {/* Campaign Badge - Purple */}
        {isCampaignLead ? (
          <View style={styles.campaignBadge}>
            <MaterialIcons name="campaign" size={14} color="#19E180" />
            <Text style={styles.campaignBadgeText}>My Campaign</Text>
          </View>
        ) : null}
        
        {/* AI Matched Badge - Blue */}
        {isAIMatched ? (
          <View style={styles.aiMatchedBadge}>
            <MaterialIcons name="psychology" size={14} color="#3B82F6" />
            <Text style={styles.aiMatchedBadgeText}>AI Matched</Text>
          </View>
        ) : null}
        
        {/* Your Request Badge - Orange */}
        {isSubRequest ? (
          <View style={styles.subRequestBadge}>
            <MaterialIcons name="construction" size={14} color="#F59E0B" />
            <Text style={styles.subRequestBadgeText}>Your Request</Text>
            {lead.matchedContractors !== undefined && lead.matchedContractors > 0 && (
              <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="people" size={12} color="#22c55e" />
                <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                  {lead.matchedContractors} matched
                </Text>
              </View>
            )}
          </View>
        ) : null}
        
        {/* Collapsible Header - Always Visible */}
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsExpanded(!isExpanded);
          }}
          style={[
            styles.cardHeader,
            isCampaignLead && styles.campaignCardHeader // Purple tint for campaign header
          ]}
        >
          <View style={styles.leadInfo}>
            <View style={styles.titleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Text style={[
                styles.leadTitle,
                isCampaignLead && styles.campaignLeadTitle // Purple text for campaign title
              ]} numberOfLines={1}>{lead.title}</Text>
                <View style={[
                  styles.temperatureBadge, 
                  isCampaignLead 
                    ? { backgroundColor: '#19E180', borderColor: '#19E180' }
                    : isSubRequest
                    ? { backgroundColor: '#F59E0B', borderColor: '#D97706' }
                    : { backgroundColor: getTemperatureColor(leadScore.temperature) }
                ]}>
                  <Text style={styles.temperatureBadgeText}>
                    {isCampaignLead ? '🎯 Campaign' : isSubRequest ? '🔧 Sub Request' : `${getTemperatureEmoji(leadScore.temperature)} ${getTemperatureLabel(leadScore.temperature)}`}
                  </Text>
                </View>
              </View>
                <MaterialIcons 
                name={isExpanded ? "expand-less" : "expand-more"} 
                size={24} 
                color={isCampaignLead ? "#19E180" : isSubRequest ? "#F59E0B" : (darkMode ? "#FFFFFF" : Colors.text)} 
              />
            </View>
            <View style={styles.compactMetaRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isCampaignLead ? (
                  <>
                    <MaterialIcons name="campaign" size={14} color="#19E180" />
                    <Text style={[styles.leadName, { color: '#19E180', marginLeft: 4 }]}>Active Campaign</Text>
                  </>
                ) : (
                  <Text style={[styles.leadName, !darkMode && { color: Colors.text }]}>{lead.contact.name}</Text>
                )}
              </View>
              <Text style={[styles.compactDivider, !darkMode && { color: Colors.sub }]}>•</Text>
              <Text style={[styles.leadValue, !darkMode && { color: "#16a34a" }]}>${leadValue.toLocaleString()}</Text>
              <Text style={[styles.compactDivider, !darkMode && { color: Colors.sub }]}>•</Text>
              <Text style={[styles.leadScore, { color: isCampaignLead ? '#19E180' : getTemperatureColor(leadScore.temperature) }]}>
                {isCampaignLead ? 'Posted' : `Score: ${leadScore.overall}`}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Compact View - Essential Info Only */}
        {!isExpanded && (
          <View style={styles.compactView}>
            {/* Phase 1: Urgency + Quality in one line */}
            <View style={styles.compactBadgeRow}>
              <View style={[styles.compactBadge, { backgroundColor: urgencyInfo.color + '22', borderColor: urgencyInfo.color }]}>
                <Text style={[styles.compactBadgeText, { color: urgencyInfo.color }]}>
                  {urgencyInfo.label.split(' ')[0]} • {timeAgo}
                </Text>
              </View>
              <View style={[styles.compactBadge, { backgroundColor: qualityBadge.color + '22', borderColor: qualityBadge.color }]}>
                <Text style={[styles.compactBadgeText, { color: qualityBadge.color }]}>
                  {qualityBadge.emoji} {qualityBadge.label.split(' ')[0]}
                </Text>
              </View>
            </View>

            {/* Phase 1: Competitive Intelligence - Compact */}
            <View style={[styles.compactCompetitive, { backgroundColor: competitivePressure.color + '15' }]}>
              <Text style={[styles.compactCompetitiveText, { color: competitivePressure.color }]}>
                {competitivePressure.message.split('•')[0]}
              </Text>
            </View>

            {/* Your Request - Matched Contractors (Compact View) */}
            {isSubRequest && lead.matchedContractors !== undefined && lead.matchedContractors > 0 && (
              <View style={[styles.compactCompetitive, { backgroundColor: '#22c55e15', borderWidth: 1, borderColor: '#22c55e40' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="people" size={14} color="#22c55e" />
                  <Text style={[styles.compactCompetitiveText, { color: '#22c55e', marginLeft: 6 }]}>
                    {lead.matchedContractors} contractor{lead.matchedContractors !== 1 ? 's' : ''} matched
                  </Text>
                </View>
              </View>
            )}


            {/* Quick Actions */}
            <View style={styles.compactActions}>
              <TouchableOpacity
                style={[styles.compactActionBtn, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line, borderWidth: 1 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (!lead.contact.phone) return Alert.alert('No phone on file');
                  const url = Platform.select({
                    ios: `tel://${lead.contact.phone}`,
                    android: `tel:${lead.contact.phone}`,
                  });
                  Linking.openURL(url!);
                }}
              >
                <MaterialIcons name="phone" size={18} color="#10B981" />
                <Text style={[styles.compactActionText, !darkMode && { color: Colors.text }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.compactActionBtn, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line, borderWidth: 1 }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowQuickResponses(!showQuickResponses);
                  setIsExpanded(true);
                }}
              >
                <MaterialIcons name="flash-on" size={18} color="#FFD700" />
                <Text style={[styles.compactActionText, { color: '#FFD700' }]}>Quick Reply</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.compactActionBtn, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line, borderWidth: 1 }]}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsExpanded(true);
                }}
              >
                <Text style={[styles.compactActionText, !darkMode && { color: Colors.text }]}>View Details</Text>
                <MaterialIcons name="arrow-forward" size={16} color={darkMode ? "#FFFFFF" : Colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Expanded View - All Details */}
        {isExpanded && (
          <View style={styles.expandedView}>
            {/* Simplified Project Details */}
            <View style={styles.projectRow}>
              <Text style={[styles.projectType, !darkMode && { color: "#16a34a" }]}>{lead.trade}</Text>
              <Text style={[styles.leadValue, !darkMode && { color: "#16a34a" }]}>
                ${leadValue.toLocaleString()}
              </Text>
            </View>

            {/* Phase 1: Response Time & Urgency */}
            <View style={styles.phase1UrgencyRow}>
              <View style={[styles.urgencyBadge, { backgroundColor: urgencyInfo.color + '22', borderColor: urgencyInfo.color }]}>
                <Text style={[styles.urgencyText, { color: urgencyInfo.color }]}>
                  {urgencyInfo.label} • {timeAgo}
                </Text>
              </View>
            </View>

            {/* Phase 1: Quality Indicators */}
            <View style={styles.phase1QualityRow}>
              <View style={[styles.qualityBadge, { backgroundColor: qualityBadge.color + '22', borderColor: qualityBadge.color }]}>
                <Text style={[styles.qualityBadgeText, { color: qualityBadge.color }]}>
                  {qualityBadge.emoji} {qualityBadge.label}
                </Text>
              </View>
              <View style={styles.qualityIndicators}>
                {qualityIndicators.phoneVerified && (
                  <MaterialIcons name="phone" size={14} color="#34C759" />
                )}
                {qualityIndicators.emailVerified && (
                  <MaterialIcons name="email" size={14} color="#34C759" />
                )}
                {qualityIndicators.budgetConfirmed && (
                  <MaterialIcons name="attach-money" size={14} color="#34C759" />
                )}
                {qualityIndicators.photosAttached && (
                  <MaterialIcons name="photo" size={14} color="#34C759" />
                )}
                {qualityIndicators.locationVerified && (
                  <MaterialIcons name="location-on" size={14} color="#34C759" />
                )}
              </View>
            </View>

            {/* Phase 1: Competitive Intelligence */}
            <View style={[styles.phase1CompetitiveRow, { backgroundColor: competitivePressure.color + '15' }]}>
              <Text style={[styles.competitiveText, { color: competitivePressure.color }]}>
                {competitivePressure.message}
              </Text>
            </View>

            {/* Your Request - Matched Contractors Display */}
            {isSubRequest && lead.matchedContractors !== undefined && (
              <View style={[styles.phase1CompetitiveRow, { backgroundColor: '#22c55e15', borderWidth: 1, borderColor: '#22c55e40', borderRadius: 8, padding: 12 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialIcons name="people" size={18} color="#22c55e" />
                  <Text style={{ color: '#22c55e', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
                    {lead.matchedContractors} Contractor{lead.matchedContractors !== 1 ? 's' : ''} Matched
                  </Text>
                </View>
                <Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 4 }}>
                  Qualified contractors have been notified and can respond to your request. Check back for responses.
                </Text>
              </View>
            )}

            {/* Phase 2: Customer Lifetime Value */}
            {ltvData.customerTier !== 'new' && (
              <View style={styles.phase2LTVRow}>
                <View style={[styles.ltvBadge, { backgroundColor: tierBadge.color + '22', borderColor: tierBadge.color }]}>
                  <Text style={styles.ltvEmoji}>{tierBadge.emoji}</Text>
                  <View style={styles.ltvContent}>
                    <Text style={[styles.ltvLabel, { color: tierBadge.color }]}>{tierBadge.label}</Text>
                    <Text style={[styles.ltvDescription, !darkMode && { color: Colors.sub }]}>{tierBadge.description}</Text>
                  </View>
                </View>
                {ltvData.propertyCount > 1 && (
                  <View style={styles.ltvIndicators}>
                    <MaterialIcons name="business" size={14} color="#34C759" />
                    <Text style={styles.ltvIndicatorText}>{ltvData.propertyCount} properties</Text>
                  </View>
                )}
              </View>
            )}

            {/* Phase 2: Repeat Potential */}
            {ltvData.repeatCustomerPotential !== 'low' && (
              <View style={[styles.phase2RepeatRow, { backgroundColor: repeatPotential.color + '15' }]}>
                <Text style={[styles.repeatText, { color: repeatPotential.color }]}>
                  💫 {repeatPotential.message}
                </Text>
              </View>
            )}

            {/* Phase 2: Engagement Tracking */}
            <View style={[styles.phase2EngagementRow, { backgroundColor: engagementStatus.color + '15' }]}>
              <View style={styles.engagementLeft}>
                <Text style={[styles.engagementLabel, { color: engagementStatus.color }]}>
                  {engagementStatus.label}
                </Text>
                <Text style={[styles.engagementMessage, !darkMode && { color: Colors.sub }]}>{engagementStatus.message}</Text>
              </View>
              {enhancedEngagement.estimateOpened && (
                <View style={styles.engagementBadge}>
                  <MaterialIcons name="visibility" size={14} color="#34C759" />
                  <Text style={styles.engagementBadgeText}>Opened</Text>
                </View>
              )}
            </View>

            {/* Phase 2: Photo Gallery Preview */}
            {photos.length > 0 && (
              <TouchableOpacity 
                style={styles.phase2PhotoRow}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPhotos(!showPhotos);
                }}
              >
                <View style={styles.photoHeader}>
                  <MaterialIcons name="photo-library" size={18} color="#3B82F6" />
                  <Text style={styles.photoHeaderText}>{photos.length} Project Photo{photos.length > 1 ? 's' : ''}</Text>
                  <MaterialIcons name={showPhotos ? "expand-less" : "expand-more"} size={18} color="#FFFFFF" />
                </View>
                {showPhotos && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.photoGallery}
                  >
                    {photos.map((photo) => {
                      const photoTypeInfo = getPhotoTypeInfo(photo.type);
                      return (
                        <View key={photo.id} style={styles.photoContainer}>
                          <View style={styles.photoPlaceholder}>
                            <MaterialIcons name="image" size={40} color="#FFFFFF" />
                          </View>
                          <View style={styles.photoTypeTag}>
                            <Text style={styles.photoTypeEmoji}>{photoTypeInfo.icon}</Text>
                            <Text style={styles.photoTypeText}>{photoTypeInfo.label}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </TouchableOpacity>
            )}

            {/* Phase 3: Smart Pricing Intelligence */}
            {isLoadingPricing ? (
              <View style={styles.phase3PricingRow}>
                <View style={styles.pricingHeader}>
                  <MaterialIcons name="trending-up" size={18} color="#10B981" />
                  <Text style={styles.pricingHeaderText}>Loading Market Pricing...</Text>
                </View>
              </View>
            ) : marketPricing && pricingRecommendation ? (
            <View style={styles.phase3PricingRow}>
              <View style={styles.pricingHeader}>
                <MaterialIcons name="trending-up" size={18} color="#10B981" />
                <Text style={styles.pricingHeaderText}>Market Pricing</Text>
                  {dataSource === 'bls_api' && (
                    <View style={[styles.pricingBadge, { backgroundColor: '#3B82F6', marginRight: 6 }]}>
                      <MaterialIcons name="verified" size={10} color="#FFFFFF" />
                      <Text style={[styles.pricingBadgeText, { marginLeft: 2 }]}>BLS DATA</Text>
                    </View>
                  )}
                <View style={[styles.pricingBadge, { backgroundColor: pricingRecommendation.confidence === 'high' ? '#10B981' : pricingRecommendation.confidence === 'medium' ? '#F59E0B' : '#EF4444' }]}>
                  <Text style={styles.pricingBadgeText}>{pricingRecommendation.confidence.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.pricingContent}>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Market Average:</Text>
                  <Text style={styles.pricingValue}>${marketPricing.averagePrice.toLocaleString()}</Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Your Range:</Text>
                  <Text style={styles.pricingValue}>${pricingRecommendation.suggestedPrice.min.toLocaleString()} - ${pricingRecommendation.suggestedPrice.max.toLocaleString()}</Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Optimal Price:</Text>
                  <Text style={[styles.pricingValue, { color: '#10B981', fontWeight: '700' }]}>${pricingRecommendation.suggestedPrice.optimal.toLocaleString()}</Text>
                </View>
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Profit Margin:</Text>
                    <Text style={[styles.pricingValue, { 
                      color: pricingRecommendation.profitMargin > 15 ? '#10B981' : // 15%+ = Excellent (Green)
                             pricingRecommendation.profitMargin > 8 ? '#F59E0B' :   // 8-15% = Good (Yellow)
                             '#EF4444'                                                // <8% = Low (Red)
                    }]}>
                    {pricingRecommendation.profitMargin}%
                  </Text>
                </View>
                <Text style={styles.pricingReasoning}>{pricingRecommendation.competitiveAdvantage}</Text>
              </View>
              </View>
            ) : null}

            {/* NEW: Competitor Intelligence */}
            <View style={styles.competitorIntelligenceCard}>
              <View style={styles.competitorHeader}>
                <MaterialIcons name="people" size={20} color="#8B5CF6" />
                <Text style={styles.competitorHeaderText}>Competitor Intelligence</Text>
                <View style={[
                  styles.positionBadge,
                  { backgroundColor: getPositionColor(competitorData.yourPosition) }
                ]}>
                  <Text style={styles.positionBadgeText}>
                    {getPositionLabel(competitorData.yourPosition)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.competitorStats}>
                <View style={styles.competitorStatItem}>
                  <MaterialIcons name="visibility" size={18} color="#3B82F6" />
                  <Text style={styles.competitorStatLabel}>Views</Text>
                  <Text style={styles.competitorStatValue}>{competitorData.viewCount}</Text>
                </View>
                <View style={styles.competitorStatItem}>
                  <MaterialIcons name="reply" size={18} color="#10B981" />
                  <Text style={styles.competitorStatLabel}>Responses</Text>
                  <Text style={styles.competitorStatValue}>{competitorData.responseCount}</Text>
                </View>
                <View style={styles.competitorStatItem}>
                  <MaterialIcons name="schedule" size={18} color="#F59E0B" />
                  <Text style={styles.competitorStatLabel}>Avg Time</Text>
                  <Text style={styles.competitorStatValue}>{competitorData.avgResponseTime}h</Text>
                </View>
                {competitorData.yourResponseTime && (
                  <View style={styles.competitorStatItem}>
                    <MaterialIcons name="timer" size={18} color={getPositionColor(competitorData.yourPosition)} />
                    <Text style={styles.competitorStatLabel}>Your Time</Text>
                    <Text style={[
                      styles.competitorStatValue,
                      { color: getPositionColor(competitorData.yourPosition) }
                    ]}>
                      {competitorData.yourResponseTime}h
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.competitorAdvantage}>
                <Text style={styles.competitorAdvantageText}>
                  {competitorData.competitiveAdvantage}
                </Text>
              </View>
              
              {competitorData.insights.length > 0 && (
                <View style={styles.competitorInsights}>
                  {competitorData.insights.map((insight, index) => (
                    <View key={index} style={styles.competitorInsightItem}>
                      <MaterialIcons name="info" size={14} color="#FFFFFF" />
                      <Text style={styles.competitorInsightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {competitorData.yourPosition === 'not_responded' && (
                <View style={styles.recommendedAction}>
                  <MaterialIcons name="flash-on" size={16} color="#EF4444" />
                  <Text style={styles.recommendedActionText}>
                    Respond {getRecommendedResponseTime(competitorData.avgResponseTime)} to beat competitors
                  </Text>
                </View>
              )}
            </View>

            {/* Phase 3: Customer Reviews & Reliability */}
            <View style={styles.phase3ReviewsRow}>
              <View style={styles.reviewsHeader}>
                <MaterialIcons name="star" size={18} color="#F59E0B" />
                <Text style={styles.reviewsHeaderText}>Customer Profile</Text>
                <View style={[styles.reliabilityBadge, { backgroundColor: customerReviews.riskLevel === 'low' ? '#10B981' : customerReviews.riskLevel === 'medium' ? '#F59E0B' : '#EF4444' }]}>
                  <Text style={styles.reliabilityBadgeText}>{customerReviews.riskLevel.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.reviewsContent}>
                <View style={styles.reviewsRow}>
                  <Text style={styles.reviewsLabel}>Rating:</Text>
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingValue}>{customerReviews.overallRating}</Text>
                    <MaterialIcons name="star" size={16} color="#F59E0B" />
                    <Text style={styles.ratingCount}>({customerReviews.reviewCount})</Text>
                  </View>
                </View>
                <View style={styles.reviewsRow}>
                  <Text style={styles.reviewsLabel}>Reliability:</Text>
                  <Text style={[styles.reliabilityScore, { color: customerReviews.reliabilityScore > 80 ? '#10B981' : customerReviews.reliabilityScore > 60 ? '#F59E0B' : '#EF4444' }]}>
                    {customerReviews.reliabilityScore}/100
                  </Text>
                </View>
                <View style={styles.reviewsRow}>
                  <Text style={styles.reviewsLabel}>Payment History:</Text>
                  <Text style={styles.paymentHistory}>{customerReviews.paymentHistory.onTime}% on time</Text>
                </View>
                {customerReviews.verifiedBuyer && (
                  <View style={styles.verifiedBadge}>
                    <MaterialIcons name="verified" size={14} color="#10B981" />
                    <Text style={styles.verifiedText}>Verified Buyer</Text>
                  </View>
                )}
                {customerReviews.repeatCustomer && (
                  <View style={styles.repeatBadge}>
                    <MaterialIcons name="repeat" size={14} color="#3B82F6" />
                    <Text style={styles.repeatCustomerText}>Repeat Customer</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Phase 3: Smart Notifications */}
            {notifications.length > 0 && (
              <View style={styles.phase3NotificationsRow}>
                <View style={styles.notificationsHeader}>
                  <MaterialIcons name="notifications" size={18} color="#8B5CF6" />
                  <Text style={styles.notificationsHeaderText}>Smart Alerts</Text>
                  <View style={styles.notificationCount}>
                    <Text style={styles.notificationCountText}>{notifications.length}</Text>
                  </View>
                </View>
                
                {notifications.slice(0, 2).map((notification, index) => (
                  <View key={index} style={[styles.notificationItem, { borderLeftColor: notification.priority === 'high' ? '#EF4444' : notification.priority === 'medium' ? '#F59E0B' : '#10B981' }]}>
                    <Text style={[styles.notificationTitle, !darkMode && { color: Colors.text }]}>{notification.title}</Text>
                    <Text style={[styles.notificationMessage, !darkMode && { color: Colors.sub }]}>{notification.message}</Text>
                    {notification.actionRequired && (
                      <View style={styles.actionRequiredBadge}>
                        <Text style={styles.actionRequiredText}>Action Required</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Stage Selector - Clickable to change stage */}
            {onStageChange && (
              <View style={styles.stageSelectorRow}>
                <Text style={styles.stageSelectorLabel}>Stage:</Text>
                <TouchableOpacity
                  style={[styles.stageBadge, { 
                    backgroundColor: getStageColor(lead.stage) + '22',
                    borderColor: getStageColor(lead.stage)
                  }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const stages: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];
                    const currentIndex = stages.indexOf(lead.stage);
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
                  }}
                >
                  <Text style={[styles.stageBadgeText, { color: getStageColor(lead.stage) }]}>
                    {lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1)}
                  </Text>
                  <MaterialIcons name="arrow-forward" size={14} color={getStageColor(lead.stage)} />
                </TouchableOpacity>
              </View>
            )}

            {/* Simplified Tags - Only essential ones */}
            <View style={styles.tagRow}>
              <View style={[styles.pill, lead.verified ? styles.pillGood : styles.pillWarn]}>
                <Text style={styles.pillText}>{lead.verified ? 'Verified' : 'Unverified'}</Text>
              </View>
              <View style={[styles.pill, styles.pillDefault]}>
                <Text style={styles.pillText}>{lead.location.city}</Text>
              </View>
            </View>

            {/* AI Lead Intelligence - Fit Score, Close Probability, Suggested Action */}
            {!isCampaignLead && (
              <>
                <View style={styles.aiIntelligenceCard}>
                  <View style={styles.aiIntelligenceHeader}>
                    <MaterialIcons name="psychology" size={18} color="#3B82F6" />
                    <Text style={styles.aiIntelligenceHeaderText}>AI Lead Intelligence</Text>
                  </View>
                  
                  <View style={styles.aiIntelligenceRow}>
                    <View style={styles.aiIntelligenceItem}>
                      <Text style={styles.aiIntelligenceLabel}>Fit Score</Text>
                      <View style={[
                        styles.aiFitBadge,
                        { backgroundColor: leadScore.overall >= 80 ? '#10B98122' : leadScore.overall >= 60 ? '#F59E0B22' : '#EF444422',
                          borderColor: leadScore.overall >= 80 ? '#10B981' : leadScore.overall >= 60 ? '#F59E0B' : '#EF4444' }
                      ]}>
                        <Text style={[
                          styles.aiFitScore,
                          { color: leadScore.overall >= 80 ? '#10B981' : leadScore.overall >= 60 ? '#F59E0B' : '#EF4444' }
                        ]}>
                          {leadScore.overall >= 80 ? '🟢 Strong' : leadScore.overall >= 60 ? '🟡 Moderate' : '🔴 Low'}
                        </Text>
                        <Text style={styles.aiFitValue}>{leadScore.overall}/100</Text>
                      </View>
                    </View>
                    
                    <View style={styles.aiIntelligenceItem}>
                      <Text style={styles.aiIntelligenceLabel}>Close Probability</Text>
                      <View style={styles.aiCloseProbBadge}>
                        <Text style={styles.aiCloseProbValue}>
                          ~{Math.round((leadScore.overall / 100) * 45 + 15)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.aiSuggestedAction}>
                  <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
                  <Text style={styles.aiSuggestedActionText}>
                    {leadScore.overall >= 80 
                      ? `Call within 15 minutes - high fit score`
                      : leadScore.overall >= 60
                      ? `Email first - budget-sensitive lead`
                      : `Wait for photos - verify project details first`}
                  </Text>
                </View>
              </>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line }]}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (!lead.contact.phone) return Alert.alert('No phone on file');
                  const url = Platform.select({
                    ios: `tel://${lead.contact.phone}`,
                    android: `tel:${lead.contact.phone}`,
                  });
                  Linking.openURL(url!);
                  
                  // Track engagement
                  const { trackLeadResponse } = await import('../../../services/engagementTracking');
                  await trackLeadResponse(lead.id, 'call', lead.createdAt);
                  
                  // Automatically mark as "contacted" if still in "new" stage
                  // Note: onStageChange not available in EnhancedLeadCard props
                  // if (lead.stage === 'new' && onStageChange) {
                  //   onStageChange(lead, 'contacted');
                  // }
                }}
              >
                <MaterialIcons name="phone" size={16} color="#10B981" />
                <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line }]}
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  if (!lead.contact.email) return Alert.alert('No email on file');
                  Linking.openURL(`mailto:${lead.contact.email}?subject=${encodeURIComponent(`${lead.project.type} project`)}`);
                  
                  // Track engagement
                  const { trackLeadResponse } = await import('../../../services/engagementTracking');
                  await trackLeadResponse(lead.id, 'email', lead.createdAt);
                  
                  // Automatically mark as "contacted" if still in "new" stage
                  // Note: onStageChange not available in EnhancedLeadCard props
                  // if (lead.stage === 'new' && onStageChange) {
                  //   onStageChange(lead, 'contacted');
                  // }
                }}
              >
                <MaterialIcons name="email" size={16} color="#3B82F6" />
                <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Email</Text>
              </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.actionButton, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line }]}
                  onPress={() => {
                  const draft = autoDraftFollowUp(lead);
                  Alert.alert('Draft Message', draft);
                  }}
                >
                <MaterialIcons name="auto-fix-high" size={16} color="#8B5CF6" />
                <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Draft</Text>
                </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line }]}
                onPress={() => {
                  if (onOpenNotes) {
                    onOpenNotes(lead);
                  }
                }}
              >
                <MaterialIcons name="note" size={16} color="#F59E0B" />
                <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Notes</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, !darkMode && { backgroundColor: Colors.surface, borderColor: Colors.line }]}
                onPress={() => {
                  Alert.prompt(
                    'Set Reminder',
                    'Enter reminder text:',
                    (reminderText) => {
                      if (reminderText) {
                        Alert.prompt(
                          'Set Date & Time',
                          'Enter date and time (MM/DD/YYYY HH:MM):',
                          (dateTime) => {
                            if (dateTime) {
                              const [datePart, timePart] = dateTime.split(' ');
                              const [month, day, year] = datePart.split('/');
                              const [hour, minute] = timePart.split(':');
                              const reminderDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                              
                              if (onSetReminder) {
                                onSetReminder(reminderDate, reminderText);
                                Alert.alert('Reminder Set', `Reminder set for ${reminderDate.toLocaleString()}`);
                              }
                            }
                          }
                        );
                      }
                    }
                  );
                }}
              >
                <MaterialIcons name="alarm" size={16} color="#EF4444" />
                <Text style={[styles.actionText, !darkMode && { color: Colors.text }]}>Remind</Text>
              </TouchableOpacity>
            </View>

            {/* Phase 1: Quick Response Button */}
            <TouchableOpacity
              style={styles.quickResponseButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowQuickResponses(!showQuickResponses);
              }}
            >
              <MaterialIcons name="flash-on" size={18} color="#FFD700" />
              <Text style={styles.quickResponseText}>Quick Response</Text>
              <MaterialIcons name={showQuickResponses ? "expand-less" : "expand-more"} size={18} color="#FFD700" />
            </TouchableOpacity>

            {/* Phase 1: Quick Response Templates */}
            {showQuickResponses && (
              <View style={styles.quickResponseContainer}>
                {QUICK_RESPONSE_TEMPLATES.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={styles.quickResponseTemplate}
                    onPress={async () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      if (template.action === 'call' && lead.contact.phone) {
                        const url = Platform.select({
                          ios: `tel://${lead.contact.phone}`,
                          android: `tel:${lead.contact.phone}`,
                        });
                        Linking.openURL(url!);
                        
                        // Track engagement
                        const { trackLeadResponse } = await import('../../../services/engagementTracking');
                        await trackLeadResponse(lead.id, 'call', lead.createdAt);
                      } else if (template.action === 'message' && lead.contact.email) {
                        Linking.openURL(`mailto:${lead.contact.email}?subject=${encodeURIComponent(lead.title ?? 'Lead Inquiry')}&body=${encodeURIComponent(template.message)}`);
                        
                        // Track engagement
                        const { trackLeadResponse } = await import('../../../services/engagementTracking');
                        await trackLeadResponse(lead.id, 'email', lead.createdAt);
                      } else {
                        Alert.alert(template.title, template.message, [
                          { text: 'Copy', onPress: () => Alert.alert('Copied', 'Message copied to clipboard') },
                          { text: 'Cancel', style: 'cancel' }
                        ]);
                      }
                    }}
                  >
                    <Text style={styles.quickResponseIcon}>{template.icon}</Text>
                    <View style={styles.quickResponseContent}>
                      <Text style={[styles.quickResponseTitle, !darkMode && { color: Colors.text }]}>{template.title}</Text>
                      <Text style={[styles.quickResponseMessage, !darkMode && { color: Colors.sub }]}>{template.message}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={16} color={darkMode ? "#FFFFFF" : Colors.sub} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Delete Button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  'Delete Lead',
                  'Are you sure you want to delete this lead?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive',
                      onPress: onDelete
                    }
                  ]
                );
              }}
            >
              <MaterialIcons name="delete" size={16} color="#FF6B6B" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Note Modal */}
      <Modal
        visible={showNoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Quick Note</Text>
              <TouchableOpacity onPress={() => setShowNoteModal(false)}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="Type your note here..."
              placeholderTextColor="#FFFFFF"
              multiline
              value={noteText}
              onChangeText={setNoteText}
              autoFocus
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                if (noteText.trim() && onAddNote) {
                  onAddNote(noteText);
                  setNoteText('');
                  setShowNoteModal(false);
                } else {
                  Alert.alert('Empty Note', 'Please enter some text for the note.');
                }
              }}
            >
              <MaterialIcons name="save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reminder Modal */}
      <Modal
        visible={showReminderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Follow-up Reminder</Text>
              <TouchableOpacity onPress={() => setShowReminderModal(false)}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.reminderLabel}>Choose when to follow up:</Text>
            
            <View style={styles.reminderOptions}>
              {[
                { label: 'In 2 Hours', hours: 2, icon: 'schedule' },
                { label: 'Tomorrow', days: 1, icon: 'today' },
                { label: 'In 3 Days', days: 3, icon: 'event' },
                { label: 'In 1 Week', days: 7, icon: 'date-range' },
              ].map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.reminderOption}
                  onPress={() => {
                    if (onSetReminder) {
                      const date = new Date();
                      if (option.hours) {
                        date.setHours(date.getHours() + option.hours);
                      } else if (option.days) {
                        date.setDate(date.getDate() + option.days);
                      }
                      onSetReminder(date, reminderNote || undefined);
                      setReminderNote('');
                      setShowReminderModal(false);
                    }
                  }}
                >
                  <MaterialIcons name={option.icon as any} size={24} color="#3B82F6" />
                  <Text style={styles.reminderOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reminderNoteInput}
              placeholder="Optional reminder note..."
              placeholderTextColor="#FFFFFF"
              value={reminderNote}
              onChangeText={setReminderNote}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

/** First batch of lead cards; “Show more” appends without leaving the page (mobile-friendly vs numbered pages). */
const LEADS_LIST_INITIAL_BATCH = 12;
const LEADS_LIST_LOAD_MORE_STEP = 12;

// Main Component
export default function EnhancedLeadsPage({
  leads,
  onStageChange,
  onLeadPress,
  onDeleteLead,
  onArchiveLead,
  onUnarchiveLead,
  onAddNote,
  onSetReminder,
  onRefreshLeads,
  onPreferencesPress,
  onLeadsViewMeta,
  contractorProfile,
}: EnhancedLeadsPageProps) {
  // Tab Navigation
  const [activeViewTab, setActiveViewTab] = useState<'leads' | 'analytics' | 'insights'>('leads');
  
  // Helper function to get next stage
  const getNextStage = (currentStage: LeadStage): LeadStage => {
    const stages: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];
    // Normalize "quoted" to "qualified" for stage progression
    const normalizedStage = currentStage === 'quoted' ? 'qualified' : currentStage;
    const currentIndex = stages.indexOf(normalizedStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : currentStage;
  };
  
  const [query, setQuery] = useState('');
  const [pipeline, setPipeline] = useState<LeadStage | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string | 'all'>('all');
  const [projectTypeFilter, setProjectTypeFilter] = useState<string | 'all'>('all');
  const [sortBy, setSortBy] = useState<'smart' | 'value' | 'date'>('smart');
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  
  // New enhanced filtering states
  const [budgetFilter, setBudgetFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'Urgent' | 'Soon' | 'Normal'>('all');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]); // Tokenized trade selector
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // Collapsed by default
  const [showTradeSelector, setShowTradeSelector] = useState(false); // Bottom sheet for trade selection
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Non-campaign, non-archived (unless showArchived) — scope of the main Leads list before pipeline/search filters
  const eligibleInLeadsTab = useMemo(() => {
    const visibleLeads = showArchived ? leads : leads.filter((lead) => !lead.archived);
    return visibleLeads.filter((lead) => !lead.projectId?.startsWith('CAMPAIGN-')).length;
  }, [leads, showArchived]);

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showEditCampaignModal, setShowEditCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<SubcontractorCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<SubcontractorCampaign[]>([]);
  const [currentCampaignIndex, setCurrentCampaignIndex] = useState(0);
  const [campaignScrollX, setCampaignScrollX] = useState(new Animated.Value(0));
  const [showMessagesInbox, setShowMessagesInbox] = useState(false);
  const [campaignTimePeriod, setCampaignTimePeriod] = useState<'month' | 'alltime'>('month');
  
  // Get chat context for unread count
  const { conversations } = useChat();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  
  // Filter conversations for INBOX (all messages TO you - campaign responses + direct messages)
  // This includes any conversation where you're the subcontractor (receiving messages)
  const inboxConversations = useMemo(() => {
    return conversations.filter(conv => conv.userRole === 'subcontractor');
  }, [conversations]);
  
  // Calculate total unread count for inbox messages
  const totalUnreadCount = useMemo(() => {
    return inboxConversations.reduce((total, conv) => total + conv.unreadCount, 0);
  }, [inboxConversations]);

  // Debounced search
  const debouncedQuery = useDebounced(query, 250);

  // Engagement flags (bid submitted / won) — keeps Leads pipeline filter aligned with Pipeline Health analytics
  const [pipelineEngagementByLeadId, setPipelineEngagementByLeadId] = useState<
    Record<string, { bidSubmittedAt?: string; bidWonAt?: string }>
  >({});

  const leadsStageSignature = useMemo(
    () => leads.map((l) => `${l.id}:${l.stage}`).join('|'),
    [leads]
  );

  const refreshPipelineEngagement = useCallback(async () => {
    try {
      const { getAllEngagementData } = await import('../../../services/engagementTracking');
      const data = await getAllEngagementData(true);
      setPipelineEngagementByLeadId(data && typeof data === 'object' ? (data as Record<string, { bidSubmittedAt?: string; bidWonAt?: string }>) : {});
    } catch (e) {
      console.warn('⚠️ Could not load engagement for pipeline filter:', e);
    }
  }, []);

  useEffect(() => {
    refreshPipelineEngagement();
  }, [refreshPipelineEngagement, leadsStageSignature]);

  // Debug function to check all storage keys
  const debugStorage = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('🔍 ALL AsyncStorage keys:', allKeys);
      const campaignKeys = allKeys.filter(k => k.toLowerCase().includes('campaign'));
      console.log('🔍 Campaign-related keys:', campaignKeys);
      for (const key of campaignKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`🔍 Key "${key}":`, value ? `${value.substring(0, 200)}...` : 'null');
      }
    } catch (error) {
      console.error('❌ Error debugging storage:', error);
    }
  };

  // Load campaigns from storage - using useCallback to avoid stale closures
  const loadCampaigns = useCallback(async () => {
    try {
      console.log('🔍 loadCampaigns: Starting to load from AsyncStorage...');
      // Debug all storage first
      await debugStorage();
      
      const storedCampaigns = await AsyncStorage.getItem('subcontractorCampaigns');
      console.log('🔍 loadCampaigns: Raw data from storage:', storedCampaigns ? `${storedCampaigns.substring(0, 200)}...` : 'null');
      if (storedCampaigns) {
        const parsedCampaigns = JSON.parse(storedCampaigns);
        console.log(`📋 loadCampaigns: Parsed ${parsedCampaigns.length} campaigns:`, parsedCampaigns.map((c: any) => ({ id: c.id, companyName: c.companyName, createdAt: c.createdAt })));
        if (!Array.isArray(parsedCampaigns)) {
          console.error('❌ Parsed campaigns is not an array!', typeof parsedCampaigns, parsedCampaigns);
          setCampaigns([]);
          return;
        }
        setCampaigns(parsedCampaigns);
        console.log(`✅ loadCampaigns: Set campaigns state to ${parsedCampaigns.length} campaigns`);
      } else {
        console.log('📋 loadCampaigns: No campaigns found in storage (key: subcontractorCampaigns)');
        setCampaigns([]);
      }
    } catch (error) {
      console.error('❌ loadCampaigns: Error loading campaigns:', error);
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Reload campaigns when insights tab becomes active
  useEffect(() => {
    if (activeViewTab === 'insights') {
      console.log('🔄 Insights tab active, reloading campaigns...');
      loadCampaigns();
    }
  }, [activeViewTab, loadCampaigns]);

  // Save campaigns to storage
  const saveCampaigns = async (newCampaigns: SubcontractorCampaign[]) => {
    try {
      console.log('💾 saveCampaigns called with', newCampaigns.length, 'campaigns');
      const jsonString = JSON.stringify(newCampaigns);
      await AsyncStorage.setItem('subcontractorCampaigns', jsonString);
      console.log('💾 Campaigns saved to AsyncStorage successfully');
      setCampaigns(newCampaigns);
      console.log('💾 Campaigns state updated to', newCampaigns.length, 'campaigns');
    } catch (error) {
      console.error('❌ Error saving campaigns:', error);
      throw error; // Re-throw so caller knows it failed
    }
  };

  // Calculate campaign performance metrics
  const calculateCampaignMetrics = useCallback((campaignId: string) => {
    const campaignLeads = leads.filter(l => l.projectId?.startsWith(`CAMPAIGN-${campaignId}`));
    const totalLeads = campaignLeads.length;
    const bookedJobs = campaignLeads.filter(l => l.stage === 'won').length;
    const winRate = totalLeads > 0 ? (bookedJobs / totalLeads) * 100 : 0;
    
    // Estimate spend: $15-20 per lead (average $17.50)
    const estimatedSpend = totalLeads * 17.5;
    
    // Calculate revenue from won leads
    const revenue = campaignLeads
      .filter(l => l.stage === 'won')
      .reduce((sum, lead) => {
        const min = lead.project?.budgetMin || 0;
        const max = lead.project?.budgetMax || 0;
        const avgBudget = min > 0 && max > 0 ? (min + max) / 2 : (min || max || 0);
        return sum + avgBudget;
      }, 0);
    
    const costPerLead = totalLeads > 0 ? estimatedSpend / totalLeads : 0;
    const roi = estimatedSpend > 0 ? ((revenue - estimatedSpend) / estimatedSpend) * 100 : 0;
    
    return {
      totalLeads,
      bookedJobs,
      winRate,
      estimatedSpend,
      revenue,
      costPerLead,
      roi,
    };
  }, [leads]);

  // Calculate aggregate performance across all campaigns
  const aggregateCampaignMetrics = useMemo(() => {
    let totalSpend = 0;
    let totalLeads = 0;
    let totalBooked = 0;
    let totalRevenue = 0;
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    campaigns.forEach(campaign => {
      const metrics = calculateCampaignMetrics(campaign.id);
      
      // Filter by time period if needed
      if (campaignTimePeriod === 'month') {
        const campaignDate = campaign.createdAt ? new Date(campaign.createdAt) : now;
        if (campaignDate < monthStart) {
          // Only count leads/revenue from this month for existing campaigns
          // For simplicity, we'll use all metrics but this could be refined
          return;
        }
      }
      
      totalSpend += metrics.estimatedSpend;
      totalLeads += metrics.totalLeads;
      totalBooked += metrics.bookedJobs;
      totalRevenue += metrics.revenue;
    });
    
    const winRate = totalLeads > 0 ? (totalBooked / totalLeads) * 100 : 0;
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    
    return {
      leads: totalLeads,
      booked: totalBooked,
      revenue: totalRevenue,
      roi,
      winRate,
      spend: totalSpend, // Keep for internal use
    };
  }, [campaigns, calculateCampaignMetrics, campaignTimePeriod]);
  
  // Calculate marketplace reach for a campaign (estimated population in service areas)
  const calculateMarketplaceReach = useCallback((campaign: SubcontractorCampaign) => {
    if (!campaign.serviceAreas || campaign.serviceAreas.length === 0) return 0;
    
    let totalReach = 0;
    campaign.serviceAreas.forEach(area => {
      // Estimate: π * r² (area in square miles) * population density
      // Average US population density: ~94 people per square mile
      // For major cities (like Las Vegas), it's higher: ~2000-3000 per square mile
      // Using a conservative estimate of 1000 per square mile for urban areas
      const radius = area.radius || 25;
      const areaSquareMiles = Math.PI * radius * radius;
      const estimatedPopulation = areaSquareMiles * 1000;
      totalReach += estimatedPopulation;
    });
    
    return Math.round(totalReach);
  }, []);
  
  // Get AI Routing status for a campaign
  const getAIRoutingStatus = useCallback((campaign: SubcontractorCampaign, metrics: ReturnType<typeof calculateCampaignMetrics>) => {
    if (metrics.totalLeads === 0) {
      return { status: 'Optimizing', color: '#60A5FA', message: 'Matching you with the best-fit buyers' };
    }
    if (metrics.totalLeads < 5) {
      return { status: 'Optimizing', color: '#60A5FA', message: 'Matching you with the best-fit buyers' };
    }
    if (metrics.winRate > 30) {
      return { status: 'Optimized', color: '#19E180', message: 'Matching you with the best-fit buyers' };
    }
    if (metrics.winRate < 15) {
      return { status: 'Optimizing', color: '#60A5FA', message: 'Matching you with the best-fit buyers' };
    }
    return { status: 'Optimizing', color: '#60A5FA', message: 'Matching you with the best-fit buyers' };
  }, []);
  
  // Calculate additional campaign metrics (Response Time, Quotes Sent, Avg Job Size)
  const calculateAdditionalMetrics = useCallback((campaignId: string) => {
    const campaignLeads = leads.filter(l => l.projectId?.startsWith(`CAMPAIGN-${campaignId}`));
    const quotesSent = campaignLeads.filter(l => l.stage === 'proposal' || l.stage === 'proposal-sent' || l.stage === 'quoted').length;
    
    // Calculate average job size from won leads
    const wonLeads = campaignLeads.filter(l => l.stage === 'won');
    const avgJobSize = wonLeads.length > 0
      ? wonLeads.reduce((sum, lead) => {
          const min = lead.project?.budgetMin || 0;
          const max = lead.project?.budgetMax || 0;
          const avgBudget = min > 0 && max > 0 ? (min + max) / 2 : (min || max || 0);
          return sum + avgBudget;
        }, 0) / wonLeads.length
      : 0;
    
    // Estimate response time (placeholder - shows typical response time)
    // In a real implementation, this would calculate from engagement data
    const responseTime = '< 4 hours'; // Default to fast response for contractor network
    
    return {
      responseTime,
      quotesSent,
      avgJobSize,
    };
  }, [leads]);

  // Bulk action functions
  const toggleBulkMode = () => {
    setBulkActionMode(!bulkActionMode);
    if (bulkActionMode) {
      setSelectedLeads(new Set());
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectAllLeads = (leadsToSelect: Lead[]) => {
    const allLeadIds = new Set(leadsToSelect.map(lead => lead.id));
    setSelectedLeads(allLeadIds);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearSelection = () => {
    setSelectedLeads(new Set());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBulkArchive = () => {
    if (selectedLeads.size === 0) {
      Alert.alert('No Leads Selected', 'Please select at least one lead to archive.');
      return;
    }

    Alert.alert(
      'Archive Leads',
      `Are you sure you want to archive ${selectedLeads.size} lead(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            selectedLeads.forEach(leadId => {
              onArchiveLead?.(leadId);
            });
            setSelectedLeads(new Set());
            setBulkActionMode(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleBulkStageChange = (newStage: LeadStage) => {
    if (selectedLeads.size === 0) {
      Alert.alert('No Leads Selected', 'Please select at least one lead.');
      return;
    }

    const selectedLeadObjects = filteredAndSortedLeads.filter(lead => selectedLeads.has(lead.id));
    selectedLeadObjects.forEach(lead => {
      onStageChange(lead, newStage);
    });
    setSelectedLeads(new Set());
    setBulkActionMode(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', `Updated ${selectedLeadObjects.length} lead(s) to ${newStage} stage.`);
  };

  const handleBulkUnarchive = () => {
    if (selectedLeads.size === 0) {
      Alert.alert('No Leads Selected', 'Please select at least one lead to unarchive.');
      return;
    }

    selectedLeads.forEach(leadId => {
      onUnarchiveLead?.(leadId);
    });
    setSelectedLeads(new Set());
    setBulkActionMode(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Enhanced filtering with new filters
  const filteredAndSortedLeads = useMemo(() => {
    console.log('🔍 Filtering leads:', {
      totalLeads: leads.length,
      pipeline,
      sourceFilter,
      projectTypeFilter,
      budgetFilter,
      timelineFilter,
      selectedTrades,
      query: debouncedQuery,
      sortBy,
      showArchived
    });
    
    // FIRST: Filter archived leads (unless showArchived is true)
    const visibleLeads = showArchived 
      ? leads 
      : leads.filter(lead => !lead.archived);
    
    // SECOND: Filter out campaign leads - they should NOT appear in the Leads tab
    // Campaign leads should only appear in the Campaigns tab (insights tab)
    const regularLeads = visibleLeads.filter(lead => {
      // Campaign leads have projectId starting with 'CAMPAIGN-'
      const hasCampaignProjectId = lead.projectId?.startsWith('CAMPAIGN-');
      const isCampaignLead = hasCampaignProjectId;
      
      if (isCampaignLead) {
        console.log(`🚫 Campaign lead filtered out from Leads tab: "${lead.title}" (projectId: "${lead.projectId}") - should only appear in Campaigns tab`);
        return false; // Exclude campaign leads from Leads tab
      }
      
      // Debug logging for sub request leads
      if (lead.isOwnRequest === true || lead.source === 'PROJECT_BASED') {
        const isOwnSubRequest = lead.source === 'PROJECT_BASED' && 
                               (lead.isOwnRequest === true || lead.createdBy === 'contractor-demo') &&
                               !hasCampaignProjectId;
        if (isOwnSubRequest) {
          console.log(`✅ Sub request lead (will show in Leads tab): "${lead.title}" (projectId: "${lead.projectId || 'none'}", isOwnRequest: ${lead.isOwnRequest}, source: "${lead.source}")`);
        }
      }
      
      return true; // Include all non-campaign leads
    });
    
    console.log(`📊 Filtered leads: ${regularLeads.length} regular leads (campaign leads excluded - they only show in Campaigns tab)`);
    
    // Apply filters to regular leads
    // Filter by pipeline stage
    const byPipeline = pipeline === 'all'
      ? regularLeads
      : regularLeads.filter((l) => {
          const eng = pipelineEngagementByLeadId[l.id];
          // Matches LeadAnalyticsDashboard / Pipeline Health (see pipelineStageUtils)
          if (pipeline === 'new') {
            return l.stage === 'new';
          }
          if (pipeline === 'contacted') {
            return hasReachedPipelineStage(l, 'contacted');
          }
          if (pipeline === 'qualified') {
            return hasReachedPipelineStage(l, 'qualified');
          }
          if (pipeline === 'proposal' || pipeline === 'proposal-sent') {
            return matchesProposalSentPipelineBucket(l, eng);
          }
          if (pipeline === 'won') {
            return matchesWonPipelineBucket(l, eng);
          }
          if (pipeline === 'lost') {
            return l.stage === 'lost';
          }
          return l.stage === pipeline;
        });
    
    // Filter by source
    const bySource = sourceFilter === 'all' 
      ? byPipeline 
      : sourceFilter === 'PROJECT_BASED'
      ? byPipeline.filter((l) => {
          // For "Sub Needs", only show sub request leads (user's own PROJECT_BASED leads)
          // Campaign leads are already separated above
          const isOwnSubRequest = l.source === 'PROJECT_BASED' && 
                                  (l.isOwnRequest === true || l.createdBy === 'contractor-demo');
          return isOwnSubRequest;
        })
      : byPipeline.filter((l) => l.source === sourceFilter);

    // Filter by budget range
    const byBudget = budgetFilter === 'all' 
      ? bySource 
      : bySource.filter((l) => {
          const avgBudget = (l.project.budgetMin + l.project.budgetMax) / 2;
          switch (budgetFilter) {
            case 'low': return avgBudget < 25000;
            case 'medium': return avgBudget >= 25000 && avgBudget < 75000;
            case 'high': return avgBudget >= 75000;
            default: return true;
          }
        });

    // Filter by timeline
    const byTimeline = timelineFilter === 'all'
      ? byBudget
      : byBudget.filter((l) => l.project.timeline === timelineFilter);

    // Filter by trade (tokenized selector - multi-select)
    const byTrade = selectedTrades.length === 0
      ? byTimeline
      : byTimeline.filter((l) => selectedTrades.some(trade => l.trade.toLowerCase().includes(trade.toLowerCase())));
    
    // Filter by project type
    const byProjectType = projectTypeFilter === 'all'
      ? byTrade
      : byTrade.filter((l) => {
          const projectType = l.project.type?.toLowerCase() || '';
          const title = l.title?.toLowerCase() || '';
          const description = l.description?.toLowerCase() || '';
          const searchText = `${projectType} ${title} ${description}`;
          
          switch (projectTypeFilter) {
            case 'kitchen_remodel':
              return projectType === 'kitchen' || searchText.includes('kitchen');
            case 'bathroom_remodel':
              return projectType === 'bathroom' || searchText.includes('bathroom');
            case 'new_build':
              return projectType === 'new_build' || projectType === 'new-build' || searchText.includes('new build') || searchText.includes('construction');
            default:
              return true;
          }
        });
    
    // Filter by search query (using debounced value)
    const byQuery = byProjectType.filter((l) =>
      `${l.title} ${l.contact.name} ${l.contact.company ?? ''} ${l.trade} ${l.location.city}`.toLowerCase().includes(debouncedQuery.toLowerCase())
    );

    console.log('🔍 After all filters (regular leads):', byQuery.length);

    // Sort (campaign leads are already excluded, so no need to sort them separately)
    const arr = [...byQuery];
    if (sortBy === 'smart') {
      arr.sort((a, b) => {
        return scoreLead(b) - scoreLead(a);
      });
    } else if (sortBy === 'value') {
      arr.sort((a, b) => {
        return calculateLeadValue(b) - calculateLeadValue(a);
      });
    } else if (sortBy === 'date') {
      arr.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    console.log('🔍 Final filtered leads:', arr.length);
    return arr;
  }, [
    leads,
    pipeline,
    pipelineEngagementByLeadId,
    sourceFilter,
    projectTypeFilter,
    budgetFilter,
    timelineFilter,
    selectedTrades,
    sortBy,
    debouncedQuery,
    showArchived,
  ]);

  const filteredLeadsSignature = useMemo(
    () => filteredAndSortedLeads.map((l) => l.id).join('\0'),
    [filteredAndSortedLeads]
  );

  const [leadsListLimit, setLeadsListLimit] = useState(LEADS_LIST_INITIAL_BATCH);

  useEffect(() => {
    setLeadsListLimit(LEADS_LIST_INITIAL_BATCH);
  }, [filteredLeadsSignature]);

  const displayedLeads = useMemo(
    () => filteredAndSortedLeads.slice(0, leadsListLimit),
    [filteredAndSortedLeads, leadsListLimit]
  );

  const hasMoreInList = displayedLeads.length < filteredAndSortedLeads.length;

  useEffect(() => {
    if (!onLeadsViewMeta) return;
    onLeadsViewMeta({
      eligibleInLeadsTab,
      visibleInView: filteredAndSortedLeads.length,
      filtersNarrowed:
        eligibleInLeadsTab > 0 && filteredAndSortedLeads.length < eligibleInLeadsTab,
      renderedInList: displayedLeads.length,
      hasMoreInList,
    });
  }, [
    eligibleInLeadsTab,
    filteredAndSortedLeads.length,
    displayedLeads.length,
    hasMoreInList,
    onLeadsViewMeta,
  ]);

  const handleStageChange = (lead: Lead) => {
    const stageOrder: LeadStage[] = ['new', 'contacted', 'qualified', 'proposal', 'won'];
    const currentIndex = stageOrder.indexOf(lead.stage);
    const nextStage = stageOrder[currentIndex + 1];
    
    if (nextStage) {
      onStageChange(lead, nextStage);
    }
  };

  // Empty state component
  const EmptyState = () => {
    const hasLeads = leads.length > 0;
    const hasFilters =
      query !== '' ||
      sourceFilter !== 'all' ||
      projectTypeFilter !== 'all' ||
      pipeline !== 'all' ||
      budgetFilter !== 'all' ||
      timelineFilter !== 'all' ||
      selectedTrades.length > 0;
    
    return (
    <View style={styles.emptyState}>
      <MaterialIcons name="search-off" size={48} color={darkMode ? '#FFFFFF' : Colors.sub} />
        <Text style={[styles.emptyStateText, !darkMode && { color: Colors.text }]}>
          {hasLeads && hasFilters 
            ? "No leads match your filters." 
            : "No leads available."}
        </Text>
        
        {hasLeads && hasFilters && (
      <TouchableOpacity
        onPress={() => {
          setQuery('');
          setSourceFilter('all');
          setProjectTypeFilter('all');
          setPipeline('all');
          setBudgetFilter('all');
          setTimelineFilter('all');
          setSelectedTrades([]);
          setSortBy('smart');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={[styles.clearFiltersButton, !darkMode && { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line }]}
      >
        <MaterialIcons name="clear" size={16} color="#3B82F6" />
        <Text style={styles.clearFiltersText}>Clear filters</Text>
      </TouchableOpacity>
        )}
        
        {!hasLeads && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onRefreshLeads) {
                onRefreshLeads();
              } else {
                console.log('No refresh function available');
              }
            }}
            style={[styles.backButton, !darkMode && { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line }]}
          >
            <MaterialIcons name="arrow-back" size={16} color="#3B82F6" />
            <Text style={styles.backButtonText}>Refresh Leads</Text>
          </TouchableOpacity>
        )}
    </View>
  );
  };

  // Header component for FlatList - Simplified but with Lead Sources
  const ListHeader = () => (
    <>
      {/* Lead Sources Section */}
      <View style={styles.wideContainer}>
        <LinearGradient
          colors={darkMode ? [...LEADS_SECTION_GRADIENT.dark] : [...LEADS_SECTION_GRADIENT.light]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.gradientBorder}
        >
          <View style={[styles.sectionCard, !darkMode && { backgroundColor: Colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, !darkMode && { color: Colors.text }]}>
              Lead Sources
            </Text>
            <Text style={[styles.sectionSubtitle, !darkMode && { color: Colors.sub }]}>Filter by lead origin and source type</Text>
          </View>
          <View style={styles.sectionContent}>
            <SourceAnalytics 
              leads={leads} 
              selectedSource={sourceFilter} 
              onSourceSelect={setSourceFilter} 
            />
          </View>
        </View>
        </LinearGradient>
      </View>

      {/* Search & Filters Section */}
      <View style={styles.searchSectionContainer}>
        {/* Search - Enhanced with integrated filter icon */}
        <View style={[
          styles.searchContainer,
          {
            backgroundColor: Colors.surface2,
            borderColor: Colors.line,
            borderWidth: 1,
            borderRadius: 14,
          }
        ]}>
          <MaterialIcons name="search" size={20} color={darkMode ? "#FFFFFF" : Colors.sub} />
          <TextInput
            style={[styles.searchInput, !darkMode && { color: Colors.text }]}
            placeholder="Search leads..."
            placeholderTextColor={darkMode ? "rgba(255, 255, 255, 0.6)" : Colors.sub}
            value={query}
            onChangeText={setQuery}
          />
          {query !== '' && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialIcons name="close" size={20} color={darkMode ? "#FFFFFF" : Colors.sub} />
            </TouchableOpacity>
          )}
          {(pipeline !== 'all' ||
            query !== '' ||
            sourceFilter !== 'all' ||
            projectTypeFilter !== 'all' ||
            budgetFilter !== 'all' ||
            timelineFilter !== 'all' ||
            selectedTrades.length > 0) && (
            <TouchableOpacity 
              onPress={() => {
                setQuery('');
                setSourceFilter('all');
                setProjectTypeFilter('all');
                setPipeline('all');
                setBudgetFilter('all');
                setTimelineFilter('all');
                setSelectedTrades([]);
                setSortBy('smart');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons name="clear" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => {
              setShowAdvancedFilters(!showAdvancedFilters);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <MaterialIcons 
              name="tune" 
              size={20} 
              color={(budgetFilter !== 'all' || timelineFilter !== 'all' || selectedTrades.length > 0) ? "#43cea2" : showAdvancedFilters ? "#43cea2" : (darkMode ? "#FFFFFF" : Colors.sub)} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk Actions Bar */}
      {bulkActionMode && (
        <View style={styles.bulkActionsBar}>
          <View style={styles.bulkActionsHeader}>
            <TouchableOpacity
              style={styles.bulkActionButton}
              onPress={() => {
                if (selectedLeads.size === filteredAndSortedLeads.length) {
                  clearSelection();
                } else {
                  selectAllLeads(filteredAndSortedLeads);
                }
              }}
            >
              <MaterialIcons 
                name={selectedLeads.size === filteredAndSortedLeads.length ? "check-box" : "check-box-outline-blank"} 
                size={20} 
                color="#43cea2" 
              />
              <Text style={styles.bulkActionText}>
                {selectedLeads.size === filteredAndSortedLeads.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.bulkActionCount}>
              {selectedLeads.size} selected
            </Text>
            <TouchableOpacity
              style={styles.bulkActionCloseButton}
              onPress={toggleBulkMode}
            >
              <MaterialIcons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.bulkActionsRow}>
            {showArchived ? (
              <TouchableOpacity
                style={[styles.bulkActionButtonSmall, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}
                onPress={handleBulkUnarchive}
                disabled={selectedLeads.size === 0}
              >
                <MaterialIcons name="unarchive" size={18} color="#10B981" />
                <Text style={[styles.bulkActionButtonText, { color: '#10B981' }]}>Unarchive</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.bulkActionButtonSmall, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}
                  onPress={() => {
                    Alert.alert(
                      'Change Stage',
                      'Select new stage:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Contacted', onPress: () => handleBulkStageChange('contacted') },
                        { text: 'Qualified', onPress: () => handleBulkStageChange('qualified') },
                        { text: 'Proposal', onPress: () => handleBulkStageChange('proposal') },
                        { text: 'Won', onPress: () => handleBulkStageChange('won') },
                        { text: 'Lost', onPress: () => handleBulkStageChange('lost') },
                      ]
                    );
                  }}
                  disabled={selectedLeads.size === 0}
                >
                  <MaterialIcons name="swap-vert" size={18} color="#F59E0B" />
                  <Text style={[styles.bulkActionButtonText, { color: '#F59E0B' }]}>Change Stage</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkActionButtonSmall, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                  onPress={handleBulkArchive}
                  disabled={selectedLeads.size === 0}
                >
                  <MaterialIcons name="archive" size={18} color="#EF4444" />
                  <Text style={[styles.bulkActionButtonText, { color: '#EF4444' }]}>Archive</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Active Preferences Indicator - Compact */}
      {contractorProfile && contractorProfile.filterByTrade && contractorProfile.specificTrades && contractorProfile.specificTrades.length > 0 && !bulkActionMode && (
        <View style={styles.preferencesIndicator}>
          <TouchableOpacity
            style={styles.preferencesIndicatorButton}
            onPress={() => {
              Alert.alert(
                'Active Preferences',
                `Only showing leads for:\n\n${contractorProfile.specificTrades?.map(t => `• ${t}`).join('\n')}`,
                [{ text: 'OK' }]
              );
            }}
          >
            <MaterialIcons name="filter-alt" size={14} color="#FFFFFF" />
            <Text style={styles.preferencesIndicatorText}>
              {contractorProfile.specificTrades.length} {contractorProfile.specificTrades.length === 1 ? 'trade' : 'trades'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Summary Row - Shows active filters */}
      {((budgetFilter !== 'all' || timelineFilter !== 'all' || selectedTrades.length > 0) && (
        <View style={styles.filterSummaryRow}>
          <View style={styles.filterSummaryContent}>
            <Text style={styles.filterSummaryLabel}>Filters:</Text>
            {budgetFilter !== 'all' && (
              <View style={styles.filterSummaryChip}>
                <Text style={styles.filterSummaryChipText}>
                  {budgetFilter === 'low' ? '< $25K' : budgetFilter === 'medium' ? '$25K–$75K' : '> $75K'}
                </Text>
              </View>
            )}
            {timelineFilter !== 'all' && (
              <View style={styles.filterSummaryChip}>
                <Text style={styles.filterSummaryChipText}>{timelineFilter}</Text>
              </View>
            )}
            {selectedTrades.map((trade, idx) => (
              <View key={idx} style={styles.filterSummaryChip}>
                <Text style={styles.filterSummaryChipText}>{trade}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              setBudgetFilter('all');
              setTimelineFilter('all');
              setSelectedTrades([]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.filterSummaryClear}
          >
            <Text style={styles.filterSummaryClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Advanced Filters Section - Collapsible */}
      {showAdvancedFilters && (
        <View style={styles.refineLeadsContainer}>
          <View style={styles.refineLeadsContent}>
            {/* Timeline Filter - Most Important, Reduced Saturation */}
            <View style={[styles.refineFilterSection, styles.refineFilterSectionPrimary]}>
              <Text style={[styles.refineFilterLabel, !darkMode && { color: Colors.text }]}>Timeline</Text>
              <View style={styles.segmentedControl}>
                {[
                  { key: 'all', label: 'All', color: darkMode ? '#FFFFFF' : Colors.text },
                  { key: 'Urgent', label: 'Urgent', color: '#DC2626' },
                  { key: 'Soon', label: 'Soon', color: '#D97706' },
                  { key: 'Normal', label: 'Normal', color: '#059669' },
                ].map((filter) => {
                  const isActive = timelineFilter === filter.key;
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      style={[
                        styles.segmentedControlSegment,
                        isActive && { backgroundColor: filter.color + '20', borderColor: filter.color }
                      ]}
                      onPress={() => {
                        setTimelineFilter(filter.key as any);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text 
                        style={[
                          styles.segmentedControlText,
                          isActive && { color: filter.color, fontWeight: '700' },
                          !isActive && { color: darkMode ? '#FFFFFF' : Colors.sub }
                        ]}
                        numberOfLines={1}
                      >
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Budget Filter - Segmented Control */}
            <View style={[styles.refineFilterSection, styles.refineFilterSectionSecondary]}>
              <Text style={[styles.refineFilterLabel, !darkMode && { color: Colors.text }]}>Budget</Text>
              <View style={styles.segmentedControl}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'low', label: '< $25K' },
                  { key: 'medium', label: '$25K–$75K' },
                  { key: 'high', label: '> $75K' },
                ].map((filter) => {
                  const isActive = budgetFilter === filter.key;
                  const isAll = filter.key === 'all';
                  return (
                    <TouchableOpacity
                      key={filter.key}
                      style={[
                        styles.segmentedControlSegment,
                        isActive && !isAll && styles.segmentedControlSegmentActive,
                        isAll && budgetFilter === 'all' && styles.segmentedControlSegmentAll
                      ]}
                      onPress={() => {
                        setBudgetFilter(filter.key as any);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text style={[
                        styles.segmentedControlText,
                        isActive && !isAll && styles.segmentedControlTextActive,
                        isAll && { color: darkMode ? '#FFFFFF' : Colors.text }
                      ]}>
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Trade Filter - Tokenized Selector */}
            <View style={[styles.refineFilterSection, styles.refineFilterSectionTertiary]}>
              <Text style={[styles.refineFilterLabel, !darkMode && { color: Colors.text }]}>Trade</Text>
              <View style={styles.tradeTokenContainer}>
                {selectedTrades.map((trade, idx) => (
                  <LinearGradient
                    key={idx}
                    colors={['rgba(45, 255, 196, 0.5)', 'rgba(0, 166, 255, 0.45)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tradeTokenGradient}
                  >
                    <View style={styles.tradeToken}>
                      <Text style={styles.tradeTokenText}>{trade}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedTrades(selectedTrades.filter((_, i) => i !== idx));
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        style={styles.tradeTokenRemove}
                      >
                        <MaterialIcons name="close" size={14} color="#050B13" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                ))}
                <TouchableOpacity
                  style={styles.tradeTokenAdd}
                  onPress={() => {
                    // Get unique trades from leads and add standard trades
                    const leadTrades = Array.from(new Set(leads.map(l => l.trade)));
                    const standardTrades = ['Cabinets', 'Concrete', 'Countertops', 'Drywall', 'Electrical', 'Flooring', 'General', 'HVAC', 'Landscaping', 'Painting', 'Plumbing', 'Roofing', 'Tile'];
                    const allTrades = Array.from(new Set([...standardTrades, ...leadTrades])).sort();
                    Alert.alert(
                      'Select Trade',
                      'Choose a trade to filter:',
                      [
                        ...allTrades.map(trade => ({
                          text: trade,
                          onPress: () => {
                            if (!selectedTrades.includes(trade)) {
                              setSelectedTrades([...selectedTrades, trade]);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }
                          }
                        })),
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <MaterialIcons name="add" size={16} color={darkMode ? "#FFFFFF" : Colors.text} />
                  <Text style={styles.tradeTokenAddText}>Add trades</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.tradeHelperText}>Select one or more specialties</Text>
            </View>
          </View>
        </View>
      )}


    </>
  );


  // Combined header with filters
  const CombinedHeader = () => (
    <View>
      <ListHeader />
    </View>
  );

  // We'll wrap all lead cards together, so we don't need to track campaign cards separately

  // Helper function to render a single lead card (without gradient border)
  const renderLeadCardContent = (lead: Lead) => (
    <LeadCardManager
      key={lead.id}
      lead={lead}
      mode="compact"
      onPress={() => {
        if (bulkActionMode) {
          toggleLeadSelection(lead.id);
        } else {
          onLeadPress(lead);
        }
      }}
      onDelete={onDeleteLead ? () => onDeleteLead(lead.id) : undefined}
      onAddNote={onAddNote ? (lead) => onAddNote(lead.id, 'Quick note added') : () => {}}
      onSetReminder={onSetReminder ? (lead) => onSetReminder(lead.id, new Date(), 'Follow up on this lead') : () => {}}
      onStageChange={onStageChange ? (lead) => onStageChange(lead, getNextStage(lead.stage)) : undefined}
    />
  );

  return (
    <>
      {/* Tab Navigation */}
      <LeadsHeader
        activeViewTab={activeViewTab}
        setActiveViewTab={setActiveViewTab}
      />

      {/* Daily Focus Smart Banner */}
      {activeViewTab === 'leads' && (() => {
        const urgentLeads = filteredAndSortedLeads.filter(lead => lead.project.timeline === 'Urgent');
        const pipelineValue = urgentLeads.reduce((sum, lead) => {
          const avgBudget = (lead.project.budgetMin + lead.project.budgetMax) / 2;
          return sum + avgBudget;
        }, 0);
        const pipelineValueK = Math.round(pipelineValue / 1000);
        
        if (urgentLeads.length > 0) {
          return (
            <View style={styles.wideContainer}>
              <View
                style={[
                  styles.dailyFocusBanner,
                  !darkMode && {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                  },
                ]}
              >
                <MaterialIcons
                  name="lightbulb"
                  size={18}
                  color={darkMode ? 'rgba(94, 234, 212, 0.95)' : '#0f766e'}
                />
                <Text
                  style={[
                    styles.dailyFocusText,
                    !darkMode && { color: Colors.text },
                  ]}
                >
                  {urgentLeads.length} urgent lead{urgentLeads.length !== 1 ? 's' : ''} need contact today to protect ${pipelineValueK}K in pipeline.
                </Text>
              </View>
            </View>
          );
        }
        return null;
      })()}

      {/* Utility Buttons - Separate Action Buttons */}
      {activeViewTab === 'leads' && (
        <View style={styles.wideContainer}>
          <View style={styles.utilityButtonsRow}>
            {onPreferencesPress && (
              <TouchableOpacity
                style={[
                  styles.utilityButtonStandalone,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: Colors.line,
                    borderWidth: 1,
                    borderRadius: 14,
                  }
                ]}
                onPress={() => {
                  onPreferencesPress();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <MaterialIcons name="psychology" size={16} color={darkMode ? '#FFFFFF' : Colors.text} />
                <Text
                  style={[
                    styles.utilityButtonText,
                    !darkMode && { color: Colors.text },
                  ]}
                >
                  Match Prefs
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.utilityButtonStandalone,
                {
                  backgroundColor: Colors.surface2,
                  borderColor: Colors.line,
                  borderWidth: 1,
                  borderRadius: 14,
                }
              ]}
              onPress={() => {
                setShowMessagesInbox(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons name="message" size={16} color={darkMode ? '#FFFFFF' : Colors.text} />
              <Text
                style={[
                  styles.utilityButtonText,
                  !darkMode && { color: Colors.text },
                ]}
              >
                Message
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

        {/* Tab Content */}
        {activeViewTab === 'leads' && (
          <>
            {/* Leads List */}
            {filteredAndSortedLeads.length === 0 ? (
              <EmptyState />
            ) : (
              <View>
                <CombinedHeader />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  {bulkActionMode && (
                    <View style={{ paddingTop: 8 }}>
                      <TouchableOpacity
                        style={styles.bulkCheckbox}
                        onPress={() => {
                          filteredAndSortedLeads.forEach(lead => toggleLeadSelection(lead.id));
                        }}
                      >
                        <MaterialIcons
                          name={filteredAndSortedLeads.every(lead => selectedLeads.has(lead.id)) ? "check-box" : "check-box-outline-blank"}
                          size={24}
                          color={
                            filteredAndSortedLeads.every((lead) => selectedLeads.has(lead.id))
                              ? '#43cea2'
                              : darkMode
                                ? '#FFFFFF'
                                : Colors.sub
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.wideContainer}>
                      <LinearGradient
                        colors={darkMode ? [...LEADS_SECTION_GRADIENT.dark] : [...LEADS_SECTION_GRADIENT.light]}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.allCardsGroupBorder}
                      >
                        <View
                          style={[
                            styles.allCardsGroupWrapper,
                            !darkMode && { backgroundColor: Colors.surface },
                          ]}
                        >
                        {/* My Leads Header */}
                        <View style={styles.myLeadsHeader}>
                          <Text
                            style={[
                              styles.myLeadsHeaderText,
                              !darkMode && { color: Colors.text },
                            ]}
                          >
                            My Leads
                          </Text>
                          <Text style={[styles.myLeadsHeaderSubtext, !darkMode && { color: Colors.sub }]}>
                            {hasMoreInList
                              ? `Showing ${displayedLeads.length} of ${filteredAndSortedLeads.length} — scroll down for Show more`
                              : 'Your active lead opportunities'}
                          </Text>
                        </View>
                        {displayedLeads.map((lead, idx) => (
                          <View key={lead.id}>
                            {idx > 0 && (
                              <View
                                style={[
                                  styles.leadCardDivider,
                                  !darkMode && { backgroundColor: Colors.line },
                                ]}
                              />
                            )}
                            <View style={styles.leadCardInGroup}>
                              {renderLeadCardContent(lead)}
                            </View>
                          </View>
                        ))}
                        {hasMoreInList ? (() => {
                          const remainingBelow =
                            filteredAndSortedLeads.length - displayedLeads.length;
                          const nextBatch = Math.min(LEADS_LIST_LOAD_MORE_STEP, remainingBelow);
                          return (
                          <TouchableOpacity
                            style={[
                              styles.leadsLoadMoreRow,
                              !darkMode && {
                                backgroundColor: Colors.surface2,
                                borderTopColor: Colors.line,
                              },
                            ]}
                            onPress={() => {
                              setLeadsListLimit((n) => n + LEADS_LIST_LOAD_MORE_STEP);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            activeOpacity={0.85}
                          >
                            <MaterialIcons
                              name="expand-more"
                              size={22}
                              color={darkMode ? 'rgba(148, 163, 184, 0.95)' : Colors.sub}
                            />
                            <View style={styles.leadsLoadMoreTextBlock}>
                              <Text
                                style={[
                                  styles.leadsLoadMoreText,
                                  !darkMode && { color: Colors.text },
                                ]}
                              >
                                Show {nextBatch} more below
                              </Text>
                              {remainingBelow > nextBatch ? (
                                <Text
                                  style={[
                                    styles.leadsLoadMoreSubtext,
                                    !darkMode && { color: Colors.sub },
                                  ]}
                                >
                                  {remainingBelow} total below
                                </Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                          );
                        })() : null}
                        </View>
                      </LinearGradient>
                    </View>
                  </View>
                </View>
                <View style={{ height: 150 }} />
              </View>
            )}
          </>
        )}

        {activeViewTab === 'analytics' && (
          <LeadAnalyticsDashboard 
            key={`analytics-${leads.length}-${leads.filter(l => l && l.stage && (l.stage === 'proposal' || l.stage === 'proposal-sent')).length}-${leads.filter(l => l && l.stage && l.stage === 'qualified').length}`} 
            leads={leads}
            onStagePress={(stage) => {
              console.log(`🔍 onStagePress called with stage: "${stage}" - setting pipeline and switching to leads tab`);
              setPipeline(stage === 'all' ? 'all' : stage);
              setActiveViewTab('leads');
              console.log(`✅ Pipeline set to: "${stage}", activeViewTab set to: "leads"`);
            }}
            onProjectTypePress={(projectType: string) => {
              setProjectTypeFilter(projectType);
              setActiveViewTab('leads');
            }}
          />
        )}

        {activeViewTab === 'insights' && (() => {
          const getStatusColor = (status: string) => {
            switch (status) {
              case 'active': return '#19E180';
              case 'paused': return '#F59E0B';
              case 'draft': return '#FFFFFF';
              case 'expired': return '#EF4444';
              default: return '#FFFFFF';
            }
          };
          
          const getStatusLabel = (status: string) => {
            switch (status) {
              case 'active': return 'Active';
              case 'paused': return 'Paused';
              case 'draft': return 'Draft';
              case 'expired': return 'Expired';
              default: return 'Unknown';
            }
          };
          
          return (
            <View style={[styles.container, !darkMode && { backgroundColor: Colors.bg }]}>
              {/* Time Period Toggle */}
              {campaigns.length > 0 && (
                <View style={styles.wideContainer}>
                  <View
                    style={[
                      styles.timePeriodToggle,
                      !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 },
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.timePeriodButton, campaignTimePeriod === 'month' && styles.timePeriodButtonActive]}
                      onPress={() => {
                        setCampaignTimePeriod('month');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.timePeriodButtonText,
                          campaignTimePeriod === 'month' && styles.timePeriodButtonTextActive,
                          !darkMode && { color: Colors.sub },
                        ]}
                      >
                        This Month
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timePeriodButton, campaignTimePeriod === 'alltime' && styles.timePeriodButtonActive]}
                      onPress={() => {
                        setCampaignTimePeriod('alltime');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <Text
                        style={[
                          styles.timePeriodButtonText,
                          campaignTimePeriod === 'alltime' && styles.timePeriodButtonTextActive,
                          !darkMode && { color: Colors.sub },
                        ]}
                      >
                        All Time
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Campaign Performance Strip */}
              {campaigns.length > 0 && (
                <View style={styles.wideContainer}>
                  <View
                    style={[
                      styles.campaignPerformanceStrip,
                      !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
                    ]}
                  >
                    <View style={styles.performanceMetric}>
                      <Text style={[styles.performanceMetricLabel, !darkMode && { color: Colors.sub }]}>Requests</Text>
                      <Text style={[styles.performanceMetricValue, !darkMode && { color: Colors.text }]}>
                        {aggregateCampaignMetrics.leads === 0 ? '—' : aggregateCampaignMetrics.leads}
                      </Text>
                    </View>
                    <View style={styles.performanceMetricDivider} />
                    <View style={styles.performanceMetric}>
                      <Text style={[styles.performanceMetricLabel, !darkMode && { color: Colors.sub }]}>Jobs Won</Text>
                      <Text style={[styles.performanceMetricValue, !darkMode && { color: Colors.text }]}>
                        {aggregateCampaignMetrics.booked === 0 ? '—' : aggregateCampaignMetrics.booked}
                      </Text>
                    </View>
                    <View style={styles.performanceMetricDivider} />
                    <View style={styles.performanceMetric}>
                      <Text style={[styles.performanceMetricLabel, !darkMode && { color: Colors.sub }]}>Awarded $</Text>
                      <Text style={[styles.performanceMetricValue, !darkMode && { color: Colors.text }]}>
                        {aggregateCampaignMetrics.revenue === 0 ? '$0' : `$${aggregateCampaignMetrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      </Text>
                    </View>
                    <View style={styles.performanceMetricDivider} />
                    <View style={styles.performanceMetric}>
                      <Text style={[styles.performanceMetricLabel, !darkMode && { color: Colors.sub }]}>Close Rate</Text>
                      <Text style={[styles.performanceMetricValue, { 
                        color: aggregateCampaignMetrics.winRate > 0 ? '#19E180' : (darkMode ? '#FFFFFF' : Colors.sub)
                      }]}>
                        {aggregateCampaignMetrics.winRate === 0 ? '—' : `${aggregateCampaignMetrics.winRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.networkActivityLabel,
                      !darkMode && { color: Colors.sub },
                    ]}
                  >
                    Network activity
                  </Text>
                </View>
              )}
              
              {/* Campaigns Section */}
              <View style={styles.wideContainer}>
                <LinearGradient
                  colors={darkMode ? [...LEADS_SECTION_GRADIENT.dark] : [...LEADS_SECTION_GRADIENT.light]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.gradientBorder}
                >
                  <View
                    style={[
                      styles.sectionCard,
                      !darkMode && { backgroundColor: Colors.surface },
                    ]}
                  >
                    <View style={styles.sectionHeader}>
                      <MaterialIcons name='campaign' size={22} color='#19E180' />
                      <Text style={[styles.sectionTitle, !darkMode && { color: Colors.text }]}>My Campaigns</Text>
                      <Text style={[styles.sectionSubtitle, !darkMode && { color: Colors.sub }]}>Manage your active marketing campaigns</Text>
                    </View>
                    <View style={styles.sectionContent}>
                      {/* Launch Campaign Button */}
                      <TouchableOpacity
                        style={styles.launchCampaignButton}
                        onPress={() => {
                          setShowCampaignModal(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                      >
                        <MaterialIcons name="campaign" size={20} color="#ecfdf5" />
                        <Text style={styles.launchCampaignText}>Activate Availability</Text>
                      </TouchableOpacity>

                      {/* Campaigns List */}
                      {campaigns.length === 0 ? (
                        <View style={styles.emptyCampaignsState}>
                          <MaterialIcons name="campaign" size={48} color="#FFFFFF" />
                          <Text style={[styles.emptyCampaignsTitle, !darkMode && { color: Colors.text }]}>No Campaigns Yet</Text>
                          <Text style={styles.emptyCampaignsText}>
                            Top contractors earn $8,000–$20,000/month from campaigns.
                          </Text>
                          <Text style={[styles.emptyCampaignsSubtext, !darkMode && { color: Colors.sub }]}>
                            Create your first campaign to start generating leads from the marketplace.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.campaignsList}>
                          {campaigns.map((campaign) => {
                            const metrics = calculateCampaignMetrics(campaign.id);
                            const statusColor = getStatusColor(campaign.status || 'active');
                            const statusLabel = getStatusLabel(campaign.status || 'active');
                            const primaryServiceArea = campaign.serviceAreas?.[0];
                            const marketplaceReach = calculateMarketplaceReach(campaign);
                            const aiRouting = getAIRoutingStatus(campaign, metrics);
                            const additionalMetrics = calculateAdditionalMetrics(campaign.id);
                            
                            // Build services description with capacity if available
                            let servicesDescription = campaign.services?.slice(0, 3).join(' • ') || 'General Contracting';
                            if (campaign.availability?.capacity) {
                              const capacityLabel = campaign.availability.capacity === 'high' ? 'High capacity' : 
                                                   campaign.availability.capacity === 'medium' ? 'Medium capacity' : 'Limited capacity';
                              servicesDescription += ` • ${capacityLabel}`;
                            }
                            
                            // Get response time color
                            const getResponseTimeColor = (responseTime: string) => {
                              if (responseTime.includes('<') || responseTime.includes('0-4') || responseTime.includes('2-4')) {
                                return '#19E180'; // Green
                              } else if (responseTime.includes('4-12') || responseTime.includes('6-12')) {
                                return '#F59E0B'; // Yellow
                              } else {
                                return '#EF4444'; // Red
                              }
                            };
                            
                            return (
                              <View
                                key={campaign.id}
                                style={[
                                  styles.campaignPerformanceCard,
                                  !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
                                ]}
                              >
                                {/* Identity + status */}
                                <View style={styles.campaignPerformanceHeader}>
                                  <View style={styles.campaignPerformanceHeaderLeft}>
                                    <MaterialIcons name="campaign" size={20} color="#5EEAD4" />
                                    <View style={styles.campaignPerformanceTitleContainer}>
                                      <Text
                                        style={[
                                          styles.campaignPerformanceTitle,
                                          !darkMode && { color: Colors.text },
                                        ]}
                                      >
                                        {campaign.companyName || campaign.campaignName || 'Untitled Campaign'}
                                      </Text>
                                      {primaryServiceArea && (
                                        <Text
                                          style={[
                                            styles.campaignPerformanceLocation,
                                            !darkMode && { color: Colors.sub },
                                          ]}
                                        >
                                          {primaryServiceArea.city}, {primaryServiceArea.state}
                                        </Text>
                                      )}
                                    </View>
                                  </View>
                                  <View style={[styles.campaignStatusChip, { backgroundColor: `${statusColor}20`, borderColor: statusColor }]}>
                                    <View style={[styles.campaignStatusDot, { backgroundColor: statusColor }]} />
                                    <Text style={[styles.campaignStatusText, { color: statusColor }]}>{statusLabel}</Text>
                                  </View>
                                </View>

                                <View style={styles.campaignCardHairline} />

                                {/* Trade, capacity & AI routing */}
                                <View style={styles.campaignTradeSection}>
                                  <Text style={styles.campaignServicesDescription}>
                                    {servicesDescription}
                                  </Text>
                                  <View style={styles.aiOptimizationStatus}>
                                    <MaterialIcons name="route" size={14} color={aiRouting.color} />
                                    <Text style={[styles.aiOptimizationText, { color: aiRouting.color }]}>
                                      AI Routing: {aiRouting.status}
                                    </Text>
                                  </View>
                                </View>

                                {/* Network Reach */}
                                {marketplaceReach > 0 && (
                                  <View style={styles.marketplaceReach}>
                                    <MaterialIcons name="network-check" size={14} color="rgba(94, 234, 212, 0.9)" />
                                    <Text
                                      style={[
                                        styles.marketplaceReachText,
                                        !darkMode && { color: Colors.sub },
                                      ]}
                                    >
                                      Contractors & Deal Sources in Range: {marketplaceReach.toLocaleString()}
                                    </Text>
                                  </View>
                                )}

                                <View style={styles.campaignCardHairline} />

                                {/* Tier 1–2 metrics */}
                                <View style={[styles.campaignMetricsPanel, !darkMode && styles.campaignMetricsPanelLight]}>
                                {/* Tier 1 Metrics (Big) - Requests, Jobs Won, Awarded Value */}
                                <View style={styles.campaignTier1Metrics}>
                                  <View style={styles.campaignTier1Metric}>
                                    <Text style={[styles.campaignTier1Label, !darkMode && { color: Colors.sub }]}>Requests</Text>
                                    <Text style={[styles.campaignTier1Value, !darkMode && { color: Colors.sub }]}>
                                      {metrics.totalLeads === 0 ? '—' : metrics.totalLeads}
                                    </Text>
                                  </View>
                                  <View style={styles.campaignTier1Metric}>
                                    <Text style={[styles.campaignTier1Label, !darkMode && { color: Colors.sub }]}>Jobs Won</Text>
                                    <Text style={[styles.campaignTier1Value, !darkMode && { color: Colors.sub }]}>
                                      {metrics.bookedJobs === 0 ? '—' : metrics.bookedJobs}
                                    </Text>
                                  </View>
                                  <View style={styles.campaignTier1Metric}>
                                    <Text style={[styles.campaignTier1Label, !darkMode && { color: Colors.sub }]}>Awarded Value</Text>
                                    <Text
                                      style={[
                                        styles.campaignTier1ValueAwarded,
                                        { color: '#19E180' },
                                        !darkMode && { color: Colors.sub },
                                      ]}
                                    >
                                      {metrics.revenue === 0 ? '$0' : `$${metrics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                    </Text>
                                  </View>
                                </View>
                                
                                {/* Tier 2 Metrics (Medium) - Close Rate, ROI */}
                                <View style={styles.campaignTier2Metrics}>
                                  <View style={styles.campaignTier2Metric}>
                                    <Text style={[styles.campaignTier2Label, !darkMode && { color: Colors.sub }]}>Close Rate</Text>
                                    <Text
                                      style={[
                                        styles.campaignTier2Value,
                                        { color: '#60A5FA' },
                                        !darkMode && { color: Colors.sub },
                                      ]}
                                    >
                                      {metrics.winRate === 0 ? '—' : `${metrics.winRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`}
                                    </Text>
                                  </View>
                                  <View style={styles.campaignTier2Metric}>
                                    <Text style={[styles.campaignTier2LabelROI, !darkMode && { color: Colors.sub }]}>ROI</Text>
                                    <Text style={[styles.campaignTier2ValueROI, { 
                                      color: metrics.roi > 0 ? '#19E180' : metrics.roi < 0 ? '#EF4444' : '#FFFFFF'
                                    }, !darkMode && { color: Colors.sub }]}>
                                      {metrics.roi === 0 ? '—' : `${metrics.roi > 0 ? '+' : ''}${metrics.roi.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`}
                                    </Text>
                                  </View>
                                </View>
                                </View>

                                {/* Tier 3 Metrics (Small) - Response Time, Quotes Sent, Avg Job Size */}
                                <View style={styles.campaignTier3Metrics}>
                                  <View style={styles.campaignTier3Metric}>
                                    <Text style={styles.campaignTier3Label}>Response Time</Text>
                                    <Text style={[styles.campaignTier3Value, { color: getResponseTimeColor(additionalMetrics.responseTime) }]}>
                                      {additionalMetrics.responseTime}
                                    </Text>
                                  </View>
                                  <View style={styles.campaignTier3Metric}>
                                    <Text style={styles.campaignTier3Label}>Quotes Sent</Text>
                                    <Text style={styles.campaignTier3Value}>
                                      {additionalMetrics.quotesSent === 0 ? '—' : additionalMetrics.quotesSent}
                                    </Text>
                                  </View>
                                  <View style={styles.campaignTier3Metric}>
                                    <Text style={styles.campaignTier3Label}>Avg Job Size</Text>
                                    <Text style={styles.campaignTier3Value}>
                                      {additionalMetrics.avgJobSize === 0 ? '—' : `$${(additionalMetrics.avgJobSize / 1000).toFixed(0)}K`}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.campaignCardHairline} />

                                {/* Actions */}
                                <View style={styles.campaignPerformanceActions}>
                                  <TouchableOpacity
                                    style={styles.campaignViewLeadsButton}
                                    onPress={() => {
                                      setActiveViewTab('leads');
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    }}
                                  >
                                    <MaterialIcons name="list" size={18} color="#FFFFFF" />
                                    <Text style={styles.campaignViewLeadsButtonText}>View Leads</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.campaignSecondaryButton}
                                    onPress={() => {
                                      // Increase Reach button - placeholder for future features
                                      Alert.alert('Increase Reach', 'Increase reach features coming soon: expand radius, show to more developers, prioritize in AI matching.');
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                  >
                                    <MaterialIcons name="expand-more" size={18} color="#5EEAD4" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.campaignSecondaryButton}
                                    onPress={() => {
                                      const newStatus: 'active' | 'paused' | 'draft' | 'expired' = campaign.status === 'active' ? 'paused' : 'active';
                                      const updatedCampaigns = campaigns.map(c => 
                                        c.id === campaign.id ? { ...c, status: newStatus } : c
                                      ) as any;
                                      saveCampaigns(updatedCampaigns);
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                  >
                                    <MaterialIcons 
                                      name={campaign.status === 'active' ? 'pause' : 'play-arrow'} 
                                      size={18} 
                                      color="#5EEAD4" 
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.campaignSecondaryButton, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}
                                    onPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                      Alert.alert(
                                        'Delete Campaign',
                                        `Are you sure you want to delete "${campaign.companyName || campaign.campaignName || 'this campaign'}"? This action cannot be undone.`,
                                        [
                                          {
                                            text: 'Cancel',
                                            style: 'cancel',
                                          },
                                          {
                                            text: 'Delete',
                                            style: 'destructive',
                                            onPress: async () => {
                                              try {
                                                const updatedCampaigns = campaigns.filter(c => c.id !== campaign.id);
                                                await saveCampaigns(updatedCampaigns);
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                Alert.alert('Success', 'Campaign deleted successfully.');
                                              } catch (error) {
                                                console.error('Error deleting campaign:', error);
                                                Alert.alert('Error', 'Failed to delete campaign. Please try again.');
                                              }
                                            },
                                          },
                                        ]
                                      );
                                    }}
                                  >
                                    <MaterialIcons name="delete" size={16} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
              
              <View style={{ height: 100 }} />
            </View>
          );
        })()}


      {/* Lead Notes Modal */}
      {selectedLead && (
        <LeadNotesModal
          visible={notesModalVisible}
          onClose={() => {
            setNotesModalVisible(false);
            setSelectedLead(null);
          }}
          leadId={selectedLead.id}
          leadTitle={selectedLead.title ?? 'Untitled Lead'}
        />
      )}

      {/* Campaign Creation Modal */}
      <CampaignCreationModal
        visible={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        onSave={async (campaign) => {
          try {
            console.log('💼 Campaign created:', campaign);
            
            // Get API base URL from config
            const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 'http://192.168.1.115:3001/api';
            
            // Post each service in the campaign as a project lead
            // This makes the campaign appear in the marketplace for other contractors
            const postedLeads = [];
            
            console.log('📋 Campaign services:', campaign.services);
            console.log('📍 Campaign service areas:', campaign.serviceAreas);
            
            if (!campaign.services || campaign.services.length === 0) {
              Alert.alert(
                'No Services',
                'Please add at least one service to your campaign.',
                [{ text: 'OK' }]
              );
              return;
            }
            
            if (!campaign.serviceAreas || campaign.serviceAreas.length === 0) {
              Alert.alert(
                'No Service Areas',
                'Please add at least one service area to your campaign.',
                [{ text: 'OK' }]
              );
              return;
            }
            
            // Create a single lead card for the entire campaign (all services)
            const serviceArea = campaign.serviceAreas[0];
            
            // Calculate combined budget range from all services
            const allBudgets = campaign.services.map(service => {
              const pricing = campaign.pricing.specialties[service] || {
                min: campaign.pricing.projectMinimum || 5000,
                max: (campaign.pricing.projectMinimum || 5000) * 2
              };
              return pricing;
            });
            const budgetMin = Math.min(...allBudgets.map(b => b.min));
            const budgetMax = Math.max(...allBudgets.map(b => b.max));
            
            // Create description with all services listed
            const servicesList = campaign.services.join(', ');
            const description = campaign.bio || 
              `Professional services from ${campaign.companyName}. Services: ${servicesList}. ${campaign.specialties?.join(', ') || ''}. Available: ${campaign.availability.schedule}`;
            
            const leadPayload = {
              title: `${campaign.companyName} - Professional Services`,
              trade: campaign.services[0] || 'General Contracting', // Use first service as primary trade
              city: serviceArea.city,
              state: serviceArea.state,
              budgetMin: budgetMin,
              budgetMax: budgetMax,
              timeline: campaign.availability.schedule === 'immediate' ? 'Urgent' : 
                        campaign.availability.schedule === '1-2 weeks' ? 'Soon' : 'Normal',
              createdBy: 'contractor-demo',
              description: description,
              projectId: `CAMPAIGN-${campaign.id}`,
            };
            
            console.log(`📤 Posting campaign lead:`, leadPayload);
            console.log(`📤 API URL: ${apiBaseUrl}/project-leads`);
            
            try {
              const leadResponse = await fetch(`${apiBaseUrl}/project-leads`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(leadPayload),
              });
              
              console.log(`📥 Response status:`, leadResponse.status);
              
              if (leadResponse.ok) {
                const result = await leadResponse.json();
                postedLeads.push(result);
                console.log(`✅ Posted campaign as lead:`, result.lead?.id);
              } else {
                const errorText = await leadResponse.text();
                console.error(`❌ Failed to post campaign:`, leadResponse.status, errorText);
              }
            } catch (error) {
              console.error(`❌ Error posting campaign:`, error);
            }
            
            // Save campaign locally
            console.log('💾 Saving campaign to storage...');
            console.log('💾 Current campaigns count:', campaigns.length);
            console.log('💾 Current campaigns state:', campaigns.map((c: any) => ({ id: c.id, companyName: c.companyName })));
            console.log('💾 New campaign to add:', { id: campaign.id, companyName: campaign.companyName, createdAt: campaign.createdAt });
            const newCampaigns = [...campaigns, campaign];
            console.log('💾 New campaigns array length:', newCampaigns.length);
            console.log('💾 New campaigns array:', newCampaigns.map((c: any) => ({ id: c.id, companyName: c.companyName })));
            await saveCampaigns(newCampaigns);
            console.log('💾 Campaign saved, verifying storage...');
            // Verify it was saved
            const verify = await AsyncStorage.getItem('subcontractorCampaigns');
            if (verify) {
              const verifyParsed = JSON.parse(verify);
              console.log('✅ Verification: Storage contains', verifyParsed.length, 'campaigns');
              console.log('✅ Verification: Campaign IDs:', verifyParsed.map((c: any) => c.id));
            } else {
              console.error('❌ Verification FAILED: Storage is empty after save!');
            }
            console.log('💾 Reloading campaigns...');
            await loadCampaigns(); // Force reload to verify
            
            // Close modal first
            setShowCampaignModal(false);
            
            // Navigate to campaigns tab to show the new campaign
            setActiveViewTab('insights');
            
            Alert.alert(
              'Campaign Created!', 
              `Posted your campaign to the marketplace. ${postedLeads.length > 0 ? 'Your lead should appear shortly.' : 'Please check your campaign details and try again.'}`,
              [
                { 
                  text: 'OK', 
                  style: 'default',
                  onPress: () => {
                    // Wait a moment then refresh leads to show the new campaign leads
                    setTimeout(() => {
                      if (onRefreshLeads) {
                        console.log('🔄 Refreshing leads after campaign creation...');
                        onRefreshLeads();
                      }
                    }, 1000);
                  }
                }
              ]
            );
          } catch (error) {
            console.error('❌ Error creating campaign:', error);
            Alert.alert(
              'Error',
              'Failed to publish campaign. It was saved locally but not posted to marketplace.',
              [{ text: 'OK', style: 'default' }]
            );
          }
        }}
      />

      {/* Campaign Edit Modal */}
      <CampaignCreationModal
        visible={showEditCampaignModal}
        onClose={() => {
          setShowEditCampaignModal(false);
          setEditingCampaign(null);
        }}
        onSave={async (updatedCampaign) => {
          if (editingCampaign) {
            try {
              console.log('✏️ Campaign updated:', updatedCampaign);
              
              // Get API base URL from config
              const apiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 'http://192.168.1.115:3001/api';
              const campaignProjectId = `CAMPAIGN-${updatedCampaign.id}`;
              
              // First, delete existing leads for this campaign to prevent duplicates
              let deletedCount = 0;
              try {
                // Bulk delete all leads for this campaign using projectId
                const deleteResponse = await fetch(`${apiBaseUrl}/project-leads/campaign/${campaignProjectId}`, {
                  method: 'DELETE',
                });
                if (deleteResponse.ok) {
                  const deleteResult = await deleteResponse.json();
                  deletedCount = deleteResult.deletedCount || 0;
                  console.log(`✅ Bulk deleted ${deletedCount} leads for campaign`);
                } else {
                  console.log('⚠️ Bulk delete failed, fetching existing leads for individual deletion...');
                  // Fallback: fetch and delete individually
                  const existingResponse = await fetch(`${apiBaseUrl}/project-leads/my-requests/contractor-demo`, {
                    headers: { 'Cache-Control': 'no-cache' },
                    cache: 'no-store'
                  });
                  
                  if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    const campaignLeads = (existingData.requests || []).filter((lead: any) => 
                      lead.projectId === campaignProjectId
                    );
                    const existingLeadIds = campaignLeads.map((lead: any) => lead.id);
                    
                    for (const leadId of existingLeadIds) {
                      try {
                        await fetch(`${apiBaseUrl}/project-leads/${leadId}`, {
                          method: 'DELETE',
                        });
                        deletedCount++;
                      } catch (error) {
                        console.error(`❌ Error deleting lead ${leadId}:`, error);
                      }
                    }
                  }
                }
                
                // Small delay to ensure deletions are processed
                await new Promise(resolve => setTimeout(resolve, 500));
              } catch (error) {
                console.error('❌ Error deleting existing leads:', error);
              }
              
              // Repost campaign as a single lead card
              const postedLeads = [];
              
              if (updatedCampaign.services && updatedCampaign.services.length > 0 && 
                  updatedCampaign.serviceAreas && updatedCampaign.serviceAreas.length > 0) {
                // Create a single lead card for the entire campaign
                const serviceArea = updatedCampaign.serviceAreas[0];
                
                // Calculate combined budget range from all services
                const allBudgets = updatedCampaign.services.map(service => {
                  const pricing = updatedCampaign.pricing.specialties[service] || {
                    min: updatedCampaign.pricing.projectMinimum || 5000,
                    max: (updatedCampaign.pricing.projectMinimum || 5000) * 2
                  };
                  return pricing;
                });
                const budgetMin = Math.min(...allBudgets.map(b => b.min));
                const budgetMax = Math.max(...allBudgets.map(b => b.max));
                
                // Create description with all services listed
                const servicesList = updatedCampaign.services.join(', ');
                const description = updatedCampaign.bio || 
                  `Professional services from ${updatedCampaign.companyName}. Services: ${servicesList}. ${updatedCampaign.specialties?.join(', ') || ''}. Available: ${updatedCampaign.availability.schedule}`;
                
                const leadPayload = {
                  title: `${updatedCampaign.companyName} - Professional Services`,
                  trade: updatedCampaign.services[0] || 'General Contracting',
                  city: serviceArea.city,
                  state: serviceArea.state,
                  budgetMin: budgetMin,
                  budgetMax: budgetMax,
                  timeline: updatedCampaign.availability.schedule === 'immediate' ? 'Urgent' : 
                            updatedCampaign.availability.schedule === '1-2 weeks' ? 'Soon' : 'Normal',
                  createdBy: 'contractor-demo',
                  description: description,
                  projectId: campaignProjectId,
                };
                
                console.log(`📤 Reposting campaign lead:`, leadPayload);
                
                try {
                  const leadResponse = await fetch(`${apiBaseUrl}/project-leads`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(leadPayload),
                  });
                  
                  if (leadResponse.ok) {
                    const result = await leadResponse.json();
                    postedLeads.push(result);
                    console.log(`✅ Reposted campaign as lead:`, result.lead?.id);
                  } else {
                    const errorText = await leadResponse.text();
                    console.error(`❌ Failed to repost campaign:`, leadResponse.status, errorText);
                  }
                } catch (error) {
                  console.error(`❌ Error reposting campaign:`, error);
                }
              }
              
              const updatedCampaigns = campaigns.map(campaign => 
                campaign.id === editingCampaign.id ? updatedCampaign : campaign
              );
              await saveCampaigns(updatedCampaigns);
              setShowEditCampaignModal(false);
              setEditingCampaign(null);
              
              // Refresh leads after a short delay
              setTimeout(() => {
                if (onRefreshLeads) {
                  console.log('🔄 Refreshing leads after campaign update...');
                  onRefreshLeads();
                }
              }, 1000);
              
              // deletedCount was already set in the delete block above
              Alert.alert(
                'Campaign Updated!', 
                `Removed ${deletedCount} old lead${deletedCount !== 1 ? 's' : ''} and reposted your campaign to the marketplace. Your lead should appear shortly.`,
                [{ text: 'Great!', style: 'default' }]
              );
            } catch (error) {
              console.error('❌ Error updating campaign:', error);
              Alert.alert(
                'Error',
                'Failed to update campaign.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          }
        }}
        initialData={editingCampaign}
        isEditMode={true}
      />

      {/* Messages Inbox - Only show campaign messages */}
      <MessagesInbox
        visible={showMessagesInbox}
        onClose={() => setShowMessagesInbox(false)}
        filterRole="subcontractor"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  wideContainer: {
    marginHorizontal: -20, // Extend beyond ScrollView padding (matches dashboard, projects, landing)
    paddingHorizontal: 4, // Add padding back inside (matches dashboard, projects, landing)
  },
  gradientBorder: {
    borderRadius: 24, // Matches estimate generator
    padding: 1, // This creates the border width (matches estimate generator)
    marginBottom: 20,
    marginHorizontal: 0, // No margin - wideContainer handles width
  },
  leadCardGradientBorder: {
    borderRadius: 24, // Matches estimate generator
    padding: 1, // This creates the border width (matches estimate generator)
    marginBottom: 12,
    marginHorizontal: -20, // Extend beyond FlatList padding (wideContainer pattern)
  },
  leadCardWrapper: {
    backgroundColor: '#000000', // Fully opaque dark background to cover gradient
    borderRadius: 22, // 24 - 2 = 22 to show 1px border on each side
  },
  allCardsGroupBorder: {
    borderRadius: 24, // Matches estimate generator
    padding: 1, // This creates the border width (matches estimate generator)
    marginBottom: 16,
    marginHorizontal: 0, // No margin - wideContainer handles width
  },
  allCardsGroupWrapper: {
    backgroundColor: '#000000', // Fully opaque dark background to cover gradient
    borderRadius: 22, // 24 - 2 = 22 to show 1px border on each side
    overflow: 'hidden',
  },
  myLeadsHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 8,
  },
  myLeadsHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  myLeadsHeaderSubtext: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.82)',
  },
  leadsLoadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  leadsLoadMoreTextBlock: {
    alignItems: 'flex-start',
  },
  leadsLoadMoreText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  leadsLoadMoreSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(148, 163, 184, 0.95)',
    marginTop: 2,
  },
  leadCardInGroup: {
    padding: 0,
  },
  leadCardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 0,
  },
  sectionCard: {
    backgroundColor: '#000000', // Fully opaque dark background to cover gradient (matches estimate generator)
    borderRadius: 22, // 24 - 2 = 22 to show 1px border on each side (matches estimate generator)
    padding: 16,
    borderWidth: 0, // Remove border since gradient provides it
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    flex: 1, // Fill the gradient container
  },
  campaignsSectionBorder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  campaignsSectionCard: {
    backgroundColor: 'transparent',
    borderRadius: 15,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.78)',
    lineHeight: 18,
  },
  sectionContent: {
    padding: 0,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: 'white',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#FFFFFF',
  },
  sortButton: {
    padding: 8,
    backgroundColor: '#13172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  sortMenu: {
    backgroundColor: '#13172A',
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3142',
    padding: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  activeSortOption: {
    backgroundColor: '#1F2B47',
  },
  sortOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  activeSortOptionText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  analyticsBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  simpleAnalytics: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsRow: {
    alignItems: 'center',
  },
  analyticsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  analyticsValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillDefault: {
    backgroundColor: '#242635',
  },
  pillGood: {
    backgroundColor: '#133D2E',
  },
  pillWarn: {
    backgroundColor: '#3C2A0A',
  },
  pillInfo: {
    backgroundColor: '#152B45',
  },
  pillText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  searchSectionContainer: {
    marginTop: 4,
    marginBottom: 20,
    marginHorizontal: 16, // Matches estimate generator GradientCard
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 0,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    height: 44,
    marginLeft: 8,
  },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  mapToggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mapToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapToggleText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  mapBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  mapContent: {
    padding: 16,
  },
  quickActionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  quickActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#13172A',
  },
  mapPlaceholderText: {
    color: '#E5E7EB',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 4,
  },
  mapStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  statText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '500',
  },
  pipelineTabs: {
    flexDirection: 'row',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  pipelineTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#12172A',
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  activePipelineTab: {
    backgroundColor: '#1E2741',
  },
  pipelineTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  activePipelineTabText: {
    color: '#3B82F6',
  },
  listContainer: {
    paddingBottom: 80,
  },
  swipeableCard: {
    marginBottom: 14,
    position: 'relative',
  },
  swipeActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 0,
  },
  leftSwipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1B365D',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  rightSwipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1B365D',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  leadCard: {
    // Base styles - background, border, padding, borderRadius are set via leadCardBaseStyle
    zIndex: 1,
  },
  campaignLeadCard: {
    borderColor: '#19E180',
    borderWidth: 2,
    // Keep surface2 background from leadCardBaseStyle
  },
  subRequestLeadCard: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    // Keep surface2 background from leadCardBaseStyle
  },
  aiMatchedLeadCard: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    // Keep surface2 background from leadCardBaseStyle
  },
  campaignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#19E18020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#19E180',
  },
  campaignBadgeText: {
    color: '#19E180',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 4,
  },
  subRequestBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aiMatchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F620',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  aiMatchedBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  campaignCardHeader: {
    backgroundColor: '#8B5CF610',
    borderRadius: 12,
    padding: 12,
    marginBottom: 0,
  },
  leadInfo: {
    flex: 1,
  },
  leadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 4,
  },
  campaignLeadTitle: {
    color: '#19E180',
    fontWeight: '700',
  },
  leadName: {
    color: 'white',
    fontSize: 15, // Slightly smaller than dollar range
    fontWeight: '600',
  },
  companyName: {
    color: '#FFFFFF',
    marginTop: 2,
    fontSize: 13,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  projectRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
    gap: 10,
  },
  projectType: {
    color: '#37D39F',
    fontWeight: '800',
  },
  leadValue: {
    color: '#2FE37D',
    fontWeight: '900', // Increased from 800
    fontSize: 17, // Slightly larger than name
  },
  budget: {
    color: '#FFB547',
  },
  tagRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252A36',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#31384A',
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 6,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: '#fff',
  },
  noteInput: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#475569',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reminderLabel: {
    fontSize: 16,
    color: '#E2E8F0',
    marginBottom: 16,
    fontWeight: '500',
  },
  reminderOptions: {
    gap: 12,
    marginBottom: 16,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#475569',
  },
  reminderOptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  reminderNoteInput: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#475569',
  },
  // Score Badge Styles
  scoreBadge: {
    backgroundColor: '#121A2A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2F3A50',
  },
  scoreBadgeText: {
    fontWeight: '800',
    fontSize: 12,
  },
  scoreModalContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 120,
    backgroundColor: '#0F1322',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A3142',
  },
  scoreModalTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  scoreModalDescription: {
    color: '#FFFFFF',
    marginTop: 8,
    fontSize: 14,
  },
  scoreModalSubtitle: {
    color: '#FFFFFF',
    marginTop: 10,
    fontWeight: '700',
    fontSize: 14,
  },
  scoreModalTip: {
    color: '#FFFFFF',
    marginTop: 6,
    fontSize: 13,
  },
  closeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    alignSelf: 'flex-end',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Sticky Filters Styles
  stickyFilters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#0B0F1C',
    borderBottomWidth: 1,
    borderColor: '#20263A',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    padding: 32,
    flex: 1,
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2B47',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  clearFiltersText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2B47',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  backButtonText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  // Source Analytics Styles
  sourceAnalytics: {
    marginBottom: 4,
  },
  insightBanner: {
    backgroundColor: '#7C2D12',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightText: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sourceFilters: {
    marginBottom: 6,
    marginTop: 2,
  },
  sourceTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#FFFFFF',
  },
  sourceTabLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sourceTabLabelActive: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  sourceBadge: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 24,
    alignItems: 'center',
  },
  sourceBadgeActive: {
    backgroundColor: '#6B7280',
  },
  sourceBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sourceBadgeTextActive: {
    color: '#FFFFFF',
  },
  sourceStatsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  sourceStatsLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  sourceStatsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  sourceStatsChipsContainer: {
    marginTop: 10,
    gap: 8,
  },
  sourceStatsChipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  sourceStatsChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sourceStatsChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sourceFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginBottom: 2,
  },
  sourceFilterTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.72)',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  helpButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  // Phase 1 Enhancement Styles
  phase1UrgencyRow: {
    marginTop: 12,
    marginBottom: 8,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  phase1QualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qualityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  qualityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  qualityIndicators: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  phase1CompetitiveRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  competitiveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickResponseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  quickResponseText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  quickResponseContainer: {
    marginTop: 12,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickResponseTemplate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickResponseIcon: {
    fontSize: 20,
  },
  quickResponseContent: {
    flex: 1,
  },
  quickResponseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F3F4F6',
    marginBottom: 2,
  },
  quickResponseMessage: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  // Phase 2 Enhancement Styles
  phase2LTVRow: {
    marginBottom: 8,
  },
  ltvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 10,
  },
  ltvEmoji: {
    fontSize: 20,
  },
  ltvContent: {
    flex: 1,
  },
  ltvLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  ltvDescription: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  ltvIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  ltvIndicatorText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  phase2RepeatRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  repeatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  phase2EngagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  engagementLeft: {
    flex: 1,
  },
  engagementLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  engagementMessage: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  engagementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  engagementBadgeText: {
    fontSize: 11,
    color: '#34C759',
    fontWeight: '600',
  },
  phase2PhotoRow: {
    marginBottom: 8,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  photoHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  photoGallery: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
  photoContainer: {
    marginRight: 12,
    width: 120,
  },
  photoPlaceholder: {
    width: 120,
    height: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  photoTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  photoTypeEmoji: {
    fontSize: 12,
  },
  photoTypeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Collapsible Card Styles
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  compactDivider: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  compactView: {
    padding: 16,
    paddingTop: 8,
  },
  compactBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  compactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  compactBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactCompetitive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  compactCompetitiveText: {
    fontSize: 11,
    fontWeight: '600',
  },
  compactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  compactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  compactActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stageSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stageSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  stageBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  expandedView: {
    padding: 16,
    paddingTop: 8,
  },
  // Phase 3 Styles
  phase3PricingRow: {
    marginBottom: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: 12,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pricingHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  pricingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pricingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  pricingContent: {
    gap: 6,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  pricingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  pricingReasoning: {
    fontSize: 11,
    color: '#10B981',
    fontStyle: 'italic',
    marginTop: 4,
  },
  phase3ReviewsRow: {
    marginBottom: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    padding: 12,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reviewsHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  reliabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reliabilityBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  reviewsContent: {
    gap: 6,
  },
  reviewsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewsLabel: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  ratingCount: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  reliabilityScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentHistory: {
    fontSize: 12,
    color: '#F3F4F6',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  repeatCustomerText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '600',
  },
  phase3NotificationsRow: {
    marginBottom: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    padding: 12,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notificationsHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  notificationCount: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  notificationCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  notificationItem: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F3F4F6',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 11,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionRequiredBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionRequiredText: {
    fontSize: 9,
    color: 'white',
    fontWeight: '600',
  },
  
  // Enhanced Filter Styles
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
  },
  advancedFiltersContainer: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 0,
    marginTop: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 2,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  tradeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    color: '#E2E8F0',
    fontSize: 14,
  },
  // Filter Summary Row
  filterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginHorizontal: 16, // Matches estimate generator GradientCard
  },
  filterSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 6,
  },
  filterSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  filterSummaryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterSummaryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  filterSummaryClear: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterSummaryClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // Refine Leads Container (Collapsible)
  refineLeadsContainer: {
    marginHorizontal: 16, // Matches estimate generator GradientCard
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  refineLeadsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  refineLeadsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refineLeadsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  refineLeadsOptional: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.6, // Reduced opacity for de-emphasis
  },
  refineLeadsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refineLeadsClearButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refineLeadsClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  refineLeadsContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  refineFilterSection: {
    marginBottom: 0,
  },
  refineFilterSectionPrimary: {
    marginBottom: 20, // Timeline - most important, increased spacing
  },
  refineFilterSectionSecondary: {
    marginBottom: 16, // Budget - increased spacing
  },
  refineFilterSectionTertiary: {
    marginBottom: 0, // Trade - tighter spacing
  },
  refineFilterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  // Segmented Control (iOS-style)
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  segmentedControlSegment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10, // Reduced from 12 (8% reduction)
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentedControlSegmentActive: {
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderColor: '#43cea2',
  },
  segmentedControlSegmentAll: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(107, 114, 128, 0.3)', // Muted outline for "All"
  },
  segmentedControlText: {
    fontSize: 12, // Reduced from 13 to prevent wrapping
    fontWeight: '500',
    color: '#FFFFFF',
  },
  segmentedControlTextActive: {
    color: '#43cea2',
    fontWeight: '700',
  },
  // Trade Token Selector
  tradeTokenContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  tradeTokenGradient: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 0,
  },
  tradeToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradeTokenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#050B13', // Dark color for contrast on gradient background
  },
  tradeTokenRemove: {
    padding: 2,
  },
  tradeTokenAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    gap: 4,
  },
  tradeTokenAddText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  tradeHelperText: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 6,
    fontStyle: 'italic',
  },
  // Refine Leads Modal Styles
  refineModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  refineModalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  refineModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 0,
  },
  refineModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refineModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  refineModalOptional: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
    opacity: 0.6,
  },
  refineModalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refineModalClearButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refineModalClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  refineModalScroll: {
    flex: 1,
  },
  refineModalFilters: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 16,
  },
  
  // Quick Action Bar Styles
  quickActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  
  // Launch Campaign Button Styles
  launchCampaignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 0,
    marginBottom: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  launchCampaignText: {
    color: '#ecfdf5',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Daily Focus Smart Banner
  dailyFocusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 0, // No margin - wideContainer handles width
    marginTop: 6,
    marginBottom: 18,
    backgroundColor: 'rgba(45, 212, 191, 0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.22)',
    gap: 12,
  },
  dailyFocusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(204, 251, 241, 0.95)',
    lineHeight: 20,
  },
  // Utility Buttons (Separate Standalone Buttons)
  utilityButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  utilityButtonStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    // backgroundColor, borderColor, borderWidth, borderRadius are set dynamically
    gap: 8,
    flex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  utilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    backgroundColor: 'transparent',
  },
  utilityButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  utilityButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  utilityBadgeDot: {
    color: '#EF4444',
    fontSize: 8,
    fontWeight: '700',
  },
  utilityBadgeCount: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  preferencesIndicator: {
    marginHorizontal: 16, // Matches estimate generator GradientCard
    marginBottom: 12,
  },
  preferencesIndicatorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  preferencesIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  messagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43cea2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0d2745',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Campaigns Section Styles
  campaignsSection: {
    marginBottom: 16,
  },
  campaignsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  campaignsList: {
    marginTop: 16,
  },
  campaignCard: {
    width: 280,
    backgroundColor: 'rgba(139, 92, 246, 0.1)', // Transparent purple tint matching lead cards
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  campaignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  campaignName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginLeft: 8,
  },
  campaignActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncCampaignButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  editCampaignButton: {
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.4)',
  },
  deleteCampaignButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  portfolioPreview: {
    marginTop: 8,
  },
  portfolioPreviewText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  portfolioThumbnails: {
    flexDirection: 'row',
  },
  portfolioThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 6,
    backgroundColor: 'rgba(20, 40, 80, 0.8)',
  },
  morePhotosIndicator: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    fontSize: 10,
    color: '#43cea2',
    fontWeight: '600',
  },
  campaignStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  campaignStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  campaignDetails: {
    gap: 4,
  },
  campaignServices: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  campaignAreas: {
    fontSize: 12,
    color: '#43cea2',
    marginBottom: 4,
  },
  campaignPricing: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  // NEW: Lead Scoring & Temperature Badge Styles
  temperatureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  temperatureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leadScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  // NEW: Competitor Intelligence Card Styles
  competitorIntelligenceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  competitorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  competitorHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  positionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  competitorStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  competitorStatItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 8,
  },
  competitorStatLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 4,
  },
  competitorStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  competitorAdvantage: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    marginBottom: 12,
  },
  competitorAdvantageText: {
    fontSize: 13,
    color: '#E0E7FF',
    fontWeight: '600',
  },
  competitorInsights: {
    gap: 8,
    marginBottom: 12,
  },
  competitorInsightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  competitorInsightText: {
    fontSize: 12,
    color: '#CCC',
    flex: 1,
    lineHeight: 18,
  },
  recommendedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  recommendedActionText: {
    fontSize: 13,
    color: '#FCA5A5',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  // NEW: Tab Navigation Styles
  tabScrollContainer: {
    marginBottom: 12,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 5,
    minWidth: 90,
  },
  tabActive: {
    backgroundColor: 'rgba(67, 206, 162, 0.25)',
    borderColor: '#43cea2',
    borderWidth: 1.5,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabTextActive: {
    color: '#43cea2',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Quick Actions Row
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  messagesButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  createCampaignButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  // Empty Campaigns State
  emptyCampaignsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginTop: 0,
  },
  emptyCampaignsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptyCampaignsText: {
    fontSize: 16,
    color: '#19E180',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
    fontWeight: '600',
  },
  emptyCampaignsSubtext: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  // Campaign Performance Strip
  campaignPerformanceStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  performanceMetric: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  performanceMetricLabel: {
    fontSize: 10,
    color: 'rgba(203, 213, 225, 0.78)',
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.35,
    textTransform: 'uppercase' as const,
    textAlign: 'center',
  },
  performanceMetricValue: {
    fontSize: 17,
    color: '#F8FAFC',
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  networkActivityLabel: {
    fontSize: 10,
    color: 'rgba(186, 199, 216, 0.75)',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  performanceMetricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 4,
  },
  // Campaign Performance Card
  campaignPerformanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  campaignCardHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  campaignTradeSection: {
    gap: 8,
  },
  campaignMetricsPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  campaignMetricsPanelLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  campaignPerformanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  campaignPerformanceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 12,
  },
  campaignPerformanceTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  campaignPerformanceTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  campaignPerformanceLocation: {
    fontSize: 13,
    color: 'rgba(203, 213, 225, 0.82)',
    fontWeight: '500',
    marginBottom: 0,
  },
  campaignServicesDescription: {
    fontSize: 13,
    color: '#7DD3FC',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: 0,
    lineHeight: 18,
  },
  campaignStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  campaignStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Subscription Badge
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    gap: 8,
  },
  subscriptionBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FBBF24',
    marginRight: 4,
  },
  subscriptionBadgeSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  // Time Period Toggle
  timePeriodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 5,
    marginBottom: 18,
    marginTop: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timePeriodButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePeriodButtonActive: {
    backgroundColor: 'rgba(45, 212, 191, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.35)',
  },
  timePeriodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(226, 232, 240, 0.75)',
  },
  timePeriodButtonTextActive: {
    color: '#5EEAD4',
    fontWeight: '700',
  },
  // Campaign Tier Metrics
  campaignTier1Metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    gap: 8,
  },
  campaignTier1Metric: {
    flex: 1,
    alignItems: 'center',
  },
  campaignTier1Label: {
    fontSize: 10,
    color: 'rgba(203, 213, 225, 0.78)',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  campaignTier1Value: {
    fontSize: 26,
    color: '#F8FAFC',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  campaignTier1ValueAwarded: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  campaignTier2Metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 0,
    gap: 8,
  },
  campaignTier2Metric: {
    flex: 1,
    alignItems: 'center',
  },
  campaignTier2Label: {
    fontSize: 10,
    color: 'rgba(203, 213, 225, 0.75)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.25,
  },
  campaignTier2Value: {
    fontSize: 20,
    fontWeight: '700',
  },
  campaignTier2LabelROI: {
    fontSize: 10,
    color: 'rgba(203, 213, 225, 0.75)',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.25,
  },
  campaignTier2ValueROI: {
    fontSize: 18,
    fontWeight: '600',
  },
  campaignTier3Metrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 0,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.09)',
  },
  campaignTier3Metric: {
    flex: 1,
    alignItems: 'center',
  },
  campaignTier3Label: {
    fontSize: 10,
    color: 'rgba(203, 213, 225, 0.72)',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.2,
  },
  campaignTier3Value: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  // Marketplace Reach
  marketplaceReach: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    marginTop: 4,
    gap: 8,
  },
  marketplaceReachText: {
    fontSize: 12,
    color: 'rgba(203, 213, 225, 0.85)',
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
  // AI Optimization Status
  aiOptimizationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    gap: 6,
  },
  aiOptimizationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  campaignPerformanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  campaignViewLeadsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  campaignViewLeadsButtonText: {
    color: '#ecfdf5',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  campaignSecondaryButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  campaignMenuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  campaignPhotos: {
    marginTop: 12,
  },
  campaignPhotosLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  campaignPhotoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
  },
  // Bulk Actions Styles
  bulkActionsBar: {
    backgroundColor: 'rgba(27, 54, 93, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
  },
  bulkActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkActionText: {
    color: '#43cea2',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkActionCount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bulkActionCloseButton: {
    padding: 4,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
  },
  bulkActionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bulkActionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bulkCheckbox: {
    padding: 12,
    marginRight: 8,
  },
  // AI Intelligence Styles
  aiIntelligenceCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  aiIntelligenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  aiIntelligenceHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  aiIntelligenceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  aiIntelligenceItem: {
    flex: 1,
  },
  aiIntelligenceLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    marginBottom: 6,
    fontWeight: '600',
  },
  aiFitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  aiFitScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  aiFitValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  aiCloseProbBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  aiCloseProbValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3B82F6',
    textAlign: 'center',
  },
  aiSuggestedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    gap: 8,
  },
  aiSuggestedActionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
});

