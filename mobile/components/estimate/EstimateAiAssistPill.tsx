import React from 'react';
import { Text, View } from 'react-native';
import { TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import {
  estimateAiAssistHintStyle,
  estimateAiAssistPillIconBadgeStyle,
  estimateAiAssistPillShellStyle,
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
      style={estimateAiAssistPillShellStyle(darkMode)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <LinearGradient
        colors={['#2DFFC4', '#00A6FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={estimateAiAssistPillIconBadgeStyle()}
      >
        <MaterialIcons name="auto-awesome" size={16} color="#0f172a" />
      </LinearGradient>
      <Text style={estimateAiAssistPillTextStyle()} numberOfLines={1}>
        {label}
      </Text>
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
