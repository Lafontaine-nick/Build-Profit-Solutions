import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function LoadingScreen() {
  const { darkMode } = useTheme();

  const backgroundColor = darkMode ? '#14213D' : '#E0E0E0';
  const textColor = darkMode ? '#E0E0E0' : '#333333';
  const accentColor = '#1B365D';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ActivityIndicator size='large' color={accentColor} />
      <Text style={[styles.loadingText, { color: textColor }]}>
        Loading user role...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
