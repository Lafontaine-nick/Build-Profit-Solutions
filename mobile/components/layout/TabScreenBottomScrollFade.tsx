import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { getTabBarUnderlayHeight, isDesktopWebLayoutWidth } from '@/constants/ScreenLayout';

/**
 * Dims scroll content only inside the floating tab pill footprint (bottom of screen).
 * Does NOT add a blur band above the nav — content fades as it passes behind the pill.
 */
export default function TabScreenBottomScrollFade() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  if (isDesktopWebLayoutWidth(width)) {
    return null;
  }

  const height = getTabBarUnderlayHeight(insets.bottom);
  const base = Colors.bg;

  const colors = darkMode
    ? (['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.72)', base] as const)
    : (['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.65)', base] as const);

  const locations = darkMode
    ? ([0, 0.35, 0.7, 1] as const)
    : ([0, 0.35, 0.7, 1] as const);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[styles.shell, { height }]}
    >
      <LinearGradient
        colors={[...colors]}
        locations={[...locations]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
  },
});
