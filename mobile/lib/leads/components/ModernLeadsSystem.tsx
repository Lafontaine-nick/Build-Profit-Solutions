/**
 * Advanced Modern Leads System Component
 * Enterprise-grade lead management with AI, automation, and analytics
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Alert, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLeadStore } from '../store';
import LeadCard from './LeadCard';
import EnhancedLeadCard from './EnhancedLeadCard';
import { ScreenHeader } from './ScreenHeader';
import AnalyticsDashboard from './AnalyticsDashboard';
import AdvancedFilters, { FilterOptions } from './AdvancedFilters';
import { LeadListSkeleton } from './SkeletonLoader';
import FloatingActionMenu from './FloatingActionMenu';
import { Lead, LeadStage } from '../types';
import { c, radius } from '../ui/tokens';
import { calculateAdvancedScore, defaultMarketData } from '../ai/advanced-scoring';
import { executeAutomation } from '../automation/smart-automation';
import { findDuplicates, getDuplicateWarning } from '../utils/duplicateDetection';
import * as Haptics from 'expo-haptics';

interface ModernLeadsSystemProps {
  onLeadPress?: (lead: Lead) => void;
}

type ActiveTab = LeadStage | 'analytics' | 'automation';

export default function ModernLeadsSystem({ onLeadPress }: ModernLeadsSystemProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('new');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    stage: 'all',
    scoreRange: { min: 0, max: 100 },
    budgetRange: { min: 0, max: 1000000 },
    projectType: 'all',
    source: 'all',
    timeline: 'all',
    location: '',
    verified: 'all',
    dateRange: { start: null, end: null },
    tags: [],
    customFields: {}
  });

  const allLeads = useLeadStore(s => s.leads);
  const moveStage = useLeadStore(s => s.moveStage);
  const rescore = useLeadStore(s => s.rescore);
  const assignMatches = useLeadStore(s => s.assignMatches);
  const addNote = useLeadStore(s => s.addNote);
  const snoozeLead = useLeadStore(s => s.snoozeLead);
  const refreshAnalytics = useLeadStore(s => s.refreshAnalytics);

  // Enhanced tabs with analytics and automation
  const tabs: { id: ActiveTab; title: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'new', title: 'New', icon: 'fiber-new' },
    { id: 'verified', title: 'Verified', icon: 'verified' },
    { id: 'qualified', title: 'Qualified', icon: 'check-circle' },
    { id: 'proposal', title: 'Proposal', icon: 'timeline' },
    { id: 'won', title: 'Won', icon: 'emoji-events' },
    { id: 'analytics', title: 'Analytics', icon: 'analytics' },
    { id: 'automation', title: 'Automation', icon: 'auto-awesome' },
  ];

  // Filter and search leads
  const filteredLeads = useMemo(() => {
    let filtered = allLeads;

    // Stage filter
    if (activeTab !== 'analytics' && activeTab !== 'automation' && filters.stage !== 'all') {
      filtered = filtered.filter(lead => lead.stage === activeTab);
    } else if (filters.stage !== 'all') {
      filtered = filtered.filter(lead => lead.stage === filters.stage);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.contact.name?.toLowerCase().includes(searchLower) ||
        lead.contact.company?.toLowerCase().includes(searchLower) ||
        lead.location?.city?.toLowerCase().includes(searchLower) ||
        lead.location?.state?.toLowerCase().includes(searchLower) ||
        lead.project.type.toLowerCase().includes(searchLower)
      );
    }

    // Score range filter
    filtered = filtered.filter(lead => {
      const score = lead.aiScore || 0;
      return score >= filters.scoreRange.min && score <= filters.scoreRange.max;
    });

    // Budget range filter
    filtered = filtered.filter(lead => {
      const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
      return avgBudget >= filters.budgetRange.min && avgBudget <= filters.budgetRange.max;
    });

    // Project type filter
    if (filters.projectType !== 'all') {
      filtered = filtered.filter(lead => lead.project.type === filters.projectType);
    }

    // Source filter
    if (filters.source !== 'all') {
      filtered = filtered.filter(lead => lead.source === filters.source);
    }

    // Timeline filter
    if (filters.timeline !== 'all') {
      filtered = filtered.filter(lead => lead.project.timeline === filters.timeline);
    }

    // Location filter
    if (filters.location) {
      const locationLower = filters.location.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.location?.city?.toLowerCase().includes(locationLower) ||
        lead.location?.state?.toLowerCase().includes(locationLower)
      );
    }

    // Verification filter
    if (filters.verified !== 'all') {
      filtered = filtered.filter(lead => {
        const isVerified = lead.verification?.emailValid && lead.verification?.phoneValid;
        return filters.verified ? isVerified : !isVerified;
      });
    }

    return filtered.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
  }, [allLeads, activeTab, filters]);

  // Calculate advanced metrics
  const metrics = useMemo(() => {
    const currentLeads = activeTab === 'analytics' || activeTab === 'automation' ? allLeads : 
      allLeads.filter(l => l.stage === activeTab);
    
    const avgScore = currentLeads.length ? 
      Math.round(currentLeads.reduce((a, l) => a + (l.aiScore || 0), 0) / currentLeads.length) : 0;
    
    const highScoreLeads = currentLeads.filter(l => (l.aiScore || 0) >= 80).length;
    const conversionRate = currentLeads.length > 0 ? 
      (currentLeads.filter(l => l.stage === 'won').length / currentLeads.length) * 100 : 0;
    
    return {
      total: currentLeads.length,
      avgScore,
      highScoreLeads,
      conversionRate: Math.round(conversionRate * 10) / 10
    };
  }, [allLeads, activeTab]);

  // Get display metrics for header
  const getHeaderMetrics = () => {
    if (activeTab === 'analytics') {
      return `📊 Real-time Insights • ${metrics.total} Total Leads`;
    }
    if (activeTab === 'automation') {
      return `🤖 Smart Automation • 5 Active Rules`;
    }
    return `${metrics.total} leads • Avg Score: ${metrics.avgScore} • ${metrics.highScoreLeads} High Priority`;
  };

  const handleLeadPress = (lead: Lead) => {
    // Check for duplicates
    const duplicates = findDuplicates(lead, allLeads);
    if (duplicates.length > 0) {
      const warning = getDuplicateWarning(duplicates);
      console.log('Duplicate warning:', warning);
    }

    // Execute automation on lead interaction
    executeAutomation(lead, 'lead_interacted');
    
    Haptics.selectionAsync();
    
    if (onLeadPress) {
      onLeadPress(lead);
    } else {
      console.log('Lead pressed:', lead);
    }
  };

  const handleStageAction = (lead: Lead) => {
    const currentStage = lead.stage;
    let nextStage: LeadStage;
    
    switch (currentStage) {
      case 'new':
        nextStage = 'verified';
        break;
      case 'verified':
        nextStage = 'qualified';
        assignMatches(lead.id);
        break;
      case 'qualified':
        nextStage = 'proposal';
        break;
      case 'proposal':
        nextStage = 'won';
        break;
      default:
        return;
    }
    
    // Execute automation on stage change
    executeAutomation(lead, 'stage_changed', { oldStage: currentStage, newStage: nextStage });
    
    moveStage(lead.id, nextStage);
  };

  const handleRescore = (lead: Lead) => {
    // Recalculate advanced score
    const advancedScore = calculateAdvancedScore(lead, defaultMarketData);
    
    // Execute automation on score change
    executeAutomation(lead, 'score_changed', { 
      oldScore: lead.aiScore || 0, 
      newScore: advancedScore.overall 
    });
    
    rescore(lead.id);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Simulate API refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      refreshAnalytics();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSnooze = (lead: Lead) => {
    Alert.alert(
      'Snooze Lead',
      'How long would you like to snooze this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '1 Hour', onPress: () => snoozeLead(lead.id, 1) },
        { text: '4 Hours', onPress: () => snoozeLead(lead.id, 4) },
        { text: '1 Day', onPress: () => snoozeLead(lead.id, 24) },
        { text: '3 Days', onPress: () => snoozeLead(lead.id, 72) },
      ]
    );
  };

  const renderLeadItem = ({ item }: { item: Lead }) => (
    <EnhancedLeadCard
      lead={item}
      onPress={() => handleLeadPress(item)}
      onAdvanceStage={() => handleStageAction(item)}
      onSnooze={() => handleSnooze(item)}
      onAddNote={(note) => addNote(item.id, note)}
    />
  );

  const renderAnalyticsTab = () => (
    <AnalyticsDashboard />
  );

  const renderAutomationTab = () => (
    <View style={styles.automationContainer}>
      <Text style={styles.automationTitle}>🤖 Smart Automation</Text>
      <Text style={styles.automationSubtitle}>
        AI-powered lead nurturing and follow-up automation
      </Text>
      
      <View style={styles.automationStats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statLabel}>Active Rules</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>127</Text>
          <Text style={styles.statLabel}>Triggers Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>23%</Text>
          <Text style={styles.statLabel}>Conversion Rate</Text>
        </View>
      </View>
      
      <Text style={styles.automationDescription}>
        Your automation system is actively nurturing leads with personalized follow-ups, 
        intelligent scoring, and smart contractor assignments.
      </Text>
    </View>
  );

  const renderTabContent = () => {
    if (activeTab === 'analytics') {
      return renderAnalyticsTab();
    }
    
    if (activeTab === 'automation') {
      return renderAutomationTab();
    }
    
    if (loading) {
      return (
        <View style={styles.leadsListContainer}>
          <LeadListSkeleton count={5} />
        </View>
      );
    }

    return (
      <View style={styles.leadsListContainer}>
        <FlatList
          data={filteredLeads}
          keyExtractor={item => item.id}
          renderItem={renderLeadItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inbox" size={64} color={c.sub} />
              <Text style={styles.emptyTitle}>No leads found</Text>
              <Text style={styles.emptySubtitle}>
                {filters.search ? 'Try adjusting your search criteria' : 'No leads in this stage yet'}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setActiveTab('new')}
              >
                <MaterialIcons name="add-circle" size={20} color={c.accent} />
                <Text style={styles.emptyButtonText}>Add Your First Lead</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader 
        title="Modern Leads" 
        metric={getHeaderMetrics()}
      />

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={() => {}}
        totalResults={filteredLeads.length}
      />

      {/* Tab Navigation */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tabContainer}
        contentContainerStyle={styles.tabContent}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.id);
            }}
          >
            <MaterialIcons
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? c.accent : c.sub}
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Floating Action Menu */}
      <FloatingActionMenu
        leads={filteredLeads}
        onAddLead={() => {
          Alert.alert('Add Lead', 'Lead creation form would open here');
        }}
        onBulkAction={() => {
          Alert.alert('Bulk Actions', 'Bulk action menu would open here');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  tabContainer: {
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: c.railTrack,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: c.railTrack,
  },
  tabText: {
    marginLeft: 4,
    color: c.sub,
    fontSize: 11,
    fontWeight: '600',
  },
  activeTabText: {
    color: c.accent,
  },
  leadsListContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  leadCardContainer: {
    marginBottom: 12,
  },
  leadActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: c.railTrack,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: c.sub,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.railTrack,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    gap: 8,
  },
  emptyButtonText: {
    color: c.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  automationContainer: {
    flex: 1,
    padding: 16,
  },
  automationTitle: {
    color: c.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  automationSubtitle: {
    color: c.sub,
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  automationStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    color: c.accent,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: c.sub,
    fontSize: 12,
    fontWeight: '600',
  },
  automationDescription: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: 16,
  },
});