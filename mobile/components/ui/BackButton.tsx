import React, { useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '@/components/ui/PressableScale';

export const BACK_BUTTON_SIZE = 44;
const MINT = '#2dcc9a';

type Props = {
  onPress: () => void;
  darkMode: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Header back: iOS chevron in a 44pt neutral circle. Same size as the header avatar. */
export default function BackButton({ onPress, darkMode, accessibilityLabel = 'Back', style }: Props) {
  const [pressed, setPressed] = useState(false);
  const restColor = darkMode ? '#FFFFFF' : '#0f172a';

  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      containerStyle={style}
      style={[
        styles.circle,
        darkMode ? styles.circleDark : styles.circleLight,
        pressed && styles.circlePressed,
      ]}
    >
      <Ionicons
        name="chevron-back"
        size={24}
        color={pressed ? MINT : restColor}
        style={styles.icon}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: BACK_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  circleLight: {
    backgroundColor: 'rgba(15,23,42,0.06)',
    borderColor: 'rgba(15,23,42,0.08)',
  },
  circlePressed: {
    backgroundColor: 'rgba(45, 204, 154, 0.16)',
    borderColor: 'rgba(45, 204, 154, 0.55)',
  },
  icon: {
    marginLeft: -1.5,
  },
});
