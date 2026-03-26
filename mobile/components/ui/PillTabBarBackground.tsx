import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

export default function PillTabBarBackground() {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={40}
        tint={darkMode ? "dark" : "light"}
        style={StyleSheet.absoluteFillObject}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: darkMode ? 'rgba(255,255,255,0.15)' : Colors.line,
            backgroundColor: darkMode ? 'rgba(15,23,42,0.40)' : 'rgba(255,255,255,0.82)',
            shadowColor: '#000',
            shadowOpacity: darkMode ? 0.35 : 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          }}
        />
      </BlurView>
    );
  }

  // Android fallback - use solid background with similar styling
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.15)' : Colors.line,
        backgroundColor: darkMode ? 'rgba(15,23,42,0.85)' : Colors.cardDark,
        shadowColor: '#000',
        shadowOpacity: darkMode ? 0.25 : 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    />
  );
}


