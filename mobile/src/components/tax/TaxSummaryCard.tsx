import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ESTIMATE_FLOW_TEXT_SECONDARY_DARK } from '@/utils/estimateFlowCardStyle';

type Props = {
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent?: string;
  helper?: string;
  onPress?: () => void;
};

/** Split $12,777,936.00 so cents stay on the same row (avoids ".00" wrapping alone on narrow cards). */
function splitUsdValue(value: string): { dollars: string; cents: string } | null {
  const m = /^(-?\$[\d,]+)(\.\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  return { dollars: m[1], cents: m[2] };
}

function taxFigureColor(value: string): string {
  const raw = value.replace(/[,$\s]/g, '');
  const numeric = raw.match(/-?\d+(?:\.\d+)?/);
  if (!numeric) return '#d7e1f0';
  const amount = Number(numeric[0]);
  if (!Number.isFinite(amount) || amount === 0) return '#d7e1f0';
  if (amount < 0) return '#f87171';
  return '#2dcc9a';
}

function fontSizeForCardValue(value: string): number {
  const len = String(value || '').length;
  if (len <= 9) return 22;
  if (len <= 11) return 20;
  if (len <= 13) return 18;
  if (len <= 15) return 16;
  return 14;
}

function TaxSummaryCardValue({ value }: { value: string }) {
  const currency = useMemo(() => splitUsdValue(value), [value]);
  const fontSize = useMemo(() => fontSizeForCardValue(value), [value]);
  const color = taxFigureColor(value);

  if (!currency) {
    return (
      <View style={styles.valueClip}>
        <Text
          style={[styles.value, { fontSize, color }]}
          numberOfLines={1}
          adjustsFontSizeToFit={Platform.OS === 'ios'}
          minimumFontScale={0.45}
          maxFontSizeMultiplier={1.2}
          ellipsizeMode="clip"
        >
          {value}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.valueRow}>
      <Text
        style={[styles.valueDollars, { fontSize, color }]}
        numberOfLines={1}
        adjustsFontSizeToFit={Platform.OS === 'ios'}
        minimumFontScale={0.45}
        maxFontSizeMultiplier={1.2}
        ellipsizeMode="clip"
      >
        {currency.dollars}
      </Text>
      <Text style={[styles.valueCents, { fontSize: Math.max(11, Math.round(fontSize * 0.72)), color }]}>
        {currency.cents}
      </Text>
    </View>
  );
}

export default function TaxSummaryCard({ label, value, icon, accent = '#2dcc9a', helper, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
          <MaterialIcons name={icon} size={20} color={accent} />
        </View>
        {onPress ? <MaterialIcons name="chevron-right" size={20} color="#d7e1f0" /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
      <TaxSummaryCardValue value={value} />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
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
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: ESTIMATE_FLOW_TEXT_SECONDARY_DARK,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  valueClip: {
    width: '100%',
    overflow: 'hidden',
    minHeight: 26,
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    width: '100%',
    overflow: 'hidden',
    minHeight: 26,
  },
  value: {
    color: '#FFFFFF',
    fontWeight: '800',
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
  valueDollars: {
    flexShrink: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  valueCents: {
    flexShrink: 0,
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 1,
    fontVariant: ['tabular-nums'],
  },
  helper: {
    color: '#d7e1f0',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 6,
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  cardPressed: {
    opacity: 0.88,
  },
});
