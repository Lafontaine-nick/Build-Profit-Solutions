import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Native (iOS/Android): floating dock using real blur.
 * Web uses `PillTabBarBackground.web.tsx` — `expo-blur` triggers Worklets errors on Metro web.
 */
export default function PillTabBarBackground() {
  const { darkMode } = useTheme();

  const edge = StyleSheet.hairlineWidth;

  const inner = {
    flex: 1,
    borderRadius: 28,
    borderWidth: edge,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    backgroundColor: darkMode ? 'rgba(12, 12, 14, 0.70)' : 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#000',
    shadowOpacity: darkMode ? 0.22 : 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
  } as const;

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 80 : 72}
      tint={darkMode ? 'dark' : 'light'}
      style={StyleSheet.absoluteFillObject}
    >
      <View style={inner} />
    </BlurView>
  );
}


