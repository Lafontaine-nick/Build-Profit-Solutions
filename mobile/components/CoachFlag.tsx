import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

interface CoachFlagProps {
  id: string;
  label: string;
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  onDismiss?: () => void;
}

export default function CoachFlag({ 
  id, 
  label, 
  text, 
  position = 'bottom',
  delay = 300,
  onDismiss 
}: CoachFlagProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const checkDismissed = async () => {
      try {
        const dismissedFlags = await AsyncStorage.getItem('bps.dismissedCoachFlags');
        const flags = dismissedFlags ? JSON.parse(dismissedFlags) : [];
        if (flags.includes(id)) {
          setDismissed(true);
          return;
        }
        
        // Show flag after delay
        setTimeout(() => {
          setVisible(true);
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }, delay);
      } catch (error) {
        console.error('Error checking coach flag:', error);
      }
    };

    checkDismissed();
  }, [id, delay]);

  const handleDismiss = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setDismissed(true);
    });

    try {
      const dismissedFlags = await AsyncStorage.getItem('bps.dismissedCoachFlags');
      const flags = dismissedFlags ? JSON.parse(dismissedFlags) : [];
      if (!flags.includes(id)) {
        flags.push(id);
        await AsyncStorage.setItem('bps.dismissedCoachFlags', JSON.stringify(flags));
      }
    } catch (error) {
      console.error('Error saving dismissed flag:', error);
    }

    if (onDismiss) {
      onDismiss();
    }
  };

  if (dismissed || !visible) return null;

  const positionStyles = {
    top: { top: 8 },
    bottom: { bottom: 8 },
    left: { left: 8 },
    right: { right: 8 },
  };

  return (
    <Animated.View
      style={[
        styles.container,
        positionStyles[position],
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleDismiss}
        style={styles.flag}
      >
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
        </View>
        <Text style={styles.text}>{text}</Text>
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 0,
  },
  flag: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderRadius: 12,
    padding: 12,
    paddingRight: 32,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  labelContainer: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22c55e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 13,
    color: '#f9fafb',
    fontWeight: '500',
    lineHeight: 18,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
});
