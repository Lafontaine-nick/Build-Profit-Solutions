import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: '1099' | 'W-2';
};

export default function LaborPayTypePill({ label }: Props) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(45, 204, 154, 0.14)',
    borderColor: 'rgba(45, 204, 154, 0.4)',
  },
  text: {
    color: '#2dcc9a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
});
