import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type Props = {
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent?: string;
  helper?: string;
  onPress?: () => void;
};

export default function TaxSummaryCard({ label, value, icon, accent = '#2DFFC4', helper, onPress }: Props) {
  const inner = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
        <MaterialIcons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={styles.value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.32}
        maxFontSizeMultiplier={1.35}
      >
        {value}
      </Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      {onPress ? (
        <Text style={styles.tapHint}>Tap for detail</Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}. Tap for detail`}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.card}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  label: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    width: '100%',
  },
  helper: {
    color: '#7FDAC5',
    fontSize: 11,
    marginTop: 6,
  },
  tapHint: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 10,
    marginTop: 8,
    fontWeight: '600',
  },
  cardPressed: {
    opacity: 0.88,
  },
});
