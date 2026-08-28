import React, { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { TouchableOpacity as GestureTouchableOpacity } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: object | object[];
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  accessibilityState?: { expanded?: boolean; disabled?: boolean };
  activeOpacity?: number;
  /** Touch feedback strength — Apply CTAs use medium. */
  haptic?: 'light' | 'medium' | 'none';
};

function fireHaptic(strength: 'light' | 'medium' = 'light') {
  if (Platform.OS === 'web') return;
  const style =
    strength === 'medium'
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light;
  void Haptics.impactAsync(style).catch(() => {});
}

/** First-tap-safe press for buttons inside AI flow scroll views. */
export default function ReliableFlowPress({
  onPress,
  disabled,
  children,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  activeOpacity = 0.82,
  haptic = 'light',
}: Props) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const lockRef = useRef(false);

  const fire = useCallback(() => {
    if (disabled || lockRef.current) return;
    lockRef.current = true;
    if (haptic !== 'none') fireHaptic(haptic);
    onPressRef.current();
    setTimeout(() => {
      lockRef.current = false;
    }, 280);
  }, [disabled, haptic]);

  return (
    <GestureTouchableOpacity
      onPressIn={fire}
      disabled={disabled}
      activeOpacity={activeOpacity}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={style}
    >
      {children}
    </GestureTouchableOpacity>
  );
}
