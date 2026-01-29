/**
 * New Leads Screen
 * Displays leads in the 'new' stage
 */

import React from 'react';
import { View, FlatList, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadStore } from '../store';
import LeadCard from '../components/LeadCard';
import { ScreenHeader } from '../components/ScreenHeader';

export default function NewScreen() {
  const navigation = useNavigation<any>();
  const leads = useLeadStore(s => s.byStage('new'));
  const analytics = useLeadStore(s => s.analytics);
  
  const avgScore = leads.length > 0 
    ? Math.round(leads.reduce((sum, lead) => sum + (lead.aiScore ?? 0), 0) / leads.length)
    : 0;

  const handleLeadPress = (leadId: string) => {
    navigation.navigate('LeadDetail', { id: leadId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="New Leads" 
        metric={`${leads.length} leads • Avg Score: ${avgScore}`}
        subtitle="Leads awaiting initial review"
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
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No new leads</Text>
              <Text style={styles.emptySubtext}>
                New leads will appear here as they come in
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#071626',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
};



