import React from 'react';
import { SafeAreaView, View, Text, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLeadStore } from '../store';
import StageRail from '../components/StageRail';
import LeadCard from '../components/LeadCard';
import ActionBar from '../components/ActionBar';
import { c, type } from '../ui/tokens';

export default function QualifiedScreen() {
  const navigation = useNavigation<any>();
  const leads = useLeadStore(s => s.byStage('qualified'));
  const move = useLeadStore(s => s.moveStage);
  const rescore = useLeadStore(s => s.rescore);

  const avg = leads.length ? Math.round(leads.reduce((a,l) => a + (l.aiScore ?? 0), 0) / leads.length) : 0;
  const first = leads[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <Text style={type.h1 as any}>Qualified</Text>
        <Text style={type.sub as any}>{leads.length} lead{leads.length !== 1 ? 's' : ''} • Avg Score: {avg}</Text>
      </View>

      <StageRail active="qualified" />

      <FlatList
        style={{ paddingHorizontal: 16, paddingTop: 4 }}
        data={leads}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <LeadCard lead={item} onPress={() => navigation.navigate('LeadDetail', { id: item.id })} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No qualified leads yet.</Text>}
      />

      {first ? (
        <ActionBar
          secondary={{ label: 'Rescore', onPress: () => rescore(first.id) }}
          primary={{ label: 'Send Proposal', onPress: () => move(first.id, 'proposal') }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  empty: { color: '#94A3B8', paddingHorizontal: 16, paddingTop: 24 }
});