import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  hasReceipt: boolean;
};

export default function ReceiptStatusPill({ hasReceipt }: Props) {
  if (hasReceipt) {
    return (
      <View style={[styles.pill, styles.receiptPill]}>
        <MaterialIcons name="receipt" size={11} color="#4ade80" />
        <Text style={[styles.text, styles.receiptText]}>Receipt</Text>
      </View>
    );
  }

  return (
    <View style={[styles.pill, styles.missingPill]}>
      <MaterialIcons name="warning-amber" size={11} color="#f87171" />
      <Text style={[styles.text, styles.missingText]}>No receipt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  receiptPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  missingPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.28)',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  receiptText: { color: '#4ade80' },
  missingText: { color: '#f87171' },
});
