/**
 * AutomationScreen - Automation Tab
 * Shows automation campaigns and performance metrics
 */

import React from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';

export default function AutomationScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="Automation" 
        metric="3 active campaigns"
        subtitle="Lead nurturing and automated workflows"
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <AutomationTile 
            title="Active Campaigns" 
            subtitle="Lead nurturing & drips" 
            metric="5 active" 
            icon="🔄"
          />
          <AutomationTile 
            title="Segments" 
            subtitle="Targeted audiences" 
            metric="8 segments" 
            icon="🎯"
          />
          <AutomationTile 
            title="Performance" 
            subtitle="Conversion & response" 
            metric="23.5% avg" 
            icon="📊"
          />
          <AutomationTile 
            title="Email Sequences" 
            subtitle="Automated follow-ups" 
            metric="12 sequences" 
            icon="📧"
          />
          <AutomationTile 
            title="Lead Scoring" 
            subtitle="AI-powered scoring" 
            metric="87 avg score" 
            icon="🤖"
          />
          <AutomationTile 
            title="Response Rate" 
            subtitle="Automation effectiveness" 
            metric="34.2%" 
            icon="📈"
          />
        </View>
        
        <View style={styles.recentActivity}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <ActivityItem 
            action="Lead scored"
            lead="Sarah Johnson"
            time="2 min ago"
            score={87}
          />
          <ActivityItem 
            action="Campaign triggered"
            campaign="Welcome Series"
            time="5 min ago"
            count={3}
          />
          <ActivityItem 
            action="Follow-up sent"
            lead="Mike Carter"
            time="12 min ago"
            type="email"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface AutomationTileProps {
  title: string;
  subtitle: string;
  metric: string;
  icon: string;
}

function AutomationTile({ title, subtitle, metric, icon }: AutomationTileProps) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        <Text style={styles.tileIcon}>{icon}</Text>
        <Text style={styles.tileTitle}>{title}</Text>
      </View>
      <Text style={styles.tileSub}>{subtitle}</Text>
      <Text style={styles.tileMetric}>{metric}</Text>
    </View>
  );
}

interface ActivityItemProps {
  action: string;
  lead?: string;
  campaign?: string;
  time: string;
  score?: number;
  count?: number;
  type?: string;
}

function ActivityItem({ action, lead, campaign, time, score, count, type }: ActivityItemProps) {
  return (
    <View style={styles.activityItem}>
      <View style={styles.activityContent}>
        <Text style={styles.activityAction}>{action}</Text>
        <Text style={styles.activityTarget}>
          {lead || campaign}
          {score && ` • Score: ${score}`}
          {count && ` • ${count} leads`}
          {type && ` • ${type}`}
        </Text>
      </View>
      <Text style={styles.activityTime}>{time}</Text>
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
    gap: 12,
    marginBottom: 24,
  },
  tile: {
    backgroundColor: '#10233A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tileIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  tileTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  tileSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 10,
  },
  tileMetric: {
    color: '#49F2A8',
    fontSize: 18,
    fontWeight: '800',
  },
  recentActivity: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  activityContent: {
    flex: 1,
  },
  activityAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  activityTarget: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    color: '#64748B',
    fontSize: 11,
  },
});



