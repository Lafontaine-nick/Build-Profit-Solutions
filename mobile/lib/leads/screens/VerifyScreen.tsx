/**
 * Verification Screen
 * Displays leads in the 'verified' stage
 */

import React from 'react';
import { View, FlatList, SafeAreaView, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadStore } from '../store';
import LeadCard from '../components/LeadCard';
import { ScreenHeader } from '../components/ScreenHeader';

export default function VerifyScreen() {
  const navigation = useNavigation<any>();
  const leads = useLeadStore(s => s.byStage('verified'));

  const handleLeadPress = (leadId: string) => {
    navigation.navigate('LeadDetail', { id: leadId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader 
        title="Verification" 
        metric={`${leads.length} ready for qualification`}
        subtitle="Verified leads ready for next steps"
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
              <Text style={styles.emptyText}>No leads to verify</Text>
              <Text style={styles.emptySubtext}>
                Verified leads will appear here
              </Text>
            </View>
          )}
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
});



