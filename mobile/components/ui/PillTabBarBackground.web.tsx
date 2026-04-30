import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Web: avoid `expo-blur` / `BlurView` — they depend on native + Reanimated worklets
 * and throw `[Worklets] createSerializableObject...` in the Metro web bundle.
 * Match the pill look with a solid translucent surface instead.
 */
export default function PillTabBarBackground() {
  const { darkMode } = useTheme();
  const edge = StyleSheet.hairlineWidth;

  const inner = {
    flex: 1,
    borderRadius: 28,
    borderWidth: edge,
    borderColor: darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)',
    backgroundColor: darkMode ? 'rgba(28, 28, 30, 0.48)' : 'rgba(255,255,255,0.76)',
    shadowColor: '#000',
    shadowOpacity: darkMode ? 0.22 : 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
  } as const;

  const shellBg = darkMode ? 'rgba(18, 18, 20, 0.55)' : 'rgba(255, 255, 255, 0.55)';

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: shellBg }]}>
      <View style={inner} />
    </View>
  );
}
