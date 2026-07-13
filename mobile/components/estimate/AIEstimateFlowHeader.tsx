import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { LinearGradient } from 'expo-linear-gradient';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';

type Props = {
  title: string;
  subtitle?: string;
  step?: 1 | 2 | 3;
  stepTotal?: 2 | 3;
  fromAssistant?: boolean;
  /** Parent already applied top safe area (modal shell or assistant). */
  omitTopSafeArea?: boolean;
  disabled?: boolean;
  onBack: () => void;
};

export default function AIEstimateFlowHeader({
  title,
  subtitle,
  step,
  stepTotal = 2,
  fromAssistant = false,
  omitTopSafeArea = false,
  disabled = false,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const headerTopPadding = omitTopSafeArea
    ? Platform.OS === 'ios'
      ? 6
      : 4
    : Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;
  // Always use Build with AI chrome: theme bg + gradient-ring back (not the old teal bar + X).
  return (
    <View
      style={[
        styles.assistantHeader,
        {
          paddingTop: headerTopPadding,
          backgroundColor: Colors.bg,
          borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        },
      ]}
    >
      <View style={styles.assistantHeaderRow}>
        <View style={styles.headerSide}>
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={BRAND_FRAME_GRADIENT_START}
            end={BRAND_FRAME_GRADIENT_END}
            style={styles.backButtonBorder}
          >
            <GradientRingBackInner
              darkMode={darkMode}
              onPress={() => {
                if (!disabled) onBack();
              }}
              accessibilityLabel={fromAssistant ? 'Back to AI Assistant' : 'Back'}
              style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={darkMode ? '#FFFFFF' : Colors.text}
              />
            </GradientRingBackInner>
          </LinearGradient>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {step != null ? (
            <Text style={[styles.stepLabel, { color: Colors.sub }]}>
              Step {step} of {stepTotal}
            </Text>
          ) : null}
          <Text style={[styles.assistantTitle, { color: Colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.assistantSubtitle, { color: Colors.sub }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSide} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  assistantHeader: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  headerSide: { width: 52, alignItems: 'flex-start' },
  backButtonBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  assistantTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  assistantSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
