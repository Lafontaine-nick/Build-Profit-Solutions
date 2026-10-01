import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

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
  onMenuPress?: () => void;
  menuAccessibilityLabel?: string;
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
  onMenuPress,
  menuAccessibilityLabel = 'More options',
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const headerTopPadding = omitTopSafeArea
    ? Platform.OS === 'ios'
      ? 6
      : 4
    : Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;
  // Gray circle back, same as the other refined estimate forms.
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
          <TouchableOpacity
            onPress={() => {
              if (!disabled) onBack();
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={fromAssistant ? 'Back to AI Assistant' : 'Back'}
            hitSlop={12}
            style={[
              styles.backButton,
              {
                backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : (Colors.surface2 ?? '#f3f4f6'),
              },
            ]}
          >
            <MaterialIcons
              name="chevron-left"
              size={26}
              color={darkMode ? '#e2e8f0' : Colors.text}
            />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {step != null ? (
            <Text style={styles.stepLabel}>
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
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {onMenuPress ? (
            <TouchableOpacity
              onPress={() => {
                if (!disabled) onMenuPress();
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={menuAccessibilityLabel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.menuButton}
            >
              <MaterialIcons
                name="more-vert"
                size={24}
                color={darkMode ? '#FFFFFF' : Colors.text}
              />
            </TouchableOpacity>
          ) : null}
        </View>
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
  headerSideRight: { alignItems: 'flex-end' },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.12,
    marginBottom: 2,
    color: '#94a3b8',
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
