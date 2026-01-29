/**
 * VerifyScreen - Verification Tab
 * Displays leads ready for verification
 */

import React from 'react';
import { View, FlatList, SafeAreaView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadsStore } from '../store/leadsStore';
import LeadCard from '../components/LeadCard';
import { ScreenHeader } from '../components/ScreenHeader';

export default function VerifyScreen() {
  const navigation = useNavigation<any>();
  const leads = useLeadsStore(s => s.byStage('verified'));

  const handleLeadPress = (leadId: string) => {
    navigation.navigate('LeadDetail', { id: leadId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="Verification" 
        metric={`${leads.length} ready`}
        subtitle="Leads ready for verification and qualification"
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
              <Text style={styles.emptyText}>No leads to verify</Text>
              <Text style={styles.emptySubtext}>Verified leads will appear here</Text>
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



