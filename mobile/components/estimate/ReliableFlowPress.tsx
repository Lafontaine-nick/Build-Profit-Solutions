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
};

function fireHaptic() {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
}: Props) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const lockRef = useRef(false);

  const fire = useCallback(() => {
    if (disabled || lockRef.current) return;
    lockRef.current = true;
    fireHaptic();
    onPressRef.current();
    setTimeout(() => {
      lockRef.current = false;
    }, 400);
  }, [disabled]);

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
