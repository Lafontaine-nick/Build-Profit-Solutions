import React from 'react';
import { Text, View } from 'react-native';
import { TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import {
  estimateAiAssistHintStyle,
  estimateAiAssistPillIconBadgeStyle,
  estimateAiAssistPillInnerStyle,
  estimateAiAssistPillRingStyle,
  estimateAiAssistPillTextStyle,
  estimateAiAssistRowStyle,
} from '../../utils/estimateFlowCardStyle';

type EstimateAiAssistPillProps = {
  label: string;
  onPress: () => void;
  darkMode: boolean;
  accessibilityLabel?: string;
};

export function EstimateAiAssistPill({
  label,
  onPress,
  darkMode,
  accessibilityLabel,
}: EstimateAiAssistPillProps) {
  return (
    <GestureTouchableOpacity
      onPressIn={onPress}
      activeOpacity={0.88}
      style={{ flexShrink: 0 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
        start={BRAND_FRAME_GRADIENT_START}
        end={BRAND_FRAME_GRADIENT_END}
        style={estimateAiAssistPillRingStyle()}
      >
        <View style={estimateAiAssistPillInnerStyle(darkMode)}>
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={BRAND_FRAME_GRADIENT_START}
            end={BRAND_FRAME_GRADIENT_END}
            style={estimateAiAssistPillIconBadgeStyle()}
          >
            <MaterialIcons name="auto-awesome" size={16} color="#0f172a" />
          </LinearGradient>
          <Text style={estimateAiAssistPillTextStyle(darkMode)} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </LinearGradient>
    </GestureTouchableOpacity>
  );
}

type EstimateAiAssistRowProps = {
  hint: string;
  label: string;
  onPress: () => void;
  darkMode: boolean;
  hintColor: string;
  accessibilityLabel?: string;
  containerStyle?: View['props']['style'];
};

/** Hint + unified AI pill — Build with AI (empty) or AI Assistant (populated). */
export function EstimateAiAssistRow({
  hint,
  label,
  onPress,
  darkMode,
  hintColor,
  accessibilityLabel,
  containerStyle,
}: EstimateAiAssistRowProps) {
  return (
    <View style={[estimateAiAssistRowStyle(), containerStyle]}>
      <Text style={[estimateAiAssistHintStyle(), { color: hintColor }]} numberOfLines={2}>
        {hint}
      </Text>
      <EstimateAiAssistPill
        label={label}
        onPress={onPress}
        darkMode={darkMode}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}
