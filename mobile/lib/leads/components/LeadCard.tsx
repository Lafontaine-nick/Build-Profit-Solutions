import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Lead } from '../types';
import { c, radius, shadow } from '../ui/tokens';

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

export default function LeadCard({ lead, onPress }: LeadCardProps) {
  const score = lead.aiScore ?? 0;
  const tier = score >= 85 ? 'high' : score >= 60 ? 'med' : 'low';

  return (
    <Pressable onPress={onPress} style={[styles.card, shadow.card]}>
      <View style={styles.row}>
        <Text style={styles.title}>{lead.contact.name || 'New Lead'}</Text>
        <View style={[styles.badge, tier === 'high' ? styles.bHigh : tier === 'med' ? styles.bMed : styles.bLow]}>
          <Text style={styles.badgeTxt}>{score || '--'}</Text>
        </View>
      </View>

      <Text style={styles.line}>
        {lead.project.type[0].toUpperCase() + lead.project.type.slice(1)} • $
        {lead.project.budgetMin?.toLocaleString() ?? '—'}–{lead.project.budgetMax?.toLocaleString() ?? '—'}
      </Text>
      <Text style={styles.sub}>{lead.location?.city}, {lead.location?.state} • {lead.project.timeline ?? '—'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { 
    backgroundColor: c.card, 
    borderRadius: radius.lg, 
    padding: 16, 
    marginBottom: 14 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  title: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 18 
  },
  line: { 
    color: '#C7D2FE', 
    marginTop: 8, 
    fontWeight: '600' 
  },
  sub: { 
    color: '#9CA3AF', 
    marginTop: 4 
  },
  badge: { 
    minWidth: 44, 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  badgeTxt: { 
    color: '#fff', 
    fontWeight: '900' 
  },
  bHigh: { 
    backgroundColor: c.accent 
  },
  bMed: { 
    backgroundColor: c.warning 
  },
  bLow: { 
    backgroundColor: c.danger 
  },
});