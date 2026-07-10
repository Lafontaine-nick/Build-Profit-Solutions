import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

type Props = {
  /** compact: quiet one-liner (Step 1 / Step 3 footer). review: Step 2 box. apply: liability above Apply. */
  variant?: 'compact' | 'review' | 'apply';
};

export const AI_ESTIMATE_DISCLAIMER_LINES = [
  'Suggested prices are a planning guide only — not a finished bid or quote.',
  'You are responsible for verifying prices, scope, markup, and totals before sending to a client.',
  'National averages and suggested labor/material splits are estimates, not numbers from your notes.',
  'This tool does not replace your professional judgment, local codes, or licensed trade requirements.',
] as const;

const COMPACT_DISCLAIMER =
  'Suggested prices are a planning guide only. Always review pricing and scope before applying or sending a bid.';

const COMPACT_PREVIEW =
  'Suggested prices are a planning guide — always review before applying.';

export default function AIEstimateDisclaimer({ variant = 'compact' }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [compactExpanded, setCompactExpanded] = useState(false);

  const borderColor = darkMode ? 'rgba(251, 191, 36, 0.28)' : 'rgba(180, 83, 9, 0.35)';
  const bg = darkMode ? 'rgba(251, 191, 36, 0.07)' : 'rgba(251, 191, 36, 0.08)';
  const iconColor = darkMode ? '#fbbf24' : '#b45309';
  const titleColor = darkMode ? '#fcd34d' : '#92400e';
  const bodyColor = Colors.sub;

  if (variant === 'apply') {
    return (
      <Text style={[styles.applyText, { color: bodyColor }]}>
        By applying, you confirm this draft has been reviewed. Build Profit Solutions is not liable
        for errors in AI-parsed scope, pricing, or suggested splits.
      </Text>
    );
  }

  if (variant === 'compact') {
    return (
      <View style={styles.compactWrap}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setCompactExpanded((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: compactExpanded }}
          style={styles.compactInline}
        >
          <MaterialIcons
            name="info-outline"
            size={14}
            color={darkMode ? 'rgba(251,191,36,0.75)' : '#b45309'}
            style={styles.compactIcon}
          />
          <Text style={[styles.compactInlineText, { color: bodyColor }]}>
            {compactExpanded ? COMPACT_DISCLAIMER : COMPACT_PREVIEW}
            {!compactExpanded ? (
              <Text style={{ color: darkMode ? 'rgba(251,191,36,0.85)' : '#b45309', fontWeight: '700' }}>
                {' '}
                Disclaimer
              </Text>
            ) : null}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.reviewBox, { borderColor, backgroundColor: bg }]}>
      <View style={styles.titleRow}>
        <MaterialIcons name="info-outline" size={17} color={iconColor} />
        <Text style={[styles.title, { color: titleColor }]}>Pricing is a guide — review before applying</Text>
      </View>
      {AI_ESTIMATE_DISCLAIMER_LINES.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: iconColor }]}>•</Text>
          <Text style={[styles.bulletText, { color: bodyColor }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  reviewBox: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  compactWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  compactInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
    maxWidth: 340,
    paddingVertical: 2,
  },
  compactIcon: {
    marginTop: 1,
  },
  compactInlineText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  applyText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
});
