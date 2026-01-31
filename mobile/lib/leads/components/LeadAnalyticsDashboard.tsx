/**
 * Lead Analytics Dashboard
 * Enhanced version with charts, trends, and comprehensive metrics
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Lead, LeadStage } from '../types';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

interface LeadAnalyticsDashboardProps {
  leads: Lead[];
  onStagePress?: (stage: LeadStage | 'all') => void;
  onProjectTypePress?: (projectType: string) => void;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

interface StructuredInsight {
  type: 'risk' | 'opportunity' | 'next-win';
  title: string;
  whyThisMatters: string;
  whatToDoNext: string;
  priority: number; // Lower = higher priority
}

interface Analytics {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  conversionRate: number;
  totalPipeline: number;
  avgLeadValue: number;
  leadsByStage: {
    new: number;
    contacted: number;
    qualified: number;
    proposal: number;
    won: number;
    lost: number;
  };
  leadsByType: { [key: string]: number };
  winRate: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LeadAnalyticsDashboard: React.FC<LeadAnalyticsDashboardProps> = ({ leads, onStagePress, onProjectTypePress }) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [engagementStats, setEngagementStats] = React.useState<any>(null);
  const [engagementData, setEngagementData] = React.useState<Record<string, { bidSubmittedAt?: string; bidWonAt?: string; [key: string]: any }>>({});
  
  // Load engagement stats and data - reload when component mounts or when leads change
  const loadEngagement = React.useCallback(async (forceRefresh: boolean = false) => {
    const { getEngagementStats, getAllEngagementData } = await import('../../../services/engagementTracking');
      const stats = await getEngagementStats(leads.length);
    const allEngagement = await getAllEngagementData(forceRefresh);
    console.log(`📊 Loaded engagement data:`, Object.keys(allEngagement).length, 'leads with engagement');
    const wonLeads = Object.entries(allEngagement).filter(([_, data]: [string, any]) => data.bidWonAt).map(([id, _]) => id);
    console.log(`📊 Bid won data (${wonLeads.length} leads):`, wonLeads);
      setEngagementStats(stats);
    setEngagementData(allEngagement);
  }, [leads.length]);

  // Create a string representation of lead stages to detect changes
  // This is critical for ensuring analytics recalculate when stages change
  const leadsStageSignature = React.useMemo(() => {
    // Defensive: Ensure leads is an array
    if (!Array.isArray(leads)) {
      console.warn('⚠️ Leads is not an array in leadsStageSignature');
      return '';
    }
    
    // Create signature with validation - ensure all leads have valid stages
    const signature = leads
      .filter(l => l && l.id && l.stage) // Filter out invalid leads
      .map(l => `${l.id}:${l.stage || 'new'}`) // Default to 'new' if stage is missing
      .join(',');
    
    console.log(`📊 Leads stage signature updated: ${signature.substring(0, 100)}... (${leads.length} leads, ${leads.filter(l => l && l.id && l.stage).length} valid)`);
    return signature;
  }, [leads]);

  React.useEffect(() => {
    loadEngagement();
  }, [loadEngagement]);

  // Reload engagement data when lead stages change (not just when count changes)
  React.useEffect(() => {
    console.log('📊 Lead stages changed - reloading engagement data');
    loadEngagement(true); // Force refresh to get latest engagement data
  }, [leadsStageSignature, loadEngagement]);

  // Force analytics recalculation when lead stages change
  // This ensures pipeline stages update immediately when a lead card stage changes
  React.useEffect(() => {
    console.log('📊 Lead stages signature changed - analytics will recalculate');
  }, [leadsStageSignature]);

  // Reload engagement data when the analytics dashboard comes into focus
  // This ensures we pick up new engagement data (like bidWonAt) after marking bids as won
  useFocusEffect(
    React.useCallback(() => {
      console.log('📊 Analytics dashboard focused - reloading engagement data (force refresh)');
      loadEngagement(true); // Force refresh to bypass cache
    }, [loadEngagement])
  );

  // Periodic refresh while on analytics tab (every 3 seconds) to catch updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log('📊 Periodic refresh - reloading engagement data');
      loadEngagement(true);
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [loadEngagement]);
  
  // Use all leads (no time filtering)
  const filteredLeads = useMemo(() => {
    // Defensive: Ensure leads is always an array
    if (!Array.isArray(leads)) {
      console.warn('⚠️ Leads is not an array, using empty array');
      return [];
    }
    
    // Filter out invalid leads but keep all valid ones (no time range filtering)
    return leads.filter(lead => {
      // Defensive: Ensure lead has required properties
      if (!lead || !lead.id) {
        console.warn('⚠️ Invalid lead found in filteredLeads:', lead);
        return false;
      }
      return true;
    });
  }, [leads]);
  
  const analytics = useMemo(() => {
    // Defensive: Ensure we have valid data before calculating
    if (!Array.isArray(filteredLeads)) {
      console.warn('⚠️ filteredLeads is not an array, returning empty analytics');
      return calculateAnalytics([], engagementData); // Use calculateAnalytics for consistent structure
    }
    
    try {
    const calculated = calculateAnalytics(filteredLeads, engagementData, engagementStats);
    console.log(`📊 Analytics recalculated: ${calculated.totalLeads} leads`);
    console.log(`📊 Stages breakdown:`, {
        new: calculated.leadsByStage.new,
        contacted: calculated.leadsByStage.contacted,
        qualified: calculated.leadsByStage.qualified,
      proposal: calculated.leadsByStage.proposal,
        won: calculated.leadsByStage.won,
        lost: calculated.leadsByStage.lost
    });
      console.log(`📊 Engagement data keys: ${Object.keys(engagementData).length}, Signature: ${leadsStageSignature.substring(0, 50)}...`);
    return calculated;
    } catch (error) {
      console.error('❌ Error calculating analytics:', error);
      // Return safe default using calculateAnalytics for consistent structure
      return calculateAnalytics([], engagementData, engagementStats);
    }
  }, [filteredLeads, engagementData, engagementStats, leadsStageSignature]); // CRITICAL: leadsStageSignature ensures recalculation when stages change
  
  // Calculate weekly trends for charts (using 'all' time range since filter is removed)
  const trendData = useMemo(
    () => calculateTrendData(filteredLeads, 'all'),
    [filteredLeads, leadsStageSignature]
  );

  const leadChartData = useMemo(() => {
    if (!trendData || !Array.isArray(trendData.chartData)) {
      return [];
    }
    let runningTotal = 0;
    return trendData.chartData.map((point: any) => {
      const value = Number(point?.value ?? 0);
      runningTotal += value;
      return {
        value: runningTotal,
        label: point?.label ?? '',
      };
    });
  }, [trendData]);

  const leadChartMax = useMemo(() => {
    if (leadChartData.length === 0) {
      return 5;
    }
    const total = leadChartData[leadChartData.length - 1]?.value ?? 0;
    const base = total > 0 ? total : 5;
    return Math.ceil(base * 1.25);
  }, [leadChartData]);

  const leadChartStep = useMemo(() => {
    if (leadChartMax <= 5) return 1;
    return Math.max(1, Math.ceil(leadChartMax / 6));
  }, [leadChartMax]);

  const hasLeadTrendData = useMemo(
    () => leadChartData.some(point => point.value > 0),
    [leadChartData]
  );
  
  // Calculate conversion funnel
  const funnelData = useMemo(() => calculateFunnelData(filteredLeads, engagementData), [filteredLeads, engagementData, leadsStageSignature]); // Include leadsStageSignature to force recalculation when stages change

  function computeTrends(ls: Lead[]) {
    const now = Date.now();
    const d7 = 7 * 24 * 60 * 60 * 1000;
    const start7 = now - d7;
    const start14 = now - 2 * d7;

    const inRange = (l: Lead, start: number, end: number) => {
      const t = new Date(l.createdAt ?? 0).getTime();
      return Number.isFinite(t) && t >= start && t < end;
    };

    const last7 = ls.filter(l => inRange(l, start7, now));
    const prev7 = ls.filter(l => inRange(l, start14, start7));

    // Helper to check if lead is won (check both stage and engagement data)
    const isWonLead = (l: Lead): boolean => {
      const isWon = l.stage === 'won';
      const hasWonBidFlag = !!(engagementData[l.id]?.bidWonAt);
      return isWon || hasWonBidFlag;
    };

    const metric = (items: Lead[]) => {
      const total = items.length || 1;
      const won = items.filter(isWonLead).length;
      const lost = items.filter(l => l.stage === 'lost').length;
      const opportunities = won + lost;
      const conversionBase = opportunities > 0 ? opportunities : total;
      const conversion = conversionBase > 0 ? Math.round((won / conversionBase) * 100) : 0;
      const wonCount = won;
      return { conversion, wonCount };
    };

    const m1 = metric(last7);
    const m0 = metric(prev7);

    const diffPct = (curr: number, prev: number) => {
      if (!Number.isFinite(prev) || prev === 0) return 0;
      return Math.round(((curr - prev) / Math.abs(prev)) * 100);
    };

    return {
      conversion: { value: m1.conversion, trend: diffPct(m1.conversion, m0.conversion) },
      won: { value: m1.wonCount, trend: diffPct(m1.wonCount, m0.wonCount) },
    };
  }

  const trends = useMemo(() => computeTrends(filteredLeads), [filteredLeads, engagementData]);

  // Calculate Revenue Pipeline Forecast (AI-weighted)
  const revenueForecast = useMemo(() => {
    // Calculate expected revenue based on win rate and AI scores
    // Active pipeline (leads not won/lost)
    const activeLeads = filteredLeads.filter(l => !['won', 'lost'].includes(l.stage));
    
    // Calculate weighted expected revenue
    // Use AI score (0-100) as probability, or fall back to historical win rate
    const avgWinRate = analytics.winRate / 100; // Convert percentage to decimal
    const baseWinProbability = avgWinRate > 0 ? avgWinRate : 0.25; // Default 25% if no win rate data
    
    let totalExpectedRevenue = 0;
    let bestCaseRevenue = 0;
    let newLeadsUpside = 0;
    
    activeLeads.forEach(lead => {
      const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
      if (avgBudget === 0) return;
      
      // Use AI score as probability (convert 0-100 to 0-1), with fallback to base win rate
      const aiScore = lead.aiScore || 0;
      const probability = aiScore > 0 ? (aiScore / 100) : baseWinProbability;
      
      // Expected revenue = budget × probability
      totalExpectedRevenue += avgBudget * probability;
      
      // Best case: use optimistic probability (70% of AI score, or 50% default)
      const bestCaseProbability = aiScore > 0 ? Math.min(0.9, (aiScore / 100) * 1.2) : 0.5;
      bestCaseRevenue += avgBudget * bestCaseProbability;
      
      // Calculate upside from new leads if contacted today
      // New leads have higher conversion when contacted quickly
      if (lead.stage === 'new') {
        // Fast contact increases probability by ~30%
        const boostedProbability = Math.min(0.9, probability * 1.3);
        const currentExpected = avgBudget * probability;
        const boostedExpected = avgBudget * boostedProbability;
        newLeadsUpside += (boostedExpected - currentExpected);
      }
    });
    
    return {
      expectedRevenue: Math.round(totalExpectedRevenue),
      bestCaseRevenue: Math.round(bestCaseRevenue),
      newLeadsUpside: Math.round(newLeadsUpside),
    };
  }, [filteredLeads, analytics.winRate]);

  // Calculate Today's Focus metrics
  const todaysFocus = useMemo(() => {
    const newLeads = filteredLeads.filter(l => l.stage === 'new');
    const newLeadsCount = newLeads.length;
    
    // Calculate pipeline at risk (value of new leads)
    const pipelineAtRisk = newLeads.reduce((sum, lead) => {
      const min = lead.project.budgetMin || 0;
      const max = lead.project.budgetMax || 0;
      const avgBudget = min > 0 && max > 0 ? (min + max) / 2 : (min || max);
      return sum + avgBudget;
    }, 0);
    
    // Ideal response window: < 4 hours (industry best practice)
    const idealResponseWindow = '< 4 hours';
    
    return {
      newLeadsCount,
      pipelineAtRisk,
      idealResponseWindow,
    };
  }, [filteredLeads]);

  return (
    <View style={styles.container}>
      {/* Time Range Selector */}
      {/* Today's Focus - Actionable decision panel */}
      {todaysFocus.newLeadsCount > 0 && (
        <View style={styles.wideContainer}>
          <LinearGradient
            colors={['#2DFFC4', '#00A6FF']}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.todaysFocusGradientBorder}
          >
            <View
              style={[
                styles.todaysFocusGradientContent,
                !darkMode && { backgroundColor: Colors.bg },
              ]}
            >
              <View style={styles.todaysFocusHeader}>
                <MaterialIcons name="lightbulb" size={24} color="#43cea2" />
                <Text
                  style={[
                    styles.todaysFocusTitle,
                    !darkMode && { color: Colors.text },
                  ]}
                >
                  Today's Focus
                </Text>
              </View>
              
              <View style={styles.todaysFocusMetrics}>
                <View style={styles.todaysFocusMetric}>
                  <MaterialIcons name="fiber-new" size={20} color="#F59E0B" />
                  <Text
                    style={[
                      styles.todaysFocusMetricValue,
                      !darkMode && { color: Colors.text },
                    ]}
                  >
                    {todaysFocus.newLeadsCount}
                  </Text>
                  <Text
                    style={[
                      styles.todaysFocusMetricLabel,
                      !darkMode && { color: Colors.sub },
                    ]}
                  >
                    new leads need contact
                  </Text>
                </View>
                
                <View style={styles.todaysFocusMetric}>
                  <MaterialIcons name="attach-money" size={20} color="#EF4444" />
                  <Text
                    style={[
                      styles.todaysFocusMetricValue,
                      !darkMode && { color: Colors.text },
                    ]}
                  >
                    ${(todaysFocus.pipelineAtRisk / 1000).toFixed(0)}K
                  </Text>
                  <Text
                    style={[
                      styles.todaysFocusMetricLabel,
                      !darkMode && { color: Colors.sub },
                    ]}
                  >
                    in pipeline at risk
                  </Text>
                </View>
                
                <View style={styles.todaysFocusMetric}>
                  <MaterialIcons name="access-time" size={20} color="#3B82F6" />
                  <Text
                    style={[
                      styles.todaysFocusMetricValue,
                      !darkMode && { color: Colors.text },
                    ]}
                  >
                    {todaysFocus.idealResponseWindow}
                  </Text>
                  <Text
                    style={[
                      styles.todaysFocusMetricLabel,
                      !darkMode && { color: Colors.sub },
                    ]}
                  >
                    ideal response window
                  </Text>
                </View>
              </View>
              
              <View style={styles.todaysFocusActions}>
                <TouchableOpacity
                  style={styles.todaysFocusPrimaryCTA}
                  onPress={() => {
                    if (onStagePress) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      console.log('🔍 View New Leads button pressed - navigating to new leads');
                      onStagePress('new');
                    } else {
                      console.warn('⚠️ onStagePress not provided to LeadAnalyticsDashboard');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="list" size={18} color="#FFFFFF" />
                  <Text style={styles.todaysFocusPrimaryCTAText}>View New Leads</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.todaysFocusSecondaryCTA}
                  onPress={() => {
                    if (onStagePress) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onStagePress('new');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.todaysFocusSecondaryCTAText}>View prioritized lead list →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Revenue Pipeline */}
      <View style={styles.wideContainer}>
        <LinearGradient
          colors={['#2DFFC4', '#00A6FF']}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.campaignGradientBorder}
        >
        <View
          style={[
            styles.campaignGradientContent,
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          <View style={styles.section}>
            <View style={styles.analyticsSectionHeader}>
              <Text
                style={[
                  styles.analyticsSectionTitle,
                  !darkMode && { color: Colors.text },
                ]}
              >
                Revenue Pipeline
              </Text>
            </View>
            <View style={styles.revenueGrid}>
              <View style={styles.revenueCard}>
                <Text
                  style={[
                    styles.revenueLabel,
                    !darkMode && { color: Colors.sub },
                  ]}
                >
                  Total Pipeline
                </Text>
                <Text style={styles.revenueValue}>
                  ${(analytics.totalPipeline / 1000).toFixed(1)}K
                </Text>
              </View>
              <View style={styles.revenueCard}>
                <Text
                  style={[
                    styles.revenueLabel,
                    !darkMode && { color: Colors.sub },
                  ]}
                >
                  Closed Revenue
                </Text>
                <Text style={[styles.revenueValue, { color: '#10B981' }]}>
                  ${((funnelData.find(s => s.stage === 'won')?.value || 0) / 1000).toFixed(1)}K
                </Text>
              </View>
            </View>
            
            {/* Revenue Forecast */}
            <View style={styles.revenueForecastContainer}>
              <View style={styles.revenueForecastRow}>
                <Text
                  style={[
                    styles.revenueForecastLabel,
                    !darkMode && { color: Colors.sub },
                  ]}
                >
                  Expected Close (AI-weighted):
                </Text>
                <Text style={styles.revenueForecastValue}>
                  ${(revenueForecast.expectedRevenue / 1000).toFixed(0)}K–${(revenueForecast.bestCaseRevenue / 1000).toFixed(0)}K
                </Text>
              </View>
              {revenueForecast.newLeadsUpside > 0 && (
                <View style={styles.revenueForecastRow}>
                  <Text
                    style={[
                      styles.revenueForecastLabel,
                      !darkMode && { color: Colors.sub },
                    ]}
                  >
                    Best-case if contacted today:
                  </Text>
                  <Text style={[styles.revenueForecastValue, { color: '#43cea2' }]}>
                    +${(revenueForecast.newLeadsUpside / 1000).toFixed(0)}K upside
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>
      </View>

      {/* Pipeline Health - Funnel with Benchmarks */}
      <View style={styles.wideContainer}>
        <LinearGradient
          colors={['#2DFFC4', '#00A6FF']}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.campaignGradientBorder}
        >
        <View
          style={[
            styles.campaignGradientContent,
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          <View style={styles.section}>
            <View style={styles.analyticsSectionHeader}>
              <Text
                style={[
                  styles.analyticsSectionTitle,
                  !darkMode && { color: Colors.text },
                ]}
              >
                Pipeline Health
              </Text>
              <Text
                style={[
                  styles.analyticsSectionSubtitle,
                  !darkMode && { color: Colors.sub },
                ]}
              >
                Progress through your sales funnel
              </Text>
            </View>
        <View style={styles.pipelineHealthContainer}>
          {(() => {
            // Define expected conversion benchmarks (industry standards)
            // These are conversion rates from previous stage to current stage
            const benchmarks: { [key: string]: { min: number; max: number; baseStage: string; useTotal?: boolean } } = {
              'new': { min: 0, max: 0, baseStage: 'new' }, // No benchmark for new - it's the starting point
              'contacted': { min: 60, max: 70, baseStage: 'new', useTotal: true }, // 60-70% of TOTAL leads should be contacted (based on original cohort)
              'qualified': { min: 40, max: 50, baseStage: 'contacted' }, // 40-50% of contacted should be qualified
              'proposal': { min: 30, max: 40, baseStage: 'qualified' }, // 30-40% of qualified should get proposals
              'won': { min: 25, max: 35, baseStage: 'proposal' }, // 25-35% of proposals should close
            };
            
            // Calculate expected counts based on benchmarks
            // Expected counts are calculated from the PREVIOUS stage's count OR total leads for contacted
            const calculateExpected = (stage: string): { min: number; max: number } => {
              const benchmark = benchmarks[stage];
              if (!benchmark || !benchmark.min || !benchmark.max) return { min: 0, max: 0 };
              
              // For "contacted", use total leads (original cohort size) instead of current "new" count
              // This ensures benchmarks stay consistent as leads progress through the pipeline
              // For other stages, use the previous stage's actual count
              const baseCount = benchmark.useTotal 
                ? analytics.totalLeads 
                : (analytics.leadsByStage[benchmark.baseStage as keyof typeof analytics.leadsByStage] || 0);
              
              // Only calculate expected if we have a base count
              if (baseCount === 0) return { min: 0, max: 0 };
              
              // Calculate expected range based on benchmark percentages
              // Use Math.ceil for min to ensure we show at least 1 if base count > 0
              // Use Math.round for max to get a realistic upper bound
              const minExpected = Math.max(1, Math.ceil(baseCount * (benchmark.min / 100)));
              const maxExpected = Math.max(1, Math.round(baseCount * (benchmark.max / 100)));
              
              // Ensure max is at least as large as min
              return { 
                min: minExpected, 
                max: Math.max(minExpected, maxExpected)
              };
            };
            
            // Define stage order for display
            const stageOrder: Array<{ key: string; label: string }> = [
              { key: 'new', label: 'New' },
              { key: 'contacted', label: 'Contacted' },
              { key: 'qualified', label: 'Qualified' },
              { key: 'proposal', label: 'Proposals Sent' },
              { key: 'won', label: 'Won' },
            ];
            
            return stageOrder
              .filter(stage => stage.key !== 'lost') // Skip lost leads in health view
              .map(({ key, label }) => {
                // Get the actual count for this stage (leadsByStage is cumulative)
                const count = analytics.leadsByStage[key as keyof typeof analytics.leadsByStage] || 0;
                
                // Calculate expected based on previous stage
                const expected = calculateExpected(key);
                const isNewStage = key === 'new';
                
                // Only show benchmark comparison if we have an expected range (non-zero)
                // This ensures we only show benchmarks when there's actual data to compare against
                const hasExpectedRange = !isNewStage && expected.min >= 0 && expected.max > 0;
                const hasGap = hasExpectedRange && count < expected.min;
                const isOnTrack = hasExpectedRange && count >= expected.min && count <= expected.max;
                const exceedsBenchmark = hasExpectedRange && count > expected.max;
                
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.pipelineHealthRow}
                    onPress={() => {
                      if (onStagePress) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onStagePress(key as LeadStage);
                      }
                    }}
                    onLongPress={() => {
                      if (count > 0 && onStagePress) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        // Long press shows bulk action option
                        // For now, just filter to that stage (same as tap)
                        // In future, could show ActionSheet with "Call all", "Email all", etc.
                        onStagePress(key as LeadStage);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pipelineHealthLabelRow}>
                      <MaterialIcons name={getStageIcon(key)} size={18} color={getStageColor(key)} />
                      <Text
                        style={[
                          styles.pipelineHealthLabel,
                          !darkMode && { color: Colors.sub },
                        ]}
                      >
                        {label}:
                      </Text>
                      <Text
                        style={[
                          styles.pipelineHealthCount,
                          !darkMode && { color: Colors.text },
                        ]}
                      >
                        {count}
                      </Text>
                      {hasExpectedRange && (
                        <>
                          <Text
                            style={[
                              styles.pipelineHealthDivider,
                              !darkMode && { color: Colors.sub },
                            ]}
                          >
                            /
                          </Text>
                          <Text
                            style={[
                              styles.pipelineHealthExpected,
                              !darkMode && { color: Colors.sub },
                            ]}
                          >
                            {expected.min}–{expected.max}
                          </Text>
                          {hasGap && <Text style={styles.pipelineHealthWarning}> ⚠️</Text>}
                          {isOnTrack && <Text style={styles.pipelineHealthSuccess}> ✓</Text>}
                          {exceedsBenchmark && <Text style={styles.pipelineHealthSuccess}> ↑</Text>}
                        </>
                      )}
                      {count > 0 && (
                        <MaterialIcons name="chevron-right" size={18} color="#6B7280" style={{ marginLeft: 'auto' }} />
                      )}
                    </View>
                    {hasExpectedRange && (
                      <Text
                        style={[
                          styles.pipelineHealthBenchmark,
                          !darkMode && { color: Colors.sub },
                        ]}
                      >
                        {hasGap && `(Benchmark: ${expected.min}–${expected.max})`}
                        {isOnTrack && `(On track)`}
                        {exceedsBenchmark && `(Above benchmark)`}
                      </Text>
                    )}
                    {count > 0 && (
                      <Text
                        style={[
                          styles.pipelineHealthActionHint,
                          !darkMode && { color: Colors.sub },
                        ]}
                      >
                        Tap to filter • Long-press for bulk actions
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              });
          })()}
        </View>
          </View>
        </View>
      </LinearGradient>
      </View>

      {/* AI Insights */}
      <View style={styles.wideContainer}>
        <View
          style={[
            styles.campaignGradientContent,
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          <View style={styles.section}>
            <View style={styles.analyticsSectionHeader}>
              <Text
                style={[
                  styles.analyticsSectionTitle,
                  !darkMode && { color: Colors.text },
                ]}
              >
                AI Coach
              </Text>
              <Text
                style={[
                  styles.analyticsSectionSubtitle,
                  !darkMode && { color: Colors.sub },
                ]}
              >
                Structured insights to guide your actions
              </Text>
            </View>
            {(() => {
              const structuredInsights = generateStructuredInsights(analytics, filteredLeads, engagementData);
              const displayedInsights = insightsExpanded ? structuredInsights : structuredInsights.slice(0, 1);
              
              return (
                <>
                  {displayedInsights.map((insight, index) => {
                    const iconName = insight.type === 'risk' ? 'warning' : insight.type === 'opportunity' ? 'lightbulb' : 'emoji-events';
                    const iconColor = insight.type === 'risk' ? '#EF4444' : insight.type === 'opportunity' ? '#F59E0B' : '#10B981';
                    
                    return (
                      <View
                        key={index}
                        style={[
                          styles.structuredInsightCard,
                          !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
                        ]}
                      >
                        <View style={styles.structuredInsightHeader}>
                          <MaterialIcons name={iconName} size={20} color={iconColor} />
                          <Text style={[styles.structuredInsightTitle, { color: iconColor }]}>{insight.title}</Text>
                        </View>
                        <View style={styles.structuredInsightBody}>
                          <View style={styles.structuredInsightRow}>
                            <Text
                              style={[
                                styles.structuredInsightLabel,
                                !darkMode && { color: Colors.sub },
                              ]}
                            >
                              Why this matters:
                            </Text>
                            <Text
                              style={[
                                styles.structuredInsightValue,
                                !darkMode && { color: Colors.text },
                              ]}
                            >
                              {insight.whyThisMatters}
                            </Text>
                          </View>
                          <View style={styles.structuredInsightRow}>
                            <Text
                              style={[
                                styles.structuredInsightLabel,
                                !darkMode && { color: Colors.sub },
                              ]}
                            >
                              What to do next:
                            </Text>
                            <Text
                              style={[
                                styles.structuredInsightValue,
                                styles.structuredInsightAction,
                                !darkMode && { color: Colors.text },
                              ]}
                            >
                              {insight.whatToDoNext}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  {structuredInsights.length > 1 && (
                    <TouchableOpacity
                      style={styles.insightsDisclosure}
                      onPress={() => {
                        setInsightsExpanded(!insightsExpanded);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.insightsDisclosureText}>
                        {insightsExpanded ? 'Show less' : `View all ${structuredInsights.length} insights`}
                      </Text>
                      <MaterialIcons 
                        name={insightsExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                        size={20} 
                        color="#43cea2" 
                      />
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </View>
      
      <View style={{ height: 100 }} />
    </View>
  );
};

/**
 * Calculate analytics from leads
 * @param leads - Array of leads to analyze
 * @param engagementData - Optional engagement data to check for bid submission status
 * @param engagementStats - Optional engagement stats for time calculations
 */
function calculateAnalytics(leads: Lead[], engagementData: Record<string, { bidSubmittedAt?: string; bidWonAt?: string; firstContactedAt?: string }> = {}, engagementStats?: any): Analytics {
  const totalLeads = leads.length;
  
  // Count by temperature (we'll calculate this based on lead characteristics)
  let hotLeads = 0;
  let warmLeads = 0;
  let coldLeads = 0;
  
  leads.forEach(lead => {
    const budget = (lead.project.budgetMin + lead.project.budgetMax) / 2;
    const isUrgent = lead.project.timeline.toLowerCase().includes('immediate') || 
                     lead.project.timeline.toLowerCase().includes('asap');
    
    if (budget > 30000 && isUrgent) hotLeads++;
    else if (budget > 15000 || isUrgent) warmLeads++;
    else coldLeads++;
  });
  
  // Calculate pipeline value - sum of average budget for active leads (not won/lost)
  const totalPipeline = leads
    .filter(l => {
      // Only include active leads (not won or lost)
      const isActive = !['won', 'lost'].includes(l.stage);
      // Also ensure the lead has a valid budget
      const hasBudget = l.project && (
        (typeof l.project.budgetMin === 'number' && l.project.budgetMin > 0) ||
        (typeof l.project.budgetMax === 'number' && l.project.budgetMax > 0)
      );
      return isActive && hasBudget;
    })
    .reduce((sum, lead) => {
      // Calculate average budget, handling missing values
      const min = lead.project.budgetMin || 0;
      const max = lead.project.budgetMax || 0;
      // If only one value exists, use it; otherwise average
      const avgBudget = min > 0 && max > 0 ? (min + max) / 2 : (min || max);
      return sum + avgBudget;
    }, 0);
  
  const avgLeadValue = totalLeads > 0 
    ? leads.reduce((sum, lead) => sum + (lead.project.budgetMin + lead.project.budgetMax) / 2, 0) / totalLeads
    : 0;
  
  // Helper function to check if lead has reached a milestone (cumulative)
  // Returns true if lead has reached or progressed past the target stage
  const hasReachedStage = (lead: Lead, targetStage: string): boolean => {
    const stageOrder = ['new', 'contacted', 'qualified', 'proposal', 'won'];
    
    // Lost leads only count in lost stage
    if (lead.stage === 'lost') return targetStage === 'lost';
    
    // For 'new' stage, only count leads currently in 'new'
    if (targetStage === 'new') return lead.stage === 'new';
    
    // Handle proposal-sent as equivalent to proposal
    const currentStage = lead.stage === 'proposal-sent' ? 'proposal' : lead.stage;
    const currentStageIndex = stageOrder.indexOf(currentStage);
    const targetStageIndex = stageOrder.indexOf(targetStage);
    
    // If current stage is not in order (unknown stage), don't count it
    if (currentStageIndex === -1 || targetStageIndex === -1) {
      return targetStage === currentStage;
    }
    
    // Lead has reached milestone if it's at or past the target stage
    return currentStageIndex >= targetStageIndex;
  };
  
  // Helper function to check if a bid has been submitted for a lead
  const hasSubmittedBid = (lead: Lead): boolean => {
    const engagement = engagementData[lead.id];
    return !!(engagement?.bidSubmittedAt);
  };
  
  // Helper function to check if a bid has been won for a lead
  const hasWonBid = (lead: Lead): boolean => {
    const engagement = engagementData[lead.id];
    const hasWon = !!(engagement?.bidWonAt);
    if (hasWon) {
      console.log(`🎉 Lead ${lead.id} has bidWonAt: ${engagement.bidWonAt}`);
    }
    return hasWon;
  };
  
  // Count by stage (cumulative - includes leads that have progressed past this stage)
  // For proposal stage: only count leads where bid was actually submitted to client
  // For won stage: count leads where bid was marked as won in bid builder (via bidWonAt) or lead stage is 'won'
  const leadsByStage = {
    new: leads.filter(l => l.stage === 'new').length,
    contacted: leads.filter(l => hasReachedStage(l, 'contacted')).length,
    qualified: leads.filter(l => hasReachedStage(l, 'qualified')).length,
    proposal: leads.filter(l => {
      // Proposal stage: only count if bid was actually submitted to client
      // Either the lead stage is proposal/proposal-sent (bid submitted and stage updated),
      // OR engagement data shows bidSubmittedAt (bid submitted, even if stage not updated yet)
      const isInProposalStage = l.stage === 'proposal' || l.stage === 'proposal-sent';
      const hasSubmittedBidFlag = hasSubmittedBid(l);
      const hasReachedQualified = hasReachedStage(l, 'qualified');
      
      const shouldCount = (isInProposalStage || hasSubmittedBidFlag) && hasReachedQualified;
      
      // Log all leads being checked, not just those that pass
      if (isInProposalStage || hasSubmittedBidFlag) {
        console.log(`🔍 Proposal check: Lead ${l.id} (${l.title}) - stage: ${l.stage}, isInProposalStage: ${isInProposalStage}, hasSubmittedBidFlag: ${hasSubmittedBidFlag}, hasReachedQualified: ${hasReachedQualified}, shouldCount: ${shouldCount}`);
      }
      
      // Count if bid was submitted, and lead has reached at least qualified stage (must be qualified to submit bid)
      return shouldCount;
    }).length,
    won: leads.filter(l => {
      // Won stage: count if lead stage is won OR engagement data shows bidWonAt (bid marked as won in bid builder)
      const isWon = l.stage === 'won';
      const hasWonBidFlag = hasWonBid(l);
      
      const shouldCount = isWon || hasWonBidFlag;
      
      if (shouldCount) {
        console.log(`✅ Won: Lead ${l.id} (${l.title}) - isWon: ${isWon}, hasWonBidFlag: ${hasWonBidFlag}`);
      }
      
      return shouldCount;
    }).length,
    lost: leads.filter(l => l.stage === 'lost').length,
  };
  
  // Count by project type - map to specific categories
  const leadsByType: { [key: string]: number } = {
    'kitchen_remodel': 0,
    'bathroom_remodel': 0,
    'new_build': 0,
    'other': 0
  };
  
  const kitchenLeads: Lead[] = [];
  const bathroomLeads: Lead[] = [];
  const newBuildLeads: Lead[] = [];
  
  leads.forEach(lead => {
    const projectType = lead.project.type?.toLowerCase() || '';
    const title = lead.title?.toLowerCase() || '';
    const description = lead.description?.toLowerCase() || '';
    const searchText = `${projectType} ${title} ${description}`;
    
    // Map project types to categories
    // Also check title and description for keywords
    if (projectType === 'kitchen' || searchText.includes('kitchen')) {
      leadsByType['kitchen_remodel']++;
      kitchenLeads.push(lead);
    } else if (projectType === 'bathroom' || searchText.includes('bathroom')) {
      leadsByType['bathroom_remodel']++;
      bathroomLeads.push(lead);
    } else if (projectType === 'new_build' || projectType === 'new-build' || searchText.includes('new build') || searchText.includes('construction')) {
      leadsByType['new_build']++;
      newBuildLeads.push(lead);
    } else {
      leadsByType['other']++;
    }
  });
  
  // Debug logging for kitchen leads
  if (leadsByType['kitchen_remodel'] > 0) {
    console.log(`🍳 Kitchen Remodel leads (${leadsByType['kitchen_remodel']}):`, 
      kitchenLeads.map(l => ({
        id: l.id,
        title: l.title,
        projectType: l.project.type,
        stage: l.stage
      }))
    );
  }
  
  // Calculate win rate
  // Win rate = Won leads / (Won + Lost + Active Proposals)
  // This gives a more meaningful metric by including proposals that are still pending
  const activeProposals = leads.filter(l => {
    // Count leads in proposal stage that haven't been won or lost yet
    const isInProposalStage = l.stage === 'proposal' || l.stage === 'proposal-sent';
    const hasSubmittedBidFlag = hasSubmittedBid(l);
    const hasReachedQualified = hasReachedStage(l, 'qualified');
    const isWon = l.stage === 'won' || hasWonBid(l);
    const isLost = l.stage === 'lost';
    
    // Active proposal = submitted bid, qualified, but not won or lost
    return (isInProposalStage || hasSubmittedBidFlag) && hasReachedQualified && !isWon && !isLost;
  }).length;
  
  const totalProposalsSubmitted = leadsByStage.won + leadsByStage.lost + activeProposals;
  const winRate = totalProposalsSubmitted > 0 ? Math.round((leadsByStage.won / totalProposalsSubmitted) * 100) : 0;
  
  // Calculate conversion rate (won leads / (won + lost)) with fallback to total leads
  const closeOpportunities = leadsByStage.won + leadsByStage.lost;
  const conversionRate = closeOpportunities > 0
    ? Math.round((leadsByStage.won / closeOpportunities) * 100)
    : (totalLeads > 0 ? Math.round((leadsByStage.won / totalLeads) * 100) : 0);
  
  // Debug logging for conversion rate and leads won
  console.log(`📊 Conversion Rate Calculation: ${leadsByStage.won} won / ${closeOpportunities || totalLeads} opportunities = ${conversionRate}%`);
  console.log(`📊 Leads Won Count: ${leadsByStage.won} (from ${leads.length} filtered leads)`);
  
  return {
    totalLeads,
    hotLeads,
    warmLeads,
    coldLeads,
    conversionRate,
    totalPipeline: Math.round(totalPipeline),
    avgLeadValue: Math.round(avgLeadValue),
    leadsByStage,
    leadsByType,
    winRate,
  };
}

/**
 * Calculate trend data for charts - grouped by weeks
 */
function calculateTrendData(leads: Lead[], timeRange: TimeRange) {
  const now = new Date();
  const chartData: Array<{ value: number; label?: string }> = [];
  const sourceMap = new Map<string, { count: number; conversions: number }>();
  
  // First, find the actual date range of all leads
  let oldestLeadDate = now;
  let newestLeadDate = new Date(0);
  
  if (leads.length > 0) {
    leads.forEach(lead => {
      const leadDate = new Date(lead.createdAt ?? 0);
      if (!isNaN(leadDate.getTime())) {
        if (leadDate < oldestLeadDate) oldestLeadDate = leadDate;
        if (leadDate > newestLeadDate) newestLeadDate = leadDate;
      }
    });
  }
  
  // If no valid dates found, use current date
  if (oldestLeadDate === now && newestLeadDate.getTime() === 0) {
    oldestLeadDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    newestLeadDate = now;
  }
  
  // Calculate the reference date and weeks to show based on time range
  let startDate: Date;
  let endDate: Date;
  let weeksToShow: number;
  
  if (timeRange === '7d') {
    endDate = now;
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    weeksToShow = 1;
  } else if (timeRange === '30d') {
    endDate = now; // Always show up to current date
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    weeksToShow = 4;
  } else if (timeRange === '90d') {
    endDate = now; // Always show up to current date
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    weeksToShow = 12;
  } else {
    // 'all' - use actual lead date range, but ensure we show up to current date
    startDate = oldestLeadDate;
    endDate = newestLeadDate > now ? newestLeadDate : now; // Show up to now if leads are older, or to newest lead if newer
    const weeksDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    weeksToShow = Math.max(12, weeksDiff + 1); // At least 12 weeks, or more if needed
  }
  
  // Get the start of the first week (Monday of the week containing startDate)
  const firstWeekStart = new Date(startDate);
  const dayOfWeek = firstWeekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  firstWeekStart.setDate(firstWeekStart.getDate() - daysToMonday);
  firstWeekStart.setHours(0, 0, 0, 0);
  
  // Cap endDate to today (don't generate future weeks)
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const cappedEndDate = endDate > today ? today : endDate;
  
  // Get the start of the current week (Monday of the week containing today)
  const currentWeekStart = new Date(today);
  const currentDayOfWeek = currentWeekStart.getDay();
  const currentDaysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  currentWeekStart.setDate(currentWeekStart.getDate() - currentDaysToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  // Calculate how many weeks we need to cover from firstWeekStart to currentWeekStart
  const totalWeeksNeeded = Math.ceil((currentWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const actualWeeksToShow = Math.max(totalWeeksNeeded, weeksToShow); // Always show enough weeks to cover the full range
  
  // Generate week data starting from the first week, always include the current week containing today
  for (let i = 0; i < actualWeeksToShow; i++) {
    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    
    // Always include the current week (the week containing today), even if it starts before today
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // If this week contains today, include it (don't skip it)
    const weekContainsToday = weekStart <= today && weekEnd >= today;
    
    // If week starts after today AND doesn't contain today, stop generating
    if (weekStart > today && !weekContainsToday) {
      break;
    }
    
    // Cap weekEnd to today if it extends beyond
    if (weekEnd > today) {
      weekEnd.setTime(today.getTime());
    }
    
    const leadsInInterval = leads.filter(lead => {
      const created = new Date(lead.createdAt ?? 0);
      if (isNaN(created.getTime())) return false;
      return created >= weekStart && created <= weekEnd;
    });
    
    // Format label as "MMM DD" (e.g., "Oct 13" or "Nov 3" for week containing Nov 5)
    const startDateLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    chartData.push({
      value: leadsInInterval.length,
      label: startDateLabel
    });
    
    // Debug logging for current week
    if (weekContainsToday) {
      console.log(`📅 Generated current week: ${startDateLabel} (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}), contains today, ${leadsInInterval.length} leads`);
    }
    
    // Track source performance
    leadsInInterval.forEach(lead => {
      const existing = sourceMap.get(lead.source) || { count: 0, conversions: 0 };
      existing.count++;
      if (lead.stage === 'won') existing.conversions++;
      sourceMap.set(lead.source, existing);
    });
    
    // If we've included the current week, we're done
    if (weekContainsToday) {
      break;
    }
  }
  
  // Debug: Log all generated weeks
  console.log(`📊 Generated ${chartData.length} weeks total. Last week: ${chartData[chartData.length - 1]?.label}`);
  
  const sourcePerformance = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source: source.charAt(0).toUpperCase() + source.slice(1).replace('_', ' '),
      count: data.count,
      conversion: data.count > 0 ? (data.conversions / data.count) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);
  
  return { chartData, sourcePerformance };
}

/**
 * Calculate conversion funnel data
 * @param leads - Array of leads to analyze
 * @param engagementData - Optional engagement data to check for bid submission status
 */
function calculateFunnelData(leads: Lead[], engagementData: Record<string, { bidSubmittedAt?: string; bidWonAt?: string }> = {}) {
  // Helper to check if bid was submitted
  const hasSubmittedBid = (lead: Lead): boolean => {
    const engagement = engagementData[lead.id];
    const hasSubmitted = !!(engagement?.bidSubmittedAt);
    if (hasSubmitted) {
      console.log(`📤 Funnel: Lead ${lead.id} has bidSubmittedAt: ${engagement.bidSubmittedAt}`);
    }
    return hasSubmitted;
  };
  
  // Helper to check if bid was won
  const hasWonBid = (lead: Lead): boolean => {
    const engagement = engagementData[lead.id];
    const hasWon = !!(engagement?.bidWonAt);
    if (hasWon) {
      console.log(`🎉 Funnel: Lead ${lead.id} has bidWonAt: ${engagement.bidWonAt}`);
    }
    return hasWon;
  };
  
  const stages: Array<{ stage: string; label: string; count: number; value: number }> = [
    { stage: 'new', label: 'New Leads', count: leads.filter(l => l.stage === 'new').length, value: 0 },
    { stage: 'contacted', label: 'Contacted', count: leads.filter(l => l.stage === 'contacted').length, value: 0 },
    { stage: 'qualified', label: 'Qualified', count: leads.filter(l => l.stage === 'qualified').length, value: 0 },
    { stage: 'proposal', label: 'Proposal Sent', count: leads.filter(l => {
      // Only count leads where bid was actually submitted
      const isInProposalStage = l.stage === 'proposal' || l.stage === 'proposal-sent';
      return isInProposalStage || hasSubmittedBid(l);
    }).length, value: 0 },
    { stage: 'won', label: 'Won', count: leads.filter(l => {
      // Count if lead stage is won OR engagement data shows bidWonAt (bid marked as won in bid builder)
      const isWon = l.stage === 'won';
      return isWon || hasWonBid(l);
    }).length, value: 0 },
  ];
  
  // Calculate revenue value for each stage
  stages.forEach(stage => {
    const stageLeads = leads.filter(l => l.stage === stage.stage || 
      (stage.stage === 'proposal' && l.stage === 'proposal-sent'));
    stage.value = stageLeads.reduce((sum, lead) => {
      const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
      return sum + avgBudget;
    }, 0);
  });
  
  return stages.filter(s => s.count > 0 || s.stage === 'won' || s.stage === 'new');
}

/**
 * Get color for source chart
 */
function getSourceColor(index: number): string {
  const colors = ['#43cea2', '#667eea', '#F59E0B', '#EF4444', '#8B5CF6'];
  return colors[index % colors.length];
}

/**
 * Calculate average time to first contact (in hours)
 */
function calculateTimeToFirstContact(leads: Lead[], engagementData: Record<string, { firstContactedAt?: string }>): string {
  const contactedLeads = leads.filter(l => {
    const engagement = engagementData[l.id];
    return l.stage !== 'new' || engagement?.firstContactedAt;
  });

  if (contactedLeads.length === 0) return 'N/A';

  const times: number[] = [];
  contactedLeads.forEach(lead => {
    const engagement = engagementData[lead.id];
    const createdAt = new Date(lead.createdAt ?? 0).getTime();
    const firstContacted = engagement?.firstContactedAt 
      ? new Date(engagement.firstContactedAt).getTime()
      : lead.stage !== 'new' ? new Date(lead.createdAt ?? 0).getTime() + (24 * 60 * 60 * 1000) // Estimate 24h if no data
      : null;
    
    if (firstContacted && firstContacted > createdAt) {
      const hours = (firstContacted - createdAt) / (1000 * 60 * 60);
      times.push(hours);
    }
  });

  if (times.length === 0) return 'N/A';
  
  const avgHours = times.reduce((a, b) => a + b, 0) / times.length;
  if (avgHours < 24) return `${Math.round(avgHours)}h`;
  return `${Math.round(avgHours / 24)}d`;
}

/**
 * Calculate Contact → Proposal conversion rate
 */
function calculateContactToProposalRate(analytics: Analytics): number {
  const contacted = analytics.leadsByStage.contacted;
  const proposals = analytics.leadsByStage.proposal;
  if (contacted === 0) return 0;
  return Math.round((proposals / contacted) * 100);
}

/**
 * Generate AI Coach insight with actionable recommendation
 */
function generateAICoachInsight(analytics: Analytics, leads: Lead[], engagementData: Record<string, any>): string | null {
  const contacted = analytics.leadsByStage.contacted;
  const proposals = analytics.leadsByStage.proposal;
  const won = analytics.leadsByStage.won;
  const newLeads = analytics.leadsByStage.new;
  const total = analytics.totalLeads;
  
  // Calculate time to first contact
  const avgTimeToContact = calculateTimeToFirstContact(leads, engagementData);
  const timeToContactHours = avgTimeToContact !== 'N/A' 
    ? (avgTimeToContact.includes('d') ? parseFloat(avgTimeToContact) * 24 : parseFloat(avgTimeToContact))
    : null;
  
  // Analyze conversion issues
  const contactToProposalRate = calculateContactToProposalRate(analytics);
  const proposalToWinRate = analytics.winRate;
  
  // Primary insight: Time to first contact
  if (timeToContactHours !== null && timeToContactHours > 24) {
    return `You're generating leads, but conversion is stalled. Focus on contacting new leads within 1 hour to improve close rate by ~18%.`;
  }
  
  // Secondary insight: Contact to proposal conversion
  if (contacted > 0 && contactToProposalRate < 20) {
    return `You're contacting leads well (${contacted} contacted), but only ${contactToProposalRate}% convert to proposals. Improve qualification process to increase proposal rate.`;
  }
  
  // Tertiary insight: Proposal to win rate
  if (proposals > 0 && proposalToWinRate < 25) {
    return `${proposalToWinRate}% win rate from ${proposals} proposals suggests pricing or scope clarity gaps. Review winning vs losing proposals for patterns.`;
  }
  
  // Positive insight if all metrics are good
  if (timeToContactHours !== null && timeToContactHours <= 24 && contactToProposalRate >= 20 && proposalToWinRate >= 25) {
    return `Strong performance across all metrics! Maintain current process and focus on lead volume for growth.`;
  }
  
  // Default: Backlog issue
  if (newLeads > total * 0.3) {
    return `You have ${newLeads} new leads (${Math.round((newLeads/total)*100)}% of pipeline). Prioritize outreach to reduce backlog and improve time-to-contact.`;
  }
  
  return null;
}

/**
 * Generate structured ranked insights based on analytics
 */
function generateStructuredInsights(analytics: Analytics, leads: Lead[], engagementData: Record<string, any>): StructuredInsight[] {
  const insights: StructuredInsight[] = [];
  
  // RISK: Pipeline untouched (100% of pipeline is new)
  const newLeadsPercent = analytics.totalLeads > 0 ? (analytics.leadsByStage.new / analytics.totalLeads) * 100 : 0;
  if (newLeadsPercent === 100 && analytics.totalLeads > 0) {
    insights.push({
      type: 'risk',
      title: '100% of pipeline is untouched',
      whyThisMatters: 'Delays reduce win probability by ~32%',
      whatToDoNext: 'Contact all new leads within 4 hours',
      priority: 1,
    });
  } else if (newLeadsPercent > 70 && analytics.totalLeads > 3) {
    insights.push({
      type: 'risk',
      title: `${Math.round(newLeadsPercent)}% of pipeline is untouched`,
      whyThisMatters: 'Delays reduce win probability by ~25%',
      whatToDoNext: 'Prioritize outreach to reduce backlog',
      priority: 2,
    });
  }
  
  // OPPORTUNITY: Project types converting faster
  // Find project types with highest conversion rates
  const projectTypeStats: { [key: string]: { count: number; won: number } } = {};
  leads.forEach(lead => {
    const type = lead.project.type || 'other';
    if (!projectTypeStats[type]) {
      projectTypeStats[type] = { count: 0, won: 0 };
    }
    projectTypeStats[type].count++;
    if (lead.stage === 'won') {
      projectTypeStats[type].won++;
    }
  });
  
  // Find project types with best conversion rates (if enough data)
  let opportunityFound = false;
  Object.entries(projectTypeStats).forEach(([type, stats]) => {
    if (!opportunityFound && stats.count >= 3 && stats.won > 0) {
      const conversionRate = (stats.won / stats.count) * 100;
      if (conversionRate > analytics.winRate * 1.5 && conversionRate > 20) {
        insights.push({
          type: 'opportunity',
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} leads converting ${Math.round(conversionRate)}% faster`,
          whyThisMatters: `${Math.round(conversionRate)}% conversion vs ${analytics.winRate}% average`,
          whatToDoNext: 'Prioritize these project types',
          priority: 3,
        });
        opportunityFound = true; // Only add one opportunity insight
      }
    }
  });
  
  // NEXT WIN: Best lead with highest close probability
  const qualifiedLeads = leads.filter(l => ['qualified', 'proposal'].includes(l.stage));
  if (qualifiedLeads.length > 0) {
    const bestLead = qualifiedLeads.reduce((best, lead) => {
      const bestScore = best.aiScore || 0;
      const leadScore = lead.aiScore || 0;
      return leadScore > bestScore ? lead : best;
    }, qualifiedLeads[0]);
    
    const bestScore = bestLead.aiScore || 0;
    if (bestScore >= 70) {
      insights.push({
        type: 'next-win',
        title: `Best lead has ${bestScore}% close probability`,
        whyThisMatters: `${bestScore}% win probability based on lead characteristics`,
        whatToDoNext: 'Contact first',
        priority: 1,
      });
    }
  }
  
  // RISK: Low win rate
  if (analytics.winRate > 0 && analytics.winRate < 15 && analytics.leadsByStage.proposal >= 3) {
    insights.push({
      type: 'risk',
      title: `${analytics.winRate}% win rate below benchmark`,
      whyThisMatters: 'Industry average is 25-30%. Gaps in pricing or scope clarity.',
      whatToDoNext: 'Review proposal pricing, scope clarity, and follow-up timing',
      priority: 2,
    });
  }
  
  // OPPORTUNITY: High-value leads
  if (!opportunityFound && analytics.avgLeadValue > 50000) {
    insights.push({
      type: 'opportunity',
      title: `High-value leads averaging $${(analytics.avgLeadValue / 1000).toFixed(0)}K`,
      whyThisMatters: 'Above average lead value increases revenue potential',
      whatToDoNext: 'Prioritize relationship building and detailed proposals',
      priority: 3,
    });
  }
  
  // Sort by priority (lower = higher priority)
  insights.sort((a, b) => a.priority - b.priority);
  
  // Return top 3 insights
  return insights.slice(0, 3);
}

/**
 * Generate AI-powered insights based on analytics (legacy function, kept for compatibility)
 */
function generateInsights(analytics: Analytics, filteredCount: number, totalCount: number): string[] {
  const insights: string[] = [];
  
  // Pipeline health analysis
  const pipelineHealth = analytics.totalPipeline;
  if (pipelineHealth > 200000) {
    insights.push(`💰 Your pipeline is strong at $${(pipelineHealth / 1000).toFixed(0)}K - focus on converting qualified leads to proposals`);
  } else if (pipelineHealth > 50000) {
    insights.push(`📈 Pipeline value of $${(pipelineHealth / 1000).toFixed(0)}K - accelerate movement from qualified to proposal stage`);
  } else if (pipelineHealth > 0) {
    insights.push(`⚠️ Pipeline needs growth - focus on qualifying more leads to increase potential revenue`);
  }
  
  // Win rate analysis with actionable recommendations
  if (analytics.winRate >= 50) {
    insights.push(`🎯 Outstanding ${analytics.winRate}% win rate! Your proposal quality and follow-up process are highly effective`);
  } else if (analytics.winRate >= 30) {
    insights.push(`✅ ${analytics.winRate}% win rate is solid - continue refining proposals and client communication`);
  } else if (analytics.winRate >= 15 && analytics.winRate > 0) {
    const proposals = analytics.leadsByStage.proposal;
    const won = analytics.leadsByStage.won;
    insights.push(`📊 ${analytics.winRate}% win rate - analyze ${proposals} active proposals to identify patterns for improvement`);
  } else if (analytics.winRate > 0 && analytics.winRate < 15) {
    insights.push(`🔍 ${analytics.winRate}% win rate suggests gaps - review proposal pricing, scope clarity, and follow-up timing`);
  }
  
  // Conversion funnel analysis
  const conversionRate = analytics.conversionRate;
  if (conversionRate >= 40) {
    insights.push(`🚀 ${conversionRate}% conversion rate is exceptional - your lead qualification process is working well`);
  } else if (conversionRate >= 25) {
    insights.push(`✅ ${conversionRate}% conversion rate is good - optimize follow-up speed to reach 30%+`);
  } else if (conversionRate >= 15 && conversionRate > 0) {
    insights.push(`📈 ${conversionRate}% conversion rate - improve initial qualification to increase lead quality`);
  } else if (conversionRate > 0 && conversionRate < 15 && analytics.totalLeads > 5) {
    insights.push(`⚠️ ${conversionRate}% conversion rate - focus on better lead scoring and qualification criteria`);
  }
  
  // Stage distribution and bottleneck analysis
  const newLeadsPercent = analytics.totalLeads > 0 ? (analytics.leadsByStage.new / analytics.totalLeads) * 100 : 0;
  const contactedPercent = analytics.totalLeads > 0 ? (analytics.leadsByStage.contacted / analytics.totalLeads) * 100 : 0;
  const qualifiedPercent = analytics.totalLeads > 0 ? (analytics.leadsByStage.qualified / analytics.totalLeads) * 100 : 0;
  const proposalPercent = analytics.totalLeads > 0 ? (analytics.leadsByStage.proposal / analytics.totalLeads) * 100 : 0;
  
  // Bottleneck detection
  if (newLeadsPercent > 50 && analytics.totalLeads > 5) {
    insights.push(`⚡ ${Math.round(newLeadsPercent)}% of leads are new - prioritize outreach to reduce backlog and improve time-to-contact`);
  } else if (contactedPercent > qualifiedPercent * 2 && analytics.leadsByStage.contacted > 3) {
    insights.push(`🎯 ${analytics.leadsByStage.contacted} contacted leads vs ${analytics.leadsByStage.qualified} qualified - focus on qualification conversations`);
  } else if (qualifiedPercent > proposalPercent * 2 && analytics.leadsByStage.qualified > 3) {
    insights.push(`📋 ${analytics.leadsByStage.qualified} qualified leads ready - convert ${Math.max(1, Math.floor(analytics.leadsByStage.qualified * 0.3))} to proposals this week`);
  }
  
  // Hot leads opportunity
  if (analytics.hotLeads > 0) {
    insights.push(`🔥 ${analytics.hotLeads} high-value hot leads detected - contact within 24 hours for best conversion odds`);
  }
  
  // Pipeline momentum
  const activePipeline = analytics.leadsByStage.qualified + analytics.leadsByStage.proposal;
  if (activePipeline >= 10) {
    insights.push(`💪 Strong pipeline momentum with ${activePipeline} active leads in qualified/proposal stages`);
  } else if (activePipeline >= 5) {
    insights.push(`📊 ${activePipeline} leads in qualified/proposal stages - maintain steady follow-up to close deals`);
  } else if (activePipeline > 0) {
    insights.push(`⚡ ${activePipeline} leads in active stages - focus on moving more leads through your pipeline`);
  }
  
  // Revenue opportunity
  const avgLeadValue = analytics.avgLeadValue;
  if (avgLeadValue > 50000) {
    insights.push(`💎 High-value leads averaging $${(avgLeadValue / 1000).toFixed(0)}K - prioritize relationship building and detailed proposals`);
  } else if (avgLeadValue > 25000) {
    insights.push(`💰 Average lead value of $${(avgLeadValue / 1000).toFixed(0)}K - focus on volume and efficiency to maximize revenue`);
  }
  
  // Time range context (only if filtered)
  if (filteredCount < totalCount && filteredCount > 0) {
    insights.push(`📅 Viewing ${filteredCount} of ${totalCount} leads in selected time range - adjust filter to see full picture`);
  }
  
  // If no insights generated, provide a default
  if (insights.length === 0) {
    insights.push(`📊 Analyze your pipeline stages to identify opportunities for improvement`);
  }
  
  // Limit to top 5 most important insights
  return insights.slice(0, 5);
}

// Helper functions
function getStageIcon(stage: string): any {
  const icons: { [key: string]: any } = {
    new: 'fiber-new',
    contacted: 'phone',
    qualified: 'check-circle',
    proposal: 'description',
    won: 'emoji-events',
    lost: 'cancel',
  };
  return icons[stage] || 'circle';
}

function getStageColor(stage: string): string {
  const colors: { [key: string]: string } = {
    new: '#3B82F6',
    contacted: '#8B5CF6',
    qualified: '#10B981',
    proposal: '#F59E0B',
    won: '#10B981',
    lost: '#6B7280',
  };
  return colors[stage] || '#6B7280';
}

function formatStageName(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function formatProjectType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'kitchen_remodel': 'Kitchen Remodel',
    'bathroom_remodel': 'Bathroom Remodel',
    'new_build': 'New Build',
    'other': 'Other'
  };
  
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  wideContainer: {
    marginHorizontal: -20, // Cancel out parent ScrollView padding (matches Lead Sources and My Leads cards exactly)
    paddingHorizontal: 4, // Add padding back inside (matches projects page width)
  },
  campaignGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 16,
    width: '100%', // Ensure full width like other pages
  },
  campaignGradientContent: {
    backgroundColor: '#000000',
    borderRadius: 23,
    padding: 12, // Match lead details page padding
  },
  keyMetricsGradientBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 12,
    width: '100%', // Ensure full width like other pages
  },
  keyMetricsGradientContent: {
    backgroundColor: '#000000',
    borderRadius: 18,
    padding: 12,
  },
  performanceSnapshotRow: {
    paddingRight: 8,
    gap: 12,
  },
  performanceSnapshotCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  performanceSnapshotValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E5E7EB',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  performanceSnapshotLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '500',
  },
  analyticsSectionHeader: {
    marginBottom: 12,
  },
  analyticsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  analyticsSectionSubtitle: {
    fontSize: 13,
    color: '#8DA0B8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 0,
    marginTop: 8,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  performanceRowContainer: {
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  performanceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  perfCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  perfLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 4,
  },
  perfValue: {
    color: '#E5E7EB',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  perfTrend: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
  trendUp: {
    color: '#10B981',
  },
  trendDown: {
    color: '#EF4444',
  },
  trendFlat: {
    color: '#94A3B8',
  },
  metricsScroll: {
    marginBottom: 20,
  },
  metricsContainer: {
    paddingRight: 16,
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  metricEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E5E7EB',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  metricLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginBottom: 0,
    marginHorizontal: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E5E7EB',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  // Pipeline Health Styles
  pipelineHealthContainer: {
    gap: 16,
  },
  pipelineHealthRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  pipelineHealthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pipelineHealthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CBD5E1',
    minWidth: 100,
  },
  pipelineHealthCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pipelineHealthDivider: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 4,
  },
  pipelineHealthExpected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pipelineHealthWarning: {
    fontSize: 14,
    color: '#F59E0B',
  },
  pipelineHealthSuccess: {
    fontSize: 14,
    color: '#10B981',
  },
  pipelineHealthBenchmark: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 26,
    marginTop: 4,
    fontStyle: 'italic',
  },
  pipelineHealthActionHint: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 26,
    marginTop: 6,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  // Legacy Stage Container Styles (kept for backward compatibility)
  stageContainer: {
    gap: 8,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(11, 28, 56, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.1)',
  },
  stageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
  },
  stageName: {
    fontSize: 14,
    color: '#CBD5E1',
    marginLeft: 8,
  },
  progressBarBg: {
    height: 8, // Reduced from 10 (~20% reduction for cleaner look)
    backgroundColor: '#0b1c38',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  stageMetaText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  typeContainer: {
    gap: 12,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeBar: {
    flex: 1,
    height: 24,
    backgroundColor: '#0b1c38',
    borderRadius: 12,
    overflow: 'hidden',
  },
  typeBarFill: {
    height: '100%',
    borderRadius: 12,
  },
  typeName: {
    fontSize: 14,
    color: '#CBD5E1',
    minWidth: 80,
  },
  typeCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E5E7EB',
    minWidth: 30,
    textAlign: 'right',
  },
  // Structured Insight Styles
  structuredInsightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  structuredInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  structuredInsightTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.2,
  },
  structuredInsightBody: {
    gap: 10,
  },
  structuredInsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  structuredInsightLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    minWidth: 100,
    marginTop: 2,
  },
  structuredInsightValue: {
    fontSize: 13,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
  structuredInsightAction: {
    color: '#43cea2',
    fontWeight: '600',
  },
  // Legacy Insight Styles (kept for backward compatibility)
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  insightText: {
    fontSize: 14,
    color: '#D1FAE5',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },
  insightsDisclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    gap: 6,
  },
  insightsDisclosureText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#43cea2',
  },
  chartWrapper: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  trendPointer: {
    height: 90,
    width: 120,
    justifyContent: 'center',
    marginTop: -30,
    marginLeft: -40,
  },
  trendPointerMonth: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 6,
  },
  trendPointerBody: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1B365D',
    borderWidth: 1,
    borderColor: '#43cea2',
  },
  trendPointerValue: {
    color: '#43cea2',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  trendPointerCaption: {
    color: '#b8c7d3',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  chartContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
  funnelContainer: {
    gap: 12,
  },
  funnelStage: {
    marginBottom: 4,
  },
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  funnelStageName: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  funnelStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  funnelCount: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
  },
  funnelDropoff: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  funnelBarContainer: {
    height: 32,
    backgroundColor: '#0b1c38',
    borderRadius: 16,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 16,
  },
  revenueGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14, // Reduced from 16 (~15% reduction)
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  revenueLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
  },
  revenueValue: {
    color: '#43cea2',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  revenueSubtext: {
    color: '#6B7280',
    fontSize: 11,
  },
  revenueForecastContainer: {
    backgroundColor: 'rgba(67, 206, 162, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.2)',
    gap: 10,
    marginTop: 8,
  },
  revenueForecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  revenueForecastLabel: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
    flex: 1,
  },
  revenueForecastValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 8,
  },
  sourceChartContainer: {
    gap: 12,
    marginTop: 12,
  },
  sourceChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sourceChartInfo: {
    minWidth: 120,
  },
  sourceChartName: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  sourceChartCount: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  sourceChartBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: '#0b1c38',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sourceChartBar: {
    height: '100%',
    borderRadius: 12,
  },
  sourceChartConversion: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 45,
    textAlign: 'right',
  },
  // Today's Focus Styles
  todaysFocusGradientBorder: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 16,
    width: '100%',
  },
  todaysFocusGradientContent: {
    backgroundColor: '#000000',
    borderRadius: 23,
    padding: 12,
  },
  todaysFocusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  todaysFocusTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  todaysFocusMetrics: {
    gap: 12,
    marginBottom: 20,
  },
  todaysFocusMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todaysFocusMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 80,
  },
  todaysFocusMetricLabel: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
  },
  todaysFocusActions: {
    gap: 12,
  },
  todaysFocusPrimaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#43cea2',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  todaysFocusPrimaryCTAText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.3,
  },
  todaysFocusSecondaryCTA: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  todaysFocusSecondaryCTAText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#43cea2',
    letterSpacing: 0.2,
  },
  // Legacy AI Coach Card Styles (kept for backward compatibility if needed)
  aiCoachCard: {
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#43cea2',
    shadowColor: '#43cea2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  aiCoachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  aiCoachTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#43cea2',
    letterSpacing: 0.3,
  },
  aiCoachMessage: {
    fontSize: 14,
    color: '#D1FAE5',
    lineHeight: 20,
    fontWeight: '500',
  },
  // Key Metrics Section Styles
  keyMetricsSection: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  keyMetricsGrid: {
    flexDirection: 'row',
    gap: 8, // Reduced gap to make cards appear wider
    marginTop: 12,
  },
  keyMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  keyMetricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E5E7EB',
    marginTop: 8,
    marginBottom: 4,
  },
  keyMetricLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '600',
  },
});





