import React from 'react';
import { View, Switch, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Typography } from '../constants/Typography';

interface PageHeaderProps {
  title?: string;
  onBackPress?: () => void;
  showThemeToggle?: boolean;
}

export default function PageHeader({
  title,
  onBackPress,
  showThemeToggle = true,
}: PageHeaderProps) {
  const { darkMode, setDarkMode } = useTheme();

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.titleContainer}>
          {onBackPress && (
            <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
              <MaterialIcons
                name='arrow-back'
                size={24}
                color={darkMode ? '#43cea2' : '#1976d2'}
              />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: darkMode ? '#fff' : '#222' }]}>
            {title}
          </Text>
        </View>
      )}
      {showThemeToggle && (
        <View style={styles.themeToggle}>
          <MaterialIcons
            name={darkMode ? 'brightness-4' : 'brightness-7'}
            size={24}
            color={darkMode ? '#43cea2' : '#1976d2'}
            style={styles.icon}
          />
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            thumbColor={darkMode ? '#43cea2' : '#1976d2'}
            trackColor={{ true: '#22304a', false: '#ccc' }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(67, 206, 162, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    marginRight: 8,
  },
});
