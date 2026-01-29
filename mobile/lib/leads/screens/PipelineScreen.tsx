/**
 * Pipeline Screen
 * Kanban-style view of all lead stages
 */

import React from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadStore } from '../store';
import LeadCard from '../components/LeadCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { LeadStage } from '../types';

const columns: LeadStage[] = ['new', 'verified', 'qualified', 'proposal', 'won'];

export default function PipelineScreen() {
  const navigation = useNavigation<any>();
  const byStage = useLeadStore(s => s.byStage);
  const analytics = useLeadStore(s => s.analytics);

  const handleLeadPress = (leadId: string) => {
    navigation.navigate('LeadDetail', { id: leadId });
  };

  const getStageTitle = (stage: LeadStage) => {
    switch (stage) {
      case 'new': return 'New';
      case 'verified': return 'Verified';
      case 'qualified': return 'Qualified';
      case 'proposal': return 'Proposal';
      case 'won': return 'Won';
      case 'lost': return 'Lost';
      default: return stage;
    }
  };

  const getStageCount = (stage: LeadStage) => {
    return analytics.byStage[stage] || 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="Pipeline" 
        metric={`${analytics.total} total leads`}
        subtitle="Complete lead pipeline overview"
      />
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.pipelineContainer}
        contentContainerStyle={styles.pipelineContent}
      >
        {columns.map(column => (
          <View key={column} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{getStageTitle(column)}</Text>
              <Text style={styles.columnCount}>{getStageCount(column)}</Text>
            </View>
            <FlatList
              data={byStage(column)}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <LeadCard 
                  lead={item} 
                  onPress={() => handleLeadPress(item.id)} 
                />
              )}
              style={styles.columnList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyColumn}>
                  <Text style={styles.emptyColumnText}>No leads</Text>
                </View>
              )}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071626',
  },
  pipelineContainer: {
    flex: 1,
  },
  pipelineContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  column: {
    width: 300,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#0F2137',
    borderRadius: 12,
    marginBottom: 8,
  },
  columnTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
  columnCount: {
    color: '#49F2A8',
    fontWeight: '700',
    fontSize: 14,
    backgroundColor: 'rgba(73, 242, 168, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  columnList: {
    flex: 1,
  },
  emptyColumn: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#0F2137',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyColumnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});



