/**
 * Automation Screen
 * Shows automation campaigns and performance metrics
 */

import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';

export default function AutomationScreen() {
  const automationData = {
    activeCampaigns: 5,
    segments: 8,
    conversionRate: 23.5,
    totalSent: 1247,
    totalResponses: 293,
    avgResponseTime: '2.3 hours'
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="Automation" 
        metric={`${automationData.activeCampaigns} active campaigns`}
        subtitle="Lead nurturing and automated workflows"
      />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <MetricTile 
            title="Active Campaigns" 
            subtitle="Lead nurturing & drips" 
            metric={`${automationData.activeCampaigns} active`}
            color="#49F2A8"
          />
          <MetricTile 
            title="Segments" 
            subtitle="Targeted audiences" 
            metric={`${automationData.segments} segments`}
            color="#3B82F6"
          />
          <MetricTile 
            title="Performance" 
            subtitle="Conversion & response" 
            metric={`${automationData.conversionRate}% avg`}
            color="#F59E0B"
          />
          <MetricTile 
            title="Total Sent" 
            subtitle="Automated messages" 
            metric={`${automationData.totalSent.toLocaleString()}`}
            color="#8B5CF6"
          />
          <MetricTile 
            title="Responses" 
            subtitle="Lead engagement" 
            metric={`${automationData.totalResponses.toLocaleString()}`}
            color="#10B981"
          />
          <MetricTile 
            title="Response Time" 
            subtitle="Average response" 
            metric={automationData.avgResponseTime}
            color="#F97316"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Campaigns</Text>
          <CampaignItem 
            name="Kitchen Remodel Follow-up"
            status="Active"
            recipients={156}
            openRate={24.2}
            clickRate={8.7}
          />
          <CampaignItem 
            name="New Lead Welcome Series"
            status="Active"
            recipients={89}
            openRate={31.4}
            clickRate={12.1}
          />
          <CampaignItem 
            name="Bathroom Renovation Drip"
            status="Paused"
            recipients={67}
            openRate={19.8}
            clickRate={6.2}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Create New Campaign</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Manage Segments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>View Analytics</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface MetricTileProps {
  title: string;
  subtitle: string;
  metric: string;
  color: string;
}

function MetricTile({ title, subtitle, metric, color }: MetricTileProps) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: `${color}20` }]}>
        <View style={[styles.tileIconDot, { backgroundColor: color }]} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
      <Text style={[styles.tileMetric, { color }]}>{metric}</Text>
    </View>
  );
}

interface CampaignItemProps {
  name: string;
  status: 'Active' | 'Paused' | 'Draft';
  recipients: number;
  openRate: number;
  clickRate: number;
}

function CampaignItem({ name, status, recipients, openRate, clickRate }: CampaignItemProps) {
  const statusColor = status === 'Active' ? '#10B981' : 
                     status === 'Paused' ? '#F59E0B' : '#6B7280';

  return (
    <View style={styles.campaignItem}>
      <View style={styles.campaignHeader}>
        <Text style={styles.campaignName}>{name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
      <View style={styles.campaignMetrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Recipients</Text>
          <Text style={styles.metricValue}>{recipients}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Open Rate</Text>
          <Text style={styles.metricValue}>{openRate}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Click Rate</Text>
          <Text style={styles.metricValue}>{clickRate}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071626',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  tile: {
    backgroundColor: '#10233A',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    minHeight: 120,
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tileIconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tileTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  tileSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  tileMetric: {
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  campaignItem: {
    backgroundColor: '#10233A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  campaignName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  campaignMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#10233A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});



