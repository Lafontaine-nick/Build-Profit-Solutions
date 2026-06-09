import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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
  const showFlowChrome = fromAssistant || step != null;

  if (showFlowChrome) {
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
          <TouchableOpacity
            onPress={onBack}
            disabled={disabled}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={fromAssistant ? 'Back to AI Assistant' : 'Back'}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
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
          <View style={styles.iconBtn} />
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={BRAND_FRAME_GRADIENT_COLORS}
      start={BRAND_FRAME_GRADIENT_START}
      end={BRAND_FRAME_GRADIENT_END}
      style={[styles.gradientHeader, { paddingTop: headerTopPadding }]}
    >
      <GradientRingBackInner style={styles.headerInner}>
        <View style={styles.assistantHeaderRow}>
          <TouchableOpacity onPress={onBack} disabled={disabled} style={styles.iconBtn}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.assistantTitle, { color: Colors.text }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.assistantSubtitle, { color: Colors.sub }]}>{subtitle}</Text>
            ) : null}
          </View>
          <View style={styles.iconBtn} />
        </View>
      </GradientRingBackInner>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientHeader: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  headerInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
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
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
