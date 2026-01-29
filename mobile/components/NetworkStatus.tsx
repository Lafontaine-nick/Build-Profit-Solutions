import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function NetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { darkMode } = useTheme();

  const theme = darkMode
    ? {
        background: '#1B365D',
        text: '#fff',
        error: '#FF6B6B',
        success: '#4CAF50',
      }
    : {
        background: '#fff',
        text: '#222',
        error: '#F44336',
        success: '#4CAF50',
      };

  useEffect(() => {
    // Simulate network status check
    const checkNetworkStatus = async () => {
      try {
        const response = await fetch('http://10.0.2.2:8000/health', {
          method: 'GET',
          timeout: 5000,
        });
        const wasConnected = isConnected;
        const newConnected = response.ok;

        if (wasConnected !== newConnected) {
          setIsConnected(newConnected);
          setIsVisible(true);

          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();

          // Hide after 3 seconds
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => setIsVisible(false));
          }, 3000);
        }
      } catch (error) {
        if (isConnected) {
          setIsConnected(false);
          setIsVisible(true);

          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();

          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => setIsVisible(false));
          }, 3000);
        }
      }
    };

    const interval = setInterval(checkNetworkStatus, 10000); // Check every 10 seconds
    checkNetworkStatus(); // Initial check

    return () => clearInterval(interval);
  }, [isConnected]);

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: isConnected ? theme.success : theme.error,
          opacity: fadeAnim,
        },
      ]}
    >
      <MaterialIcons
        name={isConnected ? 'wifi' : 'wifi-off'}
        size={16}
        color='#fff'
      />
      <Text style={styles.text}>
        {isConnected ? 'Connected' : 'No Connection'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
