/**
 * Floating Action Menu
 * Quick access to common actions like export, add lead, etc.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { c, radius, shadow } from '../ui/tokens';
import * as Haptics from 'expo-haptics';
import { Lead } from '../types';
import { exportLeadsToCSV, exportLeadsToJSON } from '../utils/exportLeads';

interface FloatingActionMenuProps {
  leads: Lead[];
  onAddLead?: () => void;
  onBulkAction?: () => void;
}

export default function FloatingActionMenu({
  leads,
  onAddLead,
  onBulkAction,
}: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.parallel([
      Animated.spring(rotation, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
      Animated.spring(menuScale, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }),
    ]).start();

    setIsOpen(!isOpen);
  };

  const handleAction = async (action: string) => {
    toggleMenu();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (action) {
      case 'export_csv':
        try {
          await exportLeadsToCSV(leads);
          Alert.alert('Success', 'Leads exported to CSV');
        } catch (error) {
          Alert.alert('Error', 'Failed to export leads');
        }
        break;

      case 'export_json':
        try {
          await exportLeadsToJSON(leads);
          Alert.alert('Success', 'Leads exported to JSON');
        } catch (error) {
          Alert.alert('Error', 'Failed to export leads');
        }
        break;

      case 'add_lead':
        onAddLead?.();
        break;

      case 'bulk':
        onBulkAction?.();
        break;

      default:
        break;
    }
  };

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const actionButtons = [
    { icon: 'add', action: 'add_lead', color: '#4CAF50', label: 'Add Lead' },
    {
      icon: 'file-download',
      action: 'export_csv',
      color: '#2196F3',
      label: 'Export CSV',
    },
    {
      icon: 'code',
      action: 'export_json',
      color: '#FF9800',
      label: 'Export JSON',
    },
    {
      icon: 'checklist',
      action: 'bulk',
      color: '#9C27B0',
      label: 'Bulk Actions',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Action Buttons */}
      {actionButtons.map((button, index) => {
        const translateY = menuScale.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(60 * (index + 1))],
        });

        return (
          <Animated.View
            key={button.action}
            style={[
              styles.actionButton,
              {
                transform: [{ translateY }, { scale: menuScale }],
                opacity: menuScale,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.actionButtonInner, { backgroundColor: button.color }]}
              onPress={() => handleAction(button.action)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={button.icon as any} size={24} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <TouchableOpacity
        style={[styles.fab, shadow.card]}
        onPress={toggleMenu}
        activeOpacity={0.9}
      >
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <MaterialIcons name="add" size={32} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  actionButton: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  actionButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
});





