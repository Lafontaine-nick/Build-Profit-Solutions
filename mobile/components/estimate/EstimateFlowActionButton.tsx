import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { estimateStep1ActionButtonStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  line: string;
  surface2: string;
  text: string;
};

type Props = {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  /** Locks icon to green or blue in every state (selected or not). */
  iconAccent?: 'green' | 'blue';
  Colors: Colors;
  darkMode: boolean;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  /** Tint + ring when selected — green (Camera / Whole project) or blue (Library / Single trade). */
  selectedAccent?: 'green' | 'blue';
  onPress: () => void;
  style?: ViewStyle;
  labelStyle?: { fontSize?: number; numberOfLines?: number };
};

export default function EstimateFlowActionButton({
  label,
  icon,
  iconColor,
  Colors,
  darkMode,
  disabled = false,
  loading = false,
  selected = false,
  onPress,
  style,
  labelStyle,
}: Props) {
  const resolvedIconColor = selected ? '#050B13' : iconColor || '#94a3b8';
  const shellLayout = {
    flex: 1 as const,
    minHeight: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    opacity: disabled || loading ? 0.45 : 1,
  };
  const shellStyle =
    selected
      ? {
          ...shellLayout,
          borderWidth: 1,
          borderColor: '#2dcc9a',
          backgroundColor: '#2dcc9a',
        }
      : {
          ...shellLayout,
          ...estimateStep1ActionButtonStyle(Colors, darkMode, {
            disabled: disabled || loading,
          }),
        };
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[shellStyle, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={resolvedIconColor} />
      ) : icon ? (
        <MaterialIcons name={icon} size={18} color={resolvedIconColor} />
      ) : null}
      <Text
        style={{
          color: selected ? '#050B13' : Colors.text,
          fontSize: labelStyle?.fontSize ?? 13,
          fontWeight: '700',
          textAlign: icon ? undefined : 'center',
        }}
        numberOfLines={labelStyle?.numberOfLines}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
