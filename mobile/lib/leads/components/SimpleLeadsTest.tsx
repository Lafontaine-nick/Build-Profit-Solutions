import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SimpleLeadsTest() {
  console.log('🎉 SimpleLeadsTest component is rendering!');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎉 NEW LEADS SYSTEM IS WORKING!</Text>
      <Text style={styles.subtitle}>✅ Integration Successful</Text>
      <Text style={styles.description}>
        You can see this message, which means the new leads system is properly integrated!
      </Text>
      <View style={styles.features}>
        <Text style={styles.feature}>✅ AI-Powered Lead Scoring</Text>
        <Text style={styles.feature}>✅ Stage-Based Pipeline</Text>
        <Text style={styles.feature}>✅ Contractor Matching</Text>
        <Text style={styles.feature}>✅ Modern UI Design</Text>
      </View>
      <View style={styles.status}>
        <Text style={styles.statusText}>🚀 Ready to implement full features!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF0000',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#49F2A8',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  features: {
    alignItems: 'flex-start',
  },
  feature: {
    fontSize: 14,
    color: '#C7D2FE',
    marginBottom: 8,
  },
  status: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#49F2A8',
    borderRadius: 12,
  },
  statusText: {
    color: '#042319',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
