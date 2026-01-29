/**
 * NewScreen - New Leads Tab
 * Displays all leads in the 'new' stage
 */

import React from 'react';
import { View, FlatList, SafeAreaView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadsStore } from '../store/leadsStore';
import LeadCard from '../components/LeadCard';
import { ScreenHeader } from '../components/ScreenHeader';

export default function NewScreen() {
  const navigation = useNavigation<any>();
  const leads = useLeadsStore(s => s.byStage('new'));
  
  // Calculate average AI score
  const avgScore = leads.length 
    ? Math.round(leads.reduce((a, l) => a + (l.aiScore ?? 0), 0) / leads.length) 
    : 0;

  const handleLeadPress = (leadId: string) => {
    navigation.navigate('LeadDetail', { id: leadId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="New Leads" 
        metric={`${leads.length} leads • Avg Score: ${avgScore}`}
        subtitle="Fresh leads ready for verification"
      />
      
      <View style={styles.content}>
        <FlatList
          data={leads}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <LeadCard 
              lead={item} 
              onPress={() => handleLeadPress(item.id)} 
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No new leads yet</Text>
              <Text style={styles.emptySubtext}>New leads will appear here</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
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
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 14,
  },
});
