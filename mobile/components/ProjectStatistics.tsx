import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Project = {
  id: string;
  name: string;
  status: string;
  margin: number;
  location: string;
  missingLaborCost: boolean;
  progress?: number;
  lastUpdated?: string;
  priority?: 'low' | 'medium' | 'high';
  budget?: number;
  timeline?: {
    startDate: string;
    endDate: string;
    duration: number;
  };
};

interface ProjectStatisticsProps {
  projects: Project[];
  theme: any;
}

export default function ProjectStatistics({
  projects,
  theme,
}: ProjectStatisticsProps) {
  const stats = {
    total: projects.length,
    won: projects.filter(p => p.status === 'Won').length,
    inProgress: projects.filter(p => p.status === 'Submitted').length,
    draft: projects.filter(p => p.status === 'Draft').length,
    totalValue: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
    avgProgress:
      projects.reduce((sum, p) => sum + (p.progress || 0), 0) /
        projects.length || 0,
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        Project Overview
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <MaterialIcons name='folder' size={24} color={theme.accent} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.total}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Total
          </Text>
        </View>
        <View style={styles.statItem}>
          <MaterialIcons name='check-circle' size={24} color={theme.accent} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.won}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>Won</Text>
        </View>
        <View style={styles.statItem}>
          <MaterialIcons
            name='hourglass-empty'
            size={24}
            color={theme.accent}
          />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.inProgress}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            In Progress
          </Text>
        </View>
        <View style={styles.statItem}>
          <MaterialIcons name='attach-money' size={24} color={theme.accent} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            ${(stats.totalValue / 1000).toFixed(0)}K
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Total Value
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});
