/**
 * PipelineScreen - Pipeline View Tab
 * Kanban-style view of all lead stages
 */

import React from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadsStore } from '../store/leadsStore';
import LeadCard from '../components/LeadCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { LeadStage } from '../types/leads';

const columns: LeadStage[] = ['new', 'verified', 'qualified', 'proposal', 'won'];

export default function PipelineScreen() {
  const navigation = useNavigation<any>();
  const byStage = useLeadsStore(s => s.byStage);

  const handleLeadPress = (leadId: string) => {
    navigation.navigate('LeadDetail', { id: leadId });
  };

  const getColumnTitle = (stage: LeadStage): string => {
    const titleMap: Record<LeadStage, string> = {
      new: 'New',
      verified: 'Verified', 
      qualified: 'Qualified',
      proposal: 'Proposal',
      won: 'Won',
      lost: 'Lost'
    };
    return titleMap[stage] || stage;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="Pipeline" 
        subtitle="Kanban view of your lead pipeline"
      />
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {columns.map(col => (
          <View key={col} style={styles.column}>
            <View style={styles.columnHeader}>
              <Text style={styles.columnTitle}>{getColumnTitle(col)}</Text>
              <Text style={styles.columnCount}>{byStage(col).length}</Text>
            </View>
            <FlatList
              data={byStage(col)}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <LeadCard 
                  lead={item} 
                  onPress={() => handleLeadPress(item.id)} 
                />
              )}
              contentContainerStyle={styles.columnContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyColumn}>
                  <Text style={styles.emptyColumnText}>No leads</Text>
                </View>
              }
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
  },
  column: {
    width: 300,
    paddingHorizontal: 8,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  columnTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
  columnCount: {
    color: '#94A3B8',
    fontSize: 12,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  columnContent: {
    paddingBottom: 20,
  },
  emptyColumn: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyColumnText: {
    color: '#64748B',
    fontSize: 14,
  },
});



