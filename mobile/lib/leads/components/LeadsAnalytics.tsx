/**
 * Leads Analytics Component
 * Shows performance metrics and insights
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lead } from '../types';

interface LeadsAnalyticsProps {
  leads: Lead[];
}

const Pill = ({ 
  label, 
  tone = 'default' 
}: { 
  label: string; 
  tone?: 'default' | 'good' | 'warn' | 'info' 
}) => {
  const bg =
    tone === 'good' ? '#133d2e' : 
    tone === 'warn' ? '#3c2a0a' : 
    tone === 'info' ? '#152b45' : 
    '#242635';
  const color =
    tone === 'good' ? '#27c082' : 
    tone === 'warn' ? '#ffb547' : 
    tone === 'info' ? '#74b0ff' : 
    '#cfd3e0';
  
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
};

export default function LeadsAnalytics({ leads }: LeadsAnalyticsProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const verified = leads.filter((l) => l.verification?.emailValid || l.verification?.phoneValid).length;
    
    // Calculate average value
    const totalValue = leads.reduce((sum, l) => {
      return sum + (l.project.budgetMax || l.project.budgetMin || 0);
    }, 0);
    const avgValue = Math.round(totalValue / Math.max(total, 1));
    
    // Win rate (won leads vs total)
    const won = leads.filter((l) => l.stage === 'won').length;
    const winRate = total ? Math.round((won / total) * 100) : 0;
    
    // Post-contact close rate
    const contacted = leads.filter((l) => 
      l.stage !== 'new' && l.stage !== 'lost'
    ).length;
    const postContactClose = contacted ? Math.round((won / contacted) * 100) : 0;
    
    // High value leads (>$50k)
    const highValue = leads.filter((l) => 
      (l.project.budgetMax || 0) > 50000
    ).length;
    
    return {
      total,
      verified,
      avgValue,
      winRate,
      postContactClose,
      highValue,
    };
  }, [leads]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Performance (30d)</Text>
      <View style={styles.pillsContainer}>
        <Pill label={`Total ${stats.total}`} />
        <Pill label={`Verified ${stats.verified}`} tone="good" />
        <Pill label={`Avg $${(stats.avgValue / 1000).toFixed(0)}K`} tone="info" />
        {stats.highValue > 0 && (
          <Pill label={`High Value ${stats.highValue}`} tone="warn" />
        )}
        <Pill label={`Win Rate ${stats.winRate}%`} tone="good" />
        <Pill label={`Close Rate ${stats.postContactClose}%`} tone="info" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111423',
    borderColor: '#2a3142',
    borderWidth: 1,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  title: {
    color: '#cfd3e0',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 14,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontWeight: '600',
    fontSize: 12,
  },
});




