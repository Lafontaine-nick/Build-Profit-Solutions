/**
 * Real-Time Analytics Dashboard
 * Enterprise-grade insights for lead generation performance
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLeadStore } from '../store';
import { c, radius, shadow, type } from '../ui/tokens';
import { AdvancedLeadScore, defaultMarketData } from '../ai/advanced-scoring';

interface AnalyticsData {
  totalLeads: number;
  conversionRate: number;
  avgScore: number;
  pipelineValue: number;
  topSources: Array<{ source: string; count: number; conversion: number }>;
  scoreDistribution: Array<{ range: string; count: number; percentage: number }>;
  weeklyTrend: Array<{ date: string; leads: number; conversions: number }>;
  performance: {
    responseTime: number;
    followUpRate: number;
    closeRate: number;
  };
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  const leads = useLeadStore(s => s.leads);
  
  useEffect(() => {
    calculateAnalytics();
  }, [leads, timeRange]);
  
  const calculateAnalytics = () => {
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    
    const filteredLeads = leads.filter(lead => 
      new Date(lead.createdAt).getTime() > cutoff
    );
    
    // Calculate metrics
    const totalLeads = filteredLeads.length;
    const conversions = filteredLeads.filter(l => l.stage === 'won').length;
    const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;
    const avgScore = totalLeads > 0 ? 
      filteredLeads.reduce((sum, lead) => sum + (lead.aiScore || 0), 0) / totalLeads : 0;
    
    const pipelineValue = filteredLeads
      .filter(l => l.stage !== 'won' && l.stage !== 'lost')
      .reduce((sum, lead) => {
        const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
        return sum + avgBudget;
      }, 0);
    
    // Top sources
    const sourceMap = new Map<string, { count: number; conversions: number }>();
    filteredLeads.forEach(lead => {
      const existing = sourceMap.get(lead.source) || { count: 0, conversions: 0 };
      existing.count++;
      if (lead.stage === 'won') existing.conversions++;
      sourceMap.set(lead.source, existing);
    });
    
    const topSources = Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source: source.charAt(0).toUpperCase() + source.slice(1),
        count: data.count,
        conversion: data.count > 0 ? (data.conversions / data.count) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Score distribution
    const scoreRanges = [
      { range: '90-100', min: 90, max: 100 },
      { range: '80-89', min: 80, max: 89 },
      { range: '70-79', min: 70, max: 79 },
      { range: '60-69', min: 60, max: 69 },
      { range: '0-59', min: 0, max: 59 }
    ];
    
    const scoreDistribution = scoreRanges.map(range => {
      const count = filteredLeads.filter(lead => {
        const score = lead.aiScore || 0;
        return score >= range.min && score <= range.max;
      }).length;
      return {
        range: range.range,
        count,
        percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0
      };
    });
    
    setAnalytics({
      totalLeads,
      conversionRate,
      avgScore,
      pipelineValue,
      topSources,
      scoreDistribution,
      weeklyTrend: [], // TODO: Implement weekly trend calculation
      performance: {
        responseTime: 2.5, // TODO: Calculate from actual data
        followUpRate: 85, // TODO: Calculate from actual data
        closeRate: conversionRate
      }
    });
  };
  
  if (!analytics) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={type.h1 as any}>📊 Analytics Dashboard</Text>
        <View style={styles.timeRangeSelector}>
          {(['7d', '30d', '90d'] as const).map(range => (
            <Text
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.activeTimeRange
              ]}
              onPress={() => setTimeRange(range)}
            >
              {range}
            </Text>
          ))}
        </View>
      </View>
      
      {/* Key Metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard
          title="Total Leads"
          value={analytics.totalLeads.toLocaleString()}
          change="+12%"
          icon="people"
          color={c.accent}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          change="+3.2%"
          icon="trending-up"
          color="#10B981"
        />
        <MetricCard
          title="Avg Score"
          value={analytics.avgScore.toFixed(0)}
          change="+5"
          icon="star"
          color="#F59E0B"
        />
        <MetricCard
          title="Pipeline Value"
          value={`$${(analytics.pipelineValue / 1000).toFixed(0)}K`}
          change="+18%"
          icon="attach-money"
          color="#8B5CF6"
        />
      </View>
      
      {/* Performance Indicators */}
      <View style={styles.section}>
        <Text style={type.h2 as any}>🎯 Performance</Text>
        <View style={styles.performanceGrid}>
          <PerformanceIndicator
            label="Response Time"
            value={`${analytics.performance.responseTime}h`}
            target="< 2h"
            status={analytics.performance.responseTime <= 2 ? 'good' : 'warning'}
          />
          <PerformanceIndicator
            label="Follow-up Rate"
            value={`${analytics.performance.followUpRate}%`}
            target="> 80%"
            status={analytics.performance.followUpRate >= 80 ? 'good' : 'warning'}
          />
          <PerformanceIndicator
            label="Close Rate"
            value={`${analytics.performance.closeRate.toFixed(1)}%`}
            target="> 25%"
            status={analytics.performance.closeRate >= 25 ? 'good' : 'warning'}
          />
        </View>
      </View>
      
      {/* Top Sources */}
      <View style={styles.section}>
        <Text style={type.h2 as any}>📈 Lead Sources</Text>
        {analytics.topSources.map((source, index) => (
          <SourceRow
            key={source.source}
            rank={index + 1}
            source={source.source}
            leads={source.count}
            conversion={source.conversion}
          />
        ))}
      </View>
      
      {/* Score Distribution */}
      <View style={styles.section}>
        <Text style={type.h2 as any}>📊 Score Distribution</Text>
        {analytics.scoreDistribution.map(range => (
          <ScoreBar
            key={range.range}
            range={range.range}
            count={range.count}
            percentage={range.percentage}
            total={analytics.totalLeads}
          />
        ))}
      </View>
    </ScrollView>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
}

function MetricCard({ title, value, change, icon, color }: MetricCardProps) {
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = (screenWidth - 48) / 2;
  
  return (
    <View style={[styles.metricCard, { width: cardWidth }, shadow.card]}>
      <View style={styles.metricHeader}>
        <MaterialIcons name={icon as any} size={24} color={color} />
        <Text style={[styles.changeText, { color: change.startsWith('+') ? '#10B981' : '#EF4444' }]}>
          {change}
        </Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

interface PerformanceIndicatorProps {
  label: string;
  value: string;
  target: string;
  status: 'good' | 'warning' | 'error';
}

function PerformanceIndicator({ label, value, target, status }: PerformanceIndicatorProps) {
  const statusColor = {
    good: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444'
  }[status];
  
  return (
    <View style={styles.performanceCard}>
      <Text style={styles.performanceLabel}>{label}</Text>
      <Text style={[styles.performanceValue, { color: statusColor }]}>{value}</Text>
      <Text style={styles.performanceTarget}>Target: {target}</Text>
    </View>
  );
}

interface SourceRowProps {
  rank: number;
  source: string;
  leads: number;
  conversion: number;
}

function SourceRow({ rank, source, leads, conversion }: SourceRowProps) {
  return (
    <View style={styles.sourceRow}>
      <View style={styles.sourceRank}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>
      <View style={styles.sourceInfo}>
        <Text style={styles.sourceName}>{source}</Text>
        <Text style={styles.sourceStats}>{leads} leads • {conversion.toFixed(1)}% conversion</Text>
      </View>
      <View style={styles.sourceConversion}>
        <Text style={[styles.conversionText, { color: conversion > 25 ? '#10B981' : '#F59E0B' }]}>
          {conversion.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

interface ScoreBarProps {
  range: string;
  count: number;
  percentage: number;
  total: number;
}

function ScoreBar({ range, count, percentage, total }: ScoreBarProps) {
  return (
    <View style={styles.scoreBarContainer}>
      <View style={styles.scoreBarHeader}>
        <Text style={styles.scoreRange}>{range}</Text>
        <Text style={styles.scoreCount}>{count} ({percentage.toFixed(1)}%)</Text>
      </View>
      <View style={styles.scoreBarBackground}>
        <View 
          style={[
            styles.scoreBarFill, 
            { width: `${percentage}%` },
            { backgroundColor: percentage > 20 ? '#10B981' : percentage > 10 ? '#F59E0B' : '#EF4444' }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bg,
  },
  loadingText: {
    color: c.text,
    fontSize: 16,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderRadius: radius.sm,
    padding: 2,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    color: c.sub,
    fontSize: 12,
    fontWeight: '600',
  },
  activeTimeRange: {
    backgroundColor: c.accent,
    color: '#052016',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: c.text,
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 12,
    color: c.sub,
    fontWeight: '500',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: radius.md,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  performanceLabel: {
    fontSize: 12,
    color: c.sub,
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  performanceTarget: {
    fontSize: 10,
    color: c.sub,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  sourceRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#052016',
    fontSize: 12,
    fontWeight: '700',
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  sourceStats: {
    color: c.sub,
    fontSize: 12,
  },
  sourceConversion: {
    alignItems: 'flex-end',
  },
  conversionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreBarContainer: {
    marginBottom: 12,
  },
  scoreBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreRange: {
    color: c.text,
    fontSize: 12,
    fontWeight: '600',
  },
  scoreCount: {
    color: c.sub,
    fontSize: 12,
  },
  scoreBarBackground: {
    height: 8,
    backgroundColor: c.railTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
