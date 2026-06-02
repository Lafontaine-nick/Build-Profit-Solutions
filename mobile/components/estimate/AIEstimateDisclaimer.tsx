import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

type Props = {
  /** compact: Step 1 intro. review: Step 2 scroll. apply: above Apply button. */
  variant?: 'compact' | 'review' | 'apply';
};

export const AI_ESTIMATE_DISCLAIMER_LINES = [
  'AI organizes your notes into a draft for review — not a finished bid.',
  'You are responsible for verifying prices, scope, markup, and totals before sending to a client.',
  'Suggested labor/material splits use standard trade ratios, not numbers from your notes.',
  'This tool does not replace your professional judgment, local codes, or licensed trade requirements.',
] as const;

export default function AIEstimateDisclaimer({ variant = 'compact' }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

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
      <View style={[styles.box, { borderColor, backgroundColor: bg }]}>
        <View style={styles.titleRow}>
          <MaterialIcons name="info-outline" size={16} color={iconColor} />
          <Text style={[styles.title, { color: titleColor }]}>AI estimate disclaimer</Text>
        </View>
        <Text style={[styles.compactBody, { color: bodyColor }]}>
          Drafts help organize walkthrough notes. Always review pricing and scope before applying or
          sending a bid. Suggested labor/material splits are estimates only.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, styles.reviewBox, { borderColor, backgroundColor: bg }]}>
      <View style={styles.titleRow}>
        <MaterialIcons name="info-outline" size={17} color={iconColor} />
        <Text style={[styles.title, { color: titleColor }]}>Important — review before applying</Text>
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
  compactBody: {
    fontSize: 12,
    lineHeight: 17,
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
