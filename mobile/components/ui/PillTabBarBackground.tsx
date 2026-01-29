import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

export default function PillTabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={40}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            backgroundColor: 'rgba(15,23,42,0.40)', // subtle dark tint over blur
            shadowColor: '#000',
            shadowOpacity: 0.35,
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
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(15,23,42,0.85)',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    />
  );
}


