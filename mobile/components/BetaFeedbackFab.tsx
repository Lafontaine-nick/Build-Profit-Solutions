import React, { useMemo } from 'react';
import { TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { isBetaFeedbackVisibleForUser } from '@/lib/betaFeedback/betaFeedbackConfig';
import type { BetaFeedbackPreset } from '@/contexts/BetaFeedbackContext';

type Props = {
  onOpen: (preset?: BetaFeedbackPreset) => void;
  /** From Clerk (provider must sit under ClerkProvider). */
  testerEmail: string | null;
};

/**
 * Subtle floating entry above the tab bar on main app routes only.
 */
export default function BetaFeedbackFab({ onOpen, testerEmail }: Props) {
  const pathname = usePathname() || '';
  const insets = useSafeAreaInsets();

  const visible = useMemo(() => {
    if (!isBetaFeedbackVisibleForUser(testerEmail)) return false;
    if (!pathname || pathname.includes('auth') || pathname.includes('onboarding')) return false;
    return true;
  }, [pathname, testerEmail]);

  const bottom = Math.max(insets.bottom, 12) + 76;

  if (!visible) return null;

  return (
    <TouchableOpacity
      accessibilityLabel="Beta feedback"
      style={[styles.fab, { bottom }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onOpen();
      }}
      activeOpacity={0.85}
    >
      <Text style={styles.fabText}>Beta</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(30,30,32,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  fabText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
