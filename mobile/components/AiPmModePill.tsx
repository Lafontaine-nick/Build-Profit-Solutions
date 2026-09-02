import React from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import {
  estimateAiAssistPillIconBadgeStyle,
  estimateAiAssistPillInnerStyle,
  estimateAiAssistPillRingStyle,
  estimateAiAssistPillTextStyle,
} from '@/utils/estimateFlowCardStyle';

const OFF_RING_COLORS: [string, string] = ['#3f3f46', '#18181b'];

type AiPmModePillProps = {
  active: boolean;
  label: string;
  onPress: () => void;
  darkMode: boolean;
  size?: 'default' | 'compact';
  elevated?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function AiPmModePill({
  active,
  label,
  onPress,
  darkMode,
  size = 'default',
  elevated = false,
  style,
  accessibilityLabel,
}: AiPmModePillProps) {
  const compact = size === 'compact';
  const iconSize = compact ? 14 : 15;
  const badgeSize = compact ? 26 : 32;
  const badgeRadius = badgeSize / 2;

  return (
    <Pressable
      onPress={onPress}
      style={[
        elevated && {
          shadowColor: '#000000',
          shadowOpacity: compact ? 0.22 : 0.35,
          shadowRadius: compact ? 8 : 10,
          shadowOffset: { width: 0, height: 3 },
          ...(Platform.OS === 'android' ? { elevation: 5 } : null),
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient
        colors={active ? BRAND_FRAME_GRADIENT_COLORS : OFF_RING_COLORS}
        start={active ? BRAND_FRAME_GRADIENT_START : { x: 0, y: 0 }}
        end={active ? BRAND_FRAME_GRADIENT_END : { x: 1, y: 1 }}
        style={estimateAiAssistPillRingStyle()}
      >
        <View
          style={[
            estimateAiAssistPillInnerStyle(darkMode),
            compact && { paddingRight: 11, paddingLeft: 4, paddingVertical: 4 },
          ]}
        >
          {active ? (
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={[
                estimateAiAssistPillIconBadgeStyle(),
                { width: badgeSize, height: badgeSize, borderRadius: badgeRadius },
              ]}
            >
              <Ionicons name="sparkles" size={iconSize} color="#0f172a" />
            </LinearGradient>
          ) : (
            <View
              style={[
                estimateAiAssistPillIconBadgeStyle(),
                { width: badgeSize, height: badgeSize, borderRadius: badgeRadius },
                { backgroundColor: 'rgba(255,255,255,0.08)' },
              ]}
            >
              <Ionicons name="sparkles" size={iconSize} color="#d4d4d8" />
            </View>
          )}
          <Text
            style={[
              estimateAiAssistPillTextStyle(darkMode),
              compact && { fontSize: 10, marginLeft: 6 },
              !active && { color: '#d4d4d8', fontWeight: '600' },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
