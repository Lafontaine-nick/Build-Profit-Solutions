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
    borderColor: darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.045)',
    // Dark: let more blur read through (less “slab”); light: airy frosted card
    backgroundColor: darkMode ? 'rgba(28, 28, 30, 0.48)' : 'rgba(255,255,255,0.76)',
    shadowColor: '#000',
    shadowOpacity: darkMode ? 0.22 : 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    ...(Platform.OS === 'android' ? { elevation: 6 } : {}),
  } as const;

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 56 : 48}
      tint={darkMode ? 'dark' : 'light'}
      style={StyleSheet.absoluteFillObject}
    >
      <View style={inner} />
    </BlurView>
  );
}


